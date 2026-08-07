/**
 * Admin — Fatura yönetimi.
 *
 * Endpoint'ler:
 *   GET  /admin/invoices/health          → Luca bağlantı + credentials testi
 *   POST /admin/invoices/lookup-taxpayer → VKN mükellef sorgu
 *   POST /admin/invoices/issue-test      → Test faturası kes (dummy verilerle)
 *   GET  /admin/invoices                 → Fatura listesi
 *   GET  /admin/invoices/:id             → Fatura detay
 *   POST /admin/invoices/:id/refresh-viewer  → Viewer URL yenile
 *   POST /admin/invoices/:id/cancel      → E-Arşiv iptal
 *   POST /admin/invoices/:id/retry       → Failed olan faturayı tekrar dene
 */

import { Router, Request, Response } from "express";
import { sql, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { authMiddleware } from "../middlewares/auth.js";
import {
  invoiceHealthCheck,
  lookupTaxPayer,
  issueInvoiceForSource,
  refreshViewerUrl,
  cancelInvoice,
} from "../lib/invoice/index.js";

const router = Router();

async function requireAdmin(req: Request, res: Response, next: () => void) {
  const userId = (req as any).userId as number;
  const [me] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!me || me.role !== "admin") return res.status(403).json({ error: "Admin yetkisi gerekli" });
  next();
}

// ─── GET /admin/invoices/health ────────────────────────────────────────
router.get(
  "/admin/invoices/health",
  authMiddleware,
  requireAdmin,
  async (_req: Request, res: Response) => {
    try {
      const r = await invoiceHealthCheck();
      // Debug: env'de ne var göster (şifre hariç ama uzunluk ve ilk/son char)
      const pwd = process.env.LUCA_USER_PASSWORD ?? "";
      const pwdInfo = pwd
        ? `len=${pwd.length}, first=${JSON.stringify(pwd[0])}, last=${JSON.stringify(pwd[pwd.length - 1])}, hasTrailingSpace=${pwd !== pwd.trimEnd()}, hasLeadingSpace=${pwd !== pwd.trimStart()}`
        : "MISSING";
      return res.json({
        ok: r.ok,
        message: r.message,
        provider: "luca",
        env: process.env.LUCA_ENV ?? "test",
        companyTaxCode: process.env.LUCA_COMPANY_TAX_CODE ?? "-",
        userTaxCode: process.env.LUCA_USER_TAX_CODE ?? "-",
        passwordInfo: pwdInfo,
      });
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: e?.message });
    }
  },
);

