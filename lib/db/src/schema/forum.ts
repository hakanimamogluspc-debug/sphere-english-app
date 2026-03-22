import { pgTable, serial, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { coursesTable } from "./courses";

export const forumTopicsTable = pgTable("forum_topics", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  authorId: integer("author_id").notNull().references(() => usersTable.id),
  category: text("category", {
    enum: ["genel", "gramer", "kelime", "konusma", "sinav"],
  }).notNull().default("genel"),
  courseId: integer("course_id").references(() => coursesTable.id, { onDelete: "set null" }),
  isPinned: boolean("is_pinned").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const forumRepliesTable = pgTable("forum_replies", {
  id: serial("id").primaryKey(),
  topicId: integer("topic_id").notNull().references(() => forumTopicsTable.id, { onDelete: "cascade" }),
  authorId: integer("author_id").notNull().references(() => usersTable.id),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertForumTopicSchema = createInsertSchema(forumTopicsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertForumReplySchema = createInsertSchema(forumRepliesTable).omit({ id: true, createdAt: true });

export type InsertForumTopic = z.infer<typeof insertForumTopicSchema>;
export type InsertForumReply = z.infer<typeof insertForumReplySchema>;
export type ForumTopic = typeof forumTopicsTable.$inferSelect;
export type ForumReply = typeof forumRepliesTable.$inferSelect;
