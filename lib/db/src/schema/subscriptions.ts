import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  timestamp,
  uniqueIndex,
  decimal,
  varchar,
  index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/**
 * Geçerli abonelik statüleri.
 * - "none"        — başvuru yok
 * - "pending"     — ödeme başlatıldı, callback bekleniyor (Iyzico)
 * - "trialing"    — deneme süresi (gelecekte kullanılabilir)
 * - "active"      — geçerli abonelik
 * - "past_due"    — ödemede gecikme (recurring failure)
 * - "canceled"    — kullanıcı/admin tarafından iptal edildi
 * - "expired"     — süresi doldu (tek seferlik paketler için)
 * - "failed"      — ödeme başarısız (initial payment)
 */
export type SubscriptionStatus =
  | "none"
  | "pending"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "expired"
  | "failed";

/**
 * Plan kataloğu kodları (artifacts/api-server/src/lib/plans.ts ile senkron).
 * Şu an sabit liste, ileride DB'ye taşınabilir.
 */
export type SubscriptionPlanKey =
  | "pro_monthly"
  | "pro_yearly"
  // Bireysel aylık recurring planlar
  | "bireysel-basic-aylik"
  | "bireysel-standard-aylik"
  | "bireysel-premium-aylik"
  | "bireysel-executive-aylik"
  // Bireysel tek seferlik peşin paketler
  | "bireysel-standard-3aylik"
  | "bireysel-standard-6aylik"
  | "bireysel-standard-yillik"
  | "bireysel-premium-3aylik"
  | "bireysel-premium-6aylik"
  | "bireysel-premium-yillik"
  // Kurumsal teklif (Iyzilink ile manuel oluşturulur)
  | "kurumsal-teklif";

/**
 * Faturalama tipi.
 * - "recurring"        — Iyzico Subscription API, her dönem otomatik tahsilat
 * - "one-time"         — Tek seferlik peşin paket (1/3/6/12 ay), expiresAt'a kadar geçerli
 * - "enterprise-quote" — Kurumsal teklif, manuel Iyzilink ile alınır
 */
export type BillingType = "recurring" | "one-time" | "enterprise-quote";

export const subscriptionsTable = pgTable(
  "subscriptions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),

    // Plan tanımı — kod, etiket, fiyat
    planKey: text("plan_key"),
    planLabel: varchar("plan_label", { length: 200 }),
    amount: decimal("amount", { precision: 12, scale: 2 }),
    currency: varchar("currency", { length: 3 }).default("TRY"),
    billingType: varchar("billing_type", { length: 30 }),
    // Tek seferlik paketlerde ay sayısı (1/3/6/12). Recurring'de null.
    durationMonths: integer("duration_months"),

    status: text("status").notNull().default("none"),

    // Sürelendirme
    trialStartedAt: timestamp("trial_started_at", { withTimezone: true }),
    trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),

    // İptal
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),

    // Admin atama (manuel comp veya enterprise için)
    grantedByAdminId: integer("granted_by_admin_id"),

    // Provider tarafı (Iyzico)
    provider: text("provider"),                                       // "iyzico" | "manual"
    providerSubscriptionId: text("provider_subscription_id"),         // Iyzico subscription ref
    providerCustomerId: text("provider_customer_id"),                 // Iyzico customer ref
    providerConversationId: text("provider_conversation_id"),         // Son checkout conversation id

    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    // Bir kullanıcının tek satırı (status="none" default ile boş başlar) —
    // yeni alımlar bu satırı update eder, geçmiş ödemeler `payments` tablosunda.
    userIdx: uniqueIndex("subscriptions_user_id_unique").on(t.userId),
    statusIdx: index("subscriptions_status_idx").on(t.status, t.expiresAt),
  })
);

export type Subscription = typeof subscriptionsTable.$inferSelect;
export type NewSubscription = typeof subscriptionsTable.$inferInsert;
