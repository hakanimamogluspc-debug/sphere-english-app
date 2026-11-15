/**
 * Ana sayfa banner'ları (www hero slaytları).
 *
 *   GET    /home-banners                → yayındaki slaytlar (sırayla). "Kampanyayı öne çıkar" açık slaytta
 *                                          ana sayfada gösterilecek yayındaki kampanya varsa etiket/metin ondan gelir.
 *   GET    /admin/home-banners
 *   POST   /admin/home-banners
 *   PATCH  /admin/home-banners/:id
 *   DELETE /admin/home-banners/:id
 */

import { Router, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth.js";

const router = Router();
const adminOnly = requireRole("admin");
const SLOTS = ["ebook", "course", "general"];

function map(r: any) {
  return {
    id: r.id, slot: r.slot, sortOrder: r.sort_order, isActive: r.is_active,
    eyebrow: r.eyebrow, titleLine1: r.title_line1, titleLine2: r.title_line2, titleAccent: r.title_accent,
    subtitle: r.subtitle, cta1Text: r.cta1_text, cta1Url: r.cta1_url, cta2Text: r.cta2_text, cta2Url: r.cta2_url,
    imageUrl: r.image_url, imageAlt: r.image_alt, imageBadge: r.image_badge, useCampaign: r.use_campaign,
    startsAt: r.starts_at, endsAt: r.ends_at,
  };
}

/** Kampanyanın kısa etiketi (rozet metni yoksa kurala göre) */
function campaignLabel(c: any): string {
  if (c.badge_text) return c.badge_text;
  const p = c.params ?? {};
  const tl = (k: number) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(k / 100);
  const disc = p.discountType === "fixed" ? `${tl(Number(p.value) * 100)} indirim` : `%${p.value} indirim`;
  if (c.type === "buy_x_pay_y") return `${p.buy} al ${p.pay} öde`;
  if (c.type === "cart_threshold") return `${tl(Number(p.minKurus))} üzeri ${disc}`;
  if (c.type === "tiered_quantity") return "Çoklu alımda indirim";
  return disc;
}

router.get("/home-banners", async (_req: Request, res: Response) => {
  const [b, c] = await Promise.all([
    pool.query(
      `SELECT * FROM home_banners WHERE is_active = TRUE
         AND (starts_at IS NULL OR starts_at <= NOW()) AND (ends_at IS NULL OR ends_at >= NOW())
       ORDER BY sort_order, id`,
    ),
    pool.query(
      `SELECT * FROM campaigns WHERE is_active = TRUE AND show_on_home = TRUE
         AND (starts_at IS NULL OR starts_at <= NOW()) AND (ends_at IS NULL OR ends_at >= NOW())
       ORDER BY priority DESC, id DESC LIMIT 1`,
    ),
  ]);
  const camp = c.rows[0];
  const banners = b.rows.map((r: any) => {
    const m: any = map(r);
    if (r.use_campaign && camp) {
      m.campaign = { id: camp.id, label: campaignLabel(camp), description: camp.description ?? null, endsAt: camp.ends_at };
      m.eyebrow = campaignLabel(camp).toLocaleUpperCase("tr-TR");
      if (camp.description) m.subtitle = camp.description;
    }
    return m;
  });
  res.setHeader("Cache-Control", "public, max-age=60");
  res.json({ banners });
});

function parse(b: any, partial: boolean): { v: Record<string, unknown> } | { error: string } {
  const v: Record<string, unknown> = {};
  const str = (x: unknown, max: number) => (x === null || x === undefined ? null : String(x).trim().slice(0, max) || null);
  if (!partial || b.titleLine1 !== undefined) {
    const t = str(b.titleLine1, 80);
    if (!t) return { error: "Başlığın ilk satırı gerekli" };
    v.title_line1 = t;
  }
  if (b.slot !== undefined) { if (!SLOTS.includes(b.slot)) return { error: "Slot geçersiz" }; v.slot = b.slot; }
  if (b.sortOrder !== undefined) v.sort_order = Math.round(Number(b.sortOrder) || 0);
  if (b.isActive !== undefined) v.is_active = b.isActive === true;
  if (b.useCampaign !== undefined) v.use_campaign = b.useCampaign === true;
  for (const [k, col, max] of [
    ["eyebrow", "eyebrow", 80], ["titleLine2", "title_line2", 80], ["titleAccent", "title_accent", 80],
    ["subtitle", "subtitle", 600], ["cta1Text", "cta1_text", 60], ["cta2Text", "cta2_text", 60],
    ["imageAlt", "image_alt", 200], ["imageBadge", "image_badge", 80],
  ] as const) if (b[k] !== undefined) v[col] = str(b[k], max);
  for (const [k, col] of [["cta1Url", "cta1_url"], ["cta2Url", "cta2_url"], ["imageUrl", "image_url"]] as const) {
    if (b[k] === undefined) continue;
    const u = str(b[k], 500);
    if (u && !/^(\/|https:\/\/)/.test(u)) return { error: "Bağlantılar / ile ya da https:// ile başlamalı" };
    v[col] = u;
  }
  for (const [k, col] of [["startsAt", "starts_at"], ["endsAt", "ends_at"]] as const) {
    if (b[k] === undefined) continue;
    const d = b[k] ? new Date(b[k]) : null;
    if (d && Number.isNaN(d.getTime())) return { error: "Tarih geçersiz" };
    v[col] = d;
  }
  return { v };
}

router.get("/admin/home-banners", authMiddleware, adminOnly, async (_req: AuthRequest, res: Response) => {
  const r = await pool.query(`SELECT * FROM home_banners ORDER BY sort_order, id`);
  res.json({ banners: r.rows.map(map) });
});

router.post("/admin/home-banners", authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
  const p = parse(req.body ?? {}, false);
  if ("error" in p) return res.status(400).json({ error: p.error });
  const keys = Object.keys(p.v);
  const r = await pool.query(
    `INSERT INTO home_banners (${keys.join(", ")}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(", ")}) RETURNING *`,
    keys.map((k) => p.v[k]),
  );
  return res.status(201).json({ banner: map(r.rows[0]) });
});

router.patch("/admin/home-banners/:id", authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
  const p = parse(req.body ?? {}, true);
  if ("error" in p) return res.status(400).json({ error: p.error });
  const keys = Object.keys(p.v);
  if (keys.length === 0) return res.status(400).json({ error: "Değişiklik yok" });
  const r = await pool.query(
    `UPDATE home_banners SET ${keys.map((k, i) => `${k} = $${i + 1}`).join(", ")}, updated_at = NOW() WHERE id = $${keys.length + 1} RETURNING *`,
    [...keys.map((k) => p.v[k]), Number(req.params.id)],
  );
  if (!r.rows[0]) return res.status(404).json({ error: "Banner bulunamadı" });
  return res.json({ banner: map(r.rows[0]) });
});

router.delete("/admin/home-banners/:id", authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
  const r = await pool.query(`DELETE FROM home_banners WHERE id = $1`, [Number(req.params.id)]);
  if (!r.rowCount) return res.status(404).json({ error: "Banner bulunamadı" });
  return res.json({ ok: true });
});

export default router;
