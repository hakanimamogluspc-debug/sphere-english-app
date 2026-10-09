import { Router } from "express";
import {
  db, usersTable,
  supportTicketsTable, supportTicketMessagesTable,
} from "@workspace/db";
import { eq, and, desc, inArray, count, sql } from "drizzle-orm";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth.js";

const router = Router();

const VALID_KINDS = new Set(["bug", "feature", "question", "other"]);
const VALID_STATUS = new Set(["open", "in_progress", "resolved", "closed"]);
const VALID_SEVERITY = new Set(["low", "normal", "high", "critical"]);

function clampStr(s: unknown, max: number): string {
  if (typeof s !== "string") return "";
  const trimmed = s.trim();
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

// ─── Kullanıcı tarafı ────────────────────────────────────────────────

/**
 * POST /support/tickets — yeni ticket oluştur.
 * Auth gerekli (user bilgisini otomatik ekler).
 */
router.post("/support/tickets", authMiddleware, async (req: AuthRequest, res) => {
  const { kind, title, body, severity, metadata } = req.body ?? {};

  const safeKind = VALID_KINDS.has(kind) ? kind : "bug";
  const safeSeverity = VALID_SEVERITY.has(severity) ? severity : "normal";
  const safeTitle = clampStr(title, 200);
  const safeBody = clampStr(body, 10000);

  if (!safeTitle || !safeBody) {
    res.status(400).json({ error: "Başlık ve açıklama zorunlu" });
    return;
  }
  if (safeTitle.length < 3) {
    res.status(400).json({ error: "Başlık en az 3 karakter olmalı" });
    return;
  }

  // Spam önleme: aynı user'ın son 60 saniyedeki ticket sayısı > 3 ise reddet
  try {
    const [{ cc }] = await db.select({ cc: count() })
      .from(supportTicketsTable)
      .where(and(
        eq(supportTicketsTable.userId, req.userId!),
        sql`${supportTicketsTable.createdAt} > NOW() - INTERVAL '60 seconds'`,
      ));
    if (Number(cc) >= 3) {
      res.status(429).json({ error: "Çok fazla bildirim gönderdiniz, lütfen biraz bekleyin" });
      return;
    }
  } catch { /* kritik değil */ }

  // Metadata whitelist — client'tan gelen context'i süz
  const safeMetadata: Record<string, unknown> = {};
  if (metadata && typeof metadata === "object") {
    const m = metadata as Record<string, unknown>;
    for (const key of ["url", "userAgent", "platform", "viewport", "deviceInfo", "appVersion", "locale"]) {
      if (typeof m[key] === "string" && (m[key] as string).length < 500) {
        safeMetadata[key] = m[key];
      }
    }
  }

  const [ticket] = await db.insert(supportTicketsTable).values({
    userId: req.userId!,
    kind: safeKind,
    severity: safeSeverity,
    title: safeTitle,
    body: safeBody,
    metadata: safeMetadata,
  }).returning();

  res.status(201).json({ ticket });
});

/**
 * GET /support/tickets/mine — kullanıcının kendi ticket'ları
 */
router.get("/support/tickets/mine", authMiddleware, async (req: AuthRequest, res) => {
  const rows = await db.select({
    id: supportTicketsTable.id,
    kind: supportTicketsTable.kind,
    status: supportTicketsTable.status,
    severity: supportTicketsTable.severity,
    title: supportTicketsTable.title,
    createdAt: supportTicketsTable.createdAt,
    updatedAt: supportTicketsTable.updatedAt,
    resolvedAt: supportTicketsTable.resolvedAt,
  })
    .from(supportTicketsTable)
    .where(eq(supportTicketsTable.userId, req.userId!))
    .orderBy(desc(supportTicketsTable.createdAt))
    .limit(100);
  res.json({ tickets: rows });
});

/**
 * GET /support/tickets/:id — detay + public messages.
 * Sadece sahibi veya admin erişebilir.
 */
router.get("/support/tickets/:id", authMiddleware, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Geçersiz id" }); return; }

  const [ticket] = await db.select().from(supportTicketsTable).where(eq(supportTicketsTable.id, id)).limit(1);
  if (!ticket) { res.status(404).json({ error: "Ticket bulunamadı" }); return; }

  const isOwner = ticket.userId === req.userId;
  const isAdmin = req.userRole === "admin";
  if (!isOwner && !isAdmin) {
    res.status(403).json({ error: "Erişim yok" });
    return;
  }

  // Mesajları çek — sahibi internal mesajları görmez
  const msgConds = [eq(supportTicketMessagesTable.ticketId, id)];
  if (!isAdmin) msgConds.push(eq(supportTicketMessagesTable.isInternal, 0));
  const messages = await db.select().from(supportTicketMessagesTable)
    .where(and(...msgConds))
    .orderBy(supportTicketMessagesTable.createdAt);

  // Author isimleri
  const authorIds = [...new Set(messages.map(m => m.authorId).filter(Boolean))] as number[];
  const authors = authorIds.length > 0 ? await db.select({
    id: usersTable.id,
    firstName: usersTable.firstName,
    lastName: usersTable.lastName,
    role: usersTable.role,
  }).from(usersTable).where(inArray(usersTable.id, authorIds)) : [];
  const authorMap = new Map(authors.map(a => [a.id, a]));

  res.json({
    ticket,
    messages: messages.map(m => ({
      ...m,
      author: m.authorId ? authorMap.get(m.authorId) ?? null : null,
    })),
  });
});

/**
 * POST /support/tickets/:id/messages — ticket'a yorum ekle.
 * Sahibi veya admin.
 */
