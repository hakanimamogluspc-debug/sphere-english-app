/**
 * Outreach Discovery Cron Job
 *
 * Çalıştırma:
 *   • Manuel (geliştirme): pnpm --filter @workspace/api-server discover
 *   • Üretim cron (Easypanel veya host cron):
 *       0 3 * * 1-5 cd /app && node ./dist/jobs/discovery-cron.mjs
 *
 * Adımlar:
 *   1. 4 segment için paralel Apify keşfi (~200 lead/gün)
 *   2. Email doğrulama (yeni gelenlerin tümü)
 *   3. Özet log
 *
 * Ortam değişkenleri:
 *   APIFY_API_TOKEN         (zorunlu)
 *   DATABASE_URL            (zorunlu)
 *   OUTREACH_LIMIT_PER_SEGMENT  (opsiyonel, default: 50)
 */

import { discoverAllSegments } from "../services/outreach-discovery.js";
import { verifyPendingLeads } from "../services/outreach-verifier.js";
import { SEGMENT_LABELS } from "@workspace/db";

async function main() {
  const startedAt = new Date();
  console.log(`[outreach-cron] Başladı: ${startedAt.toISOString()}`);

  if (!process.env.APIFY_API_TOKEN) {
    console.error("[outreach-cron] HATA: APIFY_API_TOKEN tanımlı değil. İptal ediliyor.");
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error("[outreach-cron] HATA: DATABASE_URL tanımlı değil. İptal ediliyor.");
    process.exit(1);
  }

  const limitPerSegment = Number(process.env.OUTREACH_LIMIT_PER_SEGMENT ?? "50");

  // ─── 1. Keşif ─────────────────────────────────────────────────────────
  console.log(`[outreach-cron] 4 segment paralel keşif başlıyor (segment başına ${limitPerSegment} lead hedefi)`);
  const discoveryResults = await discoverAllSegments({ limitPerSegment });

  let totalAdded = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  for (const r of discoveryResults) {
    const label = SEGMENT_LABELS[r.segment];
    if (r.errorMessage) {
      console.error(`[outreach-cron] ❌ ${label}: ${r.errorMessage}`);
      continue;
    }
    console.log(
      `[outreach-cron] ✓ ${label}: ${r.itemsScraped} taranan, ${r.leadsAdded} yeni, ${r.leadsUpdated} güncellendi, ${r.leadsSkipped} atlandı`,
    );
    totalAdded += r.leadsAdded;
    totalUpdated += r.leadsUpdated;
    totalSkipped += r.leadsSkipped;
  }

  console.log(
    `[outreach-cron] Keşif özeti: ${totalAdded} yeni lead, ${totalUpdated} güncellendi, ${totalSkipped} atlandı`,
  );

  // ─── 2. Email doğrulama (sadece yeni lead varsa) ─────────────────────
  if (totalAdded > 0) {
    console.log(`[outreach-cron] Email doğrulama başlıyor...`);
    const verifyResult = await verifyPendingLeads({ batchSize: Math.min(200, totalAdded * 2) });
    if (verifyResult.error) {
      console.error(`[outreach-cron] ⚠️ Doğrulama hatası: ${verifyResult.error}`);
    } else {
      console.log(
        `[outreach-cron] ✓ Doğrulama: ${verifyResult.verified} email kontrol edildi (valid: ${verifyResult.valid}, invalid: ${verifyResult.invalid}, risky: ${verifyResult.risky})`,
      );
    }
  }

  const durationMs = Date.now() - startedAt.getTime();
  console.log(`[outreach-cron] Tamamlandı (${Math.round(durationMs / 1000)}s)`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[outreach-cron] Beklenmeyen hata:", err);
  process.exit(1);
});
