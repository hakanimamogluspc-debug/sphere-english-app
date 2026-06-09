/**
 * Admin Analytics — kullanıcıların günlük/haftalık/aylık aktif kullanım dakikalarını sunar.
 *
 * Endpoint'ler:
 *   GET /api/admin/analytics/summary?from&to
 *      Toplam aktif kullanıcı, toplam dakika, ortalama dakika/kullanıcı, en aktif modül
 *
 *   GET /api/admin/analytics/users-daily?from&to&limit&offset&q&role
 *      Her kullanıcı için seçili aralıktaki toplam dakika ve son aktivite
 *
 *   GET /api/admin/analytics/user-detail/:userId?from&to
 *      Belirli kullanıcının modül kırılımı + günlük zaman serisi
 *
 *   GET /api/admin/analytics/trend?from&to
 *      Tüm kullanıcılar için günlük toplam dakika (sitewide line chart için)
 *
 * Tüm endpoint'ler authMiddleware + requireRole("admin") arkasında.
 */

import { Router, type Response } from "express";
import { pool } from "@workspace/db";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth.js";

const router = Router();

// ─── Tarih yardımcıları ─────────────────────────────────────────────────────
function parseDate(s: unknown, fallback: () => string): string {
  if (typeof s !== "string") return fallback();
  const m = s.match(/^\d{4}-\d{2}-\d{2}$/);
  if (!m) return fallback();
  return s;
}

function defaultFrom(): string {
  // Son 7 gün dahil
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 6);
  return d.toISOString().slice(0, 10);
}

function defaultTo(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── GET /admin/analytics/summary ──────────────────────────────────────────
router.get(
  "/admin/analytics/summary",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    const from = parseDate(req.query.from, defaultFrom);
    const to = parseDate(req.query.to, defaultTo);

    try {
      const [totals, topModuleRow, activeUsersRow] = await Promise.all([
        pool.query<{ total_minutes: string | null; total_rows: string }>(
          `SELECT COALESCE(SUM(minutes), 0)::text AS total_minutes,
                  COUNT(*)::text AS total_rows
           FROM user_daily_activity
           WHERE date BETWEEN $1 AND $2`,
          [from, to],
        ),
        pool.query<{ module: string; total: string }>(
          `SELECT module, COALESCE(SUM(minutes), 0)::text AS total
           FROM user_daily_activity
           WHERE date BETWEEN $1 AND $2
           GROUP BY module
           ORDER BY SUM(minutes) DESC
           LIMIT 1`,
          [from, to],
        ),
        pool.query<{ active_users: string }>(
          `SELECT COUNT(DISTINCT user_id)::text AS active_users
           FROM user_daily_activity
           WHERE date BETWEEN $1 AND $2`,
          [from, to],
        ),
      ]);

      const totalMinutes = parseInt(totals.rows[0]?.total_minutes ?? "0", 10);
      const activeUsers = parseInt(activeUsersRow.rows[0]?.active_users ?? "0", 10);
      const avgMinutesPerUser = activeUsers > 0 ? Math.round(totalMinutes / activeUsers) : 0;
      const topModule = topModuleRow.rows[0]
        ? { module: topModuleRow.rows[0].module, minutes: parseInt(topModuleRow.rows[0].total, 10) }
        : null;

      res.json({
        from,
        to,
        activeUsers,
        totalMinutes,
        avgMinutesPerUser,
        topModule,
      });
    } catch (err: any) {
      console.error("[analytics/summary] error:", err?.message);
      res.status(500).json({ error: err?.message ?? "Veri alınamadı." });
    }
  },
);

