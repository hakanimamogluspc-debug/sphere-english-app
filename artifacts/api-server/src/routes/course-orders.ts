/**
 * Kurumsal Grup Programı — sipariş DB + kayıt formu + admin.
 *
 * MİMARİ NOTU:
 * Iyzico entegrasyonu www (sphereenglish-www) tarafında.
 * Bu route sadece DB owner ve public kayıt formu endpoint'lerini tutar.
 * Iyzico çağrıları www'da yapılır, sonuç bu route'un HMAC internal endpoint'lerine
 * forward edilir (ebook-purchase pattern'i ile aynı).
 *
 * Public endpoints:
 *   GET  /course-programmes           → kurs kataloğu
 *   GET  /course-orders/:token        → sipariş bilgisi (kayıt formu için)
 *   POST /course-orders/:token/register → kayıt formu submit (TC, yaş, sektör, cinsiyet)
 *
 * Internal HMAC endpoints (www'dan çağrılır):
 *   POST /internal/course-orders/pre-create   → checkout init'te pending yaz
 *   POST /internal/course-orders/activate     → callback success'te paid'e çevir + admin bildirim
 *   POST /internal/course-orders/mark-failed  → callback fail'de failed'e çevir
 *
 * Admin endpoints:
 *   GET   /admin/course-orders               → liste (filter)
 *   PATCH /admin/course-orders/:id           → contacted_at, admin_notes, group ata
 */

import { Router, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import crypto from "node:crypto";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth";
import { findProgramme, loadProgrammes, COURSE_PROGRAMMES, invalidateCoursesCache } from "../lib/courses-catalog";
import { sendEmail } from "../lib/email";
import { issueInvoiceForSource } from "../lib/invoice/index.js";

// ─── Email templates ─────────────────────────────────────────
const BRAND_NAVY = "#1B365D";
const BRAND_SKY = "#0ea5e9";

function formatTRY(kurus: number): string {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 }).format(kurus / 100);
}

