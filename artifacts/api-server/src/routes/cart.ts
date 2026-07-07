/**
 * Sepet (multi-item) satın alma akışı.
 *
 * Tek order_id altında birden fazla e-kitap veya bundle satılır.
 * Her item için ayrı ebook_purchases satırı yazılır (aynı order_id + iyzico_conversation_id).
 *
 * Endpoint'ler:
 *   POST /api/internal/cart/pre-create   → Sepetteki items array'ini alır, order_id üretir,
 *                                          bundle'ları ebook'lara açar, her ebook için pending
 *                                          purchase yazar. Fiyat backend'de doğrulanır.
 *   POST /api/internal/cart/activate     → Callback success'te order_id'ye ait tüm pending
 *                                          satırları success'e çevirir, downloadToken üretir,
 *                                          TEK mail'de tüm PDF linklerini gönderir.
 *   GET  /api/order/:orderId             → Public. order_id ile başarılı satın alımları getirir
 *                                          (success sayfasında download linkleri için).
 *
 * Internal endpoint'ler HMAC X-Internal-Signature ile authenticate.
 */

import { Router, Request, Response } from "express";
import crypto from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { sendCartDownloadMail } from "../lib/ebook-mail.js";
import { notifyNewCartPurchase } from "../lib/admin-notifications.js";
import { recordRedemption } from "../lib/coupon.js";
import { attributeEbookSale } from "../lib/affiliate.js";

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

type ResolvedItem = {
  ebookId: number;
  ebookTitle: string;
  priceKurus: number; // Ana ürün fiyatı (bu ebook için ne kadar ödendi)
  bundleId: number | null; // Eğer bir bundle'dan geldiyse bundle.id
  bundleTitle: string | null;
};

/**
 * Cart items'ı ebook_purchases satırlarına açan resolver.
 * Bundle içindeki her ebook için ayrı satır oluşturulur.
 * Bundle fiyatı, içindeki ebook sayısına eşit dağıtılır (kalan artık son ebook'a).
 */
