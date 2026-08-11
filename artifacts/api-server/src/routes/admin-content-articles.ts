/**
 * Admin Content Articles routes.
 *
 * ADMIN endpoints:
 *   GET    /admin/content-articles?status=draft&category=..&q=..
 *   GET    /admin/content-articles/:id
 *   POST   /admin/content-articles                  → manuel yeni makale
 *   PATCH  /admin/content-articles/:id              → tr_summary/cefr/category/tags/status update
 *   DELETE /admin/content-articles/:id
 *   POST   /admin/content-articles/:id/publish
 *   POST   /admin/content-articles/:id/archive
 *   POST   /admin/content-articles/:id/reenrich     → GPT tekrar çalıştır
 *   POST   /admin/content-ingest/run                → Guardian fetch + auto-enrich
 *   GET    /admin/content-ingest/status             → son 20 run log
 */

import { Router, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth";
import { fetchGuardianArticles } from "../lib/content-ingest/guardian";
import { enrichArticle, enrichPending } from "../lib/content-ingest/enrich";
import { fetchLearningEnglish } from "../lib/content-ingest/learning-english";

const router = Router();

// ─── LIST ────────────────────────────────────────────────────────────────
router.get("/admin/content-articles", authMiddleware, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const status = String(req.query.status ?? "all");
    const category = String(req.query.category ?? "all");
    const cefr = String(req.query.cefr ?? "all");
    const q = String(req.query.q ?? "").trim();
    const limit = Math.min(parseInt(String(req.query.limit ?? "50"), 10) || 50, 200);
    const offset = Math.max(parseInt(String(req.query.offset ?? "0"), 10) || 0, 0);

    const wh: string[] = [];
    const params: any[] = [];
    if (status !== "all") { params.push(status); wh.push(`status = $${params.length}`); }
    if (category !== "all") { params.push(category); wh.push(`category = $${params.length}`); }
    if (cefr !== "all") { params.push(cefr); wh.push(`cefr_level = $${params.length}`); }
    if (q) { params.push(`%${q}%`); wh.push(`(title ILIKE $${params.length} OR tr_summary ILIKE $${params.length})`); }
    const where = wh.length ? `WHERE ${wh.join(" AND ")}` : "";

    params.push(limit, offset);
    const r: any = await pool.query(
      `SELECT id, source, external_id, url, title, subtitle, snippet, image_url, author,
              published_at, tr_summary, cefr_level, category, tags, status, enriched_at,
              published_admin_at, created_at
         FROM content_articles ${where}
         ORDER BY COALESCE(published_admin_at, published_at, created_at) DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    const totalRes: any = await pool.query(
      `SELECT COUNT(*)::int AS n FROM content_articles ${where}`,
      params.slice(0, params.length - 2),
    );

    return res.json({ articles: r.rows, total: totalRes.rows[0]?.n ?? 0 });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
});

// ─── DETAIL ─────────────────────────────────────────────────────────────
router.get("/admin/content-articles/:id", authMiddleware, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const r: any = await pool.query(`SELECT * FROM content_articles WHERE id = $1`, [id]);
    if (!r.rows[0]) return res.status(404).json({ error: "not found" });
    return res.json({ article: r.rows[0] });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
});

// ─── CREATE (manuel) ────────────────────────────────────────────────────
router.post("/admin/content-articles", authMiddleware, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { url, title, subtitle, snippet, body_text, body_html, image_url, author,
            published_at, tr_summary, cefr_level, category, tags } = req.body ?? {};
    if (!title || !url) return res.status(400).json({ error: "title + url gerekli" });
    const r: any = await pool.query(
      `INSERT INTO content_articles
         (source, url, title, subtitle, snippet, body_text, body_html, image_url, author,
          published_at, tr_summary, cefr_level, category, tags, status)
       VALUES ('manual', $1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9::timestamptz, NOW()),
               $10, $11, $12, $13, 'draft')
       RETURNING id`,
      [url, title, subtitle ?? null, snippet ?? null, body_text ?? null, body_html ?? null,
       image_url ?? null, author ?? null, published_at ?? null,
       tr_summary ?? null, cefr_level ?? null, category ?? null,
       Array.isArray(tags) ? tags : []],
    );
    return res.json({ ok: true, id: r.rows[0].id });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
});

// ─── UPDATE ─────────────────────────────────────────────────────────────
router.patch("/admin/content-articles/:id", authMiddleware, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const allowed = ["title", "subtitle", "snippet", "tr_summary", "cefr_level", "category", "tags", "admin_notes", "image_url"];
    const sets: string[] = [];
    const params: any[] = [];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        params.push(req.body[key]);
        sets.push(`${key} = $${params.length}`);
      }
    }
    if (!sets.length) return res.status(400).json({ error: "güncellenecek alan yok" });
    params.push(id);
    await pool.query(
      `UPDATE content_articles SET ${sets.join(", ")}, updated_at = NOW() WHERE id = $${params.length}`,
      params,
    );
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
});

router.delete("/admin/content-articles/:id", authMiddleware, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    await pool.query(`DELETE FROM content_articles WHERE id = $1`, [id]);
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
});

// ─── PUBLISH / ARCHIVE ──────────────────────────────────────────────────
router.post("/admin/content-articles/:id/publish", authMiddleware, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    await pool.query(
      `UPDATE content_articles SET status='published', published_admin_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [id],
    );
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
});

