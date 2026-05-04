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
  interviewSessionsTable,
  type InterviewSetup,
  type InterviewTurn,
  type InterviewReport,
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

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } });
const ALLOWED_VOICES = ["nova", "onyx", "shimmer", "echo", "alloy", "fable"] as const;
type Voice = (typeof ALLOWED_VOICES)[number];

// ── Coach styles for interviewer persona ─────────────────────────────────────

const INTERVIEWER_STYLES: Record<
  string,
  { name: string; voice: Voice; persona: string }
> = {
  sterling: {
    name: "Mr. Sterling",
    voice: "onyx",
    persona:
      "You are Mr. Sterling, a 57-year-old British C-suite executive interviewing for a senior role. RP accent. Authoritative, precise, dry-witted, focused on strategic thinking and leadership maturity. You ask sharp, probing questions and dislike vague answers.",
  },
  emma: {
    name: "Emma",
    voice: "shimmer",
    persona:
      "You are Emma, a 37-year-old London-based HR Business Partner. Standard British accent. Warm but structured. You assess cultural fit, communication clarity, and behavioral patterns using STAR-style probing questions.",
  },
  david: {
    name: "David",
    voice: "echo",
    persona:
      "You are David, a 43-year-old New York hiring manager from a finance/strategy background. Direct, data-driven, intense. You probe for measurable impact (numbers, KPIs) and reasoning behind decisions.",
  },
  raj: {
    name: "Raj",
    voice: "echo",
    persona:
      "You are Raj, a 32-year-old engineering manager from Bangalore now in London. Warm, technically curious, collaborative. Indian-English accent. You probe for technical depth, system thinking, and teamwork stories.",
  },
  jake: {
    name: "Jake",
    voice: "echo",
    persona:
      "You are Jake, a 30-year-old San Francisco product/marketing lead at a startup. West Coast accent. Casual but sharp. You assess hustle, creativity, and growth mindset.",
  },
  chloe: {
    name: "Chloe",
    voice: "shimmer",
    persona:
      "You are Chloe, a 28-year-old Australian Customer Success lead. Friendly Aussie accent. You probe for empathy, conflict resolution, and customer-centric thinking.",
  },
};

// ── Phase plan ──────────────────────────────────────────────────────────────

type Phase = "intro" | "experience" | "behavioral" | "technical" | "candidate_q" | "closing";

function nextPhase(currentPhase: Phase, asked: number, target: number): Phase {
  // approximate progression based on questions asked
  if (asked === 0) return "intro";
  if (asked <= Math.floor(target * 0.3)) return "experience";
  if (asked <= Math.floor(target * 0.6)) return "behavioral";
  if (asked <= Math.floor(target * 0.85)) return "technical";
  if (asked < target) return "candidate_q";
  return "closing";
}

const PHASE_GUIDANCE: Record<Phase, string> = {
  intro:
    "PHASE: Opening. Greet the candidate warmly, introduce yourself in 1 sentence, then ask: 'Tell me about yourself and what brings you to this opportunity.' Keep total under 3 sentences.",
  experience:
    "PHASE: Experience. Ask one focused question about their professional background, a concrete project, or a key achievement related to the target role. Be specific.",
  behavioral:
    "PHASE: Behavioral (STAR). Ask one behavioral question (e.g. tell me about a time you... handled conflict / led a project / faced failure / influenced without authority). Encourage Situation-Task-Action-Result style.",
  technical:
    "PHASE: Role-specific. Ask one practical or scenario-based question relevant to the target role and seniority. Probe their reasoning, not just facts.",
  candidate_q:
    "PHASE: Candidate questions. Invite them: 'What questions do you have for me about the role, team, or company?' Answer briefly if they ask.",
  closing:
    "PHASE: Closing. Thank them warmly, mention next steps will be communicated, and end the interview professionally in 2 sentences.",
};

// ── Audio helpers (reused pattern) ───────────────────────────────────────────

