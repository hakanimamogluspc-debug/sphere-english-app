import { pgTable, serial, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const materialFoldersTable = pgTable("material_folders", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdBy: integer("created_by").references(() => usersTable.id),
  isActive: boolean("is_active").notNull().default(true),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const materialsTable = pgTable("materials", {
  id: serial("id").primaryKey(),
  folderId: integer("folder_id").references(() => materialFoldersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size"),
  uploadedBy: integer("uploaded_by").references(() => usersTable.id),
  isActive: boolean("is_active").notNull().default(true),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const studentMaterialAccessTable = pgTable("student_material_access", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  folderId: integer("folder_id").notNull().references(() => materialFoldersTable.id, { onDelete: "cascade" }),
  isBlocked: boolean("is_blocked").notNull().default(false),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type MaterialFolder = typeof materialFoldersTable.$inferSelect;
export type Material = typeof materialsTable.$inferSelect;
export type StudentMaterialAccess = typeof studentMaterialAccessTable.$inferSelect;
