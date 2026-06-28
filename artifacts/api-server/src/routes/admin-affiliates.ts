/**
 * Affiliate admin endpoints — onay, ödeme, raporlama.
 *
 *   GET   /api/admin/affiliates/overview      — Dashboard stats
 *   GET   /api/admin/affiliates               — Liste (status filtresi)
 *   GET   /api/admin/affiliates/:id           — Detay + commission listesi
 *   POST  /api/admin/affiliates/:id/approve   — Başvuru onayla
 *   POST  /api/admin/affiliates/:id/reject    — Başvuru reddet
 *   PATCH /api/admin/affiliates/:id           — Suspend/reactivate/code değiştir
 *   POST  /api/admin/affiliates/commissions/approve-matured  — 14 gün dolanları onayla
 *   GET   /api/admin/affiliates/payouts/pending  — Min payout'a ulaşan affiliates
 *   POST  /api/admin/affiliates/:id/payout       — Ödeme oluştur (approved commission'ları paid yap)
 *   POST  /api/admin/affiliates/payouts/:payoutId/mark-paid  — Ödeme tamam işaretle
 */

import { Router, Response } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth.js";
import { approveMaturedCommissions, MIN_PAYOUT_KURUS } from "../lib/affiliate.js";

const router = Router();

// ─── OVERVIEW ───────────────────────────────────────────────────────────
router.get(
  "/admin/affiliates/overview",
  authMiddleware,
  requireRole("admin"),
  async (_req: AuthRequest, res: Response) => {
    try {
      const stats = await db.execute(sql`
        SELECT
          (SELECT COUNT(*) FROM affiliates)::INT AS total,
          (SELECT COUNT(*) FROM affiliates WHERE status = 'pending')::INT AS pending,
          (SELECT COUNT(*) FROM affiliates WHERE status = 'active')::INT AS active,
          (SELECT COUNT(*) FROM affiliates WHERE status = 'suspended')::INT AS suspended,
          (SELECT COALESCE(SUM(commission_kurus), 0) FROM affiliate_commissions WHERE status IN ('pending','approved'))::BIGINT AS owed_kurus,
          (SELECT COALESCE(SUM(commission_kurus), 0) FROM affiliate_commissions WHERE status = 'paid')::BIGINT AS paid_kurus,
          (SELECT COUNT(*) FROM affiliate_commissions WHERE status = 'pending' AND created_at <= NOW() - INTERVAL '14 days')::INT AS ready_to_approve,
          (SELECT COUNT(*) FROM affiliate_clicks WHERE created_at >= NOW() - INTERVAL '30 days')::INT AS clicks_30d,
          (SELECT COUNT(*) FROM affiliate_commissions WHERE billing_cycle = 1 AND created_at >= NOW() - INTERVAL '30 days')::INT AS conversions_30d
      `);
      return res.json({ stats: (stats.rows ?? stats)[0] });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message });
    }
  },
);

// ─── LİSTE ──────────────────────────────────────────────────────────────
router.get(
  "/admin/affiliates",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const status = String(req.query?.status ?? "all");
      const search = String(req.query?.search ?? "").trim().toLowerCase();
      const limit = Math.min(parseInt(String(req.query?.limit ?? "100"), 10) || 100, 500);

      const conditions: any[] = [];
      if (status !== "all") conditions.push(sql`status = ${status}`);
      if (search) {
        const like = `%${search}%`;
        conditions.push(sql`(
          LOWER(full_name) LIKE ${like}
          OR LOWER(email) LIKE ${like}
          OR LOWER(code) LIKE ${like}
        )`);
      }
      const where = conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``;

      const rows = await db.execute(sql`
        SELECT id, user_id, code, status, full_name, email, phone, website,
               total_clicks, total_conversions, total_earned_kurus, total_paid_kurus,
               approved_at, rejected_at, rejection_reason, created_at
        FROM affiliates
        ${where}
        ORDER BY
          CASE status WHEN 'pending' THEN 0 WHEN 'active' THEN 1 ELSE 2 END,
          created_at DESC
        LIMIT ${limit}
      `);
      return res.json({ affiliates: rows.rows ?? rows });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message });
    }
  },
);

