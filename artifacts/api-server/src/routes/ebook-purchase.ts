/**
 * E-kitap satın alma + indirme.
 *
 * Endpoint'ler:
 *   POST /api/internal/ebook-purchase/pre-create  → Initialize aşamasında pending purchase yaz (billing info ile)
 *   POST /api/internal/ebook-purchase/activate    → Callback başarılıysa pending'i success'e çevir, downloadToken üret
 *   POST /api/internal/ebook-purchase/mark-failed → Callback başarısızsa pending'i failed olarak işaretle
 *   GET  /api/ebooks/download?token=X             → İndirme sayfası (hak tüketmez)
 *   POST /api/ebooks/download                     → PDF'i indir (max 10 indirme, 30 gün geçerli — lib/ebook-download-policy.ts)
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
import { issueInvoiceForSource } from "../lib/invoice/index.js";
import { presignDownload } from "../lib/object-storage.js";
import { downloadExpiry, MAX_DOWNLOADS, SUPPORT_EMAIL, SUPPORT_WHATSAPP } from "../lib/ebook-download-policy.js";

/**
 * E-kitap satışı için otomatik e-Fatura/e-Arşiv kes + mail'i tetikle.
 *
 * Sıralı akış:
 *   1. Fatura kes (sync, 5-8 sn) — viewer URL alma dahil
 *   2. Mail atma tetiklenir — DB'de viewer URL varsa "Faturayı Görüntüle" butonu
 *
 * Fire-and-forget: ödeme response'u bekletmez.
 */
function issueEbookInvoiceAndSendMail(purchaseId: number): void {
  void (async () => {
    // 1. Fatura kes (best effort)
    try {
      await runInvoiceIssue(purchaseId);
    } catch (e: any) {
      console.error(`[EBOOK-INVOICE] fatura kesme HATA: purchaseId=${purchaseId} → ${e?.message}`);
    }
    // 2. Mail her koşulda gönder — fatura fail olsa bile
    try {
      await sendPurchaseEmailFireForget(purchaseId);
    } catch (e: any) {
      console.error("[EBOOK-INVOICE] mail HATA:", e?.message);
    }
  })();
}

/** Fatura kesim iç fonksiyonu — DB'den purchase bilgilerini çekip Luca'ya gönderir */
async function runInvoiceIssue(purchaseId: number): Promise<void> {
  console.info(`[EBOOK-INVOICE] fatura kesme başladı: purchaseId=${purchaseId}`);
  const rows = await db.execute(sql`
    SELECT ep.id, ep.buyer_email, ep.buyer_name, ep.buyer_phone,
           ep.invoice_type, ep.tax_id, ep.tax_office, ep.company_name,
           ep.billing_address, ep.billing_city, ep.billing_district, ep.billing_postal_code,
           ep.amount_paid, ep.coupon_discount_kurus, ep.iyzico_payment_id,
           e.title AS ebook_title, e.slug AS ebook_slug
    FROM ebook_purchases ep
    LEFT JOIN ebooks e ON e.id = ep.ebook_id
    WHERE ep.id = ${purchaseId}
    LIMIT 1
  `);
  const p = (rows.rows ?? rows)[0] as any;
  if (!p) {
    console.error(`[EBOOK-INVOICE] purchase bulunamadı: id=${purchaseId}`);
    return;
  }

  const amountKurus = Math.round(Number(p.amount_paid) * 100);
  const discountKurus = Number(p.coupon_discount_kurus ?? 0);
  const vatRate = 20;
  const unitPriceKurus = Math.round((amountKurus + discountKurus) / (1 + vatRate / 100));

  const buyerType = p.invoice_type === "corporate" ? "corporate" : "individual";
  const r = await issueInvoiceForSource({
    source: {
      type: "ebook",
      id: Number(p.id),
      orderId: p.iyzico_payment_id ?? `EBOOK-${p.id}`,
    },
    buyer: {
      email: String(p.buyer_email),
      name: String(p.buyer_name ?? "Alıcı"),
      type: buyerType,
      taxId: p.tax_id ?? undefined,
      taxOffice: p.tax_office ?? undefined,
      companyName: p.company_name ?? undefined,
      address: p.billing_address ?? undefined,
      city: p.billing_city ?? undefined,
      district: p.billing_district ?? undefined,
      postalCode: p.billing_postal_code ?? undefined,
      country: "Türkiye",
      phone: p.buyer_phone ?? undefined,
    },
    lineItems: [
      {
        productCode: p.ebook_slug ? `ebook-${p.ebook_slug}` : `ebook-${p.id}`,
        productName: String(p.ebook_title ?? "Sphere English E-Kitap"),
        quantity: 1,
        unitPriceKurus,
        vatRate,
        discountKurus: discountKurus > 0 ? discountKurus : undefined,
        note: "Dijital yayın — anında PDF indirme",
      },
    ],
    notes: [
      "Sphere English E-Kitap Satışı",
      p.iyzico_payment_id ? `Iyzico Payment ID: ${p.iyzico_payment_id}` : "",
    ].filter(Boolean),
    paymentReference: p.iyzico_payment_id ?? undefined,
    sendMailAutomatically: true,
  });
  if (r.ok) {
    console.info(`[EBOOK-INVOICE] fatura kesildi: purchaseId=${purchaseId} ettn=${r.ettn} skipped=${r.skipped ?? false}`);
  } else {
    console.error(`[EBOOK-INVOICE] fatura BAŞARISIZ: purchaseId=${purchaseId} err=${r.error}`);
  }
}

