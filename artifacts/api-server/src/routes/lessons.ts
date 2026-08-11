import { Router } from "express";
import { db, lessonsTable, lessonProgressTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth.js";
import { applyActivityStreak } from "../utils/streak.js";

const router = Router();

router.post("/lessons", authMiddleware, requireRole("admin", "teacher"), async (req: AuthRequest, res) => {
  const { moduleId, title, type, content, duration, order } = req.body;
  if (!moduleId || !title || !type) { res.status(400).json({ error: "moduleId, title, and type are required" }); return; }

  const [lesson] = await db.insert(lessonsTable).values({ moduleId, title, type, content: content || null, duration: duration || null, order: order || 0 }).returning();
  res.status(201).json({ ...lesson, isCompleted: false });
});

router.get("/lessons/:id", authMiddleware, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const [lesson] = await db.select().from(lessonsTable).where(eq(lessonsTable.id, id)).limit(1);
  if (!lesson) { res.status(404).json({ error: "Lesson not found" }); return; }

  let isCompleted = false;
  if (req.userId) {
    const [progress] = await db.select().from(lessonProgressTable)
      .where(and(eq(lessonProgressTable.userId, req.userId), eq(lessonProgressTable.lessonId, id))).limit(1);
    isCompleted = progress?.completed || false;
  }
  res.json({ ...lesson, isCompleted, quiz: null });
});

router.patch("/lessons/:id", authMiddleware, requireRole("admin", "teacher"), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const { title, type, content, duration, order } = req.body;
  const updates: any = {};
  if (title !== undefined) updates.title = title;
  if (type !== undefined) updates.type = type;
  if (content !== undefined) updates.content = content;
  if (duration !== undefined) updates.duration = duration;
  if (order !== undefined) updates.order = order;

  const [updated] = await db.update(lessonsTable).set(updates).where(eq(lessonsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Lesson not found" }); return; }
  res.json(updated);
});

router.delete("/lessons/:id", authMiddleware, requireRole("admin", "teacher"), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  await db.delete(lessonsTable).where(eq(lessonsTable.id, id));
  res.json({ success: true, message: "Lesson deleted" });
});

router.post("/lessons/:id/complete", authMiddleware, async (req: AuthRequest, res) => {
  const lessonId = parseInt(req.params.id);
  const userId = req.userId!;
  const LESSON_POINTS = 10;

  const [existing] = await db.select().from(lessonProgressTable)
    .where(and(eq(lessonProgressTable.userId, userId), eq(lessonProgressTable.lessonId, lessonId))).limit(1);

  if (existing?.completed) {
    res.json({ lessonId, completed: true, completedAt: existing.completedAt?.toISOString(), pointsEarned: 0 });
    return;
  }

  if (existing) {
    await db.update(lessonProgressTable).set({ completed: true, completedAt: new Date(), pointsEarned: LESSON_POINTS })
      .where(eq(lessonProgressTable.id, existing.id));
  } else {
    await db.insert(lessonProgressTable).values({ userId, lessonId, completed: true, completedAt: new Date(), pointsEarned: LESSON_POINTS });
  }

  // Add points + update streak (yeni kural: aktif gün +1, atlanan gün -2)
  await applyActivityStreak(userId, LESSON_POINTS);

  res.json({ lessonId, completed: true, completedAt: new Date().toISOString(), pointsEarned: LESSON_POINTS });
});

export default router;
