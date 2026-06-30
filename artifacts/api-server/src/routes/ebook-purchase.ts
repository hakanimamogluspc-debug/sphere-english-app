/**
 * E-kitap satÄ±n alma + indirme.
 *
 * Endpoint'ler:
 *   POST /api/internal/ebook-purchase/pre-create  â†’ Initialize aÅŸamasÄ±nda pending purchase yaz (billing info ile)
 *   POST /api/internal/ebook-purchase/activate    â†’ Callback baÅŸarÄ±lÄ±ysa pending'i success'e Ã§evir, downloadToken Ã¼ret
 *   POST /api/internal/ebook-purchase/mark-failed â†’ Callback baÅŸarÄ±sÄ±zsa pending'i failed olarak iÅŸaretle
 *   GET  /api/ebooks/download?token=X             â†’ Token ile tam PDF'i stream et (max 10 indirme, 7 gÃ¼n geÃ§erli)
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
import { notifyNewEbookPurchase } from "../lib/admin-notifications.js";

/** Admin'lere yeni e-kitap satÄ±ÅŸÄ± bildirimi (non-blocking) */
function notifyAdminOfEbookPurchase(purchaseId: number): void {
  void (async () => {
    try {
      const rows = await db.execute(sql`
        SELECT ep.buyer_email, ep.amount_paid, e.title
        FROM ebook_purchases ep
        JOIN ebooks e ON ep.ebook_id = e.id
        WHERE ep.id = ${purchaseId} LIMIT 1
      `);
      const r = (rows.rows ?? rows)[0] as any;
      if (!r) return;
      await notifyNewEbookPurchase({
        purchaseId,
        buyerEmail: r.buyer_email,
        ebookTitle: r.title ?? "E-kitap",
        amountTl: Number(r.amount_paid ?? 0),
      });
    } catch (e: any) {
      console.error("[EBOOK-PURCHASE] admin notify HATA:", e?.message);
    }
  })();
}

const router = Router();

