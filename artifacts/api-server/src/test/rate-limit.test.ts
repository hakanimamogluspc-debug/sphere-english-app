import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { api, resetDb, closeDb, registerUser, VALID_PASSWORD } from "./helpers.js";

/**
 * app.ts: loginLimiter → 15 dk'da en fazla 10 BAŞARISIZ deneme (başarılılar sayılmaz).
 * Limiter in-memory; her test dosyası taze bir app yüklediği için sayaç 0'dan başlar.
 */
beforeAll(async () => {
  process.env.RATE_LIMIT_DISABLED = "0"; // bu dosyada limiter'lar GERÇEK
  await resetDb();
});
afterAll(async () => {
  process.env.RATE_LIMIT_DISABLED = "1";
  await closeDb();
});

describe("rate limiting — /api/auth/login", () => {
  it("10 başarısız denemeden sonra 11. istek 429 döner, başarılı girişler limiti tüketmez", async () => {
    const { email } = await registerUser();

    // Başarılı girişler sayılmamalı
    for (let i = 0; i < 3; i++) {
      const ok = await api().post("/api/auth/login").send({ email, password: VALID_PASSWORD });
      expect(ok.status).toBe(200);
    }

    // 10 başarısız deneme → hepsi 401
    for (let i = 0; i < 10; i++) {
      const bad = await api().post("/api/auth/login").send({ email, password: `yanlis-${i}` });
      expect(bad.status).toBe(401);
      expect(bad.headers["ratelimit-remaining"]).toBeDefined(); // standardHeaders
    }

    // 11. → 429 ve Türkçe mesaj
    const blocked = await api().post("/api/auth/login").send({ email, password: VALID_PASSWORD });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toMatch(/15 dakika/);
    expect(blocked.headers["retry-after"]).toBeDefined();
  });
});

describe("rate limiting — /api/auth/forgot-password", () => {
  it("4. talep 429 döner", async () => {
    const payload = { email: "ratelimit-forgot@sphere-test.invalid" };
    const statuses: number[] = [];
    for (let i = 0; i < 4; i++) {
      const r = await api().post("/api/auth/forgot-password").send(payload);
      statuses.push(r.status);
    }
    expect(statuses.slice(0, 3).every((s) => s !== 429)).toBe(true);
    expect(statuses[3]).toBe(429);
  });
});
