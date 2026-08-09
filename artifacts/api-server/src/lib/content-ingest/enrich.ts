/**
 * Content Article enrichment (GPT-4o).
 *
 * Bir makale için:
 *   - TR özet (3 satır)
 *   - CEFR seviye (A2/B1/B2/C1/C2)
 *   - Kategori (finance/tech/leadership/negotiation/general)
 *   - 5 anahtar kelime + TR anlamı + orijinal bağlamı
 *
 * enrichArticle(articleId): tek makaleyi işler, DB'yi günceller.
 * enrichPending(limit): status='draft' + enriched_at NULL olanları işler.
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

const SYSTEM_PROMPT = `Sen Sphere English'in içerik editörüsün. Kurumsal iş İngilizcesi öğrenen Türk profesyoneller için gerçek iş makalelerini işleyip öğretici hale getiriyorsun.

Sana bir İngilizce makale (başlık + gövde) verilecek. Bu makale hakkında JSON formatında şunları döndür:

{
  "tr_summary": string,        // 3 satırlık Türkçe özet — anahtar mesajı vurgula. Emoji yok. "!" yok. Profesyonel ton.
  "cefr_level": "A2"|"B1"|"B2"|"C1"|"C2",  // Makalenin İngilizce zorluk seviyesi. Business news genelde B2-C1.
  "category": "finance"|"tech"|"leadership"|"negotiation"|"general",
  "tags": string[],            // 3-6 kelime — konu etiketleri (ör: "AI", "regulation", "startup", "layoffs")
  "key_vocab": [               // 5 tane — makalede geçen iş İngilizcesi için değerli kelimeler
    {
      "word": string,          // İngilizce kelime/ifade (makalede geçen)
      "meaning_tr": string,    // Kısa Türkçe anlam
      "context": string        // Makaleden kısa cümle örneği (İngilizce, 8-15 kelime)
    }
  ]
}

KURALLAR:
- Özet doğrudan ve haber gibi olsun, kişisel yorum yok
- CEFR seviyesi cümle karmaşıklığına + kelime seviyesine göre gerçekçi olmalı
- Kategori sadece 5 seçenekten biri
- Key vocab için basit kelime seçme (get, take) — makaledeki gerçek iş jargonu seç (mitigate, downsizing, disruption)
- Sadece JSON döndür, başka metin yok
`;

type EnrichmentResult = {
  tr_summary: string;
  cefr_level: string;
  category: string;
  tags: string[];
  key_vocab: Array<{ word: string; meaning_tr: string; context: string }>;
};

function truncateBody(text: string | null, maxChars = 8000): string {
  if (!text) return "";
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + "\n\n[…truncated]";
}

async function callGpt(title: string, body: string): Promise<EnrichmentResult> {
  const userPrompt = `Makale başlığı: ${title}\n\nMakale gövdesi:\n${truncateBody(body)}`;
  const res: any = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.3,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
  });
  const raw = res?.choices?.[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw);

  // Validate + normalize
  const validCefr = ["A2", "B1", "B2", "C1", "C2"];
  const validCat = ["finance", "tech", "leadership", "negotiation", "general"];
  return {
    tr_summary: String(parsed.tr_summary ?? "").slice(0, 2000),
    cefr_level: validCefr.includes(parsed.cefr_level) ? parsed.cefr_level : "B2",
    category: validCat.includes(parsed.category) ? parsed.category : "general",
    tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 8).map((t: any) => String(t).slice(0, 40)) : [],
    key_vocab: Array.isArray(parsed.key_vocab)
      ? parsed.key_vocab.slice(0, 6).map((v: any) => ({
          word: String(v.word ?? "").slice(0, 100),
          meaning_tr: String(v.meaning_tr ?? "").slice(0, 300),
          context: String(v.context ?? "").slice(0, 400),
        }))
      : [],
  };
}

export async function enrichArticle(articleId: number): Promise<{ ok: boolean; error?: string }> {
  const r: any = await pool.query(
    `SELECT id, title, body_text, snippet FROM content_articles WHERE id = $1 LIMIT 1`,
    [articleId],
  );
  const article = r.rows[0];
  if (!article) return { ok: false, error: "not found" };

  const bodyForGpt = article.body_text || article.snippet || article.title;
  if (!bodyForGpt || bodyForGpt.length < 40) {
    return { ok: false, error: "yetersiz içerik" };
  }

  try {
    const enrichment = await callGpt(article.title, bodyForGpt);
    await pool.query(
      `UPDATE content_articles
         SET tr_summary = $2,
             cefr_level = $3,
             category = $4,
             tags = $5,
             key_vocab = $6::jsonb,
             enriched_at = NOW(),
             updated_at = NOW()
       WHERE id = $1`,
      [
        articleId,
        enrichment.tr_summary,
        enrichment.cefr_level,
        enrichment.category,
        enrichment.tags,
        JSON.stringify(enrichment.key_vocab),
      ],
    );
    return { ok: true };
  } catch (e: any) {
    await pool.query(
      `UPDATE content_articles SET admin_notes = $2, updated_at = NOW() WHERE id = $1`,
      [articleId, `enrich hata: ${e?.message?.slice(0, 500)}`],
    );
    return { ok: false, error: e?.message ?? String(e) };
  }
}

export async function enrichPending(limit = 20): Promise<{ processed: number; ok: number; failed: number }> {
  const r: any = await pool.query(
    `SELECT id FROM content_articles
       WHERE status = 'draft' AND enriched_at IS NULL
       ORDER BY published_at DESC NULLS LAST
       LIMIT $1`,
    [limit],
  );
  const ids: number[] = r.rows.map((row: any) => row.id);
  let ok = 0, failed = 0;
  for (const id of ids) {
    const res = await enrichArticle(id);
    if (res.ok) ok++; else failed++;
  }
  return { processed: ids.length, ok, failed };
}