// ─── POST /admin/invoices/validate-manual ────────────────────────────
// Debug: env bypass — credentials'ı direkt gönderip test et
router.post(
  "/admin/invoices/validate-manual",
  authMiddleware,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { companyTaxCode, userTaxCode, userPassword, env, companyVendorNumber } = (req.body ?? {}) as any;
      if (!companyTaxCode || !userTaxCode || !userPassword) {
        return res.status(400).json({ error: "companyTaxCode, userTaxCode, userPassword gerekli" });
      }

      const region = env === "prod" ? "einvoiceserviceturmob.luca.com.tr" : "einvoiceserviceturmobtest.luca.com.tr";
      const url = `https://${region}/InvoiceService/ServiceContract/InvoiceService.svc`;

      const xmlEscape = (s: string) =>
        String(s)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&apos;");

      const envelope = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/" xmlns:ein="http://schemas.datacontract.org/2004/07/EInvoice.Service.Model">
  <soapenv:Header/>
  <soapenv:Body>
    <tem:ValidateUserCompany>
      <tem:request>
        <ein:CompanyTaxCode>${xmlEscape(companyTaxCode)}</ein:CompanyTaxCode>
        <ein:CompanyVendorNumber></ein:CompanyVendorNumber>
        <ein:UserPassword>${xmlEscape(userPassword)}</ein:UserPassword>
        <ein:UserTaxCode>${xmlEscape(userTaxCode)}</ein:UserTaxCode>
      </tem:request>
    </tem:ValidateUserCompany>
  </soapenv:Body>
</soapenv:Envelope>`;

      const r = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          SOAPAction: `"http://tempuri.org/IInvoiceService/ValidateUserCompany"`,
        },
        body: envelope,
      });
      const text = await r.text();

      return res.json({
        httpStatus: r.status,
        // İlk 2000 karakter — response yapısını görelim
        responseSnippet: text.slice(0, 2000),
        sentCredentials: {
          companyTaxCode,
          userTaxCode,
          passwordLen: userPassword.length,
          env: env ?? "test",
        },
      });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message });
    }
  },
);

// ─── POST /admin/invoices/lookup-taxpayer ─────────────────────────────
router.post(
  "/admin/invoices/lookup-taxpayer",
  authMiddleware,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const taxCode = String(req.body?.taxCode ?? "").replace(/\D/g, "");
      if (!/^\d{10,11}$/.test(taxCode)) {
        return res.status(400).json({ error: "10 haneli VKN veya 11 haneli TCKN girin" });
      }
      const r = await lookupTaxPayer(taxCode);
      if (!r) {
        return res.json({
          ok: false,
          isRegistered: false,
          postboxes: [],
          message: "Servis yanıt vermedi veya kayıt yok",
        });
      }
      return res.json({
        ok: true,
        isRegistered: r.isRegistered,
        postboxes: r.postboxes,
        title: r.title,
        recommendation: r.isRegistered
          ? "e-Fatura kesilecek — ReceiverInboxTag olarak ilk postbox kullanılabilir"
          : "e-Arşiv kesilecek — bu VKN e-Fatura mükellefi değil",
      });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message });
    }
  },
);

// ─── POST /admin/invoices/issue-test ──────────────────────────────────
// Test amaçlı — gerçek satış olmadan bir dummy fatura kes
router.post(
  "/admin/invoices/issue-test",
  authMiddleware,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const {
        buyerType = "individual", // 'individual' | 'corporate'
        buyerEmail = "test@sphereenglish.com",
        buyerName = "Test Kullanıcı",
        buyerTaxId = "11111111111",
        buyerReceiverInboxTag,
        buyerAddress = "Test Adres Mahallesi, Test Sokak No:1",
        buyerCity = "İstanbul",
        buyerDistrict = "Şişli",
        productName = "Sphere English Test E-Kitap",
        priceKurus = 19900, // 199 TL
        vatRate = 20,
      } = (req.body ?? {}) as any;

      // Unique source id — aynı test tekrar çalışırsa idempotency devreye girmesin
      const testSourceId = Date.now();

      const r = await issueInvoiceForSource({
        source: {
          type: "manual",
          id: testSourceId,
          orderId: `TEST-${testSourceId}`,
        },
        buyer: {
          email: buyerEmail,
          name: buyerName,
          type: buyerType === "corporate" ? "corporate" : "individual",
          taxId: buyerTaxId,
          companyName: buyerType === "corporate" ? buyerName : undefined,
          receiverInboxTag: buyerReceiverInboxTag,
          address: buyerAddress,
          city: buyerCity,
          district: buyerDistrict,
          country: "Türkiye",
        },
        lineItems: [
          {
            productCode: "test-ebook-01",
            productName,
            quantity: 1,
            unitPriceKurus: priceKurus,
            vatRate,
            note: "Test faturası — Sphere English Admin Panel",
          },
        ],
        notes: [
          "Bu bir TEST faturasıdır (Luca test ortamı).",
          "Gerçek satın alma değildir.",
        ],
        paymentReference: `test-${testSourceId}`,
        sendMailAutomatically: false, // Test'te otomatik mail atma
      });

      return res.json(r);
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: e?.message, stack: e?.stack?.slice(0, 500) });
    }
  },
);

// ─── POST /admin/invoices/issue-for-purchase ─────────────────────────
// Manuel fatura kesme — mevcut bir satın alma için
// Body: { purchaseId: N } veya { orderId: "cart_..." }
// - purchaseId verilirse ve o purchase'ın order_id'si varsa → tüm order için tek fatura
// - purchaseId verilirse ve order_id yoksa → sadece o purchase için tek fatura
// - orderId verilirse → tüm order için tek fatura
router.post(
  "/admin/invoices/issue-for-purchase",
  authMiddleware,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { purchaseId, orderId } = (req.body ?? {}) as any;
      if (!purchaseId && !orderId) {
        return res.status(400).json({ error: "purchaseId veya orderId gerekli" });
      }

      // İlgili tüm satın alma satırlarını çek
      let purchaseRows: any[];
      if (orderId) {
        const r = await db.execute(sql`
          SELECT p.*, e.title AS ebook_title, e.slug AS ebook_slug,
                 b.title AS bundle_title
          FROM ebook_purchases p
          LEFT JOIN ebooks e ON e.id = p.ebook_id
          LEFT JOIN ebook_bundles b ON b.id = p.bundle_id
          WHERE p.order_id = ${orderId} AND p.payment_status = 'success'
          ORDER BY p.id
        `);
        purchaseRows = (r.rows ?? r) as any[];
      } else {
        // purchaseId ile başla — order_id varsa tüm order'ı çek
        const first = await db.execute(sql`
          SELECT p.*, e.title AS ebook_title, e.slug AS ebook_slug,
                 b.title AS bundle_title
          FROM ebook_purchases p
          LEFT JOIN ebooks e ON e.id = p.ebook_id
          LEFT JOIN ebook_bundles b ON b.id = p.bundle_id
          WHERE p.id = ${parseInt(String(purchaseId), 10)}
          LIMIT 1
        `);
        const p0 = ((first.rows ?? first) as any[])[0];
        if (!p0) return res.status(404).json({ error: "Satın alma bulunamadı" });
        if (p0.payment_status !== "success") {
          return res.status(400).json({ error: `Sadece başarılı ödemeler için fatura kesilebilir (mevcut: ${p0.payment_status})` });
        }
        if (p0.order_id) {
          // Sepet siparişiyse — tüm order'ı topla
          const r = await db.execute(sql`
            SELECT p.*, e.title AS ebook_title, e.slug AS ebook_slug,
                   b.title AS bundle_title
            FROM ebook_purchases p
            LEFT JOIN ebooks e ON e.id = p.ebook_id
            LEFT JOIN ebook_bundles b ON b.id = p.bundle_id
            WHERE p.order_id = ${p0.order_id} AND p.payment_status = 'success'
            ORDER BY p.id
          `);
          purchaseRows = (r.rows ?? r) as any[];
        } else {
          purchaseRows = [p0];
        }
      }

      if (purchaseRows.length === 0) {
        return res.status(404).json({ error: "Faturalanacak satın alma bulunamadı" });
      }

      const first = purchaseRows[0];
      const orderKey = first.order_id || `single-${first.id}`;

      // Buyer bilgileri — ilk satırdan (hepsinde aynı olmalı order için)
      const buyer = {
        email: first.buyer_email,
        name: first.buyer_name || first.buyer_email,
        type: (first.invoice_type === "corporate" ? "corporate" : "individual") as "individual" | "corporate",
        taxId: first.tax_id ?? undefined,
        taxOffice: first.tax_office ?? undefined,
        companyName: first.company_name ?? undefined,
        receiverInboxTag: undefined, // e-Fatura için VKN lookup lazım — şimdilik e-Arşiv
        address: first.billing_address ?? undefined,
        city: first.billing_city ?? undefined,
        district: first.billing_district ?? undefined,
        postalCode: first.billing_postal_code ?? undefined,
        country: "Türkiye",
        phone: first.buyer_phone ?? undefined,
      };

      // Line items — her purchase satırı bir line item
      const lineItems = purchaseRows.map((p) => {
        const amountTL = typeof p.amount_paid === "string" ? parseFloat(p.amount_paid) : Number(p.amount_paid ?? 0);
        // KDV %20 dahil fiyat → çıkart (KDV hariç = amount / 1.20)
        const grossKurus = Math.round(amountTL * 100);
        const vatRate = 20;
        const unitPriceKurus = Math.round(grossKurus / (1 + vatRate / 100));
        const productCode = p.bundle_id
          ? `bundle-${p.bundle_id}-ebook-${p.ebook_id}`
          : `ebook-${p.ebook_id}`;
        const productName = p.bundle_title
          ? `${p.bundle_title} — ${p.ebook_title ?? "E-Kitap"}`
          : (p.ebook_title ?? `E-Kitap #${p.ebook_id}`);
        return {
          productCode,
          productName,
          quantity: 1,
          unitPriceKurus,
          vatRate,
        };
      });

      // Source: order-level ise ebook_cart, tek ise ebook
      const sourceType = purchaseRows.length > 1 || first.order_id ? "ebook_cart" : "ebook";
      // source_id: order_id varsa order_id hash (int'e sığdır), yoksa purchase.id
      // Idempotency için tutarlı olmalı — order_id string, integer'a çevir
      let sourceId: number;
      if (first.order_id) {
        // Order_id'yi deterministic bir int'e çevir (hash)
        let hash = 0;
        for (const ch of String(first.order_id)) {
          hash = ((hash * 31) + ch.charCodeAt(0)) | 0;
        }
        sourceId = Math.abs(hash);
      } else {
        sourceId = first.id;
      }

      const result = await issueInvoiceForSource({
        source: {
          type: sourceType as any,
          id: sourceId,
          orderId: first.order_id ?? String(first.id),
        },
        buyer,
        lineItems,
        notes: [`Manuel fatura — ${orderKey}`],
        sendMailAutomatically: true,
      });

      return res.json({
        ...result,
        purchaseCount: purchaseRows.length,
        orderKey,
      });
    } catch (e: any) {
      const details = {
        message: e?.message,
        detail: e?.detail,
        hint: e?.hint,
        code: e?.code,
        constraint: e?.constraint,
        table: e?.table,
        column: e?.column,
        dataType: e?.dataType,
        routine: e?.routine,
        where: e?.where,
      };
      console.error("[admin-invoices/issue-for-purchase] HATA DETAY:", details);
      // Kısa özet mesajı Postgres kodu + detail ile
      const shortMsg = [
        e?.code ? `[${e.code}]` : null,
        e?.message?.split("\n")[0] || "Bilinmeyen hata",
        e?.detail ? `→ ${e.detail}` : null,
        e?.column ? `(kolon: ${e.column})` : null,
      ].filter(Boolean).join(" ");
      return res.status(500).json({ ok: false, error: shortMsg, details });
    }
  },
);