function formatDT(iso: string | Date | null): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleString("tr-TR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Müşteri hoş geldin maili — kayıt formu tamamlanınca */
function buildCustomerWelcomeHtml(order: any): string {
  const priceDisplay = formatTRY(Number(order.amount_kurus));
  return `<!DOCTYPE html>
<html lang="tr"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:24px 16px;background:#f3f4f6;font-family:-apple-system,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;">
  <div style="background:${BRAND_NAVY};padding:32px 24px;text-align:center;">
    <div style="color:#7dd3fc;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:8px;">KAYDIN ONAYLANDI</div>
    <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:700;letter-spacing:-0.02em;">Sphere English Ailesine Hoş Geldin!</h1>
  </div>
  <div style="padding:32px 24px;color:${BRAND_NAVY};line-height:1.6;">
    <p style="font-size:16px;margin:0 0 20px;">Merhaba <strong>${escapeHtml(order.buyer_name)}</strong>,</p>
    <p style="font-size:15px;color:#4a5568;margin:0 0 24px;"><strong>${escapeHtml(order.programme_title)}</strong> programı için kaydın onaylandı. Sipariş bilgilerin aşağıda — bu maili saklamanı öneririz.</p>
    <div style="background:#f0f7ff;border:1px solid rgba(14,165,233,0.25);border-radius:12px;padding:18px;margin:20px 0;">
      <table style="width:100%;font-size:13px;border-collapse:collapse;">
        <tr><td style="color:#6b7280;padding:4px 0;">Program</td><td style="text-align:right;font-weight:500;color:${BRAND_NAVY};">${escapeHtml(order.programme_title)}</td></tr>
        <tr><td style="color:#6b7280;padding:4px 0;">Tutar</td><td style="text-align:right;font-weight:500;color:${BRAND_NAVY};">${priceDisplay}</td></tr>
        <tr><td style="color:#6b7280;padding:4px 0;">Sipariş No</td><td style="text-align:right;font-family:monospace;font-size:11px;color:#6b7280;">${escapeHtml(order.order_token)}</td></tr>
      </table>
    </div>
    <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;padding:18px;margin:20px 0;">
      <div style="font-size:11px;font-weight:700;color:#065f46;letter-spacing:0.14em;text-transform:uppercase;margin-bottom:6px;">SONRAKİ ADIM</div>
      <p style="color:#064e3b;font-size:14px;margin:0;">En geç <strong>24 saat içinde</strong> ekibimiz seninle iletişime geçecek. Grup ataması, ders takvimi ve Zoom giriş bilgileri e-postana iletilecek.</p>
    </div>
    <p style="font-size:13px;color:#6b7280;margin:20px 0 0;">E-Arşiv faturan Iyzico entegrasyonu üzerinden birkaç dakika içinde ayrı bir mail ile gönderilecek.</p>
    <p style="font-size:13px;color:#6b7280;margin:20px 0 0;">Sorularin için:<br>
      <a href="mailto:info@sphereenglish.com" style="color:${BRAND_SKY};text-decoration:none;">info@sphereenglish.com</a><br>
      <a href="https://wa.me/905066085810" style="color:${BRAND_SKY};text-decoration:none;">+90 506 608 58 10 (WhatsApp)</a>
    </p>
  </div>
  <div style="background:#f9fafb;padding:16px 24px;text-align:center;font-size:11px;color:#9ca3af;border-top:1px solid #f3f4f6;">
    © 2026 Sphere English · Türk profesyoneller için iş İngilizcesi
  </div>
</div>
</body></html>`;
}

/** Admin bildirim maili — ödeme aktive olunca */
function buildAdminNotifyHtml(order: any): string {
  const priceDisplay = formatTRY(Number(order.amount_kurus));
  const adminUrl = "https://app.sphereenglish.com/admin/kurs-satislari";
  return `<!DOCTYPE html>
<html lang="tr"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:24px 16px;background:#f3f4f6;font-family:-apple-system,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;">
  <div style="background:${BRAND_NAVY};padding:24px;display:flex;align-items:center;justify-content:space-between;">
    <div>
      <div style="color:#7dd3fc;font-size:10px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:4px;">SPHERE ADMIN · YENİ SATIŞ</div>
      <h1 style="color:#ffffff;margin:0;font-size:20px;font-weight:700;">Yeni Kurs Kaydı ✓</h1>
    </div>
    <div style="background:${BRAND_SKY};color:#ffffff;padding:8px 14px;border-radius:8px;font-weight:700;font-size:16px;">${priceDisplay}</div>
  </div>
  <div style="padding:24px;color:${BRAND_NAVY};line-height:1.6;">
    <div style="background:#ecfdf5;border-left:3px solid #10b981;padding:12px 16px;margin-bottom:20px;font-size:13px;color:#064e3b;">
      <strong>Aksiyon:</strong> Müşteri kayıt formunu doldurdu. <strong>24 saat içinde</strong> iletişime geç, grup atamasını yap.
    </div>
    <div style="border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
      <div style="background:#f9fafb;padding:12px 16px;font-size:11px;font-weight:700;color:#6b7280;letter-spacing:0.12em;text-transform:uppercase;">Program</div>
      <div style="padding:12px 16px;font-weight:500;">${escapeHtml(order.programme_title)}</div>
    </div>
    <div style="border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;margin-top:12px;">
      <div style="background:#f9fafb;padding:12px 16px;font-size:11px;font-weight:700;color:#6b7280;letter-spacing:0.12em;text-transform:uppercase;">Müşteri Bilgileri</div>
      <table style="width:100%;font-size:13px;border-collapse:collapse;">
        <tr><td style="color:#6b7280;padding:10px 16px;width:120px;">Ad Soyad</td><td style="padding:10px 16px;font-weight:500;">${escapeHtml(order.buyer_name)}</td></tr>
        <tr><td style="color:#6b7280;padding:10px 16px;border-top:1px solid #f3f4f6;">E-posta</td><td style="padding:10px 16px;border-top:1px solid #f3f4f6;color:${BRAND_SKY};">${escapeHtml(order.buyer_email)}</td></tr>
        <tr><td style="color:#6b7280;padding:10px 16px;border-top:1px solid #f3f4f6;">Telefon</td><td style="padding:10px 16px;border-top:1px solid #f3f4f6;font-family:monospace;">${escapeHtml(order.buyer_phone)}</td></tr>
        ${order.tc_kimlik ? `<tr><td style="color:#6b7280;padding:10px 16px;border-top:1px solid #f3f4f6;">TC Kimlik</td><td style="padding:10px 16px;border-top:1px solid #f3f4f6;font-family:monospace;">${escapeHtml(order.tc_kimlik)}</td></tr>` : ''}
        ${order.sector ? `<tr><td style="color:#6b7280;padding:10px 16px;border-top:1px solid #f3f4f6;">Sektör</td><td style="padding:10px 16px;border-top:1px solid #f3f4f6;">${escapeHtml(order.sector)}</td></tr>` : ''}
      </table>
    </div>
    <div style="border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;margin-top:12px;">
      <div style="background:#f9fafb;padding:12px 16px;font-size:11px;font-weight:700;color:#6b7280;letter-spacing:0.12em;text-transform:uppercase;">Ödeme</div>
      <table style="width:100%;font-size:13px;border-collapse:collapse;">
        <tr><td style="color:#6b7280;padding:10px 16px;width:140px;">Tutar</td><td style="padding:10px 16px;font-weight:700;">${priceDisplay}</td></tr>
        <tr><td style="color:#6b7280;padding:10px 16px;border-top:1px solid #f3f4f6;">Ödeme Tarihi</td><td style="padding:10px 16px;border-top:1px solid #f3f4f6;">${formatDT(order.paid_at ?? new Date())}</td></tr>
        ${order.iyzico_payment_id ? `<tr><td style="color:#6b7280;padding:10px 16px;border-top:1px solid #f3f4f6;">Iyzico ID</td><td style="padding:10px 16px;border-top:1px solid #f3f4f6;font-family:monospace;font-size:11px;">${escapeHtml(order.iyzico_payment_id)}</td></tr>` : ''}
      </table>
    </div>
    <div style="margin-top:24px;text-align:center;">
      <a href="${adminUrl}" style="display:inline-block;padding:12px 24px;background:${BRAND_SKY};color:#ffffff;border-radius:8px;font-weight:700;font-size:13px;text-decoration:none;">Admin Panelde Aç →</a>
    </div>
  </div>
  <div style="background:#f9fafb;padding:12px 24px;text-align:center;font-size:10px;color:#9ca3af;border-top:1px solid #f3f4f6;">
    Bu bildirim otomatik gönderildi · Sphere English Admin
  </div>
</div>
</body></html>`;
}

function escapeHtml(v: any): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Müşteri hoş geldin maili (fire-and-forget) */
function sendCustomerWelcomeEmail(orderId: number): void {
  void (async () => {
    try {
      const r: any = await pool.query(
        `SELECT order_token, programme_title, buyer_name, buyer_email, amount_kurus
           FROM course_orders WHERE id = $1 LIMIT 1`,
        [orderId],
      );
      const order = r.rows[0];
      if (!order || !order.buyer_email) return;
      const html = buildCustomerWelcomeHtml(order);
      await sendEmail(order.buyer_email, `Kayıt onayı — ${order.programme_title}`, html);
      console.info(`[COURSE-EMAIL/customer] gönderildi: orderId=${orderId} to=${order.buyer_email}`);
    } catch (e: any) {
      console.error(`[COURSE-EMAIL/customer] HATA: orderId=${orderId} → ${e?.message}`);
    }
  })();
}

/**
 * Kayıt formu tamamlanınca bireysel e-Arşiv fatura kesme (fire-and-forget).
 * Kurumsal fatura desteklenmiyor — Sphere kurumsal kurs için ayrı süreç.
 */
function issueCourseInvoice(orderId: number): void {
  void (async () => {
    try {
      const r: any = await pool.query(
        `SELECT id, order_token, programme_slug, programme_title,
                buyer_name, buyer_email, buyer_phone,
                amount_kurus, iyzico_payment_id,
                tc_kimlik,
                billing_address, billing_city, billing_district, billing_postal_code
           FROM course_orders WHERE id = $1 LIMIT 1`,
        [orderId],
      );
      const order = r.rows[0];
      if (!order) {
        console.error(`[COURSE-INVOICE] order bulunamadı: id=${orderId}`);
        return;
      }
      // KDV hesabı — fiyat KDV DAHİL (Türkiye e-ticaret pratiği), oran %20
      // 4.999 TL total → 4.165,83 KDV hariç + 833,17 KDV = 4.999
      const amountKurus = Number(order.amount_kurus);
      const vatRate = 20;
      const unitPriceKurus = Math.round(amountKurus / (1 + vatRate / 100));

      const res = await issueInvoiceForSource({
        source: {
          type: "course",
          id: Number(order.id),
          orderId: String(order.order_token),
        },
        buyer: {
          email: String(order.buyer_email),
          name: String(order.buyer_name ?? "Kursiyer"),
          type: "individual",
          taxId: order.tc_kimlik ?? undefined,
          // Ödeme modalında toplanan gerçek adres — fallback varsa provider fail etmesin
          address: order.billing_address ?? "Türkiye",
          city: order.billing_city ?? "İstanbul",
          district: order.billing_district ?? order.billing_city ?? "Türkiye",
          postalCode: order.billing_postal_code ?? undefined,
          country: "Türkiye",
          phone: order.buyer_phone ?? undefined,
        },
        lineItems: [
          {
            productCode: `course-${order.programme_slug}`,
            productName: String(order.programme_title ?? "Sphere English Kursu"),
            quantity: 1,
            unitPriceKurus,
            vatRate,
            note: "4 haftalık canlı grup programı — Business English",
          },
        ],
        notes: [
          "Sphere English Kurs Kaydı",
          order.iyzico_payment_id ? `Iyzico Payment ID: ${order.iyzico_payment_id}` : "",
        ].filter(Boolean),
        paymentReference: order.iyzico_payment_id ?? undefined,
        sendMailAutomatically: true,
      });

      if (res.ok) {
        console.info(
          `[COURSE-INVOICE] fatura kesildi: orderId=${orderId} ettn=${res.ettn} skipped=${res.skipped ?? false}`,
        );
      } else {
        console.error(`[COURSE-INVOICE] fatura BAŞARISIZ: orderId=${orderId} err=${res.error}`);
      }
    } catch (e: any) {
      console.error(`[COURSE-INVOICE] fatura kesme HATA: orderId=${orderId} → ${e?.message}`);
    }
  })();
}

const router = Router();

// ─── HMAC signature verification (ebook-purchase pattern'i) ────
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

// ─── PUBLIC: Programme catalog ─────────────────────────────────
router.get("/course-programmes", (_req: Request, res: Response) => {
  res.json({ programmes: COURSE_PROGRAMMES });
});

// ─── INTERNAL: Pre-create — checkout init aşamasında pending yaz ────
router.post("/internal/course-orders/pre-create", async (req: Request, res: Response) => {
  const rawBody = JSON.stringify(req.body);
  const signature = req.headers["x-internal-signature"];
  if (!verifySignature(rawBody, typeof signature === "string" ? signature : undefined)) {
    return res.status(401).json({ error: "Geçersiz imza" });
  }

  const {
    orderToken,
    programmeSlug,
    buyerName,
    buyerEmail,
    buyerPhone,
    tcKimlik,
    billingAddress,
    billingCity,
    billingDistrict,
    billingPostalCode,
    iyzicoConversationId,
    iyzicoToken,
    amountKurus,
  } = (req.body ?? {}) as any;

  // Önce sync cache'ten dene; yoksa DB'den async yükle (yeni admin eklenen kurslar için)
  let programme = findProgramme(String(programmeSlug ?? ""));
  if (!programme) {
    const fresh = await loadProgrammes();
    programme = fresh.find((p) => p.slug === programmeSlug) ?? null;
  }
  if (!programme) return res.status(400).json({ error: "Geçersiz program" });
  if (!orderToken || !buyerName || !buyerEmail || !buyerPhone) {
    return res.status(400).json({ error: "orderToken, ad, e-posta, telefon zorunlu" });
  }

  try {
    await pool.query(
      `INSERT INTO course_orders
         (order_token, programme_slug, programme_title,
          buyer_name, buyer_email, buyer_phone, tc_kimlik,
          billing_address, billing_city, billing_district, billing_postal_code,
          iyzico_conversation_id, iyzico_token, amount_kurus, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'pending')
       ON CONFLICT (order_token) DO NOTHING`,
      [
        orderToken, programme.slug, programme.title,
        buyerName, String(buyerEmail).toLowerCase(), buyerPhone,
        tcKimlik ? String(tcKimlik).replace(/\D/g, '').slice(0, 11) : null,
        billingAddress ?? null,
        billingCity ?? null,
        billingDistrict ?? null,
        billingPostalCode ?? null,
        iyzicoConversationId ?? null,
        iyzicoToken ?? null,
        amountKurus ?? programme.priceKurus,
      ],
    );
    return res.json({ ok: true, orderToken });
  } catch (e: any) {
    console.error("[INTERNAL/course-orders/pre-create] HATA:", e?.message);
    return res.status(500).json({ error: e?.message });
  }
});

// ─── INTERNAL: Activate — callback success'te pending → paid ────
router.post("/internal/course-orders/activate", async (req: Request, res: Response) => {
  const rawBody = JSON.stringify(req.body);
  const signature = req.headers["x-internal-signature"];
  if (!verifySignature(rawBody, typeof signature === "string" ? signature : undefined)) {
    return res.status(401).json({ error: "Geçersiz imza" });
  }

  const { orderToken, iyzicoPaymentId } = (req.body ?? {}) as any;
  if (!orderToken) return res.status(400).json({ error: "orderToken zorunlu" });

  try {
    const orderRes: any = await pool.query(
      `SELECT * FROM course_orders WHERE order_token = $1 LIMIT 1`,
      [orderToken],
    );
    const order = orderRes.rows[0];
    if (!order) return res.status(404).json({ error: "Sipariş bulunamadı" });

    // Idempotent — zaten paid/registered ise dokunma
    if (order.status === "paid" || order.status === "registered") {
      return res.json({
        ok: true,
        orderToken,
        status: order.status,
        programmeSlug: order.programme_slug,
        programmeTitle: order.programme_title,
        amountKurus: order.amount_kurus,
        alreadyProcessed: true,
      });
    }

    await pool.query(
      `UPDATE course_orders SET
         status = 'paid',
         paid_at = NOW(),
         iyzico_payment_id = COALESCE($2, iyzico_payment_id),
         updated_at = NOW()
       WHERE order_token = $1`,
      [orderToken, iyzicoPaymentId ?? null],
    );

    // Admin bildirim maili — branded template
    try {
      const admins = (process.env["ADMIN_NOTIFICATION_EMAILS"] ?? "")
        .split(",").map((s) => s.trim()).filter((s) => s.includes("@"));
      if (admins.length > 0) {
        // Fresh order verisi (paid_at + iyzico_payment_id dahil)
        const freshRes: any = await pool.query(
          `SELECT * FROM course_orders WHERE id = $1 LIMIT 1`,
          [order.id],
        );
        const freshOrder = freshRes.rows[0] ?? order;
        const html = buildAdminNotifyHtml(freshOrder);
        for (const to of admins) {
          await sendEmail(to, `[Kurs] Yeni sipariş — ${order.buyer_name}`, html).catch(() => {});
        }
      }
    } catch (e: any) {
      console.warn("[COURSE-EMAIL/admin] hata:", e?.message);
    }

    return res.json({
      ok: true,
      orderToken,
      status: "paid",
      programmeSlug: order.programme_slug,
      programmeTitle: order.programme_title,
      amountKurus: order.amount_kurus,
    });
  } catch (e: any) {
    console.error("[INTERNAL/course-orders/activate] HATA:", e?.message);
    return res.status(500).json({ error: e?.message });
  }
});

// ─── INTERNAL: Mark failed — callback fail'de pending → failed ────
router.post("/internal/course-orders/mark-failed", async (req: Request, res: Response) => {
  const rawBody = JSON.stringify(req.body);
  const signature = req.headers["x-internal-signature"];
  if (!verifySignature(rawBody, typeof signature === "string" ? signature : undefined)) {
    return res.status(401).json({ error: "Geçersiz imza" });
  }

  const { orderToken, paymentError } = (req.body ?? {}) as any;
  if (!orderToken) return res.status(400).json({ error: "orderToken zorunlu" });

  try {
    await pool.query(
      `UPDATE course_orders SET
         status = 'failed',
         admin_notes = COALESCE(admin_notes, '') || $2,
         updated_at = NOW()
       WHERE order_token = $1 AND status = 'pending'`,
      [orderToken, `\n[fail ${new Date().toISOString()}]: ${paymentError ?? "unknown"}`],
    );
    return res.json({ ok: true });
  } catch (e: any) {
    console.error("[INTERNAL/course-orders/mark-failed] HATA:", e?.message);
    return res.status(500).json({ error: e?.message });
  }
});

// ─── PUBLIC: Order lookup (kayıt formu için) ────────────────────
router.get("/course-orders/:token", async (req: Request, res: Response) => {
  try {
    const token = String(req.params.token ?? "");
    const r: any = await pool.query(
      `SELECT order_token, programme_slug, programme_title,
              buyer_name, buyer_email, buyer_phone,
              status, registration_completed_at, paid_at,
              tc_kimlik, age, sector, gender
         FROM course_orders WHERE order_token = $1 LIMIT 1`,
      [token],
    );
    const order = r.rows[0];
    if (!order) return res.status(404).json({ error: "Sipariş bulunamadı" });
    return res.json({ order });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
});

// ─── PUBLIC: Kayıt formu submit ────────────────────────────────
router.post("/course-orders/:token/register", async (req: Request, res: Response) => {
  try {
    const token = String(req.params.token ?? "");
    const { tcKimlik, age, sector, gender } = req.body ?? {};

    if (!tcKimlik || !age || !sector || !gender) {
      return res.status(400).json({ error: "TC, yaş, sektör ve cinsiyet zorunlu" });
    }

    const r: any = await pool.query(
      `SELECT id, status FROM course_orders WHERE order_token = $1 LIMIT 1`,
      [token],
    );
    const order = r.rows[0];
    if (!order) return res.status(404).json({ error: "Sipariş bulunamadı" });
    if (order.status !== "paid" && order.status !== "registered") {
      return res.status(400).json({ error: "Ödeme henüz tamamlanmamış" });
    }

    await pool.query(
      `UPDATE course_orders
         SET tc_kimlik = $2, age = $3, sector = $4, gender = $5,
             status = 'registered',
             registration_completed_at = NOW(),
             updated_at = NOW()
       WHERE order_token = $1`,
      [token, String(tcKimlik).slice(0, 11), parseInt(String(age), 10) || null,
       String(sector).slice(0, 60), String(gender).slice(0, 20)],
    );

    // E-Arşiv fatura kes (fire-and-forget) — bireysel, TC ile
    issueCourseInvoice(Number(order.id));
    // Müşteriye Sphere-markalı hoş geldin maili (fire-and-forget)
    sendCustomerWelcomeEmail(Number(order.id));

    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
});

// ─── ADMIN: Sipariş listesi ────────────────────────────────────
router.get("/admin/course-orders", authMiddleware, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const status = String(req.query.status ?? "all");
    const programme = String(req.query.programme ?? "all");
    const wh: string[] = [];
    const params: any[] = [];
    if (status !== "all") { params.push(status); wh.push(`status = $${params.length}`); }
    if (programme !== "all") { params.push(programme); wh.push(`programme_slug = $${params.length}`); }
    const where = wh.length ? `WHERE ${wh.join(" AND ")}` : "";

    const r: any = await pool.query(
      `SELECT * FROM course_orders ${where}
         ORDER BY created_at DESC LIMIT 500`,
      params,
    );
    return res.json({ orders: r.rows });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
});

router.patch("/admin/course-orders/:id", authMiddleware, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const allowed = ["admin_notes", "assigned_group_id", "contacted_at"];
    const sets: string[] = []; const params: any[] = [];
    for (const k of allowed) {
      if (req.body[k] !== undefined) {
        params.push(req.body[k]);
        sets.push(`${k} = $${params.length}`);
      }
    }
    if (!sets.length) return res.status(400).json({ error: "güncellenecek alan yok" });
    params.push(id);
    await pool.query(
      `UPDATE course_orders SET ${sets.join(", ")}, updated_at = NOW() WHERE id = $${params.length}`,
      params,
    );
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
});

export default router;
