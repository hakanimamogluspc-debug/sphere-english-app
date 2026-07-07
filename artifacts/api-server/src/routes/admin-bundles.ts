/**
 * E-Kitap Paketleri — Admin CRUD endpoints
 *
 * Admin panelde bundle yönetimi:
 *   GET    /api/admin/bundles                — Tüm paketler (aktif + pasif)
 *   GET    /api/admin/bundles/:id            — Tek paket detay + items
 *   POST   /api/admin/bundles                — Yeni paket oluştur
 *   PATCH  /api/admin/bundles/:id            — Paket bilgilerini güncelle
 *   POST   /api/admin/bundles/:id/items      — Paket item listesini güncelle (replace all)
 *   POST   /api/admin/bundles/:id/toggle     — Aktif/pasif toggle
 *   DELETE /api/admin/bundles/:id            — Sil (satış yoksa)
 */

import { Router, type IRouter, Request, Response } from "express";
import multer from "multer";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth.js";

// Kapak görseli için multer — max 5MB (görsel için yeterli)
const MAX_COVER_SIZE = 5 * 1024 * 1024;
const coverUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_COVER_SIZE },
  fileFilter: (_req, file, cb) => {
    // Sadece görsel MIME tipleri kabul et
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Sadece görsel dosyaları (JPG/PNG/WebP) kabul edilir"));
    }
  },
});

const router: IRouter = Router();

function normalizeSlug(input: string): string {
  return String(input || "")
    .toLowerCase()
    .trim()
    .replace(/[çÇ]/g, "c")
    .replace(/[ğĞ]/g, "g")
    .replace(/[ıİI]/g, "i")
    .replace(/[öÖ]/g, "o")
    .replace(/[şŞ]/g, "s")
    .replace(/[üÜ]/g, "u")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// ─── LİSTE ──────────────────────────────────────────────────────────────
router.get(
  "/admin/bundles",
  authMiddleware,
  requireRole("admin"),
  async (_req: AuthRequest, res: Response) => {
    try {
      const rows = await db.execute(sql`
        SELECT
          b.id, b.slug, b.title, b.subtitle,
          b.cover_image_url, b.price_try, b.list_price_try, b.currency,
          b.is_active, b.is_featured, b.sort_order,
          b.created_at, b.updated_at,
          (SELECT COUNT(*)::INT FROM ebook_bundle_items WHERE bundle_id = b.id) AS item_count,
          (SELECT COUNT(*)::INT FROM ebook_purchases WHERE bundle_id = b.id AND payment_status = 'success') AS sales_count
        FROM ebook_bundles b
        ORDER BY b.is_featured DESC, b.sort_order ASC, b.created_at DESC
      `);
      return res.json({ bundles: rows.rows ?? rows });
    } catch (e: any) {
      console.error("[ADMIN-BUNDLES] list HATA:", e?.message);
      return res.status(500).json({ error: "Paketler alınamadı" });
    }
  },
);

// ─── TEK PAKET DETAY ────────────────────────────────────────────────────
router.get(
  "/admin/bundles/:id",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response, next: any) => {
    if (!/^\d+$/.test(String(req.params.id ?? ""))) return next();
    const id = parseInt(req.params.id, 10);
    try {
      const bundleRows = await db.execute(sql`SELECT * FROM ebook_bundles WHERE id = ${id} LIMIT 1`);
      const bundle = (bundleRows.rows ?? bundleRows)[0];
      if (!bundle) return res.status(404).json({ error: "Paket bulunamadı" });

      const itemRows = await db.execute(sql`
        SELECT bi.id AS item_id, bi.position, e.id, e.slug, e.title, e.author,
               e.cover_image_url, e.price_try, e.is_active
        FROM ebook_bundle_items bi
        JOIN ebooks e ON bi.ebook_id = e.id
        WHERE bi.bundle_id = ${id}
        ORDER BY bi.position, bi.id
      `);
      return res.json({
        bundle,
        items: itemRows.rows ?? itemRows,
      });
    } catch (e: any) {
      return res.status(500).json({ error: "Detay alınamadı: " + e?.message });
    }
  },
);

