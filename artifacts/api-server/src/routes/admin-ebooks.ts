/**
 * E-kitap admin yönetimi + public asset stream.
 *
 * Admin endpoint'leri:
 *   GET    /api/admin/ebooks                        → tüm kitaplar (aktif+pasif)
 *   GET    /api/admin/ebooks/:id                    → tek kitap + asset listesi
 *   POST   /api/admin/ebooks                        → yeni kitap (JSON body)
 *   PATCH  /api/admin/ebooks/:id                    → kitap güncelle
 *   DELETE /api/admin/ebooks/:id                    → kitap sil (asset'lar cascade)
 *   POST   /api/admin/ebooks/:id/assets             → asset yükle (multer)
 *                                                     Form: file, assetType, position?
 *   DELETE /api/admin/ebook-assets/:assetId         → asset sil
 *   PATCH  /api/admin/ebook-assets/:assetId         → position güncelle
 *
 * Public endpoint:
 *   GET    /api/ebooks/asset/:assetId               → asset binary stream
 *
 * Tüm dosyalar (görsel + PDF) bytea olarak DB'de saklanır — Easypanel
 * ephemeral filesystem sorununu çözer.
 */

import { Router, Request, Response } from "express";
import multer from "multer";
import { sql } from "drizzle-orm";
import { db, pool } from "@workspace/db";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth.js";

const router = Router();

const MAX_ASSET_SIZE = 15 * 1024 * 1024; // 15 MB (PDF için yeterli)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_ASSET_SIZE },
});

const VALID_ASSET_TYPES = ["cover", "gallery", "preview", "full"] as const;

// ─── ADMIN: TÜM KİTAPLAR (aktif + pasif) ─────────────────────────────────
router.get(
  "/admin/ebooks",
  authMiddleware,
  requireRole("admin"),
  async (_req: AuthRequest, res: Response) => {
    try {
      const rows = await db.execute(sql`
        SELECT id, slug, title, subtitle, author, price_try, list_price_try,
               is_active, is_featured, published_at, created_at, updated_at,
               (SELECT COUNT(*) FROM ebook_assets WHERE ebook_id = ebooks.id) AS asset_count
        FROM ebooks
        ORDER BY is_featured DESC, published_at DESC
      `);
      return res.json({ ebooks: rows.rows ?? rows });
    } catch (e: any) {
      console.error("[ADMIN-EBOOKS] list HATA:", e?.message);
      return res.status(500).json({ error: "Kitaplar alınamadı" });
    }
  },
);

// ─── ADMIN: TEK KİTAP + ASSET LİSTESİ ────────────────────────────────────
router.get(
  "/admin/ebooks/:id",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Geçersiz id" });
    try {
      const ebookRows = await db.execute(sql`SELECT * FROM ebooks WHERE id = ${id}`);
      const ebook = (ebookRows.rows ?? ebookRows)[0];
      if (!ebook) return res.status(404).json({ error: "Kitap bulunamadı" });

      // Asset listesi — data_base64 hariç (büyük olduğu için)
      const assetRows = await db.execute(sql`
        SELECT id, asset_type, position, filename, mime_type, size_bytes, created_at
        FROM ebook_assets
        WHERE ebook_id = ${id}
        ORDER BY asset_type, position
      `);
      return res.json({ ebook, assets: assetRows.rows ?? assetRows });
    } catch (e: any) {
      return res.status(500).json({ error: "Detay alınamadı: " + e?.message });
    }
  },
);

