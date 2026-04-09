import { Router, Request, Response } from "express";
import OpenAI from "openai";
import multer from "multer";
import { authMiddleware } from "../middlewares/auth.js";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import os from "os";
import path from "path";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { applyActivityStreak, computeEffectiveStreak } from "../utils/streak.js";

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

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const ALLOWED_VOICES = ["nova", "onyx", "shimmer", "echo", "alloy", "fable"] as const;
type Voice = typeof ALLOWED_VOICES[number];

interface WhisperWord { word: string; start: number; end: number; probability: number }

async function convertToMp3(inputBuffer: Buffer): Promise<Buffer> {
  const tmpIn = path.join(os.tmpdir(), `audio_in_${Date.now()}.webm`);
  const tmpOut = path.join(os.tmpdir(), `audio_out_${Date.now()}.mp3`);
  try {
    fs.writeFileSync(tmpIn, inputBuffer);
    await execFileAsync("ffmpeg", [
      "-y", "-i", tmpIn,
      "-ar", "16000", "-ac", "1", "-b:a", "64k",
      tmpOut
    ]);
    const mp3Buffer = fs.readFileSync(tmpOut);
    return mp3Buffer;
  } finally {
    try { fs.unlinkSync(tmpIn); } catch {}
    try { fs.unlinkSync(tmpOut); } catch {}
  }
}

async function transcribeVerbose(
  audioBuffer: Buffer,
  mimeType: string
): Promise<{ text: string; words: WhisperWord[]; apiError?: boolean } | null> {
  try {
    let finalBuffer = audioBuffer;
    let finalExt = "mp3";
    let finalMime = "audio/mpeg";

    try {
      finalBuffer = await convertToMp3(audioBuffer);
      console.info(`ffmpeg dönüşüm tamamlandı: ${audioBuffer.length} → ${finalBuffer.length} bytes`);
    } catch (convErr: any) {
      console.warn("ffmpeg dönüşüm başarısız, orijinal buffer deneniyor:", convErr?.message);
      finalExt = "webm";
      finalMime = "audio/webm";
    }

    const audioFile = new File([finalBuffer], `audio.${finalExt}`, { type: finalMime });
    const res = await getOpenAI().audio.transcriptions.create({
      model: "whisper-1",
      file: audioFile,
      language: "en",
      response_format: "verbose_json",
      timestamp_granularities: ["word"],
      temperature: 0.1,
      prompt: "This is an English language learner practicing conversation. They may make grammar mistakes — transcribe exactly as said, do not correct grammar. IMPORTANT: The speaker may naturally insert Turkish proper nouns such as city names (Istanbul, Ankara, Izmir, Ayvalik, Antalya, Trabzon, Bursa, Eskisehir, Bodrum, Cappadocia, Pamukkale, Konya, Gaziantep, Adana, Mersin, Erzurum, Kayseri, Samsun, Diyarbakir, Alanya, Marmaris, Kusadasi, Fethiye, Çeşme, Edirne), Turkish person names (Ahmet, Mehmet, Fatma, Ayse, Ali, Kemal, Mustafa, Hasan, Hüseyin, Elif, Zeynep, Yusuf, Ibrahim, Ömer), and other Turkish words that may sound like English words. Preserve these as proper nouns rather than mapping them to English words.",
    } as any);
    const data = res as any;
    const words: WhisperWord[] = (data.words || []).map((w: any) => ({
      word: (w.word || "").trim(),
      start: w.start ?? 0,
      end: w.end ?? 0,
      probability: w.probability ?? 1,
    }));
    const text = (data.text || "").trim();
    console.info(`Whisper transcription: "${text}" (${words.length} words, ${finalBuffer.length} bytes)`);
    return { text, words };
  } catch (e: any) {
    const status = e?.status ?? e?.code ?? "unknown";
    const msg = e?.message || String(e);
    console.error(`Whisper transcription failed [${status}]:`, msg);
    // Surface specific error type for better diagnostics
    if (status === 401 || msg.includes("Incorrect API key") || msg.includes("invalid_api_key")) {
      console.error("OPENAI_API_KEY geçersiz veya eksik — üretim ortamında env var ayarlanmış mı?");
    } else if (status === 429) {
      console.error("OpenAI rate limit aşıldı — kota veya dakika limiti.");
    } else if (status === 503 || msg.includes("overloaded") || msg.includes("unavailable")) {
      console.error("OpenAI servisi geçici olarak kullanılamıyor.");
    }
    return { text: "", words: [], apiError: true };
  }
}

export interface GrammarError {
  original: string;
  corrected: string;
  explanation: string;
}

export interface VocabularySuggestion {
  original: string;
  better: string;
  explanation: string;
}

export interface SpeechAnalysis {
  grammarErrors: GrammarError[];
  vocabularySuggestions: VocabularySuggestion[];
  pronunciationTips: string[];
  overallScore: number;
  correctedText: string;
}