// ─── GET /admin/invoices/unbilled — fatura kesilmemiş satın almalar ──
// Prod env'de fatura kaydı olmayan başarılı satın almalar
router.get(
  "/admin/invoices/unbilled",
  authMiddleware,
  requireAdmin,
  async (_req: Request, res: Response) => {
    try {
      const env = process.env.LUCA_ENV === "prod" ? "prod" : "test";
      // Order bazlı grupla: fatura kesilmemişleri getir
      const rows = await db.execute(sql`
        WITH order_groups AS (
          SELECT
            COALESCE(order_id, 'single-' || id::TEXT) AS order_key,
            MAX(order_id) AS order_id,
            MIN(id) AS first_id,
            MIN(buyer_email) AS buyer_email,
            MIN(buyer_name) AS buyer_name,
            MIN(invoice_type) AS invoice_type,
            MIN(tax_id) AS tax_id,
            MIN(company_name) AS company_name,
            SUM(amount_paid)::NUMERIC AS total_amount,
            MIN(currency) AS currency,
            COUNT(*)::INT AS item_count,
            MIN(created_at) AS created_at,
            MAX(paid_at) AS paid_at
          FROM ebook_purchases
          WHERE payment_status = 'success'
          GROUP BY COALESCE(order_id, 'single-' || id::TEXT)
        )
        SELECT og.*
        FROM order_groups og
        WHERE NOT EXISTS (
          SELECT 1 FROM invoices i
          WHERE i.env = ${env}
            AND i.status IN ('sent', 'pending')
            AND (
              (og.order_id IS NOT NULL AND i.source_type = 'ebook_cart' AND i.order_id = og.order_id)
              OR (og.order_id IS NULL AND i.source_type = 'ebook' AND i.source_id = og.first_id)
            )
        )
        ORDER BY og.paid_at DESC NULLS LAST, og.created_at DESC
        LIMIT 500
      `);
      return res.json({ orders: rows.rows ?? rows, env });
    } catch (e: any) {
      console.error("[admin-invoices/unbilled] HATA:", e?.message);
      return res.status(500).json({ error: e?.message });
    }
  },
);

