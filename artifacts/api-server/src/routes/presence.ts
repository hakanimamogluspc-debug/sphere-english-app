import { Router } from "express";
import { pool } from "@workspace/db";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth.js";

const router = Router();

const TIMEOUT_MINUTES = 3;

// POST /api/presence/heartbeat — her giriş yapmış kullanıcı 60s'de bir çağırır
router.post("/presence/heartbeat", authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { name, role, page } = req.body as { name?: string; role?: string; page?: string };

  try {
    await pool.query(
      `INSERT INTO user_presence (user_id, name, role, page, last_seen)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         name = EXCLUDED.name,
         role = EXCLUDED.role,
         page = EXCLUDED.page,
         last_seen = NOW()`,
      [userId, (name || "Bilinmeyen").slice(0, 100), (role || req.userRole || "student").slice(0, 20), (page || "/").slice(0, 300)]
    );
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
