import { Router, Request, Response } from "express";
import OpenAI from "openai";
import multer from "multer";
import { authMiddleware } from "../middlewares/auth.js";
import { awardPoints } from "../lib/points.js";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import os from "os";
import path from "path";
import { db } from "@workspace/db";
import { usersTable, pronunciationAssessmentsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { applyActivityStreak, computeEffectiveStreak } from "../utils/streak.js";
import { notifyNewAssessment, notifyLevelUp } from "../lib/notifications.js";
import {
  analyzePronunciation as azureAnalyze,
  buildWordFeedback as azureBuildFeedback,
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
      "-vn",
      "-ar", "16000", "-ac", "1",
      "-b:a", "32k",
      "-threads", "0",
      tmpOut,
    ]);
    return fs.readFileSync(tmpOut);
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
      console.info(`ffmpeg dönüşüm: ${audioBuffer.length} → ${finalBuffer.length} bytes`);
    } catch (convErr: any) {
      console.warn("ffmpeg başarısız, orijinal deneniyor:", convErr?.message);
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
      prompt: "English learner practicing conversation. Transcribe exactly as said, including grammar mistakes. May include Turkish proper nouns.",
    } as any);
    const data = res as any;
    const words: WhisperWord[] = (data.words || []).map((w: any) => ({
      word: (w.word || "").trim(),
      start: w.start ?? 0,
      end: w.end ?? 0,
      probability: w.probability ?? 1,
    }));
    const text = (data.text || "").trim();
    console.info(`Whisper: "${text}" (${words.length} words)`);
    return { text, words };
  } catch (e: any) {
    const status = e?.status ?? e?.code ?? "unknown";
    const msg = e?.message || String(e);
    console.error(`Whisper failed [${status}]:`, msg);
    if (status === 401 || msg.includes("invalid_api_key")) {
      console.error("OPENAI_API_KEY geçersiz");
    } else if (status === 429) {
      console.error("OpenAI rate limit");
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
    ? `\nLow-confidence words: ${lowConfWords.join(", ")}`
    : "";

  const systemPrompt = `You are an English coach analyzing a student's spoken English.
Always respond in valid JSON only — no extra text.

Return:
{
  "grammarErrors": [{"original": "<wrong>", "corrected": "<correct>", "explanation": "<Turkish, short>"}],
  "vocabularySuggestions": [{"original": "<basic>", "better": "<better>", "explanation": "<Turkish, short>"}],
  "pronunciationTips": ["<tip in Turkish>"],
  "overallScore": <40-100>,
  "correctedText": "<corrected English>"
}

Rules:
- grammarErrors: Max 3. Only real mistakes.
- vocabularySuggestions: Max 2. Only clearly better alternatives.
- pronunciationTips: Max 2. Based on low-confidence words. Empty if none.
- overallScore: 40-100. Good = 80+.
- All explanations in Turkish. correctedText in English.`;

  const userMsg = `Transcribed speech: "${text}"${pronSection}`;

  try {
    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMsg },
      ],
      temperature: 0.2,
      max_tokens: 500,
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
      awardPoints((req as any).userId, "pronunciation_practice", { dailyCap: 20, silent: true }).catch(() => {});
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
      console.info(`Audio received: ${req.file.buffer.length} bytes, type: ${mimeType}`);

      // ── Transcribe with Whisper + Azure phoneme analysis (paralel) ──
      const [whisperResult, azurePron] = await Promise.all([
        transcribeVerbose(req.file.buffer, mimeType),
        // Chat mode = unscripted (referenceText boş) — Azure prosody + fluency + phoneme confidence
        azureAnalyze(req.file.buffer, {
          referenceText: "",
          enableProsodyAssessment: true,
        }),
      ]);

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

      const lowConfWords = whisperWords
        .filter((w) => w.probability < 0.82 && w.word.trim().length > 1)
        .map((w) => w.word.trim());

      const badWordsForPrompt = lowConfWords.map((w) => `"${w}"`).join(", ");

      const basePersonality = coachSystemPrompt
        ? coachSystemPrompt
        : `You are ${teacherName}, a warm and encouraging English conversation teacher.`;

      const systemPrompt = `${basePersonality}

CONVERSATION STYLE:
- Have a genuine conversation — not a lecture.
- Talk about anything: daily life, hobbies, travel, food, opinions — whatever flows naturally.
- Keep responses SHORT: 2-3 sentences max. Warm and spontaneous.
- Always respond in English only. Stay in character.
- Ask follow-up questions to keep conversation flowing.
- NEVER be preachy. If correcting, do it once, gently, and move on.${
  badWordsForPrompt
    ? `\n\nPRONUNCIATION NOTE — low-confidence words: ${badWordsForPrompt}\nIf natural, briefly mention the most important one.`
    : ""
}`;

      const gptMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
        { role: "system", content: systemPrompt },
        ...history.slice(-6).map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        { role: "user", content: userText },
      ];

      // ── Fire GPT and speech analysis in parallel immediately ──
      const gptPromise = getOpenAI().chat.completions.create({
        model: "gpt-4o-mini",
        messages: gptMessages,
        temperature: 0.75,
        max_tokens: 120,
      });
      const analysisPromise = analyzeSpeech(userText, lowConfWords);

      // ── GPT reply comes in, immediately fire TTS ──
      const completion = await gptPromise;
      const reply = completion.choices[0].message.content?.trim() || "I see! Tell me more.";

      // ── TTS and analysis run in parallel — no waiting for analysis before TTS! ──
      const [ttsResponse, speechAnalysis] = await Promise.all([
        getOpenAI().audio.speech.create({
          model: "tts-1",
          voice: safeVoice,
          input: reply,
          speed: 0.9,
        }),
        analysisPromise,
      ]);

      const audioBase64 = Buffer.from(await ttsResponse.arrayBuffer()).toString("base64");

      // Azure sonucu — word-level pronunciation feedback
      const azureWordFeedback = azurePron ? azureBuildFeedback(azurePron) : [];
      const azureSummary = azurePron
        ? {
            pronScore: azurePron.pronScore,
            accuracyScore: azurePron.accuracyScore,
            fluencyScore: azurePron.fluencyScore,
            prosodyScore: azurePron.prosodyScore,
            words: azureWordFeedback.filter((w) => w.score < 80).slice(0, 5),
          }
        : null;

      return res.json({
        userText,
        wordScores,
        reply,
        audioBase64,
        speechAnalysis,
        azurePronunciation: azureSummary,
      });

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

