import { Router, type Request, type Response } from "express";
import OpenAI from "openai";
import multer from "multer";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import os from "os";
import path from "path";
import { db } from "@workspace/db";
import {
  presentationSessionsTable,
  type PresentationSetup,
  type PresentationQATurn,
  type PresentationReport,
} from "@workspace/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { authMiddleware } from "../middlewares/auth.js";

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

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1024 * 1024 } });
type Voice = "nova" | "onyx" | "shimmer" | "echo" | "alloy" | "fable";

// ── Audience profiles ────────────────────────────────────────────────────────

const AUDIENCE_PROFILES: Record<
  string,
  { label: string; persona: string; voice: Voice; questionerName: string; questionerRole: string }
> = {
  investors: {
    label: "Yatırımcılar",
    persona:
      "skeptical institutional investors evaluating a pitch. Probe traction, market size, defensibility, and unit economics with sharp, ROI-focused questions.",
    voice: "onyx",
    questionerName: "Sarah Chen",
    questionerRole: "Partner, Series A VC",
  },
  board: {
    label: "Yönetim Kurulu",
    persona:
      "board members focused on strategy, risk, and governance. Ask about strategic trade-offs, risk mitigation, and execution timelines.",
    voice: "onyx",
    questionerName: "Mr. Sterling",
    questionerRole: "Board Chair",
  },
  team: {
    label: "Şirket içi Ekip",
    persona:
      "internal team members curious about implications for their work. Ask practical, operational, hands-on questions.",
    voice: "echo",
    questionerName: "Jake",
    questionerRole: "Senior PM",
  },
  customers: {
    label: "Müşteriler",
    persona:
      "potential B2B customers evaluating whether to buy. Ask about value, integration, pricing, support, and ROI for their context.",
    voice: "shimmer",
    questionerName: "Emma",
    questionerRole: "VP of Operations, Buyer",
  },
  conference: {
    label: "Konferans Dinleyicileri",
    persona:
      "industry peers at a conference. Ask thoughtful, intellectually-curious questions about the underlying ideas.",
    voice: "nova",
    questionerName: "Dr. Olivia",
    questionerRole: "Industry Researcher",
  },
  press: {
    label: "Basın",
    persona:
      "journalists looking for a story. Ask pointed, sometimes uncomfortable questions to surface news angles, controversies, or quotable lines.",
    voice: "shimmer",
    questionerName: "Chloe",
    questionerRole: "Senior Reporter",
  },
};

const GOAL_LABELS: Record<string, string> = {
  inform: "Bilgilendirme",
  persuade: "İkna",
  pitch: "Yatırım Pitch",
  train: "Eğitim / Workshop",
  update: "Durum Güncelleme",
};

const TONE_GUIDANCE: Record<string, string> = {
  formal: "Formal, conservative, executive-level register.",
  neutral: "Professional, balanced, neither overly casual nor stiff.",
  energetic: "High-energy, motivating, story-driven, with vivid examples.",
  consultative: "Advisory, evidence-based, methodical, like a trusted consultant.",
};

// ── Audio helpers ────────────────────────────────────────────────────────────

async function convertToMp3(inputBuffer: Buffer): Promise<Buffer> {
  const tmpIn = path.join(os.tmpdir(), `pres_in_${Date.now()}.webm`);
  const tmpOut = path.join(os.tmpdir(), `pres_out_${Date.now()}.mp3`);
  try {
    fs.writeFileSync(tmpIn, inputBuffer);
    await execFileAsync("ffmpeg", [
      "-y", "-i", tmpIn, "-vn", "-ar", "16000", "-ac", "1", "-b:a", "32k", "-threads", "0", tmpOut,
    ]);
    return fs.readFileSync(tmpOut);
  } finally {
    try { fs.unlinkSync(tmpIn); } catch {}
    try { fs.unlinkSync(tmpOut); } catch {}
  }
}

