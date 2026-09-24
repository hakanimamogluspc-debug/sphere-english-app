/**
 * Admin AI Content Generator — Vocab, Speaking Scenes, Reading Articles üretimi.
 *
 * Öğrenci retention için B1 → A2 → B2 öncelikli içerik üretim aracı.
 * Anthropic Claude Sonnet ile üretim, admin panelinde preview + approve,
 * onaylananlar DB'ye import.
 *
 * Endpoint'ler:
 *   POST /api/admin/ai-content/generate
 *     Body: { type, level, count, category?, context? }
 *     Response: { items: [...], warnings: [...] }
 *     Not: preview only — DB'ye YAZILMAZ
 *
 *   POST /api/admin/ai-content/import
 *     Body: { type, items: [...] }
 *     Response: { imported: N, skipped: M, errors: [...] }
 *     Not: sadece onaylanan items DB'ye yazılır
 *
 * Env: ANTHROPIC_API_KEY zorunlu.
 */

import { Router, type Response } from "express";
import crypto from "node:crypto";
import { db, pool } from "@workspace/db";
import { sql } from "drizzle-orm";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth.js";

const router = Router();

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = process.env.AI_CONTENT_MODEL ?? "claude-sonnet-4-5";
const TEMPERATURE = 0.7;

const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
type Cefr = (typeof CEFR_LEVELS)[number];

const VOCAB_CATEGORIES = [
  "business_general",
  "meetings",
  "emails",
  "sales",
  "negotiation",
  "presentations",
  "phone_calls",
  "hr",
  "finance",
  "tech",
  "customer_service",
  "everyday",
] as const;

const CARD_CATEGORIES = [
  "meetings",
  "emails",
  "phone_calls",
  "presentations",
  "sales",
  "interview",
  "self_intro",
  "customer_service",
  "business_general",
  "everyday",
  "vocabulary_expansion",
] as const;

const SCENE_CATEGORIES = [
  "general_business",
  "meetings",
  "sales",
  "negotiation",
  "presentations",
  "phone_calls",
  "tech",
  "hr",
  "finance",
  "healthcare",
] as const;

// ─── Prompt üreticileri ────────────────────────────────────────────────────

function vocabPrompt(level: Cefr, count: number, category: string): string {
  const levelGuidance: Record<Cefr, string> = {
    A1: "en temel iş İngilizcesi kelimeleri — 'meeting', 'email', 'colleague' gibi",
    A2: "temel iş İngilizcesi kelimeleri — 'schedule', 'deadline', 'client' gibi",
    B1: "orta seviye iş İngilizcesi — 'proposal', 'agenda', 'deliverable' gibi",
    B2: "üst orta seviye — 'stakeholder', 'leverage', 'implementation' gibi",
    C1: "ileri seviye — 'contingency', 'discretionary', 'articulate' gibi",
    C2: "yetkin seviye — 'expedite', 'circumvent', 'pragmatic' gibi nüanslı kelimeler",
  };

  return `Sphere English için iş İngilizcesi vocabulary üretiyorsun.

Seviye: ${level} (${levelGuidance[level]})
Kategori: ${category}
Adet: ${count}

KURALLAR:
1. Her kelime SEVİYEYE ÖZEL olmalı — A1 için 'schedule' bile olabilir, C1 için 'contingency' gibi
2. Türkçe çeviri DOĞAL olsun — Google Translate değil, Türk iş dünyasında kullanılan karşılık
3. Örnek cümle GERÇEK İŞ BAĞLAMI içersin — toplantı, email, görüşme
4. Görsel prompt AI resim üretimi için — basit, iş sahneleri ("business person at desk with laptop")
5. Duplicate kelime YOK

ÇIKTI: SADECE geçerli JSON array döndür (markdown fence YOK):
[
  {
    "word": "meeting",
    "turkish": "toplantı",
    "example_en": "The team meeting starts at 3 PM.",
    "example_tr": "Ekip toplantısı saat 3'te başlıyor.",
    "image_prompt": "professional business meeting in modern office",
    "category": "${category}",
    "level": "${level}"
  }
]

${count} kelime üret. Tümü ${level} seviye, ${category} kategorisinde.`;
}

