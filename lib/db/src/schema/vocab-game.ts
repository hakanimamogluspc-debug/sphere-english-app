import { pgTable, serial, text, timestamp, integer, boolean, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const vocabWordsTable = pgTable("vocab_words", {
  id: serial("id").primaryKey(),
  word: text("word").notNull(),
  turkish: text("turkish").notNull(),
  imagePrompt: text("image_prompt").notNull(),
  level: text("level").notNull(),
  category: text("category").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const vocabGameSessionsTable = pgTable("vocab_game_sessions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull(),
  level: text("level").notNull(),
  totalWords: integer("total_words").notNull().default(10),
  score: integer("score").notNull().default(0),
  hintsUsed: integer("hints_used").notNull().default(0),
  wordsCorrect: integer("words_correct").notNull().default(0),
  wordsSeen: integer("words_seen").notNull().default(0),
  isFinished: boolean("is_finished").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const vocabSessionWordsTable = pgTable("vocab_session_words", {
  id: serial("id").primaryKey(),
  sessionId: varchar("session_id", { length: 36 }).notNull(),
  wordId: integer("word_id").notNull(),
  wordIndex: integer("word_index").notNull(),
  attempts: integer("attempts").notNull().default(0),
  hintUsed: boolean("hint_used").notNull().default(false),
  isCorrect: boolean("is_correct"),
  isSkipped: boolean("is_skipped").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
