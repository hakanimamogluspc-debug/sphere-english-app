/**
 * İçerik Motoru — Admin paneli için kısa-format içerik üretici.
 *
 * POST /api/admin/content-engine/generate
 *   Body: { topic: string, hook?: string, trigger?: string }
 *   Response: { hook_type, trigger, hook_line, scenes[5], caption, hashtags[] }
 *
 * Claude Sonnet API'a system + user prompt at, JSON dön, fence cleanup,
 * parse hatasında 1 kez retry.
 *
 * Env: ANTHROPIC_API_KEY zorunlu.
 */

import { Router, type Request, type Response } from "express";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth.js";

const router = Router();

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = process.env.CONTENT_ENGINE_MODEL ?? "claude-sonnet-4-5";
const MAX_TOKENS = 1500;
const TEMPERATURE = 0.75;

const SYSTEM_PROMPT = `Sen Sphere English için çalışan bir kısa-format içerik motorusun.

MARKA: B2B kurumsal İngilizce eğitimi, Oxford partnerli, kurumsal ve güven veren ton.
Lacivert/turkuaz kimlik. Hedef kitle: Türk profesyoneller ve karar vericiler (İK direktörü, yönetici).

GÖREV: Verilen konudan 28 saniyelik bir Instagram Reel paketi üret: sahne sahne script + caption + hashtag.

SCRIPT YAPISI (kaydetme oranı için tasarlandı, bu zamanlamaya uy):
- 0–2 sn  KANCA: yüzle değil çarpıcı bir CÜMLEYLE aç. Çelişki/korku/sürpriz olsun.
- 2–6 sn  AĞRI: izleyicinin yaşadığı anı adlandır; fiziksel detay kullan (kalbin hızlanması, boğaz düğümü).
- 6–13 sn REFRAME: "sorun senin İngilizcen değil" — suçu yanlış yönteme/sisteme yükle.
- 13–24 sn DEĞER: KAYDEDİLEBİLİR 3 somut kalıp/çerçeve ver (numaralı).
- 24–28 sn İNCE CTA: paylaşımı tetikle, satış yapma (ör. "Bunu yaşayan birini etiketle").

KANCA KURALLARI:
- İlk cümle adresli olsun ("İngilizcen" değil, "İngilizce call'da donman"). Genel/klişe açılış yok.
- Görsel yönü ilk 1.5 sn'de net olsun; ima edilen jump-cut'lar olsun.

GİRDİYE GÖRE:
- "Kanca tipi" auto ise: Identity Call / Contrarian / Open Loop / Confession / Outcome-first içinden konuya en uygununu sen seç.
- "Tetikleyici" auto ise: Sürpriz / Korku / Ego / Aciliyet / Arzu içinden en güçlüsünü sen seç.

CAPTION KURALLARI:
- Türkçe. Kanca cümlesini güçlendir, 1 satır empati, 1 yorum yemi sorusu (izleyiciyi seçim yapmaya zorla: "hangisinde donuyorsun: sunum / birebir / call?"), sonda ince CTA: "Yöntem profilde".
- SEO için şu kelimeler doğal geçsin: kurumsal ingilizce, toplantı, business english.
- Abartılı emoji ve agresif satış dili yok.

HASHTAG KURALLARI:
- 5–8 etiket, karışık: geniş (#businessenglish #kurumsalingilizce) + niş (#toplantiingilizcesi #isingilizcesi) + niyet (#kariyer #ingilizcepratik) + marka (#sphereenglish).

YASAKLAR:
- Oxford partnerliği, sayısal istatistik veya "native gibi konuşursun" gibi doğrulanmamış iddialar UYDURMA.
- Klişe ("İngilizce öğrenmek çok kolay") kullanma.

ÇIKTI BİÇİMİ:
- SADECE geçerli JSON döndür. Markdown, kod bloğu işareti, açıklama veya ön/son metin YOK.
- Şu şemaya birebir uy:

{
  "hook_type": "Identity Call | Contrarian | Open Loop | Confession | Outcome-first",
  "trigger": "Sürpriz | Korku | Ego | Aciliyet | Arzu",
  "hook_line": "0–2 sn ekran metni (tek çarpıcı cümle)",
  "scenes": [
    { "time": "0–2 sn",   "visual": "...", "screen_text": "...", "voiceover": "..." },
    { "time": "2–6 sn",   "visual": "...", "screen_text": "...", "voiceover": "..." },
    { "time": "6–13 sn",  "visual": "...", "screen_text": "...", "voiceover": "..." },
    { "time": "13–24 sn", "visual": "...", "screen_text": "...", "voiceover": "..." },
    { "time": "24–28 sn", "visual": "...", "screen_text": "...", "voiceover": "..." }
  ],
  "caption": "Türkçe caption + yorum yemi + ince CTA",
  "hashtags": ["#businessenglish", "#kurumsalingilizce", "..."]
}

Alanları kısa ve net tut.`;

