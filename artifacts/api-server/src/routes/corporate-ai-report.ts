import { Router, type Request, type Response } from "express";
import OpenAI from "openai";
import { db } from "@workspace/db";
import {
  usersTable,
  companiesTable,
  pronunciationAssessmentsTable,
  interviewSessionsTable,
  presentationSessionsTable,
  aiQuizSessionsTable,
  aiTutorConversationsTable,
  learningPathsTable,
} from "@workspace/db/schema";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { authMiddleware } from "../middlewares/auth.js";

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

const CEFR_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"];

interface AggregatedReport {
  company: { id: number; name: string; companyTitle: string | null };
  generatedAt: string;
  cohort: {
    total: number;
    activeLast7d: number;
    activeLast30d: number;
    avgStreak: number;
    avgTotalPoints: number;
    cefrDistribution: Record<string, number>;
    avgCefrLabel: string;
  };
  activity: {
    pronunciationCount: number;
    interviewCount: number;
    presentationCount: number;
    quizCount: number;
    tutorConvos: number;
    learningPaths: number;
  };
  averages: {
    pronunciation: number | null;
    interview: number | null;
    presentation: number | null;
    quiz: number | null;
  };
  topPerformers: Array<{
    id: number;
    fullName: string;
    cefr: string | null;
    totalPoints: number;
    streak: number;
    score: number;
  }>;
  topWeakAreas: Array<{ area: string; mentions: number }>;
  ai: {
    executiveSummaryTr: string;
    bulletInsightsTr: string[];
    recommendationsForManagerTr: string[];
  } | null;
}

function avg(arr: number[]): number | null {
  if (!arr.length) return null;
  return Math.round((arr.reduce((s, x) => s + x, 0) / arr.length) * 10) / 10;
}

function cefrIndexAvg(cefrs: string[]): string {
  const idxs = cefrs
    .map((c) => CEFR_ORDER.indexOf((c || "").toUpperCase()))
    .filter((i) => i >= 0);
  if (!idxs.length) return "—";
  const a = idxs.reduce((s, x) => s + x, 0) / idxs.length;
  return CEFR_ORDER[Math.round(a)] || "—";
}

