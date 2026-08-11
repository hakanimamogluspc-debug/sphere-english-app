import { pgTable, serial, text, timestamp, integer, primaryKey } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const speakingClubsTable = pgTable("speaking_clubs", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  topic: text("topic"),
  teacherId: integer("teacher_id").references(() => usersTable.id, { onDelete: "set null" }),
  scheduledAt: timestamp("scheduled_at").notNull(),
  durationMinutes: integer("duration_minutes").notNull().default(60),
  maxParticipants: integer("max_participants").notNull().default(10),
  level: text("level").default("all"),
  status: text("status").notNull().default("upcoming"),
  meetingLink: text("meeting_link"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const speakingClubParticipantsTable = pgTable("speaking_club_participants", {
  clubId: integer("club_id").notNull().references(() => speakingClubsTable.id, { onDelete: "cascade" }),
  studentId: integer("student_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.clubId, t.studentId] })]);

export type SpeakingClub = typeof speakingClubsTable.$inferSelect;
export type SpeakingClubParticipant = typeof speakingClubParticipantsTable.$inferSelect;
