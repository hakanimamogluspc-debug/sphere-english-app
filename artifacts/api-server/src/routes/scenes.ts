/**
 * Speaking Role-Play Sahneleri
 *
 * Kullanıcı sektör bazlı bir sahne seçer, AI karşı taraf rolüyle konuşmayı
 * başlatır. Her turda kullanıcı hedef cümleyi söyler → Whisper transcript →
 * 4 skor (accuracy, fluency, pronunciation, completeness). Sahne bitince
 * özet rapor.
 *
 * Hybrid model:
 *   - user turu → text_en scripted, kullanıcı bu cümleyi söylemeli, skorlanır
 *   - ai turu → text_en scripted (MVP), TTS ile seslenir. Gelecekte GPT dinamik.
 *
 * Endpoint'ler (hepsi login + subscription/free tier'a göre):
 *   GET  /api/scenes                    → Kategori/liste + kullanıcının plan filtresi
 *   GET  /api/scenes/:slug              → Sahne detay
 *   POST /api/scenes/:slug/start        → Attempt başlat + ilk AI opening (audio+text)
 *   POST /api/scenes/attempts/:id/speak → Ses gönder → skor + bir sonraki AI turu
 *   POST /api/scenes/attempts/:id/complete → Sahneyi kapat + rapor
 *   GET  /api/scenes/attempts/history   → Kullanıcının geçmiş sahne denemeleri
 *   GET  /api/scenes/attempts/:id       → Attempt detay
 */

import { Router, Request, Response } from "express";
import multer from "multer";
import OpenAI from "openai";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import os from "os";
import path from "path";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { authMiddleware } from "../middlewares/auth.js";
import {
  analyzePronunciation as azureAnalyze,
  type AzurePronunciationResult,
} from "../lib/azure-pronunciation.js";

const execFileAsync = promisify(execFile);
const router = Router();

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY ortam değişkeni ayarlanmamış");
    _openai = new OpenAI({ apiKey });
  }
  return _openai;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// ─── Plan tier + quota ──────────────────────────────────────────────────
type PlanTier = "free" | "pro";

const FREE_DAILY_LIMIT = 3;
const FREE_ALLOWED_CATEGORIES = ["general_business", "meetings", "phone_calls"];

async function getUserTier(userId: number): Promise<PlanTier> {
  try {
    const rows = await db.execute(sql`
      SELECT status FROM subscriptions WHERE user_id = ${userId} LIMIT 1
    `);
    const status = ((rows.rows ?? rows)[0] as any)?.status;
    if (status === "active" || status === "trialing") return "pro";
    return "free";
  } catch {
    return "free";
  }
}

async function getTodayAttemptCount(userId: number): Promise<number> {
  const rows = await db.execute(sql`
    SELECT COUNT(*)::int AS n FROM speaking_scene_attempts
    WHERE user_id = ${userId}
      AND started_at > NOW() - INTERVAL '24 hours'
      AND status IN ('in_progress','completed')
  `);
  return Number(((rows.rows ?? rows)[0] as any)?.n ?? 0);
}

async function assertQuota(
  _userId: number,
  _sceneCategory: string,
  _sceneMinPlan: PlanTier,
): Promise<{ ok: true } | { ok: false; error: string; upgrade?: boolean }> {
  // Abonelik sistemi kaldırıldı — herkese sınırsız erişim.
  return { ok: true };
  // eslint-disable-next-line no-unreachable
  const tier = await getUserTier(_userId);

  // Plan tier check
  if (_sceneMinPlan === "pro" && tier === "free") {
    return { ok: false, error: "Bu sahne Pro aboneler içindir.", upgrade: true };
  }

  if (tier === "free") {
    // Kategori limiti
    if (!FREE_ALLOWED_CATEGORIES.includes(_sceneCategory)) {
      return {
        ok: false,
        error: "Bu kategori Pro abonelere özel. Ücretsiz kategorilerden birini dene.",
        upgrade: true,
      };
    }
    // Günlük limit
    const count = await getTodayAttemptCount(_userId);
    if (count >= FREE_DAILY_LIMIT) {
      return {
        ok: false,
        error: `Günlük ${FREE_DAILY_LIMIT} sahne hakkın doldu. Pro'ya geçerek sınırsız pratik yap.`,
        upgrade: true,
      };
    }
  }

  return { ok: true };
}

// ─── Whisper transcript + ffmpeg ────────────────────────────────────────
async function convertToMp3(inputBuffer: Buffer): Promise<Buffer> {
  const tmpIn = path.join(os.tmpdir(), `scene_in_${Date.now()}.webm`);
  const tmpOut = path.join(os.tmpdir(), `scene_out_${Date.now()}.mp3`);
  try {
    fs.writeFileSync(tmpIn, inputBuffer);
    await execFileAsync("ffmpeg", [
      "-y", "-i", tmpIn,
      "-vn", "-ar", "16000", "-ac", "1",
      "-b:a", "32k", "-threads", "0",
      tmpOut,
    ]);
    return fs.readFileSync(tmpOut);
  } finally {
    try { fs.unlinkSync(tmpIn); } catch {}
    try { fs.unlinkSync(tmpOut); } catch {}
  }
}

interface WhisperWord {
  word: string;
  start: number;
  end: number;
  probability: number;
}

// ─── Azure Speech Pronunciation Assessment ──────────────────────────────
// Endüstri standardı — Duolingo, EnglishScore, British Council kullanıyor.
// Phoneme-level analiz, IPA, prosody. Whisper text-based tuzağını aşar.
//
// Env vars:
//   AZURE_SPEECH_KEY    — Azure Portal → Speech Services → Keys and Endpoint
//   AZURE_SPEECH_REGION — westeurope, eastus, etc.
//
// Free tier: 5 saat/ay bedava, sonrası $1/saat.

