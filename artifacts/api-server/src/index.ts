import app from "./app";
import { logger } from "./lib/logger";
import { seedDatabase } from "./seed.js";
import { pool } from "@workspace/db";
import { db, quizzesTable } from "@workspace/db";
import { eq, isNull, and } from "drizzle-orm";

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

// ── Sistem quizlerini ekle (her seviye için, teacherId NULL) ─────────────────
const SYSTEM_QUIZZES = [
  { level: "A1", title: "A1 Seviyesi - Temel Alıştırmalar", passingScore: 60, timeLimit: 15 },
  { level: "A2", title: "A2 Seviyesi - Temel Alıştırmalar", passingScore: 60, timeLimit: 15 },
  { level: "B1", title: "B1 Seviyesi - Orta Seviye Alıştırmalar", passingScore: 65, timeLimit: 20 },
  { level: "B2", title: "B2 Seviyesi - Orta-Üstü Alıştırmalar", passingScore: 65, timeLimit: 20 },
  { level: "C1", title: "C1 Seviyesi - İleri Alıştırmalar", passingScore: 70, timeLimit: 25 },
  { level: "C2", title: "C2 Seviyesi - Yetkinlik Alıştırmaları", passingScore: 75, timeLimit: 30 },
];

async function ensureSystemQuizzes() {
  try {
    for (const sq of SYSTEM_QUIZZES) {
      const existing = await db.select({ id: quizzesTable.id })
        .from(quizzesTable)
        .where(and(eq((quizzesTable as any).level, sq.level), isNull(quizzesTable.teacherId)))
        .limit(1);

      if (existing.length > 0) continue;

      await db.insert(quizzesTable).values({
        title: sq.title,
        level: sq.level as any,
        teacherId: null,
        passingScore: sq.passingScore,
        timeLimit: sq.timeLimit,
        courseId: null,
      });

      logger.info({ level: sq.level }, `System quiz ensured: ${sq.title}`);
    }
  } catch (err: any) {
    logger.warn({ err: err.message }, "ensureSystemQuizzes: non-fatal error");
  }
}

runStartupMigrations()
  .then(() => ensureSystemQuizzes())
  .then(() => {
    app.listen(port, "0.0.0.0", (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }

      logger.info({ port }, "Server listening");

      seedDatabase().catch((e) => logger.error({ err: e }, "Seed error"));
    });
  });
