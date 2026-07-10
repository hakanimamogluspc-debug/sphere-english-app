/**
 * Terkedilmiş sepet hatırlatma cron'u.
 *
 * Çalışma prensibi:
 *   Her 30 dakikada bir tarama yapılır. Şu koşullara uyan pending siparişler için
 *   sepet hatırlatma maili gönderilir:
 *     1. payment_status = 'pending' (henüz başarılı olmadı)
 *     2. created_at > NOW() - 48 saat (çok eski değil — bounce riski)
 *     3. created_at < NOW() - 4 saat (yeterince geçti, sadece dikkat dağınıklığı değil)
 *     4. abandoned_mail_sent_at IS NULL (bir kez atıldı, bir daha atma)
 *     5. buyer_email varsa (form doldurdu, Iyzico modal'a geçti)
 *     6. Aynı email için son 30 gün içinde SUCCESS varsa ATLA (mevcut müşteri)
 *
 *   Aynı order_id'ye tek mail atılır (sepet birden fazla item olsa da).
 *
 * KUPON: RECOVERY10 ekliyoruz (opsiyonel, DB'de tanımlıysa geçerli).
 *   Bu kupon admin panelde manuel oluşturulmalı — cron kupon üretmez, sadece kodu maile koyar.
 */

import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { sendCartAbandonedMail } from "./ebook-mail.js";
import { captureException } from "./sentry.js";

const ABANDONED_INTERVAL_MS = 30 * 60 * 1000; // 30 dakika
const MIN_AGE_HOURS = 4;
const MAX_AGE_HOURS = 48;
const RECOVERY_COUPON = "RECOVERY10"; // Admin panelde bu kod tanımlıysa mailde gösterilir
const RECOVERY_COUPON_PERCENT = 10;

let intervalRef: NodeJS.Timeout | null = null;

