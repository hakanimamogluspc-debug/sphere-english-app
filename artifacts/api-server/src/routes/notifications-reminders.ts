/**
 * Bildirim / Hatırlatma sistemi — Faz R3.A
 *
 * 2 tetikleyici, e-posta ile:
 *   1) Streak-at-risk  — 20:00 civarı: streak >= 2 olan ve bugün girmeyen
 *                        kullanıcıya "streak'in tehlikede" hatırlatması
 *   2) Comeback        — 09:00 civarı: son 3-14 gün içinde aktif olmuş
 *                        ama son 2+ gündür girmeyen kullanıcıya "seni özledik"
 *
 * Endpoint (internal — INTERNAL_TOKEN gerekli):
 *   POST /internal/notifications/run-daily-reminders?type=streak_risk|comeback
 *
 * Cron ile çağrılır (Fly.io schedule veya harici cron):
 *   0 20 * * * curl -X POST https://api.../internal/notifications/run-daily-reminders?type=streak_risk \
 *              -H "x-internal-token: $INTERNAL_TOKEN"
 *   0 9  * * * curl -X POST ...?type=comeback ...
 *
 * KVKK/GDPR:
 *   - notification_preferences tablosu — kullanıcı opt-out edebilir
 *   - Default: streak_risk = ON, comeback = ON (transactional; kayıt sırasında
 *     kullanıcı zaten "hatırlatma göndeririz" bilgilendirmesi görür)
 *   - notification_log — aynı gün aynı türü ikinci kez gönderme
 */

import { Router, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { sendEmail } from "../lib/email";

const router = Router();

async function ensureTables() {
  // notification_preferences zaten Drizzle schema'sında var (streak_risk_email,
  // inactivity_email, weekly_digest_email vb.). Sadece eksik push sütunlarını ekle.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notification_preferences (
      user_id INTEGER PRIMARY KEY,
      email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      streak_risk_email BOOLEAN NOT NULL DEFAULT TRUE,
      inactivity_email BOOLEAN NOT NULL DEFAULT TRUE,
      new_assessment_email BOOLEAN NOT NULL DEFAULT TRUE,
      level_up_email BOOLEAN NOT NULL DEFAULT TRUE,
      new_quiz_email BOOLEAN NOT NULL DEFAULT FALSE,
      weekly_digest_email BOOLEAN NOT NULL DEFAULT TRUE,
      last_email_sent_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS streak_risk_push BOOLEAN NOT NULL DEFAULT FALSE`);
  await pool.query(`ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS inactivity_push BOOLEAN NOT NULL DEFAULT FALSE`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notification_log (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      type VARCHAR(40) NOT NULL,
      channel VARCHAR(20) NOT NULL,
      sent_date DATE NOT NULL DEFAULT CURRENT_DATE,
      status VARCHAR(20) NOT NULL DEFAULT 'sent',
      error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, type, channel, sent_date)
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS nlog_user_type_idx ON notification_log(user_id, type, sent_date DESC)`);
}
ensureTables().catch((e) => console.warn("[notifications] ensureTables warn:", e?.message));

// ─── Auth guard ────────────────────────────────────────────────────────────

function checkInternal(req: Request, res: Response): boolean {
  const token = process.env.INTERNAL_TOKEN;
  const provided = req.header("x-internal-token") ?? "";
  if (!token || provided !== token) {
    res.status(401).json({ error: "Internal token gerekli" });
    return false;
  }
  return true;
}

// ─── E-posta şablonları ────────────────────────────────────────────────────

