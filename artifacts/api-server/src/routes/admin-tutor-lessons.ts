/**
 * Merve ile Ders — admin sahne kütüphanesi.
 *
 *   GET    /admin/tutor-lessons            liste + ders bazlı istatistik (30 gün)
 *   GET    /admin/tutor-lessons/overview   genel istatistik (30 gün)
 *   GET    /admin/tutor-lessons/:id        tek ders
 *   POST   /admin/tutor-lessons            oluştur
 *   PATCH  /admin/tutor-lessons/:id        güncelle (updated_at değişir → seed artık ezmez)
 *   DELETE /admin/tutor-lessons/:id        sil (geçmiş oturumlar snapshot'la korunur)
 *
 * proGuard'dan ÖNCE mount edilmeli (routes/index.ts).
 */

import { Router, type Response } from "express";
import { pool } from "@workspace/db";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth.js";
import {
  getVoiceSettings, saveVoiceSettings, synthesizeSpeech, listElevenVoices, elevenAvailable,
  ttsCacheStats, clearTtsCache, SETTING_KEYS,
} from "../lib/tutor-voice.js";

const router = Router();

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const CATEGORIES = ["tanisma", "toplanti", "musteri", "telefon", "satis", "sunum", "ofis"];

export function slugify(s: string): string {
  const map: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", Ç: "c", Ğ: "g", İ: "i", Ö: "o", Ş: "s", Ü: "u" };
  return s
    .replace(/[çğıöşüÇĞİÖŞÜ]/g, (c) => map[c] ?? c)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

type StepIn = { key?: string; goalTr?: string; setupTr?: string; targets?: unknown; hintTr?: string };

/** Gövdeyi doğrula. Hata varsa { error } döner. partial=true → PATCH (yalnız gelen alanlar). */
export function validateLessonInput(body: any, partial: boolean): { value?: Record<string, any>; error?: string } {
  const v: Record<string, any> = {};
  const str = (k: string, max: number, required: boolean) => {
    if (body[k] === undefined) {
      if (required && !partial) throw new Error(`${k} zorunlu`);
      return;
    }
    const s = String(body[k] ?? "").trim();
    if (required && !s) throw new Error(`${k} boş olamaz`);
    v[k] = s.slice(0, max);
  };
  try {
    str("title", 200, true);
    str("summary", 500, false);
    str("introTr", 600, false);
    str("outroTr", 400, false);
    if (body.slug !== undefined) v.slug = slugify(String(body.slug)) || undefined;
    if (body.category !== undefined) {
      if (!CATEGORIES.includes(body.category)) throw new Error("Geçersiz kategori");
      v.category = body.category;
    }
    for (const k of ["levelMin", "levelMax"]) {
      if (body[k] !== undefined) {
        if (!LEVELS.includes(body[k])) throw new Error(`Geçersiz ${k}`);
        v[k] = body[k];
      }
    }
    if (v.levelMin && v.levelMax && LEVELS.indexOf(v.levelMin) > LEVELS.indexOf(v.levelMax)) {
      throw new Error("levelMin, levelMax'tan büyük olamaz");
    }
    if (body.sectors !== undefined) {
      if (!Array.isArray(body.sectors)) throw new Error("sectors dizi olmalı");
      v.sectors = body.sectors.map((x: any) => String(x).trim().toLowerCase()).filter(Boolean).slice(0, 20);
    }
    if (body.estMinutes !== undefined) {
      const n = Number(body.estMinutes);
      if (!Number.isFinite(n) || n < 1 || n > 60) throw new Error("estMinutes 1–60 arası olmalı");
      v.estMinutes = Math.round(n);
    }
    if (body.sortOrder !== undefined) v.sortOrder = Number(body.sortOrder) || 100;
    if (body.isPublished !== undefined) v.isPublished = Boolean(body.isPublished);
    if (body.steps !== undefined || !partial) {
      const steps = body.steps;
      if (!Array.isArray(steps) || steps.length < 1) throw new Error("En az 1 adım gerekli");
      if (steps.length > 8) throw new Error("En fazla 8 adım");
      v.steps = steps.map((s: StepIn, i: number) => {
        const goalTr = String(s.goalTr ?? "").trim();
        const setupTr = String(s.setupTr ?? "").trim();
        const targets = (Array.isArray(s.targets) ? s.targets : [])
          .map((t: any) => String(t).trim()).filter(Boolean).slice(0, 4);
        if (!goalTr || !setupTr || targets.length === 0) {
          throw new Error(`Adım ${i + 1}: görev, kurgu ve en az bir hedef cümle zorunlu`);
        }
        return {
          key: slugify(String(s.key || goalTr)).slice(0, 40) || `adim-${i + 1}`,
          goalTr: goalTr.slice(0, 200),
          setupTr: setupTr.slice(0, 500),
          targets: targets.map((t: string) => t.slice(0, 200)),
          ...(s.hintTr && String(s.hintTr).trim() ? { hintTr: String(s.hintTr).trim().slice(0, 250) } : {}),
        };
      });
    }
  } catch (e: any) {
    return { error: e.message };
  }
  return { value: v };
}

function toPublic(r: any) {
  return {
    id: r.id, slug: r.slug, title: r.title, summary: r.summary, category: r.category,
    levelMin: r.level_min, levelMax: r.level_max, sectors: r.sectors, estMinutes: r.est_minutes,
    introTr: r.intro_tr, outroTr: r.outro_tr, steps: r.steps, isPublished: r.is_published,
    sortOrder: r.sort_order, createdAt: r.created_at, updatedAt: r.updated_at,
    edited: new Date(r.updated_at).getTime() !== new Date(r.created_at).getTime(),
  };
}

router.get("/admin/tutor-lessons/overview", authMiddleware, requireRole("admin"), async (_req: AuthRequest, res: Response) => {
  try {
    const { rows: [t] } = await pool.query(
      `SELECT COUNT(*)::int AS sessions,
              COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
              COUNT(DISTINCT user_id)::int AS learners,
              COALESCE(SUM(turns), 0)::int AS turns,
              COALESCE(SUM(voice_turns), 0)::int AS voice_turns,
              COALESCE(SUM(corrections), 0)::int AS corrections,
              COUNT(*) FILTER (WHERE kind = 'personal')::int AS personal
         FROM tutor_lesson_sessions WHERE started_at > NOW() - INTERVAL '30 days'`,
    );
    const { rows: dropSteps } = await pool.query(
      `SELECT lesson_snapshot->>'title' AS title, current_step AS step, COUNT(*)::int AS n
         FROM tutor_lesson_sessions
        WHERE status = 'abandoned' AND started_at > NOW() - INTERVAL '30 days'
        GROUP BY 1, 2 ORDER BY n DESC LIMIT 8`,
    );
    return res.json({ totals: t, dropOffs: dropSteps });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
});

router.get("/admin/tutor-lessons", authMiddleware, requireRole("admin"), async (_req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT l.*,
              COALESCE(s.sessions, 0)::int AS sessions_30d,
              COALESCE(s.completed, 0)::int AS completed_30d,
              COALESCE(s.avg_corr, 0)::float AS avg_corrections
         FROM tutor_lessons l
         LEFT JOIN (
           SELECT lesson_id, COUNT(*) AS sessions,
                  COUNT(*) FILTER (WHERE status = 'completed') AS completed,
                  AVG(corrections) AS avg_corr
             FROM tutor_lesson_sessions
            WHERE started_at > NOW() - INTERVAL '30 days'
            GROUP BY lesson_id
         ) s ON s.lesson_id = l.id
        ORDER BY l.sort_order, l.id`,
    );
    return res.json({
      lessons: rows.map((r: any) => ({
        ...toPublic(r),
        stats: { sessions: r.sessions_30d, completed: r.completed_30d, avgCorrections: Math.round(r.avg_corrections * 10) / 10 },
      })),
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
});

router.get("/admin/tutor-lessons/:id", authMiddleware, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  const { rows } = await pool.query(`SELECT * FROM tutor_lessons WHERE id = $1`, [Number(req.params.id) || 0]);
  if (!rows[0]) return res.status(404).json({ error: "Ders bulunamadı." });
  return res.json({ lesson: toPublic(rows[0]) });
});

router.post("/admin/tutor-lessons", authMiddleware, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  const { value, error } = validateLessonInput(req.body ?? {}, false);
  if (error || !value) return res.status(400).json({ error });
  const slug = value.slug || slugify(value.title);
  try {
    const { rows } = await pool.query(
      `INSERT INTO tutor_lessons (slug, title, summary, category, level_min, level_max, sectors, est_minutes, intro_tr, outro_tr, steps, is_published, sort_order, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13, NOW() + INTERVAL '1 second')
       RETURNING *`,
      [
        slug, value.title, value.summary ?? "", value.category ?? "ofis",
        value.levelMin ?? "A2", value.levelMax ?? "C1", value.sectors ?? [], value.estMinutes ?? 6,
        value.introTr ?? "", value.outroTr ?? "", JSON.stringify(value.steps),
        value.isPublished ?? false, value.sortOrder ?? 100,
      ],
    );
    return res.status(201).json({ lesson: toPublic(rows[0]) });
  } catch (e: any) {
    if (e?.code === "23505") return res.status(409).json({ error: "Bu kısa adla (slug) bir ders zaten var." });
    return res.status(500).json({ error: e?.message });
  }
});

const COLS: Record<string, string> = {
  slug: "slug", title: "title", summary: "summary", category: "category", levelMin: "level_min",
  levelMax: "level_max", sectors: "sectors", estMinutes: "est_minutes", introTr: "intro_tr",
  outroTr: "outro_tr", steps: "steps", isPublished: "is_published", sortOrder: "sort_order",
};

router.patch("/admin/tutor-lessons/:id", authMiddleware, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  const { value, error } = validateLessonInput(req.body ?? {}, true);
  if (error || !value) return res.status(400).json({ error });
  const sets: string[] = [];
  const params: any[] = [Number(req.params.id) || 0];
  for (const [k, v] of Object.entries(value)) {
    if (v === undefined || !COLS[k]) continue;
    params.push(k === "steps" ? JSON.stringify(v) : v);
    sets.push(`${COLS[k]} = $${params.length}${k === "steps" ? "::jsonb" : ""}`);
  }
  if (sets.length === 0) return res.status(400).json({ error: "Güncellenecek alan yok." });
  // updated_at her zaman created_at'ten farklı olsun (seed'in "admin düzenledi" kontrolü)
  sets.push(`updated_at = GREATEST(NOW(), created_at + INTERVAL '1 second')`);
  try {
    const { rows } = await pool.query(`UPDATE tutor_lessons SET ${sets.join(", ")} WHERE id = $1 RETURNING *`, params);
    if (!rows[0]) return res.status(404).json({ error: "Ders bulunamadı." });
    return res.json({ lesson: toPublic(rows[0]) });
  } catch (e: any) {
    if (e?.code === "23505") return res.status(409).json({ error: "Bu kısa adla (slug) bir ders zaten var." });
    return res.status(500).json({ error: e?.message });
  }
});

router.delete("/admin/tutor-lessons/:id", authMiddleware, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  const { rowCount } = await pool.query(`DELETE FROM tutor_lessons WHERE id = $1`, [Number(req.params.id) || 0]);
  if (!rowCount) return res.status(404).json({ error: "Ders bulunamadı." });
  return res.json({ ok: true });
});

// ─── Merve'nin sesi ───────────────────────────────────────────────────────────

/** Ses denemesinde okunan örnek: Türkçe kurgu + İngilizce hedef cümle + övgü — gerçek ders akışına benzer. */
export const VOICE_SAMPLE =
  "Müşteri tabii ki nedenini soruyor. Kısa ve dürüst bir sebep ver, mesela limandaki yoğunluk. " +
  "Şöyle diyebilirsin: \"The delay is due to heavy congestion at the port.\" " +
  "Upper size mı? Gökyüzüne çıkmıyoruz, beden soruyoruz. Doğrusu: \"Could I try one size bigger?\" Hadi, bir de sen söyle.";

router.get("/admin/tutor-voice", authMiddleware, requireRole("admin"), async (_req: AuthRequest, res: Response) => {
  const settings = await getVoiceSettings(true);
  let voices: unknown[] = [];
  let voicesError: string | null = null;
  if (elevenAvailable()) {
    try { voices = await listElevenVoices(); } catch (e: any) { voicesError = e?.message ?? "Ses listesi alınamadı"; }
  }
  return res.json({
    settings,
    elevenAvailable: elevenAvailable(),
    openaiAvailable: Boolean(process.env.OPENAI_API_KEY),
    voices,
    voicesError,
    cache: await ttsCacheStats(),
    sample: VOICE_SAMPLE,
  });
});

router.patch("/admin/tutor-voice", authMiddleware, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  const body = req.body ?? {};
  const patch: Record<string, any> = {};
  for (const k of SETTING_KEYS) if (k in body) patch[k] = body[k];
  if (Object.keys(patch).length === 0) return res.status(400).json({ error: "Güncellenecek ayar yok." });
  return res.json({ settings: await saveVoiceSettings(patch) });
});

router.post("/admin/tutor-voice/preview", authMiddleware, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  const text = String(req.body?.text || VOICE_SAMPLE).slice(0, 800);
  const voiceId = req.body?.voiceId ? String(req.body.voiceId) : undefined;
  const o = req.body?.settings ?? {};
  const settingsOverride: Record<string, unknown> = {};
  for (const k of ["stability", "similarity", "style", "speed", "pauseAroundEnglishMs", "pauseBetweenPartsMs"]) {
    if (o[k] !== undefined && Number.isFinite(Number(o[k]))) settingsOverride[k] = Number(o[k]);
  }
  if (typeof o.deliveryTags === "boolean") settingsOverride.deliveryTags = o.deliveryTags;
  if (typeof o.elevenModel === "string" && o.elevenModel) settingsOverride.elevenModel = o.elevenModel;
  // Ders akışındaki gibi iki parça: tepki + sonraki adım
  const sentences = text.split(/(?<=[.!?])\s+(?=Upper|Hadi)/);
  const parts = sentences.length > 1 ? [{ text: sentences[0] }, { text: sentences.slice(1).join(" ") }] : [{ text }];
  const out = await synthesizeSpeech(parts, { voiceIdOverride: voiceId, settingsOverride: settingsOverride as any });
  if (!out) return res.status(502).json({ error: "Ses üretilemedi. Sunucu günlüğünde [tutor-voice] satırına bak." });
  return res.json(out);
});

router.post("/admin/tutor-voice/clear-cache", authMiddleware, requireRole("admin"), async (_req: AuthRequest, res: Response) => {
  await clearTtsCache();
  return res.json({ ok: true, cache: await ttsCacheStats() });
});

export default router;
