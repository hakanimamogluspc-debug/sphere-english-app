/**
 * /vocab/* endpoints — kelime detay, favoriler, SRS tekrar.
 * Admin kelime yönetimi: /admin/vocab/*
 *
 * Schema'daki yeni tabloları kullanır:
 *   - user_vocab_progress  (SRS: ease_factor, interval, next_review)
 *   - vocab_lists          (favoriler default list)
 *   - vocab_list_items
 */
import { Router } from "express";
import {
  db, vocabWordsTable, userVocabProgressTable,
} from "@workspace/db";
import { eq, and, desc, asc, lte, sql, inArray, count, ilike, or } from "drizzle-orm";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth.js";

const router = Router();

// ─── Public helpers ─────────────────────────────────────────────────

/** Kelime seçtiğimiz standart alanlar — client/mobile dönüşlerinde tutarlı */
const WORD_COLS = {
  id: vocabWordsTable.id,
  word: vocabWordsTable.word,
  turkish: vocabWordsTable.turkish,
  level: vocabWordsTable.level,
  category: vocabWordsTable.category,
  imagePrompt: vocabWordsTable.imagePrompt,
  pronunciation: vocabWordsTable.pronunciation,
  partOfSpeech: vocabWordsTable.partOfSpeech,
  exampleSentence: vocabWordsTable.exampleSentence,
  exampleSentenceTurkish: vocabWordsTable.exampleSentenceTurkish,
  audioUrl: vocabWordsTable.audioUrl,
  synonyms: vocabWordsTable.synonyms,
  antonyms: vocabWordsTable.antonyms,
  frequencyRank: vocabWordsTable.frequencyRank,
  difficulty: vocabWordsTable.difficulty,
};

/**
 * SM-2 lite — doğru/yanlış cevaba göre ease factor + interval güncelle.
 *
 * quality: 0 = yanlış, 1 = zor ama doğru, 2 = kolay doğru
 */
function sm2Update(prev: { easeFactor: number; intervalDays: number; streak: number }, quality: number) {
  let { easeFactor, intervalDays, streak } = prev;
  if (quality === 0) {
    // Yanlış → interval sıfırla, streak sıfır, ease factor düşür
    intervalDays = 0;
    streak = 0;
    easeFactor = Math.max(1.3, easeFactor - 0.2);
  } else {
    streak = streak + 1;
    if (intervalDays === 0) intervalDays = 1;
    else if (intervalDays === 1) intervalDays = quality === 2 ? 6 : 3;
    else intervalDays = Math.ceil(intervalDays * easeFactor);
    // Max 180 gün (nedenle çok uzun aralıklar olmasın)
    intervalDays = Math.min(180, intervalDays);
    // Ease factor
    if (quality === 2) easeFactor = Math.min(2.8, easeFactor + 0.1);
    // quality=1 → ease sabit
  }
  const nextReviewAt = new Date();
  nextReviewAt.setDate(nextReviewAt.getDate() + intervalDays);
  return { easeFactor, intervalDays, streak, nextReviewAt };
}

// ─── Kullanıcı tarafı ───────────────────────────────────────────────

/**
 * GET /vocab/words/:id — tek kelime detayı + user'ın progress'i (varsa)
 */
router.get("/vocab/words/:id", authMiddleware, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Geçersiz id" }); return; }

  const [word] = await db.select(WORD_COLS).from(vocabWordsTable)
    .where(eq(vocabWordsTable.id, id)).limit(1);
  if (!word) { res.status(404).json({ error: "Kelime bulunamadı" }); return; }

  const [progress] = await db.select().from(userVocabProgressTable)
    .where(and(
      eq(userVocabProgressTable.userId, req.userId!),
      eq(userVocabProgressTable.wordId, id),
    )).limit(1);

  res.json({ word, progress: progress ?? null });
});

/**
 * GET /vocab/favorites — favorilere eklenmiş kelimeler
 */
