import { pgTable, serial, integer, varchar, text, timestamp, boolean, index, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const notificationsTable = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    kind: varchar("kind", { length: 48 }).notNull(),
    title: varchar("title", { length: 160 }).notNull(),
    body: text("body").notNull(),
    actionUrl: varchar("action_url", { length: 256 }),
    iconKind: varchar("icon_kind", { length: 32 }).notNull().default("bell"),
    priority: varchar("priority", { length: 16 }).notNull().default("normal"),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    readAt: timestamp("read_at"),
    emailedAt: timestamp("emailed_at"),
    dedupeKey: varchar("dedupe_key", { length: 128 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    userCreatedIdx: index("notif_user_created_idx").on(t.userId, t.createdAt),
    userUnreadIdx: index("notif_user_unread_idx").on(t.userId, t.readAt),
    dedupeIdx: index("notif_dedupe_idx").on(t.userId, t.dedupeKey),
  }),
);

export const notificationPreferencesTable = pgTable("notification_preferences", {
  userId: integer("user_id")
    .primaryKey()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  emailEnabled: boolean("email_enabled").notNull().default(true),
  inAppEnabled: boolean("in_app_enabled").notNull().default(true),
  streakRiskEmail: boolean("streak_risk_email").notNull().default(true),
  inactivityEmail: boolean("inactivity_email").notNull().default(true),
  newAssessmentEmail: boolean("new_assessment_email").notNull().default(true),
  levelUpEmail: boolean("level_up_email").notNull().default(true),
  newQuizEmail: boolean("new_quiz_email").notNull().default(false),
  weeklyDigestEmail: boolean("weekly_digest_email").notNull().default(true),
  lastEmailSentAt: timestamp("last_email_sent_at"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertNotificationSchema = createInsertSchema(notificationsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notificationsTable.$inferSelect;
export type NotificationPreference = typeof notificationPreferencesTable.$inferSelect;
