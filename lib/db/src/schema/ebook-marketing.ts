import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  timestamp,
  boolean,
  index,
} from "drizzle-orm/pg-core";

/**
 * /e-kitaplar pazarlama sayfası içeriği.
 * SQL: lib/db/migrations/202610_ebook_marketing.sql
 */

/** "Haberdar ol" formu — yeni kitap/seri çıkınca bilgilendirilecekler. */
export const ebookWaitlistTable = pgTable(
  "ebook_waitlist",
  {
    id: serial("id").primaryKey(),
    email: varchar("email", { length: 320 }).notNull(),
    /** EBOOK_INTEREST_AREAS içinden; null = genel */
    interestArea: varchar("interest_area", { length: 60 }),
    source: varchar("source", { length: 60 }).notNull().default("ekitaplar-page"),
    userAgent: varchar("user_agent", { length: 500 }),
    ipHash: varchar("ip_hash", { length: 64 }),
    /** Yeni kitap duyurusu gönderildiğinde işaretlenir */
    notifiedAt: timestamp("notified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    createdIdx: index("ebook_waitlist_created_idx").on(t.createdAt),
    areaIdx: index("ebook_waitlist_area_idx").on(t.interestArea),
  }),
);

export type EbookWaitlistEntry = typeof ebookWaitlistTable.$inferSelect;

export const ebookFaqTable = pgTable(
  "ebook_faq",
  {
    id: serial("id").primaryKey(),
    question: varchar("question", { length: 300 }).notNull(),
    answer: text("answer").notNull(),
    displayOrder: integer("display_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orderIdx: index("ebook_faq_order_idx").on(t.isActive, t.displayOrder),
  }),
);

export type EbookFaq = typeof ebookFaqTable.$inferSelect;

/** "Nereden başlamalıyım?" rol bazlı rehber kartları */
export const ebookGuideTable = pgTable(
  "ebook_guide",
  {
    id: serial("id").primaryKey(),
    roleLabel: varchar("role_label", { length: 120 }).notNull(),
    description: text("description").notNull(),
    ctaText: varchar("cta_text", { length: 80 }),
    ctaHref: varchar("cta_href", { length: 300 }),
    /** Emoji ya da kısa ikon anahtarı */
    icon: varchar("icon", { length: 16 }),
    displayOrder: integer("display_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orderIdx: index("ebook_guide_order_idx").on(t.isActive, t.displayOrder),
  }),
);

export type EbookGuide = typeof ebookGuideTable.$inferSelect;

/** Formdaki ilgi alanı seçenekleri — frontend ve admin aynı listeyi kullanır */
export const EBOOK_INTEREST_AREAS = [
  { key: "toplanti-eposta", label: "Toplantı & E-posta" },
  { key: "satis-pazarlama", label: "Satış & Pazarlama" },
  { key: "finans", label: "Finans & Muhasebe" },
  { key: "teknoloji", label: "Teknoloji & Yazılım" },
  { key: "liderlik", label: "Liderlik & İK" },
  { key: "diger", label: "Diğer" },
] as const;
export type EbookInterestArea = (typeof EBOOK_INTEREST_AREAS)[number]["key"];
