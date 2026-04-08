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
    `UPDATE users SET role = 'admin' WHERE email = 'hakanimamogluspc@gmail.com' AND role != 'admin'`,
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
  app.listen(port, "0.0.0.0", (err) => {
    if (err) {
      logger.error({ err }, "Port dinleme hatası");
      process.exit(1);
    }
    logger.info({ port, pid: process.pid, worker: cluster.worker?.id }, "Worker hazır");
  });
}
