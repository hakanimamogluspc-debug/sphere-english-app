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
import { sendWelcomeMail } from "../lib/subscription-mail.js";

const SETUP_TOKEN_TTL_HOURS = 24;
const SETUP_TOKEN_TTL_MS = SETUP_TOKEN_TTL_HOURS * 60 * 60 * 1000;
const LMS_BASE_URL = process.env["LMS_BASE_URL"] ?? "https://app.sphereenglish.com";

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

    const isNewAccount = !user;

    if (!user) {
      // Yeni kullanıcı — random parola, role=student, account_type=bireysel
      const randomPassword = crypto.randomBytes(16).toString("base64");
      const hashed = await bcrypt.hash(randomPassword, 10);
      // Schema: first_name + last_name ayrı kolonlar; name'i parçala
      const nameParts = (name || "Sphere Kullanıcı").trim().split(/\s+/);
      const firstName = nameParts[0] || "Sphere";
      const lastName = nameParts.slice(1).join(" ") || "Kullanıcı";
      const insertRows = await db.execute(sql`
        INSERT INTO users (email, password, first_name, last_name, role, account_type)
        VALUES (${email.toLowerCase()}, ${hashed}, ${firstName}, ${lastName}, 'student', 'bireysel')
        RETURNING id, email, first_name, last_name
      `);
      user = (insertRows.rows ?? insertRows)[0] as any;
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

    // ── Magic link + hoşgeldin mail (fire-and-forget) ──
    // Yeni kullanıcıya şifre belirleme linki, mevcut kullanıcıya sadece giriş bilgisi
    let setupPasswordUrl = `${LMS_BASE_URL.replace(/\/$/, "")}/login`;
    let mailSent = false;
    try {
      if (isNewAccount) {
        // 32-byte rastgele token (base64url)
        const setupToken = crypto.randomBytes(32).toString("base64url");
        const expiresAt = new Date(Date.now() + SETUP_TOKEN_TTL_MS).toISOString();
        await db.execute(sql`
          INSERT INTO account_setup_tokens (user_id, token, purpose, expires_at)
          VALUES (${user.id}, ${setupToken}, 'welcome', ${expiresAt})
        `);
        setupPasswordUrl = `${LMS_BASE_URL.replace(/\/$/, "")}/sifre-belirle?token=${encodeURIComponent(setupToken)}`;
      }

      // Plan bitiş tarihi (currentPeriodEnd) — DB'den çek
      const subRows = await db.execute(sql`
        SELECT current_period_end FROM subscriptions WHERE user_id = ${user.id} LIMIT 1
      `);
      const subRow = (subRows.rows ?? subRows)[0] as any;
      const planExpiry = subRow?.current_period_end ? new Date(subRow.current_period_end) : null;

      const buyerName = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() || (name || null);
      const mailResult = await sendWelcomeMail({
        buyerEmail: user.email,
        buyerName,
        planLabel: plan.label,
        planExpiry,
        amount: Number(amount ?? plan.amount),
        currency: currency ?? "TRY",
        setupPasswordUrl,
        setupTtlHours: SETUP_TOKEN_TTL_HOURS,
        isNewAccount,
      });
      mailSent = mailResult.ok;
      if (!mailResult.ok) {
        console.error(`[INTERNAL] hoşgeldin mail başarısız: ${mailResult.error}`);
      } else {
        console.info(`[INTERNAL] Hoşgeldin mail gönderildi: ${user.email} (new=${isNewAccount})`);
      }
    } catch (mailErr: any) {
      console.error("[INTERNAL] mail/magic-link HATA:", mailErr?.message);
    }

    return res.json({ ok: true, userId: user.id, magicLinkSent: mailSent, isNewAccount });
  } catch (e: any) {
    console.error("[INTERNAL] activate HATA:", e?.message ?? e);
    return res.status(500).json({ error: "Sunucu hatası: " + (e?.message ?? "bilinmeyen") });
  }
});

export default router;
