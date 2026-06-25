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
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth.js";
import { sendPurchaseEmailFireForget } from "./ebook-purchase.js";

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

      // Toplam sayım
      const countRes = await db.execute(
        sql`SELECT COUNT(*)::INT AS total FROM ebook_purchases ${whereClause}`,
      );
      const total = ((countRes.rows ?? countRes)[0] as any)?.total ?? 0;

      // Veriler — ebook bilgisi join
      const rows = await db.execute(sql`
        SELECT
          p.id, p.ebook_id, p.user_id,
          p.buyer_email, p.buyer_name, p.buyer_phone,
          p.invoice_type, p.tax_id, p.tax_office, p.company_name,
          p.billing_address, p.billing_city, p.billing_district, p.billing_postal_code,
          p.amount_paid, p.currency,
          p.iyzico_payment_id, p.iyzico_conversation_id,
          p.payment_status, p.payment_error,
          p.invoice_status, p.invoice_number, p.invoice_issued_at, p.invoice_notes,
          p.download_token, p.download_count, p.download_expires_at,
          p.paid_at, p.created_at, p.updated_at,
          e.title AS ebook_title, e.slug AS ebook_slug
        FROM ebook_purchases p
        LEFT JOIN ebooks e ON e.id = p.ebook_id
        ${whereClause}
        ORDER BY p.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      return res.json({
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
        issuedAtSql = sql`${invoiceIssuedAt}::TIMESTAMPTZ`;
      } else if (invoiceStatus === "issued" || invoiceStatus === "sent") {
        issuedAtSql = sql`COALESCE(invoice_issued_at, NOW())`;
      }

      await db.execute(sql`
        UPDATE ebook_purchases SET
          invoice_status = COALESCE(${invoiceStatus ?? null}, invoice_status),
          invoice_number = COALESCE(${invoiceNumber ?? null}, invoice_number),
          invoice_notes = COALESCE(${invoiceNotes ?? null}, invoice_notes),
          invoice_issued_at = ${issuedAtSql},
          updated_at = NOW()
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

export default router;
