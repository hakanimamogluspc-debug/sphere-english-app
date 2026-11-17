/**
 * Admin → E-Kitap Tanımlama: seçilen öğrencilere satın alma olmadan e-kitap verir.
 *
 * Tanımlanan kitap öğrencinin uygulamadaki Kitaplarım bölümünde görünür (okuma + pratik).
 * Satış kaydı açılmaz: satış istatistikleri, faturalar, indirme sayıları ve reklam ölçümleri etkilenmez.
 * PDF indirme bağlantısı üretilmez; kitap uygulama içinden okunur.
 *
 *   GET    /admin/ebook-grants/users?q=      → öğrenci ara (ad, e-posta, öğrenci no)
 *   GET    /admin/ebook-grants/options       → yayındaki kitaplar + paketler (paket = kitap kümesi kısayolu)
 *   GET    /admin/ebook-grants?userId=&q=    → tanımlama kayıtları
 *   POST   /admin/ebook-grants               → { userIds[], ebookIds[], note?, notify? }
 *   DELETE /admin/ebook-grants/:id           → tanımlamayı geri al
 */

import { Router, type Response } from "express";
import { pool } from "@workspace/db";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth.js";
import { sendEmail } from "../lib/email.js";
import { libraryUrl } from "../lib/ebook-library.js";

const router = Router();
const adminOnly = requireRole("admin");
const MAX_USERS = 200;
const MAX_BOOKS = 100;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

function ids(v: unknown, max: number): number[] | null {
  if (!Array.isArray(v) || v.length === 0 || v.length > max) return null;
  const out = [...new Set(v.map((x) => Number(x)))];
  return out.every((n) => Number.isInteger(n) && n > 0) ? out : null;
}

