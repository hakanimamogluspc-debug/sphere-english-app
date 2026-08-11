import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const companiesTable = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  code: text("code").notNull().unique(),
  registrationLimit: integer("registration_limit").notNull().default(0),
  corporateLimit: integer("corporate_limit").notNull().default(0),
  companyTitle: text("company_title"),
  address: text("address"),
  taxOffice: text("tax_office"),
  taxNumber: text("tax_number"),
  contactNumber: text("contact_number"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCompanySchema = createInsertSchema(companiesTable).omit({ id: true, createdAt: true });
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companiesTable.$inferSelect;
