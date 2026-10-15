-- =====================================================================
-- Monitoring — 2026-10-15
--   api_metrics_minute : route bazlı dakikalık istek sayısı/süre/hata (worker'lar flush eder)
--   ai_usage_log       : her OpenAI çağrısı — model, token, tahmini maliyet, hangi route
--
-- Non-destructive, idempotent. 30 günden eski satırlar prune edilir (lib/metrics.ts).
--   psql "$DATABASE_URL" -P pager=off -f lib/db/migrations/202610_monitoring.sql
-- =====================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS api_metrics_minute (
  ts_minute     TIMESTAMPTZ NOT NULL,
  route         VARCHAR(200) NOT NULL,
  method        VARCHAR(8) NOT NULL,
  count         INTEGER NOT NULL DEFAULT 0,
  total_ms      BIGINT NOT NULL DEFAULT 0,
  max_ms        INTEGER NOT NULL DEFAULT 0,
  err_count     INTEGER NOT NULL DEFAULT 0,   -- 5xx
  b_fast        INTEGER NOT NULL DEFAULT 0,   -- < 100 ms
  b_ok          INTEGER NOT NULL DEFAULT 0,   -- 100-300
  b_slow        INTEGER NOT NULL DEFAULT 0,   -- 300-1000
  b_very_slow   INTEGER NOT NULL DEFAULT 0,   -- >= 1000
  PRIMARY KEY (ts_minute, route, method)
);
CREATE INDEX IF NOT EXISTS api_metrics_minute_ts_idx ON api_metrics_minute (ts_minute);

CREATE TABLE IF NOT EXISTS ai_usage_log (
  id                 BIGSERIAL PRIMARY KEY,
  ts                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  endpoint           VARCHAR(80) NOT NULL,       -- chat.completions | responses | embeddings | audio.transcriptions | audio.speech | images
  model              VARCHAR(80),
  prompt_tokens      INTEGER NOT NULL DEFAULT 0,
  completion_tokens  INTEGER NOT NULL DEFAULT 0,
  input_chars        INTEGER,                    -- TTS için
  audio_seconds      REAL,                       -- STT için (biliniyorsa)
  cost_usd           NUMERIC(12,6) NOT NULL DEFAULT 0,
  priced             BOOLEAN NOT NULL DEFAULT TRUE,  -- fiyat tablosunda model yoksa false
  route              VARCHAR(200),               -- isteği başlatan API route (AsyncLocalStorage)
  duration_ms        INTEGER,
  status             SMALLINT                    -- HTTP status (OpenAI)
);
CREATE INDEX IF NOT EXISTS ai_usage_log_ts_idx ON ai_usage_log (ts);
CREATE INDEX IF NOT EXISTS ai_usage_log_model_idx ON ai_usage_log (model);

COMMIT;