async function transcribe(audioBuffer: Buffer, prompt = "Professional English presentation."): Promise<string> {
  let finalBuffer = audioBuffer;
  let finalExt = "mp3";
  let finalMime = "audio/mpeg";
  try {
    finalBuffer = await convertToMp3(audioBuffer);
  } catch {
    finalExt = "webm";
    finalMime = "audio/webm";
  }
  const audioFile = new File([finalBuffer], `audio.${finalExt}`, { type: finalMime });
  const res = await getOpenAI().audio.transcriptions.create({
    model: "whisper-1",
    file: audioFile,
    language: "en",
    response_format: "text",
    temperature: 0.1,
    prompt,
  } as any);
  return (res as unknown as string).trim();
}

async function tts(text: string, voice: Voice): Promise<string> {
  const r = await getOpenAI().audio.speech.create({
    model: "tts-1",
    voice,
    input: text,
    speed: 0.96,
  });
  return Buffer.from(await r.arrayBuffer()).toString("base64");
}

// ── Filler word counter ──────────────────────────────────────────────────────

const FILLERS = [
  "um", "uh", "uhh", "umm", "er", "ehm", "like", "you know", "kind of", "sort of",
  "basically", "literally", "actually", "i mean", "right?", "okay so", "so yeah",
];

function countFillers(text: string): { count: number; examples: string[] } {
  const lower = " " + text.toLowerCase().replace(/[.,!?]/g, " ") + " ";
  let total = 0;
  const found = new Set<string>();
  for (const f of FILLERS) {
    const re = new RegExp(`\\s${f.replace(/\?/g, "\\?")}\\s`, "g");
    const matches = lower.match(re);
    if (matches) {
      total += matches.length;
      found.add(f);
    }
  }
  return { count: total, examples: Array.from(found).slice(0, 6) };
}

// ── Routes ───────────────────────────────────────────────────────────────────

// POST /presentation/start — create a session, return setup confirmation
router.post("/presentation/start", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as number;
    const body = req.body as Partial<PresentationSetup> & { targetQaTurns?: number };

    if (!body.topic || !body.audienceType || !body.goal) {
      return res.status(400).json({ error: "Konu, hedef kitle ve amaç gereklidir." });
    }
    const audienceKey = AUDIENCE_PROFILES[body.audienceType as string] ? body.audienceType! : "team";
    const goalKey = GOAL_LABELS[body.goal as string] ? body.goal! : "inform";
    const tone = (["formal", "neutral", "energetic", "consultative"].includes(body.toneStyle as string)
      ? body.toneStyle
      : "neutral") as PresentationSetup["toneStyle"];

    const setup: PresentationSetup = {
      topic: String(body.topic).slice(0, 300),
      audienceType: audienceKey,
      audienceTypeLabel: AUDIENCE_PROFILES[audienceKey].label,
      goal: goalKey as PresentationSetup["goal"],
      goalLabel: GOAL_LABELS[goalKey],
      toneStyle: tone,
      durationTargetMin: Math.min(15, Math.max(1, Number(body.durationTargetMin) || 5)),
      contextNotes: body.contextNotes ? String(body.contextNotes).slice(0, 4000) : undefined,
      language: "en",
    };
    const targetQaTurns = Math.min(4, Math.max(1, Number(body.targetQaTurns) || 2));

    const [session] = await db
      .insert(presentationSessionsTable)
      .values({
        userId,
        status: "recording",
        setup,
        targetQaTurns,
      })
      .returning();

    return res.json({
      sessionId: session.id,
      setup,
      targetQaTurns,
      audienceProfile: AUDIENCE_PROFILES[audienceKey],
    });
  } catch (err: any) {
    console.error("Presentation start error:", err?.message || err);
    return res.status(500).json({ error: "Sunum oturumu başlatılamadı." });
  }
});

