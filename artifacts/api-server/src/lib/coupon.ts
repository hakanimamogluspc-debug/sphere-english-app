/**
 * Coupon (indirim kuponu) çekirdek lib.
 *
 * Schema:
 *   coupons.applies_to[]: 'subscription_all' | 'subscription_yearly' | 'ebook' | 'subscription_monthly'
 *
 * Discount tipler:
 *   - percentage: discount_value % (0-100)
 *   - fixed: discount_value TL (kuruşa çevrilir)
 *
 * Source tipleri:
 *   - subscription | ebook
 */

import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

export type DiscountType = "percentage" | "fixed";
export type CouponAppliesTo = "subscription_all" | "subscription_yearly" | "subscription_monthly" | "ebook";

export interface CouponRow {
  id: number;
  code: string;
  description: string | null;
  discount_type: DiscountType;
  discount_value: string | number;
  applies_to: string[];
  min_purchase_kurus: number;
  max_uses: number | null;
  max_uses_per_user: number;
  total_used_count: number;
  valid_from: string;
  valid_until: string | null;
  is_active: boolean;
}

export interface ValidationResult {
  ok: boolean;
  type: "coupon" | "affiliate" | "none";
  message?: string;
  error?: string;
  // İndirim varsa
  couponId?: number;
  code?: string;
  discountKurus?: number;
  finalAmountKurus?: number;
  description?: string;
  // Affiliate ise
  affiliateCode?: string;
  partnerName?: string;
}

export function normalizeCode(code: string): string {
  return (code || "").toUpperCase().replace(/[^A-Z0-9-_]/g, "").slice(0, 40);
}

/**
 * Hybrid kod doğrulama.
 *
 * 1. Önce coupons tablosunda ara (gerçek indirim)
 * 2. Yoksa affiliates tablosunda ara (partner tracking, kullanıcıya indirim yok)
 * 3. Hiçbiri yoksa hata
 */
export async function validateCode(opts: {
  code: string;
  amountKurus: number;
  scope: "subscription_monthly" | "subscription_yearly" | "ebook";
  userId?: number | null;
}): Promise<ValidationResult> {
  const code = normalizeCode(opts.code);
  if (!code || code.length < 3) {
    return { ok: false, type: "none", error: "Kod en az 3 karakter olmalı" };
  }

  // ── 1) Coupon tablosunda ara ──
  const cRows = await db.execute(sql`
    SELECT * FROM coupons WHERE code = ${code} LIMIT 1
  `);
  const coupon = ((cRows.rows ?? cRows)[0] as any) as CouponRow | undefined;

  if (coupon) {
    if (!coupon.is_active) return { ok: false, type: "coupon", error: "Bu kupon devre dışı" };
    const now = new Date();
    if (coupon.valid_until && new Date(coupon.valid_until) < now) {
      return { ok: false, type: "coupon", error: "Bu kuponun süresi dolmuş" };
    }
    if (coupon.valid_from && new Date(coupon.valid_from) > now) {
      return { ok: false, type: "coupon", error: "Bu kupon henüz aktif değil" };
    }
    if (coupon.max_uses !== null && coupon.total_used_count >= coupon.max_uses) {
      return { ok: false, type: "coupon", error: "Bu kuponun toplam kullanım sınırı dolmuş" };
    }
    if (coupon.min_purchase_kurus > 0 && opts.amountKurus < coupon.min_purchase_kurus) {
      const minTl = (Number(coupon.min_purchase_kurus) / 100).toLocaleString("tr-TR");
      return { ok: false, type: "coupon", error: `Bu kupon için minimum ${minTl} TL alışveriş gerekli` };
    }
    // Kapsam kontrolü
    const applies = coupon.applies_to ?? [];
    const scopeMatch =
      applies.includes(opts.scope) ||
      (opts.scope.startsWith("subscription") && applies.includes("subscription_all"));
    if (!scopeMatch) {
      return {
        ok: false,
        type: "coupon",
        error:
          opts.scope === "ebook"
            ? "Bu kupon e-kitaplarda geçerli değil"
            : opts.scope === "subscription_monthly"
            ? "Bu kupon sadece yıllık aboneliklerde geçerli"
            : "Bu kupon abonelikte geçerli değil",
      };
    }
    // Per-user limit
    if (opts.userId && coupon.max_uses_per_user > 0) {
      const usedRows = await db.execute(sql`
        SELECT COUNT(*)::INT AS cnt FROM coupon_redemptions
        WHERE coupon_id = ${coupon.id} AND user_id = ${opts.userId}
      `);
      const used = ((usedRows.rows ?? usedRows)[0] as any)?.cnt ?? 0;
      if (used >= coupon.max_uses_per_user) {
        return { ok: false, type: "coupon", error: "Bu kuponu zaten kullandınız" };
      }
    }
    // İndirim hesabı
    const discountKurus = calculateDiscount(opts.amountKurus, coupon.discount_type, Number(coupon.discount_value));
    const finalAmountKurus = Math.max(0, opts.amountKurus - discountKurus);

    return {
      ok: true,
      type: "coupon",
      couponId: coupon.id,
      code: coupon.code,
      discountKurus,
      finalAmountKurus,
      description: coupon.description ?? undefined,
      message: `Kupon uygulandı: ${formatTL(discountKurus)} indirim`,
    };
  }

  // ── 2) Affiliate kodu mu? ──
  const aRows = await db.execute(sql`
    SELECT id, code, full_name FROM affiliates
    WHERE code = ${code} AND status = 'active' LIMIT 1
  `);
  const aff = ((aRows.rows ?? aRows)[0] as any);

  if (aff) {
    return {
      ok: true,
      type: "affiliate",
      affiliateCode: aff.code,
      partnerName: aff.full_name,
      message: `Partner kodu uygulandı (${aff.full_name})`,
      // Kullanıcıya indirim yok; partnere komisyon
      discountKurus: 0,
      finalAmountKurus: opts.amountKurus,
    };
  }

  return { ok: false, type: "none", error: "Geçersiz kod" };
}

export function calculateDiscount(
  amountKurus: number,
  type: DiscountType,
  value: number,
): number {
  if (type === "percentage") {
    const pct = Math.min(100, Math.max(0, value));
    return Math.floor((amountKurus * pct) / 100);
  }
  // fixed (TL)
  return Math.min(amountKurus, Math.floor(value * 100));
}

export function formatTL(kurus: number): string {
  return (kurus / 100).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + " TL";
}

/**
 * Coupon kullanım kaydı (redemption) oluştur + total_used_count artır.
 * Activate akışında çağrılır.
 */
export async function recordRedemption(opts: {
  couponId: number;
  userId?: number | null;
  sourceType: "subscription" | "ebook";
  sourceId?: number | null;
  buyerEmail?: string | null;
  originalAmountKurus: number;
  discountKurus: number;
  finalAmountKurus: number;
  conversationId?: string | null;
}): Promise<void> {
  await db.execute(sql`
    INSERT INTO coupon_redemptions (
      coupon_id, user_id, source_type, source_id, buyer_email,
      original_amount_kurus, discount_kurus, final_amount_kurus, conversation_id
    ) VALUES (
      ${opts.couponId}, ${opts.userId ?? null}, ${opts.sourceType}, ${opts.sourceId ?? null}, ${opts.buyerEmail ?? null},
      ${opts.originalAmountKurus}, ${opts.discountKurus}, ${opts.finalAmountKurus}, ${opts.conversationId ?? null}
    )
  `);
  await db.execute(sql`
    UPDATE coupons SET total_used_count = total_used_count + 1, updated_at = NOW()
    WHERE id = ${opts.couponId}
  `);
}
