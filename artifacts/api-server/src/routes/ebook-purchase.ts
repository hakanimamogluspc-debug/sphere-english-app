/**
 * E-kitap satın alma + indirme.
 *
 * Endpoint'ler:
 *   POST /api/internal/ebook-purchase/pre-create  → Initialize aşamasında pending purchase yaz (billing info ile)
 *   POST /api/internal/ebook-purchase/activate    → Callback başarılıysa pending'i success'e çevir, downloadToken üret
 *   POST /api/internal/ebook-purchase/mark-failed → Callback başarısızsa pending'i failed olarak işaretle
 *   GET  /api/ebooks/download?token=X             → Token ile tam PDF'i stream et (max 10 indirme, 7 gün geçerli)
 *
 * Internal endpoint'ler HMAC X-Internal-Signature ile authenticate.
 */

import { attributeEbookSale } from "../lib/affiliate.js";
import { recordRedemption } from "../lib/coupon.js";
import { Router, Request, Response } from "express";
import crypto from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { sendEbookDownloadMail } from "../lib/ebook-mail.js";

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

// ─── INTERNAL: Pre-create (initialize aşaması) ──────────────────────────
// sphere-www payment/ebook/initialize bunu çağırır → DB'ye pending purchase yazar
// callback'te conversationId ile bulunup activate edilir
router.post("/internal/ebook-purchase/pre-create", async (req: Request, res: Response) => {
  const rawBody = JSON.stringify(req.body);
  const signature = req.headers["x-internal-signature"];

  if (!verifySignature(rawBody, typeof signature === "string" ? signature : undefined)) {
    return res.status(401).json({ error: "Geçersiz imza" });
  }

  const {
    ebookId,
    buyerEmail,
    buyerName,
    buyerPhone,
    amountPaid,
    currency,
    iyzicoConversationId,
    invoiceType,
    taxId,
    taxOffice,
    companyName,
    billingAddress,
    billingCity,
    billingDistrict,
    billingPostalCode,
    affiliateCode,
    couponCode,
    couponDiscountKurus,
  } = (req.body ?? {}) as any;

  if (!ebookId || !buyerEmail || !iyzicoConversationId) {
    return res.status(400).json({
      error: "Eksik alan: ebookId, buyerEmail, iyzicoConversationId",
    });
  }

  try {
    // Kitabın varlığını doğrula
    const eb = await db.execute(sql`SELECT id FROM ebooks WHERE id = ${ebookId} LIMIT 1`);
    if (!(eb.rows ?? eb)[0]) return res.status(404).json({ error: "Kitap bulunamadı" });

    // Aynı conversationId'li satır varsa idempotent — update et
    const existing = await db.execute(sql`
      SELECT id FROM ebook_purchases
      WHERE iyzico_conversation_id = ${iyzicoConversationId}
      LIMIT 1
    `);
    const existingRow = (existing.rows ?? existing)[0] as any;

    // Email ile mevcut kullanıcı varsa user_id'yi yakala
    const userRows = await db.execute(sql`
      SELECT id FROM users WHERE LOWER(email) = LOWER(${buyerEmail}) LIMIT 1
    `);
    const userId = (userRows.rows ?? userRows)[0]?.id ?? null;

    if (existingRow) {
      await db.execute(sql`
        UPDATE ebook_purchases SET
          buyer_name = ${buyerName ?? null},
          buyer_phone = ${buyerPhone ?? null},
          invoice_type = ${invoiceType ?? "individual"},
          tax_id = ${taxId ?? null},
          tax_office = ${taxOffice ?? null},
          company_name = ${companyName ?? null},
          billing_address = ${billingAddress ?? null},
          billing_city = ${billingCity ?? null},
          billing_district = ${billingDistrict ?? null},
          billing_postal_code = ${billingPostalCode ?? null},
          coupon_discount_kurus = ${couponDiscountKurus ?? null},
          updated_at = NOW()
        WHERE id = ${existingRow.id}
      `);
      return res.json({ ok: true, purchaseId: existingRow.id, updated: true });
    }

    // Yeni pending kayıt
    const inserted = await db.execute(sql`
      INSERT INTO ebook_purchases (
        ebook_id, user_id, buyer_email, buyer_name, buyer_phone,
        invoice_type, tax_id, tax_office, company_name,
        billing_address, billing_city, billing_district, billing_postal_code,
        amount_paid, currency,
        iyzico_conversation_id,
        payment_status, invoice_status,
        download_count,
        coupon_discount_kurus
      ) VALUES (
        ${ebookId}, ${userId}, ${buyerEmail.toLowerCase()}, ${buyerName ?? null}, ${buyerPhone ?? null},
        ${invoiceType ?? "individual"}, ${taxId ?? null}, ${taxOffice ?? null}, ${companyName ?? null},
        ${billingAddress ?? null}, ${billingCity ?? null}, ${billingDistrict ?? null}, ${billingPostalCode ?? null},
        ${amountPaid ?? 0}, ${currency ?? "TRY"},
        ${iyzicoConversationId},
        'pending', 'pending',
        0,
        ${couponDiscountKurus ?? null}
      )
      RETURNING id
    `);
    const purchaseId = ((inserted.rows ?? inserted)[0] as any)?.id;
    // Coupon ID'yi e-postaya kayıt için ek update
    if (couponCode && purchaseId) {
      try {
        const cRows = await db.execute(sql`SELECT id FROM coupons WHERE code = ${couponCode} LIMIT 1`);
        const cId = ((cRows.rows ?? cRows)[0] as any)?.id;
        if (cId) {
          await db.execute(sql`UPDATE ebook_purchases SET coupon_id = ${cId} WHERE id = ${purchaseId}`);
        }
      } catch {}
    }
    console.info(`[EBOOK-PURCHASE] Pre-create: purchaseId=${purchaseId} buyer=${buyerEmail} conv=${iyzicoConversationId}`);
    return res.json({ ok: true, purchaseId });
  } catch (e: any) {
    console.error("[EBOOK-PURCHASE] pre-create HATA:", e?.message);
    return res.status(500).json({ error: "Pre-create başarısız: " + e?.message });
  }
});

