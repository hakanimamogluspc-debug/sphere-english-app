import { pgTable, serial, integer, varchar, timestamp, text } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { lessonsTable } from "./courses";

export const userActivityLogsTable = pgTable("user_activity_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  lessonId: integer("lesson_id").notNull().references(() => lessonsTable.id, { onDelete: "cascade" }),
  courseId: integer("course_id").notNull(),
  startTime: timestamp("start_time").notNull().defaultNow(),
  endTime: timestamp("end_time"),
  durationSeconds: integer("duration_seconds").notNull().default(0),
  watchedPercent: integer("watched_percent").notNull().default(0),
  deviceInfo: text("device_info"),
  sessionId: varchar("session_id", { length: 64 }),
});

export type UserActivityLog = typeof userActivityLogsTable.$inferSelect;
export type InsertUserActivityLog = typeof userActivityLogsTable.$inferInsert;
