import {
  pgTable,
  serial,
  integer,
  varchar,
  text,
  timestamp,
  decimal,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/**
 * Tüm ödeme ve ödeme-eventi geçmişi.
 *
 * Her başarılı/başarısız Iyzico işlemi, recurring tahsilat, refund, ve
 * webhook bildirimi burada bir satır oluşturur. subscriptions tablosu
 * mevcut/aktif durumu tutarken, bu tablo audit trail görevi görür.
 *
 * `eventType` örnekleri:
 *   - "checkout_initialized"   — checkout form oluşturuldu
 *   - "checkout_success"       — kullanıcı kart bilgisini girdi, ilk ödeme başarılı
 *   - "checkout_failed"        — ödeme reddedildi
 *   - "subscription_charged"   — recurring tahsilat başarılı
 *   - "subscription_failed"    — recurring tahsilat başarısız
 *   - "refund"                 — iade işlendi
 *   - "webhook_received"       — Iyzico'dan gelen tüm webhook'ların ham logu
 */
export const paymentsTable = pgTable(
  "payments",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    subscriptionId: integer("subscription_id"),

    eventType: varchar("event_type", { length: 50 }).notNull(),
    status: varchar("status", { length: 30 }).notNull(),  // "success" | "failed" | "pending"

    amount: decimal("amount", { precision: 12, scale: 2 }),
    currency: varchar("currency", { length: 3 }).default("TRY"),

    // Iyzico tarafı
    provider: varchar("provider", { length: 30 }).default("iyzico"),
    providerPaymentId: varchar("provider_payment_id", { length: 200 }),
    providerConversationId: varchar("provider_conversation_id", { length: 200 }),
    iyzicoToken: varchar("iyzico_token", { length: 400 }),

    // Hata sebebi (başarısız ödemelerde)
    errorCode: varchar("error_code", { length: 100 }),
    errorMessage: text("error_message"),

    // Ham webhook/response payload'u — debug ve audit için
    rawPayload: jsonb("raw_payload"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userIdx: index("payments_user_idx").on(t.userId, t.createdAt),
    subIdx: index("payments_subscription_idx").on(t.subscriptionId),
    convIdx: index("payments_conversation_idx").on(t.providerConversationId),
    typeIdx: index("payments_event_type_idx").on(t.eventType, t.createdAt),
  }),
);

export type Payment = typeof paymentsTable.$inferSelect;
export type NewPayment = typeof paymentsTable.$inferInsert;
