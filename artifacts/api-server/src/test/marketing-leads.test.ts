import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { pool } from "@workspace/db";
import { api, resetDb, closeDb, createAdmin } from "./helpers.js";

let auth: Record<string, string> = {};
const tag = Date.now();
const both = `iki-kaynak-${tag}@example.com`;   // iletişim formu + bülten
const onlyB2b = `b2b-${tag}@example.com`;
const onlyWait = `bekle-${tag}@example.com`;
let b2bId = 0;

beforeAll(async () => {
  await resetDb();
  const { token } = await createAdmin();
  auth = { Authorization: `Bearer ${token}` };
  await pool.query(`INSERT INTO contact_leads (name, email, company) VALUES ('Ayşe Y', $1, 'Acme')`, [both]);
  await pool.query(`INSERT INTO newsletter_subscribers (email, consent_text) VALUES ($1, 'onay')`, [both.toUpperCase()]);
  await pool.query(`INSERT INTO ebook_waitlist (email, interest_area) VALUES ($1, 'beceri')`, [onlyWait]);
  b2bId = (await pool.query(
    `INSERT INTO outreach_leads (email, full_name, company, job_title, segment, source) VALUES ($1, 'Mehmet K', 'Beta AŞ', 'İK Müdürü', 'b2b_hr', 'test') RETURNING id`,
    [onlyB2b],
  )).rows[0].id;
});
afterAll(async () => {
  await pool.query(`DELETE FROM contact_leads WHERE email = $1`, [both]).catch(() => {});
  await pool.query(`DELETE FROM newsletter_subscribers WHERE lower(email) = $1`, [both]).catch(() => {});
  await pool.query(`DELETE FROM ebook_waitlist WHERE email = $1`, [onlyWait]).catch(() => {});
  await pool.query(`DELETE FROM outreach_leads WHERE id = $1`, [b2bId]).catch(() => {});
  await closeDb();
});

describe("pazarlama: tüm kaynaklardan lead'ler tek listede", () => {
  it("iletişim, bülten, haberdar ol ve B2B lead'leri listelenir; aynı e-posta tek satır, kaynakları birlikte", async () => {
    const leads = (await api().get("/api/admin/marketing/leads").set(auth)).body as any[];
    const l1 = leads.filter((l) => l.email === both);
    expect(l1).toHaveLength(1);
    expect(l1[0].sources).toEqual(expect.arrayContaining(["contact_form", "newsletter"]));
    expect(l1[0].name).toBe("Ayşe Y");
    expect(l1[0].editable).toBe(true);

    const w = leads.find((l) => l.email === onlyWait);
    expect(w.sources).toEqual(["waitlist"]);
    expect(w.editable).toBeFalsy();

    const b = leads.find((l) => l.email === onlyB2b);
    expect(b.sources).toEqual(["b2b"]);
    expect(b.company).toBe("Beta AŞ");
    expect(b.detail).toContain("İK Müdürü");

    const onlyNews = (await api().get("/api/admin/marketing/leads?source=newsletter").set(auth)).body as any[];
    expect(onlyNews.map((l) => l.email)).toContain(both);
    expect(onlyNews.map((l) => l.email)).not.toContain(onlyB2b);
  });

  it("B2B lead'in durumu ve notu Leads ekranından güncellenir", async () => {
    const r = await api().patch(`/api/admin/marketing/leads/b2b-${b2bId}`).set(auth).send({ status: "qualified", notes: "Demo istedi" });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const row = (await pool.query(`SELECT status, notes FROM outreach_leads WHERE id = $1`, [b2bId])).rows[0];
    expect(row.status).toBe("qualified");
    expect(row.notes).toBe("Demo istedi");
  });
});
