/**
 * E-kitap (dijital ürün) public endpoint'leri.
 *
 *   GET  /api/ebooks                → tüm aktif kitaplar (liste)
 *   GET  /api/ebooks/:slug          → tek kitap detayı
 *
 * Admin yönetim ve satın alma endpoint'leri ayrı bir route'ta olacak.
 */

import { Router, Request, Response } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

const router = Router();

// SELECT için ortak alanlar — full_pdf_path public dönmesin (güvenlik)
const PUBLIC_COLUMNS = sql`
  id, slug, title, subtitle, description, long_description, table_of_contents,
  author, publisher, isbn, language, content_language,
  series_slug, series_order, series_title,
  cover_image_url, gallery_urls, preview_pdf_url,
  page_count, reading_time_min, category, tags,
  price_try, list_price_try, currency,
  is_active, is_featured, published_at,
  seo_title, seo_description, seo_keywords,
  created_at, updated_at
`;

router.get("/ebooks", async (_req: Request, res: Response) => {
  try {
    const rows = await db.execute(sql`
      SELECT ${PUBLIC_COLUMNS}
      FROM ebooks
      WHERE is_active = true
      ORDER BY is_featured DESC, published_at DESC
    `);
    return res.json({ ebooks: rows.rows ?? rows });
  } catch (e: any) {
    console.error("[EBOOKS] list HATA:", e?.message);
    return res.status(500).json({ error: "Kitaplar alınamadı" });
  }
});

// Reserved path'ler — slug olarak yakalanmasın (başka router handle eder)
const RESERVED_EBOOK_PATHS = new Set(["download", "asset", "yeni", "new"]);

router.get("/ebooks/:slug", async (req: Request, res: Response, next) => {
  const slug = String(req.params.slug || "").trim();
  if (!slug) return res.status(400).json({ error: "Geçersiz slug" });
  // Reserved keyword ise sonraki route'a devret (Express next())
  if (RESERVED_EBOOK_PATHS.has(slug.toLowerCase())) {
    return next();
  }
  try {
    const rows = await db.execute(sql`
      SELECT ${PUBLIC_COLUMNS}
      FROM ebooks
      WHERE slug = ${slug} AND is_active = true
      LIMIT 1
    `);
    const ebook = (rows.rows ?? rows)[0];
    if (!ebook) return res.status(404).json({ error: "Kitap bulunamadı" });

    // Aynı seri içindeki diğer kitaplar
    const seriesRows = (ebook as any).series_slug
      ? await db.execute(sql`
          SELECT id, slug, title, subtitle, series_order, cover_image_url, price_try
          FROM ebooks
          WHERE series_slug = ${(ebook as any).series_slug}
            AND id != ${(ebook as any).id}
            AND is_active = true
          ORDER BY series_order ASC
        `)
      : null;
    const related = seriesRows ? (seriesRows.rows ?? seriesRows) : [];

    return res.json({ ebook, related });
  } catch (e: any) {
    console.error("[EBOOKS] detail HATA:", e?.message);
    return res.status(500).json({ error: "Kitap alınamadı" });
  }
});

export default router;