// ─── YENİ PAKET ─────────────────────────────────────────────────────────
router.post(
  "/admin/bundles",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    const b = (req.body ?? {}) as any;
    if (!b.title || b.priceTry == null) {
      return res.status(400).json({ error: "Zorunlu alanlar: title, priceTry" });
    }
    const slug = b.slug ? normalizeSlug(b.slug) : normalizeSlug(b.title);
    if (!slug || slug.length < 3) {
      return res.status(400).json({ error: "Geçersiz slug — en az 3 karakter" });
    }

    try {
      const inserted = await db.execute(sql`
        INSERT INTO ebook_bundles (
          slug, title, subtitle, description, cover_image_url,
          price_try, list_price_try, currency,
          is_active, is_featured, sort_order,
          tags, seo_title, seo_description, seo_keywords
        ) VALUES (
          ${slug}, ${b.title}, ${b.subtitle ?? null}, ${b.description ?? null},
          ${b.coverImageUrl ?? null},
          ${Number(b.priceTry)}, ${b.listPriceTry != null ? Number(b.listPriceTry) : null},
          ${b.currency ?? "TRY"},
          ${b.isActive ?? true}, ${b.isFeatured ?? false}, ${Number(b.sortOrder ?? 0)},
          ${JSON.stringify(b.tags ?? [])}::JSONB,
          ${b.seoTitle ?? null}, ${b.seoDescription ?? null}, ${b.seoKeywords ?? null}
        )
        RETURNING id, slug
      `);
      const newRow = (inserted.rows ?? inserted)[0];

      // ebookIds gönderildiyse item olarak ekle
      if (Array.isArray(b.ebookIds) && b.ebookIds.length > 0 && newRow) {
        const bundleId = Number((newRow as any).id);
        for (let i = 0; i < b.ebookIds.length; i++) {
          const ebookId = Number(b.ebookIds[i]);
          if (!Number.isFinite(ebookId)) continue;
          await db.execute(sql`
            INSERT INTO ebook_bundle_items (bundle_id, ebook_id, position)
            VALUES (${bundleId}, ${ebookId}, ${i})
            ON CONFLICT (bundle_id, ebook_id) DO NOTHING
          `);
        }
      }

      return res.status(201).json({ ok: true, bundle: newRow });
    } catch (e: any) {
      console.error("[ADMIN-BUNDLES] create HATA:", e?.message);
      if (String(e?.message ?? "").includes("ebook_bundles_slug_unique")) {
        return res.status(409).json({ error: "Bu slug zaten kullanımda" });
      }
      return res.status(500).json({ error: "Eklenemedi: " + e?.message });
    }
  },
);

// ─── PAKET GÜNCELLE ─────────────────────────────────────────────────────
router.patch(
  "/admin/bundles/:id",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response, next: any) => {
    if (!/^\d+$/.test(String(req.params.id ?? ""))) return next();
    const id = parseInt(req.params.id, 10);
    const b = (req.body ?? {}) as any;

    // Dinamik update — sadece gönderilen alanlar
    const sets: any[] = [];
    if (b.slug !== undefined) sets.push(sql`slug = ${normalizeSlug(String(b.slug))}`);
    if (b.title !== undefined) sets.push(sql`title = ${String(b.title)}`);
    if (b.subtitle !== undefined) sets.push(sql`subtitle = ${b.subtitle ?? null}`);
    if (b.description !== undefined) sets.push(sql`description = ${b.description ?? null}`);
    if (b.coverImageUrl !== undefined) sets.push(sql`cover_image_url = ${b.coverImageUrl ?? null}`);
    if (b.priceTry !== undefined) sets.push(sql`price_try = ${Number(b.priceTry)}`);
    if (b.listPriceTry !== undefined) {
      sets.push(sql`list_price_try = ${b.listPriceTry == null ? null : Number(b.listPriceTry)}`);
    }
    if (b.isActive !== undefined) sets.push(sql`is_active = ${!!b.isActive}`);
    if (b.isFeatured !== undefined) sets.push(sql`is_featured = ${!!b.isFeatured}`);
    if (b.sortOrder !== undefined) sets.push(sql`sort_order = ${Number(b.sortOrder)}`);
    if (b.tags !== undefined) sets.push(sql`tags = ${JSON.stringify(b.tags)}::JSONB`);
    if (b.seoTitle !== undefined) sets.push(sql`seo_title = ${b.seoTitle ?? null}`);
    if (b.seoDescription !== undefined) sets.push(sql`seo_description = ${b.seoDescription ?? null}`);
    if (b.seoKeywords !== undefined) sets.push(sql`seo_keywords = ${b.seoKeywords ?? null}`);

    if (sets.length === 0) return res.status(400).json({ error: "Güncellenecek alan yok" });
    sets.push(sql`updated_at = NOW()`);

    try {
      await db.execute(sql`UPDATE ebook_bundles SET ${sql.join(sets, sql`, `)} WHERE id = ${id}`);
      return res.json({ ok: true });
    } catch (e: any) {
      console.error("[ADMIN-BUNDLES] update HATA:", e?.message);
      if (String(e?.message ?? "").includes("ebook_bundles_slug_unique")) {
        return res.status(409).json({ error: "Bu slug zaten kullanımda" });
      }
      return res.status(500).json({ error: "Güncellenemedi: " + e?.message });
    }
  },
);