router.get("/corporate/ai-performance-report", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as number;
    const [me] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!me) return res.status(401).json({ error: "Yetkisiz." });

    let companyId: number | null = null;
    if (me.role === "corporate") {
      companyId = (me as any).companyId || null;
    } else if (me.role === "admin") {
      const queryCompanyId = req.query.companyId ? parseInt(String(req.query.companyId), 10) : null;
      companyId = Number.isFinite(queryCompanyId as any) ? (queryCompanyId as number) : ((me as any).companyId || null);
      if (!companyId) {
        return res.status(400).json({ error: "Admin için companyId query parametresi gerekli." });
      }
    } else {
      return res.status(403).json({ error: "Bu rapor sadece kurum yetkilileri ve adminler içindir." });
    }

    if (!companyId) {
      return res.status(400).json({ error: "Hesabına atanmış bir şirket bulunamadı." });
    }

    const [company] = await db.select().from(companiesTable).where(eq(companiesTable.id, companyId)).limit(1);
    if (!company) return res.status(404).json({ error: "Şirket bulunamadı." });

    // Cohort: students of this company
    const cohort = await db
      .select()
      .from(usersTable)
      .where(and(eq(usersTable.companyId, companyId), eq(usersTable.role, "student")));

    if (cohort.length === 0) {
      return res.json({
        report: {
          company: { id: company.id, name: company.name, companyTitle: (company as any).companyTitle || null },
          generatedAt: new Date().toISOString(),
          cohort: { total: 0, activeLast7d: 0, activeLast30d: 0, avgStreak: 0, avgTotalPoints: 0, cefrDistribution: {}, avgCefrLabel: "—" },
          activity: { pronunciationCount: 0, interviewCount: 0, presentationCount: 0, quizCount: 0, tutorConvos: 0, learningPaths: 0 },
          averages: { pronunciation: null, interview: null, presentation: null, quiz: null },
          topPerformers: [],
          topWeakAreas: [],
          ai: null,
        } as AggregatedReport,
      });
    }

    const cohortIds = cohort.map((u) => u.id);
    const now = Date.now();
    const day7 = new Date(now - 7 * 24 * 3600 * 1000);
    const day30 = new Date(now - 30 * 24 * 3600 * 1000);

    const lastActiveDate = (u: any): Date | null => {
      const d = u.lastActiveDate || u.updatedAt;
      if (!d) return null;
      const dt = new Date(d);
      return Number.isFinite(dt.getTime()) ? dt : null;
    };

    let activeLast7d = 0;
    let activeLast30d = 0;
    const streaks: number[] = [];
    const points: number[] = [];
    const cefrDistribution: Record<string, number> = {};
    const cefrs: string[] = [];

    for (const u of cohort as any[]) {
      const la = lastActiveDate(u);
      if (la && la >= day7) activeLast7d++;
      if (la && la >= day30) activeLast30d++;
      streaks.push(u.streak || 0);
      points.push(u.totalPoints || 0);
      const cefr = (u.currentLevel || "").toUpperCase();
      if (cefr) {
        cefrDistribution[cefr] = (cefrDistribution[cefr] || 0) + 1;
        cefrs.push(cefr);
      } else {
        cefrDistribution["?"] = (cefrDistribution["?"] || 0) + 1;
      }
    }

    // Constrain activity queries to last 90 days to keep workload bounded for large cohorts
    const day90 = new Date(now - 90 * 24 * 3600 * 1000);
    const [pronunciations, interviews, presentations, quizzes, tutorConvos, paths] = await Promise.all([
      db.select().from(pronunciationAssessmentsTable)
        .where(and(inArray(pronunciationAssessmentsTable.userId, cohortIds), gte(pronunciationAssessmentsTable.createdAt, day90)))
        .catch(() => []),
      db.select().from(interviewSessionsTable)
        .where(and(inArray(interviewSessionsTable.userId, cohortIds), gte(interviewSessionsTable.startedAt, day90)))
        .catch(() => []),
      db.select().from(presentationSessionsTable)
        .where(and(inArray(presentationSessionsTable.userId, cohortIds), gte(presentationSessionsTable.startedAt, day90)))
        .catch(() => []),
      db.select().from(aiQuizSessionsTable)
        .where(and(inArray(aiQuizSessionsTable.userId, cohortIds), gte(aiQuizSessionsTable.createdAt, day90)))
        .catch(() => []),
      db.select().from(aiTutorConversationsTable)
        .where(and(inArray(aiTutorConversationsTable.userId, cohortIds), gte(aiTutorConversationsTable.lastMessageAt, day90)))
        .catch(() => []),
      db.select().from(learningPathsTable)
        .where(and(inArray(learningPathsTable.userId, cohortIds), gte(learningPathsTable.createdAt, day90)))
        .catch(() => []),
    ]);

    const pronScores = (pronunciations as any[]).map((a) => a.report?.overallScore).filter((x) => typeof x === "number");
    const intScores = (interviews as any[]).map((s) => s.report?.overallScore).filter((x) => typeof x === "number");
    const presScores = (presentations as any[]).map((s) => s.report?.overallScore).filter((x) => typeof x === "number");
    const quizScores = (quizzes as any[]).map((q) => q.report?.scorePercent).filter((x) => typeof x === "number");

    // Top performers: composite score of recent activity + points
    const activityByUser = new Map<number, number>();
    const tally = (rows: any[]) => {
      for (const r of rows) activityByUser.set(r.userId, (activityByUser.get(r.userId) || 0) + 1);
    };
    tally(pronunciations as any[]);
    tally(interviews as any[]);
    tally(presentations as any[]);
    tally(quizzes as any[]);
    tally(tutorConvos as any[]);
    tally(paths as any[]);

    const topPerformers = (cohort as any[])
      .map((u) => {
        const act = activityByUser.get(u.id) || 0;
        const score = (u.totalPoints || 0) + act * 50 + (u.streak || 0) * 10;
        return {
          id: u.id,
          fullName: `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email,
          cefr: u.currentLevel || null,
          totalPoints: u.totalPoints || 0,
          streak: u.streak || 0,
          score,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    // Top weak areas: aggregate from quiz weakAreas + interview weakPoints + presentation weaknesses
    const weakCounts = new Map<string, number>();
    const addWeak = (area: string) => {
      const key = (area || "").trim().toLowerCase();
      if (!key) return;
      weakCounts.set(key, (weakCounts.get(key) || 0) + 1);
    };
    for (const q of quizzes as any[]) for (const w of q.report?.weakAreas || []) addWeak(w.area || "");
    for (const i of interviews as any[]) for (const w of i.report?.weakPoints || []) addWeak(w.title || "");
    for (const p of presentations as any[]) for (const w of p.report?.weaknesses || []) addWeak(typeof w === "string" ? w : (w?.title || ""));
    for (const a of pronunciations as any[]) for (const w of a.report?.weakAreas || []) addWeak(w.title || "");
    const topWeakAreas = Array.from(weakCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([area, mentions]) => ({ area: area.charAt(0).toUpperCase() + area.slice(1), mentions }));

    const baseReport: AggregatedReport = {
      company: { id: company.id, name: company.name, companyTitle: (company as any).companyTitle || null },
      generatedAt: new Date().toISOString(),
      cohort: {
        total: cohort.length,
        activeLast7d,
        activeLast30d,
        avgStreak: Math.round(avg(streaks) || 0),
        avgTotalPoints: Math.round(avg(points) || 0),
        cefrDistribution,
        avgCefrLabel: cefrIndexAvg(cefrs),
      },
      activity: {
        pronunciationCount: pronunciations.length,
        interviewCount: interviews.length,
        presentationCount: presentations.length,
        quizCount: quizzes.length,
        tutorConvos: tutorConvos.length,
        learningPaths: paths.length,
      },
      averages: {
        pronunciation: avg(pronScores),
        interview: avg(intScores),
        presentation: avg(presScores),
        quiz: avg(quizScores),
      },
      topPerformers,
      topWeakAreas,
      ai: null,
    };

    // Decide whether to call AI: only if there's enough data to comment on
    const hasMinimumData = baseReport.cohort.total >= 1 && (
      baseReport.activity.pronunciationCount + baseReport.activity.interviewCount + baseReport.activity.presentationCount +
      baseReport.activity.quizCount + baseReport.activity.tutorConvos + baseReport.activity.learningPaths
    ) >= 1;

    if (hasMinimumData) {
      try {
        const sysPrompt = `You are a senior English-learning analyst writing a Turkish executive report for a corporate manager (HR / L&D) who oversees a cohort of employees on Sphere English LMS.

CONTEXT (this manager's company):
${JSON.stringify({
  company: baseReport.company,
  cohort: baseReport.cohort,
  activity: baseReport.activity,
  averages: baseReport.averages,
  topPerformers: baseReport.topPerformers.map((p) => ({ name: p.fullName, cefr: p.cefr, points: p.totalPoints })),
  topWeakAreas: baseReport.topWeakAreas,
}, null, 2)}

Write a concise, executive-tone analysis IN TURKISH. Be honest, specific, and useful. Don't be generic. Cite numbers from the data.

Return STRICT JSON:
{
  "executiveSummaryTr": "<2-3 short paragraphs in Turkish, executive tone, ~150 words total>",
  "bulletInsightsTr": ["<3-5 sharp Turkish insights — patterns, surprises, risks>"],
  "recommendationsForManagerTr": ["<3-5 concrete Turkish actions the manager should take this month>"]
}`;

        const completion = await getOpenAI().chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: sysPrompt },
            { role: "user", content: "Generate the executive report now." },
          ],
          temperature: 0.4,
          max_tokens: 1500,
          response_format: { type: "json_object" },
        });
        const parsed = JSON.parse(completion.choices[0]?.message?.content || "{}");
        baseReport.ai = {
          executiveSummaryTr: String(parsed.executiveSummaryTr || "").slice(0, 2000),
          bulletInsightsTr: Array.isArray(parsed.bulletInsightsTr)
            ? parsed.bulletInsightsTr.slice(0, 6).map((x: any) => String(x).slice(0, 300))
            : [],
          recommendationsForManagerTr: Array.isArray(parsed.recommendationsForManagerTr)
            ? parsed.recommendationsForManagerTr.slice(0, 6).map((x: any) => String(x).slice(0, 300))
            : [],
        };
      } catch (e: any) {
        console.warn("AI report summary failed:", e?.message || e);
      }
    }

    return res.json({ report: baseReport });
  } catch (err: any) {
    console.error("Corporate AI report error:", err?.message || err);
    return res.status(500).json({ error: "Rapor üretilemedi." });
  }
});

export default router;
