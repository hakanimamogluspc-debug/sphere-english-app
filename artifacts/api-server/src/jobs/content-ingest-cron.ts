/**
 * Content Ingestion Cron Job
 *
 * Guardian'dan haber çeker + GPT-4o ile enrichment yapar.
 *
 * Çalıştırma:
 *   • Manuel: node ./dist/jobs/content-ingest-cron.mjs
 *   • Cron (Easypanel): günde 1 kez, sabah 06:00
 *       0 6 * * * cd /app && node ./dist/jobs/content-ingest-cron.mjs
 *
 * Ortam değişkenleri:
 *   GUARDIAN_API_KEY   (zorunlu)
 *   OPENAI_API_KEY     (zorunlu — enrichment için)
 *   DATABASE_URL       (zorunlu)
 */

import { pool } from "@workspace/db";
import { fetchGuardianArticles } from "../lib/content-ingest/guardian.js";
import { enrichArticle, enrichPending } from "../lib/content-ingest/enrich.js";

async function main() {
  const startedAt = Date.now();
  console.log(`[content-ingest] Başladı: ${new Date(startedAt).toISOString()}`);

  if (!process.env.GUARDIAN_API_KEY) {
    console.error("[content-ingest] HATA: GUARDIAN_API_KEY tanımlı değil.");
    process.exit(1);
  }
  if (!process.env.OPENAI_API_KEY) {
    console.error("[content-ingest] HATA: OPENAI_API_KEY tanımlı değil.");
    process.exit(1);
  }

  // 1. Guardian fetch
  console.log("[content-ingest] Guardian API çekiliyor...");
  const fetchResult = await fetchGuardianArticles();
  console.log(`[content-ingest] Fetched: ${fetchResult.fetched}, Inserted: ${fetchResult.inserted}, Skipped: ${fetchResult.skipped}`);
  if (fetchResult.errors.length) {
    console.warn(`[content-ingest] Errors: ${fetchResult.errors.join(" | ")}`);
  }

  // 2. Enrichment (yeni gelenler + geride kalmış olabilecekler)
  let enriched = 0, enrichFailed = 0;
  for (const id of fetchResult.articleIds) {
    const r = await enrichArticle(id);
    if (r.ok) enriched++; else enrichFailed++;
  }
  // Bekleyen (önceki run'da başarısız olanlar) — max 10
  const pending = await enrichPending(10);
  enriched += pending.ok;
  enrichFailed += pending.failed;
  console.log(`[content-ingest] Enriched: ${enriched}, Failed: ${enrichFailed}`);

  // 3. Log
  const durationMs = Date.now() - startedAt;
  await pool.query(
    `INSERT INTO content_ingestion_log (source, fetched_count, new_count, enriched_count, error_count, duration_ms, details)
     VALUES ('guardian', $1, $2, $3, $4, $5, $6::jsonb)`,
    [fetchResult.fetched, fetchResult.inserted, enriched,
     fetchResult.errors.length + enrichFailed, durationMs,
     JSON.stringify({ errors: fetchResult.errors, skipped: fetchResult.skipped, pending })],
  );

  console.log(`[content-ingest] Bitti (${durationMs}ms)`);
  await pool.end();
  process.exit(0);
}

main().catch((e) => {
  console.error("[content-ingest] FATAL:", e);
  process.exit(1);
});
