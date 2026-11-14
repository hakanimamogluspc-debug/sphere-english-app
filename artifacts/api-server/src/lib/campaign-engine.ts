/**
 * Kampanya motoru — saf fonksiyonlar (veritabanına dokunmaz, test edilebilir).
 *
 * Tipler:
 *   timed_discount   Süreli ürün/kategori indirimi. Ürün fiyatını düşürür (sitede üstü çizili fiyat).
 *                    params: { discountType: 'percentage'|'fixed', value }
 *   buy_x_pay_y      X al Y öde. Uygun kitaplar ucuzdan pahalıya dizilir; her X kitapta en ucuz (X−Y) bedava.
 *                    params: { buy, pay }
 *   cart_threshold   Sepet tutarı eşiği. Uygun ürünlerin toplamı eşiği geçerse indirim.
 *                    params: { minKurus, discountType, value }
 *   tiered_quantity  Kademeli adet indirimi. Uygun kitap sayısına göre en yüksek kademe.
 *                    params: { tiers: [{ minQty, percent }] }
 *
 * Kurallar:
 *   1. Süreli indirimler önce fiyata uygulanır (her ürüne en iyi tek süreli indirim).
 *   2. Sepet kampanyalarından (buy_x_pay_y, cart_threshold, tiered_quantity) müşteriye en çok
 *      kazandıran TEK kampanya seçilir.
 *   3. Kupon kodu ile sepet kampanyası birleşmez: hangisi daha çok indirim sağlıyorsa o uygulanır.
 *   4. Paketler (bundle) zaten indirimli: yalnızca sepet tutarı eşiğine katkı sağlar.
 *   5. Hiçbir satır 1 TL'nin altına inmez (iyzico 0 TL'lik kalem kabul etmez).
 */

export type CampaignType = "timed_discount" | "buy_x_pay_y" | "cart_threshold" | "tiered_quantity";
export type CampaignScope = "ebook" | "course" | "all";
export type CategoryGroup = "seri" | "beceri" | "sektorel";

export interface Campaign {
  id: number;
  name: string;
  type: CampaignType;
  scope: CampaignScope;
  targetEbookIds: number[];
  targetCategories: CategoryGroup[];
  targetCourseSlugs: string[];
  params: Record<string, any>;
  badgeText: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
  priority: number;
}

export interface CartLine {
  key: string;
  kind: "ebook" | "bundle" | "course";
  refId: number;
  slug: string;
  title: string;
  category: string | null;
  unitKurus: number;
}

export interface QuotedLine extends CartLine {
  saleKurus: number;              // süreli indirim sonrası birim fiyat
  timedCampaignId: number | null;
  finalKurus: number;             // tüm indirimler dağıtıldıktan sonra ödenecek
}

export interface Quote {
  lines: QuotedLine[];
  listKurus: number;              // indirimsiz toplam
  saleKurus: number;              // süreli indirimler sonrası
  cartCampaign: { id: number; name: string; discountKurus: number } | null;
  coupon: { id: number; code: string; discountKurus: number } | null;
  applied: "campaign" | "coupon" | null;   // sepet kampanyası mı kupon mu uygulandı
  couponNote: string | null;      // kupon girildi ama kampanya daha avantajlıysa açıklama
  totalDiscountKurus: number;
  finalKurus: number;
}

export const MIN_LINE_KURUS = 100;

export function categoryGroup(category: string | null): CategoryGroup {
  const c = (category ?? "").toLocaleLowerCase("tr-TR");
  if (c.includes("sektör") || c.includes("sektor")) return "sektorel";
  if (c.includes("beceri")) return "beceri";
  return "seri";
}

export function isLive(c: Campaign, now: Date): boolean {
  if (!c.isActive) return false;
  if (c.startsAt && c.startsAt > now) return false;
  if (c.endsAt && c.endsAt < now) return false;
  return true;
}

/** Satır bu kampanyanın kapsamında mı? */
export function eligible(line: CartLine, c: Campaign): boolean {
  if (line.kind === "course") {
    if (c.scope === "ebook") return false;
    return c.targetCourseSlugs.length === 0 || c.targetCourseSlugs.includes(line.slug);
  }
  if (c.scope === "course") return false;
  if (line.kind === "bundle") return c.type === "cart_threshold";
  const noTarget = c.targetEbookIds.length === 0 && c.targetCategories.length === 0;
  return noTarget || c.targetEbookIds.includes(line.refId) || c.targetCategories.includes(categoryGroup(line.category));
}

