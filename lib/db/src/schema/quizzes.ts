import { pgTable, serial, text, timestamp, integer, boolean, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { lessonsTable, coursesTable } from "./courses";

export const quizzesTable = pgTable("quizzes", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  lessonId: integer("lesson_id").references(() => lessonsTable.id, { onDelete: "cascade" }),
  courseId: integer("course_id").references(() => coursesTable.id),
  timeLimit: integer("time_limit"),
  passingScore: integer("passing_score").notNull().default(70),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const questionsTable = pgTable("questions", {
  id: serial("id").primaryKey(),
  quizId: integer("quiz_id").notNull().references(() => quizzesTable.id, { onDelete: "cascade" }),
  type: text("type", { enum: ["multiple_choice", "true_false", "fill_blank", "matching", "ordering"] }).notNull(),
  question: text("question").notNull(),
  options: text("options").array(),
  correctAnswer: text("correct_answer").notNull(),
  points: integer("points").notNull().default(10),
  order: integer("order").notNull().default(0),
});

export const quizAttemptsTable = pgTable("quiz_attempts", {
  id: serial("id").primaryKey(),
  quizId: integer("quiz_id").notNull().references(() => quizzesTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  score: integer("score").notNull().default(0),
  totalPoints: integer("total_points").notNull().default(0),
  percentage: real("percentage").notNull().default(0),
  passed: boolean("passed").notNull().default(false),
  timeTaken: integer("time_taken"),
  pointsEarned: integer("points_earned").notNull().default(0),
  submittedAt: timestamp("submitted_at").notNull().defaultNow(),
});

export const insertQuizSchema = createInsertSchema(quizzesTable).omit({ id: true, createdAt: true });
export const insertQuestionSchema = createInsertSchema(questionsTable).omit({ id: true });
export const insertQuizAttemptSchema = createInsertSchema(quizAttemptsTable).omit({ id: true, submittedAt: true });

export type InsertQuiz = z.infer<typeof insertQuizSchema>;
export type Quiz = typeof quizzesTable.$inferSelect;
export type Question = typeof questionsTable.$inferSelect;
export type QuizAttempt = typeof quizAttemptsTable.$inferSelect;
