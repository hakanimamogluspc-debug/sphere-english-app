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
  ];
  for (const sql of migrations) {
    try {
      await pool.query(sql);
      logger.info({ sql }, "Startup migration applied");
    } catch (err: any) {
      logger.warn({ sql, err: err.message }, "Startup migration skipped");
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
