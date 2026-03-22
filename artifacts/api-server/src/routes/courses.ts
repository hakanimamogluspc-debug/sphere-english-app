import { Router } from "express";
import { db, usersTable, coursesTable, modulesTable, lessonsTable, enrollmentsTable, lessonProgressTable } from "@workspace/db";
import { eq, and, ilike, count, sql } from "drizzle-orm";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth.js";

const router = Router();

// Helper: get enrolled count and total lessons for a course
async function getCourseStats(courseId: number) {
  const [{ enrolled }] = await db.select({ enrolled: count() }).from(enrollmentsTable).where(eq(enrollmentsTable.courseId, courseId));
  const modules = await db.select({ id: modulesTable.id }).from(modulesTable).where(eq(modulesTable.courseId, courseId));
  let totalLessons = 0;
  for (const m of modules) {
    const [{ lc }] = await db.select({ lc: count() }).from(lessonsTable).where(eq(lessonsTable.moduleId, m.id));
    totalLessons += Number(lc);
  }
  return { enrolledCount: Number(enrolled), totalLessons };
}

// List courses
router.get("/courses", authMiddleware, async (req: AuthRequest, res) => {
  const { level, teacherId, isActive, search } = req.query;
  let conds: any[] = [];
  if (level && level !== "null") conds.push(eq(coursesTable.level, level as string));
  if (teacherId && teacherId !== "null") conds.push(eq(coursesTable.teacherId, parseInt(teacherId as string)));
  if (isActive !== undefined && isActive !== "null") conds.push(eq(coursesTable.isActive, isActive === "true"));
  if (search) conds.push(ilike(coursesTable.title, `%${search}%`));

  const where = conds.length > 0 ? and(...conds) : undefined;
  const courses = await db.select({
    id: coursesTable.id,
    title: coursesTable.title,
    description: coursesTable.description,
    level: coursesTable.level,
    teacherId: coursesTable.teacherId,
    price: coursesTable.price,
    isActive: coursesTable.isActive,
    imageUrl: coursesTable.imageUrl,
    createdAt: coursesTable.createdAt,
  }).from(coursesTable).where(where);

  const result = await Promise.all(courses.map(async (c) => {
    const stats = await getCourseStats(c.id);
    const teacher = c.teacherId ? await db.select({ firstName: usersTable.firstName, lastName: usersTable.lastName })
      .from(usersTable).where(eq(usersTable.id, c.teacherId)).limit(1) : [];
    return {
      ...c,
      price: c.price ? parseFloat(c.price) : null,
      teacherName: teacher[0] ? `${teacher[0].firstName} ${teacher[0].lastName}` : null,
      ...stats,
    };
  }));

  res.json(result);
});

// My courses (enrolled for students, taught for teachers)
router.get("/courses/my", authMiddleware, async (req: AuthRequest, res) => {
  if (req.userRole === "student") {
    const enrollments = await db.select({ courseId: enrollmentsTable.courseId })
      .from(enrollmentsTable).where(eq(enrollmentsTable.studentId, req.userId!));
    const courseIds = enrollments.map(e => e.courseId);
    if (courseIds.length === 0) { res.json([]); return; }

    const courses = await db.select().from(coursesTable).where(
      sql`${coursesTable.id} = ANY(${courseIds})`
    );
    const result = await Promise.all(courses.map(async (c) => {
      const stats = await getCourseStats(c.id);
      return { ...c, price: c.price ? parseFloat(c.price) : null, teacherName: null, ...stats };
    }));
    res.json(result);
  } else if (req.userRole === "teacher") {
    const courses = await db.select().from(coursesTable).where(eq(coursesTable.teacherId, req.userId!));
    const result = await Promise.all(courses.map(async (c) => {
      const stats = await getCourseStats(c.id);
      return { ...c, price: c.price ? parseFloat(c.price) : null, teacherName: null, ...stats };
    }));
    res.json(result);
  } else {
    // Admin sees all
    const courses = await db.select().from(coursesTable);
    const result = await Promise.all(courses.map(async (c) => {
      const stats = await getCourseStats(c.id);
      return { ...c, price: c.price ? parseFloat(c.price) : null, teacherName: null, ...stats };
    }));
    res.json(result);
  }
});