/** Admin'lere yeni e-kitap satışı bildirimi (non-blocking) */
function notifyAdminOfEbookPurchase(purchaseId: number): void {
  console.info(`[EBOOK-PURCHASE] admin notify ÇAĞRILDI: purchaseId=${purchaseId}`);
  void (async () => {
    try {
      const rows = await db.execute(sql`
        SELECT ep.buyer_email, ep.amount_paid, e.title, e.id AS ebook_id_check
        FROM ebook_purchases ep
        LEFT JOIN ebooks e ON ep.ebook_id = e.id
        WHERE ep.id = ${purchaseId} LIMIT 1
      `);
      const r = (rows.rows ?? rows)[0] as any;
      if (!r) {
        console.warn(`[EBOOK-PURCHASE] admin notify: purchase bulunamadi (id=${purchaseId}) — atlandı`);
        return;
      }
      console.info(
        `[EBOOK-PURCHASE] admin notify: purchase bulundu — buyer=${r.buyer_email}, ebookExists=${!!r.ebook_id_check}, title=${r.title ?? "(yok)"}`,
      );
      await notifyNewEbookPurchase({
        purchaseId,
        buyerEmail: r.buyer_email,
        ebookTitle: r.title ?? "E-kitap",
        amountTl: Number(r.amount_paid ?? 0),
      });
      console.info(`[EBOOK-PURCHASE] admin notify TAMAMLANDI: purchaseId=${purchaseId}`);
    } catch (e: any) {
      console.error("[EBOOK-PURCHASE] admin notify HATA:", e?.message, e?.stack);
    }
  })();
}

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
    // Meta Pixel/CAPI kimlik verisi — checkout başlarken yakalanır
    metaFbp,
    metaFbc,
    metaClientIp,
    metaClientUserAgent,
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
    const userId = (((userRows.rows ?? userRows)[0] as any)?.id ?? null) as number | null;

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
          meta_fbp = COALESCE(${metaFbp ?? null}, meta_fbp),
          meta_fbc = COALESCE(${metaFbc ?? null}, meta_fbc),
          meta_client_ip = COALESCE(${metaClientIp ?? null}, meta_client_ip),
          meta_client_user_agent = COALESCE(${metaClientUserAgent ?? null}, meta_client_user_agent),
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
        coupon_discount_kurus,
        meta_fbp, meta_fbc, meta_client_ip, meta_client_user_agent
      ) VALUES (
        ${ebookId}, ${userId}, ${buyerEmail.toLowerCase()}, ${buyerName ?? null}, ${buyerPhone ?? null},
        ${invoiceType ?? "individual"}, ${taxId ?? null}, ${taxOffice ?? null}, ${companyName ?? null},
        ${billingAddress ?? null}, ${billingCity ?? null}, ${billingDistrict ?? null}, ${billingPostalCode ?? null},
        ${amountPaid ?? 0}, ${currency ?? "TRY"},
        ${iyzicoConversationId},
        'pending', 'pending',
        0,
        ${couponDiscountKurus ?? null},
        ${metaFbp ?? null}, ${metaFbc ?? null}, ${metaClientIp ?? null}, ${metaClientUserAgent ?? null}
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

  let {
    ebookId,
    buyerEmail,
    buyerName,
    amountPaid,
    currency,
    iyzicoPaymentId,
    iyzicoConversationId,
    downloadToken,
    paidAt,
    affiliateCode,
  } = (req.body ?? {}) as any;

  // Meta Pixel/CAPI kimlik verisi — pending kayıttan çekip response'ta callback'e döneriz.
  // (Callback bunları sendCapiPurchase.userData'ya yazacak — attribution için kritik.)
  let metaFbp: string | null = null;
  let metaFbc: string | null = null;
  let metaClientIp: string | null = null;
  let metaClientUserAgent: string | null = null;

  // Defense-in-depth: Iyzico response'da bazen buyer.email veya conversationId boş gelir.
  // Pending kayıt (pre-create) bilgilerinden eksik alanları doldur.
  // Ayrıca meta_* alanlarını her zaman çek (response'ta callback'e döneceğiz).
  if (iyzicoConversationId) {
    try {
      const lookupRows = await db.execute(sql`
        SELECT ebook_id, buyer_email, buyer_name, amount_paid,
               meta_fbp, meta_fbc, meta_client_ip, meta_client_user_agent
        FROM ebook_purchases
        WHERE iyzico_conversation_id = ${iyzicoConversationId}
        ORDER BY created_at DESC
        LIMIT 1
      `);
      const lookupRow = (lookupRows.rows ?? lookupRows)[0] as any;
      if (lookupRow) {
        if (!ebookId && lookupRow.ebook_id) {
          ebookId = Number(lookupRow.ebook_id);
          console.info(`[EBOOK-PURCHASE] activate: ebookId pending'den resolve → ${ebookId}`);
        }
        if (!buyerEmail && lookupRow.buyer_email) {
          buyerEmail = String(lookupRow.buyer_email);
          console.info(`[EBOOK-PURCHASE] activate: buyerEmail pending'den resolve → ${buyerEmail}`);
        }
        if (!buyerName && lookupRow.buyer_name) {
          buyerName = String(lookupRow.buyer_name);
        }
        if (!amountPaid && lookupRow.amount_paid != null) {
          amountPaid = Number(lookupRow.amount_paid);
        }
        metaFbp = lookupRow.meta_fbp ?? null;
        metaFbc = lookupRow.meta_fbc ?? null;
        metaClientIp = lookupRow.meta_client_ip ?? null;
        metaClientUserAgent = lookupRow.meta_client_user_agent ?? null;
      } else {
        console.warn(`[EBOOK-PURCHASE] activate: pending kayit bulunamadi convId=${iyzicoConversationId}`);
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
        convIdValue: iyzicoConversationId ?? null,
      },
    });
  }

  try {
    const expiresAt = downloadExpiry().toISOString();
    const paidAtIso = paidAt ?? new Date().toISOString();

    // ── IDEMPOTENCY GUARD ────────────────────────────────────────────────
    // Aynı conversationId veya paymentId ile SUCCESS satır zaten varsa
    // hiçbir şey yapma — duplicate insert bug'ı önleme.
    // Iyzico bazen callback'i 2 kez tetikler (subscription redirect'i dahil).
    if (iyzicoConversationId || iyzicoPaymentId) {
      const existingSuccessRows = await db.execute(sql`
        SELECT id, download_token FROM ebook_purchases
        WHERE payment_status = 'success'
          AND (
            (${iyzicoConversationId ?? null}::TEXT IS NOT NULL AND iyzico_conversation_id = ${iyzicoConversationId ?? null})
            OR (${iyzicoPaymentId ?? null}::TEXT IS NOT NULL AND iyzico_payment_id = ${iyzicoPaymentId ?? null})
          )
        ORDER BY created_at ASC
        LIMIT 1
      `);
      const existingSuccess = (existingSuccessRows.rows ?? existingSuccessRows)[0] as any;
      if (existingSuccess) {
        console.info(
          `[EBOOK-PURCHASE] Activate SKIPPED (idempotent) — zaten aktive: purchaseId=${existingSuccess.id} convId=${iyzicoConversationId} paymentId=${iyzicoPaymentId}`,
        );
        return res.json({
          ok: true,
          purchaseId: existingSuccess.id,
          action: "already_active",
          meta: { fbp: metaFbp, fbc: metaFbc, clientIp: metaClientIp, clientUserAgent: metaClientUserAgent },
        });
      }
    }

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
        // Admin'lere yeni satış bildirimi
        notifyAdminOfEbookPurchase(updatedRow.id);
        // Fatura kes + mail'i tetikle (sıralı, fire-and-forget)
        // Fatura kesildikten SONRA mail atılır — viewer URL DB'de hazır olur
        issueEbookInvoiceAndSendMail(Number(updatedRow.id));
        return res.json({
          ok: true,
          purchaseId: updatedRow.id,
          action: "updated",
          meta: { fbp: metaFbp, fbc: metaFbc, clientIp: metaClientIp, clientUserAgent: metaClientUserAgent },
        });
      }
    }

    // Pre-create kaydı yoksa fallback: yeni kayıt oluştur (eski akış uyumu için)
    const userRows = await db.execute(sql`
      SELECT id FROM users WHERE LOWER(email) = LOWER(${buyerEmail}) LIMIT 1
    `);
    const userId = (((userRows.rows ?? userRows)[0] as any)?.id ?? null) as number | null;

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
      // Admin'lere yeni satış bildirimi
      notifyAdminOfEbookPurchase(Number(newId));
      // Fatura kes + mail'i tetikle (sıralı, fire-and-forget)
      issueEbookInvoiceAndSendMail(Number(newId));
    }
    return res.json({
      ok: true,
      purchaseId: newId,
      action: "inserted",
      meta: { fbp: metaFbp, fbc: metaFbc, clientIp: metaClientIp, clientUserAgent: metaClientUserAgent },
    });
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
//
// İki adımlı:
//   GET  /ebooks/download?token=X  → Kitap adı + "PDF'i indir" düğmesi olan sayfa. Hak TÜKETMEZ.
//   POST /ebooks/download (token)  → Hakkı düşer, dosyaya yönlendirir.
// Neden: kurumsal Outlook (Safe Links), antivirüs ve sohbet uygulamaları maildeki linki
// kendiliğinden açıyor; eskiden her açılış bir indirme sayılıyor ve hak bitiyordu.
// Botlar form göndermez → artık sadece gerçek tıklama sayılır.

