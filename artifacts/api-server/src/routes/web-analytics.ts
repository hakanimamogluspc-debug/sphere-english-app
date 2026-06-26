/**
 * Website ziyaretçi takibi (self-hosted analytics).
 *
 * Public endpoint:
 *   POST /api/analytics/track  → sphere-www client'tan sayfa görüntüleme
 *
 * Admin endpoint'leri:
 *   GET /admin/analytics/web/overview   → toplam ziyaretçi/oturum/PV + dünden değişim
 *   GET /admin/analytics/web/top-pages  → en çok ziyaret edilen sayfalar
 *   GET /admin/analytics/web/referrers  → en çok trafik getiren kaynaklar
 *   GET /admin/analytics/web/devices    → cihaz tipi dağılımı
 *   GET /admin/analytics/web/recent     → son 100 ziyaret (real-time feeling)
 *   GET /admin/analytics/web/timeline   → saatlik/günlük zaman serisi
 *
 * Filtre: ?range=24h|7d|30d (default 7d)
 *
 * KVKK: IP doğrudan saklanmaz, SHA-256 hash'i tutulur.
 */

import { Router, Request, Response } from "express";
import crypto from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import geoip from "geoip-lite";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth.js";

// ─── Ülke kodu → Türkçe isim ──────────────────────────────────────────
// En sık karşılaşacaklarımız; bilinmeyenler iki harfli ISO kodu olarak gösterilir
const COUNTRY_TR: Record<string, string> = {
  TR: "Türkiye",
  US: "ABD",
  GB: "Birleşik Krallık",
  DE: "Almanya",
  FR: "Fransa",
  NL: "Hollanda",
  RU: "Rusya",
  IT: "İtalya",
  ES: "İspanya",
  CN: "Çin",
  JP: "Japonya",
  IN: "Hindistan",
  KR: "Güney Kore",
  AZ: "Azerbaycan",
  UA: "Ukrayna",
  PL: "Polonya",
  CA: "Kanada",
  AU: "Avustralya",
  BR: "Brezilya",
  AT: "Avusturya",
  BE: "Belçika",
  CH: "İsviçre",
  SE: "İsveç",
  NO: "Norveç",
  FI: "Finlandiya",
  DK: "Danimarka",
  GR: "Yunanistan",
  BG: "Bulgaristan",
  RO: "Romanya",
  CZ: "Çekya",
  HU: "Macaristan",
  IE: "İrlanda",
  PT: "Portekiz",
  IL: "İsrail",
  SA: "Suudi Arabistan",
  AE: "BAE",
  EG: "Mısır",
  MA: "Fas",
  ZA: "Güney Afrika",
  MX: "Meksika",
  AR: "Arjantin",
  CL: "Şili",
  CO: "Kolombiya",
  TH: "Tayland",
  ID: "Endonezya",
  VN: "Vietnam",
  MY: "Malezya",
  SG: "Singapur",
  IR: "İran",
  IQ: "Irak",
  SY: "Suriye",
  PK: "Pakistan",
  BD: "Bangladeş",
  PH: "Filipinler",
  NZ: "Yeni Zelanda",
};

function countryName(iso: string | null | undefined): string {
  if (!iso) return "Bilinmiyor";
  return COUNTRY_TR[iso.toUpperCase()] ?? iso.toUpperCase();
}

interface GeoResult {
  country: string | null;
  city: string | null;
}

function lookupGeo(ip: string, req: Request): GeoResult {
  // Cloudflare arkasındaysak header'ları öncelikli kullan (daha doğru)
  const cfCountry = req.headers["cf-ipcountry"];
  const cfCity = req.headers["cf-ipcity"];
  if (typeof cfCountry === "string" && cfCountry !== "XX") {
    return {
      country: countryName(cfCountry),
      city: typeof cfCity === "string" && cfCity ? cfCity : null,
    };
  }

  // geoip-lite ile offline lookup
  try {
    if (!ip || ip === "0.0.0.0" || ip.startsWith("127.") || ip.startsWith("10.") || ip.startsWith("192.168.")) {
      return { country: null, city: null };
    }
    const lookup = geoip.lookup(ip);
    if (!lookup) return { country: null, city: null };
    return {
      country: countryName(lookup.country),
      city: lookup.city || null,
    };
  } catch (e: any) {
    console.error("[analytics/geo] lookup HATA:", e?.message);
    return { country: null, city: null };
  }
}

