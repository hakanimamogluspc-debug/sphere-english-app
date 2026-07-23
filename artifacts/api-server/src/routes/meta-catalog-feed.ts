/**
 * Meta Advantage+ Catalog Product Feed — XML endpoint.
 *
 * URL: /api/meta/catalog-feed.xml
 *
 * Bu endpoint Meta Commerce Manager'da katalog "Data feed" olarak eklenir.
 * Meta günlük 1 kez (veya manuel refresh ile) bu URL'i çeker,
 * dönen XML'deki tüm ürünleri Sphere kataloğu ile senkronize eder.
 *
 * Format: Google Shopping (Meta bunu kabul eder) — RSS 2.0 + g: namespace
 *
 * Meta Advantage+ Catalog kampanyaları bu feed'deki content_id'ler
 * ile Pixel/CAPI event'lerini (ViewContent, AddToCart, Purchase) eşleştirir:
 *   Client:  fbq('track', 'ViewContent', { content_ids: ['ebook-42'], ... })
 *   Feed:    <g:id>ebook-42</g:id>
 *   → Meta bu ürüne bakan kullanıcıya dinamik reklam gösterir
 *
 * Dokümantasyon:
 *   https://developers.facebook.com/docs/marketing-api/catalog/reference/
 */

import { Router, Request, Response } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

const router = Router();

const BASE_URL = process.env.PUBLIC_SITE_URL ?? "https://www.sphereenglish.com";
const API_BASE_URL = process.env.PUBLIC_API_BASE_URL ?? "https://app.sphereenglish.com";
const BRAND = "Sphere English";

// ─── XML helpers ──────────────────────────────────────────────────────
function xmlEscape(v: unknown): string {
  if (v == null) return "";
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    // Kontrol karakterlerini temizle (XML 1.0 spec)
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
}

function cdata(v: unknown): string {
  if (v == null) return "";
  // CDATA içinde `]]>` olamaz, split ederek escape et
  const str = String(v).replace(/]]>/g, "]]]]><![CDATA[>");
  return `<![CDATA[${str}]]>`;
}

/**
 * Public URL'e çevir — /assets/... veya /uploads/... göreceli path'leri
 * absolute URL'ye dönüştür. Meta feed sadece absolute URL kabul eder.
 */
function absoluteUrl(url: string | null | undefined, base = BASE_URL): string {
  if (!url) return "";
  const trimmed = String(url).trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (trimmed.startsWith("/")) return `${base}${trimmed}`;
  return `${base}/${trimmed}`;
}

function formatPrice(priceTry: string | number | null | undefined, currency = "TRY"): string {
  const num = typeof priceTry === "string" ? parseFloat(priceTry) : Number(priceTry ?? 0);
  if (!Number.isFinite(num) || num <= 0) return "";
  return `${num.toFixed(2)} ${currency}`;
}

