import { Router } from "express";
import { db, liveClassesTable, liveClassAttendanceTable, usersTable, coursesTable } from "@workspace/db";
import { eq, and, gte, lte, count, desc, ilike, or } from "drizzle-orm";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth.js";
import { createZoomMeeting, deleteZoomMeeting, zoomConfigured } from "../services/zoom.js";
import { applyActivityStreak } from "../utils/streak.js";

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
  let attendanceRecord: any = null;
  if (userId) {
    const [att] = await db.select().from(liveClassAttendanceTable)
      .where(and(eq(liveClassAttendanceTable.liveClassId, lc.id), eq(liveClassAttendanceTable.studentId, userId))).limit(1);
    isEnrolled = !!att;
    attendanceRecord = att || null;
  }

  return {
    ...lc,
    startTime: lc.startTime.toISOString(),
    createdAt: lc.createdAt.toISOString(),
    teacherName: teacher ? `${teacher.firstName} ${teacher.lastName}` : null,
    courseName,
    enrolledCount: Number(ec),
    isEnrolled,
    attendanceRecord: attendanceRecord ? {
      joinedAt: attendanceRecord.joinedAt?.toISOString() || null,
      leftAt: attendanceRecord.leftAt?.toISOString() || null,
      durationMinutes: attendanceRecord.durationMinutes || null,
    } : null,
    zoomEnabled: zoomConfigured(),
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
  const { title, description, courseId, startTime, duration, meetingLink, maxStudents, type, teacherId: bodyTeacherId } = req.body;
  if (!title || !startTime || !duration || !maxStudents) {
    res.status(400).json({ error: "Required fields missing" }); return;
  }

  // Admin can specify a different teacher; teachers always create for themselves
  const teacherId = (req.userRole === "admin" && bodyTeacherId) ? parseInt(bodyTeacherId) : req.userId!;

  let finalMeetingLink = meetingLink || "";
  let zoomMeetingId: string | null = null;

  if (zoomConfigured()) {
    try {
      const meeting = await createZoomMeeting(title, new Date(startTime), parseInt(duration));
      finalMeetingLink = meeting.joinUrl;
      zoomMeetingId = meeting.id;
    } catch (err: any) {
      res.status(502).json({ error: `Zoom toplantısı oluşturulamadı: ${err.message}` }); return;
    }
  } else if (!meetingLink) {
    res.status(400).json({ error: "Zoom entegrasyonu aktif değil. Toplantı linki giriniz." }); return;
  }

  const [lc] = await db.insert(liveClassesTable).values({
    title,
    description: description || null,
    teacherId,
    courseId: courseId || null,
    startTime: new Date(startTime),
    duration: parseInt(duration),
    meetingLink: finalMeetingLink,
    zoomMeetingId,
    maxStudents: parseInt(maxStudents),
    isRecorded: false,
    type: type || "group",
  }).returning();
  res.status(201).json(await enrichLiveClass(lc, req.userId));
});

router.patch("/live-classes/:id", authMiddleware, requireRole("admin", "teacher"), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const { title, description, startTime, duration, meetingLink, maxStudents } = req.body;
  const updates: any = {};
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (startTime !== undefined) updates.startTime = new Date(startTime);
  if (duration !== undefined) updates.duration = parseInt(duration);
  if (meetingLink !== undefined) updates.meetingLink = meetingLink;
  if (maxStudents !== undefined) updates.maxStudents = parseInt(maxStudents);

  const [updated] = await db.update(liveClassesTable).set(updates).where(eq(liveClassesTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Live class not found" }); return; }
  res.json(await enrichLiveClass(updated, req.userId));
});

router.delete("/live-classes/:id", authMiddleware, requireRole("admin", "teacher"), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const [lc] = await db.select().from(liveClassesTable).where(eq(liveClassesTable.id, id)).limit(1);
  if (lc?.zoomMeetingId && zoomConfigured()) {
    try { await deleteZoomMeeting(lc.zoomMeetingId); } catch {}
  }
  await db.delete(liveClassesTable).where(eq(liveClassesTable.id, id));
  res.json({ success: true });
});