// ─── ADMIN: YENİ KİTAP ──────────────────────────────────────────────────
router.post(
  "/admin/ebooks",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    const b = req.body ?? {};
    if (!b.slug || !b.title || !b.description || !b.author || b.priceTry == null) {
      return res.status(400).json({ error: "Zorunlu: slug, title, description, author, priceTry" });
    }
    try {
      const inserted = await db.execute(sql`
        INSERT INTO ebooks (
          slug, title, subtitle, description, long_description, table_of_contents,
          author, publisher, isbn, language, content_language,
          series_slug, series_order, series_title,
          page_count, reading_time_min, category, tags,
          price_try, list_price_try, currency,
          is_active, is_featured,
          seo_title, seo_description, seo_keywords
        ) VALUES (
          ${b.slug}, ${b.title}, ${b.subtitle ?? null}, ${b.description}, ${b.longDescription ?? null}, ${b.tableOfContents ?? null},
          ${b.author}, ${b.publisher ?? "Sphere English"}, ${b.isbn ?? null},
          ${b.language ?? "tr"}, ${b.contentLanguage ?? null},
          ${b.seriesSlug ?? null}, ${b.seriesOrder ?? null}, ${b.seriesTitle ?? null},
          ${b.pageCount ?? null}, ${b.readingTimeMin ?? null}, ${b.category ?? null},
          ${JSON.stringify(b.tags ?? [])}::JSONB,
          ${b.priceTry}, ${b.listPriceTry ?? null}, ${b.currency ?? "TRY"},
          ${b.isActive ?? true}, ${b.isFeatured ?? false},
          ${b.seoTitle ?? null}, ${b.seoDescription ?? null}, ${b.seoKeywords ?? null}
        )
        RETURNING id, slug
      `);
      const newRow = (inserted.rows ?? inserted)[0];
      return res.status(201).json({ ok: true, ebook: newRow });
    } catch (e: any) {
      console.error("[ADMIN-EBOOKS] create HATA:", e?.message);
      // Slug çakışması
      if (String(e?.message ?? "").includes("ebooks_slug_unique")) {
        return res.status(409).json({ error: "Bu slug zaten kullanımda" });
      }
      return res.status(500).json({ error: "Eklenemedi: " + e?.message });
    }
  },
);

// ─── ADMIN: KİTAP GÜNCELLE ──────────────────────────────────────────────
router.patch(
  "/admin/ebooks/:id",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Geçersiz id" });
    const b = req.body ?? {};

    // Dinamik update — sadece gönderilen alanları güncelle
    const updates: any[] = [];
    const fields: Record<string, any> = {
      slug: b.slug, title: b.title, subtitle: b.subtitle, description: b.description,
      long_description: b.longDescription, table_of_contents: b.tableOfContents,
      author: b.author, publisher: b.publisher, isbn: b.isbn,
      language: b.language, content_language: b.contentLanguage,
      series_slug: b.seriesSlug, series_order: b.seriesOrder, series_title: b.seriesTitle,
      page_count: b.pageCount, reading_time_min: b.readingTimeMin, category: b.category,
      price_try: b.priceTry, list_price_try: b.listPriceTry,
      is_active: b.isActive, is_featured: b.isFeatured,
      seo_title: b.seoTitle, seo_description: b.seoDescription, seo_keywords: b.seoKeywords,
    };
    const sets: string[] = [];
    const params: any[] = [];
    for (const [k, v] of Object.entries(fields)) {
      if (v !== undefined) {
        sets.push(`${k} = $${params.length + 1}`);
        params.push(v);
      }
    }
    if (b.tags !== undefined) {
      sets.push(`tags = $${params.length + 1}::JSONB`);
      params.push(JSON.stringify(b.tags));
    }
    if (sets.length === 0) return res.json({ ok: true, message: "Değişiklik yok" });
    sets.push(`updated_at = NOW()`);
    params.push(id);

    const queryText = `UPDATE ebooks SET ${sets.join(", ")} WHERE id = $${params.length}`;
    try {
      await pool.query(queryText, params);
      return res.json({ ok: true });
    } catch (e: any) {
      console.error("[ADMIN-EBOOKS] update HATA:", e?.message);
      return res.status(500).json({ error: "Güncellenemedi: " + e?.message });
    }
  },
);

// ─── ADMIN: KİTAP SİL ───────────────────────────────────────────────────
router.delete(
  "/admin/ebooks/:id",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Geçersiz id" });
    try {
      // ON DELETE CASCADE ile assets de silinir
      await db.execute(sql`DELETE FROM ebooks WHERE id = ${id}`);
      return res.json({ ok: true });
    } catch (e: any) {
      return res.status(500).json({ error: "Silinemedi: " + e?.message });
    }
  },
);

