import { Router } from "express";
import { db } from "@workspace/db";
import { vocabWordsTable, vocabGameSessionsTable, vocabSessionWordsTable } from "@workspace/db";
import { eq, and, sql, desc, ne, notInArray } from "drizzle-orm";
import OpenAI from "openai";

const router = Router();

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI | null {
  try {
    if (!_openai) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) return null;
      _openai = new OpenAI({ apiKey });
    }
    return _openai;
  } catch {
    return null;
  }
}

/* ── POST /vocab-game/game/start ── */
router.post("/vocab-game/game/start", async (req, res) => {
  try {
    const { username, level = "A1", session_length = 10 } = req.body;
    if (!username) return res.status(400).json({ detail: "Kullanıcı adı gerekli" });

    const sessionLength = Math.min(Math.max(Number(session_length) || 10, 5), 30);

    let wordQuery = db.select({ id: vocabWordsTable.id })
      .from(vocabWordsTable);

    const words = level === "mixed"
      ? await wordQuery
      : await db.select({ id: vocabWordsTable.id }).from(vocabWordsTable).where(eq(vocabWordsTable.level, level));

    if (words.length < sessionLength) {
      return res.status(400).json({ detail: "Bu seviyede yeterli kelime yok" });
    }

    const shuffled = words.sort(() => Math.random() - 0.5).slice(0, sessionLength);

    const [session] = await db.insert(vocabGameSessionsTable).values({
      username,
      level,
      totalWords: sessionLength,
    }).returning();

    await db.insert(vocabSessionWordsTable).values(
      shuffled.map((w, i) => ({
        sessionId: session.id,
        wordId: w.id,
        wordIndex: i,
      }))
    );

    return res.json({ session_id: session.id, total_words: sessionLength, message: "Oyun başladı!" });
  } catch (e) {
    console.error("vocab start error:", e);
    return res.status(500).json({ detail: "Sunucu hatası" });
  }
});

/* ── GET /vocab-game/game/word ── */
router.get("/vocab-game/game/word", async (req, res) => {
  try {
    const { session_id } = req.query as { session_id: string };
    if (!session_id) return res.status(400).json({ detail: "session_id gerekli" });

    const [session] = await db.select().from(vocabGameSessionsTable).where(eq(vocabGameSessionsTable.id, session_id));
    if (!session) return res.status(404).json({ detail: "Oturum bulunamadı" });
    if (session.isFinished) return res.json({ done: true });

    const sessionWords = await db.select().from(vocabSessionWordsTable)
      .where(eq(vocabSessionWordsTable.sessionId, session_id))
      .orderBy(vocabSessionWordsTable.wordIndex);

    const next = sessionWords.find(sw => sw.isCorrect === null && !sw.isSkipped);
    if (!next) {
      await db.update(vocabGameSessionsTable).set({ isFinished: true }).where(eq(vocabGameSessionsTable.id, session_id));
      return res.json({ done: true });
    }

    const [word] = await db.select().from(vocabWordsTable).where(eq(vocabWordsTable.id, next.wordId));

    const wordsSeen = sessionWords.filter(sw => sw.isCorrect !== null || sw.isSkipped).length;
    const totalWords = session.totalWords;

    return res.json({
      word_id: word.id,
      word_index: next.wordIndex + 1,
      image_prompt: word.imagePrompt,
      level: word.level,
      category: word.category,
      remaining: sessionWords.filter(sw => sw.isCorrect === null && !sw.isSkipped).length,
      words_seen: wordsSeen,
      total_words: totalWords,
      current_score: session.score || 0,
    });
  } catch (e) {
    console.error("vocab word error:", e);
    return res.status(500).json({ detail: "Sunucu hatası" });
  }
});