function pctOrFixed(amount: number, type: unknown, value: unknown): number {
  const v = Number(value) || 0;
  if (type === "fixed") return Math.min(amount, Math.round(v * 100));
  return Math.floor((amount * Math.min(100, Math.max(0, v))) / 100);
}

/** Sepet kampanyasının bu satırlarda sağlayacağı indirim (kuruş) */
export function cartCampaignDiscount(c: Campaign, lines: QuotedLine[]): number {
  const el = lines.filter((l) => eligible(l, c));
  const p = c.params ?? {};
  if (c.type === "buy_x_pay_y") {
    const buy = Math.floor(Number(p.buy)), pay = Math.floor(Number(p.pay));
    if (!(buy >= 2 && pay >= 1 && pay < buy)) return 0;
    const books = el.filter((l) => l.kind === "ebook").map((l) => l.saleKurus).sort((a, b) => a - b);
    const free = Math.floor(books.length / buy) * (buy - pay);
    return books.slice(0, free).reduce((s, x) => s + x, 0);
  }
  if (c.type === "cart_threshold") {
    const base = el.reduce((s, l) => s + l.saleKurus, 0);
    if (base < Math.round(Number(p.minKurus) || 0) || base === 0) return 0;
    return pctOrFixed(base, p.discountType, p.value);
  }
  if (c.type === "tiered_quantity") {
    const books = el.filter((l) => l.kind === "ebook");
    const tiers = Array.isArray(p.tiers) ? p.tiers : [];
    const tier = tiers
      .filter((t: any) => books.length >= Number(t.minQty))
      .sort((a: any, b: any) => Number(b.minQty) - Number(a.minQty))[0];
    if (!tier) return 0;
    return pctOrFixed(books.reduce((s, l) => s + l.saleKurus, 0), "percentage", tier.percent);
  }
  return 0;
}

/** İndirimi satırlara orantılı dağıt (iyzico kalem toplamı = ödenecek tutar olmalı) */
export function distribute(lines: QuotedLine[], discount: number): void {
  const total = lines.reduce((s, l) => s + l.saleKurus, 0);
  const maxDiscount = Math.max(0, total - lines.length * MIN_LINE_KURUS);
  let d = Math.min(discount, maxDiscount);
  let acc = 0;
  lines.forEach((l, i) => {
    if (i === lines.length - 1) {
      l.finalKurus = l.saleKurus - (d - acc);
    } else {
      const part = total > 0 ? Math.floor((d * l.saleKurus) / total) : 0;
      l.finalKurus = l.saleKurus - part;
      acc += part;
    }
  });
  // Bir satır alt sınırın altına düştüyse farkı diğerlerinden telafi et
  for (const l of lines) {
    if (l.finalKurus < MIN_LINE_KURUS) {
      let need = MIN_LINE_KURUS - l.finalKurus;
      l.finalKurus = MIN_LINE_KURUS;
      for (const o of lines) {
        if (need <= 0) break;
        const room = o.finalKurus - MIN_LINE_KURUS;
        if (o !== l && room > 0) { const t = Math.min(room, need); o.finalKurus -= t; need -= t; }
      }
    }
  }
}

/**
 * Teklif hesabı.
 * @param coupon  Kupon doğrulaması yapıldıysa sonucu: indirim, satış toplamı üzerinden hesaplanmış olmalı
 *                (bkz. lib/campaigns.ts — kupon indirimi süreli indirimler sonrası tutara göre hesaplanır).
 */
