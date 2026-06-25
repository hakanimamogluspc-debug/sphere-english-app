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
 * E-kitap dosya/görsel varlıkları (cover, gallery, preview PDF, full PDF).
 *
 * Sphere'in pazarlama sitesinde public klasör Easypanel deploy'larında
 * ephemeral — admin yüklemeleri restart sonrası kayboluyor. Çözüm: tüm
 * dosyaları DB'de bytea olarak tut, api-server'dan stream et.
 *
 * Public URL şablonu: `/api-server/api/ebooks/<slug>/asset/<id>`
 * Bu URL frontend'de doğrudan <img src="..."> veya <a href="..."> ile kullanılır.
 */
export const ebookAssetsTable = pgTable(
  "ebook_assets",
  {
    id: serial("id").primaryKey(),
    ebookId: integer("ebook_id").notNull(),
    /** 'cover' | 'gallery' | 'preview' | 'full' */
    assetType: varchar("asset_type", { length: 20 }).notNull(),
    /** Galeri sıralaması (cover/preview/full için 0) */
    position: integer("position").notNull().default(0),
    filename: varchar("filename", { length: 300 }).notNull(),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    /** Binary içerik — PostgreSQL BYTEA olarak saklanır */
    dataBase64: text("data_base64").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    ebookIdx: index("ebook_assets_ebook_idx").on(t.ebookId, t.assetType, t.position),
  }),
);

export type EbookAsset = typeof ebookAssetsTable.$inferSelect;
export type NewEbookAsset = typeof ebookAssetsTable.$inferInsert;

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
    buyerPhone: varchar("buyer_phone", { length: 30 }),

    // ── Fatura bilgileri ──
    /** 'individual' (bireysel) | 'corporate' (kurumsal) */
    invoiceType: varchar("invoice_type", { length: 20 }).default("individual"),
    /** Bireysel: TC kimlik no (11 hane) / Kurumsal: VKN (10 hane) */
    taxId: varchar("tax_id", { length: 20 }),
    /** Sadece kurumsal */
    taxOffice: varchar("tax_office", { length: 150 }),
    /** Sadece kurumsal — şirket unvanı */
    companyName: varchar("company_name", { length: 300 }),
    /** Açık adres (cadde/sokak/no/daire) */
    billingAddress: text("billing_address"),
    billingCity: varchar("billing_city", { length: 100 }),
    billingDistrict: varchar("billing_district", { length: 100 }),
    billingPostalCode: varchar("billing_postal_code", { length: 10 }),

    // Ödeme detayları
    amountPaid: decimal("amount_paid", { precision: 10, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("TRY"),
    iyzicoPaymentId: varchar("iyzico_payment_id", { length: 200 }),
    iyzicoConversationId: varchar("iyzico_conversation_id", { length: 200 }),

    /** 'pending' (form gönderildi, ödeme bekliyor) | 'success' | 'failed' | 'expired' */
    paymentStatus: varchar("payment_status", { length: 20 }).notNull().default("pending"),
    /** Iyzico hata mesajı / errorCode (başarısız ödemelerde) */
    paymentError: text("payment_error"),

    // ── Fatura kesim takibi ──
    /** 'pending' (kesilmedi) | 'issued' (kesildi) | 'sent' (gönderildi) | 'cancelled' */
    invoiceStatus: varchar("invoice_status", { length: 20 }).notNull().default("pending"),
    invoiceNumber: varchar("invoice_number", { length: 100 }),
    invoiceIssuedAt: timestamp("invoice_issued_at", { withTimezone: true }),
    /** Admin notu (örn. "e-Arşiv portalından kesildi") */
    invoiceNotes: text("invoice_notes"),

    // İndirme erişimi — başarılı ödemede doldurulur
    downloadToken: varchar("download_token", { length: 100 }),
    downloadCount: integer("download_count").notNull().default(0),
    downloadExpiresAt: timestamp("download_expires_at", { withTimezone: true }),

    // ── Mail gönderim takibi ──
    /** İlk başarılı mail gönderim zamanı */
    mailSentAt: timestamp("mail_sent_at", { withTimezone: true }),
    /** 'pending' | 'sent' | 'failed' — yeniden deneme için */
    mailStatus: varchar("mail_status", { length: 20 }).default("pending"),
    mailError: text("mail_error"),
    mailAttempts: integer("mail_attempts").notNull().default(0),

    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tokenIdx: uniqueIndex("ebook_purchases_token_unique").on(t.downloadToken),
    emailIdx: index("ebook_purchases_email_idx").on(t.buyerEmail, t.paidAt),
    ebookIdx: index("ebook_purchases_ebook_idx").on(t.ebookId, t.paidAt),
    statusIdx: index("ebook_purchases_status_idx").on(t.paymentStatus, t.createdAt),
    invoiceStatusIdx: index("ebook_purchases_invoice_status_idx").on(t.invoiceStatus, t.paidAt),
    convIdx: index("ebook_purchases_conv_idx").on(t.iyzicoConversationId),
  }),
);

export type Ebook = typeof ebooksTable.$inferSelect;
export type NewEbook = typeof ebooksTable.$inferInsert;
export type EbookPurchase = typeof ebookPurchasesTable.$inferSelect;
export type NewEbookPurchase = typeof ebookPurchasesTable.$inferInsert;
