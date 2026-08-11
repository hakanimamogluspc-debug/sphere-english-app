import { pgTable, serial, text, timestamp, integer, primaryKey } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const groupsTable = pgTable("groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  teacherId: integer("teacher_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const groupMembersTable = pgTable("group_members", {
  groupId: integer("group_id").notNull().references(() => groupsTable.id, { onDelete: "cascade" }),
  studentId: integer("student_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.groupId, t.studentId] })]);

export type Group = typeof groupsTable.$inferSelect;
export type GroupMember = typeof groupMembersTable.$inferSelect;
