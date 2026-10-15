/**
 * OpenAI kullanım/maliyet takibi.
 *
 * Kullanım: new OpenAI({ apiKey, fetch: openaiTrackedFetch })
 * Tüm OpenAI çağrıları bu fetch'ten geçer; yanıt JSON'undaki `usage` alanından
 * token sayısı okunur, fiyat tablosuyla maliyet hesaplanır, ai_usage_log'a yazılır.
 * İsteği başlatan API route'u lib/metrics.ts'teki AsyncLocalStorage'dan alınır.
 *
 * Fiyatlar (USD / 1M token) — OpenAI liste fiyatı, 2026-10. Model çıkınca ekle;
 * tabloda olmayan model `priced=false` ile kaydedilir, admin ekranında uyarı çıkar.
 */

import { pool } from "@workspace/db";
import { requestContext } from "./metrics.js";

type Price = { in: number; out: number } | { perMinute: number } | { perMChars: number };

const PRICES: Record<string, Price> = {
  // Chat / responses
  "gpt-4o-mini": { in: 0.15, out: 0.60 },
  "gpt-4o": { in: 2.50, out: 10.00 },
  "gpt-4.1": { in: 2.00, out: 8.00 },
  "gpt-4.1-mini": { in: 0.40, out: 1.60 },
  "gpt-4.1-nano": { in: 0.10, out: 0.40 },
  "gpt-5": { in: 1.25, out: 10.00 },
  "gpt-5-mini": { in: 0.25, out: 2.00 },
  "gpt-5-nano": { in: 0.05, out: 0.40 },
  "o3-mini": { in: 1.10, out: 4.40 },
  "o4-mini": { in: 1.10, out: 4.40 },
  // Embeddings
  "text-embedding-3-small": { in: 0.02, out: 0 },
  "text-embedding-3-large": { in: 0.13, out: 0 },
  // Audio
  "whisper-1": { perMinute: 0.006 },
  "gpt-4o-transcribe": { perMinute: 0.006 },
  "gpt-4o-mini-transcribe": { perMinute: 0.003 },
  "tts-1": { perMChars: 15.00 },
  "tts-1-hd": { perMChars: 30.00 },
  "gpt-4o-mini-tts": { perMChars: 0.60 },
};

/** "gpt-4o-mini-2024-07-18" → "gpt-4o-mini" */
function baseModel(model: string): string {
  if (PRICES[model]) return model;
  const stripped = model.replace(/-\d{4}-\d{2}-\d{2}$/, "").replace(/-\d{4}$/, "");
  if (PRICES[stripped]) return stripped;
  // En uzun prefix eşleşmesi
  const keys = Object.keys(PRICES).sort((a, b) => b.length - a.length);
  return keys.find((k) => model.startsWith(k)) ?? model;
}

function endpointOf(url: string): string {
  const p = url.split("?")[0];
  if (p.includes("/chat/completions")) return "chat.completions";
  if (p.includes("/responses")) return "responses";
  if (p.includes("/embeddings")) return "embeddings";
  if (p.includes("/audio/transcriptions")) return "audio.transcriptions";
  if (p.includes("/audio/translations")) return "audio.translations";
  if (p.includes("/audio/speech")) return "audio.speech";
  if (p.includes("/images")) return "images";
  return "other";
}

type UsageRow = {
  endpoint: string; model: string | null; promptTokens: number; completionTokens: number;
  inputChars: number | null; audioSeconds: number | null; costUsd: number; priced: boolean;
  route: string | null; durationMs: number; status: number;
};

const queue: UsageRow[] = [];
let flushTimer: NodeJS.Timeout | null = null;