const router = Router();

// ─── Yardımcılar ────────────────────────────────────────────────────────

function hashIp(ip: string): string {
  const salt = process.env["ANALYTICS_IP_SALT"] ?? "sphere-analytics-default-salt";
  return crypto.createHmac("sha256", salt).update(ip).digest("hex").slice(0, 32);
}

function getClientIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string") return fwd.split(",")[0]?.trim() ?? "0.0.0.0";
  return (req.socket?.remoteAddress ?? "0.0.0.0").replace(/^::ffff:/, "");
}

const BOT_REGEX =
  /bot|crawl|spider|slurp|baiduspider|yandexbot|googlebot|bingbot|duckduckbot|facebookexternalhit|pingdom|monitor|uptime|headless|preview|screenshot|prerender|axios|node-fetch|python-requests|curl|wget/i;

function detectBot(ua: string): boolean {
  if (!ua) return true; // UA yoksa bot say
  return BOT_REGEX.test(ua);
}

interface ParsedUA {
  device: "mobile" | "tablet" | "desktop";
  browser: string;
  os: string;
}

function parseUA(ua: string): ParsedUA {
  const lower = ua.toLowerCase();

  // Device
  let device: ParsedUA["device"] = "desktop";
  if (/ipad|tablet/.test(lower)) device = "tablet";
  else if (/mobile|android|iphone|ipod|blackberry|opera mini/.test(lower)) device = "mobile";

  // Browser
  let browser = "Bilinmiyor";
  if (/edg\//.test(lower)) browser = "Edge";
  else if (/opr\/|opera/.test(lower)) browser = "Opera";
  else if (/chrome\//.test(lower) && !/edg\//.test(lower)) browser = "Chrome";
  else if (/firefox\//.test(lower)) browser = "Firefox";
  else if (/safari\//.test(lower) && !/chrome/.test(lower)) browser = "Safari";

  // OS
  let os = "Bilinmiyor";
  if (/windows nt/.test(lower)) os = "Windows";
  else if (/mac os x/.test(lower) || /macintosh/.test(lower)) os = "macOS";
  else if (/android/.test(lower)) os = "Android";
  else if (/iphone|ipad|ipod|ios/.test(lower)) os = "iOS";
  else if (/linux/.test(lower)) os = "Linux";

  return { device, browser, os };
}

function parseReferrerDomain(referrer: string | null): string | null {
  if (!referrer) return null;
  try {
    const u = new URL(referrer);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function rangeToInterval(range: string): string {
  switch (range) {
    case "24h":
      return "24 hours";
    case "30d":
      return "30 days";
    case "7d":
    default:
      return "7 days";
  }
}

// ─── PUBLIC: SAYFA GÖRÜNTÜLEME KAYDET ───────────────────────────────────
router.post("/analytics/track", async (req: Request, res: Response) => {
  try {
    const body = (req.body ?? {}) as any;
    const visitorId = String(body.visitorId ?? "").trim().slice(0, 64);
    const path = String(body.path ?? "").trim().slice(0, 500);
    const title = String(body.title ?? "").trim().slice(0, 500) || null;
    const fullUrl = String(body.url ?? "").trim().slice(0, 2000) || null;
    const referrer = String(body.referrer ?? "").trim().slice(0, 2000) || null;

    if (!visitorId || !path) {
      return res.status(400).json({ ok: false });
    }

    // DNT (Do Not Track) saygısı
    const dnt = req.headers["dnt"] || (body.dnt ? "1" : null);
    if (dnt === "1") return res.json({ ok: true, ignored: "dnt" });

    const ua = String(req.headers["user-agent"] ?? "");
    const isBot = detectBot(ua);
    const ip = getClientIp(req);
    const ipHash = hashIp(ip);
    const { device, browser, os } = parseUA(ua);
    const referrerDomain = parseReferrerDomain(referrer);
    const geo = lookupGeo(ip, req);

    // UTM
    const utm = (body.utm ?? {}) as any;
    const utmSource = (utm.source || "").toString().slice(0, 120) || null;
    const utmMedium = (utm.medium || "").toString().slice(0, 120) || null;
    const utmCampaign = (utm.campaign || "").toString().slice(0, 255) || null;
    const utmTerm = (utm.term || "").toString().slice(0, 255) || null;
    const utmContent = (utm.content || "").toString().slice(0, 255) || null;

    // Mevcut aktif session var mı? Aynı visitorId + son 30 dk içinde aktivite varsa
    // session ID'sini al, yoksa yeni session yarat
    const sessRows = await db.execute(sql`
      SELECT id FROM web_visitor_sessions
      WHERE visitor_id = ${visitorId}
        AND last_seen_at >= NOW() - INTERVAL '30 minutes'
      ORDER BY last_seen_at DESC
      LIMIT 1
    `);
    let sessionId: number | null = ((sessRows.rows ?? sessRows)[0] as any)?.id ?? null;

    if (sessionId) {
      await db.execute(sql`
        UPDATE web_visitor_sessions
        SET last_seen_at = NOW(),
            page_view_count = page_view_count + 1
        WHERE id = ${sessionId}
      `);
    } else {
      const inserted = await db.execute(sql`
        INSERT INTO web_visitor_sessions (
          visitor_id, ip_hash, user_agent, device_type, browser, os,
          country, city,
          referrer, referrer_domain,
          utm_source, utm_medium, utm_campaign, utm_term, utm_content,
          landing_path, is_bot, page_view_count
        ) VALUES (
          ${visitorId}, ${ipHash}, ${ua}, ${device}, ${browser}, ${os},
          ${geo.country}, ${geo.city},
          ${referrer}, ${referrerDomain},
          ${utmSource}, ${utmMedium}, ${utmCampaign}, ${utmTerm}, ${utmContent},
          ${path}, ${isBot}, 1
        )
        RETURNING id
      `);
      sessionId = ((inserted.rows ?? inserted)[0] as any)?.id ?? null;
    }

    // Sayfa görüntülemeyi kaydet — bot'larınkini de tutuyoruz, admin filtreleyebilir
    if (sessionId) {
      await db.execute(sql`
        INSERT INTO web_page_views (
          session_id, visitor_id, path, full_url, page_title, referrer
        ) VALUES (
          ${sessionId}, ${visitorId}, ${path}, ${fullUrl}, ${title}, ${referrer}
        )
      `);
    }

    return res.json({ ok: true, sessionId });
  } catch (e: any) {
    // Tracking sessizce başarısız olmalı (kullanıcı tarafından görünmüyor)
    console.error("[analytics/track] HATA:", e?.message);
    return res.status(200).json({ ok: false });
  }
});

// ─── ADMIN: ÖZET ───────────────────────────────────────────────────────
router.get(
  "/admin/analytics/web/overview",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const interval = rangeToInterval(String(req.query?.range ?? "7d"));
      const includeBots = String(req.query?.includeBots ?? "0") === "1";

      const botFilter = includeBots ? sql`` : sql`AND is_bot = FALSE`;
      const botFilterPV = includeBots
        ? sql``
        : sql`AND EXISTS (SELECT 1 FROM web_visitor_sessions s WHERE s.id = pv.session_id AND s.is_bot = FALSE)`;

      // Current period
      const cur = await db.execute(sql`
        SELECT
          COUNT(DISTINCT visitor_id)::INT AS visitors,
          COUNT(*)::INT AS sessions
        FROM web_visitor_sessions
        WHERE last_seen_at >= NOW() - (${interval})::INTERVAL
        ${botFilter}
      `);
      const pvRes = await db.execute(sql`
        SELECT COUNT(*)::INT AS pageviews
        FROM web_page_views pv
        WHERE viewed_at >= NOW() - (${interval})::INTERVAL
        ${botFilterPV}
      `);

      // Previous period (aynı süre öncesi)
      const prev = await db.execute(sql`
        SELECT
          COUNT(DISTINCT visitor_id)::INT AS visitors,
          COUNT(*)::INT AS sessions
        FROM web_visitor_sessions
        WHERE last_seen_at < NOW() - (${interval})::INTERVAL
          AND last_seen_at >= NOW() - 2 * (${interval})::INTERVAL
        ${botFilter}
      `);
      const pvPrev = await db.execute(sql`
        SELECT COUNT(*)::INT AS pageviews
        FROM web_page_views pv
        WHERE viewed_at < NOW() - (${interval})::INTERVAL
          AND viewed_at >= NOW() - 2 * (${interval})::INTERVAL
        ${botFilterPV}
      `);

      // Ortalama sayfa/oturum + bounce (tek sayfa görüntüleme oranı)
      const avg = await db.execute(sql`
        SELECT
          COALESCE(AVG(page_view_count)::NUMERIC(10, 2), 0) AS avg_pv_per_session,
          COALESCE(
            (COUNT(*) FILTER (WHERE page_view_count = 1)::NUMERIC / NULLIF(COUNT(*), 0) * 100)::NUMERIC(5, 1),
            0
          ) AS bounce_rate
        FROM web_visitor_sessions
        WHERE last_seen_at >= NOW() - (${interval})::INTERVAL
        ${botFilter}
      `);

      const c = (cur.rows ?? cur)[0] as any;
      const cpv = (pvRes.rows ?? pvRes)[0] as any;
      const p = (prev.rows ?? prev)[0] as any;
      const ppv = (pvPrev.rows ?? pvPrev)[0] as any;
      const a = (avg.rows ?? avg)[0] as any;

      function delta(currentVal: number, prevVal: number): number | null {
        if (!prevVal || prevVal === 0) return null;
        return Math.round(((currentVal - prevVal) / prevVal) * 100);
      }

      return res.json({
        range: req.query?.range ?? "7d",
        current: {
          visitors: c?.visitors ?? 0,
          sessions: c?.sessions ?? 0,
          pageviews: cpv?.pageviews ?? 0,
          avgPvPerSession: parseFloat(a?.avg_pv_per_session ?? "0"),
          bounceRate: parseFloat(a?.bounce_rate ?? "0"),
        },
        previous: {
          visitors: p?.visitors ?? 0,
          sessions: p?.sessions ?? 0,
          pageviews: ppv?.pageviews ?? 0,
        },
        delta: {
          visitors: delta(c?.visitors ?? 0, p?.visitors ?? 0),
          sessions: delta(c?.sessions ?? 0, p?.sessions ?? 0),
          pageviews: delta(cpv?.pageviews ?? 0, ppv?.pageviews ?? 0),
        },
      });
    } catch (e: any) {
      console.error("[analytics/overview] HATA:", e?.message);
      return res.status(500).json({ error: e?.message });
    }
  },
);

// ─── ADMIN: EN POPÜLER SAYFALAR ────────────────────────────────────────
router.get(
  "/admin/analytics/web/top-pages",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const interval = rangeToInterval(String(req.query?.range ?? "7d"));
      const limit = Math.min(parseInt(String(req.query?.limit ?? "20"), 10) || 20, 100);
      const includeBots = String(req.query?.includeBots ?? "0") === "1";
      const botFilter = includeBots
        ? sql``
        : sql`AND EXISTS (SELECT 1 FROM web_visitor_sessions s WHERE s.id = pv.session_id AND s.is_bot = FALSE)`;

      const rows = await db.execute(sql`
        SELECT
          path,
          COUNT(*)::INT AS pageviews,
          COUNT(DISTINCT visitor_id)::INT AS unique_visitors,
          MAX(page_title) AS sample_title
        FROM web_page_views pv
        WHERE viewed_at >= NOW() - (${interval})::INTERVAL
        ${botFilter}
        GROUP BY path
        ORDER BY pageviews DESC
        LIMIT ${limit}
      `);

      return res.json({ pages: rows.rows ?? rows });
    } catch (e: any) {
      console.error("[analytics/top-pages] HATA:", e?.message);
      return res.status(500).json({ error: e?.message });
    }
  },
);

// ─── ADMIN: KAYNAKLAR (REFERRER + UTM) ─────────────────────────────────
router.get(
  "/admin/analytics/web/referrers",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const interval = rangeToInterval(String(req.query?.range ?? "7d"));
      const includeBots = String(req.query?.includeBots ?? "0") === "1";
      const botFilter = includeBots ? sql`` : sql`AND is_bot = FALSE`;

      // Referrer domain'leri
      const domains = await db.execute(sql`
        SELECT
          COALESCE(NULLIF(referrer_domain, ''), 'Direkt') AS source,
          COUNT(*)::INT AS sessions,
          COUNT(DISTINCT visitor_id)::INT AS visitors
        FROM web_visitor_sessions
        WHERE last_seen_at >= NOW() - (${interval})::INTERVAL
        ${botFilter}
        GROUP BY referrer_domain
        ORDER BY sessions DESC
        LIMIT 20
      `);

      // UTM kampanyaları
      const campaigns = await db.execute(sql`
        SELECT
          COALESCE(utm_source, '—') AS utm_source,
          COALESCE(utm_medium, '—') AS utm_medium,
          COALESCE(utm_campaign, '—') AS utm_campaign,
          COUNT(*)::INT AS sessions
        FROM web_visitor_sessions
        WHERE last_seen_at >= NOW() - (${interval})::INTERVAL
          AND (utm_source IS NOT NULL OR utm_medium IS NOT NULL OR utm_campaign IS NOT NULL)
        ${botFilter}
        GROUP BY utm_source, utm_medium, utm_campaign
        ORDER BY sessions DESC
        LIMIT 20
      `);

      return res.json({
        domains: domains.rows ?? domains,
        campaigns: campaigns.rows ?? campaigns,
      });
    } catch (e: any) {
      console.error("[analytics/referrers] HATA:", e?.message);
      return res.status(500).json({ error: e?.message });
    }
  },
);