// ─── GET /admin/invoices ──────────────────────────────────────────────
router.get(
  "/admin/invoices",
  authMiddleware,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const limit = Math.min(200, parseInt(String(req.query.limit ?? "50"), 10) || 50);
      const status = req.query.status ? String(req.query.status) : null;
      const sourceType = req.query.source_type ? String(req.query.source_type) : null;

      const rows = await db.execute(sql`
        SELECT id, provider, env, invoice_type, ettn, external_invoice_code,
               invoice_date, source_type, source_id, order_id,
               buyer_email, buyer_name, buyer_type, buyer_tax_id,
               total_kurus, currency, status, attempts, last_error,
               viewer_url, sent_at, created_at
        FROM invoices
        WHERE 1=1
          ${status ? sql`AND status = ${status}` : sql``}
          ${sourceType ? sql`AND source_type = ${sourceType}` : sql``}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `);
      return res.json({ invoices: (rows.rows ?? rows) as any[] });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message });
    }
  },
);

// ─── GET /admin/invoices/:id ─────────────────────────────────────────
router.get(
  "/admin/invoices/:id",
  authMiddleware,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const id = parseInt(String(req.params.id ?? ""), 10);
      if (!Number.isFinite(id)) return res.status(400).json({ error: "Geçersiz id" });

      const rows = await db.execute(sql`SELECT * FROM invoices WHERE id = ${id} LIMIT 1`);
      const row = (rows.rows ?? rows)[0];
      if (!row) return res.status(404).json({ error: "Fatura bulunamadı" });
      return res.json({ invoice: row });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message });
    }
  },
);

