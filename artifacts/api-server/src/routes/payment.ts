/**
 * Iyzico ödeme akışı — MVP.
 *
 * Endpoint'ler:
 *   GET  /api/payment/plans                  → Plan kataloğu (public)
 *   GET  /api/payment/me/subscription        → Kullanıcının aktif aboneliği (auth)
 *   POST /api/payment/checkout/initialize    → Iyzico Checkout Form üret (auth)
 *   POST /api/payment/checkout/callback      → Iyzico geri dönüş — token doğrula (public, called by Iyzico)
 *   POST /api/payment/webhook                → Iyzico webhook (public, called by Iyzico)
 *   POST /api/payment/subscription/cancel    → Aktif aboneliği iptal et (auth)
 *
 * Akış (tek seferlik ve aylık recurring):
 *   1) Frontend planCode ile initialize çağırır
 *   2) Backend Iyzico API'sini çağırır, checkoutFormContent (HTML) + token alır
 *      → "pending" status'lı subscription kaydı oluşturulur
 *      → payments tablosuna "checkout_initialized" event yazılır
 *   3) Frontend HTML'i embed eder (script tag içinde Iyzico modal açar)
 *   4) Kullanıcı kartı girer + 3DS doğrular
 *   5) Iyzico, callbackUrl'a POST atar (token + status)
 *   6) Backend retrieveCheckoutForm ile token'i doğrular
 *      → Başarılı ise subscription "active", expiresAt set edilir
 *      → payments tablosuna "checkout_success" / "checkout_failed" event yazılır
 *   7) Kullanıcı return URL'ine yönlendirilir (success/failure sayfası)
 *
 * MVP'de recurring tahsilat Iyzico Subscription API yerine "süresi bitince
 * yeniden ödeme" mantığıyla yapılıyor — yani aslında her plan one-time olarak
 * işliyor. Sonraki fazda Subscription API entegre edilecek.
 */

import { Router, Request, Response } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { authMiddleware, type AuthRequest } from "../middlewares/auth.js";
import { PLAN_CATALOG, getPlan, type PlanDefinition } from "../lib/plans.js";
import {
  getIyzicoClient,
  iyzicoCall,
  newConversationId,
  appBaseUrl,
} from "../lib/iyzico.js";

const router = Router();

// ─── Plan kataloğu (public) ──────────────────────────────────────────────
router.get("/plans", (_req: Request, res: Response) => {
  res.json({ plans: PLAN_CATALOG });
});

// ─── Kullanıcının aktif aboneliği (auth) ─────────────────────────────────
router.get(
  "/me/subscription",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    if (!req.userId) return res.status(401).json({ error: "Yetki yok" });
    try {
      const rows = await db.execute(sql`
        SELECT id, plan_key, plan_label, status, amount, currency,
               billing_type, duration_months, started_at, expires_at,
               canceled_at, cancel_at_period_end, current_period_end,
               provider, provider_subscription_id, updated_at
        FROM subscriptions
        WHERE user_id = ${req.userId}
        ORDER BY id DESC
        LIMIT 1
      `);
      const sub = (rows.rows ?? rows)[0] ?? null;
      return res.json({ subscription: sub });
    } catch (e: any) {
      console.error("[PAYMENT] me/subscription HATA:", e?.message);
      return res.status(500).json({ error: "Abonelik bilgisi alınamadı" });
    }
  },
);

