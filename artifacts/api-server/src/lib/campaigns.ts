/**
 * Kampanyalar — veritabanı katmanı + teklif (quote) hesabı.
 * Fiyat hesabının tek doğruluk kaynağı burasıdır: www ödeme başlatırken buradan teklif alır.
 */

import { pool } from "@workspace/db";
import { computeQuote, type Campaign, type CartLine, type Quote, type CategoryGroup } from "./campaign-engine.js";
import { validateCode } from "./coupon.js";

export function rowToCampaign(r: any): Campaign {
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    scope: r.scope,
    targetEbookIds: (r.target_ebook_ids ?? []).map(Number),
    targetCategories: (r.target_categories ?? []) as CategoryGroup[],
    targetCourseSlugs: r.target_course_slugs ?? [],
    params: r.params ?? {},
    badgeText: r.badge_text ?? null,
    startsAt: r.starts_at ? new Date(r.starts_at) : null,
    endsAt: r.ends_at ? new Date(r.ends_at) : null,
    isActive: !!r.is_active,
    priority: Number(r.priority ?? 0),
  };
}

export async function loadActiveCampaigns(): Promise<Campaign[]> {
  const r = await pool.query(
    `SELECT * FROM campaigns
     WHERE is_active = TRUE AND (starts_at IS NULL OR starts_at <= NOW()) AND (ends_at IS NULL OR ends_at >= NOW())
     ORDER BY priority DESC, id`,
  );
  return r.rows.map(rowToCampaign);
}

export type QuoteItemInput = { type: "ebook" | "bundle" | "course"; slug: string };

/** Sepet kalemlerini güncel fiyatlarıyla çözer. Bulunamayan kalem için hata döner. */
export async function resolveLines(items: QuoteItemInput[]): Promise<{ lines: CartLine[] } | { error: string }> {
  const lines: CartLine[] = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const slug = String(it?.slug ?? "").trim();
    if (!slug) return { error: "Geçersiz ürün" };
    if (it.type === "ebook") {
      const r = (await pool.query(
        `SELECT id, slug, title, category, price_try FROM ebooks WHERE slug = $1 AND is_active = TRUE LIMIT 1`, [slug],
      )).rows[0];
      if (!r) return { error: `Kitap bulunamadı: ${slug}` };
      lines.push({ key: `ebook:${r.id}:${i}`, kind: "ebook", refId: r.id, slug: r.slug, title: r.title, category: r.category, unitKurus: Math.round(Number(r.price_try) * 100) });
    } else if (it.type === "bundle") {
      const r = (await pool.query(
        `SELECT id, slug, title, price_try FROM ebook_bundles WHERE slug = $1 AND is_active = TRUE LIMIT 1`, [slug],
      )).rows[0];
      if (!r) return { error: `Paket bulunamadı: ${slug}` };
      lines.push({ key: `bundle:${r.id}:${i}`, kind: "bundle", refId: r.id, slug: r.slug, title: r.title, category: null, unitKurus: Math.round(Number(r.price_try) * 100) });
    } else if (it.type === "course") {
      const r = (await pool.query(
        `SELECT id, slug, title, price_kurus FROM marketing_courses WHERE (slug = $1 OR level_slug = $1) AND is_active = TRUE LIMIT 1`, [slug],
      )).rows[0];
      if (!r) return { error: `Kurs bulunamadı: ${slug}` };
      lines.push({ key: `course:${r.id}:${i}`, kind: "course", refId: r.id, slug: r.slug, title: r.title, category: null, unitKurus: Number(r.price_kurus) });
    } else {
      return { error: "Geçersiz ürün türü" };
    }
  }
  return { lines };
}

/**
 * Sepet için teklif. Kupon verilirse süreli indirimler sonrası tutar üzerinden doğrulanır ve
 * sepet kampanyasıyla karşılaştırılır; müşteri için hangisi iyiyse o uygulanır.
 * Kuponlar şimdilik yalnızca e-kitap sepetinde geçerli.
 */
export async function quoteCart(
  items: QuoteItemInput[],
  couponCode?: string | null,
  now = new Date(),
): Promise<{ quote: Quote; couponError?: string; affiliateCode?: string } | { error: string }> {
  if (!Array.isArray(items) || items.length === 0) return { error: "Sepet boş" };
  if (items.length > 20) return { error: "Sepette en fazla 20 ürün olabilir" };
  const resolved = await resolveLines(items);
  if ("error" in resolved) return resolved;
  const campaigns = await loadActiveCampaigns();

  // Önce kuponsuz hesapla: kupon, süreli indirimler sonrası tutara uygulanır
  const base = computeQuote(resolved.lines, campaigns, now, null);
  let coupon: { id: number; code: string; discountKurus: number } | null = null;
  let couponError: string | undefined;
  let affiliateCode: string | undefined;

  if (couponCode && String(couponCode).trim()) {
    if (resolved.lines.some((l) => l.kind === "course")) {
      couponError = "Kupon kodları şu an yalnızca e-kitaplarda geçerli";
    } else {
      const v = await validateCode({ code: String(couponCode), amountKurus: base.saleKurus, scope: "ebook" });
      if (!v.ok) couponError = v.error ?? "Kupon geçersiz";
      else if (v.type === "coupon" && v.couponId && v.code) coupon = { id: v.couponId, code: v.code, discountKurus: v.discountKurus ?? 0 };
      else if (v.type === "affiliate") affiliateCode = v.affiliateCode;
    }
  }
  const quote = coupon ? computeQuote(resolved.lines, campaigns, now, coupon) : base;
  return { quote, couponError, affiliateCode };
}

/** Herkese açık kampanya özeti (site rozetleri ve ana sayfa banner'ı için) */
export function publicCampaign(c: Campaign & { description?: string | null; showOnHome?: boolean }) {
  return {
    id: c.id, name: c.name, type: c.type, scope: c.scope,
    targetEbookIds: c.targetEbookIds, targetCategories: c.targetCategories, targetCourseSlugs: c.targetCourseSlugs,
    params: c.params, badgeText: c.badgeText, description: c.description ?? null,
    endsAt: c.endsAt, showOnHome: !!c.showOnHome,
  };
}
