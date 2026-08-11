/**
 * In-process scheduler.
 *
 * Node-cron gerekmiyor — her dakika saati kontrol edip window'a girdiğinde tetikliyor.
 * Idempotency: her job kendi DB flag'i ile duplicate koruma yapıyor
 *   - weekly-report: weekly_reports_sent UNIQUE(user_id, week_start)
 *   - content-ingest: content_ingestion_log kontrolü (gün başına 1 kez)
 *
 * Kontroller Türkiye saati (UTC+3) baz alınarak yapılır (Node process TZ değişse bile).
 *
 * ENV:
 *   ENABLE_SCHEDULER=1        → aktif et
 *   SCHEDULER_QUIET=1         → log yazma
 */

import { pool } from "@workspace/db";
import { runWeeklyReportForAllUsers } from "./weekly-report.js";
import { extractPending } from "./mistake-extractor.js";
import { fetchGuardianArticles } from "./content-ingest/guardian.js";
import { enrichArticle } from "./content-ingest/enrich.js";
import { fetchAllSources as fetchCareerAll, enrichCareerItem } from "./career-ingest.js";

const TZ_OFFSET_MIN = 3 * 60; // Türkiye UTC+3

function nowTr(): { day: number; hour: number; minute: number; iso: string } {
  const now = new Date();
  const tr = new Date(now.getTime() + TZ_OFFSET_MIN * 60000);
  return {
    day: tr.getUTCDay(),      // 0=Pazar, 1=Pzt, ...
    hour: tr.getUTCHours(),
    minute: tr.getUTCMinutes(),
    iso: tr.toISOString(),
  };
}

function log(msg: string) {
  if (process.env.SCHEDULER_QUIET === "1") return;
  console.log(`[scheduler] ${msg}`);
}

/** Content ingest — her sabah 06:00 UTC (~09:00 TR) */
async function tryContentIngest(t: ReturnType<typeof nowTr>) {
  if (!(t.hour === 9 && t.minute < 5)) return;
  if (!process.env.GUARDIAN_API_KEY || !process.env.OPENAI_API_KEY) return;

  // Bugün zaten bir run yapıldı mı?
  const check: any = await pool.query(
    `SELECT id FROM content_ingestion_log
       WHERE source = 'guardian' AND run_at::date = CURRENT_DATE LIMIT 1`,
  );
  if (check.rows[0]) return;

  log(`Content ingest başlıyor (${t.iso})`);
  const startedAt = Date.now();
  try {
    const fetchResult = await fetchGuardianArticles();
    let enriched = 0, enrichFailed = 0;
    for (const id of fetchResult.articleIds) {
      const r = await enrichArticle(id);
      if (r.ok) enriched++; else enrichFailed++;
    }
    await pool.query(
      `INSERT INTO content_ingestion_log (source, fetched_count, new_count, enriched_count, error_count, duration_ms, details)
       VALUES ('guardian', $1, $2, $3, $4, $5, $6::jsonb)`,
      [fetchResult.fetched, fetchResult.inserted, enriched,
       fetchResult.errors.length + enrichFailed, Date.now() - startedAt,
       JSON.stringify({ errors: fetchResult.errors, skipped: fetchResult.skipped, source: "scheduler" })],
    );
    log(`Content ingest OK: ${fetchResult.fetched} fetch, ${fetchResult.inserted} yeni, ${enriched} enrich`);
  } catch (e: any) {
    log(`Content ingest HATA: ${e?.message}`);
  }
}

/** Career content ingest — her sabah 09:15 TR */
async function tryCareerIngest(t: ReturnType<typeof nowTr>) {
  if (!(t.hour === 9 && t.minute >= 15 && t.minute < 20)) return;
  if (!process.env.OPENAI_API_KEY) return;

  const check: any = await pool.query(
    `SELECT id FROM career_ingestion_log WHERE run_at::date = CURRENT_DATE LIMIT 1`,
  );
  if (check.rows[0]) return;

  log(`Career ingest başlıyor (${t.iso})`);
  const startedAt = Date.now();
  try {
    const result = await fetchCareerAll(5);
    let enriched = 0, enrichFailed = 0;
    for (const id of result.articleIds) {
      const r = await enrichCareerItem(id);
      if (r.ok) enriched++; else enrichFailed++;
    }
    await pool.query(
      `INSERT INTO career_ingestion_log (fetched_count, new_count, enriched_count, error_count, duration_ms, details)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [result.fetched, result.inserted, enriched,
       result.errors.length + enrichFailed, Date.now() - startedAt,
       JSON.stringify({ errors: result.errors, skipped: result.skipped, source: "scheduler" })],
    );
    log(`Career ingest OK: ${result.fetched} fetch, ${result.inserted} yeni, ${enriched} enrich`);
  } catch (e: any) {
    log(`Career ingest HATA: ${e?.message}`);
  }
}

/** Weekly report — Pazartesi 08:00 TR */
async function tryWeeklyReport(t: ReturnType<typeof nowTr>) {
  if (!(t.day === 1 && t.hour === 8 && t.minute < 5)) return;

  // Bu Pazartesi zaten çalıştı mı? (weekly_reports_sent'te bugün insert var mı)
  const check: any = await pool.query(
    `SELECT id FROM weekly_reports_sent WHERE sent_at::date = CURRENT_DATE LIMIT 1`,
  );
  if (check.rows[0]) return;

  log(`Weekly report başlıyor (${t.iso})`);
  try {
    // Önce mistake extraction (max 50 sohbet)
    try {
      const ext = await extractPending(50);
      log(`Mistake extraction: ${ext.processed} sohbet, ${ext.totalMistakes} hata`);
    } catch (e: any) {
      log(`Extract skip: ${e?.message}`);
    }
    const r = await runWeeklyReportForAllUsers();
    log(`Weekly report OK: ${r.processed} işlendi, ${r.sent} gönderildi, ${r.skipped} atlandı`);
  } catch (e: any) {
    log(`Weekly report HATA: ${e?.message}`);
  }
}

/** Ana tick — her 60 sn */
let started = false;
export function startScheduler() {
  if (started) return;
  if (process.env.ENABLE_SCHEDULER !== "1") {
    log("Devre dışı (ENABLE_SCHEDULER=1 yap)");
    return;
  }
  started = true;
  log("Scheduler aktif — 60 sn'de bir kontrol");

  const tick = async () => {
    const t = nowTr();
    try { await tryContentIngest(t); } catch (e: any) { log(`ingest tick err: ${e?.message}`); }
    try { await tryCareerIngest(t); } catch (e: any) { log(`career tick err: ${e?.message}`); }
    try { await tryWeeklyReport(t); } catch (e: any) { log(`weekly tick err: ${e?.message}`); }
  };

  // 60 sn'de bir
  setInterval(tick, 60_000);
  // İlk tetikleme app start'tan 30 sn sonra
  setTimeout(tick, 30_000);
}