// POST /presentation/:id/submit — upload full presentation audio, transcribe, generate first Q&A
router.post(
  "/presentation/:id/submit",
  authMiddleware,
  upload.single("audio"),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as number;
      const sessionId = parseInt(req.params.id, 10);
      if (!Number.isFinite(sessionId)) return res.status(400).json({ error: "Geçersiz id." });

      const [session] = await db
        .select()
        .from(presentationSessionsTable)
        .where(and(eq(presentationSessionsTable.id, sessionId), eq(presentationSessionsTable.userId, userId)))
        .limit(1);
      if (!session) return res.status(404).json({ error: "Sunum bulunamadı." });
      if (session.status !== "recording") return res.status(400).json({ error: "Bu oturum kayıt aşamasında değil." });
      if (!req.file || req.file.buffer.length < 8000) {
        return res.status(400).json({ error: "Kayıt çok kısa. Lütfen tam sunumunu en az 30 saniye olacak şekilde anlat." });
      }

      // 1. Transcribe
      const transcript = await transcribe(req.file.buffer, `English business presentation about ${session.setup.topic}`);
      if (!transcript || transcript.length < 50) {
        return res.status(400).json({ error: "Sunum içeriği anlaşılamadı. Lütfen daha net konuşarak tekrar dene." });
      }

      // 2. Generate first Q&A question from audience persona
      const profile = AUDIENCE_PROFILES[session.setup.audienceType] || AUDIENCE_PROFILES.team;
      const firstQuestionPrompt = `You are role-playing ${profile.questionerName} (${profile.questionerRole}), part of an audience of ${profile.persona}.

A speaker just delivered the following presentation in English about "${session.setup.topic}". Their goal was: ${session.setup.goalLabel}. Audience: ${session.setup.audienceTypeLabel}.

Read the presentation transcript below carefully, then ask ONE pointed, specific question (max 2 sentences) that the audience would realistically ask. Reference something concrete the speaker said. Keep it fair but probing.

Transcript:
"""${transcript.slice(0, 3500)}"""

Respond with ONLY the question text — no preamble, no name, no explanation.`;
      const qCompletion = await getOpenAI().chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: firstQuestionPrompt }],
        temperature: 0.7,
        max_tokens: 120,
      });
      const firstQuestion = qCompletion.choices[0]?.message?.content?.trim() || "Could you elaborate on the key takeaway?";
      const audioBase64 = await tts(firstQuestion, profile.voice);

      // 3. Save and move to QA phase
      const placeholderTurn: PresentationQATurn = {
        question: firstQuestion,
        candidateAnswer: "",
        questionerName: profile.questionerName,
        questionerRole: profile.questionerRole,
        timestamp: new Date().toISOString(),
      };
      await db
        .update(presentationSessionsTable)
        .set({
          status: "qa",
          presentationTranscript: transcript,
          qaTurns: [placeholderTurn],
          updatedAt: new Date(),
        })
        .where(eq(presentationSessionsTable.id, sessionId));

      return res.json({
        transcript,
        firstQuestion,
        audioBase64,
        questionerName: profile.questionerName,
        questionerRole: profile.questionerRole,
        targetQaTurns: session.targetQaTurns,
      });
    } catch (err: any) {
      console.error("Presentation submit error:", err?.message || err);
      return res.status(500).json({ error: "Sunum işlenirken bir hata oluştu." });
    }
  },
);

