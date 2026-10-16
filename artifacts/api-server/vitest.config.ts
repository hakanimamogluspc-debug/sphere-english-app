import { defineConfig } from "vitest/config";

/**
 * Entegrasyon testleri — gerçek Postgres'e karşı koşar (TEST_DATABASE_URL).
 * Şema her koşuda sıfırdan kurulur (bkz. src/test/global-setup.ts), bu yüzden
 * URL'de "test" geçmeyen bir veritabanına ASLA bağlanmaz.
 */
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    globalSetup: ["src/test/global-setup.ts"],
    setupFiles: ["src/test/setup-env.ts"],
    // Tek DB paylaşıldığı için dosyalar sırayla koşar
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 120_000,
    environment: "node",
    reporters: process.env.CI ? ["default", "junit"] : ["default"],
    outputFile: { junit: "test-results/junit.xml" },
  },
});
