import { pgTable, serial, integer, varchar, text, timestamp, jsonb, index, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export interface TutorMessageCorrection {
  original: string;
  corrected: string;
  explanationTr: string;
}

export interface TutorMessageMeta {
  corrections?: TutorMessageCorrection[];
  vocabSuggestions?: Array<{ original: string; better: string; reason: string }>;
  grammarTip?: string;
  followUpPrompts?: string[];
}

export const aiTutorConversationsTable = pgTable(
  "ai_tutor_conversations",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 200 }).notNull().default("Yeni Sohbet"),
    focusArea: varchar("focus_area", { length: 60 }), // grammar | vocabulary | conversation | exam_prep | business | free
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    lastMessageAt: timestamp("last_message_at").notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("ai_tutor_convo_user_idx").on(t.userId, t.lastMessageAt),
  }),
);

export const aiTutorMessagesTable = pgTable(
  "ai_tutor_messages",
  {
    id: serial("id").primaryKey(),
    conversationId: integer("conversation_id")
      .notNull()
      .references(() => aiTutorConversationsTable.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 16 }).notNull(), // user | assistant | system
    content: text("content").notNull(),
    meta: jsonb("meta").$type<TutorMessageMeta | null>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    convoIdx: index("ai_tutor_msg_convo_idx").on(t.conversationId, t.createdAt),
  }),
);

export interface TutorMemoryFact {
  id: string;
  category: "level" | "goal" | "weakness" | "strength" | "interest" | "context";
  fact: string; // Turkish or English short fact
  createdAt: string;
}

export const aiTutorMemoryTable = pgTable(
  "ai_tutor_memory",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    facts: jsonb("facts").$type<TutorMemoryFact[]>().notNull().default([]),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("ai_tutor_memory_user_idx").on(t.userId),
  }),
);

export const insertTutorConversationSchema = createInsertSchema(aiTutorConversationsTable).omit({
  id: true,
  createdAt: true,
  lastMessageAt: true,
});
export const insertTutorMessageSchema = createInsertSchema(aiTutorMessagesTable).omit({
  id: true,
  createdAt: true,
});

export type AITutorConversation = typeof aiTutorConversationsTable.$inferSelect;
export type AITutorMessage = typeof aiTutorMessagesTable.$inferSelect;
export type AITutorMemory = typeof aiTutorMemoryTable.$inferSelect;
