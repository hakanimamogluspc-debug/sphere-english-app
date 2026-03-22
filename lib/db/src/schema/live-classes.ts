import { pgTable, serial, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { coursesTable } from "./courses";

export const liveClassesTable = pgTable("live_classes", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  teacherId: integer("teacher_id").notNull().references(() => usersTable.id),
  courseId: integer("course_id").references(() => coursesTable.id),
  startTime: timestamp("start_time").notNull(),
  duration: integer("duration").notNull(),
  meetingLink: text("meeting_link").notNull(),
  zoomMeetingId: text("zoom_meeting_id"),
  maxStudents: integer("max_students").notNull().default(30),
  isRecorded: boolean("is_recorded").notNull().default(false),
  recordingUrl: text("recording_url"),
  type: text("type", { enum: ["one-on-one", "group"] }).notNull().default("group"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const liveClassAttendanceTable = pgTable("live_class_attendance", {
  id: serial("id").primaryKey(),
  liveClassId: integer("live_class_id").notNull().references(() => liveClassesTable.id, { onDelete: "cascade" }),
  studentId: integer("student_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
  leftAt: timestamp("left_at"),
  durationMinutes: integer("duration_minutes"),
});

export const insertLiveClassSchema = createInsertSchema(liveClassesTable).omit({ id: true, createdAt: true });
export type InsertLiveClass = z.infer<typeof insertLiveClassSchema>;
export type LiveClass = typeof liveClassesTable.$inferSelect;
export type LiveClassAttendance = typeof liveClassAttendanceTable.$inferSelect;
