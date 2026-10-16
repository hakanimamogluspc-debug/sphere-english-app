import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { api, closeDb, resetDb, registerUser } from "./helpers.js";

beforeAll(resetDb);

afterAll(closeDb);

describe("health", () => {
  it("GET /api/healthz → ok + ortam bilgisi", async () => {
    const res = await api().get("/api/healthz");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.env).toBe("staging"); // test env APP_ENV=staging
    expect(res.headers["x-app-env"]).toBe("staging");
    expect(res.headers["x-robots-tag"]).toContain("noindex");
  });

  it("bilinmeyen API yolu: token yoksa 401 (auth önce), token varsa 404 JSON", async () => {
    const anon = await api().get("/api/boyle-bir-yol-yok");
    expect(anon.status).toBe(401);
    const { token } = await registerUser();
    const res = await api().get("/api/boyle-bir-yol-yok").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  it("güvenlik başlıkları (helmet) set edilmiş", async () => {
    const res = await api().get("/api/healthz");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBeDefined();
  });
});
