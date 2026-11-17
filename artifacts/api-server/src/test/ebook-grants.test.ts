import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { pool } from "@workspace/db";
import { api, resetDb, closeDb, registerUser, createAdmin } from "./helpers.js";

let admin: Record<string, string> = {};
let bookA = 0;
let bookB = 0;
let passive = 0;

beforeAll(async () => {
  await resetDb();
  admin = { Authorization: `Bearer ${(await createAdmin()).token}` };
  const tag = Date.now();
  const mk = async (slug: string, title: string, active = true) => (await pool.query(
    `INSERT INTO ebooks (slug, title, description, author, price_try, is_active) VALUES ($1, $2, 'x', 'Sphere English', 399, $3) RETURNING id`,
    [`${slug}-${tag}`, title, active],
  )).rows[0].id as number;
  bookA = await mk("tanim-a", "Tanımlanan Kitap A");
  bookB = await mk("tanim-b", "Tanımlanan Kitap B");
  passive = await mk("tanim-pasif", "Pasif Kitap", false);
  await pool.query(
    `INSERT INTO ebook_assets (ebook_id, asset_type, filename, mime_type, size_bytes, data_base64)
     VALUES ($1, 'full', 'a.pdf', 'application/pdf', 4, $2)`,
    [bookA, Buffer.from("%PDF").toString("base64")],
  );
});
afterAll(async () => {
  await pool.query(`DELETE FROM ebooks WHERE id IN ($1, $2, $3)`, [bookA, bookB, passive]).catch(() => {});
  await closeDb();
});

describe("admin: öğrenciye e-kitap tanımlama", () => {
  it("yetkisiz erişim reddedilir; eksik/yanlış seçim 400", async () => {
    const s = await registerUser();
    const student = { Authorization: `Bearer ${s.token}` };
    expect((await api().get("/api/admin/ebook-grants")).status).toBe(401);
    expect((await api().post("/api/admin/ebook-grants").set(student).send({ userIds: [s.user.id], ebookIds: [bookA] })).status).toBe(403);
    expect((await api().post("/api/admin/ebook-grants").set(admin).send({ userIds: [], ebookIds: [bookA] })).status).toBe(400);
    expect((await api().post("/api/admin/ebook-grants").set(admin).send({ userIds: [s.user.id], ebookIds: [] })).status).toBe(400);
    expect((await api().post("/api/admin/ebook-grants").set(admin).send({ userIds: [s.user.id], ebookIds: [passive] })).status).toBe(400);
    expect((await api().post("/api/admin/ebook-grants").set(admin).send({ userIds: [99999999], ebookIds: [bookA] })).status).toBe(400);
  });

  it("tanımlanan kitap öğrencinin kitaplığında görünür ve okunur; satış kaydı açılmaz", async () => {
    const s = await registerUser();
    const student = { Authorization: `Bearer ${s.token}` };
    expect((await api().get("/api/me/ebooks").set(student)).body.ebooks).toHaveLength(0);
    expect((await api().post(`/api/me/ebooks/${bookA}/read-link`).set(student)).status).toBe(404);

    const r = await api().post("/api/admin/ebook-grants").set(admin).send({ userIds: [s.user.id], ebookIds: [bookA, bookB], note: "Kurumsal hediye" });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(r.body).toMatchObject({ granted: 2, skipped: 0, mailed: 0 });

    const lib = (await api().get("/api/me/ebooks").set(student)).body.ebooks;
    expect(lib.map((b: any) => b.id).sort()).toEqual([bookA, bookB].sort());
    expect(lib.every((b: any) => b.granted === true)).toBe(true);
    expect((await api().post(`/api/me/ebooks/${bookA}/read-link`).set(student)).status).toBe(200);

    const sales = await pool.query(`SELECT 1 FROM ebook_purchases WHERE user_id = $1`, [s.user.id]);
    expect(sales.rows).toHaveLength(0);
  });

  it("aynı kitap ikinci kez tanımlanmaz; satın alınmış kitap atlanır", async () => {
    const s = await registerUser();
    await pool.query(
      `INSERT INTO ebook_purchases (ebook_id, user_id, buyer_email, amount_paid, download_token, download_count, download_expires_at, payment_status)
       VALUES ($1, $2, $3, 399, $4, 0, NOW() + INTERVAL '30 days', 'success')`,
      [bookA, s.user.id, s.email.toLowerCase(), `tok_grant_${Date.now()}_abcdefghijkl`],
    );
    const first = await api().post("/api/admin/ebook-grants").set(admin).send({ userIds: [s.user.id], ebookIds: [bookA, bookB] });
    expect(first.body).toMatchObject({ granted: 1, skipped: 1 });
    const again = await api().post("/api/admin/ebook-grants").set(admin).send({ userIds: [s.user.id], ebookIds: [bookA, bookB] });
    expect(again.body).toMatchObject({ granted: 0, skipped: 2 });
    const lib = (await api().get("/api/me/ebooks").set({ Authorization: `Bearer ${s.token}` })).body.ebooks;
    expect(lib).toHaveLength(2);
    expect(lib.find((b: any) => b.id === bookA).granted).toBe(false);
  });

  it("listeleme, öğrenci arama ve geri alma: geri alınan kitap kitaplıktan çıkar", async () => {
    const s = await registerUser({ firstName: "Tanımlı", lastName: "Öğrenci" });
    const student = { Authorization: `Bearer ${s.token}` };
    await api().post("/api/admin/ebook-grants").set(admin).send({ userIds: [s.user.id], ebookIds: [bookB] });

    const found = await api().get(`/api/admin/ebook-grants/users?q=${encodeURIComponent(s.email)}`).set(admin);
    expect(found.body.users[0]).toMatchObject({ id: s.user.id, bookCount: 1 });
    const opts = await api().get("/api/admin/ebook-grants/options").set(admin);
    const optIds = opts.body.ebooks.map((e: any) => e.id);
    expect(optIds).toEqual(expect.arrayContaining([bookA, bookB]));
    expect(optIds).not.toContain(passive);

    const list = await api().get(`/api/admin/ebook-grants?userId=${s.user.id}`).set(admin);
    expect(list.body.grants).toHaveLength(1);
    expect(list.body.grants[0].title).toBe("Tanımlanan Kitap B");

    expect((await api().delete(`/api/admin/ebook-grants/${list.body.grants[0].id}`).set(admin)).status).toBe(200);
    expect((await api().get("/api/me/ebooks").set(student)).body.ebooks).toHaveLength(0);
    expect((await api().delete(`/api/admin/ebook-grants/${list.body.grants[0].id}`).set(admin)).status).toBe(404);
  });
});