async function resolveCartItems(
  items: Array<{ type: "ebook" | "bundle"; slug: string }>,
): Promise<{ resolved: ResolvedItem[]; subtotalKurus: number; itemCount: number } | { error: string }> {
  const resolved: ResolvedItem[] = [];
  let subtotalKurus = 0;
  let itemCount = 0;

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
      itemCount += 1;
    } else if (it.type === "bundle") {
      const bRows = await db.execute(sql`
        SELECT id, title, price_try FROM ebook_bundles
        WHERE slug = ${it.slug} AND is_active = TRUE
        LIMIT 1
      `);
      const bundle = (bRows.rows ?? bRows)[0] as any;
      if (!bundle) return { error: `Paket bulunamadı: ${it.slug}` };

      const itemsRows = await db.execute(sql`
        SELECT e.id, e.title
        FROM ebook_bundle_items bi
        INNER JOIN ebooks e ON e.id = bi.ebook_id
        WHERE bi.bundle_id = ${bundle.id} AND e.is_active = TRUE
        ORDER BY bi.sort_order ASC, e.id ASC
      `);
      const ebooks = (itemsRows.rows ?? itemsRows) as any[];
      if (ebooks.length === 0) return { error: `Paket boş: ${it.slug}` };

      const bundlePriceKurus = Math.round(Number(bundle.price_try) * 100);
      const perItemKurus = Math.floor(bundlePriceKurus / ebooks.length);
      const remainder = bundlePriceKurus - perItemKurus * ebooks.length;

      ebooks.forEach((eb, idx) => {
        // Son item'a rounding artığını ekle → toplam paket fiyatı korunur
        const price = idx === ebooks.length - 1 ? perItemKurus + remainder : perItemKurus;
        resolved.push({
          ebookId: Number(eb.id),
          ebookTitle: String(eb.title),
          priceKurus: price,
          bundleId: Number(bundle.id),
          bundleTitle: String(bundle.title),
        });
      });
      subtotalKurus += bundlePriceKurus;
      itemCount += 1;
    }
  }

  return { resolved, subtotalKurus, itemCount };
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
    affiliateCode,
    iyzicoConversationId,
  } = (req.body ?? {}) as any;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "items array boş olamaz" });
  }
  if (!buyerEmail || !iyzicoConversationId) {
    return res.status(400).json({ error: "buyerEmail ve iyzicoConversationId gerekli" });
  }

  try {
    // Items resolve — bundle → ebook satırları
    const r = await resolveCartItems(items);
    if ("error" in r) return res.status(400).json({ error: r.error });

    const { resolved, subtotalKurus, itemCount } = r;

    // Coupon indirimini item'lara pro-rata dağıt
    const discountKurus = Math.max(0, Number(couponDiscountKurus ?? 0));
    const finalKurus = Math.max(0, subtotalKurus - discountKurus);

    // Coupon ID lookup
    let couponId: number | null = null;
    if (couponCode) {
      try {
        const cRows = await db.execute(sql`SELECT id FROM coupons WHERE code = ${couponCode} LIMIT 1`);
        couponId = ((cRows.rows ?? cRows)[0] as any)?.id ?? null;
      } catch {}
    }

    // User ID lookup
    const userRows = await db.execute(sql`
      SELECT id FROM users WHERE LOWER(email) = LOWER(${buyerEmail}) LIMIT 1
    `);
    const userId = (userRows.rows ?? userRows)[0]?.id ?? null;

    // Order_id — conversationId'yi order_id olarak kullan (birebir eşleşir)
    const orderId = iyzicoConversationId;

    // Idempotency: aynı order_id + ebookId satır varsa hiçbir şey yapma (double-submit koruması)
    const existingRows = await db.execute(sql`
      SELECT COUNT(*)::int AS n FROM ebook_purchases WHERE order_id = ${orderId}
    `);
    const alreadyExists = Number(((existingRows.rows ?? existingRows)[0] as any)?.n ?? 0) > 0;
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

    // Her resolved item için pending purchase yaz — aynı order_id + conversationId
    // Coupon indirimi son satıra ekleniyor (tek redemption oluşturmak için)
    const purchaseIds: number[] = [];
    for (let i = 0; i < resolved.length; i++) {
      const item = resolved[i];
      const isLastItem = i === resolved.length - 1;
      const itemCouponDiscount = isLastItem ? discountKurus : 0;
      // Bu ebook için ödenen tutar = base priceKurus - eğer son ise total discount pay
      const paidKurusForThis = Math.max(
        0,
        item.priceKurus - itemCouponDiscount,
      );
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
      `[CART] pre-create: order_id=${orderId} items=${resolved.length} purchase_ids=[${purchaseIds.join(",")}] finalKurus=${finalKurus}`,
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

    // Idempotency guard — bu order zaten aktive edildiyse hemen dön
    const successRows = await db.execute(sql`
      SELECT id, download_token FROM ebook_purchases
      WHERE order_id = ${orderKey} AND payment_status = 'success'
      LIMIT 1
    `);
    if ((successRows.rows ?? successRows).length > 0) {
      console.info(`[CART] activate SKIP (idempotent): order_id=${orderKey} zaten aktif`);
      return res.json({ ok: true, orderId: orderKey, action: "already_active" });
    }

    // order_id ile pending kayıtları bul
    const pendingRows = await db.execute(sql`
      SELECT id, ebook_id, amount_paid, coupon_id, coupon_discount_kurus, buyer_email
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

    const activated: Array<{ id: number; downloadToken: string; ebookId: number }> = [];

    for (const p of pending) {
      const dlToken = crypto.randomBytes(32).toString("base64url");
      await db.execute(sql`
        UPDATE ebook_purchases SET
          payment_status = 'success',
          iyzico_payment_id = ${iyzicoPaymentId ? String(iyzicoPaymentId) : null},
          download_token = ${dlToken},
          download_expires_at = ${expiresAt},
          paid_at = ${paidAtIso},
          updated_at = NOW()
        WHERE id = ${p.id}
      `);
      activated.push({ id: Number(p.id), downloadToken: dlToken, ebookId: Number(p.ebook_id) });

      // Coupon redemption sadece SON kayda ekli olarak yaz
      if (p.coupon_id && p.coupon_discount_kurus) {
        try {
          const originalKurus = Math.round(Number(p.amount_paid) * 100) + Number(p.coupon_discount_kurus);
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

      // Affiliate attribution — her satır için ayrı komisyon
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
    }

    console.info(`[CART] activate: order_id=${orderKey} ${activated.length} satır aktive edildi`);

    // Sepet için toplu mail (fire-and-forget)
    void (async () => {
      try {
        // Order detayları
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

        // Mail attempts artır
        await db.execute(sql`
          UPDATE ebook_purchases SET mail_attempts = mail_attempts + 1, updated_at = NOW()
          WHERE order_id = ${orderKey}
        `);

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
    })();

    // Admin bildirim
    void (async () => {
      try {
        const first = (await db.execute(sql`
          SELECT buyer_email FROM ebook_purchases WHERE order_id = ${orderKey} LIMIT 1
        `)).rows?.[0] as any;
        const totalRows = await db.execute(sql`
          SELECT COALESCE(SUM(amount_paid), 0)::TEXT AS total, COUNT(*)::INT AS n FROM ebook_purchases WHERE order_id = ${orderKey}
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

    return res.json({
      ok: true,
      orderId: orderKey,
      itemCount: activated.length,
      downloadTokens: activated.map((a) => a.downloadToken),
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

    // Sadece success olanları göster (public endpoint güvenliği)
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
