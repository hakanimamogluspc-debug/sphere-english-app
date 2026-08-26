/**
 * Kurumsal Grup Programı — sipariş + Iyzico ödeme + kayıt formu akışı.
 *
 * Public endpoints:
 *   POST /api/course-orders/checkout
 *     body: { programmeSlug, buyerName, buyerEmail, buyerPhone }
 *     → Iyzico session başlatır, checkoutFormContent + orderToken döner
 *
 *   POST /api/course-orders/callback
 *     body: { orderToken, iyzicoToken } (Iyzico callback sayfasından)
 *     → Iyzico'dan sonuç çeker, order status'ünü paid/failed yapar
 *
 *   GET /api/course-orders/:token
 *     → Order bilgilerini döner (paid ise formu doldurmak için)
 *
 *   POST /api/course-orders/:token/register
 *     body: { tcKimlik, age, sector, gender }
 *     → Kayıt formunu tamamlar, "24 saat içinde iletişime geçilecek" sinyali
 *
 * Admin endpoints:
 *   GET   /admin/course-orders          → tüm siparişler (filter)
 *   PATCH /admin/course-orders/:id      → contacted_at, admin_notes, group ata
 */

import { Router, type Request, type Response } from "express";
import { sql } from "drizzle-orm";
import { db, pool } from "@workspace/db";
import crypto from "node:crypto";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth";
import { getIyzicoClient, iyzicoCall, newConversationId, appBaseUrl } from "../lib/iyzico";
import { findProgramme, COURSE_PROGRAMMES } from "../lib/courses-catalog";
import { sendEmail } from "../lib/email";

const router = Router();

function genOrderToken(): string {
  return `co_${Date.now().toString(36)}_${crypto.randomBytes(6).toString("hex")}`;
}

function splitName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: parts[0] };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1] };
}

// ─── PUBLIC: Programme catalog ─────────────────────────────────
router.get("/course-programmes", (_req: Request, res: Response) => {
  res.json({ programmes: COURSE_PROGRAMMES });
});

// ─── PUBLIC: Checkout başlat ───────────────────────────────────
router.post("/course-orders/checkout", async (req: Request, res: Response) => {
  try {
    const { programmeSlug, buyerName, buyerEmail, buyerPhone } = req.body ?? {};

    const programme = findProgramme(String(programmeSlug ?? ""));
    if (!programme) return res.status(400).json({ error: "Geçersiz program" });

    if (!buyerName || !buyerEmail || !buyerPhone) {
      return res.status(400).json({ error: "Ad, e-posta ve telefon zorunlu" });
    }

    const iyzipay = getIyzicoClient();
    const conversationId = newConversationId("course");
    const orderToken = genOrderToken();
    const amountTry = programme.priceKurus / 100;
    const { firstName, lastName } = splitName(String(buyerName));

    // WWW callback — kullanıcı ödeme sonrası döner
    const wwwBase = (process.env.WWW_BASE_URL ?? "https://www.sphereenglish.com").replace(/\/$/, "");
    const callbackUrl = `${wwwBase}/api/payment/course/callback?orderToken=${orderToken}`;

    const request = {
      locale: "tr",
      conversationId,
      price: amountTry.toFixed(2),
      paidPrice: amountTry.toFixed(2),
      currency: "TRY",
      basketId: `CO-${orderToken}`,
      paymentGroup: "PRODUCT",
      callbackUrl,
      // Taksit — Iyzico merchant panel'indeki BÜTÜN banka anlaşmalarına izin ver.
      // Dar liste yerine (1..12 kapsar) → Iyzico kullanıcının bankasına göre kesip
      // uygulanabilir taksitleri gösterir. Bkz. iyzico docs: enabledInstallments.
      enabledInstallments: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      buyer: {
        id: orderToken,
        name: firstName,
        surname: lastName,
        gsmNumber: String(buyerPhone),
        email: String(buyerEmail).toLowerCase(),
        identityNumber: "11111111111", // TC kayıt formunda alınacak, iyzico için dummy
        registrationAddress: "Türkiye",
        ip: req.ip ?? "127.0.0.1",
        city: "İstanbul",
        country: "Turkey",
      },
      shippingAddress: {
        contactName: buyerName,
        city: "İstanbul",
        country: "Turkey",
        address: "Dijital hizmet — fiziksel teslimat yok",
      },
      billingAddress: {
        contactName: buyerName,
        city: "İstanbul",
        country: "Turkey",
        address: "Dijital hizmet",
      },
      basketItems: [
        {
          id: programme.slug,
          name: programme.title,
          category1: "Eğitim",
          itemType: "VIRTUAL",
          price: amountTry.toFixed(2),
        },
      ],
    };

    const result: any = await iyzicoCall(
      iyzipay.checkoutFormInitialize.create.bind(iyzipay.checkoutFormInitialize),
      request,
    );

    if (result?.status !== "success") {
      console.error("[course-orders/checkout] Iyzico HATA:", result);
      return res.status(502).json({
        error: result?.errorMessage || "Ödeme formu oluşturulamadı",
        errorCode: result?.errorCode,
      });
    }

    // DB'ye pending order yaz
    await pool.query(
      `INSERT INTO course_orders
         (order_token, programme_slug, programme_title,
          buyer_name, buyer_email, buyer_phone,
          iyzico_conversation_id, iyzico_token, amount_kurus, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')`,
      [orderToken, programme.slug, programme.title,
       buyerName, String(buyerEmail).toLowerCase(), buyerPhone,
       conversationId, result.token, programme.priceKurus],
    );

    return res.json({
      orderToken,
      token: result.token,
      checkoutFormContent: result.checkoutFormContent,
      paymentPageUrl: result.paymentPageUrl,
      conversationId,
    });
  } catch (e: any) {
    console.error("[course-orders/checkout] HATA:", e?.message);
    return res.status(500).json({ error: e?.message ?? "Sipariş oluşturulamadı" });
  }
});