// ─── INTERNAL: Activate (callback başarılı) ──────────────────────────────
// Iyzico callback başarılı paymentStatus döndürürse çağrılır
// Pending kaydı bulup success'e çevirir + download token üretir
router.post("/internal/ebook-purchase/activate", async (req: Request, res: Response) => {
  const rawBody = JSON.stringify(req.body);
  const signature = req.headers["x-internal-signature"];

  if (!verifySignature(rawBody, typeof signature === "string" ? signature : undefined)) {
    return res.status(401).json({ error: "Geçersiz imza" });
  }

  const {
    ebookId,
    buyerEmail,
    buyerName,
    amountPaid,
    currency,
    iyzicoPaymentId,
    iyzicoConversationId,
    downloadToken,
    paidAt,
  } = (req.body ?? {}) as any;

  if (!ebookId || !buyerEmail || !downloadToken) {
    return res.status(400).json({ error: "Eksik alan: ebookId, buyerEmail, downloadToken" });
  }

  try {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const paidAtIso = paidAt ?? new Date().toISOString();

    // Önce pending satırı conversationId ile bul ve güncelle
    if (iyzicoConversationId) {
      const upd = await db.execute(sql`
        UPDATE ebook_purchases SET
          payment_status = 'success',
          amount_paid = ${amountPaid ?? 0},
          iyzico_payment_id = ${iyzicoPaymentId ?? null},
          download_token = ${downloadToken},
          download_expires_at = ${expiresAt},
          paid_at = ${paidAtIso},
          updated_at = NOW()
        WHERE iyzico_conversation_id = ${iyzicoConversationId}
          AND payment_status IN ('pending', 'failed')
        RETURNING id
      `);
      const updatedRow = (upd.rows ?? upd)[0] as any;
      if (updatedRow) {
        console.info(`[EBOOK-PURCHASE] Activate: purchaseId=${updatedRow.id} buyer=${buyerEmail}`);
        // Coupon redemption record (varsa)
        try {
          const cRows = await db.execute(sql`
            SELECT coupon_id, coupon_discount_kurus, amount_paid FROM ebook_purchases WHERE id = ${updatedRow.id} LIMIT 1
          `);
          const purchaseRow = ((cRows.rows ?? cRows)[0] as any);
          if (purchaseRow?.coupon_id && purchaseRow.coupon_discount_kurus) {
            const finalKurus = Math.round(Number(purchaseRow.amount_paid ?? 0) * 100);
            const discountKurus = Number(purchaseRow.coupon_discount_kurus);
            await recordRedemption({
              couponId: purchaseRow.coupon_id,
              userId: null,
              sourceType: "ebook",
              sourceId: Number(updatedRow.id),
              buyerEmail,
              originalAmountKurus: finalKurus + discountKurus,
              discountKurus,
              finalAmountKurus: finalKurus,
              conversationId: iyzicoConversationId ?? null,
            });
            console.info(`[EBOOK-PURCHASE] Coupon redeemed: ${discountKurus} kurus indirim`);
          }
        } catch (cErr: any) {
          console.error("[EBOOK-PURCHASE] coupon redeem HATA:", cErr?.message);
        }
        // Affiliate attribution + commission
        if (affiliateCode) {
          try {
            const amountKurus = Math.round(Number(amountPaid ?? 0) * 100);
            await attributeEbookSale({
              purchaseId: Number(updatedRow.id),
              userId: null,
              amountKurus,
              affiliateCode,
            });
          } catch (affErr: any) {
            console.error("[EBOOK-PURCHASE] affiliate attr HATA:", affErr?.message);
          }
        }
        // Mail gönder (fire-and-forget — response'u bloklamasın)
        sendPurchaseEmailFireForget(updatedRow.id).catch((e) => {
          console.error("[EBOOK-PURCHASE] mail fire-forget HATA:", e?.message);
        });
        return res.json({ ok: true, purchaseId: updatedRow.id, action: "updated" });
      }
    }

    // Pre-create kaydı yoksa fallback: yeni kayıt oluştur (eski akış uyumu için)
    const userRows = await db.execute(sql`
      SELECT id FROM users WHERE LOWER(email) = LOWER(${buyerEmail}) LIMIT 1
    `);
    const userId = (userRows.rows ?? userRows)[0]?.id ?? null;

    const inserted = await db.execute(sql`
      INSERT INTO ebook_purchases (
        ebook_id, user_id, buyer_email, buyer_name,
        amount_paid, currency,
        iyzico_payment_id, iyzico_conversation_id,
        download_token, download_expires_at, paid_at,
        payment_status, invoice_status, download_count
      ) VALUES (
        ${ebookId}, ${userId}, ${buyerEmail.toLowerCase()}, ${buyerName ?? null},
        ${amountPaid ?? 0}, ${currency ?? "TRY"},
        ${iyzicoPaymentId ?? null}, ${iyzicoConversationId ?? null},
        ${downloadToken}, ${expiresAt}, ${paidAtIso},
        'success', 'pending', 0
      )
      RETURNING id
    `);
    const newId = ((inserted.rows ?? inserted)[0] as any)?.id;
    console.info(`[EBOOK-PURCHASE] Activate (fallback INSERT): purchaseId=${newId} buyer=${buyerEmail}`);
    if (affiliateCode && newId) {
      try {
        const amountKurus = Math.round(Number(amountPaid ?? 0) * 100);
        await attributeEbookSale({
          purchaseId: Number(newId),
          userId,
          amountKurus,
          affiliateCode,
        });
      } catch (affErr: any) {
        console.error("[EBOOK-PURCHASE] affiliate attr (fallback) HATA:", affErr?.message);
      }
    }
    if (newId) {
      sendPurchaseEmailFireForget(newId).catch((e) => {
        console.error("[EBOOK-PURCHASE] mail fire-forget HATA:", e?.message);
      });
    }
    return res.json({ ok: true, purchaseId: newId, action: "inserted" });
  } catch (e: any) {
    console.error("[EBOOK-PURCHASE] activate HATA:", e?.message);
    return res.status(500).json({ error: "Kayıt başarısız: " + e?.message });
  }
});

