import {
  pgTable, serial, text, timestamp, integer, boolean, varchar,
  uniqueIndex, index, real,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { usersTable } from "./users";

/**
 * vocab_words — kelime havuzu.
 *
 * İyileştirmeler (2026-10):
 *  - Zenginleştirici alanlar (pronunciation IPA, partOfSpeech, örnek cümle,
 *    audioUrl, synonyms, antonyms, frequency, difficulty) tümü NULLABLE
 *    eklendi — eski seed/insert'ler kırılmaz.
 *  - word üzerinde CASE-INSENSITIVE unique index (lower(word)).
 *  - level ve category için index (sık filtreleniyor).
 */
export const vocabWordsTable = pgTable(
  "vocab_words",
  {
    id: serial("id").primaryKey(),
    word: text("word").notNull(),
    turkish: text("turkish").notNull(),
    imagePrompt: text("image_prompt").notNull(),
    level: text("level").notNull(),
    category: text("category").notNull(),

    // ─── Yeni alanlar (opsiyonel) ─────────────────────────────
    /** IPA fonetik — ör: /ˈæpəl/ */
    pronunciation: text("pronunciation"),
    /** noun | verb | adjective | adverb | preposition | ... */
    partOfSpeech: varchar("part_of_speech", { length: 32 }),
    /** İngilizce örnek cümle — kelimeyi içermeli */
    exampleSentence: text("example_sentence"),
    /** Örnek cümlenin Türkçe çevirisi */
    exampleSentenceTurkish: text("example_sentence_tr"),
    /** TTS/pronunciation audio dosyası URL'i (opsiyonel) */
    audioUrl: text("audio_url"),
    /** Eş anlamlı kelimeler (küçük liste) */
    synonyms: text("synonyms").array(),
    /** Zıt anlamlı kelimeler */
    antonyms: text("antonyms").array(),
    /** Kelime sıklığı (1 = en yaygın; yükseldikçe daha nadir) */
    frequencyRank: integer("frequency_rank"),
    /** CEFR içinde ince ayar: 1 (kolay) → 5 (zor) */
    difficulty: integer("difficulty"),
    /** Son güncelleme (admin edit'leri için) */
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    // ─────────────────────────────────────────────────────────

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    wordLowerUnique: uniqueIndex("vocab_words_word_lower_unique").on(sql`lower(${t.word})`),
    levelIdx: index("vocab_words_level_idx").on(t.level),
    categoryIdx: index("vocab_words_category_idx").on(t.category),
    levelCategoryIdx: index("vocab_words_level_category_idx").on(t.level, t.category),
    frequencyIdx: index("vocab_words_frequency_idx").on(t.frequencyRank),
  }),
);

/**
 * vocab_game_sessions — bir oyun oturumu.
 *
 * İyileştirmeler:
 *  - userId FK eklendi (nullable, backward compat). Yeni oyunlar
 *    oturum açmış kullanıcıya bağlanabilir; eski kayıtlar username
 *    ile çalışmaya devam eder.
 *  - username'de ve finishedAt'te index (leaderboard sorguları).
 */
export const vocabGameSessionsTable = pgTable(
  "vocab_game_sessions",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    userId: integer("user_id").references(() => usersTable.id, { onDelete: "set null" }),
    username: text("username").notNull(),
    level: text("level").notNull(),
    totalWords: integer("total_words").notNull().default(10),
    score: integer("score").notNull().default(0),
    hintsUsed: integer("hints_used").notNull().default(0),
    wordsCorrect: integer("words_correct").notNull().default(0),
    wordsSeen: integer("words_seen").notNull().default(0),
    isFinished: boolean("is_finished").notNull().default(false),
    /** Oturum bitiş zamanı — leaderboard için */
    finishedAt: timestamp("finished_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("vocab_sessions_user_idx").on(t.userId),
    usernameIdx: index("vocab_sessions_username_idx").on(t.username),
    finishedIdx: index("vocab_sessions_finished_idx").on(t.isFinished, t.score),
  }),
);

/**
 * vocab_session_words — oturumdaki her kelime için durum.
 *
 * İyileştirmeler:
 *  - wordId için FK (ON DELETE CASCADE — kelime silinirse ilgili
 *    session satırları da silinir).
 *  - sessionId için FK (ON DELETE CASCADE).
 *  - (sessionId, wordId) üzerinde unique — çift insert önler.
 */