function streakRiskEmail(name: string, streak: number, appUrl: string): { subject: string; html: string } {
  const subject = `${name}, ${streak} günlük serin tehlikede!`;
  const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${subject}</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background: #f8fafc; margin: 0; padding: 20px;">
  <table role="presentation" width="100%" style="max-width: 560px; margin: 0 auto; background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
    <tr><td>
      <div style="font-size: 48px; margin-bottom: 8px;">🔥</div>
      <h1 style="color: #ea580c; font-size: 24px; margin: 0 0 8px 0;">${streak} günlük serin tehlikede!</h1>
      <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 16px 0;">
        Merhaba <strong>${name}</strong>,
      </p>
      <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 16px 0;">
        Bugün henüz İngilizce çalışmadın. Sadece <strong>2 dakika</strong> yeter —
        günün iş kartlarına bak ve serini korumaya devam et.
      </p>
      <div style="margin: 28px 0; text-align: center;">
        <a href="${appUrl}/dashboard" style="display: inline-block; background: linear-gradient(to right, #10b981, #059669); color: white; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 16px;">
          Serimi Koru →
        </a>
      </div>
      <p style="color: #94a3b8; font-size: 13px; line-height: 1.5; margin: 24px 0 0 0; border-top: 1px solid #e2e8f0; padding-top: 16px;">
        Bu bildirimleri almak istemiyorsan
        <a href="${appUrl}/ayarlar/bildirimler" style="color: #64748b;">tercihlerinden</a>
        kapatabilirsin.
      </p>
    </td></tr>
  </table>
</body></html>`;
  return { subject, html };
}

function comebackEmail(name: string, daysAway: number, appUrl: string): { subject: string; html: string } {
  const subject = daysAway <= 3
    ? `${name}, ${daysAway} gündür seni bekliyoruz`
    : `${name}, biraz aradın verdin — geri dön`;

  const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${subject}</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background: #f8fafc; margin: 0; padding: 20px;">
  <table role="presentation" width="100%" style="max-width: 560px; margin: 0 auto; background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
    <tr><td>
      <div style="font-size: 48px; margin-bottom: 8px;">👋</div>
      <h1 style="color: #4f46e5; font-size: 24px; margin: 0 0 8px 0;">${daysAway <= 3 ? "Seni özledik" : "Yolun açık olsun"}</h1>
      <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 16px 0;">
        Merhaba <strong>${name}</strong>,
      </p>
      <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 16px 0;">
        Son ${daysAway} gündür Sphere English'e uğramadın. Sadece bugün için
        <strong>2 dakikalık bir iş kartı</strong> hazırladık — göz atıp devam
        edersen kaldığın yerden ilerleyebilirsin.
      </p>
      <ul style="color: #64748b; font-size: 14px; line-height: 1.7; margin: 16px 0; padding-left: 20px;">
        <li>🎯 Bugün için 1 küçük görev bekliyor</li>
        <li>💼 Sektörüne özel yeni iş İngilizcesi kalıpları</li>
        <li>🏆 Haftalık sıralamanda geride kalmayasın</li>
      </ul>
      <div style="margin: 28px 0; text-align: center;">
        <a href="${appUrl}/dashboard" style="display: inline-block; background: linear-gradient(to right, #4f46e5, #6366f1); color: white; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 16px;">
          Kaldığım Yerden Devam →
        </a>
      </div>
      <p style="color: #94a3b8; font-size: 13px; line-height: 1.5; margin: 24px 0 0 0; border-top: 1px solid #e2e8f0; padding-top: 16px;">
        Bu bildirimleri almak istemiyorsan
        <a href="${appUrl}/ayarlar/bildirimler" style="color: #64748b;">tercihlerinden</a>
        kapatabilirsin.
      </p>
    </td></tr>
  </table>
</body></html>`;
  return { subject, html };
}

// ─── Yardımcı ──────────────────────────────────────────────────────────────

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a + "T00:00:00Z").getTime();
  const db = new Date(b + "T00:00:00Z").getTime();
  return Math.round((db - da) / 86400000);
}

async function logNotification(
  userId: number,
  type: string,
  channel: string,
  status: "sent" | "skipped" | "failed",
  error?: string,
): Promise<boolean> {
  try {
    const r = await pool.query(
      `INSERT INTO notification_log (user_id, type, channel, status, error)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, type, channel, sent_date) DO NOTHING
       RETURNING id`,
      [userId, type, channel, status, error ?? null],
    );
    return r.rows.length > 0;
  } catch (e: any) {
    console.warn("[notifications] log insert warn:", e?.message);
    return false;
  }
}

// ─── STREAK-AT-RISK — akşam 20:00 çağrısı ─────────────────────────────────

async function runStreakRisk(appUrl: string) {
  const today = todayIso();
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  // Streak >= 2, last_active_date < today, e-posta var, opt-in
  const rows = await pool.query(
    `SELECT u.id, u.name, u.email, u.streak, u.last_active_date,
            COALESCE(p.streak_risk_email, TRUE) AS opt_in
     FROM users u
     LEFT JOIN notification_preferences p ON p.user_id = u.id
     WHERE u.email IS NOT NULL AND u.email <> ''
       AND u.streak >= 2
       AND (u.last_active_date IS NULL OR u.last_active_date < $1)
       AND u.role = 'student'
     LIMIT 5000`,
    [today],
  );

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows.rows) {
    if (row.opt_in === false) {
      skipped++;
      continue;
    }
    // last_active_date bugün DEĞİL, dün OLMALI (bugün de geçmediyse comeback'e girer)
    if (row.last_active_date && daysBetween(row.last_active_date, today) > 1) {
      // 2+ gündür yok — comeback'e bırak
      skipped++;
      continue;
    }

    const inserted = await logNotification(row.id, "streak_risk", "email", "sent");
    if (!inserted) {
      // Bugün zaten gönderilmiş
      skipped++;
      continue;
    }

    const { subject, html } = streakRiskEmail(String(row.name || "Merhaba").split(" ")[0], row.streak, appUrl);
    const result = await sendEmail(row.email, subject, html);
    if (result.ok) {
      sent++;
    } else {
      failed++;
      await pool.query(
        `UPDATE notification_log SET status = 'failed', error = $1
         WHERE user_id = $2 AND type = 'streak_risk' AND channel = 'email' AND sent_date = CURRENT_DATE`,
        [result.error ?? "unknown", row.id],
      );
    }
  }

  return { candidates: rows.rowCount, sent, skipped, failed };
}

