/**
 * Internal payment activation endpoint.
 *
 * www.sphereenglish.com'da Iyzico ile başarılı ödeme alınınca, pazarlama
 * sitesinin Next.js API route'u bu endpoint'i çağırır:
 *
 *   POST /api/internal/payment/activate
 *   Headers:
 *     X-Internal-Signature: HMAC-SHA256(INTERNAL_API_SHARED_SECRET, JSON.stringify(body))
 *   Body:
 *     { email, name, planCode, amount, currency, iyzicoPaymentId,
 *       iyzicoConversationId, paidAt }
 *
 * İşlem:
 *   1) İmza doğrula (HMAC) — yetkisiz aktivasyon engellenir
 *   2) Email ile kullanıcı bul; yoksa yeni kullanıcı oluştur (random parola,
 *      role=student, account_type=bireysel)
 *   3) subscriptions tablosuna upsert et (status=active, expires_at=now+months)
 *   4) payments tablosuna webhook event yaz
 *   5) (TODO) Magic-link mail gönder — yeni kullanıcının şifre belirlemesi için
 *
 * Bu endpoint AUTHMİDDLEWARE GİRMEZ — kendi imza doğrulamasını kullanır.
 */

import { Router, Request, Response } from "express";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { getPlan } from "../lib/plans.js";

const router = Router();

function verifySignature(rawBody: string, signature: string | undefined): boolean {
  if (!signature) return false;
  const secret = process.env["INTERNAL_API_SHARED_SECRET"];
  if (!secret) {
    console.error("[INTERNAL] INTERNAL_API_SHARED_SECRET tanımlı değil");
    return false;
  }
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

router.post("/internal/payment/activate", async (req: Request, res: Response) => {
  // İmza için raw body lazım. Express JSON parser'ı zaten geçti — bu yüzden
  // body'yi tekrar stringify edelim. Pazarlama sitesi tarafında da aynı
  // JSON.stringify(body) ile imza üretiyoruz, sonuç aynı string olur.
  const rawBody = JSON.stringify(req.body);
  const signature = req.headers["x-internal-signature"];

  if (!verifySignature(rawBody, typeof signature === "string" ? signature : undefined)) {
    console.warn("[INTERNAL] geçersiz imza", { ip: req.ip });
    return res.status(401).json({ error: "Geçersiz imza" });
  }

  const {
    email,
    name,
    planCode,
    amount,
    currency,
    iyzicoPaymentId,
    iyzicoConversationId,
    paidAt,
  } = (req.body ?? {}) as {
    email?: string;
    name?: string;
    planCode?: string;
    amount?: number;
    currency?: string;
    iyzicoPaymentId?: string;
    iyzicoConversationId?: string;
    paidAt?: string;
  };

  if (!email || !planCode) {
    return res.status(400).json({ error: "email ve planCode zorunlu" });
  }
  const plan = getPlan(planCode);
  if (!plan) return res.status(400).json({ error: "Bilinmeyen planCode" });

  try {
    // 1) Kullanıcıyı bul ya da oluştur
    const userRows = await db.execute(sql`
      SELECT id, email, name FROM users WHERE LOWER(email) = LOWER(${email}) LIMIT 1
    `);
    let user = (userRows.rows ?? userRows)[0] as any;
    let magicLinkSent = false;

    if (!user) {
      // Yeni kullanıcı — random parola, role=student, account_type=bireysel
      const randomPassword = crypto.randomBytes(16).toString("base64");
      const hashed = await bcrypt.hash(randomPassword, 10);
      const insertRows = await db.execute(sql`
        INSERT INTO users (email, password, name, role, account_type)
        VALUES (${email.toLowerCase()}, ${hashed}, ${name || "Sphere Kullanıcı"}, 'student', 'bireysel')
        RETURNING id, email, name
      `);
      user = (insertRows.rows ?? insertRows)[0] as any;
      magicLinkSent = false; // TODO: nodemailer ile magic-link mail gönder
      console.info(`[INTERNAL] Yeni kullanıcı oluşturuldu: ${user.email} (id=${user.id})`);
    }

    // 2) Subscription'ı aktif yap (upsert)
    const months = plan.billingType === "recurring" ? 1 : (plan.durationMonths ?? 1);
    await db.execute(sql`
      INSERT INTO subscriptions (
        user_id, plan_key, plan_label, amount, currency,
        billing_type, duration_months,
        status, started_at, expires_at, current_period_start, current_period_end,
        provider, provider_subscription_id, provider_conversation_id, updated_at
      ) VALUES (
        ${user.id}, ${plan.code}, ${plan.label}, ${plan.amount}, ${currency ?? "TRY"},
        ${plan.billingType}, ${plan.durationMonths ?? null},
        'active', NOW(), NOW() + (${months}::int * INTERVAL '1 month'),
        NOW(), NOW() + (${months}::int * INTERVAL '1 month'),
        'iyzico', ${iyzicoPaymentId ?? null}, ${iyzicoConversationId ?? null}, NOW()
      )
      ON CONFLICT (user_id) DO UPDATE SET
        plan_key = EXCLUDED.plan_key,
        plan_label = EXCLUDED.plan_label,
        amount = EXCLUDED.amount,
        billing_type = EXCLUDED.billing_type,
        duration_months = EXCLUDED.duration_months,
        status = 'active',
        started_at = NOW(),
        expires_at = EXCLUDED.expires_at,
        current_period_start = NOW(),
        current_period_end = EXCLUDED.current_period_end,
        provider = 'iyzico',
        provider_subscription_id = EXCLUDED.provider_subscription_id,
        provider_conversation_id = EXCLUDED.provider_conversation_id,
        cancel_at_period_end = false,
        canceled_at = NULL,
        updated_at = NOW()
    `);

    // 3) payments tablosuna audit kaydı
    await db.execute(sql`
      INSERT INTO payments (
        user_id, event_type, status, amount, currency,
        provider, provider_payment_id, provider_conversation_id,
        raw_payload
      ) VALUES (
        ${user.id}, 'checkout_success', 'success',
        ${amount ?? plan.amount}, ${currency ?? "TRY"},
        'iyzico', ${iyzicoPaymentId ?? null}, ${iyzicoConversationId ?? null},
        ${JSON.stringify({ email, name, planCode, paidAt, source: "www.sphereenglish.com" })}::jsonb
      )
    `);

    console.info(`[INTERNAL] Abonelik aktive: user=${user.id} plan=${planCode}`);
    return res.json({ ok: true, userId: user.id, magicLinkSent });
  } catch (e: any) {
    console.error("[INTERNAL] activate HATA:", e?.message ?? e);
    return res.status(500).json({ error: "Sunucu hatası: " + (e?.message ?? "bilinmeyen") });
  }
});

export default router;