/* ── POST /vocab-game/game/guess ── */
router.post("/vocab-game/game/guess", async (req, res) => {
  try {
    const { session_id, word_id, guess } = req.body;
    if (!session_id || !word_id || !guess) return res.status(400).json({ detail: "Eksik alan" });

    const [sw] = await db.select().from(vocabSessionWordsTable)
      .where(and(eq(vocabSessionWordsTable.sessionId, session_id), eq(vocabSessionWordsTable.wordId, Number(word_id))));
    if (!sw) return res.status(404).json({ detail: "Kelime bulunamadı" });

    const [word] = await db.select().from(vocabWordsTable).where(eq(vocabWordsTable.id, Number(word_id)));
    const correct = guess.trim().toLowerCase() === word.word.toLowerCase();

    const newAttempts = sw.attempts + 1;
    const gameOverWord = newAttempts >= 3 && !correct;

    let scoreGained = 0;
    const [session] = await db.select().from(vocabGameSessionsTable).where(eq(vocabGameSessionsTable.id, session_id));

    if (correct) {
      scoreGained = sw.hintUsed ? 5 : 10;
      await db.update(vocabSessionWordsTable).set({ isCorrect: true, attempts: newAttempts })
        .where(and(eq(vocabSessionWordsTable.sessionId, session_id), eq(vocabSessionWordsTable.wordId, Number(word_id))));
      await db.update(vocabGameSessionsTable).set({
        score: (session.score || 0) + scoreGained,
        wordsCorrect: (session.wordsCorrect || 0) + 1,
        wordsSeen: (session.wordsSeen || 0) + 1,
      }).where(eq(vocabGameSessionsTable.id, session_id));
    } else if (gameOverWord) {
      await db.update(vocabSessionWordsTable).set({ isCorrect: false, attempts: newAttempts, isSkipped: true })
        .where(and(eq(vocabSessionWordsTable.sessionId, session_id), eq(vocabSessionWordsTable.wordId, Number(word_id))));
      await db.update(vocabGameSessionsTable).set({
        wordsSeen: (session.wordsSeen || 0) + 1,
      }).where(eq(vocabGameSessionsTable.id, session_id));
    } else {
      await db.update(vocabSessionWordsTable).set({ attempts: newAttempts })
        .where(and(eq(vocabSessionWordsTable.sessionId, session_id), eq(vocabSessionWordsTable.wordId, Number(word_id))));
    }

    const [updatedSession] = await db.select().from(vocabGameSessionsTable).where(eq(vocabGameSessionsTable.id, session_id));

    return res.json({
      correct,
      word: gameOverWord || correct ? word.word : null,
      turkish: gameOverWord || correct ? word.turkish : null,
      correct_word: word.word,
      score_gained: scoreGained,
      current_score: updatedSession.score,
      attempts: newAttempts,
      game_over_word: gameOverWord,
      added_to_retry: gameOverWord,
    });
  } catch (e) {
    console.error("vocab guess error:", e);
    return res.status(500).json({ detail: "Sunucu hatası" });
  }
});

/* ── GET /vocab-game/game/hint ── */
router.get("/vocab-game/game/hint", async (req, res) => {
  try {
    const { session_id, word_id } = req.query as { session_id: string; word_id: string };
    if (!session_id || !word_id) return res.status(400).json({ detail: "Eksik parametre" });

    const [word] = await db.select().from(vocabWordsTable).where(eq(vocabWordsTable.id, Number(word_id)));
    if (!word) return res.status(404).json({ detail: "Kelime bulunamadı" });

    await db.update(vocabSessionWordsTable).set({ hintUsed: true })
      .where(and(eq(vocabSessionWordsTable.sessionId, session_id), eq(vocabSessionWordsTable.wordId, Number(word_id))));
    await db.update(vocabGameSessionsTable).set({ hintsUsed: sql`hints_used + 1` })
      .where(eq(vocabGameSessionsTable.id, session_id));

    const hint = await generateHint(word.word, word.turkish, word.category);
    return res.json({ hint });
  } catch (e) {
    console.error("vocab hint error:", e);
    return res.status(500).json({ detail: "Sunucu hatası" });
  }
});