interface AzurePronunciationResult {
  accuracyScore: number; // 0-100 phoneme-level ortalama
  fluencyScore: number; // 0-100 doğal akıcılık
  completenessScore: number; // 0-100 söylenen/hedef
  pronScore: number; // 0-100 overall (weighted)
  words: Array<{
    word: string;
    accuracyScore: number;
    errorType: "None" | "Mispronunciation" | "Omission" | "Insertion" | "UnexpectedBreak" | "MissingBreak" | "Monotone";
    phonemes: Array<{ phoneme: string; accuracyScore: number }>;
  }>;
  recognizedText: string;
}

/**
 * Ses buffer'ı WAV 16kHz mono PCM'e dönüştür.
 * Azure Pronunciation Assessment bu format bekliyor.
 */
async function convertToWav16k(inputBuffer: Buffer): Promise<Buffer> {
  const tmpIn = path.join(os.tmpdir(), `az_in_${Date.now()}.webm`);
  const tmpOut = path.join(os.tmpdir(), `az_out_${Date.now()}.wav`);
  try {
    fs.writeFileSync(tmpIn, inputBuffer);
    await execFileAsync("ffmpeg", [
      "-y", "-i", tmpIn,
      "-vn",
      "-acodec", "pcm_s16le",
      "-ar", "16000",
      "-ac", "1",
      tmpOut,
    ]);
    return fs.readFileSync(tmpOut);
  } finally {
    try { fs.unlinkSync(tmpIn); } catch {}
    try { fs.unlinkSync(tmpOut); } catch {}
  }
}

async function analyzePronunciationAzureLegacy(
  audioBuffer: Buffer,
  targetText: string,
): Promise<AzurePronunciationResult | null> {
  // Yeni helper'ı çağır — reference mode
  const r = await azureAnalyze(audioBuffer, {
    referenceText: targetText,
    enableProsodyAssessment: true,
  });
  if (!r) return null;
  return {
    accuracyScore: r.accuracyScore,
    fluencyScore: r.fluencyScore,
    completenessScore: r.completenessScore,
    pronScore: r.pronScore,
    words: r.words as any,
    recognizedText: r.recognizedText,
  };
}

// Eski implementasyon — helper'a devredildi, aşağıdaki geçici bloğu skip et
async function _unusedAzureAnalyze(
  audioBuffer: Buffer,
  targetText: string,
): Promise<AzurePronunciationResult | null> {
  const azureKey = process.env.AZURE_SPEECH_KEY;
  const azureRegion = process.env.AZURE_SPEECH_REGION || "westeurope";
  if (!azureKey) {
    console.warn("[scenes] AZURE_SPEECH_KEY yok — Azure atlandı");
    return null;
  }

  try {
    // 1) WAV 16kHz mono'ya dönüştür
    const wavBuffer = await convertToWav16k(audioBuffer);

    // 2) Pronunciation config header (base64 encoded JSON)
    const pronunciationConfig = {
      ReferenceText: targetText,
      GradingSystem: "HundredMark",
      Granularity: "Phoneme",
      EnableMiscue: true, // Omission/Insertion tespiti
      PhonemeAlphabet: "IPA",
      NBestPhonemeCount: 3,
    };
    const configBase64 = Buffer.from(JSON.stringify(pronunciationConfig)).toString("base64");

    // 3) REST API call
    const endpoint =
      `https://${azureRegion}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1` +
      `?language=en-US&format=detailed`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": azureKey,
        "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000",
        Accept: "application/json",
        "Pronunciation-Assessment": configBase64,
      },
      body: wavBuffer as any,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error(`[scenes] Azure HTTP ${response.status}:`, errText.slice(0, 200));
      return null;
    }

    const data: any = await response.json();
    if (data.RecognitionStatus !== "Success") {
      console.warn("[scenes] Azure RecognitionStatus:", data.RecognitionStatus);
      // Success değil ama yine de partial skor gelebilir
    }

    const nBest = data.NBest?.[0];
    if (!nBest) return null;

    const pa = nBest.PronunciationAssessment ?? {};
    const words = (nBest.Words ?? []).map((w: any) => ({
      word: String(w.Word ?? ""),
      accuracyScore: Number(w.PronunciationAssessment?.AccuracyScore ?? 0),
      errorType: String(w.PronunciationAssessment?.ErrorType ?? "None") as any,
      phonemes: Array.isArray(w.Phonemes)
        ? w.Phonemes.map((p: any) => ({
            phoneme: String(p.Phoneme ?? ""),
            accuracyScore: Number(p.PronunciationAssessment?.AccuracyScore ?? 0),
          }))
        : [],
    }));

    return {
      accuracyScore: Math.round(Number(pa.AccuracyScore ?? 0)),
      fluencyScore: Math.round(Number(pa.FluencyScore ?? 0)),
      completenessScore: Math.round(Number(pa.CompletenessScore ?? 0)),
      pronScore: Math.round(Number(pa.PronScore ?? pa.PronunciationScore ?? 0)),
      words,
      recognizedText: String(data.DisplayText ?? nBest.Display ?? ""),
    };
  } catch (e: any) {
    console.error("[scenes] Azure HATA:", e?.message);
    return null;
  }
}

// ─── GPT-4o Audio ile ses tabanlı pronunciation analizi ─────────────────
// Whisper text-based olduğu için "fridey" → "Friday" olarak yazıp yüksek puan
// veriyordu. GPT-4o-audio-preview sesi doğrudan dinleyip her kelimenin
// telaffuzunu değerlendirir — gerçek phoneme-benzeri analiz.
interface GPT4oPronResult {
  overallScore: number; // 0-100
  pronunciationScore: number; // 0-100
  fluencyScore: number; // 0-100
  wordScores: Array<{ word: string; score: number; issue: string | null }>;
  issues: string[];
  positiveFeedback: string[];
}