async function analyzeSpeech(
  text: string,
  lowConfWords: string[]
): Promise<SpeechAnalysis> {
  const pronSection = lowConfWords.length > 0
    ? `\nLow-confidence words (possible pronunciation issues): ${lowConfWords.join(", ")}`
    : "";

  const systemPrompt = `You are an expert English language coach analyzing a student's spoken English. 
Analyze the transcribed speech for grammar errors, vocabulary issues, and pronunciation tips.
Always respond in valid JSON only — no extra text.

Return this exact JSON structure:
{
  "grammarErrors": [
    { "original": "<exact wrong phrase>", "corrected": "<correct version>", "explanation": "<short Turkish explanation>" }
  ],
  "vocabularySuggestions": [
    { "original": "<basic/wrong word>", "better": "<better alternative>", "explanation": "<short Turkish explanation>" }
  ],
  "pronunciationTips": ["<tip in Turkish about a specific word or sound>"],
  "overallScore": <40-100>,
  "correctedText": "<full corrected version of the text>"
}

Rules:
- grammarErrors: Only real grammar mistakes (wrong tense, missing article, wrong preposition, subject-verb disagreement, etc). Max 4.
- vocabularySuggestions: Only if there are clearly weak or incorrect word choices. Max 3.
- pronunciationTips: Based on the low-confidence words list. Give phonetic tip in Turkish. Max 2. Empty array if no issues.
- overallScore: 40-100. Good speech = 80+. Many errors = 40-60.
- correctedText: The full corrected sentence(s) in English.
- All explanations must be in Turkish. correctedText must be in English.`;

  const userMsg = `Transcribed speech: "${text}"${pronSection}`;

  try {
    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMsg },
      ],
      temperature: 0.2,
      max_tokens: 600,
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("JSON bulunamadı");
    return JSON.parse(match[0]) as SpeechAnalysis;
  } catch (e: any) {
    console.error("Speech analysis failed:", e?.message);
    return {
      grammarErrors: [],
      vocabularySuggestions: [],
      pronunciationTips: [],
      overallScore: 75,
      correctedText: text,
    };
  }
}

// ─── /pronunciation/chat — conversational AI teacher ─────────────────────

interface HistoryMessage { role: "user" | "assistant"; content: string }

router.post(
  "/pronunciation/chat",
  authMiddleware,
  upload.single("audio"),
  async (req: Request, res: Response) => {
    try {
      const voice = req.body.voice as Voice;
      const safeVoice: Voice = ALLOWED_VOICES.includes(voice) ? voice : "nova";
      const teacherName: string = req.body.teacherName || "Sarah";
      const coachSystemPrompt: string = req.body.systemPrompt || "";

      let history: HistoryMessage[] = [];
      try {
        history = JSON.parse(req.body.history || "[]");
      } catch {}

      if (!req.file || req.file.buffer.length < 3000) {
        console.warn(`Audio too small: ${req.file?.buffer?.length ?? 0} bytes`);
        return res.status(400).json({ error: "Ses kaydı çok kısa. En az 2 saniye konuşun." });
      }

      const mimeType = req.file.mimetype || "audio/webm";
      console.info(`Received audio: ${req.file.buffer.length} bytes, type: ${mimeType}`);

      // ── Transcribe with Whisper verbose ──
      const whisperResult = await transcribeVerbose(req.file.buffer, mimeType);

      if (whisperResult?.apiError) {
        return res.status(500).json({ error: "Yapay zeka servisi şu an ulaşılamıyor. Lütfen biraz bekleyip tekrar deneyin." });
      }

      let userText = whisperResult?.text || "";

      if (!userText) {
        return res.status(400).json({ error: "Ses anlaşılamadı. Daha yüksek ve net konuşmayı deneyin." });
      }

      // ── Word-level scores ──
      const whisperWords = whisperResult?.words || [];
      const wordScores = whisperWords
        .filter((w) => w.word.length > 0)
        .map((w) => ({
          word: w.word,
          score: Math.round(w.probability * 100),
          ok: w.probability >= 0.82,
        }))
        .filter((w) => w.word.trim().length > 0);

      // ── Low confidence words for pronunciation tips ──
      const lowConfWords = whisperWords
        .filter((w) => w.probability < 0.82 && w.word.trim().length > 1)
        .map((w) => w.word.trim());

      // ── Run speech analysis (grammar + vocabulary + pronunciation) in parallel with GPT conversation ──
      const badWordsForPrompt = lowConfWords
        .map((w) => `"${w}"`)
        .join(", ");

      const basePersonality = coachSystemPrompt
        ? coachSystemPrompt
        : `You are ${teacherName}, a warm and encouraging English conversation teacher.`;

      const systemPrompt = `${basePersonality}

CONVERSATION STYLE:
- You are a real person having a genuine conversation — not a robot or a tutor lecturing the student.
- Talk about ANYTHING: daily life, hobbies, travel, food, movies, weather, personal experiences, opinions — whatever flows naturally.
- You have your own personality, opinions, and life experiences. Share them. Be curious about the student's life too.
- When the student asks about or brings up topics related to your professional background, naturally engage with that depth — but don't force it.
- Keep your responses SHORT (2-4 sentences max). Conversational, warm, and spontaneous — like texting a friend or chatting at a coffee break.
- Always respond in English only.
- Stay in character at all times — your personality, accent background, and communication style should feel authentic.
- Ask follow-up questions to keep the conversation flowing naturally.
- NEVER be preachy or lecture-y. If you correct something, do it once, gently, and move on.
- Never be harsh. Be encouraging and human.${
  badWordsForPrompt
    ? `\n\nPRONUNCIATION NOTE (Whisper low-confidence words): ${badWordsForPrompt}\nIf natural, mention the most important one briefly and move on.`
    : ""
}`;

      const gptMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
        { role: "system", content: systemPrompt },
        ...history.slice(-6).map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        { role: "user", content: userText },
      ];

      // ── Run GPT conversation + speech analysis in parallel ──
      const [completion, speechAnalysis] = await Promise.all([
        getOpenAI().chat.completions.create({
          model: "gpt-4o-mini",
          messages: gptMessages,
          temperature: 0.75,
          max_tokens: 150,
        }),
        analyzeSpeech(userText, lowConfWords),
      ]);

      const reply = completion.choices[0].message.content?.trim() || "I see! Tell me more.";

      // ── TTS ──
      const ttsResponse = await getOpenAI().audio.speech.create({
        model: "tts-1",
        voice: safeVoice,
        input: reply,
        speed: 0.9,
      });
      const audioBase64 = Buffer.from(await ttsResponse.arrayBuffer()).toString("base64");

      return res.json({ userText, wordScores, reply, audioBase64, speechAnalysis });

    } catch (err: any) {
      console.error("Pronunciation chat error:", err?.message || err);
      return res.status(500).json({ error: "Bir hata oluştu. Lütfen tekrar deneyin." });
    }
  }
);

