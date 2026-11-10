/**
 * Kitap pratikleri — PDF'ten kalıp ve terimleri yapay zekâyla çıkarır.
 *
 * Akış: kitabın tam PDF'i birkaç sayfalık parçalara bölünür (pdf-lib), her parça modele
 * PDF olarak gönderilir, model yalnızca kitapta GERÇEKTEN yazan kalıp/terimleri JSON döner.
 * Sonuçlar ebook_practice_items'a 'draft' olarak yazılır; admin düzeltip onaylar.
 * Öğrenci yalnızca onaylı ve yayına alınmış içeriği görür.
 *
 * Model: EBOOK_EXTRACT_MODEL (varsayılan gpt-4o). Kitap başına maliyet birkaç dolar civarı.
 */

import OpenAI from "openai";
import { PDFDocument } from "pdf-lib";
import { pool } from "@workspace/db";
import { openaiTrackedFetch } from "./ai-usage.js";
import { getObjectBuffer } from "./object-storage.js";

// Küçük parça = model daha az öğe atlıyor (6 sayfada 200 öğelik kitaptan yalnızca ~50 geldi)
export const CHUNK_PAGES = 3;

export interface ExtractedItem {
  unit: string;
  kind: "pattern" | "term";
  en: string;
  tr: string;
  explanation: string | null;
  example_en: string | null;
  example_tr: string | null;
}

export type ChunkExtractor = (pdf: Buffer, ctx: { from: number; to: number; title: string; lastUnit: string; hint?: string }) => Promise<ExtractedItem[]>;