// ─── ADMIN: ASSET YÜKLE ─────────────────────────────────────────────────
router.post(
  "/admin/ebooks/:id/assets",
  authMiddleware,
  requireRole("admin"),
  upload.single("file"),
  async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Geçersiz id" });
    const file = req.file;
    if (!file) return res.status(400).json({ error: "Dosya yok (form alanı: file)" });

    const assetType = String(req.body?.assetType ?? "").trim();
    if (!VALID_ASSET_TYPES.includes(assetType as any)) {
      return res.status(400).json({ error: "Geçersiz assetType. Kullanılabilir: " + VALID_ASSET_TYPES.join(", ") });
    }
    const position = parseInt(req.body?.position ?? "0", 10) || 0;

    try {
      // Cover, preview, full için tek satır kuralı — eskisini sil
      if (assetType !== "gallery") {
        await db.execute(sql`
          DELETE FROM ebook_assets
          WHERE ebook_id = ${id} AND asset_type = ${assetType}
        `);
      }

      const dataBase64 = file.buffer.toString("base64");
      const inserted = await db.execute(sql`
        INSERT INTO ebook_assets (
          ebook_id, asset_type, position, filename, mime_type, size_bytes, data_base64
        ) VALUES (
          ${id}, ${assetType}, ${position}, ${file.originalname}, ${file.mimetype}, ${file.size}, ${dataBase64}
        )
        RETURNING id, asset_type, position, filename, mime_type, size_bytes, created_at
      `);
      const newAsset = (inserted.rows ?? inserted)[0] as any;

      // ebooks tablosundaki ilgili URL alanını otomatik güncelle
      const ASSET_BASE = process.env["PUBLIC_ASSET_BASE_URL"] ?? "https://app.sphereenglish.com/api-server";
      const assetUrl = `${ASSET_BASE.replace(/\/$/, "")}/api/ebooks/asset/${newAsset.id}`;
      if (assetType === "cover") {
        await db.execute(sql`UPDATE ebooks SET cover_image_url = ${assetUrl}, updated_at = NOW() WHERE id = ${id}`);
      } else if (assetType === "preview") {
        await db.execute(sql`UPDATE ebooks SET preview_pdf_url = ${assetUrl}, updated_at = NOW() WHERE id = ${id}`);
      } else if (assetType === "full") {
        await db.execute(sql`UPDATE ebooks SET full_pdf_path = ${assetUrl}, updated_at = NOW() WHERE id = ${id}`);
      } else if (assetType === "gallery") {
        // gallery_urls JSONB array — rebuild from ebook_assets
        const galleryRows = await db.execute(sql`
          SELECT id FROM ebook_assets
          WHERE ebook_id = ${id} AND asset_type = 'gallery'
          ORDER BY position, id
        `);
        const urls = (galleryRows.rows ?? galleryRows).map(
          (r: any) => `${ASSET_BASE.replace(/\/$/, "")}/api/ebooks/asset/${r.id}`,
        );
        await db.execute(sql`
          UPDATE ebooks SET gallery_urls = ${JSON.stringify(urls)}::JSONB, updated_at = NOW()
          WHERE id = ${id}
        `);
      }

      return res.status(201).json({ ok: true, asset: newAsset, url: assetUrl });
    } catch (e: any) {
      console.error("[ADMIN-EBOOKS] asset upload HATA:", e?.message);
      if (e?.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ error: "Dosya 15MB sınırını aşıyor" });
      }
      return res.status(500).json({ error: "Yüklenemedi: " + e?.message });
    }
  },
);