async function flushQueue(): Promise<void> {
  if (queue.length === 0) return;
  const rows = queue.splice(0, queue.length);
  const values: unknown[] = [];
  const tuples = rows.map((r, i) => {
    const o = i * 11;
    values.push(r.endpoint, r.model, r.promptTokens, r.completionTokens, r.inputChars, r.audioSeconds, r.costUsd, r.priced, r.route, r.durationMs, r.status);
    return `($${o + 1},$${o + 2},$${o + 3},$${o + 4},$${o + 5},$${o + 6},$${o + 7},$${o + 8},$${o + 9},$${o + 10},$${o + 11})`;
  });
  try {
    await pool.query(
      `INSERT INTO ai_usage_log
         (endpoint, model, prompt_tokens, completion_tokens, input_chars, audio_seconds, cost_usd, priced, route, duration_ms, status)
       VALUES ${tuples.join(",")}`,
      values,
    );
  } catch (e: any) {
    if (e?.code !== "42P01") console.warn("[ai-usage] flush HATA:", e?.message);
  }
}

function enqueue(row: UsageRow): void {
  queue.push(row);
  if (queue.length >= 20) { flushQueue().catch(() => {}); return; }
  if (!flushTimer) {
    flushTimer = setTimeout(() => { flushTimer = null; flushQueue().catch(() => {}); }, 5_000);
    flushTimer.unref();
  }
}

function computeCost(model: string | null, promptTokens: number, completionTokens: number, inputChars: number | null, audioSeconds: number | null): { cost: number; priced: boolean } {
  if (!model) return { cost: 0, priced: false };
  const p = PRICES[baseModel(model)];
  if (!p) return { cost: 0, priced: false };
  if ("perMinute" in p) return audioSeconds != null ? { cost: (audioSeconds / 60) * p.perMinute, priced: true } : { cost: 0, priced: false };
  if ("perMChars" in p) return inputChars != null ? { cost: (inputChars / 1_000_000) * p.perMChars, priced: true } : { cost: 0, priced: false };
  return { cost: (promptTokens / 1_000_000) * p.in + (completionTokens / 1_000_000) * p.out, priced: true };
}

/** OpenAI SDK'ya verilecek fetch — yanıtı klonlayıp usage'ı asenkron okur, akışı yavaşlatmaz. */
export const openaiTrackedFetch: typeof fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const start = Date.now();
  const res = await fetch(input, init);
  try {
    const endpoint = endpointOf(url);
    const ctx = requestContext.getStore();
    const route = ctx ? `${ctx.method} ${ctx.route}` : null;
    const durationMs = Date.now() - start;
    const ct = res.headers.get("content-type") ?? "";

    // İstek gövdesinden model / TTS input uzunluğu (JSON ise)
    let reqModel: string | null = null;
    let inputChars: number | null = null;
    const body = init?.body;
    if (typeof body === "string" && body.startsWith("{")) {
      try {
        const j = JSON.parse(body);
        reqModel = typeof j.model === "string" ? j.model : null;
        if (endpoint === "audio.speech" && typeof j.input === "string") inputChars = j.input.length;
      } catch { /* ignore */ }
    } else if (body instanceof FormData) {
      const m = body.get("model");
      if (typeof m === "string") reqModel = m;
    }

    if (ct.includes("application/json") && res.ok) {
      // Klonla, asenkron parse et — asıl akış beklemesin
      res.clone().json().then((j: any) => {
        const model: string | null = j?.model ?? reqModel;
        const u = j?.usage ?? {};
        const promptTokens = Number(u.prompt_tokens ?? u.input_tokens ?? 0);
        const completionTokens = Number(u.completion_tokens ?? u.output_tokens ?? 0);
        const audioSeconds = typeof j?.duration === "number" ? j.duration : null; // verbose_json transcription
        const { cost, priced } = computeCost(model, promptTokens, completionTokens, inputChars, audioSeconds);
        enqueue({ endpoint, model, promptTokens, completionTokens, inputChars, audioSeconds, costUsd: cost, priced, route, durationMs, status: res.status });
      }).catch(() => {});
    } else {
      // Stream (SSE), binary (TTS mp3) ya da hata — token bilinmez; çağrıyı yine de say
      const model = reqModel;
      const { cost, priced } = computeCost(model, 0, 0, inputChars, null);
      enqueue({ endpoint, model, promptTokens: 0, completionTokens: 0, inputChars, audioSeconds: null, costUsd: cost, priced: priced && (inputChars != null), route, durationMs, status: res.status });
    }
  } catch { /* izleme asla isteği bozmasın */ }
  return res;
};

export { PRICES as AI_PRICES };
