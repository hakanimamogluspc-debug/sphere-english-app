/**
 * E-kitap satın alma yönetimi (admin).
 *
 * Endpoint'ler:
 *   GET    /api/admin/ebook-purchases               → liste (filtreler: status, ebookId, search, dateFrom, dateTo)
 *   GET    /api/admin/ebook-purchases/:id           → tek satın alma detayı
 *   PATCH  /api/admin/ebook-purchases/:id           → fatura bilgisi güncelle (invoice_status, invoice_number, invoice_notes)
 *   GET    /api/admin/ebook-purchases/stats         → özet istatistik (toplam, status'a göre dağılım, son 30 gün)
 */

import { Router, Response } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import crypto from "node:crypto";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth.js";
import { sendPurchaseEmailFireForget } from "./ebook-purchase.js";
import { sendEbookDownloadMail } from "../lib/ebook-mail.js";
import { notifyNewEbookPurchase } from "../lib/admin-notifications.js";

const router = Router();

// ─── İSTATİSTİK ─────────────────────────────────────────────────────────
router.get(
  "/admin/ebook-purchases/stats",
  authMiddleware,
  requireRole("admin"),
  async (_req: AuthRequest, res: Response) => {
    try {
      const rows = await db.execute(sql`
        SELECT
          COUNT(*)::INT AS total,
          COUNT(*) FILTER (WHERE payment_status = 'success')::INT AS success_count,
          COUNT(*) FILTER (WHERE payment_status = 'pending')::INT AS pending_count,
          COUNT(*) FILTER (WHERE payment_status = 'failed')::INT AS failed_count,
          COUNT(*) FILTER (WHERE payment_status = 'success' AND invoice_status = 'pending')::INT AS pending_invoices,
          COUNT(*) FILTER (WHERE payment_status = 'success' AND invoice_status = 'issued')::INT AS issued_invoices,
          COALESCE(SUM(amount_paid) FILTER (WHERE payment_status = 'success'), 0)::NUMERIC AS total_revenue,
          COALESCE(SUM(amount_paid) FILTER (WHERE payment_status = 'success' AND paid_at >= NOW() - INTERVAL '30 days'), 0)::NUMERIC AS revenue_30d
        FROM ebook_purchases
      `);
      const stats = (rows.rows ?? rows)[0] as any;
      return res.json({ stats });
    } catch (e: any) {
      console.error("[admin-ebook-purchases/stats] HATA:", e?.message);
      return res.status(500).json({ error: "İstatistik alınamadı" });
    }
  },
);

