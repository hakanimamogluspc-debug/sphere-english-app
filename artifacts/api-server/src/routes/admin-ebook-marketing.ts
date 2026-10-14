/**
 * /e-kitaplar pazarlama sayfası — admin yönetimi.
 *
 *   Waitlist
 *   GET    /api/admin/ebook-waitlist              → liste (?area=&q=&limit=&offset=)
 *   GET    /api/admin/ebook-waitlist/stats        → alan bazlı sayım
 *   GET    /api/admin/ebook-waitlist/export.csv   → CSV
 *   DELETE /api/admin/ebook-waitlist/:id
 *
 *   FAQ
 *   GET    /api/admin/ebook-faq
 *   POST   /api/admin/ebook-faq
 *   PUT    /api/admin/ebook-faq/reorder           body: { ids: number[] }
 *   PATCH  /api/admin/ebook-faq/:id
 *   DELETE /api/admin/ebook-faq/:id
 *
 *   Guide
 *   GET    /api/admin/ebook-guide
 *   POST   /api/admin/ebook-guide
 *   PUT    /api/admin/ebook-guide/reorder         body: { ids: number[] }
 *   PATCH  /api/admin/ebook-guide/:id
 *   DELETE /api/admin/ebook-guide/:id
 *
 * Not: Repoda iki drizzle-orm kopyası olduğundan query builder tipleri çakışıyor;
 * diğer admin route'ları gibi pool.query (parametreli) kullanılır.
 */

import { Router, Response } from "express";
import { pool, EBOOK_INTEREST_AREAS } from "@workspace/db";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth.js";

const router = Router();
const adminOnly = requireRole("admin");

const VALID_AREAS = new Set<string>(EBOOK_INTEREST_AREAS.map((a) => a.key));
const areaLabel = (k: string | null) =>
  k ? (EBOOK_INTEREST_AREAS.find((a) => a.key === k)?.label ?? k) : "Genel";

function numId(raw: unknown): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function str(v: unknown, max: number): string | undefined {
  if (typeof v !== "string") return undefined;
  return v.trim().slice(0, max);
}

const FAQ_COLS = `id, question, answer, display_order AS "displayOrder", is_active AS "isActive",
  created_at AS "createdAt", updated_at AS "updatedAt"`;
const GUIDE_COLS = `id, role_label AS "roleLabel", description, cta_text AS "ctaText",
  cta_href AS "ctaHref", icon, display_order AS "displayOrder", is_active AS "isActive",
  created_at AS "createdAt", updated_at AS "updatedAt"`;
const WL_COLS = `id, email, interest_area AS "interestArea", source, user_agent AS "userAgent",
  notified_at AS "notifiedAt", created_at AS "createdAt"`;

// ─── WAITLIST ────────────────────────────────────────────────────────────

router.get("/admin/ebook-waitlist/stats", authMiddleware, adminOnly, async (_req: AuthRequest, res: Response) => {
  try {
    const [byArea, last7] = await Promise.all([
      pool.query(`SELECT interest_area AS area, count(*)::int AS count FROM ebook_waitlist GROUP BY interest_area`),
      pool.query(`SELECT count(*)::int AS c FROM ebook_waitlist WHERE created_at > now() - interval '7 days'`),
    ]);
    const rows = byArea.rows as Array<{ area: string | null; count: number }>;
    const total = rows.reduce((s, r) => s + Number(r.count), 0);
    return res.json({
      total,
      last7Days: Number(last7.rows[0]?.c ?? 0),
      byArea: rows.map((r) => ({ key: r.area, label: areaLabel(r.area), count: Number(r.count) })),
      areas: EBOOK_INTEREST_AREAS,
    });
  } catch (e: any) {
    console.error("[ADMIN-EBOOK-MKT] waitlist stats HATA:", e?.message);
    return res.status(500).json({ error: "İstatistik alınamadı" });
  }
});

router.get("/admin/ebook-waitlist/export.csv", authMiddleware, adminOnly, async (_req: AuthRequest, res: Response) => {
  try {
    const r = await pool.query(`SELECT ${WL_COLS} FROM ebook_waitlist ORDER BY created_at DESC`);
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [
      ["id", "email", "interest_area", "interest_label", "source", "notified_at", "created_at"].join(","),
      ...r.rows.map((x: any) =>
        [
          x.id, x.email, x.interestArea ?? "", areaLabel(x.interestArea), x.source,
          x.notifiedAt ? new Date(x.notifiedAt).toISOString() : "",
          new Date(x.createdAt).toISOString(),
        ].map(esc).join(","),
      ),
    ];
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="ebook-waitlist-${new Date().toISOString().slice(0, 10)}.csv"`);
    return res.send("﻿" + lines.join("\n"));
  } catch (e: any) {
    console.error("[ADMIN-EBOOK-MKT] waitlist export HATA:", e?.message);
    return res.status(500).json({ error: "Export başarısız" });
  }
});

router.get("/admin/ebook-waitlist", authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const area = typeof req.query.area === "string" ? req.query.area : "";
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 500);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const conds: string[] = [];
    const params: unknown[] = [];
    if (area === "__none__") conds.push(`interest_area IS NULL`);
    else if (area && VALID_AREAS.has(area)) { params.push(area); conds.push(`interest_area = $${params.length}`); }
    if (q) { params.push(`%${q}%`); conds.push(`email ILIKE $${params.length}`); }
    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";

    const [list, cnt] = await Promise.all([
      pool.query(
        `SELECT ${WL_COLS} FROM ebook_waitlist ${where}
         ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset],
      ),
      pool.query(`SELECT count(*)::int AS total FROM ebook_waitlist ${where}`, params),
    ]);

    return res.json({
      entries: list.rows.map((x: any) => ({ ...x, interestLabel: areaLabel(x.interestArea) })),
      total: Number(cnt.rows[0]?.total ?? 0),
      limit,
      offset,
    });
  } catch (e: any) {
    console.error("[ADMIN-EBOOK-MKT] waitlist list HATA:", e?.message);
    return res.status(500).json({ error: "Liste alınamadı" });
  }
});

