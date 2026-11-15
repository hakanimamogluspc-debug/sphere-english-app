import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { pool } from "@workspace/db";
import { api, resetDb, closeDb, createAdmin } from "./helpers.js";

let auth: Record<string, string> = {};
const tag = Date.now();

beforeAll(async () => {
  await resetDb();
  auth = { Authorization: `Bearer ${(await createAdmin()).token}` };
});
afterAll(async () => {
  await pool.query(`DELETE FROM home_banners WHERE title_line1 LIKE $1`, [`%${tag}%`]).catch(() => {});
  await pool.query(`DELETE FROM campaigns WHERE name LIKE $1`, [`%${tag}%`]).catch(() => {});
  await closeDb();
});

describe("ana sayfa banner'ları", () => {
  it("varsayılan 3 slayt kurulur; yayındaki slaytlar sırayla döner", async () => {
    const r = await api().get("/api/home-banners");
    expect(r.status).toBe(200);
    const slots = r.body.banners.map((b: any) => b.slot);
    expect(slots).toEqual(expect.arrayContaining(["ebook", "course", "general"]));
  });

  it("admin slayt ekler/gizler; geçersiz bağlantı reddedilir; yetki gerekir", async () => {
    expect((await api().post("/api/admin/home-banners").set(auth).send({ titleLine1: `X ${tag}`, cta1Url: "javascript:alert(1)" })).status).toBe(400);
    const c = await api().post("/api/admin/home-banners").set(auth).send({ titleLine1: `Test ${tag}`, slot: "general", isActive: true, sortOrder: 0 });
    expect(c.status, JSON.stringify(c.body)).toBe(201);
    expect((await api().get("/api/home-banners")).body.banners[0].titleLine1).toBe(`Test ${tag}`);
    await api().patch(`/api/admin/home-banners/${c.body.banner.id}`).set(auth).send({ isActive: false });
    expect((await api().get("/api/home-banners")).body.banners.map((b: any) => b.id)).not.toContain(c.body.banner.id);
    expect((await api().get("/api/admin/home-banners")).status).toBe(401);
  });

  it("'kampanyayı öne çıkar' slaytı, ana sayfada gösterilecek yayındaki kampanyanın etiketini alır", async () => {
    await api().post("/api/admin/campaigns").set(auth).send({
      name: `Kasım ${tag}`, type: "buy_x_pay_y", params: { buy: 3, pay: 2 }, isActive: true, showOnHome: true,
      badgeText: "3 al 2 öde", description: "Beceri Kitapları'nda 3 kitap alana en ucuzu bizden.",
    });
    const ebook = (await api().get("/api/home-banners")).body.banners.find((b: any) => b.slot === "ebook");
    expect(ebook.campaign.label).toBe("3 al 2 öde");
    expect(ebook.subtitle).toContain("3 kitap alana");
  });
});
