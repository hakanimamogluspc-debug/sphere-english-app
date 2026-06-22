import cluster from "node:cluster";
import os from "node:os";
import app from "./app";
import { logger } from "./lib/logger";
import { seedDatabase } from "./seed.js";
import { pool, VOCAB_WORDS } from "@workspace/db";

const rawPort = process.env["PORT"] ?? "3000";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// ── Startup migrations — schema değişikliklerini güvenle uygular ─────────────
async function runStartupMigrations() {
  const migrations = [
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS student_number VARCHAR(20)`,
    `ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS level VARCHAR(10)`,
    // GÜVENLİK: Hardcoded e-posta ile otomatik admin yükseltme kaldırıldı.
    // Eski davranış: belirli bir e-postayla kayıt olan kullanıcı otomatik admin oluyordu —
    // saldırgan o e-postayla kayıt olarak yetki yükseltebilirdi.
    // Admin'leri SEED_ADMIN_EMAIL ortam değişkeniyle ata (aşağıda promoteAdminFromEnv).
    // Modül yönetimi tablosu
    `CREATE TABLE IF NOT EXISTS feature_settings (
      id SERIAL PRIMARY KEY,
      key VARCHAR(50) NOT NULL UNIQUE,
      label VARCHAR(100) NOT NULL,
      is_enabled BOOLEAN NOT NULL DEFAULT true,
      visible_to TEXT[] NOT NULL DEFAULT ARRAY['student']::TEXT[],
      category VARCHAR(50) NOT NULL DEFAULT 'general',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    // account_type kolonu — bireysel/kurumsal ayrımı için
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS account_type VARCHAR(20)`,
    // Mevcut öğrencileri sınıflandır
    `UPDATE users SET account_type = 'bireysel' WHERE company_id IS NULL AND role = 'student' AND account_type IS NULL`,
    `UPDATE users SET account_type = 'kurumsal' WHERE company_id IS NOT NULL AND role = 'student' AND account_type IS NULL`,
    // Varsayılan modülleri ekle (zaten varsa atla)
    `INSERT INTO feature_settings (key, label, is_enabled, visible_to, category) VALUES
      ('student-materials',           'Materyallerim',          true, ARRAY['student']::TEXT[],             'student'),
      ('student-live-classes',        'Ders Takvimim',          true, ARRAY['student']::TEXT[],             'student'),
      ('student-quizzes',             'Alıştırmalar',           true, ARRAY['student']::TEXT[],             'student'),
      ('student-speaking-club',       'Speaking Club',          true, ARRAY['student']::TEXT[],             'student'),
      ('student-pronunciation-coach', 'Telaffuz Koçu',          true, ARRAY['student']::TEXT[],             'student'),
      ('student-writing-coach',       'Yazma Koçu',             true, ARRAY['student']::TEXT[],             'student'),
      ('student-forum',               'Forum',                  true, ARRAY['student']::TEXT[],             'student'),
      ('student-progress',            'İlerleme Durumum',       true, ARRAY['student']::TEXT[],             'student'),
      ('student-certificates',        'Sertifikalar',           true, ARRAY['student']::TEXT[],             'student'),
      ('student-leaderboard',         'Sıralama',               true, ARRAY['student']::TEXT[],             'student'),
      ('teacher-materials',           'Materyaller',            true, ARRAY['teacher','admin']::TEXT[],     'teacher'),
      ('teacher-live-classes',        'Canlı Oturumlar',        true, ARRAY['teacher','admin']::TEXT[],     'teacher'),
      ('teacher-quizzes',             'Quiz Yönetimi',          true, ARRAY['teacher','admin']::TEXT[],     'teacher'),
      ('teacher-speaking-club',       'Speaking Club',          true, ARRAY['teacher','admin']::TEXT[],     'teacher'),
      ('student-vocab-game',           'Kelime Oyunu',           true, ARRAY['student']::TEXT[],             'student')
    ON CONFLICT (key) DO NOTHING`,
    // Ensure vocab-game and forum are always enabled (fix for production deployments)
    `UPDATE feature_settings SET is_enabled = true, visible_to = ARRAY['student']::TEXT[] WHERE key IN ('student-vocab-game', 'student-forum')`,
    // AI Studio modülleri — grammar coach ve simulation mode ekle
    `INSERT INTO feature_settings (key, label, is_enabled, visible_to, category) VALUES
      ('student-grammar-coach',    'Dilbilgisi Koçu', true, ARRAY['student']::TEXT[], 'ai-studio'),
      ('student-simulation-mode',  'İş Senaryoları',  true, ARRAY['student']::TEXT[], 'ai-studio')
    ON CONFLICT (key) DO NOTHING`,
    // Mevcut AI Studio modüllerini ai-studio kategorisine taşı
    `UPDATE feature_settings SET category = 'ai-studio' WHERE key IN ('student-pronunciation-coach', 'student-writing-coach', 'student-vocab-game')`,
    // student-courses modülünü ekle (yoksa)
    `INSERT INTO feature_settings (key, label, is_enabled, visible_to, category) VALUES
      ('student-courses', 'Kurslarım', true, ARRAY['student']::TEXT[], 'student')
    ON CONFLICT (key) DO NOTHING`,
    `CREATE TABLE IF NOT EXISTS vocab_words (
      id SERIAL PRIMARY KEY,
      word TEXT NOT NULL,
      turkish TEXT NOT NULL,
      image_prompt TEXT NOT NULL,
      level TEXT NOT NULL,
      category TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS vocab_game_sessions (
      id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
      username TEXT NOT NULL,
      level TEXT NOT NULL,
      total_words INTEGER NOT NULL DEFAULT 10,
      score INTEGER NOT NULL DEFAULT 0,
      hints_used INTEGER NOT NULL DEFAULT 0,
      words_correct INTEGER NOT NULL DEFAULT 0,
      words_seen INTEGER NOT NULL DEFAULT 0,
      is_finished BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS vocab_session_words (
      id SERIAL PRIMARY KEY,
      session_id VARCHAR(36) NOT NULL,
      word_id INTEGER NOT NULL,
      word_index INTEGER NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      hint_used BOOLEAN NOT NULL DEFAULT false,
      is_correct BOOLEAN,
      is_skipped BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
    // Seviye testi tamamlandı mı? Yeni öğrenciler sisteme girmeden önce bu testi yapmalı.
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS placement_test_completed BOOLEAN NOT NULL DEFAULT false`,
    // Mevcut kullanıcılar için testi tamamlanmış say (sadece yeni kayıt olanlar zorunlu)
    `UPDATE users SET placement_test_completed = true WHERE placement_test_completed = false AND created_at < NOW() - INTERVAL '2 minutes'`,
    // ─── Performans indexleri ─────────────────────────────────────────────────
    `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`,
    `CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id)`,
    `CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`,
    `CREATE INDEX IF NOT EXISTS idx_users_placement ON users(placement_test_completed)`,
    `CREATE INDEX IF NOT EXISTS idx_vocab_words_level ON vocab_words(level)`,
    `CREATE INDEX IF NOT EXISTS idx_vocab_sessions_username ON vocab_game_sessions(username)`,
    `CREATE INDEX IF NOT EXISTS idx_vocab_session_words_session ON vocab_session_words(session_id)`,
    // Anlık çevrimiçi kullanıcı takibi — her worker aynı DB'ye yazar
    `CREATE TABLE IF NOT EXISTS user_presence (
      user_id INTEGER PRIMARY KEY,
      name VARCHAR(100) NOT NULL DEFAULT '',
      role VARCHAR(20) NOT NULL DEFAULT 'student',
      page VARCHAR(300) NOT NULL DEFAULT '/',
      last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    // E-posta takip sütunları — kampanya açılma/tıklama istatistikleri
    `ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS opened_count INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS clicked_count INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS delivered_count INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS bounced_count INTEGER NOT NULL DEFAULT 0`,
    // E-posta olayları tablosu — Resend webhook ile dolar
    `CREATE TABLE IF NOT EXISTS email_events (
      id SERIAL PRIMARY KEY,
      campaign_id INTEGER,
      resend_email_id TEXT,
      recipient_email TEXT,
      event_type TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_email_events_campaign ON email_events(campaign_id)`,
    `CREATE INDEX IF NOT EXISTS idx_email_events_resend_id ON email_events(resend_email_id)`,
    // Seviye geçme sınavları — CEFR başına Oxford Business Result tabanlı
    `CREATE TABLE IF NOT EXISTS level_exam_attempts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      cefr_level TEXT NOT NULL,
      score INTEGER NOT NULL DEFAULT 0,
      total INTEGER NOT NULL,
      percent INTEGER NOT NULL DEFAULT 0,
      passed BOOLEAN NOT NULL DEFAULT false,
      answers JSONB NOT NULL DEFAULT '[]'::jsonb,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_level_exam_attempts_user ON level_exam_attempts(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_level_exam_attempts_user_level ON level_exam_attempts(user_id, cefr_level)`,
    // Feature setting — sidebar'da gözüksün
    `INSERT INTO feature_settings (key, label, is_enabled, visible_to, category) VALUES
      ('student-level-exams', 'Seviye Geçme Sınavı', true, ARRAY['student','admin']::TEXT[], 'student')
    ON CONFLICT (key) DO UPDATE SET is_enabled = true, visible_to = EXCLUDED.visible_to, category = EXCLUDED.category`,
    // Abonelik tablosu — provider-agnostic (Iyzico ileride plug-in)
    `CREATE TABLE IF NOT EXISTS subscriptions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      plan_key TEXT,
      status TEXT NOT NULL DEFAULT 'none',
      trial_started_at TIMESTAMPTZ,
      trial_ends_at TIMESTAMPTZ,
      current_period_start TIMESTAMPTZ,
      current_period_end TIMESTAMPTZ,
      cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
      canceled_at TIMESTAMPTZ,
      granted_by_admin_id INTEGER,
      provider TEXT,
      provider_subscription_id TEXT,
      provider_customer_id TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_user_id_unique ON subscriptions(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status)`,
    // Veritabanı seviyesinde enum kısıtları (text + CHECK) — geçersiz state'leri ekleyemesin
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='subscriptions_status_check') THEN
         ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_status_check
           CHECK (status IN ('none','trialing','active','past_due','canceled','expired'));
       END IF;
       IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='subscriptions_plan_key_check') THEN
         ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_plan_key_check
           CHECK (plan_key IS NULL OR plan_key IN ('pro_monthly','pro_yearly'));
       END IF;
     END $$`,
    // Genel "abonelik kilitlemesi açık mı?" anahtarı — Iyzico hazır olana kadar kapalı
    `INSERT INTO feature_settings (key, label, is_enabled, visible_to, category) VALUES
      ('subscription-enforcement', 'Abonelik Kilitleri (Pro paywall)', false, ARRAY['admin']::TEXT[], 'system')
      ON CONFLICT (key) DO NOTHING`,
    // ─── Iyzico için subscriptions tablosunu genişlet ────────────────────────
    // Yeni kolonlar: plan etiketi, tutar, faturalama tipi, süre, dönem bilgileri
    `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS plan_label VARCHAR(200)`,
    `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS amount DECIMAL(12,2)`,
    `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'TRY'`,
    `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS billing_type VARCHAR(30)`,
    `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS duration_months INTEGER`,
    `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ`,
    `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ`,
    `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS provider_conversation_id TEXT`,
    `CREATE INDEX IF NOT EXISTS idx_subscriptions_expires_at ON subscriptions(status, expires_at)`,
    // Eski CHECK constraint'leri kaldır — yeni status ve plan_key değerleri için yer aç
    `DO $$ BEGIN
       IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='subscriptions_status_check') THEN
         ALTER TABLE subscriptions DROP CONSTRAINT subscriptions_status_check;
       END IF;
       IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='subscriptions_plan_key_check') THEN
         ALTER TABLE subscriptions DROP CONSTRAINT subscriptions_plan_key_check;
       END IF;
     END $$`,
    // Yeni geniş status set'i
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='subscriptions_status_check_v2') THEN
         ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_status_check_v2
           CHECK (status IN ('none','pending','trialing','active','past_due','canceled','expired','failed'));
       END IF;
     END $$`,
    // ─── Iyzico ödeme olay geçmişi (audit trail) ─────────────────────────────
    `CREATE TABLE IF NOT EXISTS payments (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      subscription_id INTEGER,
      event_type VARCHAR(50) NOT NULL,
      status VARCHAR(30) NOT NULL,
      amount DECIMAL(12,2),
      currency VARCHAR(3) DEFAULT 'TRY',
      provider VARCHAR(30) DEFAULT 'iyzico',
      provider_payment_id VARCHAR(200),
      provider_conversation_id VARCHAR(200),
      iyzico_token VARCHAR(400),
      error_code VARCHAR(100),
      error_message TEXT,
      raw_payload JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS payments_user_idx ON payments(user_id, created_at)`,
    `CREATE INDEX IF NOT EXISTS payments_subscription_idx ON payments(subscription_id)`,
    `CREATE INDEX IF NOT EXISTS payments_conversation_idx ON payments(provider_conversation_id)`,
    `CREATE INDEX IF NOT EXISTS payments_event_type_idx ON payments(event_type, created_at)`,
    // ─── Eğitmen başvuruları (pazarlama sitesi /egitmen-ol formu) ───────────
    `CREATE TABLE IF NOT EXISTS teacher_applications (
      id SERIAL PRIMARY KEY,
      full_name VARCHAR(200) NOT NULL,
      email VARCHAR(200) NOT NULL,
      phone VARCHAR(30) NOT NULL,
      birth_date VARCHAR(12) NOT NULL,
      nationality VARCHAR(100) NOT NULL,
      location VARCHAR(200) NOT NULL,
      experience VARCHAR(50) NOT NULL,
      education VARCHAR(50) NOT NULL,
      english_level VARCHAR(30) NOT NULL,
      certifications TEXT,
      references_text TEXT,
      cv_filename VARCHAR(300),
      cv_mime_type VARCHAR(100),
      cv_size_bytes INTEGER,
      cv_content BYTEA,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      admin_notes TEXT,
      reviewed_by INTEGER,
      reviewed_at TIMESTAMPTZ,
      kvkk_accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      submitter_ip VARCHAR(64),
      user_agent TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    // Eğer eski deploy "references" kolonu ile yarattıysa rename et — yoksa NO-OP
    `ALTER TABLE teacher_applications RENAME COLUMN "references" TO references_text`,
    // references_text yoksa ekle (eski tabloya migrate edenler için ek güvenlik)
    `ALTER TABLE teacher_applications ADD COLUMN IF NOT EXISTS references_text TEXT`,
    `CREATE INDEX IF NOT EXISTS teacher_apps_status_idx ON teacher_applications(status, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS teacher_apps_email_idx ON teacher_applications(email)`,
    // Sidebar entry + admin role
    `INSERT INTO feature_settings (key, label, is_enabled, visible_to, category) VALUES
      ('admin-teacher-applications', 'Eğitmen Başvuruları', true, ARRAY['admin']::TEXT[], 'admin')
      ON CONFLICT (key) DO NOTHING`,
    // Yeni AI Studio modülleri — interview-sim, presentation-sim, ai-quiz, ai-tutor, learning-path
    `INSERT INTO feature_settings (key, label, is_enabled, visible_to, category) VALUES
      ('student-interview-sim',     'Mülakat Simülatörü',     true, ARRAY['student','bireysel_ogrenci','kurumsal_ogrenci','admin']::TEXT[], 'ai-studio'),
      ('student-presentation-sim',  'Sunum Simülatörü',       true, ARRAY['student','bireysel_ogrenci','kurumsal_ogrenci','admin']::TEXT[], 'ai-studio'),
      ('student-ai-quiz',           'Akıllı Quiz Üretici',    true, ARRAY['student','bireysel_ogrenci','kurumsal_ogrenci','admin']::TEXT[], 'ai-studio'),
      ('student-ai-tutor',          'Kişisel AI Öğretmen',    true, ARRAY['student','bireysel_ogrenci','kurumsal_ogrenci','admin']::TEXT[], 'ai-studio'),
      ('student-learning-path',     'Adaptif Öğrenme Yolu',   true, ARRAY['student','bireysel_ogrenci','kurumsal_ogrenci','admin']::TEXT[], 'ai-studio')
      ON CONFLICT (key) DO NOTHING`,
    // Kurumsal AI raporu
    `INSERT INTO feature_settings (key, label, is_enabled, visible_to, category) VALUES
      ('corporate-ai-report', 'AI Performans Raporu', true, ARRAY['admin']::TEXT[], 'corporate')
      ON CONFLICT (key) DO NOTHING`,
    // Sidebar'da görünsün
    `INSERT INTO feature_settings (key, label, is_enabled, visible_to, category) VALUES
      ('student-subscription', 'Aboneliğim', true, ARRAY['student']::TEXT[], 'student'),
      ('admin-subscriptions', 'Abonelikler', true, ARRAY['admin']::TEXT[], 'admin')
    ON CONFLICT (key) DO UPDATE SET is_enabled = true, visible_to = EXCLUDED.visible_to, category = EXCLUDED.category`,

    // ─── AI Studio yeni özellikler için tablolar ────────────────────────────
    // Pronunciation assessments (T001)
    `CREATE TABLE IF NOT EXISTS pronunciation_assessments (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      teacher_id VARCHAR(64) NOT NULL,
      teacher_name VARCHAR(64) NOT NULL,
      duration_seconds INTEGER NOT NULL DEFAULT 0,
      message_count INTEGER NOT NULL DEFAULT 0,
      avg_score INTEGER NOT NULL DEFAULT 0,
      estimated_cefr VARCHAR(8) NOT NULL,
      cefr_confidence VARCHAR(16) NOT NULL DEFAULT 'medium',
      strengths JSONB NOT NULL DEFAULT '[]'::JSONB,
      weak_areas JSONB NOT NULL DEFAULT '{"phonemes":[],"grammar":[],"vocabulary":[],"fluency":[]}'::JSONB,
      recommendations JSONB NOT NULL DEFAULT '[]'::JSONB,
      ai_summary TEXT NOT NULL DEFAULT '',
      transcript_summary JSONB NOT NULL DEFAULT '[]'::JSONB,
      raw_metrics JSONB NOT NULL DEFAULT '{"totalGrammarErrors":0,"totalVocabSuggestions":0,"totalPronunciationTips":0,"lowConfidenceWords":[]}'::JSONB,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS pron_assess_user_created_idx ON pronunciation_assessments (user_id, created_at)`,

    // Notifications (T002)
    `CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind VARCHAR(48) NOT NULL,
      title VARCHAR(160) NOT NULL,
      body TEXT NOT NULL,
      action_url VARCHAR(256),
      icon_kind VARCHAR(32) NOT NULL DEFAULT 'bell',
      priority VARCHAR(16) NOT NULL DEFAULT 'normal',
      metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
      read_at TIMESTAMP,
      emailed_at TIMESTAMP,
      dedupe_key VARCHAR(128),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS notif_user_created_idx ON notifications (user_id, created_at)`,
    `CREATE INDEX IF NOT EXISTS notif_user_unread_idx ON notifications (user_id, read_at)`,
    `CREATE INDEX IF NOT EXISTS notif_dedupe_idx ON notifications (user_id, dedupe_key)`,
    `CREATE TABLE IF NOT EXISTS notification_preferences (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      email_enabled BOOLEAN NOT NULL DEFAULT true,
      in_app_enabled BOOLEAN NOT NULL DEFAULT true,
      streak_risk_email BOOLEAN NOT NULL DEFAULT true,
      inactivity_email BOOLEAN NOT NULL DEFAULT true,
      new_assessment_email BOOLEAN NOT NULL DEFAULT true,
      level_up_email BOOLEAN NOT NULL DEFAULT true,
      new_quiz_email BOOLEAN NOT NULL DEFAULT false,
      weekly_digest_email BOOLEAN NOT NULL DEFAULT true,
      last_email_sent_at TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,

    // Interview Simulator (T003)
    `CREATE TABLE IF NOT EXISTS interview_sessions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status VARCHAR(16) NOT NULL DEFAULT 'active',
      setup JSONB NOT NULL,
      transcript JSONB NOT NULL DEFAULT '[]'::JSONB,
      questions_asked INTEGER NOT NULL DEFAULT 0,
      target_questions INTEGER NOT NULL DEFAULT 8,
      current_phase VARCHAR(24) NOT NULL DEFAULT 'intro',
      report JSONB,
      duration_sec INTEGER NOT NULL DEFAULT 0,
      started_at TIMESTAMP NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS interview_user_idx ON interview_sessions (user_id, created_at)`,
    `CREATE INDEX IF NOT EXISTS interview_status_idx ON interview_sessions (user_id, status)`,

    // Presentation Simulator (T004)
    `CREATE TABLE IF NOT EXISTS presentation_sessions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status VARCHAR(16) NOT NULL DEFAULT 'recording',
      setup JSONB NOT NULL,
      presentation_transcript TEXT,
      qa_turns JSONB NOT NULL DEFAULT '[]'::JSONB,
      target_qa_turns INTEGER NOT NULL DEFAULT 2,
      report JSONB,
      duration_sec INTEGER NOT NULL DEFAULT 0,
      started_at TIMESTAMP NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS presentation_user_idx ON presentation_sessions (user_id, created_at)`,
    `CREATE INDEX IF NOT EXISTS presentation_status_idx ON presentation_sessions (user_id, status)`,

    // AI Quiz (T005)
    `CREATE TABLE IF NOT EXISTS ai_quiz_sessions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(200) NOT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'ready',
      setup JSONB NOT NULL,
      questions JSONB NOT NULL DEFAULT '[]'::JSONB,
      answers JSONB NOT NULL DEFAULT '[]'::JSONB,
      report JSONB,
      time_taken_sec INTEGER,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      submitted_at TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS ai_quiz_user_idx ON ai_quiz_sessions (user_id, created_at)`,

    // AI Tutor (T006)
    `CREATE TABLE IF NOT EXISTS ai_tutor_conversations (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(200) NOT NULL DEFAULT 'Yeni Sohbet',
      focus_area VARCHAR(60),
      archived BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      last_message_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS ai_tutor_convo_user_idx ON ai_tutor_conversations (user_id, last_message_at)`,
    `CREATE TABLE IF NOT EXISTS ai_tutor_messages (
      id SERIAL PRIMARY KEY,
      conversation_id INTEGER NOT NULL REFERENCES ai_tutor_conversations(id) ON DELETE CASCADE,
      role VARCHAR(16) NOT NULL,
      content TEXT NOT NULL,
      meta JSONB,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS ai_tutor_msg_convo_idx ON ai_tutor_messages (conversation_id, created_at)`,
    `CREATE TABLE IF NOT EXISTS ai_tutor_memory (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      facts JSONB NOT NULL DEFAULT '[]'::JSONB,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS ai_tutor_memory_user_idx ON ai_tutor_memory (user_id)`,

    // Learning Paths (T007)
    `CREATE TABLE IF NOT EXISTS learning_paths (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(200) NOT NULL DEFAULT 'Kişisel Öğrenme Yolun',
      cefr_at_generation VARCHAR(8),
      is_active BOOLEAN NOT NULL DEFAULT true,
      plan JSONB NOT NULL,
      progress JSONB NOT NULL DEFAULT '{}'::JSONB,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS learning_paths_user_idx ON learning_paths (user_id, is_active)`,
    // Günlük kullanıcı aktivite tablosu — admin analytics dashboard için
    `CREATE TABLE IF NOT EXISTS user_daily_activity (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      module VARCHAR(50) NOT NULL DEFAULT 'general',
      minutes INTEGER NOT NULL DEFAULT 0,
      last_updated TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS user_daily_activity_unique ON user_daily_activity (user_id, date, module)`,
    `CREATE INDEX IF NOT EXISTS user_daily_activity_date_idx ON user_daily_activity (date DESC)`,
    `CREATE INDEX IF NOT EXISTS user_daily_activity_user_idx ON user_daily_activity (user_id, date DESC)`,
    // Chatbot FAQ tablosu
    `CREATE TABLE IF NOT EXISTS chatbot_faqs (
      id SERIAL PRIMARY KEY,
      category TEXT,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      keywords TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_by INTEGER,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS chatbot_faqs_active_idx ON chatbot_faqs (is_active)`,
    `CREATE INDEX IF NOT EXISTS chatbot_faqs_sort_idx ON chatbot_faqs (sort_order)`,
    // Chatbot konuşmaları (lead capture + analytics)
    `CREATE TABLE IF NOT EXISTS chatbot_conversations (
      id SERIAL PRIMARY KEY,
      session_id TEXT NOT NULL,
      messages JSONB NOT NULL DEFAULT '[]'::JSONB,
      lead_email TEXT,
      lead_name TEXT,
      lead_company TEXT,
      lead_captured_at TIMESTAMP,
      user_agent TEXT,
      ip TEXT,
      referrer TEXT,
      page_url TEXT,
      message_count INTEGER NOT NULL DEFAULT 0,
      is_resolved BOOLEAN NOT NULL DEFAULT false,
      started_at TIMESTAMP NOT NULL DEFAULT NOW(),
      last_message_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS chatbot_conversations_session_unique ON chatbot_conversations (session_id)`,
    `CREATE INDEX IF NOT EXISTS chatbot_conversations_lead_idx ON chatbot_conversations (lead_email)`,
    `CREATE INDEX IF NOT EXISTS chatbot_conversations_started_idx ON chatbot_conversations (started_at DESC)`,
    // Eski deploy'lardan kalmış olabilecek versiyonlar için kolon eklemeleri
    `ALTER TABLE chatbot_conversations ADD COLUMN IF NOT EXISTS started_at TIMESTAMP NOT NULL DEFAULT NOW()`,
    `ALTER TABLE chatbot_conversations ADD COLUMN IF NOT EXISTS is_resolved BOOLEAN NOT NULL DEFAULT false`,
    `ALTER TABLE chatbot_conversations ADD COLUMN IF NOT EXISTS message_count INTEGER NOT NULL DEFAULT 0`,
  ];
  for (const sql of migrations) {
    try {
      await pool.query(sql);
      logger.info({ sql: sql.slice(0, 60) }, "Startup migration applied");
    } catch (err: any) {
      logger.warn({ sql: sql.slice(0, 60), err: err.message }, "Startup migration skipped");
    }
  }
}

// ── Admin promotion (env-controlled, opt-in) ─────────────────────────────────
// Belirli bir kullanıcıyı admin yapmak için SEED_ADMIN_EMAIL'i ayarla.
// Hardcoded fallback yok — env yoksa bu fonksiyon hiçbir şey yapmaz.
// Yalnızca daha önce kayıt olmuş bir kullanıcıyı yükseltir; kayıt etmez.
async function promoteAdminFromEnv() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  if (!email) return;
  try {
    const result = await pool.query(
      `UPDATE users SET role = 'admin' WHERE email = $1 AND role != 'admin' RETURNING id`,
      [email]
    );
    if (result.rowCount && result.rowCount > 0) {
      logger.info({ email }, "Admin role assigned from SEED_ADMIN_EMAIL");
    }
  } catch (err: any) {
    logger.warn({ err: err.message, email }, "Admin promotion skipped");
  }
}

async function seedVocabWords() {
  try {
    const { rows } = await pool.query("SELECT COUNT(*) as count FROM vocab_words");
    const count = parseInt(rows[0].count, 10);
    if (count > 0) {
      logger.info({ count }, "Vocab words already seeded, skipping");
      return;
    }
    const placeholders: string[] = [];
    const values: string[] = [];
    let idx = 1;
    for (const w of VOCAB_WORDS) {
      placeholders.push(`($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4})`);
      values.push(w.word, w.turkish, w.imagePrompt, w.level, w.category);
      idx += 5;
    }
    await pool.query(
      `INSERT INTO vocab_words (word, turkish, image_prompt, level, category) VALUES ${placeholders.join(",")}`,
      values
    );
    logger.info({ count: VOCAB_WORDS.length }, "Vocab words seeded successfully");
  } catch (err: any) {
    logger.warn({ err: err.message }, "Vocab word seeding skipped");
  }
}

// ─── Cluster modu — tüm CPU çekirdeklerini kullan ────────────────────────────
if (cluster.isPrimary) {
  // Sadece primary süreç migration + seed çalıştırır
  runStartupMigrations()
    .then(() => seedDatabase())
    .then(() => seedVocabWords())
    .then(() => promoteAdminFromEnv())
    .then(() => {
      const numWorkers = Math.max(1, Math.min(os.cpus().length, 8));
      logger.info({ workers: numWorkers, cpus: os.cpus().length }, "Cluster başlatılıyor");
      for (let i = 0; i < numWorkers; i++) {
        cluster.fork();
      }
      cluster.on("exit", (worker, code, signal) => {
        logger.warn({ pid: worker.process.pid, code, signal }, "Worker düştü, yeniden başlatılıyor");
        cluster.fork(); // Çöken worker'ı otomatik yeniden başlat
      });
    })
    .catch((err) => {
      logger.error({ err }, "Başlangıç hatası, sunucu kapatılıyor");
      process.exit(1);
    });
} else {
  // Worker süreçler sadece HTTP isteklerini dinler
  const server = app.listen(port, "0.0.0.0", (err) => {
    if (err) {
      logger.error({ err }, "Port dinleme hatası");
      process.exit(1);
    }
    logger.info({ port, pid: process.pid, worker: cluster.worker?.id }, "Worker hazır");
  });

  // ─── Graceful shutdown — deploy sırasında aktif istekleri kesmeden kapat ───
  const shutdown = (signal: string) => {
    logger.info({ signal, pid: process.pid }, "Kapatma sinyali alındı, yeni bağlantılar durduruldu");
    server.close(() => {
      logger.info({ pid: process.pid }, "HTTP server kapandı, DB pool temizleniyor");
      pool.end().then(() => {
        logger.info({ pid: process.pid }, "Temiz kapatma tamamlandı");
        process.exit(0);
      }).catch(() => process.exit(0));
    });
    // 15 saniyede kapanmazsa zorla kapat (takılı kalmayı önler)
    setTimeout(() => {
      logger.warn({ pid: process.pid }, "Graceful shutdown zaman aşımı, zorla kapatılıyor");
      process.exit(1);
    }, 15_000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT",  () => shutdown("SIGINT"));
}