router.post("/live-classes/:id/join", authMiddleware, async (req: AuthRequest, res) => {
  const liveClassId = parseInt(req.params.id);
  const studentId = req.userId!;

  const [lc] = await db.select().from(liveClassesTable).where(eq(liveClassesTable.id, liveClassId)).limit(1);
  if (!lc) { res.status(404).json({ error: "Live class not found" }); return; }

  const now = new Date();
  const classStart = new Date(lc.startTime);
  const classEnd = new Date(classStart.getTime() + lc.duration * 60000);
  const windowStart = new Date(classStart.getTime() - 15 * 60000);

  if (now < windowStart) {
    res.status(400).json({ error: "Ders henüz başlamadı. 15 dakika öncesinden katılabilirsiniz." }); return;
  }
  if (now > classEnd) {
    res.status(400).json({ error: "Bu dersin süresi doldu." }); return;
  }

  const [existing] = await db.select().from(liveClassAttendanceTable)
    .where(and(eq(liveClassAttendanceTable.liveClassId, liveClassId), eq(liveClassAttendanceTable.studentId, studentId))).limit(1);

  if (!existing) {
    await db.insert(liveClassAttendanceTable).values({ liveClassId, studentId, joinedAt: now });
    await applyActivityStreak(studentId, 15);
  } else {
    // Öğrenci gerçekten tıkladığında joinedAt'i güncelle — süre doğru hesaplansın
    await db.update(liveClassAttendanceTable)
      .set({ joinedAt: now, leftAt: null, durationMinutes: null })
      .where(eq(liveClassAttendanceTable.id, existing.id));
  }

  res.json({ success: true, meetingLink: lc.meetingLink });
});

router.post("/live-classes/:id/leave", authMiddleware, async (req: AuthRequest, res) => {
  const liveClassId = parseInt(req.params.id);
  const studentId = req.userId!;

  const [att] = await db.select().from(liveClassAttendanceTable)
    .where(and(eq(liveClassAttendanceTable.liveClassId, liveClassId), eq(liveClassAttendanceTable.studentId, studentId))).limit(1);

  if (!att) { res.json({ success: true }); return; }
  if (att.leftAt) { res.json({ success: true, alreadyLeft: true }); return; }

  const now = new Date();
  const durationMinutes = Math.round((now.getTime() - att.joinedAt.getTime()) / 60000);

  await db.update(liveClassAttendanceTable)
    .set({ leftAt: now, durationMinutes })
    .where(eq(liveClassAttendanceTable.id, att.id));

  res.json({ success: true, durationMinutes });
});

router.get("/live-classes/:id/attendance", authMiddleware, requireRole("admin", "teacher"), async (req: AuthRequest, res) => {
  const liveClassId = parseInt(req.params.id);

  const [lc] = await db.select().from(liveClassesTable).where(eq(liveClassesTable.id, liveClassId)).limit(1);
  if (!lc) { res.status(404).json({ error: "Live class not found" }); return; }

  const records = await db.select({
    id: liveClassAttendanceTable.id,
    studentId: liveClassAttendanceTable.studentId,
    joinedAt: liveClassAttendanceTable.joinedAt,
    leftAt: liveClassAttendanceTable.leftAt,
    durationMinutes: liveClassAttendanceTable.durationMinutes,
    firstName: usersTable.firstName,
    lastName: usersTable.lastName,
    email: usersTable.email,
  })
    .from(liveClassAttendanceTable)
    .leftJoin(usersTable, eq(liveClassAttendanceTable.studentId, usersTable.id))
    .where(eq(liveClassAttendanceTable.liveClassId, liveClassId));

  res.json({
    liveClass: {
      id: lc.id,
      title: lc.title,
      startTime: lc.startTime.toISOString(),
      duration: lc.duration,
      maxStudents: lc.maxStudents,
    },
    attendance: records.map(r => ({
      ...r,
      joinedAt: r.joinedAt?.toISOString() || null,
      leftAt: r.leftAt?.toISOString() || null,
    })),
  });
});