function verifySignature(rawBody: string, signature: string | undefined): boolean {
  if (!signature) return false;
  const secret = process.env["INTERNAL_API_SHARED_SECRET"];
  if (!secret) {
    console.error("[INTERNAL] INTERNAL_API_SHARED_SECRET tanÄ±mlÄ± deÄŸil");
    return false;
  }
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

// â”€â”€â”€ INTERNAL: Pre-create (initialize aÅŸamasÄ±) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// sphere-www payment/ebook/initialize bunu Ã§aÄŸÄ±rÄ±r â†’ DB'ye pending purchase yazar
// callback'te conversationId ile bulunup activate edilir
router.post("/internal/ebook-purchase/pre-create", async (req: Request, res: Response) => {
  const rawBody = JSON.stringify(req.body);
  const signature = req.headers["x-internal-signature"];

  if (!verifySignature(rawBody, typeof signature === "string" ? signature : undefined)) {
    return res.status(401).json({ error: "GeÃ§ersiz imza" });
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
    // KitabÄ±n varlÄ±ÄŸÄ±nÄ± doÄŸrula
    const eb = await db.execute(sql`SELECT id FROM ebooks WHERE id = ${ebookId} LIMIT 1`);
    if (!(eb.rows ?? eb)[0]) return res.status(404).json({ error: "Kitap bulunamadÄ±" });

    // AynÄ± conversationId'li satÄ±r varsa idempotent â€” update et
    const existing = await db.execute(sql`
      SELECT id FROM ebook_purchases
      WHERE iyzico_conversation_id = ${iyzicoConversationId}
      LIMIT 1
    `);
    const existingRow = (existing.rows ?? existing)[0] as any;

    // Email ile mevcut kullanÄ±cÄ± varsa user_id'yi yakala
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

    // Yeni pending kayÄ±t
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
    // Coupon ID'yi e-postaya kayÄ±t iÃ§in ek update
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
    return res.status(500).json({ error: "Pre-create baÅŸarÄ±sÄ±z: " + e?.message });
  }
});

// â”€â”€â”€ INTERNAL: Activate (callback baÅŸarÄ±lÄ±) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Iyzico callback baÅŸarÄ±lÄ± paymentStatus dÃ¶ndÃ¼rÃ¼rse Ã§aÄŸrÄ±lÄ±r
// Pending kaydÄ± bulup success'e Ã§evirir + download token Ã¼retir
router.post("/internal/ebook-purchase/activate", async (req: Request, res: Response) => {
  const rawBody = JSON.stringify(req.body);
  const signature = req.headers["x-internal-signature"];

  if (!verifySignature(rawBody, typeof signature === "string" ? signature : undefined)) {
    return res.status(401).json({ error: "GeÃ§ersiz imza" });
  }

  const {
    ebookId: providedEbookId,
    buyerEmail,
    buyerName,
    amountPaid,
    currency,
    iyzicoPaymentId,
    iyzicoConversationId,
    downloadToken,
    paidAt,
  } = (req.body ?? {}) as any;

  // ebookId resolve â€” www tarafÄ± regex match edememiÅŸse iyzicoConversationId
  // Ã¼zerinden pending kayÄ±ttan Ã§ek (defense-in-depth)
  let ebookId: number | null = providedEbookId ? Number(providedEbookId) : null;
  if (!ebookId && iyzicoConversationId) {
    try {
      const lookupRows = await db.execute(sql`
        SELECT ebook_id FROM ebook_purchases
        WHERE iyzico_conversation_id = ${iyzicoConversationId}
        ORDER BY created_at DESC
        LIMIT 1
      `);
      const lookupRow = (lookupRows.rows ?? lookupRows)[0] as any;
      if (lookupRow?.ebook_id) {
        ebookId = Number(lookupRow.ebook_id);
        console.info(
          `[EBOOK-PURCHASE] activate: ebookId www'den gelmedi, pending kayÄ±ttan resolve edildi â†’ ${ebookId} (conv=${iyzicoConversationId})`,
        );
      }
    } catch (lookupErr: any) {
      console.error("[EBOOK-PURCHASE] activate: pending lookup HATA:", lookupErr?.message);
    }
  }

  if (!ebookId || !buyerEmail || !downloadToken) {
    return res.status(400).json({
      error: "Eksik alan: ebookId, buyerEmail, downloadToken",
      debug: {
        ebookId: ebookId ?? null,
        hasBuyerEmail: !!buyerEmail,
        hasDownloadToken: !!downloadToken,
        hasConvId: !!iyzicoConversationId,
      },
    });
  }

  try {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const paidAtIso = paidAt ?? new Date().toISOString();

    // Ã–nce pending satÄ±rÄ± conversationId ile bul ve gÃ¼ncelle
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
        // Mail gÃ¶nder (fire-and-forget â€” response'u bloklamasÄ±n)
        sendPurchaseEmailFireForget(updatedRow.id).catch((e) => {
          console.error("[EBOOK-PURCHASE] mail fire-forget HATA:", e?.message);
        });
        // Admin'lere yeni satÄ±ÅŸ bildirimi
        notifyAdminOfEbookPurchase(updatedRow.id);
        return res.json({ ok: true, purchaseId: updatedRow.id, action: "updated" });
      }
    }

    // Pre-create kaydÄ± yoksa fallback: yeni kayÄ±t oluÅŸtur (eski akÄ±ÅŸ uyumu iÃ§in)
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
      // Admin'lere yeni satÄ±ÅŸ bildirimi
      notifyAdminOfEbookPurchase(Number(newId));
    }
    return res.json({ ok: true, purchaseId: newId, action: "inserted" });
  } catch (e: any) {
    console.error("[EBOOK-PURCHASE] activate HATA:", e?.message);
    return res.status(500).json({ error: "KayÄ±t baÅŸarÄ±sÄ±z: " + e?.message });
  }
});

