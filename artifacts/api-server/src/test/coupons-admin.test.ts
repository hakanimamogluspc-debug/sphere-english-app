import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { api, resetDb, closeDb, createAdmin } from "./helpers.js";

beforeAll(resetDb);
afterAll(closeDb);

describe("admin kupon düzenleme / silme", () => {
  it("kupon düzenlenir (kod, tarih, değer), geçersiz değerler reddedilir, kullanılmamış kupon silinir", async () => {
    const { token } = await createAdmin();
    const auth = { Authorization: `Bearer ${token}` };

    const created = await api().post("/api/admin/coupons").set(auth).send({
      code: "DUZENLE10", discountType: "percentage", discountValue: 10,
      validUntil: "2026-11-01T20:59:00.000Z",
    });
    expect(created.status, JSON.stringify(created.body)).toBe(200);
    const id = created.body.coupon.id;

    const upd = await api().patch(`/api/admin/coupons/${id}`).set(auth).send({
      code: "duzenle20", discountValue: 20,
      validFrom: "2026-10-01T00:00:00.000Z", validUntil: "2026-12-31T20:59:00.000Z",
    });
    expect(upd.status, JSON.stringify(upd.body)).toBe(200);

    const d = await api().get(`/api/admin/coupons/${id}`).set(auth);
    expect(d.body.coupon.code).toBe("DUZENLE20");
    expect(Number(d.body.coupon.discount_value)).toBe(20);
    expect(new Date(d.body.coupon.valid_until).toISOString()).toBe("2026-12-31T20:59:00.000Z");
    expect(new Date(d.body.coupon.valid_from).toISOString()).toBe("2026-10-01T00:00:00.000Z");

    // Bitiş başlangıçtan önce olamaz; yüzde 100'ü aşamaz
    expect((await api().patch(`/api/admin/coupons/${id}`).set(auth).send({ validUntil: "2026-09-01T00:00:00.000Z" })).status).toBe(400);
    expect((await api().patch(`/api/admin/coupons/${id}`).set(auth).send({ discountValue: 150 })).status).toBe(400);
    // Süresiz yapılabilir
    expect((await api().patch(`/api/admin/coupons/${id}`).set(auth).send({ validUntil: null })).status).toBe(200);

    expect((await api().delete(`/api/admin/coupons/${id}`).set(auth)).status).toBe(200);
    expect((await api().get(`/api/admin/coupons/${id}`).set(auth)).status).toBe(404);
  });

  it("kullanılmış kupon silinemez (satış geçmişi korunur)", async () => {
    const { token } = await createAdmin();
    const auth = { Authorization: `Bearer ${token}` };
    const created = await api().post("/api/admin/coupons").set(auth).send({
      code: "KULLANILDI", discountType: "fixed", discountValue: 50,
    });
    const id = created.body.coupon.id;
    await db.execute(sql`UPDATE coupons SET total_used_count = 1 WHERE id = ${id}`);

    const del = await api().delete(`/api/admin/coupons/${id}`).set(auth);
    expect(del.status).toBe(409);
    expect((await api().get(`/api/admin/coupons/${id}`).set(auth)).status).toBe(200);
  });
});
