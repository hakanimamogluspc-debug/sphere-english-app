/**
 * vitest globalSetup — test koşusundan önce BİR kez (ana süreçte) çalışır.
 *
 *  1) TEST_DATABASE_URL'deki veritabanını sıfırlar (DROP SCHEMA public)
 *  2) Drizzle şemasını kurar (lib/db → drizzle-kit push)  → users, subscriptions, payments…
 *  3) Canlıdaki açılış migration'larını koşar (runStartupMigrations) → feature_settings,
 *     pending_subscription_drafts, account_setup_tokens vb.
 *
 * Yani testler, canlı uygulamanın açılışta gördüğü şemanın aynısını görür.
 */
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyTestEnv, TEST_DATABASE_URL } from "./test-env.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const LIB_DB_DIR = path.resolve(here, "../../../../lib/db");

export default async function globalSetup(): Promise<void> {
  applyTestEnv(); // DATABASE_URL = TEST_DATABASE_URL — @workspace/db bundan sonra import edilmeli

  const t0 = Date.now();
  const { pool } = await import("@workspace/db");
  try {
    await pool.query("SELECT 1");
  } catch (err: any) {
    throw new Error(
      `Test veritabanına bağlanılamadı (${TEST_DATABASE_URL}): ${err?.message}\n` +
        "Yerelde: docker run -d --name sphere-test-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=sphere_test -p 5432:5432 postgres:16",
    );
  }
  await pool.query("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;");

  // Drizzle şeması — lib/db'nin kendi drizzle-kit'i ve config'i ile (sabit komut, kullanıcı girdisi yok)
  execSync("pnpm exec drizzle-kit push --force", {
    cwd: LIB_DB_DIR,
    stdio: process.env.VITEST_VERBOSE_SETUP ? "inherit" : "pipe",
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });

  // Açılış migration'ları (canlıyla aynı kod)
  const { runStartupMigrations } = await import("../lib/startup-migrations.js");
  await runStartupMigrations();
  await pool.end();

  console.info(`[test] şema hazır (${Date.now() - t0} ms) → ${TEST_DATABASE_URL}`);
}