function scenePrompt(level: Cefr, category: string): string {
  const levelGuidance: Record<Cefr, string> = {
    A1: "çok basit, kısa cümleler (5-8 kelime), günlük iş temel diyaloglar — 'Hi, I'm John from Sales'",
    A2: "basit, günlük iş cümleleri, temel gramer (present/past simple)",
    B1: "orta seviye, konu odaklı diyaloglar, phrasal verb sınırlı",
    B2: "akıcı, doğal iş dili, deyimler, karmaşık cümle yapıları",
    C1: "ileri, nüanslı iş dili, üst düzey iletişim, kültürel farkındalık",
    C2: "yetkin, native-yakın karmaşık müzakereler, ustalık gerektiren diyaloglar",
  };

  return `Sphere English için iş İngilizcesi konuşma sahnesi (speaking scene) üretiyorsun.

Seviye: ${level} (${levelGuidance[level]})
Kategori: ${category}

Bir sahne: kullanıcının bir rolü olan (örn. müşteri temsilcisi), AI'ın karşı rolü olan (örn. müşteri) bir diyalog.
6-10 tur olsun — user ve ai sırasıyla konuşur.

KURALLAR:
1. Konu ${category} ile ilgili, Türk profesyonellerin GERÇEK yaşadığı iş durumu
2. Cümleler ${level} seviyesine UYGUN — daha kolay veya zor değil
3. İlk tur ai — sahneyi başlatır (örn. "Hi, welcome. How can I help you?")
4. Turkish translations doğal ve iş bağlamında olsun
5. Görev/hedef (task_tr) net — "Müşteriye ürünü öner, ihtiyaçlarını sor" gibi

ÇIKTI: SADECE geçerli JSON döndür (markdown fence YOK):
{
  "title_en": "First Meeting with New Client",
  "title_tr": "Yeni Müşteriyle İlk Toplantı",
  "description_tr": "Yeni bir müşteriyle tanışıyorsunuz. Kendinizi tanıtın, ihtiyaçlarını dinleyin.",
  "user_role_tr": "Sales Manager (Satış Müdürü)",
  "counterpart_role_tr": "New Client (Yeni Müşteri)",
  "task_tr": "Kendini tanıt, müşterinin sektörünü öğren, ürününüzü kısaca anlat",
  "difficulty": "${level}",
  "avg_duration_min": 5,
  "voice": "nova",
  "min_plan": "free",
  "turns": [
    { "speaker": "ai", "text_en": "Hi, welcome to our office.", "text_tr": "Merhaba, ofisimize hoş geldiniz.", "hint_tr": "Selamla ve kendini tanıt" },
    { "speaker": "user", "text_en": "Thank you. My name is ...", "text_tr": "Teşekkürler. Adım ...", "hint_tr": "Adını söyle ve şirketini belirt" }
  ]
}

Tek sahne üret. ${level} seviye, ${category} kategori.`;
}

function readingPrompt(level: Cefr, count: number, category: string): string {
  const wordCount: Record<Cefr, string> = {
    A1: "80-120",
    A2: "120-180",
    B1: "180-250",
    B2: "250-350",
    C1: "350-450",
    C2: "400-500",
  };

  const levelGuidance: Record<Cefr, string> = {
    A1: "en basit cümleler (present simple), tekrarlar bilinçli, 5-8 kelimelik cümleler",
    A2: "basit cümleler, past simple, present continuous, günlük iş vokabülerü",
    B1: "orta seviye, present perfect, conditionals, iş vokabülerü",
    B2: "akıcı, karmaşık cümleler, phrasal verbs, iş jargonu",
    C1: "ileri, nüanslı, deyimler, formal register",
    C2: "yetkin, native-yakın, karmaşık argüman yapıları",
  };

  return `Sphere English için iş İngilizcesi kısa okuma parçaları üretiyorsun.

Seviye: ${level} (${levelGuidance[level]})
Kategori: ${category}
Adet: ${count}
Kelime sayısı (her parça): ${wordCount[level]}

Her parça:
- İş dünyasından bir mini hikaye, senaryo veya bilgi metni
- Öğrenciyi sıkmayacak — modern, işe yarayacak konular (kariyer ipuçları, iletişim, teknoloji)
- Cümle uzunluğu seviyeye uygun
- 3-5 anahtar kelime öne çıkar

ÇIKTI: SADECE geçerli JSON array döndür (markdown fence YOK):
[
  {
    "title": "Preparing for a Job Interview",
    "cefr_level": "${level}",
    "category": "${category}",
    "body": "Job interviews can be stressful. Here are three tips...",
    "summary_tr": "İş görüşmesine hazırlanmak için üç ipucu.",
    "keywords": ["interview", "preparation", "questions"],
    "estimated_read_minutes": 3
  }
]

${count} parça üret. Tümü ${level} seviye, ${category} kategori.`;
}

