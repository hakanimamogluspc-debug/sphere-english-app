import app from "./app";
import { logger } from "./lib/logger";
import { seedDatabase } from "./seed.js";
import { pool } from "@workspace/db";

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
      ('teacher-speaking-club',       'Speaking Club',          true, ARRAY['teacher','admin']::TEXT[],     'teacher')
    ON CONFLICT (key) DO NOTHING`,
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

runStartupMigrations().then(() => {
  app.listen(port, "0.0.0.0", (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");

    seedDatabase().catch((e) => logger.error({ err: e }, "Seed error"));
  });
});
