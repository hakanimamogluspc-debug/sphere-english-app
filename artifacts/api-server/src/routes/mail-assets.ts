/**
 * Medya Kütüphanesi — maillerde, duyurularda ve elle yazılan HTML'lerde kullanılan görseller.
 *
 * (Eski adı "Mail Assets"; tablo ve adresler geriye dönük uyumlu kalsın diye aynı:
 *  daha önce gönderilmiş maillerdeki /api/mail-assets/:id linkleri çalışmaya devam eder.)
 *
 * Neden kırılıyordu:
 *  - Görsel adresi, uygulamanın genel güvenlik ayarı yüzünden "Cross-Origin-Resource-Policy: same-origin"
 *    ile dönüyordu → başka bir sitede / tarayıcıdan açılan mail istemcisinde / önizleme çerçevesinde
 *    tarayıcı görseli engelliyordu. Artık "cross-origin".
 *  - WebP / HEIC gibi formatlar Outlook'ta görünmüyor → admin sayfası yüklemeden önce görseli
 *    tarayıcıda JPEG/PNG'ye çevirip maile uygun boyuta küçültüyor; sunucu yalnızca JPEG/PNG/GIF kabul eder.
 *
 * Dosyalar Hetzner Object Storage'da (S3_* tanımlıysa), değilse veritabanında tutulur.
 *
 * Endpoints:
 *   POST   /admin/mail-assets/upload            → multipart (image, description, width, height) (admin)
 *   GET    /admin/mail-assets                   → liste (?q=&limit=) (admin)
 *   PATCH  /admin/mail-assets/:id               → açıklama (alt metin) güncelle (admin)
 *   DELETE /admin/mail-assets/:id               → sil (admin)
 *   POST   /admin/mail-assets/migrate-storage   → veritabanındaki eski görselleri depoya taşı (admin)
 *   GET    /api/mail-assets/:id[/:dosya-adi]    → görsel (herkese açık, mail istemcileri için)
 */

import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import crypto from "node:crypto";
import { sql, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { authMiddleware } from "../middlewares/auth.js";
import { storageEnabled, putObject, getObjectStream, deleteObject, safeFilename } from "../lib/object-storage.js";

const router = Router();

// ─── Multer config ────────────────────────────────────────────────────
const MAX_ASSET_SIZE = 8 * 1024 * 1024; // 8MB
/** Her mail istemcisinin gösterebildiği formatlar. WebP/HEIC Outlook'ta görünmüyor. */
export const MAIL_SAFE_MIMES = ["image/jpeg", "image/png", "image/gif"];
const assetUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_ASSET_SIZE },
  fileFilter: (_req, file, cb) => {
    const mime = file.mimetype === "image/jpg" ? "image/jpeg" : file.mimetype;
    if (MAIL_SAFE_MIMES.includes(mime)) return cb(null, true);
    cb(new Error("Sadece JPEG, PNG veya GIF (WebP/HEIC bazı mail programlarında görünmüyor — Medya sayfası otomatik çevirir)"));
  },
});

// ─── Auth helper ──────────────────────────────────────────────────────
async function requireAdmin(req: Request, res: Response, next: () => void) {
  const userId = (req as any).userId as number;
  const [me] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!me || me.role !== "admin") { res.status(403).json({ error: "Admin yetkisi gerekli" }); return; }
  next();
}

export function publicUrlFor(id: number, filename?: string | null): string {
  const base = process.env.PUBLIC_API_BASE_URL ?? "https://app.sphereenglish.com";
  const name = filename ? `/${encodeURIComponent(safeFilename(filename))}` : "";
  return `${base.replace(/\/$/, "")}/api/mail-assets/${id}${name}`;
}

function toAsset(r: any) {
  return {
    id: r.id, filename: r.filename, description: r.description, mime: r.mime, size: r.size,
    width: r.width ?? null, height: r.height ?? null,
    storage: r.storage_key ? "bucket" : "db",
    created_at: r.created_at,
    url: publicUrlFor(r.id, r.filename),
  };
}

function intOrNull(v: unknown): number | null {
  const n = parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) && n > 0 && n < 20000 ? n : null;
}

