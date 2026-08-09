import { Router } from "express";
import { db, usersTable, pool } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authMiddleware, type AuthRequest } from "../middlewares/auth.js";
import { recordPlacementMistakes } from "../lib/mistake-extractor.js";

const router = Router();

const ANSWER_KEY: Record<number, string> = {
  1: "A", 2: "A", 3: "C", 4: "C", 5: "A", 6: "B", 7: "C", 8: "A", 9: "B", 10: "C",
  11: "C", 12: "C", 13: "B", 14: "C", 15: "A", 16: "C", 17: "C", 18: "A", 19: "A", 20: "A",
  21: "B", 22: "A", 23: "B", 24: "C", 25: "C", 26: "B", 27: "A", 28: "A", 29: "C", 30: "A",
  31: "C", 32: "A", 33: "C", 34: "B", 35: "A", 36: "C", 37: "C", 38: "C", 39: "B", 40: "A",
  41: "A", 42: "C", 43: "A", 44: "A", 45: "B", 46: "B", 47: "A", 48: "C", 49: "C", 50: "C",
  51: "B", 52: "A", 53: "C", 54: "B", 55: "A", 56: "C", 57: "B", 58: "B", 59: "A", 60: "B",
};

function scoreToLevel(score: number): "A1" | "A2" | "B1" | "B2" | "C1" {
  if (score <= 12) return "A1";
  if (score <= 26) return "A2";
  if (score <= 40) return "B1";
  if (score <= 54) return "B2";
  return "C1";
}

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

  const { answers, questions } = req.body as {
    answers: Record<string, string>;
    // Frontend soruları da gönderiyorsa (opsiyonel) — mistake tablosuna text ile kaydedebilelim
    questions?: Array<{ id: number; text: string; options: Record<string, string>; }>;
  };
  if (!answers || typeof answers !== "object") {
    res.status(400).json({ error: "Cevaplar eksik veya geçersiz" });
    return;
  }

  let score = 0;
  const wrongList: Array<{
    id: number; question: string; userAnswer: string; userAnswerText: string;
    correctAnswer: string; correctAnswerText: string;
  }> = [];
  const qMap = new Map<number, any>();
  (questions ?? []).forEach(q => qMap.set(q.id, q));

  for (let q = 1; q <= 60; q++) {
    const userAns = answers[String(q)];
    const correctAns = ANSWER_KEY[q];
    if (userAns === correctAns) {
      score++;
    } else if (userAns) {
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

  const level = scoreToLevel(score);

  const [updated] = await db
    .update(usersTable)
    .set({
      currentLevel: level,
      placementTestCompleted: true,
    } as any)
    .where(eq(usersTable.id, req.userId!))
    .returning();

  // Cevapları level_exam_attempts'e persiste et (mevcut tablo — placement için de kullanıyoruz)
  try {
    await pool.query(
      `INSERT INTO level_exam_attempts (user_id, cefr_level, score, total, percent, passed, answers)
       VALUES ($1, $2, $3, 60, $4, true, $5::jsonb)`,
      [req.userId, level, score, Math.round((score / 60) * 100),
       JSON.stringify({ source: "placement_test", answers, wrong: wrongList })],
    );
  } catch (e: any) {
    console.warn("[placement-test/submit] level_exam_attempts insert warn:", e?.message);
  }

  // Yanlış cevapları user_mistakes'e ekle (async — response'u geciktirmesin)
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

  const { password: _, ...userWithoutPassword } = updated;
  res.json({ score, level, user: userWithoutPassword, wrong: wrongList, total: 60 });
});

export default router;
