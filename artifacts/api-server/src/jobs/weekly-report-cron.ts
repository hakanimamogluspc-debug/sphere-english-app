/**
 * Weekly Report Cron Job
 *
 * Pazartesi sabah 08:00 (Türkiye) — geçen haftanın raporunu tüm aktif kullanıcılara gönderir.
 *
 * Cron (Easypanel):
 *   0 5 * * 1 cd /app && node ./dist/jobs/weekly-report-cron.mjs   # 05:00 UTC = 08:00 TR
 *
 * ENV: OPENAI_API_KEY, DATABASE_URL, ADMIN_NOTIFICATION_EMAILS (opsiyonel)
 *
 * Bonus: mistake extraction'i da bu sırada çağırır — son 7 günün AI Tutor sohbetlerini işler.
 */

import { pool } from "@workspace/db";
import { runWeeklyReportForAllUsers } from "../lib/weekly-report.js";
import { extractPending } from "../lib/mistake-extractor.js";

async function main() {
  const startedAt = Date.now();
  console.log(`[weekly-report] Başladı: ${new Date(startedAt).toISOString()}`);

  // 1. Önce bekleyen mistake extraction'ları işle (raporda görünsün)
  try {
    console.log("[weekly-report] Mistake extraction başlıyor...");
    const ext = await extractPending(50);
    console.log(`[weekly-report] Extract: ${ext.processed} sohbet, ${ext.totalMistakes} hata, ${ext.errors.length} hata`);
    if (ext.errors.length > 0) console.warn(ext.errors.slice(0, 5).join("\n"));
  } catch (e: any) {
    console.warn("[weekly-report] extract skip:", e?.message);
  }

  // 2. Rapor gönderimi
  const result = await runWeeklyReportForAllUsers();
  console.log(`[weekly-report] İşlenen: ${result.processed}, Gönderilen: ${result.sent}, Atlanan: ${result.skipped}`);

  console.log(`[weekly-report] Bitti (${Date.now() - startedAt}ms)`);
  await pool.end();
  process.exit(0);
}

main().catch((e) => {
  console.error("[weekly-report] FATAL:", e);
  process.exit(1);
});