// ─── DETAY ──────────────────────────────────────────────────────────────
router.get(
  "/admin/affiliates/:id",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id ?? "", 10);
      if (!id) return res.status(400).json({ error: "id geçersiz" });

      const aRows = await db.execute(sql`SELECT * FROM affiliates WHERE id = ${id} LIMIT 1`);
      const aff = (aRows.rows ?? aRows)[0];
      if (!aff) return res.status(404).json({ error: "bulunamadı" });

      const cRows = await db.execute(sql`
        SELECT id, source_type, source_id, sale_amount_kurus, commission_rate,
               commission_kurus, billing_cycle, status,
               approved_at, paid_at, refunded_at, refund_reason, created_at
        FROM affiliate_commissions
        WHERE affiliate_id = ${id}
        ORDER BY created_at DESC
        LIMIT 200
      `);
      const pRows = await db.execute(sql`
        SELECT id, amount_kurus, commission_count, period_start, period_end,
               status, payment_reference, paid_at, notes, created_at
        FROM affiliate_payouts
        WHERE affiliate_id = ${id}
        ORDER BY created_at DESC
        LIMIT 50
      `);
      return res.json({
        affiliate: aff,
        commissions: cRows.rows ?? cRows,
        payouts: pRows.rows ?? pRows,
      });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message });
    }
  },
);

// ─── ONAYLA ─────────────────────────────────────────────────────────────
router.post(
  "/admin/affiliates/:id/approve",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id ?? "", 10);
      const adminId = req.user?.id;
      if (!id) return res.status(400).json({ error: "id geçersiz" });

      await db.execute(sql`
        UPDATE affiliates SET
          status = 'active',
          approved_at = NOW(),
          approved_by = ${adminId ?? null},
          rejected_at = NULL,
          rejection_reason = NULL,
          updated_at = NOW()
        WHERE id = ${id}
      `);

      // user_id NULL ise email match ile bağla + user'ın role'ünü "partner" yap
      const affRows = await db.execute(sql`
        SELECT user_id, email FROM affiliates WHERE id = ${id} LIMIT 1
      `);
      const aff = (affRows.rows ?? affRows)[0] as any;
      if (aff) {
        let linkedUserId = aff.user_id;
        if (!linkedUserId && aff.email) {
          const uRows = await db.execute(sql`
            SELECT id FROM users WHERE LOWER(email) = LOWER(${aff.email}) LIMIT 1
          `);
          linkedUserId = ((uRows.rows ?? uRows)[0] as any)?.id ?? null;
          if (linkedUserId) {
            await db.execute(sql`UPDATE affiliates SET user_id = ${linkedUserId} WHERE id = ${id}`);
          }
        }
        // Role partner yap (student → partner)
        if (linkedUserId) {
          await db.execute(sql`
            UPDATE users SET role = 'partner', updated_at = NOW()
            WHERE id = ${linkedUserId} AND role IN ('student','partner')
          `);
        }
      }

      // TODO: e-mail bildirimi (sendAffiliateApprovedMail)
      return res.json({ ok: true });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message });
    }
  },
);

router.post(
  "/admin/affiliates/:id/reject",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id ?? "", 10);
      const reason = String((req.body as any)?.reason ?? "");
      if (!id) return res.status(400).json({ error: "id geçersiz" });

      await db.execute(sql`
        UPDATE affiliates SET
          status = 'rejected',
          rejected_at = NOW(),
          rejection_reason = ${reason || "Belirtilmedi"},
          updated_at = NOW()
        WHERE id = ${id}
      `);
      return res.json({ ok: true });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message });
    }
  },
);

// ─── PATCH: suspend / reactivate / kod değiştir ─────────────────────────
router.patch(
  "/admin/affiliates/:id",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id ?? "", 10);
      const { status, code, notes } = (req.body ?? {}) as any;
      if (!id) return res.status(400).json({ error: "id geçersiz" });

      const sets: any[] = [];
      if (status && ["active", "suspended", "pending"].includes(status)) {
        sets.push(sql`status = ${status}`);
      }
      if (code) {
        const upper = String(code).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 40);
        if (upper.length >= 3) sets.push(sql`code = ${upper}`);
      }
      if (notes !== undefined) sets.push(sql`motivation = ${notes}`);
      if (sets.length === 0) return res.status(400).json({ error: "Güncelleme yok" });

      sets.push(sql`updated_at = NOW()`);
      await db.execute(sql`UPDATE affiliates SET ${sql.join(sets, sql`, `)} WHERE id = ${id}`);
      return res.json({ ok: true });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message });
    }
  },
);

// ─── 14 gün dolanları toplu onayla ──────────────────────────────────────
router.post(
  "/admin/affiliates/commissions/approve-matured",
  authMiddleware,
  requireRole("admin"),
  async (_req: AuthRequest, res: Response) => {
    try {
      const result = await approveMaturedCommissions();
      return res.json({ ok: true, ...result });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message });
    }
  },
);

