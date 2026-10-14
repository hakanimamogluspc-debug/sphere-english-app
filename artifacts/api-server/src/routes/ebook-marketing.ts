/**
 * /e-kitaplar pazarlama sayfası — public endpoint'ler.
 *
 *   GET  /api/ebook-marketing/faq        → aktif FAQ (sıralı)
 *   GET  /api/ebook-marketing/guide      → aktif rehber kartları (sıralı)
 *   GET  /api/ebook-marketing/interests  → "Haberdar ol" ilgi alanı seçenekleri
 *   POST /api/ebook-marketing/waitlist   → "Haberdar ol" kaydı
 *        body: { email, interestArea?, source?, website? (honeypot) }
 *
 * Rate limit: app.ts'de /api/ebook-marketing/waitlist → waitlistLimiter.
 * Not: Repoda iki drizzle-orm kopyası olduğundan query builder tipleri çakışıyor;
 * diğer route'lar gibi pool.query (parametreli) kullanılır.
 */

import { Router, Request, Response } from "express";
import { createHash } from "node:crypto";
import { pool, EBOOK_INTEREST_AREAS } from "@workspace/db";
import { sendEbookWaitlistConfirmation } from "../lib/ebook-waitlist-mail.js";
import { notifyNewEbookWaitlist } from "../lib/admin-notifications.js";

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const VALID_AREAS = new Set<string>(EBOOK_INTEREST_AREAS.map((a) => a.key));

function areaLabel(key: string | null | undefined): string | null {
  if (!key) return null;
  return EBOOK_INTEREST_AREAS.find((a) => a.key === key)?.label ?? null;
}

router.get("/ebook-marketing/faq", async (_req: Request, res: Response) => {
  try {
    const r = await pool.query(
      `SELECT id, question, answer FROM ebook_faq
       WHERE is_active = TRUE ORDER BY display_order ASC, id ASC`,
    );
    res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    return res.json({ faq: r.rows });
  } catch (e: any) {
    console.error("[EBOOK-MKT] faq HATA:", e?.message);
    return res.status(500).json({ error: "FAQ alınamadı" });
  }
});

router.get("/ebook-marketing/guide", async (_req: Request, res: Response) => {
  try {
    const r = await pool.query(
      `SELECT id, role_label AS "roleLabel", description,
              cta_text AS "ctaText", cta_href AS "ctaHref", icon
       FROM ebook_guide
       WHERE is_active = TRUE ORDER BY display_order ASC, id ASC`,
    );
    res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    return res.json({ guide: r.rows });
  } catch (e: any) {
    console.error("[EBOOK-MKT] guide HATA:", e?.message);
    return res.status(500).json({ error: "Rehber alınamadı" });
  }
});

router.get("/ebook-marketing/interests", (_req: Request, res: Response) => {
  res.setHeader("Cache-Control", "public, max-age=3600");
  return res.json({ interests: EBOOK_INTEREST_AREAS });
});

router.post("/ebook-marketing/waitlist", async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as Record<string, unknown>;

  // Honeypot — botlar doldurur, insanlar görmez. Sessizce 200 dön.
  if (typeof body.website === "string" && body.website.trim().length > 0) {
    return res.json({ ok: true });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 320) {
    return res.status(400).json({ error: "Geçerli bir e-posta adresi girin." });
  }

  const rawArea = typeof body.interestArea === "string" ? body.interestArea.trim() : "";
  const interestArea = rawArea && VALID_AREAS.has(rawArea) ? rawArea : null;
  const source = typeof body.source === "string" && body.source.trim()
    ? body.source.trim().slice(0, 60)
    : "ekitaplar-page";

  const ip = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim()
    || req.socket?.remoteAddress || "";
  const ipHash = ip ? createHash("sha256").update(ip).digest("hex") : null;
  const userAgent = String(req.headers["user-agent"] ?? "").slice(0, 500) || null;

  try {
    // Aynı email + aynı alan daha önce kaydolduysa tekrar mail atma
    const existing = await pool.query(
      `SELECT id FROM ebook_waitlist
       WHERE lower(email) = $1 AND COALESCE(interest_area, '') = COALESCE($2, '')
       LIMIT 1`,
      [email, interestArea],
    );
    if (existing.rows.length > 0) {
      return res.json({ ok: true, alreadySubscribed: true });
    }

    const ins = await pool.query(
      `INSERT INTO ebook_waitlist (email, interest_area, source, user_agent, ip_hash)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [email, interestArea, source, userAgent, ipHash],
    );
    const entryId = Number(ins.rows[0]?.id);

    const cnt = await pool.query(`SELECT count(*)::int AS c FROM ebook_waitlist`);
    const totalCount = Number(cnt.rows[0]?.c ?? 0);

    const label = areaLabel(interestArea);

    // Mail'ler non-blocking — kullanıcı cevabı beklemesin
    void sendEbookWaitlistConfirmation({ email, interestLabel: label });
    void notifyNewEbookWaitlist({ entryId, email, interestLabel: label ?? "Genel", totalCount });

    return res.status(201).json({ ok: true });
  } catch (e: any) {
    // Unique index yarışı (eşzamanlı çift submit) — kullanıcıya ok dön
    if (e?.code === "23505") return res.json({ ok: true, alreadySubscribed: true });
    console.error("[EBOOK-MKT] waitlist HATA:", e?.message);
    return res.status(500).json({ error: "Kayıt alınamadı, lütfen tekrar deneyin." });
  }
});

export default router;
