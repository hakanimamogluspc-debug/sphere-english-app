/**
 * Word of the Day — Merriam-Webster RSS + GPT-4o-mini TR çeviri.
 *
 * fetchTodaysWord(): RSS'ten günün kelimesini çeker, GPT ile TR üretir, DB'ye kaydeder.
 * getTodaysWord(): DB'den bugünün kelimesini döndürür (yoksa fetchTodaysWord tetikle).
 *
 * RSS: https://www.merriam-webster.com/wotd/feed/rss2
 */

import OpenAI from "openai";
import { pool } from "@workspace/db";

const RSS_URL = "https://www.merriam-webster.com/wotd/feed/rss2";

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY yok");
    _openai = new OpenAI({ apiKey });
  }
  return _openai;
}

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

type RawWord = {
  word: string;
  title: string;
  description: string;
  link: string;
  pubDate: string;
};

async function fetchRss(): Promise<RawWord | null> {
  const res = await fetch(RSS_URL, { headers: { "User-Agent": "SphereEnglish/1.0" } });
  if (!res.ok) throw new Error(`WOTD RSS HTTP ${res.status}`);
  const xml = await res.text();

  const itemRe = /<item\b[^>]*>([\s\S]*?)<\/item>/i;
  const m = xml.match(itemRe);
  if (!m) return null;
  const block = m[1];

  const title = firstMatch(block, /<title[^>]*>([\s\S]*?)<\/title>/i) ?? "";
  const description = firstMatch(block, /<description[^>]*>([\s\S]*?)<\/description>/i) ?? "";
  const link = firstMatch(block, /<link[^>]*>([\s\S]*?)<\/link>/i) ?? "";
  const pubDate = firstMatch(block, /<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i) ?? "";

  // Title format: "Word of the Day: WORD" veya sadece "WORD"
  const cleanTitle = stripTags(title);
  const word = cleanTitle.replace(/^word of the day\s*:\s*/i, "").trim().split(/\s+/)[0];

  return {
    word,
    title: cleanTitle,
    description: stripTags(description).slice(0, 4000),
    link: stripTags(link),
    pubDate: stripTags(pubDate),
  };
}

type Parsed = {
  word: string;
  phonetic: string | null;
  partOfSpeech: string | null;
  definitionEn: string | null;
  exampleEn: string | null;
};

/** Description'dan structured bilgi çıkar (Merriam-Webster formatına uygun) */
function parseWordDescription(word: string, description: string): Parsed {
  // Merriam-Webster format örneği:
  // "Merriam-Webster's Word of the Day for August 12, 2026 is: apocryphal • \\uh-PAH-kruh-ful\\ • adjective..."
  // Genelde phonetic \\...\\ arasında olur
  const phonetic = firstMatch(description, /\\([^\\]+)\\/);
  const pos = firstMatch(description, /\\[^\\]+\\\s*[•‧\-]\s*(noun|verb|adjective|adverb|preposition|conjunction|pronoun|interjection)/i);

  // "is: WORD • pron • POS : DEFINITION" tarzı — pos'tan sonrasını al
  let definitionEn: string | null = null;
  if (pos) {
    const posIdx = description.indexOf(pos);
    const rest = description.slice(posIdx + pos.length).replace(/^[\s•‧\-:]+/, "");
    // İlk cümleyi tanım kabul et
    definitionEn = rest.split(/\/\//)[0].trim().split(/\.\s+/)[0].slice(0, 400) || null;
  }

  return {
    word,
    phonetic: phonetic ?? null,
    partOfSpeech: pos ? pos.toLowerCase() : null,
    definitionEn,
    exampleEn: null, // Merriam-Webster genelde description'da örnek vermez
  };
}

async function callGptTranslation(word: string, definitionEn: string | null): Promise<{ tr_meaning: string; tr_note: string }> {
  const prompt = `İngilizce kelime: "${word}"${definitionEn ? `\nİngilizce tanım: "${definitionEn}"` : ""}

Türk bir iş İngilizcesi öğrencisi için JSON döndür:
{
  "tr_meaning": "en fazla 3-4 Türkçe kelime (virgülle)",
  "tr_note": "1 kısa Türkçe cümle: hangi bağlamda kullanılır, sık geçtiği bir alan (iş toplantısı, email, teknik metin vs.)"
}

Sadece JSON, başka metin yok.`;

  const res: any = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: prompt }],
  });
  const parsed = JSON.parse(res?.choices?.[0]?.message?.content ?? "{}");
  return {
    tr_meaning: String(parsed.tr_meaning ?? "").slice(0, 300),
    tr_note: String(parsed.tr_note ?? "").slice(0, 500),
  };
}

/** RSS'ten bugünün kelimesini çeker + DB'ye yazar */
export async function fetchTodaysWord(): Promise<{ ok: boolean; word?: string; skipped?: boolean; error?: string }> {
  try {
    const raw = await fetchRss();
    if (!raw || !raw.word) return { ok: false, error: "RSS boş" };

    const pub = raw.pubDate ? new Date(raw.pubDate) : new Date();
    const dateStr = pub.toISOString().slice(0, 10);

    // Zaten var mı?
    const check: any = await pool.query(
      `SELECT id FROM daily_words WHERE published_at = $1 LIMIT 1`,
      [dateStr],
    );
    if (check.rows[0]) return { ok: true, skipped: true, word: raw.word };

    const parsed = parseWordDescription(raw.word, raw.description);
    let tr = { tr_meaning: "", tr_note: "" };
    try {
      tr = await callGptTranslation(raw.word, parsed.definitionEn);
    } catch (e: any) {
      console.warn("[wotd] gpt hata:", e?.message);
    }

    await pool.query(
      `INSERT INTO daily_words
         (word, phonetic, part_of_speech, definition_en, example_en, tr_meaning, tr_note, source, source_url, published_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'merriam-webster', $8, $9::date)
       ON CONFLICT (published_at) DO NOTHING`,
      [parsed.word, parsed.phonetic, parsed.partOfSpeech, parsed.definitionEn,
       parsed.exampleEn, tr.tr_meaning || null, tr.tr_note || null, raw.link, dateStr],
    );
    return { ok: true, word: parsed.word };
  } catch (e: any) {
    console.error("[wotd]", e?.message);
    return { ok: false, error: e?.message };
  }
}

/** Bugünün kelimesini DB'den döndürür (yoksa fetch tetikler) */
export async function getTodaysWord() {
  const today = new Date().toISOString().slice(0, 10);
  let r: any = await pool.query(
    `SELECT * FROM daily_words WHERE published_at = $1 LIMIT 1`,
    [today],
  );
  if (!r.rows[0]) {
    // En son mevcut olanı döndür (bugünkü henüz gelmediyse)
    r = await pool.query(
      `SELECT * FROM daily_words ORDER BY published_at DESC LIMIT 1`,
    );
  }
  return r.rows[0] ?? null;
}

export async function getRecentWords(limit = 7) {
  const r: any = await pool.query(
    `SELECT id, word, phonetic, part_of_speech, tr_meaning, published_at
       FROM daily_words ORDER BY published_at DESC LIMIT $1`,
    [limit],
  );
  return r.rows;
}
