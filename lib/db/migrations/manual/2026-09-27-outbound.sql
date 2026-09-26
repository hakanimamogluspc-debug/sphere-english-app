-- B2B Outbound sistem tabloları — R7
-- Manuel çalıştır: Easypanel Postgres console veya psql ile

CREATE TABLE IF NOT EXISTS "outbound_templates" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "body_html" TEXT NOT NULL,
  "body_text" TEXT NOT NULL,
  "segment" TEXT,
  "variables" JSONB,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_by" INTEGER,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "outbound_templates_segment_idx" ON "outbound_templates"("segment");

CREATE TABLE IF NOT EXISTS "outbound_campaigns" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "segment" TEXT NOT NULL,
  "target_criteria" JSONB,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "from_name" TEXT NOT NULL,
  "from_email" TEXT NOT NULL,
  "reply_to_email" TEXT,
  "daily_send_limit" INTEGER NOT NULL DEFAULT 50,
  "send_only_business_hours" BOOLEAN NOT NULL DEFAULT TRUE,
  "timezone" TEXT NOT NULL DEFAULT 'Europe/Istanbul',
  "total_recipients" INTEGER NOT NULL DEFAULT 0,
  "emails_sent" INTEGER NOT NULL DEFAULT 0,
  "emails_opened" INTEGER NOT NULL DEFAULT 0,
  "emails_clicked" INTEGER NOT NULL DEFAULT 0,
  "replies" INTEGER NOT NULL DEFAULT 0,
  "bookings" INTEGER NOT NULL DEFAULT 0,
  "bounces" INTEGER NOT NULL DEFAULT 0,
  "unsubscribes" INTEGER NOT NULL DEFAULT 0,
  "created_by" INTEGER,
  "started_at" TIMESTAMP,
  "completed_at" TIMESTAMP,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "outbound_campaigns_status_idx" ON "outbound_campaigns"("status");
CREATE INDEX IF NOT EXISTS "outbound_campaigns_segment_idx" ON "outbound_campaigns"("segment");

CREATE TABLE IF NOT EXISTS "outbound_sequence_steps" (
  "id" SERIAL PRIMARY KEY,
  "campaign_id" INTEGER NOT NULL,
  "step_order" INTEGER NOT NULL,
  "template_id" INTEGER NOT NULL,
  "delay_days" INTEGER NOT NULL DEFAULT 0,
  "condition" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "outbound_seq_steps_campaign_idx" ON "outbound_sequence_steps"("campaign_id");

CREATE TABLE IF NOT EXISTS "outbound_campaign_leads" (
  "id" SERIAL PRIMARY KEY,
  "campaign_id" INTEGER NOT NULL,
  "lead_id" INTEGER NOT NULL,
  "current_step" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "next_send_at" TIMESTAMP,
  "last_event_at" TIMESTAMP,
  "added_at" TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS "outbound_camp_lead_unique" ON "outbound_campaign_leads"("campaign_id","lead_id");
CREATE INDEX IF NOT EXISTS "outbound_camp_lead_status_idx" ON "outbound_campaign_leads"("status");
CREATE INDEX IF NOT EXISTS "outbound_camp_lead_next_send_idx" ON "outbound_campaign_leads"("next_send_at");

CREATE TABLE IF NOT EXISTS "outbound_email_events" (
  "id" SERIAL PRIMARY KEY,
  "campaign_id" INTEGER NOT NULL,
  "lead_id" INTEGER NOT NULL,
  "step_id" INTEGER,
  "template_id" INTEGER,
  "event_type" TEXT NOT NULL,
  "provider_message_id" TEXT,
  "user_agent" TEXT,
  "ip_address" TEXT,
  "click_url" TEXT,
  "bounce_reason" TEXT,
  "raw_data" JSONB,
  "occurred_at" TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "outbound_events_camp_lead_idx" ON "outbound_email_events"("campaign_id","lead_id");
CREATE INDEX IF NOT EXISTS "outbound_events_type_idx" ON "outbound_email_events"("event_type");
CREATE INDEX IF NOT EXISTS "outbound_events_occurred_idx" ON "outbound_email_events"("occurred_at");

CREATE TABLE IF NOT EXISTS "outbound_meetings" (
  "id" SERIAL PRIMARY KEY,
  "lead_id" INTEGER,
  "campaign_id" INTEGER,
  "calendly_event_uri" TEXT NOT NULL,
  "calendly_invitee_uri" TEXT,
  "calendly_event_type" TEXT,
  "invitee_name" TEXT,
  "invitee_email" TEXT NOT NULL,
  "invitee_company" TEXT,
  "invitee_phone" TEXT,
  "scheduled_at" TIMESTAMP NOT NULL,
  "duration_minutes" INTEGER,
  "meeting_url" TEXT,
  "location" TEXT,
  "questions_answers" JSONB,
  "status" TEXT NOT NULL DEFAULT 'scheduled',
  "outcome" TEXT,
  "notes" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS "outbound_meetings_calendly_unique" ON "outbound_meetings"("calendly_event_uri");
CREATE INDEX IF NOT EXISTS "outbound_meetings_lead_idx" ON "outbound_meetings"("lead_id");
CREATE INDEX IF NOT EXISTS "outbound_meetings_scheduled_idx" ON "outbound_meetings"("scheduled_at");