function escapeHtml(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function formatTrDate(d: Date): string {
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Istanbul" });
}

function downloadPage(res: Response, status: number, opts: { title: string; body: string; action?: string }) {
  res.status(status);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  // Form gönderiminden sonra nesne deposuna yönlendirme olduğu için form-action https: açık.
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'none'; style-src 'unsafe-inline'; img-src https: data:; form-action 'self' https:; base-uri 'none'; frame-ancestors 'none'",
  );
  const support = `<p class="sup">Sorun mu var? <a href="${SUPPORT_WHATSAPP}">WhatsApp'tan yaz</a> ya da <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a> adresine e-posta gönder; bağlantını hemen yenileyelim.</p>`;
  res.send(`<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>${escapeHtml(opts.title)} — Sphere English</title>
<style>
body{margin:0;background:#e8eef8;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#1e3a6e;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px;box-sizing:border-box}
.card{background:#fff;border-radius:16px;max-width:460px;width:100%;padding:32px 28px;box-shadow:0 8px 30px rgba(30,58,110,.12)}
.brand{font-weight:800;letter-spacing:-.01em;margin-bottom:20px;color:#1e3a6e}
h1{font-size:22px;margin:0 0 12px}p{line-height:1.55;margin:0 0 14px;color:#334155}
.meta{font-size:14px;color:#64748b}
button{width:100%;border:0;border-radius:12px;background:#1e3a6e;color:#fff;font-size:17px;font-weight:700;padding:16px;cursor:pointer;margin:8px 0 14px}
button:hover{background:#16305c}a{color:#0e7da6}.sup{font-size:13px;color:#64748b;margin-top:18px}
</style></head><body><main class="card"><div class="brand">Sphere English</div>
<h1>${escapeHtml(opts.title)}</h1>${opts.body}${opts.action ?? ""}${support}</main></body></html>`);
}

