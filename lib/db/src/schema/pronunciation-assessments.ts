import { pgTable, serial, integer, text, varchar, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const pronunciationAssessmentsTable = pgTable(
  "pronunciation_assessments",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),

    teacherId: varchar("teacher_id", { length: 64 }).notNull(),
    teacherName: varchar("teacher_name", { length: 64 }).notNull(),

    durationSeconds: integer("duration_seconds").notNull().default(0),
    messageCount: integer("message_count").notNull().default(0),
    avgScore: integer("avg_score").notNull().default(0),

    estimatedCefr: varchar("estimated_cefr", { length: 8 }).notNull(),
    cefrConfidence: varchar("cefr_confidence", { length: 16 }).notNull().default("medium"),

    strengths: jsonb("strengths").$type<string[]>().notNull().default([]),
    weakAreas: jsonb("weak_areas")
      .$type<{
        phonemes: string[];
        grammar: string[];
        vocabulary: string[];
        fluency: string[];
      }>()
      .notNull()
      .default({ phonemes: [], grammar: [], vocabulary: [], fluency: [] }),

    recommendations: jsonb("recommendations")
      .$type<Array<{ title: string; action: string; priority: "high" | "medium" | "low" }>>()
      .notNull()
      .default([]),

    aiSummary: text("ai_summary").notNull().default(""),

    transcriptSummary: jsonb("transcript_summary")
      .$type<Array<{ role: "user" | "teacher"; text: string; score?: number }>>()
      .notNull()
      .default([]),

    rawMetrics: jsonb("raw_metrics")
      .$type<{
        totalGrammarErrors: number;
        totalVocabSuggestions: number;
        totalPronunciationTips: number;
        lowConfidenceWords: string[];
      }>()
      .notNull()
      .default({
        totalGrammarErrors: 0,
        totalVocabSuggestions: 0,
        totalPronunciationTips: 0,
        lowConfidenceWords: [],
      }),

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    userCreatedIdx: index("pron_assess_user_created_idx").on(t.userId, t.createdAt),
  }),
);

export type PronunciationAssessment = typeof pronunciationAssessmentsTable.$inferSelect;
export type InsertPronunciationAssessment = typeof pronunciationAssessmentsTable.$inferInsert;
