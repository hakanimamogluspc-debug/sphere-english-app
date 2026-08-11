import { Router } from "express";
import { db, usersTable, coursesTable, enrollmentsTable, liveClassesTable, messagesTable, certificatesTable } from "@workspace/db";
import { eq, and, gte, count } from "drizzle-orm";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth.js";
import { computeEffectiveStreak } from "../utils/streak.js";

const router = Router();

router.get("/dashboard/stats", authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const role = req.userRole!;

  const now = new Date();
  const [{ upcomingClasses }] = await db.select({ upcomingClasses: count() })
    .from(liveClassesTable).where(gte(liveClassesTable.startTime, now));

  const [{ unreadMessages }] = await db.select({ unreadMessages: count() })
    .from(messagesTable).where(and(eq(messagesTable.receiverId, userId), eq(messagesTable.isRead, false)));

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);

  if (role === "student") {
    const [{ enrolled }] = await db.select({ enrolled: count() }).from(enrollmentsTable).where(eq(enrollmentsTable.studentId, userId));
    const effectiveStreak = user ? computeEffectiveStreak(user.streak, user.lastActiveDate) : 0;
    res.json({
      role,
      totalPoints: user?.totalPoints || 0,
      streak: effectiveStreak,
      level: user?.currentLevel || null,
      enrolledCourses: Number(enrolled),
      completedLessons: 0,
      upcomingClasses: Number(upcomingClasses),
      unreadMessages: Number(unreadMessages),
      badges: (user?.badges || []).length,
      weeklyGoalProgress: 35,
      taughtCourses: null,
      totalStudents: null,
      pendingAssignments: null,
    });
  } else if (role === "teacher") {
    const [{ taught }] = await db.select({ taught: count() }).from(coursesTable).where(eq(coursesTable.teacherId, userId));
    res.json({
      role,
      totalPoints: null,
      streak: null,
      level: null,
      enrolledCourses: null,
      completedLessons: null,
      upcomingClasses: Number(upcomingClasses),
      unreadMessages: Number(unreadMessages),
      badges: null,
      weeklyGoalProgress: null,
      taughtCourses: Number(taught),
      totalStudents: 0,
      pendingAssignments: 0,
    });
  } else {
    // Admin
    const [{ total }] = await db.select({ total: count() }).from(usersTable);
    res.json({
      role,
      totalPoints: null,
      streak: null,
      level: null,
      enrolledCourses: null,
      completedLessons: null,
      upcomingClasses: Number(upcomingClasses),
      unreadMessages: Number(unreadMessages),
      badges: null,
      weeklyGoalProgress: null,
      taughtCourses: null,
      totalStudents: Number(total),
      pendingAssignments: null,
    });
  }
});

router.get("/dashboard/admin", authMiddleware, requireRole("admin"), async (req: AuthRequest, res) => {
  const [{ totalUsers }] = await db.select({ totalUsers: count() }).from(usersTable);
  const [{ totalStudents }] = await db.select({ totalStudents: count() }).from(usersTable).where(eq(usersTable.role, "student"));
  const [{ totalTeachers }] = await db.select({ totalTeachers: count() }).from(usersTable).where(eq(usersTable.role, "teacher"));
  const [{ totalCourses }] = await db.select({ totalCourses: count() }).from(coursesTable);
  const [{ activeCourses }] = await db.select({ activeCourses: count() }).from(coursesTable).where(eq(coursesTable.isActive, true));
  const [{ totalLiveClasses }] = await db.select({ totalLiveClasses: count() }).from(liveClassesTable);
  const [{ upcomingLiveClasses }] = await db.select({ upcomingLiveClasses: count() }).from(liveClassesTable).where(gte(liveClassesTable.startTime, new Date()));
  const [{ totalEnrollments }] = await db.select({ totalEnrollments: count() }).from(enrollmentsTable);
  const [{ certificatesIssued }] = await db.select({ certificatesIssued: count() }).from(certificatesTable);

  const recentUsers = await db.select({
    id: usersTable.id,
    email: usersTable.email,
    role: usersTable.role,
    firstName: usersTable.firstName,
    lastName: usersTable.lastName,
    avatar: usersTable.avatar,
    phone: usersTable.phone,
    currentLevel: usersTable.currentLevel,
    totalPoints: usersTable.totalPoints,
    streak: usersTable.streak,
    badges: usersTable.badges,
    createdAt: usersTable.createdAt,
  }).from(usersTable).orderBy(usersTable.createdAt).limit(5);

  res.json({
    totalUsers: Number(totalUsers),
    totalStudents: Number(totalStudents),
    totalTeachers: Number(totalTeachers),
    totalCourses: Number(totalCourses),
    activeCourses: Number(activeCourses),
    totalLiveClasses: Number(totalLiveClasses),
    upcomingLiveClasses: Number(upcomingLiveClasses),
    totalEnrollments: Number(totalEnrollments),
    certificatesIssued: Number(certificatesIssued),
    recentRegistrations: recentUsers.map(u => ({ ...u, createdAt: u.createdAt.toISOString() })),
  });
});

export default router;
