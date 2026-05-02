import { pgTable, serial, integer, varchar, text, timestamp, jsonb, index, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export interface LearningPathStep {
  id: string;
  weekNumber: number; // 1..4
  dayLabel: string; // e.g. "Pazartesi", "Salı" (Turkish)
  titleTr: string;
  descriptionTr: string;
  estimatedMinutes: number;
  category: "vocabulary" | "grammar" | "speaking" | "listening" | "writing" | "reading" | "exam_prep" | "review";
  featureLink: string | null; // app route, e.g. /student/vocab-game, /student/ai-quiz
  featureLabel: string | null; // human-readable, e.g. "Kelime Oyunu"
  rationaleTr: string; // why this step matters for THIS student (1-2 sentences)
  isCompleted: boolean;
  completedAt: string | null;
}

export interface LearningPathWeekSummary {
  weekNumber: number;
  themeTr: string;
  goalTr: string;
}

export interface LearningPathPlan {
  overallGoalTr: string;
  cefrTarget: string; // e.g. "B2'ye doğru hızlanma"
  weeklySummaries: LearningPathWeekSummary[];
  steps: LearningPathStep[];
  recommendationsTr: string[]; // 3-5 high-level reminders
  generationContextTr: string; // a short paragraph: why this plan was generated for them
}

export const learningPathsTable = pgTable(
  "learning_paths",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 200 }).notNull().default("Kişisel Öğrenme Yolun"),
    cefrAtGeneration: varchar("cefr_at_generation", { length: 8 }),
    isActive: boolean("is_active").notNull().default(true),
    plan: jsonb("plan").$type<LearningPathPlan>().notNull(),
    progress: jsonb("progress").$type<Record<string, { isCompleted: boolean; completedAt: string }>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("learning_paths_user_idx").on(t.userId, t.isActive),
  }),
);

export const insertLearningPathSchema = createInsertSchema(learningPathsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type LearningPath = typeof learningPathsTable.$inferSelect;
export type InsertLearningPath = z.infer<typeof insertLearningPathSchema>;
