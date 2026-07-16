/**
 * Sepet (multi-item) satın alma akışı.
 *
 * DATA MODELİ:
 *   PENDING (pre-create):
 *     Her sepet item için 1 satır. Bundle ise bundle_id set + ebook_id=dummy
 *     (bundle'ın ilk kitabı, yalnızca NOT NULL için). Böylece admin panelde 5
 *     paket satırı yerine 1 satır görünür.
 *
 *   SUCCESS (activate):
 *     Ebook satırı → mevcut satır success'e çevrilir + download token.
 *     Bundle master satırı → satır SİLİNİR, içindeki her ebook için ayrı yeni
 *     satır oluşturulur (her PDF için ayrı download token gerekli).
 *
 *   Bu sayede: pending durumunda sepet başına 1 satır; success durumunda her
 *   PDF için ayrı download link — hem UI temiz, hem indirme mekaniği doğru.
 *
 * Endpoint'ler:
 *   POST /api/internal/cart/pre-create   → 1 satır per item (bundle master dahil)
 *   POST /api/internal/cart/activate     → bundle master satırlarını expand et
 *   GET  /api/order/:orderId             → success items (bundle expanded ebook'lar)
 */

import { Router, Request, Response } from "express";
import crypto from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { sendCartDownloadMail } from "../lib/ebook-mail.js";
import { notifyNewCartPurchase } from "../lib/admin-notifications.js";
import { recordRedemption } from "../lib/coupon.js";
import { attributeEbookSale } from "../lib/affiliate.js";
import { issueInvoiceForSource } from "../lib/invoice/index.js";

const router = Router();

