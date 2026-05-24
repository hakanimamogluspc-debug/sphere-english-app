/**
 * Admin Outreach API
 *
 * Endpoint'ler:
 *  GET    /api/admin/outreach/leads          → liste (filtre + arama + pagination)
 *  GET    /api/admin/outreach/leads/:id      → tek lead detayı
 *  PATCH  /api/admin/outreach/leads/:id      → status / notes / tags güncelle
 *  DELETE /api/admin/outreach/leads/:id      → arşivle (soft delete)
 *  GET    /api/admin/outreach/stats          → segment bazlı istatistik
 *  GET    /api/admin/outreach/runs           → son keşif çalıştırmaları
 *  POST   /api/admin/outreach/trigger        → manuel keşif tetikle (tek segment veya tümü)
 *  POST   /api/admin/outreach/verify         → manuel email doğrulama tetikle
 *  GET    /api/admin/outreach/export.csv     → CSV export
 */

import { Router, type Response } from "express";
import { db, outreachLeadsTable, outreachRunsTable } from "@workspace/db";
import { and, count, desc, eq, gte, ilike, inArray, or, sql } from "drizzle-orm";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth.js";
import { discoverAllSegments, discoverSegment } from "../services/outreach-discovery.js";
import { verifyPendingLeads } from "../services/outreach-verifier.js";
import type { OutreachSegment } from "@workspace/db";

const router = Router();

const SEGMENTS: OutreachSegment[] = ["b2b_hr", "b2b_sme", "b2c_pro", "partner"];

// ─── GET /admin/outreach/leads ───────────────────────────────────────────
router.get(
  "/admin/outreach/leads",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const {
        segment,
        status,
        emailStatus,
        search,
        page = "1",
        pageSize = "50",
      } = req.query as Record<string, string>;

      const filters: any[] = [];

      if (segment && SEGMENTS.includes(segment as OutreachSegment)) {
        filters.push(eq(outreachLeadsTable.segment, segment as OutreachSegment));
      }
      if (status) {
        filters.push(eq(outreachLeadsTable.status, status as any));
      }
      if (emailStatus) {
        filters.push(eq(outreachLeadsTable.emailStatus, emailStatus as any));
      }
      if (search?.trim()) {
        const q = `%${search.trim()}%`;
        filters.push(
          or(
            ilike(outreachLeadsTable.email, q),
            ilike(outreachLeadsTable.fullName, q),
            ilike(outreachLeadsTable.company, q),
            ilike(outreachLeadsTable.jobTitle, q),
          ),
        );
      }

      const where = filters.length > 0 ? and(...filters) : undefined;

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const sizeNum = Math.min(200, Math.max(10, parseInt(pageSize, 10) || 50));
      const offset = (pageNum - 1) * sizeNum;

      const [items, [{ total }]] = await Promise.all([
        db
          .select()
          .from(outreachLeadsTable)
          .where(where)
          .orderBy(desc(outreachLeadsTable.discoveredAt))
          .limit(sizeNum)
          .offset(offset),
        db
          .select({ total: count() })
          .from(outreachLeadsTable)
          .where(where),
      ]);

      return res.json({
        items,
        pagination: {
          page: pageNum,
          pageSize: sizeNum,
          total: Number(total),
          totalPages: Math.ceil(Number(total) / sizeNum),
        },
      });
    } catch (e: any) {
      console.error("[outreach] list error:", e);
      return res.status(500).json({ error: e?.message ?? "Liste alınamadı." });
    }
  },
);

// ─── GET /admin/outreach/leads/:id ───────────────────────────────────────
router.get(
  "/admin/outreach/leads/:id",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = Number(req.params.id);
      const [lead] = await db
        .select()
        .from(outreachLeadsTable)
        .where(eq(outreachLeadsTable.id, id));

      if (!lead) return res.status(404).json({ error: "Lead bulunamadı." });
      return res.json(lead);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message ?? "Lead alınamadı." });
    }
  },
);

// ─── PATCH /admin/outreach/leads/:id ─────────────────────────────────────
router.patch(
  "/admin/outreach/leads/:id",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = Number(req.params.id);
      const { status, notes, tags } = req.body as { status?: string; notes?: string; tags?: string };

      const update: Record<string, any> = { updatedAt: new Date() };
      if (status) update.status = status;
      if (notes !== undefined) update.notes = notes;
      if (tags !== undefined) update.tags = tags;

      await db.update(outreachLeadsTable).set(update).where(eq(outreachLeadsTable.id, id));
      return res.json({ ok: true });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message ?? "Güncelleme başarısız." });
    }
  },
);

