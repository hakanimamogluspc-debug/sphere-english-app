import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { pool } from "@workspace/db";
import { api, resetDb, closeDb, registerUser, uniqueEmail, VALID_PASSWORD } from "./helpers.js";
import { ebookClaimSig } from "../lib/ebook-library.js";

let ebookId = 0;
let otherEbookId = 0;
let seq = 0;

async function purchase(email: string, ebook = ebookId, status = "success") {
  await pool.query(
    `INSERT INTO ebook_purchases (ebook_id, buyer_email, amount_paid, download_token, download_count, download_expires_at, payment_status)
     VALUES ($1, $2, 399, $3, 0, NOW() + INTERVAL '30 days', $4)`,
    [ebook, email.toLowerCase(), `tok_lib_${Date.now()}_${++seq}_abcdefghijkl`, status],
  );
}

beforeAll(async () => {
  await resetDb();
  const tag = Date.now();
  ebookId = (await pool.query(
    `INSERT INTO ebooks (slug, title, description, author, price_try) VALUES ($1, 'Kitaplık Testi', 'x', 'Sphere English', 399) RETURNING id`,
    [`kitaplik-${tag}`],
  )).rows[0].id;
  otherEbookId = (await pool.query(
    `INSERT INTO ebooks (slug, title, description, author, price_try) VALUES ($1, 'Başkasının Kitabı', 'x', 'Sphere English', 399) RETURNING id`,
    [`baskasi-${tag}`],
  )).rows[0].id;
  await pool.query(
    `INSERT INTO ebook_assets (ebook_id, asset_type, filename, mime_type, size_bytes, data_base64)
     VALUES ($1, 'full', 'kitap.pdf', 'application/pdf', 4, $2)`,
    [ebookId, Buffer.from("%PDF").toString("base64")],
  );
});
afterAll(async () => {
  await pool.query(`DELETE FROM ebooks WHERE id IN ($1, $2)`, [ebookId, otherEbookId]).catch(() => {});
  await closeDb();
});

describe("Kitaplarım: hesabı olmayan alıcı", () => {
  it("imzasız / yanlış imzalı bağlantı reddedilir; hesap kendiliğinden açılmaz", async () => {
    const email = uniqueEmail("alici");
    await purchase(email);
    expect((await api().get(`/api/ebook-library/claim?e=${encodeURIComponent(email)}&s=yanlis`)).status).toBe(400);
    const ok = await api().get(`/api/ebook-library/claim?e=${encodeURIComponent(email)}&s=${ebookClaimSig(email)}`);
    expect(ok.status).toBe(200);
    expect(ok.body.hasAccount).toBe(false);
    expect(ok.body.books).toContain("Kitaplık Testi");
    const users = await pool.query(`SELECT 1 FROM users WHERE lower(email) = $1`, [email.toLowerCase()]);
    expect(users.rows).toHaveLength(0);
  });

  it("koşul onayı olmadan hesap açılmaz; onayla açılır, kitap bağlanır, PDF okunur", async () => {
    const email = uniqueEmail("yeni");
    await purchase(email);
    const s = ebookClaimSig(email);
    const base = { e: email, s, firstName: "Ayşe", lastName: "Yılmaz", password: VALID_PASSWORD };

    expect((await api().post("/api/ebook-library/activate").send(base)).status).toBe(400);
    expect((await api().post("/api/ebook-library/activate").send({ ...base, s: "x".repeat(24), termsAccepted: true })).status).toBe(400);

    const r = await api().post("/api/ebook-library/activate").send({ ...base, termsAccepted: true });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(r.body.linked).toBe(1);
    const auth = { Authorization: `Bearer ${r.body.token}` };

    const terms = await pool.query(`SELECT terms_accepted_at FROM users WHERE lower(email) = $1`, [email.toLowerCase()]);
    expect(terms.rows[0].terms_accepted_at).not.toBeNull();

    const list = await api().get("/api/me/ebooks").set(auth);
    expect(list.body.ebooks.map((b: any) => b.title)).toEqual(["Kitaplık Testi"]);
    expect(list.body.ebooks[0].hasFile).toBe(true);

    const link = await api().post(`/api/me/ebooks/${ebookId}/read-link`).set(auth);
    expect(link.status).toBe(200);
    const file = await api().get(`/api${link.body.path}`);
    expect(file.status).toBe(200);
    expect(file.headers["content-type"]).toContain("application/pdf");
    expect(file.headers["content-disposition"]).toContain("inline");

    // Aynı bağlantıyla ikinci hesap açılamaz
    expect((await api().post("/api/ebook-library/activate").send({ ...base, termsAccepted: true })).status).toBe(409);
  });
});

describe("Kitaplarım: erişim kontrolü", () => {
  it("hesabı olan alıcının kitapları kendi kitaplığında; başkasının kitabı açılamaz; bozuk okuma bağlantısı reddedilir", async () => {
    const { email, token, user } = await registerUser();
    await purchase(email);
    await purchase(uniqueEmail("baska"), otherEbookId);
    await purchase(email, otherEbookId, "pending"); // ödenmemiş — görünmemeli
    const auth = { Authorization: `Bearer ${token}` };

    const list = await api().get("/api/me/ebooks").set(auth);
    expect(list.body.ebooks.map((b: any) => b.id)).toEqual([ebookId]);

    expect((await api().post(`/api/me/ebooks/${otherEbookId}/read-link`).set(auth)).status).toBe(404);
    expect((await api().get("/api/me/ebooks")).status).toBe(401);

    const link = await api().post(`/api/me/ebooks/${ebookId}/read-link`).set(auth);
    const tampered = link.body.path.replace(`u=${user.id}`, `u=${user.id + 999}`);
    expect((await api().get(`/api${tampered}`)).status).toBe(403);
    const expired = `/api/me/ebooks/${ebookId}/file?u=${user.id}&x=1&s=${"a".repeat(32)}`;
    expect((await api().get(expired)).status).toBe(403);
  });
});
