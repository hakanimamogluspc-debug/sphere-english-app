/**
 * www pop-up'ları + bülten aboneliği (kişiye özel tek kullanımlık hoş geldin kuponu).
 *
 * PUBLIC
 *   GET  /api/popups/active                 → yayındaki pop-up'lar (öncelik sırasıyla)
 *   POST /api/popups/:id/event {type}        → view | click (istatistik)
 *   POST /api/newsletter/subscribe           → { email, popupId, consent: true } → kupon üret + e-posta
 *   GET  /api/newsletter/unsubscribe?e=&s=   → imzalı bağlantıyla bültenden çık
 *
 * ADMIN
 *   GET/POST /api/admin/popups, PATCH/DELETE /api/admin/popups/:id
 *   GET /api/admin/newsletter, GET /api/admin/newsletter/export.csv
 */

import { Router, type Request, type Response } from "express";
import crypto from "node:crypto";
import { pool } from "@workspace/db";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth.js";
import { sendEmail } from "../lib/email.js";

const router = Router();
const adminOnly = requireRole("admin");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const WWW = (process.env.WWW_URL ?? "https://www.sphereenglish.com").replace(/\/$/, "");
const API_PUBLIC = (process.env.PUBLIC_API_URL || "https://app.sphereenglish.com/api").replace(/\/+$/, "");

/** Kayıt anında kullanıcıya gösterilen ve veritabanına aynen yazılan onay metni (ispat için). */
export const NEWSLETTER_CONSENT_TEXT =
  "Sphere English'ten yeni kitap, kurs, kampanya ve duyuru e-postaları almayı kabul ediyorum. " +
  "İstediğim zaman e-postalardaki bağlantıyla tek tıkla ayrılabilirim.";

const KINDS = new Set(["announcement", "newsletter"]);
const SCOPES = new Set(["ebook", "subscription_all", "subscription_monthly", "subscription_yearly"]);

function numId(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}
function str(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}
function intIn(v: unknown, min: number, max: number, def: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : def;
}
const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

function secret(): string {
  return process.env.UNSUBSCRIBE_SECRET || process.env.JWT_SECRET || process.env.INTERNAL_TOKEN || "sphere-unsubscribe";
}
export function newsletterUnsubSig(email: string): string {
  return crypto.createHmac("sha256", secret()).update(`nl:${email.toLowerCase()}`).digest("base64url").slice(0, 22);
}
export function newsletterUnsubUrl(email: string): string {
  return `${API_PUBLIC}/newsletter/unsubscribe?e=${encodeURIComponent(email.toLowerCase())}&s=${newsletterUnsubSig(email)}`;
}

function discountLabel(type: string | null, value: unknown): string | null {
  const v = Number(value);
  if (!type || !(v > 0)) return null;
  return type === "percentage" ? `%${Math.round(v)} indirim` : `${Math.round(v)} TL indirim`;
}

const PUBLIC_COLS = `id, kind, title, body, image_url AS "imageUrl", cta_text AS "ctaText", cta_url AS "ctaUrl",
  delay_seconds AS "delaySeconds", frequency_days AS "frequencyDays", priority,
  coupon_discount_type AS "couponDiscountType", coupon_discount_value AS "couponDiscountValue",
  coupon_valid_days AS "couponValidDays", updated_at AS "updatedAt"`;
const ADMIN_COLS = `${PUBLIC_COLS}, is_active AS "isActive", starts_at AS "startsAt", ends_at AS "endsAt",
  coupon_applies_to AS "couponAppliesTo", views, clicks, signups, created_at AS "createdAt"`;

// ─── PUBLIC ───────────────────────────────────────────────────────────────