// ─── Min payout'a ulaşmış affiliates ────────────────────────────────────
router.get(
  "/admin/affiliates/payouts/pending",
  authMiddleware,
  requireRole("admin"),
  async (_req: AuthRequest, res: Response) => {
    try {
      const rows = await db.execute(sql`
        SELECT
          a.id, a.code, a.full_name, a.email, a.iban, a.bank_name, a.account_holder_name, a.tc_number,
          COALESCE(SUM(c.commission_kurus), 0)::BIGINT AS payable_kurus,
          COUNT(c.id)::INT AS commission_count
        FROM affiliates a
        INNER JOIN affiliate_commissions c ON c.affiliate_id = a.id
        WHERE c.status = 'approved'
          AND a.status = 'active'
        GROUP BY a.id
        HAVING SUM(c.commission_kurus) >= ${MIN_PAYOUT_KURUS}
        ORDER BY payable_kurus DESC
      `);
      return res.json({ ready: rows.rows ?? rows, minPayoutKurus: MIN_PAYOUT_KURUS });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message });
    }
  },
);

// ─── Payout oluştur — approved commission'ları paid'e dönüştür ──────────
router.post(
  "/admin/affiliates/:id/payout",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id ?? "", 10);
      if (!id) return res.status(400).json({ error: "id geçersiz" });

      const aRows = await db.execute(sql`
        SELECT id, iban, bank_name, account_holder_name FROM affiliates WHERE id = ${id} LIMIT 1
      `);
      const aff = (aRows.rows ?? aRows)[0] as any;
      if (!aff) return res.status(404).json({ error: "Affiliate bulunamadı" });
      if (!aff.iban) return res.status(400).json({ error: "Affiliate'in IBAN'ı yok" });

      const cRows = await db.execute(sql`
        SELECT id, commission_kurus, created_at FROM affiliate_commissions
        WHERE affiliate_id = ${id} AND status = 'approved'
        ORDER BY created_at ASC
      `);
      const comms = (cRows.rows ?? cRows) as any[];
      if (comms.length === 0) return res.status(400).json({ error: "Approved komisyon yok" });

      const amountKurus = comms.reduce((s, c) => s + Number(c.commission_kurus), 0);
      const periodStart = comms[0].created_at;
      const periodEnd = comms[comms.length - 1].created_at;

      const payoutRows = await db.execute(sql`
        INSERT INTO affiliate_payouts (
          affiliate_id, amount_kurus, commission_count,
          period_start, period_end, status,
          iban, bank_name, account_holder_name
        ) VALUES (
          ${id}, ${amountKurus}, ${comms.length},
          ${periodStart}, ${periodEnd}, 'pending',
          ${aff.iban}, ${aff.bank_name}, ${aff.account_holder_name}
        )
        RETURNING id
      `);
      const payoutId = ((payoutRows.rows ?? payoutRows)[0] as any)?.id;

      // Commission'ları bu payout'a bağla — henüz paid değil, mark-paid endpoint'i bunu yapar
      const commIds = comms.map((c) => Number(c.id));
      await db.execute(sql`
        UPDATE affiliate_commissions
        SET payout_id = ${payoutId}
        WHERE id = ANY(${commIds})
      `);

      return res.json({ ok: true, payoutId, amountKurus, commissionCount: comms.length });
    } catch (e: any) {
      console.error("[admin-aff/payout] HATA:", e?.message);
      return res.status(500).json({ error: e?.message });
    }
  },
);

// ─── Payout'u "ödendi" işaretle ─────────────────────────────────────────
router.post(
  "/admin/affiliates/payouts/:payoutId/mark-paid",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const payoutId = parseInt(req.params.payoutId ?? "", 10);
      const { paymentReference, notes } = (req.body ?? {}) as any;
      const adminId = req.user?.id;
      if (!payoutId) return res.status(400).json({ error: "payoutId geçersiz" });

      // Payout'u paid yap
      const pRows = await db.execute(sql`
        UPDATE affiliate_payouts SET
          status = 'paid',
          paid_at = NOW(),
          paid_by = ${adminId ?? null},
          payment_reference = ${paymentReference ?? null},
          notes = ${notes ?? null}
        WHERE id = ${payoutId} AND status = 'pending'
        RETURNING affiliate_id, amount_kurus
      `);
      const payout = (pRows.rows ?? pRows)[0] as any;
      if (!payout) return res.status(400).json({ error: "Payout zaten ödenmiş veya yok" });

      // Bağlı commission'ları paid yap
      await db.execute(sql`
        UPDATE affiliate_commissions
        SET status = 'paid', paid_at = NOW()
        WHERE payout_id = ${payoutId}
      `);

      // Affiliate'in total_paid_kurus artır
      await db.execute(sql`
        UPDATE affiliates
        SET total_paid_kurus = total_paid_kurus + ${payout.amount_kurus},
            updated_at = NOW()
        WHERE id = ${payout.affiliate_id}
      `);

      // TODO: e-mail bildirimi (sendAffiliatePaidMail)
      return res.json({ ok: true });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message });
    }
  },
);

export default router;