// ─── INTERNAL: Mark failed (callback başarısız) ──────────────────────────
// Iyzico callback failure döndürürse pending kaydı failed olarak işaretlenir
router.post("/internal/ebook-purchase/mark-failed", async (req: Request, res: Response) => {
  const rawBody = JSON.stringify(req.body);
  const signature = req.headers["x-internal-signature"];

  if (!verifySignature(rawBody, typeof signature === "string" ? signature : undefined)) {
    return res.status(401).json({ error: "Geçersiz imza" });
  }

  const { iyzicoConversationId, iyzicoPaymentId, paymentError } = (req.body ?? {}) as any;
  if (!iyzicoConversationId) {
    return res.status(400).json({ error: "iyzicoConversationId gerekli" });
  }

  try {
    // iyzico_payment_id null gelirse COALESCE bug'ı tetiklenir — conditional SET
    if (iyzicoPaymentId) {
      await db.execute(sql`
        UPDATE ebook_purchases SET
          payment_status = 'failed',
          iyzico_payment_id = ${String(iyzicoPaymentId)},
          payment_error = ${paymentError ?? null},
          updated_at = NOW()
        WHERE iyzico_conversation_id = ${iyzicoConversationId}
          AND payment_status = 'pending'
      `);
    } else {
      await db.execute(sql`
        UPDATE ebook_purchases SET
          payment_status = 'failed',
          payment_error = ${paymentError ?? null},
          updated_at = NOW()
        WHERE iyzico_conversation_id = ${iyzicoConversationId}
          AND payment_status = 'pending'
      `);
    }
    return res.json({ ok: true });
  } catch (e: any) {
    console.error("[EBOOK-PURCHASE] mark-failed HATA:", e?.message);
    return res.status(500).json({ error: "Mark failed başarısız: " + e?.message });
  }
});