// ─── LİSTE ──────────────────────────────────────────────────────────────
router.get(
  "/admin/ebook-purchases",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const status = String(req.query?.status ?? "").trim(); // pending|success|failed|all
      const invoiceStatus = String(req.query?.invoiceStatus ?? "").trim(); // pending|issued|sent|all
      const ebookId = req.query?.ebookId ? parseInt(String(req.query.ebookId), 10) : null;
      const search = String(req.query?.search ?? "").trim().toLowerCase();
      const limit = Math.min(parseInt(String(req.query?.limit ?? "50"), 10) || 50, 200);
      const offset = parseInt(String(req.query?.offset ?? "0"), 10) || 0;

      // WHERE koşullarını dinamik kur
      const conditions: any[] = [];
      if (status && status !== "all") conditions.push(sql`payment_status = ${status}`);
      if (invoiceStatus && invoiceStatus !== "all")
        conditions.push(sql`invoice_status = ${invoiceStatus}`);
      if (ebookId) conditions.push(sql`ebook_id = ${ebookId}`);
      if (search) {
        const like = `%${search}%`;
        conditions.push(sql`(
          LOWER(buyer_email) LIKE ${like}
          OR LOWER(buyer_name) LIKE ${like}
          OR LOWER(COALESCE(company_name, '')) LIKE ${like}
          OR LOWER(COALESCE(invoice_number, '')) LIKE ${like}
        )`);
      }

      const whereClause =
        conditions.length > 0
          ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
          : sql``;

      // ─── Order-level gruplama ────────────────────────────────────────
      // Aynı order_id'ye sahip birden fazla ebook_purchases satırı = 1 sipariş
      // (sepet/bundle satışı). order_id NULL olan eski tekil e-kitap satışları
      // kendi id'siyle unique order olarak sayılır.
      //
      // "order_key" = order_id veya "single-{id}"
      //
      // Toplam: SİPARİŞ sayısı (item değil)

      // Sipariş sayısı için distinct count
      const countRes = await db.execute(sql`
        SELECT COUNT(DISTINCT COALESCE(order_id, 'single-' || id::TEXT))::INT AS total
        FROM ebook_purchases
        ${whereClause}
      `);
      const total = ((countRes.rows ?? countRes)[0] as any)?.total ?? 0;

      // Order-level query — CTE ile filter'lı rows'u al, sonra grupla
      const rows = await db.execute(sql`
        WITH filtered AS (
          SELECT
            p.*,
            e.title AS ebook_title,
            e.slug AS ebook_slug,
            e.cover_image_url AS ebook_cover_url,
            COALESCE(p.order_id, 'single-' || p.id::TEXT) AS order_key
          FROM ebook_purchases p
          LEFT JOIN ebooks e ON e.id = p.ebook_id
          ${whereClause}
        )
        SELECT
          order_key,
          MAX(order_id) AS order_id,
          MIN(id) AS id,
          MIN(id) AS first_purchase_id,
          (array_agg(ebook_id ORDER BY id))[1] AS ebook_id,
          CASE
            WHEN COUNT(*) > 1 THEN 'Sepet: ' || COUNT(*)::TEXT || ' kitap'
            ELSE (array_agg(ebook_title ORDER BY id))[1]
          END AS ebook_title,
          (array_agg(ebook_slug ORDER BY id))[1] AS ebook_slug,
          MAX(bundle_id) AS bundle_id,
          MIN(buyer_email) AS buyer_email,
          MIN(buyer_name) AS buyer_name,
          MIN(buyer_phone) AS buyer_phone,
          MIN(invoice_type) AS invoice_type,
          MIN(tax_id) AS tax_id,
          MIN(tax_office) AS tax_office,
          MIN(company_name) AS company_name,
          MIN(billing_address) AS billing_address,
          MIN(billing_city) AS billing_city,
          MIN(billing_district) AS billing_district,
          MIN(billing_postal_code) AS billing_postal_code,
          -- Payment status: eğer hepsi success ise success, yoksa mixed
          CASE
            WHEN BOOL_AND(payment_status = 'success') THEN 'success'
            WHEN BOOL_AND(payment_status = 'failed') THEN 'failed'
            WHEN BOOL_AND(payment_status = 'pending') THEN 'pending'
            ELSE 'mixed'
          END AS payment_status,
          -- Invoice status: hepsi issued mı
          CASE
            WHEN BOOL_AND(invoice_status = 'issued') THEN 'issued'
            WHEN BOOL_AND(invoice_status = 'sent') THEN 'sent'
            WHEN BOOL_AND(invoice_status = 'pending') THEN 'pending'
            ELSE 'partial'
          END AS invoice_status,
          -- İlk item'ın diğer alanları (detay için)
          (array_agg(invoice_number ORDER BY id))[1] AS invoice_number,
          (array_agg(invoice_issued_at ORDER BY id))[1] AS invoice_issued_at,
          (array_agg(invoice_notes ORDER BY id))[1] AS invoice_notes,
          (array_agg(download_token ORDER BY id))[1] AS download_token,
          (array_agg(download_count ORDER BY id))[1] AS download_count,
          (array_agg(download_expires_at ORDER BY id))[1] AS download_expires_at,
          (array_agg(payment_error ORDER BY id))[1] AS payment_error,
          MAX(iyzico_payment_id) AS iyzico_payment_id,
          MAX(iyzico_conversation_id) AS iyzico_conversation_id,
          -- amount_paid = sepet ise toplam, tek item ise item tutarı
          SUM(amount_paid)::NUMERIC AS amount_paid,
          SUM(amount_paid)::NUMERIC AS total_amount,
          MIN(currency) AS currency,
          COUNT(*)::INT AS item_count,
          MIN(created_at) AS created_at,
          MAX(paid_at) AS paid_at,
          MAX(updated_at) AS updated_at,
          -- Items array — order içindeki tüm kitaplar
          json_agg(json_build_object(
            'id', id,
            'ebook_id', ebook_id,
            'ebook_title', ebook_title,
            'ebook_slug', ebook_slug,
            'ebook_cover_url', ebook_cover_url,
            'amount_paid', amount_paid,
            'currency', currency,
            'download_token', download_token,
            'download_count', download_count,
            'download_expires_at', download_expires_at,
            'invoice_status', invoice_status,
            'invoice_number', invoice_number,
            'invoice_notes', invoice_notes,
            'payment_status', payment_status,
            'payment_error', payment_error,
            'created_at', created_at,
            'paid_at', paid_at
          ) ORDER BY id) AS items
        FROM filtered
        GROUP BY order_key
        ORDER BY MIN(created_at) DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      return res.json({
        orders: rows.rows ?? rows,
        // Geriye uyumluluk — eski clients purchases key'ini bekliyorsa
        // orders'ın flatten'ı yerine boş array gönder (frontend güncelleniyor zaten)
        purchases: rows.rows ?? rows,
        total,
        limit,
        offset,
      });
    } catch (e: any) {
      console.error("[admin-ebook-purchases] HATA:", e?.message);
      return res.status(500).json({ error: "Liste alınamadı: " + e?.message });
    }
  },
);

// ─── CSV EXPORT (fatura kesme için) ────────────────────────────────────
// Item-level satırlar — sepet siparişleri her kitap için ayrı satır (aynı order_id)
router.get(
  "/admin/ebook-purchases/export.csv",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const status = String(req.query?.status ?? "success").trim(); // default: sadece başarılı
      const dateFrom = req.query?.dateFrom ? String(req.query.dateFrom) : null;
      const dateTo = req.query?.dateTo ? String(req.query.dateTo) : null;

      const conditions: any[] = [];
      if (status && status !== "all") conditions.push(sql`payment_status = ${status}`);
      if (dateFrom) conditions.push(sql`created_at >= ${dateFrom}::TIMESTAMPTZ`);
      if (dateTo) conditions.push(sql`created_at <= ${dateTo}::TIMESTAMPTZ`);

      const whereClause =
        conditions.length > 0
          ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
          : sql``;

      const rows = await db.execute(sql`
        SELECT
          p.id,
          p.order_id,
          p.bundle_id,
          p.paid_at,
          p.created_at,
          p.buyer_name,
          p.buyer_email,
          p.buyer_phone,
          p.invoice_type,
          p.tax_id,
          p.tax_office,
          p.company_name,
          p.billing_address,
          p.billing_city,
          p.billing_district,
          p.billing_postal_code,
          p.amount_paid,
          p.currency,
          p.payment_status,
          p.iyzico_payment_id,
          p.iyzico_conversation_id,
          p.invoice_status,
          p.invoice_number,
          p.invoice_issued_at,
          p.invoice_notes,
          e.title AS ebook_title,
          e.slug AS ebook_slug,
          e.author AS ebook_author,
          b.title AS bundle_title
        FROM ebook_purchases p
        LEFT JOIN ebooks e ON e.id = p.ebook_id
        LEFT JOIN ebook_bundles b ON b.id = p.bundle_id
        ${whereClause}
        ORDER BY p.paid_at DESC NULLS LAST, p.created_at DESC
      `);

      const data = (rows.rows ?? rows) as any[];

      // CSV kolonları — Excel'de fatura kesme için tam bilgi
      const headers = [
        "Satın Alma ID",
        "Sipariş No",
        "Ödeme Tarihi",
        "Oluşturma Tarihi",
        "Alıcı Adı",
        "Alıcı E-posta",
        "Alıcı Telefon",
        "Fatura Tipi",
        "TC/VKN",
        "Vergi Dairesi",
        "Firma Adı",
        "Adres",
        "Şehir",
        "İlçe",
        "Posta Kodu",
        "Ürün Adı",
        "Ürün Slug",
        "Yazar",
        "Paket (varsa)",
        "Tutar",
        "Para Birimi",
        "Ödeme Durumu",
        "Iyzico Payment ID",
        "Fatura Durumu",
        "Fatura Numarası",
        "Fatura Kesildi",
        "Fatura Notları",
      ];

      function esc(v: any): string {
        if (v == null) return "";
        const s = String(v);
        // Excel için Türkçe tarih formatı — ISO date yerine dd.MM.yyyy HH:mm
        return `"${s.replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
      }
      function fmtDate(v: any): string {
        if (!v) return "";
        try {
          const d = new Date(v);
          if (isNaN(d.getTime())) return "";
          const dd = String(d.getDate()).padStart(2, "0");
          const mm = String(d.getMonth() + 1).padStart(2, "0");
          const yyyy = d.getFullYear();
          const hh = String(d.getHours()).padStart(2, "0");
          const mi = String(d.getMinutes()).padStart(2, "0");
          return `${dd}.${mm}.${yyyy} ${hh}:${mi}`;
        } catch {
          return "";
        }
      }
      function fmtInvoiceType(t: any): string {
        if (t === "corporate") return "Kurumsal";
        if (t === "individual") return "Bireysel";
        return t || "";
      }
      function fmtPaymentStatus(s: any): string {
        return { success: "Başarılı", pending: "Beklemede", failed: "Başarısız", expired: "Süresi Doldu" }[s as string] ?? String(s ?? "");
      }
      function fmtInvoiceStatus(s: any): string {
        return { pending: "Kesilmedi", issued: "Kesildi", sent: "Gönderildi", cancelled: "İptal" }[s as string] ?? String(s ?? "");
      }
      function fmtAmount(v: any): string {
        if (v == null) return "";
        const n = typeof v === "string" ? parseFloat(v) : Number(v);
        if (!Number.isFinite(n)) return "";
        // Excel Türkçe locale için virgüllü decimal
        return n.toFixed(2).replace(".", ",");
      }

      const lines: string[] = [];
      // Header
      lines.push(headers.map(esc).join(";"));

      for (const r of data) {
        lines.push([
          r.id,
          r.order_id ?? "",
          fmtDate(r.paid_at),
          fmtDate(r.created_at),
          r.buyer_name ?? "",
          r.buyer_email ?? "",
          r.buyer_phone ?? "",
          fmtInvoiceType(r.invoice_type),
          r.tax_id ?? "",
          r.tax_office ?? "",
          r.company_name ?? "",
          r.billing_address ?? "",
          r.billing_city ?? "",
          r.billing_district ?? "",
          r.billing_postal_code ?? "",
          r.ebook_title ?? "",
          r.ebook_slug ?? "",
          r.ebook_author ?? "",
          r.bundle_title ?? "",
          fmtAmount(r.amount_paid),
          r.currency ?? "TRY",
          fmtPaymentStatus(r.payment_status),
          r.iyzico_payment_id ?? "",
          fmtInvoiceStatus(r.invoice_status),
          r.invoice_number ?? "",
          fmtDate(r.invoice_issued_at),
          r.invoice_notes ?? "",
        ].map(esc).join(";"));
      }

      const csv = lines.join("\n");
      // UTF-8 BOM — Excel Türkçe karakterleri doğru gösterir
      const bom = "﻿";

      const filename = `sphere-e-kitap-satislari-${new Date().toISOString().slice(0, 10)}.csv`;
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Cache-Control", "no-store");
      return res.send(bom + csv);
    } catch (e: any) {
      console.error("[admin-ebook-purchases/export.csv] HATA:", e?.message);
      return res.status(500).send("Export başarısız: " + e?.message);
    }
  },
);