function businessCardPrompt(level: Cefr, count: number, category: string): string {
  const levelGuidance: Record<Cefr, string> = {
    A1: "en basit — 4-6 kelimelik kalıp ifadeler ('Nice to meet you')",
    A2: "temel — 5-8 kelimelik günlük iş kalıpları ('Could you send me the file?')",
    B1: "orta — 6-10 kelimelik iş kalıpları, phrasal verb sınırlı",
    B2: "üst orta — doğal iş dili, deyimler ve nüans başlangıcı",
    C1: "ileri — nüanslı, diplomatik kalıplar ('I'd be inclined to suggest…')",
    C2: "yetkin — sofistike, kültürel farkındalık gerektiren kalıplar",
  };

  return `Sphere English için mikro-içerik "İş Kartı" (Business Card) üretiyorsun.

Her kart 2-3 dakikada okunacak, KONKRE, İŞE YARAR bir iş İngilizcesi kalıp öğretir.
Örnek konular: "Toplantıda 'let me get back to you' yerine ne söylenir",
"Email red cevabı — kibar 4 formül", "Cold call açılış cümleleri", "Zam istemenin İngilizcesi".

Seviye: ${level} (${levelGuidance[level]})
Kategori: ${category}
Adet: ${count}

KURALLAR:
1. context_tr — 2-3 cümle Türkçe: "Bu kartı ne zaman kullanacaksın?" — somut bir iş durumu
2. phrase_en — ana ifade (kısa ve net)
3. alternatives_en — 3-4 alternatif kalıp (farklı formallık seviyeleri)
4. example_en — gerçek iş bağlamında bir cümle
5. translation_tr — example_en'in doğal Türkçe çevirisi
6. tags — 2-4 filtrelenebilir etiket (örn: ["email","polite","refusal"])
7. Türk profesyonellerin GERÇEK ihtiyaçlarına odaklan — kültürel farkındalık, kibarlık, formallık

ÇIKTI: SADECE geçerli JSON array döndür (markdown fence YOK):
[
  {
    "level": "${level}",
    "category": "${category}",
    "context_tr": "Bir toplantıda hemen cevap veremediğin bir soru geldiğinde profesyonelce süre kazanmak istersin. 'Bilmiyorum' yerine bu kalıp senin hazırlıksızlığını gizler.",
    "phrase_en": "Let me get back to you on that.",
    "alternatives_en": [
      "I'll need to check and get back to you.",
      "Can I circle back to you on this?",
      "Let me look into it and follow up."
    ],
    "example_en": "That's a great question — let me get back to you on that after I check with the team.",
    "translation_tr": "Harika bir soru — ekiple konuşup size dönerim.",
    "tags": ["meeting", "professional", "buy_time"]
  }
]

${count} kart üret. Tümü ${level} seviye, ${category} kategori. Konuları çeşitlendir — aynı senaryoyu tekrar etme.`;
}

// ─── Claude API çağrısı ────────────────────────────────────────────────────

async function callClaude(userPrompt: string, apiKey: string, maxTokens = 4000): Promise<string> {
  const body = {
    model: MODEL,
    max_tokens: maxTokens,
    temperature: TEMPERATURE,
    messages: [{ role: "user", content: userPrompt }],
  };

  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Claude API ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  const allText = (data.content ?? [])
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text!)
    .join("\n");

  if (!allText) throw new Error("Claude'dan boş yanıt");
  return allText;
}

function extractJSON<T>(raw: string): T {
  let text = raw.trim();
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try {
    return JSON.parse(text);
  } catch {
    // Find first { or [ and last } or ]
    const startObj = text.indexOf("{");
    const startArr = text.indexOf("[");
    let start = -1;
    let endChar = "";
    if (startArr !== -1 && (startObj === -1 || startArr < startObj)) {
      start = startArr;
      endChar = "]";
    } else if (startObj !== -1) {
      start = startObj;
      endChar = "}";
    }
    if (start === -1) throw new Error("Geçerli JSON bulunamadı");
    const end = text.lastIndexOf(endChar);
    if (end < start) throw new Error("Geçerli JSON bulunamadı");
    return JSON.parse(text.slice(start, end + 1));
  }
}