// ─── ADMIN: CİHAZ DAĞILIMI ─────────────────────────────────────────────
router.get(
  "/admin/analytics/web/devices",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const interval = rangeToInterval(String(req.query?.range ?? "7d"));
      const includeBots = String(req.query?.includeBots ?? "0") === "1";
      const botFilter = includeBots ? sql`` : sql`AND is_bot = FALSE`;

      const devices = await db.execute(sql`
        SELECT device_type AS device, COUNT(*)::INT AS sessions
        FROM web_visitor_sessions
        WHERE last_seen_at >= NOW() - (${interval})::INTERVAL
        ${botFilter}
        GROUP BY device_type
        ORDER BY sessions DESC
      `);
      const browsers = await db.execute(sql`
        SELECT browser, COUNT(*)::INT AS sessions
        FROM web_visitor_sessions
        WHERE last_seen_at >= NOW() - (${interval})::INTERVAL
        ${botFilter}
        GROUP BY browser
        ORDER BY sessions DESC
        LIMIT 10
      `);
      const oses = await db.execute(sql`
        SELECT os, COUNT(*)::INT AS sessions
        FROM web_visitor_sessions
        WHERE last_seen_at >= NOW() - (${interval})::INTERVAL
        ${botFilter}
        GROUP BY os
        ORDER BY sessions DESC
        LIMIT 10
      `);

      return res.json({
        devices: devices.rows ?? devices,
        browsers: browsers.rows ?? browsers,
        oses: oses.rows ?? oses,
      });
    } catch (e: any) {
      console.error("[analytics/devices] HATA:", e?.message);
      return res.status(500).json({ error: e?.message });
    }
  },
);

