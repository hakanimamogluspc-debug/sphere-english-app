import { pgTable, serial, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";

export const grammarBooksTable = pgTable("grammar_books", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  level: text("level").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const grammarTopicsTable = pgTable("grammar_topics", {
  id: serial("id").primaryKey(),
  bookId: integer("book_id").notNull(),
  title: text("title").notNull(),
  level: text("level").notNull(),
  content: text("content").notNull(),
  cachedSummary: text("cached_summary"),
  cachedExamples: text("cached_examples"),
  cachedTable: text("cached_table"),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const grammarProgressTable = pgTable("grammar_progress", {
  id: serial("id").primaryKey(),
  username: text("username").notNull(),
  topicId: integer("topic_id").notNull(),
  correctAnswers: integer("correct_answers").notNull().default(0),
  totalAnswered: integer("total_answered").notNull().default(0),
  completed: boolean("completed").notNull().default(false),
  completedAt: timestamp("completed_at"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
