/**
 * Bildirim / Hatırlatma sistemi — Faz R3.A
 *
 * 2 tetikleyici, e-posta ile:
 *   1) Streak-at-risk  — 20:00 civarı: streak >= 2 olan ve bugün girmeyen
 *                        kullanıcıya "streak'in tehlikede" hatırlatması
 *   2) Comeback        — 09:00 civarı: inaktif gün sayısına göre 3/7/14/30/60. gün
 *                        dizisi (lib/reminder-sequence.ts) — her dokunuş farklı
 *                        açı, kişiselleştirilmiş içerik, A/B konu satırı.
 *                        Geri dönüş (7 gün içinde giriş) notification_log'a işlenir;
 *                        admin: GET /admin/notifications/reminder-stats
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
import { sendPushToUser } from "./push-notifications";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth";
import {
  COMEBACK_TOUCHES, loadCandidates, pickTouch, pickVariant, alreadySentThisPeriod, sentRecently,
  renderComeback, renderStreakRisk, type ReminderUser,
} from "../lib/reminder-sequence";

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
  // Dizi / A-B / geri dönüş ölçümü
  await pool.query(`ALTER TABLE notification_log ADD COLUMN IF NOT EXISTS variant VARCHAR(4)`);
  await pool.query(`ALTER TABLE notification_log ADD COLUMN IF NOT EXISTS touch_day INTEGER`);
  await pool.query(`ALTER TABLE notification_log ADD COLUMN IF NOT EXISTS returned_at TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE notification_log ADD COLUMN IF NOT EXISTS returned_days INTEGER`);
  await pool.query(`CREATE INDEX IF NOT EXISTS nlog_type_sent_idx ON notification_log(type, sent_date DESC)`);
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
  extra?: { variant?: string; touchDay?: number },
): Promise<boolean> {
  try {
    const r = await pool.query(
      `INSERT INTO notification_log (user_id, type, channel, status, error, variant, touch_day)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id, type, channel, sent_date) DO NOTHING
       RETURNING id`,
      [userId, type, channel, status, error ?? null, extra?.variant ?? null, extra?.touchDay ?? null],
    );
    return r.rows.length > 0;
  } catch (e: any) {
    console.warn("[notifications] log insert warn:", e?.message);
    return false;
  }
}

// ─── STREAK-AT-RISK — akşam 20:00 çağrısı ─────────────────────────────────

export async function runStreakRisk(appUrl: string) {
  const today = todayIso();
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  // Streak >= 2, last_active_date < today, e-posta var, opt-in
  const rows = await pool.query(
    `SELECT u.id, u.first_name AS name, u.email, u.streak, u.last_active_date,
            COALESCE(p.streak_risk_email, TRUE) AS opt_in,
            COALESCE(p.streak_risk_push, FALSE) AS push_opt_in
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
    const firstName = String(row.name || "Merhaba").split(" ")[0];
    const mail = renderStreakRisk(firstName, row.streak, appUrl);
    const inserted = await logNotification(row.id, "streak_risk", "email", "sent", undefined, { variant: mail.variant });
    if (!inserted) {
      // Bugün zaten gönderilmiş
      skipped++;
      continue;
    }
    const { subject, html } = mail;
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

    // Push kanalı — opt-in ise dene (bağımsız log satırı)
    if (row.push_opt_in) {
      const pushInserted = await logNotification(row.id, "streak_risk", "push", "sent");
      if (pushInserted) {
        try {
          await sendPushToUser(row.id, {
            title: mail.pushTitle,
            body: mail.pushBody,
            url: mail.ctaPath,
            tag: "streak_risk",
          });
        } catch (e: any) {
          await pool.query(
            `UPDATE notification_log SET status = 'failed', error = $1
             WHERE user_id = $2 AND type = 'streak_risk' AND channel = 'push' AND sent_date = CURRENT_DATE`,
            [e?.message ?? "unknown", row.id],
          );
        }
      }
    }
  }

  return { candidates: rows.rowCount, sent, skipped, failed };
}

// ─── COMEBACK — sabah 09:00 çağrısı ────────────────────────────────────────

/**
 * Geri dönüş dizisi (3/7/14/30/60) — bkz. lib/reminder-sequence.ts
 * Önce geri dönüş ölçümünü günceller, sonra adayları işler.
 */
