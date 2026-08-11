/**
 * Kariyer/Motivasyon içerik ingest — YouTube RSS + Podcast RSS.
 *
 * fetchAllSources(): tüm aktif kaynakları çeker + DB'ye yeni item ekler.
 * enrichPending(limit): TR özet + kategori + tag üretir (GPT-4o-mini).
 *
 * XML parse manuel (regex) — küçük dependency yok, RSS 2.0 + Atom yapıları.
 */

import OpenAI from "openai";
import { pool } from "@workspace/db";

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY yok");
    _openai = new OpenAI({ apiKey });
  }
  return _openai;
}

type Source = {
  id: number;
  slug: string;
  name: string;
  source_type: "video" | "podcast";
  language: string;
  feed_url: string;
};

type FeedItem = {
  guid: string;
  title: string;
  description: string;
  url: string;
  audio_url?: string;
  thumbnail_url?: string;
  duration_sec?: number;
  published_at?: string;
};

// ─── XML helpers ────────────────────────────────────────────────────
function stripCdata(s: string): string {
  return s.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "").trim();
}
function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
}
function stripTags(s: string): string {
  return decodeHtml(stripCdata(s).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}
function firstMatch(str: string, re: RegExp): string | null {
  const m = str.match(re);
  return m ? m[1] : null;
}

function parseDuration(s: string): number | undefined {
  // Formatlar: "1:23:45", "23:45", sadece saniye
  if (!s) return;
  const parts = s.trim().split(":").map(x => parseInt(x, 10)).filter(x => !isNaN(x));
  if (parts.length === 0) return;
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
}

// ─── RSS 2.0 (podcast) parse ────────────────────────────────────────
function parseRss(xml: string): FeedItem[] {
  const items: FeedItem[] = [];
  const itemRe = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1];
    const title = firstMatch(block, /<title[^>]*>([\s\S]*?)<\/title>/i);
    const description = firstMatch(block, /<description[^>]*>([\s\S]*?)<\/description>/i)
                     ?? firstMatch(block, /<itunes:summary[^>]*>([\s\S]*?)<\/itunes:summary>/i);
    const link = firstMatch(block, /<link[^>]*>([\s\S]*?)<\/link>/i);
    const guid = firstMatch(block, /<guid[^>]*>([\s\S]*?)<\/guid>/i);
    const pubDate = firstMatch(block, /<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i);
    const enclosureUrl = firstMatch(block, /<enclosure\s+[^>]*url="([^"]+)"/i);
    const durationStr = firstMatch(block, /<itunes:duration[^>]*>([\s\S]*?)<\/itunes:duration>/i);
    const image = firstMatch(block, /<itunes:image\s+[^>]*href="([^"]+)"/i)
               ?? firstMatch(block, /<media:thumbnail\s+[^>]*url="([^"]+)"/i);

    const cleanTitle = title ? stripTags(title) : "";
    const cleanLink = link ? stripTags(link) : "";
    if (!cleanTitle || !cleanLink) continue;

    items.push({
      guid: guid ? stripTags(guid) : cleanLink,
      title: cleanTitle,
      description: description ? stripTags(description).slice(0, 4000) : "",
      url: cleanLink,
      audio_url: enclosureUrl ?? undefined,
      thumbnail_url: image ?? undefined,
      duration_sec: durationStr ? parseDuration(stripTags(durationStr)) : undefined,
      published_at: pubDate ? stripTags(pubDate) : undefined,
    });
  }
  return items;
}

// ─── Atom (YouTube) parse ───────────────────────────────────────────
function parseAtom(xml: string, isYouTube: boolean): FeedItem[] {
  const items: FeedItem[] = [];
  const entryRe = /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi;
  let m: RegExpExecArray | null;
  while ((m = entryRe.exec(xml)) !== null) {
    const block = m[1];
    const title = firstMatch(block, /<title[^>]*>([\s\S]*?)<\/title>/i);
    const linkHref = firstMatch(block, /<link\s+[^>]*href="([^"]+)"/i);
    const videoId = firstMatch(block, /<yt:videoId>([\s\S]*?)<\/yt:videoId>/i);
    const published = firstMatch(block, /<published>([\s\S]*?)<\/published>/i);
    const mediaDescription = firstMatch(block, /<media:description[^>]*>([\s\S]*?)<\/media:description>/i);
    const summary = firstMatch(block, /<summary[^>]*>([\s\S]*?)<\/summary>/i);
    const thumb = firstMatch(block, /<media:thumbnail\s+[^>]*url="([^"]+)"/i);

    const cleanTitle = title ? stripTags(title) : "";
    if (!cleanTitle) continue;

    const url = isYouTube && videoId
      ? `https://www.youtube.com/watch?v=${stripTags(videoId)}`
      : (linkHref ?? "");
    if (!url) continue;

    const thumbnail = thumb ?? (isYouTube && videoId
      ? `https://i.ytimg.com/vi/${stripTags(videoId)}/hqdefault.jpg`
      : undefined);

    items.push({
      guid: (videoId ? `yt:${stripTags(videoId)}` : url),
      title: cleanTitle,
      description: (mediaDescription ?? summary)
        ? stripTags(mediaDescription ?? summary ?? "").slice(0, 4000) : "",
      url,
      thumbnail_url: thumbnail,
      published_at: published ? stripTags(published) : undefined,
    });
  }
  return items;
}

