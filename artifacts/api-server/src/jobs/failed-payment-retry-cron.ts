/**
 * Failed Payment Retry Cron
 *
 * Her 1 saatte çalışır:
 *   - Son 48 saat içinde başarısız ödemeler (checkout_failed veya subscription_failed)
 *   - Henüz kullanıcıya bildirim gönderilmemiş (raw_payload.retry_notified_at YOK)
 *   - İlgili subscription aktif ya da pending durumda
 *
 * Yapılan iş:
 *   1. Kullanıcıya "Ödeme Başarısız — Tekrar Dene" email'i gönder
 *   2. Payment raw_payload'una notified_at timestamp yaz (bir daha gönderilmesin)
 *   3. Admin'e Slack/mail özeti (toplam fail sayısı > 5 ise)
 *
 * ENV:
 *   PAYMENT_RETRY_CRON_ENABLED=true  — aktif
 *   APP_BASE_URL                      — tekrar deneme CTA linki için
 */

import { db, pool } from "@workspace/db";
import { sendEmail } from "../lib/email.js";
import { logger } from "../lib/logger.js";

const TICK_INTERVAL_MS = 60 * 60 * 1000; // 1 saat
let timer: NodeJS.Timeout | null = null;
let running = false;
let lastTickAt: Date | null = null;
let lastDebug: any = null;

export function getFailedPaymentRetryStatus() {
  return {
    started: timer !== null,
    running,
    lastTickAt,
    lastDebug,
    envEnabled: process.env.PAYMENT_RETRY_CRON_ENABLED === "true",
  };
}

export function startFailedPaymentRetryCron() {
  if (process.env.PAYMENT_RETRY_CRON_ENABLED !== "true") {
    logger.info("[failed-payment-retry] Devre dışı (PAYMENT_RETRY_CRON_ENABLED != true)");
    return;
  }
  if (timer) return;
  logger.info("[failed-payment-retry] Başlatıldı — her 1 saatte bir çalışacak");
  setTimeout(() => tick().catch((e) => logger.error({ err: e?.message }, "[failed-payment-retry] tick error")), 60_000);
  timer = setInterval(() => {
    tick().catch((e) => logger.error({ err: e?.message }, "[failed-payment-retry] tick error"));
  }, TICK_INTERVAL_MS);
}

export function stopFailedPaymentRetryCron() {
  if (timer) { clearInterval(timer); timer = null; }
}

async function tick() {
  if (running) return;
  running = true;
  lastTickAt = new Date();
  const dbg: any = {};
  try {
    // Son 48 saatte başarısız ödeme + bildirim gönderilmemiş + user email'i var
    const { rows } = await pool.query(`
      SELECT
        p.id, p.user_id, p.subscription_id, p.event_type, p.amount, p.currency,
        p.error_code, p.error_message, p.raw_payload, p.created_at,
        u.email, u.first_name,
        s.plan_label, s.plan_key
      FROM payments p
      JOIN users u ON u.id = p.user_id
      LEFT JOIN subscriptions s ON s.id = p.subscription_id
      WHERE p.status = 'failed'
        AND p.event_type IN ('checkout_failed', 'subscription_failed')
        AND p.created_at > NOW() - INTERVAL '48 hours'
        AND (p.raw_payload->>'retry_notified_at') IS NULL
        AND u.email IS NOT NULL
      ORDER BY p.created_at DESC
      LIMIT 100
    `);

    dbg.candidateCount = rows.length;
    let notified = 0;
    let failed = 0;

    for (const row of rows) {
      try {
        const email = String(row.email);
        const firstName = String(row.first_name || "").split(" ")[0] || "Merhaba";
        const planLabel = row.plan_label || "paket";
        const amount = Number(row.amount || 0);
        const errMsg = row.error_message || "Kartınızda sorun oluştu";
        const isSubscription = row.event_type === "subscription_failed";

        const retryUrl = isSubscription
          ? `${process.env.APP_BASE_URL || "https://app.sphereenglish.com"}/abonelik`
          : `${process.env.APP_BASE_URL || "https://app.sphereenglish.com"}/odeme`;

        const subject = isSubscription
          ? "Sphere English — Abonelik yenileme başarısız"
          : "Sphere English — Ödeme tamamlanamadı";

        const html = buildEmailHtml({
          firstName, planLabel, amount, errorMessage: String(errMsg),
          retryUrl, isSubscription,
        });

        const result = await sendEmail(email, subject, html);
        if (result.ok) {
          notified++;
          // raw_payload içine notified_at ekle
          await pool.query(`
            UPDATE payments
            SET raw_payload = COALESCE(raw_payload, '{}'::jsonb) || jsonb_build_object('retry_notified_at', NOW()::text)
            WHERE id = $1
          `, [row.id]);
        } else {
          failed++;
          logger.warn({ paymentId: row.id, err: result.error }, "[failed-payment-retry] email gönderilemedi");
        }
      } catch (e: any) {
        failed++;
        logger.error({ paymentId: row.id, err: e?.message }, "[failed-payment-retry] row error");
      }
    }

    dbg.notified = notified;
    dbg.failed = failed;
    if (notified > 0) logger.info({ notified, failed }, "[failed-payment-retry] ✓ Döngü tamamlandı");
  } finally {
    lastDebug = dbg;
    running = false;
  }
}