// ─── PUBLIC: Iyzico callback → sonuç doğrula, status güncelle ────
router.post("/course-orders/callback", async (req: Request, res: Response) => {
  try {
    const { orderToken, iyzicoToken } = req.body ?? {};
    if (!orderToken || !iyzicoToken) {
      return res.status(400).json({ error: "orderToken + iyzicoToken zorunlu" });
    }

    const orderRes: any = await pool.query(
      `SELECT * FROM course_orders WHERE order_token = $1 LIMIT 1`,
      [orderToken],
    );
    const order = orderRes.rows[0];
    if (!order) return res.status(404).json({ error: "Sipariş bulunamadı" });

    // Zaten paid ise idempotent
    if (order.status === "paid" || order.status === "registered") {
      return res.json({ ok: true, orderToken, status: order.status });
    }

    const iyzipay = getIyzicoClient();
    const result: any = await iyzicoCall(
      iyzipay.checkoutForm.retrieve.bind(iyzipay.checkoutForm),
      { locale: "tr", token: String(iyzicoToken) },
    );

    if (result?.paymentStatus === "SUCCESS" && result?.status === "success") {
      await pool.query(
        `UPDATE course_orders SET status = 'paid', paid_at = NOW(), updated_at = NOW() WHERE order_token = $1`,
        [orderToken],
      );

      // Admin bildirim maili
      try {
        const admins = (process.env.ADMIN_NOTIFICATION_EMAILS ?? "")
          .split(",").map(s => s.trim()).filter(s => s.includes("@"));
        if (admins.length > 0) {
          const html = `<div style="font-family:sans-serif">
            <h2>Yeni Kurs Siparişi ✓</h2>
            <p><b>Program:</b> ${order.programme_title}</p>
            <p><b>Müşteri:</b> ${order.buyer_name}</p>
            <p><b>E-posta:</b> ${order.buyer_email}</p>
            <p><b>Telefon:</b> ${order.buyer_phone}</p>
            <p><b>Tutar:</b> ${(order.amount_kurus / 100).toFixed(2)} TL</p>
            <p style="color:#0ea5e9">Müşteri kayıt formunu dolduruyor — 24 saat içinde iletişime geç.</p>
          </div>`;
          for (const to of admins) {
            await sendEmail(to, `[Kurs] Yeni sipariş — ${order.buyer_name}`, html).catch(() => {});
          }
        }
      } catch {}

      return res.json({ ok: true, orderToken, status: "paid" });
    }

    await pool.query(
      `UPDATE course_orders SET status = 'failed', updated_at = NOW() WHERE order_token = $1`,
      [orderToken],
    );
    return res.json({ ok: false, orderToken, status: "failed", error: result?.errorMessage });
  } catch (e: any) {
    console.error("[course-orders/callback] HATA:", e?.message);
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

    // Order paid olmalı
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