async function convertToMp3(inputBuffer: Buffer): Promise<Buffer> {
  const tmpIn = path.join(os.tmpdir(), `iv_in_${Date.now()}.webm`);
  const tmpOut = path.join(os.tmpdir(), `iv_out_${Date.now()}.mp3`);
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

async function transcribe(audioBuffer: Buffer): Promise<string> {
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
    prompt: "Job interview answer in English.",
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

// ── System prompt builder ────────────────────────────────────────────────────

function buildSystemPrompt(setup: InterviewSetup, phase: Phase, persona: string, asked: number, target: number): string {
  const base = `${persona}

You are conducting a ${setup.seniority.toUpperCase()} level job interview for the role of "${setup.targetRole}" in the ${setup.industry} sector. The candidate is a Turkish professional practicing English. The interview will be ~${target} questions total (currently on question ${asked + 1}).

INTERVIEW RULES:
- Stay completely in character as the interviewer.
- Speak ENGLISH only. Use natural, professional, native-level interview language.
- Keep each turn concise (2-3 sentences max). Ask ONE question per turn unless the candidate asks you something.
- Never give the candidate feedback during the interview — that comes at the end.
- React naturally to their answer (brief acknowledgement) before the next question.
- If the candidate goes off-topic, gently steer back.

${PHASE_GUIDANCE[phase]}`;

  const ctx: string[] = [];
  if (setup.jobDescription) ctx.push(`JOB DESCRIPTION:\n${setup.jobDescription.slice(0, 1500)}`);
  if (setup.resumeText) ctx.push(`CANDIDATE RESUME / BACKGROUND:\n${setup.resumeText.slice(0, 1500)}`);
  return ctx.length ? `${base}\n\n${ctx.join("\n\n")}` : base;
}

// ── Routes ───────────────────────────────────────────────────────────────────

// POST /interview/start — create session, return opening question + audio
router.post("/interview/start", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as number;
    const body = req.body as Partial<InterviewSetup> & { targetQuestions?: number };

    if (!body.targetRole || !body.industry || !body.seniority) {
      return res.status(400).json({ error: "Hedef rol, sektör ve seviye gereklidir." });
    }

    const setup: InterviewSetup = {
      targetRole: String(body.targetRole).slice(0, 200),
      seniority: (["junior", "mid", "senior", "lead", "executive"].includes(body.seniority as string)
        ? body.seniority
        : "mid") as InterviewSetup["seniority"],
      industry: String(body.industry).slice(0, 80),
      interviewerStyle: String(body.interviewerStyle || "emma"),
      jobDescription: body.jobDescription ? String(body.jobDescription).slice(0, 4000) : undefined,
      resumeText: body.resumeText ? String(body.resumeText).slice(0, 4000) : undefined,
      language: "en",
      cefrTarget: body.cefrTarget,
    };
    const targetQuestions = Math.min(12, Math.max(4, Number(body.targetQuestions) || 8));
    const styleKey = INTERVIEWER_STYLES[setup.interviewerStyle] ? setup.interviewerStyle : "emma";
    const style = INTERVIEWER_STYLES[styleKey];

    const phase: Phase = "intro";
    const systemPrompt = buildSystemPrompt(setup, phase, style.persona, 0, targetQuestions);

    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Begin the interview." },
      ],
      temperature: 0.6,
      max_tokens: 160,
    });
    const opening = completion.choices[0]?.message?.content?.trim() || "Hello, thanks for joining today. To start, could you tell me about yourself?";
    const audioBase64 = await tts(opening, style.voice);

    const initialTurn: InterviewTurn = {
      role: "interviewer",
      content: opening,
      timestamp: new Date().toISOString(),
    };

    const [session] = await db
      .insert(interviewSessionsTable)
      .values({
        userId,
        status: "active",
        setup,
        transcript: [initialTurn],
        questionsAsked: 1,
        targetQuestions,
        currentPhase: phase,
      })
      .returning();

    return res.json({
      sessionId: session.id,
      reply: opening,
      audioBase64,
      phase,
      questionsAsked: 1,
      targetQuestions,
      interviewerName: style.name,
    });
  } catch (err: any) {
    console.error("Interview start error:", err?.message || err);
    return res.status(500).json({ error: "Mülakat başlatılamadı." });
  }
});

