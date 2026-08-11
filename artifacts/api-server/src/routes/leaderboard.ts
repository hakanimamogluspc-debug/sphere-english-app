import { Router } from "express";
import { pool } from "@workspace/db";
import { authMiddleware, type AuthRequest } from "../middlewares/auth.js";

const router = Router();

/**
 * GET /leaderboard?mode=week|month|all&level=B1
 *   week/month → puan son N gün içinde kazanılan
 *   all        → users.total_points (tüm zamanlar)
 */
router.get("/leaderboard", authMiddleware, async (req: AuthRequest, res) => {
  const mode = String(req.query.mode ?? "week");
  const level = req.query.level ? String(req.query.level) : null;

  const interval = mode === "month" ? "30 days" : mode === "week" ? "7 days" : null;
  const params: any[] = [];
  const wh: string[] = [`u.role = 'student'`];
  if (level && level !== "null") { params.push(level); wh.push(`u.current_level = $${params.length}`); }

  let sql: string;
  if (interval) {
    sql = `
      SELECT u.id, u.first_name, u.last_name, u.avatar, u.current_level,
             u.streak, u.badges, u.student_number,
             COALESCE(SUM(pe.amount) FILTER (WHERE pe.created_at > NOW() - INTERVAL '${interval}'), 0)::int AS period_points,
             u.total_points AS total_points_all
        FROM users u
        LEFT JOIN points_events pe ON pe.user_id = u.id
        WHERE ${wh.join(" AND ")}
        GROUP BY u.id
        HAVING COALESCE(SUM(pe.amount) FILTER (WHERE pe.created_at > NOW() - INTERVAL '${interval}'), 0) > 0
           OR u.id = $${params.length + 1}
        ORDER BY period_points DESC, u.total_points DESC
        LIMIT 50
    `;
    params.push(req.userId ?? 0);
  } else {
    sql = `
      SELECT u.id, u.first_name, u.last_name, u.avatar, u.current_level,
             u.streak, u.badges, u.student_number,
             u.total_points AS period_points,
             u.total_points AS total_points_all
        FROM users u
        WHERE ${wh.join(" AND ")}
        ORDER BY u.total_points DESC NULLS LAST
        LIMIT 50
    `;
  }

  const r: any = await pool.query(sql, params);
  const entries = r.rows.map((u: any, i: number) => ({
    rank: i + 1,
    userId: u.id,
    userName: `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim(),
    userAvatar: u.avatar,
    level: u.current_level,
    totalPoints: u.period_points,        // aktif mode puanı (frontend bunu gösterir)
    totalPointsAll: u.total_points_all,  // tüm zaman referans
    streak: u.streak,
    badges: Array.isArray(u.badges) ? u.badges.length : 0,
    isCurrentUser: u.id === req.userId,
    studentNumber: u.student_number || null,
  }));
  res.json(entries);
});

export default router;