export async function runComeback(appUrl: string) {
  await markReturns();

  const candidates = await loadCandidates(3);
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const byTouch: Record<string, number> = {};

  for (const u of candidates) {
    const touch = pickTouch(u.inactiveDays);
    if (!touch) { skipped++; continue; }
    if (await alreadySentThisPeriod(u.id, touch.key)) { skipped++; continue; }
    if (await sentRecently(u.id, 2)) { skipped++; continue; }

    const variant = pickVariant(u.id);
    const inserted = await logNotification(u.id, touch.key, "email", "sent", undefined, { variant, touchDay: touch.day });
    if (!inserted) { skipped++; continue; }

    const mail = renderComeback(touch, u, variant, appUrl);
    const result = await sendEmail(u.email, mail.subject, mail.html);
    if (result.ok) {
      sent++;
      byTouch[touch.key] = (byTouch[touch.key] ?? 0) + 1;
    } else {
      failed++;
      await pool.query(
        `UPDATE notification_log SET status = 'failed', error = $1
         WHERE user_id = $2 AND type = $3 AND channel = 'email' AND sent_date = CURRENT_DATE`,
        [result.error ?? "unknown", u.id, touch.key],
      );
    }

    // Push — opt-in ise (tercih tablosundan)
    const pref = await pool.query(`SELECT inactivity_push FROM notification_preferences WHERE user_id = $1`, [u.id]);
    if (pref.rows[0]?.inactivity_push) {
      const pushInserted = await logNotification(u.id, touch.key, "push", "sent", undefined, { variant, touchDay: touch.day });
      if (pushInserted) {
        try {
          await sendPushToUser(u.id, { title: mail.pushTitle, body: mail.pushBody, url: mail.ctaPath, tag: touch.key });
        } catch (e: any) {
          await pool.query(
            `UPDATE notification_log SET status = 'failed', error = $1
             WHERE user_id = $2 AND type = $3 AND channel = 'push' AND sent_date = CURRENT_DATE`,
            [e?.message ?? "unknown", u.id, touch.key],
          );
        }
      }
    }
  }

  return { candidates: candidates.length, sent, skipped, failed, byTouch };
}

/**
 * Geri dönüş ölçümü: gönderimden sonraki 7 gün içinde kullanıcı aktif olduysa
 * returned_at / returned_days işaretlenir. Hem comeback hem streak_risk için.
 * Idempotent — her cron koşusunda çağrılır.
 */
