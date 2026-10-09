import { Router } from "express";
import {
  db, usersTable, pool,
  placementQuestionsTable, placementTestAttemptsTable,
} from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { authMiddleware, type AuthRequest } from "../middlewares/auth.js";
import { recordPlacementMistakes } from "../lib/mistake-extractor.js";
import { awardPoints } from "../lib/points.js";

const router = Router();

/**
 * Fallback ANSWER_KEY — DB'ye seed çalıştırılmadıysa veya placement_questions
 * tablosu boşsa kullanılır. Önceki hardcoded set.
 */
const FALLBACK_ANSWER_KEY: Record<number, string> = {
  1: "A", 2: "A", 3: "C", 4: "C", 5: "A", 6: "B", 7: "C", 8: "A", 9: "B", 10: "C",
  11: "C", 12: "C", 13: "B", 14: "C", 15: "A", 16: "C", 17: "C", 18: "A", 19: "A", 20: "A",
  21: "B", 22: "A", 23: "B", 24: "C", 25: "C", 26: "B", 27: "A", 28: "A", 29: "C", 30: "A",
  31: "C", 32: "A", 33: "C", 34: "B", 35: "A", 36: "C", 37: "C", 38: "C", 39: "B", 40: "A",
  41: "A", 42: "C", 43: "A", 44: "A", 45: "B", 46: "B", 47: "A", 48: "C", 49: "C", 50: "C",
  51: "B", 52: "A", 53: "C", 54: "B", 55: "A", 56: "C", 57: "B", 58: "B", 59: "A", 60: "B",
};

function scoreToLevel(score: number, total = 60): "A1" | "A2" | "B1" | "B2" | "C1" {
  // Oranla ölçeklendir ki soru sayısı değişirse de doğru çalışsın
  const pct = total > 0 ? (score / total) : 0;
  if (pct <= 0.20) return "A1";
  if (pct <= 0.43) return "A2";
  if (pct <= 0.67) return "B1";
  if (pct <= 0.90) return "B2";
  return "C1";
}

/**
 * Mevcut answer key'i döndürür: DB varsa oradan, yoksa fallback.
 * Ayrıca total soru sayısını da döner.
 */
async function loadAnswerKey(): Promise<{ answers: Record<number, string>; total: number }> {
  try {
    const rows = await db.select({
      orderIndex: placementQuestionsTable.orderIndex,
      correctOption: placementQuestionsTable.correctOption,
    })
      .from(placementQuestionsTable)
      .where(eq(placementQuestionsTable.isActive, true))
      .orderBy(asc(placementQuestionsTable.orderIndex));
    if (rows.length > 0) {
      const map: Record<number, string> = {};
      for (const r of rows) map[r.orderIndex] = r.correctOption;
      return { answers: map, total: rows.length };
    }
  } catch (e: any) {
    console.warn("[placement-test] DB answer key load failed, falling back:", e?.message);
  }
  return { answers: FALLBACK_ANSWER_KEY, total: 60 };
}

/**
 * GET /placement-test/questions — Soru bankasını döndürür.
 * DB'de aktif soru varsa onları, yoksa boş array (frontend fallback eder).
 */
router.get("/placement-test/questions", async (_req, res) => {
  try {
    const rows = await db.select({
      id: placementQuestionsTable.orderIndex,
      text: placementQuestionsTable.text,
      options: placementQuestionsTable.options,
      cefrLevel: placementQuestionsTable.cefrLevel,
    })
      .from(placementQuestionsTable)
      .where(eq(placementQuestionsTable.isActive, true))
      .orderBy(asc(placementQuestionsTable.orderIndex));
    res.json({ questions: rows, total: rows.length });
  } catch (e: any) {
    console.warn("[placement-test/questions] error:", e?.message);
    res.json({ questions: [], total: 0 });
  }
});

router.get("/placement-test/status", authMiddleware, async (req: AuthRequest, res) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
  if (!user) {
    res.status(404).json({ error: "Kullanıcı bulunamadı" });
    return;
  }
  res.json({
    completed: (user as any).placementTestCompleted ?? false,
    currentLevel: user.currentLevel ?? null,
  });
});

