/**
 * Admin Speaking Scenes routes.
 *
 *   GET    /admin/scenes                         → tüm sahneler (filter: category/difficulty/active/q)
 *   GET    /admin/scenes/stats                   → kategori × seviye özet
 *   GET    /admin/scenes/:id                     → detay (turns dahil)
 *   PATCH  /admin/scenes/:id                     → başlık/rol/vs update + is_active
 *   DELETE /admin/scenes/:id                     → sil (cascade turns)
 *   POST   /admin/scenes/generate                → { category, difficulty, topic?, publish? }
 *   POST   /admin/scenes/bulk-fill               → { targetPerCategory: 10 } → hedef sayıya kadar tüm kategoriler
 *   PATCH  /admin/scenes/turns/:id               → tek turn güncelle (text_en/text_tr/notes/phonetic)
 *   DELETE /admin/scenes/turns/:id               → turn sil
 *   POST   /admin/scenes/:id/turns               → yeni turn ekle
 */

import { Router, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth";
import { generateScene, bulkFillCategory, bulkFillAll, CATEGORIES } from "../lib/scene-generator";

const router = Router();

router.get("/admin/scenes", authMiddleware, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const category = String(req.query.category ?? "all");
    const difficulty = String(req.query.difficulty ?? "all");
    const active = String(req.query.active ?? "all"); // all/active/inactive
    const q = String(req.query.q ?? "").trim();

    const wh: string[] = [];
    const params: any[] = [];
    if (category !== "all") { params.push(category); wh.push(`category = $${params.length}`); }
    if (difficulty !== "all") { params.push(difficulty); wh.push(`difficulty = $${params.length}`); }
    if (active === "active") wh.push(`is_active = TRUE`);
    if (active === "inactive") wh.push(`is_active = FALSE`);
    if (q) { params.push(`%${q}%`); wh.push(`(title_en ILIKE $${params.length} OR title_tr ILIKE $${params.length} OR slug ILIKE $${params.length})`); }
    const where = wh.length ? `WHERE ${wh.join(" AND ")}` : "";

    const r: any = await pool.query(
      `SELECT id, slug, category, title_en, title_tr, description_tr,
              user_role_tr, counterpart_role_tr, difficulty, min_plan,
              avg_duration_min, voice, is_active, sort_order,
              created_at, updated_at,
              (SELECT COUNT(*)::int FROM speaking_scene_turns t WHERE t.scene_id = s.id) AS turn_count
         FROM speaking_scenes s ${where}
         ORDER BY category, difficulty, sort_order, id`,
      params,
    );
    return res.json({ scenes: r.rows });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
});

router.get("/admin/scenes/stats", authMiddleware, requireRole("admin"), async (_req: AuthRequest, res: Response) => {
  try {
    const r: any = await pool.query(
      `SELECT category, difficulty, is_active,
              COUNT(*)::int AS n
         FROM speaking_scenes
         GROUP BY category, difficulty, is_active
         ORDER BY category, difficulty`,
    );
    return res.json({ stats: r.rows, categories: CATEGORIES });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
});

router.get("/admin/scenes/:id", authMiddleware, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const s: any = await pool.query(`SELECT * FROM speaking_scenes WHERE id = $1`, [id]);
    if (!s.rows[0]) return res.status(404).json({ error: "not found" });
    const t: any = await pool.query(
      `SELECT id, turn_order, speaker, text_en, text_tr, notes_tr, phonetic_hint
         FROM speaking_scene_turns WHERE scene_id = $1 ORDER BY turn_order`,
      [id],
    );
    return res.json({ scene: s.rows[0], turns: t.rows });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
});