async function analyzePronunciationGPT4o(
  audioBuffer: Buffer,
  targetText: string,
): Promise<GPT4oPronResult | null> {
  try {
    const base64 = audioBuffer.toString("base64");
    const systemPrompt = `You are a STRICT native English pronunciation coach analyzing a Turkish learner's spoken English.
Return valid JSON only — no markdown, no explanation outside JSON.

Structure:
{
  "overallScore": <0-100>,
  "pronunciationScore": <0-100>,
  "fluencyScore": <0-100>,
  "wordScores": [{ "word": "<target word>", "score": <0-100>, "issue": "<brief Turkish or null>" }],
  "issues": ["<brief Turkish issue>"],
  "positiveFeedback": ["<brief Turkish positive>"]
}

STRICT RULES:
- Listen carefully to ACTUAL pronunciation, not what the target text says
- If speaker says "fridey" instead of "Friday", give that word 30-50 (Turkish accent trap)
- If they say "sedule" instead of "schedule", low score
- Common Turkish speaker issues: /θ/ → /t/, /w/ ↔ /v/, silent letters ignored, /r/ rolled
- Pauses of 2+ seconds between words → drop fluencyScore heavily
- Missing or extra words → drop overallScore
- Be HONEST: bad pronunciation should NEVER get 85+
- 90+ ONLY for near-native accuracy AND fluency
- All Turkish feedback (concise, actionable)
- wordScores: cover each target word in order`;

    const userText = `TARGET TEXT (what they should say):\n"${targetText}"\n\nListen to the audio and evaluate the ACTUAL pronunciation.`;

    const res: any = await getOpenAI().chat.completions.create({
      model: "gpt-4o-audio-preview",
      modalities: ["text"],
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: userText },
            {
              type: "input_audio",
              input_audio: { data: base64, format: "mp3" },
            },
          ],
        } as any,
      ],
      temperature: 0.2,
      max_tokens: 800,
    });

    const raw = res.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as GPT4oPronResult;

    // Defensive normalize
    return {
      overallScore: Math.max(0, Math.min(100, Math.round(Number(parsed.overallScore ?? 0)))),
      pronunciationScore: Math.max(
        0,
        Math.min(100, Math.round(Number(parsed.pronunciationScore ?? 0))),
      ),
      fluencyScore: Math.max(0, Math.min(100, Math.round(Number(parsed.fluencyScore ?? 0)))),
      wordScores: Array.isArray(parsed.wordScores)
        ? parsed.wordScores.map((w) => ({
            word: String(w.word ?? ""),
            score: Math.max(0, Math.min(100, Math.round(Number(w.score ?? 0)))),
            issue: w.issue ? String(w.issue) : null,
          }))
        : [],
      issues: Array.isArray(parsed.issues) ? parsed.issues.map(String) : [],
      positiveFeedback: Array.isArray(parsed.positiveFeedback)
        ? parsed.positiveFeedback.map(String)
        : [],
    };
  } catch (e: any) {
    console.error("[scenes] GPT-4o audio HATA:", e?.message);
    return null;
  }
}

async function transcribeAudio(
  audioBuffer: Buffer,
): Promise<{
  text: string;
  words: WhisperWord[];
  durationMs: number;
  audioSeconds: number;
  mp3Buffer: Buffer;
} | null> {
  try {
    let finalBuffer = audioBuffer;
    let ext = "mp3";
    let mime = "audio/mpeg";
    let audioSeconds = 0;
    let mp3Buffer = audioBuffer; // GPT-4o audio için ayrı MP3 buffer
    try {
      finalBuffer = await convertToMp3(audioBuffer);
      mp3Buffer = finalBuffer;
      audioSeconds = finalBuffer.length / 4000;
    } catch {
      ext = "webm";
      mime = "audio/webm";
    }

    const file = new File([finalBuffer], `audio.${ext}`, { type: mime });
    const t0 = Date.now();
    const res: any = await getOpenAI().audio.transcriptions.create({
      model: "whisper-1",
      file,
      language: "en",
      response_format: "verbose_json",
      timestamp_granularities: ["word"],
      temperature: 0,
      // As-pronounced prompt — Whisper'ı normalizasyondan uzaklaştır
      prompt:
        "English learner practicing scripted business dialog. Transcribe EXACTLY as heard, including mispronunciations, hesitations, and unusual word forms. Do not autocorrect. If a word is unclear or partial, spell it phonetically as heard.",
    } as any);

    const words: WhisperWord[] = (res.words || []).map((w: any) => ({
      word: (w.word || "").trim(),
      start: w.start ?? 0,
      end: w.end ?? 0,
      probability: w.probability ?? 1,
    }));

    // Whisper response'da genelde `duration` gelir
    const responseSeconds = Number(res.duration ?? 0);
    if (responseSeconds > 0) audioSeconds = responseSeconds;

    return {
      text: String(res.text || "").trim(),
      words,
      durationMs: Date.now() - t0,
      audioSeconds,
      mp3Buffer,
    };
  } catch (e: any) {
    console.error("[scenes] Whisper HATA:", e?.message);
    return null;
  }
}

// ─── Skorlama ───────────────────────────────────────────────────────────

// Metin normalize — karşılaştırma için (küçük harf, punctuation temizle)
function normalize(text: string): string {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Word-level Levenshtein-benzeri karşılaştırma (edit distance)
function alignWords(target: string[], said: string[]): Array<{
  target: string | null;
  said: string | null;
  match: "exact" | "close" | "missing" | "extra";
}> {
  // Dinamik programlama ile edit distance ve back-trace
  const m = target.length;
  const n = said.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = target[i - 1] === said[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  // Back-trace
  const result: Array<{ target: string | null; said: string | null; match: any }> = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && target[i - 1] === said[j - 1]) {
      result.push({ target: target[i - 1], said: said[j - 1], match: "exact" });
      i--; j--;
    } else if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + 1) {
      // Substitution — telaffuz farkı
      const similarity =
        1 -
        Math.min(
          Math.abs(target[i - 1].length - said[j - 1].length),
          Math.max(target[i - 1].length, said[j - 1].length),
        ) /
          Math.max(target[i - 1].length, said[j - 1].length, 1);
      result.push({
        target: target[i - 1],
        said: said[j - 1],
        match: similarity > 0.5 ? "close" : "missing",
      });
      i--; j--;
    } else if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      result.push({ target: target[i - 1], said: null, match: "missing" });
      i--;
    } else {
      result.push({ target: null, said: said[j - 1], match: "extra" });
      j--;
    }
  }
  return result.reverse();
}

