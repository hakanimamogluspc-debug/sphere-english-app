import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { api, resetDb, closeDb, createAdmin } from "./helpers.js";

// 1×1 PNG
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

let auth: Record<string, string> = {};

beforeAll(async () => {
  await resetDb();
  const { token } = await createAdmin();
  auth = { Authorization: `Bearer ${token}` };
});
afterAll(closeDb);

describe("Medya Kütüphanesi", () => {
  it("yükle → herkese açık link başka sitelerde de gösterilebilir (CORP cross-origin), kalıcı önbellek", async () => {
    const up = await api().post("/api/admin/mail-assets/upload").set(auth)
      .field("width", "1").field("height", "1").field("description", "Logo")
      .attach("image", PNG, { filename: "Kapak Görseli.png", contentType: "image/png" });
    expect(up.status, JSON.stringify(up.body)).toBe(200);
    const a = up.body.asset;
    expect(a.width).toBe(1);
    expect(a.storage).toBe("db"); // test ortamında nesne deposu yok
    expect(a.url).toMatch(/\/api\/mail-assets\/\d+\/Kapak-Gorseli\.png$/);

    const path = new URL(a.url).pathname;
    const img = await api().get(path);
    expect(img.status).toBe(200);
    expect(img.headers["content-type"]).toContain("image/png");
    expect(img.headers["cross-origin-resource-policy"]).toBe("cross-origin");
    expect(img.headers["cache-control"]).toContain("immutable");
    // Eski (dosya adısız) adres de çalışır — daha önce gönderilmiş mailler için
    expect((await api().get(`/api/mail-assets/${a.id}`)).status).toBe(200);
    // Aynı ETag → 304
    expect((await api().get(path).set("If-None-Match", img.headers.etag)).status).toBe(304);
  });

  it("WebP reddedilir (Outlook göstermiyor); açıklama güncellenir; silinen görsel 404", async () => {
    const webp = await api().post("/api/admin/mail-assets/upload").set(auth)
      .attach("image", Buffer.from("RIFF0000WEBP"), { filename: "x.webp", contentType: "image/webp" });
    expect(webp.status).toBe(400);

    const up = await api().post("/api/admin/mail-assets/upload").set(auth)
      .attach("image", PNG, { filename: "silinecek.png", contentType: "image/png" });
    const id = up.body.asset.id;
    expect((await api().patch(`/api/admin/mail-assets/${id}`).set(auth).send({ description: "Yeni alt" })).status).toBe(200);
    const list = await api().get(`/api/admin/mail-assets?q=${encodeURIComponent("yeni alt")}`).set(auth);
    expect(list.body.assets.map((x: any) => x.id)).toContain(id);

    expect((await api().delete(`/api/admin/mail-assets/${id}`).set(auth)).status).toBe(200);
    expect((await api().get(`/api/mail-assets/${id}`)).status).toBe(404);
  });

  it("yönetim uçları admin ister", async () => {
    expect((await api().get("/api/admin/mail-assets")).status).toBe(401);
  });
});
