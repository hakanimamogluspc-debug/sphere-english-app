/**
 * Test ortam değişkenleri — hem globalSetup (ana süreç) hem setupFiles (worker)
 * aynı fonksiyonu çağırır ki iki tarafta da aynı değerler olsun.
 *
 * Gerçek sırlar burada YOK; sadece testin ihtiyaç duyduğu sabitler.
 */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/sphere_test";

export const TEST_JWT_SECRET = "test-jwt-secret-must-be-at-least-32-characters-long";
export const TEST_INTERNAL_SECRET = "test-internal-shared-secret";
export const TEST_INTERNAL_TOKEN = "test-internal-token-0123456789abcdef0123456789abcdef";

/** Yanlışlıkla canlı/staging DB'ye bağlanmayı engelle */
export function assertTestDatabaseUrl(url: string): void {
  const dbName = url.split("/").pop()?.split("?")[0] ?? "";
  if (!/test/i.test(dbName)) {
    throw new Error(
      `TEST_DATABASE_URL veritabanı adı "test" içermeli (şu an: "${dbName}"). ` +
        "Testler şemayı sıfırlar; canlı/staging DB'ye karşı koşmaz.",
    );
  }
}

export function applyTestEnv(): void {
  assertTestDatabaseUrl(TEST_DATABASE_URL);
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.JWT_SECRET = TEST_JWT_SECRET;
  process.env.INTERNAL_API_SHARED_SECRET = TEST_INTERNAL_SECRET;
  process.env.INTERNAL_TOKEN = TEST_INTERNAL_TOKEN;
  // staging modu: cron'lar kapalı, allowlist boş → hiç mail gitmez, push kapalı
  process.env.APP_ENV = "staging";
  process.env.STAGING_EMAIL_ALLOWLIST = "";
  process.env.DISABLE_BACKGROUND_JOBS = "1";
  process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? "silent";
  // Testler çok sayıda kayıt/giriş yapar; limiter'lar kapalı (rate-limit.test.ts kendisi açar)
  process.env.RATE_LIMIT_DISABLED = "1";
  // Dış servisler: anahtar yok → ilgili kod yolları "yapılandırılmamış" dalına düşer
  delete process.env.OPENAI_API_KEY;
  delete process.env.RESEND_API_KEY;
  delete process.env.SENTRY_DSN;
  delete process.env.META_ACCESS_TOKEN;
  delete process.env.IYZICO_API_KEY;
  delete process.env.IYZICO_SECRET_KEY;
}
