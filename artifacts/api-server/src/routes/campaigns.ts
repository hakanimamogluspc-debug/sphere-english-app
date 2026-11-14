/**
 * Kampanyalar.
 *
 * Public:
 *   GET  /campaigns/active   → yayındaki kampanyalar (site rozetleri, ana sayfa banner'ı)
 *   POST /campaigns/quote    { items: [{type, slug}], couponCode? } → fiyat teklifi (kampanya vs kupon en iyisi)
 * Admin:
 *   GET    /admin/campaigns            → tümü
 *   GET    /admin/campaigns/options    → hedef seçimi için kitap/kurs listesi
 *   POST   /admin/campaigns
 *   PATCH  /admin/campaigns/:id
 *   DELETE /admin/campaigns/:id        (kullanılmışsa silinmez, pasife alınır)
 */

import { Router, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth.js";
import { validateCampaignParams } from "../lib/campaign-engine.js";
import { quoteCart, publicCampaign, rowToCampaign } from "../lib/campaigns.js";

const router = Router();
const adminOnly = requireRole("admin");
const TYPES = ["timed_discount", "buy_x_pay_y", "cart_threshold", "tiered_quantity"];
const SCOPES = ["ebook", "course", "all"];
const CATS = ["seri", "beceri", "sektorel"];

router.get("/campaigns/active", async (_req: Request, res: Response) => {
  const rows = (await pool.query(
    `SELECT * FROM campaigns WHERE is_active = TRUE AND (starts_at IS NULL OR starts_at <= NOW()) AND (ends_at IS NULL OR ends_at >= NOW())
     ORDER BY priority DESC, id`,
  )).rows;
  res.setHeader("Cache-Control", "public, max-age=60");
  res.json({ campaigns: rows.map((r: any) => publicCampaign({ ...rowToCampaign(r), description: r.description, showOnHome: r.show_on_home })) });
});

router.post("/campaigns/quote", async (req: Request, res: Response) => {
  const { items, couponCode } = req.body ?? {};
  const r = await quoteCart(items, couponCode);
  if ("error" in r) return res.status(400).json({ error: r.error });
  const q = r.quote;
  return res.json({
    lines: q.lines.map((l) => ({
      type: l.kind, id: l.refId, slug: l.slug, title: l.title,
      listKurus: l.unitKurus, saleKurus: l.saleKurus, finalKurus: l.finalKurus, timedCampaignId: l.timedCampaignId,
    })),
    listKurus: q.listKurus, saleKurus: q.saleKurus,
    cartCampaign: q.cartCampaign, coupon: q.coupon, applied: q.applied, couponNote: q.couponNote,
    couponError: r.couponError ?? null, affiliateCode: r.affiliateCode ?? null,
    totalDiscountKurus: q.totalDiscountKurus, finalKurus: q.finalKurus,
  });
});

// ─── Admin ──────────────────────────────────────────────────────────────

function mapAdmin(r: any) {
  return {
    ...publicCampaign({ ...rowToCampaign(r), description: r.description, showOnHome: r.show_on_home }),
    startsAt: r.starts_at, isActive: r.is_active, priority: r.priority, usedCount: r.used_count,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

/** Gövdeyi doğrula ve kolon değerlerine çevir */
function parseBody(b: any, partial: boolean): { values: Record<string, unknown> } | { error: string } {
  const v: Record<string, unknown> = {};
  if (!partial || b.name !== undefined) {
    const name = String(b.name ?? "").trim();
    if (!name) return { error: "Kampanya adı gerekli" };
    v.name = name.slice(0, 200);
  }
  if (!partial || b.type !== undefined) {
    if (!TYPES.includes(b.type)) return { error: "Kampanya türü geçersiz" };
    v.type = b.type;
  }
  if (b.scope !== undefined) {
    if (!SCOPES.includes(b.scope)) return { error: "Kapsam geçersiz" };
    v.scope = b.scope;
  }
  if (b.targetEbookIds !== undefined) v.target_ebook_ids = (Array.isArray(b.targetEbookIds) ? b.targetEbookIds : []).map(Number).filter(Number.isInteger);
  if (b.targetCategories !== undefined) v.target_categories = (Array.isArray(b.targetCategories) ? b.targetCategories : []).filter((c: string) => CATS.includes(c));
  if (b.targetCourseSlugs !== undefined) v.target_course_slugs = (Array.isArray(b.targetCourseSlugs) ? b.targetCourseSlugs : []).map(String);
  if (b.params !== undefined) v.params = JSON.stringify(b.params ?? {});
  if (b.badgeText !== undefined) v.badge_text = String(b.badgeText ?? "").trim().slice(0, 60) || null;
  if (b.description !== undefined) v.description = String(b.description ?? "").trim() || null;
  if (b.startsAt !== undefined) v.starts_at = b.startsAt ? new Date(b.startsAt) : null;
  if (b.endsAt !== undefined) v.ends_at = b.endsAt ? new Date(b.endsAt) : null;
  if (b.isActive !== undefined) v.is_active = b.isActive === true;
  if (b.showOnHome !== undefined) v.show_on_home = b.showOnHome === true;
  if (b.priority !== undefined) v.priority = Math.round(Number(b.priority) || 0);
  for (const k of ["starts_at", "ends_at"]) {
    const d = v[k] as Date | null | undefined;
    if (d instanceof Date && Number.isNaN(d.getTime())) return { error: "Tarih geçersiz" };
  }
  return { values: v };
}

router.get("/admin/campaigns", authMiddleware, adminOnly, async (_req: AuthRequest, res: Response) => {
  const r = await pool.query(`SELECT * FROM campaigns ORDER BY is_active DESC, priority DESC, id DESC`);
  res.json({ campaigns: r.rows.map(mapAdmin) });
});

router.get("/admin/campaigns/options", authMiddleware, adminOnly, async (_req: AuthRequest, res: Response) => {
  const [e, c] = await Promise.all([
    pool.query(`SELECT id, title, category, price_try FROM ebooks WHERE is_active = TRUE ORDER BY series_order NULLS LAST, id`),
    pool.query(`SELECT slug, title, price_kurus FROM marketing_courses WHERE is_active = TRUE ORDER BY id`),
  ]);
  res.json({
    ebooks: e.rows.map((x: any) => ({ id: x.id, title: x.title, category: x.category, priceKurus: Math.round(Number(x.price_try) * 100) })),
    courses: c.rows.map((x: any) => ({ slug: x.slug, title: x.title, priceKurus: Number(x.price_kurus) })),
  });
});

router.post("/admin/campaigns", authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
  const p = parseBody(req.body ?? {}, false);
  if ("error" in p) return res.status(400).json({ error: p.error });
  const err = validateCampaignParams(String(p.values.type), req.body?.params ?? {});
  if (err) return res.status(400).json({ error: err });
  const keys = Object.keys(p.values);
  const r = await pool.query(
    `INSERT INTO campaigns (${keys.join(", ")}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(", ")}) RETURNING *`,
    keys.map((k) => p.values[k]),
  );
  return res.status(201).json({ campaign: mapAdmin(r.rows[0]) });
});

router.patch("/admin/campaigns/:id", authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const cur = (await pool.query(`SELECT * FROM campaigns WHERE id = $1`, [id])).rows[0];
  if (!cur) return res.status(404).json({ error: "Kampanya bulunamadı" });
  const p = parseBody(req.body ?? {}, true);
  if ("error" in p) return res.status(400).json({ error: p.error });
  const type = String(p.values.type ?? cur.type);
  const params = req.body?.params ?? cur.params;
  const err = validateCampaignParams(type, params);
  if (err) return res.status(400).json({ error: err });
  const keys = Object.keys(p.values);
  if (keys.length === 0) return res.status(400).json({ error: "Değişiklik yok" });
  const r = await pool.query(
    `UPDATE campaigns SET ${keys.map((k, i) => `${k} = $${i + 1}`).join(", ")}, updated_at = NOW() WHERE id = $${keys.length + 1} RETURNING *`,
    [...keys.map((k) => p.values[k]), id],
  );
  return res.json({ campaign: mapAdmin(r.rows[0]) });
});

router.delete("/admin/campaigns/:id", authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const used = (await pool.query(
    `SELECT (SELECT COUNT(*) FROM ebook_purchases WHERE campaign_id = $1) + (SELECT COUNT(*) FROM course_orders WHERE campaign_id = $1) AS n`, [id],
  )).rows[0];
  if (Number(used?.n ?? 0) > 0) {
    await pool.query(`UPDATE campaigns SET is_active = FALSE, updated_at = NOW() WHERE id = $1`, [id]);
    return res.status(409).json({ error: "Bu kampanyayla satış yapılmış; silinmedi, pasife alındı." });
  }
  const r = await pool.query(`DELETE FROM campaigns WHERE id = $1`, [id]);
  if (!r.rowCount) return res.status(404).json({ error: "Kampanya bulunamadı" });
  return res.json({ ok: true });
});

export default router;
