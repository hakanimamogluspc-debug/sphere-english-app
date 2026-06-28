/**
 * Affiliate program çekirdek kütüphanesi.
 *
 * - Komisyon hesaplama (subscription %20 ilk + %10 yenileme x12, ebook %20)
 * - Kod doğrulama / lookup
 * - Subscription/Ebook activate sırasında attribution
 * - 14 günlük onay penceresi (refund window)
 */

import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

export const FIRST_PAYMENT_RATE = 0.20;
export const RENEWAL_RATE = 0.10;
export const RENEWAL_MAX_CYCLES = 12; // İlk dahil 12 fatura
export const EBOOK_RATE = 0.20;
export const APPROVAL_WINDOW_DAYS = 14;
export const MIN_PAYOUT_KURUS = 50000; // 500 TL

export type AffiliateStatus = "pending" | "active" | "suspended" | "rejected";
export type CommissionStatus = "pending" | "approved" | "paid" | "refunded" | "cancelled";

export interface AffiliateRow {
  id: number;
  user_id: number | null;
  code: string;
  status: AffiliateStatus;
  full_name: string;
  email: string;
}

/**
 * Affiliate kodunu normalize et (UPPER, alphanumeric).
 */
export function normalizeCode(code: string): string {
  return (code || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 40);
}

/**
 * Aktif affiliate'i koddan bul. Sadece "active" döner; pending/rejected null.
 */
export async function findActiveAffiliateByCode(code: string): Promise<AffiliateRow | null> {
  const c = normalizeCode(code);
  if (!c) return null;
  const rows = await db.execute(sql`
    SELECT id, user_id, code, status, full_name, email
    FROM affiliates
    WHERE code = ${c} AND status = 'active'
    LIMIT 1
  `);
  return ((rows.rows ?? rows)[0] as any) ?? null;
}

/**
 * Affiliate ID'den koda bak.
 */
export async function getAffiliateById(id: number): Promise<AffiliateRow | null> {
  const rows = await db.execute(sql`
    SELECT id, user_id, code, status, full_name, email
    FROM affiliates WHERE id = ${id} LIMIT 1
  `);
  return ((rows.rows ?? rows)[0] as any) ?? null;
}

/**
 * Unique kod üretici. Verilen base'i normalize eder, çakışırsa sayı ekler.
 */
export async function generateUniqueCode(base: string): Promise<string> {
  let candidate = normalizeCode(base) || "PARTNER";
  if (candidate.length < 4) candidate = candidate + "2026";

  for (let attempt = 0; attempt < 100; attempt++) {
    const tryCode = attempt === 0 ? candidate : `${candidate}${attempt}`;
    const rows = await db.execute(sql`
      SELECT id FROM affiliates WHERE code = ${tryCode} LIMIT 1
    `);
    if ((rows.rows ?? rows).length === 0) return tryCode;
  }
  // Çok düşük olasılık ama fallback
  return `${candidate}${Date.now().toString(36).toUpperCase()}`;
}

/**
 * Click kaydı oluştur. Self-referral kontrolü burada YAPILMAZ —
 * sadece tıklama izi. Conversion sırasında self-ref engellenir.
 */
export async function recordClick(opts: {
  affiliateId: number;
  landingPath?: string | null;
  referrer?: string | null;
  userAgent?: string | null;
  ipCountry?: string | null;
  utm?: { source?: string; medium?: string; campaign?: string };
  visitorId?: string | null;
}): Promise<void> {
  try {
    await db.execute(sql`
      INSERT INTO affiliate_clicks (
        affiliate_id, landing_path, referrer, user_agent, ip_country,
        utm_source, utm_medium, utm_campaign, visitor_id
      ) VALUES (
        ${opts.affiliateId}, ${opts.landingPath ?? null}, ${opts.referrer ?? null},
        ${opts.userAgent?.slice(0, 500) ?? null}, ${opts.ipCountry ?? null},
        ${opts.utm?.source ?? null}, ${opts.utm?.medium ?? null}, ${opts.utm?.campaign ?? null},
        ${opts.visitorId ?? null}
      )
    `);
    await db.execute(sql`
      UPDATE affiliates SET total_clicks = total_clicks + 1, updated_at = NOW()
      WHERE id = ${opts.affiliateId}
    `);
  } catch (e: any) {
    console.error("[affiliate] recordClick HATA:", e?.message);
  }
}

/**
 * Subscription aktivasyonu sonrası attribution + commission.
 * Aynı subscription için tekrar çağrılırsa idempotent (mevcut row varsa skip).
 *
 * @param subscriptionId  subscriptions.id
 * @param userId          customer user
 * @param amountKurus     ödenen tutar (kuruş cinsinden — TL * 100)
 * @param affiliateCode   varsa kod (cookie/body'den)
 */
