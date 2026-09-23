/**
 * Notification tercihleri — kullanıcının hangi bildirimi aldığını yönetir.
 *
 * GET  /student/notification-prefs   — mevcut tercihleri döner
 * PATCH /student/notification-prefs  — güncelle
 * GET  /notifications/unsubscribe    — e-posta linkinden hızlı opt-out
 *
 * Şema: lib/db/schema/notifications.ts (notificationPreferencesTable) —
 *   streak_risk_email, inactivity_email, weekly_digest_email vb.
 *   push sütunları notifications-reminders.ts ALTER TABLE ile eklenir.
 */

import { Router, type Response, type Request } from "express";
import crypto from "node:crypto";
import { pool } from "@workspace/db";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";

const router = Router();

async function ensureTable() {
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
}
ensureTable().catch((e) => console.warn("[notif-prefs] ensureTable warn:", e?.message));

const KEYS = [
  "streak_risk_email",
  "inactivity_email",
  "weekly_digest_email",
  "streak_risk_push",
  "inactivity_push",
] as const;

router.get("/student/notification-prefs", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ error: "Yetkisiz" });
    const r = await pool.query(
      `SELECT streak_risk_email, inactivity_email, weekly_digest_email,
              streak_risk_push, inactivity_push
       FROM notification_preferences WHERE user_id = $1 LIMIT 1`,
      [req.userId],
    );
    const row = r.rows[0] ?? {};
    return res.json({
      ok: true,
      prefs: {
        streak_risk_email: row.streak_risk_email ?? true,
        inactivity_email: row.inactivity_email ?? true,
        weekly_digest_email: row.weekly_digest_email ?? true,
        streak_risk_push: row.streak_risk_push ?? false,
        inactivity_push: row.inactivity_push ?? false,
      },
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
});

router.patch("/student/notification-prefs", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ error: "Yetkisiz" });
    const body = req.body ?? {};
    const values: Record<string, boolean> = {};
    for (const k of KEYS) {
      if (k in body) values[k] = Boolean(body[k]);
    }
    if (Object.keys(values).length === 0) {
      return res.status(400).json({ error: "En az bir alan gönderilmeli" });
    }

    const cols = Object.keys(values);
    const args: any[] = [req.userId, ...cols.map((k) => values[k])];
    const insertCols = ["user_id", ...cols].join(", ");
    const insertVals = args.map((_, i) => `$${i + 1}`).join(", ");
    const updateSet = cols.map((k, i) => `${k} = $${i + 2}`).join(", ");

    await pool.query(
      `INSERT INTO notification_preferences (${insertCols}) VALUES (${insertVals})
       ON CONFLICT (user_id) DO UPDATE SET ${updateSet}, updated_at = NOW()`,
      args,
    );
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
});

// One-click unsubscribe (e-posta footer linki için)
router.get("/notifications/unsubscribe", async (req: Request, res: Response) => {
  try {
    const token = String(req.query.token ?? "");
    const type = String(req.query.type ?? "");
    if (!token || !type) return res.status(400).send("Eksik parametre");

    const secret = process.env.INTERNAL_TOKEN ?? "dev";
    const [uidStr, hmac] = token.split(".");
    const userId = parseInt(uidStr, 10);
    const expected = crypto.createHmac("sha256", secret).update(`${userId}:${type}`).digest("hex").slice(0, 24);
    if (!userId || hmac !== expected) return res.status(400).send("Geçersiz token");

    const col = type === "streak_risk" ? "streak_risk_email"
              : type === "comeback" || type === "inactivity" ? "inactivity_email"
              : type === "weekly_digest" ? "weekly_digest_email"
              : null;
    if (!col) return res.status(400).send("Geçersiz tür");

    await pool.query(
      `INSERT INTO notification_preferences (user_id, ${col}) VALUES ($1, FALSE)
       ON CONFLICT (user_id) DO UPDATE SET ${col} = FALSE, updated_at = NOW()`,
      [userId],
    );
    return res.send(`
<!DOCTYPE html><html><head><meta charset="utf-8"><title>Abonelikten çıkıldı</title></head>
<body style="font-family: sans-serif; max-width: 500px; margin: 60px auto; text-align: center; color: #334155;">
  <h2>✅ Abonelikten çıkıldınız</h2>
  <p>Bu tür bildirimleri artık göndermeyeceğiz. Tüm tercihleriniz için
  <a href="https://app.sphereenglish.com/ayarlar/bildirimler">buraya</a> tıklayın.</p>
</body></html>`);
  } catch (e: any) {
    return res.status(500).send("Hata: " + e?.message);
  }
});

export default router;