// ─── DELETE /admin/outreach/leads/:id  (soft delete - archive) ────────────
router.delete(
  "/admin/outreach/leads/:id",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = Number(req.params.id);
      await db
        .update(outreachLeadsTable)
        .set({ status: "archived", updatedAt: new Date() })
        .where(eq(outreachLeadsTable.id, id));
      return res.json({ ok: true });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message ?? "Arşivleme başarısız." });
    }
  },
);

// ─── POST /admin/outreach/leads/bulk ──────────────────────────────────────
router.post(
  "/admin/outreach/leads/bulk",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { ids, action, value } = req.body as { ids: number[]; action: string; value?: string };
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "ID listesi boş olamaz." });
      }

      const now = new Date();
      if (action === "set_status" && value) {
        await db
          .update(outreachLeadsTable)
          .set({ status: value as any, updatedAt: now })
          .where(inArray(outreachLeadsTable.id, ids));
      } else if (action === "archive") {
        await db
          .update(outreachLeadsTable)
          .set({ status: "archived", updatedAt: now })
          .where(inArray(outreachLeadsTable.id, ids));
      } else {
        return res.status(400).json({ error: "Geçersiz işlem." });
      }
      return res.json({ ok: true, count: ids.length });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message ?? "İşlem başarısız." });
    }
  },
);

// ─── GET /admin/outreach/stats ────────────────────────────────────────────
router.get(
  "/admin/outreach/stats",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);

      const [[total], [newThisWeek], [validEmails], [unverified]] = await Promise.all([
        db.select({ c: count() }).from(outreachLeadsTable),
        db.select({ c: count() }).from(outreachLeadsTable).where(gte(outreachLeadsTable.discoveredAt, sevenDaysAgo)),
        db.select({ c: count() }).from(outreachLeadsTable).where(eq(outreachLeadsTable.emailStatus, "valid")),
        db.select({ c: count() }).from(outreachLeadsTable).where(eq(outreachLeadsTable.emailVerified, false)),
      ]);

      const bySegment = await db
        .select({ segment: outreachLeadsTable.segment, c: count() })
        .from(outreachLeadsTable)
        .groupBy(outreachLeadsTable.segment);

      const byStatus = await db
        .select({ status: outreachLeadsTable.status, c: count() })
        .from(outreachLeadsTable)
        .groupBy(outreachLeadsTable.status);

      const byEmailStatus = await db
        .select({ emailStatus: outreachLeadsTable.emailStatus, c: count() })
        .from(outreachLeadsTable)
        .groupBy(outreachLeadsTable.emailStatus);

      // Son 14 gün günlük keşif
      const dailyDiscovery = await db
        .select({
          date: sql<string>`DATE(${outreachLeadsTable.discoveredAt})`,
          c: count(),
        })
        .from(outreachLeadsTable)
        .where(gte(outreachLeadsTable.discoveredAt, new Date(Date.now() - 14 * 86400000)))
        .groupBy(sql`DATE(${outreachLeadsTable.discoveredAt})`)
        .orderBy(sql`DATE(${outreachLeadsTable.discoveredAt})`);

      return res.json({
        total: Number(total.c),
        newThisWeek: Number(newThisWeek.c),
        validEmails: Number(validEmails.c),
        unverified: Number(unverified.c),
        bySegment: bySegment.map((r) => ({ segment: r.segment, count: Number(r.c) })),
        byStatus: byStatus.map((r) => ({ status: r.status, count: Number(r.c) })),
        byEmailStatus: byEmailStatus.map((r) => ({ emailStatus: r.emailStatus, count: Number(r.c) })),
        dailyDiscovery: dailyDiscovery.map((r) => ({ date: r.date, count: Number(r.c) })),
        apifyConfigured: !!process.env.APIFY_API_TOKEN,
      });
    } catch (e: any) {
      console.error("[outreach] stats error:", e);
      return res.status(500).json({ error: e?.message ?? "İstatistikler alınamadı." });
    }
  },
);

