/**
 * Öğrenci "Raporum" endpoints.
 *
 *   GET /my/report/latest              → en son haftalık rapor (weekly_reports_sent'ten) veya on-the-fly
 *   GET /my/report/history?limit=10    → geçmiş raporlar
 *   GET /my/mistakes?type=&unresolved=1&limit=  → kullanıcının hataları
 *   POST /my/mistakes/:id/resolve      → "anladım" işaretle
 *   POST /admin/weekly-report/run      → manuel trigger (admin)
 *   POST /admin/weekly-report/preview  → { userId } → tek kullanıcıya test raporu
 */

import { Router, type Response } from "express";
import { pool } from "@workspace/db";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth";
import { generateWeeklyReport, sendWeeklyReportToUser, runWeeklyReportForAllUsers } from "../lib/weekly-report";
import { extractPending } from "../lib/mistake-extractor";

const router = Router();

router.get("/my/report/latest", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    // Önce kaydedilmiş var mı bak (son 8 gün)
    const saved: any = await pool.query(
      `SELECT week_start, sent_at, summary FROM weekly_reports_sent
         WHERE user_id = $1 AND sent_at > NOW() - INTERVAL '8 days'
         ORDER BY sent_at DESC LIMIT 1`,
      [userId],
    );
    if (saved.rows[0]) {
      return res.json({ report: saved.rows[0].summary, cached: true, weekStart: saved.rows[0].week_start });
    }
    // Yoksa on-the-fly üret
    const report = await generateWeeklyReport(userId);
    return res.json({ report, cached: false });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
});

router.get("/my/report/history", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const limit = Math.min(parseInt(String(req.query.limit ?? "10"), 10) || 10, 30);
    const r: any = await pool.query(
      `SELECT week_start, sent_at, summary FROM weekly_reports_sent
         WHERE user_id = $1
         ORDER BY week_start DESC LIMIT $2`,
      [userId, limit],
    );
    return res.json({ reports: r.rows });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
});

router.get("/my/mistakes", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const type = String(req.query.type ?? "all");
    const unresolved = String(req.query.unresolved ?? "1") === "1";
    const limit = Math.min(parseInt(String(req.query.limit ?? "50"), 10) || 50, 200);

    const wh: string[] = [`user_id = $1`];
    const params: any[] = [userId];
    if (type !== "all") { params.push(type); wh.push(`mistake_type = $${params.length}`); }
    if (unresolved) wh.push(`resolved_at IS NULL`);
    params.push(limit);

    const r: any = await pool.query(
      `SELECT id, mistake_type, wrong_text, correct_text, explanation, context,
              source_module, cefr_tag, tags, occurrence_count, first_seen_at, last_seen_at, resolved_at
         FROM user_mistakes
         WHERE ${wh.join(" AND ")}
         ORDER BY occurrence_count DESC, last_seen_at DESC
         LIMIT $${params.length}`,
      params,
    );

    // Type başına özet
    const stats: any = await pool.query(
      `SELECT mistake_type, COUNT(*)::int AS n
         FROM user_mistakes WHERE user_id = $1 AND resolved_at IS NULL
         GROUP BY mistake_type`,
      [userId],
    );

    return res.json({ mistakes: r.rows, stats: stats.rows });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
});

router.post("/my/mistakes/:id/resolve", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const id = parseInt(req.params.id, 10);
    await pool.query(
      `UPDATE user_mistakes SET resolved_at = NOW()
         WHERE id = $1 AND user_id = $2 AND resolved_at IS NULL`,
      [id, userId],
    );
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
});

// ─── ADMIN ─────────────────────────────────────────────────────────
router.post("/admin/weekly-report/run", authMiddleware, requireRole("admin"), async (_req: AuthRequest, res: Response) => {
  try {
    const r = await runWeeklyReportForAllUsers();
    return res.json({ ok: true, ...r });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
});

router.post("/admin/weekly-report/preview", authMiddleware, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const userId = parseInt(String(req.body?.userId ?? req.userId), 10);
    const r = await sendWeeklyReportToUser(userId);
    return res.json(r);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
});

router.post("/admin/mistake-extraction/run", authMiddleware, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const limit = parseInt(String(req.body?.limit ?? "20"), 10);
    const r = await extractPending(limit);
    return res.json({ ok: true, ...r });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
});

export default router;