interface Scores {
  accuracy: number;
  fluency: number;
  pronunciation: number;
  completeness: number;
  overall: number;
}

function computeScores(
  targetText: string,
  transcript: string,
  whisperWords: WhisperWord[],
  audioSeconds: number,
): { scores: Scores; wordAnalysis: any[] } {
  const targetWords = normalize(targetText).split(" ").filter(Boolean);
  const saidWords = normalize(transcript).split(" ").filter(Boolean);

  if (targetWords.length === 0) {
    return {
      scores: { accuracy: 0, fluency: 0, pronunciation: 0, completeness: 0, overall: 0 },
      wordAnalysis: [],
    };
  }

  const aligned = alignWords(targetWords, saidWords);

  // ── ACCURACY ──
  const exactCount = aligned.filter((a) => a.match === "exact").length;
  const closeCount = aligned.filter((a) => a.match === "close").length;
  const missingCount = aligned.filter((a) => a.match === "missing").length;
  const extraCount = aligned.filter((a) => a.match === "extra").length;

  const accuracy = Math.round(
    ((exactCount + closeCount * 0.5) / targetWords.length) * 100,
  );

  // ── COMPLETENESS ──
  const completeness = Math.round(
    ((exactCount + closeCount) / targetWords.length) * 100,
  );

  // ── PRONUNCIATION ──
  // Word-level Whisper confidence — sıkı threshold + düşük confidence cezası
  let pronScore = 100;
  if (whisperWords.length > 0) {
    // Her kelime için: 0.95+ → 100, 0.85-0.95 → 80-100 arası, 0.85 altı → cezayla düşer
    const perWord = whisperWords.map((w) => {
      const p = Math.max(0, Math.min(1, w.probability));
      if (p >= 0.95) return 100;
      if (p >= 0.85) return 80 + ((p - 0.85) / 0.1) * 20;
      if (p >= 0.7) return 50 + ((p - 0.7) / 0.15) * 30;
      return Math.max(0, p * 70); // 0.7 altı = ciddi problem
    });
    const avgWord = perWord.reduce((s, x) => s + x, 0) / perWord.length;
    // Ek olarak: extra/missing kelime varsa cezalandır — bozuk telaffuz genelde
    // kelime kaybına veya fazla ses yaratmaya neden olur
    const editRatio = (missingCount + extraCount) / Math.max(1, targetWords.length);
    const editPenalty = Math.min(30, editRatio * 60);
    pronScore = Math.round(Math.max(0, avgWord - editPenalty));
  }

  // ── FLUENCY ──
  // İki metrik birlikte:
  //   1. Speech ratio = konuşulan süre / toplam ses süresi (bekleme cezası)
  //   2. WPM (kelime/dakika) — hedef 110-150
  let speechRatio = 1;
  if (whisperWords.length > 0 && audioSeconds > 0.5) {
    const first = whisperWords[0].start;
    const last = whisperWords[whisperWords.length - 1].end;
    // Toplam word duration + sadece kelimeler arası kısa sessizlikleri say
    const totalWordSpan = Math.max(0, last - first);
    speechRatio = Math.max(0, Math.min(1, totalWordSpan / audioSeconds));
  }
  // Speech ratio skoru: 0.7+ ideal → 100, düştükçe hızla azalır
  let ratioScore = 100;
  if (speechRatio < 0.3) ratioScore = Math.round(speechRatio * 100); // <30% → çok kötü
  else if (speechRatio < 0.6) ratioScore = Math.round(30 + ((speechRatio - 0.3) / 0.3) * 50);
  else if (speechRatio < 0.75) ratioScore = Math.round(80 + ((speechRatio - 0.6) / 0.15) * 20);
  else ratioScore = 100;

  // WPM skoru
  const wpm = audioSeconds > 0 ? (saidWords.length / audioSeconds) * 60 : 0;
  let wpmScore = 100;
  if (wpm < 40) wpmScore = Math.round((wpm / 40) * 40); // <40 → çok yavaş
  else if (wpm < 90) wpmScore = Math.round(40 + ((wpm - 40) / 50) * 40);
  else if (wpm < 110) wpmScore = Math.round(80 + ((wpm - 90) / 20) * 20);
  else if (wpm > 200) wpmScore = Math.round(100 - Math.min(40, (wpm - 200) / 3));
  else wpmScore = 100;

  // Fluency = 60% speech ratio + 40% WPM (bekleme daha çok cezalandırılır)
  const fluency = Math.max(0, Math.min(100, Math.round(ratioScore * 0.6 + wpmScore * 0.4)));

  // ── OVERALL ──
  // Ağırlıklar telaffuz odaklı: pron 40% + accuracy 30% + fluency 20% + completeness 10%
  const overall = Math.round(
    pronScore * 0.4 +
      accuracy * 0.3 +
      fluency * 0.2 +
      completeness * 0.1,
  );

  const wordAnalysis = aligned.map((a) => ({
    target: a.target,
    said: a.said,
    match: a.match,
  }));

  return {
    scores: {
      accuracy: Math.max(0, Math.min(100, accuracy)),
      fluency,
      pronunciation: Math.max(0, Math.min(100, pronScore)),
      completeness: Math.max(0, Math.min(100, completeness)),
      overall: Math.max(0, Math.min(100, overall)),
    },
    wordAnalysis,
  };
}

// ─── ENDPOINTS ──────────────────────────────────────────────────────────