router.post("/admin/content-articles/:id/archive", authMiddleware, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    await pool.query(`UPDATE content_articles SET status='archived', updated_at = NOW() WHERE id = $1`, [id]);
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
});

// ─── RE-ENRICH ──────────────────────────────────────────────────────────
router.post("/admin/content-articles/:id/reenrich", authMiddleware, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const r = await enrichArticle(id);
    return res.json(r);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
});

// ─── INGESTION ──────────────────────────────────────────────────────────
router.post("/admin/content-ingest/run", authMiddleware, requireRole("admin"), async (_req: AuthRequest, res: Response) => {
  const startedAt = Date.now();
  try {
    const fetchResult = await fetchGuardianArticles();
    // Yeni eklenenler için enrichment
    let enriched = 0, enrichFailed = 0;
    for (const id of fetchResult.articleIds) {
      const r = await enrichArticle(id);
      if (r.ok) enriched++; else enrichFailed++;
    }

    const durationMs = Date.now() - startedAt;
    await pool.query(
      `INSERT INTO content_ingestion_log (source, fetched_count, new_count, enriched_count, error_count, duration_ms, details)
       VALUES ('guardian', $1, $2, $3, $4, $5, $6::jsonb)`,
      [fetchResult.fetched, fetchResult.inserted, enriched,
       fetchResult.errors.length + enrichFailed, durationMs,
       JSON.stringify({ errors: fetchResult.errors, skipped: fetchResult.skipped, enrichFailed })],
    );

    return res.json({
      ok: true,
      fetched: fetchResult.fetched,
      inserted: fetchResult.inserted,
      skipped: fetchResult.skipped,
      enriched,
      enrichFailed,
      errors: fetchResult.errors,
      durationMs,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
});

// BBC Learning English + VOA Learning English manuel tetikleme
router.post("/admin/content-ingest/learning-english", authMiddleware, requireRole("admin"), async (_req: AuthRequest, res: Response) => {
  const startedAt = Date.now();
  try {
    const fetchResult = await fetchLearningEnglish(5);
    let enriched = 0, enrichFailed = 0;
    for (const id of fetchResult.articleIds) {
      const r = await enrichArticle(id);
      if (r.ok) enriched++; else enrichFailed++;
    }
    const durationMs = Date.now() - startedAt;
    await pool.query(
      `INSERT INTO content_ingestion_log (source, fetched_count, new_count, enriched_count, error_count, duration_ms, details)
       VALUES ('learning_english', $1, $2, $3, $4, $5, $6::jsonb)`,
      [fetchResult.fetched, fetchResult.inserted, enriched,
       fetchResult.errors.length + enrichFailed, durationMs,
       JSON.stringify({ errors: fetchResult.errors, skipped: fetchResult.skipped, enrichFailed })],
    );
    return res.json({
      ok: true,
      fetched: fetchResult.fetched,
      inserted: fetchResult.inserted,
      skipped: fetchResult.skipped,
      enriched,
      enrichFailed,
      errors: fetchResult.errors,
      durationMs,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
});

router.post("/admin/content-ingest/enrich-pending", authMiddleware, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const limit = parseInt(String(req.query.limit ?? "20"), 10) || 20;
    const r = await enrichPending(limit);
    return res.json(r);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
});

router.get("/admin/content-ingest/status", authMiddleware, requireRole("admin"), async (_req: AuthRequest, res: Response) => {
  try {
    const r: any = await pool.query(
      `SELECT id, source, run_at, fetched_count, new_count, enriched_count, error_count, duration_ms, details
         FROM content_ingestion_log ORDER BY run_at DESC LIMIT 20`,
    );
    const stats: any = await pool.query(
      `SELECT status, COUNT(*)::int AS n FROM content_articles GROUP BY status`,
    );
    return res.json({ runs: r.rows, stats: stats.rows });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
});

export default router;
