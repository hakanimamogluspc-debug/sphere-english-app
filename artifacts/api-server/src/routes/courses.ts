/**
 * Courses — Admin CRUD + public catalog.
 *
 * DB-backed kurs kataloğu (e-kitap admin pattern'i).
 * course-orders artık DB'den okuyacak (findProgrammeFromDb).
 *
 * Public:
 *   GET  /api/courses               → aktif kurs listesi (www için)
 *   GET  /api/courses/:slug         → tek kurs detayı
 *
 * Admin:
 *   GET    /api/admin/courses       → tüm kurslar (aktif+pasif)
 *   POST   /api/admin/courses       → yeni kurs oluştur
 *   GET    /api/admin/courses/:id   → tek kurs (edit için)
 *   PATCH  /api/admin/courses/:id   → güncelle
 *   DELETE /api/admin/courses/:id   → soft delete (is_active=false)
 */

import { Router, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth";
import { invalidateCoursesCache } from "../lib/courses-catalog";

const router = Router();

/** DB row → frontend-friendly object (JSON alanları parse) */
function normalizeCourse(row: any): any {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    title_en: row.title_en,
    subtitle: row.subtitle,
    description: row.description,
    level: row.level,
    level_badge: row.level_badge,
    level_cefr: row.level_cefr,
    level_audience: row.level_audience,
    duration_weeks: row.duration_weeks,
    duration_label: row.duration_label,
    price_kurus: row.price_kurus,
    price_display: row.price_display,
    weeks: row.weeks ?? [],
    audience: row.audience ?? [],
    related_ebook_slugs: row.related_ebook_slugs ?? [],
    cohort_status: row.cohort_status,
    cohort_start_date: row.cohort_start_date,
    cohort_start_display: row.cohort_start_display,
    cohort_capacity: row.cohort_capacity,
    cohort_registrations: row.cohort_registrations,
    seo_title: row.seo_title,
    seo_description: row.seo_description,
    is_active: row.is_active,
    sort_order: row.sort_order,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// ─── PUBLIC ────────────────────────────────────────────────────

router.get("/courses", async (_req: Request, res: Response) => {
  try {
    const r: any = await pool.query(
      `SELECT * FROM marketing_courses WHERE is_active = true ORDER BY sort_order ASC, id ASC`,
    );
    return res.json({ courses: r.rows.map(normalizeCourse) });
  } catch (e: any) {
    console.error("[courses/list] HATA:", e?.message);
    return res.status(500).json({ error: e?.message });
  }
});

router.get("/courses/:slug", async (req: Request, res: Response) => {
  try {
    const slug = String(req.params.slug ?? "").trim();
    const r: any = await pool.query(
      `SELECT * FROM marketing_courses WHERE slug = $1 AND is_active = true LIMIT 1`,
      [slug],
    );
    const course = r.rows[0];
    if (!course) return res.status(404).json({ error: "Kurs bulunamadı" });
    return res.json({ course: normalizeCourse(course) });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
});

// ─── ADMIN ────────────────────────────────────────────────────

/** GET all — aktif + pasif */
router.get("/admin/courses", authMiddleware, requireRole("admin"), async (_req: AuthRequest, res: Response) => {
  try {
    const r: any = await pool.query(
      `SELECT * FROM marketing_courses ORDER BY sort_order ASC, id ASC`,
    );
    return res.json({ courses: r.rows.map(normalizeCourse) });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
});

/** GET single by id (edit için) */
router.get("/admin/courses/:id", authMiddleware, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: "Geçersiz id" });
    const r: any = await pool.query(`SELECT * FROM marketing_courses WHERE id = $1 LIMIT 1`, [id]);
    const course = r.rows[0];
    if (!course) return res.status(404).json({ error: "Kurs bulunamadı" });
    return res.json({ course: normalizeCourse(course) });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
});

/** Allowed fields for insert/update */
const ALLOWED_FIELDS = [
  "slug", "title", "title_en", "subtitle", "description",
  "level", "level_badge", "level_cefr", "level_audience",
  "duration_weeks", "duration_label",
  "price_kurus", "price_display",
  "weeks", "audience", "related_ebook_slugs",
  "cohort_status", "cohort_start_date", "cohort_start_display", "cohort_capacity", "cohort_registrations",
  "seo_title", "seo_description",
  "is_active", "sort_order",
];

/** POST create */
router.post("/admin/courses", authMiddleware, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const body = req.body ?? {};
    const slug = String(body.slug ?? "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const title = String(body.title ?? "").trim();
    const priceKurus = parseInt(String(body.price_kurus ?? 0), 10);

    if (!slug || slug.length < 3) return res.status(400).json({ error: "slug en az 3 karakter olmalı" });
    if (!title) return res.status(400).json({ error: "title zorunlu" });
    if (!priceKurus || priceKurus < 100) return res.status(400).json({ error: "price_kurus geçerli olmalı (min 100 kuruş)" });

    // Slug unique kontrol
    const exists: any = await pool.query(`SELECT id FROM marketing_courses WHERE slug = $1`, [slug]);
    if (exists.rows.length > 0) {
      return res.status(400).json({ error: "Bu slug zaten kullanımda" });
    }

    const fields: string[] = [];
    const values: any[] = [];
    const placeholders: string[] = [];
    let paramIdx = 1;

    for (const f of ALLOWED_FIELDS) {
      if (body[f] === undefined) continue;
      let val = body[f];
      // JSON alanları
      if (f === "weeks" || f === "audience") {
        val = JSON.stringify(val ?? []);
      }
      // Array alan
      if (f === "related_ebook_slugs") {
        val = Array.isArray(val) ? val : [];
      }
      // Number normalize
      if (f === "duration_weeks" || f === "price_kurus" || f === "cohort_capacity" || f === "cohort_registrations" || f === "sort_order") {
        val = parseInt(String(val), 10) || 0;
      }
      // Bool normalize
      if (f === "is_active") {
        val = val === true || val === "true";
      }
      // Empty string → null (özellikle date alanları için)
      if (val === "") val = null;

      fields.push(f);
      values.push(val);
      placeholders.push(`$${paramIdx++}`);
    }

    if (!fields.includes("slug")) { fields.push("slug"); values.push(slug); placeholders.push(`$${paramIdx++}`); }
    if (!fields.includes("title")) { fields.push("title"); values.push(title); placeholders.push(`$${paramIdx++}`); }
    if (!fields.includes("price_kurus")) { fields.push("price_kurus"); values.push(priceKurus); placeholders.push(`$${paramIdx++}`); }

    const r: any = await pool.query(
      `INSERT INTO marketing_courses (${fields.join(", ")}) VALUES (${placeholders.join(", ")}) RETURNING *`,
      values,
    );
    invalidateCoursesCache();
    return res.json({ course: normalizeCourse(r.rows[0]) });
  } catch (e: any) {
    console.error("[admin/courses POST] HATA:", e?.message);
    return res.status(500).json({ error: e?.message });
  }
});