// POST /interview/:id/turn — audio in, returns AI reply audio + transcript update
router.post(
  "/interview/:id/turn",
  authMiddleware,
  upload.single("audio"),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as number;
      const sessionId = parseInt(req.params.id, 10);
      if (!Number.isFinite(sessionId)) return res.status(400).json({ error: "Geçersiz id." });

      const [session] = await db
        .select()
        .from(interviewSessionsTable)
        .where(and(eq(interviewSessionsTable.id, sessionId), eq(interviewSessionsTable.userId, userId)))
        .limit(1);
      if (!session) return res.status(404).json({ error: "Mülakat bulunamadı." });
      if (session.status !== "active") return res.status(400).json({ error: "Bu mülakat zaten kapatılmış." });

      if (!req.file || req.file.buffer.length < 3000) {
        return res.status(400).json({ error: "Ses kaydı çok kısa. En az 2 saniye konuşun." });
      }

      const userText = await transcribe(req.file.buffer);
      if (!userText) {
        return res.status(400).json({ error: "Ses anlaşılamadı. Daha net konuşmayı deneyin." });
      }

      const styleKey = INTERVIEWER_STYLES[session.setup.interviewerStyle]
        ? session.setup.interviewerStyle
        : "emma";
      const style = INTERVIEWER_STYLES[styleKey];

      const newAsked = session.questionsAsked + 1;
      const phase = nextPhase(session.currentPhase as Phase, newAsked, session.targetQuestions) as Phase;
      const isFinalTurn = newAsked > session.targetQuestions;

      const systemPrompt = buildSystemPrompt(
        session.setup,
        isFinalTurn ? "closing" : phase,
        style.persona,
        newAsked - 1,
        session.targetQuestions,
      );

      const recentTranscript = session.transcript.slice(-10).map((t) => ({
        role: (t.role === "interviewer" ? "assistant" : "user") as "assistant" | "user",
        content: t.content,
      }));

      const completion = await getOpenAI().chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          ...recentTranscript,
          { role: "user", content: userText },
        ],
        temperature: 0.65,
        max_tokens: 180,
      });

      const reply = completion.choices[0]?.message?.content?.trim() || "Thank you. Let's move on.";
      const audioBase64 = await tts(reply, style.voice);

      const candidateTurn: InterviewTurn = {
        role: "candidate",
        content: userText,
        timestamp: new Date().toISOString(),
      };
      const interviewerTurn: InterviewTurn = {
        role: "interviewer",
        content: reply,
        timestamp: new Date().toISOString(),
      };

      const newTranscript = [...session.transcript, candidateTurn, interviewerTurn];

      await db
        .update(interviewSessionsTable)
        .set({
          transcript: newTranscript,
          questionsAsked: newAsked,
          currentPhase: isFinalTurn ? "closing" : phase,
          updatedAt: new Date(),
        })
        .where(eq(interviewSessionsTable.id, sessionId));

      return res.json({
        userText,
        reply,
        audioBase64,
        phase: isFinalTurn ? "closing" : phase,
        questionsAsked: newAsked,
        targetQuestions: session.targetQuestions,
        isFinalTurn,
      });
    } catch (err: any) {
      console.error("Interview turn error:", err?.message || err);
      return res.status(500).json({ error: "Mülakat sırasında bir hata oluştu." });
    }
  },
);

