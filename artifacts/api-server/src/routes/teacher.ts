import { Router } from "express";
import {
  db, usersTable, groupsTable, groupMembersTable,
  quizzesTable, questionsTable, quizAttemptsTable,
  speakingClubsTable, speakingClubParticipantsTable,
  messagesTable,
} from "@workspace/db";
import { eq, and, inArray, count, desc, sql } from "drizzle-orm";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth.js";

const router = Router();

// ─── Yardımcı: öğretmenin grup id listesi ───────────────────────────────────
async function teacherGroupIds(teacherId: number): Promise<number[]> {
  const rows = await db.select({ id: groupsTable.id })
    .from(groupsTable)
    .where(eq(groupsTable.teacherId, teacherId));
  return rows.map((r) => r.id);
}

// ─── Öğrenci Listeleri (sadece kendi gruplarındakiler) ───────────────────────

// GET /teacher/groups — öğretmenin grupları + üye sayısı
router.get("/teacher/groups", authMiddleware, requireRole("teacher", "admin"), async (req: AuthRequest, res) => {
  const teacherId = req.userId!;
  const groups = await db.select().from(groupsTable).where(eq(groupsTable.teacherId, teacherId));
  const result = await Promise.all(groups.map(async (g) => {
    const [{ mc }] = await db.select({ mc: count() }).from(groupMembersTable).where(eq(groupMembersTable.groupId, g.id));
    return { ...g, memberCount: Number(mc) };
  }));
  res.json(result);
});

// GET /teacher/students — kendi gruplarındaki öğrenciler
router.get("/teacher/students", authMiddleware, requireRole("teacher", "admin"), async (req: AuthRequest, res) => {
  const teacherId = req.userId!;
  const groupIds = await teacherGroupIds(teacherId);
  if (groupIds.length === 0) { res.json([]); return; }

  const members = await db.select({
    studentId: groupMembersTable.studentId,
    groupId: groupMembersTable.groupId,
    joinedAt: groupMembersTable.joinedAt,
  }).from(groupMembersTable).where(inArray(groupMembersTable.groupId, groupIds));

  if (members.length === 0) { res.json([]); return; }

  const studentIds = [...new Set(members.map((m) => m.studentId))];
  const students = await db.select({
    id: usersTable.id,
    firstName: usersTable.firstName,
    lastName: usersTable.lastName,
    email: usersTable.email,
    totalPoints: usersTable.totalPoints,
    streak: usersTable.streak,
    avatarUrl: usersTable.avatarUrl,
  }).from(usersTable).where(inArray(usersTable.id, studentIds));

  const result = students.map((s) => {
    const mem = members.filter((m) => m.studentId === s.id);
    return { ...s, groups: mem.map((m) => ({ groupId: m.groupId, joinedAt: m.joinedAt })) };
  });
  res.json(result);
});

// GET /teacher/groups/:groupId/members — bir gruptaki üyeler
router.get("/teacher/groups/:groupId/members", authMiddleware, requireRole("teacher", "admin"), async (req: AuthRequest, res) => {
  const teacherId = req.userId!;
  const groupId = parseInt(req.params.groupId);
  const [group] = await db.select().from(groupsTable).where(
    and(eq(groupsTable.id, groupId), eq(groupsTable.teacherId, teacherId))
  ).limit(1);
  if (!group) { res.status(403).json({ error: "Bu gruba erişim yetkiniz yok" }); return; }

  const members = await db.select({
    studentId: groupMembersTable.studentId,
    joinedAt: groupMembersTable.joinedAt,
  }).from(groupMembersTable).where(eq(groupMembersTable.groupId, groupId));

  if (members.length === 0) { res.json({ group, members: [] }); return; }

  const studentIds = members.map((m) => m.studentId);
  const students = await db.select({
    id: usersTable.id, firstName: usersTable.firstName, lastName: usersTable.lastName,
    email: usersTable.email, totalPoints: usersTable.totalPoints, streak: usersTable.streak,
  }).from(usersTable).where(inArray(usersTable.id, studentIds));

  res.json({ group, members: members.map((m) => ({
    ...students.find((s) => s.id === m.studentId), joinedAt: m.joinedAt,
  }))});
});

// POST /teacher/groups/:groupId/members — gruba öğrenci ekle
router.post("/teacher/groups/:groupId/members", authMiddleware, requireRole("teacher", "admin"), async (req: AuthRequest, res) => {
  const teacherId = req.userId!;
  const groupId = parseInt(req.params.groupId);
  const { studentId } = req.body;
  if (!studentId) { res.status(400).json({ error: "studentId gerekli" }); return; }

  const [group] = await db.select().from(groupsTable).where(
    and(eq(groupsTable.id, groupId), eq(groupsTable.teacherId, teacherId))
  ).limit(1);
  if (!group) { res.status(403).json({ error: "Bu gruba erişim yetkiniz yok" }); return; }

  const [student] = await db.select({ id: usersTable.id, role: usersTable.role })
    .from(usersTable).where(and(eq(usersTable.id, parseInt(studentId)), eq(usersTable.role, "student"))).limit(1);
  if (!student) { res.status(404).json({ error: "Öğrenci bulunamadı" }); return; }

  await db.insert(groupMembersTable).values({ groupId, studentId: student.id }).onConflictDoNothing();
  res.json({ success: true });
});

