/**
 * Eğitmen başvuruları — pazarlama sitesinden form + admin yönetim.
 *
 * Endpoint'ler:
 *   POST   /api/teacher-applications              → Public form submit (multer ile CV)
 *   GET    /api/admin/teacher-applications        → Admin liste (filter + page)
 *   GET    /api/admin/teacher-applications/:id    → Admin tek başvuru detay
 *   PATCH  /api/admin/teacher-applications/:id    → Admin status/notes güncelle
 *   GET    /api/admin/teacher-applications/:id/cv → CV PDF download
 *
 * CV: bytea (Postgres) — max 5MB. Filesystem persistence sorununu önler.
 */

import { Router, Request, Response } from "express";
import multer from "multer";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth.js";

const router = Router();

const MAX_CV_SIZE = 5 * 1024 * 1024; // 5 MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_CV_SIZE },
});

// CORS açık tutulur — pazarlama sitesinden direkt çağrılabilsin (yine de
// Next.js API route üzerinden proxy yapıyoruz, bu yedek).
function setPublicCors(res: Response, req: Request) {
  const origin = req.headers.origin;
  const allow = ["https://www.sphereenglish.com", "https://sphereenglish.com", "http://localhost:3000"];
  if (origin && allow.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type");
  }
}

router.options("/teacher-applications", (req, res) => {
  setPublicCors(res, req);
  res.status(204).end();
});

// ─── PUBLIC: Form submit ─────────────────────────────────────────────────
router.post(
  "/teacher-applications",
  upload.single("cv"),
  async (req: Request, res: Response) => {
    setPublicCors(res, req);
    try {
      const body = (req.body ?? {}) as Record<string, string>;
      const required = ["fullName", "email", "phone", "birthDate", "nationality", "location", "experience", "education", "englishLevel"];
      for (const f of required) {
        if (!body[f] || String(body[f]).trim().length === 0) {
          return res.status(400).json({ error: `Zorunlu alan eksik: ${f}` });
        }
      }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email)) {
        return res.status(400).json({ error: "Geçersiz e-posta adresi" });
      }
      if (body.kvkkAccepted !== "true") {
        return res.status(400).json({ error: "KVKK onayı zorunludur" });
      }

      // Certifications: front "IELTS,CELTA" gibi virgüllü string gönderir
      let certificationsJson: string | null = null;
      if (body.certifications) {
        try {
          // Hem array hem virgüllü string olabilir
          const parsed = body.certifications.startsWith("[")
            ? JSON.parse(body.certifications)
            : body.certifications.split(",").map((s) => s.trim()).filter(Boolean);
          certificationsJson = JSON.stringify(parsed);
        } catch {
          certificationsJson = body.certifications;
        }
      }

      // CV (opsiyonel ama önerilen)
      const cv = req.file;
      if (cv && cv.mimetype !== "application/pdf") {
        return res.status(400).json({ error: "CV sadece PDF formatında olabilir" });
      }
      if (cv && cv.size > MAX_CV_SIZE) {
        return res.status(400).json({ error: "CV maksimum 5MB olabilir" });
      }

      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || null;
      const userAgent = (req.headers["user-agent"] as string) || null;

      const inserted = await db.execute(sql`
        INSERT INTO teacher_applications (
          full_name, email, phone, birth_date, nationality, location,
          experience, education, english_level, certifications, references,
          cv_filename, cv_mime_type, cv_size_bytes, cv_content,
          status, kvkk_accepted_at, submitter_ip, user_agent
        ) VALUES (
          ${body.fullName.trim()}, ${body.email.trim().toLowerCase()}, ${body.phone.trim()},
          ${body.birthDate}, ${body.nationality.trim()}, ${body.location.trim()},
          ${body.experience}, ${body.education}, ${body.englishLevel},
          ${certificationsJson}, ${body.references || null},
          ${cv?.originalname ?? null}, ${cv?.mimetype ?? null}, ${cv?.size ?? null}, ${cv?.buffer ?? null},
          'pending', NOW(), ${ip}, ${userAgent}
        )
        RETURNING id
      `);
      const newId = (inserted.rows ?? inserted)[0]?.id;

      console.info(`[TEACHER-APP] Yeni başvuru: ${body.email} (id=${newId})`);
      return res.status(201).json({ ok: true, id: newId, message: "Başvurunuz alındı. En kısa sürede dönüş yapacağız." });
    } catch (e: any) {
      console.error("[TEACHER-APP] submit HATA:", e?.message ?? e);
      // multer file-size hatası
      if (e?.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ error: "CV dosyası 5MB sınırını aşıyor" });
      }
      return res.status(500).json({ error: "Başvuru gönderilemedi. Lütfen tekrar deneyin." });
    }
  },
);

