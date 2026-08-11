/**
 * BBC Learning English + VOA Learning English ingest.
 * Öğrencinin seviyesine uygun basitleştirilmiş İngilizce haberler.
 *
 * content_articles tablosuna DRAFT olarak yazar — mevcut enrichment (enrich.ts)
 * TR özet + CEFR + kategori üretir.
 */

import { pool } from "@workspace/db";

const SOURCES = [
  { slug: "bbc-6-minute-english",   name: "BBC 6 Minute English",  url: "https://feeds.bbci.co.uk/learningenglish/english/features/6-minute-english/rss.xml" },
  { slug: "bbc-english-at-work",    name: "BBC English at Work",   url: "https://feeds.bbci.co.uk/learningenglish/english/features/english-at-work/rss.xml" },
  { slug: "bbc-news-review",        name: "BBC News Review",       url: "https://feeds.bbci.co.uk/learningenglish/english/features/news-review/rss.xml" },
  { slug: "voa-learning-english",   name: "VOA Learning English",  url: "https://learningenglish.voanews.com/api/zq$oqekiuq" },
];

function firstMatch(s: string, re: RegExp): string | null {
  const m = s.match(re);
  return m ? m[1] : null;
}
function decode(s: string): string {
  return s.replace(/<!\[CDATA\[/g, "").replace(/\]\]>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'");
}
function stripTags(s: string): string {
  return decode(s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}
function extractImage(block: string): string | null {
  return firstMatch(block, /<media:thumbnail\s+[^>]*url="([^"]+)"/i)
      ?? firstMatch(block, /<enclosure\s+[^>]*url="([^"]+)"\s+[^>]*type="image/i)
      ?? firstMatch(block, /<img[^>]+src="([^"]+)"/i);
}

async function fetchRss(source: typeof SOURCES[number]): Promise<Array<{
  guid: string; title: string; description: string; url: string; pubDate?: string; imageUrl?: string; bodyText?: string;
}>> {
  const res = await fetch(source.url, { headers: { "User-Agent": "SphereEnglish/1.0" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const xml = await res.text();

  const items: any[] = [];
  const itemRe = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1];
    const title = firstMatch(block, /<title[^>]*>([\s\S]*?)<\/title>/i);
    const description = firstMatch(block, /<description[^>]*>([\s\S]*?)<\/description>/i);
    const link = firstMatch(block, /<link[^>]*>([\s\S]*?)<\/link>/i);
    const guid = firstMatch(block, /<guid[^>]*>([\s\S]*?)<\/guid>/i);
    const pubDate = firstMatch(block, /<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i);
    const image = extractImage(block);
    const contentEncoded = firstMatch(block, /<content:encoded[^>]*>([\s\S]*?)<\/content:encoded>/i);

    if (!title || !link) continue;
    items.push({
      guid: guid ? stripTags(guid) : stripTags(link),
      title: stripTags(title),
      description: description ? stripTags(description).slice(0, 4000) : "",
      url: stripTags(link),
      pubDate: pubDate ? stripTags(pubDate) : undefined,
      imageUrl: image ?? undefined,
      bodyText: contentEncoded ? stripTags(contentEncoded).slice(0, 8000) : undefined,
    });
  }
  return items;
}

export type LearningIngestResult = {
  fetched: number;
  inserted: number;
  skipped: number;
  errors: string[];
  articleIds: number[];
};

export async function fetchLearningEnglish(perSourceLimit = 5): Promise<LearningIngestResult> {
  const result: LearningIngestResult = { fetched: 0, inserted: 0, skipped: 0, errors: [], articleIds: [] };

  for (const src of SOURCES) {
    try {
      const items = (await fetchRss(src)).slice(0, perSourceLimit);
      result.fetched += items.length;
      for (const item of items) {
        try {
          const pub = item.pubDate ? new Date(item.pubDate) : null;
          const pubIso = pub && !isNaN(pub.getTime()) ? pub.toISOString() : null;

          const insertRes: any = await pool.query(
            `INSERT INTO content_articles
               (source, external_id, url, title, snippet, body_text, image_url, author,
                original_section, published_at, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'learning_english', $9, 'draft')
             ON CONFLICT (source, external_id) WHERE external_id IS NOT NULL DO NOTHING
             RETURNING id`,
            [src.slug, item.guid, item.url, item.title.slice(0, 500),
             item.description.slice(0, 4000), item.bodyText ?? null,
             item.imageUrl ?? null, src.name, pubIso],
          );
          const id = insertRes.rows[0]?.id;
          if (id) { result.inserted++; result.articleIds.push(id); }
          else result.skipped++;
        } catch { result.skipped++; }
      }
    } catch (e: any) {
      result.errors.push(`[${src.slug}] ${e?.message ?? String(e)}`);
    }
  }

  return result;
}
