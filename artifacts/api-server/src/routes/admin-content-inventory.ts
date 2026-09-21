/**
 * Admin Content Inventory — CEFR seviye başına içerik envanteri.
 *
 * Yeni öğrenci seviye desteği (A1-A2) genişletildikten sonra, hangi
 * içerik türünde hangi seviyede kaç öğe var, nerede boşluk var
 * görmek için özet endpoint.
 *
 * GET /api/admin/content-inventory → CEFR × content_type matrisi
 */

import { Router, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth";

const router = Router();

const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
type Cefr = (typeof CEFR_LEVELS)[number];

/**
 * Farklı tablolar farklı alan isimleri + farklı seviye formatları kullanıyor.
 * Hepsini tek matrise indirgemek için normalizasyon yapıyoruz.
 *
 *   vocab_words.level        → "A1"|"A2"|...
 *   speaking_scenes.difficulty → "A2"|"B1"|"B2"|"C1"  (A1 YOK — migration gerekli!)
 *   content_articles.cefr_level → "A2"|"B1"|"B2"|"C1"|"C2" (A1 YOK — belki eklenmeli)
 *   level_exam_attempts.cefr_level → free text
 *   users.cefr_level → placement sonucu
 */
router.get(
  "/admin/content-inventory",
  authMiddleware,
  requireRole("admin"),
  async (_req: AuthRequest, res: Response) => {
    try {
      // Boş matris hazırla
      const inventory: Record<string, Record<Cefr, number>> = {};
      const initMatrix = (): Record<Cefr, number> =>
        Object.fromEntries(CEFR_LEVELS.map((l) => [l, 0])) as Record<Cefr, number>;

      // 1) Vocab words
      inventory["vocab"] = initMatrix();
      const vocabRows = await db.execute(sql`
        SELECT UPPER(TRIM(level)) AS lvl, COUNT(*)::int AS n
        FROM vocab_words
        GROUP BY UPPER(TRIM(level))
      `);
      for (const r of (vocabRows.rows ?? vocabRows) as any[]) {
        const key = String(r.lvl ?? "").toUpperCase();
        if (CEFR_LEVELS.includes(key as Cefr)) inventory["vocab"][key as Cefr] = Number(r.n);
      }

      // 2) Speaking scenes (difficulty alanı A2-C1 kabul ediyor)
      inventory["speaking_scenes"] = initMatrix();
      const sceneRows = await db.execute(sql`
        SELECT UPPER(TRIM(difficulty)) AS lvl, COUNT(*)::int AS n
        FROM speaking_scenes
        WHERE is_active = TRUE
        GROUP BY UPPER(TRIM(difficulty))
      `);
      for (const r of (sceneRows.rows ?? sceneRows) as any[]) {
        const key = String(r.lvl ?? "").toUpperCase();
        if (CEFR_LEVELS.includes(key as Cefr)) inventory["speaking_scenes"][key as Cefr] = Number(r.n);
      }

      // 3) Content articles
      inventory["reading_articles"] = initMatrix();
      const articleRows = await db.execute(sql`
        SELECT UPPER(TRIM(cefr_level)) AS lvl, COUNT(*)::int AS n
        FROM content_articles
        WHERE status = 'published'
        GROUP BY UPPER(TRIM(cefr_level))
      `);
      for (const r of (articleRows.rows ?? articleRows) as any[]) {
        const key = String(r.lvl ?? "").toUpperCase();
        if (CEFR_LEVELS.includes(key as Cefr)) inventory["reading_articles"][key as Cefr] = Number(r.n);
      }

      // 4) Level exam attempts (öğrenci-taraflı, ne kadar seviye sınavı tamamlandı)
      inventory["level_exams_taken"] = initMatrix();
      try {
        const examRows = await db.execute(sql`
          SELECT UPPER(TRIM(cefr_level)) AS lvl, COUNT(*)::int AS n
          FROM level_exam_attempts
          GROUP BY UPPER(TRIM(cefr_level))
        `);
        for (const r of (examRows.rows ?? examRows) as any[]) {
          const key = String(r.lvl ?? "").toUpperCase();
          if (CEFR_LEVELS.includes(key as Cefr)) inventory["level_exams_taken"][key as Cefr] = Number(r.n);
        }
      } catch {
        // tablo yoksa 0 kalır
      }

      // 5) Kullanıcı seviye dağılımı — users.current_level (placement test sonucu)
      inventory["users_by_level"] = initMatrix();
      try {
        const userRows = await db.execute(sql`
          SELECT UPPER(TRIM(current_level)) AS lvl, COUNT(*)::int AS n
          FROM users
          WHERE current_level IS NOT NULL AND role = 'student'
          GROUP BY UPPER(TRIM(current_level))
        `);
        for (const r of (userRows.rows ?? userRows) as any[]) {
          const key = String(r.lvl ?? "").toUpperCase();
          if (CEFR_LEVELS.includes(key as Cefr)) inventory["users_by_level"][key as Cefr] = Number(r.n);
        }
      } catch (e: any) {
        console.warn("[admin/content-inventory] users.current_level sorgu hata:", e?.message);
      }

      // Hedefler — retention için önerilen minimum içerik sayıları
      const targets: Record<string, Record<Cefr, number>> = {
        vocab: { A1: 500, A2: 500, B1: 700, B2: 700, C1: 500, C2: 500 },
        speaking_scenes: { A1: 20, A2: 20, B1: 25, B2: 25, C1: 15, C2: 10 },
        reading_articles: { A1: 30, A2: 30, B1: 40, B2: 40, C1: 30, C2: 20 },
        level_exams_taken: { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 }, // sayaç, hedef yok
        users_by_level: { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 }, // sayaç, hedef yok
      };

      // Toplam satırlar
      const totals: Record<string, number> = {};
      for (const [content, byLevel] of Object.entries(inventory)) {
        totals[content] = Object.values(byLevel).reduce((a, b) => a + b, 0);
      }

      // Grammar coach — SABİT KOD, DB'de değil
      const grammarStaticNote =
        "grammar-coach.ts içinde sabit kod — DB'de tablo yok. Kaba tahmin: A1 ~15, A2 ~15, B1+ eksik. Refactor gerekli (grammar_rules tablosu).";

      return res.json({
        cefr_levels: CEFR_LEVELS,
        inventory,
        targets,
        totals,
        gaps: computeGaps(inventory, targets),
        notes: {
          grammar: grammarStaticNote,
          speaking_scenes_a1_missing:
            "speaking_scenes.difficulty CHECK constraint sadece A2-C1 kabul ediyor. A1 desteği için migration gerekli.",
          content_articles_a1: "content_articles.cefr_level VARCHAR(4) — A1 kabul eder, sadece içerik yok.",
        },
      });
    } catch (e: any) {
      console.error("[admin/content-inventory] HATA:", e?.message);
      return res.status(500).json({ error: e?.message });
    }
  },
);

/** Hedef ile mevcut arasındaki farkı hesapla — nerede eksiklik var */
function computeGaps(
  inventory: Record<string, Record<Cefr, number>>,
  targets: Record<string, Record<Cefr, number>>,
): Record<string, Record<Cefr, number>> {
  const gaps: Record<string, Record<Cefr, number>> = {};
  for (const [content, byLevel] of Object.entries(inventory)) {
    const target = targets[content];
    if (!target) continue;
    gaps[content] = {} as Record<Cefr, number>;
    for (const lvl of CEFR_LEVELS) {
      const have = byLevel[lvl] ?? 0;
      const need = target[lvl] ?? 0;
      gaps[content][lvl] = Math.max(0, need - have);
    }
  }
  return gaps;
}

export default router;