async function processAbandonedCarts(): Promise<void> {
  try {
    // 1. Aday order_id'ler bul — pending, 4-48 saat arasında, mail atılmamış
    // Tek sorgu ile group by order_id, çünkü aynı sepet çoklu ürün olabilir
    const candidates = await db.execute(sql`
      SELECT DISTINCT ON (COALESCE(ep.order_id, ep.iyzico_conversation_id))
        COALESCE(ep.order_id, ep.iyzico_conversation_id) AS group_key,
        ep.buyer_email,
        ep.buyer_name,
        ep.created_at
      FROM ebook_purchases ep
      WHERE ep.payment_status = 'pending'
        AND ep.abandoned_mail_sent_at IS NULL
        AND ep.buyer_email IS NOT NULL
        AND ep.buyer_email != ''
        AND ep.created_at < NOW() - (${MIN_AGE_HOURS} || ' hours')::INTERVAL
        AND ep.created_at > NOW() - (${MAX_AGE_HOURS} || ' hours')::INTERVAL
      ORDER BY COALESCE(ep.order_id, ep.iyzico_conversation_id), ep.created_at ASC
      LIMIT 50
    `);
    const rows = (candidates.rows ?? candidates) as any[];
    if (rows.length === 0) return;

    console.info(`[cart-abandoned] ${rows.length} aday sepet bulundu`);

    // Kupon var mı kontrol et (bir kere, tüm mail'ler için ortak)
    let couponAvailable = false;
    try {
      const c = await db.execute(sql`
        SELECT id FROM coupons
        WHERE code = ${RECOVERY_COUPON}
          AND is_active = TRUE
          AND (valid_until IS NULL OR valid_until > NOW())
        LIMIT 1
      `);
      couponAvailable = (c.rows ?? c).length > 0;
    } catch {
      /* coupons tablosu farklı şemada olabilir, sessizce geç */
    }

    for (const cand of rows) {
      const groupKey = String(cand.group_key ?? "");
      const buyerEmail = String(cand.buyer_email ?? "").toLowerCase();
      if (!groupKey || !buyerEmail) continue;

      try {
        // Mükerrer koruma: aynı email için son 30 gün içinde SUCCESS var mı?
        const alreadyPurchased = await db.execute(sql`
          SELECT 1 FROM ebook_purchases
          WHERE LOWER(buyer_email) = ${buyerEmail}
            AND payment_status = 'success'
            AND created_at > NOW() - INTERVAL '30 days'
          LIMIT 1
        `);
        if ((alreadyPurchased.rows ?? alreadyPurchased).length > 0) {
          // Bu email zaten müşteri, mail atma. Ama mail_sent_at'i işaretle ki tekrar taranmasın.
          await db.execute(sql`
            UPDATE ebook_purchases SET abandoned_mail_sent_at = NOW()
            WHERE (order_id = ${groupKey} OR iyzico_conversation_id = ${groupKey})
              AND payment_status = 'pending'
          `);
          console.info(`[cart-abandoned] SKIP ${buyerEmail} — son 30 gün içinde SUCCESS var`);
          continue;
        }

        // Sepet detaylarını çek
        const detailsRows = await db.execute(sql`
          SELECT ep.id, ep.buyer_email, ep.buyer_name, ep.amount_paid, ep.bundle_id,
                 e.title AS ebook_title, e.author AS ebook_author, e.cover_image_url AS ebook_cover,
                 b.title AS bundle_title, b.cover_image_url AS bundle_cover
          FROM ebook_purchases ep
          LEFT JOIN ebooks e ON e.id = ep.ebook_id
          LEFT JOIN ebook_bundles b ON b.id = ep.bundle_id
          WHERE (ep.order_id = ${groupKey} OR ep.iyzico_conversation_id = ${groupKey})
            AND ep.payment_status = 'pending'
          ORDER BY ep.id ASC
        `);
        const details = (detailsRows.rows ?? detailsRows) as any[];
        if (details.length === 0) continue;

        // Bundle'ları tekilleştir — aynı bundle'a ait çoklu ebook satırı varsa
        // sadece 1 kez göster.
        const seen = new Set<string>();
        const mailItems: Array<{
          title: string;
          author: string | null;
          priceTry: number;
          isBundle: boolean;
          coverUrl: string | null;
        }> = [];
        let totalTry = 0;

        for (const d of details) {
          if (d.bundle_id) {
            const key = `bundle:${d.bundle_id}`;
            if (seen.has(key)) continue;
            seen.add(key);
            // Bundle toplam fiyatı = bu bundle'a ait tüm satırların amount_paid toplamı
            const bundleTotal = details
              .filter((x) => x.bundle_id === d.bundle_id)
              .reduce((s, x) => s + Number(x.amount_paid ?? 0), 0);
            mailItems.push({
              title: String(d.bundle_title ?? "Kitap Paketi"),
              author: null,
              priceTry: bundleTotal,
              isBundle: true,
              coverUrl: d.bundle_cover ?? null,
            });
            totalTry += bundleTotal;
          } else {
            mailItems.push({
              title: String(d.ebook_title ?? "E-kitap"),
              author: d.ebook_author ?? null,
              priceTry: Number(d.amount_paid ?? 0),
              isBundle: false,
              coverUrl: d.ebook_cover ?? null,
            });
            totalTry += Number(d.amount_paid ?? 0);
          }
        }

        const wwwBase =
          process.env.PUBLIC_WWW_BASE_URL ?? "https://www.sphereenglish.com";
        const cartUrl = `${wwwBase.replace(/\/$/, "")}/sepet`;

        // Mail at
        const mailResult = await sendCartAbandonedMail({
          buyerEmail,
          buyerName: details[0].buyer_name ?? null,
          items: mailItems,
          totalTry,
          cartUrl,
          couponCode: couponAvailable ? RECOVERY_COUPON : null,
          couponPercent: couponAvailable ? RECOVERY_COUPON_PERCENT : null,
        });

        // Tüm satırların abandoned_mail_sent_at'ini işaretle
        await db.execute(sql`
          UPDATE ebook_purchases SET abandoned_mail_sent_at = NOW()
          WHERE (order_id = ${groupKey} OR iyzico_conversation_id = ${groupKey})
            AND payment_status = 'pending'
        `);

        if (mailResult.ok) {
          console.info(
            `[cart-abandoned] mail gönderildi: ${buyerEmail} (order=${groupKey}, ${mailItems.length} ürün, ${totalTry.toFixed(0)} TL)`,
          );
        } else {
          console.error(
            `[cart-abandoned] mail HATA: ${buyerEmail} order=${groupKey} → ${mailResult.error}`,
          );
        }
      } catch (itemErr: any) {
        console.error(
          `[cart-abandoned] order=${groupKey} işleme HATA:`,
          itemErr?.message,
        );
        try {
          captureException(itemErr, {
            tags: { module: "cart-abandoned" },
            extra: { orderKey: groupKey },
          });
        } catch {
          /* ignore */
        }
      }
    }
  } catch (e: any) {
    console.error("[cart-abandoned] cron HATA:", e?.message);
    try {
      captureException(e, { tags: { module: "cart-abandoned" } });
    } catch {
      /* ignore */
    }
  }
}

/**
 * Cron'u başlat. index.ts'te bir kez çağrılır.
 * Her 30 dakikada bir tarama.
 */
export function startCartAbandonedCron(): void {
  if (intervalRef) {
    console.warn("[cart-abandoned] cron zaten çalışıyor");
    return;
  }
  console.info(
    `[cart-abandoned] cron başladı — her ${ABANDONED_INTERVAL_MS / 60000} dk tarama, ${MIN_AGE_HOURS}-${MAX_AGE_HOURS} saat pending sepetler`,
  );
  // 60 saniye sonra ilk çalıştırma (startup'ta hemen yük olmasın)
  setTimeout(() => {
    void processAbandonedCarts();
    intervalRef = setInterval(() => void processAbandonedCarts(), ABANDONED_INTERVAL_MS);
  }, 60 * 1000);
}

export function stopCartAbandonedCron(): void {
  if (intervalRef) {
    clearInterval(intervalRef);
    intervalRef = null;
    console.info("[cart-abandoned] cron durduruldu");
  }
}
