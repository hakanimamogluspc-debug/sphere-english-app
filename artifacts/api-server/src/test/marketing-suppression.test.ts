import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { pool } from "@workspace/db";
import { api, resetDb, closeDb, createAdmin } from "./helpers.js";
import { marketingUnsubSig } from "../lib/email-suppression.js";

let auth: Record<string, string> = {};
const tag = Date.now();
const a = `lead-a-${tag}@example.com`;
const b = `lead-b-${tag}@example.com`;

beforeAll(async () => {
  await resetDb();
  const { token } = await createAdmin();
  auth = { Authorization: `Bearer ${token}` };
  await pool.query(`INSERT INTO contact_leads (name, email) VALUES ('Lead A', $1), ('Lead B', $2)`, [a, b]);
});
afterAll(async () => {
  await pool.query(`DELETE FROM contact_leads WHERE email IN ($1, $2)`, [a, b]).catch(() => {});
  await pool.query(`DELETE FROM email_suppressions WHERE lower(email) IN ($1, $2)`, [a, b]).catch(() => {});
  await closeDb();
});

describe("leads: listeden çıkarma", () => {
  it("admin listeden çıkarır → leads'te işaretli, toplu gönderim önizlemesinde hariç", async () => {
    const u = await api().post("/api/admin/marketing/leads/unsubscribe").set(auth).send({ emails: [a] });
    expect(u.status, JSON.stringify(u.body)).toBe(200);

    const leads = (await api().get("/api/admin/marketing/leads").set(auth)).body as any[];
    expect(leads.find((l) => l.email === a)?.unsubscribed).toBe(true);
    expect(leads.find((l) => l.email === b)?.unsubscribed).toBe(false);

    const p = await api().post("/api/admin/marketing/campaigns/preview").set(auth).send({ filter: "custom", customEmails: [a, b] });
    expect(p.body.count).toBe(1);
    expect(p.body.excluded).toBe(1);

    const contacts = await api().post("/api/admin/marketing/campaigns/preview").set(auth).send({ filter: "contact_leads" });
    expect(contacts.body.sample.map((x: any) => x.email)).not.toContain(a);
  });

  it("yalnızca listeden çıkmış kişilere gönderim reddedilir", async () => {
    const r = await api().post("/api/admin/marketing/campaigns/send").set(auth)
      .send({ subject: "Test", body: "<p>Merhaba</p>", filter: "custom", customEmails: [a] });
    expect(r.status).toBe(400);
    expect(r.body.error).toContain("listeden");
  });

  it("e-postadaki imzalı bağlantı listeden çıkarır; geri alma çalışır", async () => {
    expect((await api().get(`/api/marketing/unsubscribe?e=${encodeURIComponent(b)}&s=yanlis`)).status).toBe(400);
    const ok = await api().get(`/api/marketing/unsubscribe?e=${encodeURIComponent(b)}&s=${marketingUnsubSig(b)}`);
    expect(ok.status).toBe(200);
    expect(ok.text).toContain("Listeden çıkarıldın");
    // Tek tıkla çıkış (List-Unsubscribe-Post)
    expect((await api().post(`/api/marketing/unsubscribe?e=${encodeURIComponent(b)}&s=${marketingUnsubSig(b)}`)).status).toBe(200);

    await api().post("/api/admin/marketing/leads/resubscribe").set(auth).send({ email: b });
    const leads = (await api().get("/api/admin/marketing/leads").set(auth)).body as any[];
    expect(leads.find((l) => l.email === b)?.unsubscribed).toBe(false);
  });

  it("yönetim uçları admin ister", async () => {
    expect((await api().post("/api/admin/marketing/leads/unsubscribe").send({ emails: [a] })).status).toBe(401);
  });
});