async function fetchAndParse(source: Source): Promise<FeedItem[]> {
  const res = await fetch(source.feed_url, {
    headers: { "User-Agent": "SphereEnglish/1.0" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const xml = await res.text();

  const isAtom = /<feed\b[^>]*xmlns\s*=\s*"http:\/\/www\.w3\.org\/2005\/Atom"/i.test(xml)
              || /<entry\b/i.test(xml);
  const isYouTube = source.feed_url.includes("youtube.com");
  return isAtom ? parseAtom(xml, isYouTube) : parseRss(xml);
}

async function upsertItem(source: Source, item: FeedItem): Promise<number | null> {
  const publishedAt = item.published_at ? new Date(item.published_at) : null;
  const publishedIso = publishedAt && !isNaN(publishedAt.getTime()) ? publishedAt.toISOString() : null;

  try {
    const r: any = await pool.query(
      `INSERT INTO career_content
         (source_id, source_slug, source_type, external_id, url, audio_url,
          title, description, thumbnail_url, author, duration_sec, language, published_at, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'draft')
       ON CONFLICT (source_id, external_id) WHERE external_id IS NOT NULL DO NOTHING
       RETURNING id`,
      [source.id, source.slug, source.source_type, item.guid, item.url,
       item.audio_url ?? null, item.title.slice(0, 500), item.description.slice(0, 4000),
       item.thumbnail_url ?? null, source.name, item.duration_sec ?? null,
       source.language, publishedIso],
    );
    return r.rows[0]?.id ?? null;
  } catch {
    return null;
  }
}

export type CareerIngestResult = {
  fetched: number;
  inserted: number;
  skipped: number;
  errors: string[];
  articleIds: number[];
};

export async function fetchAllSources(perSourceLimit = 5): Promise<CareerIngestResult> {
  const srcRes: any = await pool.query(
    `SELECT id, slug, name, source_type, language, feed_url
       FROM career_sources WHERE is_active = TRUE`,
  );
  const sources = srcRes.rows as Source[];

  const result: CareerIngestResult = { fetched: 0, inserted: 0, skipped: 0, errors: [], articleIds: [] };

  for (const src of sources) {
    try {
      const items = await fetchAndParse(src);
      const latest = items.slice(0, perSourceLimit);
      result.fetched += latest.length;
      for (const item of latest) {
        const id = await upsertItem(src, item);
        if (id) { result.inserted++; result.articleIds.push(id); }
        else result.skipped++;
      }
      await pool.query(`UPDATE career_sources SET last_fetched_at = NOW() WHERE id = $1`, [src.id]).catch(() => {});
    } catch (e: any) {
      result.errors.push(`[${src.slug}] ${e?.message ?? String(e)}`);
    }
  }

  return result;
}

// ─── ENRICHMENT ────────────────────────────────────────────────────
const ENRICH_SYSTEM = `Sen Sphere English'in kariyer/motivasyon içerik editörüsün. Türk profesyonellere sunulacak video/podcast içeriklerini işliyorsun.

Sana bir içerik (başlık + açıklama) verilecek. JSON döndür:
{
  "tr_summary": string,        // 2-3 satır Türkçe özet. Nesnel, spoiler yok. Emoji yok. "!" yok.
  "category": "career"|"motivation"|"entrepreneurship"|"leadership"|"productivity",
  "tags": string[],            // 2-5 kısa etiket (ör: "startup", "public-speaking", "burnout")
  "relevance": number          // 0-10: bir Türk profesyonel için ne kadar faydalı? Düşük = jenerik/reklam/off-topic
}

KURALLAR:
- Türkçe özet — samimi ama profesyonel
- Kategori sadece 5 seçenekten biri
- Relevance düşükse (< 4) tag'e "low-signal" ekle
- Reklam/tanıtım içerikleri relevance düşük
- Sadece JSON döndür`;

export async function enrichCareerItem(id: number): Promise<{ ok: boolean; error?: string }> {
  const r: any = await pool.query(
    `SELECT id, title, description, source_type, language FROM career_content WHERE id = $1`, [id],
  );
  const item = r.rows[0];
  if (!item) return { ok: false, error: "not found" };

  const body = (item.description ?? "").slice(0, 3000) || item.title;
  const userPrompt = `Kaynak türü: ${item.source_type} (${item.language})\nBaşlık: ${item.title}\nAçıklama: ${body}`;

  try {
    const res: any = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: ENRICH_SYSTEM },
        { role: "user", content: userPrompt },
      ],
    });
    const parsed = JSON.parse(res?.choices?.[0]?.message?.content ?? "{}");
    const validCat = ["career", "motivation", "entrepreneurship", "leadership", "productivity"];

    await pool.query(
      `UPDATE career_content
         SET tr_summary = $2,
             category = $3,
             tags = $4,
             admin_notes = $5,
             enriched_at = NOW(),
             updated_at = NOW()
       WHERE id = $1`,
      [id,
       String(parsed.tr_summary ?? "").slice(0, 1500),
       validCat.includes(parsed.category) ? parsed.category : "career",
       Array.isArray(parsed.tags) ? parsed.tags.slice(0, 6).map((t: any) => String(t).slice(0, 40)) : [],
       parsed.relevance !== undefined ? `relevance:${parsed.relevance}` : null,
      ],
    );
    return { ok: true };
  } catch (e: any) {
    await pool.query(`UPDATE career_content SET admin_notes = $2 WHERE id = $1`,
      [id, `enrich hata: ${e?.message?.slice(0, 400)}`]);
    return { ok: false, error: e?.message };
  }
}

export async function enrichPending(limit = 20): Promise<{ processed: number; ok: number; failed: number }> {
  const r: any = await pool.query(
    `SELECT id FROM career_content
       WHERE status = 'draft' AND enriched_at IS NULL
       ORDER BY published_at DESC NULLS LAST LIMIT $1`,
    [limit],
  );
  const ids = r.rows.map((row: any) => row.id);
  let ok = 0, failed = 0;
  for (const id of ids) {
    const res = await enrichCareerItem(id);
    if (res.ok) ok++; else failed++;
  }
  return { processed: ids.length, ok, failed };
}