const SYSTEM = `Sen Türk profesyonellere iş İngilizcesi öğreten bir kitabın içeriğini yapılandıran bir editörsün.
Sana kitabın birkaç sayfası PDF olarak verilecek. Görevin bu sayfalarda AÇIKÇA öğretilen:
- "pattern": kurumsal kalıp / ifade (örn. "Let's get the ball rolling")
- "term": iş terimi / kelime (örn. "agenda", "action item")
öğelerini çıkarmak.

Kurallar:
- EKSİKSİZ ol: sayfalardaki HER kalıbı ve HER terimi tek tek çıkar. Terim listeleri, tablolar, sözlükçeler ve kutular da dahildir; tablodaki her satır ayrı bir öğedir. Özetleme, seçme, "en önemlileri" yapma.
- Yalnızca sayfada yazanı al. Kitapta olmayan kalıp, çeviri ya da örnek UYDURMA.
- Türkçe anlam (tr), açıklama ve örnek cümleler kitapta varsa birebir al; yoksa tr için kısa doğru bir karşılık yaz, explanation/example alanlarını null bırak.
- Kapak, içindekiler, önsöz, tanıtım, alıştırma soruları ve cevap anahtarı öğe DEĞİLDİR; atla.
- "unit": öğenin ait olduğu ünite/bölüm başlığı, kitapta yazdığı gibi. Bu sayfalarda başlık görünmüyorsa önceki üniteyi kullan (sana verilecek).
- explanation kısa olsun (en fazla 2 cümle, Türkçe).
- Sayfalarda öğe yoksa boş liste dön.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["unit", "kind", "en", "tr", "explanation", "example_en", "example_tr"],
        properties: {
          unit: { type: "string" },
          kind: { type: "string", enum: ["pattern", "term"] },
          en: { type: "string" },
          tr: { type: "string" },
          explanation: { type: ["string", "null"] },
          example_en: { type: ["string", "null"] },
          example_tr: { type: ["string", "null"] },
        },
      },
    },
  },
} as const;

let _openai: OpenAI | null = null;
function openai(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY tanımlı değil");
  if (!_openai) _openai = new OpenAI({ fetch: openaiTrackedFetch, apiKey, timeout: 180_000, maxRetries: 2 });
  return _openai;
}

const openaiExtractor: ChunkExtractor = async (pdf, ctx) => {
  const r = await openai().chat.completions.create({
    model: process.env.EBOOK_EXTRACT_MODEL || "gpt-4o",
    temperature: 0,
    max_tokens: 12000,
    response_format: { type: "json_schema", json_schema: { name: "ebook_items", strict: true, schema: SCHEMA as any } },
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: [
          { type: "text", text: `Kitap: "${ctx.title}". Sayfalar ${ctx.from}–${ctx.to}. Önceki ünite: "${ctx.lastUnit || "(yok)"}".`
            + (ctx.hint ? `\nKitabın tanıtımı (kaç kalıp/terim içerdiğine dair ipucu): ${ctx.hint}` : "") },
          { type: "file", file: { filename: `sayfa-${ctx.from}-${ctx.to}.pdf`, file_data: `data:application/pdf;base64,${pdf.toString("base64")}` } } as any,
        ],
      },
    ],
  });
  const text = r.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(text) as { items?: ExtractedItem[] };
  return Array.isArray(parsed.items) ? parsed.items : [];
};

let extractor: ChunkExtractor = openaiExtractor;
/** Testlerde gerçek model yerine sahte çıkarıcı */
export function setExtractorForTests(fn: ChunkExtractor | null) { extractor = fn ?? openaiExtractor; }

async function loadFullPdf(ebookId: number): Promise<Buffer> {
  const a = (await pool.query(
    `SELECT data_base64, storage_key FROM ebook_assets WHERE ebook_id = $1 AND asset_type = 'full' LIMIT 1`, [ebookId],
  )).rows[0];
  if (!a) throw new Error("Kitabın tam PDF dosyası yüklenmemiş");
  return a.storage_key ? getObjectBuffer(a.storage_key) : Buffer.from(a.data_base64 ?? "", "base64");
}

export async function splitPdf(buf: Buffer, size = CHUNK_PAGES): Promise<{ from: number; to: number; pdf: Buffer }[]> {
  const src = await PDFDocument.load(buf, { ignoreEncryption: true });
  const n = src.getPageCount();
  const out: { from: number; to: number; pdf: Buffer }[] = [];
  for (let start = 0; start < n; start += size) {
    const end = Math.min(n, start + size);
    const doc = await PDFDocument.create();
    const pages = await doc.copyPages(src, Array.from({ length: end - start }, (_, i) => start + i));
    pages.forEach((p) => doc.addPage(p));
    out.push({ from: start + 1, to: end, pdf: Buffer.from(await doc.save()) });
  }
  return out;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** İş zaten çalışıyorsa false döner. */
export async function claimExtractionJob(ebookId: number): Promise<boolean> {
  const r = await pool.query(
    `INSERT INTO ebook_practice_jobs (ebook_id, status, done, total, item_count, error, started_at, finished_at)
     VALUES ($1, 'running', 0, 0, 0, NULL, NOW(), NULL)
     ON CONFLICT (ebook_id) DO UPDATE SET status = 'running', done = 0, total = 0, item_count = 0, error = NULL,
       started_at = NOW(), finished_at = NULL
     WHERE ebook_practice_jobs.status <> 'running' OR ebook_practice_jobs.started_at < NOW() - INTERVAL '45 minutes'
     RETURNING ebook_id`,
    [ebookId],
  );
  return (r.rowCount ?? 0) > 0;
}

/**
 * Çıkarımı çalıştırır. Önceki TASLAK öğeler silinir; onaylanmış/gizlenmiş öğeler korunur ve
 * aynı kalıp tekrar eklenmez.
 */
export async function runPracticeExtraction(ebookId: number, opts: { append?: boolean } = {}): Promise<{ items: number }> {
  try {
    const book = (await pool.query(`SELECT title, description FROM ebooks WHERE id = $1`, [ebookId])).rows[0];
    if (!book) throw new Error("Kitap bulunamadı");
    const chunks = await splitPdf(await loadFullPdf(ebookId));
    await pool.query(`UPDATE ebook_practice_jobs SET total = $2 WHERE ebook_id = $1`, [ebookId, chunks.length]);
    // append: "Eksikleri tara" — mevcut taslaklar da korunur, yalnızca yeni öğeler eklenir
    if (!opts.append) await pool.query(`DELETE FROM ebook_practice_items WHERE ebook_id = $1 AND status = 'draft'`, [ebookId]);

    const kept = await pool.query(`SELECT kind, en, unit_title, unit_order FROM ebook_practice_items WHERE ebook_id = $1`, [ebookId]);
    const seen = new Set(kept.rows.map((x: any) => `${x.kind}|${norm(x.en)}`));
    // Ünite eşleştirme büyük/küçük harfe duyarsız: "Günlük Ofis Dili" ile "GÜNLÜK OFİS DİLİ" aynı ünite
    const unitKey = (s: string) => s.toLocaleLowerCase("tr").replace(/\s+/g, " ").trim();
    const unitOrder = new Map<string, number>();
    const unitName = new Map<string, string>();
    for (const x of kept.rows as any[]) {
      const k = unitKey(x.unit_title);
      if (!unitOrder.has(k)) { unitOrder.set(k, x.unit_order); unitName.set(k, x.unit_title); }
    }
    const isAllCaps = (s: string) => s === s.toLocaleUpperCase("tr") && s !== s.toLocaleLowerCase("tr");
    let position = opts.append
      ? Number((await pool.query(`SELECT COALESCE(MAX(position), 0) AS p FROM ebook_practice_items WHERE ebook_id = $1`, [ebookId])).rows[0].p)
      : 0;
    let lastUnit = "";
    let inserted = 0;

    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];
      const items = await extractor(c.pdf, { from: c.from, to: c.to, title: book.title, lastUnit, hint: String(book.description ?? "").slice(0, 400) });
      for (const it of items) {
        const en = String(it.en ?? "").trim();
        if (!en || (it.kind !== "pattern" && it.kind !== "term")) continue;
        const key = `${it.kind}|${norm(en)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const raw = String(it.unit ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
        const k = raw ? unitKey(raw) : unitKey(lastUnit);
        if (!unitOrder.has(k)) { unitOrder.set(k, unitOrder.size + 1); unitName.set(k, raw || lastUnit); }
        // Aynı ünite hem normal hem BÜYÜK HARFLE geldiyse normal yazılışı tercih et
        else if (raw && isAllCaps(unitName.get(k)!) && !isAllCaps(raw)) {
          unitName.set(k, raw);
          await pool.query(`UPDATE ebook_practice_items SET unit_title = $3 WHERE ebook_id = $1 AND unit_order = $2`, [ebookId, unitOrder.get(k), raw]);
        }
        const unit = unitName.get(k)!;
        lastUnit = unit;
        await pool.query(
          `INSERT INTO ebook_practice_items (ebook_id, unit_order, unit_title, position, kind, en, tr, explanation, example_en, example_tr, source_pages)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [ebookId, unitOrder.get(k), unit, ++position, it.kind, en, String(it.tr ?? "").trim(),
           it.explanation?.trim() || null, it.example_en?.trim() || null, it.example_tr?.trim() || null, `${c.from}-${c.to}`],
        );
        inserted++;
      }
      await pool.query(`UPDATE ebook_practice_jobs SET done = $2, item_count = $3 WHERE ebook_id = $1`, [ebookId, i + 1, inserted]);
    }
    await pool.query(`UPDATE ebook_practice_jobs SET status = 'done', finished_at = NOW() WHERE ebook_id = $1`, [ebookId]);
    console.info(`[ebook-practice] kitap=${ebookId} ${chunks.length} parça, ${inserted} öğe`);
    return { items: inserted };
  } catch (e: any) {
    console.error(`[ebook-practice] kitap=${ebookId} HATA:`, e?.message);
    await pool.query(
      `UPDATE ebook_practice_jobs SET status = 'failed', error = $2, finished_at = NOW() WHERE ebook_id = $1`,
      [ebookId, String(e?.message ?? e).slice(0, 500)],
    ).catch(() => {});
    throw e;
  }
}