router.get("/vocab/favorites", authMiddleware, async (req: AuthRequest, res) => {
  const rows = await db.select({
    ...WORD_COLS,
    isFavorite: userVocabProgressTable.isFavorite,
    isLearned: userVocabProgressTable.isLearned,
    nextReviewAt: userVocabProgressTable.nextReviewAt,
  })
    .from(userVocabProgressTable)
    .innerJoin(vocabWordsTable, eq(vocabWordsTable.id, userVocabProgressTable.wordId))
    .where(and(
      eq(userVocabProgressTable.userId, req.userId!),
      eq(userVocabProgressTable.isFavorite, true),
    ))
    .orderBy(desc(userVocabProgressTable.updatedAt));
  res.json({ words: rows });
});

/**
 * POST /vocab/favorites/:wordId — favorilere ekle (idempotent, upsert)
 * DELETE /vocab/favorites/:wordId — favorilerden çıkar
 */
router.post("/vocab/favorites/:wordId", authMiddleware, async (req: AuthRequest, res) => {
  const wordId = parseInt(req.params.wordId);
  if (isNaN(wordId)) { res.status(400).json({ error: "Geçersiz id" }); return; }

  // Kelime var mı?
  const [word] = await db.select({ id: vocabWordsTable.id }).from(vocabWordsTable).where(eq(vocabWordsTable.id, wordId)).limit(1);
  if (!word) { res.status(404).json({ error: "Kelime bulunamadı" }); return; }

  const [existing] = await db.select().from(userVocabProgressTable)
    .where(and(
      eq(userVocabProgressTable.userId, req.userId!),
      eq(userVocabProgressTable.wordId, wordId),
    )).limit(1);

  if (existing) {
    await db.update(userVocabProgressTable)
      .set({ isFavorite: true, updatedAt: new Date() })
      .where(eq(userVocabProgressTable.id, existing.id));
  } else {
    await db.insert(userVocabProgressTable).values({
      userId: req.userId!,
      wordId,
      isFavorite: true,
    });
  }
  res.json({ ok: true, isFavorite: true });
});

router.delete("/vocab/favorites/:wordId", authMiddleware, async (req: AuthRequest, res) => {
  const wordId = parseInt(req.params.wordId);
  if (isNaN(wordId)) { res.status(400).json({ error: "Geçersiz id" }); return; }

  await db.update(userVocabProgressTable)
    .set({ isFavorite: false, updatedAt: new Date() })
    .where(and(
      eq(userVocabProgressTable.userId, req.userId!),
      eq(userVocabProgressTable.wordId, wordId),
    ));
  res.json({ ok: true, isFavorite: false });
});

/**
 * GET /vocab/review — bugün tekrar edilecek kelimeler.
 * Query: limit (default 20, max 50)
 *
 * next_review_at <= NOW() olanlar + hiç çalışılmamış olup kullanıcının
 * seviyesine uygun olanlardan rastgele (yeni kelime öğrenmek için)
 */
router.get("/vocab/review", authMiddleware, async (req: AuthRequest, res) => {
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || "20"))));

  // Due reviews
  const due = await db.select({
    ...WORD_COLS,
    streak: userVocabProgressTable.streak,
    timesCorrect: userVocabProgressTable.timesCorrect,
    timesWrong: userVocabProgressTable.timesWrong,
    easeFactor: userVocabProgressTable.easeFactor,
    nextReviewAt: userVocabProgressTable.nextReviewAt,
  })
    .from(userVocabProgressTable)
    .innerJoin(vocabWordsTable, eq(vocabWordsTable.id, userVocabProgressTable.wordId))
    .where(and(
      eq(userVocabProgressTable.userId, req.userId!),
      lte(userVocabProgressTable.nextReviewAt, new Date()),
      eq(userVocabProgressTable.isLearned, false),
    ))
    .orderBy(asc(userVocabProgressTable.nextReviewAt))
    .limit(limit);

  res.json({ words: due, due: due.length });
});

/**
 * POST /vocab/review/:wordId — cevap sonucunu kaydet
 * Body: { quality: 0 | 1 | 2 }
 *   0 = yanlış
 *   1 = zor ama doğru
 *   2 = kolay doğru
 */
