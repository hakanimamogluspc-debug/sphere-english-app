/**
 * Admin Career Content routes.
 *
 *   GET/PATCH/DELETE /admin/career-content
 *   POST /admin/career-content/:id/publish|archive|reenrich
 *   POST /admin/career-ingest/run
 *   POST /admin/career-ingest/enrich-pending
 *   GET  /admin/career-ingest/status
 *   Sources CRUD: /admin/career-sources
 */

import { Router, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth";
import { fetchAllSources, enrichCareerItem, enrichPending } from "../lib/career-ingest";

const router = Router();

// ─── CONTENT LIST + CRUD ────────────────────────────────────────
router.get("/admin/career-content", authMiddleware, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const status = String(req.query.status ?? "all");
    const type = String(req.query.type ?? "all");
    const language = String(req.query.language ?? "all");
    const category = String(req.query.category ?? "all");
    const source = String(req.query.source ?? "all");
    const q = String(req.query.q ?? "").trim();
    const limit = Math.min(parseInt(String(req.query.limit ?? "100"), 10) || 100, 300);

    const wh: string[] = [];
    const params: any[] = [];
    if (status !== "all") { params.push(status); wh.push(`status = $${params.length}`); }
    if (type !== "all") { params.push(type); wh.push(`source_type = $${params.length}`); }
    if (language !== "all") { params.push(language); wh.push(`language = $${params.length}`); }
    if (category !== "all") { params.push(category); wh.push(`category = $${params.length}`); }
    if (source !== "all") { params.push(source); wh.push(`source_slug = $${params.length}`); }
    if (q) { params.push(`%${q}%`); wh.push(`(title ILIKE $${params.length} OR tr_summary ILIKE $${params.length})`); }
    const where = wh.length ? `WHERE ${wh.join(" AND ")}` : "";
    params.push(limit);

    const r: any = await pool.query(
      `SELECT id, source_slug, source_type, url, audio_url, title, description, thumbnail_url,
              author, duration_sec, language, published_at, tr_summary, category, tags,
              status, admin_notes, enriched_at, published_admin_at
         FROM career_content ${where}
         ORDER BY COALESCE(published_admin_at, published_at, created_at) DESC
         LIMIT $${params.length}`,
      params,
    );
    const stats: any = await pool.query(
      `SELECT status, COUNT(*)::int AS n FROM career_content GROUP BY status`,
    );
    return res.json({ items: r.rows, stats: stats.rows });
  } catch (e: any) { return res.status(500).json({ error: e?.message }); }
});

router.patch("/admin/career-content/:id", authMiddleware, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const allowed = ["title", "description", "tr_summary", "category", "tags", "language", "admin_notes", "thumbnail_url"];
    const sets: string[] = []; const params: any[] = [];
    for (const k of allowed) {
      if (req.body[k] !== undefined) { params.push(req.body[k]); sets.push(`${k} = $${params.length}`); }
    }
    if (!sets.length) return res.status(400).json({ error: "güncellenecek alan yok" });
    params.push(id);
    await pool.query(`UPDATE career_content SET ${sets.join(", ")}, updated_at = NOW() WHERE id = $${params.length}`, params);
    return res.json({ ok: true });
  } catch (e: any) { return res.status(500).json({ error: e?.message }); }
});

router.delete("/admin/career-content/:id", authMiddleware, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    await pool.query(`DELETE FROM career_content WHERE id = $1`, [parseInt(req.params.id, 10)]);
    return res.json({ ok: true });
  } catch (e: any) { return res.status(500).json({ error: e?.message }); }
});

router.post("/admin/career-content/:id/publish", authMiddleware, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    await pool.query(
      `UPDATE career_content SET status='published', published_admin_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [parseInt(req.params.id, 10)],
    );
    return res.json({ ok: true });
  } catch (e: any) { return res.status(500).json({ error: e?.message }); }
});

router.post("/admin/career-content/:id/archive", authMiddleware, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    await pool.query(`UPDATE career_content SET status='archived', updated_at = NOW() WHERE id = $1`, [parseInt(req.params.id, 10)]);
    return res.json({ ok: true });
  } catch (e: any) { return res.status(500).json({ error: e?.message }); }
});

router.post("/admin/career-content/:id/reenrich", authMiddleware, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const r = await enrichCareerItem(parseInt(req.params.id, 10));
    return res.json(r);
  } catch (e: any) { return res.status(500).json({ error: e?.message }); }
});

// ─── INGEST ────────────────────────────────────────────────────
router.post("/admin/career-ingest/run", authMiddleware, requireRole("admin"), async (_req: AuthRequest, res: Response) => {
  const startedAt = Date.now();
  try {
    const fetchResult = await fetchAllSources(5);
    let enriched = 0, enrichFailed = 0;
    for (const id of fetchResult.articleIds) {
      const r = await enrichCareerItem(id);
      if (r.ok) enriched++; else enrichFailed++;
    }
    const durationMs = Date.now() - startedAt;
    await pool.query(
      `INSERT INTO career_ingestion_log (fetched_count, new_count, enriched_count, error_count, duration_ms, details)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [fetchResult.fetched, fetchResult.inserted, enriched,
       fetchResult.errors.length + enrichFailed, durationMs,
       JSON.stringify({ errors: fetchResult.errors, skipped: fetchResult.skipped, enrichFailed })],
    );
    return res.json({ ok: true, ...fetchResult, enriched, enrichFailed, durationMs });
  } catch (e: any) { return res.status(500).json({ error: e?.message }); }
});