// ─── Helper: tek bir üretim (route handler'lar ve bulk için ortak) ────────

async function runGenerate(
  type: string,
  cefr: Cefr,
  cat: string,
  count: number,
  apiKey: string,
): Promise<{ items: any[]; warnings: string[] }> {
  const warnings: string[] = [];
  let items: any[] = [];

  if (type === "vocab") {
    const n = Math.max(1, Math.min(50, count || 20));
    if (!VOCAB_CATEGORIES.includes(cat as any)) warnings.push(`Kategori '${cat}' önerilen listede yok`);
    const raw = await callClaude(vocabPrompt(cefr, n, cat || "business_general"), apiKey, Math.min(8000, n * 200 + 500));
    items = extractJSON<any[]>(raw);
    if (!Array.isArray(items)) throw new Error("Response array değil");
  } else if (type === "scene") {
    if (!SCENE_CATEGORIES.includes(cat as any)) warnings.push(`Kategori '${cat}' önerilen listede yok`);
    const raw = await callClaude(scenePrompt(cefr, cat || "general_business"), apiKey, 3500);
    items = [extractJSON<any>(raw)];
  } else if (type === "reading") {
    const n = Math.max(1, Math.min(10, count || 3));
    const raw = await callClaude(readingPrompt(cefr, n, cat || "business_general"), apiKey, Math.min(8000, n * 800 + 500));
    items = extractJSON<any[]>(raw);
    if (!Array.isArray(items)) throw new Error("Response array değil");
  } else if (type === "business_card") {
    const n = Math.max(1, Math.min(30, count || 10));
    if (!CARD_CATEGORIES.includes(cat as any)) warnings.push(`Kategori '${cat}' önerilen listede yok`);
    const raw = await callClaude(businessCardPrompt(cefr, n, cat || "business_general"), apiKey, Math.min(8000, n * 400 + 500));
    items = extractJSON<any[]>(raw);
    if (!Array.isArray(items)) throw new Error("Response array değil");
  } else {
    throw new Error("Geçersiz tür: " + type);
  }
  return { items, warnings };
}

// ─── POST /admin/ai-content/generate ───────────────────────────────────────

router.post(
  "/admin/ai-content/generate",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "ANTHROPIC_API_KEY environment değişkeni tanımlı değil" });
      }

      const { type, level, count, category } = req.body ?? {};

      if (!["vocab", "scene", "reading", "business_card"].includes(String(type))) {
        return res.status(400).json({ error: "type: 'vocab' | 'scene' | 'reading' | 'business_card' olmalı" });
      }
      if (!CEFR_LEVELS.includes(String(level).toUpperCase() as Cefr)) {
        return res.status(400).json({ error: "level: A1-C2 arası olmalı" });
      }

      const cefr = String(level).toUpperCase() as Cefr;
      const cat = String(category ?? "").trim();
      const n = parseInt(String(count), 10) || 0;
      const { items, warnings } = await runGenerate(String(type), cefr, cat, n, apiKey);
      return res.json({ ok: true, type, level: cefr, count: items.length, items, warnings });
    } catch (e: any) {
      console.error("[admin/ai-content/generate] HATA:", e?.message);
      return res.status(500).json({ error: e?.message ?? "Üretim başarısız" });
    }
  },
);

// ─── Helper: import (route handler + bulk için ortak) ────────────────────