type DownloadCheck =
  | { ok: true; purchase: any; title: string }
  | { ok: false; status: number; title: string; message: string };

async function checkDownloadToken(token: string): Promise<DownloadCheck> {
  if (!token) return { ok: false, status: 400, title: "Bağlantı eksik", message: "İndirme bağlantısı eksik görünüyor. Maildeki düğmeye tekrar tıklamayı dene." };
  const rows = await db.execute(sql`
    SELECT p.id, p.ebook_id, p.download_count, p.download_expires_at, p.payment_status, e.title
    FROM ebook_purchases p LEFT JOIN ebooks e ON e.id = p.ebook_id
    WHERE p.download_token = ${token}
    LIMIT 1
  `);
  const purchase = (rows.rows ?? rows)[0] as any;
  if (!purchase) {
    console.error(`[EBOOK-DOWNLOAD] Token bulunamadı: ${token.slice(0, 12)}... (uzunluk=${token.length})`);
    return { ok: false, status: 404, title: "Bağlantı geçersiz", message: "Bu indirme bağlantısı tanınmadı. Bağlantı mailden eksik kopyalanmış olabilir; maildeki düğmeye doğrudan tıklamayı dene." };
  }
  const title = String(purchase.title ?? "E-kitabın");
  if (purchase.payment_status !== "success") {
    console.warn(`[EBOOK-DOWNLOAD] Reddedildi - status=${purchase.payment_status} id=${purchase.id}`);
    return { ok: false, status: 403, title, message: "Bu siparişin ödemesi henüz tamamlanmamış görünüyor." };
  }
  if (!purchase.download_expires_at || new Date(purchase.download_expires_at) < new Date()) {
    console.warn(`[EBOOK-DOWNLOAD] Reddedildi - süresi dolmuş id=${purchase.id}`);
    return { ok: false, status: 410, title, message: "Bu indirme bağlantısının süresi dolmuş. Bize yazman yeterli; yeni bağlantını hemen gönderelim." };
  }
  if (Number(purchase.download_count) >= MAX_DOWNLOADS) {
    console.warn(`[EBOOK-DOWNLOAD] Reddedildi - limit dolu id=${purchase.id}`);
    return { ok: false, status: 429, title, message: `Bu bağlantının ${MAX_DOWNLOADS} indirme hakkı dolmuş. Bize yazman yeterli; bağlantını yenileyelim.` };
  }
  return { ok: true, purchase, title };
}

