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
  db,
  outboundCampaignsTable, outboundSequenceStepsTable,
  outboundCampaignLeadsTable, outboundEmailEventsTable,
  outboundTemplatesTable, outreachLeadsTable,
} from "@workspace/db";
import { and, eq, lte, sql, inArray, count } from "drizzle-orm";
import { sendOutboundEmail, renderTemplate } from "./email-provider.js";

const TICK_INTERVAL_MS = 5 * 60 * 1000; // 5 dakika
let timer: NodeJS.Timeout | null = null;
let running = false;

export function startOutboundScheduler() {
  if (process.env.OUTBOUND_SCHEDULER_ENABLED !== "true") {
    console.log("[outbound-scheduler] Devre dışı (OUTBOUND_SCHEDULER_ENABLED != true)");
    return;
  }
  if (timer) return;
  console.log("[outbound-scheduler] Başlatıldı, her 5 dakikada bir çalışacak");
  // İlk çalışma: 30 saniye sonra (app boot bekle)
  setTimeout(() => tick().catch(e => console.error("[outbound-scheduler] tick error:", e?.message)), 30_000);
  timer = setInterval(() => {
    tick().catch(e => console.error("[outbound-scheduler] tick error:", e?.message));
  }, TICK_INTERVAL_MS);
}

export function stopOutboundScheduler() {
  if (timer) { clearInterval(timer); timer = null; }
}

async function tick() {
  if (running) return;
  running = true;
  try {
    // Business hours kontrolü — TR zaman diliminde çalıştır
    if (!isInBusinessHours()) return;

    // Aktif kampanyaları çek
    const activeCampaigns = await db.select().from(outboundCampaignsTable)
      .where(eq(outboundCampaignsTable.status, "active"));

    for (const campaign of activeCampaigns) {
      try {
        await processCampaign(campaign);
      } catch (e: any) {
        console.error(`[outbound-scheduler] campaign ${campaign.id} error:`, e?.message);
      }
    }
  } finally {
    running = false;
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
  // Bu kampanyanın step'leri
  const steps = await db.select().from(outboundSequenceStepsTable)
    .where(eq(outboundSequenceStepsTable.campaignId, campaign.id))
    .orderBy(outboundSequenceStepsTable.stepOrder);

  if (steps.length === 0) return; // Step yok, iş yok

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
  if (remainingBudget <= 0) return;

  // Gönderilecek lead'leri bul: pending/in_progress + next_send_at <= now + status uygun
  const readyLeads = await db.select().from(outboundCampaignLeadsTable)
    .where(and(
      eq(outboundCampaignLeadsTable.campaignId, campaign.id),
      inArray(outboundCampaignLeadsTable.status, ["pending", "in_progress"]),
      lte(outboundCampaignLeadsTable.nextSendAt, new Date()),
    ))
    .limit(remainingBudget);

  for (const cl of readyLeads) {
    try {
      await sendNextStep(campaign, cl, steps);
    } catch (e: any) {
      console.error(`[outbound-scheduler] lead ${cl.leadId} in campaign ${campaign.id}:`, e?.message);
    }
  }
}

async function sendNextStep(campaign: any, cl: any, steps: any[]) {
  const nextStepIdx = cl.currentStep; // 0-indexed
  if (nextStepIdx >= steps.length) {
    // Tüm step'ler bitti
    await db.update(outboundCampaignLeadsTable)
      .set({ status: "completed", nextSendAt: null, lastEventAt: new Date() })
      .where(eq(outboundCampaignLeadsTable.id, cl.id));
    return;
  }
  const step = steps[nextStepIdx];

  // Template'i çek
  const [tpl] = await db.select().from(outboundTemplatesTable)
    .where(eq(outboundTemplatesTable.id, step.templateId));
  if (!tpl) return;

  // Lead'i çek
  const [lead] = await db.select().from(outreachLeadsTable)
    .where(eq(outreachLeadsTable.id, cl.leadId));
  if (!lead) return;
  if (!lead.email) return;

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
    return;
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
