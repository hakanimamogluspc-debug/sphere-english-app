import { Router, type Request, type Response } from "express";
import OpenAI from "openai";
import { db } from "@workspace/db";
import {
  learningPathsTable,
  pronunciationAssessmentsTable,
  interviewSessionsTable,
  presentationSessionsTable,
  aiQuizSessionsTable,
  aiTutorMemoryTable,
  usersTable,
  type LearningPathPlan,
  type LearningPathStep,
} from "@workspace/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { authMiddleware } from "../middlewares/auth.js";
import { awardPoints } from "../lib/points.js";
import { randomUUID } from "crypto";

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

const FEATURE_CATALOG: Array<{ link: string; label: string; categories: string[] }> = [
  { link: "/student/pronunciation", label: "Telaffuz Koçu", categories: ["speaking", "listening"] },
  { link: "/student/grammar-coach", label: "Dilbilgisi Koçu", categories: ["grammar"] },
  { link: "/student/writing-coach", label: "Yazma Koçu", categories: ["writing"] },
  { link: "/student/vocab-game", label: "Kelime Oyunu", categories: ["vocabulary"] },
  { link: "/student/simulation-mode", label: "İş Senaryoları", categories: ["speaking", "exam_prep"] },
  { link: "/student/interview-sim", label: "Mülakat Simülatörü", categories: ["speaking", "exam_prep"] },
  { link: "/student/presentation-sim", label: "Sunum Simülatörü", categories: ["speaking"] },
  { link: "/student/ai-quiz", label: "Akıllı Quiz Üretici", categories: ["vocabulary", "grammar", "reading", "exam_prep"] },
  { link: "/student/ai-tutor", label: "Kişisel AI Öğretmen", categories: ["grammar", "vocabulary", "speaking", "writing", "reading", "exam_prep"] },
];

async function gatherUserSnapshot(userId: number) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);

  // Pronunciation: last 5
  const pronunciations = await db
    .select()
    .from(pronunciationAssessmentsTable)
    .where(eq(pronunciationAssessmentsTable.userId, userId))
    .orderBy(desc(pronunciationAssessmentsTable.createdAt))
    .limit(5)
    .catch(() => []);

  // Interview: last 3 with reports
  const interviews = await db
    .select()
    .from(interviewSessionsTable)
    .where(eq(interviewSessionsTable.userId, userId))
    .orderBy(desc(interviewSessionsTable.startedAt))
    .limit(3)
    .catch(() => []);

  // Presentations: last 3
  const presentations = await db
    .select()
    .from(presentationSessionsTable)
    .where(eq(presentationSessionsTable.userId, userId))
    .orderBy(desc(presentationSessionsTable.startedAt))
    .limit(3)
    .catch(() => []);

  // Quizzes: last 5
  const quizzes = await db
    .select()
    .from(aiQuizSessionsTable)
    .where(eq(aiQuizSessionsTable.userId, userId))
    .orderBy(desc(aiQuizSessionsTable.createdAt))
    .limit(5)
    .catch(() => []);

  // Tutor memory
  const [memory] = await db
    .select()
    .from(aiTutorMemoryTable)
    .where(eq(aiTutorMemoryTable.userId, userId))
    .limit(1)
    .catch(() => [null as any]);

  return { user, pronunciations, interviews, presentations, quizzes, memory };
}

