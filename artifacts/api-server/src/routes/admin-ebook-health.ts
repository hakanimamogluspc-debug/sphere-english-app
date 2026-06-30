/**
 * E-Kitap sistemi sağlık kontrolü.
 *
 * Tüm e-kitapları tarar, her biri için:
 *   - Aktif mi?
 *   - Full PDF asset var mı? (yoksa download fail eder)
 *   - Preview asset var mı? (opsiyonel ama önerilen)
 *   - Slug reserved keyword ile çakışıyor mu? (download, asset, yeni, new)
 *   - Satış istatistikleri (toplam, success, pending, failed)
 *
 * Bonus:
 *   - Toplam BEKLEYEN satış sayısı (kurtarma gerektiren)
 *   - Sistemde uyarı listesi
 *
 * Endpoint: GET /api/admin/ebooks/health-check
 */

import { Router, type IRouter, Response } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth.js";

const RESERVED_SLUGS = ["download", "asset", "yeni", "new"];

const router: IRouter = Router();

router.get(
  "/admin/ebooks/health-check",
  authMiddleware,
  requireRole("admin"),
  async (_req: AuthRequest, res: Response) => {
    try {
      // Tüm e-kitapları çek
      const ebookRows = await db.execute(sql`
        SELECT id, slug, title, is_active, created_at
        FROM ebooks
        ORDER BY id ASC
      `);
      const ebooks = (ebookRows.rows ?? ebookRows) as any[];

      // Her ebook için full + preview asset durumu
      const assetRows = await db.execute(sql`
        SELECT ebook_id, asset_type
        FROM ebook_assets
        WHERE ebook_id IN (SELECT id FROM ebooks)
      `);
      const assets = (assetRows.rows ?? assetRows) as any[];

      const assetMap = new Map<number, Set<string>>();
      for (const a of assets) {
        const eid = Number(a.ebook_id);
        if (!assetMap.has(eid)) assetMap.set(eid, new Set());
        assetMap.get(eid)!.add(String(a.asset_type));
      }

      // Her ebook için satış istatistikleri
      const salesRows = await db.execute(sql`
        SELECT ebook_id, payment_status, COUNT(*)::int AS count
        FROM ebook_purchases
        GROUP BY ebook_id, payment_status
      `);
      const sales = (salesRows.rows ?? salesRows) as any[];

      const salesMap = new Map<number, Record<string, number>>();
      for (const s of sales) {
        const eid = Number(s.ebook_id);
        if (!salesMap.has(eid)) salesMap.set(eid, {});
        salesMap.get(eid)![String(s.payment_status)] = Number(s.count);
      }

      // Toplam bekleyen satış (sistem geneli)
      const totalPendingRows = await db.execute(sql`
        SELECT COUNT(*)::int AS total FROM ebook_purchases WHERE payment_status = 'pending'
      `);
      const totalPending = Number((totalPendingRows.rows ?? totalPendingRows)[0]?.total ?? 0);

      // Her ebook için health raporu
      const warnings: string[] = [];
      const report = ebooks.map((eb: any) => {
        const ebId = Number(eb.id);
        const assetTypes = assetMap.get(ebId) ?? new Set();
        const ebSales = salesMap.get(ebId) ?? {};

        const hasFullPdf = assetTypes.has("full");
        const hasPreview = assetTypes.has("preview");
        const slugConflict = RESERVED_SLUGS.includes(String(eb.slug ?? "").toLowerCase());

        // Uyarılar
        if (eb.is_active && !hasFullPdf) {
          warnings.push(`⚠ "${eb.title}" (id=${ebId}) aktif ama FULL PDF asset YOK — satın alma sonrası indirme fail olur`);
        }
        if (slugConflict) {
          warnings.push(`🚨 "${eb.title}" (id=${ebId}) slug "${eb.slug}" reserved keyword — route conflict riski`);
        }
        if ((ebSales.pending ?? 0) > 0) {
          warnings.push(`⏱ "${eb.title}" (id=${ebId}) için ${ebSales.pending} BEKLEYEN satış var — manuel kurtarma gerekebilir`);
        }
        if ((ebSales.failed ?? 0) > 5) {
          warnings.push(`✗ "${eb.title}" (id=${ebId}) için ${ebSales.failed} BAŞARISIZ satış — incelenmesi gerekir`);
        }

        return {
          id: ebId,
          slug: eb.slug,
          title: eb.title,
          isActive: !!eb.is_active,
          hasFullPdf,
          hasPreview,
          slugConflict,
          sales: {
            total: Object.values(ebSales).reduce((a, b) => a + Number(b), 0),
            success: ebSales.success ?? 0,
            pending: ebSales.pending ?? 0,
            failed: ebSales.failed ?? 0,
          },
          status: hasFullPdf && !slugConflict ? "ok" : "warning",
        };
      });

      // Özet
      const summary = {
        totalEbooks: ebooks.length,
        activeEbooks: ebooks.filter((e: any) => e.is_active).length,
        missingFullPdf: report.filter((r) => r.isActive && !r.hasFullPdf).length,
        slugConflicts: report.filter((r) => r.slugConflict).length,
        totalPendingSales: totalPending,
        warningCount: warnings.length,
        overallStatus: warnings.length === 0 ? "healthy" : "warnings",
      };

      return res.json({ summary, warnings, ebooks: report });
    } catch (e: any) {
      console.error("[admin/ebooks/health-check] HATA:", e?.message);
      return res.status(500).json({ error: e?.message ?? "Sağlık kontrolü başarısız" });
    }
  },
);

export default router;