router.post("/admin/career-ingest/enrich-pending", authMiddleware, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const limit = parseInt(String(req.query.limit ?? "20"), 10);
    const r = await enrichPending(limit);
    return res.json(r);
  } catch (e: any) { return res.status(500).json({ error: e?.message }); }
});

router.get("/admin/career-ingest/status", authMiddleware, requireRole("admin"), async (_req: AuthRequest, res: Response) => {
  try {
    const runs: any = await pool.query(
      `SELECT * FROM career_ingestion_log ORDER BY run_at DESC LIMIT 20`,
    );
    return res.json({ runs: runs.rows });
  } catch (e: any) { return res.status(500).json({ error: e?.message }); }
});

// ─── SOURCES CRUD ──────────────────────────────────────────────
router.get("/admin/career-sources", authMiddleware, requireRole("admin"), async (_req: AuthRequest, res: Response) => {
  try {
    const r: any = await pool.query(
      `SELECT s.*, (SELECT COUNT(*)::int FROM career_content c WHERE c.source_id = s.id) AS content_count
         FROM career_sources s ORDER BY is_active DESC, source_type, name`,
    );
    return res.json({ sources: r.rows });
  } catch (e: any) { return res.status(500).json({ error: e?.message }); }
});

router.post("/admin/career-sources", authMiddleware, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { slug, name, source_type, language, feed_url, site_url, is_active } = req.body ?? {};
    if (!slug || !name || !source_type || !feed_url) return res.status(400).json({ error: "slug + name + source_type + feed_url zorunlu" });
    await pool.query(
      `INSERT INTO career_sources (slug, name, source_type, language, feed_url, site_url, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, TRUE))`,
      [slug, name, source_type, language || "en", feed_url, site_url ?? null, is_active],
    );
    return res.json({ ok: true });
  } catch (e: any) { return res.status(500).json({ error: e?.message }); }
});

router.patch("/admin/career-sources/:id", authMiddleware, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const allowed = ["name", "source_type", "language", "feed_url", "site_url", "is_active"];
    const sets: string[] = []; const params: any[] = [];
    for (const k of allowed) {
      if (req.body[k] !== undefined) { params.push(req.body[k]); sets.push(`${k} = $${params.length}`); }
    }
    if (!sets.length) return res.status(400).json({ error: "yok" });
    params.push(id);
    await pool.query(`UPDATE career_sources SET ${sets.join(", ")} WHERE id = $${params.length}`, params);
    return res.json({ ok: true });
  } catch (e: any) { return res.status(500).json({ error: e?.message }); }
});

router.delete("/admin/career-sources/:id", authMiddleware, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    await pool.query(`DELETE FROM career_sources WHERE id = $1`, [parseInt(req.params.id, 10)]);
    return res.json({ ok: true });
  } catch (e: any) { return res.status(500).json({ error: e?.message }); }
});

// ─── PUBLIC (öğrenci) endpoints ───────────────────────────────
router.get("/career/feed", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const type = String(req.query.type ?? "all");
    const language = String(req.query.language ?? "all");
    const category = String(req.query.category ?? "all");
    const limit = Math.min(parseInt(String(req.query.limit ?? "24"), 10) || 24, 50);
    const cursor = parseInt(String(req.query.cursor ?? "0"), 10) || 0;

    const wh: string[] = [`status = 'published'`];
    const params: any[] = [];
    if (type !== "all") { params.push(type); wh.push(`source_type = $${params.length}`); }
    if (language !== "all") { params.push(language); wh.push(`language = $${params.length}`); }
    if (category !== "all") { params.push(category); wh.push(`category = $${params.length}`); }
    if (cursor > 0) { params.push(cursor); wh.push(`id < $${params.length}`); }
    params.push(limit);

    const r: any = await pool.query(
      `SELECT id, source_slug, source_type, url, audio_url, title, thumbnail_url,
              author, duration_sec, language, published_at, tr_summary, category, tags
         FROM career_content WHERE ${wh.join(" AND ")}
         ORDER BY COALESCE(published_admin_at, published_at, created_at) DESC, id DESC
         LIMIT $${params.length}`,
      params,
    );
    const items = r.rows;
    const nextCursor = items.length === limit ? items[items.length - 1].id : null;
    return res.json({ items, nextCursor });
  } catch (e: any) { return res.status(500).json({ error: e?.message }); }
});

router.get("/career/recommended", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? "3"), 10) || 3, 10);
    // Karışık: 1 video + 1 podcast + 1 TR (varsa)
    const r: any = await pool.query(
      `SELECT id, source_slug, source_type, url, title, thumbnail_url, author,
              duration_sec, language, published_at, tr_summary, category, tags
         FROM career_content
         WHERE status = 'published'
         ORDER BY COALESCE(published_admin_at, published_at, created_at) DESC
         LIMIT $1`,
      [limit],
    );
    return res.json({ items: r.rows });
  } catch (e: any) { return res.status(500).json({ error: e?.message }); }
});

export default router;
