import { Router, Request, Response } from "express";
import OpenAI from "openai";
import multer from "multer";
import { authMiddleware } from "../middlewares/auth.js";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import os from "os";
import path from "path";

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
      prompt: "This is an English language learner practicing conversation. They may make grammar mistakes like: she dont, he go, I am go, she dont like, they doesn't, we was. Transcribe exactly what is said, including grammar errors. Do not correct the grammar.",
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
    console.error("Whisper transcription failed:", e?.status, e?.message || e);
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
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMsg },
      ],
      temperature: 0.2,
      max_tokens: 800,
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

      const userText = whisperResult?.text || "";

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

      const systemPrompt = `You are ${teacherName}, a warm and encouraging English conversation teacher.
Your role is to have natural, flowing conversations with the student in English.
The student is learning English and practicing speaking.

IMPORTANT RULES:
- Always respond in English only.
- Keep your responses SHORT (2-4 sentences max). Be conversational, not lecture-y.
- If there are mispronounced words (listed below), mention 1 at most per turn — weave it in naturally like: "By the way, the word '...' is pronounced like '...'" — then continue the conversation.
- If pronunciation is fine, just have a natural conversation. Ask follow-up questions to keep things going.
- Be encouraging and friendly. Never harsh.
- If the student seems to be struggling, slow down and help.${
  badWordsForPrompt
    ? `\n\nPRONUNCIATION ISSUES DETECTED (Whisper low-confidence): ${badWordsForPrompt}\nMention the most important one naturally in your reply if relevant.`
    : "\n\nPRONUNCIATION: No issues detected. Just have a natural conversation."
}`;

      const gptMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
        { role: "system", content: systemPrompt },
        ...history.slice(-10).map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
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

export default router;