// DELETE /teacher/groups/:groupId/members/:studentId — gruptan öğrenci çıkar
router.delete("/teacher/groups/:groupId/members/:studentId", authMiddleware, requireRole("teacher", "admin"), async (req: AuthRequest, res) => {
  const teacherId = req.userId!;
  const groupId = parseInt(req.params.groupId);
  const studentId = parseInt(req.params.studentId);

  const [group] = await db.select().from(groupsTable).where(
    and(eq(groupsTable.id, groupId), eq(groupsTable.teacherId, teacherId))
  ).limit(1);
  if (!group) { res.status(403).json({ error: "Bu gruba erişim yetkiniz yok" }); return; }

  await db.delete(groupMembersTable).where(
    and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.studentId, studentId))
  );
  res.json({ success: true });
});

// GET /teacher/all-students — sisteme kayıtlı tüm öğrenciler (gruba ekleme için)
router.get("/teacher/all-students", authMiddleware, requireRole("teacher", "admin"), async (req: AuthRequest, res) => {
  const students = await db.select({
    id: usersTable.id, firstName: usersTable.firstName, lastName: usersTable.lastName, email: usersTable.email,
  }).from(usersTable).where(eq(usersTable.role, "student"));
  res.json(students);
});

// ─── Öğrenci İlerleme ────────────────────────────────────────────────────────

// GET /teacher/progress — kendi öğrencilerinin quiz denemeleri
router.get("/teacher/progress", authMiddleware, requireRole("teacher", "admin"), async (req: AuthRequest, res) => {
  const teacherId = req.userId!;
  const groupIds = await teacherGroupIds(teacherId);
  if (groupIds.length === 0) { res.json([]); return; }

  const members = await db.select({ studentId: groupMembersTable.studentId })
    .from(groupMembersTable).where(inArray(groupMembersTable.groupId, groupIds));
  if (members.length === 0) { res.json([]); return; }

  const studentIds = [...new Set(members.map((m) => m.studentId))];
  const students = await db.select({
    id: usersTable.id, firstName: usersTable.firstName, lastName: usersTable.lastName,
    email: usersTable.email, totalPoints: usersTable.totalPoints, streak: usersTable.streak,
  }).from(usersTable).where(inArray(usersTable.id, studentIds));

  const result = await Promise.all(students.map(async (s) => {
    const attempts = await db.select({
      id: quizAttemptsTable.id,
      quizId: quizAttemptsTable.quizId,
      score: quizAttemptsTable.score,
      percentage: quizAttemptsTable.percentage,
      passed: quizAttemptsTable.passed,
      submittedAt: quizAttemptsTable.submittedAt,
    }).from(quizAttemptsTable)
      .where(eq(quizAttemptsTable.userId, s.id))
      .orderBy(desc(quizAttemptsTable.submittedAt))
      .limit(10);

    const [{ avg }] = await db.select({ avg: sql<string>`AVG(percentage)` })
      .from(quizAttemptsTable).where(eq(quizAttemptsTable.userId, s.id));

    return {
      ...s,
      quizAttempts: attempts.length,
      averageScore: avg ? Math.round(parseFloat(avg)) : null,
      recentAttempts: attempts.slice(0, 5),
    };
  }));
  res.json(result);
});

// ─── Quiz Yönetimi ────────────────────────────────────────────────────────────

// GET /teacher/quizzes — öğretmenin oluşturduğu quizler
router.get("/teacher/quizzes", authMiddleware, requireRole("teacher", "admin"), async (req: AuthRequest, res) => {
  const teacherId = req.userId!;
  const quizzes = await db.select().from(quizzesTable).where(eq(quizzesTable.teacherId, teacherId))
    .orderBy(desc(quizzesTable.createdAt));
  const result = await Promise.all(quizzes.map(async (q) => {
    const [{ qc }] = await db.select({ qc: count() }).from(questionsTable).where(eq(questionsTable.quizId, q.id));
    const [{ ac }] = await db.select({ ac: count() }).from(quizAttemptsTable).where(eq(quizAttemptsTable.quizId, q.id));
    return { ...q, questionsCount: Number(qc), attemptsCount: Number(ac) };
  }));
  res.json(result);
});

