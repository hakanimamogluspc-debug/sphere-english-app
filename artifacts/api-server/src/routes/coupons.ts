/**
 * Coupon endpoints — public validate + admin CRUD.
 *
 * PUBLIC:
 *   POST /api/coupons/validate { code, scope, amountKurus } → { ok, type, discountKurus, finalAmountKurus, ... }
 *
 * ADMIN:
 *   GET    /api/admin/coupons              — Liste
 *   GET    /api/admin/coupons/:id          — Detay + redemptions
 *   POST   /api/admin/coupons              — Yeni kupon
 *   PATCH  /api/admin/coupons/:id          — Güncelle
 *   POST   /api/admin/coupons/:id/toggle   — Aktif/pasif
 *   DELETE /api/admin/coupons/:id          — Sil (kullanılmamışsa)
 */

import { Router, Request, Response } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth.js";
import { validateCode, normalizeCode } from "../lib/coupon.js";

const router = Router();

// ─── PUBLIC: Validate ───────────────────────────────────────────────────
router.post("/coupons/validate", async (req: Request, res: Response) => {
  try {
    const { code, scope, amountKurus, userId } = (req.body ?? {}) as any;
    if (!code || !scope || amountKurus == null) {
      return res.status(400).json({ error: "code, scope, amountKurus zorunlu" });
    }
    if (!["subscription_monthly", "subscription_yearly", "ebook"].includes(scope)) {
      return res.status(400).json({ error: "Geçersiz scope" });
    }
    const result = await validateCode({
      code: String(code),
      amountKurus: Number(amountKurus),
      scope,
      userId: userId ? Number(userId) : null,
    });
    return res.json(result);
  } catch (e: any) {
    console.error("[coupon/validate] HATA:", e?.message);
    return res.status(500).json({ ok: false, error: e?.message });
  }
});

// ─── ADMIN: Liste ───────────────────────────────────────────────────────
router.get(
  "/admin/coupons",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const status = String(req.query?.status ?? "all");
      const search = String(req.query?.search ?? "").trim().toLowerCase();
      const conditions: any[] = [];
      if (status === "active") conditions.push(sql`is_active = TRUE`);
      if (status === "inactive") conditions.push(sql`is_active = FALSE`);
      if (search) {
        const like = `%${search}%`;
        conditions.push(sql`(LOWER(code) LIKE ${like} OR LOWER(COALESCE(description,'')) LIKE ${like})`);
      }
      const where = conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``;

      const rows = await db.execute(sql`
        SELECT id, code, description, discount_type, discount_value, applies_to,
               min_purchase_kurus, max_uses, max_uses_per_user, total_used_count,
               valid_from, valid_until, is_active, notes, created_at
        FROM coupons
        ${where}
        ORDER BY is_active DESC, created_at DESC
        LIMIT 200
      `);
      return res.json({ coupons: rows.rows ?? rows });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message });
    }
  },
);

// ─── ADMIN: Detay + redemptions ─────────────────────────────────────────
router.get(
  "/admin/coupons/:id",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id ?? "", 10);
      if (!id) return res.status(400).json({ error: "id geçersiz" });
      const cRows = await db.execute(sql`SELECT * FROM coupons WHERE id = ${id} LIMIT 1`);
      const coupon = (cRows.rows ?? cRows)[0];
      if (!coupon) return res.status(404).json({ error: "bulunamadı" });
      const rRows = await db.execute(sql`
        SELECT id, user_id, source_type, source_id, buyer_email,
               original_amount_kurus, discount_kurus, final_amount_kurus, created_at
        FROM coupon_redemptions WHERE coupon_id = ${id}
        ORDER BY created_at DESC LIMIT 100
      `);
      return res.json({ coupon, redemptions: rRows.rows ?? rRows });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message });
    }
  },
);