router.get("/ebooks/download", async (req: Request, res: Response) => {
  const token = String(req.query?.token ?? "").trim();
  try {
    const c = await checkDownloadToken(token);
    if (!c.ok) return downloadPage(res, c.status, { title: c.title, body: `<p>${escapeHtml(c.message)}</p>` });
    const left = MAX_DOWNLOADS - Number(c.purchase.download_count);
    const until = formatTrDate(new Date(c.purchase.download_expires_at));
    return downloadPage(res, 200, {
      title: c.title,
      body: `<p>Kitabın hazır. Aşağıdaki düğmeye bastığında PDF dosyası cihazına inecek.</p>
<p class="meta">Kalan indirme hakkı: <strong>${left}</strong> · Son gün: <strong>${escapeHtml(until)}</strong></p>`,
      action: `<form method="post"><input type="hidden" name="token" value="${escapeHtml(token)}"><button type="submit">PDF'i indir</button></form>
<p class="meta">İndirdikten sonra dosyayı cihazına kaydetmeni öneririz (telefonda "Dosyalar"a kaydet / Paylaş → Dosyalara kaydet).</p>`,
    });
  } catch (e: any) {
    console.error("[EBOOK-DOWNLOAD] sayfa HATA:", e?.message);
    return downloadPage(res, 500, { title: "Bir sorun oluştu", body: "<p>Şu an indirme sayfası açılamadı. Birkaç dakika sonra tekrar dene.</p>" });
  }
});

