/**
 * Lara'nın sesi — gerçekçi Türkçe/İngilizce seslendirme.
 *
 * Neden parça parça?
 *   Tek seferde "Türkçe cümle + İngilizce örnek" okutulunca ses motoru ya İngilizceyi Türk aksanıyla
 *   ya Türkçeyi yabancı aksanla okuyor; duraklamalar da rastgele. Burada:
 *     1. Konuşma TR / EN parçalara bölünür (İngilizce = tırnak içindeki cümleler).
 *     2. Her parça kendi diliyle seslendirilir (ElevenLabs: language_code + previous/next_text ile süreklilik).
 *     3. Parçalar ffmpeg ile birleştirilir; aralara GERÇEK sessizlik konur
 *        (İngilizce hedef cümleden önce/sonra öğrencinin algılayacağı kadar duraklama).
 *     4. Sabit metinler (adım kurguları, açılış/kapanış, hedef cümleler) önbelleğe alınır → ucuz ve hızlı.
 *
 * Sağlayıcı: ElevenLabs (ELEVENLABS_API_KEY + seçili ses varsa). Hata olursa OpenAI'ye düşer — ders sessiz kalmaz.
 * Ayarlar: admin "Lara'nın Sesi" ekranından (tutor_settings), yoksa env.
 */

import OpenAI from "openai";
import { createHash } from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import os from "os";
import path from "path";
import { pool } from "@workspace/db";
import { openaiTrackedFetch } from "./ai-usage.js";

const execFileAsync = promisify(execFile);
const ELEVEN_BASE = "https://api.elevenlabs.io/v1";

// ─── Ayarlar ──────────────────────────────────────────────────────────────────

export type VoiceSettings = {
  provider: "elevenlabs" | "openai";
  elevenVoiceId: string | null;
  elevenVoiceName: string | null;
  elevenModel: string;
  stability: number;      // 0–1: düşük = daha duygulu/değişken, yüksek = daha düz
  similarity: number;     // 0–1
  style: number;          // 0–1: ifade abartısı
  speed: number;          // 0.7–1.2
  pauseAroundEnglishMs: number; // İngilizce hedef cümleden önce/sonra sessizlik
  pauseBetweenPartsMs: number;  // tepki ile sonraki adım arası
  deliveryTags: boolean;  // v3/v4: [ses tonu] etiketleri
  openaiVoice: string;
  openaiModel: string;
};

const DEFAULTS: VoiceSettings = {
  provider: "openai",
  elevenVoiceId: null,
  elevenVoiceName: null,
  elevenModel: "eleven_v4",
  stability: 0.45,
  similarity: 0.8,
  style: 0.25,
  speed: 0.97,
  pauseAroundEnglishMs: 450,
  pauseBetweenPartsMs: 600,
  deliveryTags: true,
  openaiVoice: "coral",
  openaiModel: "gpt-4o-mini-tts",
};

export const SETTING_KEYS = [
  "elevenVoiceId", "elevenVoiceName", "elevenModel", "stability", "similarity", "style", "speed",
  "pauseAroundEnglishMs", "pauseBetweenPartsMs", "deliveryTags", "openaiVoice",
] as const;

let cached: { at: number; value: VoiceSettings } | null = null;

export function elevenAvailable(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY);
}

function num(v: unknown, def: number, min: number, max: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
}

