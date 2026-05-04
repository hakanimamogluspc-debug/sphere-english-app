import { pgTable, serial, integer, varchar, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export type AIQuizQuestionType = "multiple_choice" | "true_false" | "fill_blank";

export interface AIQuizQuestion {
  id: string;
  type: AIQuizQuestionType;
  category: "vocabulary" | "grammar" | "comprehension";
  prompt: string; // English question
  context?: string; // optional excerpt or sentence for context
  options?: string[]; // for multiple_choice / true_false
  correctAnswer: string;
  explanationEn: string;
  explanationTr: string;
}

export interface AIQuizSetup {
  sourceMode: "topic" | "text";
  topic?: string;
  sourceText?: string;
  level: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
  numQuestions: number;
  categories: Array<"vocabulary" | "grammar" | "comprehension">;
}

export interface AIQuizAnswer {
  questionId: string;
  userAnswer: string;
  isCorrect: boolean;
}

export interface AIQuizReport {
  scoreCorrect: number;
  scoreTotal: number;
  scorePercent: number;
  passed: boolean;
  estimatedCefrFit: string;
  cefrConfidence: "low" | "medium" | "high";
  byCategory: {
    vocabulary?: { correct: number; total: number };
    grammar?: { correct: number; total: number };
    comprehension?: { correct: number; total: number };
  };
  weakAreas: Array<{ area: string; detail: string; suggestion: string }>;
  studyPlan: string[];
  encouragement: string;
}

export const aiQuizSessionsTable = pgTable(
  "ai_quiz_sessions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 200 }).notNull(),
    status: varchar("status", { length: 16 }).notNull().default("ready"), // ready | submitted | abandoned
    setup: jsonb("setup").$type<AIQuizSetup>().notNull(),
    questions: jsonb("questions").$type<AIQuizQuestion[]>().notNull().default([]),
    answers: jsonb("answers").$type<AIQuizAnswer[]>().notNull().default([]),
    report: jsonb("report").$type<AIQuizReport | null>(),
    timeTakenSec: integer("time_taken_sec"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    submittedAt: timestamp("submitted_at"),
  },
  (t) => ({
    userIdx: index("ai_quiz_user_idx").on(t.userId, t.createdAt),
  }),
);

export const insertAIQuizSessionSchema = createInsertSchema(aiQuizSessionsTable).omit({
  id: true,
  createdAt: true,
});

export type AIQuizSession = typeof aiQuizSessionsTable.$inferSelect;
export type InsertAIQuizSession = z.infer<typeof insertAIQuizSessionSchema>;
