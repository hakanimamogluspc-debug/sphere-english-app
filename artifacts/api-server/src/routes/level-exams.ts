import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { usersTable, levelExamAttemptsTable } from "@workspace/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { authMiddleware } from "../middlewares/auth.js";
import {
  CEFR_ORDER,
  LEVEL_EXAM_BANK,
  cefrAtOrAbove,
  gradeAnswers,
  getExamForLevel,
} from "../lib/level-exam-bank.js";

const router = Router();
type Cefr = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

function isCefr(x: any): x is Cefr {
  return CEFR_ORDER.includes(x);
}

// Centralized unlock check — used by BOTH GET and POST to prevent lock bypass.
async function isLevelUnlocked(userId: number, currentLevel: string | null, target: Cefr): Promise<boolean> {
  const targetIdx = CEFR_ORDER.indexOf(target);
  const currentIdx = CEFR_ORDER.indexOf((currentLevel || "A1") as Cefr);
  if (targetIdx <= currentIdx + 1) return true;
  if (targetIdx === 0) return true;
  // unlocked if previous level was passed
  const prev = await db
    .select({ id: levelExamAttemptsTable.id })
    .from(levelExamAttemptsTable)
    .where(
      and(
        eq(levelExamAttemptsTable.userId, userId),
        eq(levelExamAttemptsTable.cefrLevel, CEFR_ORDER[targetIdx - 1]),
        eq(levelExamAttemptsTable.passed, true)
      )
    )
    .limit(1);
  return prev.length > 0;
}

const SUBMIT_COOLDOWN_MS = 30_000; // anti-brute-force: one attempt per 30s per level

router.get("/level-exams", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as number;
    const [me] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!me) return res.status(401).json({ error: "Yetkisiz." });

    const allAttempts = await db
      .select()
      .from(levelExamAttemptsTable)
      .where(eq(levelExamAttemptsTable.userId, userId))
      .orderBy(desc(levelExamAttemptsTable.completedAt));

    const passedSet = new Set(allAttempts.filter((a) => a.passed).map((a) => a.cefrLevel as Cefr));
    const currentIdx = CEFR_ORDER.indexOf((me.currentLevel || "A1") as Cefr);

    const levels = CEFR_ORDER.map((level, idx) => {
      const attemptsAtLevel = allAttempts.filter((a) => a.cefrLevel === level);
      const lastAttempt = attemptsAtLevel[0] || null;
      const passed = passedSet.has(level);
      // A user can attempt a level if it's at-or-below their current level + 1, OR if they've passed any
      // earlier level. This way: starts unlocked = level the user is currently at + everything below.
      // Higher levels unlock progressively as lower ones are passed.
      const unlocked = idx <= Math.max(currentIdx, 0) + 1 || (idx > 0 && passedSet.has(CEFR_ORDER[idx - 1]));
      return {
        level,
        unlocked,
        passed,
        questionCount: LEVEL_EXAM_BANK[level].length,
        passThresholdPercent: 70,
        timeLimitMinutes: 25,
        attempts: attemptsAtLevel.length,
        lastAttempt: lastAttempt
          ? {
              id: lastAttempt.id,
              score: lastAttempt.score,
              total: lastAttempt.total,
              percent: lastAttempt.percent,
              passed: lastAttempt.passed,
              completedAt: lastAttempt.completedAt,
            }
          : null,
      };
    });

    return res.json({ currentLevel: me.currentLevel, levels });
  } catch (err: any) {
    console.error("level-exams list error:", err?.message || err);
    return res.status(500).json({ error: "Seviye sınavları listelenemedi." });
  }
});

router.get("/level-exams/:level", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as number;
    const level = String(req.params.level || "").toUpperCase();
    if (!isCefr(level)) return res.status(400).json({ error: "Geçersiz seviye." });

    const [me] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!me) return res.status(401).json({ error: "Yetkisiz." });

    const targetIdx = CEFR_ORDER.indexOf(level);
    const unlocked = await isLevelUnlocked(userId, me.currentLevel, level);
    if (!unlocked) {
      return res.status(403).json({ error: `${level} sınavına erişebilmek için önce ${CEFR_ORDER[targetIdx - 1]} sınavını geçmelisin.` });
    }

    const { questions, total } = getExamForLevel(level);
    if (total === 0) return res.status(404).json({ error: "Bu seviyede henüz soru tanımlanmamış." });

    // Strip correct answers before returning
    const safeQuestions = questions.map((q) => ({
      id: q.id,
      prompt: q.prompt,
      options: q.options,
    }));

    return res.json({
      level,
      total,
      passThresholdPercent: 70,
      timeLimitMinutes: 25,
      questions: safeQuestions,
    });
  } catch (err: any) {
    console.error("level-exam fetch error:", err?.message || err);
    return res.status(500).json({ error: "Sınav yüklenemedi." });
  }
});