router.get("/admin/ebook-grants/users", authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
  const q = String(req.query.q ?? "").trim().toLowerCase().slice(0, 100);
  const like = `%${q}%`;
  const r = await pool.query(
    `SELECT u.id, u.first_name, u.last_name, u.email, u.student_number, u.role,
            (SELECT c.name FROM companies c WHERE c.id = u.company_id) AS company,
            (SELECT COUNT(DISTINCT x.ebook_id)::int FROM (
               SELECT p.ebook_id FROM ebook_purchases p WHERE p.user_id = u.id AND p.payment_status = 'success'
               UNION SELECT g.ebook_id FROM ebook_grants g WHERE g.user_id = u.id
             ) x) AS book_count
     FROM users u
     WHERE u.role IN ('student', 'corporate')
       AND ($1 = '' OR lower(u.email) LIKE $2 OR lower(u.first_name || ' ' || u.last_name) LIKE $2
            OR lower(COALESCE(u.student_number, '')) LIKE $2)
     ORDER BY u.created_at DESC
     LIMIT 30`,
    [q, like],
  );
  res.json({
    users: r.rows.map((u: any) => ({
      id: u.id, name: `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim(), email: u.email,
      studentNumber: u.student_number, role: u.role, company: u.company, bookCount: u.book_count,
    })),
  });
});

router.get("/admin/ebook-grants/options", authMiddleware, adminOnly, async (_req: AuthRequest, res: Response) => {
  const [e, b] = await Promise.all([
    pool.query(`SELECT id, title, subtitle, category, series_order FROM ebooks WHERE is_active = TRUE ORDER BY series_order NULLS LAST, title`),
    pool.query(
      `SELECT b.id, b.title, COALESCE(array_agg(bi.ebook_id ORDER BY bi.position) FILTER (WHERE bi.ebook_id IS NOT NULL), '{}') AS ebook_ids
       FROM ebook_bundles b LEFT JOIN ebook_bundle_items bi ON bi.bundle_id = b.id
       GROUP BY b.id ORDER BY b.id`,
    ),
  ]);
  res.json({
    ebooks: e.rows.map((x: any) => ({ id: x.id, title: x.title, subtitle: x.subtitle, category: x.category })),
    bundles: b.rows.map((x: any) => ({ id: x.id, title: x.title, ebookIds: x.ebook_ids })).filter((x: any) => x.ebookIds.length > 0),
  });
});

router.get("/admin/ebook-grants", authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
  const userId = Number(req.query.userId);
  const q = String(req.query.q ?? "").trim().toLowerCase().slice(0, 100);
  const r = await pool.query(
    `SELECT g.id, g.note, g.created_at, g.user_id, g.ebook_id,
            u.first_name, u.last_name, u.email, e.title,
            (SELECT a.first_name || ' ' || a.last_name FROM users a WHERE a.id = g.granted_by) AS granted_by
     FROM ebook_grants g JOIN users u ON u.id = g.user_id JOIN ebooks e ON e.id = g.ebook_id
     WHERE ($1::int IS NULL OR g.user_id = $1)
       AND ($2 = '' OR lower(u.email) LIKE $3 OR lower(u.first_name || ' ' || u.last_name) LIKE $3 OR lower(e.title) LIKE $3)
     ORDER BY g.created_at DESC, g.id DESC
     LIMIT 300`,
    [Number.isInteger(userId) && userId > 0 ? userId : null, q, `%${q}%`],
  );
  res.json({
    grants: r.rows.map((g: any) => ({
      id: g.id, userId: g.user_id, ebookId: g.ebook_id, note: g.note, createdAt: g.created_at,
      userName: `${g.first_name ?? ""} ${g.last_name ?? ""}`.trim(), email: g.email, title: g.title, grantedBy: g.granted_by,
    })),
  });
});

router.post("/admin/ebook-grants", authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
  const userIds = ids(req.body?.userIds, MAX_USERS);
  const ebookIds = ids(req.body?.ebookIds, MAX_BOOKS);
  if (!userIds) return res.status(400).json({ error: "En az bir öğrenci seçin" });
  if (!ebookIds) return res.status(400).json({ error: "En az bir kitap seçin" });
  const note = String(req.body?.note ?? "").trim().slice(0, 300) || null;
  const notify = req.body?.notify === true;

  const [users, books] = await Promise.all([
    pool.query(`SELECT id, first_name, email FROM users WHERE id = ANY($1::int[])`, [userIds]),
    pool.query(`SELECT id, title FROM ebooks WHERE id = ANY($1::int[]) AND is_active = TRUE`, [ebookIds]),
  ]);
  if (users.rows.length !== userIds.length) return res.status(400).json({ error: "Seçilen öğrencilerden biri bulunamadı" });
  if (books.rows.length !== ebookIds.length) return res.status(400).json({ error: "Seçilen kitaplardan biri yayında değil" });

  // Öğrencinin zaten sahip olduğu (satın aldığı ya da daha önce tanımlanmış) kitaplar atlanır.
  const ins = await pool.query(
    `INSERT INTO ebook_grants (user_id, ebook_id, granted_by, note)
     SELECT u.id, e.id, $3, $4
     FROM unnest($1::int[]) AS u(id) CROSS JOIN unnest($2::int[]) AS e(id)
     WHERE NOT EXISTS (SELECT 1 FROM ebook_purchases p WHERE p.user_id = u.id AND p.ebook_id = e.id AND p.payment_status = 'success')
     ON CONFLICT (user_id, ebook_id) DO NOTHING
     RETURNING user_id, ebook_id`,
    [userIds, ebookIds, req.userId, note],
  );
  const granted = ins.rows.length;
  const skipped = userIds.length * ebookIds.length - granted;
  console.info(`[ebook-grants] admin=${req.userId} ${granted} tanımlama (${skipped} atlandı), ${userIds.length} öğrenci × ${ebookIds.length} kitap`);

  // İsteğe bağlı bilgilendirme: yalnızca yeni kitap tanımlanan öğrencilere, yalnızca yeni kitapların adıyla.
  let mailed = 0;
  if (notify && granted > 0) {
    const titleOf = new Map<number, string>(books.rows.map((b: any) => [b.id, b.title]));
    const byUser = new Map<number, string[]>();
    for (const row of ins.rows as any[]) {
      byUser.set(row.user_id, [...(byUser.get(row.user_id) ?? []), titleOf.get(row.ebook_id) ?? ""]);
    }
    await Promise.all(users.rows.filter((u: any) => byUser.has(u.id)).map(async (u: any) => {
      const titles = byUser.get(u.id)!;
      const html = `<div style="font-family:-apple-system,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1e3a6e">
  <h1 style="font-size:20px;margin:0 0 12px">Kitaplığına yeni kitap eklendi</h1>
  <p style="font-size:15px;line-height:1.6;color:#374151">Merhaba ${esc(u.first_name ?? "")},</p>
  <p style="font-size:15px;line-height:1.6;color:#374151">Sphere English hesabına şu ${titles.length > 1 ? "kitaplar" : "kitap"} tanımlandı:</p>
  <ul style="font-size:15px;line-height:1.7;color:#1e3a6e;padding-left:20px">${titles.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
  <p style="font-size:15px;line-height:1.6;color:#374151">Uygulamadaki Kitaplarım bölümünden okuyabilirsin.</p>
  <p style="margin:20px 0"><a href="${libraryUrl()}" style="background:#1e3a6e;color:#fff;font-weight:700;text-decoration:none;padding:12px 24px;border-radius:10px;display:inline-block">Kitaplarım'a git</a></p>
</div>`;
      try {
        const r = await sendEmail(u.email, "Kitaplığına yeni kitap eklendi", html);
        if (r?.ok) mailed++;
      } catch (e: any) {
        console.warn("[ebook-grants] bilgilendirme maili gönderilemedi:", e?.message);
      }
    }));
  }
  return res.status(201).json({ ok: true, granted, skipped, mailed });
});

router.delete("/admin/ebook-grants/:id", authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
  const r = await pool.query(`DELETE FROM ebook_grants WHERE id = $1`, [Number(req.params.id)]);
  if (!r.rowCount) return res.status(404).json({ error: "Kayıt bulunamadı" });
  console.info(`[ebook-grants] admin=${req.userId} tanımlama geri alındı id=${req.params.id}`);
  return res.json({ ok: true });
});

export default router;