// ─── ADMIN: Yeni kupon ──────────────────────────────────────────────────
router.post(
  "/admin/coupons",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const {
        code, description,
        discountType, discountValue,
        appliesTo, minPurchaseKurus,
        maxUses, maxUsesPerUser,
        validFrom, validUntil,
        notes,
      } = (req.body ?? {}) as any;

      const normCode = normalizeCode(String(code ?? ""));
      if (!normCode || normCode.length < 3) return res.status(400).json({ error: "Kod en az 3 karakter" });
      if (!["percentage", "fixed"].includes(discountType)) return res.status(400).json({ error: "discountType: percentage|fixed" });
      if (discountValue == null || Number(discountValue) <= 0) return res.status(400).json({ error: "discountValue > 0 olmalı" });

      const adminId = req.userId;
      const appliesArr = Array.isArray(appliesTo) && appliesTo.length > 0 ? appliesTo : ["subscription_all", "ebook"];

      const inserted = await db.execute(sql`
        INSERT INTO coupons (
          code, description, discount_type, discount_value, applies_to,
          min_purchase_kurus, max_uses, max_uses_per_user,
          valid_from, valid_until, is_active, created_by, notes
        ) VALUES (
          ${normCode}, ${description ?? null}, ${discountType}, ${Number(discountValue)},
          ${appliesArr}::TEXT[],
          ${minPurchaseKurus ?? 0}, ${maxUses ?? null}, ${maxUsesPerUser ?? 1},
          ${validFrom ?? new Date().toISOString()}, ${validUntil ?? null},
          TRUE, ${adminId ?? null}, ${notes ?? null}
        )
        RETURNING id, code
      `);
      return res.json({ ok: true, coupon: (inserted.rows ?? inserted)[0] });
    } catch (e: any) {
      if (e?.message?.includes("duplicate") || e?.code === "23505") {
        return res.status(409).json({ error: "Bu kod zaten kullanımda" });
      }
      console.error("[admin/coupons POST]", e?.message);
      return res.status(500).json({ error: e?.message });
    }
  },
);

// ─── ADMIN: Güncelle ────────────────────────────────────────────────────
router.patch(
  "/admin/coupons/:id",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id ?? "", 10);
      if (!id) return res.status(400).json({ error: "id geçersiz" });
      const body = (req.body ?? {}) as any;
      const sets: any[] = [];
      if (body.description !== undefined) sets.push(sql`description = ${body.description}`);
      if (body.discountValue !== undefined) sets.push(sql`discount_value = ${Number(body.discountValue)}`);
      if (body.appliesTo !== undefined && Array.isArray(body.appliesTo))
        sets.push(sql`applies_to = ${body.appliesTo}::TEXT[]`);
      if (body.minPurchaseKurus !== undefined) sets.push(sql`min_purchase_kurus = ${Number(body.minPurchaseKurus)}`);
      if (body.maxUses !== undefined) sets.push(sql`max_uses = ${body.maxUses === null ? null : Number(body.maxUses)}`);
      if (body.maxUsesPerUser !== undefined) sets.push(sql`max_uses_per_user = ${Number(body.maxUsesPerUser)}`);
      if (body.validUntil !== undefined) sets.push(sql`valid_until = ${body.validUntil}`);
      if (body.isActive !== undefined) sets.push(sql`is_active = ${!!body.isActive}`);
      if (body.notes !== undefined) sets.push(sql`notes = ${body.notes}`);
      if (sets.length === 0) return res.status(400).json({ error: "Güncellenecek alan yok" });
      sets.push(sql`updated_at = NOW()`);

      await db.execute(sql`UPDATE coupons SET ${sql.join(sets, sql`, `)} WHERE id = ${id}`);
      return res.json({ ok: true });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message });
    }
  },
);

// ─── ADMIN: Toggle aktif/pasif ──────────────────────────────────────────
router.post(
  "/admin/coupons/:id/toggle",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id ?? "", 10);
      if (!id) return res.status(400).json({ error: "id geçersiz" });
      await db.execute(sql`
        UPDATE coupons SET is_active = NOT is_active, updated_at = NOW() WHERE id = ${id}
      `);
      return res.json({ ok: true });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message });
    }
  },
);

export default router;