function summarizeForPrompt(snapshot: Awaited<ReturnType<typeof gatherUserSnapshot>>): string {
  const u: any = snapshot.user || {};
  const lines: string[] = [];
  lines.push(`Student: ${u.fullName || u.email || "(unknown)"} | CEFR: ${u.cefrLevel || "unknown"} | role: ${u.role}`);

  if (snapshot.pronunciations.length > 0) {
    lines.push(`\nLast pronunciation assessments:`);
    for (const a of snapshot.pronunciations.slice(0, 3) as any[]) {
      const r = a.report || {};
      lines.push(`  - ${r.estimatedCefr || "?"} | overall ${r.overallScore ?? "?"} | weak: ${(r.weakAreas || []).map((w: any) => w.title).slice(0, 3).join(", ")}`);
    }
  } else {
    lines.push(`\nNo pronunciation history yet.`);
  }

  if (snapshot.interviews.length > 0) {
    lines.push(`\nLast interview sessions:`);
    for (const s of snapshot.interviews.slice(0, 2) as any[]) {
      const r = s.report || {};
      lines.push(`  - ${s.setup?.role || ""} interview | overall ${r.overallScore ?? "n/a"} | weak: ${(r.weakPoints || []).map((w: any) => w.title).slice(0, 2).join(", ")}`);
    }
  }

  if (snapshot.presentations.length > 0) {
    lines.push(`\nLast presentations:`);
    for (const s of snapshot.presentations.slice(0, 2) as any[]) {
      const r = s.report || {};
      lines.push(`  - "${s.setup?.topic || ""}" | overall ${r.overallScore ?? "n/a"} | structure ${r.structureScore ?? "?"} clarity ${r.clarityScore ?? "?"} qa ${r.qaHandlingScore ?? "?"}`);
    }
  }

  if (snapshot.quizzes.length > 0) {
    lines.push(`\nLast AI quizzes:`);
    for (const q of snapshot.quizzes.slice(0, 4) as any[]) {
      const r = q.report || {};
      lines.push(`  - "${q.title}" L${q.setup?.level} | ${r.scoreCorrect ?? "?"}/${r.scoreTotal ?? "?"} (${r.scorePercent ?? "?"}%) | weak: ${(r.weakAreas || []).map((w: any) => w.area).slice(0, 2).join(", ")}`);
    }
  }

  if (snapshot.memory && Array.isArray(snapshot.memory.facts) && snapshot.memory.facts.length > 0) {
    lines.push(`\nPersistent facts (from tutor memory):`);
    for (const f of snapshot.memory.facts) {
      lines.push(`  - [${f.category}] ${f.fact}`);
    }
  }

  return lines.join("\n");
}

