import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { pool } from "@workspace/db";
import { api, resetDb, closeDb, createAdmin } from "./helpers.js";
import { waitlistUnsubSignature } from "../lib/ebook-waitlist-mail.js";

let ebookId = 0;
let auth: Record<string, string> = {};
const tag = Date.now();
const a = `duyuru-a-${tag}@example.com`;
const b = `duyuru-b-${tag}@example.com`;

beforeAll(async () => {
  await resetDb();
  const { token } = await createAdmin();
  auth = { Authorization: `Bearer ${token}` };
  const e = await pool.query(
    `INSERT INTO ebooks (slug, title, description, author, price_try, category)
     VALUES ($1, 'Sunum İngilizcesi', 'Sunum kalıpları', 'Sphere English', 199, 'Beceri Kitapları') RETURNING id`,
    [`sunum-${tag}`],
  );
  ebookId = e.rows[0].id;
  // a iki farklı alanda kayıtlı → tek mail almalı
  await pool.query(
    `INSERT INTO ebook_waitlist (email, interest_area) VALUES ($1, 'beceri'), ($1, 'finans'), ($2, NULL)`,
    [a, b],
  );
});
afterAll(async () => {
  await pool.query(`DELETE FROM ebook_waitlist WHERE email IN ($1, $2)`, [a, b]).catch(() => {});
  await pool.query(`DELETE FROM ebooks WHERE id = $1`, [ebookId]).catch(() => {});
  await closeDb();
});

describe("bekleme listesine yeni kitap duyurusu", () => {
  it("önizleme: alan filtresi, aynı e-postaya tek mail, kitap bilgisi ve çıkış bağlantısı", async () => {
    const all = await api().get(`/api/admin/ebook-waitlist/announce/preview?ebookId=${ebookId}`).set(auth);
    expect(all.status, JSON.stringify(all.body)).toBe(200);
    expect(all.body.recipients).toBeGreaterThanOrEqual(2);
    expect(all.body.subject).toContain("Sunum İngilizcesi");
    expect(all.body.html).toContain("Listeden çık");

    const skill = await api().get(`/api/admin/ebook-waitlist/announce/preview?ebookId=${ebookId}&areas=beceri`).set(auth);
    expect(skill.body.recipients).toBe(1);
    const general = await api().get(`/api/admin/ebook-waitlist/announce/preview?ebookId=${ebookId}&areas=__none__,beceri`).set(auth);
    expect(general.body.recipients).toBe(2);
  });

  it("gönderim kuyruğa alınır; pasif kitap duyurulamaz", async () => {
    const r = await api().post(`/api/admin/ebook-waitlist/announce`).set(auth).send({ ebookId, areas: ["beceri"] });
    expect(r.status, JSON.stringify(r.body)).toBe(202);
    expect(r.body.queued).toBe(1);

    await pool.query(`UPDATE ebooks SET is_active = false WHERE id = $1`, [ebookId]);
    const p = await api().post(`/api/admin/ebook-waitlist/announce`).set(auth).send({ ebookId });
    expect(p.status).toBe(400);
    await pool.query(`UPDATE ebooks SET is_active = true WHERE id = $1`, [ebookId]);
  });

  it("imzalı çıkış bağlantısı e-postanın tüm kayıtlarını siler; imzasız bağlantı reddedilir", async () => {
    expect((await api().get(`/api/ebook-marketing/waitlist/unsubscribe?e=${encodeURIComponent(a)}&s=yanlis`)).status).toBe(400);
    const ok = await api().get(`/api/ebook-marketing/waitlist/unsubscribe?e=${encodeURIComponent(a)}&s=${waitlistUnsubSignature(a)}`);
    expect(ok.status).toBe(200);
    expect(ok.text).toContain("Listeden çıkarıldın");
    const left = await pool.query(`SELECT count(*)::int AS c FROM ebook_waitlist WHERE lower(email) = $1`, [a]);
    expect(left.rows[0].c).toBe(0);
  });
});
