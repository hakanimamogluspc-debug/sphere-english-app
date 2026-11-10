/**
 * Admin — Kitap pratikleri (AI çıkarımı + onay).
 *
 *   GET    /admin/ebook-practice                 → kitaplar + öğe sayıları + iş durumu + yayında mı
 *   GET    /admin/ebook-practice/:ebookId        → öğeler (ünite sırasıyla) + iş durumu
 *   POST   /admin/ebook-practice/:ebookId/extract → çıkarımı başlat (arka planda; taslaklar yenilenir)
 *   PATCH  /admin/ebook-practice/items/:id       → öğeyi düzelt / durumunu değiştir
 *   DELETE /admin/ebook-practice/items/:id
 *   POST   /admin/ebook-practice/:ebookId/bulk-status { status, unitOrder? | ids? }
 *   POST   /admin/ebook-practice/:ebookId/publish { published }
 */

import { Router, type Response } from "express";
import { pool } from "@workspace/db";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth.js";
import { claimExtractionJob, runPracticeExtraction } from "../lib/ebook-practice-extract.js";

const router = Router();
const adminOnly = requireRole("admin");
const STATUSES = ["draft", "approved", "hidden"] as const;

function mapItem(x: any) {
  return {
    id: x.id, unitOrder: x.unit_order, unitTitle: x.unit_title, position: x.position, kind: x.kind,
    en: x.en, tr: x.tr, explanation: x.explanation, exampleEn: x.example_en, exampleTr: x.example_tr,
    sourcePages: x.source_pages, status: x.status,
  };
}

async function jobOf(ebookId: number) {
  const j = (await pool.query(`SELECT * FROM ebook_practice_jobs WHERE ebook_id = $1`, [ebookId])).rows[0];
  return j ? { status: j.status, done: j.done, total: j.total, itemCount: j.item_count, error: j.error, startedAt: j.started_at, finishedAt: j.finished_at } : null;
}

router.get("/admin/ebook-practice", authMiddleware, adminOnly, async (_req: AuthRequest, res: Response) => {
  const r = await pool.query(
    `SELECT e.id, e.title, e.category, e.practice_published,
            COUNT(i.id) FILTER (WHERE i.status = 'draft')::int AS drafts,
            COUNT(i.id) FILTER (WHERE i.status = 'approved')::int AS approved,
            COUNT(i.id) FILTER (WHERE i.status = 'hidden')::int AS hidden,
            j.status AS job_status, j.done AS job_done, j.total AS job_total,
            EXISTS (SELECT 1 FROM ebook_assets a WHERE a.ebook_id = e.id AND a.asset_type = 'full') AS has_file
     FROM ebooks e
     LEFT JOIN ebook_practice_items i ON i.ebook_id = e.id
     LEFT JOIN ebook_practice_jobs j ON j.ebook_id = e.id
     WHERE e.is_active = TRUE
     GROUP BY e.id, j.status, j.done, j.total
     ORDER BY e.series_order NULLS LAST, e.id`,
  );
  res.json({
    books: r.rows.map((x: any) => ({
      id: x.id, title: x.title, category: x.category, published: x.practice_published, hasFile: x.has_file,
      drafts: x.drafts, approved: x.approved, hidden: x.hidden,
      job: x.job_status ? { status: x.job_status, done: x.job_done, total: x.job_total } : null,
    })),
  });
});

router.get("/admin/ebook-practice/:ebookId", authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
  const ebookId = Number(req.params.ebookId);
  const book = (await pool.query(`SELECT id, title, practice_published FROM ebooks WHERE id = $1`, [ebookId])).rows[0];
  if (!book) return res.status(404).json({ error: "Kitap bulunamadı" });
  const items = await pool.query(
    `SELECT * FROM ebook_practice_items WHERE ebook_id = $1 ORDER BY unit_order, position, id`, [ebookId],
  );
  return res.json({
    book: { id: book.id, title: book.title, published: book.practice_published },
    job: await jobOf(ebookId),
    items: items.rows.map(mapItem),
  });
});

