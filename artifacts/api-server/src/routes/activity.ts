import { Router } from "express";
import { db, userActivityLogsTable, usersTable, lessonsTable, coursesTable, modulesTable } from "@workspace/db";
import { eq, and, gte, lte, sql, sum, count } from "drizzle-orm";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth.js";

const router = Router();

// Ders başladığında session aç
router.post("/lessons/:lessonId/start", authMiddleware, async (req: AuthRequest, res) => {
  const lessonId = parseInt(req.params.lessonId);
  const { courseId, sessionId, deviceInfo } = req.body;
  const userId = req.userId!;

  const [log] = await db.insert(userActivityLogsTable).values({
    userId,
    lessonId,
    courseId: courseId || 0,
    sessionId: sessionId || null,
    deviceInfo: deviceInfo || null,
    startTime: new Date(),
    durationSeconds: 0,
    watchedPercent: 0,
  }).returning();

  res.json({ logId: log.id });
});

// Heartbeat — her 30 saniyede bir çağrılır
router.post("/lessons/:lessonId/heartbeat", authMiddleware, async (req: AuthRequest, res) => {
  const lessonId = parseInt(req.params.lessonId);
  const { logId, durationSeconds, watchedPercent } = req.body;
  const userId = req.userId!;

  if (logId) {
    await db.update(userActivityLogsTable)
      .set({
        durationSeconds: durationSeconds || 0,
        watchedPercent: Math.min(watchedPercent || 0, 100),
        endTime: new Date(),
      })
      .where(and(
        eq(userActivityLogsTable.id, logId),
        eq(userActivityLogsTable.userId, userId)
      ));
  }

  res.json({ ok: true });
});

// Ders bitişi — final kayıt
router.post("/lessons/:lessonId/end", authMiddleware, async (req: AuthRequest, res) => {
  const lessonId = parseInt(req.params.lessonId);
  const { logId, durationSeconds, watchedPercent } = req.body;
  const userId = req.userId!;

  if (logId) {
    await db.update(userActivityLogsTable)
      .set({
        durationSeconds: durationSeconds || 0,
        watchedPercent: Math.min(watchedPercent || 0, 100),
        endTime: new Date(),
      })
      .where(and(
        eq(userActivityLogsTable.id, logId),
        eq(userActivityLogsTable.userId, userId)
      ));
  }

  res.json({ ok: true });
});

// MEB Rapor verisi — JSON (admin + teacher)
router.get("/reports/meb", authMiddleware, requireRole("admin", "teacher"), async (req: AuthRequest, res) => {
  const { studentId, startDate, endDate } = req.query as Record<string, string>;

  const filters: any[] = [];
  if (studentId) filters.push(eq(userActivityLogsTable.userId, parseInt(studentId)));
  if (startDate) filters.push(gte(userActivityLogsTable.startTime, new Date(startDate)));
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    filters.push(lte(userActivityLogsTable.startTime, end));
  }

  const logs = await db.select({
    id: userActivityLogsTable.id,
    userId: userActivityLogsTable.userId,
    lessonId: userActivityLogsTable.lessonId,
    courseId: userActivityLogsTable.courseId,
    startTime: userActivityLogsTable.startTime,
    endTime: userActivityLogsTable.endTime,
    durationSeconds: userActivityLogsTable.durationSeconds,
    watchedPercent: userActivityLogsTable.watchedPercent,
    deviceInfo: userActivityLogsTable.deviceInfo,
  })
  .from(userActivityLogsTable)
  .where(filters.length > 0 ? and(...filters) : undefined)
  .orderBy(userActivityLogsTable.startTime);

  // Kullanıcı bilgilerini eşleştir
  const userIds = [...new Set(logs.map(l => l.userId))];
  const users = userIds.length > 0
    ? await db.select({ id: usersTable.id, firstName: usersTable.firstName, lastName: usersTable.lastName, email: usersTable.email })
        .from(usersTable)
        .where(sql`${usersTable.id} = ANY(${userIds})`)
    : [];

  const lessonIds = [...new Set(logs.map(l => l.lessonId))];
  const lessons = lessonIds.length > 0
    ? await db.select({ id: lessonsTable.id, title: lessonsTable.title, type: lessonsTable.type })
        .from(lessonsTable)
        .where(sql`${lessonsTable.id} = ANY(${lessonIds})`)
    : [];

  const courseIds = [...new Set(logs.map(l => l.courseId))];
  const courses = courseIds.length > 0
    ? await db.select({ id: coursesTable.id, title: coursesTable.title })
        .from(coursesTable)
        .where(sql`${coursesTable.id} = ANY(${courseIds})`)
    : [];

  const enriched = logs.map(log => ({
    ...log,
    user: users.find(u => u.id === log.userId) || null,
    lesson: lessons.find(l => l.id === log.lessonId) || null,
    course: courses.find(c => c.id === log.courseId) || null,
    durationMinutes: Math.round((log.durationSeconds || 0) / 60 * 10) / 10,
  }));

  // Özet istatistikler
  const totalSeconds = logs.reduce((sum, l) => sum + (l.durationSeconds || 0), 0);
  const uniqueStudents = new Set(logs.map(l => l.userId)).size;

  res.json({
    logs: enriched,
    summary: {
      totalLogs: logs.length,
      totalMinutes: Math.round(totalSeconds / 60),
      totalHours: Math.round(totalSeconds / 3600 * 10) / 10,
      uniqueStudents,
      dateRange: { startDate, endDate },
    },
  });
});

// Öğrencinin kendi haftalık aktivitesi
router.get("/reports/weekly-activity", authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const logs = await db.select()
    .from(userActivityLogsTable)
    .where(and(
      eq(userActivityLogsTable.userId, userId),
      gte(userActivityLogsTable.startTime, sevenDaysAgo)
    ));

  const heatmap: Record<string, { sessions: number; totalMinutes: number; totalSeconds: number }> = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    heatmap[d.toISOString().split("T")[0]] = { sessions: 0, totalMinutes: 0, totalSeconds: 0 };
  }

  for (const log of logs) {
    const dateKey = log.startTime.toISOString().split("T")[0];
    if (heatmap[dateKey]) {
      heatmap[dateKey].sessions++;
      heatmap[dateKey].totalSeconds += log.durationSeconds || 0;
      heatmap[dateKey].totalMinutes = Math.round(heatmap[dateKey].totalSeconds / 60);
    }
  }

  res.json(Object.entries(heatmap).map(([date, data]) => ({ date, ...data })));
});

export default router;