// ─── Checkout form başlat (auth) ─────────────────────────────────────────
router.post(
  "/checkout/initialize",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    if (!req.userId) return res.status(401).json({ error: "Yetki yok" });
    const { planCode } = (req.body ?? {}) as { planCode?: string };
    if (!planCode) return res.status(400).json({ error: "planCode gerekli" });

    const plan: PlanDefinition | undefined = getPlan(planCode);
    if (!plan)
      return res.status(400).json({ error: "Geçersiz plan kodu" });

    try {
      // 1) Kullanıcı bilgilerini al — Iyzico'nun zorunlu alanları
      const userRows = await db.execute(sql`
        SELECT id, email, name, role, account_type
        FROM users
        WHERE id = ${req.userId}
        LIMIT 1
      `);
      const user = (userRows.rows ?? userRows)[0] as any;
      if (!user) return res.status(404).json({ error: "Kullanıcı bulunamadı" });

      // 2) Conversation ID üret — webhook/callback eşleştirmesi için
      const conversationId = newConversationId("checkout");

      // 3) Subscription kaydını pending olarak oluştur veya update et
      await db.execute(sql`
        INSERT INTO subscriptions (
          user_id, plan_key, plan_label, amount, currency,
          billing_type, duration_months, status, provider, provider_conversation_id,
          updated_at
        ) VALUES (
          ${req.userId}, ${plan.code}, ${plan.label}, ${plan.amount}, 'TRY',
          ${plan.billingType}, ${plan.durationMonths ?? null},
          'pending', 'iyzico', ${conversationId},
          NOW()
        )
        ON CONFLICT (user_id) DO UPDATE SET
          plan_key = EXCLUDED.plan_key,
          plan_label = EXCLUDED.plan_label,
          amount = EXCLUDED.amount,
          billing_type = EXCLUDED.billing_type,
          duration_months = EXCLUDED.duration_months,
          status = 'pending',
          provider = 'iyzico',
          provider_conversation_id = EXCLUDED.provider_conversation_id,
          updated_at = NOW()
      `);

      // 4) Iyzico Checkout Form Request
      const iyzipay = getIyzicoClient();
      const callbackUrl = `${appBaseUrl()}/api-server/api/payment/checkout/callback`;
      const fullName: string = String(user.name ?? "Sphere Kullanıcı").trim();
      const nameParts = fullName.split(/\s+/);
      const firstName = nameParts[0] || "Sphere";
      const lastName = nameParts.slice(1).join(" ") || "Kullanıcı";

      const request = {
        locale: "tr",
        conversationId,
        price: plan.amount.toFixed(2),
        paidPrice: plan.amount.toFixed(2),
        currency: "TRY",
        basketId: `B-${req.userId}-${Date.now()}`,
        paymentGroup: "SUBSCRIPTION",
        callbackUrl,
        enabledInstallments: [1, 2, 3, 6, 9],
        buyer: {
          id: String(req.userId),
          name: firstName,
          surname: lastName,
          gsmNumber: "+905000000000",
          email: user.email,
          identityNumber: "11111111111",  // TC opsiyonel ama dummy şart
          registrationAddress: "Adres bilgisi sağlanmadı",
          ip: req.ip ?? "127.0.0.1",
          city: "Balıkesir",
          country: "Turkey",
        },
        shippingAddress: {
          contactName: fullName,
          city: "Balıkesir",
          country: "Turkey",
          address: "Dijital ürün — fiziksel teslimat yok",
        },
        billingAddress: {
          contactName: fullName,
          city: "Balıkesir",
          country: "Turkey",
          address: "Dijital ürün — fatura adresi sağlanmadı",
        },
        basketItems: [
          {
            id: plan.code,
            name: plan.label,
            category1: "Eğitim",
            itemType: "VIRTUAL",
            price: plan.amount.toFixed(2),
          },
        ],
      };

      const result: any = await iyzicoCall(
        iyzipay.checkoutFormInitialize.create.bind(iyzipay.checkoutFormInitialize),
        request,
      );

      // 5) payments tablosuna initialize event'i yaz
      await db.execute(sql`
        INSERT INTO payments (
          user_id, event_type, status, amount, currency,
          provider, provider_conversation_id, iyzico_token, raw_payload
        ) VALUES (
          ${req.userId}, 'checkout_initialized',
          ${result?.status === "success" ? "pending" : "failed"},
          ${plan.amount}, 'TRY',
          'iyzico', ${conversationId}, ${result?.token ?? null},
          ${JSON.stringify(result)}::jsonb
        )
      `);

      if (result?.status !== "success") {
        console.error("[PAYMENT] checkout initialize başarısız:", result);
        return res.status(502).json({
          error: result?.errorMessage || "Ödeme formu oluşturulamadı",
          errorCode: result?.errorCode,
        });
      }

      // 6) Frontend'e hem HTML hem URL döndür
      return res.json({
        token: result.token,
        checkoutFormContent: result.checkoutFormContent,  // <script> ile sayfaya inject edilir
        paymentPageUrl: result.paymentPageUrl,            // veya bu URL'a redirect
        conversationId,
      });
    } catch (e: any) {
      console.error("[PAYMENT] initialize HATA:", e?.message ?? e);
      return res.status(500).json({
        error: "Ödeme başlatılamadı: " + (e?.message ?? "Bilinmeyen hata"),
      });
    }
  },
);

