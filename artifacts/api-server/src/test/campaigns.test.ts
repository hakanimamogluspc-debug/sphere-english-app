import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { pool } from "@workspace/db";
import { api, resetDb, closeDb, createAdmin } from "./helpers.js";
import { computeQuote, validateCampaignParams, type Campaign, type CartLine } from "../lib/campaign-engine.js";

const now = new Date("2026-11-14T12:00:00Z");
const book = (id: number, tl: number, category: string | null = null): CartLine =>
  ({ key: `e${id}`, kind: "ebook", refId: id, slug: `k${id}`, title: `Kitap ${id}`, category, unitKurus: tl * 100 });
const camp = (over: Partial<Campaign>): Campaign => ({
  id: 1, name: "K", type: "buy_x_pay_y", scope: "ebook", targetEbookIds: [], targetCategories: [], targetCourseSlugs: [],
  params: {}, badgeText: null, startsAt: null, endsAt: null, isActive: true, priority: 0, ...over,
});
const sum = (q: { lines: { finalKurus: number }[] }) => q.lines.reduce((s, l) => s + l.finalKurus, 0);

describe("kampanya motoru", () => {
  it("3 al 2 öde: en ucuz kitap bedava; satır toplamı = ödenecek tutar", () => {
    const q = computeQuote([book(1, 399), book(2, 499), book(3, 599)], [camp({ params: { buy: 3, pay: 2 } })], now);
    expect(q.cartCampaign?.discountKurus).toBe(39900);
    expect(q.finalKurus).toBe((399 + 499 + 599 - 399) * 100);
    expect(sum(q)).toBe(q.finalKurus);
    expect(q.lines.every((l) => l.finalKurus >= 100)).toBe(true);
    // 2 kitapta uygulanmaz
    expect(computeQuote([book(1, 399), book(2, 499)], [camp({ params: { buy: 3, pay: 2 } })], now).cartCampaign).toBeNull();
  });

  it("sepet eşiği, kademeli adet; en çok kazandıran tek sepet kampanyası seçilir", () => {
    const lines = [book(1, 399), book(2, 399), book(3, 399)]; // 1197 TL
    const threshold = camp({ id: 2, type: "cart_threshold", params: { minKurus: 100000, discountType: "percentage", value: 15 } });
    const tiered = camp({ id: 3, type: "tiered_quantity", params: { tiers: [{ minQty: 2, percent: 10 }, { minQty: 3, percent: 20 }] } });
    const q = computeQuote(lines, [threshold, tiered], now);
    expect(q.cartCampaign?.id).toBe(3); // %20 > %15
    expect(q.cartCampaign?.discountKurus).toBe(Math.floor(119700 * 0.2));
    expect(computeQuote([book(1, 399)], [threshold], now).cartCampaign).toBeNull(); // eşik altı
  });

  it("süreli kategori indirimi fiyata uygulanır; hedef dışı kitaba uygulanmaz", () => {
    const timed = camp({ type: "timed_discount", targetCategories: ["beceri"], params: { discountType: "percentage", value: 30 } });
    const q = computeQuote([book(1, 499, "Beceri Kitapları"), book(2, 399, "1000 Kelime")], [timed], now);
    expect(q.lines[0].saleKurus).toBe(34930);
    expect(q.lines[1].saleKurus).toBe(39900);
    expect(q.finalKurus).toBe(34930 + 39900);
  });

  it("kupon ile kampanya birleşmez: daha avantajlı olan uygulanır", () => {
    const lines = [book(1, 399), book(2, 399), book(3, 399)];
    const c = camp({ params: { buy: 3, pay: 2 } }); // 399 TL indirim
    const small = computeQuote(lines, [c], now, { id: 9, code: "K10", discountKurus: 11970 });
    expect(small.applied).toBe("campaign");
    expect(small.coupon).toBeNull();
    expect(small.couponNote).toContain("kampanyası");
    const big = computeQuote(lines, [c], now, { id: 9, code: "K50", discountKurus: 59850 });
    expect(big.applied).toBe("coupon");
    expect(big.finalKurus).toBe(119700 - 59850);
  });

  it("süresi geçmiş / pasif kampanya uygulanmaz; paket yalnızca sepet eşiğine sayılır", () => {
    expect(computeQuote([book(1, 399), book(2, 399), book(3, 399)],
      [camp({ params: { buy: 3, pay: 2 }, endsAt: new Date("2026-11-01") })], now).cartCampaign).toBeNull();
    const bundle: CartLine = { key: "b", kind: "bundle", refId: 1, slug: "set", title: "Set", category: null, unitKurus: 119900 };
    expect(computeQuote([bundle, book(1, 399), book(2, 399)], [camp({ params: { buy: 3, pay: 2 } })], now).cartCampaign).toBeNull();
    const th = computeQuote([bundle], [camp({ type: "cart_threshold", params: { minKurus: 100000, discountType: "fixed", value: 100 } })], now);
    expect(th.finalKurus).toBe(119900 - 10000);
  });

  it("kurs: süreli indirim ve eşik uygulanır, kitap kampanyası uygulanmaz", () => {
    const course: CartLine = { key: "c", kind: "course", refId: 1, slug: "foundation", title: "Kurs", category: null, unitKurus: 1000000 };
    const ebookOnly = camp({ type: "timed_discount", scope: "ebook", params: { discountType: "percentage", value: 50 } });
    const courseCamp = camp({ id: 5, type: "timed_discount", scope: "course", targetCourseSlugs: ["foundation"], params: { discountType: "fixed", value: 1000 } });
    const q = computeQuote([course], [ebookOnly, courseCamp], now);
    expect(q.finalKurus).toBe(900000);
  });

  it("admin girdisi doğrulanır", () => {
    expect(validateCampaignParams("buy_x_pay_y", { buy: 3, pay: 3 })).toBeTruthy();
    expect(validateCampaignParams("buy_x_pay_y", { buy: 3, pay: 2 })).toBeNull();
    expect(validateCampaignParams("cart_threshold", { minKurus: 50000, discountType: "fixed", value: 600 })).toBeTruthy();
    expect(validateCampaignParams("tiered_quantity", { tiers: [{ minQty: 1, percent: 10 }] })).toBeTruthy();
    expect(validateCampaignParams("timed_discount", { discountType: "percentage", value: 100 })).toBeTruthy();
  });
});

