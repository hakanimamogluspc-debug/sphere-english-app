/**
 * Dictionary Lookup — Free Dictionary API + GPT-4o-mini TR fallback
 *
 * GET /api/dictionary/:word[?context=optional-english-sentence]
 *   → { word, tr, phonetic, audio_url, definitions, source }
 *
 * Cache: dictionary_cache tablosu (aynı kelime tekrar sorulmaz)
 * Free Dictionary: https://api.dictionaryapi.dev/api/v2/entries/en/{word}
 */

import { Router, type Response } from "express";
import { pool } from "@workspace/db";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";
import OpenAI from "openai";

const router = Router();
const FD_ENDPOINT = "https://api.dictionaryapi.dev/api/v2/entries/en";

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY yok");
    _openai = new OpenAI({ apiKey });
  }
  return _openai;
}

function normalize(w: string): string {
  return w.toLowerCase().trim().replace(/[^a-z\-']/g, "");
}

type FDResponse = {
  word: string;
  phonetic?: string;
  phonetics?: Array<{ text?: string; audio?: string }>;
  meanings?: Array<{
    partOfSpeech: string;
    definitions: Array<{ definition: string; example?: string }>;
  }>;
};

async function fetchFreeDictionary(word: string): Promise<{
  phonetic: string | null;
  audio_url: string | null;
  definitions: Array<{ pos: string; meaning: string; example: string | null }>;
} | null> {
  try {
    const res = await fetch(`${FD_ENDPOINT}/${encodeURIComponent(word)}`, {
      headers: { "User-Agent": "SphereEnglish/1.0" },
    });
    if (!res.ok) return null;
    const data = await res.json() as FDResponse[];
    if (!Array.isArray(data) || data.length === 0) return null;
    const entry = data[0];

    // Fonetik
    let phonetic = entry.phonetic ?? null;
    let audioUrl: string | null = null;
    if (entry.phonetics) {
      for (const p of entry.phonetics) {
        if (!phonetic && p.text) phonetic = p.text;
        if (!audioUrl && p.audio) audioUrl = p.audio;
      }
    }

    // Tanımlar — her POS için ilk 1 tanım, max 3 POS
    const defs: Array<{ pos: string; meaning: string; example: string | null }> = [];
    for (const m of (entry.meanings ?? []).slice(0, 3)) {
      const d = m.definitions?.[0];
      if (d?.definition) {
        defs.push({
          pos: m.partOfSpeech,
          meaning: d.definition.slice(0, 400),
          example: d.example ? d.example.slice(0, 300) : null,
        });
      }
    }

    return { phonetic, audio_url: audioUrl, definitions: defs };
  } catch {
    return null;
  }
}

async function fetchGptTranslation(word: string, context: string | null, enDefinition: string | null): Promise<string | null> {
  try {
    const contextLine = context ? `\nBağlam cümlesi: "${context.slice(0, 300)}"` : "";
    const defLine = enDefinition ? `\nİngilizce tanım: "${enDefinition.slice(0, 300)}"` : "";
    const res: any = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Sen bir çevirmensin. İngilizce kelimenin Türkçe karşılığını en fazla 3 kelime olarak, virgülle ayrılmış şekilde döndür. JSON: {"tr": "..."}. Yorum yapma, sadece çeviri.`,
        },
        {
          role: "user",
          content: `Kelime: "${word}"${contextLine}${defLine}`,
        },
      ],
    });
    const raw = res?.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);
    const tr = String(parsed.tr ?? "").trim().slice(0, 200);
    return tr || null;
  } catch {
    return null;
  }
}

router.get("/dictionary/:word", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const raw = String(req.params.word ?? "");
    const word = normalize(raw);
    if (word.length < 2 || word.length > 40) return res.status(400).json({ error: "geçersiz kelime" });

    const context = String(req.query.context ?? "").slice(0, 400) || null;

    // Cache
    const cached: any = await pool.query(
      `SELECT tr_translation, phonetic, audio_url, definitions, source
         FROM dictionary_cache WHERE word = $1 LIMIT 1`,
      [word],
    );
    if (cached.rows[0]) {
      const c = cached.rows[0];
      // fetch_count + last_used_at güncelle (fire and forget)
      pool.query(
        `UPDATE dictionary_cache SET fetch_count = fetch_count + 1, last_used_at = NOW() WHERE word = $1`,
        [word],
      ).catch(() => {});
      return res.json({
        word,
        tr: c.tr_translation,
        phonetic: c.phonetic,
        audio_url: c.audio_url,
        definitions: c.definitions ?? [],
        source: c.source,
        cached: true,
      });
    }

    // Free Dictionary
    const fd = await fetchFreeDictionary(word);

    // GPT TR çevirisi — Free Dict'in ilk tanımını bağlam olarak kullan
    const firstDef = fd?.definitions?.[0]?.meaning ?? null;
    const tr = await fetchGptTranslation(word, context, firstDef);

    // Hiçbiri bulamadıysa: not_found kaydı at (aynı kelime tekrar sorulmasın)
    if (!fd && !tr) {
      await pool.query(
        `INSERT INTO dictionary_cache (word, source) VALUES ($1, 'not_found')
         ON CONFLICT (word) DO NOTHING`,
        [word],
      );
      return res.status(404).json({ error: "kelime bulunamadı", word });
    }

    const source = fd && tr ? "both" : fd ? "free_dict" : "gpt";
    const insertRes: any = await pool.query(
      `INSERT INTO dictionary_cache (word, tr_translation, phonetic, audio_url, definitions, source)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)
       ON CONFLICT (word) DO UPDATE
         SET tr_translation = EXCLUDED.tr_translation,
             phonetic = EXCLUDED.phonetic,
             audio_url = EXCLUDED.audio_url,
             definitions = EXCLUDED.definitions,
             source = EXCLUDED.source,
             last_used_at = NOW()
       RETURNING *`,
      [word, tr, fd?.phonetic ?? null, fd?.audio_url ?? null,
       JSON.stringify(fd?.definitions ?? []), source],
    );

    return res.json({
      word,
      tr,
      phonetic: fd?.phonetic ?? null,
      audio_url: fd?.audio_url ?? null,
      definitions: fd?.definitions ?? [],
      source,
      cached: false,
    });
  } catch (e: any) {
    console.error("[dictionary]", e?.message);
    return res.status(500).json({ error: e?.message });
  }
});

export default router;