/* ── POST /vocab-game/game/finish ── */
router.post("/vocab-game/game/finish", async (req, res) => {
  try {
    const { session_id } = req.query as { session_id: string };
    if (!session_id) return res.status(400).json({ detail: "session_id gerekli" });

    const [session] = await db.select().from(vocabGameSessionsTable).where(eq(vocabGameSessionsTable.id, session_id));
    if (!session) return res.status(404).json({ detail: "Oturum bulunamadı" });

    await db.update(vocabGameSessionsTable).set({ isFinished: true }).where(eq(vocabGameSessionsTable.id, session_id));

    const sessionWords = await db.select({
      wordId: vocabSessionWordsTable.wordId,
      isCorrect: vocabSessionWordsTable.isCorrect,
      isSkipped: vocabSessionWordsTable.isSkipped,
    }).from(vocabSessionWordsTable).where(eq(vocabSessionWordsTable.sessionId, session_id));

    const wrongWordIds = sessionWords
      .filter(sw => sw.isCorrect === false || (sw.isSkipped && sw.isCorrect !== true))
      .map(sw => sw.wordId);

    const retryWords = wrongWordIds.length > 0
      ? await db.select({ word: vocabWordsTable.word, turkish: vocabWordsTable.turkish, imagePrompt: vocabWordsTable.imagePrompt })
          .from(vocabWordsTable).where(sql`id = ANY(${wrongWordIds})`)
      : [];

    return res.json({
      username: session.username,
      score: session.score,
      words_seen: session.wordsSeen,
      words_correct: session.wordsCorrect,
      hints_used: session.hintsUsed,
      level: session.level,
      retry_list: retryWords.map(w => ({ word: w.word, turkish: w.turkish, image_prompt: w.imagePrompt })),
    });
  } catch (e) {
    console.error("vocab finish error:", e);
    return res.status(500).json({ detail: "Sunucu hatası" });
  }
});

/* ── GET /vocab-game/scores/leaderboard ── */
router.get("/vocab-game/scores/leaderboard", async (req, res) => {
  try {
    const { level = "all", limit = "20" } = req.query as { level?: string; limit?: string };

    let query = db.select().from(vocabGameSessionsTable)
      .where(eq(vocabGameSessionsTable.isFinished, true))
      .orderBy(desc(vocabGameSessionsTable.score))
      .limit(Number(limit));

    const sessions = level === "all"
      ? await query
      : await db.select().from(vocabGameSessionsTable)
          .where(and(eq(vocabGameSessionsTable.isFinished, true), eq(vocabGameSessionsTable.level, level)))
          .orderBy(desc(vocabGameSessionsTable.score))
          .limit(Number(limit));

    return res.json(sessions.map((s, i) => ({
      rank: i + 1,
      username: s.username,
      score: s.score,
      level: s.level,
      words_correct: s.wordsCorrect,
      words_seen: s.wordsSeen,
      hints_used: s.hintsUsed,
      played_at: s.createdAt,
    })));
  } catch (e) {
    console.error("vocab leaderboard error:", e);
    return res.status(500).json({ detail: "Sunucu hatası" });
  }
});

/* ── GET /vocab-game/scores/stats ── */
router.get("/vocab-game/scores/stats", async (req, res) => {
  try {
    const [wordStats] = await db.select({
      total: sql<number>`count(*)`,
    }).from(vocabWordsTable);

    const [gameStats] = await db.select({
      total_games: sql<number>`count(*)`,
      highest_score: sql<number>`max(score)`,
    }).from(vocabGameSessionsTable).where(eq(vocabGameSessionsTable.isFinished, true));

    const levels = await db.selectDistinct({ level: vocabWordsTable.level }).from(vocabWordsTable);
    const cats = await db.selectDistinct({ category: vocabWordsTable.category }).from(vocabWordsTable);

    return res.json({
      total_words: Number(wordStats?.total || 0),
      total_levels: levels.length,
      total_categories: cats.length,
      total_games: Number(gameStats?.total_games || 0),
      highest_score: Number(gameStats?.highest_score || 0),
    });
  } catch (e) {
    console.error("vocab stats error:", e);
    return res.status(500).json({ detail: "Sunucu hatası" });
  }
});