// ─── GET /admin/analytics/users-daily ──────────────────────────────────────
router.get(
  "/admin/analytics/users-daily",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    const from = parseDate(req.query.from, defaultFrom);
    const to = parseDate(req.query.to, defaultTo);
    const limit = Math.min(parseInt((req.query.limit as string) || "50", 10) || 50, 200);
    const offset = Math.max(parseInt((req.query.offset as string) || "0", 10) || 0, 0);
    const search = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
    const role = typeof req.query.role === "string" ? req.query.role.slice(0, 20) : "";

    try {
      const params: any[] = [from, to];
      const where: string[] = [`uda.date BETWEEN $1 AND $2`];
      if (search) {
        params.push(`%${search}%`);
        const idx = params.length;
        where.push(`(u.first_name ILIKE $${idx} OR u.last_name ILIKE $${idx} OR u.email ILIKE $${idx})`);
      }
      if (role) {
        params.push(role);
        where.push(`u.role = $${params.length}`);
      }

      params.push(limit, offset);
      const limitIdx = params.length - 1;
      const offsetIdx = params.length;

      const sql = `
        SELECT u.id            AS user_id,
               u.first_name    AS first_name,
               u.last_name     AS last_name,
               u.email         AS email,
               u.role          AS role,
               u.current_level AS level,
               u.student_number AS student_number,
               COALESCE(SUM(uda.minutes), 0)::int AS total_minutes,
               COUNT(DISTINCT uda.date)::int     AS active_days,
               MAX(uda.last_updated)             AS last_active
        FROM users u
        INNER JOIN user_daily_activity uda ON uda.user_id = u.id
        WHERE ${where.join(" AND ")}
        GROUP BY u.id
        ORDER BY total_minutes DESC, last_active DESC
        LIMIT $${limitIdx} OFFSET $${offsetIdx}
      `;
      const result = await pool.query(sql, params);

      // Toplam kayıt (pagination için)
      const countSql = `
        SELECT COUNT(*)::int AS total FROM (
          SELECT u.id
          FROM users u
          INNER JOIN user_daily_activity uda ON uda.user_id = u.id
          WHERE ${where.join(" AND ")}
          GROUP BY u.id
        ) sub
      `;
      const countRes = await pool.query<{ total: number }>(countSql, params.slice(0, params.length - 2));

      res.json({
        from,
        to,
        total: countRes.rows[0]?.total ?? 0,
        items: result.rows.map((r: any) => ({
          userId: r.user_id,
          name: `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || r.email,
          email: r.email,
          role: r.role,
          level: r.level,
          studentNumber: r.student_number,
          totalMinutes: r.total_minutes,
          activeDays: r.active_days,
          lastActive: r.last_active,
        })),
      });
    } catch (err: any) {
      console.error("[analytics/users-daily] error:", err?.message);
      res.status(500).json({ error: err?.message ?? "Veri alınamadı." });
    }
  },
);

// ─── GET /admin/analytics/user-detail/:userId ──────────────────────────────
router.get(
  "/admin/analytics/user-detail/:userId",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    const userId = parseInt(req.params.userId, 10);
    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(400).json({ error: "Geçersiz userId." });
    }
    const from = parseDate(req.query.from, defaultFrom);
    const to = parseDate(req.query.to, defaultTo);

    try {
      const [userRow, modulesRow, dailyRow] = await Promise.all([
        pool.query<{
          id: number;
          first_name: string;
          last_name: string;
          email: string;
          role: string;
          level: string | null;
          student_number: string | null;
          created_at: Date;
        }>(
          `SELECT id, first_name, last_name, email, role, current_level AS level, student_number, created_at
           FROM users WHERE id = $1`,
          [userId],
        ),
        pool.query<{ module: string; minutes: string }>(
          `SELECT module, SUM(minutes)::text AS minutes
           FROM user_daily_activity
           WHERE user_id = $1 AND date BETWEEN $2 AND $3
           GROUP BY module
           ORDER BY SUM(minutes) DESC`,
          [userId, from, to],
        ),
        pool.query<{ date: Date; minutes: string }>(
          `SELECT date, SUM(minutes)::text AS minutes
           FROM user_daily_activity
           WHERE user_id = $1 AND date BETWEEN $2 AND $3
           GROUP BY date
           ORDER BY date ASC`,
          [userId, from, to],
        ),
      ]);

      if (userRow.rows.length === 0) {
        return res.status(404).json({ error: "Kullanıcı bulunamadı." });
      }
      const u = userRow.rows[0];

      const modules = modulesRow.rows.map((r) => ({
        module: r.module,
        minutes: parseInt(r.minutes, 10),
      }));
      const totalMinutes = modules.reduce((acc, m) => acc + m.minutes, 0);

      const daily = dailyRow.rows.map((r) => ({
        date: r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date).slice(0, 10),
        minutes: parseInt(r.minutes, 10),
      }));

      res.json({
        user: {
          id: u.id,
          name: `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || u.email,
          email: u.email,
          role: u.role,
          level: u.level,
          studentNumber: u.student_number,
          createdAt: u.created_at,
        },
        from,
        to,
        totalMinutes,
        activeDays: daily.length,
        modules,
        daily,
      });
    } catch (err: any) {
      console.error("[analytics/user-detail] error:", err?.message);
      res.status(500).json({ error: err?.message ?? "Veri alınamadı." });
    }
  },
);

// ─── GET /admin/analytics/trend ────────────────────────────────────────────
router.get(
  "/admin/analytics/trend",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    const from = parseDate(req.query.from, () => {
      // Trend için varsayılan: son 30 gün
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - 29);
      return d.toISOString().slice(0, 10);
    });
    const to = parseDate(req.query.to, defaultTo);

    try {
      const result = await pool.query<{ date: Date; minutes: string; active_users: string }>(
        `SELECT date,
                SUM(minutes)::text AS minutes,
                COUNT(DISTINCT user_id)::text AS active_users
         FROM user_daily_activity
         WHERE date BETWEEN $1 AND $2
         GROUP BY date
         ORDER BY date ASC`,
        [from, to],
      );

      const daily = result.rows.map((r) => ({
        date: r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date).slice(0, 10),
        minutes: parseInt(r.minutes, 10),
        activeUsers: parseInt(r.active_users, 10),
      }));

      res.json({ from, to, daily });
    } catch (err: any) {
      console.error("[analytics/trend] error:", err?.message);
      res.status(500).json({ error: err?.message ?? "Veri alınamadı." });
    }
  },
);

export default router;
