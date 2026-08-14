/**
 * E-Kitap Paketleri (Bundle) — Public endpoints
 *
 * www tarafında /e-kitaplar/paketler sayfasında bundle satışları için.
 * Admin CRUD için admin-bundles.ts'e bak.
 *
 * Endpoint'ler:
 *   GET /api/bundles              — Aktif tüm paketleri listele (kitap özetiyle)
 *   GET /api/bundles/:slug        — Tek paket detayı (tüm kitap bilgileriyle)
 *   GET /api/bundles/featured     — Öne çıkan paketler (ana sayfa için)
 */

import { Router, type IRouter, Request, Response } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

// Reserved keyword'ler — /bundles/:slug route'una yakalanmasın
const RESERVED_BUNDLE_SLUGS = new Set(["yeni", "new", "paketler", "featured", "list"]);

const router: IRouter = Router();

// ─── Öne çıkan paketler ─────────────────────────────────────────────────
router.get("/bundles/featured", async (_req: Request, res: Response) => {
  try {
    const rows = await db.execute(sql`
      SELECT
        b.id, b.slug, b.title, b.subtitle, b.cover_image_url,
        b.price_try, b.currency,
        (
          SELECT COUNT(*)::INT
          FROM ebook_bundle_items bi
          WHERE bi.bundle_id = b.id
        ) AS item_count,
        (
          SELECT COALESCE(SUM(e.price_try), 0)
          FROM ebook_bundle_items bi
          JOIN ebooks e ON bi.ebook_id = e.id
          WHERE bi.bundle_id = b.id AND e.is_active = TRUE
        ) AS individual_total_try,
        (
          SELECT COALESCE(json_agg(
            json_build_object('id', e.id, 'title', e.title, 'cover_image_url', e.cover_image_url)
            ORDER BY bi.position, bi.id
          ), '[]'::json)
          FROM ebook_bundle_items bi
          JOIN ebooks e ON bi.ebook_id = e.id
          WHERE bi.bundle_id = b.id AND e.is_active = TRUE
        ) AS items_preview
      FROM ebook_bundles b
      WHERE b.is_active = TRUE AND b.is_featured = TRUE
      ORDER BY b.sort_order ASC, b.created_at DESC
      LIMIT 6
    `);
    const bundles = (rows.rows ?? rows).map((b: any) => enrichBundleSavings(b));
    return res.json({ bundles });
  } catch (e: any) {
    console.error("[bundles/featured] HATA:", e?.message);
    return res.status(500).json({ error: "Paketler alınamadı" });
  }
});

/** Bundle response'una gerçek zamanlı savings ekle + list_price_try'ı override et (stale değerleri temizle) */
function enrichBundleSavings(b: any) {
  const individual = Number(b.individual_total_try ?? 0);
  const price = Number(b.price_try ?? 0);
  const savings = Math.max(0, individual - price);
  const percent = individual > 0 ? Math.round(((individual - price) / individual) * 100) : 0;
  return {
    ...b,
    list_price_try: individual,          // frontend backwards compat — stale değer override edildi
    individual_total_try: individual,
    savings_amount_try: savings,
    savings_percent: Math.max(0, percent),
  };
}

// ─── Tüm aktif paketler ─────────────────────────────────────────────────
router.get("/bundles", async (_req: Request, res: Response) => {
  try {
    const rows = await db.execute(sql`
      SELECT
        b.id, b.slug, b.title, b.subtitle, b.description,
        b.cover_image_url, b.price_try, b.currency,
        b.is_featured, b.tags,
        (
          SELECT COUNT(*)::INT
          FROM ebook_bundle_items bi
          WHERE bi.bundle_id = b.id
        ) AS item_count,
        (
          SELECT COALESCE(SUM(e.price_try), 0)
          FROM ebook_bundle_items bi
          JOIN ebooks e ON bi.ebook_id = e.id
          WHERE bi.bundle_id = b.id AND e.is_active = TRUE
        ) AS individual_total_try,
        (
          SELECT COALESCE(json_agg(
            json_build_object(
              'id', e.id,
              'slug', e.slug,
              'title', e.title,
              'cover_image_url', e.cover_image_url
            )
            ORDER BY bi.position, bi.id
          ), '[]'::json)
          FROM ebook_bundle_items bi
          JOIN ebooks e ON bi.ebook_id = e.id
          WHERE bi.bundle_id = b.id AND e.is_active = TRUE
        ) AS items_preview
      FROM ebook_bundles b
      WHERE b.is_active = TRUE
      ORDER BY b.is_featured DESC, b.sort_order ASC, b.created_at DESC
    `);
    const bundles = (rows.rows ?? rows).map((b: any) => enrichBundleSavings(b));
    return res.json({ bundles });
  } catch (e: any) {
    console.error("[bundles] HATA:", e?.message);
    return res.status(500).json({ error: "Paketler alınamadı" });
  }
});

