import { pgTable, serial, integer, varchar, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export interface InterviewTurn {
  role: "interviewer" | "candidate";
  content: string;
  audioBase64?: string;
  scoreSnapshot?: number;
  timestamp?: string;
}

export interface InterviewSetup {
  targetRole: string;
  seniority: "junior" | "mid" | "senior" | "lead" | "executive";
  industry: string;
  interviewerStyle: string; // coach id
  jobDescription?: string;
  resumeText?: string;
  language: "en";
  cefrTarget?: string;
}

export interface InterviewReport {
  overallScore: number; // 0-100
  hireRecommendation: "strong_hire" | "hire" | "lean_hire" | "no_hire";
  hireRecommendationLabel: string;
  estimatedCefr: string;
  cefrConfidence: "low" | "medium" | "high";
  englishFluencyScore: number;
  technicalContentScore: number;
  communicationScore: number;
  professionalismScore: number;
  strongPoints: Array<{ title: string; detail: string }>;
  weakPoints: Array<{ title: string; detail: string; suggestion: string }>;
  bestAnswers: Array<{
    question: string;
    yourAnswer: string;
    modelAnswer: string;
    whyBetter: string;
  }>;
  interviewerImpression: string;
  recommendedPracticeAreas: string[];
  nextSteps: string[];
}

export const interviewSessionsTable = pgTable(
  "interview_sessions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 16 }).notNull().default("active"), // active | completed | abandoned
    setup: jsonb("setup").$type<InterviewSetup>().notNull(),
    transcript: jsonb("transcript").$type<InterviewTurn[]>().notNull().default([]),
    questionsAsked: integer("questions_asked").notNull().default(0),
    targetQuestions: integer("target_questions").notNull().default(8),
    currentPhase: varchar("current_phase", { length: 24 }).notNull().default("intro"),
    report: jsonb("report").$type<InterviewReport | null>(),
    durationSec: integer("duration_sec").notNull().default(0),
    startedAt: timestamp("started_at").notNull().defaultNow(),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("interview_user_idx").on(t.userId, t.createdAt),
    statusIdx: index("interview_status_idx").on(t.userId, t.status),
  }),
);

export const insertInterviewSessionSchema = createInsertSchema(interviewSessionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InterviewSession = typeof interviewSessionsTable.$inferSelect;
export type InsertInterviewSession = z.infer<typeof insertInterviewSessionSchema>;
