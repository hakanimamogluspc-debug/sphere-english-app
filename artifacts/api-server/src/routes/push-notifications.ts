/**
 * Web Push Notification — R3.B
 *
 * Tarayıcı push notification altyapısı. Kullanıcı service worker'a subscribe
 * olur, backend `push_subscriptions` tablosunda saklar, streak_risk / comeback
 * gibi olaylar tetiklendiğinde push mesajı gönderir.
 *
 * Env değişkenleri (production'da zorunlu):
 *   VAPID_PUBLIC_KEY   — istemciye verilen kimlik
 *   VAPID_PRIVATE_KEY  — sunucu imzası
 *   VAPID_SUBJECT      — mailto:info@sphereenglish.com
 *
 * VAPID key üretimi (bir kereye mahsus):
 *   npx web-push generate-vapid-keys
 *
 * Endpoint'ler:
 *   GET  /public/push/vapid-key           — istemcinin subscribe için ihtiyacı olan public key
 *   POST /student/push/subscribe          — subscription objesini sakla
 *   POST /student/push/unsubscribe        — sil
 *   POST /internal/push/test              — tek kullanıcıya test mesajı (INTERNAL_TOKEN)
 *
 * sendPushToUser(userId, payload) — diğer route'lardan çağrılır.
 */

import { Router, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";
// web-push named import edilir — package hem CJS hem ESM.
// deploy sonrası npm install ile ekleniyor.
import webpush from "web-push";

const router = Router();

// ─── VAPID konfigürasyon ──────────────────────────────────────────────────

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY ?? "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:info@sphereenglish.com";

let vapidReady = false;
try {
  if (VAPID_PUBLIC && VAPID_PRIVATE) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
    vapidReady = true;
  } else {
    console.warn("[push] VAPID_PUBLIC_KEY veya VAPID_PRIVATE_KEY eksik — push devre dışı");
  }
} catch (e: any) {
  console.error("[push] VAPID setup hata:", e?.message);
}

// ─── Tablo ────────────────────────────────────────────────────────────────

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      endpoint TEXT NOT NULL,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      user_agent TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_used_at TIMESTAMPTZ,
      UNIQUE(user_id, endpoint)
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS push_sub_user_idx ON push_subscriptions(user_id)`);
}
ensureTable().catch((e) => console.warn("[push] ensureTable warn:", e?.message));

// ─── Yardımcı: kullanıcıya push gönder ────────────────────────────────────

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  badge?: string;
  tag?: string;
}

export async function sendPushToUser(
  userId: number,
  payload: PushPayload,
): Promise<{ sent: number; failed: number; removed: number }> {
  if (!vapidReady) return { sent: 0, failed: 0, removed: 0 };

  const subs = await pool.query(
    `SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1`,
    [userId],
  );

  let sent = 0;
  let failed = 0;
  let removed = 0;

  for (const sub of subs.rows) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify({
          title: payload.title,
          body: payload.body,
          url: payload.url ?? "/dashboard",
          icon: payload.icon ?? "/icons/icon-192.png",
          badge: payload.badge ?? "/icons/badge-72.png",
          tag: payload.tag ?? "sphere-notification",
        }),
      );
      sent++;
      await pool
        .query(`UPDATE push_subscriptions SET last_used_at = NOW() WHERE id = $1`, [sub.id])
        .catch(() => {});
    } catch (err: any) {
      const status = err?.statusCode ?? err?.status ?? 0;
      if (status === 410 || status === 404) {
        // Gone / Not found — subscription geçersiz, sil
        await pool.query(`DELETE FROM push_subscriptions WHERE id = $1`, [sub.id]).catch(() => {});
        removed++;
      } else {
        console.warn("[push] send failed:", err?.message ?? err);
        failed++;
      }
    }
  }

  return { sent, failed, removed };
}

// ─── GET /public/push/vapid-key ──────────────────────────────────────────

router.get("/public/push/vapid-key", (_req, res) => {
  if (!vapidReady) return res.status(503).json({ error: "Push devre dışı" });
  return res.json({ publicKey: VAPID_PUBLIC });
});

// ─── POST /student/push/subscribe ────────────────────────────────────────

router.post("/student/push/subscribe", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ error: "Yetkisiz" });
    if (!vapidReady) return res.status(503).json({ error: "Push devre dışı" });

    const sub = req.body?.subscription;
    if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
      return res.status(400).json({ error: "Geçersiz subscription" });
    }
    const userAgent = String(req.headers["user-agent"] ?? "").slice(0, 300);

    await pool.query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, endpoint) DO UPDATE
         SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, user_agent = EXCLUDED.user_agent`,
      [req.userId, sub.endpoint, sub.keys.p256dh, sub.keys.auth, userAgent],
    );
    return res.json({ ok: true });
  } catch (e: any) {
    console.error("[push/subscribe] HATA:", e?.message);
    return res.status(500).json({ error: e?.message });
  }
});

// ─── POST /student/push/unsubscribe ──────────────────────────────────────

router.post("/student/push/unsubscribe", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ error: "Yetkisiz" });
    const endpoint = String(req.body?.endpoint ?? "");
    if (!endpoint) {
      // Bütün device'lardan çık
      await pool.query(`DELETE FROM push_subscriptions WHERE user_id = $1`, [req.userId]);
    } else {
      await pool.query(
        `DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2`,
        [req.userId, endpoint],
      );
    }
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
});

// ─── POST /internal/push/test — bir kullanıcıya test push ────────────────

router.post("/internal/push/test", async (req: Request, res: Response) => {
  const token = process.env.INTERNAL_TOKEN;
  const provided = req.header("x-internal-token") ?? "";
  if (!token || provided !== token) return res.status(401).json({ error: "Internal token gerekli" });

  const userId = parseInt(String(req.body?.userId ?? req.query.userId ?? 0), 10);
  if (!userId) return res.status(400).json({ error: "userId gerekli" });

  const r = await sendPushToUser(userId, {
    title: "Sphere English",
    body: req.body?.body ?? "Bu bir test bildirimidir 🎉",
    url: "/dashboard",
    tag: "sphere-test",
  });
  return res.json({ ok: true, ...r });
});

export default router;
