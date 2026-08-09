/**
 * Weekly Report — her kullanıcı için haftalık öğrenme özetini üretir + mail + notification gönderir.
 *
 * generateWeeklyReport(userId, weekStart) → summary object + email/notification tetikler.
 * runWeeklyReportCron() → tüm aktif kullanıcılar için — cron job'dan çağrılır.
 */

import { pool } from "@workspace/db";
import { sendEmail } from "./email.js";
import { createNotification } from "./notifications.js";

const APP_URL = process.env.APP_URL || "https://app.sphereenglish.com";

export type WeeklyReport = {
  userId: number;
  weekStart: string; // YYYY-MM-DD
  weekEnd: string;
  activityMinutes: number;
  activeDays: number;
  articlesRead: number;
  articlesSaved: number;
  topMistakeTypes: Array<{ type: string; count: number }>;
  recurrentMistakes: Array<{ wrong_text: string; correct_text: string | null; occurrence_count: number; explanation: string | null }>;
  newMistakes: number;
  aiTutorMessages: number;
  suggestions: string[];
};

function mondayOf(d: Date): Date {
  const day = d.getUTCDay(); // Sunday = 0
  const diff = day === 0 ? -6 : 1 - day;
  const m = new Date(d);
  m.setUTCDate(d.getUTCDate() + diff);
  m.setUTCHours(0, 0, 0, 0);
  return m;
}