// GET /api/scenes — Kategorileri ve sahneleri listele
router.get("/scenes", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as number;
    const tier = await getUserTier(userId);
    const category = req.query.category ? String(req.query.category) : null;

    const rows = await db.execute(sql`
      SELECT id, slug, category, title_en, title_tr, description_tr,
             user_role_tr, counterpart_role_tr, difficulty, min_plan,
             avg_duration_min, sort_order
      FROM speaking_scenes
      WHERE is_active = TRUE
        ${category ? sql`AND category = ${category}` : sql``}
      ORDER BY sort_order ASC, id ASC
    `);
    const scenes = (rows.rows ?? rows) as any[];

    // Abonelik kaldırıldı — hiçbir sahne kilitli değil
    const withLock = scenes.map((s) => ({ ...s, locked: false, lock_reason: null }));

    // Kullanıcının bugünkü limit durumu
    let dailyRemaining: number | null = null;
    if (tier === "free") {
      const used = await getTodayAttemptCount(userId);
      dailyRemaining = Math.max(0, FREE_DAILY_LIMIT - used);
    }

    return res.json({
      tier,
      dailyRemaining,
      dailyLimit: tier === "free" ? FREE_DAILY_LIMIT : null,
      scenes: withLock,
    });
  } catch (e: any) {
    console.error("[scenes] list HATA:", e?.message);
    return res.status(500).json({ error: "Sahneler listelenemedi" });
  }
});

// GET /api/scenes/:slug — Sahne detay + turlar
router.get("/scenes/:slug", authMiddleware, async (req: Request, res: Response) => {
  try {
    const slug = String(req.params.slug ?? "").trim();
    if (!slug) return res.status(400).json({ error: "slug gerekli" });

    const rows = await db.execute(sql`
      SELECT id, slug, category, title_en, title_tr, description_tr,
             user_role_tr, counterpart_role_tr, difficulty, min_plan,
             avg_duration_min, voice
      FROM speaking_scenes
      WHERE slug = ${slug} AND is_active = TRUE
      LIMIT 1
    `);
    const scene = (rows.rows ?? rows)[0] as any;
    if (!scene) return res.status(404).json({ error: "Sahne bulunamadı" });

    // Turları da göster (preview olarak, ama user turları görünür kalsın — kullanıcı zaten okuyacak)
    const turnsRows = await db.execute(sql`
      SELECT id, turn_order, speaker, text_en, text_tr, notes_tr, phonetic_hint
      FROM speaking_scene_turns
      WHERE scene_id = ${scene.id}
      ORDER BY turn_order ASC
    `);
    const turns = (turnsRows.rows ?? turnsRows) as any[];

    return res.json({ scene, turns });
  } catch (e: any) {
    console.error("[scenes] detail HATA:", e?.message);
    return res.status(500).json({ error: "Sahne detayı alınamadı" });
  }
});

// POST /api/scenes/:slug/start — Attempt başlat
router.post(
  "/scenes/:slug/start",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as number;
      const slug = String(req.params.slug ?? "").trim();

      const sceneRows = await db.execute(sql`
        SELECT id, category, min_plan, voice FROM speaking_scenes
        WHERE slug = ${slug} AND is_active = TRUE LIMIT 1
      `);
      const scene = (sceneRows.rows ?? sceneRows)[0] as any;
      if (!scene) return res.status(404).json({ error: "Sahne bulunamadı" });

      const q = await assertQuota(userId, scene.category, scene.min_plan);
      if (!q.ok) return res.status(403).json({ error: q.error, upgrade: q.upgrade });

      // Attempt oluştur
      const ins = await db.execute(sql`
        INSERT INTO speaking_scene_attempts (user_id, scene_id, status, turn_count)
        VALUES (${userId}, ${scene.id}, 'in_progress', 0)
        RETURNING id, started_at
      `);
      const attempt = (ins.rows ?? ins)[0] as any;

      // İlk AI turu — turn_order 1 (AI opening)
      const firstAiTurnRows = await db.execute(sql`
        SELECT id, turn_order, text_en, text_tr, notes_tr
        FROM speaking_scene_turns
        WHERE scene_id = ${scene.id} AND speaker = 'ai'
        ORDER BY turn_order ASC LIMIT 1
      `);
      const firstAi = (firstAiTurnRows.rows ?? firstAiTurnRows)[0] as any;

      let openingAudio: string | null = null;
      if (firstAi) {
        try {
          const tts = await getOpenAI().audio.speech.create({
            model: "tts-1",
            voice: scene.voice || "nova",
            input: firstAi.text_en,
            speed: 0.95,
          });
          openingAudio = Buffer.from(await tts.arrayBuffer()).toString("base64");
        } catch (ttsErr: any) {
          console.error("[scenes] TTS HATA:", ttsErr?.message);
        }
      }

      // Bir sonraki user turu (turn_order 2 genellikle)
      const nextUserTurnRows = await db.execute(sql`
        SELECT id, turn_order, text_en, text_tr, notes_tr, phonetic_hint
        FROM speaking_scene_turns
        WHERE scene_id = ${scene.id} AND speaker = 'user'
        ORDER BY turn_order ASC LIMIT 1
      `);
      const nextUser = (nextUserTurnRows.rows ?? nextUserTurnRows)[0] as any;

      return res.json({
        attemptId: attempt.id,
        startedAt: attempt.started_at,
        aiTurn: firstAi
          ? {
              turnId: firstAi.id,
              turnOrder: firstAi.turn_order,
              text: firstAi.text_en,
              textTr: firstAi.text_tr,
              notesTr: firstAi.notes_tr,
              audioBase64: openingAudio,
            }
          : null,
        nextUserTurn: nextUser
          ? {
              turnId: nextUser.id,
              turnOrder: nextUser.turn_order,
              text: nextUser.text_en,
              textTr: nextUser.text_tr,
              notesTr: nextUser.notes_tr,
              phoneticHint: nextUser.phonetic_hint,
            }
          : null,
      });
    } catch (e: any) {
      console.error("[scenes] start HATA:", e?.message);
      return res.status(500).json({ error: "Sahne başlatılamadı" });
    }
  },
);