// ─── GET /api/meta/catalog-feed.xml ───────────────────────────────────
router.get("/meta/catalog-feed.xml", async (_req: Request, res: Response) => {
  try {
    // Tüm aktif e-kitaplar
    const ebooksResult = await db.execute(sql`
      SELECT
        id, slug, title, subtitle, description, author, publisher,
        cover_image_url, category, tags,
        price_try, list_price_try, currency, is_active,
        published_at, updated_at
      FROM ebooks
      WHERE is_active = TRUE
      ORDER BY id
    `);
    const ebooks = (ebooksResult.rows ?? ebooksResult) as any[];

    // Tüm aktif paketler (kapak DB'de bytea ise /api/bundle-cover/:id kullanılır)
    const bundlesResult = await db.execute(sql`
      SELECT
        b.id, b.slug, b.title, b.subtitle, b.description,
        b.cover_image_url, b.cover_data IS NOT NULL AS has_cover_data,
        b.price_try, b.list_price_try, b.currency, b.is_active,
        b.created_at, b.updated_at,
        COALESCE(json_agg(json_build_object(
          'ebook_id', bi.ebook_id,
          'ebook_title', e.title
        ) ORDER BY bi.position) FILTER (WHERE bi.ebook_id IS NOT NULL), '[]'::json) AS items
      FROM ebook_bundles b
      LEFT JOIN ebook_bundle_items bi ON bi.bundle_id = b.id
      LEFT JOIN ebooks e ON e.id = bi.ebook_id AND e.is_active = TRUE
      WHERE b.is_active = TRUE
      GROUP BY b.id
      ORDER BY b.id
    `);
    const bundles = (bundlesResult.rows ?? bundlesResult) as any[];

    // ─── XML üret ───────────────────────────────────────────────────
    const items: string[] = [];

    // ── E-kitaplar ──
    for (const e of ebooks) {
      const price = formatPrice(e.price_try, e.currency);
      if (!price) continue; // fiyat yoksa Meta reddeder

      const listPrice = formatPrice(e.list_price_try, e.currency);
      const link = `${BASE_URL}/e-kitaplar/${e.slug}`;
      const image = absoluteUrl(e.cover_image_url);
      // Kısaltılmış description (Meta max 5000 karakter ama pratik 500-1000 arası tavsiye)
      const desc = String(e.description ?? "").slice(0, 4000);

      items.push(`    <item>
      <g:id>ebook-${e.id}</g:id>
      <g:title>${cdata(e.title)}</g:title>
      <g:description>${cdata(desc)}</g:description>
      <g:link>${xmlEscape(link)}</g:link>
      <g:image_link>${xmlEscape(image)}</g:image_link>
      <g:availability>in stock</g:availability>
      <g:price>${xmlEscape(price)}</g:price>
      ${listPrice && listPrice !== price ? `<g:sale_price>${xmlEscape(price)}</g:sale_price>\n      ` : ""}<g:brand>${xmlEscape(e.publisher || BRAND)}</g:brand>
      <g:condition>new</g:condition>
      <g:product_type>${xmlEscape(e.category || "E-Kitap")}</g:product_type>
      <g:google_product_category>Media &gt; Books &gt; E-books</g:google_product_category>
      <g:custom_label_0>author:${xmlEscape(e.author)}</g:custom_label_0>
    </item>`);
    }

    // ── Bundle'lar ──
    for (const b of bundles) {
      const price = formatPrice(b.price_try, b.currency);
      if (!price) continue;

      const listPrice = formatPrice(b.list_price_try, b.currency);
      const link = `${BASE_URL}/paketler/${b.slug}`;
      // Cover: önce cover_image_url, yoksa DB'deki bytea via api-server endpoint
      const image = b.cover_image_url
        ? absoluteUrl(b.cover_image_url)
        : b.has_cover_data
          ? `${API_BASE_URL}/api/bundle-cover/${b.id}`
          : "";
      const desc = String(b.description ?? b.subtitle ?? "").slice(0, 4000);

      // Bundle içindeki kitap sayısı — title'a bilgi olarak eklenebilir
      const itemsArray = Array.isArray(b.items) ? b.items : (typeof b.items === "string" ? JSON.parse(b.items) : []);
      const itemCount = itemsArray.filter((it: any) => it?.ebook_id).length;

      items.push(`    <item>
      <g:id>bundle-${b.id}</g:id>
      <g:title>${cdata(b.title)}</g:title>
      <g:description>${cdata(desc)}</g:description>
      <g:link>${xmlEscape(link)}</g:link>
      <g:image_link>${xmlEscape(image)}</g:image_link>
      <g:availability>in stock</g:availability>
      <g:price>${xmlEscape(price)}</g:price>
      ${listPrice && listPrice !== price ? `<g:sale_price>${xmlEscape(price)}</g:sale_price>\n      ` : ""}<g:brand>${xmlEscape(BRAND)}</g:brand>
      <g:condition>new</g:condition>
      <g:product_type>Kitap Paketi</g:product_type>
      <g:google_product_category>Media &gt; Books &gt; E-books</g:google_product_category>
      <g:custom_label_0>type:bundle</g:custom_label_0>
      <g:custom_label_1>items:${itemCount}</g:custom_label_1>
    </item>`);
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
  <channel>
    <title>Sphere English E-Kitap Katalog</title>
    <link>${BASE_URL}/e-kitaplar</link>
    <description>Sphere English — Kurumsal iş İngilizcesi e-kitap ve paket kataloğu (Meta Advantage+ Catalog için)</description>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items.join("\n")}
  </channel>
</rss>`;

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    // Meta günde 1x çekiyor — 1 saatlik cache yeter
    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600");
    res.setHeader("X-Product-Count", String(ebooks.length + bundles.length));
    return res.send(xml);
  } catch (e: any) {
    console.error("[meta/catalog-feed] HATA:", e?.message ?? e);
    return res.status(500).send(`<?xml version="1.0" encoding="UTF-8"?>
<error><message>${xmlEscape(e?.message ?? "Bilinmeyen hata")}</message></error>`);
  }
});

// JSON versiyonu — debug için (Meta kabul etmez, sadece geliştirici görsün)
router.get("/meta/catalog-feed.json", async (_req: Request, res: Response) => {
  try {
    const ebooksResult = await db.execute(sql`
      SELECT id, slug, title, description, price_try, currency, cover_image_url, is_active
      FROM ebooks WHERE is_active = TRUE ORDER BY id
    `);
    const bundlesResult = await db.execute(sql`
      SELECT id, slug, title, description, price_try, currency, cover_image_url, is_active
      FROM ebook_bundles WHERE is_active = TRUE ORDER BY id
    `);
    return res.json({
      ebooks: ebooksResult.rows ?? ebooksResult,
      bundles: bundlesResult.rows ?? bundlesResult,
      feedUrl: `${API_BASE_URL}/api/meta/catalog-feed.xml`,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
});

export default router;
