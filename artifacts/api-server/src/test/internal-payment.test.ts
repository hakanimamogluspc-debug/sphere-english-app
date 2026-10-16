import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { pool } from "@workspace/db";
import { api, resetDb, closeDb, registerUser, uniqueEmail, internalSignature } from "./helpers.js";
import { TEST_INTERNAL_TOKEN } from "./test-env.js";

beforeAll(resetDb);
afterAll(closeDb);

function activate(body: Record<string, unknown>, signature?: string) {
  const req = api().post("/api/internal/payment/activate");
  if (signature !== undefined) req.set("X-Internal-Signature", signature);
  return req.send(body);
}

describe("POST /api/internal/payment/activate (www → api, Iyzico sonrası)", () => {
  const base = {
    planCode: "sphere-pro-aylik",
    amount: 1,
    currency: "TRY",
    paidAt: new Date().toISOString(),
  };

  it("imzasız istek → 401", async () => {
    const res = await activate({ ...base, email: uniqueEmail("pay") });
    expect(res.status).toBe(401);
  });

  it("yanlış imza → 401", async () => {
    const res = await activate({ ...base, email: uniqueEmail("pay") }, "deadbeef".repeat(8));
    expect(res.status).toBe(401);
  });

  it("imza doğru ama gövde değiştirilmiş → 401 (imza gövdeye bağlı)", async () => {
    const body = { ...base, email: uniqueEmail("pay") };
    const sig = internalSignature(body);
    const res = await activate({ ...body, planCode: "sphere-premium-yillik" }, sig);
    expect(res.status).toBe(401);
  });

  it("bilinmeyen plan → 400", async () => {
    const body = { ...base, email: uniqueEmail("pay"), planCode: "yok-boyle-plan" };
    const res = await activate(body, internalSignature(body));
    expect(res.status).toBe(400);
  });

  it("email/planCode yoksa → 400", async () => {
    const body = { amount: 1 };
    const res = await activate(body, internalSignature(body));
    expect(res.status).toBe(400);
  });

  it("yeni e-posta → kullanıcı oluşur, abonelik aktif, ödeme kaydı yazılır", async () => {
    const email = uniqueEmail("newbuyer");
    const body = { ...base, email, name: "Ayşe Yılmaz", iyzicoPaymentId: "PAY-1", iyzicoConversationId: "CONV-1" };
    const res = await activate(body, internalSignature(body));
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.ok ?? res.body.success ?? true).toBeTruthy();

    const { rows: users } = await pool.query(`SELECT id, first_name, last_name, role FROM users WHERE email = $1`, [email.toLowerCase()]);
    expect(users).toHaveLength(1);
    expect(users[0].first_name).toBe("Ayşe");
    expect(users[0].last_name).toBe("Yılmaz");
    expect(users[0].role).toBe("student");

    const { rows: subs } = await pool.query(`SELECT status, plan_key, provider, expires_at FROM subscriptions WHERE user_id = $1`, [users[0].id]);
    expect(subs).toHaveLength(1);
    expect(subs[0].status).toBe("active");
    expect(subs[0].plan_key).toBe("sphere-pro-aylik");
    expect(subs[0].provider).toBe("iyzico");
    // aylık plan → ~30 gün sonra biter
    const days = (new Date(subs[0].expires_at).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(27);
    expect(days).toBeLessThan(32);

    const { rows: pays } = await pool.query(`SELECT event_type, status, provider_payment_id FROM payments WHERE user_id = $1`, [users[0].id]);
    expect(pays).toHaveLength(1);
    expect(pays[0].event_type).toBe("checkout_success");
    expect(pays[0].provider_payment_id).toBe("PAY-1");
  });

  it("mevcut kullanıcı → yeni kullanıcı açılmaz, abonelik upsert edilir (tek satır)", async () => {
    const { email, user } = await registerUser();
    const body1 = { ...base, email, iyzicoPaymentId: "PAY-2", iyzicoConversationId: "CONV-2" };
    const r1 = await activate(body1, internalSignature(body1));
    expect(r1.status, JSON.stringify(r1.body)).toBe(200);

    // Yenileme: ikinci ödeme aynı kullanıcı, yıllık plana geçiş
    const body2 = { ...base, email, planCode: "sphere-pro-yillik", iyzicoPaymentId: "PAY-3", iyzicoConversationId: "CONV-3" };
    const r2 = await activate(body2, internalSignature(body2));
    expect(r2.status, JSON.stringify(r2.body)).toBe(200);

    const { rows: users } = await pool.query(`SELECT count(*)::int AS n FROM users WHERE email = $1`, [email.toLowerCase()]);
    expect(users[0].n).toBe(1);
    const { rows: subs } = await pool.query(`SELECT plan_key, status FROM subscriptions WHERE user_id = $1`, [user.id]);
    expect(subs).toHaveLength(1);
    expect(subs[0].plan_key).toBe("sphere-pro-yillik");
    expect(subs[0].status).toBe("active");
    const { rows: pays } = await pool.query(`SELECT count(*)::int AS n FROM payments WHERE user_id = $1`, [user.id]);
    expect(pays[0].n).toBe(2);
  });

  it("pre-create taslağındaki fatura bilgisi aboneliğe işlenir, e-posta gövdede olmasa bile çözülür", async () => {
    const email = uniqueEmail("draft");
    const pre = {
      conversationId: "CONV-DRAFT-1",
      planCode: "sphere-core-aylik",
      email,
      name: "Mehmet Demir",
      invoiceType: "corporate",
      taxId: "1234567890",
      taxOffice: "Ayvalık",
      companyName: "Demir Gıda Ltd.",
      billingAddress: "Atatürk Blv. 1",
      billingCity: "Balıkesir",
    };
    const preRes = await api().post("/api/internal/subscription/pre-create").set("X-Internal-Signature", internalSignature(pre)).send(pre);
    expect(preRes.status, JSON.stringify(preRes.body)).toBe(200);

    // Aktivasyonda email/planCode yok — sadece conversationId
    const body = { amount: 1, currency: "TRY", iyzicoPaymentId: "PAY-D1", iyzicoConversationId: "CONV-DRAFT-1" };
    const res = await activate(body, internalSignature(body));
    expect(res.status, JSON.stringify(res.body)).toBe(200);

    const { rows } = await pool.query(
      `SELECT s.plan_key, s.invoice_type, s.tax_id, s.company_name, s.billing_city, d.used_at
         FROM subscriptions s
         JOIN users u ON u.id = s.user_id
         JOIN pending_subscription_drafts d ON d.conversation_id = 'CONV-DRAFT-1'
        WHERE u.email = $1`,
      [email.toLowerCase()],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].plan_key).toBe("sphere-core-aylik");
    expect(rows[0].invoice_type).toBe("corporate");
    expect(rows[0].tax_id).toBe("1234567890");
    expect(rows[0].company_name).toBe("Demir Gıda Ltd.");
    expect(rows[0].used_at).not.toBeNull();
  });
});

describe("internal cron endpoint'leri (x-internal-token)", () => {
  it("token yoksa / yanlışsa 401", async () => {
    const none = await api().post("/api/internal/weekly-report/run");
    expect(none.status).toBe(401);
    const wrong = await api().post("/api/internal/weekly-report/run").set("x-internal-token", "yanlis");
    expect(wrong.status).toBe(401);
  });

  it("doğru token kabul edilir (401 değil)", async () => {
    const res = await api().post("/api/internal/weekly-report/run").set("x-internal-token", TEST_INTERNAL_TOKEN);
    expect(res.status).not.toBe(401);
  });
});