// ─── PAKET İTEM'LARINI GÜNCELLE (replace all) ───────────────────────────
router.post(
  "/admin/bundles/:id/items",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response, next: any) => {
    if (!/^\d+$/.test(String(req.params.id ?? ""))) return next();
    const id = parseInt(req.params.id, 10);
    const ebookIds = Array.isArray(req.body?.ebookIds) ? req.body.ebookIds : null;
    if (!ebookIds) {
      return res.status(400).json({ error: "ebookIds array gerekli" });
    }

    try {
      // Mevcut item'ları sil
      await db.execute(sql`DELETE FROM ebook_bundle_items WHERE bundle_id = ${id}`);

      // Yeni item'ları sırayla ekle
      for (let i = 0; i < ebookIds.length; i++) {
        const ebookId = Number(ebookIds[i]);
        if (!Number.isFinite(ebookId)) continue;
        await db.execute(sql`
          INSERT INTO ebook_bundle_items (bundle_id, ebook_id, position)
          VALUES (${id}, ${ebookId}, ${i})
          ON CONFLICT (bundle_id, ebook_id) DO NOTHING
        `);
      }

      // Güncellenmiş bundle'ı updated_at ile işaretle
      await db.execute(sql`UPDATE ebook_bundles SET updated_at = NOW() WHERE id = ${id}`);

      return res.json({ ok: true, itemCount: ebookIds.length });
    } catch (e: any) {
      console.error("[ADMIN-BUNDLES] items update HATA:", e?.message);
      return res.status(500).json({ error: "İtem'lar güncellenemedi: " + e?.message });
    }
  },
);

// ─── AKTIF/PASİF TOGGLE ─────────────────────────────────────────────────
router.post(
  "/admin/bundles/:id/toggle",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response, next: any) => {
    if (!/^\d+$/.test(String(req.params.id ?? ""))) return next();
    const id = parseInt(req.params.id, 10);
    try {
      await db.execute(sql`
        UPDATE ebook_bundles SET is_active = NOT is_active, updated_at = NOW()
        WHERE id = ${id}
      `);
      return res.json({ ok: true });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message });
    }
  },
);

// ─── KAPAK GÖRSELİ YÜKLE ────────────────────────────────────────────────
router.post(
  "/admin/bundles/:id/cover",
  authMiddleware,
  requireRole("admin"),
  coverUpload.single("file"),
  async (req: AuthRequest, res: Response, next: any) => {
    if (!/^\d+$/.test(String(req.params.id ?? ""))) return next();
    const id = parseInt(req.params.id, 10);

    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) return res.status(400).json({ error: "Dosya yüklenmedi" });

    try {
      const buffer = file.buffer;
      const mime = file.mimetype;
      const size = file.size;

      // Tam URL — www tarafından direkt <img src> ile çağrılabilir
      const ASSET_BASE = process.env["PUBLIC_ASSET_BASE_URL"] ?? "https://app.sphereenglish.com/api-server";
      const coverUrl = `${ASSET_BASE.replace(/\/$/, "")}/api/bundle-cover/${id}`;

      // DB'ye BYTEA olarak kaydet + full URL
      await db.execute(sql`
        UPDATE ebook_bundles SET
          cover_data = ${buffer},
          cover_mime = ${mime},
          cover_size = ${size},
          cover_image_url = ${coverUrl},
          updated_at = NOW()
        WHERE id = ${id}
      `);

      return res.json({
        ok: true,
        url: coverUrl,
        mime,
        size,
      });
    } catch (e: any) {
      console.error("[ADMIN-BUNDLES] cover upload HATA:", e?.message);
      return res.status(500).json({ error: "Kapak yüklenemedi: " + e?.message });
    }
  },
);

// ─── KAPAK GÖRSELİ SİL ──────────────────────────────────────────────────
router.delete(
  "/admin/bundles/:id/cover",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response, next: any) => {
    if (!/^\d+$/.test(String(req.params.id ?? ""))) return next();
    const id = parseInt(req.params.id, 10);
    try {
      await db.execute(sql`
        UPDATE ebook_bundles SET
          cover_data = NULL,
          cover_mime = NULL,
          cover_size = NULL,
          cover_image_url = NULL,
          updated_at = NOW()
        WHERE id = ${id}
      `);
      return res.json({ ok: true });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message });
    }
  },
);

// ─── SİL ────────────────────────────────────────────────────────────────
router.delete(
  "/admin/bundles/:id",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response, next: any) => {
    if (!/^\d+$/.test(String(req.params.id ?? ""))) return next();
    const id = parseInt(req.params.id, 10);
    try {
      // Satış varsa sadece pasif yap, silme
      const salesRows = await db.execute(sql`
        SELECT COUNT(*)::INT AS cnt FROM ebook_purchases
        WHERE bundle_id = ${id} AND payment_status = 'success'
      `);
      const salesCount = Number((salesRows.rows ?? salesRows)[0]?.cnt ?? 0);
      if (salesCount > 0) {
        return res.status(409).json({
          error: `Bu paketin ${salesCount} adet satışı var — silinemez. Pasif yapabilirsin.`,
        });
      }

      await db.execute(sql`DELETE FROM ebook_bundles WHERE id = ${id}`);
      return res.json({ ok: true });
    } catch (e: any) {
      console.error("[ADMIN-BUNDLES] delete HATA:", e?.message);
      return res.status(500).json({ error: "Silinemedi: " + e?.message });
    }
  },
);

export default router;