router.delete("/admin/ebook-waitlist/:id", authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
  const id = numId(req.params.id);
  if (!id) return res.status(400).json({ error: "Geçersiz id" });
  try {
    await pool.query(`DELETE FROM ebook_waitlist WHERE id = $1`, [id]);
    return res.json({ ok: true });
  } catch (e: any) {
    console.error("[ADMIN-EBOOK-MKT] waitlist delete HATA:", e?.message);
    return res.status(500).json({ error: "Silinemedi" });
  }
});

// ─── Ortak reorder (transaction) ─────────────────────────────────────────

async function reorder(table: "ebook_faq" | "ebook_guide", ids: number[]): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (let i = 0; i < ids.length; i++) {
      await client.query(
        `UPDATE ${table} SET display_order = $1, updated_at = NOW() WHERE id = $2`,
        [i + 1, ids[i]],
      );
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

function parseIds(raw: unknown): number[] {
  return Array.isArray(raw) ? (raw.map(numId).filter(Boolean) as number[]) : [];
}

// ─── FAQ ─────────────────────────────────────────────────────────────────

router.get("/admin/ebook-faq", authMiddleware, adminOnly, async (_req: AuthRequest, res: Response) => {
  try {
    const r = await pool.query(`SELECT ${FAQ_COLS} FROM ebook_faq ORDER BY display_order ASC, id ASC`);
    return res.json({ faq: r.rows });
  } catch (e: any) {
    console.error("[ADMIN-EBOOK-MKT] faq list HATA:", e?.message);
    return res.status(500).json({ error: "FAQ alınamadı" });
  }
});

router.post("/admin/ebook-faq", authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
  const question = str(req.body?.question, 300);
  const answer = str(req.body?.answer, 5000);
  if (!question || !answer) return res.status(400).json({ error: "Soru ve cevap zorunlu" });
  try {
    const r = await pool.query(
      `INSERT INTO ebook_faq (question, answer, display_order, is_active)
       VALUES ($1, $2, (SELECT COALESCE(MAX(display_order), 0) + 1 FROM ebook_faq), $3)
       RETURNING ${FAQ_COLS}`,
      [question, answer, req.body?.isActive === false ? false : true],
    );
    return res.status(201).json({ faq: r.rows[0] });
  } catch (e: any) {
    console.error("[ADMIN-EBOOK-MKT] faq create HATA:", e?.message);
    return res.status(500).json({ error: "Oluşturulamadı" });
  }
});

// reorder, :id'den ÖNCE tanımlı olmalı
router.put("/admin/ebook-faq/reorder", authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
  const ids = parseIds(req.body?.ids);
  if (!ids.length) return res.status(400).json({ error: "ids boş" });
  try {
    await reorder("ebook_faq", ids);
    return res.json({ ok: true });
  } catch (e: any) {
    console.error("[ADMIN-EBOOK-MKT] faq reorder HATA:", e?.message);
    return res.status(500).json({ error: "Sıralama kaydedilemedi" });
  }
});

router.patch("/admin/ebook-faq/:id", authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
  const id = numId(req.params.id);
  if (!id) return res.status(400).json({ error: "Geçersiz id" });
  const sets: string[] = ["updated_at = NOW()"];
  const params: unknown[] = [];
  const push = (col: string, v: unknown) => { params.push(v); sets.push(`${col} = $${params.length}`); };
  const question = str(req.body?.question, 300);
  const answer = str(req.body?.answer, 5000);
  if (question !== undefined) push("question", question);
  if (answer !== undefined) push("answer", answer);
  if (typeof req.body?.isActive === "boolean") push("is_active", req.body.isActive);
  if (Number.isInteger(req.body?.displayOrder)) push("display_order", req.body.displayOrder);
  try {
    params.push(id);
    const r = await pool.query(
      `UPDATE ebook_faq SET ${sets.join(", ")} WHERE id = $${params.length} RETURNING ${FAQ_COLS}`,
      params,
    );
    if (!r.rows[0]) return res.status(404).json({ error: "Bulunamadı" });
    return res.json({ faq: r.rows[0] });
  } catch (e: any) {
    console.error("[ADMIN-EBOOK-MKT] faq patch HATA:", e?.message);
    return res.status(500).json({ error: "Güncellenemedi" });
  }
});