router.post("/level-exams/:level/submit", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as number;
    const level = String(req.params.level || "").toUpperCase();
    if (!isCefr(level)) return res.status(400).json({ error: "Geçersiz seviye." });

    const [me] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!me) return res.status(401).json({ error: "Yetkisiz." });

    // SECURITY: re-check unlock — prevents direct POST bypass to a locked level.
    const unlocked = await isLevelUnlocked(userId, me.currentLevel, level);
    if (!unlocked) {
      const targetIdx = CEFR_ORDER.indexOf(level);
      return res.status(403).json({
        error: `${level} sınavına erişebilmek için önce ${CEFR_ORDER[targetIdx - 1]} sınavını geçmelisin.`,
      });
    }

    // Anti-brute-force: 30s cooldown between submissions per level.
    const recent = await db
      .select({ completedAt: levelExamAttemptsTable.completedAt })
      .from(levelExamAttemptsTable)
      .where(and(eq(levelExamAttemptsTable.userId, userId), eq(levelExamAttemptsTable.cefrLevel, level)))
      .orderBy(desc(levelExamAttemptsTable.completedAt))
      .limit(1);
    if (recent[0]) {
      const elapsed = Date.now() - new Date(recent[0].completedAt).getTime();
      if (elapsed < SUBMIT_COOLDOWN_MS) {
        const wait = Math.ceil((SUBMIT_COOLDOWN_MS - elapsed) / 1000);
        return res.status(429).json({ error: `Çok hızlı denedin. ${wait} saniye sonra tekrar gönderebilirsin.` });
      }
    }

    const rawAnswers = Array.isArray(req.body?.answers) ? req.body.answers : [];
    // Cap input length: even with dedup, limit raw payload size (DoS guard).
    const selections = rawAnswers.slice(0, 200).map((a: any) => ({
      questionId: String(a?.questionId || ""),
      selectedIndex: Number.isInteger(a?.selectedIndex) ? a.selectedIndex : null,
    }));

    const { score, total, percent, passed, graded } = gradeAnswers(level, selections);

    const [attempt] = await db
      .insert(levelExamAttemptsTable)
      .values({
        userId,
        cefrLevel: level,
        score,
        total,
        percent,
        passed,
        answers: graded.map(({ questionId, selectedIndex, isCorrect }) => ({ questionId, selectedIndex, isCorrect })),
      })
      .returning();

    let levelPromoted = false;
    let newLevel = me.currentLevel;
    if (passed && cefrAtOrAbove(level, "A1")) {
      // Atomic, monotonic promotion: only update if the passed level is strictly
      // higher than the user's *current* DB value (handles race conditions).
      const cefrCase = sql`CASE current_level
        WHEN 'A1' THEN 1 WHEN 'A2' THEN 2 WHEN 'B1' THEN 3
        WHEN 'B2' THEN 4 WHEN 'C1' THEN 5 WHEN 'C2' THEN 6
        ELSE 0 END`;
      const passedRank = CEFR_ORDER.indexOf(level) + 1;
      const updated = await db
        .update(usersTable)
        .set({ currentLevel: level })
        .where(and(eq(usersTable.id, userId), sql`(${cefrCase}) < ${passedRank}`))
        .returning({ currentLevel: usersTable.currentLevel });
      if (updated[0]) {
        newLevel = updated[0].currentLevel;
        levelPromoted = true;
      }
    }

    return res.json({
      attemptId: attempt.id,
      level,
      score,
      total,
      percent,
      passed,
      passThresholdPercent: 70,
      levelPromoted,
      newLevel,
      review: graded.map((g) => {
        const q = LEVEL_EXAM_BANK[level].find((x) => x.id === g.questionId);
        return {
          questionId: g.questionId,
          prompt: q?.prompt || "",
          options: q?.options || [],
          selectedIndex: g.selectedIndex,
          correctIndex: g.correctIndex,
          isCorrect: g.isCorrect,
        };
      }),
    });
  } catch (err: any) {
    console.error("level-exam submit error:", err?.message || err);
    return res.status(500).json({ error: "Sınav gönderilemedi." });
  }
});

router.get("/level-exams/attempts/me", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as number;
    const attempts = await db
      .select()
      .from(levelExamAttemptsTable)
      .where(eq(levelExamAttemptsTable.userId, userId))
      .orderBy(desc(levelExamAttemptsTable.completedAt))
      .limit(50);
    return res.json({ attempts });
  } catch (err: any) {
    console.error("level-exam attempts error:", err?.message || err);
    return res.status(500).json({ error: "Geçmiş yüklenemedi." });
  }
});

export default router;