function buildEmailHtml(args: {
  firstName: string;
  planLabel: string;
  amount: number;
  errorMessage: string;
  retryUrl: string;
  isSubscription: boolean;
}): string {
  const { firstName, planLabel, amount, errorMessage, retryUrl, isSubscription } = args;
  const title = isSubscription ? "Abonelik yenileme başarısız" : "Ödeme tamamlanamadı";
  const body = isSubscription
    ? `${planLabel} aboneliğinizin otomatik yenilemesi başarısız oldu. Erişiminizin kesilmemesi için kart bilgilerinizi güncelleyin veya tekrar deneyin.`
    : `${planLabel} satın alma işleminiz tamamlanamadı. Hiçbir ücret tahsil edilmedi.`;

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${title}</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background: #f8fafc; margin: 0; padding: 20px;">
  <table role="presentation" width="100%" style="max-width: 560px; margin: 0 auto; background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
    <tr><td>
      <div style="font-size: 48px; margin-bottom: 8px;">⚠️</div>
      <h1 style="color: #ea580c; font-size: 22px; margin: 0 0 8px 0;">${title}</h1>
      <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 16px 0;">
        Merhaba <strong>${firstName}</strong>,<br/><br/>
        ${body}
      </p>

      <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 6px; margin: 16px 0;">
        <div style="font-size: 13px; color: #78350f;">
          <strong>Tutar:</strong> ₺${amount.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}<br/>
          <strong>Hata:</strong> ${errorMessage}
        </div>
      </div>

      <p style="color: #475569; font-size: 14px; line-height: 1.6;">
        Yaygın sebepler:
      </p>
      <ul style="color: #475569; font-size: 14px; line-height: 1.8;">
        <li>Kart limiti yetersiz</li>
        <li>3D Secure doğrulama tamamlanmadı</li>
        <li>Kartınız online ödemelere kapalı — bankanıza açtırın</li>
        <li>Kart bilgileri hatalı</li>
      </ul>

      <div style="text-align: center; margin: 28px 0 16px 0;">
        <a href="${retryUrl}" style="display: inline-block; background: #1e3a6e; color: white; text-decoration: none; padding: 14px 32px; border-radius: 999px; font-weight: bold; font-size: 15px;">
          Tekrar Dene
        </a>
      </div>

      <p style="color: #94a3b8; font-size: 12px; line-height: 1.6; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
        Sorun yaşıyorsanız <a href="mailto:destek@sphereenglish.com" style="color: #0ea5e9;">destek@sphereenglish.com</a> ile iletişime geçin.<br/>
        Bu e-postayı aldıysanız geçen 48 saat içinde Sphere English üzerinden bir ödeme denemesi başarısız olmuştur.
      </p>

      <p style="color: #cbd5e1; font-size: 11px; margin-top: 20px;">
        Sphere English · İş İngilizcesi Eğitim Platformu
      </p>
    </td></tr>
  </table>
</body></html>`;
}