// ─── POST /admin/mail-assets/upload ──────────────────────────────────
router.post(
  "/admin/mail-assets/upload",
  authMiddleware,
  requireAdmin,
  (req: Request, res: Response, next: NextFunction) => {
    assetUpload.single("image")(req, res, (err: unknown) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(413).json({ error: `Dosya çok büyük (max ${MAX_ASSET_SIZE / 1024 / 1024}MB)` });
          }
          return res.status(400).json({ error: `Multer: ${err.message}` });
        }
        return res.status(400).json({ error: (err as Error)?.message ?? "Upload hata" });
      }
      next();
    });
  },
  async (req: Request, res: Response) => {
    try {
      const file = (req as any).file as any;
      if (!file) return res.status(400).json({ error: "Dosya eksik (field: image)" });

      const description = String(req.body?.description ?? "").trim().slice(0, 500);
      const userId = (req as any).userId as number;
      const buffer = file.buffer as Buffer;
      const mime = file.mimetype === "image/jpg" ? "image/jpeg" : file.mimetype;
      const filename = String(file.originalname ?? "gorsel").slice(0, 255);
      const width = intOrNull(req.body?.width);
      const height = intOrNull(req.body?.height);

      let storageKey: string | null = null;
      if (storageEnabled()) {
        const d = new Date();
        storageKey = `media/${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${crypto.randomUUID()}-${safeFilename(filename)}`;
        await putObject(storageKey, buffer, mime);
      }

      const inserted = await db.execute(sql`
        INSERT INTO mail_assets (filename, description, mime, size, data, storage_key, width, height, uploaded_by)
        VALUES (${filename}, ${description || null}, ${mime}, ${buffer.length},
                ${storageKey ? null : buffer}, ${storageKey}, ${width}, ${height}, ${userId})
        RETURNING id, filename, description, mime, size, storage_key, width, height, created_at
      `);
      const row = ((inserted.rows ?? inserted) as any[])[0];
      return res.json({ ok: true, asset: toAsset(row) });
    } catch (e: any) {
      console.error("[mail-assets/upload] HATA:", e?.message);
      return res.status(500).json({ error: e?.message ?? "Upload başarısız" });
    }
  },
);

// ─── GET /admin/mail-assets ──────────────────────────────────────────
router.get(
  "/admin/mail-assets",
  authMiddleware,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const limit = Math.min(300, parseInt(String(req.query.limit ?? "100"), 10) || 100);
      const q = String(req.query.q ?? "").trim().toLowerCase();
      const like = `%${q}%`;
      const rows = await db.execute(sql`
        SELECT id, filename, description, mime, size, storage_key, width, height, created_at
        FROM mail_assets
        ${q ? sql`WHERE LOWER(filename) LIKE ${like} OR LOWER(COALESCE(description, '')) LIKE ${like}` : sql``}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `);
      const counts = await db.execute(sql`
        SELECT COUNT(*)::int AS total,
               COUNT(*) FILTER (WHERE storage_key IS NULL)::int AS in_db
        FROM mail_assets
      `);
      const c = ((counts.rows ?? counts) as any[])[0] ?? {};
      return res.json({
        assets: ((rows.rows ?? rows) as any[]).map(toAsset),
        total: Number(c.total ?? 0),
        inDb: Number(c.in_db ?? 0),
        storageEnabled: storageEnabled(),
      });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message });
    }
  },
);

// ─── PATCH /admin/mail-assets/:id ────────────────────────────────────
router.patch(
  "/admin/mail-assets/:id",
  authMiddleware,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const id = parseInt(String((req.params.id as string) ?? ""), 10);
      if (!Number.isFinite(id)) return res.status(400).json({ error: "Geçersiz id" });
      const description = String(req.body?.description ?? "").trim().slice(0, 500);
      await db.execute(sql`UPDATE mail_assets SET description = ${description || null} WHERE id = ${id}`);
      return res.json({ ok: true });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message });
    }
  },
);

