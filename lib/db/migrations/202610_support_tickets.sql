-- =====================================================================
-- Support Tickets — 2026-10-09
--
-- Non-destructive, idempotent. Yeni tablolar; mevcut tablo/kolona
-- dokunulmaz. Veri kaybı yok.
--
-- Çalıştırma (Easypanel sphere-api container shell):
--   psql "$DATABASE_URL" -f lib/db/migrations/202610_support_tickets.sql
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS support_tickets (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER REFERENCES users(id) ON DELETE SET NULL,
  assigned_to_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  kind            VARCHAR(20) NOT NULL DEFAULT 'bug',
  status          VARCHAR(20) NOT NULL DEFAULT 'open',
  severity        VARCHAR(20) NOT NULL DEFAULT 'normal',
  title           VARCHAR(200) NOT NULL,
  body            TEXT NOT NULL,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  resolved_at     TIMESTAMP
);
CREATE INDEX IF NOT EXISTS support_tickets_user_idx ON support_tickets (user_id);
CREATE INDEX IF NOT EXISTS support_tickets_status_idx ON support_tickets (status);
CREATE INDEX IF NOT EXISTS support_tickets_kind_idx ON support_tickets (kind);
CREATE INDEX IF NOT EXISTS support_tickets_severity_idx ON support_tickets (severity);
CREATE INDEX IF NOT EXISTS support_tickets_created_idx ON support_tickets (created_at);

CREATE TABLE IF NOT EXISTS support_ticket_messages (
  id          SERIAL PRIMARY KEY,
  ticket_id   INTEGER NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  author_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  body        TEXT NOT NULL,
  is_internal INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS support_ticket_messages_ticket_idx
  ON support_ticket_messages (ticket_id);

COMMIT;