export async function generateWeeklyReport(userId: number, weekStartInput?: Date): Promise<WeeklyReport | null> {
  const monday = weekStartInput ? mondayOf(weekStartInput) : mondayOf(new Date(Date.now() - 7 * 86400000));
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  sunday.setUTCHours(23, 59, 59, 999);
  const weekStartStr = monday.toISOString().slice(0, 10);
  const weekEndStr = sunday.toISOString().slice(0, 10);

  // 1. Aktivite dakika + gün sayısı
  const actRes: any = await pool.query(
    `SELECT COALESCE(SUM(minutes),0)::int AS mins,
            COUNT(DISTINCT date)::int AS days
       FROM user_daily_activity
       WHERE user_id = $1 AND date BETWEEN $2::date AND $3::date`,
    [userId, weekStartStr, weekEndStr],
  );
  const activityMinutes = actRes.rows[0]?.mins ?? 0;
  const activeDays = actRes.rows[0]?.days ?? 0;

  // 2. Article read / saved
  const artRes: any = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE action = 'view')::int AS reads,
       COUNT(*) FILTER (WHERE action = 'save')::int AS saves
     FROM article_interactions
     WHERE user_id = $1 AND created_at BETWEEN $2 AND $3`,
    [userId, monday.toISOString(), sunday.toISOString()],
  );
  const articlesRead = artRes.rows[0]?.reads ?? 0;
  const articlesSaved = artRes.rows[0]?.saves ?? 0;

  // 3. AI tutor mesaj sayısı
  const aiRes: any = await pool.query(
    `SELECT COUNT(*)::int AS n
       FROM ai_tutor_messages m
       JOIN ai_tutor_conversations c ON c.id = m.conversation_id
       WHERE c.user_id = $1 AND m.role = 'user'
         AND m.created_at BETWEEN $2 AND $3`,
    [userId, monday.toISOString(), sunday.toISOString()],
  );
  const aiTutorMessages = aiRes.rows[0]?.n ?? 0;

  // 4. Bu haftaki yeni hatalar
  const newMistakesRes: any = await pool.query(
    `SELECT COUNT(*)::int AS n FROM user_mistakes
       WHERE user_id = $1 AND first_seen_at BETWEEN $2 AND $3`,
    [userId, monday.toISOString(), sunday.toISOString()],
  );
  const newMistakes = newMistakesRes.rows[0]?.n ?? 0;

  // 5. En sık hata tipleri (unresolved, tüm zamanlar)
  const typesRes: any = await pool.query(
    `SELECT mistake_type AS type, COUNT(*)::int AS count
       FROM user_mistakes
       WHERE user_id = $1 AND resolved_at IS NULL
       GROUP BY mistake_type
       ORDER BY count DESC
       LIMIT 5`,
    [userId],
  );
  const topMistakeTypes = typesRes.rows;

  // 6. Tekrar eden hatalar (occurrence_count>=2, unresolved)
  const recurRes: any = await pool.query(
    `SELECT wrong_text, correct_text, explanation, occurrence_count
       FROM user_mistakes
       WHERE user_id = $1 AND resolved_at IS NULL AND occurrence_count >= 2
       ORDER BY occurrence_count DESC, last_seen_at DESC
       LIMIT 5`,
    [userId],
  );
  const recurrentMistakes = recurRes.rows;

  // 7. Öneriler — basit rule-based
  const suggestions: string[] = [];
  if (activeDays === 0) {
    suggestions.push("Bu hafta hiç giriş yapmamışsın. Hedefinden kopma — bugün 15 dk pratik iyi bir başlangıç.");
  } else if (activeDays >= 5) {
    suggestions.push(`Bu hafta ${activeDays} gün pratik yaptın — harika bir tutarlılık.`);
  }
  if (recurrentMistakes.length > 0) {
    suggestions.push(`${recurrentMistakes[0].wrong_text} kalıbını hâlâ tekrarlıyorsun (${recurrentMistakes[0].occurrence_count} kez). Bu haftaki odak noktan olsun.`);
  }
  if (articlesRead === 0 && activeDays > 0) {
    suggestions.push("Keşfet sekmesindeki güncel iş makalelerine göz at — kelime dağarcığın hızla açılır.");
  }
  if (topMistakeTypes[0]?.type === "grammar") {
    suggestions.push("Hatalarının çoğu grammar. Dilbilgisi Koçu ile bu haftaki konu üzerine odaklı çalışabilirsin.");
  }

  return {
    userId,
    weekStart: weekStartStr,
    weekEnd: weekEndStr,
    activityMinutes,
    activeDays,
    articlesRead,
    articlesSaved,
    topMistakeTypes,
    recurrentMistakes,
    newMistakes,
    aiTutorMessages,
    suggestions,
  };
}

// ─── HTML mail template ────────────────────────────────────────────────
const TYPE_LABEL: Record<string, string> = {
  grammar: "Dilbilgisi", vocab: "Kelime", collocation: "Kalıp",
  spelling: "Yazım", register: "Ton/Register", pronunciation: "Telaffuz", other: "Diğer",
};

function renderEmail(name: string, r: WeeklyReport): { subject: string; html: string } {
  const dateRange = `${fmtDate(r.weekStart)} – ${fmtDate(r.weekEnd)}`;
  const subject = `Haftalık İngilizce Raporun — ${dateRange}`;

  const statTiles = `
    ${tile("Aktif Gün", `${r.activeDays} / 7`)}
    ${tile("Toplam Süre", `${r.activityMinutes} dk`)}
    ${tile("Okunan Makale", String(r.articlesRead))}
    ${tile("Yeni Hata Tespiti", String(r.newMistakes))}
  `;

  const recurrentSection = r.recurrentMistakes.length > 0 ? `
    <tr><td style="padding:24px 32px 12px;">
      <h2 style="margin:0 0 12px;color:#1B365D;font-size:16px;">Sık Tekrar Eden Hataların</h2>
      ${r.recurrentMistakes.map(m => `
        <div style="border-left:3px solid #ef4444;background:#fef2f2;padding:12px 14px;margin-bottom:8px;border-radius:0 6px 6px 0;">
          <div style="font-size:13px;color:#991b1b;">
            <strong style="text-decoration:line-through;">${escape(m.wrong_text)}</strong>
            → <strong style="color:#065f46;">${escape(m.correct_text || "?")}</strong>
            <span style="color:#64748b;font-weight:normal;">· ${m.occurrence_count} kez</span>
          </div>
          ${m.explanation ? `<div style="font-size:12px;color:#475569;margin-top:6px;">${escape(m.explanation)}</div>` : ""}
        </div>
      `).join("")}
    </td></tr>
  ` : "";

  const typesSection = r.topMistakeTypes.length > 0 ? `
    <tr><td style="padding:12px 32px;">
      <h3 style="margin:0 0 8px;color:#1B365D;font-size:14px;">Hata Kategorileri</h3>
      <div style="display:flex;flex-wrap:wrap;gap:6px;">
        ${r.topMistakeTypes.map(t =>
          `<span style="display:inline-block;background:#eef2ff;color:#3730a3;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:600;">${escape(TYPE_LABEL[t.type] || t.type)}: ${t.count}</span>`
        ).join("")}
      </div>
    </td></tr>
  ` : "";

  const suggestionsSection = r.suggestions.length > 0 ? `
    <tr><td style="padding:16px 32px 24px;">
      <div style="background:#f0f9ff;border:1px solid #0ea5e9;border-radius:8px;padding:16px;">
        <div style="font-size:12px;font-weight:700;color:#0369a1;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">Bu Hafta İçin</div>
        ${r.suggestions.map(s => `<div style="font-size:14px;color:#0c4a6e;margin-bottom:6px;">• ${escape(s)}</div>`).join("")}
      </div>
    </td></tr>
  ` : "";

  const html = `<!DOCTYPE html>