// POST /learning-path/generate — generate (or regenerate) the active plan
router.post("/learning-path/generate", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as number;
    const focusOverrideTr = String(req.body?.focusTr || "").slice(0, 200).trim();

    const snapshot = await gatherUserSnapshot(userId);
    const summary = summarizeForPrompt(snapshot);
    const cefr = (snapshot.user as any)?.cefrLevel || "B1";

    const featureCatalogStr = FEATURE_CATALOG.map((f) => `  - "${f.link}" ${f.label} (${f.categories.join("/")})`).join("\n");

    const sys = `You are a senior English curriculum designer at Sphere English LMS, building a 4-week, hyper-personalized English learning plan for a Turkish student.

YOUR INPUTS:
${summary}

${focusOverrideTr ? `EXTRA FOCUS REQUEST FROM STUDENT: "${focusOverrideTr}"` : ""}

AVAILABLE IN-APP FEATURES (you may link to these):
${featureCatalogStr}

YOUR TASK:
Design a 4-week plan with 4-5 weekly steps (so 16-20 total steps). Each step is a single, doable session (~20-45 min).

Plan rules:
- Address the student's documented weaknesses first; don't waste time on what they already master.
- Mix categories: speaking, vocabulary, grammar, listening, reading, writing, exam_prep, review.
- Each week should have a coherent theme.
- Use the in-app features liberally — most steps should link to one. Some "review" or "reading" steps can have featureLink null (e.g. read article externally).
- Calibrate to their CEFR (${cefr}). Don't make it too easy or too hard.
- All Turkish strings must be natural Turkish (not translated English).
- Day labels in Turkish: Pazartesi, Salı, Çarşamba, Perşembe, Cuma, Cumartesi, Pazar.
- Spread steps across days; you can put 1 step per day, 2-3 a week is fine for busy weeks.

Return STRICT JSON (no markdown):
{
  "overallGoalTr": "<1 sentence Turkish: the student's goal>",
  "cefrTarget": "<short Turkish: 'B2 seviyesine geçiş' or similar>",
  "generationContextTr": "<1-2 Turkish sentences: why this plan was built for THEM, citing 1-2 specific weaknesses>",
  "weeklySummaries": [
    { "weekNumber": 1, "themeTr": "<short Turkish theme>", "goalTr": "<1 sentence Turkish week goal>" },
    ... 4 weeks total
  ],
  "steps": [
    {
      "weekNumber": 1,
      "dayLabel": "Pazartesi",
      "titleTr": "<short Turkish title>",
      "descriptionTr": "<2-3 Turkish sentences: what to do>",
      "estimatedMinutes": 30,
      "category": "speaking" | "vocabulary" | "grammar" | "listening" | "writing" | "reading" | "exam_prep" | "review",
      "featureLink": "/student/vocab-game" | null,
      "featureLabel": "Kelime Oyunu" | null,
      "rationaleTr": "<1 Turkish sentence: why THIS for THEM>"
    }
  ],
  "recommendationsTr": ["<3-5 short Turkish reminders/habits>"]
}`;

    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: sys },
        { role: "user", content: "Generate the personalized 4-week plan now." },
      ],
      temperature: 0.5,
      max_tokens: 2500,
      response_format: { type: "json_object" },
    });

    let parsed: Partial<LearningPathPlan>;
    try {
      parsed = JSON.parse(completion.choices[0]?.message?.content || "{}");
    } catch {
      return res.status(500).json({ error: "Plan oluşturulamadı (parse)." });
    }

    if (!Array.isArray(parsed.steps) || parsed.steps.length === 0) {
      return res.status(500).json({ error: "Plan oluşturulamadı, lütfen tekrar dene." });
    }

    // Normalize / validate steps
    const validCategories = ["vocabulary", "grammar", "speaking", "listening", "writing", "reading", "exam_prep", "review"];
    const validLinks = new Set(FEATURE_CATALOG.map((f) => f.link));
    const linkLabel = new Map(FEATURE_CATALOG.map((f) => [f.link, f.label]));

    const steps: LearningPathStep[] = (parsed.steps as any[])
      .map((s) => {
        const cat = validCategories.includes(s.category) ? s.category : "review";
        let link = s.featureLink || null;
        if (link && !validLinks.has(link)) link = null;
        const label = link ? (linkLabel.get(link) || s.featureLabel || null) : null;
        return {
          id: randomUUID(),
          weekNumber: Math.max(1, Math.min(4, Number(s.weekNumber) || 1)),
          dayLabel: String(s.dayLabel || "Pazartesi").slice(0, 20),
          titleTr: String(s.titleTr || "").slice(0, 200),
          descriptionTr: String(s.descriptionTr || "").slice(0, 800),
          estimatedMinutes: Math.max(5, Math.min(120, Number(s.estimatedMinutes) || 30)),
          category: cat,
          featureLink: link,
          featureLabel: label,
          rationaleTr: String(s.rationaleTr || "").slice(0, 300),
          isCompleted: false,
          completedAt: null,
        };
      })
      .filter((s) => s.titleTr.length > 0);

    if (steps.length === 0) {
      return res.status(500).json({ error: "Plan adımları oluşturulamadı." });
    }

    // Sort by week then day order
    const dayOrder: Record<string, number> = {
      Pazartesi: 1, Salı: 2, Çarşamba: 3, Perşembe: 4, Cuma: 5, Cumartesi: 6, Pazar: 7,
    };
    steps.sort((a, b) => a.weekNumber - b.weekNumber || (dayOrder[a.dayLabel] || 8) - (dayOrder[b.dayLabel] || 8));

    const weeklySummaries = Array.isArray(parsed.weeklySummaries)
      ? (parsed.weeklySummaries as any[]).slice(0, 4).map((w, i) => ({
          weekNumber: Number(w.weekNumber) || i + 1,
          themeTr: String(w.themeTr || "").slice(0, 200),
          goalTr: String(w.goalTr || "").slice(0, 300),
        }))
      : [];

    const plan: LearningPathPlan = {
      overallGoalTr: String(parsed.overallGoalTr || "").slice(0, 300),
      cefrTarget: String(parsed.cefrTarget || cefr).slice(0, 60),
      weeklySummaries,
      steps,
      recommendationsTr: Array.isArray(parsed.recommendationsTr)
        ? (parsed.recommendationsTr as any[]).map((r) => String(r).slice(0, 200)).slice(0, 6)
        : [],
      generationContextTr: String(parsed.generationContextTr || "").slice(0, 500),
    };

    // Deactivate previous active plans for this user
    await db
      .update(learningPathsTable)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(learningPathsTable.userId, userId), eq(learningPathsTable.isActive, true)));

    const [created] = await db
      .insert(learningPathsTable)
      .values({
        userId,
        cefrAtGeneration: cefr,
        isActive: true,
        plan,
        progress: {},
      })
      .returning();

    return res.json({ path: created });
  } catch (err: any) {
    console.error("Generate learning path error:", err?.message || err);
    return res.status(500).json({ error: "Plan oluşturulurken bir hata oluştu." });
  }
});

