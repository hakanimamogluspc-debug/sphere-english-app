import { Router } from "express";
import { db, messagesTable, usersTable, announcementsTable, coursesTable } from "@workspace/db";
import { eq, or, and, count, sql } from "drizzle-orm";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth.js";

const router = Router();

// Messages
router.get("/messages", authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  // Get all unique conversation partners
  const sent = await db.select({ partnerId: messagesTable.receiverId }).from(messagesTable).where(eq(messagesTable.senderId, userId));
  const received = await db.select({ partnerId: messagesTable.senderId }).from(messagesTable).where(eq(messagesTable.receiverId, userId));
  const partnerIds = [...new Set([...sent.map(x => x.partnerId), ...received.map(x => x.partnerId)])];

  const conversations = await Promise.all(partnerIds.map(async (partnerId) => {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, partnerId)).limit(1);
    if (!user) return null;

    const messages = await db.select().from(messagesTable).where(
      or(
        and(eq(messagesTable.senderId, userId), eq(messagesTable.receiverId, partnerId)),
        and(eq(messagesTable.senderId, partnerId), eq(messagesTable.receiverId, userId))
      )
    ).orderBy(messagesTable.sentAt);

    const lastMessage = messages[messages.length - 1];
    const unreadCount = messages.filter(m => m.receiverId === userId && !m.isRead).length;

    return {
      userId: partnerId,
      userName: `${user.firstName} ${user.lastName}`,
      userAvatar: user.avatar,
      userRole: user.role,
      lastMessage: lastMessage?.content || "",
      lastMessageAt: lastMessage?.sentAt.toISOString() || new Date().toISOString(),
      unreadCount,
    };
  }));

  res.json(conversations.filter(Boolean));
});

router.get("/messages/:userId", authMiddleware, async (req: AuthRequest, res) => {
  const currentUserId = req.userId!;
  const partnerId = parseInt(req.params.userId);

  const messages = await db.select().from(messagesTable).where(
    or(
      and(eq(messagesTable.senderId, currentUserId), eq(messagesTable.receiverId, partnerId)),
      and(eq(messagesTable.senderId, partnerId), eq(messagesTable.receiverId, currentUserId))
    )
  ).orderBy(messagesTable.sentAt);

  const enriched = await Promise.all(messages.map(async (m) => {
    const [sender] = await db.select({ firstName: usersTable.firstName, lastName: usersTable.lastName })
      .from(usersTable).where(eq(usersTable.id, m.senderId)).limit(1);
    return {
      ...m, sentAt: m.sentAt.toISOString(),
      senderName: sender ? `${sender.firstName} ${sender.lastName}` : "Unknown",
    };
  }));

  res.json(enriched);
});

router.post("/messages", authMiddleware, async (req: AuthRequest, res) => {
  const { receiverId, content } = req.body;
  if (!receiverId || !content) { res.status(400).json({ error: "receiverId and content are required" }); return; }
  const [message] = await db.insert(messagesTable).values({ senderId: req.userId!, receiverId, content }).returning();
  const [sender] = await db.select({ firstName: usersTable.firstName, lastName: usersTable.lastName })
    .from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
  res.status(201).json({ ...message, sentAt: message.sentAt.toISOString(), senderName: sender ? `${sender.firstName} ${sender.lastName}` : "Unknown" });
});

router.patch("/messages/:id/read", authMiddleware, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  await db.update(messagesTable).set({ isRead: true }).where(eq(messagesTable.id, id));
  res.json({ success: true, message: "Marked as read" });
});

router.delete("/messages/:id", authMiddleware, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const [msg] = await db.select().from(messagesTable).where(eq(messagesTable.id, id)).limit(1);
  if (!msg) { res.status(404).json({ error: "Mesaj bulunamadı" }); return; }
  if (msg.senderId !== req.userId) { res.status(403).json({ error: "Sadece kendi mesajınızı silebilirsiniz" }); return; }
  await db.delete(messagesTable).where(eq(messagesTable.id, id));
  res.json({ success: true });
});

// Announcements
router.get("/announcements", authMiddleware, async (req: AuthRequest, res) => {
  const { courseId } = req.query;
  let announcements;
  if (courseId && courseId !== "null") {
    announcements = await db.select().from(announcementsTable).where(eq(announcementsTable.courseId, parseInt(courseId as string)));
  } else {
    announcements = await db.select().from(announcementsTable);
  }

  const enriched = await Promise.all(announcements.map(async (a) => {
    const [author] = await db.select({ firstName: usersTable.firstName, lastName: usersTable.lastName })
      .from(usersTable).where(eq(usersTable.id, a.authorId)).limit(1);
    let courseTitle = null;
    if (a.courseId) {
      const [course] = await db.select({ title: coursesTable.title }).from(coursesTable).where(eq(coursesTable.id, a.courseId)).limit(1);
      courseTitle = course?.title || null;
    }
    return {
      ...a, createdAt: a.createdAt.toISOString(),
      authorName: author ? `${author.firstName} ${author.lastName}` : "Unknown",
      courseTitle,
    };
  }));

  res.json(enriched);
});

router.post("/announcements", authMiddleware, requireRole("admin", "teacher"), async (req: AuthRequest, res) => {
  const { courseId, title, content } = req.body;
  if (!title || !content) { res.status(400).json({ error: "title and content are required" }); return; }
  const [announcement] = await db.insert(announcementsTable).values({
    courseId: courseId || null, authorId: req.userId!, title, content,
  }).returning();
  const [author] = await db.select({ firstName: usersTable.firstName, lastName: usersTable.lastName })
    .from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
  res.status(201).json({ ...announcement, createdAt: announcement.createdAt.toISOString(), authorName: author ? `${author.firstName} ${author.lastName}` : "Unknown", courseTitle: null });
});

export default router;