router.delete("/admin/ebook-faq/:id", authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
  const id = numId(req.params.id);
  if (!id) return res.status(400).json({ error: "Geçersiz id" });
  try {
    await pool.query(`DELETE FROM ebook_faq WHERE id = $1`, [id]);
    return res.json({ ok: true });
  } catch (e: any) {
    console.error("[ADMIN-EBOOK-MKT] faq delete HATA:", e?.message);
    return res.status(500).json({ error: "Silinemedi" });
  }
});

// ─── GUIDE ───────────────────────────────────────────────────────────────

router.get("/admin/ebook-guide", authMiddleware, adminOnly, async (_req: AuthRequest, res: Response) => {
  try {
    const r = await pool.query(`SELECT ${GUIDE_COLS} FROM ebook_guide ORDER BY display_order ASC, id ASC`);
    return res.json({ guide: r.rows });
  } catch (e: any) {
    console.error("[ADMIN-EBOOK-MKT] guide list HATA:", e?.message);
    return res.status(500).json({ error: "Rehber alınamadı" });
  }
});

router.post("/admin/ebook-guide", authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
  const roleLabel = str(req.body?.roleLabel, 120);
  const description = str(req.body?.description, 2000);
  if (!roleLabel || !description) return res.status(400).json({ error: "Rol ve açıklama zorunlu" });
  try {
    const r = await pool.query(
      `INSERT INTO ebook_guide (role_label, description, cta_text, cta_href, icon, display_order, is_active)
       VALUES ($1, $2, $3, $4, $5, (SELECT COALESCE(MAX(display_order), 0) + 1 FROM ebook_guide), $6)
       RETURNING ${GUIDE_COLS}`,
      [
        roleLabel, description,
        str(req.body?.ctaText, 80) || null,
        str(req.body?.ctaHref, 300) || null,
        str(req.body?.icon, 16) || null,
        req.body?.isActive === false ? false : true,
      ],
    );
    return res.status(201).json({ guide: r.rows[0] });
  } catch (e: any) {
    console.error("[ADMIN-EBOOK-MKT] guide create HATA:", e?.message);
    return res.status(500).json({ error: "Oluşturulamadı" });
  }
});

router.put("/admin/ebook-guide/reorder", authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
  const ids = parseIds(req.body?.ids);
  if (!ids.length) return res.status(400).json({ error: "ids boş" });
  try {
    await reorder("ebook_guide", ids);
    return res.json({ ok: true });
  } catch (e: any) {
    console.error("[ADMIN-EBOOK-MKT] guide reorder HATA:", e?.message);
    return res.status(500).json({ error: "Sıralama kaydedilemedi" });
  }
});

router.patch("/admin/ebook-guide/:id", authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
  const id = numId(req.params.id);
  if (!id) return res.status(400).json({ error: "Geçersiz id" });
  const body = (req.body ?? {}) as Record<string, unknown>;
  const sets: string[] = ["updated_at = NOW()"];
  const params: unknown[] = [];
  const push = (col: string, v: unknown) => { params.push(v); sets.push(`${col} = $${params.length}`); };
  const roleLabel = str(body.roleLabel, 120);
  const description = str(body.description, 2000);
  if (roleLabel !== undefined) push("role_label", roleLabel);
  if (description !== undefined) push("description", description);
  if ("ctaText" in body) push("cta_text", str(body.ctaText, 80) || null);
  if ("ctaHref" in body) push("cta_href", str(body.ctaHref, 300) || null);
  if ("icon" in body) push("icon", str(body.icon, 16) || null);
  if (typeof body.isActive === "boolean") push("is_active", body.isActive);
  if (Number.isInteger(body.displayOrder)) push("display_order", body.displayOrder);
  try {
    params.push(id);
    const r = await pool.query(
      `UPDATE ebook_guide SET ${sets.join(", ")} WHERE id = $${params.length} RETURNING ${GUIDE_COLS}`,
      params,
    );
    if (!r.rows[0]) return res.status(404).json({ error: "Bulunamadı" });
    return res.json({ guide: r.rows[0] });
  } catch (e: any) {
    console.error("[ADMIN-EBOOK-MKT] guide patch HATA:", e?.message);
    return res.status(500).json({ error: "Güncellenemedi" });
  }
});

router.delete("/admin/ebook-guide/:id", authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
  const id = numId(req.params.id);
  if (!id) return res.status(400).json({ error: "Geçersiz id" });
  try {
    await pool.query(`DELETE FROM ebook_guide WHERE id = $1`, [id]);
    return res.json({ ok: true });
  } catch (e: any) {
    console.error("[ADMIN-EBOOK-MKT] guide delete HATA:", e?.message);
    return res.status(500).json({ error: "Silinemedi" });
  }
});

export default router;