export async function attributeSubscriptionSale(opts: {
  subscriptionId: number;
  userId: number;
  amountKurus: number;
  affiliateCode?: string | null;
}): Promise<{ attributed: boolean; commissionKurus?: number; affiliateId?: number }> {
  const { subscriptionId, userId, amountKurus, affiliateCode } = opts;

  if (!affiliateCode) return { attributed: false };
  const affiliate = await findActiveAffiliateByCode(affiliateCode);
  if (!affiliate) return { attributed: false };

  // Self-referral engelleme
  if (affiliate.user_id && affiliate.user_id === userId) {
    console.info(`[affiliate] self-referral engellendi: aff=${affiliate.id} user=${userId}`);
    return { attributed: false };
  }

  // Subscription'a affiliate_id yaz (varsa skip — attribution sadece bir kez)
  const upd = await db.execute(sql`
    UPDATE subscriptions
    SET affiliate_id = ${affiliate.id},
        affiliate_attributed_at = NOW()
    WHERE id = ${subscriptionId}
      AND affiliate_id IS NULL
    RETURNING id
  `);
  const didAttribute = ((upd.rows ?? upd).length ?? 0) > 0;
  if (!didAttribute) {
    // Zaten attribute edilmiş; yine de commission insert dene (yenileme olabilir)
  }

  // Bu subscription için kaçıncı fatura?
  const cycleRows = await db.execute(sql`
    SELECT COUNT(*)::int AS cycle FROM affiliate_commissions
    WHERE source_type = 'subscription' AND source_id = ${subscriptionId}
  `);
  const billingCycle = (((cycleRows.rows ?? cycleRows)[0] as any)?.cycle ?? 0) + 1;

  if (billingCycle > RENEWAL_MAX_CYCLES) {
    console.info(`[affiliate] sub=${subscriptionId} cycle=${billingCycle} > max, komisyon yok`);
    return { attributed: true, affiliateId: affiliate.id };
  }

  const rate = billingCycle === 1 ? FIRST_PAYMENT_RATE : RENEWAL_RATE;
  const commissionKurus = Math.floor(amountKurus * rate);

  if (commissionKurus <= 0) {
    return { attributed: true, affiliateId: affiliate.id };
  }

  await db.execute(sql`
    INSERT INTO affiliate_commissions (
      affiliate_id, source_type, source_id, customer_user_id,
      sale_amount_kurus, commission_rate, commission_kurus, billing_cycle,
      status
    ) VALUES (
      ${affiliate.id}, 'subscription', ${subscriptionId}, ${userId},
      ${amountKurus}, ${rate.toFixed(4)}, ${commissionKurus}, ${billingCycle},
      'pending'
    )
  `);

  await db.execute(sql`
    UPDATE affiliates
    SET total_conversions = total_conversions + ${billingCycle === 1 ? 1 : 0},
        total_earned_kurus = total_earned_kurus + ${commissionKurus},
        updated_at = NOW()
    WHERE id = ${affiliate.id}
  `);

  console.info(
    `[affiliate] commission: aff=${affiliate.id} sub=${subscriptionId} cycle=${billingCycle} rate=${rate} kurus=${commissionKurus}`,
  );
  return { attributed: true, commissionKurus, affiliateId: affiliate.id };
}

/**
 * E-kitap satışı için attribution + commission.
 */