// ─── PUBLIC: Tam PDF indirme (token ile) ─────────────────────────────────
// CORS açık, çoğu tarayıcıdan link tıklanır
router.get("/ebooks/download", async (req: Request, res: Response) => {
  const token = String(req.query?.token ?? "").trim();
  if (!token) return res.status(400).send("Token eksik");

  try {
    // Token + süre + indirme sayısı kontrolü
    const rows = await db.execute(sql`
      SELECT id, ebook_id, download_count, download_expires_at, payment_status
      FROM ebook_purchases
      WHERE download_token = ${token}
      LIMIT 1
    `);
    const purchase = (rows.rows ?? rows)[0] as any;

    if (!purchase) return res.status(404).send("Geçersiz indirme bağlantısı");
    if (purchase.payment_status !== "success") {
      return res.status(403).send("Bu sipariş için ödeme tamamlanmamış");
    }
    if (!purchase.download_expires_at || new Date(purchase.download_expires_at) < new Date()) {
      return res.status(410).send("İndirme bağlantısının süresi dolmuş (7 gün)");
    }
    if (purchase.download_count >= 10) {
      return res.status(429).send("İndirme limiti doldu (max 10). Destek ile iletişime geçin.");
    }

    // Full PDF asset'i bul
    const assetRows = await db.execute(sql`
      SELECT filename, mime_type, size_bytes, data_base64
      FROM ebook_assets
      WHERE ebook_id = ${purchase.ebook_id} AND asset_type = 'full'
      LIMIT 1
    `);
    const asset = (assetRows.rows ?? assetRows)[0] as any;
    if (!asset) {
      console.error(`[EBOOK-DOWNLOAD] Full PDF asset yok: ebookId=${purchase.ebook_id}`);
      return res.status(500).send("PDF dosyası bulunamadı. Lütfen destek ile iletişime geçin.");
    }

    // Counter ++
    await db.execute(sql`
      UPDATE ebook_purchases SET download_count = download_count + 1, updated_at = NOW()
      WHERE id = ${purchase.id}
    `);

    res.setHeader("Content-Type", asset.mime_type || "application/pdf");
    res.setHeader("Content-Length", String(asset.size_bytes));
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${asset.filename.replace(/[^a-zA-Z0-9._-]/g, "_")}"`,
    );
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("Access-Control-Allow-Origin", "*");

    const buf = Buffer.from(asset.data_base64, "base64");
    return res.send(buf);
  } catch (e: any) {
    console.error("[EBOOK-DOWNLOAD] HATA:", e?.message);
    return res.status(500).send("İndirme hatası");
  }
});

