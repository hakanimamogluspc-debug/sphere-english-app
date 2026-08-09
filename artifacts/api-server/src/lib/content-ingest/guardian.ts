/**
 * Guardian Content API ingestion.
 *
 * https://open-platform.theguardian.com/documentation/
 *
 * ENV: GUARDIAN_API_KEY (test-key ile bile çalışır ama rate-limit sıkı)
 *
 * fetchGuardianArticles(): son 24-48 saatte business + technology
 *   section'larından yayınlanmış makaleleri çeker, DB'ye DRAFT olarak yazar.
 *
 * Duplicate koruması: (source, external_id) unique index.
 */

import { pool } from "@workspace/db";

const GUARDIAN_ENDPOINT = "https://content.guardianapis.com/search";

// Hangi section'lardan çekiyoruz + kaç makale
const SECTIONS = ["business", "technology"];
const PAGE_SIZE = 15; // her section için, günlük ~30 makale

type GuardianArticle = {
  id: string;                    // Guardian internal id (external_id olarak kullanacağız)
  webTitle: string;
  webUrl: string;
  sectionId: string;
  sectionName: string;
  webPublicationDate: string;
  fields?: {
    trailText?: string;          // özet
    standfirst?: string;         // alt başlık
    body?: string;               // full HTML
    bodyText?: string;           // plain text
    wordcount?: string;
    thumbnail?: string;
    byline?: string;
    headline?: string;
  };
};

export type IngestResult = {
  fetched: number;
  inserted: number;
  skipped: number;
  errors: string[];
  articleIds: number[]; // yeni eklenen DB id'leri (enrichment için)
};

async function fetchSection(section: string, apiKey: string): Promise<GuardianArticle[]> {
  const params = new URLSearchParams({
    "api-key": apiKey,
    section,
    "order-by": "newest",
    "page-size": String(PAGE_SIZE),
    "show-fields": "trailText,standfirst,body,bodyText,wordcount,thumbnail,byline,headline",
    lang: "en",
  });
  const url = `${GUARDIAN_ENDPOINT}?${params.toString()}`;
  const res = await fetch(url, { headers: { "User-Agent": "SphereEnglish/1.0" } });
  if (!res.ok) {
    throw new Error(`Guardian API ${section}: HTTP ${res.status} ${await res.text().catch(() => "")}`);
  }
  const data: any = await res.json();
  return (data?.response?.results ?? []) as GuardianArticle[];
}

/** Çekilen bir makaleyi DB'ye yaz (unique conflict'te skip). Returns article id (yeni ise). */
async function upsertArticle(a: GuardianArticle): Promise<number | null> {
  const fields = a.fields ?? {};
  const bodyHtml = fields.body ?? null;
  const bodyText = fields.bodyText ?? (bodyHtml ? bodyHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : null);
  const wordCount = fields.wordcount ? parseInt(fields.wordcount, 10) : null;
  const subtitle = fields.standfirst?.replace(/<[^>]+>/g, "").trim() || null;

  try {
    const res = await pool.query(
      `INSERT INTO content_articles
         (source, external_id, url, title, subtitle, snippet, body_html, body_text, word_count,
          image_url, author, original_section, published_at, status)
       VALUES
         ('guardian', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'draft')
       ON CONFLICT (source, external_id) WHERE external_id IS NOT NULL DO NOTHING
       RETURNING id`,
      [
        a.id,
        a.webUrl,
        fields.headline || a.webTitle,
        subtitle,
        fields.trailText ?? null,
        bodyHtml,
        bodyText,
        wordCount,
        fields.thumbnail ?? null,
        fields.byline ?? null,
        a.sectionName,
        a.webPublicationDate,
      ],
    );
    return res.rows[0]?.id ?? null;
  } catch (e: any) {
    // conflict veya başka sorun — sessizce atla
    return null;
  }
}

export async function fetchGuardianArticles(): Promise<IngestResult> {
  const apiKey = process.env.GUARDIAN_API_KEY;
  if (!apiKey) {
    return { fetched: 0, inserted: 0, skipped: 0, errors: ["GUARDIAN_API_KEY yok"], articleIds: [] };
  }

  const result: IngestResult = { fetched: 0, inserted: 0, skipped: 0, errors: [], articleIds: [] };

  for (const section of SECTIONS) {
    try {
      const items = await fetchSection(section, apiKey);
      result.fetched += items.length;
      for (const item of items) {
        const insertedId = await upsertArticle(item);
        if (insertedId) {
          result.inserted++;
          result.articleIds.push(insertedId);
        } else {
          result.skipped++;
        }
      }
    } catch (e: any) {
      result.errors.push(`[${section}] ${e?.message ?? String(e)}`);
    }
  }

  return result;
}