export const vocabSessionWordsTable = pgTable(
  "vocab_session_words",
  {
    id: serial("id").primaryKey(),
    sessionId: varchar("session_id", { length: 36 })
      .notNull()
      .references(() => vocabGameSessionsTable.id, { onDelete: "cascade" }),
    wordId: integer("word_id")
      .notNull()
      .references(() => vocabWordsTable.id, { onDelete: "cascade" }),
    wordIndex: integer("word_index").notNull(),
    attempts: integer("attempts").notNull().default(0),
    hintUsed: boolean("hint_used").notNull().default(false),
    isCorrect: boolean("is_correct"),
    isSkipped: boolean("is_skipped").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    sessionIdx: index("vocab_session_words_session_idx").on(t.sessionId),
    sessionWordUnique: uniqueIndex("vocab_session_words_session_word_unique").on(
      t.sessionId,
      t.wordId,
    ),
  }),
);

/**
 * user_vocab_progress — Spaced Repetition System (SM-2 benzeri).
 *
 * Her kullanıcı × kelime çifti için öğrenme durumu:
 *  - timesCorrect / timesWrong: toplam istatistik
 *  - streak: ardışık doğru sayısı
 *  - easeFactor: SM-2 ease factor (default 2.5)
 *  - interval: bir sonraki tekrar aralığı (gün)
 *  - lastSeenAt / nextReviewAt: zamanlama
 *  - isLearned: ustalaşıldı mı (ör. interval > 21 gün)
 */
export const userVocabProgressTable = pgTable(
  "user_vocab_progress",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    wordId: integer("word_id")
      .notNull()
      .references(() => vocabWordsTable.id, { onDelete: "cascade" }),

    timesCorrect: integer("times_correct").notNull().default(0),
    timesWrong: integer("times_wrong").notNull().default(0),
    streak: integer("streak").notNull().default(0),

    /** SM-2 ease factor (1.3 - 2.5+ aralığı tipik) */
    easeFactor: real("ease_factor").notNull().default(2.5),
    /** Bir sonraki tekrar aralığı — gün cinsinden */
    intervalDays: integer("interval_days").notNull().default(0),

    lastSeenAt: timestamp("last_seen_at"),
    nextReviewAt: timestamp("next_review_at"),

    isLearned: boolean("is_learned").notNull().default(false),
    isFavorite: boolean("is_favorite").notNull().default(false),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    userWordUnique: uniqueIndex("user_vocab_progress_user_word_unique").on(
      t.userId,
      t.wordId,
    ),
    userReviewIdx: index("user_vocab_progress_user_review_idx").on(
      t.userId,
      t.nextReviewAt,
    ),
    userFavIdx: index("user_vocab_progress_user_fav_idx").on(t.userId, t.isFavorite),
  }),
);

/**
 * vocab_lists — kullanıcı/öğretmen tarafından oluşturulan kelime setleri.
 *   - "Favorilerim", "Bugün öğrendiklerim", "Lesson 3 kelimeleri" gibi
 *   - ownerId null olabilir → sistem/admin listesi (public)
 *   - isPublic → başkaları kopyalayabilir / görebilir
 */
export const vocabListsTable = pgTable(
  "vocab_lists",
  {
    id: serial("id").primaryKey(),
    ownerId: integer("owner_id").references(() => usersTable.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description"),
    isPublic: boolean("is_public").notNull().default(false),
    /** Örn: 'favorites', 'daily', 'lesson', 'custom' */
    kind: varchar("kind", { length: 32 }).notNull().default("custom"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    ownerIdx: index("vocab_lists_owner_idx").on(t.ownerId),
    publicIdx: index("vocab_lists_public_idx").on(t.isPublic),
  }),
);

/**
 * vocab_list_items — liste × kelime bağlantı tablosu.
 */
export const vocabListItemsTable = pgTable(
  "vocab_list_items",
  {
    id: serial("id").primaryKey(),
    listId: integer("list_id")
      .notNull()
      .references(() => vocabListsTable.id, { onDelete: "cascade" }),
    wordId: integer("word_id")
      .notNull()
      .references(() => vocabWordsTable.id, { onDelete: "cascade" }),
    /** Liste içindeki sıralama (opsiyonel) */
    position: integer("position"),
    /** Kullanıcının bu kelime için eklediği not */
    note: text("note"),
    addedAt: timestamp("added_at").notNull().defaultNow(),
  },
  (t) => ({
    listIdx: index("vocab_list_items_list_idx").on(t.listId),
    listWordUnique: uniqueIndex("vocab_list_items_list_word_unique").on(
      t.listId,
      t.wordId,
    ),
  }),
);