function verifySignature(rawBody: string, signature: string | undefined): boolean {
  if (!signature) return false;
  const secret = process.env["INTERNAL_API_SHARED_SECRET"];
  if (!secret) {
    console.error("[CART/INTERNAL] INTERNAL_API_SHARED_SECRET tanımlı değil");
    return false;
  }
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

/**
 * Sepet item = 1 satır (pending için).
 * Ebook: {ebookId, priceKurus, bundleId=null}
 * Bundle: {ebookId=first_ebook_of_bundle, priceKurus=bundle_price, bundleId=bundle.id}
 */
type ResolvedRow = {
  ebookId: number; // Bundle ise: bundle'ın ilk ebook_id'si (NOT NULL için)
  ebookTitle: string;
  priceKurus: number; // Bundle ise: bundle toplam fiyatı
  bundleId: number | null;
  bundleTitle: string | null;
};

/**
 * Cart items → pending satırlar için resolver.
 * Bundle 5 ebook içerse bile SADECE 1 satır döner (bundle master).
 * Activate zamanında bundle master expand edilir.
 */
async function resolveCartRows(
  items: Array<{ type: "ebook" | "bundle"; slug: string }>,
): Promise<
  | { resolved: ResolvedRow[]; subtotalKurus: number; itemCount: number }
  | { error: string }
> {
  const resolved: ResolvedRow[] = [];
  let subtotalKurus = 0;

  for (const it of items) {
    if (it.type === "ebook") {
      const rows = await db.execute(sql`
        SELECT id, title, price_try FROM ebooks
        WHERE slug = ${it.slug} AND is_active = TRUE
        LIMIT 1
      `);
      const eb = (rows.rows ?? rows)[0] as any;
      if (!eb) return { error: `E-kitap bulunamadı: ${it.slug}` };
      const priceKurus = Math.round(Number(eb.price_try) * 100);
      resolved.push({
        ebookId: Number(eb.id),
        ebookTitle: String(eb.title),
        priceKurus,
        bundleId: null,
        bundleTitle: null,
      });
      subtotalKurus += priceKurus;
    } else if (it.type === "bundle") {
      const bRows = await db.execute(sql`
        SELECT id, title, price_try FROM ebook_bundles
        WHERE slug = ${it.slug} AND is_active = TRUE
        LIMIT 1
      `);
      const bundle = (bRows.rows ?? bRows)[0] as any;
      if (!bundle) return { error: `Paket bulunamadı: ${it.slug}` };

      // Bundle'ın ilk ebook_id'sini alalım (NOT NULL constraint için dummy)
      const firstRows = await db.execute(sql`
        SELECT e.id
        FROM ebook_bundle_items bi
        INNER JOIN ebooks e ON e.id = bi.ebook_id
        WHERE bi.bundle_id = ${bundle.id} AND e.is_active = TRUE
        ORDER BY bi.position ASC, e.id ASC
        LIMIT 1
      `);
      const firstEbook = (firstRows.rows ?? firstRows)[0] as any;
      if (!firstEbook) return { error: `Paket boş: ${it.slug}` };

      const bundlePriceKurus = Math.round(Number(bundle.price_try) * 100);
      resolved.push({
        ebookId: Number(firstEbook.id),
        ebookTitle: String(bundle.title), // Bundle master için title = bundle adı
        priceKurus: bundlePriceKurus,
        bundleId: Number(bundle.id),
        bundleTitle: String(bundle.title),
      });
      subtotalKurus += bundlePriceKurus;
    }
  }

  return { resolved, subtotalKurus, itemCount: resolved.length };
}

// ─── INTERNAL: cart/pre-create ────────────────────────────────────────────
router.post("/internal/cart/pre-create", async (req: Request, res: Response) => {
  const rawBody = JSON.stringify(req.body);
  const signature = req.headers["x-internal-signature"];
  if (!verifySignature(rawBody, typeof signature === "string" ? signature : undefined)) {
    return res.status(401).json({ error: "Geçersiz imza" });
  }

  const {
    items,
    buyerEmail,
    buyerName,
    buyerPhone,
    invoiceType,
    taxId,
    taxOffice,
    companyName,
    billingAddress,
    billingCity,
    billingDistrict,
    billingPostalCode,
    couponCode,
    couponDiscountKurus,
    affiliateCode: _affiliateCode,
    iyzicoConversationId,
  } = (req.body ?? {}) as any;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "items array boş olamaz" });
  }
  if (!buyerEmail || !iyzicoConversationId) {
    return res.status(400).json({ error: "buyerEmail ve iyzicoConversationId gerekli" });
  }

  try {
    const r = await resolveCartRows(items);
    if ("error" in r) return res.status(400).json({ error: r.error });

    const { resolved, subtotalKurus } = r;

    const discountKurus = Math.max(0, Number(couponDiscountKurus ?? 0));
    const finalKurus = Math.max(0, subtotalKurus - discountKurus);

    // Coupon ID lookup
    let couponId: number | null = null;
    if (couponCode) {
      try {
        const cRows = await db.execute(
          sql`SELECT id FROM coupons WHERE code = ${couponCode} LIMIT 1`,
        );
        couponId = ((cRows.rows ?? cRows)[0] as any)?.id ?? null;
      } catch {}
    }

    const userRows = await db.execute(sql`
      SELECT id FROM users WHERE LOWER(email) = LOWER(${buyerEmail}) LIMIT 1
    `);
    const userId = (userRows.rows ?? userRows)[0]?.id ?? null;

    const orderId = iyzicoConversationId;

    // Idempotency check
    const existingRows = await db.execute(sql`
      SELECT COUNT(*)::int AS n FROM ebook_purchases WHERE order_id = ${orderId}
    `);
    const alreadyExists =
      Number(((existingRows.rows ?? existingRows)[0] as any)?.n ?? 0) > 0;
    if (alreadyExists) {
      console.info(`[CART] pre-create SKIP (idempotent): order_id=${orderId} zaten var`);
      return res.json({
        ok: true,
        orderId,
        finalKurus,
        subtotalKurus,
        discountKurus,
        itemCount: resolved.length,
        updated: false,
      });
    }

    const purchaseIds: number[] = [];
    for (let i = 0; i < resolved.length; i++) {
      const item = resolved[i];
      const isLastItem = i === resolved.length - 1;
      const itemCouponDiscount = isLastItem ? discountKurus : 0;
      const paidKurusForThis = Math.max(0, item.priceKurus - itemCouponDiscount);
      const paidTry = paidKurusForThis / 100;

      const ins = await db.execute(sql`
        INSERT INTO ebook_purchases (
          ebook_id, user_id, buyer_email, buyer_name, buyer_phone,
          invoice_type, tax_id, tax_office, company_name,
          billing_address, billing_city, billing_district, billing_postal_code,
          amount_paid, currency,
          iyzico_conversation_id,
          payment_status, invoice_status,
          download_count,
          coupon_id, coupon_discount_kurus,
          order_id, bundle_id
        ) VALUES (
          ${item.ebookId}, ${userId}, ${String(buyerEmail).toLowerCase()}, ${buyerName ?? null}, ${buyerPhone ?? null},
          ${invoiceType ?? "individual"}, ${taxId ?? null}, ${taxOffice ?? null}, ${companyName ?? null},
          ${billingAddress ?? null}, ${billingCity ?? null}, ${billingDistrict ?? null}, ${billingPostalCode ?? null},
          ${paidTry}, ${"TRY"},
          ${iyzicoConversationId},
          'pending', 'pending',
          0,
          ${isLastItem ? couponId : null}, ${isLastItem ? discountKurus || null : null},
          ${orderId}, ${item.bundleId}
        )
        RETURNING id
      `);
      const pid = ((ins.rows ?? ins)[0] as any)?.id;
      if (pid) purchaseIds.push(Number(pid));
    }

    console.info(
      `[CART] pre-create: order_id=${orderId} rows=${resolved.length} purchase_ids=[${purchaseIds.join(",")}] finalKurus=${finalKurus}`,
    );

    return res.json({
      ok: true,
      orderId,
      finalKurus,
      subtotalKurus,
      discountKurus,
      itemCount: resolved.length,
      purchaseIds,
    });
  } catch (e: any) {
    console.error("[CART] pre-create HATA:", e?.message, e?.stack);
    return res.status(500).json({ error: "Sepet oluşturulamadı: " + e?.message });
  }
});

