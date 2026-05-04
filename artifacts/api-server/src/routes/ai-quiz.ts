import { Router, type Request, type Response } from "express";
import OpenAI from "openai";
import { db } from "@workspace/db";
import {
  aiQuizSessionsTable,
  type AIQuizSetup,
  type AIQuizQuestion,
  type AIQuizAnswer,
  type AIQuizReport,
} from "@workspace/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { authMiddleware } from "../middlewares/auth.js";

function clipStr(v: any, max: number): string {
  return String(v ?? "").slice(0, max);
}
function clipArr<T>(v: any, max: number, mapFn: (x: any) => T): T[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, max).map(mapFn);
}

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

const ALL_CATEGORIES = ["vocabulary", "grammar", "comprehension"] as const;
const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// POST /ai-quiz/generate — generate questions
router.post("/ai-quiz/generate", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as number;
    const body = req.body as Partial<AIQuizSetup>;

    const sourceMode: "topic" | "text" = body.sourceMode === "text" ? "text" : "topic";
    const topic = body.topic ? String(body.topic).slice(0, 200).trim() : "";
    const sourceText = body.sourceText ? String(body.sourceText).slice(0, 8000).trim() : "";
    if (sourceMode === "topic" && !topic) {
      return res.status(400).json({ error: "Lütfen bir konu girin." });
    }
    if (sourceMode === "text" && (!sourceText || sourceText.length < 80)) {
      return res.status(400).json({ error: "Lütfen en az 80 karakterlik bir metin yapıştırın." });
    }

    const level = (CEFR_LEVELS as readonly string[]).includes(body.level as string)
      ? (body.level as AIQuizSetup["level"])
      : "B1";
    const numQuestions = Math.min(20, Math.max(4, Number(body.numQuestions) || 8));
    const categoriesRaw = Array.isArray(body.categories) ? body.categories : ["mixed"];
    const categories = (categoriesRaw.length === 0
      ? [...ALL_CATEGORIES]
      : (categoriesRaw.filter((c) => (ALL_CATEGORIES as readonly string[]).includes(c as string)) as AIQuizSetup["categories"])
    );
    const finalCategories = categories.length > 0 ? categories : [...ALL_CATEGORIES];

    const setup: AIQuizSetup = {
      sourceMode,
      topic: sourceMode === "topic" ? topic : undefined,
      sourceText: sourceMode === "text" ? sourceText : undefined,
      level,
      numQuestions,
      categories: finalCategories,
    };

    const sourceLabel = sourceMode === "topic" ? `the topic "${topic}"` : `the following English text`;
    const sourceForPrompt = sourceMode === "text"
      ? `\n\nSOURCE TEXT (use this as the basis for comprehension questions):\n"""${sourceText}"""\n`
      : "";

    const systemPrompt = `You are an expert English-language assessment designer creating a quiz for a Turkish learner at CEFR level ${level}.

Generate exactly ${numQuestions} high-quality questions about ${sourceLabel}. The selected categories are: ${finalCategories.join(", ")}.

QUESTION DESIGN RULES:
- Distribute questions roughly evenly across the selected categories.
- Use a mix of: "multiple_choice" (4 options), "true_false" (2 options: True/False), "fill_blank" (single short answer).
- "vocabulary" questions test word meaning, collocations, synonyms, or usage in context.
- "grammar" questions test verb forms, tenses, articles, prepositions, conditionals, modals, etc. appropriate for ${level}.
- "comprehension" questions test understanding of the source ${sourceMode === "text" ? "text" : "topic"} (inference, main idea, detail, vocabulary in context).
- Calibrate difficulty strictly to ${level}. ${level === "A1" || level === "A2" ? "Use very simple language and short questions." : level === "B1" || level === "B2" ? "Use natural intermediate-level language." : "Use sophisticated, nuanced language."}
- For fill_blank: correctAnswer must be a single word or short phrase (max 4 words). Be lenient — list the most obvious answer.
- All explanations are MANDATORY: explanationEn (1-2 sentences in English) AND explanationTr (1-2 sentences in Turkish).

Return STRICT JSON (no markdown), this exact schema:
{
  "title": "<short Turkish quiz title 4-8 words>",
  "questions": [
    {
      "id": "q1",
      "type": "multiple_choice" | "true_false" | "fill_blank",
      "category": "vocabulary" | "grammar" | "comprehension",
      "prompt": "<the question text in English>",
      "context": "<optional 1-sentence context/excerpt in English, may be omitted>",
      "options": ["<4 options for mc, 2 for true_false>"] (omit for fill_blank),
      "correctAnswer": "<exact correct option text, or 'True'/'False', or fill-blank word>",
      "explanationEn": "<English explanation>",
      "explanationTr": "<Turkish explanation>"
    }
  ]
}

Rules:
- IDs must be q1..qN sequential.
- correctAnswer for multiple_choice MUST exactly match one of the options (case-sensitive).
- For true_false, options must be exactly ["True","False"] and correctAnswer one of them.
- For fill_blank, omit options.${sourceForPrompt}`;

    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Generate the quiz now.` },
      ],
      temperature: 0.5,
      max_tokens: 4000,
      response_format: { type: "json_object" },
    });

    let parsed: { title: string; questions: AIQuizQuestion[] };
    try {
      parsed = JSON.parse(completion.choices[0]?.message?.content || "{}");
    } catch {
      return res.status(500).json({ error: "Quiz oluşturulurken bir hata oluştu (parse)." });
    }
    const rawQuestions = Array.isArray(parsed.questions) ? parsed.questions : [];
    if (rawQuestions.length === 0) {
      return res.status(500).json({ error: "Quiz oluşturulamadı, lütfen farklı bir kaynak deneyin." });
    }

    // Validate, shuffle options for MC, normalize
    const validated: AIQuizQuestion[] = [];
    for (let i = 0; i < rawQuestions.length; i++) {
      const q = rawQuestions[i];
      if (!q || typeof q.prompt !== "string" || typeof q.correctAnswer !== "string") continue;
      const type: AIQuizQuestion["type"] = ["multiple_choice", "true_false", "fill_blank"].includes(q.type as string)
        ? (q.type as AIQuizQuestion["type"])
        : "multiple_choice";
      const category = (["vocabulary", "grammar", "comprehension"].includes(q.category as string)
        ? q.category
        : "vocabulary") as AIQuizQuestion["category"];

      let options: string[] | undefined;
      if (type === "multiple_choice") {
        options = Array.isArray(q.options) ? q.options.filter((o) => typeof o === "string").slice(0, 6) : [];
        if (!options.includes(q.correctAnswer)) {
          // ensure correct answer is among options
          options = [q.correctAnswer, ...options].slice(0, 4);
        }
        options = shuffle(options);
      } else if (type === "true_false") {
        options = ["True", "False"];
        if (!options.includes(q.correctAnswer)) continue; // skip invalid
      }

      const promptStr = clipStr(q.prompt, 800);
      const correctStr = clipStr(q.correctAnswer, 300);
      if (!promptStr || !correctStr) continue;

      validated.push({
        id: `q${validated.length + 1}`,
        type,
        category,
        prompt: promptStr,
        context: q.context ? clipStr(q.context, 1500) : undefined,
        options: options ? options.map((o) => clipStr(o, 300)) : undefined,
        correctAnswer: correctStr,
        explanationEn: clipStr(q.explanationEn, 600),
        explanationTr: clipStr(q.explanationTr, 600),
      });
    }
    if (validated.length === 0) {
      return res.status(500).json({ error: "Quiz oluşturulamadı, lütfen tekrar deneyin." });
    }

    const title = (parsed.title || (sourceMode === "topic" ? `${topic} Quiz` : "Özel Quiz")).slice(0, 200);

    const [session] = await db
      .insert(aiQuizSessionsTable)
      .values({
        userId,
        title,
        status: "ready",
        setup,
        questions: validated,
        answers: [],
      })
      .returning();

    // Strip correctAnswer & explanations from response (don't leak before submission)
    const safeQuestions = validated.map((q) => ({
      id: q.id,
      type: q.type,
      category: q.category,
      prompt: q.prompt,
      context: q.context,
      options: q.options,
    }));

    return res.json({
      sessionId: session.id,
      title,
      setup,
      questions: safeQuestions,
    });
  } catch (err: any) {
    console.error("AI quiz generate error:", err?.message || err);
    return res.status(500).json({ error: "Quiz oluşturulurken bir hata oluştu." });
  }
});

// POST /ai-quiz/:id/submit — submit answers, return graded report with explanations
router.post("/ai-quiz/:id/submit", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as number;
    const sessionId = parseInt(req.params.id, 10);
    if (!Number.isFinite(sessionId)) return res.status(400).json({ error: "Geçersiz id." });

    const [session] = await db
      .select()
      .from(aiQuizSessionsTable)
      .where(and(eq(aiQuizSessionsTable.id, sessionId), eq(aiQuizSessionsTable.userId, userId)))
      .limit(1);
    if (!session) return res.status(404).json({ error: "Quiz bulunamadı." });
    if (session.status === "submitted" && session.report) {
      return res.json({ report: session.report, questions: session.questions, answers: session.answers });
    }

    const body = req.body as { answers?: Array<{ questionId: string; userAnswer: string }>; timeTakenSec?: number };
    const submittedAnswers = Array.isArray(body.answers) ? body.answers : [];

    const answers: AIQuizAnswer[] = [];
    let correct = 0;
    const byCategory: Record<string, { correct: number; total: number }> = {};

    for (const q of session.questions) {
      const sub = submittedAnswers.find((a) => a.questionId === q.id);
      const userAnswer = sub ? String(sub.userAnswer || "").trim() : "";
      let isCorrect = false;
      if (q.type === "fill_blank") {
        isCorrect = userAnswer.toLowerCase() === q.correctAnswer.trim().toLowerCase();
      } else {
        isCorrect = userAnswer.toLowerCase() === q.correctAnswer.trim().toLowerCase();
      }
      if (isCorrect) correct++;
      answers.push({ questionId: q.id, userAnswer, isCorrect });
      if (!byCategory[q.category]) byCategory[q.category] = { correct: 0, total: 0 };
      byCategory[q.category].total++;
      if (isCorrect) byCategory[q.category].correct++;
    }

    const total = session.questions.length;
    const percent = Math.round((correct / Math.max(1, total)) * 100);
    const passed = percent >= 70;

    // Generate weak areas + study plan via AI based on missed questions
    const missedQs = session.questions
      .filter((q) => {
        const a = answers.find((x) => x.questionId === q.id);
        return !a || !a.isCorrect;
      })
      .slice(0, 8);

    let report: AIQuizReport;
    if (missedQs.length === 0) {
      // Perfect — minimal AI call
      report = {
        scoreCorrect: correct,
        scoreTotal: total,
        scorePercent: percent,
        passed: true,
        estimatedCefrFit: session.setup.level,
        cefrConfidence: "high",
        byCategory,
        weakAreas: [],
        studyPlan: [
          "Bir üst seviyede (CEFR) yeni bir quiz dene.",
          "Bu konuda kelime dağarcığını derinleştirmek için 1 makale oku.",
          "Telaffuz Koçu'nda aynı konuda 5 dakika konuş.",
        ],
        encouragement: "Mükemmel performans! Bir sonraki seviyeye geçmenin tam zamanı.",
      };
    } else {
      const analyzerSystem = `You are a Turkish English tutor analyzing a learner's quiz performance.

Quiz: "${session.title}" | Level: ${session.setup.level} | Score: ${correct}/${total} (${percent}%)

For each MISSED question, you'll see: question + their answer + correct answer + category.
Identify 2-4 thematic weak areas (Turkish), suggest 3-5 concrete study plan items (Turkish), and write a short encouraging Turkish message.

Return STRICT JSON:
{
  "weakAreas": [{"area":"<Turkish 3-6 words>","detail":"<Turkish 1-2 sentences>","suggestion":"<Turkish actionable tip>"}],
  "studyPlan": ["<Turkish item>"],
  "encouragement": "<2-3 sentence Turkish>",
  "estimatedCefrFit": "A1"|"A2"|"B1"|"B2"|"C1"|"C2",
  "cefrConfidence": "low"|"medium"|"high"
}

Tone: kind, professional, specific. No fluff.`;

      const userMsg = missedQs
        .map((q, i) => {
          const a = answers.find((x) => x.questionId === q.id);
          return `${i + 1}. [${q.category}] Q: ${q.prompt}\n   Their answer: ${a?.userAnswer || "(blank)"}\n   Correct: ${q.correctAnswer}`;
        })
        .join("\n\n");

      const completion = await getOpenAI().chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: analyzerSystem },
          { role: "user", content: userMsg },
        ],
        temperature: 0.4,
        max_tokens: 900,
        response_format: { type: "json_object" },
      });

      let analyzed: Partial<AIQuizReport> = {};
      try {
        analyzed = JSON.parse(completion.choices[0]?.message?.content || "{}");
      } catch {
        analyzed = {};
      }

      const validCefr = (CEFR_LEVELS as readonly string[]).includes(analyzed.estimatedCefrFit as string)
        ? (analyzed.estimatedCefrFit as string)
        : session.setup.level;
      const validConf = (["low", "medium", "high"].includes(analyzed.cefrConfidence as string)
        ? (analyzed.cefrConfidence as "low" | "medium" | "high")
        : "medium");

      report = {
        scoreCorrect: correct,
        scoreTotal: total,
        scorePercent: percent,
        passed,
        estimatedCefrFit: validCefr,
        cefrConfidence: validConf,
        byCategory,
        weakAreas: clipArr(analyzed.weakAreas, 6, (w: any) => ({
          area: clipStr(w?.area, 120),
          detail: clipStr(w?.detail, 400),
          suggestion: clipStr(w?.suggestion, 300),
        })).filter((w) => w.area.length > 0),
        studyPlan: clipArr(analyzed.studyPlan, 6, (s: any) => clipStr(s, 250)).filter((s) => s.length > 0),
        encouragement: clipStr(analyzed.encouragement, 500) || (passed ? "Güzel iş, devam et!" : "Pes etme, hatalar öğrenmenin parçası."),
      };
    }

    const [updated] = await db
      .update(aiQuizSessionsTable)
      .set({
        status: "submitted",
        answers,
        report,
        timeTakenSec: Math.max(0, Number(body.timeTakenSec) || 0),
        submittedAt: new Date(),
      })
      .where(eq(aiQuizSessionsTable.id, sessionId))
      .returning();

    return res.json({ report, questions: updated.questions, answers: updated.answers });
  } catch (err: any) {
    console.error("AI quiz submit error:", err?.message || err);
    return res.status(500).json({ error: "Quiz değerlendirilirken bir hata oluştu." });
  }
});

// GET /ai-quiz/sessions — list user's sessions
router.get("/ai-quiz/sessions", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as number;
    const rows = await db
      .select({
        id: aiQuizSessionsTable.id,
        title: aiQuizSessionsTable.title,
        status: aiQuizSessionsTable.status,
        setup: aiQuizSessionsTable.setup,
        report: aiQuizSessionsTable.report,
        createdAt: aiQuizSessionsTable.createdAt,
        submittedAt: aiQuizSessionsTable.submittedAt,
        timeTakenSec: aiQuizSessionsTable.timeTakenSec,
      })
      .from(aiQuizSessionsTable)
      .where(eq(aiQuizSessionsTable.userId, userId))
      .orderBy(desc(aiQuizSessionsTable.createdAt))
      .limit(40);
    return res.json({ sessions: rows });
  } catch (err: any) {
    console.error("List ai-quiz sessions error:", err?.message || err);
    return res.status(500).json({ error: "Quiz geçmişi alınamadı." });
  }
});

// GET /ai-quiz/sessions/:id — single session (with full data)
router.get("/ai-quiz/sessions/:id", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as number;
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Geçersiz id." });
    const [row] = await db
      .select()
      .from(aiQuizSessionsTable)
      .where(and(eq(aiQuizSessionsTable.id, id), eq(aiQuizSessionsTable.userId, userId)))
      .limit(1);
    if (!row) return res.status(404).json({ error: "Quiz bulunamadı." });
    // If not submitted, hide correct answers
    if (row.status !== "submitted") {
      return res.json({
        session: {
          ...row,
          questions: row.questions.map((q) => ({
            id: q.id, type: q.type, category: q.category,
            prompt: q.prompt, context: q.context, options: q.options,
          })),
        },
      });
    }
    return res.json({ session: row });
  } catch (err: any) {
    console.error("Get ai-quiz session error:", err?.message || err);
    return res.status(500).json({ error: "Quiz alınamadı." });
  }
});

// GET /ai-quiz/active — last unsubmitted ("ready") quiz the user can resume
router.get("/ai-quiz/active", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as number;
    const [row] = await db
      .select()
      .from(aiQuizSessionsTable)
      .where(and(eq(aiQuizSessionsTable.userId, userId), eq(aiQuizSessionsTable.status, "ready")))
      .orderBy(desc(aiQuizSessionsTable.createdAt))
      .limit(1);
    if (!row) return res.json({ session: null });
    // Strip correct answers — same shape as generate response
    const safeQuestions = row.questions.map((q) => ({
      id: q.id, type: q.type, category: q.category,
      prompt: q.prompt, context: q.context, options: q.options,
    }));
    return res.json({
      session: {
        id: row.id,
        title: row.title,
        setup: row.setup,
        questions: safeQuestions,
        createdAt: row.createdAt,
      },
    });
  } catch (err: any) {
    console.error("Get active ai-quiz error:", err?.message || err);
    return res.status(500).json({ error: "Aktif quiz alınamadı." });
  }
});

// POST /ai-quiz/:id/abandon — discard an unfinished quiz
router.post("/ai-quiz/:id/abandon", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as number;
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Geçersiz id." });
    const result = await db
      .update(aiQuizSessionsTable)
      .set({ status: "abandoned" })
      .where(and(
        eq(aiQuizSessionsTable.id, id),
        eq(aiQuizSessionsTable.userId, userId),
        eq(aiQuizSessionsTable.status, "ready"),
      ))
      .returning({ id: aiQuizSessionsTable.id });
    if (result.length === 0) {
      return res.status(404).json({ error: "İptal edilecek bekleyen quiz bulunamadı." });
    }
    return res.json({ ok: true });
  } catch (err: any) {
    console.error("Abandon ai-quiz error:", err?.message || err);
    return res.status(500).json({ error: "Quiz iptal edilemedi." });
  }
});

export default router;
