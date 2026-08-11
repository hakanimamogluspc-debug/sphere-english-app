import { Router } from "express";
import { db, usersTable, lessonProgressTable, enrollmentsTable, coursesTable, modulesTable, lessonsTable } from "@workspace/db";
import { eq, and, count, inArray, gte, sql } from "drizzle-orm";
import { authMiddleware, type AuthRequest } from "../middlewares/auth.js";

const router = Router();

const ALL_BADGES = [
  { id: "first_lesson", name: "First Lesson", description: "Complete your first lesson", icon: "🏆" },
  { id: "streak_7", name: "7 Day Streak", description: "Study 7 days in a row", icon: "🔥" },
  { id: "streak_30", name: "30 Day Streak", description: "Study 30 days in a row", icon: "⚡" },
  { id: "perfect_quiz", name: "Perfect Quiz", description: "Get 100% on a quiz", icon: "⭐" },
  { id: "level_up", name: "Level Up", description: "Complete all lessons in your level", icon: "🎯" },
  { id: "course_complete", name: "Course Complete", description: "Complete an entire course", icon: "🎓" },
  { id: "points_100", name: "Century", description: "Earn 100 points", icon: "💯" },
  { id: "points_500", name: "High Scorer", description: "Earn 500 points", icon: "🌟" },
  { id: "points_1000", name: "Champion", description: "Earn 1000 points", icon: "👑" },
];

async function buildProgressOverview(userId: number) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) return null;

  // Course progress — fix: count only lessons belonging to each course
  const enrollments = await db.select({ courseId: enrollmentsTable.courseId }).from(enrollmentsTable).where(eq(enrollmentsTable.studentId, userId));
  const courseProgress = await Promise.all(enrollments.map(async (e) => {
    const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, e.courseId)).limit(1);
    if (!course) return null;
    const modules = await db.select({ id: modulesTable.id }).from(modulesTable).where(eq(modulesTable.courseId, e.courseId));
    let totalLessons = 0;
    let lessonIds: number[] = [];
    for (const m of modules) {
      const lessons = await db.select({ id: lessonsTable.id }).from(lessonsTable).where(eq(lessonsTable.moduleId, m.id));
      totalLessons += lessons.length;
      lessonIds.push(...lessons.map(l => l.id));
    }

    // Fix: filter completions by lessons that belong to THIS course only
    let completedLessons = 0;
    if (lessonIds.length > 0) {
      const [{ cc }] = await db.select({ cc: count() }).from(lessonProgressTable)
        .where(and(
          eq(lessonProgressTable.userId, userId),
          eq(lessonProgressTable.completed, true),
          inArray(lessonProgressTable.lessonId, lessonIds)
        ));
      completedLessons = Math.min(Number(cc), totalLessons);
    }

    const percentage = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

    // Last activity for this course
    let lastActivity: string | null = null;
    if (lessonIds.length > 0) {
      const lastProgress = await db.select({ completedAt: lessonProgressTable.completedAt })
        .from(lessonProgressTable)
        .where(and(
          eq(lessonProgressTable.userId, userId),
          eq(lessonProgressTable.completed, true),
          inArray(lessonProgressTable.lessonId, lessonIds)
        ))
        .orderBy(sql`${lessonProgressTable.completedAt} DESC`)
        .limit(1);
      lastActivity = lastProgress[0]?.completedAt?.toISOString() || null;
    }

    return {
      userId, courseId: e.courseId, courseTitle: course.title,
      completedLessons, totalLessons, percentage, lastActivity, userName: null,
    };
  }));

  // Weekly activity — real data from last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
  const recentProgress = await db.select().from(lessonProgressTable)
    .where(and(
      eq(lessonProgressTable.userId, userId),
      eq(lessonProgressTable.completed, true),
      gte(lessonProgressTable.completedAt, sevenDaysAgo)
    ));

  const weeklyActivity = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const dateStr = d.toISOString().split("T")[0];
    const dayProgress = recentProgress.filter(p => p.completedAt?.toISOString().split("T")[0] === dateStr);
    weeklyActivity.push({
      date: dateStr,
      lessonsCompleted: dayProgress.length,
      pointsEarned: dayProgress.reduce((sum, p) => sum + (p.pointsEarned || 0), 0),
    });
  }

  // Recent activity
  const recentProgressAll = await db.select().from(lessonProgressTable)
    .where(and(eq(lessonProgressTable.userId, userId), eq(lessonProgressTable.completed, true)))
    .orderBy(sql`${lessonProgressTable.completedAt} DESC`).limit(5);

  const recentActivity = recentProgressAll.map(p => ({
    type: "lesson_completed" as const,
    description: "Bir ders tamamlandı",
    pointsEarned: p.pointsEarned,
    timestamp: p.completedAt?.toISOString() || new Date().toISOString(),
  }));

  // Badges
  const earnedBadgeIds = user.badges || [];
  const badges = ALL_BADGES.map(b => ({
    ...b,
    earnedAt: earnedBadgeIds.includes(b.id) ? new Date().toISOString() : null,
  }));

  return {
    userId,
    totalPoints: user.totalPoints,
    streak: user.streak,
    level: user.currentLevel,
    badges,
    courseProgress: courseProgress.filter(Boolean),
    weeklyActivity,
    recentActivity,
  };
}

router.get("/progress/me", authMiddleware, async (req: AuthRequest, res) => {
  const overview = await buildProgressOverview(req.userId!);
  if (!overview) { res.status(404).json({ error: "User not found" }); return; }
  res.json(overview);
});

router.get("/progress/students/:studentId", authMiddleware, async (req: AuthRequest, res) => {
  const studentId = parseInt(req.params.studentId);
  const overview = await buildProgressOverview(studentId);
  if (!overview) { res.status(404).json({ error: "Student not found" }); return; }
  res.json(overview);
});

router.get("/progress/courses/:courseId", authMiddleware, async (req: AuthRequest, res) => {
  const courseId = parseInt(req.params.courseId);
  const enrollments = await db.select({ studentId: enrollmentsTable.studentId }).from(enrollmentsTable).where(eq(enrollmentsTable.courseId, courseId));
  const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, courseId)).limit(1);
  if (!course) { res.status(404).json({ error: "Course not found" }); return; }

  const modules = await db.select({ id: modulesTable.id }).from(modulesTable).where(eq(modulesTable.courseId, courseId));
  let totalLessons = 0;
  let lessonIds: number[] = [];
  for (const m of modules) {
    const lessons = await db.select({ id: lessonsTable.id }).from(lessonsTable).where(eq(lessonsTable.moduleId, m.id));
    totalLessons += Number(lessons.length);
    lessonIds.push(...lessons.map(l => l.id));
  }

  const result = await Promise.all(enrollments.map(async (e) => {
    const [user] = await db.select({ firstName: usersTable.firstName, lastName: usersTable.lastName }).from(usersTable).where(eq(usersTable.id, e.studentId)).limit(1);

    let completedLessons = 0;
    if (lessonIds.length > 0) {
      const [{ cc }] = await db.select({ cc: count() }).from(lessonProgressTable)
        .where(and(
          eq(lessonProgressTable.userId, e.studentId),
          eq(lessonProgressTable.completed, true),
          inArray(lessonProgressTable.lessonId, lessonIds)
        ));
      completedLessons = Math.min(Number(cc), totalLessons);
    }

    return {
      userId: e.studentId, userName: user ? `${user.firstName} ${user.lastName}` : null,
      courseId, courseTitle: course.title, completedLessons, totalLessons,
      percentage: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0,
      lastActivity: null,
    };
  }));

  res.json(result);
});

export default router;