// ─── TEK SATIN ALMA DETAYI ──────────────────────────────────────────────
router.get(
  "/admin/ebook-purchases/:id",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id ?? "", 10);
    if (!id) return res.status(400).json({ error: "id geçersiz" });

    try {
      const rows = await db.execute(sql`
        SELECT
          p.*,
          e.title AS ebook_title, e.slug AS ebook_slug, e.author AS ebook_author
        FROM ebook_purchases p
        LEFT JOIN ebooks e ON e.id = p.ebook_id
        WHERE p.id = ${id}
        LIMIT 1
      `);
      const purchase = (rows.rows ?? rows)[0] as any;
      if (!purchase) return res.status(404).json({ error: "Satın alma bulunamadı" });

      return res.json({ purchase });
    } catch (e: any) {
      console.error("[admin-ebook-purchases/:id] HATA:", e?.message);
      return res.status(500).json({ error: "Detay alınamadı" });
    }
  },
);

// ─── FATURA BİLGİSİNİ GÜNCELLE ──────────────────────────────────────────
router.patch(
  "/admin/ebook-purchases/:id",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id ?? "", 10);
    if (!id) return res.status(400).json({ error: "id geçersiz" });

    const {
      invoiceStatus,
      invoiceNumber,
      invoiceNotes,
      invoiceIssuedAt,
    } = (req.body ?? {}) as any;

    const validStatuses = ["pending", "issued", "sent", "cancelled"];
    if (invoiceStatus && !validStatuses.includes(invoiceStatus)) {
      return res.status(400).json({ error: "Geçersiz invoiceStatus" });
    }

    try {
      // Otomatik invoice_issued_at: status 'issued'/'sent' olduğunda set et
      let issuedAtSql = sql`invoice_issued_at`;
      if (invoiceIssuedAt) {
        issuedAtSql = sql`${String(invoiceIssuedAt)}::TIMESTAMPTZ`;
      } else if (invoiceStatus === "issued" || invoiceStatus === "sent") {
        issuedAtSql = sql`COALESCE(invoice_issued_at, NOW())`;
      }

      // Conditional SET — COALESCE(NULL param, col) Postgres'te tip belirleyemiyor
      const sets: any[] = [];
      if (invoiceStatus) sets.push(sql`invoice_status = ${String(invoiceStatus)}`);
      if (invoiceNumber !== undefined && invoiceNumber !== null)
        sets.push(sql`invoice_number = ${String(invoiceNumber)}`);
      if (invoiceNotes !== undefined && invoiceNotes !== null)
        sets.push(sql`invoice_notes = ${String(invoiceNotes)}`);
      sets.push(sql`invoice_issued_at = ${issuedAtSql}`);
      sets.push(sql`updated_at = NOW()`);

      await db.execute(sql`
        UPDATE ebook_purchases SET ${sql.join(sets, sql`, `)}
        WHERE id = ${id}
      `);

      const rows = await db.execute(sql`
        SELECT * FROM ebook_purchases WHERE id = ${id} LIMIT 1
      `);
      const purchase = (rows.rows ?? rows)[0];

      console.info(`[admin-ebook-purchases] Updated id=${id} invoiceStatus=${invoiceStatus}`);
      return res.json({ purchase });
    } catch (e: any) {
      console.error("[admin-ebook-purchases PATCH] HATA:", e?.message);
      return res.status(500).json({ error: "Güncelleme başarısız: " + e?.message });
    }
  },
);

