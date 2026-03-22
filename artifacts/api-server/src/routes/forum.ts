import { Router } from "express";
import { db, usersTable, forumTopicsTable, forumRepliesTable } from "@workspace/db";
import { eq, desc, count, sql } from "drizzle-orm";
import { authMiddleware, type AuthRequest } from "../middlewares/auth.js";

const router = Router();

// ─── Konular listesi ──────────────────────────────────────────────────────────
router.get("/forum", authMiddleware, async (req: AuthRequest, res) => {
  const { category } = req.query;

  const topics = await db.select().from(forumTopicsTable)
    .where(category && category !== "tumu" ? eq(forumTopicsTable.category, category as string) : undefined)
    .orderBy(desc(forumTopicsTable.isPinned), desc(forumTopicsTable.createdAt));

  const enriched = await Promise.all(topics.map(async (t) => {
    const [author] = await db.select({ firstName: usersTable.firstName, lastName: usersTable.lastName, role: usersTable.role })
      .from(usersTable).where(eq(usersTable.id, t.authorId)).limit(1);
    const [replyCount] = await db.select({ c: count() }).from(forumRepliesTable).where(eq(forumRepliesTable.topicId, t.id));
    // Son yanıt
    const [lastReply] = await db.select({ createdAt: forumRepliesTable.createdAt })
      .from(forumRepliesTable).where(eq(forumRepliesTable.topicId, t.id)).orderBy(desc(forumRepliesTable.createdAt)).limit(1);

    return {
      ...t,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
      authorName: author ? `${author.firstName} ${author.lastName}` : "Bilinmiyor",
      authorRole: author?.role ?? null,
      replyCount: Number(replyCount?.c ?? 0),
      lastReplyAt: lastReply?.createdAt?.toISOString() ?? null,
    };
  }));

  res.json(enriched);
});

// ─── Konu oluştur ────────────────────────────────────────────────────────────
router.post("/forum", authMiddleware, async (req: AuthRequest, res) => {
  const { title, content, category, courseId } = req.body;
  if (!title?.trim() || !content?.trim()) {
    res.status(400).json({ error: "Başlık ve içerik zorunludur" }); return;
  }

  const [topic] = await db.insert(forumTopicsTable).values({
    title: title.trim(),
    content: content.trim(),
    authorId: req.userId!,
    category: category ?? "genel",
    courseId: courseId ?? null,
  }).returning();

  const [author] = await db.select({ firstName: usersTable.firstName, lastName: usersTable.lastName, role: usersTable.role })
    .from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);

  res.status(201).json({
    ...topic,
    createdAt: topic.createdAt.toISOString(),
    updatedAt: topic.updatedAt.toISOString(),
    authorName: author ? `${author.firstName} ${author.lastName}` : "Bilinmiyor",
    authorRole: author?.role ?? null,
    replyCount: 0,
    lastReplyAt: null,
  });
});

// ─── Konu detayı + yanıtlar ───────────────────────────────────────────────────
router.get("/forum/:id", authMiddleware, async (req: AuthRequest, res) => {
  const topicId = parseInt(req.params.id);
  const [topic] = await db.select().from(forumTopicsTable).where(eq(forumTopicsTable.id, topicId)).limit(1);
  if (!topic) { res.status(404).json({ error: "Konu bulunamadı" }); return; }

  const [author] = await db.select({ firstName: usersTable.firstName, lastName: usersTable.lastName, role: usersTable.role })
    .from(usersTable).where(eq(usersTable.id, topic.authorId)).limit(1);

  const replies = await db.select().from(forumRepliesTable)
    .where(eq(forumRepliesTable.topicId, topicId)).orderBy(forumRepliesTable.createdAt);

  const enrichedReplies = await Promise.all(replies.map(async (r) => {
    const [rAuthor] = await db.select({ firstName: usersTable.firstName, lastName: usersTable.lastName, role: usersTable.role })
      .from(usersTable).where(eq(usersTable.id, r.authorId)).limit(1);
    return {
      ...r,
      createdAt: r.createdAt.toISOString(),
      authorName: rAuthor ? `${rAuthor.firstName} ${rAuthor.lastName}` : "Bilinmiyor",
      authorRole: rAuthor?.role ?? null,
    };
  }));

  res.json({
    ...topic,
    createdAt: topic.createdAt.toISOString(),
    updatedAt: topic.updatedAt.toISOString(),
    authorName: author ? `${author.firstName} ${author.lastName}` : "Bilinmiyor",
    authorRole: author?.role ?? null,
    replies: enrichedReplies,
  });
});

// ─── Yanıt ekle ──────────────────────────────────────────────────────────────
router.post("/forum/:id/replies", authMiddleware, async (req: AuthRequest, res) => {
  const topicId = parseInt(req.params.id);
  const { content } = req.body;
  if (!content?.trim()) { res.status(400).json({ error: "Yanıt içeriği zorunludur" }); return; }

  const [topic] = await db.select({ id: forumTopicsTable.id }).from(forumTopicsTable).where(eq(forumTopicsTable.id, topicId)).limit(1);
  if (!topic) { res.status(404).json({ error: "Konu bulunamadı" }); return; }

  const [reply] = await db.insert(forumRepliesTable).values({
    topicId,
    authorId: req.userId!,
    content: content.trim(),
  }).returning();

  // Konunun updatedAt'ini güncelle
  await db.update(forumTopicsTable).set({ updatedAt: new Date() }).where(eq(forumTopicsTable.id, topicId));

  const [author] = await db.select({ firstName: usersTable.firstName, lastName: usersTable.lastName, role: usersTable.role })
    .from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);

  res.status(201).json({
    ...reply,
    createdAt: reply.createdAt.toISOString(),
    authorName: author ? `${author.firstName} ${author.lastName}` : "Bilinmiyor",
    authorRole: author?.role ?? null,
  });
});

// ─── Konu sil (sadece yazar veya admin) ──────────────────────────────────────
router.delete("/forum/:id", authMiddleware, async (req: AuthRequest, res) => {
  const topicId = parseInt(req.params.id);
  const [topic] = await db.select().from(forumTopicsTable).where(eq(forumTopicsTable.id, topicId)).limit(1);
  if (!topic) { res.status(404).json({ error: "Konu bulunamadı" }); return; }
  if (topic.authorId !== req.userId && req.userRole !== "admin") {
    res.status(403).json({ error: "Bu konuyu silme yetkiniz yok" }); return;
  }
  await db.delete(forumTopicsTable).where(eq(forumTopicsTable.id, topicId));
  res.json({ success: true });
});

export default router;
