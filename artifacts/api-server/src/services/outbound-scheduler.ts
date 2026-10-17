/**
 * B2B Outbound Sequence Scheduler
 *
 * Her 5 dakikada bir çalışır. Aktif kampanyalarda:
 *   1. `next_send_at <= NOW()` olan pending/in_progress lead'leri bulur
 *   2. Kampanya günlük limitini kontrol eder (business hours + tz)
 *   3. Uygun step'in template'ini render eder + gönderir
 *   4. Sonraki step için `next_send_at` = now + delayDays hesaplar
 *   5. Son step ise status = "completed"
 *
 * ENV:
 *   OUTBOUND_SCHEDULER_ENABLED=true      (production'da aktif)
 *   OUTBOUND_SEND_HOURS_START=9          (default 9)
 *   OUTBOUND_SEND_HOURS_END=17           (default 17)
 */

import {
  db, pool,
  outboundCampaignsTable, outboundSequenceStepsTable,
  outboundCampaignLeadsTable, outboundEmailEventsTable,
  outboundTemplatesTable, outreachLeadsTable,
} from "@workspace/db";
import { and, eq, lte, sql, inArray, count } from "drizzle-orm";
import { sendOutboundEmail, renderTemplate } from "./email-provider.js";

/**
 * NOT (cluster): Scheduler PRIMARY süreçte çalışır (index.ts, diğer cron'larla birlikte).
 * Eskiden worker id=1'de başlıyordu; worker 1 çöküp yeniden açılınca yeni id 1 olmadığı için
 * scheduler sessizce ölüyordu. Durum bilgisi süreç belleğinde değil DB'de tutulur
 * (outbound_scheduler_state) — admin isteği hangi worker'a düşerse düşsün doğru görünür.
 * Aynı anda iki tick (otomatik + admin "şimdi dene") çift mail atmasın diye
 * pg advisory lock kullanılır.
 */

const TICK_INTERVAL_MS = 5 * 60 * 1000; // 5 dakika
const LOCK_KEY = 728_101; // outbound-scheduler için sabit advisory lock anahtarı
let timer: NodeJS.Timeout | null = null;
let lastDebug: any = null;

