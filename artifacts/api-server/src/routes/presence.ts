import { Router } from "express";
import { pool } from "@workspace/db";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth.js";
import { resolveModule } from "../lib/activity-module.js";

const router = Router();

const TIMEOUT_MINUTES = 3;
// İdle koruması: önceki heartbeat'ten bu kadar saniyenin altında geçtiyse "aktif" sayılır.
// Daha uzun geçmişse user idle'a gitmiş kabul edilir ve dakika eklenmez (refresh / sekme kapatma).
const ACTIVE_WINDOW_SECONDS = 120;

// POST /api/presence/heartbeat — her giriş yapmış kullanıcı 60s'de bir çağırır
router.post("/presence/heartbeat", authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { name, role, page } = req.body as { name?: string; role?: string; page?: string };

  const safeName = (name || "Bilinmeyen").slice(0, 100);
  const safeRole = (role || req.userRole || "student").slice(0, 20);
  const safePage = (page || "/").slice(0, 300);

  try {
    // 1) Mevcut presence kaydı (var ise) — önceki heartbeat ne zamandı
    const prevResult = await pool.query<{ last_seen: Date | null }>(
      `SELECT last_seen FROM user_presence WHERE user_id = $1`,
      [userId],
    );
    const prevLastSeen = prevResult.rows[0]?.last_seen ?? null;
    const secondsSinceLast =
      prevLastSeen != null ? Math.floor((Date.now() - new Date(prevLastSeen).getTime()) / 1000) : null;
    const isActiveContinuation =
      secondsSinceLast != null && secondsSinceLast >= 0 && secondsSinceLast <= ACTIVE_WINDOW_SECONDS;

    // 2) Presence kaydını upsert et (her halükarda)
    await pool.query(
      `INSERT INTO user_presence (user_id, name, role, page, last_seen)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         name = EXCLUDED.name,
         role = EXCLUDED.role,
         page = EXCLUDED.page,
         last_seen = NOW()`,
      [userId, safeName, safeRole, safePage],
    );

    // 3) Eğer aktif devamlılık varsa günlük modül dakikasına 1 ekle
    //    (refresh / sayfa açılış gibi izolated heartbeat'lerde dakika eklenmez)
    if (isActiveContinuation) {
      const moduleName = resolveModule(safePage);
      // YYYY-MM-DD formatında bugünün tarihi (UTC bazlı; istersen TZ ekleyebiliriz)
      const today = new Date().toISOString().slice(0, 10);
      await pool
        .query(
          `INSERT INTO user_daily_activity (user_id, date, module, minutes, last_updated)
           VALUES ($1, $2, $3, 1, NOW())
           ON CONFLICT (user_id, date, module) DO UPDATE SET
             minutes = user_daily_activity.minutes + 1,
             last_updated = NOW()`,
          [userId, today, moduleName],
        )
        .catch((err) => {
          // Tablo yoksa veya başka bir hata olursa heartbeat'i bozma — sessizce yut
          console.warn("[presence] daily activity update failed:", err?.message);
        });
    }

    res.json({ ok: true });
  } catch {
    res.json({ ok: true });
  }
});

// GET /api/presence/active — sadece admin görebilir
router.get("/presence/active", authMiddleware, requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(
      `SELECT user_id, name, role, page,
              EXTRACT(EPOCH FROM (NOW() - last_seen))::int AS last_seen_ago
       FROM user_presence
       WHERE last_seen > NOW() - INTERVAL '${TIMEOUT_MINUTES} minutes'
       ORDER BY last_seen DESC`
    );

    const users = result.rows.map((r: any) => ({
      userId: r.user_id,
      name: r.name,
      role: r.role,
      page: r.page,
      lastSeenAgo: r.last_seen_ago,
    }));

    res.json({ count: users.length, users });
  } catch {
    res.json({ count: 0, users: [] });
  }
});

export default router;