// ─── COMEBACK — sabah 09:00 çağrısı ────────────────────────────────────────

async function runComeback(appUrl: string) {
  const today = todayIso();
  const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
  const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);

  const rows = await pool.query(
    `SELECT u.id, u.name, u.email, u.last_active_date,
            COALESCE(p.inactivity_email, TRUE) AS opt_in
     FROM users u
     LEFT JOIN notification_preferences p ON p.user_id = u.id
     WHERE u.email IS NOT NULL AND u.email <> ''
       AND u.last_active_date IS NOT NULL
       AND u.last_active_date >= $1
       AND u.last_active_date <= $2
       AND u.role = 'student'
     LIMIT 5000`,
    [fourteenDaysAgo, twoDaysAgo],
  );

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows.rows) {
    if (row.opt_in === false) {
      skipped++;
      continue;
    }
    const daysAway = daysBetween(row.last_active_date, today);
    if (daysAway < 2) {
      skipped++;
      continue;
    }
    // Aynı hafta içinde 1'den fazla comeback göndermeyelim — son 6 gün kontrolü
    const recent = await pool.query(
      `SELECT 1 FROM notification_log
       WHERE user_id = $1 AND type = 'comeback' AND channel = 'email'
         AND sent_date >= CURRENT_DATE - INTERVAL '6 days'
       LIMIT 1`,
      [row.id],
    );
    if (recent.rowCount && recent.rowCount > 0) {
      skipped++;
      continue;
    }
    const inserted = await logNotification(row.id, "comeback", "email", "sent");
    if (!inserted) {
      skipped++;
      continue;
    }

    const { subject, html } = comebackEmail(String(row.name || "Merhaba").split(" ")[0], daysAway, appUrl);
    const result = await sendEmail(row.email, subject, html);
    if (result.ok) {
      sent++;
    } else {
      failed++;
      await pool.query(
        `UPDATE notification_log SET status = 'failed', error = $1
         WHERE user_id = $2 AND type = 'comeback' AND channel = 'email' AND sent_date = CURRENT_DATE`,
        [result.error ?? "unknown", row.id],
      );
    }
  }

  return { candidates: rows.rowCount, sent, skipped, failed };
}

// ─── POST /internal/notifications/run-daily-reminders ─────────────────────

router.post("/internal/notifications/run-daily-reminders", async (req: Request, res: Response) => {
  if (!checkInternal(req, res)) return;

  const type = String((req.query.type as string) || "").toLowerCase();
  const appUrl = process.env.APP_URL ?? "https://app.sphereenglish.com";

  try {
    if (type === "streak_risk") {
      const r = await runStreakRisk(appUrl);
      return res.json({ ok: true, type, ...r });
    }
    if (type === "comeback") {
      const r = await runComeback(appUrl);
      return res.json({ ok: true, type, ...r });
    }
    return res.status(400).json({ error: "type: 'streak_risk' | 'comeback' olmalı" });
  } catch (e: any) {
    console.error("[notifications/run] HATA:", e?.message);
    return res.status(500).json({ error: e?.message });
  }
});

// ─── GET /internal/notifications/preview ─────────────────────────────────
// Debug: mail göndermeden aday sayısını gör

router.get("/internal/notifications/preview", async (req: Request, res: Response) => {
  if (!checkInternal(req, res)) return;

  const today = todayIso();
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
  const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);

  try {
    const risk = await pool.query(
      `SELECT COUNT(*)::int AS n FROM users u
       LEFT JOIN notification_preferences p ON p.user_id = u.id
       WHERE u.email IS NOT NULL AND u.email <> ''
         AND u.streak >= 2 AND u.role = 'student'
         AND (u.last_active_date IS NULL OR u.last_active_date < $1)
         AND COALESCE(p.streak_risk_email, TRUE) = TRUE`,
      [today],
    );
    const cb = await pool.query(
      `SELECT COUNT(*)::int AS n FROM users u
       LEFT JOIN notification_preferences p ON p.user_id = u.id
       WHERE u.email IS NOT NULL AND u.email <> ''
         AND u.role = 'student'
         AND u.last_active_date >= $1 AND u.last_active_date <= $2
         AND COALESCE(p.inactivity_email, TRUE) = TRUE`,
      [fourteenDaysAgo, twoDaysAgo],
    );
    const lastRun = await pool.query(
      `SELECT type, channel, sent_date, COUNT(*)::int AS n, SUM(CASE WHEN status='sent' THEN 1 ELSE 0 END)::int AS sent
       FROM notification_log
       WHERE sent_date >= CURRENT_DATE - INTERVAL '7 days'
       GROUP BY type, channel, sent_date
       ORDER BY sent_date DESC, type
       LIMIT 50`,
    );
    return res.json({
      ok: true,
      today,
      candidates: {
        streak_risk: risk.rows[0]?.n ?? 0,
        comeback: cb.rows[0]?.n ?? 0,
      },
      last_7_days_log: lastRun.rows,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
});

export default router;