export async function ensureVoiceTables(): Promise<void> {
  await pool.query(`CREATE TABLE IF NOT EXISTS tutor_settings (
    key VARCHAR(80) PRIMARY KEY, value TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  await pool.query(`CREATE TABLE IF NOT EXISTS tutor_tts_cache (
    hash CHAR(64) PRIMARY KEY, audio BYTEA NOT NULL, chars INTEGER NOT NULL DEFAULT 0,
    hits INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
}

export async function getVoiceSettings(force = false): Promise<VoiceSettings> {
  if (!force && cached && Date.now() - cached.at < 60_000) return cached.value;
  const raw: Record<string, string> = {};
  try {
    await ensureVoiceTables();
    const { rows } = await pool.query(`SELECT key, value FROM tutor_settings WHERE key LIKE 'voice.%'`);
    for (const r of rows) raw[String(r.key).slice(6)] = r.value;
  } catch { /* tablo yoksa env'e düş */ }
  const env = process.env;
  const voiceId = raw.elevenVoiceId || env.ELEVENLABS_VOICE_ID || null;
  const value: VoiceSettings = {
    provider: elevenAvailable() && voiceId ? "elevenlabs" : "openai",
    elevenVoiceId: voiceId,
    elevenVoiceName: raw.elevenVoiceName || null,
    elevenModel: raw.elevenModel || env.ELEVENLABS_MODEL || DEFAULTS.elevenModel,
    stability: num(raw.stability, DEFAULTS.stability, 0, 1),
    similarity: num(raw.similarity, DEFAULTS.similarity, 0, 1),
    style: num(raw.style, DEFAULTS.style, 0, 1),
    speed: num(raw.speed, DEFAULTS.speed, 0.7, 1.2),
    pauseAroundEnglishMs: num(raw.pauseAroundEnglishMs, DEFAULTS.pauseAroundEnglishMs, 0, 2000),
    pauseBetweenPartsMs: num(raw.pauseBetweenPartsMs, DEFAULTS.pauseBetweenPartsMs, 0, 2000),
    deliveryTags: raw.deliveryTags === undefined ? DEFAULTS.deliveryTags : raw.deliveryTags === "true",
    openaiVoice: raw.openaiVoice || env.TUTOR_TTS_VOICE || DEFAULTS.openaiVoice,
    openaiModel: env.TUTOR_TTS_MODEL || DEFAULTS.openaiModel,
  };
  cached = { at: Date.now(), value };
  return value;
}

export async function saveVoiceSettings(patch: Partial<Record<(typeof SETTING_KEYS)[number], string | number | boolean | null>>): Promise<VoiceSettings> {
  await ensureVoiceTables();
  for (const k of SETTING_KEYS) {
    if (!(k in patch)) continue;
    const v = patch[k];
    if (v === null || v === "") {
      await pool.query(`DELETE FROM tutor_settings WHERE key = $1`, [`voice.${k}`]);
    } else {
      await pool.query(
        `INSERT INTO tutor_settings (key, value, updated_at) VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [`voice.${k}`, String(v)],
      );
    }
  }
  cached = null;
  return getVoiceSettings(true);
}

// ─── Metni parçalara ayır ─────────────────────────────────────────────────────

export type Segment = { lang: "tr" | "en"; text: string; part: number; cacheable: boolean };
export type SpeechPart = { text: string; cacheable?: boolean };

const EN_HINTS = new Set([
  "the", "you", "your", "i", "i'm", "i'll", "i'd", "we", "we're", "we'll", "our", "is", "are", "was", "were", "to", "and",
  "can", "could", "would", "will", "should", "what", "how", "when", "why", "where", "this", "that", "it", "it's", "for",
  "of", "a", "an", "do", "does", "did", "have", "has", "please", "thanks", "thank", "me", "my", "us", "with", "about",
  "let's", "sure", "hello", "hi", "great", "good", "yes", "okay", "so", "be", "there", "they", "their", "on", "at", "in",
]);

/** Tırnaksız bir cümlenin İngilizce olup olmadığını tahmin eder (rol yapma bölümündeki İngilizce repliklar için). */
export function looksEnglishSentence(t: string): boolean {
  if (/[çğıöşüÇĞİÖŞÜâ]/.test(t)) return false;
  const words = t.toLowerCase().replace(/[’]/g, "'").match(/[a-z']+/g) ?? [];
  if (words.length === 0) return false;
  const hits = words.filter((w) => EN_HINTS.has(w)).length;
  return hits >= 2 || (hits >= 1 && hits / words.length >= 0.25);
}

/** Tırnak içindeki (≥2 kelime ya da ≥8 harf) İngilizce örnekleri ve tırnaksız İngilizce cümleleri ayrı parça yapar. Saf fonksiyon. */
export function splitSegments(parts: SpeechPart[]): Segment[] {
  const out: Segment[] = [];
  parts.forEach((p, part) => {
    const text = (p.text || "").replace(/\s+/g, " ").trim();
    if (!text) return;
    const re = /["“”]([^"“”]{2,300})["“”]/g;
    let last = 0;
    let m: RegExpExecArray | null;
    const push = (lang: "tr" | "en", t: string) => {
      const clean = t.replace(/\s+/g, " ").trim();
      if (!/[\p{L}\p{N}]/u.test(clean)) return; // yalnız noktalama
      if (lang === "en") {
        out.push({ lang, text: clean, part, cacheable: Boolean(p.cacheable) });
        return;
      }
      // Tırnaksız metni cümlelere böl; İngilizce görünen cümleleri İngilizce oku
      for (const sentence of clean.split(/(?<=[.!?…])\s+/)) {
        if (!/[\p{L}\p{N}]/u.test(sentence)) continue;
        out.push({ lang: looksEnglishSentence(sentence) ? "en" : "tr", text: sentence, part, cacheable: Boolean(p.cacheable) });
      }
    };
    while ((m = re.exec(text))) {
      const inner = m[1].trim();
      const looksEnglish = /^[A-Za-z0-9 ,.'’?!;:\-–—()%&/]+$/.test(inner) && (inner.split(/\s+/).length >= 2 || inner.length >= 8);
      if (!looksEnglish) continue; // "No" gibi tek kelimeler Türkçe akışta kalsın
      push("tr", text.slice(last, m.index));
      push("en", inner);
      last = m.index + m[0].length;
    }
    push("tr", text.slice(last));
  });
  // Yan yana aynı dil + aynı parça → birleştir
  const merged: Segment[] = [];
  for (const s of out) {
    const prev = merged[merged.length - 1];
    if (prev && prev.lang === s.lang && prev.part === s.part) prev.text = `${prev.text} ${s.text}`;
    else merged.push({ ...s });
  }
  return merged;
}

/** İki parça arasına konacak sessizlik (ms). */
export function pauseBefore(prev: Segment | undefined, cur: Segment, s: Pick<VoiceSettings, "pauseAroundEnglishMs" | "pauseBetweenPartsMs">): number {
  if (!prev) return 0;
  if (prev.part !== cur.part) return s.pauseBetweenPartsMs;
  if (prev.lang === "en" || cur.lang === "en") return s.pauseAroundEnglishMs;
  return 150;
}

/** Ses motoruna gidecek metin: Türkçe noktalama ritmi + (v3/v4) ton etiketi. */
export function deliveryText(seg: Segment, s: Pick<VoiceSettings, "elevenModel" | "deliveryTags">, provider: "elevenlabs" | "openai"): string {
  let t = seg.text;
  if (seg.lang === "en" && !/[.!?…]$/.test(t)) t += ".";
  const tagged = provider === "elevenlabs" && s.deliveryTags && /^eleven_v[34]/.test(s.elevenModel);
  if (!tagged) return t;
  return seg.lang === "en"
    ? `[clearly, a little slower, like a teacher modelling a sentence] ${t}`
    : `[warm, friendly, smiling] ${t}`;
}

// ─── Sağlayıcılar ─────────────────────────────────────────────────────────────

let _openai: OpenAI | null = null;
function openai(): OpenAI {
  if (!_openai) _openai = new OpenAI({ fetch: openaiTrackedFetch, apiKey: process.env.OPENAI_API_KEY!, timeout: 30_000, maxRetries: 1 });
  return _openai;
}

const OPENAI_INSTR = {
  tr: "Sen Lara'sın: 30'lu yaşlarda, sıcak ve esprili bir Türk İngilizce öğretmeni. Doğal, akıcı İstanbul Türkçesiyle konuş; cümle sonlarında doğal duraklamalar yap, gülümseyen ve cesaret veren bir ton kullan, abartma.",
  en: "Read this English sentence as a friendly teacher modelling it for a learner: clear, natural native English pronunciation, slightly slower than normal, with natural stress on key words.",
};

async function openaiSegment(seg: Segment, s: VoiceSettings): Promise<Buffer> {
  const params: any = { model: s.openaiModel, voice: s.openaiVoice, input: seg.text, response_format: "mp3" };
  if (s.openaiModel.startsWith("gpt-4o")) params.instructions = OPENAI_INSTR[seg.lang];
  const r = await openai().audio.speech.create(params);
  return Buffer.from(await r.arrayBuffer());
}

async function logElevenUsage(model: string, chars: number, ms: number, status: number) {
  const per1k = Number(process.env.ELEVENLABS_USD_PER_1K_CHARS);
  const priced = Number.isFinite(per1k) && per1k > 0;
  pool.query(
    `INSERT INTO ai_usage_log (endpoint, model, input_chars, cost_usd, priced, route, duration_ms, status)
     VALUES ('elevenlabs.tts', $1, $2, $3, $4, 'tutor-voice', $5, $6)`,
    [model, chars, priced ? (chars / 1000) * per1k : 0, priced, ms, status],
  ).catch(() => {});
}

/** ElevenLabs hata gövdesini insan okunur Türkçe açıklamaya çevir. Saf fonksiyon (test edilir). */
export function explainElevenError(status: number, raw: string): string {
  let detail = raw;
  try {
    const j = JSON.parse(raw);
    const d = j?.detail;
    detail = typeof d === "string" ? d : d?.message ? `${d.status ?? ""} ${d.message}`.trim() : JSON.stringify(d ?? j);
  } catch { /* düz metin */ }
  const low = detail.toLowerCase();
  let hint = "";
  if (status === 429 || low.includes("concurrent")) hint = "Aynı anda istek sınırı aşıldı — sistem sırayla yeniden dener; çok öğrenci aynı anda konuşuyorsa planın eşzamanlılık sınırı yetmiyor olabilir.";
  else if (status === 401 && low.includes("quota")) hint = "Karakter kotası dolmuş — planını/kullanımını kontrol et.";
  else if (status === 401 && (low.includes("permission") || low.includes("missing_permissions"))) hint = "API anahtarının izni eksik — anahtara \"Text to Speech\" iznini ver.";
  else if (status === 401) hint = "API anahtarı geçersiz ya da hatalı kopyalanmış.";
  else if (status === 402 || low.includes("paid_plan") || low.includes("subscription")) hint = "Bu ses/model API'de ücretli plan istiyor (kütüphane sesleri için en az Starter).";
  else if (status === 404 || low.includes("voice_not_found")) hint = "Ses bulunamadı — sesi ElevenLabs'ta \"Add to my voices\" ile hesabına ekle.";
  else if (low.includes("model")) hint = "Model bu ses ya da plan için kullanılamıyor — ayarlardan başka model dene (ör. Multilingual v2).";
  return `ElevenLabs ${status}: ${detail.slice(0, 220)}${hint ? ` → ${hint}` : ""}`;
}

// ─── Eşzamanlılık sınırı ─────────────────────────────────────────────────────
// ElevenLabs planı aynı anda en fazla N isteğe izin verir (Starter: 3). Bir cevap birden çok parça
// içerdiği ve birden çok öğrenci aynı anda konuşabildiği için istekler sıraya alınır.
// Sınır süreç (worker) başınadır; birden çok worker varsa ELEVENLABS_MAX_CONCURRENCY'yi buna göre düşük tut.
const MAX_CONCURRENCY = Math.max(1, Number(process.env.ELEVENLABS_MAX_CONCURRENCY) || 2);
let active = 0;
const waiters: Array<() => void> = [];
async function acquire(): Promise<void> {
  if (active < MAX_CONCURRENCY) { active++; return; }
  await new Promise<void>((resolve) => waiters.push(resolve));
  active++;
}
function release(): void {
  active--;
  const next = waiters.shift();
  if (next) next();
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function elevenRequest(voiceId: string, body: Record<string, unknown>, model: string): Promise<{ ok: true; buf: Buffer } | { ok: false; status: number; raw: string }> {
  // 429 (eşzamanlılık / hız sınırı) gelirse kısa beklemeyle 3 kez daha dene
  for (let attempt = 0; ; attempt++) {
    await acquire();
    let r: { ok: true; buf: Buffer } | { ok: false; status: number; raw: string };
    try {
      r = await elevenRequestOnce(voiceId, body, model);
    } finally {
      release();
    }
    if (r.ok || r.status !== 429 || attempt >= 3) return r;
    await sleep(400 * (attempt + 1) + Math.random() * 250);
  }
}

async function elevenRequestOnce(voiceId: string, body: Record<string, unknown>, model: string): Promise<{ ok: true; buf: Buffer } | { ok: false; status: number; raw: string }> {
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25_000);
  try {
    const res = await fetch(`${ELEVEN_BASE}/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_64`, {
      method: "POST",
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY!, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    void logElevenUsage(model, String(body.text).length, Date.now() - t0, res.status);
    if (!res.ok) return { ok: false, status: res.status, raw: await res.text().catch(() => "") };
    return { ok: true, buf: Buffer.from(await res.arrayBuffer()) };
  } finally {
    clearTimeout(timer);
  }
}

async function elevenSegment(seg: Segment, s: VoiceSettings, prevText?: string, nextText?: string, voiceIdOverride?: string): Promise<Buffer> {
  const voiceId = voiceIdOverride || s.elevenVoiceId;
  if (!voiceId) throw new Error("ElevenLabs ses seçilmemiş");
  const full: Record<string, unknown> = {
    text: deliveryText(seg, s, "elevenlabs"),
    model_id: s.elevenModel,
    voice_settings: {
      stability: s.stability,
      similarity_boost: s.similarity,
      style: s.style,
      use_speaker_boost: true,
      speed: s.speed,
    },
  };
  // multilingual_v2 language_code desteklemiyor
  if (!s.elevenModel.startsWith("eleven_multilingual")) full.language_code = seg.lang;
  if (prevText) full.previous_text = prevText.slice(-300);
  if (nextText) full.next_text = nextText.slice(0, 300);

  const first = await elevenRequest(voiceId, full, s.elevenModel);
  if (first.ok) return first.buf;

  // 400/422: bazı model/ses kombinasyonları ek parametreleri reddedebilir → sade istekle bir kez daha
  if (first.status === 400 || first.status === 422) {
    const minimal = { text: seg.text, model_id: s.elevenModel, voice_settings: { stability: s.stability, similarity_boost: s.similarity } };
    const second = await elevenRequest(voiceId, minimal, s.elevenModel);
    if (second.ok) {
      console.warn("[tutor-voice] ElevenLabs tam istek reddedildi, sade istek çalıştı:", explainElevenError(first.status, first.raw));
      return second.buf;
    }
    throw new Error(explainElevenError(second.status, second.raw));
  }
  throw new Error(explainElevenError(first.status, first.raw));
}

// ─── Önbellek ─────────────────────────────────────────────────────────────────

function cacheKey(seg: Segment, s: VoiceSettings, provider: string, voiceId: string | null): string {
  const sig = provider === "elevenlabs"
    ? [provider, voiceId, s.elevenModel, s.stability, s.similarity, s.style, s.speed, s.deliveryTags]
    : [provider, s.openaiVoice, s.openaiModel];
  return createHash("sha256").update(JSON.stringify([...sig, seg.lang, seg.text])).digest("hex");
}

async function cacheGet(hash: string): Promise<Buffer | null> {
  try {
    const { rows } = await pool.query(
      `UPDATE tutor_tts_cache SET hits = hits + 1, last_used_at = NOW() WHERE hash = $1 RETURNING audio`,
      [hash],
    );
    return rows[0]?.audio ?? null;
  } catch {
    return null;
  }
}

async function cachePut(hash: string, audio: Buffer, chars: number) {
  pool.query(
    `INSERT INTO tutor_tts_cache (hash, audio, chars) VALUES ($1, $2, $3) ON CONFLICT (hash) DO NOTHING`,
    [hash, audio, chars],
  ).catch(() => {});
}

// ─── Birleştirme ──────────────────────────────────────────────────────────────

async function concatWithSilence(clips: Buffer[], pausesMs: number[]): Promise<Buffer> {
  if (clips.length === 1 && !pausesMs[0]) return clips[0];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lara-"));
  try {
    const args: string[] = ["-y"];
    const filterIn: string[] = [];
    let idx = 0;
    clips.forEach((clip, i) => {
      const pause = pausesMs[i] ?? 0;
      if (pause > 0) {
        args.push("-f", "lavfi", "-t", (pause / 1000).toFixed(3), "-i", "anullsrc=r=44100:cl=mono");
        filterIn.push(`[${idx}:a]aformat=sample_rates=44100:channel_layouts=mono[a${idx}]`);
        idx++;
      }
      const f = path.join(dir, `c${i}.mp3`);
      fs.writeFileSync(f, clip);
      args.push("-i", f);
      filterIn.push(`[${idx}:a]aformat=sample_rates=44100:channel_layouts=mono[a${idx}]`);
      idx++;
    });
    const labels = Array.from({ length: idx }, (_, i) => `[a${i}]`).join("");
    const out = path.join(dir, "out.mp3");
    args.push(
      "-filter_complex", `${filterIn.join(";")};${labels}concat=n=${idx}:v=0:a=1[out]`,
      "-map", "[out]", "-ac", "1", "-ar", "44100", "-b:a", "64k", out,
    );
    await execFileAsync("ffmpeg", args, { timeout: 20_000 });
    return fs.readFileSync(out);
  } catch (e: any) {
    console.warn("[tutor-voice] ffmpeg birleştirme başarısız, duraklamasız birleştiriliyor:", e?.message);
    return Buffer.concat(clips);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ─── Dışa açık ────────────────────────────────────────────────────────────────

/**
 * Konuşmayı seslendir. Başarısızsa null (ders yazıyla devam eder).
 * voiceIdOverride: admin ses denemesinde başka bir sesi kaydetmeden dinlemek için.
 */
export async function synthesizeSpeech(
  parts: SpeechPart[] | string,
  opts: { voiceIdOverride?: string; settingsOverride?: Partial<VoiceSettings> } = {},
): Promise<{ audioBase64: string; provider: "elevenlabs" | "openai"; fallbackReason?: string } | null> {
  const list: SpeechPart[] = typeof parts === "string" ? [{ text: parts }] : parts;
  const segs = splitSegments(list);
  if (segs.length === 0) return null;
  const base = await getVoiceSettings();
  const s: VoiceSettings = { ...base, ...opts.settingsOverride };
  const voiceId = opts.voiceIdOverride || s.elevenVoiceId;
  let provider: "elevenlabs" | "openai" = elevenAvailable() && voiceId ? "elevenlabs" : "openai";
  if (provider === "openai" && !process.env.OPENAI_API_KEY) return null;

  const render = async (prov: "elevenlabs" | "openai") =>
    Promise.all(segs.map(async (seg, i) => {
      // İngilizce hedef cümleler ve sabit metinler önbelleğe
      const cacheable = seg.cacheable || (seg.lang === "en" && seg.text.length <= 200);
      const key = cacheable ? cacheKey(seg, s, prov, voiceId ?? null) : null;
      if (key) {
        const hit = await cacheGet(key);
        if (hit) return hit;
      }
      const buf = prov === "elevenlabs"
        ? await elevenSegment(seg, s, segs[i - 1]?.text, segs[i + 1]?.text, voiceId ?? undefined)
        : await openaiSegment(seg, s);
      if (key) void cachePut(key, buf, seg.text.length);
      return buf;
    }));

  let clips: Buffer[];
  let fallbackReason: string | undefined;
  try {
    clips = await render(provider);
  } catch (e: any) {
    console.warn(`[tutor-voice] ${provider} başarısız:`, e?.message);
    if (provider === "elevenlabs") fallbackReason = String(e?.message ?? "bilinmeyen hata");
    if (provider === "elevenlabs" && process.env.OPENAI_API_KEY) {
      provider = "openai";
      try {
        clips = await render("openai");
      } catch (e2: any) {
        console.warn("[tutor-voice] openai yedeği de başarısız:", e2?.message);
        return null;
      }
    } else {
      return null;
    }
  }
  const pauses = segs.map((seg, i) => pauseBefore(segs[i - 1], seg, s));
  const audio = await concatWithSilence(clips, pauses);
  return { audioBase64: audio.toString("base64"), provider, fallbackReason };
}

// ─── Admin: ses listesi ───────────────────────────────────────────────────────

export type ElevenVoice = { voiceId: string; name: string; category: string | null; labels: Record<string, string>; previewUrl: string | null };

export async function listElevenVoices(): Promise<ElevenVoice[]> {
  if (!elevenAvailable()) return [];
  const res = await fetch(`${ELEVEN_BASE}/voices`, { headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY! } });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
  const j: any = await res.json();
  return (j.voices || []).map((v: any) => ({
    voiceId: v.voice_id,
    name: v.name,
    category: v.category ?? null,
    labels: v.labels ?? {},
    previewUrl: v.preview_url ?? null,
  }));
}

export async function ttsCacheStats(): Promise<{ entries: number; hits: number; chars: number; sizeKb: number }> {
  try {
    await ensureVoiceTables();
    const { rows: [r] } = await pool.query(
      `SELECT COUNT(*)::int AS entries, COALESCE(SUM(hits),0)::int AS hits, COALESCE(SUM(chars),0)::int AS chars,
              COALESCE(SUM(octet_length(audio)),0)::bigint / 1024 AS size_kb FROM tutor_tts_cache`,
    );
    return { entries: r.entries, hits: r.hits, chars: r.chars, sizeKb: Number(r.size_kb) };
  } catch {
    return { entries: 0, hits: 0, chars: 0, sizeKb: 0 };
  }
}

export async function clearTtsCache(): Promise<void> {
  await ensureVoiceTables();
  await pool.query(`TRUNCATE tutor_tts_cache`);
}