// ─── INTERNAL: cart/activate ─────────────────────────────────────────────
// Bundle master satırları BURADA expand edilir.
router.post("/internal/cart/activate", async (req: Request, res: Response) => {
  const rawBody = JSON.stringify(req.body);
  const signature = req.headers["x-internal-signature"];
  if (!verifySignature(rawBody, typeof signature === "string" ? signature : undefined)) {
    return res.status(401).json({ error: "Geçersiz imza" });
  }

  const {
    orderId,
    iyzicoConversationId,
    iyzicoPaymentId,
    paidAt,
    affiliateCode,
  } = (req.body ?? {}) as any;

  const orderKey: string = orderId || iyzicoConversationId;
  if (!orderKey) {
    return res.status(400).json({ error: "orderId veya iyzicoConversationId gerekli" });
  }

  try {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const paidAtIso = paidAt ?? new Date().toISOString();

    // Idempotency guard — bu order zaten aktive edildiyse dön
    const successRows = await db.execute(sql`
      SELECT id FROM ebook_purchases
      WHERE order_id = ${orderKey} AND payment_status = 'success'
      LIMIT 1
    `);
    if ((successRows.rows ?? successRows).length > 0) {
      console.info(`[CART] activate SKIP (idempotent): order_id=${orderKey} zaten aktif`);
      return res.json({ ok: true, orderId: orderKey, action: "already_active" });
    }

    // Pending kayıtları çek — buyer bilgileri + coupon + bundle_id
    const pendingRows = await db.execute(sql`
      SELECT id, ebook_id, bundle_id, amount_paid, buyer_email, buyer_name, buyer_phone,
             invoice_type, tax_id, tax_office, company_name,
             billing_address, billing_city, billing_district, billing_postal_code,
             coupon_id, coupon_discount_kurus, user_id
      FROM ebook_purchases
      WHERE order_id = ${orderKey}
        AND payment_status IN ('pending', 'failed')
      ORDER BY id ASC
    `);
    const pending = (pendingRows.rows ?? pendingRows) as any[];

    if (pending.length === 0) {
      console.error(`[CART] activate: order_id=${orderKey} için pending kayıt yok`);
      return res.status(404).json({ error: "Pending kayıt bulunamadı" });
    }

    const activatedPurchaseIds: number[] = [];

    for (const p of pending) {
      // COUPON REDEMPTION — sadece bir kere, master satırında
      if (p.coupon_id && p.coupon_discount_kurus) {
        try {
          const originalKurus =
            Math.round(Number(p.amount_paid) * 100) + Number(p.coupon_discount_kurus);
          await recordRedemption({
            couponId: Number(p.coupon_id),
            userId: null,
            sourceType: "ebook",
            sourceId: Number(p.id),
            buyerEmail: String(p.buyer_email),
            originalAmountKurus: originalKurus,
            discountKurus: Number(p.coupon_discount_kurus),
            finalAmountKurus: Math.round(Number(p.amount_paid) * 100),
            conversationId: iyzicoConversationId ?? null,
          });
        } catch (cErr: any) {
          console.error("[CART] coupon redeem HATA:", cErr?.message);
        }
      }

      // AFFILIATE ATTRIBUTION — master satır için
      if (affiliateCode) {
        try {
          const amountKurus = Math.round(Number(p.amount_paid) * 100);
          await attributeEbookSale({
            purchaseId: Number(p.id),
            userId: null,
            amountKurus,
            affiliateCode,
          });
        } catch (affErr: any) {
          console.error("[CART] affiliate attr HATA:", affErr?.message);
        }
      }

      if (p.bundle_id) {
        // ── BUNDLE MASTER → içindeki ebook'lara EXPAND ────────────────
        const bundleItemsRows = await db.execute(sql`
          SELECT e.id AS ebook_id, e.title AS ebook_title
          FROM ebook_bundle_items bi
          INNER JOIN ebooks e ON e.id = bi.ebook_id
          WHERE bi.bundle_id = ${p.bundle_id} AND e.is_active = TRUE
          ORDER BY bi.position ASC, e.id ASC
        `);
        const bundleEbooks = (bundleItemsRows.rows ?? bundleItemsRows) as any[];
        if (bundleEbooks.length === 0) {
          console.error(`[CART] bundle_id=${p.bundle_id} boş — expand atlandı`);
          continue;
        }

        // Bundle toplam ödemesini içindeki ebook'lara pro-rata dağıt
        const bundleTotalKurus = Math.round(Number(p.amount_paid) * 100);
        const perItemKurus = Math.floor(bundleTotalKurus / bundleEbooks.length);
        const remainder = bundleTotalKurus - perItemKurus * bundleEbooks.length;

        for (let i = 0; i < bundleEbooks.length; i++) {
          const eb = bundleEbooks[i];
          const kurus =
            i === bundleEbooks.length - 1 ? perItemKurus + remainder : perItemKurus;
          const paidTry = kurus / 100;
          const dlToken = crypto.randomBytes(32).toString("base64url");

          const ins = await db.execute(sql`
            INSERT INTO ebook_purchases (
              ebook_id, user_id, buyer_email, buyer_name, buyer_phone,
              invoice_type, tax_id, tax_office, company_name,
              billing_address, billing_city, billing_district, billing_postal_code,
              amount_paid, currency,
              iyzico_conversation_id, iyzico_payment_id,
              payment_status, invoice_status,
              download_count, download_token, download_expires_at,
              paid_at,
              order_id, bundle_id
            ) VALUES (
              ${eb.ebook_id}, ${p.user_id}, ${p.buyer_email}, ${p.buyer_name}, ${p.buyer_phone},
              ${p.invoice_type}, ${p.tax_id}, ${p.tax_office}, ${p.company_name},
              ${p.billing_address}, ${p.billing_city}, ${p.billing_district}, ${p.billing_postal_code},
              ${paidTry}, 'TRY',
              ${iyzicoConversationId ?? null}, ${iyzicoPaymentId ? String(iyzicoPaymentId) : null},
              'success', 'pending',
              0, ${dlToken}, ${expiresAt}::TIMESTAMPTZ,
              ${paidAtIso}::TIMESTAMPTZ,
              ${orderKey}, ${p.bundle_id}
            )
            RETURNING id
          `);
          const newId = ((ins.rows ?? ins)[0] as any)?.id;
          if (newId) activatedPurchaseIds.push(Number(newId));
        }

        // Bundle master satırını sil
        await db.execute(sql`DELETE FROM ebook_purchases WHERE id = ${p.id}`);
        console.info(
          `[CART] bundle master silindi (id=${p.id}), ${bundleEbooks.length} ebook satırı oluşturuldu`,
        );
      } else {
        // ── EBOOK: mevcut satırı success'e çevir ──────────────────────
        const dlToken = crypto.randomBytes(32).toString("base64url");
        await db.execute(sql`
          UPDATE ebook_purchases SET
            payment_status = 'success',
            iyzico_payment_id = ${iyzicoPaymentId ? String(iyzicoPaymentId) : null},
            download_token = ${dlToken},
            download_expires_at = ${expiresAt}::TIMESTAMPTZ,
            paid_at = ${paidAtIso}::TIMESTAMPTZ,
            updated_at = NOW()
          WHERE id = ${p.id}
        `);
        activatedPurchaseIds.push(Number(p.id));
      }
    }

    console.info(
      `[CART] activate: order_id=${orderKey} ${activatedPurchaseIds.length} ebook satırı hazır`,
    );

    // Mail — 8 sn gecikme ile (fatura viewer URL hazır olsun)
    setTimeout(() => void (async () => {
      try {
        const detailRows = await db.execute(sql`
          SELECT p.id, p.buyer_email, p.buyer_name, p.invoice_type,
                 p.amount_paid, p.currency,
                 p.download_token, p.download_expires_at, p.bundle_id,
                 e.title AS ebook_title, e.author AS ebook_author,
                 b.title AS bundle_title
          FROM ebook_purchases p
          LEFT JOIN ebooks e ON e.id = p.ebook_id
          LEFT JOIN ebook_bundles b ON b.id = p.bundle_id
          WHERE p.order_id = ${orderKey} AND p.payment_status = 'success'
          ORDER BY p.id ASC
        `);
        const details = (detailRows.rows ?? detailRows) as any[];
        if (details.length === 0) return;

        await db.execute(sql`
          UPDATE ebook_purchases SET mail_attempts = mail_attempts + 1, updated_at = NOW()
          WHERE order_id = ${orderKey}
        `);

        // Sepet için fatura viewer URL — order_id ile invoices tablosundan çek
        let invoiceViewerUrl: string | null = null;
        try {
          const invRows = await db.execute(sql`
            SELECT viewer_url FROM invoices
            WHERE order_id = ${orderKey} AND status = 'sent'
            ORDER BY id DESC LIMIT 1
          `);
          invoiceViewerUrl = ((invRows.rows ?? invRows)[0] as any)?.viewer_url ?? null;
        } catch (e: any) {
          console.warn("[CART] invoice viewer URL çekilirken hata:", e?.message);
        }

        const totalAmount = details.reduce((s, d) => s + Number(d.amount_paid), 0);
        const first = details[0];
        const mailResult = await sendCartDownloadMail({
          buyerEmail: String(first.buyer_email),
          buyerName: first.buyer_name ?? null,
          orderId: orderKey,
          totalAmount,
          currency: String(first.currency ?? "TRY"),
          invoiceType: first.invoice_type === "corporate" ? "corporate" : "individual",
          items: details.map((d) => ({
            ebookTitle: String(d.ebook_title ?? "E-kitap"),
            ebookAuthor: d.ebook_author ?? "Sphere English",
            downloadToken: String(d.download_token),
            downloadExpiresAt: new Date(d.download_expires_at),
            bundleTitle: d.bundle_title ?? null,
          })),
          invoiceViewerUrl,
        });

        if (mailResult.ok) {
          await db.execute(sql`
            UPDATE ebook_purchases SET
              mail_status = 'sent',
              mail_sent_at = NOW(),
              mail_error = NULL,
              updated_at = NOW()
            WHERE order_id = ${orderKey}
          `);
          console.info(`[CART] mail gönderildi: order_id=${orderKey} → ${first.buyer_email}`);
        } else {
          await db.execute(sql`
            UPDATE ebook_purchases SET
              mail_status = 'failed',
              mail_error = ${mailResult.error ?? "bilinmeyen hata"},
              updated_at = NOW()
            WHERE order_id = ${orderKey}
          `);
          console.error(`[CART] mail başarısız: order_id=${orderKey} err=${mailResult.error}`);
        }
      } catch (e: any) {
        console.error("[CART] mail fire-forget HATA:", e?.message);
      }
    })(), 8000);

    // Admin bildirim
    void (async () => {
      try {
        const first = (
          await db.execute(sql`
            SELECT buyer_email FROM ebook_purchases WHERE order_id = ${orderKey} LIMIT 1
          `)
        ).rows?.[0] as any;
        const totalRows = await db.execute(sql`
          SELECT COALESCE(SUM(amount_paid), 0)::TEXT AS total, COUNT(*)::INT AS n
          FROM ebook_purchases WHERE order_id = ${orderKey} AND payment_status = 'success'
        `);
        const t = (totalRows.rows ?? totalRows)[0] as any;
        await notifyNewCartPurchase({
          orderId: orderKey,
          buyerEmail: String(first?.buyer_email ?? "-"),
          itemCount: Number(t?.n ?? 0),
          totalTl: Number(t?.total ?? 0),
        });
      } catch (e: any) {
        console.error("[CART] admin notify HATA:", e?.message);
      }
    })();

    // Otomatik e-Fatura/e-Arşiv (tek fatura, tüm sepet için)
    void (async () => {
      try {
        // Sepetin tüm ebook satırlarını ve buyer'ı al
        const detailRows = await db.execute(sql`
          SELECT ep.id, ep.buyer_email, ep.buyer_name, ep.buyer_phone,
                 ep.invoice_type, ep.tax_id, ep.tax_office, ep.company_name,
                 ep.billing_address, ep.billing_city, ep.billing_district, ep.billing_postal_code,
                 ep.amount_paid, ep.coupon_discount_kurus, ep.iyzico_payment_id, ep.bundle_id,
                 e.title AS ebook_title, e.slug AS ebook_slug,
                 b.title AS bundle_title
          FROM ebook_purchases ep
          LEFT JOIN ebooks e ON e.id = ep.ebook_id
          LEFT JOIN ebook_bundles b ON b.id = ep.bundle_id
          WHERE ep.order_id = ${orderKey} AND ep.payment_status = 'success'
          ORDER BY ep.id ASC
        `);
        const details = (detailRows.rows ?? detailRows) as any[];
        if (details.length === 0) return;

        const first = details[0];
        const buyerType = first.invoice_type === "corporate" ? "corporate" : "individual";
        const vatRate = 20;

        // Line items — bundle satırları gruplu, tekil kitaplar ayrı
        // Fatura kalemleri: her ebook satırı bir line
        const lineItems = details.map((d) => {
          const amountKurus = Math.round(Number(d.amount_paid) * 100);
          const unitPriceKurus = Math.round(amountKurus / (1 + vatRate / 100));
          const label = d.bundle_id
            ? `${d.bundle_title ?? "Paket"} — ${d.ebook_title ?? "E-kitap"}`
            : String(d.ebook_title ?? "E-kitap");
          return {
            productCode: d.ebook_slug ? `ebook-${d.ebook_slug}` : `ebook-${d.id}`,
            productName: label,
            quantity: 1,
            unitPriceKurus,
            vatRate,
            note: d.bundle_id ? "Paket kapsamında" : undefined,
          };
        });

        // Tek fatura kes — source olarak order_id kullan (integer değil, bigint tabanlı hash)
        // source_id: order_id'nin hash'i (16 haneden az bigint)
        const sourceIdHash = Math.abs(
          orderKey.split("").reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) % 9007199254740991, 0),
        );

        const r = await issueInvoiceForSource({
          source: {
            type: "ebook_cart",
            id: sourceIdHash,
            orderId: orderKey,
          },
          buyer: {
            email: String(first.buyer_email),
            name: String(first.buyer_name ?? "Alıcı"),
            type: buyerType,
            taxId: first.tax_id ?? undefined,
            taxOffice: first.tax_office ?? undefined,
            companyName: first.company_name ?? undefined,
            address: first.billing_address ?? undefined,
            city: first.billing_city ?? undefined,
            district: first.billing_district ?? undefined,
            postalCode: first.billing_postal_code ?? undefined,
            country: "Türkiye",
            phone: first.buyer_phone ?? undefined,
          },
          lineItems,
          notes: [
            `Sphere English Sepet Siparişi — ${details.length} kalem`,
            first.iyzico_payment_id ? `Iyzico Payment ID: ${first.iyzico_payment_id}` : "",
          ].filter(Boolean),
          paymentReference: first.iyzico_payment_id ?? undefined,
          sendMailAutomatically: true,
        });
        if (r.ok) {
          console.info(`[CART-INVOICE] fatura kesildi: order=${orderKey} ettn=${r.ettn} skipped=${r.skipped ?? false}`);
        } else {
          console.error(`[CART-INVOICE] fatura BAŞARISIZ: order=${orderKey} err=${r.error}`);
        }
      } catch (e: any) {
        console.error("[CART-INVOICE] hata:", e?.message);
      }
    })();

    return res.json({
      ok: true,
      orderId: orderKey,
      itemCount: activatedPurchaseIds.length,
      purchaseIds: activatedPurchaseIds,
    });
  } catch (e: any) {
    console.error("[CART] activate HATA:", e?.message, e?.stack);
    return res.status(500).json({ error: "Activate başarısız: " + e?.message });
  }
});