export async function markReturns(): Promise<number> {
  const r = await pool.query(
    `UPDATE notification_log nl
        SET returned_at = NOW(),
            returned_days = (u.last_active_date::date - nl.sent_date)
       FROM users u
      WHERE u.id = nl.user_id
        AND nl.returned_at IS NULL
        AND nl.status = 'sent'
        AND nl.channel = 'email'
        AND u.last_active_date IS NOT NULL
        AND u.last_active_date::date > nl.sent_date
        AND u.last_active_date::date <= nl.sent_date + 7`,
  );
  return r.rowCount ?? 0;
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

// Debug — bugünkü log detayı (kime gitti + status)
router.get("/internal/notifications/log-today", async (req: Request, res: Response) => {
  if (!checkInternal(req, res)) return;
  try {
    const r = await pool.query(
      `SELECT nl.id, nl.user_id, u.email, u.first_name, u.streak, u.last_active_date,
              nl.type, nl.channel, nl.status, nl.error, nl.created_at
       FROM notification_log nl
       LEFT JOIN users u ON u.id = nl.user_id
       WHERE nl.sent_date = CURRENT_DATE
       ORDER BY nl.created_at DESC
       LIMIT 200`,
    );
    return res.json({ ok: true, count: r.rowCount, rows: r.rows });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
});

router.get("/internal/notifications/preview", async (req: Request, res: Response) => {
  if (!checkInternal(req, res)) return;

  const today = todayIso();
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

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
         AND (CURRENT_DATE - u.last_active_date::date) BETWEEN 3 AND 75
         AND COALESCE(p.inactivity_email, TRUE) = TRUE`,
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

// ─── ADMIN — hatırlatma etkisi ──────────────────────────────────────────────

/**
 * GET /admin/notifications/reminder-stats?days=90
 * Dokunuş + varyant bazında gönderim / 7 gün içinde geri dönüş.
 * Not: "geri döndü" = mailden sonraki 7 gün içinde last_active_date ilerledi;
 * maile tıklamadan da dönmüş olabilir — nedensellik değil, korelasyon.
 */
router.get("/admin/notifications/reminder-stats", authMiddleware, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  const days = Math.min(Math.max(parseInt(String(req.query.days ?? "90"), 10) || 90, 7), 365);
  try {
    await markReturns();
    const [byTouch, byVariant, series, recent] = await Promise.all([
      pool.query(
        `SELECT type, touch_day AS "touchDay",
                COUNT(*) FILTER (WHERE status = 'sent')::int AS sent,
                COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
                COUNT(*) FILTER (WHERE returned_at IS NOT NULL)::int AS returned,
                ROUND(AVG(returned_days) FILTER (WHERE returned_days IS NOT NULL), 1)::float AS "avgReturnDays"
           FROM notification_log
          WHERE channel = 'email' AND sent_date >= CURRENT_DATE - ($1::int)
            AND sent_date < CURRENT_DATE - 7   -- 7 günlük pencere dolmuş olanlar (adil karşılaştırma)
          GROUP BY type, touch_day ORDER BY touch_day NULLS FIRST, type`,
        [days],
      ),
      pool.query(
        `SELECT type, COALESCE(variant, '-') AS variant,
                COUNT(*) FILTER (WHERE status = 'sent')::int AS sent,
                COUNT(*) FILTER (WHERE returned_at IS NOT NULL)::int AS returned
           FROM notification_log
          WHERE channel = 'email' AND sent_date >= CURRENT_DATE - ($1::int)
            AND sent_date < CURRENT_DATE - 7
          GROUP BY type, variant ORDER BY type, variant`,
        [days],
      ),
      pool.query(
        `SELECT date_trunc('week', sent_date)::date AS week,
                COUNT(*) FILTER (WHERE status = 'sent')::int AS sent,
                COUNT(*) FILTER (WHERE returned_at IS NOT NULL)::int AS returned
           FROM notification_log
          WHERE channel = 'email' AND sent_date >= CURRENT_DATE - ($1::int)
          GROUP BY 1 ORDER BY 1`,
        [days],
      ),
      pool.query(
        `SELECT nl.sent_date AS "sentDate", nl.type, nl.variant, nl.status, nl.returned_days AS "returnedDays",
                u.first_name AS "firstName", u.email
           FROM notification_log nl LEFT JOIN users u ON u.id = nl.user_id
          WHERE nl.channel = 'email'
          ORDER BY nl.created_at DESC LIMIT 40`,
      ),
    ]);
    const pending = await pool.query(
      `SELECT COUNT(*)::int AS n FROM notification_log WHERE channel = 'email' AND status = 'sent' AND sent_date >= CURRENT_DATE - 7`,
    );
    return res.json({
      days,
      touches: COMEBACK_TOUCHES,
      byTouch: byTouch.rows,
      byVariant: byVariant.rows,
      weekly: series.rows,
      recent: recent.rows,
      pendingWindow: pending.rows[0]?.n ?? 0,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
});

/** GET /admin/notifications/reminder-preview?touch=comeback_7&variant=A → HTML (örnek kullanıcıyla) */
router.get("/admin/notifications/reminder-preview", authMiddleware, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  const appUrl = process.env.APP_URL ?? "https://app.sphereenglish.com";
  const key = String(req.query.touch ?? "comeback_3");
  const variant = (String(req.query.variant ?? "A").toUpperCase() === "B" ? "B" : "A") as "A" | "B";
  const sample: ReminderUser = {
    id: variant === "A" ? 2 : 1, firstName: "Ayşe", email: "ornek@sphereenglish.com", inactiveDays: 0,
    level: "B1", learningGoal: "customer", sector: "manufacturing", dueVocab: 23, topModule: "pronunciation_coach", totalMinutes30: 95,
  };
  if (key === "streak_risk") {
    const m = renderStreakRisk("Ayşe", 6, appUrl, variant === "A" ? 0 : 1);
    res.type("html").send(`<!-- subject: ${m.subject} -->\n${m.html}`);
    return;
  }
  const touch = COMEBACK_TOUCHES.find((t) => t.key === key);
  if (!touch) return res.status(404).json({ error: "touch bulunamadı" });
  sample.inactiveDays = touch.day;
  const m = renderComeback(touch, sample, variant, appUrl);
  res.setHeader("X-Subject", encodeURIComponent(m.subject));
  res.type("html").send(`<!-- subject: ${m.subject} -->\n${m.html}`);
});

export default router;