async function runImport(
  type: string,
  items: any[],
): Promise<{ imported: number; skipped: any[]; errors: string[] }> {
  let imported = 0;
  const skipped: any[] = [];
  const errors: string[] = [];

  if (type === "vocab") {
    for (const it of items) {
      try {
        const word = String(it.word ?? "").trim();
        const turkish = String(it.turkish ?? "").trim();
        const level = String(it.level ?? "").toUpperCase();
        const category = String(it.category ?? "business_general");
        const imagePrompt = String(it.image_prompt ?? "");
        if (!word || !turkish || !level) { skipped.push({ reason: "eksik alan", item: it }); continue; }
        const exists = await pool.query(
          "SELECT id FROM vocab_words WHERE LOWER(word) = LOWER($1) AND UPPER(level) = UPPER($2) LIMIT 1",
          [word, level],
        );
        if (exists.rows.length > 0) { skipped.push({ reason: "duplicate", item: it }); continue; }
        await pool.query(
          `INSERT INTO vocab_words (word, turkish, image_prompt, level, category) VALUES ($1, $2, $3, $4, $5)`,
          [word, turkish, imagePrompt, level, category],
        );
        imported++;
      } catch (err: any) { errors.push(`vocab: ${err?.message}`); }
    }
  } else if (type === "scene") {
    for (const it of items) {
      try {
        const titleEn = String(it.title_en ?? "").trim();
        const titleTr = String(it.title_tr ?? "").trim();
        const descTr = String(it.description_tr ?? "").trim();
        const difficulty = String(it.difficulty ?? "").toUpperCase();
        const category = String(it.category ?? it.scene_category ?? "general_business");
        const turns = Array.isArray(it.turns) ? it.turns : [];
        if (!titleEn || !titleTr || !difficulty || turns.length === 0) { skipped.push({ reason: "eksik alan", item: it }); continue; }
        const baseSlug = titleEn.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
        const slug = `${baseSlug}-${crypto.randomBytes(3).toString("hex")}`;
        const sceneRow = await pool.query(
          `INSERT INTO speaking_scenes (slug, category, title_en, title_tr, description_tr, user_role_tr, counterpart_role_tr, difficulty, min_plan, avg_duration_min, voice, is_active, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, TRUE, 0) RETURNING id`,
          [slug, category, titleEn, titleTr, descTr, String(it.user_role_tr ?? ""), String(it.counterpart_role_tr ?? ""), difficulty, String(it.min_plan ?? "free"), parseInt(String(it.avg_duration_min ?? 5), 10) || 5, String(it.voice ?? "nova")],
        );
        const sceneId = sceneRow.rows[0]?.id;
        if (sceneId) {
          for (let idx = 0; idx < turns.length; idx++) {
            const t = turns[idx];
            await pool.query(
              `INSERT INTO speaking_scene_turns (scene_id, turn_order, speaker, text_en, text_tr, notes_tr) VALUES ($1, $2, $3, $4, $5, $6)`,
              [sceneId, idx, String(t.speaker ?? "user"), String(t.text_en ?? ""), String(t.text_tr ?? ""), String(t.hint_tr ?? t.notes_tr ?? "")],
            );
          }
          imported++;
        }
      } catch (err: any) { errors.push(`scene: ${err?.message}`); }
    }
  } else if (type === "reading") {
    for (const it of items) {
      try {
        const title = String(it.title ?? "").trim();
        const body = String(it.body ?? "").trim();
        const cefrLevel = String(it.cefr_level ?? "").toUpperCase();
        const category = String(it.category ?? "business_general");
        const summaryTr = String(it.summary_tr ?? "");
        if (!title || !body || !cefrLevel) { skipped.push({ reason: "eksik alan", item: it }); continue; }
        const externalId = `ai-${crypto.randomBytes(6).toString("hex")}`;
        const wordCount = body.split(/\s+/).filter(Boolean).length;
        await pool.query(
          `INSERT INTO content_articles (source, external_id, url, title, body_text, word_count, tr_summary, cefr_level, category, status, published_admin_at)
           VALUES ('ai_generated', $1, $2, $3, $4, $5, $6, $7, $8, 'published', NOW())`,
          [externalId, `internal://ai-content/${externalId}`, title, body, wordCount, summaryTr, cefrLevel, category],
        );
        imported++;
      } catch (err: any) { errors.push(`reading: ${err?.message}`); }
    }
  } else if (type === "business_card") {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS business_cards (
        id SERIAL PRIMARY KEY, level VARCHAR(4) NOT NULL, category VARCHAR(40) NOT NULL,
        context_tr TEXT NOT NULL, phrase_en TEXT NOT NULL, alternatives_en JSONB NOT NULL DEFAULT '[]'::jsonb,
        example_en TEXT NOT NULL, translation_tr TEXT NOT NULL, tags TEXT[] NOT NULL DEFAULT '{}',
        is_active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    for (const it of items) {
      try {
        const level = String(it.level ?? "").toUpperCase();
        const category = String(it.category ?? "business_general");
        const contextTr = String(it.context_tr ?? "").trim();
        const phraseEn = String(it.phrase_en ?? "").trim();
        const exampleEn = String(it.example_en ?? "").trim();
        const translationTr = String(it.translation_tr ?? "").trim();
        const alternativesEn = Array.isArray(it.alternatives_en) ? it.alternatives_en : [];
        const tags = Array.isArray(it.tags) ? it.tags.map((t: any) => String(t)) : [];
        if (!level || !contextTr || !phraseEn || !exampleEn || !translationTr) { skipped.push({ reason: "eksik alan", item: it }); continue; }
        const exists = await pool.query(
          "SELECT id FROM business_cards WHERE LOWER(phrase_en) = LOWER($1) AND level = $2 LIMIT 1",
          [phraseEn, level],
        );
        if (exists.rows.length > 0) { skipped.push({ reason: "duplicate", item: it }); continue; }
        await pool.query(
          `INSERT INTO business_cards (level, category, context_tr, phrase_en, alternatives_en, example_en, translation_tr, tags)
           VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)`,
          [level, category, contextTr, phraseEn, JSON.stringify(alternativesEn), exampleEn, translationTr, tags],
        );
        imported++;
      } catch (err: any) { errors.push(`business_card: ${err?.message}`); }
    }
  }

  return { imported, skipped, errors };
}

// ─── POST /admin/ai-content/import ─────────────────────────────────────────

router.post(
  "/admin/ai-content/import",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    const { type, items } = req.body ?? {};

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "items array boş olamaz" });
    }
    if (!["vocab", "scene", "reading", "business_card"].includes(String(type))) {
      return res.status(400).json({ error: "type geçersiz" });
    }

    try {
      const { imported, skipped, errors } = await runImport(String(type), items);
      return res.json({ ok: true, type, imported, skipped: skipped.length, skippedDetails: skipped, errors });
    } catch (e: any) {
      console.error("[admin/ai-content/import] HATA:", e?.message);
      return res.status(500).json({ error: e?.message });
    }
  },
);