// ─── TEST MAİL GÖNDER ───────────────────────────────────────────────────
// Admin'in mail adresine örnek bir e-kitap teslimat mail'i gönderir.
// SMTP/Resend yapılandırmasını ve template'i hızlıca doğrulamak için.
router.post(
  "/admin/ebook-purchases/test-email",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    const toEmail = String((req.body as any)?.email ?? "").trim().toLowerCase()
      || (req.user as any)?.email
      || "";
    if (!toEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(toEmail)) {
      return res.status(400).json({ error: "Geçerli alıcı e-postası gerekli" });
    }

    try {
      // Veritabanından gerçek bir kitap çekelim (varsa) — template'i gerçekçi göstermek için
      const ebookRows = await db.execute(sql`
        SELECT title, author, price_try FROM ebooks WHERE is_active = TRUE
        ORDER BY is_featured DESC, published_at DESC LIMIT 1
      `);
      const e = (ebookRows.rows ?? ebookRows)[0] as any;

      // Sahte ama görsel olarak gerçekçi token (kullanılmayacak — sadece görüntü)
      const fakeToken = "TEST_" + Math.random().toString(36).slice(2, 18);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const result = await sendEbookDownloadMail({
        buyerEmail: toEmail,
        buyerName: "Test Admin",
        ebookTitle: e?.title ?? "Kurumsal İletişim & Toplantılar",
        ebookAuthor: e?.author ?? "Didem İmamoğlu",
        amountPaid: e?.price_try ?? 199,
        currency: "TRY",
        downloadToken: fakeToken,
        downloadExpiresAt: expiresAt,
        invoiceType: "individual",
      });

      if (result.ok) {
        console.info(`[admin/test-email] Test mail gönderildi: ${toEmail}`);
        return res.json({
          ok: true,
          to: toEmail,
          message: `Test mail gönderildi. Mail kutunu kontrol et: ${toEmail}`,
        });
      }
      return res.status(502).json({
        error: result.error ?? "Mail gönderilemedi",
        hint: "RESEND_API_KEY veya SMTP_HOST/USER/PASS env'lerini kontrol et",
      });
    } catch (e: any) {
      console.error("[admin/test-email] HATA:", e?.message);
      return res.status(500).json({ error: "Test mail başarısız: " + e?.message });
    }
  },
);

