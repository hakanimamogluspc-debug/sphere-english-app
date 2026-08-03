/**
 * Mail Assets — admin mail şablonlarında kullanılan görseller.
 *
 * Amaç: kullanıcı bir mail için görsel yüklesin (ürün kapağı, banner vs),
 * absolute URL üretilsin, GPT-4o bunu <img src="..."> olarak mail'e yerleştirsin.
 *
 * DB'de bytea olarak saklanır (Easypanel ephemeral filesystem çözümü),
 * public URL /api/mail-assets/:id → mail client'lardan erişilebilir olmalı (no auth).
 *
 * Endpoints:
 *   POST /admin/mail-assets/upload  → multipart, DB'ye yaz (auth: admin)
 *   GET  /admin/mail-assets         → listem (auth: admin)
 *   DELETE /admin/mail-assets/:id   → sil (auth: admin)
 *   GET  /api/mail-assets/:id       → binary stream (public, mail client için)
 */

import { Router, Request, Response } from "express";
import multer from "multer";
import { sql, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { authMiddleware } from "../middlewares/auth.js";

const router = Router();

// ─── Multer config ────────────────────────────────────────────────────
const MAX_ASSET_SIZE = 8 * 1024 * 1024; // 8MB — mail görseli için fazlasıyla yeter
const assetUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_ASSET_SIZE },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new Error("Sadece JPEG, PNG, WebP veya GIF"));
  },
});

// ─── Auth helper ──────────────────────────────────────────────────────
async function requireAdmin(req: Request, res: Response, next: () => void) {
  const userId = (req as any).userId as number;
  const [me] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!me || me.role !== "admin") return res.status(403).json({ error: "Admin yetkisi gerekli" });
  next();
}

function publicUrlFor(id: number): string {
  const base = process.env.PUBLIC_API_BASE_URL ?? "https://app.sphereenglish.com";
  return `${base.replace(/\/$/, "")}/api/mail-assets/${id}`;
}

// ─── POST /admin/mail-assets/upload ──────────────────────────────────
// Tek dosya (image) upload. Description opsiyonel (form field)
router.post(
  "/admin/mail-assets/upload",
  authMiddleware,
  requireAdmin,
  (req, res, next) => {
    assetUpload.single("image")(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(413).json({ error: `Dosya çok büyük (max ${MAX_ASSET_SIZE / 1024 / 1024}MB)` });
          }
          return res.status(400).json({ error: `Multer: ${err.message}` });
        }
        return res.status(400).json({ error: err.message ?? "Upload hata" });
      }
      next();
    });
  },
  async (req: Request, res: Response) => {
    try {
      const file = (req as any).file as any;
      if (!file) return res.status(400).json({ error: "Dosya eksik (field: image)" });

      const description = String(req.body?.description ?? "").slice(0, 500);
      const userId = (req as any).userId as number;

      const buffer = file.buffer as Buffer;
      const mime = file.mimetype;
      const filename = String(file.originalname ?? "asset").slice(0, 255);
      const size = buffer.length;

      const inserted = await db.execute(sql`
        INSERT INTO mail_assets (filename, description, mime, size, data, uploaded_by)
        VALUES (${filename}, ${description || null}, ${mime}, ${size}, ${buffer}, ${userId})
        RETURNING id, filename, description, mime, size, created_at
      `);
      const row = ((inserted.rows ?? inserted) as any[])[0];

      return res.json({
        ok: true,
        asset: {
          ...row,
          url: publicUrlFor(row.id),
        },
      });
    } catch (e: any) {
      console.error("[mail-assets/upload] HATA:", e?.message);
      return res.status(500).json({ error: e?.message ?? "Upload başarısız" });
    }
  },
);

// ─── GET /admin/mail-assets ──────────────────────────────────────────
// Listem — son yüklenen görseller
router.get(
  "/admin/mail-assets",
  authMiddleware,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const limit = Math.min(100, parseInt(String(req.query.limit ?? "50"), 10) || 50);
      const rows = await db.execute(sql`
        SELECT id, filename, description, mime, size, uploaded_by, created_at
        FROM mail_assets
        ORDER BY created_at DESC
        LIMIT ${limit}
      `);
      const assets = ((rows.rows ?? rows) as any[]).map((r) => ({
        ...r,
        url: publicUrlFor(r.id),
      }));
      return res.json({ assets });
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
      const id = parseInt(String(req.params.id ?? ""), 10);
      if (!Number.isFinite(id)) return res.status(400).json({ error: "Geçersiz id" });
      await db.execute(sql`DELETE FROM mail_assets WHERE id = ${id}`);
      return res.json({ ok: true });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message });
    }
  },
);

// ─── GET /api/mail-assets/:id ────────────────────────────────────────
// Public binary stream — mail client'ları erişebilmeli, auth YOK
router.get("/mail-assets/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id ?? ""), 10);
    if (!Number.isFinite(id)) return res.status(400).send("Geçersiz id");

    const rows = await db.execute(sql`
      SELECT data, mime, size, filename
      FROM mail_assets
      WHERE id = ${id}
      LIMIT 1
    `);
    const row = ((rows.rows ?? rows) as any[])[0];
    if (!row || !row.data) return res.status(404).send("Görsel bulunamadı");

    res.setHeader("Content-Type", row.mime || "image/jpeg");
    if (row.size) res.setHeader("Content-Length", String(row.size));
    // Uzun cache — mail'de kullanılıyor, sık değişmez
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    // CORS — mail client'lar için
    res.setHeader("Access-Control-Allow-Origin", "*");
    // filename indirmede kullanılsın
    if (row.filename) {
      res.setHeader("Content-Disposition", `inline; filename="${row.filename}"`);
    }
    return res.send(row.data);
  } catch (e: any) {
    console.error("[mail-assets/stream] HATA:", e?.message);
    return res.status(500).send("Sunucu hatası");
  }
});

export default router;
