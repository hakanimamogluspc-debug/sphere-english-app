import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Otomatik lead bulma sistemi — Apify ile günlük taranır.
 * Mevcut contact_leads tablosunu BOZMAZ; o kullanıcıların gönderdiği formlar için.
 * Bu tablo, dışarıdan keşfedilen potansiyel müşteriler için.
 */
export const outreachLeadsTable = pgTable(
  "outreach_leads",
  {
    id: serial("id").primaryKey(),

    // Kimlik
    email: text("email").notNull(),
    firstName: text("first_name"),
    lastName: text("last_name"),
    fullName: text("full_name"),

    // Profil
    linkedinUrl: text("linkedin_url"),
    jobTitle: text("job_title"),
    seniority: text("seniority"), // 'junior' | 'mid' | 'senior' | 'c-level'
    location: text("location"),

    // Şirket
    company: text("company"),
    companyDomain: text("company_domain"),
    companyWebsite: text("company_website"),
    companyPhone: text("company_phone"),
    industry: text("industry"),

    // Segment & kaynak
    segment: text("segment", {
      enum: ["b2b_hr", "b2b_sme", "b2c_pro", "partner"],
    }).notNull(),
    source: text("source").notNull(), // 'apify_linkedin_people', 'apify_gmaps', etc.
    sourceRunId: text("source_run_id"), // Apify run ID (debug)
    sourceUrl: text("source_url"), // ham kaynak URL

    // Email doğrulama
    emailVerified: boolean("email_verified").notNull().default(false),
    emailStatus: text("email_status", {
      enum: ["valid", "risky", "invalid", "unknown", "catch_all"],
    }).default("unknown"),
    emailVerifiedAt: timestamp("email_verified_at"),

    // Yönetim
    status: text("status", {
      enum: ["new", "viewed", "contacted", "qualified", "rejected", "archived"],
    })
      .notNull()
      .default("new"),
    notes: text("notes"),
    tags: text("tags"), // virgülle ayrılmış

    // Ham veriyi sakla (debug ve gelecekte enrichment için)
    rawData: jsonb("raw_data"),

    // Zaman damgaları
    discoveredAt: timestamp("discovered_at").notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    emailUnique: uniqueIndex("outreach_leads_email_unique").on(t.email),
    segmentIdx: index("outreach_leads_segment_idx").on(t.segment),
    statusIdx: index("outreach_leads_status_idx").on(t.status),
    discoveredIdx: index("outreach_leads_discovered_idx").on(t.discoveredAt),
  }),
);

/**
 * Her Apify çalıştırması için log kaydı — hata ayıklama ve istatistik.
 */
export const outreachRunsTable = pgTable("outreach_runs", {
  id: serial("id").primaryKey(),

  jobType: text("job_type", {
    enum: ["discovery", "verification", "manual"],
  }).notNull(),
  segment: text("segment"), // b2b_hr, b2b_sme, b2c_pro, partner — null = all
  status: text("status", {
    enum: ["running", "success", "partial", "failed"],
  })
    .notNull()
    .default("running"),

  // Apify
  apifyActorId: text("apify_actor_id"),
  apifyRunId: text("apify_run_id"),

  // Sayılar
  itemsScraped: integer("items_scraped").notNull().default(0),
  leadsAdded: integer("leads_added").notNull().default(0),
  leadsUpdated: integer("leads_updated").notNull().default(0),
  leadsSkipped: integer("leads_skipped").notNull().default(0),
  emailsVerified: integer("emails_verified").notNull().default(0),

  // Hata
  errorMessage: text("error_message"),

  // Maliyet (Apify USD cinsinden)
  costUsd: text("cost_usd"), // text olarak — decimal hassasiyeti için

  startedAt: timestamp("started_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export type OutreachLead = typeof outreachLeadsTable.$inferSelect;
export type InsertOutreachLead = typeof outreachLeadsTable.$inferInsert;
export type OutreachRun = typeof outreachRunsTable.$inferSelect;
export type InsertOutreachRun = typeof outreachRunsTable.$inferInsert;

export type OutreachSegment = "b2b_hr" | "b2b_sme" | "b2c_pro" | "partner";

export const SEGMENT_LABELS: Record<OutreachSegment, string> = {
  b2b_hr: "B2B İK Müdürleri",
  b2b_sme: "B2B KOBİ Sahipleri",
  b2c_pro: "B2C Profesyoneller",
  partner: "Eğitim Partnerleri",
};