router.post("/placement-test/submit", authMiddleware, async (req: AuthRequest, res) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
  if (!user) {
    res.status(404).json({ error: "Kullanıcı bulunamadı" });
    return;
  }

  if ((user as any).placementTestCompleted) {
    res.status(400).json({ error: "Seviye testi zaten tamamlandı" });
    return;
  }

  const { answers, questions, startedAt } = req.body as {
    answers: Record<string, string>;
    questions?: Array<{ id: number; text: string; options: Record<string, string>; }>;
    /** ISO timestamp — opsiyonel, süre hesabı için */
    startedAt?: string;
  };
  if (!answers || typeof answers !== "object") {
    res.status(400).json({ error: "Cevaplar eksik veya geçersiz" });
    return;
  }

  const { answers: ANSWER_KEY, total: TOTAL } = await loadAnswerKey();

  let score = 0;
  const questionResults: Array<{
    questionId: number;
    userAnswer: string | null;
    correctAnswer: string;
    isCorrect: boolean;
  }> = [];
  const wrongList: Array<{
    id: number; question: string; userAnswer: string; userAnswerText: string;
    correctAnswer: string; correctAnswerText: string;
  }> = [];
  const qMap = new Map<number, any>();
  (questions ?? []).forEach(q => qMap.set(q.id, q));

  for (let q = 1; q <= TOTAL; q++) {
    const userAns = answers[String(q)];
    const correctAns = ANSWER_KEY[q];
    if (!correctAns) continue;

    const isCorrect = userAns === correctAns;
    if (isCorrect) score++;

    questionResults.push({
      questionId: q,
      userAnswer: userAns ?? null,
      correctAnswer: correctAns,
      isCorrect,
    });

    if (userAns && !isCorrect) {
      const qDetail = qMap.get(q);
      wrongList.push({
        id: q,
        question: qDetail?.text ?? `Soru ${q}`,
        userAnswer: userAns,
        userAnswerText: qDetail?.options?.[userAns] ?? userAns,
        correctAnswer: correctAns,
        correctAnswerText: qDetail?.options?.[correctAns] ?? correctAns,
      });
    }
  }

  const level = scoreToLevel(score, TOTAL);

  const [updated] = await db
    .update(usersTable)
    .set({
      currentLevel: level,
      placementTestCompleted: true,
    } as any)
    .where(eq(usersTable.id, req.userId!))
    .returning();

  // Yeni: placement_test_attempts tablosuna detaylı kayıt
  try {
    const startedAtDate = startedAt ? new Date(startedAt) : new Date();
    const completedAtDate = new Date();
    const duration = Math.max(0, Math.round((completedAtDate.getTime() - startedAtDate.getTime()) / 1000));
    await db.insert(placementTestAttemptsTable).values({
      userId: req.userId!,
      score,
      total: TOTAL,
      cefrLevel: level,
      startedAt: startedAtDate,
      completedAt: completedAtDate,
      durationSeconds: duration,
      questionResults,
    });
  } catch (e: any) {
    console.warn("[placement-test/submit] placement_test_attempts insert warn:", e?.message);
  }

  // Backward compat — mevcut level_exam_attempts kaydı korunuyor
  try {
    await pool.query(
      `INSERT INTO level_exam_attempts (user_id, cefr_level, score, total, percent, passed, answers)
       VALUES ($1, $2, $3, $4, $5, true, $6::jsonb)`,
      [req.userId, level, score, TOTAL, Math.round((score / TOTAL) * 100),
       JSON.stringify({ source: "placement_test", answers, wrong: wrongList })],
    );
  } catch (e: any) {
    console.warn("[placement-test/submit] level_exam_attempts insert warn:", e?.message);
  }

  if (wrongList.length > 0) {
    recordPlacementMistakes(
      req.userId!,
      wrongList.map(w => ({
        questionId: w.id,
        question: w.question,
        userAnswer: `${w.userAnswer}: ${w.userAnswerText}`,
        correctAnswer: `${w.correctAnswer}: ${w.correctAnswerText}`,
      })),
      level,
    ).catch((e) => console.warn("[placement-test/submit] mistake insert warn:", e?.message));
  }

  awardPoints(req.userId!, "placement_test_complete", { onceEverForRef: true, refId: "any", silent: true }).catch(() => {});

  const { password: _, ...userWithoutPassword } = updated;
  res.json({ score, level, user: userWithoutPassword, wrong: wrongList, total: TOTAL });
});

export default router;