/** PATCH update */
router.patch("/admin/courses/:id", authMiddleware, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: "Geçersiz id" });

    const body = req.body ?? {};
    const sets: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;

    for (const f of ALLOWED_FIELDS) {
      if (body[f] === undefined) continue;
      let val = body[f];
      if (f === "weeks" || f === "audience") val = JSON.stringify(val ?? []);
      if (f === "related_ebook_slugs") val = Array.isArray(val) ? val : [];
      if (f === "duration_weeks" || f === "price_kurus" || f === "cohort_capacity" || f === "cohort_registrations" || f === "sort_order") {
        val = parseInt(String(val), 10) || 0;
      }
      if (f === "is_active") val = val === true || val === "true";
      // slug normalize (edit için de)
      if (f === "slug" && typeof val === "string") {
        val = val.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
      }
      if (val === "") val = null;
      sets.push(`${f} = $${paramIdx++}`);
      values.push(val);
    }

    if (sets.length === 0) return res.status(400).json({ error: "güncellenecek alan yok" });

    values.push(id);
    const r: any = await pool.query(
      `UPDATE marketing_courses SET ${sets.join(", ")}, updated_at = NOW() WHERE id = $${paramIdx} RETURNING *`,
      values,
    );
    if (r.rows.length === 0) return res.status(404).json({ error: "Kurs bulunamadı" });
    invalidateCoursesCache();
    return res.json({ course: normalizeCourse(r.rows[0]) });
  } catch (e: any) {
    console.error("[admin/courses PATCH] HATA:", e?.message);
    return res.status(500).json({ error: e?.message });
  }
});

/** DELETE — soft (is_active=false) */
router.delete("/admin/courses/:id", authMiddleware, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: "Geçersiz id" });
    const r: any = await pool.query(
      `UPDATE marketing_courses SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id`,
      [id],
    );
    if (r.rows.length === 0) return res.status(404).json({ error: "Kurs bulunamadı" });
    invalidateCoursesCache();
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
});

export default router;