// â”€â”€â”€ INTERNAL: Mark failed (callback baÅŸarÄ±sÄ±z) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Iyzico callback failure dÃ¶ndÃ¼rÃ¼rse pending kaydÄ± failed olarak iÅŸaretlenir
router.post("/internal/ebook-purchase/mark-failed", async (req: Request, res: Response) => {
  const rawBody = JSON.stringify(req.body);
  const signature = req.headers["x-internal-signature"];

  if (!verifySignature(rawBody, typeof signature === "string" ? signature : undefined)) {
    return res.status(401).json({ error: "GeÃ§ersiz imza" });
  }

  const { iyzicoConversationId, iyzicoPaymentId, paymentError } = (req.body ?? {}) as any;
  if (!iyzicoConversationId) {
    return res.status(400).json({ error: "iyzicoConversationId gerekli" });
  }

  try {
    // iyzico_payment_id null gelirse COALESCE bug'Ä± tetiklenir â€” conditional SET
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
    return res.status(500).json({ error: "Mark failed baÅŸarÄ±sÄ±z: " + e?.message });
  }
});

// â”€â”€â”€ PUBLIC: Tam PDF indirme (token ile) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// CORS aÃ§Ä±k, Ã§oÄŸu tarayÄ±cÄ±dan link tÄ±klanÄ±r
router.get("/ebooks/download", async (req: Request, res: Response) => {
  const token = String(req.query?.token ?? "").trim();
  if (!token) return res.status(400).send("Token eksik");

  try {
    // Token + sÃ¼re + indirme sayÄ±sÄ± kontrolÃ¼
    const rows = await db.execute(sql`
      SELECT id, ebook_id, download_count, download_expires_at, payment_status
      FROM ebook_purchases
      WHERE download_token = ${token}
      LIMIT 1
    `);
    const purchase = (rows.rows ?? rows)[0] as any;

    if (!purchase) return res.status(404).send("GeÃ§ersiz indirme baÄŸlantÄ±sÄ±");
    if (purchase.payment_status !== "success") {
      return res.status(403).send("Bu sipariÅŸ iÃ§in Ã¶deme tamamlanmamÄ±ÅŸ");
    }
    if (!purchase.download_expires_at || new Date(purchase.download_expires_at) < new Date()) {
      return res.status(410).send("Ä°ndirme baÄŸlantÄ±sÄ±nÄ±n sÃ¼resi dolmuÅŸ (7 gÃ¼n)");
    }
    if (purchase.download_count >= 10) {
      return res.status(429).send("Ä°ndirme limiti doldu (max 10). Destek ile iletiÅŸime geÃ§in.");
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
      return res.status(500).send("PDF dosyasÄ± bulunamadÄ±. LÃ¼tfen destek ile iletiÅŸime geÃ§in.");
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
    return res.status(500).send("Ä°ndirme hatasÄ±");
  }
});

/**
 * Verilen purchaseId iÃ§in satÄ±n alma mailini gÃ¶nder.
 * Mail durumu (sent/failed/error) ebook_purchases tablosuna kaydedilir.
 * Fire-and-forget kullanÄ±ldÄ±ÄŸÄ±nda Ã¶deme akÄ±ÅŸÄ±nÄ± bloklamaz.
 */
export async function sendPurchaseEmailFireForget(purchaseId: number): Promise<void> {
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
      console.error(`[EBOOK-PURCHASE/mail] purchase bulunamadÄ±: id=${purchaseId}`);
      return;
    }
    if (p.payment_status !== "success" || !p.download_token) {
      console.warn(`[EBOOK-PURCHASE/mail] mail atlandÄ± (status=${p.payment_status}, token=${!!p.download_token})`);
      return;
    }

    // Attempt counter artÄ±r
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
      console.info(`[EBOOK-PURCHASE/mail] GÃ¶nderildi: id=${purchaseId} to=${p.buyer_email}`);
    } else {
      await db.execute(sql`
        UPDATE ebook_purchases SET
          mail_status = 'failed',
          mail_error = ${result.error ?? "bilinmeyen hata"},
          updated_at = NOW()
        WHERE id = ${purchaseId}
      `);
      console.error(`[EBOOK-PURCHASE/mail] BaÅŸarÄ±sÄ±z: id=${purchaseId} err=${result.error}`);
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

// Export â€” admin endpoint'inden de Ã§aÄŸrÄ±labilsin

export default router;