// ─── DELETE /admin/mail-assets/:id ───────────────────────────────────
router.delete(
  "/admin/mail-assets/:id",
  authMiddleware,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const id = parseInt(String((req.params.id as string) ?? ""), 10);
      if (!Number.isFinite(id)) return res.status(400).json({ error: "Geçersiz id" });
      const del = await db.execute(sql`DELETE FROM mail_assets WHERE id = ${id} RETURNING storage_key`);
      const key = ((del.rows ?? del) as any[])[0]?.storage_key as string | undefined;
      if (key) await deleteObject(key);
      return res.json({ ok: true });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message });
    }
  },
);

// ─── POST /admin/mail-assets/migrate-storage ─────────────────────────
// Veritabanında duran eski görselleri nesne deposuna taşır (adresleri değişmez).
router.post(
  "/admin/mail-assets/migrate-storage",
  authMiddleware,
  requireAdmin,
  async (_req: Request, res: Response) => {
    if (!storageEnabled()) return res.status(400).json({ error: "Nesne deposu yapılandırılmamış (S3_*)" });
    try {
      const rows = await db.execute(sql`SELECT id, filename, mime FROM mail_assets WHERE storage_key IS NULL AND data IS NOT NULL ORDER BY id`);
      let moved = 0;
      const errors: string[] = [];
      for (const r of (rows.rows ?? rows) as any[]) {
        try {
          const dataRows = await db.execute(sql`SELECT data FROM mail_assets WHERE id = ${r.id}`);
          const data = ((dataRows.rows ?? dataRows) as any[])[0]?.data as Buffer;
          const key = `media/legacy/${r.id}-${safeFilename(String(r.filename ?? "gorsel"))}`;
          await putObject(key, Buffer.from(data), r.mime || "image/jpeg");
          await db.execute(sql`UPDATE mail_assets SET storage_key = ${key}, data = NULL WHERE id = ${r.id}`);
          moved++;
        } catch (e: any) {
          errors.push(`#${r.id}: ${e?.message}`);
        }
      }
      return res.json({ ok: errors.length === 0, moved, errors });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message });
    }
  },
);

// ─── GET /api/mail-assets/:id[/:dosya-adi] ───────────────────────────
// Herkese açık. Mail istemcileri ve başka sitelerdeki HTML'ler doğrudan buradan yükler.
router.get(["/mail-assets/:id", "/mail-assets/:id/:name"], async (req: Request, res: Response) => {
  try {
    const id = parseInt(String((req.params.id as string) ?? ""), 10);
    if (!Number.isFinite(id)) return res.status(400).send("Geçersiz id");

    const rows = await db.execute(sql`
      SELECT mime, size, filename, storage_key, (storage_key IS NULL) AS from_db
      FROM mail_assets WHERE id = ${id} LIMIT 1
    `);
    const row = ((rows.rows ?? rows) as any[])[0];
    if (!row) return res.status(404).send("Görsel bulunamadı");

    const etag = `"ma-${id}-${row.size}"`;
    // Başka sitelerde / mail istemcilerinde gösterilebilsin (uygulama geneli "same-origin" ayarını ez)
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("ETag", etag);
    if (req.headers["if-none-match"] === etag) return res.status(304).end();

    res.setHeader("Content-Type", row.mime || "image/jpeg");
    if (row.filename) {
      res.setHeader("Content-Disposition", `inline; filename="${safeFilename(String(row.filename))}"`);
    }

    if (row.storage_key) {
      const obj = await getObjectStream(row.storage_key);
      if (obj.contentLength) res.setHeader("Content-Length", String(obj.contentLength));
      obj.stream.on("error", () => { if (!res.headersSent) res.status(500); res.end(); });
      return obj.stream.pipe(res);
    }

    const dataRows = await db.execute(sql`SELECT data FROM mail_assets WHERE id = ${id}`);
    const data = ((dataRows.rows ?? dataRows) as any[])[0]?.data;
    if (!data) return res.status(404).send("Görsel bulunamadı");
    res.setHeader("Content-Length", String(data.length));
    return res.send(data);
  } catch (e: any) {
    console.error("[mail-assets/stream] HATA:", e?.message);
    if (!res.headersSent) return res.status(500).send("Sunucu hatası");
    res.end();
  }
});

export default router;