/**
 * Verilen purchaseId için satın alma mailini gönder.
 * Mail durumu (sent/failed/error) ebook_purchases tablosuna kaydedilir.
 * Fire-and-forget kullanıldığında ödeme akışını bloklamaz.
 */
async function sendPurchaseEmailFireForget(purchaseId: number): Promise<void> {
  try {
    const rows = await db.execute(sql`
      SELECT p.id, p.buyer_email, p.buyer_name, p.invoice_type,
             p.amount_paid, p.currency,
             p.download_token, p.download_expires_at,
             p.payment_status,
             e.title AS ebook_title, e.author AS ebook_author
      FROM ebook_purchases p
      LEFT JOIN ebooks e ON e.id = p.ebook_id
      WHERE p.id = ${purchaseId}
      LIMIT 1
    `);
    const p = (rows.rows ?? rows)[0] as any;
    if (!p) {
      console.error(`[EBOOK-PURCHASE/mail] purchase bulunamadı: id=${purchaseId}`);
      return;
    }
    if (p.payment_status !== "success" || !p.download_token) {
      console.warn(`[EBOOK-PURCHASE/mail] mail atlandı (status=${p.payment_status}, token=${!!p.download_token})`);
      return;
    }

    // Attempt counter artır
    await db.execute(sql`
      UPDATE ebook_purchases SET mail_attempts = mail_attempts + 1, updated_at = NOW()
      WHERE id = ${purchaseId}
    `);

    const result = await sendEbookDownloadMail({
      buyerEmail: p.buyer_email,
      buyerName: p.buyer_name ?? null,
      ebookTitle: p.ebook_title ?? "Sphere English E-Kitap",
      ebookAuthor: p.ebook_author ?? "Sphere English",
      amountPaid: p.amount_paid,
      currency: p.currency ?? "TRY",
      downloadToken: p.download_token,
      downloadExpiresAt: new Date(p.download_expires_at),
      invoiceType: p.invoice_type === "corporate" ? "corporate" : "individual",
    });

    if (result.ok) {
      await db.execute(sql`
        UPDATE ebook_purchases SET
          mail_status = 'sent',
          mail_sent_at = NOW(),
          mail_error = NULL,
          updated_at = NOW()
        WHERE id = ${purchaseId}
      `);
      console.info(`[EBOOK-PURCHASE/mail] Gönderildi: id=${purchaseId} to=${p.buyer_email}`);
    } else {
      await db.execute(sql`
        UPDATE ebook_purchases SET
          mail_status = 'failed',
          mail_error = ${result.error ?? "bilinmeyen hata"},
          updated_at = NOW()
        WHERE id = ${purchaseId}
      `);
      console.error(`[EBOOK-PURCHASE/mail] Başarısız: id=${purchaseId} err=${result.error}`);
    }
  } catch (e: any) {
    console.error("[EBOOK-PURCHASE/mail] HATA:", e?.message);
    try {
      await db.execute(sql`
        UPDATE ebook_purchases SET
          mail_status = 'failed',
          mail_error = ${e?.message ?? "exception"},
          updated_at = NOW()
        WHERE id = ${purchaseId}
      `);
    } catch {
      // ignore
    }
  }
}

// Export — admin endpoint'inden de çağrılabilsin
export { sendPurchaseEmailFireForget };

export default router;
