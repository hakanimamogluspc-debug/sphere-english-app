import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  decimal,
  timestamp,
  boolean,
  index,
  uniqueIndex,
  jsonb,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/**
 * Sphere English dijital ürün kataloğu (e-kitaplar).
 *
 * Pazarlama sitesinde /e-kitaplar sayfasında listelenir, /e-kitaplar/[slug]
 * detay sayfasında satın alma akışı çalıştırılır. PDF dosyaları sphere-www
 * public/assets/ebooks/ klasöründe servis edilir (önizleme açık, tam sürüm
 * indirme token ile korumalıdır).
 *
 * Seri yapısı: "İş İngilizcesinde Kullanılan 1000 Kelime — Kitap 01/02/..."
 * series_slug + series_order ile aynı seri kitaplar gruplanır.
 */
export const ebooksTable = pgTable(
  "ebooks",
  {
    id: serial("id").primaryKey(),

    // URL slug — /e-kitaplar/<slug>
    slug: varchar("slug", { length: 200 }).notNull(),

    // ── İçerik bilgileri ──
    title: varchar("title", { length: 300 }).notNull(),
    subtitle: varchar("subtitle", { length: 300 }),
    description: text("description").notNull(),
    /** Uzun açıklama / markdown */
    longDescription: text("long_description"),
    /** Kitabın içindekiler tablosu (markdown veya JSON) */
    tableOfContents: text("table_of_contents"),

    author: varchar("author", { length: 200 }).notNull(),
    publisher: varchar("publisher", { length: 200 }).notNull().default("Sphere English"),
    isbn: varchar("isbn", { length: 30 }),
    language: varchar("language", { length: 5 }).notNull().default("tr"),
    /** İçerik dili — iş İngilizcesi kitabıdır ama açıklama Türkçedir */
    contentLanguage: varchar("content_language", { length: 50 }),

    // ── Seri ──
    seriesSlug: varchar("series_slug", { length: 100 }),
    seriesOrder: integer("series_order"),
    seriesTitle: varchar("series_title", { length: 300 }),

    // ── Görsel + dosya yolları (sphere-www public altında) ──
    /** Ana kapak görseli URL — örn. /assets/ebooks/kurumsal-iletisim-mockup-book.jpg */
    coverImageUrl: varchar("cover_image_url", { length: 500 }),
    /** Ek ürün görselleri (mockup, tablet, sayfa içi vb.) — sıralı JSON array */
    galleryUrls: jsonb("gallery_urls").$type<string[]>().default([]),
    /** 5 sayfalık önizleme PDF — public erişim */
    previewPdfUrl: varchar("preview_pdf_url", { length: 500 }),
    /** Tam PDF yolu — sadece backend bilir, indirme token ile servis */
    fullPdfPath: varchar("full_pdf_path", { length: 500 }),

    // ── Metaları ──
    pageCount: integer("page_count"),
    /** Tahmini okuma süresi (dakika) */
    readingTimeMin: integer("reading_time_min"),
    category: varchar("category", { length: 100 }),
    /** Etiketler (JSON array) — örn. ["toplantı", "e-posta", "B2"] */
    tags: jsonb("tags").$type<string[]>().default([]),

    // ── Fiyat ──
    priceTry: decimal("price_try", { precision: 10, scale: 2 }).notNull(),
    /** Liste fiyatı (indirim öncesi) */
    listPriceTry: decimal("list_price_try", { precision: 10, scale: 2 }),
    currency: varchar("currency", { length: 3 }).notNull().default("TRY"),

    // ── Yayın durumu ──
    isActive: boolean("is_active").notNull().default(true),
    isFeatured: boolean("is_featured").notNull().default(false),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),

    // ── SEO ──
    seoTitle: varchar("seo_title", { length: 200 }),
    seoDescription: varchar("seo_description", { length: 300 }),
    seoKeywords: text("seo_keywords"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    slugIdx: uniqueIndex("ebooks_slug_unique").on(t.slug),
    activeIdx: index("ebooks_active_idx").on(t.isActive, t.publishedAt),
    seriesIdx: index("ebooks_series_idx").on(t.seriesSlug, t.seriesOrder),
    featuredIdx: index("ebooks_featured_idx").on(t.isFeatured),
  }),
);

/**
 * Dijital kitap satın alma kayıtları.
 *
 * Iyzico üzerinden başarılı ödeme sonrası buraya bir kayıt eklenir.
 * download_token ile kullanıcı belirli süre içinde indirebilir.
 */
export const ebookPurchasesTable = pgTable(
  "ebook_purchases",
  {
    id: serial("id").primaryKey(),
    ebookId: integer("ebook_id")
      .notNull()
      .references(() => ebooksTable.id, { onDelete: "cascade" }),
    userId: integer("user_id").references(() => usersTable.id, { onDelete: "set null" }),

    // Misafir satın alma için email zorunlu (kullanıcı varsa email de tutulur)
    buyerEmail: varchar("buyer_email", { length: 200 }).notNull(),
    buyerName: varchar("buyer_name", { length: 200 }),

    // Ödeme detayları
    amountPaid: decimal("amount_paid", { precision: 10, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("TRY"),
    iyzicoPaymentId: varchar("iyzico_payment_id", { length: 200 }),
    iyzicoConversationId: varchar("iyzico_conversation_id", { length: 200 }),

    // İndirme erişimi
    downloadToken: varchar("download_token", { length: 100 }).notNull(),
    downloadCount: integer("download_count").notNull().default(0),
    downloadExpiresAt: timestamp("download_expires_at", { withTimezone: true }).notNull(),

    paidAt: timestamp("paid_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tokenIdx: uniqueIndex("ebook_purchases_token_unique").on(t.downloadToken),
    emailIdx: index("ebook_purchases_email_idx").on(t.buyerEmail, t.paidAt),
    ebookIdx: index("ebook_purchases_ebook_idx").on(t.ebookId, t.paidAt),
  }),
);

export type Ebook = typeof ebooksTable.$inferSelect;
export type NewEbook = typeof ebooksTable.$inferInsert;
export type EbookPurchase = typeof ebookPurchasesTable.$inferSelect;
export type NewEbookPurchase = typeof ebookPurchasesTable.$inferInsert;
