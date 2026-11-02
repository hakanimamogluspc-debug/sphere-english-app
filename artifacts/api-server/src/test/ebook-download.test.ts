import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { pool } from "@workspace/db";
import { api, resetDb, closeDb, createAdmin } from "./helpers.js";

let ebookId = 0;
let seq = 0;

async function makePurchase(opts: { count?: number; expiresInMs?: number; status?: string } = {}) {
  const token = `tok_${Date.now()}_${++seq}_abcdefghijklmnop`;
  const r = await pool.query(
    `INSERT INTO ebook_purchases (ebook_id, buyer_email, amount_paid, download_token, download_count, download_expires_at, payment_status)
     VALUES ($1, $2, 100, $3, $4, $5, $6) RETURNING id`,
    [ebookId, `alici${seq}@example.com`, token, opts.count ?? 0,
     new Date(Date.now() + (opts.expiresInMs ?? 86400000)), opts.status ?? "success"],
  );
  return { id: r.rows[0].id as number, token };
}

async function countOf(id: number): Promise<number> {
  return (await pool.query(`SELECT download_count FROM ebook_purchases WHERE id = $1`, [id])).rows[0].download_count;
}

beforeAll(async () => {
  await resetDb();
  const e = await pool.query(
    `INSERT INTO ebooks (slug, title, description, author, price_try)
     VALUES ($1, 'Test Kitabı', 'test', 'Sphere English', 100) RETURNING id`,
    [`test-kitap-${Date.now()}`],
  );
  ebookId = e.rows[0].id;
  await pool.query(
    `INSERT INTO ebook_assets (ebook_id, asset_type, filename, mime_type, size_bytes, data_base64)
     VALUES ($1, 'full', 'kitap.pdf', 'application/pdf', 4, $2)`,
    [ebookId, Buffer.from("%PDF").toString("base64")],
  );
});
afterAll(async () => {
  await pool.query(`DELETE FROM ebooks WHERE id = $1`, [ebookId]).catch(() => {});
  await closeDb();
});

describe("e-kitap indirme sayfası", () => {
  it("GET sayfayı gösterir ve hak TÜKETMEZ (mail tarayıcı botları); POST indirir ve hakkı düşer", async () => {
    const p = await makePurchase();
    const page = await api().get(`/api/ebooks/download?token=${p.token}`);
    expect(page.status).toBe(200);
    expect(page.headers["content-type"]).toContain("text/html");
    expect(page.text).toContain("Test Kitabı");
    expect(page.text).toContain("PDF'i indir");
    await api().get(`/api/ebooks/download?token=${p.token}`);
    expect(await countOf(p.id)).toBe(0);

    const dl = await api().post("/api/ebooks/download").type("form").send({ token: p.token });
    expect(dl.status).toBe(200);
    expect(dl.headers["content-type"]).toContain("application/pdf");
    expect(await countOf(p.id)).toBe(1);
  });

  it("süresi dolmuş / hakkı bitmiş / geçersiz bağlantıda anlaşılır sayfa ve destek bilgisi", async () => {
    const expired = await makePurchase({ expiresInMs: -1000 });
    const r1 = await api().get(`/api/ebooks/download?token=${expired.token}`);
    expect(r1.status).toBe(410);
    expect(r1.text).toContain("süresi dolmuş");
    expect(r1.text).toContain("wa.me");

    const full = await makePurchase({ count: 10 });
    expect((await api().post("/api/ebooks/download").type("form").send({ token: full.token })).status).toBe(429);
    expect(await countOf(full.id)).toBe(10);

    expect((await api().get(`/api/ebooks/download?token=yok`)).status).toBe(404);
  });

  it("admin 'linki yenile': süre baştan başlar, sayaç sıfırlanır, bağlantı aynı kalır", async () => {
    const { token } = await createAdmin();
    const p = await makePurchase({ count: 10, expiresInMs: -1000 });
    const r = await api().post(`/api/admin/ebook-purchases/${p.id}/renew-link`).set({ Authorization: `Bearer ${token}` });
    // Test ortamında mail servisi yok → 502 (bağlantı yine de yenilenmiş olmalı)
    expect([200, 502], JSON.stringify(r.body)).toContain(r.status);
    const row = (await pool.query(`SELECT download_count, download_expires_at, download_token FROM ebook_purchases WHERE id = $1`, [p.id])).rows[0];
    expect(row.download_count).toBe(0);
    expect(row.download_token).toBe(p.token);
    const days = (new Date(row.download_expires_at).getTime() - Date.now()) / 86400000;
    expect(days).toBeGreaterThan(29);
    expect(days).toBeLessThan(31);
    expect((await api().get(`/api/ebooks/download?token=${p.token}`)).status).toBe(200);

    const pending = await makePurchase({ status: "pending" });
    expect((await api().post(`/api/admin/ebook-purchases/${pending.id}/renew-link`).set({ Authorization: `Bearer ${token}` })).status).toBe(400);
  });

  it("set / sepet siparişinde 'linki yenile' siparişteki TÜM kitapları yeniler", async () => {
    const { token } = await createAdmin();
    const a = await makePurchase({ count: 10, expiresInMs: -1000 });
    const b = await makePurchase({ count: 4, expiresInMs: -1000 });
    const order = `ORD-TEST-${Date.now()}`;
    await pool.query(`UPDATE ebook_purchases SET order_id = $1 WHERE id = ANY($2::int[])`, [order, [a.id, b.id]]);

    const r = await api().post(`/api/admin/ebook-purchases/${a.id}/renew-link`).set({ Authorization: `Bearer ${token}` });
    expect([200, 502], JSON.stringify(r.body)).toContain(r.status);
    const rows = (await pool.query(
      `SELECT download_count, download_expires_at FROM ebook_purchases WHERE order_id = $1`, [order],
    )).rows;
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.download_count).toBe(0);
      expect(new Date(row.download_expires_at).getTime()).toBeGreaterThan(Date.now() + 29 * 86400000);
    }
  });
});