// ─── POST /admin/invoices/:id/refresh-viewer ─────────────────────────
router.post(
  "/admin/invoices/:id/refresh-viewer",
  authMiddleware,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const id = parseInt(String(req.params.id ?? ""), 10);
      const r = await refreshViewerUrl(id);
      if (!r) return res.status(404).json({ error: "Viewer alınamadı" });
      return res.json({ ok: true, ...r });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message });
    }
  },
);

// ─── POST /admin/invoices/:id/cancel ─────────────────────────────────
router.post(
  "/admin/invoices/:id/cancel",
  authMiddleware,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const id = parseInt(String(req.params.id ?? ""), 10);
      const reason = String(req.body?.reason ?? "İade / iptal").slice(0, 200);
      const r = await cancelInvoice(id, reason);
      return res.json(r);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message });
    }
  },
);

// ─── POST /admin/invoices/:id/retry ──────────────────────────────────
// Failed fatura → aynı buyer/items ile tekrar dene (yeni satır INSERT, eski failed kalır)
router.post(
  "/admin/invoices/:id/retry",
  authMiddleware,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const id = parseInt(String(req.params.id ?? ""), 10);
      const rows = await db.execute(sql`SELECT * FROM invoices WHERE id = ${id} LIMIT 1`);
      const row = (rows.rows ?? rows)[0] as any;
      if (!row) return res.status(404).json({ error: "Fatura bulunamadı" });
      if (row.status !== "failed") {
        return res.status(400).json({ error: `Sadece failed faturalar retry edilebilir (mevcut: ${row.status})` });
      }

      const lineItems = typeof row.line_items === "string" ? JSON.parse(row.line_items) : row.line_items;

      // Retry — yeni source_id ekle ki idempotency guard'ı geçmesin (failed olduğu için zaten geçer)
      // Ama source için eski kaydı archive'lamak istersen manuel status='canceled' yapabilirsin
      const r = await issueInvoiceForSource({
        source: {
          type: row.source_type,
          id: row.source_id,
          orderId: row.order_id ?? undefined,
        },
        buyer: {
          email: row.buyer_email,
          name: row.buyer_name,
          type: row.buyer_type,
          taxId: row.buyer_tax_id ?? undefined,
          taxOffice: row.buyer_tax_office ?? undefined,
          companyName: row.buyer_company_name ?? undefined,
          receiverInboxTag: row.buyer_receiver_inbox_tag ?? undefined,
          address: row.buyer_address ?? undefined,
          city: row.buyer_city ?? undefined,
          district: row.buyer_district ?? undefined,
          country: row.buyer_country ?? "Türkiye",
        },
        lineItems,
        sendMailAutomatically: false,
      });

      return res.json(r);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message });
    }
  },
);

export default router;