// ─── Iyzico callback (Iyzico bizi POST'lar) ──────────────────────────────
// Bu endpoint Iyzico tarafından çağrılır — auth YOK, sadece token doğrulama.
// Iyzico body olarak { token, status } gönderir. Biz token ile retrieveCheckoutForm
// çağrısı yapıp gerçek ödeme detayını alırız.
router.post("/checkout/callback", async (req: Request, res: Response) => {
  const { token } = (req.body ?? {}) as { token?: string };
  if (!token) {
    return res.redirect(`${appBaseUrl()}/student/subscription?status=error&reason=missing-token`);
  }

  try {
    const iyzipay = getIyzicoClient();
    const result: any = await iyzicoCall(
      iyzipay.checkoutForm.retrieve.bind(iyzipay.checkoutForm),
      { locale: "tr", token },
    );

    const conversationId: string | undefined = result?.conversationId;
    const paymentStatus: string | undefined = result?.paymentStatus;  // "SUCCESS" | "FAILURE"
    const status: string = result?.status; // "success" | "failure"

    // Subscription'ı conversationId ile bul
    const subRows = await db.execute(sql`
      SELECT id, user_id, plan_key, billing_type, duration_months, amount
      FROM subscriptions
      WHERE provider_conversation_id = ${conversationId ?? ""}
      LIMIT 1
    `);
    const sub = (subRows.rows ?? subRows)[0] as any;

    const isSuccess = status === "success" && paymentStatus === "SUCCESS";

    // Audit kaydı
    await db.execute(sql`
      INSERT INTO payments (
        user_id, subscription_id, event_type, status,
        amount, currency, provider, provider_payment_id, provider_conversation_id,
        iyzico_token, error_code, error_message, raw_payload
      ) VALUES (
        ${sub?.user_id ?? null}, ${sub?.id ?? null},
        ${isSuccess ? "checkout_success" : "checkout_failed"},
        ${isSuccess ? "success" : "failed"},
        ${result?.paidPrice ?? sub?.amount ?? null}, ${result?.currency ?? "TRY"},
        'iyzico', ${result?.paymentId ?? null}, ${conversationId ?? null},
        ${token}, ${result?.errorCode ?? null}, ${result?.errorMessage ?? null},
        ${JSON.stringify(result)}::jsonb
      )
    `);

    if (isSuccess && sub) {
      // Süreyi hesapla: recurring → 1 ay, one-time → durationMonths
      const months = sub.billing_type === "recurring" ? 1 : (sub.duration_months ?? 1);
      await db.execute(sql`
        UPDATE subscriptions
        SET status = 'active',
            started_at = NOW(),
            expires_at = NOW() + (${months}::int * INTERVAL '1 month'),
            current_period_start = NOW(),
            current_period_end = NOW() + (${months}::int * INTERVAL '1 month'),
            updated_at = NOW()
        WHERE id = ${sub.id}
      `);
      return res.redirect(`${appBaseUrl()}/student/subscription?status=success&conv=${conversationId}`);
    } else {
      if (sub) {
        await db.execute(sql`
          UPDATE subscriptions
          SET status = 'failed', updated_at = NOW()
          WHERE id = ${sub.id}
        `);
      }
      const reason = result?.errorMessage ?? result?.errorCode ?? "unknown";
      return res.redirect(
        `${appBaseUrl()}/student/subscription?status=failed&reason=${encodeURIComponent(reason)}`,
      );
    }
  } catch (e: any) {
    console.error("[PAYMENT] callback HATA:", e?.message ?? e);
    return res.redirect(`${appBaseUrl()}/student/subscription?status=error`);
  }
});

// ─── Iyzico webhook (subscription olayları) ──────────────────────────────
// Iyzico Subscription API kullanıldığında recurring tahsilat eventleri buraya
// düşer. MVP'de Subscription API kullanmıyoruz; yine de placeholder endpoint
// hazır olsun ki Iyzico paneline kaydedilebilsin.
router.post("/webhook", async (req: Request, res: Response) => {
  try {
    // Iyzico header'da imza gönderir; production'da doğrulanmalı.
    const signature = req.headers["x-iyz-signature"] || req.headers["x-iyzico-signature"];

    await db.execute(sql`
      INSERT INTO payments (
        event_type, status, provider, raw_payload, error_message
      ) VALUES (
        'webhook_received', 'pending', 'iyzico',
        ${JSON.stringify(req.body)}::jsonb,
        ${signature ? `signature=${String(signature).substring(0, 64)}` : null}
      )
    `);

    // Iyzico 200 bekler — diğer türlüsünde retry'a alır
    return res.status(200).json({ ok: true });
  } catch (e: any) {
    console.error("[PAYMENT] webhook HATA:", e?.message);
    // 200 dön ki sonsuz retry olmasın, log atmak yeterli
    return res.status(200).json({ ok: false });
  }
});

// ─── Aboneliği iptal et (auth) ───────────────────────────────────────────
// Tek seferlik paket → expires_at'a kadar erişim açık, cancel_at_period_end=true
// Recurring → bir sonraki periyot başlamadan iptal
router.post(
  "/subscription/cancel",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    if (!req.userId) return res.status(401).json({ error: "Yetki yok" });
    try {
      await db.execute(sql`
        UPDATE subscriptions
        SET cancel_at_period_end = true,
            canceled_at = NOW(),
            updated_at = NOW()
        WHERE user_id = ${req.userId}
          AND status IN ('active', 'pending')
      `);
      // Subscription API kullanıldığında Iyzico'ya cancel çağrısı atılacak (sonraki faz)
      return res.json({ ok: true });
    } catch (e: any) {
      console.error("[PAYMENT] cancel HATA:", e?.message);
      return res.status(500).json({ error: "İptal başarısız" });
    }
  },
);

export default router;