router.post("/admin/ebook-practice/:ebookId/extract", authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
  const ebookId = Number(req.params.ebookId);
  const ok = (await pool.query(
    `SELECT 1 FROM ebook_assets WHERE ebook_id = $1 AND asset_type = 'full' LIMIT 1`, [ebookId],
  )).rows.length > 0;
  if (!ok) return res.status(400).json({ error: "Bu kitabın tam PDF'i yüklenmemiş" });
  if (!(await claimExtractionJob(ebookId))) return res.status(409).json({ error: "Çıkarım zaten çalışıyor" });
  // Arka planda — birkaç dakika sürebilir; admin ekranı durumu yoklar
  runPracticeExtraction(ebookId).catch(() => {});
  return res.status(202).json({ ok: true, job: await jobOf(ebookId) });
});

router.patch("/admin/ebook-practice/items/:id", authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const b = req.body ?? {};
  const sets: string[] = [];
  const vals: unknown[] = [];
  const add = (col: string, v: unknown) => { vals.push(v); sets.push(`${col} = $${vals.length}`); };
  const txt = (v: unknown) => (v === null || v === undefined ? null : String(v).trim() || null);

  if (b.en !== undefined) {
    const en = String(b.en).trim();
    if (!en) return res.status(400).json({ error: "İngilizce alan boş olamaz" });
    add("en", en);
  }
  if (b.tr !== undefined) add("tr", String(b.tr ?? "").trim());
  if (b.explanation !== undefined) add("explanation", txt(b.explanation));
  if (b.exampleEn !== undefined) add("example_en", txt(b.exampleEn));
  if (b.exampleTr !== undefined) add("example_tr", txt(b.exampleTr));
  if (b.unitTitle !== undefined) add("unit_title", String(b.unitTitle ?? "").trim().slice(0, 300));
  if (b.kind !== undefined) {
    if (b.kind !== "pattern" && b.kind !== "term") return res.status(400).json({ error: "Tür geçersiz" });
    add("kind", b.kind);
  }
  if (b.status !== undefined) {
    if (!STATUSES.includes(b.status)) return res.status(400).json({ error: "Durum geçersiz" });
    add("status", b.status);
  }
  if (sets.length === 0) return res.status(400).json({ error: "Değişiklik yok" });
  vals.push(id);
  const r = await pool.query(
    `UPDATE ebook_practice_items SET ${sets.join(", ")}, updated_at = NOW() WHERE id = $${vals.length} RETURNING *`, vals,
  );
  if (!r.rows[0]) return res.status(404).json({ error: "Öğe bulunamadı" });
  return res.json({ item: mapItem(r.rows[0]) });
});

router.delete("/admin/ebook-practice/items/:id", authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
  const r = await pool.query(`DELETE FROM ebook_practice_items WHERE id = $1`, [Number(req.params.id)]);
  if (!r.rowCount) return res.status(404).json({ error: "Öğe bulunamadı" });
  return res.json({ ok: true });
});

router.post("/admin/ebook-practice/:ebookId/bulk-status", authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
  const ebookId = Number(req.params.ebookId);
  const { status, unitOrder, ids } = req.body ?? {};
  if (!STATUSES.includes(status)) return res.status(400).json({ error: "Durum geçersiz" });
  let r;
  if (Array.isArray(ids) && ids.length > 0) {
    r = await pool.query(
      `UPDATE ebook_practice_items SET status = $1, updated_at = NOW() WHERE ebook_id = $2 AND id = ANY($3::int[])`,
      [status, ebookId, ids.map(Number)],
    );
  } else if (Number.isInteger(unitOrder)) {
    r = await pool.query(
      `UPDATE ebook_practice_items SET status = $1, updated_at = NOW() WHERE ebook_id = $2 AND unit_order = $3 AND status <> 'hidden'`,
      [status, ebookId, unitOrder],
    );
  } else {
    return res.status(400).json({ error: "ids ya da unitOrder gerekli" });
  }
  return res.json({ ok: true, updated: r.rowCount ?? 0 });
});

router.post("/admin/ebook-practice/:ebookId/publish", authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
  const ebookId = Number(req.params.ebookId);
  const published = req.body?.published === true;
  if (published) {
    const n = (await pool.query(
      `SELECT COUNT(*)::int AS n FROM ebook_practice_items WHERE ebook_id = $1 AND status = 'approved'`, [ebookId],
    )).rows[0].n;
    if (n === 0) return res.status(400).json({ error: "Yayına almak için en az bir onaylı öğe gerekli" });
  }
  const r = await pool.query(`UPDATE ebooks SET practice_published = $2 WHERE id = $1`, [ebookId, published]);
  if (!r.rowCount) return res.status(404).json({ error: "Kitap bulunamadı" });
  return res.json({ ok: true, published });
});

export default router;