router.get("/popups/active", async (_req: Request, res: Response) => {
  try {
    const r = await pool.query(
      `SELECT ${PUBLIC_COLS} FROM site_popups
        WHERE is_active = TRUE
          AND (starts_at IS NULL OR starts_at <= NOW())
          AND (ends_at IS NULL OR ends_at > NOW())
        ORDER BY priority DESC, id DESC
        LIMIT 5`,
    );
    res.setHeader("Cache-Control", "public, max-age=60");
    return res.json({
      popups: r.rows.map((p: any) => ({
        ...p,
        couponLabel: p.kind === "newsletter" ? discountLabel(p.couponDiscountType, p.couponDiscountValue) : null,
        consentText: p.kind === "newsletter" ? NEWSLETTER_CONSENT_TEXT : null,
      })),
    });
  } catch (e: any) {
    console.error("[popups] active HATA:", e?.message);
    return res.json({ popups: [] });
  }
});

router.post("/popups/:id/event", async (req: Request, res: Response) => {
  const id = numId(req.params.id);
  const type = String((req.body as any)?.type ?? "");
  const col = type === "view" ? "views" : type === "click" ? "clicks" : null;
  if (!id || !col) return res.status(400).json({ error: "Geçersiz" });
  try {
    await pool.query(`UPDATE site_popups SET ${col} = ${col} + 1 WHERE id = $1`, [id]);
  } catch { /* istatistik kritik değil */ }
  return res.json({ ok: true });
});

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // karışan 0/O, 1/I yok
function randomCode(): string {
  const bytes = crypto.randomBytes(6);
  return "HOSGELDIN-" + Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

async function createWelcomeCoupon(popup: any, email: string): Promise<{ id: number; code: string; validUntil: Date } | null> {
  const type = popup.coupon_discount_type;
  const value = Number(popup.coupon_discount_value);
  if (!type || !(value > 0)) return null;
  const applies: string[] = (popup.coupon_applies_to?.length ? popup.coupon_applies_to : ["ebook"]).filter((s: string) => SCOPES.has(s));
  const lit = `{${applies.map((s) => `"${s}"`).join(",")}}`;
  const validUntil = new Date(Date.now() + intIn(popup.coupon_valid_days, 1, 365, 14) * 86400000);
  for (let i = 0; i < 5; i++) {
    const code = randomCode();
    try {
      const r = await pool.query(
        `INSERT INTO coupons (code, description, discount_type, discount_value, applies_to,
                              min_purchase_kurus, max_uses, max_uses_per_user, valid_from, valid_until, is_active, notes)
         VALUES ($1, $2, $3, $4, $5::TEXT[], 0, 1, 1, NOW(), $6, TRUE, $7) RETURNING id`,
        [code, `Bülten hoş geldin kuponu (pop-up #${popup.id})`, type, value, lit, validUntil.toISOString(), `Bülten: ${email}`],
      );
      return { id: r.rows[0].id, code, validUntil };
    } catch (e: any) {
      if (e?.code !== "23505") throw e; // kod çakışması → tekrar dene
    }
  }
  return null;
}

function couponEmailHtml(code: string, label: string, validUntil: Date, email: string): string {
  const until = validUntil.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Istanbul" });
  return `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:16px;overflow:hidden;">
<tr><td style="background:#1e3a6e;padding:26px 32px;"><div style="font-size:22px;font-weight:800;color:#fff;">Sphere English</div>
<div style="font-size:13px;color:#4dcfff;margin-top:2px;">Bültene hoş geldin</div></td></tr>
<tr><td style="padding:28px 32px;">
<p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.6;">Merhaba,<br>Bültenimize katıldığın için teşekkürler. Yeni kitapları, kursları ve kampanyaları ilk sen öğreneceksin.</p>
<p style="margin:0 0 8px;font-size:15px;color:#334155;">Sana özel <b style="color:#1e3a6e;">${esc(label)}</b> kuponun:</p>
<div style="margin:0 0 16px;padding:16px;border:2px dashed #13a9e0;border-radius:12px;text-align:center;font-size:24px;font-weight:800;letter-spacing:2px;color:#1e3a6e;">${esc(code)}</div>
<p style="margin:0 0 20px;font-size:13px;color:#64748b;line-height:1.6;">Tek kullanımlık · <b>${esc(until)}</b> tarihine kadar geçerli · Ödeme sırasında sepetteki kupon alanına yaz.</p>
<table role="presentation" width="100%"><tr><td align="center"><a href="${WWW}/e-kitaplar?utm_source=newsletter&utm_medium=email&utm_campaign=hosgeldin"
style="display:inline-block;background:#1e3a6e;color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 30px;border-radius:12px;">E-kitaplara göz at</a></td></tr></table>
</td></tr>
<tr><td style="padding:18px 32px 26px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;text-align:center;line-height:1.6;">
Bu e-postayı www.sphereenglish.com'da bültenimize kaydolduğun için aldın.<br>
<a href="${newsletterUnsubUrl(email)}" style="color:#64748b;">Bültenden çık</a> · Sphere English · info@sphereenglish.com</td></tr>
</table></td></tr></table></body></html>`;
}

router.post("/newsletter/subscribe", async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  if (typeof body.website === "string" && body.website.trim()) return res.json({ ok: true }); // honeypot
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 320) return res.status(400).json({ error: "Geçerli bir e-posta adresi gir." });
  if (body.consent !== true) return res.status(400).json({ error: "Devam etmek için onay kutusunu işaretle." });
  const popupId = numId(body.popupId);

  try {
    const existing = await pool.query(`SELECT id, coupon_id, unsubscribed_at FROM newsletter_subscribers WHERE lower(email) = $1`, [email]);
    if (existing.rows[0]) {
      const ex = existing.rows[0];
      if (ex.unsubscribed_at) {
        await pool.query(`UPDATE newsletter_subscribers SET unsubscribed_at = NULL, consent_text = $2, consent_at = NOW() WHERE id = $1`, [ex.id, NEWSLETTER_CONSENT_TEXT]);
      }
      // Aynı adrese ikinci kupon verilmez (kupon toplama önlemi)
      return res.json({ ok: true, alreadySubscribed: true });
    }

    const popup = popupId
      ? (await pool.query(`SELECT * FROM site_popups WHERE id = $1 AND kind = 'newsletter'`, [popupId])).rows[0]
      : null;

    const ip = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() || req.socket?.remoteAddress || "";
    const ins = await pool.query(
      `INSERT INTO newsletter_subscribers (email, source, popup_id, consent_text, ip_hash, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT ((lower(email))) DO NOTHING
       RETURNING id`,
      [email, popup ? "popup" : "site", popup?.id ?? null, NEWSLETTER_CONSENT_TEXT,
       ip ? crypto.createHash("sha256").update(ip).digest("hex") : null,
       String(req.headers["user-agent"] ?? "").slice(0, 500) || null],
    );
    if (!ins.rows[0]) return res.json({ ok: true, alreadySubscribed: true });
    const subId = ins.rows[0].id;

    let coupon: { code: string; label: string; validUntil: string } | null = null;
    if (popup) {
      await pool.query(`UPDATE site_popups SET signups = signups + 1 WHERE id = $1`, [popup.id]);
      const c = await createWelcomeCoupon(popup, email);
      if (c) {
        await pool.query(`UPDATE newsletter_subscribers SET coupon_id = $2 WHERE id = $1`, [subId, c.id]);
        const label = discountLabel(popup.coupon_discount_type, popup.coupon_discount_value) ?? "indirim";
        coupon = { code: c.code, label, validUntil: c.validUntil.toISOString() };
        void sendEmail(email, `Hoş geldin! ${label} kuponun: ${c.code}`, couponEmailHtml(c.code, label, c.validUntil, email))
          .catch((e) => console.error("[newsletter] kupon maili HATA:", e?.message));
      }
    }
    return res.status(201).json({ ok: true, coupon });
  } catch (e: any) {
    console.error("[newsletter] subscribe HATA:", e?.message);
    return res.status(500).json({ error: "Kayıt şu an alınamadı, birazdan tekrar dene." });
  }
});

