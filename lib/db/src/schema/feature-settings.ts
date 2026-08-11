import { pgTable, serial, varchar, boolean, text, timestamp } from "drizzle-orm/pg-core";

export const featureSettingsTable = pgTable("feature_settings", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 50 }).notNull().unique(),
  label: varchar("label", { length: 100 }).notNull(),
  isEnabled: boolean("is_enabled").notNull().default(true),
  visibleTo: text("visible_to").array().notNull().default(["student"]),
  category: varchar("category", { length: 50 }).notNull().default("general"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
