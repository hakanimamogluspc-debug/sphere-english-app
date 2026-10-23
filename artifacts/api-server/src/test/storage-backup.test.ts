import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { api, resetDb, closeDb, registerUser, createAdmin } from "./helpers.js";
import { regionFromEndpoint, safeFilename, storageEnabled } from "../lib/object-storage.js";
import { assetKey } from "../lib/ebook-asset-store.js";
import { encryptFile, decryptFile, parsePropfind, selectExpired, offsiteConfigured } from "../lib/backup-offsite.js";

beforeAll(resetDb);
afterAll(closeDb);

describe("nesne deposu yardımcıları", () => {
  it("endpoint'ten konum kodu çıkarılır", () => {
    expect(regionFromEndpoint("https://fsn1.your-objectstorage.com")).toBe("fsn1");
    expect(regionFromEndpoint("https://hel1.your-objectstorage.com/")).toBe("hel1");
    expect(regionFromEndpoint("https://s3.example.com")).toBe("us-east-1");
    expect(regionFromEndpoint("bozuk")).toBe("us-east-1");
  });

  it("dosya adı güvenli hâle getirilir; anahtar ebooks/<id>/<tür>/ altında", () => {
    expect(safeFilename("Müzakere İngilizcesi (Tam) v2.pdf")).toBe("Muzakere-Ingilizcesi-Tam-v2.pdf");
    expect(safeFilename("???")).toBe("file");
    expect(assetKey(7, "full", "Kitap Ş.pdf", "abc")).toBe("ebooks/7/full/abc-Kitap-S.pdf");
  });

  it("test ortamında depo kapalı → eski davranış (veritabanı)", () => {
    expect(storageEnabled()).toBe(false);
  });
});

describe("yedek şifreleme ve Storage Box yardımcıları", () => {
  const dir = path.join(os.tmpdir(), `sphere-bk-test-${process.pid}`);
  beforeAll(() => fs.mkdir(dir, { recursive: true }));
  afterAll(() => fs.rm(dir, { recursive: true, force: true }));

  it("şifrele → çöz gidiş-dönüş birebir aynı; yanlış anahtar reddedilir", async () => {
    const src = path.join(dir, "in.sql.gz");
    const enc = path.join(dir, "in.sql.gz.enc");
    const out = path.join(dir, "out.sql.gz");
    const data = randomBytes(1_500_000);
    await fs.writeFile(src, data);
    await encryptFile(src, enc, "test-key-0123456789-abcdef");
    const encBuf = await fs.readFile(enc);
    expect(encBuf.subarray(0, 6).toString()).toBe("SPHBK1");
    expect(encBuf.includes(data.subarray(0, 64))).toBe(false); // düz metin görünmez
    await decryptFile(enc, out, "test-key-0123456789-abcdef");
    expect((await fs.readFile(out)).equals(data)).toBe(true);
    await expect(decryptFile(enc, path.join(dir, "x"), "yanlis-anahtar-0123456789")).rejects.toThrow();
  });

  it("kısa anahtar kabul edilmez", async () => {
    const src = path.join(dir, "k.bin");
    await fs.writeFile(src, "x");
    await expect(encryptFile(src, src + ".enc", "kisa")).rejects.toThrow(/kısa/);
  });

  it("PROPFIND yanıtından yalnız Sphere yedekleri listelenir (yeniden eskiye)", () => {
    const xml = `<?xml version="1.0"?><d:multistatus xmlns:d="DAV:">
      <d:response><d:href>/sphere-backups/</d:href></d:response>
      <d:response><d:href>/sphere-backups/sphere_20261020_1.sql.gz.enc</d:href><d:propstat><d:prop><d:getcontentlength>1234</d:getcontentlength></d:prop></d:propstat></d:response>
      <d:response><d:href>/sphere-backups/sphere_20261022_2.sql.gz.enc</d:href><d:propstat><d:prop><d:getcontentlength>2048</d:getcontentlength></d:prop></d:propstat></d:response>
      <d:response><d:href>/sphere-backups/notlar.txt</d:href></d:response>
    </d:multistatus>`;
    expect(parsePropfind(xml)).toEqual([
      { name: "sphere_20261022_2.sql.gz.enc", sizeBytes: 2048 },
      { name: "sphere_20261020_1.sql.gz.enc", sizeBytes: 1234 },
    ]);
  });

  it("saklama süresi dosya adındaki tarihe göre uygulanır", () => {
    const now = new Date("2026-10-23T03:00:00Z");
    const names = ["sphere_20260901_1.sql.gz.enc", "sphere_20260923_1.sql.gz.enc", "sphere_20261022_1.sql.gz.enc", "baska.enc"];
    expect(selectExpired(names, 30, now)).toEqual(["sphere_20260901_1.sql.gz.enc"]);
  });
});

describe("admin uçları (depo/yedek yapılandırılmamışken)", () => {
  it("öğrenci giremez", async () => {
    const { token } = await registerUser();
    expect((await api().get("/api/admin/storage/status").set("Authorization", `Bearer ${token}`)).status).toBe(403);
  });

  it("durum: depo kapalı, taşıma 400; yedek listesinde eksik ayarlar görünür", async () => {
    expect(offsiteConfigured()).toBe(false);
    const { token } = await createAdmin();
    const auth = { Authorization: `Bearer ${token}` };
    const st = await api().get("/api/admin/storage/status").set(auth);
    expect(st.status, JSON.stringify(st.body)).toBe(200);
    expect(st.body.enabled).toBe(false);
    expect(st.body.connection.ok).toBe(false);
    expect(typeof st.body.ebooks.inDb).toBe("number");

    expect((await api().post("/api/admin/storage/migrate-ebooks").set(auth).send({})).status).toBe(400);

    const b = await api().get("/api/admin/backups").set(auth);
    expect(b.status).toBe(200);
    expect(b.body.offsite.configured).toBe(false);
    expect(b.body.offsite.missing).toContain("BACKUP_ENCRYPTION_KEY");
    expect(Array.isArray(b.body.runs)).toBe(true);
  });
});
