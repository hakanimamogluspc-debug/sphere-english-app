/**
 * Otomatik bekleyen e-kitap satışı kurtarma cron'u.
 *
 * Iyzico callback bazen başarısız olabiliyor (network, signature, timing).
 * Bu cron her 5 dakikada bir BEKLEYEN satışları tarar ve şu kontrolleri yapar:
 *   1. Pre-create'ten 10 dakikadan fazla olmuş mu? (yeni kayıtları henüz işleme)
 *   2. Iyzico paymentId atanmış mı? (callback aldıysa, sadece DB kaydı eksikse)
 *   3. Pending kayıt 24 saatten yeni mi? (eski olanlar abandoned cart, dokunma)
 *   4. Eğer şartlar uygunsa: success'e çevir, download token üret, mail at, admin'e bildir
 *
 * Bu sayede activate fail durumlarında kullanıcı en geç 5 dk içinde
 * otomatik olarak PDF mail'ini alır — manuel müdahale gerekmez.
 */

import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import crypto from "node:crypto";
import { sendEbookDownloadMail } from "./ebook-mail.js";
import { notifyNewEbookPurchase } from "./admin-notifications.js";
import { captureException } from "./sentry.js";

const RECOVERY_INTERVAL_MS = 5 * 60 * 1000; // 5 dakika
const MIN_AGE_MS = 1 * 60 * 1000;            // 1 dk geçmiş bekleyenleri al
const MAX_AGE_MS = 24 * 60 * 60 * 1000;      // 24 saatten eski olanlar abandoned

let intervalRef: NodeJS.Timeout | null = null;

async function recoverPendingPurchases(): Promise<void> {
  try {
    // BEKLEYEN ama Iyzico ödemesi başarılı (paymentId var) ve makul yaş aralığında
    const candidates = await db.execute(sql`
      SELECT
        ep.id, ep.ebook_id, ep.buyer_email, ep.amount_paid,
        ep.iyzico_payment_id, ep.iyzico_conversation_id, ep.created_at,
        ep.download_token
      FROM ebook_purchases ep
      WHERE ep.payment_status = 'pending'
        AND ep.iyzico_payment_id IS NOT NULL
        AND ep.iyzico_payment_id != ''
        AND ep.created_at > NOW() - INTERVAL '24 hours'
        AND ep.created_at < NOW() - INTERVAL '1 minute'
      ORDER BY ep.created_at ASC
      LIMIT 20
    `);
    const rows = (candidates.rows ?? candidates) as any[];

    if (rows.length === 0) return;

    console.info(`[ebook-recovery] ${rows.length} bekleyen satış bulundu — otomatik kurtarma başlıyor`);

    for (const purchase of rows) {
      const id = Number(purchase.id);
      try {
        const newToken = purchase.download_token || crypto.randomBytes(32).toString("base64url");
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        const paidAtIso = new Date().toISOString();

        // Pending → success
        await db.execute(sql`
          UPDATE ebook_purchases SET
            payment_status = 'success',
            download_token = ${newToken},
            download_expires_at = ${expiresAt}::TIMESTAMPTZ,
            paid_at = COALESCE(paid_at, ${paidAtIso}::TIMESTAMPTZ),
            updated_at = NOW(),
            notes = COALESCE(notes, '') || ${' [AUTO-RECOVERY: cron ' + new Date().toISOString() + ']'}
          WHERE id = ${id} AND payment_status = 'pending'
        `);

        // Detaylı bilgileri çek (ebook title vb.)
        const detailRows = await db.execute(sql`
          SELECT ep.id, ep.buyer_email, ep.buyer_name, ep.invoice_type,
                 ep.amount_paid, ep.currency,
                 ep.download_token, ep.download_expires_at, ep.payment_status,
                 e.title AS ebook_title, e.author AS ebook_author
          FROM ebook_purchases ep
          LEFT JOIN ebooks e ON e.id = ep.ebook_id
          WHERE ep.id = ${id}
          LIMIT 1
        `);
        const detail = (detailRows.rows ?? detailRows)[0] as any;
        if (!detail || detail.payment_status !== "success") {
          console.warn(`[ebook-recovery] id=${id} success'e geçemedi — atlandı`);
          continue;
        }

        // Müşteriye PDF mail
        try {
          await sendEbookDownloadMail({
            buyerEmail: detail.buyer_email,
            buyerName: detail.buyer_name ?? null,
            ebookTitle: detail.ebook_title ?? "Sphere English E-Kitap",
            ebookAuthor: detail.ebook_author ?? "Sphere English",
            amountPaid: detail.amount_paid,
            currency: detail.currency ?? "TRY",
            downloadToken: detail.download_token,
            downloadExpiresAt: detail.download_expires_at,
            invoiceType: detail.invoice_type,
          });
          await db.execute(sql`
            UPDATE ebook_purchases SET
              mail_status = 'sent',
              mail_sent_at = NOW(),
              mail_attempts = mail_attempts + 1,
              updated_at = NOW()
            WHERE id = ${id}
          `);
        } catch (mailErr: any) {
          console.error(`[ebook-recovery] id=${id} mail HATA:`, mailErr?.message);
          await db.execute(sql`
            UPDATE ebook_purchases SET
              mail_status = 'failed',
              mail_error = ${mailErr?.message ?? "unknown"},
              mail_attempts = mail_attempts + 1,
              updated_at = NOW()
            WHERE id = ${id}
          `);
        }

        // Admin bildirimi
        try {
          await notifyNewEbookPurchase({
            purchaseId: id,
            buyerEmail: detail.buyer_email,
            ebookTitle: detail.ebook_title ?? "E-kitap",
            amountTl: Number(detail.amount_paid ?? 0),
          });
        } catch (notifyErr: any) {
          console.error(`[ebook-recovery] id=${id} admin notify HATA:`, notifyErr?.message);
        }

        console.info(`[ebook-recovery] ✓ id=${id} otomatik kurtarıldı (${detail.buyer_email})`);
      } catch (perItemErr: any) {
        console.error(`[ebook-recovery] id=${id} HATA:`, perItemErr?.message);
        captureException(perItemErr, { context: "ebook-recovery", purchaseId: id });
      }
    }
  } catch (e: any) {
    console.error("[ebook-recovery] cron HATA:", e?.message);
    captureException(e, { context: "ebook-recovery-cron" });
  }
}

export function startEbookRecoveryCron(): void {
  if (intervalRef) return;

  // İlk çalışmayı 1 dk sonra başlat (boot sırasında DB tam hazır olsun)
  setTimeout(() => {
    void recoverPendingPurchases();
  }, 60 * 1000);

  intervalRef = setInterval(() => {
    void recoverPendingPurchases();
  }, RECOVERY_INTERVAL_MS);

  console.info(`[ebook-recovery] Cron aktif — her ${RECOVERY_INTERVAL_MS / 60000} dakikada bir kontrol`);
}

export function stopEbookRecoveryCron(): void {
  if (intervalRef) {
    clearInterval(intervalRef);
    intervalRef = null;
  }
}