// ─── Tek paket detay (slug ile) ─────────────────────────────────────────
router.get("/bundles/:slug", async (req: Request, res: Response, next) => {
  const slug = String(req.params.slug || "").trim();
  if (!slug) return res.status(400).json({ error: "Slug gerekli" });

  // Reserved keyword ise sonraki route'a devret
  if (RESERVED_BUNDLE_SLUGS.has(slug.toLowerCase())) {
    return next();
  }

  try {
    const rows = await db.execute(sql`
      SELECT
        b.id, b.slug, b.title, b.subtitle, b.description,
        b.cover_image_url, b.price_try, b.currency,
        b.is_featured, b.tags, b.seo_title, b.seo_description, b.seo_keywords,
        b.created_at,
        (
          SELECT COALESCE(json_agg(
            json_build_object(
              'id', e.id,
              'slug', e.slug,
              'title', e.title,
              'subtitle', e.subtitle,
              'description', e.description,
              'author', e.author,
              'cover_image_url', e.cover_image_url,
              'page_count', e.page_count,
              'reading_time_min', e.reading_time_min,
              'price_try', e.price_try,
              'category', e.category
            )
            ORDER BY bi.position, bi.id
          ), '[]'::json)
          FROM ebook_bundle_items bi
          JOIN ebooks e ON bi.ebook_id = e.id
          WHERE bi.bundle_id = b.id AND e.is_active = TRUE
        ) AS items,
        (
          SELECT COALESCE(SUM(e.price_try), 0)
          FROM ebook_bundle_items bi
          JOIN ebooks e ON bi.ebook_id = e.id
          WHERE bi.bundle_id = b.id AND e.is_active = TRUE
        ) AS individual_total_try
      FROM ebook_bundles b
      WHERE b.slug = ${slug} AND b.is_active = TRUE
      LIMIT 1
    `);
    const bundle = (rows.rows ?? rows)[0] as any;
    if (!bundle) return res.status(404).json({ error: "Paket bulunamadı" });

    // Tutarlı hesaplama: list/featured ile aynı helper
    return res.json({ bundle: enrichBundleSavings(bundle) });
  } catch (e: any) {
    console.error("[bundles/:slug] HATA:", e?.message);
    return res.status(500).json({ error: "Paket alınamadı" });
  }
});

// ─── PUBLIC: Bundle Kapak Görseli Stream ────────────────────────────────
// GET /api/bundle-cover/:id → binary görsel stream
// CORS açık — pazarlama sitesinden <img src> ile çağrılabilir
router.get("/bundle-cover/:id", async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id ?? ""), 10);
  if (!Number.isFinite(id)) return res.status(400).send("Invalid id");

  try {
    const rows = await db.execute(sql`
      SELECT cover_data, cover_mime, cover_size
      FROM ebook_bundles
      WHERE id = ${id} AND cover_data IS NOT NULL
      LIMIT 1
    `);
    const asset = (rows.rows ?? rows)[0] as any;
    if (!asset || !asset.cover_data) {
      return res.status(404).send("Kapak bulunamadı");
    }

    res.setHeader("Content-Type", asset.cover_mime || "image/jpeg");
    if (asset.cover_size) res.setHeader("Content-Length", String(asset.cover_size));
    // Cache 5 dakika + must-revalidate — re-upload'da yeni görsel gözükür
    // (immutable kaldırıldı; URL zaten ?v=<ts> cache-buster taşıyor)
    res.setHeader("Cache-Control", "public, max-age=300, must-revalidate");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("Access-Control-Allow-Origin", "*");

    return res.send(asset.cover_data);
  } catch (e: any) {
    console.error("[bundle-cover] HATA:", e?.message);
    return res.status(500).send("Cover alınamadı");
  }
});

export default router;
