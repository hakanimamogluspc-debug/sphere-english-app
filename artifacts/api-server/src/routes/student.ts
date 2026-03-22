import { Router } from "express";
import {
  db, usersTable, groupsTable, groupMembersTable,
  liveClassesTable, liveClassAttendanceTable,
  coursesTable, modulesTable, lessonsTable, enrollmentsTable,
} from "@workspace/db";
import { eq, and, inArray, or } from "drizzle-orm";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth.js";

const router = Router();

// ─── Kendi ders takvimi ───────────────────────────────────────────────────────
// GET /student/live-classes — öğrencinin kayıtlı kurslarına + kendi grubunun öğretmenine ait dersler
router.get("/student/live-classes", authMiddleware, requireRole("student"), async (req: AuthRequest, res) => {
  const studentId = req.userId!;

  // Kayıtlı kurs id'leri
  const enrollments = await db.select({ courseId: enrollmentsTable.courseId })
    .from(enrollmentsTable).where(eq(enrollmentsTable.studentId, studentId));
  const courseIds = enrollments.map(e => e.courseId);

  // Öğrencinin gruplarındaki öğretmen id'leri
  const memberships = await db.select({ groupId: groupMembersTable.groupId })
    .from(groupMembersTable).where(eq(groupMembersTable.studentId, studentId));
  const groupIds = memberships.map(m => m.groupId);

  let teacherIds: number[] = [];
  if (groupIds.length > 0) {
    const groups = await db.select({ teacherId: groupsTable.teacherId })
      .from(groupsTable).where(inArray(groupsTable.id, groupIds));
    teacherIds = groups.map(g => g.teacherId).filter(Boolean) as number[];
  }

  // Dersler: kayıtlı kurs OR öğretmen
  let classes: any[] = [];
  if (courseIds.length > 0 || teacherIds.length > 0) {
    const conditions = [];
    if (courseIds.length > 0) conditions.push(inArray(liveClassesTable.courseId, courseIds));
    if (teacherIds.length > 0) conditions.push(inArray(liveClassesTable.teacherId, teacherIds));

    classes = await db.select().from(liveClassesTable)
      .where(conditions.length === 1 ? conditions[0] : or(...conditions))
      .orderBy(liveClassesTable.startTime);
  }

  // Öğretmen adını ekle
  const enriched = await Promise.all(classes.map(async (cls) => {
    const [teacher] = await db.select({ firstName: usersTable.firstName, lastName: usersTable.lastName })
      .from(usersTable).where(eq(usersTable.id, cls.teacherId)).limit(1);
    // Bu öğrenci bu derse katıldı mı?
    const [attendance] = await db.select().from(liveClassAttendanceTable)
      .where(and(eq(liveClassAttendanceTable.liveClassId, cls.id), eq(liveClassAttendanceTable.studentId, studentId))).limit(1);
    return {
      ...cls,
      startTime: cls.startTime.toISOString(),
      createdAt: cls.createdAt.toISOString(),
      teacherName: teacher ? `${teacher.firstName} ${teacher.lastName}` : null,
      isAttending: !!attendance,
    };
  }));

  res.json(enriched);
});

// ─── Hoca materyalleri (kayıtlı kursların dersleri) ──────────────────────────
// GET /student/materials — öğrencinin kayıtlı kurslarındaki tüm dersler/materyaller
router.get("/student/materials", authMiddleware, requireRole("student"), async (req: AuthRequest, res) => {
  const studentId = req.userId!;

  const enrollments = await db.select({ courseId: enrollmentsTable.courseId })
    .from(enrollmentsTable).where(eq(enrollmentsTable.studentId, studentId));
  if (enrollments.length === 0) { res.json([]); return; }

  const courseIds = enrollments.map(e => e.courseId);

  const courses = await db.select({
    id: coursesTable.id,
    title: coursesTable.title,
    level: coursesTable.level,
    teacherId: coursesTable.teacherId,
  }).from(coursesTable).where(inArray(coursesTable.id, courseIds));

  const result = await Promise.all(courses.map(async (course) => {
    const [teacher] = await db.select({ firstName: usersTable.firstName, lastName: usersTable.lastName })
      .from(usersTable).where(eq(usersTable.id, course.teacherId!)).limit(1);

    const modules = await db.select().from(modulesTable)
      .where(eq(modulesTable.courseId, course.id)).orderBy(modulesTable.order);

    const modulesWithLessons = await Promise.all(modules.map(async (mod) => {
      const lessons = await db.select().from(lessonsTable)
        .where(eq(lessonsTable.moduleId, mod.id)).orderBy(lessonsTable.order);
      return { ...mod, lessons };
    }));

    return {
      courseId: course.id,
      courseTitle: course.title,
      level: course.level,
      teacherName: teacher ? `${teacher.firstName} ${teacher.lastName}` : null,
      modules: modulesWithLessons,
    };
  }));

  res.json(result);
});

export default router;
