import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { pool } from "@workspace/db";
import { api, resetDb, closeDb, createAdmin } from "./helpers.js";
import { newsletterUnsubSig } from "../routes/site-popups.js";

let auth: Record<string, string> = {};
const tag = Date.now();
const email = `bulten-${tag}@example.com`;
let popupId = 0;

beforeAll(async () => {
  await resetDb();
  const { token } = await createAdmin();
  auth = { Authorization: `Bearer ${token}` };
});
afterAll(async () => {
  await pool.query(`DELETE FROM newsletter_subscribers WHERE lower(email) = $1`, [email]).catch(() => {});
  await pool.query(`DELETE FROM coupons WHERE notes = $1`, [`Bülten: ${email}`]).catch(() => {});
  await pool.query(`DELETE FROM site_popups WHERE title LIKE $1`, [`%${tag}%`]).catch(() => {});
  await closeDb();
});

describe("site pop-up'ları + bülten", () => {
  it("admin pop-up oluşturur; yayındaki pop-up herkese açık listede görünür, kapalı olan görünmez", async () => {
    const c = await api().post("/api/admin/popups").set(auth).send({
      kind: "newsletter", title: `Bülten ${tag}`, isActive: true, priority: 5,
      couponDiscountType: "percentage", couponDiscountValue: 10, couponAppliesTo: ["ebook"], couponValidDays: 14,
    });
    expect(c.status, JSON.stringify(c.body)).toBe(201);
    popupId = c.body.id;
    await api().post("/api/admin/popups").set(auth).send({ kind: "announcement", title: `Kapalı ${tag}`, isActive: false });

    const pub = await api().get("/api/popups/active");
    const titles = pub.body.popups.map((p: any) => p.title);
    expect(titles).toContain(`Bülten ${tag}`);
    expect(titles).not.toContain(`Kapalı ${tag}`);
    const mine = pub.body.popups.find((p: any) => p.id === popupId);
    expect(mine.couponLabel).toBe("%10 indirim");
    expect(mine.consentText).toBeTruthy();
    expect(mine.views).toBeUndefined(); // istatistikler herkese açık değil
  });

  it("geçersiz değerler reddedilir", async () => {
    expect((await api().post("/api/admin/popups").set(auth).send({ title: "" })).status).toBe(400);
    expect((await api().post("/api/admin/popups").set(auth).send({ title: `x ${tag}`, ctaUrl: "javascript:alert(1)" })).status).toBe(400);
    expect((await api().post("/api/admin/popups").set(auth)
      .send({ kind: "newsletter", title: `y ${tag}`, couponDiscountType: "percentage", couponDiscountValue: 150 })).status).toBe(400);
    expect((await api().get("/api/admin/popups")).status).toBe(401);
  });

  it("bülten kaydı: onay şart; kişiye özel tek kullanımlık kupon üretilir; aynı adrese ikinci kupon yok", async () => {
    expect((await api().post("/api/newsletter/subscribe").send({ email, popupId })).status).toBe(400);

    const r = await api().post("/api/newsletter/subscribe").send({ email, popupId, consent: true });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(r.body.coupon.code).toMatch(/^HOSGELDIN-[A-Z2-9]{6}$/);
    const cp = (await pool.query(`SELECT max_uses, max_uses_per_user, discount_value, is_active FROM coupons WHERE code = $1`, [r.body.coupon.code])).rows[0];
    expect(cp.max_uses).toBe(1);
    expect(cp.max_uses_per_user).toBe(1);
    expect(Number(cp.discount_value)).toBe(10);

    const again = await api().post("/api/newsletter/subscribe").send({ email: email.toUpperCase(), popupId, consent: true });
    expect(again.body.alreadySubscribed).toBe(true);
    expect(again.body.coupon).toBeUndefined();

    const sub = (await pool.query(`SELECT consent_text FROM newsletter_subscribers WHERE lower(email) = $1`, [email])).rows[0];
    expect(sub.consent_text).toContain("kabul ediyorum");
    const st = (await api().get("/api/admin/popups").set(auth)).body.popups.find((p: any) => p.id === popupId);
    expect(st.signups).toBe(1);
  });

  it("gösterim/tıklama sayılır; imzalı bağlantıyla bültenden çıkılır", async () => {
    await api().post(`/api/popups/${popupId}/event`).send({ type: "view" });
    const st = (await api().get("/api/admin/popups").set(auth)).body.popups.find((p: any) => p.id === popupId);
    expect(st.views).toBe(1);

    expect((await api().get(`/api/newsletter/unsubscribe?e=${encodeURIComponent(email)}&s=yanlis`)).status).toBe(400);
    const ok = await api().get(`/api/newsletter/unsubscribe?e=${encodeURIComponent(email)}&s=${newsletterUnsubSig(email)}`);
    expect(ok.status).toBe(200);
    const row = (await pool.query(`SELECT unsubscribed_at FROM newsletter_subscribers WHERE lower(email) = $1`, [email])).rows[0];
    expect(row.unsubscribed_at).not.toBeNull();
  });
});