// ─── GET /admin/outreach/runs ─────────────────────────────────────────────
router.get(
  "/admin/outreach/runs",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const runs = await db
        .select()
        .from(outreachRunsTable)
        .orderBy(desc(outreachRunsTable.startedAt))
        .limit(30);
      return res.json(runs);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message ?? "Çalıştırmalar alınamadı." });
    }
  },
);

// ─── POST /admin/outreach/trigger  (manuel başlat) ────────────────────────
router.post(
  "/admin/outreach/trigger",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { segment, limit } = req.body as { segment?: string; limit?: number };

      if (!process.env.APIFY_API_TOKEN) {
        return res.status(400).json({ error: "APIFY_API_TOKEN tanımlı değil. .env'e ekleyin." });
      }

      // Arka planda çalıştır — admin paneli beklemesin
      if (segment && SEGMENTS.includes(segment as OutreachSegment)) {
        discoverSegment(segment as OutreachSegment, { limit: limit ?? 50 }).catch((err) => {
          console.error(`[outreach] discoverSegment(${segment}) failed:`, err);
        });
        return res.json({ ok: true, message: `${segment} segmenti için keşif arka planda başladı.` });
      }

      // Tüm segmentler
      discoverAllSegments({ limitPerSegment: limit ?? 50 }).catch((err) => {
        console.error("[outreach] discoverAllSegments failed:", err);
      });
      return res.json({ ok: true, message: "4 segment için keşif arka planda başladı. ~5-10 dakika sürer." });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message ?? "Tetikleme başarısız." });
    }
  },
);

// ─── POST /admin/outreach/verify  (manuel email doğrulama) ────────────────
router.post(
  "/admin/outreach/verify",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { batchSize } = req.body as { batchSize?: number };
      if (!process.env.APIFY_API_TOKEN) {
        return res.status(400).json({ error: "APIFY_API_TOKEN tanımlı değil." });
      }
      verifyPendingLeads({ batchSize: batchSize ?? 100 }).catch((err) => {
        console.error("[outreach] verifyPendingLeads failed:", err);
      });
      return res.json({ ok: true, message: "Doğrulama arka planda başladı." });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message ?? "Doğrulama başarısız." });
    }
  },
);

// ─── GET /admin/outreach/export.csv ───────────────────────────────────────
router.get(
  "/admin/outreach/export.csv",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { segment, status, emailStatus } = req.query as Record<string, string>;

      const filters: any[] = [];
      if (segment && SEGMENTS.includes(segment as OutreachSegment)) {
        filters.push(eq(outreachLeadsTable.segment, segment as OutreachSegment));
      }
      if (status) filters.push(eq(outreachLeadsTable.status, status as any));
      if (emailStatus) filters.push(eq(outreachLeadsTable.emailStatus, emailStatus as any));

      const where = filters.length > 0 ? and(...filters) : undefined;
      const leads = await db
        .select()
        .from(outreachLeadsTable)
        .where(where)
        .orderBy(desc(outreachLeadsTable.discoveredAt))
        .limit(10000);

      const headers = [
        "email",
        "full_name",
        "first_name",
        "last_name",
        "job_title",
        "company",
        "company_website",
        "industry",
        "location",
        "linkedin_url",
        "segment",
        "email_status",
        "status",
        "discovered_at",
      ];

      const escape = (v: any): string => {
        if (v == null) return "";
        const s = String(v).replace(/"/g, '""');
        return /[",\n]/.test(s) ? `"${s}"` : s;
      };

      const lines = [headers.join(",")];
      for (const l of leads) {
        lines.push(
          [
            escape(l.email),
            escape(l.fullName),
            escape(l.firstName),
            escape(l.lastName),
            escape(l.jobTitle),
            escape(l.company),
            escape(l.companyWebsite),
            escape(l.industry),
            escape(l.location),
            escape(l.linkedinUrl),
            escape(l.segment),
            escape(l.emailStatus),
            escape(l.status),
            escape(l.discoveredAt),
          ].join(","),
        );
      }

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="outreach-leads-${Date.now()}.csv"`);
      // UTF-8 BOM ekle (Excel TR karakter sorunları için)
      return res.send("﻿" + lines.join("\n"));
    } catch (e: any) {
      console.error("[outreach] export error:", e);
      return res.status(500).json({ error: e?.message ?? "Export başarısız." });
    }
  },
);

export default router;