// POST /interview/:id/end — finalize, generate report
router.post("/interview/:id/end", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as number;
    const sessionId = parseInt(req.params.id, 10);
    if (!Number.isFinite(sessionId)) return res.status(400).json({ error: "Geçersiz id." });

    const [session] = await db
      .select()
      .from(interviewSessionsTable)
      .where(and(eq(interviewSessionsTable.id, sessionId), eq(interviewSessionsTable.userId, userId)))
      .limit(1);
    if (!session) return res.status(404).json({ error: "Mülakat bulunamadı." });

    // If already completed and report exists, just return it
    if (session.status === "completed" && session.report) {
      return res.json({ report: session.report, session });
    }

    // Build transcript text for the analyzer
    const transcriptText = session.transcript
      .map((t) => `${t.role === "interviewer" ? "Interviewer" : "Candidate"}: ${t.content}`)
      .join("\n");

    const candidateTurns = session.transcript.filter((t) => t.role === "candidate");
    if (candidateTurns.length === 0) {
      return res.status(400).json({ error: "Mülakat raporu için en az bir cevap gereklidir." });
    }

    const analyzerSystem = `You are a senior interviewer + English-language coach producing a structured post-interview report for a Turkish professional who just completed a mock interview in ENGLISH for the role of "${session.setup.targetRole}" (${session.setup.seniority}, ${session.setup.industry} industry).

Analyze the full transcript holistically. Be honest, specific, and constructive. The candidate is non-native; assess BOTH their technical/professional substance AND their English language performance.

Return STRICT JSON (no markdown) matching this schema:
{
  "overallScore": <0-100>,
  "hireRecommendation": "strong_hire" | "hire" | "lean_hire" | "no_hire",
  "hireRecommendationLabel": "<short Turkish phrase>",
  "estimatedCefr": "A1"|"A2"|"B1"|"B2"|"C1"|"C2",
  "cefrConfidence": "low"|"medium"|"high",
  "englishFluencyScore": <0-100>,
  "technicalContentScore": <0-100>,
  "communicationScore": <0-100>,
  "professionalismScore": <0-100>,
  "strongPoints": [{"title":"<Turkish 3-6 words>","detail":"<Turkish 1-2 sentences>"}],
  "weakPoints": [{"title":"<Turkish 3-6 words>","detail":"<Turkish 1-2 sentences>","suggestion":"<Turkish actionable tip>"}],
  "bestAnswers": [
    {
      "question": "<original interviewer question in English>",
      "yourAnswer": "<the candidate's actual answer, lightly trimmed>",
      "modelAnswer": "<a polished native-English model answer, 3-5 sentences, STAR if behavioral>",
      "whyBetter": "<1-2 sentences in Turkish explaining why the model answer is stronger>"
    }
  ],
  "interviewerImpression": "<2-3 sentence Turkish summary in the interviewer's voice>",
  "recommendedPracticeAreas": ["<Turkish, max 5 items>"],
  "nextSteps": ["<Turkish, max 4 concrete actions>"]
}

Rules:
- 3-5 strongPoints, 3-5 weakPoints.
- 2-3 bestAnswers — pick the questions where improvement matters most.
- All visible labels MUST be in Turkish; only modelAnswer / question / yourAnswer / estimatedCefr stay in English.
- If transcript is very short or thin, set cefrConfidence="low" and hireRecommendation="lean_hire" or "no_hire".`;

    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: analyzerSystem },
        {
          role: "user",
          content: `Job description:\n${session.setup.jobDescription || "(not provided)"}\n\nResume context:\n${session.setup.resumeText || "(not provided)"}\n\nFull transcript:\n${transcriptText}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 1800,
      response_format: { type: "json_object" },
    });

    let report: InterviewReport;
    try {
      const raw = completion.choices[0]?.message?.content || "{}";
      report = JSON.parse(raw) as InterviewReport;
    } catch (e: any) {
      console.error("Report JSON parse failed:", e?.message);
      return res.status(500).json({ error: "Rapor oluşturulurken bir hata oluştu." });
    }

    // Sanitize / clamp
    const clamp = (n: any, min = 0, max = 100) => {
      const x = Number(n);
      if (!Number.isFinite(x)) return min;
      return Math.max(min, Math.min(max, Math.round(x)));
    };
    report.overallScore = clamp(report.overallScore);
    report.englishFluencyScore = clamp(report.englishFluencyScore);
    report.technicalContentScore = clamp(report.technicalContentScore);
    report.communicationScore = clamp(report.communicationScore);
    report.professionalismScore = clamp(report.professionalismScore);
    if (!["strong_hire", "hire", "lean_hire", "no_hire"].includes(report.hireRecommendation)) {
      report.hireRecommendation = "lean_hire";
    }
    if (!["A1", "A2", "B1", "B2", "C1", "C2"].includes(report.estimatedCefr)) {
      report.estimatedCefr = "B1";
    }
    if (!["low", "medium", "high"].includes(report.cefrConfidence)) {
      report.cefrConfidence = "medium";
    }
    report.strongPoints = Array.isArray(report.strongPoints) ? report.strongPoints.slice(0, 6) : [];
    report.weakPoints = Array.isArray(report.weakPoints) ? report.weakPoints.slice(0, 6) : [];
    report.bestAnswers = Array.isArray(report.bestAnswers) ? report.bestAnswers.slice(0, 4) : [];
    report.recommendedPracticeAreas = Array.isArray(report.recommendedPracticeAreas)
      ? report.recommendedPracticeAreas.slice(0, 6)
      : [];
    report.nextSteps = Array.isArray(report.nextSteps) ? report.nextSteps.slice(0, 5) : [];

    const durationSec = Math.max(
      0,
      Math.round((Date.now() - new Date(session.startedAt).getTime()) / 1000),
    );

    const [updated] = await db
      .update(interviewSessionsTable)
      .set({
        status: "completed",
        report,
        durationSec,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(interviewSessionsTable.id, sessionId))
      .returning();

    return res.json({ report, session: updated });
  } catch (err: any) {
    console.error("Interview end error:", err?.message || err);
    return res.status(500).json({ error: "Rapor oluşturulamadı." });
  }
});

// GET /interview/sessions — list user's sessions (recent first)
router.get("/interview/sessions", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as number;
    const rows = await db
      .select()
      .from(interviewSessionsTable)
      .where(eq(interviewSessionsTable.userId, userId))
      .orderBy(desc(interviewSessionsTable.createdAt))
      .limit(30);
    return res.json({ sessions: rows });
  } catch (err: any) {
    console.error("List interview sessions error:", err?.message || err);
    return res.status(500).json({ error: "Mülakat geçmişi alınamadı." });
  }
});

// GET /interview/sessions/:id — single session
router.get("/interview/sessions/:id", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as number;
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Geçersiz id." });
    const [row] = await db
      .select()
      .from(interviewSessionsTable)
      .where(and(eq(interviewSessionsTable.id, id), eq(interviewSessionsTable.userId, userId)))
      .limit(1);
    if (!row) return res.status(404).json({ error: "Mülakat bulunamadı." });
    return res.json({ session: row });
  } catch (err: any) {
    console.error("Get interview session error:", err?.message || err);
    return res.status(500).json({ error: "Mülakat alınamadı." });
  }
});

// GET /interview/active — get the user's currently-active interview (resume support)
router.get("/interview/active", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as number;
    const [row] = await db
      .select()
      .from(interviewSessionsTable)
      .where(and(eq(interviewSessionsTable.userId, userId), eq(interviewSessionsTable.status, "active")))
      .orderBy(desc(interviewSessionsTable.createdAt))
      .limit(1);
    if (!row) return res.json({ session: null });
    const styleKey = INTERVIEWER_STYLES[row.setup.interviewerStyle] ? row.setup.interviewerStyle : "emma";
    return res.json({
      session: row,
      interviewerName: INTERVIEWER_STYLES[styleKey].name,
    });
  } catch (err: any) {
    console.error("Get active interview error:", err?.message || err);
    return res.status(500).json({ error: "Aktif mülakat alınamadı." });
  }
});

// POST /interview/:id/abandon — mark active session as abandoned (user chose to start new)
router.post("/interview/:id/abandon", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as number;
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Geçersiz id." });
    const result = await db
      .update(interviewSessionsTable)
      .set({ status: "abandoned", updatedAt: new Date() })
      .where(and(
        eq(interviewSessionsTable.id, id),
        eq(interviewSessionsTable.userId, userId),
        eq(interviewSessionsTable.status, "active"),
      ))
      .returning({ id: interviewSessionsTable.id });
    if (result.length === 0) {
      return res.status(404).json({ error: "İptal edilecek aktif mülakat bulunamadı." });
    }
    return res.json({ ok: true });
  } catch (err: any) {
    console.error("Abandon interview error:", err?.message || err);
    return res.status(500).json({ error: "Mülakat iptal edilemedi." });
  }
});

// GET /interview/coaches — list available interviewer styles
router.get("/interview/coaches", authMiddleware, async (_req: Request, res: Response) => {
  return res.json({
    coaches: Object.entries(INTERVIEWER_STYLES).map(([id, s]) => ({
      id,
      name: s.name,
      voice: s.voice,
      // First sentence only as bio for UI
      bio: s.persona.split(".")[0] + ".",
    })),
  });
});

export default router;