router.post("/vocab/review/:wordId", authMiddleware, async (req: AuthRequest, res) => {
  const wordId = parseInt(req.params.wordId);
  const quality = parseInt(String(req.body?.quality));
  if (isNaN(wordId) || isNaN(quality) || quality < 0 || quality > 2) {
    res.status(400).json({ error: "Geçersiz quality (0-2 olmalı)" });
    return;
  }

  const [existing] = await db.select().from(userVocabProgressTable)
    .where(and(
      eq(userVocabProgressTable.userId, req.userId!),
      eq(userVocabProgressTable.wordId, wordId),
    )).limit(1);

  const prev = existing
    ? { easeFactor: existing.easeFactor, intervalDays: existing.intervalDays, streak: existing.streak }
    : { easeFactor: 2.5, intervalDays: 0, streak: 0 };

  const next = sm2Update(prev, quality);

  const correct = quality > 0;
  const isLearned = next.intervalDays >= 21; // 3 haftadan fazla aralığa gidince "öğrenildi"

  if (existing) {
    await db.update(userVocabProgressTable).set({
      easeFactor: next.easeFactor,
      intervalDays: next.intervalDays,
      streak: next.streak,
      nextReviewAt: next.nextReviewAt,
      lastSeenAt: new Date(),
      timesCorrect: existing.timesCorrect + (correct ? 1 : 0),
      timesWrong: existing.timesWrong + (correct ? 0 : 1),
      isLearned: isLearned,
      updatedAt: new Date(),
    }).where(eq(userVocabProgressTable.id, existing.id));
  } else {
    await db.insert(userVocabProgressTable).values({
      userId: req.userId!,
      wordId,
      easeFactor: next.easeFactor,
      intervalDays: next.intervalDays,
      streak: next.streak,
      nextReviewAt: next.nextReviewAt,
      lastSeenAt: new Date(),
      timesCorrect: correct ? 1 : 0,
      timesWrong: correct ? 0 : 1,
      isLearned,
    });
  }

  res.json({
    ok: true,
    quality,
    nextReviewAt: next.nextReviewAt,
    intervalDays: next.intervalDays,
    isLearned,
  });
});

/**
 * GET /vocab/review/stats — kullanıcının toplam/vadesi gelen/öğrenilen sayıları
 */
router.get("/vocab/review/stats", authMiddleware, async (req: AuthRequest, res) => {
  const uid = req.userId!;
  const now = new Date();
  const [totals] = await db.select({
    tracked: count(),
  }).from(userVocabProgressTable).where(eq(userVocabProgressTable.userId, uid));
  const [due] = await db.select({ cc: count() })
    .from(userVocabProgressTable)
    .where(and(
      eq(userVocabProgressTable.userId, uid),
      lte(userVocabProgressTable.nextReviewAt, now),
      eq(userVocabProgressTable.isLearned, false),
    ));
  const [learned] = await db.select({ cc: count() })
    .from(userVocabProgressTable)
    .where(and(
      eq(userVocabProgressTable.userId, uid),
      eq(userVocabProgressTable.isLearned, true),
    ));
  const [fav] = await db.select({ cc: count() })
    .from(userVocabProgressTable)
    .where(and(
      eq(userVocabProgressTable.userId, uid),
      eq(userVocabProgressTable.isFavorite, true),
    ));
  res.json({
    tracked: Number(totals?.tracked || 0),
    due: Number(due?.cc || 0),
    learned: Number(learned?.cc || 0),
    favorites: Number(fav?.cc || 0),
  });
});

// ─── Admin tarafı ────────────────────────────────────────────────────

/**
 * GET /admin/vocab/words — filterlanabilir liste
 */