// POST /presentation/:id/qa-turn — answer current question, optionally get next or signal done
router.post(
  "/presentation/:id/qa-turn",
  authMiddleware,
  upload.single("audio"),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as number;
      const sessionId = parseInt(req.params.id, 10);
      if (!Number.isFinite(sessionId)) return res.status(400).json({ error: "Geçersiz id." });

      const [session] = await db
        .select()
        .from(presentationSessionsTable)
        .where(and(eq(presentationSessionsTable.id, sessionId), eq(presentationSessionsTable.userId, userId)))
        .limit(1);
      if (!session) return res.status(404).json({ error: "Sunum bulunamadı." });
      if (session.status !== "qa") return res.status(400).json({ error: "Bu oturum Q&A aşamasında değil." });
      if (!req.file || req.file.buffer.length < 3000) {
        return res.status(400).json({ error: "Cevap çok kısa. En az 2 saniye konuşun." });
      }

      const profile = AUDIENCE_PROFILES[session.setup.audienceType] || AUDIENCE_PROFILES.team;
      const answerText = await transcribe(req.file.buffer, `Answer to a Q&A question about ${session.setup.topic}`);
      if (!answerText) {
        return res.status(400).json({ error: "Cevap anlaşılamadı." });
      }

      const turns = [...session.qaTurns];
      const lastIdx = turns.length - 1;
      if (lastIdx < 0 || turns[lastIdx].candidateAnswer) {
        return res.status(400).json({ error: "Cevaplanacak aktif soru yok." });
      }
      turns[lastIdx] = { ...turns[lastIdx], candidateAnswer: answerText, timestamp: new Date().toISOString() };

      const remainingTurns = session.targetQaTurns - turns.length;
      let nextQuestion: string | null = null;
      let audioBase64: string | null = null;

      if (remainingTurns > 0) {
        // Generate next question, contextual to previous answer
        const previousQA = turns
          .map((t) => `Q: ${t.question}\nA: ${t.candidateAnswer}`)
          .join("\n\n");
        const nextQPrompt = `You are still ${profile.questionerName} (${profile.questionerRole}). The Q&A so far:

${previousQA}

Original presentation transcript (truncated):
"""${(session.presentationTranscript || "").slice(0, 2500)}"""

Ask ONE follow-up question (max 2 sentences) that drills deeper, challenges, or explores a different angle than what's been covered. Be realistic for ${profile.persona}. Reply with the question text only.`;
        const c = await getOpenAI().chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: nextQPrompt }],
          temperature: 0.75,
          max_tokens: 120,
        });
        nextQuestion = c.choices[0]?.message?.content?.trim() || "Anything else you'd like to add?";
        audioBase64 = await tts(nextQuestion, profile.voice);

        const newTurn: PresentationQATurn = {
          question: nextQuestion,
          candidateAnswer: "",
          questionerName: profile.questionerName,
          questionerRole: profile.questionerRole,
          timestamp: new Date().toISOString(),
        };
        turns.push(newTurn);
      }

      await db
        .update(presentationSessionsTable)
        .set({ qaTurns: turns, updatedAt: new Date() })
        .where(eq(presentationSessionsTable.id, sessionId));

      return res.json({
        answerText,
        nextQuestion,
        audioBase64,
        remainingTurns: Math.max(0, remainingTurns),
        completedTurns: turns.filter((t) => t.candidateAnswer).length,
        targetQaTurns: session.targetQaTurns,
      });
    } catch (err: any) {
      console.error("Presentation Q&A turn error:", err?.message || err);
      return res.status(500).json({ error: "Q&A sırasında bir hata oluştu." });
    }
  },
);

