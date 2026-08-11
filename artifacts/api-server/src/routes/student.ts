import { Router } from "express";
import {
  db, usersTable,
  liveClassesTable, liveClassAttendanceTable,
  coursesTable, modulesTable, lessonsTable, enrollmentsTable,
} from "@workspace/db";
import { eq, and, inArray, or } from "drizzle-orm";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth.js";

const router = Router();

// ─── Kendi ders takvimi ───────────────────────────────────────────────────────
// GET /student/live-classes — öğrencinin özellikle eklendiği dersler + kayıtlı kurs dersleri
router.get("/student/live-classes", authMiddleware, requireRole("student"), async (req: AuthRequest, res) => {
  const studentId = req.userId!;

  // 1. Öğrencinin attendance kaydı olan dersler (öğretmen tarafından eklenmiş)
  const attRecords = await db.select().from(liveClassAttendanceTable)
    .where(eq(liveClassAttendanceTable.studentId, studentId));
  const enrolledClassIds = attRecords.map(a => a.liveClassId);

  // 2. Kayıtlı olduğu kurslara bağlı dersler
  const enrollments = await db.select({ courseId: enrollmentsTable.courseId })
    .from(enrollmentsTable).where(eq(enrollmentsTable.studentId, studentId));
  const courseIds = enrollments.map(e => e.courseId);

  // Sadece bu iki kaynaktan gelen dersler gösterilir
  let classes: any[] = [];
  const conditions = [];
  if (enrolledClassIds.length > 0) conditions.push(inArray(liveClassesTable.id, enrolledClassIds));
  if (courseIds.length > 0) conditions.push(inArray(liveClassesTable.courseId, courseIds));

  if (conditions.length > 0) {
    classes = await db.select().from(liveClassesTable)
      .where(conditions.length === 1 ? conditions[0] : or(...conditions))
      .orderBy(liveClassesTable.startTime);
  }

  // Öğretmen adı + attendance kaydını ekle
  const enriched = await Promise.all(classes.map(async (cls) => {
    const [teacher] = await db.select({ firstName: usersTable.firstName, lastName: usersTable.lastName })
      .from(usersTable).where(eq(usersTable.id, cls.teacherId)).limit(1);
    const att = attRecords.find(a => a.liveClassId === cls.id) || null;
    return {
      ...cls,
      startTime: cls.startTime.toISOString(),
      createdAt: cls.createdAt.toISOString(),
      teacherName: teacher ? `${teacher.firstName} ${teacher.lastName}` : null,
      isAttending: !!att,
      // attendanceRecord: frontend'in durationMinutes ve joinedAt için beklediği alan
      attendanceRecord: att ? {
        joinedAt: att.joinedAt?.toISOString() || null,
        leftAt: att.leftAt?.toISOString() || null,
        durationMinutes: att.durationMinutes || null,
      } : null,
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