// ─── Legacy /pronunciation/analyze (kept for compatibility) ─────────────

router.post(
  "/pronunciation/analyze",
  authMiddleware,
  upload.single("audio"),
  async (req: Request, res: Response) => {
    try {
      const voice = req.body.voice as Voice;
      const safeVoice: Voice = ALLOWED_VOICES.includes(voice) ? voice : "nova";

      if (!req.file || req.file.buffer.length < 500) {
        return res.status(400).json({ error: "Ses kaydı bulunamadı." });
      }

      const mimeType = req.file.mimetype || "audio/webm";
      const whisperResult = await transcribeVerbose(req.file.buffer, mimeType);
      const primaryText = whisperResult?.text || "";

      if (!primaryText) {
        return res.status(400).json({ error: "Ses anlaşılamadı. Lütfen daha net konuşun." });
      }

      const whisperWords = whisperResult?.words || [];
      const wordScores = whisperWords
        .filter((w) => w.word.length > 0)
        .map((w) => ({
          word: w.word.toLowerCase().replace(/[^a-z']/g, ""),
          score: Math.round(w.probability * 100),
          ok: w.probability >= 0.80,
        }))
        .filter((w) => w.word.length > 0);

      const ttsResponse = await getOpenAI().audio.speech.create({
        model: "tts-1",
        voice: safeVoice,
        input: primaryText,
        speed: 0.85,
      });
      const audioBase64 = Buffer.from(await ttsResponse.arrayBuffer()).toString("base64");

      return res.json({
        hasErrors: false,
        corrected: primaryText,
        original: primaryText,
        feedback: "",
        score: 100,
        pronunciationIssues: [],
        wordScores,
        audioBase64,
      });
    } catch (err: any) {
      console.error("Pronunciation analyze error:", err?.message || err);
      return res.status(500).json({ error: "Analiz başarısız oldu." });
    }
  }
);

// ── Practice streak endpoint — 10 dk AI koç pratiği → streak güncelle ──────
router.post("/pronunciation/practice-streak", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as number;
    const PRACTICE_POINTS = 20;
    const result = await applyActivityStreak(userId, PRACTICE_POINTS);
    if (result.alreadyActiveToday) {
      return res.json({ streakUpdated: false, streak: result.newStreak, totalPoints: result.newTotalPoints, message: "Bugün zaten aktifsin." });
    }
    return res.json({ streakUpdated: true, streak: result.newStreak, totalPoints: result.newTotalPoints, pointsEarned: PRACTICE_POINTS });
  } catch (err: any) {
    console.error("Practice streak error:", err?.message || err);
    return res.status(500).json({ error: "Streak güncellenemedi." });
  }
});

// ── Translation endpoint ────────────────────────────────────────────────────
router.post("/pronunciation/translate", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { text } = req.body as { text?: string };
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return res.status(400).json({ error: "Metin eksik." });
    }
    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      max_tokens: 400,
      messages: [
        {
          role: "system",
          content: "Translate the following English text to natural, fluent Turkish. Return ONLY the Turkish translation, nothing else.",
        },
        { role: "user", content: text.trim() },
      ],
    });
    const translation = (completion.choices[0]?.message?.content || "").trim();
    return res.json({ translation });
  } catch (err: any) {
    console.error("Translation error:", err?.message || err);
    return res.status(500).json({ error: "Çeviri başarısız oldu." });
  }
});

export default router;