router.post("/support/tickets/:id/messages", authMiddleware, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const { body, isInternal } = req.body ?? {};
  const safeBody = clampStr(body, 5000);
  if (!safeBody) { res.status(400).json({ error: "Mesaj boş olamaz" }); return; }

  const [ticket] = await db.select().from(supportTicketsTable).where(eq(supportTicketsTable.id, id)).limit(1);
  if (!ticket) { res.status(404).json({ error: "Ticket bulunamadı" }); return; }

  const isOwner = ticket.userId === req.userId;
  const isAdmin = req.userRole === "admin";
  if (!isOwner && !isAdmin) {
    res.status(403).json({ error: "Erişim yok" });
    return;
  }
  // Sadece admin internal yazabilir
  const internalFlag = isAdmin && isInternal ? 1 : 0;

  const [msg] = await db.insert(supportTicketMessagesTable).values({
    ticketId: id,
    authorId: req.userId!,
    body: safeBody,
    isInternal: internalFlag,
  }).returning();

  // Ticket updatedAt güncelle (closed ticket'a yorum atılırsa reopen)
  const patch: any = { updatedAt: new Date() };
  if (ticket.status === "closed" || ticket.status === "resolved") {
    if (isOwner) patch.status = "open"; // kullanıcı tekrar yazdı → reopen
  }
  await db.update(supportTicketsTable).set(patch).where(eq(supportTicketsTable.id, id));

  res.status(201).json({ message: msg });
});

// ─── Admin tarafı ────────────────────────────────────────────────────

/**
 * GET /admin/support/tickets — filtrelenebilir admin liste.
 *
 * Query: status, kind, severity, page, limit, q (başlıkta arama)
 */
router.get("/admin/support/tickets", authMiddleware, requireRole("admin"), async (req: AuthRequest, res) => {
  const page = Math.max(1, parseInt(String(req.query.page || "1")));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "25"))));
  const offset = (page - 1) * limit;

  const conds: any[] = [];
  const q = req.query;
  if (typeof q.status === "string" && VALID_STATUS.has(q.status)) {
    conds.push(eq(supportTicketsTable.status, q.status));
  }
  if (typeof q.kind === "string" && VALID_KINDS.has(q.kind)) {
    conds.push(eq(supportTicketsTable.kind, q.kind));
  }
  if (typeof q.severity === "string" && VALID_SEVERITY.has(q.severity)) {
    conds.push(eq(supportTicketsTable.severity, q.severity));
  }
  if (typeof q.q === "string" && q.q.trim().length > 0) {
    conds.push(sql`${supportTicketsTable.title} ILIKE ${"%" + q.q.trim() + "%"}`);
  }

  const where = conds.length ? and(...conds) : undefined;

  const tickets = await db.select({
    id: supportTicketsTable.id,
    userId: supportTicketsTable.userId,
    kind: supportTicketsTable.kind,
    status: supportTicketsTable.status,
    severity: supportTicketsTable.severity,
    title: supportTicketsTable.title,
    createdAt: supportTicketsTable.createdAt,
    updatedAt: supportTicketsTable.updatedAt,
  }).from(supportTicketsTable)
    .where(where)
    .orderBy(desc(supportTicketsTable.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ total }] = await db.select({ total: count() })
    .from(supportTicketsTable)
    .where(where);

  // Kullanıcı isimlerini çek
  const userIds = [...new Set(tickets.map(t => t.userId).filter(Boolean))] as number[];
  const users = userIds.length > 0 ? await db.select({
    id: usersTable.id,
    firstName: usersTable.firstName,
    lastName: usersTable.lastName,
    email: usersTable.email,
  }).from(usersTable).where(inArray(usersTable.id, userIds)) : [];
  const userMap = new Map(users.map(u => [u.id, u]));

  res.json({
    tickets: tickets.map(t => ({
      ...t,
      user: t.userId ? userMap.get(t.userId) ?? null : null,
    })),
    total: Number(total),
    page,
    limit,
  });
});

/**
 * PATCH /admin/support/tickets/:id — status/severity/assignee güncelle.
 */
router.patch("/admin/support/tickets/:id", authMiddleware, requireRole("admin"), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Geçersiz id" }); return; }

  const patch: any = { updatedAt: new Date() };
  const { status, severity, assignedToId } = req.body ?? {};
  if (typeof status === "string" && VALID_STATUS.has(status)) {
    patch.status = status;
    if (status === "resolved" || status === "closed") {
      patch.resolvedAt = new Date();
    }
  }
  if (typeof severity === "string" && VALID_SEVERITY.has(severity)) {
    patch.severity = severity;
  }
  if (assignedToId === null) patch.assignedToId = null;
  else if (typeof assignedToId === "number") patch.assignedToId = assignedToId;

  const [updated] = await db.update(supportTicketsTable)
    .set(patch)
    .where(eq(supportTicketsTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Ticket bulunamadı" }); return; }
  res.json({ ticket: updated });
});

/**
 * GET /admin/support/stats — basit özet
 */
router.get("/admin/support/stats", authMiddleware, requireRole("admin"), async (_req: AuthRequest, res) => {
  const byStatus = await db.select({
    status: supportTicketsTable.status,
    cc: count(),
  }).from(supportTicketsTable).groupBy(supportTicketsTable.status);
  const byKind = await db.select({
    kind: supportTicketsTable.kind,
    cc: count(),
  }).from(supportTicketsTable).groupBy(supportTicketsTable.kind);
  res.json({
    byStatus: byStatus.map(r => ({ status: r.status, count: Number(r.cc) })),
    byKind: byKind.map(r => ({ kind: r.kind, count: Number(r.cc) })),
  });
});

export default router;