// ─── POST /admin/ai-content/bulk-generate ────────────────────────────────
// Çoklu (level, category) kombinasyonlarını tek istekte üret + import et.
// Body: { type, level, categories: string[], countPerCategory: number, autoImport?: boolean }
// Response: { batches: [{level, category, generated, imported, warnings, errors}], totals }
router.post(
  "/admin/ai-content/bulk-generate",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY tanımlı değil" });

      const { type, level, categories, countPerCategory, autoImport } = req.body ?? {};
      if (!["vocab", "scene", "reading", "business_card"].includes(String(type))) {
        return res.status(400).json({ error: "type: 'vocab' | 'scene' | 'reading' | 'business_card' olmalı" });
      }
      if (!CEFR_LEVELS.includes(String(level).toUpperCase() as Cefr)) {
        return res.status(400).json({ error: "level: A1-C2" });
      }
      if (!Array.isArray(categories) || categories.length === 0) {
        return res.status(400).json({ error: "categories boş olamaz" });
      }
      if (categories.length > 15) {
        return res.status(400).json({ error: "Maksimum 15 kategori" });
      }
      const cefr = String(level).toUpperCase() as Cefr;
      const n = parseInt(String(countPerCategory), 10) || 10;
      const doImport = autoImport !== false; // varsayılan true

      // Uzun sürebilir — HTTP timeout'a takılmasın diye header'ı önden set et
      res.setTimeout(15 * 60 * 1000);

      const batches: any[] = [];
      let totalGenerated = 0;
      let totalImported = 0;
      let totalErrors = 0;

      for (const cat of categories) {
        const category = String(cat).trim();
        try {
          const { items, warnings } = await runGenerate(String(type), cefr, category, n, apiKey);
          let imported = 0;
          let skippedCount = 0;
          let errList: string[] = [];
          if (doImport) {
            const r = await runImport(String(type), items);
            imported = r.imported;
            skippedCount = r.skipped.length;
            errList = r.errors;
          }
          batches.push({
            level: cefr,
            category,
            generated: items.length,
            imported,
            skipped: skippedCount,
            warnings,
            errors: errList,
          });
          totalGenerated += items.length;
          totalImported += imported;
          totalErrors += errList.length;
        } catch (e: any) {
          batches.push({
            level: cefr,
            category,
            generated: 0,
            imported: 0,
            skipped: 0,
            warnings: [],
            errors: [e?.message ?? "hata"],
          });
          totalErrors++;
        }
      }

      return res.json({
        ok: true,
        type,
        level: cefr,
        totals: {
          batches: batches.length,
          generated: totalGenerated,
          imported: totalImported,
          errors: totalErrors,
        },
        batches,
      });
    } catch (e: any) {
      console.error("[admin/ai-content/bulk-generate] HATA:", e?.message);
      return res.status(500).json({ error: e?.message });
    }
  },
);


export default router;
