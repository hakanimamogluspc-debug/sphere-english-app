/**
 * Streak Decrement — gece cron ile çağrılır.
 *
 * Kural: last_active_date < dün ise streak sıfırlanır.
 * (Yani sadece "bugün" veya "dün" aktif olan streak'i korur.)
 *
 * Freeze uygulanmış kullanıcılar (streak_freeze_count > 0 ve dün freeze uyguladıysa)
 * korunur — freeze zaten last_active_date'i dün yapmıştı.
 *
 * Endpoint (internal — INTERNAL_TOKEN gerekli):
 *   POST /internal/streak/decrement
 *
 * Cron: 0 0 * * * (her gece TR 00:00 = 21:00 UTC)
 */

import { Router, type Request, type Response } from "express";
import { pool } from "@workspace/db";

const router = Router();

function checkInternal(req: Request, res: Response): boolean {
  const token = process.env.INTERNAL_TOKEN;
  const provided = req.header("x-internal-token") ?? "";
  if (!token || provided !== token) {
    res.status(401).json({ error: "Internal token gerekli" });
    return false;
  }
  return true;
}

router.post("/internal/streak/decrement", async (req: Request, res: Response) => {
  if (!checkInternal(req, res)) return;

  try {
    // Dün tarihi (UTC)
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    // last_active_date < yesterday ise sıfırla
    const r = await pool.query(
      `UPDATE users
       SET streak = 0
       WHERE role = 'student'
         AND streak > 0
         AND last_active_date IS NOT NULL
         AND last_active_date < $1
       RETURNING id, streak, last_active_date`,
      [yesterday],
    );

    return res.json({
      ok: true,
      reset_count: r.rowCount,
      cutoff_date: yesterday,
    });
  } catch (e: any) {
    console.error("[streak/decrement] HATA:", e?.message);
    return res.status(500).json({ error: e?.message });
  }
});

// Debug — kimlerin streak'i sıfırlanmak üzere
router.get("/internal/streak/at-risk-preview", async (req: Request, res: Response) => {
  if (!checkInternal(req, res)) return;
  try {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const r = await pool.query(
      `SELECT id, first_name, streak, last_active_date
       FROM users
       WHERE role = 'student' AND streak > 0
         AND last_active_date IS NOT NULL
         AND last_active_date < $1
       ORDER BY streak DESC
       LIMIT 100`,
      [yesterday],
    );
    return res.json({ ok: true, cutoff: yesterday, count: r.rowCount, users: r.rows });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
});

export default router;