interface ContentPacket {
  hook_type: string;
  trigger: string;
  hook_line: string;
  scenes: Array<{ time: string; visual: string; screen_text: string; voiceover: string }>;
  caption: string;
  hashtags: string[];
}

// Claude'un response text'ini parse et — fence'leri temizle, JSON parse
function extractJSON(raw: string): ContentPacket {
  let text = raw.trim();

  // ```json ... ``` veya ``` ... ``` fence'leri temizle
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();

  // Önce direkt parse dene
  try {
    return JSON.parse(text);
  } catch {
    // İçinden ilk { ... } bloğunu çıkar
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1 || end < start) {
      throw new Error("Geçerli JSON bulunamadı");
    }
    const candidate = text.slice(start, end + 1);
    return JSON.parse(candidate);
  }
}

async function callClaude(
  userMessage: string,
  apiKey: string,
  retryNote?: string,
): Promise<ContentPacket> {
  const body = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    temperature: TEMPERATURE,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: retryNote
          ? `${userMessage}\n\nÖNEMLİ NOT: ${retryNote}`
          : userMessage,
      },
    ],
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
    throw new Error(`Claude API error ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };

  // Tüm text bloklarını birleştir
  const allText = (data.content ?? [])
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text!)
    .join("\n");

  if (!allText) {
    throw new Error("Claude'dan boş yanıt geldi");
  }

  return extractJSON(allText);
}

// ─── Marka güvenliği kontrolü ──────────────────────────────────────────────
// Çıktıda riskli iddialar varsa frontend kırmızı uyarı şeridi gösterir
function checkBrandSafety(packet: ContentPacket): string[] {
  const warnings: string[] = [];
  const allText = [
    packet.hook_line,
    packet.caption,
    ...packet.scenes.flatMap((s) => [s.visual, s.screen_text, s.voiceover]),
  ]
    .join(" ")
    .toLowerCase();

  if (/\boxford\b/.test(allText)) {
    warnings.push("Oxford partnerliği iddiası içeriyor — doğrulanmadan yayınlama.");
  }
  if (/native (gibi|seviye|akıcı)/.test(allText)) {
    warnings.push("'Native gibi' tarzı iddia içeriyor — bu söz veremezsin.");
  }
  if (/%\d{2,}|\b\d{2,}%/.test(allText)) {
    warnings.push("Sayısal istatistik içeriyor — kaynağı kanıtsız ise kaldır.");
  }
  if (/\bortalama \d+ (gün|hafta|ay)\b/.test(allText)) {
    warnings.push("Süre vaadi içeriyor — sözleşmeye dönüşecek bir iddia olabilir.");
  }
  return warnings;
}

// ─── Route ─────────────────────────────────────────────────────────────────
router.post(
  "/admin/content-engine/generate",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error:
          "ANTHROPIC_API_KEY ortam değişkeni tanımlı değil. Easypanel → Environment Variables'a ekleyin.",
      });
    }

    const { topic, hook, trigger } = (req.body ?? {}) as {
      topic?: string;
      hook?: string;
      trigger?: string;
    };

    if (!topic || typeof topic !== "string" || topic.trim().length < 3) {
      return res.status(400).json({ error: "Konu en az 3 karakter olmalı." });
    }

    const userMessage = [
      `Konu: ${topic.trim().slice(0, 500)}`,
      `Kanca tipi: ${hook?.trim() || "Auto"}`,
      `Tetikleyici: ${trigger?.trim() || "Auto"}`,
    ].join("\n");

    try {
      let packet: ContentPacket;
      try {
        packet = await callClaude(userMessage, apiKey);
      } catch (firstErr: any) {
        // Parse hatası olursa 1 kez "sadece JSON" notuyla retry
        if (/JSON|parse/i.test(String(firstErr?.message))) {
          packet = await callClaude(
            userMessage,
            apiKey,
            "Önceki çıktın JSON olarak parse edilemedi. Bu sefer SADECE geçerli JSON döndür, başka hiçbir şey yazma.",
          );
        } else {
          throw firstErr;
        }
      }

      // Minimal şema doğrulaması
      if (
        !packet.hook_line ||
        !Array.isArray(packet.scenes) ||
        packet.scenes.length === 0 ||
        !packet.caption ||
        !Array.isArray(packet.hashtags)
      ) {
        return res.status(502).json({
          error: "AI eksik şemada yanıt verdi, lütfen tekrar deneyin.",
        });
      }

      const warnings = checkBrandSafety(packet);

      return res.json({
        ok: true,
        packet,
        warnings,
        meta: {
          model: MODEL,
          topic: topic.trim(),
          hook: hook?.trim() || "Auto",
          trigger: trigger?.trim() || "Auto",
        },
      });
    } catch (err: any) {
      console.error("[content-engine] error:", err?.message ?? err);
      return res.status(500).json({
        error: err?.message ?? "İçerik üretimi başarısız oldu.",
      });
    }
  },
);

export default router;