// ─── MAİL YENİDEN GÖNDER ─────────────────────────────────────────────────
router.post(
  "/admin/ebook-purchases/:id/resend-email",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id ?? "", 10);
    if (!id) return res.status(400).json({ error: "id geçersiz" });

    try {
      // Önce satın almayı doğrula
      const rows = await db.execute(sql`
        SELECT id, payment_status, download_token, buyer_email
        FROM ebook_purchases WHERE id = ${id} LIMIT 1
      `);
      const purchase = (rows.rows ?? rows)[0] as any;
      if (!purchase) return res.status(404).json({ error: "Satın alma bulunamadı" });
      if (purchase.payment_status !== "success") {
        return res
          .status(400)
          .json({ error: `Mail gönderilemez — ödeme durumu '${purchase.payment_status}'` });
      }
      if (!purchase.download_token) {
        return res.status(400).json({ error: "İndirme token'ı yok" });
      }

      // Mail'i bekleyerek gönder (admin manuel tetikledi, sonucu görsün)
      // sendPurchaseEmailFireForget kendi içinde mail_status'u günceller
      await sendPurchaseEmailFireForget(id);

      // Admin'lere de bildirim gönder (eğer ilk satışta gitmemişse)
      try {
        const titleRows = await db.execute(sql`
          SELECT e.title, ep.amount_paid FROM ebook_purchases ep
          JOIN ebooks e ON ep.ebook_id = e.id
          WHERE ep.id = ${id} LIMIT 1
        `);
        const r = (titleRows.rows ?? titleRows)[0] as any;
        if (r) {
          await notifyNewEbookPurchase({
            purchaseId: id,
            buyerEmail: purchase.buyer_email,
            ebookTitle: String(r.title ?? "E-kitap"),
            amountTl: Number(r.amount_paid ?? 0),
          });
          console.info(`[admin-ebook-purchases/resend-email] Admin bildirim de gönderildi (id=${id})`);
        }
      } catch (notifyErr: any) {
        console.error("[admin-ebook-purchases/resend-email] admin notify HATA:", notifyErr?.message);
      }

      // Güncel durumu döndür
      const updatedRows = await db.execute(sql`
        SELECT mail_status, mail_sent_at, mail_error, mail_attempts
        FROM ebook_purchases WHERE id = ${id} LIMIT 1
      `);
      const status = (updatedRows.rows ?? updatedRows)[0] as any;

      if (status?.mail_status === "sent") {
        return res.json({
          ok: true,
          mailSentAt: status.mail_sent_at,
          mailAttempts: status.mail_attempts,
          to: purchase.buyer_email,
        });
      }
      return res.status(502).json({
        error: status?.mail_error ?? "Mail gönderilemedi (detay log'da)",
        mailAttempts: status?.mail_attempts,
      });
    } catch (e: any) {
      console.error("[admin-ebook-purchases/resend-email] HATA:", e?.message);
      return res.status(500).json({ error: "Mail gönderilemedi: " + e?.message });
    }
  },
);

