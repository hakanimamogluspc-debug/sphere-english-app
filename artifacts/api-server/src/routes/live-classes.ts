import { Router } from "express";
import { db, liveClassesTable, liveClassAttendanceTable, usersTable, coursesTable } from "@workspace/db";
import { eq, and, gte, count } from "drizzle-orm";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth.js";

const router = Router();

async function enrichLiveClass(lc: any, userId?: number) {
  const [teacher] = await db.select({ firstName: usersTable.firstName, lastName: usersTable.lastName })
    .from(usersTable).where(eq(usersTable.id, lc.teacherId)).limit(1);
  const [{ ec }] = await db.select({ ec: count() }).from(liveClassAttendanceTable)
    .where(eq(liveClassAttendanceTable.liveClassId, lc.id));

  let courseName = null;
  if (lc.courseId) {
    const [course] = await db.select({ title: coursesTable.title }).from(coursesTable)
      .where(eq(coursesTable.id, lc.courseId)).limit(1);
    courseName = course?.title || null;
  }

  let isEnrolled = false;
  if (userId) {
    const [att] = await db.select().from(liveClassAttendanceTable)
      .where(and(eq(liveClassAttendanceTable.liveClassId, lc.id), eq(liveClassAttendanceTable.studentId, userId))).limit(1);
    isEnrolled = !!att;
  }

  return {
    ...lc,
    startTime: lc.startTime.toISOString(),
    createdAt: lc.createdAt.toISOString(),
    teacherName: teacher ? `${teacher.firstName} ${teacher.lastName}` : null,
    courseName,
    enrolledCount: Number(ec),
    isEnrolled,
  };
}

router.get("/live-classes", authMiddleware, async (req: AuthRequest, res) => {
  const { courseId, teacherId, upcoming } = req.query;
  let conds: any[] = [];
  if (courseId && courseId !== "null") conds.push(eq(liveClassesTable.courseId, parseInt(courseId as string)));
  if (teacherId && teacherId !== "null") conds.push(eq(liveClassesTable.teacherId, parseInt(teacherId as string)));
  if (upcoming === "true") conds.push(gte(liveClassesTable.startTime, new Date()));

  const where = conds.length > 0 ? and(...conds) : undefined;
  const classes = await db.select().from(liveClassesTable).where(where);
  const enriched = await Promise.all(classes.map(lc => enrichLiveClass(lc, req.userId)));
  res.json(enriched);
});

router.get("/live-classes/:id", authMiddleware, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const [lc] = await db.select().from(liveClassesTable).where(eq(liveClassesTable.id, id)).limit(1);
  if (!lc) { res.status(404).json({ error: "Live class not found" }); return; }
  res.json(await enrichLiveClass(lc, req.userId));
});

router.post("/live-classes", authMiddleware, requireRole("admin", "teacher"), async (req: AuthRequest, res) => {
  const { title, description, courseId, startTime, duration, meetingLink, maxStudents, isRecorded, type } = req.body;
  if (!title || !startTime || !duration || !meetingLink || !maxStudents) {
    res.status(400).json({ error: "Required fields missing" }); return;
  }
  const [lc] = await db.insert(liveClassesTable).values({
    title, description: description || null, teacherId: req.userId!,
    courseId: courseId || null, startTime: new Date(startTime),
    duration, meetingLink, maxStudents, isRecorded: isRecorded || false,
    type: type || "group",
  }).returning();
  res.status(201).json(await enrichLiveClass(lc, req.userId));
});

router.patch("/live-classes/:id", authMiddleware, requireRole("admin", "teacher"), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const { title, description, startTime, duration, meetingLink, maxStudents, isRecorded, recordingUrl } = req.body;
  const updates: any = {};
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (startTime !== undefined) updates.startTime = new Date(startTime);
  if (duration !== undefined) updates.duration = duration;
  if (meetingLink !== undefined) updates.meetingLink = meetingLink;
  if (maxStudents !== undefined) updates.maxStudents = maxStudents;
  if (isRecorded !== undefined) updates.isRecorded = isRecorded;
  if (recordingUrl !== undefined) updates.recordingUrl = recordingUrl;

  const [updated] = await db.update(liveClassesTable).set(updates).where(eq(liveClassesTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Live class not found" }); return; }
  res.json(await enrichLiveClass(updated, req.userId));
});

router.delete("/live-classes/:id", authMiddleware, requireRole("admin", "teacher"), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  await db.delete(liveClassesTable).where(eq(liveClassesTable.id, id));
  res.json({ success: true, message: "Live class deleted" });
});

router.post("/live-classes/:id/join", authMiddleware, async (req: AuthRequest, res) => {
  const liveClassId = parseInt(req.params.id);
  const studentId = req.userId!;
  const [existing] = await db.select().from(liveClassAttendanceTable)
    .where(and(eq(liveClassAttendanceTable.liveClassId, liveClassId), eq(liveClassAttendanceTable.studentId, studentId))).limit(1);
  if (!existing) {
    await db.insert(liveClassAttendanceTable).values({ liveClassId, studentId });
    // Add 15 points for joining
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, studentId)).limit(1);
    if (user) {
      await db.update(usersTable).set({ totalPoints: user.totalPoints + 15, updatedAt: new Date() }).where(eq(usersTable.id, studentId));
    }
  }
  res.json({ success: true, message: "Joined live class" });
});

export default router;