router.get("/newsletter/unsubscribe", async (req: Request, res: Response) => {
  const email = String(req.query.e ?? "").trim().toLowerCase();
  const sig = String(req.query.s ?? "");
  const expected = email ? newsletterUnsubSig(email) : "";
  const ok = !!email && sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  if (ok) {
    await pool.query(`UPDATE newsletter_subscribers SET unsubscribed_at = NOW() WHERE lower(email) = $1 AND unsubscribed_at IS NULL`, [email]).catch(() => {});
  }
  res.status(ok ? 200 : 400);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'");
  return res.send(`<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sphere English</title>
<style>body{margin:0;background:#e8eef8;font-family:system-ui,sans-serif;color:#1e3a6e;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px}
.c{background:#fff;border-radius:16px;max-width:440px;padding:32px}p{color:#334155;line-height:1.6}a{color:#0e7da6}</style></head>
<body><div class="c"><h2>${ok ? "Bültenden çıkarıldın" : "Bağlantı geçersiz"}</h2><p>${ok
    ? "Artık bülten e-postası almayacaksın."
    : "Bu bağlantı tanınmadı. Bültenden çıkmak için info@sphereenglish.com adresine yazabilirsin."}</p>
<p><a href="${WWW}">sphereenglish.com</a></p></div></body></html>`);
});

