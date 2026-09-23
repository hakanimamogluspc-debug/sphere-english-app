/**
 * İş Kartları — Mikro-içerik (Faz R2)
 *
 * Her kart 2-3 dakikada tamamlanan somut, işe yarar bir iş İngilizcesi
 * yapı sunar. Duolingo Max'in "explain my answer" veya LinkedIn Learning
 * mikro-derslerinin iş İngilizcesi versiyonu.
 *
 * Yapı:
 *   context_tr    — "Ne zaman kullanılır?" (TR — 1-2 cümle)
 *   phrase_en     — Ana ifade (EN)
 *   alternatives_en — 2-3 alternatif kalıp
 *   example_en    — Gerçek iş bağlamı örneği
 *   translation_tr — Türkçe çeviri
 *   tags          — filtreleme için
 *
 * Endpoint'ler:
 *   GET  /student/business-cards/daily     — bugünkü 3-5 kart (deterministic)
 *   GET  /student/business-cards           — pagination'lı liste (kütüphane)
 *   POST /student/business-cards/:id/seen  — görüldü işaretle
 *   POST /student/business-cards/:id/favorite — favorileri toggle
 *   GET  /student/business-cards/favorites  — favorilerin listesi
 */

import { Router, type Response } from "express";
import { pool } from "@workspace/db";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";
import { getUserLevel } from "../lib/user-level";

const router = Router();