// POST /api/scenes/attempts/:attemptId/speak — Ses gönder, skor + sonraki AI turu
router.post(
  "/scenes/attempts/:attemptId/speak",
  authMiddleware,
  upload.single("audio"),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as number;
      const attemptId = parseInt(String(req.params.attemptId ?? ""), 10);
      const turnId = req.body?.turnId ? parseInt(String(req.body.turnId), 10) : null;

      if (!Number.isFinite(attemptId))
        return res.status(400).json({ error: "Geçersiz attemptId" });
      if (!req.file || req.file.buffer.length < 2000)
        return res.status(400).json({ error: "Ses kaydı çok kısa. En az 2 saniye konuş." });

      // Attempt sahiplik kontrolü + sahne bilgisi
      const attRows = await db.execute(sql`
        SELECT a.id, a.scene_id, a.user_id, a.status, a.turn_count,
               s.voice
        FROM speaking_scene_attempts a
        INNER JOIN speaking_scenes s ON s.id = a.scene_id
        WHERE a.id = ${attemptId} LIMIT 1
      `);
      const att = (attRows.rows ?? attRows)[0] as any;
      if (!att) return res.status(404).json({ error: "Attempt bulunamadı" });
      if (Number(att.user_id) !== userId)
        return res.status(403).json({ error: "Yetkisiz" });
      if (att.status !== "in_progress")
        return res.status(400).json({ error: "Sahne tamamlanmış" });

      // Hedef turu bul
      let targetTurn: any = null;
      if (turnId) {
        const tRows = await db.execute(sql`
          SELECT id, turn_order, text_en, text_tr
          FROM speaking_scene_turns
          WHERE id = ${turnId} AND scene_id = ${att.scene_id} AND speaker = 'user' LIMIT 1
        `);
        targetTurn = (tRows.rows ?? tRows)[0];
      }
      if (!targetTurn) return res.status(400).json({ error: "Hedef tur bulunamadı" });

      // ─── AZURE-ONLY MODE ─────────────────────────────────────────────
      // Azure Speech Pronunciation Assessment tek doğruluk kaynağı.
      // Whisper ve GPT-4o audio kaldırıldı — çakışma yok, tek transcript, tek skor.
      // FFmpeg silence removal ile başlangıç sessizlik hayaletleri önleniyor.
      const azure = await azureAnalyze(req.file.buffer, {
        referenceText: String(targetTurn.text_en),
        enableMiscue: true,
        enableProsodyAssessment: true,
      });

      if (!azure) {
        return res.status(502).json({
          error: "Ses analizi geçici olarak erişilemez. Lütfen birkaç saniye sonra tekrar dene.",
        });
      }

      console.info(
        `[scenes/speak] target="${String(targetTurn.text_en).slice(0, 40)}" recognized="${azure.recognizedText.slice(0, 40)}" words=${azure.words.length} scores=pron:${azure.pronScore}/acc:${azure.accuracyScore}/flu:${azure.fluencyScore}/comp:${azure.completenessScore}`,
      );

      // Boş transcript = anlaşılamaz ses
      if (!azure.recognizedText || azure.recognizedText.trim().length === 0) {
        return res.status(400).json({
          error: "Ses anlaşılamadı. Mikrofona daha net ve yüksek sesle konuşmayı dene.",
        });
      }

      // Azure recognizedText geldi ama tüm skorlar 0 → PronunciationAssessment parse hatası veya audio problemi
      if (
        azure.recognizedText.length > 0 &&
        azure.pronScore === 0 &&
        azure.accuracyScore === 0 &&
        azure.completenessScore === 0
      ) {
        console.error(
          `[scenes/speak] BUG: recognized text var ama tüm skorlar 0. Response üretiliyor ama uyarı loguna al.`,
        );
      }

      // Target text kelimeleri — hangi kelimelerin hedeflendiğini bilmek için
      const targetWordsNorm = normalize(String(targetTurn.text_en)).split(" ").filter(Boolean);

      // wordAnalysis: Azure'ın words array'ini frontend format'ına çevir
      // Hayalet filtreleri:
      //   - recognizedText'te kelime GEÇİYOR ama errorType='Omission' → çelişki, ignore
      //   - accuracyScore < 5 VE errorType='None' → başka bir hayalet, ignore
      const recognizedLower = azure.recognizedText.toLowerCase();
      const finalWordAnalysis = azure.words
        .filter((w) => {
          const wordNorm = w.word.toLowerCase().replace(/[^a-z']/g, "");
          // recognizedText'te varsa ama "Omission" işaretlenmişse → hayalet
          if (w.errorType === "Omission" && recognizedLower.includes(wordNorm)) return false;
          // Hayalet: skor sıfır AMA errorType hiçbir şey
          if (w.errorType === "None" && w.accuracyScore < 5) return false;
          return true;
        })
        .map((w) => {
          const wordNorm = w.word.toLowerCase().replace(/[^a-z']/g, "");
          let match: "exact" | "close" | "missing" | "extra" = "exact";
          if (w.errorType === "Omission") match = "missing";
          else if (w.errorType === "Insertion") match = "extra";
          else if (w.errorType === "Mispronunciation" || w.accuracyScore < 60) match = "close";

          const worstPhonemes = w.phonemes
            .filter((p) => p.accuracyScore < 70)
            .sort((a, b) => a.accuracyScore - b.accuracyScore)
            .slice(0, 2);
          const phonemeNote =
            worstPhonemes.length > 0
              ? `Zayıf sesler: /${worstPhonemes.map((p) => p.phoneme).join(", /")}/`
              : null;

          return {
            target: w.errorType === "Insertion" ? null : w.word,
            said: w.errorType === "Omission" ? null : w.word,
            match,
            gptScore: w.accuracyScore,
            gptIssue:
              match === "missing"
                ? "Söylenmedi"
                : match === "extra"
                  ? "Fazla kelime"
                  : w.accuracyScore < 60
                    ? `Telaffuz zayıf ${phonemeNote ? `— ${phonemeNote}` : ""}`.trim()
                    : phonemeNote,
          };
        });

      // Skorlar direkt Azure'dan
      const finalScores = {
        accuracy: azure.accuracyScore,
        fluency: azure.fluencyScore,
        completeness: azure.completenessScore,
        pronunciation: azure.pronScore,
        // Overall = ağırlıklı Azure skorları
        overall: Math.round(
          azure.pronScore * 0.5 +
            azure.accuracyScore * 0.25 +
            azure.fluencyScore * 0.15 +
            azure.completenessScore * 0.1,
        ),
      };

      // Genel feedback — Azure'ın word errorType'larından türet
      const issues: string[] = [];
      const positives: string[] = [];

      const mispronounced = azure.words.filter(
        (w) =>
          w.errorType === "Mispronunciation" &&
          w.accuracyScore < 60 &&
          !(recognizedLower.includes(w.word.toLowerCase().replace(/[^a-z']/g, ""))
            && w.accuracyScore >= 45),
      );
      if (mispronounced.length > 0) {
        issues.push(
          `${mispronounced.length} kelime telaffuz düşük: ${mispronounced
            .slice(0, 3)
            .map((w) => `"${w.word}"`)
            .join(", ")}`,
        );
      }
      const omitted = azure.words.filter(
        (w) =>
          w.errorType === "Omission" &&
          !recognizedLower.includes(w.word.toLowerCase().replace(/[^a-z']/g, "")),
      );
      if (omitted.length > 0) {
        issues.push(
          `${omitted.length} kelime söylenmedi: ${omitted
            .slice(0, 3)
            .map((w) => `"${w.word}"`)
            .join(", ")}`,
        );
      }
      if (azure.fluencyScore < 45) {
        issues.push("Akıcılık düşük — kelimeler arası bekleme var, doğal bir akış hedefle");
      }
      if (azure.accuracyScore >= 80) {
        positives.push("Ses üretimi çok iyi — kelimelerin net telaffuz edildi");
      }
      if (azure.fluencyScore >= 70) {
        positives.push("Akıcılığın doğal — konuşman rahat");
      }
      if (azure.completenessScore >= 90) {
        positives.push("Hedef cümlenin tamamını söyledin");
      }
      const azureFeedback = { issues, positives };

      // Transcript = Azure recognizedText
      const transcript = azure.recognizedText;
      // Kullanmadığımız değişkenler için stub (aşağıdaki DB insert için)
      const _unusedTargetWords = targetWordsNorm;

      const scores = finalScores;
      const wordAnalysis = finalWordAnalysis;
      // audioDurationSec'i ms'ye çevir (DB'de duration_ms tutuyoruz)
      const durationMs = Math.round((azure.audioDurationSec ?? 0) * 1000);

      // Turn attempt kaydet
      await db.execute(sql`
        INSERT INTO speaking_scene_turn_attempts (
          attempt_id, turn_id, turn_order,
          target_text, transcript,
          accuracy_score, fluency_score, pronunciation_score,
          completeness_score, overall_score,
          word_analysis, duration_ms
        ) VALUES (
          ${attemptId}, ${targetTurn.id}, ${targetTurn.turn_order},
          ${String(targetTurn.text_en)}, ${transcript},
          ${scores.accuracy}, ${scores.fluency}, ${scores.pronunciation},
          ${scores.completeness}, ${scores.overall},
          ${JSON.stringify(wordAnalysis)}::jsonb, ${durationMs}
        )
      `);

      // Attempt turn_count arttır
      await db.execute(sql`
        UPDATE speaking_scene_attempts
        SET turn_count = turn_count + 1
        WHERE id = ${attemptId}
      `);

      // Sonraki turu bul (mevcut turn_order + 1)
      const nextRows = await db.execute(sql`
        SELECT id, turn_order, speaker, text_en, text_tr, notes_tr, phonetic_hint
        FROM speaking_scene_turns
        WHERE scene_id = ${att.scene_id} AND turn_order > ${targetTurn.turn_order}
        ORDER BY turn_order ASC LIMIT 2
      `);
      const nextTurns = (nextRows.rows ?? nextRows) as any[];
      const nextAi = nextTurns.find((t) => t.speaker === "ai") ?? null;
      const nextUser = nextTurns.find((t) => t.speaker === "user") ?? null;

      // AI turu varsa TTS üret
      let aiAudio: string | null = null;
      if (nextAi) {
        try {
          const tts = await getOpenAI().audio.speech.create({
            model: "tts-1",
            voice: att.voice || "nova",
            input: nextAi.text_en,
            speed: 0.95,
          });
          aiAudio = Buffer.from(await tts.arrayBuffer()).toString("base64");
        } catch (ttsErr: any) {
          console.error("[scenes] speak TTS HATA:", ttsErr?.message);
        }
      }

      // Sahne bitti mi?
      const isLastTurn = !nextAi && !nextUser;

      return res.json({
        transcript,
        target: String(targetTurn.text_en),
        scores,
        wordAnalysis,
        // Feedback: Azure (tek kaynak)
        feedback: {
          issues: azureFeedback.issues.slice(0, 3),
          positives: azureFeedback.positives.slice(0, 2),
          engine: "azure",
        },
        aiTurn: nextAi
          ? {
              turnId: nextAi.id,
              turnOrder: nextAi.turn_order,
              text: nextAi.text_en,
              textTr: nextAi.text_tr,
              audioBase64: aiAudio,
            }
          : null,
        nextUserTurn: nextUser
          ? {
              turnId: nextUser.id,
              turnOrder: nextUser.turn_order,
              text: nextUser.text_en,
              textTr: nextUser.text_tr,
              phoneticHint: nextUser.phonetic_hint,
              notesTr: nextUser.notes_tr,
            }
          : null,
        isLastTurn,
      });
    } catch (e: any) {
      console.error("[scenes] speak HATA:", e?.message, e?.stack);
      return res.status(500).json({ error: "Ses işlenemedi: " + e?.message });
    }
  },
);

// POST /api/scenes/attempts/:attemptId/complete — Sahneyi bitir + rapor
router.post(
  "/scenes/attempts/:attemptId/complete",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as number;
      const attemptId = parseInt(String(req.params.attemptId ?? ""), 10);

      const attRows = await db.execute(sql`
        SELECT id, user_id, status, started_at FROM speaking_scene_attempts
        WHERE id = ${attemptId} LIMIT 1
      `);
      const att = (attRows.rows ?? attRows)[0] as any;
      if (!att) return res.status(404).json({ error: "Attempt bulunamadı" });
      if (Number(att.user_id) !== userId)
        return res.status(403).json({ error: "Yetkisiz" });
      if (att.status === "completed")
        return res.status(400).json({ error: "Zaten tamamlanmış" });

      // Turn skorları
      const turnRows = await db.execute(sql`
        SELECT overall_score, accuracy_score, fluency_score,
               pronunciation_score, completeness_score
        FROM speaking_scene_turn_attempts
        WHERE attempt_id = ${attemptId}
      `);
      const turns = (turnRows.rows ?? turnRows) as any[];

      if (turns.length === 0) {
        // Hiç deneme yok → abandoned
        await db.execute(sql`
          UPDATE speaking_scene_attempts
          SET status = 'abandoned', completed_at = NOW()
          WHERE id = ${attemptId}
        `);
        return res.json({ status: "abandoned" });
      }

      const avg = (key: string) =>
        Math.round(turns.reduce((s, t) => s + Number(t[key] ?? 0), 0) / turns.length);

      const totalScore = avg("overall_score");
      const accAvg = avg("accuracy_score");
      const fluAvg = avg("fluency_score");
      const proAvg = avg("pronunciation_score");
      const cmpAvg = avg("completeness_score");

      const startedAt = new Date(att.started_at);
      const durationSec = Math.round((Date.now() - startedAt.getTime()) / 1000);

      // Zayıf alan tespit
      const weakAreas: string[] = [];
      if (accAvg < 70) weakAreas.push("Doğruluk (kelime seçimi)");
      if (fluAvg < 70) weakAreas.push("Akıcılık (konuşma hızı)");
      if (proAvg < 70) weakAreas.push("Telaffuz");
      if (cmpAvg < 70) weakAreas.push("Tamlık (eksik kelime)");

      const summary =
        totalScore >= 85
          ? "Harika bir performans! Bu sahneyi çok iyi geçtin, benzer sahneleri deneyebilirsin."
          : totalScore >= 70
            ? "İyi bir çalışma. Zayıf alanları biraz daha pratik yaparak yükseltebilirsin."
            : "İyi bir başlangıç. Aynı sahneyi tekrar edip skorunu yükseltmeyi dene.";

      await db.execute(sql`
        UPDATE speaking_scene_attempts SET
          status = 'completed',
          completed_at = NOW(),
          total_score = ${totalScore},
          duration_seconds = ${durationSec},
          ai_summary_tr = ${summary},
          weak_areas = ${JSON.stringify(weakAreas)}::jsonb
        WHERE id = ${attemptId}
      `);

      return res.json({
        status: "completed",
        totalScore,
        scores: {
          accuracy: accAvg,
          fluency: fluAvg,
          pronunciation: proAvg,
          completeness: cmpAvg,
        },
        turnCount: turns.length,
        durationSeconds: durationSec,
        weakAreas,
        aiSummary: summary,
      });
    } catch (e: any) {
      console.error("[scenes] complete HATA:", e?.message);
      return res.status(500).json({ error: "Sahne kapatılamadı" });
    }
  },
);

// GET /api/scenes/attempts/history — Kullanıcının geçmiş sahneleri
router.get("/scenes/attempts/history", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as number;
    const limit = Math.min(50, parseInt(String(req.query.limit ?? "20"), 10) || 20);

    const rows = await db.execute(sql`
      SELECT a.id, a.scene_id, a.status, a.total_score, a.turn_count,
             a.duration_seconds, a.started_at, a.completed_at,
             s.slug, s.title_en, s.title_tr, s.category, s.difficulty
      FROM speaking_scene_attempts a
      INNER JOIN speaking_scenes s ON s.id = a.scene_id
      WHERE a.user_id = ${userId}
      ORDER BY a.started_at DESC
      LIMIT ${limit}
    `);

    return res.json({ attempts: (rows.rows ?? rows) as any[] });
  } catch (e: any) {
    console.error("[scenes] history HATA:", e?.message);
    return res.status(500).json({ error: "Geçmiş alınamadı" });
  }
});

// GET /api/scenes/attempts/:id — Attempt detay + turn detayları
router.get("/scenes/attempts/:id", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as number;
    const id = parseInt(String(req.params.id ?? ""), 10);

    const attRows = await db.execute(sql`
      SELECT a.*, s.slug, s.title_en, s.title_tr, s.category, s.difficulty
      FROM speaking_scene_attempts a
      INNER JOIN speaking_scenes s ON s.id = a.scene_id
      WHERE a.id = ${id} LIMIT 1
    `);
    const att = (attRows.rows ?? attRows)[0] as any;
    if (!att) return res.status(404).json({ error: "Bulunamadı" });
    if (Number(att.user_id) !== userId)
      return res.status(403).json({ error: "Yetkisiz" });

    const turnRows = await db.execute(sql`
      SELECT id, turn_order, target_text, transcript,
             accuracy_score, fluency_score, pronunciation_score,
             completeness_score, overall_score, word_analysis
      FROM speaking_scene_turn_attempts
      WHERE attempt_id = ${id}
      ORDER BY turn_order ASC
    `);

    return res.json({
      attempt: att,
      turns: (turnRows.rows ?? turnRows) as any[],
    });
  } catch (e: any) {
    console.error("[scenes] detail HATA:", e?.message);
    return res.status(500).json({ error: "Detay alınamadı" });
  }
});

export default router;