router.get("/zoom/status", authMiddleware, (req, res) => {
  res.json({ configured: zoomConfigured() });
});

// ─── Admin: tüm oturumları listele (detaylı filtreleme) ───────────────────────
router.get("/admin/live-classes", authMiddleware, requireRole("admin"), async (req: AuthRequest, res) => {
  const { teacherId, type, dateFrom, dateTo, status, search } = req.query;
  let conds: any[] = [];
  if (teacherId && teacherId !== "all") conds.push(eq(liveClassesTable.teacherId, parseInt(teacherId as string)));
  if (type && type !== "all") conds.push(eq(liveClassesTable.type, type as string));
  if (dateFrom) conds.push(gte(liveClassesTable.startTime, new Date(dateFrom as string)));
  if (dateTo) conds.push(lte(liveClassesTable.startTime, new Date(dateTo as string)));
  if (status === "upcoming") conds.push(gte(liveClassesTable.startTime, new Date()));
  if (status === "past") conds.push(lte(liveClassesTable.startTime, new Date()));

  const where = conds.length > 0 ? and(...conds) : undefined;
  const classes = await db.select().from(liveClassesTable).where(where).orderBy(desc(liveClassesTable.startTime));

  const enriched = await Promise.all(classes.map(async (lc) => {
    const [teacher] = await db.select({ firstName: usersTable.firstName, lastName: usersTable.lastName, email: usersTable.email })
      .from(usersTable).where(eq(usersTable.id, lc.teacherId)).limit(1);
    const [{ ec }] = await db.select({ ec: count() }).from(liveClassAttendanceTable)
      .where(eq(liveClassAttendanceTable.liveClassId, lc.id));
    let courseName = null;
    if (lc.courseId) {
      const [course] = await db.select({ title: coursesTable.title }).from(coursesTable).where(eq(coursesTable.id, lc.courseId)).limit(1);
      courseName = course?.title || null;
    }
    return {
      ...lc,
      startTime: lc.startTime.toISOString(),
      createdAt: lc.createdAt.toISOString(),
      teacherName: teacher ? `${teacher.firstName} ${teacher.lastName}` : null,
      teacherEmail: teacher?.email || null,
      courseName,
      enrolledCount: Number(ec),
    };
  }));

  // Search filter after enrichment
  const filtered = search
    ? enriched.filter(lc =>
        lc.title.toLowerCase().includes((search as string).toLowerCase()) ||
        (lc.teacherName || "").toLowerCase().includes((search as string).toLowerCase())
      )
    : enriched;

  res.json(filtered);
});

// ─── Admin: oturuma öğrenci ekle ─────────────────────────────────────────────
router.post("/admin/live-classes/:id/students", authMiddleware, requireRole("admin"), async (req: AuthRequest, res) => {
  const liveClassId = parseInt(req.params.id);
  const { studentIds } = req.body;
  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    res.status(400).json({ error: "studentIds gereklidir" }); return;
  }
  await db.insert(liveClassAttendanceTable)
    .values(studentIds.map((sid: number) => ({ liveClassId, studentId: Number(sid), joinedAt: new Date() })))
    .onConflictDoNothing();
  res.json({ success: true, added: studentIds.length });
});

// ─── Admin: oturumdan öğrenci çıkar ──────────────────────────────────────────
router.delete("/admin/live-classes/:id/students/:studentId", authMiddleware, requireRole("admin"), async (req: AuthRequest, res) => {
  const liveClassId = parseInt(req.params.id);
  const studentId = parseInt(req.params.studentId);
  await db.delete(liveClassAttendanceTable)
    .where(and(eq(liveClassAttendanceTable.liveClassId, liveClassId), eq(liveClassAttendanceTable.studentId, studentId)));
  res.json({ success: true });
});

export default router;