async function ensureStateTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS outbound_scheduler_state (
      id INT PRIMARY KEY DEFAULT 1,
      started_at TIMESTAMPTZ,
      started_pid INT,
      last_tick_at TIMESTAMPTZ,
      last_tick_error TEXT,
      last_tick_forced BOOLEAN DEFAULT false,
      tick_count INT NOT NULL DEFAULT 0,
      last_debug JSONB,
      CONSTRAINT outbound_scheduler_state_single CHECK (id = 1)
    )`);
  await pool.query(`INSERT INTO outbound_scheduler_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING`);
}

async function recordStart() {
  await ensureStateTable();
  await pool.query(
    `UPDATE outbound_scheduler_state SET started_at = NOW(), started_pid = $1 WHERE id = 1`,
    [process.pid],
  );
}

async function recordTick(error: string | null, forced: boolean) {
  try {
    await pool.query(
      `UPDATE outbound_scheduler_state
         SET last_tick_at = NOW(), last_tick_error = $1, last_tick_forced = $2,
             tick_count = tick_count + 1, last_debug = $3::jsonb
       WHERE id = 1`,
      [error, forced, lastDebug ? JSON.stringify(lastDebug) : null],
    );
  } catch (e: any) {
    console.error("[outbound-scheduler] durum kaydedilemedi:", e?.message);
  }
}

export async function getSchedulerStatus() {
  await ensureStateTable();
  const { rows } = await pool.query(`SELECT * FROM outbound_scheduler_state WHERE id = 1`);
  const s = rows[0] ?? {};
  const lastTickAt: Date | null = s.last_tick_at ?? null;
  // Otomatik tick 5 dk'da bir; 12 dk içinde tick yoksa scheduler ölü sayılır.
  const alive = Boolean(lastTickAt && Date.now() - new Date(lastTickAt).getTime() < 12 * 60 * 1000);
  return {
    started: Boolean(s.started_at) && alive,
    alive,
    startedAt: s.started_at ?? null,
    startedPid: s.started_pid ?? null,
    lastTickAt,
    lastTickError: s.last_tick_error ?? null,
    lastTickForced: s.last_tick_forced ?? false,
    tickCount: s.tick_count ?? 0,
    envEnabled: process.env.OUTBOUND_SCHEDULER_ENABLED === "true",
    skipBusinessHours: process.env.OUTBOUND_SKIP_BUSINESS_HOURS === "true",
    allowWeekend: process.env.OUTBOUND_ALLOW_WEEKEND === "true",
    inBusinessHours: isInBusinessHours(),
    lastDebug: s.last_debug ?? null,
  };
}

/** Manuel tick — admin panel'den tetiklenir, business hours atlar. Hata/uyarı kodunu döner. */
export async function forceTick(): Promise<string | null> {
  return tick(true);
}

export function startOutboundScheduler() {
  if (process.env.OUTBOUND_SCHEDULER_ENABLED !== "true") {
    console.log("[outbound-scheduler] Devre dışı (OUTBOUND_SCHEDULER_ENABLED != true)");
    return;
  }
  if (timer) return;
  console.log(`[outbound-scheduler] Başlatıldı (pid ${process.pid}), her 5 dakikada bir çalışacak`);
  recordStart().catch((e) => console.error("[outbound-scheduler] start kaydı:", e?.message));
  const run = () => tick().catch((e) => console.error("[outbound-scheduler] tick error:", e?.message));
  // İlk çalışma: 30 saniye sonra (app boot bekle)
  setTimeout(run, 30_000);
  timer = setInterval(run, TICK_INTERVAL_MS);
}

export function stopOutboundScheduler() {
  if (timer) { clearInterval(timer); timer = null; }
}

async function tick(force = false): Promise<string | null> {
  // Süreçler arası kilit: aynı anda tek tick (çift gönderimi önler)
  const client = await pool.connect();
  let locked = false;
  let error: string | null = null;
  lastDebug = null;
  try {
    const { rows } = await client.query(`SELECT pg_try_advisory_lock($1) AS ok`, [LOCK_KEY]);
    locked = Boolean(rows[0]?.ok);
    if (!locked) {
      error = "another_tick_running";
      return error;
    }

    // Business hours kontrolü — TR zaman diliminde çalıştır
    if (!force && !isInBusinessHours()) {
      error = "outside_business_hours";
      return error;
    }

    // Aktif kampanyaları çek
    const activeCampaigns = await db.select().from(outboundCampaignsTable)
      .where(eq(outboundCampaignsTable.status, "active"));
    if (activeCampaigns.length === 0) error = "no_active_campaigns";

    for (const campaign of activeCampaigns) {
      try {
        await processCampaign(campaign);
      } catch (e: any) {
        console.error(`[outbound-scheduler] campaign ${campaign.id} error:`, e?.message);
        error = `campaign_${campaign.id}: ${e?.message ?? "error"}`;
      }
    }
    return error;
  } catch (e: any) {
    error = e?.message ?? "tick_failed";
    throw e;
  } finally {
    if (locked) {
      await client.query(`SELECT pg_advisory_unlock($1)`, [LOCK_KEY]).catch(() => {});
    }
    client.release();
    // Kilit alınamadıysa durum satırını ezme (diğer tick yazacak)
    if (error !== "another_tick_running") await recordTick(error, force);
  }
}

function isInBusinessHours(): boolean {
  // Test / dev için tüm kontrolleri atla
  if (process.env.OUTBOUND_SKIP_BUSINESS_HOURS === "true") return true;

  const startHour = Number(process.env.OUTBOUND_SEND_HOURS_START || 9);
  const endHour = Number(process.env.OUTBOUND_SEND_HOURS_END || 17);
  const now = new Date();
  // TR saati
  const tr = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Istanbul" }));
  const dow = tr.getDay(); // 0=Sunday, 6=Saturday
  if (dow === 0 || dow === 6) {
    // Hafta sonu — opsiyonel bypass
    if (process.env.OUTBOUND_ALLOW_WEEKEND !== "true") return false;
  }
  const h = tr.getHours();
  return h >= startHour && h < endHour;
}

async function processCampaign(campaign: any) {
  const dbg: any = { campaignId: campaign.id, campaignName: campaign.name };
  lastDebug = dbg;

  // Bu kampanyanın step'leri
  const steps = await db.select().from(outboundSequenceStepsTable)
    .where(eq(outboundSequenceStepsTable.campaignId, campaign.id))
    .orderBy(outboundSequenceStepsTable.stepOrder);

  dbg.stepsCount = steps.length;
  if (steps.length === 0) { dbg.exit = "no_steps"; return; }

  // Günlük gönderilen sayısı (bugün, bu kampanya)
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const [{ n: sentToday }] = await db.select({ n: count() })
    .from(outboundEmailEventsTable)
    .where(and(
      eq(outboundEmailEventsTable.campaignId, campaign.id),
      eq(outboundEmailEventsTable.eventType, "sent"),
      // occurredAt >= todayStart — SQL raw kullan
      sql`${outboundEmailEventsTable.occurredAt} >= ${todayStart}`,
    ));

  const remainingBudget = campaign.dailySendLimit - Number(sentToday);
  dbg.sentToday = Number(sentToday);
  dbg.remainingBudget = remainingBudget;
  if (remainingBudget <= 0) { dbg.exit = "no_budget"; return; }

  // Global suppression list — unsubscribe veya spam/bounce olmuş leadIds
  // KVKK: Herhangi bir kampanyada unsubscribe olan user başka kampanyaya eklense bile mail almasın
  const suppressedRows = await db.selectDistinct({ leadId: outboundEmailEventsTable.leadId })
    .from(outboundEmailEventsTable)
    .where(inArray(outboundEmailEventsTable.eventType, ["unsubscribed", "spam", "bounced"]));
  const suppressedIds = new Set(suppressedRows.map((r) => r.leadId));
  dbg.suppressedCount = suppressedIds.size;

  // Gönderilecek lead'leri bul: pending/in_progress + next_send_at <= now + status uygun
  const candidateLeads = await db.select().from(outboundCampaignLeadsTable)
    .where(and(
      eq(outboundCampaignLeadsTable.campaignId, campaign.id),
      inArray(outboundCampaignLeadsTable.status, ["pending", "in_progress"]),
      lte(outboundCampaignLeadsTable.nextSendAt, new Date()),
    ))
    .limit(remainingBudget * 2); // suppressed filtresi sonrası yetsin diye 2x al

  // Suppression filtresi uygula
  const readyLeads = candidateLeads
    .filter((cl) => !suppressedIds.has(cl.leadId))
    .slice(0, remainingBudget);

  const skippedBySuppression = candidateLeads.length - readyLeads.length;
  if (skippedBySuppression > 0) dbg.skippedBySuppression = skippedBySuppression;

  // Suppressed leadleri bu kampanya için de "unsubscribed" olarak işaretle (bir daha denenmesin)
  const toMarkSuppressed = candidateLeads.filter((cl) => suppressedIds.has(cl.leadId));
  for (const cl of toMarkSuppressed) {
    await db.update(outboundCampaignLeadsTable)
      .set({ status: "unsubscribed", lastEventAt: new Date(), nextSendAt: null })
      .where(eq(outboundCampaignLeadsTable.id, cl.id));
  }

  dbg.readyLeadsCount = readyLeads.length;
  dbg.readyLeadIds = readyLeads.map(l => l.leadId);

  const sendResults: any[] = [];
  for (const cl of readyLeads) {
    try {
      const r = await sendNextStep(campaign, cl, steps);
      sendResults.push({ leadId: cl.leadId, ...r });
    } catch (e: any) {
      console.error(`[outbound-scheduler] lead ${cl.leadId} in campaign ${campaign.id}:`, e?.message);
      sendResults.push({ leadId: cl.leadId, error: e?.message });
    }
  }
  dbg.sendResults = sendResults;
  dbg.exit = "completed";
}

async function sendNextStep(campaign: any, cl: any, steps: any[]) {
  const nextStepIdx = cl.currentStep; // 0-indexed
  if (nextStepIdx >= steps.length) {
    // Tüm step'ler bitti
    await db.update(outboundCampaignLeadsTable)
      .set({ status: "completed", nextSendAt: null, lastEventAt: new Date() })
      .where(eq(outboundCampaignLeadsTable.id, cl.id));
    return { skipped: "all_steps_done" };
  }
  const step = steps[nextStepIdx];

  // Template'i çek
  const [tpl] = await db.select().from(outboundTemplatesTable)
    .where(eq(outboundTemplatesTable.id, step.templateId));
  if (!tpl) return { skipped: "template_not_found", templateId: step.templateId };

  // Lead'i çek
  const [lead] = await db.select().from(outreachLeadsTable)
    .where(eq(outreachLeadsTable.id, cl.leadId));
  if (!lead) return { skipped: "lead_not_found", leadId: cl.leadId };
  if (!lead.email) return { skipped: "no_email", leadId: cl.leadId };

  // Kontrol: bu step'te "no_reply" koşulu varsa ve reply gelmiş mi?
  if (step.condition === "no_reply" && cl.status === "replied") {
    // Cevap gelmiş, sonraki step'i skip et
    await db.update(outboundCampaignLeadsTable)
      .set({ currentStep: nextStepIdx + 1, nextSendAt: new Date() })
      .where(eq(outboundCampaignLeadsTable.id, cl.id));
    return;
  }

  const subject = renderTemplate(tpl.subject, lead);
  const html = wrapWithFooter(renderTemplate(tpl.bodyHtml, lead), campaign.id, cl.leadId);
  const text = renderTemplate(tpl.bodyText || tpl.bodyHtml.replace(/<[^>]+>/g, ""), lead);

  const result = await sendOutboundEmail({
    to: lead.email,
    toName: lead.fullName || undefined,
    from: campaign.fromEmail,
    fromName: campaign.fromName,
    replyTo: campaign.replyToEmail || campaign.fromEmail,
    subject, html, text,
    customArgs: {
      campaign_id: String(campaign.id),
      lead_id: String(cl.leadId),
      step_id: String(step.id),
      template_id: String(tpl.id),
    },
  });

  if (!result.ok) {
    console.error(`[outbound-scheduler] send failed lead ${lead.id}: ${result.error}`);
    return { sendFailed: result.error, leadEmail: lead.email };
  }

  // Event kaydet
  await db.insert(outboundEmailEventsTable).values({
    campaignId: campaign.id,
    leadId: cl.leadId,
    stepId: step.id,
    templateId: tpl.id,
    eventType: "sent",
    providerMessageId: result.messageId || null,
    occurredAt: new Date(),
  });

  // Kampanya sayacı
  await db.update(outboundCampaignsTable)
    .set({
      emailsSent: sql`${outboundCampaignsTable.emailsSent} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(outboundCampaignsTable.id, campaign.id));

  // Lead durumu ilerlet
  const isLastStep = nextStepIdx + 1 >= steps.length;
  const nextStep = !isLastStep ? steps[nextStepIdx + 1] : null;
  const nextSendAt = nextStep
    ? new Date(Date.now() + (nextStep.delayDays || 0) * 24 * 60 * 60 * 1000)
    : null;

  await db.update(outboundCampaignLeadsTable)
    .set({
      currentStep: nextStepIdx + 1,
      status: isLastStep ? "completed" : "in_progress",
      nextSendAt,
      lastEventAt: new Date(),
    })
    .where(eq(outboundCampaignLeadsTable.id, cl.id));

  // Log
  console.log(`[outbound-scheduler] ✓ campaign=${campaign.id} lead=${cl.leadId} step=${nextStepIdx + 1}/${steps.length}`);
  return { sent: true, to: lead.email, step: nextStepIdx + 1, messageId: result.messageId };
}

/**
 * E-postanın altına unsubscribe + tracking footer'ı ekler.
 * KVKK gereği unsubscribe link zorunlu.
 */
function wrapWithFooter(html: string, campaignId: number, leadId: number): string {
  const base = process.env.PUBLIC_API_URL || "https://api.sphereenglish.com";
  const unsubUrl = `${base}/outbound/unsubscribe?c=${campaignId}&l=${leadId}`;

  const footer = `
    <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e8eef8;font-family:sans-serif;font-size:11px;color:#8ba7d9;">
      Bu e-postayı Sphere English'ten aldınız. Bir daha e-posta almak istemiyorsanız
      <a href="${unsubUrl}" style="color:#0e7da6;text-decoration:underline;">bu bağlantıya tıklayın</a>.<br>
      Sphere English · İş İngilizcesi Eğitim Platformu · İstanbul, TR
    </div>
  `;
  return html + footer;
}
