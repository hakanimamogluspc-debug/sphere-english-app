/**
 * Iyzico Refund Servisi
 *
 * Admin panelden tetiklenen iade işlemleri.
 *
 * Iyzipay refund.create: paymentTransactionId gerektirir.
 * Bu değer başarılı payment response'unda `paymentItems[].paymentTransactionId` olarak gelir.
 * Payments tablosunda `rawPayload.paymentItems[0].paymentTransactionId` olarak saklanır.
 *
 * ENV:
 *   IYZICO_API_KEY, IYZICO_SECRET_KEY (lib/iyzico.ts tarafından okunur)
 */

import { db, paymentsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { getIyzicoClient, iyzicoCall, newConversationId } from "../lib/iyzico.js";
import { logger } from "../lib/logger.js";

export type RefundReason =
  | "customer_request"      // Müşteri talebi
  | "duplicate_charge"      // Çift tahsilat
  | "fraud"                 // Dolandırıcılık şüphesi
  | "service_failure"       // Hizmet verilemedi
  | "other";

export interface RefundRequest {
  /** payments.id (bizim DB'deki ödeme kaydı) */
  paymentId: number;
  /** TL cinsinden iade tutarı. null/undefined ise tam iade yapılır. */
  amount?: number | null;
  reason: RefundReason;
  /** Admin notu */
  notes?: string;
  /** İsteği yapan admin user ID (audit için) */
  adminUserId: number;
  /** İade IP adresi — Iyzico zorunlu field */
  ip: string;
}

export interface RefundResult {
  ok: boolean;
  refundPaymentId?: number;      // Yeni oluşturulan refund kaydının payments.id'si
  providerRefundId?: string;     // Iyzico tarafındaki refund paymentId
  amount?: number;
  error?: string;
}

/**
 * Iyzico'ya refund çağrısı atar, DB'ye audit kaydı yazar.
 *
 * ÖNEMLİ: Refund tam veya kısmi olabilir. Kısmi iade için `amount` ver.
 * Tam iade için `amount` null bırak — orijinal tutar kullanılır.
 */
export async function processRefund(req: RefundRequest): Promise<RefundResult> {
  // 1. Orijinal ödeme kaydını çek
  const [payment] = await db.select().from(paymentsTable)
    .where(eq(paymentsTable.id, req.paymentId));

  if (!payment) {
    return { ok: false, error: "Ödeme bulunamadı" };
  }
  if (payment.status !== "success") {
    return { ok: false, error: `Sadece başarılı ödemeler iade edilebilir (mevcut: ${payment.status})` };
  }
  if (payment.eventType === "refund") {
    return { ok: false, error: "Zaten bir refund kaydı — tekrar iade yapamazsınız" };
  }

  // Daha önce iade edilmiş mi?
  const existingRefunds = await db.select({ amount: paymentsTable.amount }).from(paymentsTable)
    .where(sql`${paymentsTable.providerPaymentId} = ${payment.providerPaymentId} AND event_type = 'refund' AND status = 'success'`);
  const alreadyRefunded = existingRefunds.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const originalAmount = Number(payment.amount || 0);
  const remainingRefundable = originalAmount - alreadyRefunded;

  if (remainingRefundable <= 0) {
    return { ok: false, error: "Bu ödeme tamamen iade edilmiş" };
  }

  // Refund tutarı
  const refundAmount = req.amount ?? remainingRefundable;
  if (refundAmount <= 0 || refundAmount > remainingRefundable) {
    return { ok: false, error: `İade tutarı 0 ile ${remainingRefundable} TL arasında olmalı` };
  }

  // 2. paymentTransactionId'yi raw_payload'dan al
  const raw = payment.rawPayload as any;
  const paymentTransactionId =
    raw?.paymentItems?.[0]?.paymentTransactionId ??
    raw?.paymentTransactionId ??
    null;

  if (!paymentTransactionId) {
    logger.error({ paymentId: payment.id, rawKeys: Object.keys(raw || {}) },
      "[refund] paymentTransactionId raw_payload içinde bulunamadı");
    return { ok: false, error: "Ödeme transaction ID'si eksik (eski kayıt — manuel Iyzico panelinden iade yap)" };
  }

  // 3. Iyzico'ya refund çağrısı
  const iyzipay = getIyzicoClient();
  if (!iyzipay) {
    return { ok: false, error: "Iyzico client yapılandırılmamış" };
  }

  const conversationId = newConversationId("refund");
  const iyzicoReq = {
    locale: "tr",
    conversationId,
    paymentTransactionId,
    price: refundAmount.toFixed(2),
    currency: payment.currency || "TRY",
    ip: req.ip,
  };

  try {
    const result: any = await iyzicoCall((r, cb) => iyzipay.refund.create(r, cb), iyzicoReq);
    const refundSuccess = result?.status === "success";

    // 4. Payments tablosuna refund event'i yaz (başarılı veya başarısız)
    const [refundRecord] = await db.insert(paymentsTable).values({
      userId: payment.userId,
      subscriptionId: payment.subscriptionId,
      eventType: "refund",
      status: refundSuccess ? "success" : "failed",
      amount: refundAmount.toFixed(2),
      currency: payment.currency || "TRY",
      provider: "iyzico",
      providerPaymentId: payment.providerPaymentId,            // orijinal paymentId
      providerConversationId: conversationId,
      errorCode: refundSuccess ? null : result?.errorCode,
      errorMessage: refundSuccess ? null : result?.errorMessage,
      rawPayload: {
        request: { ...iyzicoReq, adminUserId: req.adminUserId, reason: req.reason, notes: req.notes },
        response: result,
      },
    }).returning();

    if (!refundSuccess) {
      logger.error({ paymentId: payment.id, result }, "[refund] Iyzico refund failed");
      return {
        ok: false,
        error: result?.errorMessage || "Iyzico refund hatası",
        refundPaymentId: refundRecord.id,
      };
    }

    logger.info({
      paymentId: payment.id,
      refundPaymentId: refundRecord.id,
      amount: refundAmount,
      adminUserId: req.adminUserId,
    }, "[refund] ✓ Iade başarılı");

    return {
      ok: true,
      refundPaymentId: refundRecord.id,
      providerRefundId: result?.paymentId,
      amount: refundAmount,
    };
  } catch (err: any) {
    const errorMessage = err?.message || "Iyzico refund network error";
    logger.error({ paymentId: payment.id, err: errorMessage }, "[refund] Exception");

    // Hata durumunda da audit kaydı
    await db.insert(paymentsTable).values({
      userId: payment.userId,
      subscriptionId: payment.subscriptionId,
      eventType: "refund",
      status: "failed",
      amount: refundAmount.toFixed(2),
      currency: payment.currency || "TRY",
      provider: "iyzico",
      providerPaymentId: payment.providerPaymentId,
      providerConversationId: conversationId,
      errorMessage,
      rawPayload: {
        request: { ...iyzicoReq, adminUserId: req.adminUserId, reason: req.reason, notes: req.notes },
        exception: errorMessage,
      },
    });

    return { ok: false, error: errorMessage };
  }
}