async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS business_cards (
      id SERIAL PRIMARY KEY,
      level VARCHAR(4) NOT NULL,
      category VARCHAR(40) NOT NULL,
      context_tr TEXT NOT NULL,
      phrase_en TEXT NOT NULL,
      alternatives_en JSONB NOT NULL DEFAULT '[]'::jsonb,
      example_en TEXT NOT NULL,
      translation_tr TEXT NOT NULL,
      tags TEXT[] NOT NULL DEFAULT '{}',
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS business_cards_level_cat_idx ON business_cards(level, category, is_active)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_business_card_progress (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      card_id INTEGER NOT NULL,
      seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      favorited BOOLEAN NOT NULL DEFAULT FALSE,
      favorited_at TIMESTAMPTZ,
      UNIQUE(user_id, card_id)
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS ubc_user_idx ON user_business_card_progress(user_id, seen_at DESC)`);
}
ensureTables().catch((e) => console.warn("[business-cards] ensureTables warn:", e?.message));

const CEFR_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"];
function cefrIndex(l: string): number {
  const i = CEFR_ORDER.indexOf(l);
  return i === -1 ? 2 : i;
}

const GOAL_CATEGORIES: Record<string, string[]> = {
  interview: ["interview", "self_intro", "business_general"],
  meetings: ["meetings", "phone_calls", "business_general"],
  presentation: ["presentations", "meetings", "business_general"],
  email: ["emails", "business_general"],
  customer: ["sales", "phone_calls", "customer_service"],
  certificate: ["business_general", "vocabulary_expansion"],
  general: ["business_general", "everyday"],
};

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// ─── GET /student/business-cards/daily ─────────────────────────────────────

router.get("/student/business-cards/daily", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ error: "Yetkisiz" });

    // Kullanıcı profili
    const userRow = await pool.query(
      `SELECT current_level, sector, learning_goal FROM users WHERE id = $1 LIMIT 1`,
      [req.userId],
    );
    const u = userRow.rows[0] ?? {};
    const level = (await getUserLevel(req.userId)) ?? (u.current_level as string | null) ?? "B1";
    const goal = (u.learning_goal as string | null) ?? "general";

    const preferredCategories = GOAL_CATEGORIES[goal] ?? GOAL_CATEGORIES["general"];
    const userIdx = cefrIndex(level);
    const allowedLevels = CEFR_ORDER.slice(0, userIdx + 1); // user seviyesi ve altındakiler

    // Bugünkü seed
    const date = todayIsoDate();
    const seed = hashString(`${req.userId}-${date}`);

    // Aday havuzu — kategoriye göre + seviyeye uygun
    const r = await pool.query(
      `SELECT id, level, category, context_tr, phrase_en, alternatives_en,
              example_en, translation_tr, tags
       FROM business_cards
       WHERE is_active = TRUE
         AND level = ANY($1)
         AND category = ANY($2)
       ORDER BY id ASC`,
      [allowedLevels, preferredCategories],
    );

    let candidates = r.rows;

    // Fallback: hedeflenen kategori yeterli değilse — user seviyesindeki tüm kartlar
    if (candidates.length < 3) {
      const fb = await pool.query(
        `SELECT id, level, category, context_tr, phrase_en, alternatives_en,
                example_en, translation_tr, tags
         FROM business_cards
         WHERE is_active = TRUE AND level = ANY($1)
         ORDER BY id ASC
         LIMIT 30`,
        [allowedLevels],
      );
      candidates = fb.rows;
    }

    if (candidates.length === 0) {
      return res.json({
        ok: true,
        date,
        cards: [],
        message: "Henüz iş kartı yok. Admin panelden ekleyin.",
      });
    }

    // Deterministic pick — Fisher-Yates ile shuffle, ilk 5'i al
    const shuffled = [...candidates];
    let s = seed;
    for (let i = shuffled.length - 1; i > 0; i--) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      const j = s % (i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const picked = shuffled.slice(0, Math.min(5, shuffled.length));

    // Görülme durumu
    const seenRes = await pool.query(
      `SELECT card_id, favorited FROM user_business_card_progress WHERE user_id = $1 AND card_id = ANY($2)`,
      [req.userId, picked.map((c) => c.id)],
    );
    const seenMap = new Map<number, boolean>();
    const favMap = new Map<number, boolean>();
    for (const row of seenRes.rows) {
      seenMap.set(Number(row.card_id), true);
      favMap.set(Number(row.card_id), Boolean(row.favorited));
    }

    return res.json({
      ok: true,
      date,
      cards: picked.map((c) => ({
        id: c.id,
        level: c.level,
        category: c.category,
        context_tr: c.context_tr,
        phrase_en: c.phrase_en,
        alternatives_en: c.alternatives_en,
        example_en: c.example_en,
        translation_tr: c.translation_tr,
        tags: c.tags ?? [],
        seen: seenMap.has(c.id),
        favorited: favMap.get(c.id) ?? false,
      })),
    });
  } catch (e: any) {
    console.error("[business-cards/daily] HATA:", e?.message);
    return res.status(500).json({ error: e?.message });
  }
});

// ─── POST /student/business-cards/:id/seen ────────────────────────────────

router.post("/student/business-cards/:id/seen", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ error: "Yetkisiz" });
    const cardId = parseInt(req.params.id, 10);
    if (!cardId) return res.status(400).json({ error: "Geçersiz id" });

    await pool.query(
      `INSERT INTO user_business_card_progress (user_id, card_id, seen_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id, card_id) DO UPDATE SET seen_at = NOW()`,
      [req.userId, cardId],
    );
    return res.json({ ok: true });
  } catch (e: any) {
    console.error("[business-cards/seen] HATA:", e?.message);
    return res.status(500).json({ error: e?.message });
  }
});

// ─── POST /student/business-cards/:id/favorite ────────────────────────────

router.post("/student/business-cards/:id/favorite", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ error: "Yetkisiz" });
    const cardId = parseInt(req.params.id, 10);
    if (!cardId) return res.status(400).json({ error: "Geçersiz id" });

    // Toggle
    const current = await pool.query(
      `SELECT favorited FROM user_business_card_progress WHERE user_id = $1 AND card_id = $2 LIMIT 1`,
      [req.userId, cardId],
    );
    const newFav = current.rows[0] ? !current.rows[0].favorited : true;

    await pool.query(
      `INSERT INTO user_business_card_progress (user_id, card_id, favorited, favorited_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, card_id) DO UPDATE
         SET favorited = $3, favorited_at = $4`,
      [req.userId, cardId, newFav, newFav ? new Date() : null],
    );

    return res.json({ ok: true, favorited: newFav });
  } catch (e: any) {
    console.error("[business-cards/favorite] HATA:", e?.message);
    return res.status(500).json({ error: e?.message });
  }
});

// ─── GET /student/business-cards/favorites ────────────────────────────────

router.get("/student/business-cards/favorites", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ error: "Yetkisiz" });
    const r = await pool.query(
      `SELECT bc.id, bc.level, bc.category, bc.context_tr, bc.phrase_en,
              bc.alternatives_en, bc.example_en, bc.translation_tr, bc.tags,
              ubc.favorited_at
       FROM user_business_card_progress ubc
       INNER JOIN business_cards bc ON bc.id = ubc.card_id
       WHERE ubc.user_id = $1 AND ubc.favorited = TRUE AND bc.is_active = TRUE
       ORDER BY ubc.favorited_at DESC
       LIMIT 200`,
      [req.userId],
    );
    return res.json({
      ok: true,
      cards: r.rows.map((c) => ({
        id: c.id,
        level: c.level,
        category: c.category,
        context_tr: c.context_tr,
        phrase_en: c.phrase_en,
        alternatives_en: c.alternatives_en,
        example_en: c.example_en,
        translation_tr: c.translation_tr,
        tags: c.tags ?? [],
        favorited_at: c.favorited_at,
      })),
    });
  } catch (e: any) {
    console.error("[business-cards/favorites] HATA:", e?.message);
    return res.status(500).json({ error: e?.message });
  }
});

// ─── GET /student/business-cards ──────────────────────────────────────────
// Kütüphane — pagination'lı liste

router.get("/student/business-cards", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ error: "Yetkisiz" });
    const level = String(req.query.level ?? "").toUpperCase();
    const category = String(req.query.category ?? "");
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? 20), 10) || 20));
    const offset = Math.max(0, parseInt(String(req.query.offset ?? 0), 10) || 0);

    const conditions: string[] = ["is_active = TRUE"];
    const args: any[] = [];
    let idx = 1;
    if (level && CEFR_ORDER.includes(level)) {
      conditions.push(`level = $${idx++}`);
      args.push(level);
    }
    if (category) {
      conditions.push(`category = $${idx++}`);
      args.push(category);
    }
    args.push(limit, offset);

    const r = await pool.query(
      `SELECT id, level, category, context_tr, phrase_en, alternatives_en,
              example_en, translation_tr, tags
       FROM business_cards
       WHERE ${conditions.join(" AND ")}
       ORDER BY id DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      args,
    );

    // Total count
    const cnt = await pool.query(
      `SELECT COUNT(*)::int AS n FROM business_cards WHERE ${conditions.join(" AND ")}`,
      args.slice(0, args.length - 2),
    );

    return res.json({
      ok: true,
      cards: r.rows,
      total: Number(cnt.rows[0]?.n ?? 0),
      limit,
      offset,
    });
  } catch (e: any) {
    console.error("[business-cards list] HATA:", e?.message);
    return res.status(500).json({ error: e?.message });
  }
});

export default router;