router.patch("/admin/scenes/:id", authMiddleware, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const allowed = ["title_en", "title_tr", "description_tr", "user_role_tr", "counterpart_role_tr",
                     "difficulty", "min_plan", "avg_duration_min", "voice", "is_active", "sort_order", "category"];
    const sets: string[] = [];
    const params: any[] = [];
    for (const k of allowed) {
      if (req.body[k] !== undefined) {
        params.push(req.body[k]);
        sets.push(`${k} = $${params.length}`);
      }
    }
    if (!sets.length) return res.status(400).json({ error: "güncellenecek alan yok" });
    params.push(id);
    await pool.query(
      `UPDATE speaking_scenes SET ${sets.join(", ")}, updated_at = NOW() WHERE id = $${params.length}`,
      params,
    );
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
});

router.delete("/admin/scenes/:id", authMiddleware, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    await pool.query(`DELETE FROM speaking_scenes WHERE id = $1`, [id]);
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
});

// ─── Turn CRUD ─────────────────────────────────────────────────
router.patch("/admin/scenes/turns/:id", authMiddleware, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const allowed = ["speaker", "text_en", "text_tr", "notes_tr", "phonetic_hint", "turn_order"];
    const sets: string[] = [];
    const params: any[] = [];
    for (const k of allowed) {
      if (req.body[k] !== undefined) { params.push(req.body[k] || null); sets.push(`${k} = $${params.length}`); }
    }
    if (!sets.length) return res.status(400).json({ error: "güncellenecek alan yok" });
    params.push(id);
    await pool.query(`UPDATE speaking_scene_turns SET ${sets.join(", ")} WHERE id = $${params.length}`, params);
    return res.json({ ok: true });
  } catch (e: any) { return res.status(500).json({ error: e?.message }); }
});

router.delete("/admin/scenes/turns/:id", authMiddleware, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    await pool.query(`DELETE FROM speaking_scene_turns WHERE id = $1`, [id]);
    return res.json({ ok: true });
  } catch (e: any) { return res.status(500).json({ error: e?.message }); }
});

router.post("/admin/scenes/:id/turns", authMiddleware, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const sceneId = parseInt(req.params.id, 10);
    const { speaker, text_en, text_tr, notes_tr, phonetic_hint } = req.body ?? {};
    if (!speaker || !text_en) return res.status(400).json({ error: "speaker + text_en gerekli" });
    const orderRes: any = await pool.query(
      `SELECT COALESCE(MAX(turn_order), 0) + 1 AS next FROM speaking_scene_turns WHERE scene_id = $1`,
      [sceneId],
    );
    await pool.query(
      `INSERT INTO speaking_scene_turns (scene_id, turn_order, speaker, text_en, text_tr, notes_tr, phonetic_hint)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [sceneId, orderRes.rows[0].next, speaker, text_en, text_tr ?? null, notes_tr ?? null, phonetic_hint ?? null],
    );
    return res.json({ ok: true });
  } catch (e: any) { return res.status(500).json({ error: e?.message }); }
});

// ─── AI Generation ─────────────────────────────────────────────
router.post("/admin/scenes/generate", authMiddleware, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { category, difficulty, topic, publish, minPlan } = req.body ?? {};
    const r = await generateScene({ category, difficulty, topic, publish, minPlan });
    return res.json(r);
  } catch (e: any) { return res.status(500).json({ error: e?.message }); }
});

router.post("/admin/scenes/bulk-fill", authMiddleware, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const targetPerCategory = Math.min(20, parseInt(String(req.body?.targetPerCategory ?? "10"), 10) || 10);
    const category = req.body?.category ?? "all";
    if (category !== "all") {
      const r = await bulkFillCategory(category, targetPerCategory);
      return res.json({ ok: true, [category]: r });
    }
    const result = await bulkFillAll(targetPerCategory);
    const totalCreated = Object.values(result).reduce((s, v) => s + v.created, 0);
    const totalFailed = Object.values(result).reduce((s, v) => s + v.failed, 0);
    return res.json({ ok: true, result, totalCreated, totalFailed });
  } catch (e: any) { return res.status(500).json({ error: e?.message }); }
});

export default router;
