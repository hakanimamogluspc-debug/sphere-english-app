-- =====================================================================
-- Vocab Schema Improvements — 2026-10-09
--
-- Non-destructive, idempotent migration. Hiçbir mevcut tablo/kolon
-- silinmez, veri kaybı yok. Prod'da güvenle çalışır.
--
-- Çalıştırma (Easypanel sphere-api container shell):
--   psql "$DATABASE_URL" -f lib/db/migrations/202610_vocab_schema_improvements.sql
-- =====================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────
-- 1. vocab_words → yeni nullable alanlar + indexler
-- ────────────────────────────────────────────────────────────────────
ALTER TABLE vocab_words ADD COLUMN IF NOT EXISTS pronunciation TEXT;
ALTER TABLE vocab_words ADD COLUMN IF NOT EXISTS part_of_speech VARCHAR(32);
ALTER TABLE vocab_words ADD COLUMN IF NOT EXISTS example_sentence TEXT;
ALTER TABLE vocab_words ADD COLUMN IF NOT EXISTS example_sentence_tr TEXT;
ALTER TABLE vocab_words ADD COLUMN IF NOT EXISTS audio_url TEXT;
ALTER TABLE vocab_words ADD COLUMN IF NOT EXISTS synonyms TEXT[];
ALTER TABLE vocab_words ADD COLUMN IF NOT EXISTS antonyms TEXT[];
ALTER TABLE vocab_words ADD COLUMN IF NOT EXISTS frequency_rank INTEGER;
ALTER TABLE vocab_words ADD COLUMN IF NOT EXISTS difficulty INTEGER;
ALTER TABLE vocab_words ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW();

-- UYARI: Bu unique index lower(word) üzerinde — eğer DB'de
-- case-insensitive duplicate kelimeler varsa HATA verir ve ROLLBACK olur.
-- Önceden kontrol için şu sorguyu çalıştır:
--   SELECT lower(word), count(*) FROM vocab_words GROUP BY lower(word) HAVING count(*) > 1;
-- Boş dönerse güvenle devam.
CREATE UNIQUE INDEX IF NOT EXISTS vocab_words_word_lower_unique ON vocab_words (lower(word));

CREATE INDEX IF NOT EXISTS vocab_words_level_idx ON vocab_words (level);
CREATE INDEX IF NOT EXISTS vocab_words_category_idx ON vocab_words (category);
CREATE INDEX IF NOT EXISTS vocab_words_level_category_idx ON vocab_words (level, category);
CREATE INDEX IF NOT EXISTS vocab_words_frequency_idx ON vocab_words (frequency_rank);

-- ────────────────────────────────────────────────────────────────────
-- 2. vocab_game_sessions → user_id FK + finished_at + indexler
-- ────────────────────────────────────────────────────────────────────
ALTER TABLE vocab_game_sessions
  ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE vocab_game_sessions
  ADD COLUMN IF NOT EXISTS finished_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS vocab_sessions_user_idx ON vocab_game_sessions (user_id);
CREATE INDEX IF NOT EXISTS vocab_sessions_username_idx ON vocab_game_sessions (username);
CREATE INDEX IF NOT EXISTS vocab_sessions_finished_idx ON vocab_game_sessions (is_finished, score);

-- ────────────────────────────────────────────────────────────────────
-- 3. vocab_session_words → FK'ler + unique(session, word)
-- UYARI: Eğer orphan kayıt varsa FK ekleme başarısız olur.
-- Önceden kontrol:
--   SELECT COUNT(*) FROM vocab_session_words sw
--     LEFT JOIN vocab_game_sessions s ON s.id = sw.session_id WHERE s.id IS NULL;
--   SELECT COUNT(*) FROM vocab_session_words sw
--     LEFT JOIN vocab_words w ON w.id = sw.word_id WHERE w.id IS NULL;
-- Her ikisi 0 dönerse güvenle devam.
-- ────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vocab_session_words_session_id_fkey'
  ) THEN
    ALTER TABLE vocab_session_words
      ADD CONSTRAINT vocab_session_words_session_id_fkey
      FOREIGN KEY (session_id) REFERENCES vocab_game_sessions(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vocab_session_words_word_id_fkey'
  ) THEN
    ALTER TABLE vocab_session_words
      ADD CONSTRAINT vocab_session_words_word_id_fkey
      FOREIGN KEY (word_id) REFERENCES vocab_words(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS vocab_session_words_session_idx ON vocab_session_words (session_id);
CREATE UNIQUE INDEX IF NOT EXISTS vocab_session_words_session_word_unique
  ON vocab_session_words (session_id, word_id);

-- ────────────────────────────────────────────────────────────────────
-- 4. user_vocab_progress (yeni tablo — SRS)
-- ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_vocab_progress (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  word_id        INTEGER NOT NULL REFERENCES vocab_words(id) ON DELETE CASCADE,
  times_correct  INTEGER NOT NULL DEFAULT 0,
  times_wrong    INTEGER NOT NULL DEFAULT 0,
  streak         INTEGER NOT NULL DEFAULT 0,
  ease_factor    REAL    NOT NULL DEFAULT 2.5,
  interval_days  INTEGER NOT NULL DEFAULT 0,
  last_seen_at   TIMESTAMP,
  next_review_at TIMESTAMP,
  is_learned     BOOLEAN NOT NULL DEFAULT false,
  is_favorite    BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS user_vocab_progress_user_word_unique
  ON user_vocab_progress (user_id, word_id);
CREATE INDEX IF NOT EXISTS user_vocab_progress_user_review_idx
  ON user_vocab_progress (user_id, next_review_at);
CREATE INDEX IF NOT EXISTS user_vocab_progress_user_fav_idx
  ON user_vocab_progress (user_id, is_favorite);

-- ────────────────────────────────────────────────────────────────────
-- 5. vocab_lists (yeni tablo)
-- ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vocab_lists (
  id          SERIAL PRIMARY KEY,
  owner_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name        VARCHAR(120) NOT NULL,
  description TEXT,
  is_public   BOOLEAN NOT NULL DEFAULT false,
  kind        VARCHAR(32) NOT NULL DEFAULT 'custom',
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS vocab_lists_owner_idx ON vocab_lists (owner_id);
CREATE INDEX IF NOT EXISTS vocab_lists_public_idx ON vocab_lists (is_public);

-- ────────────────────────────────────────────────────────────────────
-- 6. vocab_list_items (yeni tablo)
-- ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vocab_list_items (
  id        SERIAL PRIMARY KEY,
  list_id   INTEGER NOT NULL REFERENCES vocab_lists(id) ON DELETE CASCADE,
  word_id   INTEGER NOT NULL REFERENCES vocab_words(id) ON DELETE CASCADE,
  position  INTEGER,
  note      TEXT,
  added_at  TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS vocab_list_items_list_idx ON vocab_list_items (list_id);
CREATE UNIQUE INDEX IF NOT EXISTS vocab_list_items_list_word_unique
  ON vocab_list_items (list_id, word_id);

COMMIT;