router.get("/admin/vocab/words", authMiddleware, requireRole("admin"), async (req: AuthRequest, res) => {
  const page = Math.max(1, parseInt(String(req.query.page || "1")));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "25"))));
  const offset = (page - 1) * limit;

  const conds: any[] = [];
  const q = req.query;
  if (typeof q.level === "string") conds.push(eq(vocabWordsTable.level, q.level));
  if (typeof q.category === "string") conds.push(eq(vocabWordsTable.category, q.category));
  if (typeof q.q === "string" && q.q.trim()) {
    const term = `%${q.q.trim()}%`;
    conds.push(or(ilike(vocabWordsTable.word, term), ilike(vocabWordsTable.turkish, term)));
  }
  const where = conds.length ? and(...conds) : undefined;

  const words = await db.select(WORD_COLS).from(vocabWordsTable)
    .where(where)
    .orderBy(asc(vocabWordsTable.word))
    .limit(limit).offset(offset);
  const [{ total }] = await db.select({ total: count() }).from(vocabWordsTable).where(where);

  res.json({ words, total: Number(total), page, limit });
});

const VALID_FIELDS = new Set([
  "word", "turkish", "imagePrompt", "level", "category",
  "pronunciation", "partOfSpeech", "exampleSentence", "exampleSentenceTurkish",
  "audioUrl", "synonyms", "antonyms", "frequencyRank", "difficulty",
]);

/**
 * POST /admin/vocab/words — yeni kelime oluştur
 */
router.post("/admin/vocab/words", authMiddleware, requireRole("admin"), async (req: AuthRequest, res) => {
  const b = req.body ?? {};
  if (!b.word || !b.turkish || !b.level || !b.category) {
    res.status(400).json({ error: "word, turkish, level, category zorunlu" });
    return;
  }
  try {
    const [created] = await db.insert(vocabWordsTable).values({
      word: String(b.word).trim(),
      turkish: String(b.turkish).trim(),
      imagePrompt: String(b.imagePrompt || "").trim(),
      level: String(b.level).toUpperCase(),
      category: String(b.category),
      pronunciation: b.pronunciation ? String(b.pronunciation) : null,
      partOfSpeech: b.partOfSpeech ? String(b.partOfSpeech) : null,
      exampleSentence: b.exampleSentence ? String(b.exampleSentence) : null,
      exampleSentenceTurkish: b.exampleSentenceTurkish ? String(b.exampleSentenceTurkish) : null,
      audioUrl: b.audioUrl ? String(b.audioUrl) : null,
      synonyms: Array.isArray(b.synonyms) ? b.synonyms.slice(0, 10).map(String) : null,
      antonyms: Array.isArray(b.antonyms) ? b.antonyms.slice(0, 10).map(String) : null,
      frequencyRank: typeof b.frequencyRank === "number" ? b.frequencyRank : null,
      difficulty: typeof b.difficulty === "number" ? b.difficulty : null,
    }).returning();
    res.status(201).json({ word: created });
  } catch (e: any) {
    res.status(400).json({ error: e?.message || "Eklenemedi" });
  }
});

/**
 * PATCH /admin/vocab/words/:id — kelimeyi güncelle
 */
router.patch("/admin/vocab/words/:id", authMiddleware, requireRole("admin"), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Geçersiz id" }); return; }
  const b = req.body ?? {};
  const patch: any = { updatedAt: new Date() };
  for (const key of Object.keys(b)) {
    if (!VALID_FIELDS.has(key)) continue;
    patch[key] = b[key];
  }
  if (Object.keys(patch).length === 1) {
    res.status(400).json({ error: "Güncellenecek alan yok" });
    return;
  }
  const [updated] = await db.update(vocabWordsTable).set(patch)
    .where(eq(vocabWordsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Kelime bulunamadı" }); return; }
  res.json({ word: updated });
});

/**
 * DELETE /admin/vocab/words/:id — kelimeyi sil
 */
router.delete("/admin/vocab/words/:id", authMiddleware, requireRole("admin"), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Geçersiz id" }); return; }
  const result = await db.delete(vocabWordsTable).where(eq(vocabWordsTable.id, id)).returning({ id: vocabWordsTable.id });
  if (result.length === 0) { res.status(404).json({ error: "Kelime bulunamadı" }); return; }
  res.json({ ok: true });
});

export default router;
