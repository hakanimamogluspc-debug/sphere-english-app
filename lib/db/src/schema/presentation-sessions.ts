import { pgTable, serial, integer, varchar, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export interface PresentationSetup {
  topic: string;
  audienceType: string; // "investors" | "team" | "customers" | "board" | "conference" | "students" | "press"
  audienceTypeLabel: string;
  goal: "inform" | "persuade" | "pitch" | "train" | "update";
  goalLabel: string;
  toneStyle: "formal" | "neutral" | "energetic" | "consultative";
  durationTargetMin: number;
  contextNotes?: string;
  language: "en";
}

export interface PresentationQATurn {
  question: string;
  questionAudio?: string;
  candidateAnswer: string;
  candidateAudio?: string;
  questionerName: string;
  questionerRole: string;
  timestamp?: string;
}

export interface PresentationReport {
  overallScore: number; // 0-100
  estimatedCefr: string;
  cefrConfidence: "low" | "medium" | "high";

  // Pillar scores
  structureScore: number;
  clarityScore: number;
  persuasivenessScore: number;
  englishFluencyScore: number;
  vocalDeliveryScore: number;
  qaHandlingScore: number;

  // Verdict
  audienceVerdict: "compelling" | "solid" | "needs_work" | "weak";
  audienceVerdictLabel: string;

  // Talking-stats from transcript
  wordCount: number;
  estimatedDurationSec: number;
  estimatedPaceWpm: number;
  fillerWordCount: number;
  fillerExamples: string[];

  // Qualitative feedback
  hookFeedback: { yourOpening: string; rating: "weak" | "ok" | "strong"; suggestion: string };
  closingFeedback: { yourClosing: string; rating: "weak" | "ok" | "strong"; suggestion: string };
  structureNotes: string;

  // Strong & weak
  strongPoints: Array<{ title: string; detail: string }>;
  weakPoints: Array<{ title: string; detail: string; suggestion: string }>;

  // Improvements
  improvedOpeningHook: string; // English model
  improvedClosingCta: string; // English model

  // Vocabulary upgrades
  vocabUpgrades: Array<{ original: string; better: string; explanation: string }>;

  // Q&A grading per turn
  qaFeedback: Array<{
    question: string;
    yourAnswer: string;
    rating: "weak" | "ok" | "strong";
    modelAnswer: string;
    coaching: string;
  }>;

  // Final tips
  recommendedPracticeAreas: string[];
  nextSteps: string[];
  audienceImpression: string; // 2-3 sentence Turkish narrative
}

export const presentationSessionsTable = pgTable(
  "presentation_sessions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 16 }).notNull().default("recording"), // recording | qa | completed | abandoned
    setup: jsonb("setup").$type<PresentationSetup>().notNull(),
    presentationTranscript: text("presentation_transcript"), // user's full presentation (English)
    qaTurns: jsonb("qa_turns").$type<PresentationQATurn[]>().notNull().default([]),
    targetQaTurns: integer("target_qa_turns").notNull().default(2),
    report: jsonb("report").$type<PresentationReport | null>(),
    durationSec: integer("duration_sec").notNull().default(0),
    startedAt: timestamp("started_at").notNull().defaultNow(),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("presentation_user_idx").on(t.userId, t.createdAt),
    statusIdx: index("presentation_status_idx").on(t.userId, t.status),
  }),
);

export const insertPresentationSessionSchema = createInsertSchema(presentationSessionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type PresentationSession = typeof presentationSessionsTable.$inferSelect;
export type InsertPresentationSession = z.infer<typeof insertPresentationSessionSchema>;