// ─── ADMIN: ASSET SİL ───────────────────────────────────────────────────
router.delete(
  "/admin/ebook-assets/:assetId",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.assetId, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Geçersiz id" });
    try {
      // Önce hangi ebook ve tipte olduğunu öğren
      const rows = await db.execute(sql`
        SELECT ebook_id, asset_type FROM ebook_assets WHERE id = ${id}
      `);
      const a = (rows.rows ?? rows)[0] as any;
      if (!a) return res.status(404).json({ error: "Asset bulunamadı" });

      await db.execute(sql`DELETE FROM ebook_assets WHERE id = ${id}`);

      // ebooks tablosundaki URL alanını güncelle
      if (a.asset_type === "cover") {
        await db.execute(sql`UPDATE ebooks SET cover_image_url = NULL, updated_at = NOW() WHERE id = ${a.ebook_id}`);
      } else if (a.asset_type === "preview") {
        await db.execute(sql`UPDATE ebooks SET preview_pdf_url = NULL, updated_at = NOW() WHERE id = ${a.ebook_id}`);
      } else if (a.asset_type === "full") {
        await db.execute(sql`UPDATE ebooks SET full_pdf_path = NULL, updated_at = NOW() WHERE id = ${a.ebook_id}`);
      } else if (a.asset_type === "gallery") {
        const ASSET_BASE = process.env["PUBLIC_ASSET_BASE_URL"] ?? "https://app.sphereenglish.com/api-server";
        const galleryRows = await db.execute(sql`
          SELECT id FROM ebook_assets
          WHERE ebook_id = ${a.ebook_id} AND asset_type = 'gallery'
          ORDER BY position, id
        `);
        const urls = (galleryRows.rows ?? galleryRows).map(
          (r: any) => `${ASSET_BASE.replace(/\/$/, "")}/api/ebooks/asset/${r.id}`,
        );
        await db.execute(sql`
          UPDATE ebooks SET gallery_urls = ${JSON.stringify(urls)}::JSONB, updated_at = NOW()
          WHERE id = ${a.ebook_id}
        `);
      }
      return res.json({ ok: true });
    } catch (e: any) {
      return res.status(500).json({ error: "Silinemedi: " + e?.message });
    }
  },
);

// ─── ADMIN: ASSET POSITION GÜNCELLE ─────────────────────────────────────
router.patch(
  "/admin/ebook-assets/:assetId",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.assetId, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Geçersiz id" });
    const position = parseInt(req.body?.position ?? "0", 10) || 0;
    try {
      await db.execute(sql`UPDATE ebook_assets SET position = ${position} WHERE id = ${id}`);
      return res.json({ ok: true });
    } catch (e: any) {
      return res.status(500).json({ error: "Güncellenemedi: " + e?.message });
    }
  },
);

// ─── PUBLIC: ASSET STREAM ──────────────────────────────────────────────
// /api/ebooks/asset/:assetId → binary stream (görsel veya PDF)
// CORS açık tut — pazarlama sitesinden <img src> ile çağrılır
router.get("/ebooks/asset/:assetId", async (req: Request, res: Response) => {
  const id = parseInt(req.params.assetId, 10);
  if (!Number.isFinite(id)) return res.status(400).send("Invalid id");
  try {
    const rows = await db.execute(sql`
      SELECT filename, mime_type, size_bytes, data_base64
      FROM ebook_assets WHERE id = ${id}
    `);
    const asset = (rows.rows ?? rows)[0] as any;
    if (!asset) return res.status(404).send("Asset bulunamadı");

    res.setHeader("Content-Type", asset.mime_type || "application/octet-stream");
    res.setHeader("Content-Length", String(asset.size_bytes));
    res.setHeader("Cache-Control", "public, max-age=3600, immutable");
    // Cross-origin <img> tag'lerinin yükleyebilmesi için CORP override
    // (Helmet default 'same-origin' set ediyor — www.sphereenglish.com'dan
    // app.sphereenglish.com asset'i yüklenince engellenmesini önler)
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("Access-Control-Allow-Origin", "*");
    // Inline göster — download zorla değil
    res.setHeader("Content-Disposition", `inline; filename="${asset.filename.replace(/[^a-zA-Z0-9._-]/g, "_")}"`);
    const buf = Buffer.from(asset.data_base64, "base64");
    return res.send(buf);
  } catch (e: any) {
    console.error("[EBOOK-ASSET] stream HATA:", e?.message);
    return res.status(500).send("Yüklenemedi");
  }
});

export default router;