// GET /teacher/quizzes/:id — quiz detayı (sorular dahil)
router.get("/teacher/quizzes/:id", authMiddleware, requireRole("teacher", "admin"), async (req: AuthRequest, res) => {
  const teacherId = req.userId!;
  const id = parseInt(req.params.id);
  const [quiz] = await db.select().from(quizzesTable)
    .where(and(eq(quizzesTable.id, id), eq(quizzesTable.teacherId, teacherId))).limit(1);
  if (!quiz) { res.status(404).json({ error: "Quiz bulunamadı" }); return; }
  const questions = await db.select().from(questionsTable)
    .where(eq(questionsTable.quizId, id)).orderBy(questionsTable.order);
  res.json({ ...quiz, questions });
});

// POST /teacher/quizzes — yeni quiz oluştur
router.post("/teacher/quizzes", authMiddleware, requireRole("teacher", "admin"), async (req: AuthRequest, res) => {
  const teacherId = req.userId!;
  const { title, courseId, timeLimit, passingScore, questions: qs } = req.body;
  if (!title) { res.status(400).json({ error: "Başlık zorunludur" }); return; }

  const [quiz] = await db.insert(quizzesTable).values({
    title, courseId: courseId || null, teacherId,
    timeLimit: timeLimit || null, passingScore: passingScore || 70,
  }).returning();

  let savedQuestions: any[] = [];
  if (qs && Array.isArray(qs) && qs.length > 0) {
    savedQuestions = await Promise.all(qs.map(async (q: any, i: number) => {
      const [saved] = await db.insert(questionsTable).values({
        quizId: quiz.id, type: q.type || "multiple_choice", question: q.question,
        options: q.options || null, correctAnswer: q.correctAnswer,
        points: q.points || 10, order: i,
      }).returning();
      return saved;
    }));
  }
  res.status(201).json({ ...quiz, questions: savedQuestions });
});

// PATCH /teacher/quizzes/:id — quiz güncelle
router.patch("/teacher/quizzes/:id", authMiddleware, requireRole("teacher", "admin"), async (req: AuthRequest, res) => {
  const teacherId = req.userId!;
  const id = parseInt(req.params.id);
  const [quiz] = await db.select().from(quizzesTable)
    .where(and(eq(quizzesTable.id, id), eq(quizzesTable.teacherId, teacherId))).limit(1);
  if (!quiz) { res.status(404).json({ error: "Quiz bulunamadı" }); return; }

  const { title, timeLimit, passingScore } = req.body;
  const updates: any = {};
  if (title !== undefined) updates.title = title;
  if (timeLimit !== undefined) updates.timeLimit = timeLimit || null;
  if (passingScore !== undefined) updates.passingScore = passingScore;

  const [updated] = await db.update(quizzesTable).set(updates).where(eq(quizzesTable.id, id)).returning();
  res.json(updated);
});

// DELETE /teacher/quizzes/:id — quiz sil
router.delete("/teacher/quizzes/:id", authMiddleware, requireRole("teacher", "admin"), async (req: AuthRequest, res) => {
  const teacherId = req.userId!;
  const id = parseInt(req.params.id);
  const [quiz] = await db.select().from(quizzesTable)
    .where(and(eq(quizzesTable.id, id), eq(quizzesTable.teacherId, teacherId))).limit(1);
  if (!quiz) { res.status(404).json({ error: "Quiz bulunamadı" }); return; }
  await db.delete(quizzesTable).where(eq(quizzesTable.id, id));
  res.json({ success: true });
});

// GET /teacher/quizzes/:id/attempts — quiz denemeleri
router.get("/teacher/quizzes/:id/attempts", authMiddleware, requireRole("teacher", "admin"), async (req: AuthRequest, res) => {
  const teacherId = req.userId!;
  const id = parseInt(req.params.id);
  const [quiz] = await db.select().from(quizzesTable)
    .where(and(eq(quizzesTable.id, id), eq(quizzesTable.teacherId, teacherId))).limit(1);
  if (!quiz) { res.status(404).json({ error: "Quiz bulunamadı" }); return; }

  const attempts = await db.select({
    id: quizAttemptsTable.id, userId: quizAttemptsTable.userId,
    score: quizAttemptsTable.score, percentage: quizAttemptsTable.percentage,
    passed: quizAttemptsTable.passed, submittedAt: quizAttemptsTable.submittedAt,
    firstName: usersTable.firstName, lastName: usersTable.lastName, email: usersTable.email,
  }).from(quizAttemptsTable)
    .leftJoin(usersTable, eq(quizAttemptsTable.userId, usersTable.id))
    .where(eq(quizAttemptsTable.quizId, id))
    .orderBy(desc(quizAttemptsTable.submittedAt));
  res.json(attempts);
});

// ─── Speaking Club ─────────────────────────────────────────────────────────

