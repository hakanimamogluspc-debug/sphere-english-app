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
 * Marketing sitesindeki chatbot için admin tarafından yönetilen FAQ veritabanı.
 * Sistem prompt'a sabit bilgi gömüldükten sonra bu tablo değişken / öğrenebilen
 * bilgi için kullanılır - örneğin yeni kampanyalar, yeni koçlar, yeni fiyatlar.
 */
export const chatbotFaqsTable = pgTable(
  "chatbot_faqs",
  {
    id: serial("id").primaryKey(),

    // Kategori (örn: "Fiyatlandırma", "Kurumsal", "Koçlar", "Teknik")
    category: text("category"),

    // Soru - kullanıcı bunu sormasa bile bot başka kelimelerle eşleştirebilir
    question: text("question").notNull(),

    // Cevap (markdown destekli, bot bunu kendisi okur ve yanıt üretir)
    answer: text("answer").notNull(),

    // Anahtar kelimeler (basit lookup için, virgülle ayrılmış)
    keywords: text("keywords"),

    // Aktif mi (gizli/taslak için)
    isActive: boolean("is_active").notNull().default(true),

    // Sıralama (önemli FAQ'ler önce listelensin)
    sortOrder: integer("sort_order").notNull().default(0),

    createdBy: integer("created_by"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    activeIdx: index("chatbot_faqs_active_idx").on(t.isActive),
    sortIdx: index("chatbot_faqs_sort_idx").on(t.sortOrder),
  }),
);

/**
 * Konuşma kayıtları (analytics + lead capture context).
 * Her oturum bir kayıt. Mesajlar JSON array olarak saklanır.
 */
export const chatbotConversationsTable = pgTable(
  "chatbot_conversations",
  {
    id: serial("id").primaryKey(),

    // Browser fingerprint / oturum ID (cookie veya localStorage)
    sessionId: text("session_id").notNull(),

    // Mesaj listesi: [{role: "user"|"assistant", content: "...", timestamp: "..."}]
    messages: jsonb("messages").notNull().default([]),

    // Lead capture
    leadEmail: text("lead_email"),
    leadName: text("lead_name"),
    leadCompany: text("lead_company"),
    leadCapturedAt: timestamp("lead_captured_at"),

    // Meta
    userAgent: text("user_agent"),
    ip: text("ip"),
    referrer: text("referrer"),
    pageUrl: text("page_url"), // hangi sayfadan başlatıldı

    // İstatistik
    messageCount: integer("message_count").notNull().default(0),
    isResolved: boolean("is_resolved").notNull().default(false), // admin işaretlediğinde

    startedAt: timestamp("started_at").notNull().defaultNow(),
    lastMessageAt: timestamp("last_message_at").notNull().defaultNow(),
  },
  (t) => ({
    sessionUnique: uniqueIndex("chatbot_conversations_session_unique").on(t.sessionId),
    leadIdx: index("chatbot_conversations_lead_idx").on(t.leadEmail),
    startedIdx: index("chatbot_conversations_started_idx").on(t.startedAt),
  }),
);

export type ChatbotFaq = typeof chatbotFaqsTable.$inferSelect;
export type InsertChatbotFaq = typeof chatbotFaqsTable.$inferInsert;
export type ChatbotConversation = typeof chatbotConversationsTable.$inferSelect;
export type InsertChatbotConversation = typeof chatbotConversationsTable.$inferInsert;

export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: string;
};
