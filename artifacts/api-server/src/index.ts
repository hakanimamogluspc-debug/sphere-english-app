import { initSentry } from "./lib/sentry.js";
import { startBackupCron } from "./lib/db-backup.js";
import { startEbookRecoveryCron } from "./lib/ebook-recovery-cron.js";
import { startCartAbandonedCron } from "./lib/cart-abandoned-cron.js";
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
    // Defansif: drizzle-kit push schema'da kolon yoksa BYTEA'yı silebilir.
    // ALTER IF NOT EXISTS ile her startup'ta kolon varlığını garantile.
    `ALTER TABLE teacher_applications ADD COLUMN IF NOT EXISTS cv_content BYTEA`,
    `ALTER TABLE teacher_applications ADD COLUMN IF NOT EXISTS cv_filename VARCHAR(300)`,
    `ALTER TABLE teacher_applications ADD COLUMN IF NOT EXISTS cv_mime_type VARCHAR(100)`,
    `ALTER TABLE teacher_applications ADD COLUMN IF NOT EXISTS cv_size_bytes INTEGER`,
    // Sidebar entry + admin role
    `INSERT INTO feature_settings (key, label, is_enabled, visible_to, category) VALUES
      ('admin-teacher-applications', 'Eğitmen Başvuruları', true, ARRAY['admin']::TEXT[], 'admin')
      ON CONFLICT (key) DO NOTHING`,
    // ─── E-kitap kataloğu + satın alma ─────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS ebooks (
      id SERIAL PRIMARY KEY,
      slug VARCHAR(200) NOT NULL,
      title VARCHAR(300) NOT NULL,
      subtitle VARCHAR(300),
      description TEXT NOT NULL,
      long_description TEXT,
      table_of_contents TEXT,
      author VARCHAR(200) NOT NULL,
      publisher VARCHAR(200) NOT NULL DEFAULT 'Sphere English',
      isbn VARCHAR(30),
      language VARCHAR(5) NOT NULL DEFAULT 'tr',
      content_language VARCHAR(50),
      series_slug VARCHAR(100),
      series_order INTEGER,
      series_title VARCHAR(300),
      cover_image_url VARCHAR(500),
      preview_pdf_url VARCHAR(500),
      full_pdf_path VARCHAR(500),
      page_count INTEGER,
      reading_time_min INTEGER,
      category VARCHAR(100),
      tags JSONB DEFAULT '[]'::JSONB,
      price_try DECIMAL(10,2) NOT NULL,
      list_price_try DECIMAL(10,2),
      currency VARCHAR(3) NOT NULL DEFAULT 'TRY',
      is_active BOOLEAN NOT NULL DEFAULT true,
      is_featured BOOLEAN NOT NULL DEFAULT false,
      published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      seo_title VARCHAR(200),
      seo_description VARCHAR(300),
      seo_keywords TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS ebooks_slug_unique ON ebooks(slug)`,
    `CREATE INDEX IF NOT EXISTS ebooks_active_idx ON ebooks(is_active, published_at DESC)`,
    `CREATE INDEX IF NOT EXISTS ebooks_series_idx ON ebooks(series_slug, series_order)`,
    `CREATE INDEX IF NOT EXISTS ebooks_featured_idx ON ebooks(is_featured)`,
    // Eski deploy'ta VARCHAR(20) ile yaratılan ebooks tablosunda content_language çok kısa idi.
    // ALTER ile güvenli genişletme (var olan veriyi koruyarak).
    `ALTER TABLE ebooks ALTER COLUMN content_language TYPE VARCHAR(50)`,
    // Ürün galerisi (mockup, tablet, sayfa içi) — JSONB array
    `ALTER TABLE ebooks ADD COLUMN IF NOT EXISTS gallery_urls JSONB DEFAULT '[]'::JSONB`,
    // E-kitap dosya/görsel asset tablosu (admin upload → bytea → stream)
    `CREATE TABLE IF NOT EXISTS ebook_assets (
      id SERIAL PRIMARY KEY,
      ebook_id INTEGER NOT NULL REFERENCES ebooks(id) ON DELETE CASCADE,
      asset_type VARCHAR(20) NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      filename VARCHAR(300) NOT NULL,
      mime_type VARCHAR(100) NOT NULL,
      size_bytes INTEGER NOT NULL,
      data_base64 TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS ebook_assets_ebook_idx ON ebook_assets(ebook_id, asset_type, position)`,
    // Admin sidebar entry
    `INSERT INTO feature_settings (key, label, is_enabled, visible_to, category) VALUES
      ('admin-ebooks', 'E-Kitap Yönetimi', true, ARRAY['admin']::TEXT[], 'admin')
      ON CONFLICT (key) DO NOTHING`,
    `INSERT INTO feature_settings (key, label, is_enabled, visible_to, category) VALUES
      ('admin-ebook-purchases', 'E-Kitap Satışları', true, ARRAY['admin']::TEXT[], 'admin')
      ON CONFLICT (key) DO NOTHING`,
    `CREATE TABLE IF NOT EXISTS ebook_purchases (
      id SERIAL PRIMARY KEY,
      ebook_id INTEGER NOT NULL REFERENCES ebooks(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      buyer_email VARCHAR(200) NOT NULL,
      buyer_name VARCHAR(200),
      amount_paid DECIMAL(10,2) NOT NULL,
      currency VARCHAR(3) NOT NULL DEFAULT 'TRY',
      iyzico_payment_id VARCHAR(200),
      iyzico_conversation_id VARCHAR(200),
      download_token VARCHAR(100) NOT NULL,
      download_count INTEGER NOT NULL DEFAULT 0,
      download_expires_at TIMESTAMPTZ NOT NULL,
      paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS ebook_purchases_token_unique ON ebook_purchases(download_token)`,
    `CREATE INDEX IF NOT EXISTS ebook_purchases_email_idx ON ebook_purchases(buyer_email, paid_at)`,
    `CREATE INDEX IF NOT EXISTS ebook_purchases_ebook_idx ON ebook_purchases(ebook_id, paid_at)`,
    // ── Fatura alanları (Q2 2026 — Faz 1) — defansif ALTER ADD COLUMN IF NOT EXISTS
    // Mevcut satırlarda NULL kalır, yeni satın almalarda dolu gelecek
    `ALTER TABLE ebook_purchases ADD COLUMN IF NOT EXISTS buyer_phone VARCHAR(30)`,
    `ALTER TABLE ebook_purchases ADD COLUMN IF NOT EXISTS invoice_type VARCHAR(20) DEFAULT 'individual'`,
    `ALTER TABLE ebook_purchases ADD COLUMN IF NOT EXISTS tax_id VARCHAR(20)`,
    `ALTER TABLE ebook_purchases ADD COLUMN IF NOT EXISTS tax_office VARCHAR(150)`,
    `ALTER TABLE ebook_purchases ADD COLUMN IF NOT EXISTS company_name VARCHAR(300)`,
    `ALTER TABLE ebook_purchases ADD COLUMN IF NOT EXISTS billing_address TEXT`,
    `ALTER TABLE ebook_purchases ADD COLUMN IF NOT EXISTS billing_city VARCHAR(100)`,
    `ALTER TABLE ebook_purchases ADD COLUMN IF NOT EXISTS billing_district VARCHAR(100)`,
    `ALTER TABLE ebook_purchases ADD COLUMN IF NOT EXISTS billing_postal_code VARCHAR(10)`,
    // Ödeme durumu — pending/success/failed/expired
    `ALTER TABLE ebook_purchases ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) NOT NULL DEFAULT 'success'`,
    `ALTER TABLE ebook_purchases ADD COLUMN IF NOT EXISTS payment_error TEXT`,
    // Fatura takibi
    `ALTER TABLE ebook_purchases ADD COLUMN IF NOT EXISTS invoice_status VARCHAR(20) NOT NULL DEFAULT 'pending'`,
    `ALTER TABLE ebook_purchases ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(100)`,
    `ALTER TABLE ebook_purchases ADD COLUMN IF NOT EXISTS invoice_issued_at TIMESTAMPTZ`,
    `ALTER TABLE ebook_purchases ADD COLUMN IF NOT EXISTS invoice_notes TEXT`,
    `ALTER TABLE ebook_purchases ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
    // Mail gönderim takibi
    `ALTER TABLE ebook_purchases ADD COLUMN IF NOT EXISTS mail_sent_at TIMESTAMPTZ`,
    `ALTER TABLE ebook_purchases ADD COLUMN IF NOT EXISTS mail_status VARCHAR(20) DEFAULT 'pending'`,
    `ALTER TABLE ebook_purchases ADD COLUMN IF NOT EXISTS mail_error TEXT`,
    `ALTER TABLE ebook_purchases ADD COLUMN IF NOT EXISTS mail_attempts INTEGER NOT NULL DEFAULT 0`,
    // Audit log alanı — manuel aktivasyon, manuel düzeltme gibi admin müdahaleleri
    `ALTER TABLE ebook_purchases ADD COLUMN IF NOT EXISTS notes TEXT`,
    // download_token + download_expires_at + paid_at NOT NULL idi — pending kayıtlar için NULL'a izin verelim
    `ALTER TABLE ebook_purchases ALTER COLUMN download_token DROP NOT NULL`,
    `ALTER TABLE ebook_purchases ALTER COLUMN download_expires_at DROP NOT NULL`,
    `ALTER TABLE ebook_purchases ALTER COLUMN paid_at DROP NOT NULL`,
    // Yeni index'ler
    `CREATE INDEX IF NOT EXISTS ebook_purchases_status_idx ON ebook_purchases(payment_status, created_at)`,
    `CREATE INDEX IF NOT EXISTS ebook_purchases_invoice_status_idx ON ebook_purchases(invoice_status, paid_at)`,
    `CREATE INDEX IF NOT EXISTS ebook_purchases_conv_idx ON ebook_purchases(iyzico_conversation_id)`,

    // ─── E-Kitap Paketleri (Bundle) ─────────────────────────────────────────
    // Birden fazla e-kitabı tek fiyata satmak için paket sistemi.
    // Admin panelden oluşturulur, www tarafında paketler sayfasında satılır.
    `CREATE TABLE IF NOT EXISTS ebook_bundles (
      id SERIAL PRIMARY KEY,
      slug VARCHAR(200) NOT NULL,
      title VARCHAR(300) NOT NULL,
      subtitle TEXT,
      description TEXT,
      cover_image_url TEXT,
      price_try DECIMAL(10, 2) NOT NULL,
      list_price_try DECIMAL(10, 2),
      currency VARCHAR(3) NOT NULL DEFAULT 'TRY',
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      is_featured BOOLEAN NOT NULL DEFAULT FALSE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      tags JSONB DEFAULT '[]'::JSONB,
      seo_title VARCHAR(300),
      seo_description TEXT,
      seo_keywords TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS ebook_bundles_slug_unique ON ebook_bundles(slug)`,
    `CREATE INDEX IF NOT EXISTS ebook_bundles_active_idx ON ebook_bundles(is_active, sort_order)`,
    `CREATE INDEX IF NOT EXISTS ebook_bundles_featured_idx ON ebook_bundles(is_featured, sort_order) WHERE is_featured = TRUE`,

    // Bundle içindeki kitap listesi (many-to-many junction)
    `CREATE TABLE IF NOT EXISTS ebook_bundle_items (
      id SERIAL PRIMARY KEY,
      bundle_id INTEGER NOT NULL REFERENCES ebook_bundles(id) ON DELETE CASCADE,
      ebook_id INTEGER NOT NULL REFERENCES ebooks(id) ON DELETE CASCADE,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(bundle_id, ebook_id)
    )`,
    `CREATE INDEX IF NOT EXISTS ebook_bundle_items_bundle_idx ON ebook_bundle_items(bundle_id, position)`,
    `CREATE INDEX IF NOT EXISTS ebook_bundle_items_ebook_idx ON ebook_bundle_items(ebook_id)`,

    // Bundle kapak görseli — DB'de bytea (Easypanel ephemeral filesystem çözümü)
    `ALTER TABLE ebook_bundles ADD COLUMN IF NOT EXISTS cover_data BYTEA`,
    `ALTER TABLE ebook_bundles ADD COLUMN IF NOT EXISTS cover_mime VARCHAR(100)`,
    `ALTER TABLE ebook_bundles ADD COLUMN IF NOT EXISTS cover_size INTEGER`,

    // ebook_purchases'a bundle bağlantısı — bundle satışlarında her item için kayıt açılır,
    // aynı order_id ile gruplanır, bundle_id ile hangi paketten geldiği izlenir.
    `ALTER TABLE ebook_purchases ADD COLUMN IF NOT EXISTS bundle_id INTEGER REFERENCES ebook_bundles(id) ON DELETE SET NULL`,
    `ALTER TABLE ebook_purchases ADD COLUMN IF NOT EXISTS order_id VARCHAR(100)`,
    `CREATE INDEX IF NOT EXISTS ebook_purchases_bundle_idx ON ebook_purchases(bundle_id) WHERE bundle_id IS NOT NULL`,
    `CREATE INDEX IF NOT EXISTS ebook_purchases_order_idx ON ebook_purchases(order_id) WHERE order_id IS NOT NULL`,

    // Terkedilmiş sepet hatırlatma maili — timestamp NULL ise henüz mail atılmadı
    `ALTER TABLE ebook_purchases ADD COLUMN IF NOT EXISTS abandoned_mail_sent_at TIMESTAMPTZ`,
    `CREATE INDEX IF NOT EXISTS ebook_purchases_abandoned_idx ON ebook_purchases(payment_status, created_at) WHERE payment_status = 'pending' AND abandoned_mail_sent_at IS NULL`,

    // ─── Website Analytics (ziyaretçi takibi) ──────────────────────────────
    `CREATE TABLE IF NOT EXISTS web_visitor_sessions (
      id BIGSERIAL PRIMARY KEY,
      visitor_id VARCHAR(64) NOT NULL,
      ip_hash VARCHAR(64),
      user_agent TEXT,
      device_type VARCHAR(20),
      browser VARCHAR(60),
      os VARCHAR(60),
      country VARCHAR(80),
      city VARCHAR(120),
      referrer TEXT,
      referrer_domain VARCHAR(255),
      utm_source VARCHAR(120),
      utm_medium VARCHAR(120),
      utm_campaign VARCHAR(255),
      utm_term VARCHAR(255),
      utm_content VARCHAR(255),
      landing_path VARCHAR(500),
      is_bot BOOLEAN NOT NULL DEFAULT FALSE,
      page_view_count INTEGER NOT NULL DEFAULT 0,
      first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS web_sessions_visitor_idx ON web_visitor_sessions(visitor_id, last_seen_at DESC)`,
    `CREATE INDEX IF NOT EXISTS web_sessions_lastseen_idx ON web_visitor_sessions(last_seen_at DESC)`,
    `CREATE INDEX IF NOT EXISTS web_sessions_bot_idx ON web_visitor_sessions(is_bot, last_seen_at DESC)`,
    `CREATE TABLE IF NOT EXISTS web_page_views (
      id BIGSERIAL PRIMARY KEY,
      session_id BIGINT REFERENCES web_visitor_sessions(id) ON DELETE CASCADE,
      visitor_id VARCHAR(64) NOT NULL,
      path VARCHAR(500) NOT NULL,
      full_url TEXT,
      page_title VARCHAR(500),
      referrer TEXT,
      viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS web_pageviews_viewed_idx ON web_page_views(viewed_at DESC)`,
    `CREATE INDEX IF NOT EXISTS web_pageviews_session_idx ON web_page_views(session_id, viewed_at)`,
    `CREATE INDEX IF NOT EXISTS web_pageviews_path_idx ON web_page_views(path, viewed_at DESC)`,
    `CREATE INDEX IF NOT EXISTS web_pageviews_visitor_idx ON web_page_views(visitor_id, viewed_at DESC)`,
    // ─── Magic link / şifre belirleme token'ları ─────────────────────────────
    // Pazarlama sitesinden abone olunduğunda kullanıcı hesabı oluşur,
    // bu token ile e-postadan şifre belirleyebilir
    `CREATE TABLE IF NOT EXISTS account_setup_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token VARCHAR(120) NOT NULL UNIQUE,
      purpose VARCHAR(20) NOT NULL DEFAULT 'welcome',
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS account_setup_tokens_user_idx ON account_setup_tokens(user_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS account_setup_tokens_expires_idx ON account_setup_tokens(expires_at)`,
    // ── Abonelik öncesi fatura draft'ları (pazarlama formu → callback eşlemesi) ──
    `CREATE TABLE IF NOT EXISTS pending_subscription_drafts (
      id SERIAL PRIMARY KEY,
      conversation_id VARCHAR(200) NOT NULL UNIQUE,
      plan_code VARCHAR(100) NOT NULL,
      buyer_email VARCHAR(200) NOT NULL,
      buyer_name VARCHAR(200),
      buyer_phone VARCHAR(30),
      invoice_type VARCHAR(20) NOT NULL DEFAULT 'individual',
      tax_id VARCHAR(20),
      tax_office VARCHAR(150),
      company_name VARCHAR(300),
      billing_address TEXT,
      billing_city VARCHAR(100),
      billing_district VARCHAR(100),
      billing_postal_code VARCHAR(10),
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS pending_sub_drafts_email_idx ON pending_subscription_drafts(buyer_email, created_at DESC)`,
    // subscriptions tablosuna fatura alanları (kalıcı kayıt)
    `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS invoice_type VARCHAR(20)`,
    `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS tax_id VARCHAR(20)`,
    `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS tax_office VARCHAR(150)`,
    `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS company_name VARCHAR(300)`,
    `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS billing_address TEXT`,
    `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS billing_city VARCHAR(100)`,
    `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS billing_district VARCHAR(100)`,
    `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS billing_postal_code VARCHAR(10)`,
    `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS invoice_status VARCHAR(20) NOT NULL DEFAULT 'pending'`,
    `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(100)`,
    `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS invoice_issued_at TIMESTAMPTZ`,
    // ─── Instagram bot (DM + Yorum AI cevap) ──────────────────────────────
    `CREATE TABLE IF NOT EXISTS instagram_threads (
      id SERIAL PRIMARY KEY,
      ig_user_id VARCHAR(60) NOT NULL UNIQUE,
      ig_username VARCHAR(100),
      ig_full_name VARCHAR(200),
      profile_pic_url TEXT,
      last_message_text TEXT,
      last_message_at TIMESTAMPTZ,
      last_inbound_at TIMESTAMPTZ,
      unread_count INTEGER NOT NULL DEFAULT 0,
      is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
      bot_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      escalated_at TIMESTAMPTZ,
      escalation_reason TEXT,
      first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS ig_threads_last_msg_idx ON instagram_threads(last_message_at DESC)`,
    `CREATE INDEX IF NOT EXISTS ig_threads_unread_idx ON instagram_threads(unread_count, last_message_at DESC) WHERE unread_count > 0`,
    `CREATE TABLE IF NOT EXISTS instagram_messages (
      id BIGSERIAL PRIMARY KEY,
      thread_id INTEGER NOT NULL REFERENCES instagram_threads(id) ON DELETE CASCADE,
      ig_message_id VARCHAR(120) UNIQUE,
      direction VARCHAR(10) NOT NULL,
      sender_id VARCHAR(60) NOT NULL,
      message_text TEXT,
      attachments JSONB DEFAULT '[]'::JSONB,
      ai_generated BOOLEAN NOT NULL DEFAULT FALSE,
      ai_confidence NUMERIC(4, 3),
      ai_model VARCHAR(60),
      ai_latency_ms INTEGER,
      delivery_status VARCHAR(20) DEFAULT 'pending',
      delivery_error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      sent_at TIMESTAMPTZ
    )`,
    `CREATE INDEX IF NOT EXISTS ig_messages_thread_idx ON instagram_messages(thread_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS ig_messages_direction_idx ON instagram_messages(direction, created_at DESC)`,
    `CREATE TABLE IF NOT EXISTS instagram_comments (
      id BIGSERIAL PRIMARY KEY,
      ig_comment_id VARCHAR(120) NOT NULL UNIQUE,
      ig_media_id VARCHAR(120),
      ig_parent_comment_id VARCHAR(120),
      sender_id VARCHAR(60) NOT NULL,
      sender_username VARCHAR(100),
      comment_text TEXT,
      reply_text TEXT,
      reply_ig_id VARCHAR(120),
      ai_generated BOOLEAN NOT NULL DEFAULT FALSE,
      ai_confidence NUMERIC(4, 3),
      reply_status VARCHAR(20) DEFAULT 'pending',
      reply_error TEXT,
      skipped_reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      replied_at TIMESTAMPTZ
    )`,
    `CREATE INDEX IF NOT EXISTS ig_comments_created_idx ON instagram_comments(created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS ig_comments_status_idx ON instagram_comments(reply_status, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS ig_comments_media_idx ON instagram_comments(ig_media_id, created_at DESC)`,
    `CREATE TABLE IF NOT EXISTS instagram_bot_settings (
      key VARCHAR(80) PRIMARY KEY,
      value TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `INSERT INTO instagram_bot_settings (key, value) VALUES
      ('bot_enabled', 'true'),
      ('reply_to_dms', 'true'),
      ('reply_to_comments', 'true'),
      ('persona_name', 'Sphere Asistanı'),
      ('persona_tone', 'samimi-profesyonel'),
      ('escalation_keywords', 'şikayet,iade,refund,iptal,müdür,manager,problem')
      ON CONFLICT (key) DO NOTHING`,
    `INSERT INTO feature_settings (key, label, is_enabled, visible_to, category) VALUES
      ('admin-instagram-bot', 'Instagram Bot', true, ARRAY['admin']::TEXT[], 'admin')
      ON CONFLICT (key) DO NOTHING`,
    // Instagram message ID'leri çok uzun (200+ karakter base64) — VARCHAR(120) yetmedi
    `ALTER TABLE instagram_messages ALTER COLUMN ig_message_id TYPE TEXT`,
    `ALTER TABLE instagram_comments ALTER COLUMN ig_comment_id TYPE TEXT`,
    `ALTER TABLE instagram_comments ALTER COLUMN ig_parent_comment_id TYPE TEXT`,
    `ALTER TABLE instagram_comments ALTER COLUMN ig_media_id TYPE TEXT`,
    `ALTER TABLE instagram_comments ALTER COLUMN reply_ig_id TYPE TEXT`,
    // ─── WhatsApp bot (Cloud API — DM AI cevap) ───────────────────────────
    `CREATE TABLE IF NOT EXISTS whatsapp_threads (
      id SERIAL PRIMARY KEY,
      wa_phone_number VARCHAR(30) NOT NULL UNIQUE,
      wa_profile_name VARCHAR(200),
      last_message_text TEXT,
      last_message_at TIMESTAMPTZ,
      last_inbound_at TIMESTAMPTZ,
      unread_count INTEGER NOT NULL DEFAULT 0,
      is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
      bot_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      escalated_at TIMESTAMPTZ,
      escalation_reason TEXT,
      first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS wa_threads_last_msg_idx ON whatsapp_threads(last_message_at DESC)`,
    `CREATE INDEX IF NOT EXISTS wa_threads_unread_idx ON whatsapp_threads(unread_count, last_message_at DESC) WHERE unread_count > 0`,
    `CREATE TABLE IF NOT EXISTS whatsapp_messages (
      id BIGSERIAL PRIMARY KEY,
      thread_id INTEGER NOT NULL REFERENCES whatsapp_threads(id) ON DELETE CASCADE,
      wa_message_id TEXT UNIQUE,
      direction VARCHAR(10) NOT NULL,
      sender_phone VARCHAR(30) NOT NULL,
      message_text TEXT,
      message_type VARCHAR(20) DEFAULT 'text',
      attachments JSONB DEFAULT '[]'::JSONB,
      ai_generated BOOLEAN NOT NULL DEFAULT FALSE,
      ai_confidence NUMERIC(4, 3),
      ai_model VARCHAR(60),
      ai_latency_ms INTEGER,
      delivery_status VARCHAR(20) DEFAULT 'pending',
      delivery_error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      sent_at TIMESTAMPTZ
    )`,
    `CREATE INDEX IF NOT EXISTS wa_messages_thread_idx ON whatsapp_messages(thread_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS wa_messages_direction_idx ON whatsapp_messages(direction, created_at DESC)`,
    `CREATE TABLE IF NOT EXISTS whatsapp_bot_settings (
      key VARCHAR(80) PRIMARY KEY,
      value TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `INSERT INTO whatsapp_bot_settings (key, value) VALUES
      ('bot_enabled', 'true'),
      ('reply_to_dms', 'true'),
      ('persona_name', 'Ezgi'),
      ('persona_tone', 'samimi-pazarlama'),
      ('escalation_keywords', 'şikayet,para iade,ücret iadesi,iptal et,müdürünüzle,avukat,dava açacağım,sahte,dolandırıcı,scam,fraud,refund')
      ON CONFLICT (key) DO NOTHING`,
    `INSERT INTO feature_settings (key, label, is_enabled, visible_to, category) VALUES
      ('admin-whatsapp-bot', 'WhatsApp Bot', true, ARRAY['admin']::TEXT[], 'admin')
      ON CONFLICT (key) DO NOTHING`,
    // ─── Affiliate Program ────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS affiliates (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      code VARCHAR(40) NOT NULL UNIQUE,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      full_name VARCHAR(200) NOT NULL,
      email VARCHAR(200) NOT NULL,
      phone VARCHAR(30),
      website VARCHAR(300),
      social_links TEXT,
      motivation TEXT,
      audience_description TEXT,
      tc_number VARCHAR(11),
      iban VARCHAR(34),
      bank_name VARCHAR(100),
      account_holder_name VARCHAR(200),
      approved_at TIMESTAMPTZ,
      approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      rejected_at TIMESTAMPTZ,
      rejection_reason TEXT,
      total_clicks INTEGER NOT NULL DEFAULT 0,
      total_conversions INTEGER NOT NULL DEFAULT 0,
      total_earned_kurus BIGINT NOT NULL DEFAULT 0,
      total_paid_kurus BIGINT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS aff_code_idx ON affiliates(code)`,
    `CREATE INDEX IF NOT EXISTS aff_status_idx ON affiliates(status, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS aff_user_idx ON affiliates(user_id)`,
    `CREATE TABLE IF NOT EXISTS affiliate_commissions (
      id BIGSERIAL PRIMARY KEY,
      affiliate_id INTEGER NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
      source_type VARCHAR(20) NOT NULL,
      source_id INTEGER NOT NULL,
      customer_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      sale_amount_kurus BIGINT NOT NULL,
      commission_rate NUMERIC(5,4) NOT NULL,
      commission_kurus BIGINT NOT NULL,
      billing_cycle INTEGER NOT NULL DEFAULT 1,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      approved_at TIMESTAMPTZ,
      paid_at TIMESTAMPTZ,
      payout_id INTEGER,
      refunded_at TIMESTAMPTZ,
      refund_reason TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS aff_comm_aff_idx ON affiliate_commissions(affiliate_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS aff_comm_status_idx ON affiliate_commissions(status, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS aff_comm_source_idx ON affiliate_commissions(source_type, source_id)`,
    `CREATE TABLE IF NOT EXISTS affiliate_payouts (
      id SERIAL PRIMARY KEY,
      affiliate_id INTEGER NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
      amount_kurus BIGINT NOT NULL,
      commission_count INTEGER NOT NULL,
      period_start DATE NOT NULL,
      period_end DATE NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      iban VARCHAR(34),
      bank_name VARCHAR(100),
      account_holder_name VARCHAR(200),
      payment_reference VARCHAR(200),
      paid_at TIMESTAMPTZ,
      paid_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS aff_payout_aff_idx ON affiliate_payouts(affiliate_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS aff_payout_status_idx ON affiliate_payouts(status, created_at DESC)`,
    `CREATE TABLE IF NOT EXISTS affiliate_clicks (
      id BIGSERIAL PRIMARY KEY,
      affiliate_id INTEGER NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
      landing_path TEXT,
      referrer TEXT,
      user_agent TEXT,
      ip_country VARCHAR(5),
      utm_source VARCHAR(100),
      utm_medium VARCHAR(100),
      utm_campaign VARCHAR(100),
      visitor_id VARCHAR(80),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS aff_click_aff_idx ON affiliate_clicks(affiliate_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS aff_click_date_idx ON affiliate_clicks(created_at DESC)`,
    // Subscription + ebook_purchases tablolarına affiliate kolonu
    `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS affiliate_id INTEGER REFERENCES affiliates(id) ON DELETE SET NULL`,
    `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS affiliate_attributed_at TIMESTAMPTZ`,
    `CREATE INDEX IF NOT EXISTS sub_affiliate_idx ON subscriptions(affiliate_id) WHERE affiliate_id IS NOT NULL`,
    `ALTER TABLE ebook_purchases ADD COLUMN IF NOT EXISTS affiliate_id INTEGER REFERENCES affiliates(id) ON DELETE SET NULL`,
    `ALTER TABLE ebook_purchases ADD COLUMN IF NOT EXISTS affiliate_attributed_at TIMESTAMPTZ`,
    `CREATE INDEX IF NOT EXISTS ebook_pur_affiliate_idx ON ebook_purchases(affiliate_id) WHERE affiliate_id IS NOT NULL`,
    `INSERT INTO feature_settings (key, label, is_enabled, visible_to, category) VALUES
      ('admin-affiliates', 'Affiliate Program', true, ARRAY['admin']::TEXT[], 'admin')
      ON CONFLICT (key) DO NOTHING`,
    // ─── Coupons (Indirim Kuponları) ──────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS coupons (
      id SERIAL PRIMARY KEY,
      code VARCHAR(40) NOT NULL UNIQUE,
      description TEXT,
      discount_type VARCHAR(20) NOT NULL,
      discount_value NUMERIC(10, 2) NOT NULL,
      applies_to TEXT[] NOT NULL DEFAULT ARRAY['subscription_all','ebook']::TEXT[],
      min_purchase_kurus BIGINT NOT NULL DEFAULT 0,
      max_uses INTEGER,
      max_uses_per_user INTEGER NOT NULL DEFAULT 1,
      total_used_count INTEGER NOT NULL DEFAULT 0,
      valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      valid_until TIMESTAMPTZ,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS coupons_code_idx ON coupons(code)`,
    `CREATE INDEX IF NOT EXISTS coupons_active_idx ON coupons(is_active, valid_until) WHERE is_active = TRUE`,
    `CREATE TABLE IF NOT EXISTS coupon_redemptions (
      id BIGSERIAL PRIMARY KEY,
      coupon_id INTEGER NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      source_type VARCHAR(20) NOT NULL,
      source_id INTEGER,
      buyer_email VARCHAR(200),
      original_amount_kurus BIGINT NOT NULL,
      discount_kurus BIGINT NOT NULL,
      final_amount_kurus BIGINT NOT NULL,
      conversation_id VARCHAR(100),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS cr_coupon_idx ON coupon_redemptions(coupon_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS cr_user_idx ON coupon_redemptions(user_id, coupon_id)`,
    `CREATE INDEX IF NOT EXISTS cr_source_idx ON coupon_redemptions(source_type, source_id)`,
    `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS coupon_id INTEGER REFERENCES coupons(id) ON DELETE SET NULL`,
    `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS coupon_discount_kurus BIGINT`,
    `ALTER TABLE ebook_purchases ADD COLUMN IF NOT EXISTS coupon_id INTEGER REFERENCES coupons(id) ON DELETE SET NULL`,
    `ALTER TABLE ebook_purchases ADD COLUMN IF NOT EXISTS coupon_discount_kurus BIGINT`,
    `ALTER TABLE pending_subscription_drafts ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(40)`,
    `ALTER TABLE pending_subscription_drafts ADD COLUMN IF NOT EXISTS coupon_discount_kurus BIGINT`,
    `ALTER TABLE pending_subscription_drafts ADD COLUMN IF NOT EXISTS affiliate_code VARCHAR(40)`,
    `INSERT INTO feature_settings (key, label, is_enabled, visible_to, category) VALUES
      ('admin-coupons', 'Kupon Kodları', true, ARRAY['admin']::TEXT[], 'admin')
      ON CONFLICT (key) DO NOTHING`,
    // İlk kitap seed — sadece yoksa ekle
    `INSERT INTO ebooks (
      slug, title, subtitle, description, long_description,
      author, publisher, language, content_language,
      series_slug, series_order, series_title,
      cover_image_url, preview_pdf_url, full_pdf_path,
      page_count, reading_time_min, category, tags,
      price_try, list_price_try, is_active, is_featured,
      seo_title, seo_description, seo_keywords,
      table_of_contents
    ) VALUES (
      'kurumsal-iletisim-toplantilar',
      'Kurumsal İletişim & Toplantılar',
      'İş İngilizcesinde Kullanılan 1000 Kelime — Kitap 01',
      'Plaza dilini akıcı konuşmak isteyenler için 50 vazgeçilmez kurumsal kalıp, 150 temel iş terimi ve ünite alıştırmaları — toplantılardan e-postalara, gerçek iş hayatından örneklerle.',
      'Bu kitap, kurumsal hayatta İngilizceyi güvenle kullanmak isteyen profesyoneller için hazırlanmıştır. Toplantı yönetiminden günlük ofis diline, en sık kullanılan 50 kalıbı ve 150 temel terimi; anlamları, kullanım tüyoları ve gerçek iş hayatından örneklerle bir araya getirir.',
      'Didem İmamoğlu',
      'Sphere English',
      'tr', 'TR-EN',
      'is-ingilizcesinde-1000-kelime', 1, 'İş İngilizcesinde Kullanılan 1000 Kelime',
      '/assets/ebooks/kurumsal-iletisim-toplantilar-cover.svg',
      '/assets/ebooks/kurumsal-iletisim-toplantilar-preview.pdf',
      '/secure/ebooks/kurumsal-iletisim-toplantilar.pdf',
      72, 90, 'İş İngilizcesi',
      '["toplantı","e-posta","kurumsal iletişim","plaza dili","B2","C1"]'::JSONB,
      149, 249, true, true,
      'Kurumsal İletişim & Toplantılar E-kitabı | Sphere English',
      'Plaza dili — 50 kurumsal kalıp + 150 temel iş terimi + toplantı / e-posta örnekleri. PDF dijital kitap, hemen indir.',
      'kurumsal İngilizce, iş İngilizcesi, toplantı İngilizcesi, e-posta İngilizcesi, plaza dili, business English, dijital kitap, PDF kitap, iş İngilizcesi kitap',
      E'## İçindekiler\n\n**Bölüm 1 — Toplantı Açılış & Kapanış Kalıpları**\n- Toplantı başlatma\n- Gündem belirleme\n- Söz alma & verme\n- Toplantı sonlandırma\n\n**Bölüm 2 — E-posta Dili**\n- Profesyonel selamlama\n- Talep ifadeleri\n- Takip e-postaları\n- Kapanış formülleri\n\n**Bölüm 3 — Sunum & Müzakere**\n- Hedef belirleme\n- Önerme & karşılık verme\n- Anlaşmazlık ifadesi\n\n**Bölüm 4 — Günlük Ofis Diyalogları**\n- Kahve molası\n- Çalışan değerlendirmesi\n- Dönüş bildirimi\n\n**Ek — 150 Temel İş Terimi Sözlük**'
    )
    ON CONFLICT (slug) DO NOTHING`,
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
      // Background cron'ları başlat (idempotent — birden fazla çağrı zararsız)
      startBackupCron();
      startEbookRecoveryCron();
      startCartAbandonedCron();
    })
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

// ── Background services ──
initSentry().catch(() => {});
startBackupCron();
