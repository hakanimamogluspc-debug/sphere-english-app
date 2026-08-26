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
                tc_kimlik
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
          // Adres kayıt formunda alınmıyor — Luca GİB adres verisini TC üzerinden alır
          // Yine de fallback verelim, provider fail etmesin
          address: "Türkiye",
          city: "İstanbul",
          district: "Türkiye",
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
          buyer_name, buyer_email, buyer_phone,
          iyzico_conversation_id, iyzico_token, amount_kurus, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
       ON CONFLICT (order_token) DO NOTHING`,
      [
        orderToken, programme.slug, programme.title,
        buyerName, String(buyerEmail).toLowerCase(), buyerPhone,
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

    // Admin bildirim maili
    try {
      const admins = (process.env["ADMIN_NOTIFICATION_EMAILS"] ?? "")
        .split(",").map((s) => s.trim()).filter((s) => s.includes("@"));
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