// ─── ADMIN ────────────────────────────────────────────────────────────────

function popupFields(b: any) {
  const kind = KINDS.has(b.kind) ? b.kind : "announcement";
  const discType = b.couponDiscountType === "fixed" ? "fixed" : b.couponDiscountType === "percentage" ? "percentage" : null;
  const discValue = Number(b.couponDiscountValue);
  const applies = Array.isArray(b.couponAppliesTo) ? b.couponAppliesTo.filter((s: string) => SCOPES.has(s)) : ["ebook"];
  return {
    kind,
    title: str(b.title, 200),
    body: str(b.body, 2000),
    imageUrl: str(b.imageUrl, 1000),
    ctaText: str(b.ctaText, 80),
    ctaUrl: str(b.ctaUrl, 1000),
    delaySeconds: intIn(b.delaySeconds, 0, 120, 8),
    frequencyDays: intIn(b.frequencyDays, 0, 365, 7),
    priority: intIn(b.priority, -100, 100, 0),
    isActive: !!b.isActive,
    startsAt: b.startsAt ? new Date(b.startsAt).toISOString() : null,
    endsAt: b.endsAt ? new Date(b.endsAt).toISOString() : null,
    couponDiscountType: kind === "newsletter" && discType && discValue > 0 ? discType : null,
    couponDiscountValue: kind === "newsletter" && discType && discValue > 0 ? discValue : null,
    couponAppliesTo: `{${(applies.length ? applies : ["ebook"]).map((s: string) => `"${s}"`).join(",")}}`,
    couponValidDays: intIn(b.couponValidDays, 1, 365, 14),
  };
}

function validate(f: ReturnType<typeof popupFields>): string | null {
  if (!f.title) return "Başlık gerekli";
  if (f.couponDiscountType === "percentage" && Number(f.couponDiscountValue) > 100) return "Yüzde 0-100 arası olmalı";
  if (f.startsAt && f.endsAt && new Date(f.endsAt) <= new Date(f.startsAt)) return "Bitiş başlangıçtan sonra olmalı";
  if (f.ctaUrl && !/^(https?:\/\/|\/)/.test(f.ctaUrl)) return "Buton linki https:// ya da / ile başlamalı";
  return null;
}

router.get("/admin/popups", authMiddleware, adminOnly, async (_req: AuthRequest, res: Response) => {
  const r = await pool.query(`SELECT ${ADMIN_COLS} FROM site_popups ORDER BY is_active DESC, priority DESC, id DESC`);
  return res.json({ popups: r.rows, consentText: NEWSLETTER_CONSENT_TEXT });
});

router.post("/admin/popups", authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
  const f = popupFields(req.body ?? {});
  const err = validate(f);
  if (err) return res.status(400).json({ error: err });
  const r = await pool.query(
    `INSERT INTO site_popups (kind, title, body, image_url, cta_text, cta_url, delay_seconds, frequency_days, priority,
       is_active, starts_at, ends_at, coupon_discount_type, coupon_discount_value, coupon_applies_to, coupon_valid_days)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::TEXT[],$16) RETURNING id`,
    [f.kind, f.title, f.body, f.imageUrl, f.ctaText, f.ctaUrl, f.delaySeconds, f.frequencyDays, f.priority,
     f.isActive, f.startsAt, f.endsAt, f.couponDiscountType, f.couponDiscountValue, f.couponAppliesTo, f.couponValidDays],
  );
  return res.status(201).json({ ok: true, id: r.rows[0].id });
});