// ── Practice streak endpoint ──────────────────────────────────────────────
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

// ── Translation endpoint ──────────────────────────────────────────────────
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

// ─── Session Assessment — CEFR + Weak Areas Report ───────────────────────

interface AssessSessionBody {
  teacherId: string;
  teacherName: string;
  durationSeconds: number;
  messages: Array<{
    role: "user" | "teacher";
    text: string;
    score?: number;
    grammarErrors?: GrammarError[];
    vocabSuggestions?: VocabularySuggestion[];
    pronunciationTips?: string[];
    lowConfidenceWords?: string[];
  }>;
  avgScore: number;
}

interface AssessmentResult {
  estimatedCefr: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
  cefrConfidence: "low" | "medium" | "high";
  strengths: string[];
  weakAreas: {
    phonemes: string[];
    grammar: string[];
    vocabulary: string[];
    fluency: string[];
  };
  recommendations: Array<{ title: string; action: string; priority: "high" | "medium" | "low" }>;
  aiSummary: string;
}

router.post("/pronunciation/assess-session", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as number;
    const body = req.body as AssessSessionBody;

    if (!body || !Array.isArray(body.messages)) {
      return res.status(400).json({ error: "Geçersiz veri." });
    }

    const userMessages = body.messages.filter((m) => m.role === "user");
    if (userMessages.length === 0) {
      return res.status(400).json({ error: "Değerlendirme için en az bir konuşma gerekli." });
    }

    // ── Aggregate metrics ──
    const allGrammarErrors: GrammarError[] = [];
    const allVocabSuggestions: VocabularySuggestion[] = [];
    const allPronunciationTips: string[] = [];
    const allLowConfWords: string[] = [];

    for (const m of userMessages) {
      if (m.grammarErrors) allGrammarErrors.push(...m.grammarErrors);
      if (m.vocabSuggestions) allVocabSuggestions.push(...m.vocabSuggestions);
      if (m.pronunciationTips) allPronunciationTips.push(...m.pronunciationTips);
      if (m.lowConfidenceWords) allLowConfWords.push(...m.lowConfidenceWords);
    }

    const uniqueLowConf = Array.from(new Set(allLowConfWords)).slice(0, 30);

    // ── Build prompt for GPT ──
    const transcriptForGpt = userMessages
      .map((m, i) => `[${i + 1}] (skor:${m.score ?? "?"}/100) "${m.text}"`)
      .join("\n");

    const grammarSummary = allGrammarErrors
      .slice(0, 15)
      .map((e) => `- "${e.original}" → "${e.corrected}"`)
      .join("\n");

    const vocabSummary = allVocabSuggestions
      .slice(0, 10)
      .map((v) => `- "${v.original}" → "${v.better}"`)
      .join("\n");

    const systemPrompt = `You are a CEFR-certified English assessor analyzing a Turkish learner's spoken English session.
Always respond in valid JSON only — no extra text, no markdown.

Return EXACTLY this structure:
{
  "estimatedCefr": "A1" | "A2" | "B1" | "B2" | "C1" | "C2",
  "cefrConfidence": "low" | "medium" | "high",
  "strengths": ["<2-4 strengths in Turkish, short>"],
  "weakAreas": {
    "phonemes": ["<phoneme/sound issues in Turkish, max 4>"],
    "grammar": ["<grammar pattern weaknesses in Turkish, max 4>"],
    "vocabulary": ["<vocab gaps in Turkish, max 3>"],
    "fluency": ["<fluency/pace issues in Turkish, max 3>"]
  },
  "recommendations": [
    {"title": "<Turkish title>", "action": "<concrete Turkish action>", "priority": "high" | "medium" | "low"}
  ],
  "aiSummary": "<2-3 sentence Turkish summary of the session, encouraging tone>"
}

Rules:
- estimatedCefr: Use total transcript length, vocabulary range, grammar complexity, error density.
  - A1: very basic, present tense only, single words/short phrases
  - A2: simple sentences, frequent errors in basic grammar
  - B1: connected speech, can describe experiences, occasional complex sentences
  - B2: clear & detailed, varied vocab, can argue a point with some errors
  - C1: fluent, nuanced, complex grammar mostly correct
  - C2: near-native precision and range
- cefrConfidence: low if very few user messages (<3) or very short, medium otherwise, high if 8+ rich messages
- recommendations: 3-5 items max, prioritized
- All Turkish text must be natural and encouraging (not harsh)`;

    const userPrompt = `Session metrics:
- Duration: ${body.durationSeconds} seconds
- User turns: ${userMessages.length}
- Average word-level score: ${body.avgScore}/100
- Low-confidence words flagged by Whisper: ${uniqueLowConf.length > 0 ? uniqueLowConf.join(", ") : "none"}

User transcript (turn by turn):
${transcriptForGpt}

${grammarSummary ? `Grammar errors observed:\n${grammarSummary}` : "No major grammar errors observed."}

${vocabSummary ? `Vocabulary improvements suggested:\n${vocabSummary}` : ""}

Now produce the assessment JSON.`;

    let assessment: AssessmentResult;
    try {
      const completion = await getOpenAI().chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 900,
        response_format: { type: "json_object" },
      });

      const raw = completion.choices[0]?.message?.content ?? "{}";
      assessment = JSON.parse(raw) as AssessmentResult;

      // Defensive defaults
      if (!assessment.estimatedCefr) assessment.estimatedCefr = "B1";
      if (!assessment.cefrConfidence) assessment.cefrConfidence = "medium";
      if (!Array.isArray(assessment.strengths)) assessment.strengths = [];
      if (!assessment.weakAreas) assessment.weakAreas = { phonemes: [], grammar: [], vocabulary: [], fluency: [] };
      if (!Array.isArray(assessment.recommendations)) assessment.recommendations = [];
      if (typeof assessment.aiSummary !== "string") assessment.aiSummary = "";
    } catch (e: any) {
      console.error("Assessment GPT failed:", e?.message);
      return res.status(500).json({ error: "Değerlendirme üretilemedi. Lütfen tekrar deneyin." });
    }

    // ── Save to DB ──
    const transcriptSummary = userMessages.slice(-12).map((m) => ({
      role: "user" as const,
      text: m.text.slice(0, 300),
      score: m.score,
    }));

    const inserted = await db
      .insert(pronunciationAssessmentsTable)
      .values({
        userId,
        teacherId: body.teacherId.slice(0, 64),
        teacherName: body.teacherName.slice(0, 64),
        durationSeconds: Math.max(0, Math.floor(body.durationSeconds || 0)),
        messageCount: userMessages.length,
        avgScore: Math.max(0, Math.min(100, Math.floor(body.avgScore || 0))),
        estimatedCefr: assessment.estimatedCefr,
        cefrConfidence: assessment.cefrConfidence,
        strengths: assessment.strengths,
        weakAreas: assessment.weakAreas,
        recommendations: assessment.recommendations,
        aiSummary: assessment.aiSummary,
        transcriptSummary,
        rawMetrics: {
          totalGrammarErrors: allGrammarErrors.length,
          totalVocabSuggestions: allVocabSuggestions.length,
          totalPronunciationTips: allPronunciationTips.length,
          lowConfidenceWords: uniqueLowConf,
        },
      })
      .returning();

    // Update user's currentLevel only if confidence is medium/high and we have a stronger estimate
    let leveledUpFrom: string | null = null;
    let leveledUpTo: string | null = null;
    try {
      const user = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
      const currentLevel = user[0]?.currentLevel;
      const cefrOrder = ["A1", "A2", "B1", "B2", "C1", "C2"];
      const newIdx = cefrOrder.indexOf(assessment.estimatedCefr);
      const oldIdx = currentLevel ? cefrOrder.indexOf(currentLevel) : -1;
      const shouldUpdate =
        assessment.cefrConfidence !== "low" &&
        newIdx >= 0 &&
        (oldIdx < 0 || newIdx > oldIdx); // only upgrade
      if (shouldUpdate) {
        await db
          .update(usersTable)
          .set({ currentLevel: assessment.estimatedCefr, updatedAt: new Date() })
          .where(eq(usersTable.id, userId));
        leveledUpFrom = currentLevel ?? null;
        leveledUpTo = assessment.estimatedCefr;
      }
    } catch (e: any) {
      console.warn("CEFR level update skipped:", e?.message);
    }

    // Fire notifications (non-blocking)
    notifyNewAssessment(userId, {
      cefr: assessment.estimatedCefr,
      assessmentId: inserted[0].id,
      teacherName: body.teacherName,
      aiSummary: assessment.aiSummary,
    }).catch((e) => console.warn("notifyNewAssessment failed:", e?.message));

    if (leveledUpTo) {
      notifyLevelUp(userId, { fromLevel: leveledUpFrom, toLevel: leveledUpTo }).catch((e) =>
        console.warn("notifyLevelUp failed:", e?.message),
      );
    }

    return res.json({ assessment: inserted[0] });
  } catch (err: any) {
    console.error("Assess session error:", err?.message || err);
    return res.status(500).json({ error: "Değerlendirme sırasında bir hata oluştu." });
  }
});