export async function attributeEbookSale(opts: {
  purchaseId: number;
  userId?: number | null;
  amountKurus: number;
  affiliateCode?: string | null;
}): Promise<{ attributed: boolean; commissionKurus?: number; affiliateId?: number }> {
  const { purchaseId, userId, amountKurus, affiliateCode } = opts;
  if (!affiliateCode) return { attributed: false };
  const affiliate = await findActiveAffiliateByCode(affiliateCode);
  if (!affiliate) return { attributed: false };

  if (affiliate.user_id && userId && affiliate.user_id === userId) {
    console.info(`[affiliate] ebook self-referral engellendi: aff=${affiliate.id} user=${userId}`);
    return { attributed: false };
  }

  // Idempotency: aynı purchase için zaten commission varsa skip
  const existRows = await db.execute(sql`
    SELECT id FROM affiliate_commissions
    WHERE source_type = 'ebook' AND source_id = ${purchaseId}
    LIMIT 1
  `);
  if ((existRows.rows ?? existRows).length > 0) {
    return { attributed: true, affiliateId: affiliate.id };
  }

  await db.execute(sql`
    UPDATE ebook_purchases
    SET affiliate_id = ${affiliate.id},
        affiliate_attributed_at = NOW()
    WHERE id = ${purchaseId} AND affiliate_id IS NULL
  `);

  const commissionKurus = Math.floor(amountKurus * EBOOK_RATE);
  if (commissionKurus <= 0) return { attributed: true, affiliateId: affiliate.id };

  await db.execute(sql`
    INSERT INTO affiliate_commissions (
      affiliate_id, source_type, source_id, customer_user_id,
      sale_amount_kurus, commission_rate, commission_kurus, billing_cycle,
      status
    ) VALUES (
      ${affiliate.id}, 'ebook', ${purchaseId}, ${userId ?? null},
      ${amountKurus}, ${EBOOK_RATE.toFixed(4)}, ${commissionKurus}, 1,
      'pending'
    )
  `);
  await db.execute(sql`
    UPDATE affiliates
    SET total_conversions = total_conversions + 1,
        total_earned_kurus = total_earned_kurus + ${commissionKurus},
        updated_at = NOW()
    WHERE id = ${affiliate.id}
  `);

  console.info(
    `[affiliate] ebook commission: aff=${affiliate.id} purchase=${purchaseId} kurus=${commissionKurus}`,
  );
  return { attributed: true, commissionKurus, affiliateId: affiliate.id };
}

/**
 * 14 günü dolmuş 'pending' komisyonları 'approved' yap.
 * Bu fonksiyon cron veya admin endpoint'inden çağrılır.
 */
export async function approveMaturedCommissions(): Promise<{ approved: number }> {
  const res = await db.execute(sql`
    UPDATE affiliate_commissions
    SET status = 'approved', approved_at = NOW()
    WHERE status = 'pending'
      AND created_at <= NOW() - INTERVAL '${sql.raw(String(APPROVAL_WINDOW_DAYS))} days'
    RETURNING id
  `);
  const approved = (res.rows ?? res).length;
  if (approved > 0) {
    console.info(`[affiliate] ${approved} komisyon onaylandı (14 gün geçti)`);
  }
  return { approved };
}

/**
 * Bir komisyonu refund yap (Iyzico refund'da çağrılır).
 */
export async function refundCommission(opts: {
  sourceType: "subscription" | "ebook";
  sourceId: number;
  reason?: string;
}): Promise<{ refunded: number }> {
  const res = await db.execute(sql`
    UPDATE affiliate_commissions
    SET status = 'refunded',
        refunded_at = NOW(),
        refund_reason = ${opts.reason ?? "Iyzico refund"}
    WHERE source_type = ${opts.sourceType}
      AND source_id = ${opts.sourceId}
      AND status IN ('pending', 'approved')
    RETURNING affiliate_id, commission_kurus
  `);
  const rows = (res.rows ?? res) as any[];
  for (const r of rows) {
    await db.execute(sql`
      UPDATE affiliates
      SET total_earned_kurus = GREATEST(0, total_earned_kurus - ${r.commission_kurus}),
          updated_at = NOW()
      WHERE id = ${r.affiliate_id}
    `);
  }
  return { refunded: rows.length };
}

/**
 * Affiliate'in dashboard istatistikleri.
 */
export async function getAffiliateStats(affiliateId: number) {
  const rows = await db.execute(sql`
    SELECT
      a.total_clicks, a.total_conversions, a.total_earned_kurus, a.total_paid_kurus,
      COALESCE((
        SELECT SUM(commission_kurus) FROM affiliate_commissions
        WHERE affiliate_id = a.id AND status = 'pending'
      )::BIGINT, 0) AS pending_kurus,
      COALESCE((
        SELECT SUM(commission_kurus) FROM affiliate_commissions
        WHERE affiliate_id = a.id AND status = 'approved'
      )::BIGINT, 0) AS approved_kurus,
      COALESCE((
        SELECT SUM(commission_kurus) FROM affiliate_commissions
        WHERE affiliate_id = a.id AND status = 'paid'
      )::BIGINT, 0) AS paid_kurus,
      COALESCE((
        SELECT COUNT(*) FROM affiliate_clicks
        WHERE affiliate_id = a.id AND created_at >= NOW() - INTERVAL '30 days'
      )::INT, 0) AS clicks_30d,
      COALESCE((
        SELECT COUNT(DISTINCT customer_user_id) FROM affiliate_commissions
        WHERE affiliate_id = a.id AND billing_cycle = 1 AND created_at >= NOW() - INTERVAL '30 days'
      )::INT, 0) AS conversions_30d
    FROM affiliates a
    WHERE a.id = ${affiliateId}
  `);
  return ((rows.rows ?? rows)[0] as any) ?? null;
}
