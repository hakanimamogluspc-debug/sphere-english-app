import { initSentry } from "./lib/sentry.js";
import { startBackupCron } from "./lib/db-backup.js";
import { appEnv, backgroundJobsEnabled } from "./lib/app-env.js";
import { startMetricsFlusher } from "./lib/metrics.js";
import { startEbookRecoveryCron } from "./lib/ebook-recovery-cron.js";
import { startCartAbandonedCron } from "./lib/cart-abandoned-cron.js";
import { startFailedPaymentRetryCron } from "./jobs/failed-payment-retry-cron.js";
import { seedSpeakingScenes } from "./lib/scenes-seed.js";
import { seedHelpCenter } from "./lib/help-center-seed.js";
import { seedTutorLessons } from "./lib/tutor-lessons-seed.js";
import cluster from "node:cluster";
import os from "node:os";
import app from "./app";
import { logger } from "./lib/logger";
import { seedDatabase } from "./seed.js";
import { pool, VOCAB_WORDS } from "@workspace/db";
import { runStartupMigrations } from "./lib/startup-migrations.js";

const rawPort = process.env["PORT"] ?? "3000";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
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

// ─── Kritik env kontrolü — production'da güvenlik açığı yaratacak eksiklikleri log'la
function validateCriticalEnvs() {
  const isProd = process.env.NODE_ENV === "production";
  const critical: Array<{ name: string; severity: "error" | "warn"; note: string }> = [
    { name: "DATABASE_URL", severity: "error", note: "Boot fail eder — DB bağlantısı zorunlu" },
    { name: "JWT_SECRET", severity: "error", note: "Auth çalışmaz" },
    { name: "IYZICO_API_KEY", severity: "error", note: "Ödeme kırık" },
    { name: "IYZICO_SECRET_KEY", severity: "error", note: "Ödeme kırık" },
    { name: "INTERNAL_TOKEN", severity: "error", note: "Unsubscribe token vs internal cron endpoint'ler güvenli değil" },
    { name: "RESEND_API_KEY", severity: "warn", note: "Transactional mail göndermez" },
    { name: "SENTRY_DSN", severity: "warn", note: "Error tracking devre dışı" },
    { name: "OUTBOUND_SCHEDULER_ENABLED", severity: "warn", note: "B2B outbound kampanyaları çalışmaz" },
    { name: "PAYMENT_RETRY_CRON_ENABLED", severity: "warn", note: "Başarısız ödeme için kullanıcı bildirimleri gönderilmez" },
    { name: "RESEND_WEBHOOK_SECRET", severity: "warn", note: "Resend webhook imza doğrulaması devre dışı" },
    { name: "OPENAI_API_KEY", severity: "warn", note: "AI özellikleri (tutor/quiz) çalışmaz" },
  ];
  const missing = critical.filter(c => !process.env[c.name] || process.env[c.name]!.trim() === "");
  if (missing.length === 0) {
    logger.info("[env-check] ✓ Tüm kritik env'ler mevcut");
    return;
  }
  for (const c of missing) {
    if (c.severity === "error") {
      logger.error({ env: c.name }, `[env-check] KRITIK EKSİK: ${c.name} — ${c.note}`);
      if (isProd && (c.name === "JWT_SECRET" || c.name === "INTERNAL_TOKEN")) {
        console.error(`[env-check] BOOT DURDURULDU: ${c.name} production'da zorunlu`);
        process.exit(1);
      }
    } else {
      logger.warn({ env: c.name }, `[env-check] uyarı: ${c.name} eksik — ${c.note}`);
    }
  }
  // Zayıf INTERNAL_TOKEN
  const it = process.env.INTERNAL_TOKEN;
  if (it && it.length < 32) {
    logger.warn(`[env-check] INTERNAL_TOKEN sadece ${it.length} karakter — en az 32 karakterlik random string kullan (openssl rand -hex 32)`);
  }
}

// ─── Cluster modu — tüm CPU çekirdeklerini kullan ────────────────────────────
if (cluster.isPrimary) {
  // Sadece primary süreç migration + seed çalıştırır
  validateCriticalEnvs();
  runStartupMigrations()
    .then(() => seedDatabase())
    .then(() => seedVocabWords())
    .then(() => promoteAdminFromEnv())
    .then(() => {
      // Speaking scenes seed (idempotent — sadece yoksa ekler)
      void seedSpeakingScenes();
      void seedHelpCenter();
      void seedTutorLessons();
      // Background cron'ları başlat (idempotent) — STAGING'de KAPALI (bkz. lib/app-env.ts)
      if (backgroundJobsEnabled()) {
        startBackupCron();
        startEbookRecoveryCron();
        startCartAbandonedCron();
        startFailedPaymentRetryCron();
        // Learning cron'ları (content ingest + weekly report) — primary'de tek instance
        void import("./lib/scheduler.js").then(m => m.startScheduler()).catch(e => logger.warn({ err: e?.message }, "scheduler import fail"));
        // B2B outbound sequence scheduler — primary'de tek instance (worker çökse de yaşar)
        void import("./services/outbound-scheduler.js")
          .then(({ startOutboundScheduler }) => startOutboundScheduler())
          .catch(err => logger.error({ err }, "outbound-scheduler başlatılamadı"));
      } else {
        logger.warn({ appEnv: appEnv() }, "Arka plan cron'ları KAPALI (staging / DISABLE_BACKGROUND_JOBS)");
      }
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
    startMetricsFlusher();
    // Outbound scheduler artık primary süreçte başlıyor (yukarıda, backgroundJobsEnabled bloğu).
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
if (backgroundJobsEnabled()) startBackupCron();
