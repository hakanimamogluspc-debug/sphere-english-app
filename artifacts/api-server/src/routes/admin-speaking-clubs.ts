import { Router } from "express";
import { db, speakingClubsTable, speakingClubParticipantsTable, usersTable } from "@workspace/db";
import { eq, desc, count } from "drizzle-orm";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth.js";

const router = Router();

// GET /admin/speaking-clubs
router.get("/admin/speaking-clubs", authMiddleware, requireRole("admin"), async (_req, res) => {
  const clubs = await db
    .select()
    .from(speakingClubsTable)
    .orderBy(desc(speakingClubsTable.scheduledAt));

  const result = await Promise.all(
    clubs.map(async (c) => {
      let teacher = null;
      if (c.teacherId) {
        const [t] = await db
          .select({ id: usersTable.id, firstName: usersTable.firstName, lastName: usersTable.lastName })
          .from(usersTable)
          .where(eq(usersTable.id, c.teacherId))
          .limit(1);
        teacher = t || null;
      }
      const [{ pc }] = await db
        .select({ pc: count() })
        .from(speakingClubParticipantsTable)
        .where(eq(speakingClubParticipantsTable.clubId, c.id));
      return { ...c, teacher, participantCount: Number(pc) };
    })
  );

  res.json(result);
});

// GET /admin/speaking-clubs/:id/participants
router.get("/admin/speaking-clubs/:id/participants", authMiddleware, requireRole("admin"), async (req, res) => {
  const id = parseInt(req.params.id);
  const participants = await db
    .select({
      studentId: speakingClubParticipantsTable.studentId,
      joinedAt: speakingClubParticipantsTable.joinedAt,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      email: usersTable.email,
    })
    .from(speakingClubParticipantsTable)
    .leftJoin(usersTable, eq(speakingClubParticipantsTable.studentId, usersTable.id))
    .where(eq(speakingClubParticipantsTable.clubId, id))
    .orderBy(speakingClubParticipantsTable.joinedAt);
  res.json(participants);
});

// POST /admin/speaking-clubs
router.post("/admin/speaking-clubs", authMiddleware, requireRole("admin"), async (req: AuthRequest, res) => {
  const { title, description, topic, teacherId, scheduledAt, durationMinutes, maxParticipants, level, meetingLink } = req.body;

  if (!title || title.trim() === "") {
    res.status(400).json({ error: "Etkinlik başlığı zorunludur" });
    return;
  }
  if (!scheduledAt) {
    res.status(400).json({ error: "Tarih ve saat zorunludur" });
    return;
  }

  const [club] = await db
    .insert(speakingClubsTable)
    .values({
      title: title.trim(),
      description: description?.trim() || null,
      topic: topic?.trim() || null,
      teacherId: teacherId ? Number(teacherId) : null,
      scheduledAt: new Date(scheduledAt),
      durationMinutes: durationMinutes ? Number(durationMinutes) : 60,
      maxParticipants: maxParticipants ? Number(maxParticipants) : 10,
      level: level || "all",
      status: "upcoming",
      meetingLink: meetingLink?.trim() || null,
    })
    .returning();

  res.status(201).json(club);
});

// PATCH /admin/speaking-clubs/:id
router.patch("/admin/speaking-clubs/:id", authMiddleware, requireRole("admin"), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const { title, description, topic, teacherId, scheduledAt, durationMinutes, maxParticipants, level, meetingLink, status } = req.body;

  const updates: any = {};
  if (title !== undefined && title.trim() !== "") updates.title = title.trim();
  if (description !== undefined) updates.description = description?.trim() || null;
  if (topic !== undefined) updates.topic = topic?.trim() || null;
  if (teacherId !== undefined) updates.teacherId = teacherId ? Number(teacherId) : null;
  if (scheduledAt !== undefined) updates.scheduledAt = new Date(scheduledAt);
  if (durationMinutes !== undefined) updates.durationMinutes = Number(durationMinutes);
  if (maxParticipants !== undefined) updates.maxParticipants = Number(maxParticipants);
  if (level !== undefined) updates.level = level;
  if (meetingLink !== undefined) updates.meetingLink = meetingLink?.trim() || null;
  if (status !== undefined) updates.status = status;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "Güncellenecek alan yok" });
    return;
  }

  const [updated] = await db
    .update(speakingClubsTable)
    .set(updates)
    .where(eq(speakingClubsTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Etkinlik bulunamadı" }); return; }
  res.json(updated);
});

// DELETE /admin/speaking-clubs/:id
router.delete("/admin/speaking-clubs/:id", authMiddleware, requireRole("admin"), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  await db.delete(speakingClubsTable).where(eq(speakingClubsTable.id, id));
  res.json({ success: true });
});

export default router;