// Get course detail
router.get("/courses/:id", authMiddleware, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, id)).limit(1);
  if (!course) { res.status(404).json({ error: "Course not found" }); return; }

  const modules = await db.select().from(modulesTable).where(eq(modulesTable.courseId, id)).orderBy(modulesTable.order);
  const modulesWithLessons = await Promise.all(modules.map(async (m) => {
    const lessons = await db.select().from(lessonsTable).where(eq(lessonsTable.moduleId, m.id)).orderBy(lessonsTable.order);
    let lessonsWithProgress = lessons;
    if (req.userId) {
      lessonsWithProgress = await Promise.all(lessons.map(async (l) => {
        const [progress] = await db.select().from(lessonProgressTable)
          .where(and(eq(lessonProgressTable.userId, req.userId!), eq(lessonProgressTable.lessonId, l.id))).limit(1);
        return { ...l, isCompleted: progress?.completed || false };
      }));
    }
    return { ...m, lessons: lessonsWithProgress };
  }));

  const stats = await getCourseStats(id);
  const teacher = course.teacherId ? await db.select({ firstName: usersTable.firstName, lastName: usersTable.lastName })
    .from(usersTable).where(eq(usersTable.id, course.teacherId)).limit(1) : [];

  let isEnrolled = false;
  let completionPercentage: number | null = null;
  if (req.userId && req.userRole === "student") {
    const [enrollment] = await db.select().from(enrollmentsTable)
      .where(and(eq(enrollmentsTable.studentId, req.userId), eq(enrollmentsTable.courseId, id))).limit(1);
    isEnrolled = !!enrollment;
    if (isEnrolled && stats.totalLessons > 0) {
      const completed = await db.select({ c: count() }).from(lessonProgressTable)
        .where(and(eq(lessonProgressTable.userId, req.userId), eq(lessonProgressTable.completed, true)));
      completionPercentage = Math.round((Number(completed[0].c) / stats.totalLessons) * 100);
    }
  }

  res.json({
    ...course,
    price: course.price ? parseFloat(course.price) : null,
    teacherName: teacher[0] ? `${teacher[0].firstName} ${teacher[0].lastName}` : null,
    ...stats,
    modules: modulesWithLessons,
    isEnrolled,
    completionPercentage,
  });
});

// Create course
router.post("/courses", authMiddleware, requireRole("admin", "teacher"), async (req: AuthRequest, res) => {
  const { title, description, level, teacherId, price, isActive, imageUrl } = req.body;
  const tid = req.userRole === "teacher" ? req.userId : (teacherId || req.userId);
  const [course] = await db.insert(coursesTable).values({
    title, description, level, teacherId: tid,
    price: price ? String(price) : null,
    isActive: isActive !== false,
    imageUrl: imageUrl || null,
  }).returning();
  res.status(201).json({ ...course, price: course.price ? parseFloat(course.price) : null, enrolledCount: 0, totalLessons: 0, teacherName: null });
});

// Update course
router.patch("/courses/:id", authMiddleware, requireRole("admin", "teacher"), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const { title, description, level, teacherId, price, isActive, imageUrl } = req.body;
  const updates: any = { updatedAt: new Date() };
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (level !== undefined) updates.level = level;
  if (teacherId !== undefined) updates.teacherId = teacherId;
  if (price !== undefined) updates.price = price ? String(price) : null;
  if (isActive !== undefined) updates.isActive = isActive;
  if (imageUrl !== undefined) updates.imageUrl = imageUrl;

  const [updated] = await db.update(coursesTable).set(updates).where(eq(coursesTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Course not found" }); return; }
  const stats = await getCourseStats(id);
  res.json({ ...updated, price: updated.price ? parseFloat(updated.price) : null, teacherName: null, ...stats });
});

// Delete course
router.delete("/courses/:id", authMiddleware, requireRole("admin"), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  await db.delete(coursesTable).where(eq(coursesTable.id, id));
  res.json({ success: true, message: "Course deleted" });
});

// Enroll in course
router.post("/courses/:id/enroll", authMiddleware, async (req: AuthRequest, res) => {
  const courseId = parseInt(req.params.id);
  const studentId = req.body.studentId || req.userId;

  const [existing] = await db.select().from(enrollmentsTable)
    .where(and(eq(enrollmentsTable.studentId, studentId), eq(enrollmentsTable.courseId, courseId))).limit(1);
  if (existing) { res.json({ success: true, message: "Already enrolled" }); return; }

  await db.insert(enrollmentsTable).values({ studentId, courseId });
  res.json({ success: true, message: "Enrolled successfully" });
});

// Unenroll from course
router.post("/courses/:id/unenroll", authMiddleware, async (req: AuthRequest, res) => {
  const courseId = parseInt(req.params.id);
  const studentId = req.body.studentId || req.userId;
  await db.delete(enrollmentsTable).where(
    and(eq(enrollmentsTable.studentId, studentId), eq(enrollmentsTable.courseId, courseId))
  );
  res.json({ success: true, message: "Unenrolled successfully" });
});

export default router;