// GET /teacher/speaking-clubs — öğretmenin speaking club etkinlikleri
router.get("/teacher/speaking-clubs", authMiddleware, requireRole("teacher", "admin"), async (req: AuthRequest, res) => {
  const teacherId = req.userId!;
  const clubs = await db.select().from(speakingClubsTable)
    .where(eq(speakingClubsTable.teacherId, teacherId))
    .orderBy(desc(speakingClubsTable.scheduledAt));

  const result = await Promise.all(clubs.map(async (c) => {
    const participants = await db.select({
      studentId: speakingClubParticipantsTable.studentId,
      joinedAt: speakingClubParticipantsTable.joinedAt,
      firstName: usersTable.firstName, lastName: usersTable.lastName, email: usersTable.email,
    }).from(speakingClubParticipantsTable)
      .leftJoin(usersTable, eq(speakingClubParticipantsTable.studentId, usersTable.id))
      .where(eq(speakingClubParticipantsTable.clubId, c.id));
    return { ...c, participants, participantCount: participants.length };
  }));
  res.json(result);
});

// GET /api/speaking-clubs — tüm kullanıcılar için açık etkinlik listesi
router.get("/speaking-clubs", authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const clubs = await db.select().from(speakingClubsTable)
    .orderBy(desc(speakingClubsTable.scheduledAt));

  const result = await Promise.all(clubs.map(async (c) => {
    const [{ pc }] = await db.select({ pc: count() }).from(speakingClubParticipantsTable)
      .where(eq(speakingClubParticipantsTable.clubId, c.id));
    const [joined] = await db.select().from(speakingClubParticipantsTable)
      .where(and(eq(speakingClubParticipantsTable.clubId, c.id), eq(speakingClubParticipantsTable.studentId, userId)))
      .limit(1);
    const [teacher] = await c.teacherId
      ? await db.select({ firstName: usersTable.firstName, lastName: usersTable.lastName })
          .from(usersTable).where(eq(usersTable.id, c.teacherId!)).limit(1)
      : [null];
    return {
      ...c,
      participantCount: Number(pc),
      isJoined: !!joined,
      teacherName: teacher ? `${teacher.firstName} ${teacher.lastName}` : null,
    };
  }));
  res.json(result);
});

// POST /speaking-clubs/:id/join — etkinliğe katıl
router.post("/speaking-clubs/:id/join", authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const clubId = parseInt(req.params.id);
  const [club] = await db.select().from(speakingClubsTable).where(eq(speakingClubsTable.id, clubId)).limit(1);
  if (!club) { res.status(404).json({ error: "Etkinlik bulunamadı" }); return; }

  const [{ pc }] = await db.select({ pc: count() }).from(speakingClubParticipantsTable)
    .where(eq(speakingClubParticipantsTable.clubId, clubId));
  if (Number(pc) >= club.maxParticipants) {
    res.status(400).json({ error: "Etkinlik kapasitesi doldu" }); return;
  }

  await db.insert(speakingClubParticipantsTable).values({ clubId, studentId: userId }).onConflictDoNothing();
  res.json({ success: true });
});

// DELETE /speaking-clubs/:id/leave — etkinlikten ayrıl
router.delete("/speaking-clubs/:id/leave", authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const clubId = parseInt(req.params.id);
  await db.delete(speakingClubParticipantsTable).where(
    and(eq(speakingClubParticipantsTable.clubId, clubId), eq(speakingClubParticipantsTable.studentId, userId))
  );
  res.json({ success: true });
});

// ─── Grup Mesajı (Duyuru) ─────────────────────────────────────────────────

// POST /teacher/groups/:groupId/announce — gruptaki tüm öğrencilere mesaj gönder
router.post("/teacher/groups/:groupId/announce", authMiddleware, requireRole("teacher", "admin"), async (req: AuthRequest, res) => {
  const teacherId = req.userId!;
  const groupId = parseInt(req.params.groupId);
  const { content } = req.body;
  if (!content) { res.status(400).json({ error: "Mesaj içeriği zorunludur" }); return; }

  const [group] = await db.select().from(groupsTable).where(
    and(eq(groupsTable.id, groupId), eq(groupsTable.teacherId, teacherId))
  ).limit(1);
  if (!group) { res.status(403).json({ error: "Bu gruba erişim yetkiniz yok" }); return; }

  const members = await db.select({ studentId: groupMembersTable.studentId })
    .from(groupMembersTable).where(eq(groupMembersTable.groupId, groupId));
  if (members.length === 0) { res.json({ sent: 0 }); return; }

  await Promise.all(members.map((m) =>
    db.insert(messagesTable).values({ senderId: teacherId, receiverId: m.studentId, content })
  ));
  res.json({ sent: members.length });
});

export default router;