/**
 * Manuel aktive et (kurtarma) — pending kayıtları success'e çevirir,
 * download token üretir, müşteriye mail atar, admin bildirim gönderir.
 *
 * Activate callback fail olduğunda veya başka manuel müdahale gerektiğinde
 * kullanılır. Sadece pending status için çalışır (idempotency: success ise reddet).
 *
 * Endpoint: POST /api/admin/ebook-purchases/:id/manual-activate
 */
router.post(
  "/admin/ebook-purchases/:id/manual-activate",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id ?? "", 10);
    if (!id) return res.status(400).json({ error: "id geçersiz" });

    try {
      const rows = await db.execute(sql`
        SELECT id, payment_status, download_token, buyer_email, ebook_id, amount_paid, paid_at, notes
        FROM ebook_purchases WHERE id = ${id} LIMIT 1
      `);
      const purchase = (rows.rows ?? rows)[0] as any;
      if (!purchase) return res.status(404).json({ error: "Satın alma bulunamadı" });
      if (purchase.payment_status === "success") {
        return res.status(400).json({
          error: "Bu satış zaten 'success' durumunda. Mail göndermek için 'Mail Yeniden Gönder' butonunu kullan.",
        });
      }
      if (purchase.payment_status === "failed") {
        return res.status(400).json({
          error: "Bu satış 'failed' durumda. Önce status'ü düzelt veya yeni bir satış oluştur.",
        });
      }

      // download_token yoksa üret
      const newToken = purchase.download_token || crypto.randomBytes(32).toString("base64url");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const paidAtIso = new Date().toISOString();

      // Mevcut paid_at'i çek (COALESCE param bug'ı önlemek için JS tarafında)
      const existingPaidAt = (purchase as any).paid_at;
      const finalPaidAtIso = existingPaidAt ? new Date(existingPaidAt).toISOString() : paidAtIso;

      // Audit notu (mevcut notes'a ekle, JS tarafında concat)
      const adminId = req.userId ?? 0;
      const auditNote = ` [MANUEL AKTIVE: admin ${adminId} / ${new Date().toISOString()}]`;
      const existingNotes = (purchase as any).notes ?? "";
      const newNotes = `${existingNotes}${auditNote}`;

      // Pending → success + token + expire + paid_at — tüm parametreler typed
      await db.execute(sql`
        UPDATE ebook_purchases SET
          payment_status = 'success',
          download_token = ${newToken},
          download_expires_at = ${expiresAt}::TIMESTAMPTZ,
          paid_at = ${finalPaidAtIso}::TIMESTAMPTZ,
          updated_at = NOW(),
          notes = ${newNotes}
        WHERE id = ${id}
      `);

      console.info(`[admin-ebook-purchases/manual-activate] id=${id} success'e çevrildi (admin=${adminId})`);

      // Müşteriye PDF mail gönder
      try {
        await sendPurchaseEmailFireForget(id);
      } catch (mailErr: any) {
        console.error("[admin-ebook-purchases/manual-activate] mail HATA:", mailErr?.message);
      }

      // Admin'lere yeni satış bildirimi
      try {
        const titleRows = await db.execute(sql`
          SELECT title FROM ebooks WHERE id = ${purchase.ebook_id} LIMIT 1
        `);
        const title = (titleRows.rows ?? titleRows)[0]?.title ?? "E-kitap";
        await notifyNewEbookPurchase({
          purchaseId: id,
          buyerEmail: purchase.buyer_email,
          ebookTitle: String(title),
          amountTl: Number(purchase.amount_paid ?? 0),
        });
      } catch (notifyErr: any) {
        console.error("[admin-ebook-purchases/manual-activate] notify HATA:", notifyErr?.message);
      }

      // Güncel durumu döndür
      const updatedRows = await db.execute(sql`
        SELECT payment_status, download_token, download_expires_at,
               mail_status, mail_sent_at, mail_error
        FROM ebook_purchases WHERE id = ${id} LIMIT 1
      `);
      const updated = (updatedRows.rows ?? updatedRows)[0] as any;

      return res.json({
        ok: true,
        message: "Satın alma başarıyla aktive edildi. Müşteriye mail gönderildi.",
        purchase: {
          id,
          paymentStatus: updated?.payment_status,
          downloadToken: updated?.download_token,
          downloadExpiresAt: updated?.download_expires_at,
          mailStatus: updated?.mail_status,
          mailSentAt: updated?.mail_sent_at,
          mailError: updated?.mail_error,
        },
      });
    } catch (e: any) {
      console.error("[admin-ebook-purchases/manual-activate] HATA:", e?.message);
      return res.status(500).json({ error: "Aktive edilemedi: " + e?.message });
    }
  },
);

export default router;
