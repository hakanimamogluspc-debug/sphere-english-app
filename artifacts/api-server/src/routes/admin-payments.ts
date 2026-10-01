/**
 * Admin Payments & Refund API
 *
 * GET  /admin/payments               — ödeme listesi (filtre: user_id, event_type, status, tarih)
 * GET  /admin/payments/:id           — ödeme detayı + refund geçmişi
 * POST /admin/payments/:id/refund    — Iyzico refund tetikle
 */

import { Router, type Request, type Response } from "express";
import { db, paymentsTable, usersTable } from "@workspace/db";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth.js";
import { processRefund, type RefundReason } from "../services/payment-refund.js";

const router = Router();

// ─── GET /admin/payments ────────────────────────────────────────────────
router.get("/admin/payments", authMiddleware, requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { user_id, event_type, status, since, limit = "50", offset = "0" } = req.query as any;
      const filters: any[] = [];
      if (user_id) filters.push(eq(paymentsTable.userId, Number(user_id)));
      if (event_type) filters.push(eq(paymentsTable.eventType, String(event_type)));
      if (status) filters.push(eq(paymentsTable.status, String(status)));
      if (since) filters.push(gte(paymentsTable.createdAt, new Date(String(since))));

      const where = filters.length ? and(...filters) : undefined;
      const rows = await db.select({
        id: paymentsTable.id,
        userId: paymentsTable.userId,
        subscriptionId: paymentsTable.subscriptionId,
        eventType: paymentsTable.eventType,
        status: paymentsTable.status,
        amount: paymentsTable.amount,
        currency: paymentsTable.currency,
        providerPaymentId: paymentsTable.providerPaymentId,
        providerConversationId: paymentsTable.providerConversationId,
        errorCode: paymentsTable.errorCode,
        errorMessage: paymentsTable.errorMessage,
        createdAt: paymentsTable.createdAt,
        userEmail: usersTable.email,
        userName: usersTable.firstName,
      })
        .from(paymentsTable)
        .leftJoin(usersTable, eq(paymentsTable.userId, usersTable.id))
        .where(where)
        .orderBy(desc(paymentsTable.createdAt))
        .limit(Math.min(200, Number(limit)))
        .offset(Number(offset));

      const [{ total }] = await db.select({ total: sql<number>`COUNT(*)::int` })
        .from(paymentsTable).where(where);

      return res.json({ ok: true, items: rows, total: Number(total) });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message });
    }
  });

// ─── GET /admin/payments/:id ─────────────────────────────────────────────
router.get("/admin/payments/:id", authMiddleware, requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = Number(req.params.id);
      const [p] = await db.select().from(paymentsTable).where(eq(paymentsTable.id, id));
      if (!p) return res.status(404).json({ error: "Ödeme bulunamadı" });

      // İlişkili refund'ları da getir
      const refunds = p.providerPaymentId
        ? await db.select().from(paymentsTable).where(
          and(
            eq(paymentsTable.providerPaymentId, p.providerPaymentId),
            eq(paymentsTable.eventType, "refund"),
          ),
        )
        : [];

      return res.json({ ok: true, payment: p, refunds });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message });
    }
  });

// ─── POST /admin/payments/:id/refund ─────────────────────────────────────
router.post("/admin/payments/:id/refund", authMiddleware, requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const paymentId = Number(req.params.id);
      const { amount, reason, notes } = req.body as {
        amount?: number | null;
        reason: RefundReason;
        notes?: string;
      };

      if (!reason) return res.status(400).json({ error: "İade sebebi (reason) zorunlu" });
      if (!req.userId) return res.status(401).json({ error: "Admin kimliği eksik" });

      // Client IP — Iyzico zorunlu field
      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
        || req.socket.remoteAddress
        || "127.0.0.1";

      const result = await processRefund({
        paymentId,
        amount: amount ?? null,
        reason,
        notes,
        adminUserId: req.userId,
        ip,
      });

      if (!result.ok) return res.status(400).json(result);
      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message });
    }
  });

export default router;
