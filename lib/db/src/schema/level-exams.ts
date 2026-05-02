import { pgTable, serial, integer, text, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { usersTable } from "./users";

export interface LevelExamQuestion {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  source: "oxford_business_result" | "sphere_ai";
}

export interface LevelExamAnswer {
  questionId: string;
  selectedIndex: number | null;
  isCorrect: boolean;
}

export const levelExamAttemptsTable = pgTable("level_exam_attempts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  cefrLevel: text("cefr_level", { enum: ["A1", "A2", "B1", "B2", "C1", "C2"] }).notNull(),
  score: integer("score").notNull().default(0),
  total: integer("total").notNull(),
  percent: integer("percent").notNull().default(0),
  passed: boolean("passed").notNull().default(false),
  answers: jsonb("answers").$type<LevelExamAnswer[]>().notNull().default([]),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertLevelExamAttemptSchema = createInsertSchema(levelExamAttemptsTable).omit({
  id: true,
  startedAt: true,
  completedAt: true,
});

export type LevelExamAttempt = typeof levelExamAttemptsTable.$inferSelect;
export type NewLevelExamAttempt = typeof levelExamAttemptsTable.$inferInsert;