router.post("/ebooks/download", async (req: Request, res: Response) => {
  const token = String((req.body as any)?.token ?? req.query?.token ?? "").trim();
  try {
    const c = await checkDownloadToken(token);
    if (!c.ok) return downloadPage(res, c.status, { title: c.title, body: `<p>${escapeHtml(c.message)}</p>` });
    const purchase = c.purchase;

    const assetRows = await db.execute(sql`
      SELECT filename, mime_type, size_bytes, data_base64, storage_key
      FROM ebook_assets
      WHERE ebook_id = ${purchase.ebook_id} AND asset_type = 'full'
      LIMIT 1
    `);
    const asset = (assetRows.rows ?? assetRows)[0] as any;
    if (!asset) {
      console.error(`[EBOOK-DOWNLOAD] Full PDF asset yok: ebookId=${purchase.ebook_id}`);
      return downloadPage(res, 500, { title: c.title, body: "<p>Kitap dosyasına şu an ulaşılamıyor. Bize yaz, hemen ilgilenelim.</p>" });
    }

    // Hakkı düş — yarış durumunda limiti aşmamak için koşullu güncelle
    const upd = await db.execute(sql`
      UPDATE ebook_purchases SET download_count = download_count + 1, updated_at = NOW()
      WHERE id = ${purchase.id} AND download_count < ${MAX_DOWNLOADS}
      RETURNING download_count
    `);
    if (((upd.rows ?? upd) as any[]).length === 0) {
      return downloadPage(res, 429, { title: c.title, body: `<p>Bu bağlantının ${MAX_DOWNLOADS} indirme hakkı dolmuş. Bize yazman yeterli; bağlantını yenileyelim.</p>` });
    }
    console.info(`[EBOOK-DOWNLOAD] indirildi id=${purchase.id}`);

    if (asset.storage_key) {
      // Dosya nesne deposunda → 5 dakikalık süreli bağlantıyla doğrudan oradan indir.
      const url = await presignDownload(asset.storage_key, asset.filename, asset.mime_type || "application/pdf", 300);
      res.setHeader("Cache-Control", "private, no-store");
      return res.redirect(303, url);
    }

    res.setHeader("Content-Type", asset.mime_type || "application/pdf");
    res.setHeader("Content-Length", String(asset.size_bytes));
    res.setHeader("Content-Disposition", `attachment; filename="${asset.filename.replace(/[^a-zA-Z0-9._-]/g, "_")}"`);
    res.setHeader("Cache-Control", "private, no-store");
    return res.send(Buffer.from(asset.data_base64, "base64"));
  } catch (e: any) {
    console.error("[EBOOK-DOWNLOAD] HATA:", e?.message);
    return downloadPage(res, 500, { title: "Bir sorun oluştu", body: "<p>İndirme sırasında bir sorun oluştu. Birkaç dakika sonra tekrar dene.</p>" });
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

    // Fatura viewer URL'i (varsa) — fatura kesim ~3-5 sn sürdüğü için bu fonksiyon
    // activate handler'da 8 sn gecikme ile çağrılıyor, viewer URL genelde hazır olur.
    let invoiceViewerUrl: string | null = null;
    try {
      const invRows = await db.execute(sql`
        SELECT viewer_url FROM invoices
        WHERE source_type = 'ebook' AND source_id = ${purchaseId} AND status = 'sent'
        ORDER BY id DESC LIMIT 1
      `);
      invoiceViewerUrl = ((invRows.rows ?? invRows)[0] as any)?.viewer_url ?? null;
    } catch (e: any) {
      console.warn("[EBOOK-PURCHASE/mail] invoice viewer URL çekilirken hata:", e?.message);
    }

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
      invoiceViewerUrl,
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
