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
