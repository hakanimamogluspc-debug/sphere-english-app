/**
 * Öğrenci Content Articles (public — auth'lu ama admin değil).
 *
 * PUBLIC endpoints:
 *   GET  /content/feed?category=&cefr=&q=&cursor=&limit=
 *   GET  /content/recommended?limit=3    → kullanıcının CEFR'ına göre 3 makale
 *   GET  /content/:id                    → detay (key_vocab + body dahil, view interaction kaydı)
 *   POST /content/:id/save               → kaydet
 *   DELETE /content/:id/save             → save kaldır
 *   POST /content/:id/interact           → { action: 'view'|'like'|'complete_read'|'dismiss' }
 *   GET  /content/saved                  → kullanıcının kaydettikleri
 */

import { Router, type Response } from "express";
import { pool } from "@workspace/db";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";
import { awardPoints } from "../lib/points";

const router = Router();

// ─── FEED ───────────────────────────────────────────────────────────
router.get("/content/feed", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const category = String(req.query.category ?? "all");
    const cefr = String(req.query.cefr ?? "all");
    const q = String(req.query.q ?? "").trim();
    const savedOnly = String(req.query.saved ?? "") === "1";
    const limit = Math.min(parseInt(String(req.query.limit ?? "24"), 10) || 24, 50);
    const cursor = parseInt(String(req.query.cursor ?? "0"), 10) || 0;

    const wh: string[] = [`ca.status = 'published'`];
    const params: any[] = [];

    if (category !== "all") { params.push(category); wh.push(`ca.category = $${params.length}`); }
    if (cefr !== "all") { params.push(cefr); wh.push(`ca.cefr_level = $${params.length}`); }
    if (q) { params.push(`%${q}%`); wh.push(`(ca.title ILIKE $${params.length} OR ca.tr_summary ILIKE $${params.length})`); }
    if (cursor > 0) { params.push(cursor); wh.push(`ca.id < $${params.length}`); }

    const savedJoin = savedOnly
      ? `INNER JOIN user_saved_articles usa ON usa.article_id = ca.id AND usa.user_id = $${params.length + 1}`
      : `LEFT JOIN user_saved_articles usa ON usa.article_id = ca.id AND usa.user_id = $${params.length + 1}`;
    params.push(userId);
    params.push(limit);

    const sql = `
      SELECT ca.id, ca.source, ca.url, ca.title, ca.subtitle, ca.image_url, ca.author,
             ca.published_at, ca.tr_summary, ca.cefr_level, ca.category, ca.tags,
             ca.published_admin_at, ca.audio_url, ca.duration_sec, ca.content_type,
             (usa.saved_at IS NOT NULL) AS saved
        FROM content_articles ca
        ${savedJoin}
        WHERE ${wh.join(" AND ")}
        ORDER BY COALESCE(ca.published_admin_at, ca.published_at, ca.created_at) DESC, ca.id DESC
        LIMIT $${params.length}
    `;
    const r: any = await pool.query(sql, params);
    const items = r.rows;
    const nextCursor = items.length === limit ? items[items.length - 1].id : null;
    return res.json({ items, nextCursor });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
});