// ── Assessment history ──
router.get("/pronunciation/assessments", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as number;
    const limit = Math.min(50, parseInt(String(req.query.limit ?? "20"), 10) || 20);

    const rows = await db
      .select({
        id: pronunciationAssessmentsTable.id,
        teacherId: pronunciationAssessmentsTable.teacherId,
        teacherName: pronunciationAssessmentsTable.teacherName,
        durationSeconds: pronunciationAssessmentsTable.durationSeconds,
        messageCount: pronunciationAssessmentsTable.messageCount,
        avgScore: pronunciationAssessmentsTable.avgScore,
        estimatedCefr: pronunciationAssessmentsTable.estimatedCefr,
        cefrConfidence: pronunciationAssessmentsTable.cefrConfidence,
        aiSummary: pronunciationAssessmentsTable.aiSummary,
        createdAt: pronunciationAssessmentsTable.createdAt,
      })
      .from(pronunciationAssessmentsTable)
      .where(eq(pronunciationAssessmentsTable.userId, userId))
      .orderBy(desc(pronunciationAssessmentsTable.createdAt))
      .limit(limit);

    return res.json({ assessments: rows });
  } catch (err: any) {
    console.error("List assessments error:", err?.message || err);
    return res.status(500).json({ error: "Geçmiş raporlar alınamadı." });
  }
});

// ── Single assessment detail ──
router.get("/pronunciation/assessments/:id", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as number;
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Geçersiz id." });

    const rows = await db
      .select()
      .from(pronunciationAssessmentsTable)
      .where(eq(pronunciationAssessmentsTable.id, id))
      .limit(1);

    const row = rows[0];
    if (!row || row.userId !== userId) {
      return res.status(404).json({ error: "Rapor bulunamadı." });
    }
    return res.json({ assessment: row });
  } catch (err: any) {
    console.error("Get assessment error:", err?.message || err);
    return res.status(500).json({ error: "Rapor alınamadı." });
  }
});

export default router;