// ─── PUBLIC: GET /api/order/:orderId ─────────────────────────────────────
router.get("/order/:orderId", async (req: Request, res: Response) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const orderId = String(req.params.orderId ?? "").trim();
  if (!orderId) return res.status(400).json({ error: "orderId gerekli" });

  try {
    const rows = await db.execute(sql`
      SELECT p.id, p.amount_paid, p.currency, p.download_token, p.download_expires_at,
             p.buyer_email, p.payment_status, p.bundle_id, p.paid_at,
             e.slug AS ebook_slug, e.title AS ebook_title, e.author AS ebook_author,
             e.cover_image_url AS ebook_cover,
             b.slug AS bundle_slug, b.title AS bundle_title
      FROM ebook_purchases p
      LEFT JOIN ebooks e ON e.id = p.ebook_id
      LEFT JOIN ebook_bundles b ON b.id = p.bundle_id
      WHERE p.order_id = ${orderId}
      ORDER BY p.id ASC
    `);
    const items = (rows.rows ?? rows) as any[];
    if (items.length === 0) return res.status(404).json({ error: "Sipariş bulunamadı" });

    const successItems = items.filter((i) => i.payment_status === "success");
    if (successItems.length === 0) {
      return res.status(403).json({ error: "Bu sipariş henüz tamamlanmadı" });
    }

    const totalAmount = successItems.reduce((s, i) => s + Number(i.amount_paid), 0);
    return res.json({
      ok: true,
      order: {
        orderId,
        totalAmount,
        currency: String(successItems[0].currency ?? "TRY"),
        paidAt: successItems[0].paid_at,
        itemCount: successItems.length,
        items: successItems.map((i) => ({
          ebookSlug: i.ebook_slug,
          ebookTitle: i.ebook_title,
          ebookAuthor: i.ebook_author,
          ebookCoverUrl: i.ebook_cover,
          bundleSlug: i.bundle_slug,
          bundleTitle: i.bundle_title,
          downloadToken: i.download_token,
          downloadExpiresAt: i.download_expires_at,
          amountPaid: Number(i.amount_paid),
        })),
      },
    });
  } catch (e: any) {
    console.error("[CART] order lookup HATA:", e?.message);
    return res.status(500).json({ error: "Sipariş sorgusu başarısız" });
  }
});

export default router;