// ─── ADMIN: Liste ─────────────────────────────────────────────────────────
router.get(
  "/admin/teacher-applications",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { status, page = "1" } = req.query as Record<string, string>;
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limit = 50;
      const offset = (pageNum - 1) * limit;

      const rows = await db.execute(sql`
        SELECT id, full_name, email, phone, birth_date, nationality, location,
               experience, education, english_level, certifications, references,
               cv_filename, cv_mime_type, cv_size_bytes,
               status, admin_notes, reviewed_at,
               created_at, updated_at
        FROM teacher_applications
        ${status ? sql`WHERE status = ${status}` : sql``}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `);
      // Status sayıları (badge'ler için)
      const counts = await db.execute(sql`
        SELECT status, COUNT(*)::int as count
        FROM teacher_applications
        GROUP BY status
      `);
      return res.json({
        items: rows.rows ?? rows,
        page: pageNum,
        counts: counts.rows ?? counts,
      });
    } catch (e: any) {
      console.error("[TEACHER-APP] list HATA:", e?.message);
      return res.status(500).json({ error: "Başvurular alınamadı" });
    }
  },
);

// ─── ADMIN: Tek detay (CV hariç) ──────────────────────────────────────────
router.get(
  "/admin/teacher-applications/:id",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Geçersiz id" });
    try {
      const rows = await db.execute(sql`
        SELECT id, full_name, email, phone, birth_date, nationality, location,
               experience, education, english_level, certifications, references,
               cv_filename, cv_mime_type, cv_size_bytes,
               status, admin_notes, reviewed_at, reviewed_by,
               submitter_ip, user_agent, created_at, updated_at
        FROM teacher_applications
        WHERE id = ${id}
      `);
      const item = (rows.rows ?? rows)[0];
      if (!item) return res.status(404).json({ error: "Başvuru bulunamadı" });
      return res.json({ item });
    } catch (e: any) {
      return res.status(500).json({ error: "Detay alınamadı" });
    }
  },
);

// ─── ADMIN: status / notes güncelle ──────────────────────────────────────
router.patch(
  "/admin/teacher-applications/:id",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Geçersiz id" });

    const { status, adminNotes } = req.body as { status?: string; adminNotes?: string };
    const allowed = ["pending", "reviewing", "accepted", "rejected", "archived"];
    if (status && !allowed.includes(status)) {
      return res.status(400).json({ error: "Geçersiz status" });
    }
    try {
      await db.execute(sql`
        UPDATE teacher_applications
        SET status = COALESCE(${status ?? null}, status),
            admin_notes = COALESCE(${adminNotes ?? null}, admin_notes),
            reviewed_by = ${req.userId ?? null},
            reviewed_at = CASE WHEN ${status ?? null} IS NOT NULL THEN NOW() ELSE reviewed_at END,
            updated_at = NOW()
        WHERE id = ${id}
      `);
      return res.json({ ok: true });
    } catch (e: any) {
      console.error("[TEACHER-APP] patch HATA:", e?.message);
      return res.status(500).json({ error: "Güncellenemedi" });
    }
  },
);

// ─── ADMIN: CV PDF download ─────────────────────────────────────────────
router.get(
  "/admin/teacher-applications/:id/cv",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Geçersiz id" });
    try {
      const rows = await db.execute(sql`
        SELECT cv_filename, cv_mime_type, cv_content
        FROM teacher_applications
        WHERE id = ${id}
      `);
      const item = (rows.rows ?? rows)[0] as any;
      if (!item || !item.cv_content) {
        return res.status(404).json({ error: "CV bulunamadı" });
      }
      const filename = item.cv_filename || `cv-${id}.pdf`;
      const mime = item.cv_mime_type || "application/pdf";
      res.setHeader("Content-Type", mime);
      res.setHeader("Content-Disposition", `attachment; filename="${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}"`);
      // Postgres bytea — Buffer olarak gelir
      res.send(Buffer.isBuffer(item.cv_content) ? item.cv_content : Buffer.from(item.cv_content));
    } catch (e: any) {
      console.error("[TEACHER-APP] cv HATA:", e?.message);
      return res.status(500).json({ error: "CV indirilemedi" });
    }
  },
);

export default router;
