-- =====================================================================
-- KVKK / sözleşme onayı kaydı — 2026-10-15
-- Kayıt formundaki zorunlu "Kullanım Koşulları + Gizlilik Politikası"
-- onayının zamanı ve sürümü. Mevcut kullanıcılar için NULL kalır
-- (onay kutusu eklenmeden önce kayıt olmuşlar).
--
-- Non-destructive, idempotent.
--   psql "$DATABASE_URL" -P pager=off -f lib/db/migrations/202610_terms_acceptance.sql
-- =====================================================================
BEGIN;
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_version VARCHAR(20);
COMMIT;