export function computeQuote(
  input: CartLine[],
  campaigns: Campaign[],
  now: Date,
  coupon?: { id: number; code: string; discountKurus: number } | null,
): Quote {
  const live = campaigns.filter((c) => isLive(c, now));
  const timed = live.filter((c) => c.type === "timed_discount");
  const cartLevel = live.filter((c) => c.type !== "timed_discount");

  const lines: QuotedLine[] = input.map((l) => {
    let best = 0, bestId: number | null = null;
    for (const c of timed) {
      if (!eligible(l, c) || l.kind === "bundle") continue;
      const d = Math.min(pctOrFixed(l.unitKurus, c.params?.discountType, c.params?.value), l.unitKurus - MIN_LINE_KURUS);
      if (d > best || (d === best && d > 0 && bestId !== null && c.priority > (timed.find((x) => x.id === bestId)?.priority ?? 0))) {
        best = d; bestId = c.id;
      }
    }
    const sale = l.unitKurus - Math.max(0, best);
    return { ...l, saleKurus: sale, timedCampaignId: best > 0 ? bestId : null, finalKurus: sale };
  });

  let cartCampaign: Quote["cartCampaign"] = null;
  for (const c of cartLevel) {
    const d = cartCampaignDiscount(c, lines);
    if (d > 0 && (!cartCampaign || d > cartCampaign.discountKurus ||
        (d === cartCampaign.discountKurus && c.priority > (cartLevel.find((x) => x.id === cartCampaign!.id)?.priority ?? 0)))) {
      cartCampaign = { id: c.id, name: c.name, discountKurus: d };
    }
  }

  const listKurus = lines.reduce((s, l) => s + l.unitKurus, 0);
  const saleKurus = lines.reduce((s, l) => s + l.saleKurus, 0);
  const couponD = coupon && coupon.discountKurus > 0 ? coupon.discountKurus : 0;
  const campD = cartCampaign?.discountKurus ?? 0;

  let applied: Quote["applied"] = null;
  let couponNote: string | null = null;
  let discount = 0;
  if (couponD > campD) {
    applied = "coupon"; discount = couponD;
    if (cartCampaign) couponNote = `Kuponunuz "${cartCampaign.name}" kampanyasından daha avantajlı olduğu için kupon uygulandı.`;
  } else if (campD > 0) {
    applied = "campaign"; discount = campD;
    if (couponD > 0) couponNote = `"${cartCampaign!.name}" kampanyası kuponunuzdan daha avantajlı olduğu için kampanya uygulandı.`;
  }

  distribute(lines, discount);
  const finalKurus = lines.reduce((s, l) => s + l.finalKurus, 0);
  return {
    lines,
    listKurus,
    saleKurus,
    cartCampaign: applied === "campaign" ? cartCampaign : null,
    coupon: applied === "coupon" && coupon ? coupon : null,
    applied,
    couponNote,
    totalDiscountKurus: listKurus - finalKurus,
    finalKurus,
  };
}

/** Admin girdisini doğrula; hata mesajı ya da null */
export function validateCampaignParams(type: string, p: any): string | null {
  const num = (v: unknown) => Number(v);
  if (type === "timed_discount") {
    if (!["percentage", "fixed"].includes(p?.discountType)) return "İndirim türü seçin (yüzde ya da tutar)";
    if (!(num(p.value) > 0)) return "İndirim değeri 0'dan büyük olmalı";
    if (p.discountType === "percentage" && num(p.value) >= 100) return "Yüzde indirim 100'den küçük olmalı";
    return null;
  }
  if (type === "buy_x_pay_y") {
    const buy = num(p?.buy), pay = num(p?.pay);
    if (!Number.isInteger(buy) || !Number.isInteger(pay) || buy < 2 || pay < 1 || pay >= buy) return "X al Y öde: X ≥ 2, 1 ≤ Y < X olmalı (ör. 3 al 2 öde)";
    return null;
  }
  if (type === "cart_threshold") {
    if (!(num(p?.minKurus) > 0)) return "Sepet eşiği 0'dan büyük olmalı";
    if (!["percentage", "fixed"].includes(p?.discountType)) return "İndirim türü seçin (yüzde ya da tutar)";
    if (!(num(p.value) > 0)) return "İndirim değeri 0'dan büyük olmalı";
    if (p.discountType === "percentage" && num(p.value) >= 100) return "Yüzde indirim 100'den küçük olmalı";
    if (p.discountType === "fixed" && num(p.value) * 100 >= num(p.minKurus)) return "Tutar indirimi sepet eşiğinden küçük olmalı";
    return null;
  }
  if (type === "tiered_quantity") {
    const tiers = Array.isArray(p?.tiers) ? p.tiers : [];
    if (tiers.length === 0) return "En az bir kademe ekleyin";
    for (const t of tiers) {
      if (!Number.isInteger(num(t.minQty)) || num(t.minQty) < 2) return "Kademe adedi en az 2 olmalı";
      if (!(num(t.percent) > 0 && num(t.percent) < 100)) return "Kademe yüzdesi 1–99 arası olmalı";
    }
    return null;
  }
  return "Kampanya türü geçersiz";
}