// GET /learning-path/current — get the active plan
router.get("/learning-path/current", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as number;
    const [path] = await db
      .select()
      .from(learningPathsTable)
      .where(and(eq(learningPathsTable.userId, userId), eq(learningPathsTable.isActive, true)))
      .orderBy(desc(learningPathsTable.createdAt))
      .limit(1);
    if (!path) return res.json({ path: null });
    // Apply progress to steps
    const stepsWithProgress = path.plan.steps.map((s) => {
      const p = (path.progress as any)[s.id];
      if (p) return { ...s, isCompleted: !!p.isCompleted, completedAt: p.completedAt || null };
      return s;
    });
    return res.json({
      path: {
        ...path,
        plan: { ...path.plan, steps: stepsWithProgress },
      },
    });
  } catch (err: any) {
    console.error("Get learning path error:", err?.message || err);
    return res.status(500).json({ error: "Plan alınamadı." });
  }
});

// POST /learning-path/:id/step/:stepId/toggle
router.post("/learning-path/:id/step/:stepId/toggle", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as number;
    const id = parseInt(req.params.id, 10);
    const stepId = String(req.params.stepId);
    // Adım tamamlama sadece "checked" iken puan (bir kereye mahsus)
    if (req.body?.checked === true) {
      awardPoints(userId, "learning_path_step", { onceEverForRef: true, refId: `${id}:${stepId}`, silent: true }).catch(() => {});
    }
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Geçersiz id." });

    const [path] = await db
      .select()
      .from(learningPathsTable)
      .where(and(eq(learningPathsTable.id, id), eq(learningPathsTable.userId, userId)))
      .limit(1);
    if (!path) return res.status(404).json({ error: "Plan bulunamadı." });

    const stepExists = path.plan.steps.some((s) => s.id === stepId);
    if (!stepExists) return res.status(404).json({ error: "Adım bulunamadı." });

    const progress = { ...(path.progress as any) };
    const cur = progress[stepId];
    if (cur && cur.isCompleted) {
      delete progress[stepId];
    } else {
      progress[stepId] = { isCompleted: true, completedAt: new Date().toISOString() };
    }

    const [updated] = await db
      .update(learningPathsTable)
      .set({ progress, updatedAt: new Date() })
      .where(eq(learningPathsTable.id, id))
      .returning();

    const stepsWithProgress = updated.plan.steps.map((s) => {
      const p = (updated.progress as any)[s.id];
      if (p) return { ...s, isCompleted: !!p.isCompleted, completedAt: p.completedAt || null };
      return s;
    });

    return res.json({
      path: { ...updated, plan: { ...updated.plan, steps: stepsWithProgress } },
    });
  } catch (err: any) {
    console.error("Toggle step error:", err?.message || err);
    return res.status(500).json({ error: "Adım güncellenemedi." });
  }
});

export default router;
