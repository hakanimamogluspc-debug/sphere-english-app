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

      if (!["vocab", "scene", "reading"].includes(String(type))) {
        return res.status(400).json({ error: "type: 'vocab' | 'scene' | 'reading' olmalı" });
      }
      if (!CEFR_LEVELS.includes(String(level).toUpperCase() as Cefr)) {
        return res.status(400).json({ error: "level: A1-C2 arası olmalı" });
      }

      const cefr = String(level).toUpperCase() as Cefr;
      const cat = String(category ?? "").trim();

      let items: any[] = [];
      const warnings: string[] = [];

      if (type === "vocab") {
        const n = Math.max(1, Math.min(50, parseInt(String(count), 10) || 20));
        if (!VOCAB_CATEGORIES.includes(cat as any)) {
          warnings.push(`Kategori '${cat}' önerilen listede yok — devam ediliyor ama gözden geçir.`);
        }
        const prompt = vocabPrompt(cefr, n, cat || "business_general");
        const raw = await callClaude(prompt, apiKey, Math.min(8000, n * 200 + 500));
        items = extractJSON<any[]>(raw);
        if (!Array.isArray(items)) throw new Error("Response array değil");
      } else if (type === "scene") {
        if (!SCENE_CATEGORIES.includes(cat as any)) {
          warnings.push(`Kategori '${cat}' önerilen listede yok — devam ediliyor ama gözden geçir.`);
        }
        const prompt = scenePrompt(cefr, cat || "general_business");
        const raw = await callClaude(prompt, apiKey, 3500);
        const item = extractJSON<any>(raw);
        items = [item];
      } else if (type === "reading") {
        const n = Math.max(1, Math.min(10, parseInt(String(count), 10) || 3));
        const prompt = readingPrompt(cefr, n, cat || "business_general");
        const raw = await callClaude(prompt, apiKey, Math.min(8000, n * 800 + 500));
        items = extractJSON<any[]>(raw);
        if (!Array.isArray(items)) throw new Error("Response array değil");
      }

      return res.json({ ok: true, type, level: cefr, count: items.length, items, warnings });
    } catch (e: any) {
      console.error("[admin/ai-content/generate] HATA:", e?.message);
      return res.status(500).json({ error: e?.message ?? "Üretim başarısız" });
    }
  },
);

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
    if (!["vocab", "scene", "reading"].includes(String(type))) {
      return res.status(400).json({ error: "type geçersiz" });
    }

    let imported = 0;
    const skipped: any[] = [];
    const errors: string[] = [];

    try {
      if (type === "vocab") {
        for (const it of items) {
          try {
            const word = String(it.word ?? "").trim();
            const turkish = String(it.turkish ?? "").trim();
            const level = String(it.level ?? "").toUpperCase();
            const category = String(it.category ?? "business_general");
            const imagePrompt = String(it.image_prompt ?? "");
            if (!word || !turkish || !level) {
              skipped.push({ reason: "eksik alan", item: it });
              continue;
            }
            // Duplicate check (word + level)
            const exists = await pool.query(
              "SELECT id FROM vocab_words WHERE LOWER(word) = LOWER($1) AND UPPER(level) = UPPER($2) LIMIT 1",
              [word, level],
            );
            if (exists.rows.length > 0) {
              skipped.push({ reason: "duplicate", item: it });
              continue;
            }
            await pool.query(
              `INSERT INTO vocab_words (word, turkish, image_prompt, level, category)
               VALUES ($1, $2, $3, $4, $5)`,
              [word, turkish, imagePrompt, level, category],
            );
            imported++;
          } catch (err: any) {
            errors.push(`vocab: ${err?.message}`);
          }
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
            if (!titleEn || !titleTr || !difficulty || turns.length === 0) {
              skipped.push({ reason: "eksik alan", item: it });
              continue;
            }
            // Slug üret
            const baseSlug = titleEn
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, "")
              .slice(0, 80);
            const slug = `${baseSlug}-${crypto.randomBytes(3).toString("hex")}`;

            const sceneRow = await pool.query(
              `INSERT INTO speaking_scenes (
                slug, category, title_en, title_tr, description_tr,
                user_role_tr, counterpart_role_tr,
                difficulty, min_plan, avg_duration_min, voice,
                is_active, sort_order
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, TRUE, 0)
              RETURNING id`,
              [
                slug,
                category,
                titleEn,
                titleTr,
                descTr,
                String(it.user_role_tr ?? ""),
                String(it.counterpart_role_tr ?? ""),
                difficulty,
                String(it.min_plan ?? "free"),
                parseInt(String(it.avg_duration_min ?? 5), 10) || 5,
                String(it.voice ?? "nova"),
              ],
            );
            const sceneId = sceneRow.rows[0]?.id;
            if (sceneId) {
              // Turn'leri ekle — kolonlar: turn_order, speaker, text_en, text_tr, notes_tr
              for (let idx = 0; idx < turns.length; idx++) {
                const t = turns[idx];
                await pool.query(
                  `INSERT INTO speaking_scene_turns (
                    scene_id, turn_order, speaker, text_en, text_tr, notes_tr
                  ) VALUES ($1, $2, $3, $4, $5, $6)`,
                  [
                    sceneId,
                    idx,
                    String(t.speaker ?? "user"),
                    String(t.text_en ?? ""),
                    String(t.text_tr ?? ""),
                    String(t.hint_tr ?? t.notes_tr ?? ""),
                  ],
                );
              }
              imported++;
            }
          } catch (err: any) {
            errors.push(`scene: ${err?.message}`);
          }
        }
      } else if (type === "reading") {
        for (const it of items) {
          try {
            const title = String(it.title ?? "").trim();
            const body = String(it.body ?? "").trim();
            const cefrLevel = String(it.cefr_level ?? "").toUpperCase();
            const category = String(it.category ?? "business_general");
            const summaryTr = String(it.summary_tr ?? "");
            const keywords = Array.isArray(it.keywords) ? it.keywords : [];
            if (!title || !body || !cefrLevel) {
              skipped.push({ reason: "eksik alan", item: it });
              continue;
            }
            // content_articles şeması: source, external_id, url (NOT NULL), title, body_text, tr_summary, cefr_level
            const externalId = `ai-${crypto.randomBytes(6).toString("hex")}`;
            const wordCount = body.split(/\s+/).filter(Boolean).length;
            await pool.query(
              `INSERT INTO content_articles (
                source, external_id, url, title, body_text,
                word_count, tr_summary, cefr_level, category,
                status, published_admin_at
              ) VALUES (
                'ai_generated', $1, $2, $3, $4, $5, $6, $7, $8, 'published', NOW()
              )`,
              [
                externalId,
                `internal://ai-content/${externalId}`, // sentetik URL — AI üretimi için
                title,
                body,
                wordCount,
                summaryTr,
                cefrLevel,
                category,
              ],
            );
            imported++;
          } catch (err: any) {
            errors.push(`reading: ${err?.message}`);
          }
        }
      }

      return res.json({ ok: true, type, imported, skipped: skipped.length, skippedDetails: skipped, errors });
    } catch (e: any) {
      console.error("[admin/ai-content/import] HATA:", e?.message);
      return res.status(500).json({ error: e?.message });
    }
  },
);

export default router;
