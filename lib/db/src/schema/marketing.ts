import { pgTable, serial, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";

export const contactLeadsTable = pgTable("contact_leads", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  company: text("company"),
  message: text("message"),
  source: text("source").default("website"),
  status: text("status", { enum: ["new", "contacted", "qualified", "lost"] }).notNull().default("new"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const emailCampaignsTable = pgTable("email_campaigns", {
  id: serial("id").primaryKey(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  recipientFilter: text("recipient_filter").notNull().default("all"),
  recipientCount: integer("recipient_count").notNull().default(0),
  sentCount: integer("sent_count").notNull().default(0),
  status: text("status", { enum: ["draft", "sending", "sent", "failed"] }).notNull().default("draft"),
  sentAt: timestamp("sent_at"),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const pageViewsTable = pgTable("page_views", {
  id: serial("id").primaryKey(),
  page: text("page").notNull(),
  referrer: text("referrer"),
  userAgent: text("user_agent"),
  ip: text("ip"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const emailTemplatesTable = pgTable("email_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  subject: text("subject").notNull().default(""),
  htmlContent: text("html_content"),
  fileType: text("file_type", { enum: ["html", "pdf"] }).notNull().default("html"),
  fileName: text("file_name").notNull(),
  filePath: text("file_path"),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ContactLead = typeof contactLeadsTable.$inferSelect;
export type InsertContactLead = typeof contactLeadsTable.$inferInsert;
export type EmailCampaign = typeof emailCampaignsTable.$inferSelect;
export type PageView = typeof pageViewsTable.$inferSelect;
export type EmailTemplate = typeof emailTemplatesTable.$inferSelect;