<html lang="tr"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="600" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.05);">
      <tr><td style="padding:36px 32px;background:linear-gradient(135deg,#1B365D 0%,#0ea5e9 100%);text-align:center;">
        <div style="font-size:11px;color:rgba(255,255,255,.85);letter-spacing:.15em;text-transform:uppercase;font-weight:700;">${dateRange}</div>
        <h1 style="margin:8px 0 0;color:#fff;font-size:24px;font-weight:700;">Haftalık Rapor</h1>
      </td></tr>
      <tr><td style="padding:28px 32px 12px;">
        <p style="margin:0 0 6px;font-size:16px;">Merhaba <strong>${escape(name)}</strong>,</p>
        <p style="margin:0;font-size:14px;color:#475569;line-height:1.6;">Geçen haftanın öğrenme özeti aşağıda.</p>
      </td></tr>
      <tr><td style="padding:8px 24px 8px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${statTiles}</tr></table>
      </td></tr>
      ${recurrentSection}
      ${typesSection}
      ${suggestionsSection}
      <tr><td style="padding:8px 32px 32px;text-align:center;">
        <a href="${APP_URL}/raporum" style="display:inline-block;background:#0ea5e9;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">
          Tüm Rapora Uygulamada Bak
        </a>
      </td></tr>
      <tr><td style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;font-size:11px;color:#94a3b8;">
        Sphere English · Bildirim tercihlerini <a href="${APP_URL}/student/settings" style="color:#94a3b8;">ayarlardan</a> yönetebilirsin.
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

  return { subject, html };
}

function tile(label: string, value: string): string {
  return `<td width="25%" align="center" style="padding:8px;">
    <div style="border:1px solid #e2e8f0;border-radius:8px;padding:16px 6px;">
      <div style="font-size:22px;font-weight:700;color:#1B365D;line-height:1.2;">${value}</div>
      <div style="font-size:11px;color:#64748b;margin-top:4px;">${label}</div>
    </div>
  </td>`;
}

function escape(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function fmtDate(s: string): string {
  const d = new Date(s + "T00:00:00");
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "short" });
}

// ─── Send report to one user ───────────────────────────────────────────
export async function sendWeeklyReportToUser(userId: number): Promise<{ ok: boolean; reason?: string }> {
  const u: any = await pool.query(
    `SELECT id, email, first_name, last_name FROM users WHERE id = $1`,
    [userId],
  );
  const user = u.rows[0];
  if (!user) return { ok: false, reason: "user not found" };

  const report = await generateWeeklyReport(userId);
  if (!report) return { ok: false, reason: "report üretilemedi" };

  // Değersiz haftaları atla (hiç aktivite yok + hata yok + mesaj yok)
  if (report.activeDays === 0 && report.newMistakes === 0 && report.aiTutorMessages === 0 && report.articlesRead === 0) {
    return { ok: false, reason: "aktivite yok — skip" };
  }

  // Idempotency: bu hafta gönderildi mi?
  const existing: any = await pool.query(
    `SELECT id, email_sent FROM weekly_reports_sent WHERE user_id = $1 AND week_start = $2`,
    [userId, report.weekStart],
  );

  let emailSent = false;
  if (user.email && !existing.rows[0]?.email_sent) {
    try {
      const { subject, html } = renderEmail(user.first_name || "arkadaşım", report);
      await sendEmail(user.email, subject, html);
      emailSent = true;
    } catch (e: any) {
      console.warn(`[weekly-report] mail hata userId=${userId}:`, e?.message);
    }
  }

  // In-app notification
  try {
    await createNotification({
      userId,
      kind: "weekly_report",
      title: "Haftalık raporun hazır",
      body: `${report.activeDays}/7 gün pratik, ${report.articlesRead} makale okundu, ${report.newMistakes} yeni hata tespiti.`,
      actionUrl: "/raporum",
      iconKind: "chart",
      priority: "normal",
      dedupeKey: `weekly_report_${report.weekStart}`,
      metadata: { weekStart: report.weekStart },
    } as any);
  } catch (e: any) {
    console.warn(`[weekly-report] notif hata userId=${userId}:`, e?.message);
  }

  // Save to weekly_reports_sent
  await pool.query(
    `INSERT INTO weekly_reports_sent (user_id, week_start, summary, email_sent)
     VALUES ($1, $2, $3::jsonb, $4)
     ON CONFLICT (user_id, week_start) DO UPDATE
       SET summary = EXCLUDED.summary, email_sent = weekly_reports_sent.email_sent OR EXCLUDED.email_sent, sent_at = NOW()`,
    [userId, report.weekStart, JSON.stringify(report), emailSent],
  );

  return { ok: true };
}

// ─── Cron entry: tüm student'lar için ──────────────────────────────────
export async function runWeeklyReportForAllUsers(): Promise<{ processed: number; sent: number; skipped: number }> {
  const users: any = await pool.query(
    `SELECT DISTINCT id FROM users
       WHERE role IN ('student', 'corporate') AND email IS NOT NULL`,
  );
  let sent = 0, skipped = 0;
  for (const row of users.rows) {
    const r = await sendWeeklyReportToUser(row.id);
    if (r.ok) sent++; else skipped++;
  }
  return { processed: users.rows.length, sent, skipped };
}