/* ── Hint generation ── */
async function generateHint(word: string, turkish: string, category: string): Promise<string> {
  const openai = getOpenAI();
  if (openai) {
    try {
      const resp = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Sen İngilizce kelime öğretiminde uzman bir Türkçe asistansın. " +
              "Kullanıcının İngilizce bir kelimeyi tahmin etmesine yardımcı olacak kısa bir ipucu ver (1-2 cümle). " +
              "İpucunu TAMAMEN TÜRKÇE yaz. " +
              "Kesinlikle kelimenin kendisini, çoğul/çekimli hallerini veya doğrudan Türkçe karşılığını kullanma.",
          },
          {
            role: "user",
            content:
              `'${word}' İngilizce kelimesi için Türkçe bir ipucu yaz ` +
              `(kategori: ${category}, Türkçesi: ${turkish}). ` +
              `İpucunda '${word}' veya '${turkish}' kelimelerini kullanma. Sadece Türkçe yaz.`,
          },
        ],
        max_tokens: 100,
        temperature: 0.7,
      });
      return resp.choices[0].message.content?.trim() ?? fallbackHint(category);
    } catch (e) {
      console.error("OpenAI hint error:", e);
    }
  }
  return fallbackHint(category);
}

const FALLBACK_HINTS: Record<string, string> = {
  animals: "Bu canlı bir varlık. Boyutunu, yaşadığı ortamı ve nasıl hareket ettiğini düşün.",
  food: "Bunu bir mutfakta veya restoran menüsünde bulabilirsin. Tadını, dokusunu veya rengini düşün.",
  colors: "Bu, nesnelerin görünümünü tanımlamak için kullanılan bir renktir.",
  technology: "Bu, günlük hayatta kullanılan modern cihazlar veya dijital kavramlarla ilgilidir.",
  nature: "Bunu doğal dünyada, belki dışarıda veya çevrede bulabilirsin.",
  emotions: "Bu, insanların günlük hayatta deneyimlediği bir duygu veya ruh halini tanımlar.",
  verbs: "Bu bir eylem — bir kişinin veya hayvanın yaptığı bir şey.",
  adjectives: "Bu, bir kişi, yer veya nesne hakkında daha fazla bilgi veren tanımlayıcı bir kelimedir.",
  places: "Bu, insanların ziyaret ettiği veya yaşadığı bir yer veya bina türüdür.",
  transport: "Bu, bir yerden başka bir yere gitmek için kullanılan bir araç veya ulaşım şeklidir.",
  family: "Bu, aile içindeki bir akrabalık ilişkisini veya rolü tanımlar.",
  body: "Bu, insan vücudunun bir parçasıyla ilgilidir.",
  clothing: "Bu, insanların giydiği veya taktığı bir şeydir.",
  house: "Bu, evde ya da evle ilgili bir nesne veya kavramdır.",
  weather: "Bu, dışarıdaki hava koşullarını veya doğa olaylarını tanımlar.",
  business: "Bu, iş dünyası veya ticaretle ilgili bir kavramdır.",
  health: "Bu, sağlık, tıp veya vücut bakımıyla ilgilidir.",
  education: "Bu, öğrenme, okul veya eğitimle ilgili bir kavramdır.",
  sports: "Bu, spor veya fiziksel aktiviteyle ilgilidir.",
  time: "Bu, zaman, süre veya tarihi ifade etmek için kullanılır.",
};

function fallbackHint(category: string): string {
  return FALLBACK_HINTS[category] ?? `Bu kelime '${category}' kategorisine ait. Bu konuyla ilgili yaygın kelimeleri düşün!`;
}

export default router;
