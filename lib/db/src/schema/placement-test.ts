import {
  pgTable, serial, text, timestamp, integer, boolean, varchar, jsonb, index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/**
 * placement_questions — Placement test soru bankası.
 *
 * Önceden hardcoded (frontend TSX + backend ANSWER_KEY) olan 60 soru
 * DB'ye taşındı. Admin daha sonra CRUD endpoint'leri eklendiğinde
 * yeni soru ekleyip pasif edebilir.
 */
export const placementQuestionsTable = pgTable(
  "placement_questions",
  {
    id: serial("id").primaryKey(),
    /** 1-60 arası sıra numarası — frontend/backend uyumluluğu için */
    orderIndex: integer("order_index").notNull(),
    text: text("text").notNull(),
    /** { A: "...", B: "...", C: "...", (opsiyonel D: "...") } */
    options: jsonb("options").$type<Record<string, string>>().notNull(),
    /** Doğru seçenek — "A" | "B" | "C" | "D" */
    correctOption: varchar("correct_option", { length: 1 }).notNull(),
    /** CEFR seviyesi: bu sorunun ait olduğu zorluk kademesi */
    cefrLevel: varchar("cefr_level", { length: 2 }).notNull(),
    /** grammar | vocab | reading | listening (opsiyonel) */
    skill: varchar("skill", { length: 32 }),
    /** 1 (en kolay) - 5 (en zor) — ileride stratified sampling için */
    difficulty: integer("difficulty"),
    /** Pasifleştirilmiş sorular test'e dahil edilmez */
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    orderIdx: index("placement_questions_order_idx").on(t.orderIndex),
    activeIdx: index("placement_questions_active_idx").on(t.isActive, t.orderIndex),
    levelIdx: index("placement_questions_level_idx").on(t.cefrLevel),
  }),
);

/**
 * placement_test_attempts — Placement test deneme kayıtları.
 *
 * level_exam_attempts tablosu zaten var ve jsonb içinde cevapları
 * saklıyor; bu tablo onu replace etmiyor, placement için ÖZEL olarak
 * question-level analytics tutuyor:
 *  - Her soru için user'ın cevabı + doğru/yanlış
 *  - Soru bazlı analitik: hangi soru en çok yanlış yapılıyor
 *  - Süre takibi
 */
export const placementTestAttemptsTable = pgTable(
  "placement_test_attempts",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    /** Toplam doğru cevap sayısı */
    score: integer("score").notNull(),
    /** Toplam soru sayısı */
    total: integer("total").notNull(),
    /** Hesaplanan CEFR seviyesi (A1..C1) */
    cefrLevel: varchar("cefr_level", { length: 2 }).notNull(),
    startedAt: timestamp("started_at").notNull().defaultNow(),
    completedAt: timestamp("completed_at").notNull().defaultNow(),
    /** Testi tamamlama süresi — saniye */
    durationSeconds: integer("duration_seconds"),
    /**
     * Her soru için detaylı sonuç:
     * [{ questionId: 12, userAnswer: "B", correctAnswer: "C", isCorrect: false }, ...]
     */
    questionResults: jsonb("question_results").$type<Array<{
      questionId: number;
      userAnswer: string | null;
      correctAnswer: string;
      isCorrect: boolean;
    }>>().notNull().default([]),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("placement_test_attempts_user_idx").on(t.userId),
    levelIdx: index("placement_test_attempts_level_idx").on(t.cefrLevel),
    completedIdx: index("placement_test_attempts_completed_idx").on(t.completedAt),
  }),
);