// ─── RECOMMENDED (dashboard widget için) ──────────────────────────────
router.get("/content/recommended", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const limit = Math.min(parseInt(String(req.query.limit ?? "3"), 10) || 3, 10);

    // kullanıcının CEFR'ını çek
    const u: any = await pool.query(`SELECT current_level FROM users WHERE id = $1`, [userId]);
    const userLevel = u.rows[0]?.current_level ?? "B1";

    // Son 30 gün içinde 'view' interaction alınan article_id'leri çıkar
    const excludeRes: any = await pool.query(
      `SELECT DISTINCT article_id FROM article_interactions
         WHERE user_id = $1 AND action = 'view' AND created_at > NOW() - INTERVAL '30 days'`,
      [userId],
    );
    const excludeIds: number[] = excludeRes.rows.map((r: any) => r.article_id);

    // CEFR seviyesine yakın 2 seviye + tam seviye
    const levelOrder = ["A2", "B1", "B2", "C1", "C2"];
    const idx = levelOrder.indexOf(userLevel);
    const acceptableLevels = idx >= 0
      ? levelOrder.slice(Math.max(0, idx - 1), Math.min(levelOrder.length, idx + 2))
      : ["B1", "B2"];

    const params: any[] = ["published", acceptableLevels];
    let excludeClause = "";
    if (excludeIds.length > 0) {
      params.push(excludeIds);
      excludeClause = `AND ca.id != ALL($${params.length})`;
    }
    params.push(limit);

    const r: any = await pool.query(
      `SELECT ca.id, ca.title, ca.tr_summary, ca.image_url, ca.category, ca.cefr_level, ca.tags,
              ca.published_at, ca.author
         FROM content_articles ca
         WHERE ca.status = $1
           AND ca.cefr_level = ANY($2)
           ${excludeClause}
         ORDER BY COALESCE(ca.published_admin_at, ca.published_at, ca.created_at) DESC
         LIMIT $${params.length}`,
      params,
    );

    return res.json({ items: r.rows, userLevel });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
});

// ─── DETAIL (view interaction otomatik kaydedilir) ────────────────────
router.get("/content/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "id" });

    const r: any = await pool.query(
      `SELECT ca.*,
              (SELECT saved_at FROM user_saved_articles WHERE user_id = $2 AND article_id = ca.id) AS saved_at,
              (SELECT note FROM user_saved_articles WHERE user_id = $2 AND article_id = ca.id) AS user_note
         FROM content_articles ca
         WHERE ca.id = $1 AND ca.status = 'published'`,
      [id, userId],
    );
    const article = r.rows[0];
    if (!article) return res.status(404).json({ error: "bulunamadı" });

    // View interaction kaydet (fire and forget)
    pool.query(
      `INSERT INTO article_interactions (user_id, article_id, action) VALUES ($1, $2, 'view')`,
      [userId, id],
    ).catch(() => {});

    // Puan ver — günde max 10 puan makale görüntülemekten
    awardPoints(userId, "article_view", { dailyCap: 10, refId: id, silent: true }).catch(() => {});
    // İlk kez makale okuma bonusu
    awardPoints(userId, "first_article_read", { onceEverForRef: true, refId: "any", silent: true }).catch(() => {});

    return res.json({ article });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
});

// ─── SAVE / UNSAVE ──────────────────────────────────────────────────
router.post("/content/:id/save", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const id = parseInt(req.params.id, 10);
    const note = (req.body?.note ?? "").toString().slice(0, 2000) || null;
    await pool.query(
      `INSERT INTO user_saved_articles (user_id, article_id, note)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, article_id) DO UPDATE SET note = EXCLUDED.note`,
      [userId, id, note],
    );
    pool.query(
      `INSERT INTO article_interactions (user_id, article_id, action) VALUES ($1, $2, 'save')`,
      [userId, id],
    ).catch(() => {});
    // Save puan (aynı makale 1 kere)
    awardPoints(userId, "article_save", { onceEverForRef: true, refId: `save:${id}`, silent: true }).catch(() => {});
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
});

router.delete("/content/:id/save", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const id = parseInt(req.params.id, 10);
    await pool.query(`DELETE FROM user_saved_articles WHERE user_id = $1 AND article_id = $2`, [userId, id]);
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
});

// ─── INTERACT (view/like/complete_read/dismiss) ────────────────────────
router.post("/content/:id/interact", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const id = parseInt(req.params.id, 10);
    const action = String(req.body?.action ?? "").toLowerCase();
    const allowed = ["view", "like", "complete_read", "dismiss"];
    if (!allowed.includes(action)) return res.status(400).json({ error: "geçersiz action" });
    await pool.query(
      `INSERT INTO article_interactions (user_id, article_id, action, metadata)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [userId, id, action, JSON.stringify(req.body?.metadata ?? null)],
    );
    // Complete read puan (aynı makale bir kez)
    if (action === "complete_read") {
      awardPoints(userId, "article_complete_read", { onceEverForRef: true, refId: `complete:${id}`, silent: true }).catch(() => {});
    }
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
});

export default router;