router.patch("/admin/popups/:id", authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
  const id = numId(req.params.id);
  if (!id) return res.status(400).json({ error: "id geçersiz" });
  const cur = (await pool.query(`SELECT ${ADMIN_COLS} FROM site_popups WHERE id = $1`, [id])).rows[0];
  if (!cur) return res.status(404).json({ error: "bulunamadı" });
  const f = popupFields({ ...cur, ...(req.body ?? {}) });
  const err = validate(f);
  if (err) return res.status(400).json({ error: err });
  await pool.query(
    `UPDATE site_popups SET kind=$2, title=$3, body=$4, image_url=$5, cta_text=$6, cta_url=$7, delay_seconds=$8,
       frequency_days=$9, priority=$10, is_active=$11, starts_at=$12, ends_at=$13, coupon_discount_type=$14,
       coupon_discount_value=$15, coupon_applies_to=$16::TEXT[], coupon_valid_days=$17, updated_at=NOW()
     WHERE id=$1`,
    [id, f.kind, f.title, f.body, f.imageUrl, f.ctaText, f.ctaUrl, f.delaySeconds, f.frequencyDays, f.priority,
     f.isActive, f.startsAt, f.endsAt, f.couponDiscountType, f.couponDiscountValue, f.couponAppliesTo, f.couponValidDays],
  );
  return res.json({ ok: true });
});

router.delete("/admin/popups/:id", authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
  const id = numId(req.params.id);
  if (!id) return res.status(400).json({ error: "id geçersiz" });
  await pool.query(`DELETE FROM site_popups WHERE id = $1`, [id]);
  return res.json({ ok: true });
});

router.get("/admin/newsletter", authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
  const limit = intIn(req.query.limit, 1, 500, 100);
  const offset = intIn(req.query.offset, 0, 1_000_000, 0);
  const [list, counts] = await Promise.all([
    pool.query(
      `SELECT s.id, s.email, s.source, s.created_at AS "createdAt", s.unsubscribed_at AS "unsubscribedAt",
              c.code AS "couponCode", c.total_used_count AS "couponUsed", p.title AS "popupTitle"
         FROM newsletter_subscribers s
         LEFT JOIN coupons c ON c.id = s.coupon_id
         LEFT JOIN site_popups p ON p.id = s.popup_id
        ORDER BY s.created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset],
    ),
    pool.query(
      `SELECT COUNT(*) FILTER (WHERE s.unsubscribed_at IS NULL)::int AS active,
              COUNT(*) FILTER (WHERE s.unsubscribed_at IS NOT NULL)::int AS unsubscribed,
              COUNT(*) FILTER (WHERE c.total_used_count > 0)::int AS "couponUsed",
              COUNT(*)::int AS total
         FROM newsletter_subscribers s LEFT JOIN coupons c ON c.id = s.coupon_id`,
    ),
  ]);
  return res.json({ subscribers: list.rows, ...counts.rows[0] });
});

router.get("/admin/newsletter/export.csv", authMiddleware, adminOnly, async (_req: AuthRequest, res: Response) => {
  const r = await pool.query(
    `SELECT s.email, s.created_at, s.consent_at, s.unsubscribed_at, c.code
       FROM newsletter_subscribers s LEFT JOIN coupons c ON c.id = s.coupon_id
      WHERE s.unsubscribed_at IS NULL ORDER BY s.created_at`,
  );
  const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = [["email", "kayit_tarihi", "onay_tarihi", "kupon"].join(","),
    ...r.rows.map((x: any) => [q(x.email), q(x.created_at?.toISOString?.() ?? x.created_at), q(x.consent_at?.toISOString?.() ?? x.consent_at), q(x.code)].join(","))];
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="bulten-aboneleri.csv"`);
  return res.send("﻿" + rows.join("\n"));
});

export default router;
