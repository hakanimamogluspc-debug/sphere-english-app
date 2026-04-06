import { Router } from "express";
import { db, quizzesTable, questionsTable, quizAttemptsTable, quizAssignmentsTable, usersTable, coursesTable } from "@workspace/db";
import { eq, and, inArray, count, sum } from "drizzle-orm";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth.js";

const router = Router();

router.get("/quizzes", authMiddleware, async (req: AuthRequest, res) => {
  const { lessonId, courseId } = req.query;
  let conds: any[] = [];
  if (lessonId && lessonId !== "null") conds.push(eq(quizzesTable.lessonId, parseInt(lessonId as string)));
  if (courseId && courseId !== "null") conds.push(eq(quizzesTable.courseId, parseInt(courseId as string)));

  // Öğrenci için: önce atanmış quizlere bak, yoksa seviyeye göre filtrele
  if (req.userRole === "student") {
    const assignments = await db
      .select({ quizId: quizAssignmentsTable.quizId })
      .from(quizAssignmentsTable)
      .where(eq(quizAssignmentsTable.studentId, req.userId!));

    if (assignments.length > 0) {
      const assignedIds = assignments.map((a) => a.quizId);
      conds.push(inArray(quizzesTable.id, assignedIds));
    } else {
      // Fallback: seviyeye göre filtrele
      const [user] = await db.select({ currentLevel: usersTable.currentLevel }).from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
      if (user?.currentLevel) {
        conds.push(eq(quizzesTable.level, user.currentLevel));
      }
    }
  }

  const where = conds.length > 0 ? and(...conds) : undefined;
  const quizzes = await db.select().from(quizzesTable).where(where);
  const result = await Promise.all(quizzes.map(async (q) => {
    const questions = await db.select({ id: questionsTable.id, points: questionsTable.points }).from(questionsTable).where(eq(questionsTable.quizId, q.id));
    return { ...q, questionsCount: questions.length, totalPoints: questions.reduce((s, x) => s + x.points, 0) };
  }));
  res.json(result);
});

router.get("/quizzes/:id", authMiddleware, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const [quiz] = await db.select().from(quizzesTable).where(eq(quizzesTable.id, id)).limit(1);
  if (!quiz) { res.status(404).json({ error: "Quiz not found" }); return; }
  const questions = await db.select().from(questionsTable).where(eq(questionsTable.quizId, id)).orderBy(questionsTable.order);
  const totalPoints = questions.reduce((s, q) => s + q.points, 0);
  res.json({ ...quiz, questions, totalPoints });
});

router.post("/quizzes", authMiddleware, requireRole("admin", "teacher"), async (req: AuthRequest, res) => {
  const { title, level, lessonId, courseId, timeLimit, passingScore, questions: qs } = req.body;
  const [quiz] = await db.insert(quizzesTable).values({
    title, level: level || null, lessonId: lessonId || null, courseId: courseId || null,
    timeLimit: timeLimit || null, passingScore: passingScore || 70,
  }).returning();

  let savedQuestions: any[] = [];
  if (qs && Array.isArray(qs)) {
    savedQuestions = await Promise.all(qs.map(async (q: any, i: number) => {
      const [saved] = await db.insert(questionsTable).values({
        quizId: quiz.id, type: q.type, question: q.question,
        options: q.options || null, correctAnswer: q.correctAnswer,
        points: q.points || 10, order: q.order !== undefined ? q.order : i,
      }).returning();
      return saved;
    }));
  }

  const totalPoints = savedQuestions.reduce((s, q) => s + q.points, 0);
  res.status(201).json({ ...quiz, questions: savedQuestions, questionsCount: savedQuestions.length, totalPoints });
});

router.patch("/quizzes/:id", authMiddleware, requireRole("admin", "teacher"), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const { title, timeLimit, passingScore } = req.body;
  const updates: any = {};
  if (title !== undefined) updates.title = title;
  if (timeLimit !== undefined) updates.timeLimit = timeLimit;
  if (passingScore !== undefined) updates.passingScore = passingScore;

  const [updated] = await db.update(quizzesTable).set(updates).where(eq(quizzesTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Quiz not found" }); return; }
  const questions = await db.select({ id: questionsTable.id, points: questionsTable.points }).from(questionsTable).where(eq(questionsTable.quizId, id));
  res.json({ ...updated, questionsCount: questions.length, totalPoints: questions.reduce((s, q) => s + q.points, 0) });
});

router.delete("/quizzes/:id", authMiddleware, requireRole("admin", "teacher"), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  await db.delete(quizzesTable).where(eq(quizzesTable.id, id));
  res.json({ success: true, message: "Quiz deleted" });
});

router.post("/quizzes/:id/submit", authMiddleware, async (req: AuthRequest, res) => {
  const quizId = parseInt(req.params.id);
  const userId = req.userId!;
  const { answers, timeTaken } = req.body;

  const [quiz] = await db.select().from(quizzesTable).where(eq(quizzesTable.id, quizId)).limit(1);
  if (!quiz) { res.status(404).json({ error: "Quiz not found" }); return; }

  const questions = await db.select().from(questionsTable).where(eq(questionsTable.quizId, quizId));
  const totalPoints = questions.reduce((s, q) => s + q.points, 0);

  let score = 0;
  for (const answer of (answers || [])) {
    const q = questions.find(x => x.id === answer.questionId);
    if (!q) continue;
    if (q.correctAnswer.toLowerCase().trim() === String(answer.answer).toLowerCase().trim()) {
      score += q.points;
    }
  }

  const percentage = totalPoints > 0 ? Math.round((score / totalPoints) * 100) : 0;
  const passed = percentage >= quiz.passingScore;
  const pointsEarned = passed ? Math.round(20 + (percentage / 100) * 30) : Math.round((percentage / 100) * 10);

  const [attempt] = await db.insert(quizAttemptsTable).values({
    quizId, userId, score, totalPoints, percentage, passed, timeTaken: timeTaken || null, pointsEarned,
  }).returning();

  // Add points to user
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (user) {
    await db.update(usersTable).set({ totalPoints: user.totalPoints + pointsEarned, updatedAt: new Date() }).where(eq(usersTable.id, userId));
  }

  res.json({
    id: attempt.id, quizId, quizTitle: quiz.title, userId, userName: null,
    score, totalPoints, percentage, passed,
    timeTaken: timeTaken || null, submittedAt: attempt.submittedAt.toISOString(), pointsEarned,
  });
});

router.get("/quizzes/:id/results", authMiddleware, async (req: AuthRequest, res) => {
  const quizId = parseInt(req.params.id);
  const [quiz] = await db.select().from(quizzesTable).where(eq(quizzesTable.id, quizId)).limit(1);

  let attempts;
  if (req.userRole === "student") {
    attempts = await db.select().from(quizAttemptsTable)
      .where(and(eq(quizAttemptsTable.quizId, quizId), eq(quizAttemptsTable.userId, req.userId!)));
  } else {
    attempts = await db.select().from(quizAttemptsTable).where(eq(quizAttemptsTable.quizId, quizId));
  }

  const enriched = await Promise.all(attempts.map(async (a) => {
    const [user] = await db.select({ firstName: usersTable.firstName, lastName: usersTable.lastName })
      .from(usersTable).where(eq(usersTable.id, a.userId)).limit(1);
    return {
      ...a,
      quizTitle: quiz?.title || "",
      userName: user ? `${user.firstName} ${user.lastName}` : null,
      submittedAt: a.submittedAt.toISOString(),
    };
  }));

  res.json(enriched);
});

export default router;