// ─── ADMIN: SON ZİYARETLER (REAL-TIME) ─────────────────────────────────
router.get(
  "/admin/analytics/web/recent",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const limit = Math.min(parseInt(String(req.query?.limit ?? "50"), 10) || 50, 200);
      const includeBots = String(req.query?.includeBots ?? "0") === "1";
      const botFilter = includeBots
        ? sql``
        : sql`AND s.is_bot = FALSE`;

      const rows = await db.execute(sql`
        SELECT
          pv.id, pv.viewed_at, pv.path, pv.page_title, pv.referrer,
          s.visitor_id, s.device_type, s.browser, s.os,
          s.country, s.city,
          s.referrer_domain, s.utm_source, s.utm_campaign,
          s.is_bot
        FROM web_page_views pv
        JOIN web_visitor_sessions s ON s.id = pv.session_id
        WHERE 1=1 ${botFilter}
        ORDER BY pv.viewed_at DESC
        LIMIT ${limit}
      `);

      return res.json({ visits: rows.rows ?? rows });
    } catch (e: any) {
      console.error("[analytics/recent] HATA:", e?.message);
      return res.status(500).json({ error: e?.message });
    }
  },
);

// ─── ADMIN: COĞRAFİ DAĞILIM (ülke + şehir) ─────────────────────────────
router.get(
  "/admin/analytics/web/geo",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const interval = rangeToInterval(String(req.query?.range ?? "7d"));
      const includeBots = String(req.query?.includeBots ?? "0") === "1";
      const botFilter = includeBots ? sql`` : sql`AND is_bot = FALSE`;

      const countries = await db.execute(sql`
        SELECT
          COALESCE(NULLIF(country, ''), 'Bilinmiyor') AS country,
          COUNT(*)::INT AS sessions,
          COUNT(DISTINCT visitor_id)::INT AS visitors
        FROM web_visitor_sessions
        WHERE last_seen_at >= NOW() - (${interval})::INTERVAL
        ${botFilter}
        GROUP BY country
        ORDER BY sessions DESC
        LIMIT 25
      `);

      const cities = await db.execute(sql`
        SELECT
          COALESCE(NULLIF(city, ''), 'Bilinmiyor') AS city,
          COALESCE(NULLIF(country, ''), '—') AS country,
          COUNT(*)::INT AS sessions,
          COUNT(DISTINCT visitor_id)::INT AS visitors
        FROM web_visitor_sessions
        WHERE last_seen_at >= NOW() - (${interval})::INTERVAL
          AND city IS NOT NULL AND city <> ''
        ${botFilter}
        GROUP BY city, country
        ORDER BY sessions DESC
        LIMIT 25
      `);

      return res.json({
        countries: countries.rows ?? countries,
        cities: cities.rows ?? cities,
      });
    } catch (e: any) {
      console.error("[analytics/geo] HATA:", e?.message);
      return res.status(500).json({ error: e?.message });
    }
  },
);

// ─── ADMIN: ZAMAN SERİSİ (saatlik/günlük) ──────────────────────────────
router.get(
  "/admin/analytics/web/timeline",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const range = String(req.query?.range ?? "7d");
      const interval = rangeToInterval(range);
      const bucket = range === "24h" ? "hour" : "day";
      const includeBots = String(req.query?.includeBots ?? "0") === "1";
      const botFilter = includeBots
        ? sql``
        : sql`AND EXISTS (SELECT 1 FROM web_visitor_sessions s WHERE s.id = pv.session_id AND s.is_bot = FALSE)`;

      const rows = await db.execute(sql`
        SELECT
          date_trunc(${bucket}, viewed_at) AS bucket,
          COUNT(*)::INT AS pageviews,
          COUNT(DISTINCT visitor_id)::INT AS visitors
        FROM web_page_views pv
        WHERE viewed_at >= NOW() - (${interval})::INTERVAL
        ${botFilter}
        GROUP BY 1
        ORDER BY 1
      `);

      return res.json({ bucket, points: rows.rows ?? rows });
    } catch (e: any) {
      console.error("[analytics/timeline] HATA:", e?.message);
      return res.status(500).json({ error: e?.message });
    }
  },
);

export default router;
