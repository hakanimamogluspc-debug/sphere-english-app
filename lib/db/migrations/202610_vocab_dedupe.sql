-- =====================================================================
-- vocab_words duplicate temizliği + lower(word) unique index — 2026-10-14
--
-- Problem: ~231 kelime büyük/küçük harf farkıyla (ör. "Budget" / "budget")
-- iki kez kayıtlı. 202610_vocab_schema_improvements.sql'deki unique index
-- bu yüzden oluşturulamıyordu.
--
-- Strateji (veri kaybı yok):
--   1. Her lower(word) grubu için "kanonik" satır seç: en zengin kayıt
--      (telaffuz + örnek cümle dolu olan), eşitse en düşük id.
--   2. user_vocab_progress: dupe → kanonik taşı; aynı kullanıcıda ikisi de
--      varsa istatistikleri BİRLEŞTİR (toplam doğru/yanlış, en geç görülme,
--      favori/öğrenildi OR), sonra dupe satırı sil.
--   3. vocab_session_words / vocab_list_items: dupe → kanonik taşı; çakışırsa
--      dupe satırı sil (aynı oturum/listede aynı kelime iki kez olmaz).
--   4. Dupe kelimeleri sil (FK'ler artık kanonik'e bakıyor; cascade boş).
--   5. Unique index oluştur.
--
-- İdempotent: dupe yoksa hiçbir şey değişmez, index IF NOT EXISTS.
--
-- Önce bak:
--   psql "$DATABASE_URL" -P pager=off -c \
--     "SELECT lower(word), count(*) FROM vocab_words GROUP BY 1 HAVING count(*)>1 ORDER BY 2 DESC LIMIT 10;"
-- Çalıştır (Easypanel sphere-api container shell):
--   psql "$DATABASE_URL" -P pager=off -f lib/db/migrations/202610_vocab_dedupe.sql
-- =====================================================================

BEGIN;

-- 1. Kanonik eşlemesi
CREATE TEMP TABLE vocab_dupe_map ON COMMIT DROP AS
WITH ranked AS (
  SELECT
    id,
    lower(trim(word)) AS key,
    ROW_NUMBER() OVER (
      PARTITION BY lower(trim(word))
      ORDER BY
        (pronunciation IS NOT NULL AND pronunciation <> '')::int
        + (example_sentence IS NOT NULL AND example_sentence <> '')::int
        + (audio_url IS NOT NULL AND audio_url <> '')::int DESC,
        id ASC
    ) AS rn
  FROM vocab_words
),
keep AS (SELECT key, id AS keep_id FROM ranked WHERE rn = 1)
SELECT r.id AS dupe_id, k.keep_id
FROM ranked r
JOIN keep k ON k.key = r.key
WHERE r.rn > 1;

-- Rapor
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM vocab_dupe_map;
  RAISE NOTICE 'vocab_words dupe sayısı: %', n;
END $$;

-- 2a. user_vocab_progress — kullanıcıda kanonik kayıt da varsa birleştir
UPDATE user_vocab_progress canon
SET
  times_correct  = canon.times_correct + d.times_correct,
  times_wrong    = canon.times_wrong + d.times_wrong,
  streak         = GREATEST(canon.streak, d.streak),
  ease_factor    = GREATEST(canon.ease_factor, d.ease_factor),
  interval_days  = GREATEST(canon.interval_days, d.interval_days),
  last_seen_at   = GREATEST(canon.last_seen_at, d.last_seen_at),
  next_review_at = LEAST(canon.next_review_at, d.next_review_at),
  is_learned     = canon.is_learned OR d.is_learned,
  is_favorite    = canon.is_favorite OR d.is_favorite,
  updated_at     = NOW()
FROM user_vocab_progress d
JOIN vocab_dupe_map m ON m.dupe_id = d.word_id
WHERE canon.user_id = d.user_id AND canon.word_id = m.keep_id;

-- 2b. Birleştirilenleri sil (kanonik satırı olanlar)
DELETE FROM user_vocab_progress d
USING vocab_dupe_map m
WHERE d.word_id = m.dupe_id
  AND EXISTS (SELECT 1 FROM user_vocab_progress c WHERE c.user_id = d.user_id AND c.word_id = m.keep_id);

-- 2c. Kalanları kanonik'e taşı
UPDATE user_vocab_progress d
SET word_id = m.keep_id, updated_at = NOW()
FROM vocab_dupe_map m
WHERE d.word_id = m.dupe_id;

-- 3a. vocab_session_words
DELETE FROM vocab_session_words d
USING vocab_dupe_map m
WHERE d.word_id = m.dupe_id
  AND EXISTS (SELECT 1 FROM vocab_session_words c WHERE c.session_id = d.session_id AND c.word_id = m.keep_id);
UPDATE vocab_session_words d
SET word_id = m.keep_id
FROM vocab_dupe_map m
WHERE d.word_id = m.dupe_id;

-- 3b. vocab_list_items
DELETE FROM vocab_list_items d
USING vocab_dupe_map m
WHERE d.word_id = m.dupe_id
  AND EXISTS (SELECT 1 FROM vocab_list_items c WHERE c.list_id = d.list_id AND c.word_id = m.keep_id);
UPDATE vocab_list_items d
SET word_id = m.keep_id
FROM vocab_dupe_map m
WHERE d.word_id = m.dupe_id;

-- 4. Dupe kelimeleri sil
DELETE FROM vocab_words w USING vocab_dupe_map m WHERE w.id = m.dupe_id;

-- 4b. Baş/son boşlukları da normalize et (ileride yeni dupe oluşmasın)
UPDATE vocab_words SET word = trim(word) WHERE word <> trim(word);

-- 5. Unique index
CREATE UNIQUE INDEX IF NOT EXISTS vocab_words_word_lower_unique ON vocab_words (lower(word));

COMMIT;

-- Doğrulama:
--   SELECT count(*) FROM vocab_words;
--   SELECT lower(word), count(*) FROM vocab_words GROUP BY 1 HAVING count(*)>1;  -- 0 satır beklenir