let auth: Record<string, string> = {};
const tag = Date.now();
const ids: number[] = [];

beforeAll(async () => {
  await resetDb();
  auth = { Authorization: `Bearer ${(await createAdmin()).token}` };
  for (const [i, price] of [399, 499, 599].entries()) {
    ids.push((await pool.query(
      `INSERT INTO ebooks (slug, title, description, author, price_try, category, is_active) VALUES ($1, $2, 'x', 'Sphere English', $3, 'Beceri Kitapları', TRUE) RETURNING id`,
      [`kmp-${tag}-${i}`, `Kampanya Kitap ${i}`, price],
    )).rows[0].id);
  }
});
afterAll(async () => {
  await pool.query(`DELETE FROM campaigns WHERE name LIKE $1`, [`%${tag}%`]).catch(() => {});
  await pool.query(`DELETE FROM ebooks WHERE id = ANY($1::int[])`, [ids]).catch(() => {});
  await closeDb();
});

describe("kampanya API", () => {
  it("admin oluşturur; yayında olan teklif hesabına girer; hatalı parametre reddedilir", async () => {
    expect((await api().post("/api/admin/campaigns").set(auth).send({ name: `Hatalı ${tag}`, type: "buy_x_pay_y", params: { buy: 2, pay: 2 } })).status).toBe(400);
    const c = await api().post("/api/admin/campaigns").set(auth).send({
      name: `3 al 2 öde ${tag}`, type: "buy_x_pay_y", scope: "ebook", targetEbookIds: ids, params: { buy: 3, pay: 2 }, isActive: true, badgeText: "3 al 2 öde",
    });
    expect(c.status, JSON.stringify(c.body)).toBe(201);

    const items = [0, 1, 2].map((i) => ({ type: "ebook", slug: `kmp-${tag}-${i}` }));
    const q = await api().post("/api/campaigns/quote").send({ items });
    expect(q.status, JSON.stringify(q.body)).toBe(200);
    expect(q.body.applied).toBe("campaign");
    expect(q.body.finalKurus).toBe((499 + 599) * 100);
    expect(q.body.lines.reduce((s: number, l: any) => s + l.finalKurus, 0)).toBe(q.body.finalKurus);

    const active = await api().get("/api/campaigns/active");
    expect(active.body.campaigns.map((x: any) => x.id)).toContain(c.body.campaign.id);

    // Pasife alınınca teklif değişir
    await api().patch(`/api/admin/campaigns/${c.body.campaign.id}`).set(auth).send({ isActive: false });
    expect((await api().post("/api/campaigns/quote").send({ items })).body.applied).toBeNull();
  });

  it("geçersiz ürün ve admin yetkisi", async () => {
    expect((await api().post("/api/campaigns/quote").send({ items: [{ type: "ebook", slug: "yok-boyle-kitap" }] })).status).toBe(400);
    expect((await api().get("/api/admin/campaigns")).status).toBe(401);
  });
});