// POST /presentation/:id/end — finalize, generate report
router.post("/presentation/:id/end", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as number;
    const sessionId = parseInt(req.params.id, 10);
    if (!Number.isFinite(sessionId)) return res.status(400).json({ error: "Geçersiz id." });

    const [session] = await db
      .select()
      .from(presentationSessionsTable)
      .where(and(eq(presentationSessionsTable.id, sessionId), eq(presentationSessionsTable.userId, userId)))
      .limit(1);
    if (!session) return res.status(404).json({ error: "Sunum bulunamadı." });
    if (session.status === "completed" && session.report) {
      return res.json({ report: session.report, session });
    }
    if (!session.presentationTranscript) {
      return res.status(400).json({ error: "Henüz bir sunum kaydı yok." });
    }

    const transcript = session.presentationTranscript;
    const fillers = countFillers(transcript);
    const wordCount = transcript.split(/\s+/).filter(Boolean).length;
    const estimatedDurationSec = Math.max(20, Math.round((wordCount / 150) * 60)); // assume 150 wpm baseline
    const estimatedPaceWpm = wordCount > 0 ? Math.round((wordCount / Math.max(1, estimatedDurationSec)) * 60) : 0;

    const qaText = (session.qaTurns || [])
      .filter((t) => t.candidateAnswer)
      .map((t, i) => `Q${i + 1} (${t.questionerName}): ${t.question}\nAnswer: ${t.candidateAnswer}`)
      .join("\n\n") || "(no Q&A captured)";

    const analyzerSystem = `You are a senior public-speaking & business-English coach producing a structured post-presentation report for a Turkish professional who just delivered an English presentation.

Context:
- Topic: ${session.setup.topic}
- Audience: ${session.setup.audienceTypeLabel} (${session.setup.audienceType})
- Goal: ${session.setup.goalLabel}
- Tone aimed for: ${TONE_GUIDANCE[session.setup.toneStyle]}
- Target duration: ${session.setup.durationTargetMin} min
- Word count detected: ${wordCount}
- Filler words detected: ${fillers.count}

Be honest, specific, and actionable. Assess BOTH presentation craft AND English language quality.

Return STRICT JSON (no markdown) matching this schema:
{
  "overallScore": <0-100>,
  "estimatedCefr": "A1"|"A2"|"B1"|"B2"|"C1"|"C2",
  "cefrConfidence": "low"|"medium"|"high",
  "structureScore": <0-100>,
  "clarityScore": <0-100>,
  "persuasivenessScore": <0-100>,
  "englishFluencyScore": <0-100>,
  "vocalDeliveryScore": <0-100>,
  "qaHandlingScore": <0-100>,
  "audienceVerdict": "compelling"|"solid"|"needs_work"|"weak",
  "audienceVerdictLabel": "<Turkish 2-4 words>",
  "hookFeedback": {"yourOpening":"<short quote of opening from transcript>","rating":"weak|ok|strong","suggestion":"<Turkish actionable tip>"},
  "closingFeedback": {"yourClosing":"<short quote of closing from transcript>","rating":"weak|ok|strong","suggestion":"<Turkish actionable tip>"},
  "structureNotes": "<Turkish 2-3 sentences about overall structure (intro-body-conclusion)>",
  "strongPoints": [{"title":"<Turkish 3-6 words>","detail":"<Turkish 1-2 sentences>"}],
  "weakPoints": [{"title":"<Turkish 3-6 words>","detail":"<Turkish 1-2 sentences>","suggestion":"<Turkish actionable>"}],
  "improvedOpeningHook": "<polished English opening hook tailored to topic+audience, 2-3 sentences>",
  "improvedClosingCta": "<polished English closing call-to-action, 2-3 sentences>",
  "vocabUpgrades": [{"original":"<word/phrase from transcript>","better":"<more professional alternative>","explanation":"<Turkish 1 sentence>"}],
  "qaFeedback": [{"question":"<Q text>","yourAnswer":"<their answer trimmed>","rating":"weak|ok|strong","modelAnswer":"<polished English model answer 2-3 sentences>","coaching":"<Turkish 1-2 sentence coaching>"}],
  "recommendedPracticeAreas": ["<Turkish, max 5>"],
  "nextSteps": ["<Turkish, max 4 concrete actions>"],
  "audienceImpression": "<2-3 Turkish sentences in the voice of the audience verdict>"
}

Rules:
- 3-5 strongPoints, 3-5 weakPoints, 3-5 vocabUpgrades.
- qaFeedback length must match the number of completed Q&A pairs (could be 0 if none).
- Visible labels MUST be Turkish; only English fields stay English (improvedOpeningHook, improvedClosingCta, original/better/yourAnswer/question/modelAnswer/yourOpening/yourClosing/estimatedCefr).
- If transcript is short or weak, lower scores honestly.`;

    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: analyzerSystem },
        {
          role: "user",
          content: `Presentation transcript:\n"""${transcript}"""\n\nQ&A:\n${qaText}\n\nContext notes from speaker:\n${session.setup.contextNotes || "(none)"}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 2200,
      response_format: { type: "json_object" },
    });

    let report: PresentationReport;
    try {
      const raw = completion.choices[0]?.message?.content || "{}";
      report = JSON.parse(raw) as PresentationReport;
    } catch (e: any) {
      console.error("Report JSON parse failed:", e?.message);
      return res.status(500).json({ error: "Rapor oluşturulurken bir hata oluştu." });
    }

    // ── Sanitize / clamp ────
    const clamp = (n: any, min = 0, max = 100) => {
      const x = Number(n);
      if (!Number.isFinite(x)) return min;
      return Math.max(min, Math.min(max, Math.round(x)));
    };
    report.overallScore = clamp(report.overallScore);
    report.structureScore = clamp(report.structureScore);
    report.clarityScore = clamp(report.clarityScore);
    report.persuasivenessScore = clamp(report.persuasivenessScore);
    report.englishFluencyScore = clamp(report.englishFluencyScore);
    report.vocalDeliveryScore = clamp(report.vocalDeliveryScore);
    report.qaHandlingScore = clamp(report.qaHandlingScore);
    if (!["A1", "A2", "B1", "B2", "C1", "C2"].includes(report.estimatedCefr)) report.estimatedCefr = "B1";
    if (!["low", "medium", "high"].includes(report.cefrConfidence)) report.cefrConfidence = "medium";
    if (!["compelling", "solid", "needs_work", "weak"].includes(report.audienceVerdict)) {
      report.audienceVerdict = "solid";
    }
    report.wordCount = wordCount;
    report.estimatedDurationSec = estimatedDurationSec;
    report.estimatedPaceWpm = estimatedPaceWpm;
    report.fillerWordCount = fillers.count;
    report.fillerExamples = fillers.examples;
    report.strongPoints = Array.isArray(report.strongPoints) ? report.strongPoints.slice(0, 6) : [];
    report.weakPoints = Array.isArray(report.weakPoints) ? report.weakPoints.slice(0, 6) : [];
    report.vocabUpgrades = Array.isArray(report.vocabUpgrades) ? report.vocabUpgrades.slice(0, 6) : [];
    report.qaFeedback = Array.isArray(report.qaFeedback) ? report.qaFeedback.slice(0, 4) : [];
    report.recommendedPracticeAreas = Array.isArray(report.recommendedPracticeAreas)
      ? report.recommendedPracticeAreas.slice(0, 6)
      : [];
    report.nextSteps = Array.isArray(report.nextSteps) ? report.nextSteps.slice(0, 5) : [];
    if (!report.hookFeedback || typeof report.hookFeedback !== "object") {
      report.hookFeedback = { yourOpening: "", rating: "ok", suggestion: "" };
    }
    if (!report.closingFeedback || typeof report.closingFeedback !== "object") {
      report.closingFeedback = { yourClosing: "", rating: "ok", suggestion: "" };
    }

    const durationSec = Math.max(
      0,
      Math.round((Date.now() - new Date(session.startedAt).getTime()) / 1000),
    );

    const [updated] = await db
      .update(presentationSessionsTable)
      .set({
        status: "completed",
        report,
        durationSec,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(presentationSessionsTable.id, sessionId))
      .returning();

    return res.json({ report, session: updated });
  } catch (err: any) {
    console.error("Presentation end error:", err?.message || err);
    return res.status(500).json({ error: "Rapor oluşturulamadı." });
  }
});

// GET /presentation/sessions
router.get("/presentation/sessions", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as number;
    const rows = await db
      .select()
      .from(presentationSessionsTable)
      .where(eq(presentationSessionsTable.userId, userId))
      .orderBy(desc(presentationSessionsTable.createdAt))
      .limit(30);
    return res.json({ sessions: rows });
  } catch (err: any) {
    console.error("List presentation sessions error:", err?.message || err);
    return res.status(500).json({ error: "Sunum geçmişi alınamadı." });
  }
});

// GET /presentation/sessions/:id
router.get("/presentation/sessions/:id", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as number;
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Geçersiz id." });
    const [row] = await db
      .select()
      .from(presentationSessionsTable)
      .where(and(eq(presentationSessionsTable.id, id), eq(presentationSessionsTable.userId, userId)))
      .limit(1);
    if (!row) return res.status(404).json({ error: "Sunum bulunamadı." });
    return res.json({ session: row });
  } catch (err: any) {
    console.error("Get presentation session error:", err?.message || err);
    return res.status(500).json({ error: "Sunum alınamadı." });
  }
});

// GET /presentation/audiences
router.get("/presentation/audiences", authMiddleware, async (_req: Request, res: Response) => {
  return res.json({
    audiences: Object.entries(AUDIENCE_PROFILES).map(([id, p]) => ({
      id,
      label: p.label,
      questionerName: p.questionerName,
      questionerRole: p.questionerRole,
      bio: p.persona.split(".")[0] + ".",
    })),
  });
});

export default router;
