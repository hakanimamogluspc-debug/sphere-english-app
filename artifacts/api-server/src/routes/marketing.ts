import { Router, Request, Response, NextFunction } from "express";
import { db, pool, usersTable, contactLeadsTable, emailCampaignsTable, emailEventsTable, pageViewsTable, emailTemplatesTable } from "@workspace/db";
import { eq, desc, gte, count, and, or, inArray, sql } from "drizzle-orm";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth.js";
import nodemailer from "nodemailer";
import { Resend } from "resend";
import multer from "multer";
import path from "path";
import fs from "fs";
import { suppressedEmails, suppress, unsuppress, verifyMarketingUnsub, marketingUnsubUrl, unsubscribeFooterHtml } from "../lib/email-suppression.js";

const TEMPLATES_DIR = path.join(process.cwd(), "public", "templates");
if (!fs.existsSync(TEMPLATES_DIR)) fs.mkdirSync(TEMPLATES_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, TEMPLATES_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, `${unique}-${file.originalname}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [".html", ".htm", ".pdf"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error("Sadece HTML ve PDF dosyaları kabul edilir."));
  },
});

const router = Router();

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  const secure = port === 465;
  return nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS: !secure,
    auth: { user, pass },
    tls: { rejectUnauthorized: false, ciphers: "SSLv3" },
    connectionTimeout: 20000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  } as any);
}

async function sendEmailViaResendOrSmtp(
  to: string,
  subject: string,
  html: string,
  fromEmail: string,
  resend: Resend | null,
  transporter: ReturnType<typeof getTransporter>,
  headers?: Record<string, string>,
): Promise<{ ok: boolean; error?: string; resendEmailId?: string }> {
  const from = `Sphere English <${fromEmail}>`;
  if (resend) {
    const { data, error } = await resend.emails.send({ from, to, subject, html, ...(headers ? { headers } : {}) });
    if (error) return { ok: false, error: error.message };
    return { ok: true, resendEmailId: data?.id };
  }
  if (transporter) {
    await transporter.sendMail({ from, to, subject, html, ...(headers ? { headers } : {}) });
    return { ok: true };
  }
  return { ok: false, error: "E-posta yapılandırılmamış" };
}

// ─── Admin: Test email connection ──────────────────────────────────────────────
router.post(
  "/admin/marketing/smtp-test",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    const resend = getResend();
    if (resend) {
      return res.json({
        ok: true,
        config: { provider: "Resend", keySet: true },
        message: "Resend API yapılandırılmış ve hazır. info@sphereenglish.com üzerinden gönderim aktif.",
      });
    }

    const host = process.env.SMTP_HOST || "(boş)";
    const port = process.env.SMTP_PORT || "(boş)";
    const user = process.env.SMTP_USER || "(boş)";
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM || "(boş)";
    const config = { provider: "SMTP", host, port, user, from, passSet: !!pass, passLength: pass?.length ?? 0 };

    if (!pass) {
      return res.json({ ok: false, config, error: "SMTP_PASS tanımlanmamış" });
    }

    const transporter = getTransporter();
    if (!transporter) {
      return res.json({ ok: false, config, error: "SMTP_HOST, SMTP_USER veya SMTP_PASS eksik" });
    }

    try {
      await transporter.verify();
      return res.json({ ok: true, config, message: "Bağlantı başarılı! SMTP hazır." });
    } catch (e: any) {
      return res.json({ ok: false, config, error: `SMTP hatası: ${e?.message}` });
    }
  }
);

// ─── Public: Track page view (www site calls this) ───────────────────────────
router.post("/marketing/track", async (req: Request, res: Response) => {
  try {
    const { page, referrer } = req.body;
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "";
    const ua = req.headers["user-agent"] || "";
    await db.insert(pageViewsTable).values({ page: page || "/", referrer, ip, userAgent: ua });
    return res.json({ ok: true });
  } catch {
    return res.json({ ok: false });
  }
});

// ─── Public: Submit contact/lead form ────────────────────────────────────────
router.post("/marketing/contact", async (req: Request, res: Response) => {
  try {
    const { name, email, phone, company, message, source } = req.body;
    if (!name || !email) return res.status(400).json({ error: "Ad ve e-posta zorunludur." });
    await db.insert(contactLeadsTable).values({ name, email, phone, company, message, source: source || "website" });

    // Admin'lere mail bildirimi (non-blocking)
    void import("../lib/admin-notifications.js").then((m) =>
      m.notifyNewContactMessage({
        name,
        email,
        phone: phone || undefined,
        subject: company ? `${company} (${source ?? "website"})` : (source ?? "website"),
        message: message ?? "(Mesaj boş)",
      }),
    ).catch((e) => console.error("[marketing/contact] notify HATA:", e?.message));

    return res.json({ ok: true, message: "Mesajınız alındı. En kısa sürede iletişime geçeceğiz." });
  } catch (e: any) {
    return res.status(500).json({ error: "Bir hata oluştu." });
  }
});

// ─── Admin: Marketing stats ───────────────────────────────────────────────────
router.get(
  "/admin/marketing/stats",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - 7);
      const startOfMonth = new Date(now); startOfMonth.setDate(now.getDate() - 30);

      const [totalUsers] = await db.select({ count: count() }).from(usersTable);
      const [newToday] = await db.select({ count: count() }).from(usersTable).where(gte(usersTable.createdAt, startOfToday));
      const [newThisWeek] = await db.select({ count: count() }).from(usersTable).where(gte(usersTable.createdAt, startOfWeek));
      const [newThisMonth] = await db.select({ count: count() }).from(usersTable).where(gte(usersTable.createdAt, startOfMonth));

      const allLeads = await collectLeads();
      const [openLeads] = await db.select({ count: count() }).from(contactLeadsTable).where(eq(contactLeadsTable.status, "new"));

      const [totalPageViews] = await db.select({ count: count() }).from(pageViewsTable);
      const [weekPageViews] = await db.select({ count: count() }).from(pageViewsTable).where(gte(pageViewsTable.createdAt, startOfWeek));

      const [totalCampaigns] = await db.select({ count: count() }).from(emailCampaignsTable);
      const [sentCampaigns] = await db.select({ count: count() }).from(emailCampaignsTable).where(eq(emailCampaignsTable.status, "sent"));

      // Role breakdown
      const roleStats = await db
        .select({ role: usersTable.role, count: count() })
        .from(usersTable)
        .groupBy(usersTable.role);

      // Level breakdown
      const levelStats = await db
        .select({ level: usersTable.currentLevel, count: count() })
        .from(usersTable)
        .where(sql`${usersTable.currentLevel} IS NOT NULL`)
        .groupBy(usersTable.currentLevel);

      // Registrations per day (last 14 days)
      const dailyRegs = await db
        .select({
          date: sql<string>`DATE(${usersTable.createdAt})`,
          count: count(),
        })
        .from(usersTable)
        .where(gte(usersTable.createdAt, new Date(Date.now() - 14 * 86400000)))
        .groupBy(sql`DATE(${usersTable.createdAt})`);

      return res.json({
        users: {
          total: Number(totalUsers.count),
          newToday: Number(newToday.count),
          newThisWeek: Number(newThisWeek.count),
          newThisMonth: Number(newThisMonth.count),
        },
        leads: {
          // Tüm kaynaklar (iletişim, asistan, demo, kurs, e-kitap, bülten, haberdar ol, B2B) — e-posta başına tek
          total: allLeads.length,
          newThisWeek: allLeads.filter((l) => l.createdAt && new Date(l.createdAt) >= startOfWeek).length,
          open: Number(openLeads.count),
        },
        pageViews: {
          total: Number(totalPageViews.count),
          thisWeek: Number(weekPageViews.count),
        },
        campaigns: {
          total: Number(totalCampaigns.count),
          sent: Number(sentCampaigns.count),
        },
        roleBreakdown: roleStats,
        levelBreakdown: levelStats,
        dailyRegistrations: dailyRegs,
        emailConfigured: !!process.env.RESEND_API_KEY || (!!process.env.SMTP_HOST && !!process.env.SMTP_USER && !!process.env.SMTP_PASS),
      });
    } catch (e: any) {
      console.error("Marketing stats error:", e);
      return res.status(500).json({ error: "İstatistikler alınamadı." });
    }
  }
);

// ─── Admin: Get contact leads ─────────────────────────────────────────────────
/**
 * Tüm lead kaynakları tek listede. Aynı e-posta birden çok kaynaktan geldiyse TEK satır olur,
 * `sources` alanında hepsi listelenir. Öncelik (satırın adı/şirketi/durumu hangi kaynaktan alınır):
 * iletişim formu > site asistanı > demo > kurs alıcısı > e-kitap alıcısı > bülten > haberdar ol > B2B.
 */
const LEAD_SOURCE_ORDER = [
  "contact_form", "chatbot", "demo", "course_order", "ebook_purchase", "newsletter", "waitlist", "b2b",
] as const;
type LeadSource = (typeof LEAD_SOURCE_ORDER)[number];

async function collectLeads(): Promise<any[]> {
  const q = async (text: string) => {
    try { return (await pool.query(text)).rows as any[]; }
    catch (e: any) { console.warn("[marketing/leads] kaynak okunamadı:", e?.message); return []; }
  };
  const [contacts, buyers, courses, demos, news, waits, b2b] = await Promise.all([
    q(`SELECT id, name, email, phone, company, message, source, status, notes, created_at FROM contact_leads ORDER BY created_at DESC LIMIT 5000`),
    q(`SELECT DISTINCT ON (lower(buyer_email)) buyer_email AS email, buyer_name AS name, buyer_phone AS phone, created_at
         FROM ebook_purchases WHERE payment_status = 'success' AND buyer_email IS NOT NULL AND buyer_email <> ''
        ORDER BY lower(buyer_email), created_at DESC`),
    q(`SELECT DISTINCT ON (lower(buyer_email)) buyer_email AS email, buyer_name AS name, buyer_phone AS phone, programme_title, created_at
         FROM course_orders WHERE status IN ('paid','registered') ORDER BY lower(buyer_email), created_at DESC`),
    q(`SELECT DISTINCT ON (lower(customer_email)) customer_email AS email, customer_name AS name, customer_phone AS phone,
              customer_company AS company, message, status, booking_date, created_at
         FROM demo_bookings ORDER BY lower(customer_email), created_at DESC`),
    q(`SELECT email, created_at, unsubscribed_at FROM newsletter_subscribers`),
    q(`SELECT DISTINCT ON (lower(email)) email, interest_area, created_at FROM ebook_waitlist ORDER BY lower(email), created_at DESC`),
    q(`SELECT id, email, COALESCE(full_name, NULLIF(TRIM(COALESCE(first_name,'') || ' ' || COALESCE(last_name,'')), '')) AS name,
              company, job_title, segment, status, notes, discovered_at AS created_at
         FROM outreach_leads WHERE email IS NOT NULL AND email <> '' ORDER BY discovered_at DESC LIMIT 5000`),
  ]);

  const byEmail = new Map<string, any>();
  const add = (src: LeadSource, email: unknown, rec: Record<string, any>) => {
    const key = String(email ?? "").trim().toLowerCase();
    if (!key.includes("@")) return;
    const cur = byEmail.get(key);
    if (!cur) {
      byEmail.set(key, { email: key, sources: [src], ...rec, source: src });
      return;
    }
    if (!cur.sources.includes(src)) cur.sources.push(src);
    // Eksik alanları sonraki kaynaklardan tamamla
    for (const k of ["name", "phone", "company", "message"]) if (!cur[k] && rec[k]) cur[k] = rec[k];
    // En yeni hareket tarihi
    if (rec.createdAt && (!cur.createdAt || new Date(rec.createdAt) > new Date(cur.createdAt))) cur.createdAt = rec.createdAt;
  };

  // Öncelik sırasıyla ekle (ilk gelen satırın kimliği/durumu kullanılır)
  for (const l of contacts) {
    const src: LeadSource = l.source === "chatbot" ? "chatbot" : "contact_form";
    add(src, l.email, { id: `contact-${l.id}`, rawId: l.id, name: l.name, phone: l.phone, company: l.company,
      message: l.message, status: l.status ?? "new", notes: l.notes, createdAt: l.created_at, editable: true });
  }
  for (const d of demos) add("demo", d.email, { id: `demo-${d.email}`, rawId: d.email, name: d.name, phone: d.phone,
    company: d.company, message: d.message, status: "demo", createdAt: d.created_at,
    detail: `Demo: ${d.booking_date ? new Date(d.booking_date).toLocaleDateString("tr-TR") : ""} (${d.status})` });
  for (const c of courses) add("course_order", c.email, { id: `course-${c.email}`, rawId: c.email, name: c.name,
    phone: c.phone, status: "customer", createdAt: c.created_at, detail: `Kurs: ${c.programme_title}` });
  for (const b of buyers) add("ebook_purchase", b.email, { id: `ebook-${b.email}`, rawId: b.email, name: b.name,
    phone: b.phone, status: "customer", createdAt: b.created_at });
  for (const n of news) add("newsletter", n.email, { id: `news-${n.email}`, rawId: n.email, status: n.unsubscribed_at ? "lost" : "new",
    createdAt: n.created_at, detail: n.unsubscribed_at ? "Bültenden ayrıldı" : "Bülten abonesi" });
  for (const w of waits) add("waitlist", w.email, { id: `wait-${w.email}`, rawId: w.email, status: "new",
    createdAt: w.created_at, detail: w.interest_area ? `Haberdar ol: ${w.interest_area}` : "Haberdar ol listesi" });
  for (const o of b2b) add("b2b", o.email, { id: `b2b-${o.id}`, rawId: o.id, name: o.name, company: o.company,
    status: o.status === "rejected" ? "lost" : (o.status ?? "new"), notes: o.notes, createdAt: o.created_at, editable: true,
    detail: [o.job_title, o.segment].filter(Boolean).join(" · ") || null });

  const merged = [...byEmail.values()];
  merged.sort((a, b) => (b.createdAt ? new Date(b.createdAt).getTime() : 0) - (a.createdAt ? new Date(a.createdAt).getTime() : 0));
  return merged;
}

router.get(
  "/admin/marketing/leads",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      // ?source=<kaynak> ile tek kaynağa daraltılabilir (varsayılan: hepsi)
      const source = String(req.query.source ?? "all").toLowerCase();
      let merged = await collectLeads();
      if (source !== "all") merged = merged.filter((l) => l.sources.includes(source));

      // Listeden çıkanları işaretle (Leads ekranında rozet + toplu gönderimden hariç)
      const sup = await suppressedEmails();
      for (const l of merged) {
        const s = sup.get(String(l.email || "").toLowerCase());
        l.unsubscribed = !!s;
        l.unsubscribedAt = s?.createdAt ?? null;
      }
      return res.json(merged.slice(0, 10000));
    } catch (e: any) {
      console.error("[marketing/leads] HATA:", e?.message);
      return res.status(500).json({ error: "Leadler alınamadı." });
    }
  }
);

// ─── Admin: Listeden çıkar / geri al ──────────────────────────────────────────
router.post(
  "/admin/marketing/leads/unsubscribe",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    const emails = Array.isArray(req.body?.emails) ? req.body.emails.map(String) : [];
    if (emails.length === 0) return res.status(400).json({ error: "E-posta seçilmedi" });
    const added = await suppress(emails, String(req.body?.reason ?? "Admin: çıkma talebi"), "admin", req.userId);
    return res.json({ ok: true, added });
  },
);

router.post(
  "/admin/marketing/leads/resubscribe",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    const email = String(req.body?.email ?? "").trim();
    if (!email.includes("@")) return res.status(400).json({ error: "E-posta geçersiz" });
    await unsuppress(email);
    return res.json({ ok: true });
  },
);

// ─── Public: e-postadaki "listeden çık" bağlantısı (imzalı) ─────────────────
async function handlePublicUnsub(req: Request, res: Response) {
  const email = String(req.query.e ?? "").trim().toLowerCase();
  const ok = !!email && verifyMarketingUnsub(email, req.query.s);
  if (ok) await suppress([email], "E-postadaki bağlantıyla çıktı", "link").catch(() => {});
  if (req.method === "POST") return res.status(ok ? 200 : 400).json({ ok }); // List-Unsubscribe-Post (tek tık)
  res.status(ok ? 200 : 400);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'");
  return res.send(`<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sphere English</title>
<style>body{margin:0;background:#e8eef8;font-family:system-ui,sans-serif;color:#1e3a6e;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px}
.c{background:#fff;border-radius:16px;max-width:440px;padding:32px}p{color:#334155;line-height:1.6}a{color:#0e7da6}</style></head>
<body><div class="c"><h2>${ok ? "Listeden çıkarıldın" : "Bağlantı geçersiz"}</h2><p>${ok
    ? "Artık Sphere English kampanya ve duyuru e-postası almayacaksın. Satın aldığın ürünlerle ilgili e-postalar (indirme bağlantısı, fatura) gelmeye devam eder."
    : "Bu bağlantı tanınmadı. Listeden çıkmak için info@sphereenglish.com adresine yazabilirsin."}</p>
<p><a href="https://www.sphereenglish.com">sphereenglish.com</a></p></div></body></html>`);
}
router.get("/marketing/unsubscribe", handlePublicUnsub);
router.post("/marketing/unsubscribe", handlePublicUnsub);

// ─── Admin: Update lead status ────────────────────────────────────────────────
router.patch(
  "/admin/marketing/leads/:id",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      // id: "contact-12" / "b2b-34" (birleşik liste) ya da eski düz sayı (iletişim formu)
      const raw = String(req.params.id ?? "");
      const { status, notes } = req.body;
      const CONTACT_STATUSES = ["new", "contacted", "qualified", "lost"];
      if (raw.startsWith("b2b-")) {
        const id = Number(raw.slice(4));
        if (!Number.isInteger(id)) return res.status(400).json({ error: "id geçersiz" });
        // B2B kayıtlarında "Kaybedildi" karşılığı "rejected"
        const b2bStatus = status === "lost" ? "rejected" : status;
        await pool.query(
          `UPDATE outreach_leads SET status = COALESCE($2, status), notes = $3, updated_at = NOW() WHERE id = $1`,
          [id, ["new", "viewed", "contacted", "qualified", "rejected", "archived"].includes(b2bStatus) ? b2bStatus : null, notes ?? null],
        );
        return res.json({ ok: true });
      }
      const id = Number(raw.startsWith("contact-") ? raw.slice(8) : raw);
      if (!Number.isInteger(id)) return res.status(400).json({ error: "Bu lead türü düzenlenemez" });
      if (status && !CONTACT_STATUSES.includes(status)) return res.status(400).json({ error: "Geçersiz durum" });
      await db.update(contactLeadsTable).set({ status, notes, updatedAt: new Date() }).where(eq(contactLeadsTable.id, id));
      return res.json({ ok: true });
    } catch {
      return res.status(500).json({ error: "Güncelleme başarısız." });
    }
  }
);

// ─── Admin: Get email campaigns ───────────────────────────────────────────────
router.get(
  "/admin/marketing/campaigns",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const campaigns = await db.select().from(emailCampaignsTable).orderBy(desc(emailCampaignsTable.createdAt)).limit(50);
      return res.json(campaigns);
    } catch {
      return res.status(500).json({ error: "Kampanyalar alınamadı." });
    }
  }
);

// ─── Admin: Preview recipients ────────────────────────────────────────────────
router.post(
  "/admin/marketing/campaigns/preview",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { filter, customEmails } = req.body as { filter: string; customEmails?: string[] };
      const all = await getFilteredUsers(filter, customEmails);
      const sup = await suppressedEmails();
      const users = all.filter((u: any) => !sup.has(String(u.email).toLowerCase()));
      return res.json({
        count: users.length,
        excluded: all.length - users.length, // listeden çıkmış oldukları için gönderilmeyecekler
        sample: users.slice(0, 5).map(u => ({ email: u.email, name: `${u.firstName} ${u.lastName}`.trim() || u.email })),
      });
    } catch {
      return res.status(500).json({ error: "Önizleme başarısız." });
    }
  }
);

function extractNameFromEmail(email: string): string {
  const local = email.split("@")[0] || "";
  const parts = local.split(/[._\-+]/);
  const first = parts[0] || local;
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

/** Synthetic user object from an email (not registered in usersTable) */
function syntheticUser(email: string, name?: string | null) {
  const first = name ? name.split(" ")[0] : "";
  const last = name && name.split(" ").length > 1 ? name.split(" ").slice(1).join(" ") : "";
  return {
    email: email.trim().toLowerCase(),
    firstName: first,
    lastName: last,
    role: "student" as any,
    id: 0,
    passwordHash: "",
    createdAt: new Date(),
    updatedAt: new Date(),
    currentLevel: null as any,
    profilePicture: null,
    isActive: true,
    lastLoginAt: null,
  };
}

async function getEbookBuyerEmails(): Promise<Array<{ email: string; name: string | null }>> {
  const rows = await db.execute(sql`
    SELECT DISTINCT ON (buyer_email) buyer_email AS email, buyer_name AS name
    FROM ebook_purchases
    WHERE payment_status = 'success' AND buyer_email IS NOT NULL AND buyer_email != ''
    ORDER BY buyer_email, created_at DESC
  `);
  return ((rows.rows ?? rows) as any[]).map((r) => ({
    email: String(r.email).toLowerCase(),
    name: r.name || null,
  }));
}

async function getContactLeadEmails(): Promise<Array<{ email: string; name: string | null }>> {
  const rows = await db
    .select({ email: contactLeadsTable.email, name: contactLeadsTable.name })
    .from(contactLeadsTable);
  return rows
    .filter((r) => r.email)
    .map((r) => ({ email: r.email.toLowerCase(), name: r.name ?? null }));
}

async function getFilteredUsers(filter: string, customEmails?: string[]) {
  if (filter === "custom" && customEmails && customEmails.length > 0) {
    const emails = customEmails.map(e => e.trim().toLowerCase()).filter(Boolean);
    const dbUsers = await db.select().from(usersTable).where(inArray(usersTable.email, emails));
    const dbEmails = dbUsers.map(u => u.email.toLowerCase());
    const extraUsers = emails
      .filter(e => !dbEmails.includes(e))
      .map(e => syntheticUser(e));
    return [...dbUsers, ...extraUsers];
  }

  // ─── Ebook buyers — sadece e-kitap alanlar ─────────────────────────────
  if (filter === "ebook_buyers") {
    const buyers = await getEbookBuyerEmails();
    const emails = buyers.map(b => b.email);
    if (emails.length === 0) return [];
    const dbUsers = await db.select().from(usersTable).where(inArray(usersTable.email, emails));
    const dbEmails = new Set(dbUsers.map(u => u.email.toLowerCase()));
    const extraUsers = buyers
      .filter(b => !dbEmails.has(b.email))
      .map(b => syntheticUser(b.email, b.name));
    return [...dbUsers, ...extraUsers];
  }

  // ─── Contact form lead'leri ────────────────────────────────────────────
  if (filter === "contact_leads") {
    const leads = await getContactLeadEmails();
    const emails = leads.map(l => l.email);
    if (emails.length === 0) return [];
    const dbUsers = await db.select().from(usersTable).where(inArray(usersTable.email, emails));
    const dbEmails = new Set(dbUsers.map(u => u.email.toLowerCase()));
    const extraUsers = leads
      .filter(l => !dbEmails.has(l.email))
      .map(l => syntheticUser(l.email, l.name));
    return [...dbUsers, ...extraUsers];
  }

  // ─── Herkes — kayıtlı users + ebook buyers + contact leads (dedupe) ────
  if (filter === "everyone") {
    const [users, buyers, leads] = await Promise.all([
      db.select().from(usersTable),
      getEbookBuyerEmails(),
      getContactLeadEmails(),
    ]);
    const seen = new Set(users.map(u => u.email.toLowerCase()));
    const extras: any[] = [];
    for (const b of buyers) {
      if (!seen.has(b.email)) { seen.add(b.email); extras.push(syntheticUser(b.email, b.name)); }
    }
    for (const l of leads) {
      if (!seen.has(l.email)) { seen.add(l.email); extras.push(syntheticUser(l.email, l.name)); }
    }
    return [...users, ...extras];
  }

  if (filter === "all") {
    return db.select().from(usersTable);
  }
  if (filter.startsWith("role:")) {
    const role = filter.replace("role:", "") as any;
    return db.select().from(usersTable).where(eq(usersTable.role, role));
  }
  if (filter.startsWith("level:")) {
    const level = filter.replace("level:", "") as any;
    return db.select().from(usersTable).where(eq(usersTable.currentLevel, level));
  }
  return db.select().from(usersTable);
}

// ─── Admin: Send email campaign ───────────────────────────────────────────────
router.post(
  "/admin/marketing/campaigns/send",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { subject, body, filter, variables, customEmails, customName } = req.body as { subject: string; body: string; filter: string; variables?: Record<string, string>; customEmails?: string[]; customName?: string };

      if (!subject?.trim() || !body?.trim()) {
        return res.status(400).json({ error: "Konu ve içerik zorunludur." });
      }

      if (filter === "custom" && (!customEmails || customEmails.length === 0)) {
        return res.status(400).json({ error: "Özel gönderim için en az bir e-posta adresi girin." });
      }

      const allRecipients = await getFilteredUsers(filter || "all", customEmails);
      // Listeden çıkanlara hiçbir toplu e-posta gitmez
      const sup = await suppressedEmails();
      const recipients = allRecipients.filter((u: any) => !sup.has(String(u.email).toLowerCase()));
      const excludedCount = allRecipients.length - recipients.length;
      if (recipients.length === 0) {
        return res.status(400).json({ error: excludedCount > 0 ? "Seçilen alıcıların hepsi listeden çıkmış." : "Bu filtreye uyan alıcı bulunamadı." });
      }

      // Create campaign record
      const [campaign] = await db.insert(emailCampaignsTable).values({
        subject,
        body,
        recipientFilter: filter || "all",
        recipientCount: recipients.length,
        sentCount: 0,
        status: "sending",
        createdBy: req.userId,
      }).returning();

      const resend = getResend();
      const transporter = resend ? null : getTransporter();
      const fromEmail = process.env.SMTP_FROM || "info@sphereenglish.com";

      let sentCount = 0;
      const sendErrors: string[] = [];

      if (resend || transporter) {
        // Verify SMTP connection first (only if using SMTP)
        if (!resend && transporter) {
          try {
            await transporter.verify();
          } catch (verifyErr: any) {
            await db.update(emailCampaignsTable)
              .set({ status: "failed" })
              .where(eq(emailCampaignsTable.id, campaign.id));
            return res.status(500).json({ error: `SMTP bağlantı hatası: ${verifyErr?.message || verifyErr}` });
          }
        }

        for (const user of recipients) {
          try {
            // For non-registered users: use customName if given, else extract from email
            const resolvedFirstName = user.firstName || customName?.trim() || extractNameFromEmail(user.email);
            const resolvedLastName = user.lastName || "";
            let personalizedBody = body
              .replace(/\{\{EMAIL\}\}/g, user.email || "")
              .replace(/\{\{AD\}\}/g, resolvedFirstName)
              .replace(/\{\{SOYAD\}\}/g, resolvedLastName)
              .replace(/\{\{AD_SOYAD\}\}/g, `${resolvedFirstName} ${resolvedLastName}`.trim());
            if (variables && typeof variables === "object") {
              for (const [key, val] of Object.entries(variables)) {
                personalizedBody = personalizedBody.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), val);
              }
            }
            // "Listeden çık" bağlantısı: şablonda {{LISTEDEN_CIK}} varsa oraya, yoksa en alta eklenir
            const unsubUrl = marketingUnsubUrl(user.email);
            personalizedBody = /\{\{LISTEDEN_CIK\}\}/.test(personalizedBody)
              ? personalizedBody.replace(/\{\{LISTEDEN_CIK\}\}/g, unsubUrl)
              : /<\/body>/i.test(personalizedBody)
                ? personalizedBody.replace(/<\/body>/i, `${unsubscribeFooterHtml(user.email)}</body>`)
                : personalizedBody + unsubscribeFooterHtml(user.email);
            const result = await sendEmailViaResendOrSmtp(user.email, subject, personalizedBody, fromEmail, resend, transporter, {
              "List-Unsubscribe": `<${unsubUrl}>`,
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            });
            if (result.ok) {
              sentCount++;
              // Resend email ID'sini kaydet (webhook ile eşleştirmek için)
              if (result.resendEmailId) {
                await pool.query(
                  `INSERT INTO email_events (campaign_id, resend_email_id, recipient_email, event_type) VALUES ($1, $2, $3, 'email.sent')`,
                  [campaign.id, result.resendEmailId, user.email]
                );
              }
            } else {
              sendErrors.push(`${user.email}: ${result.error}`);
            }
          } catch (e: any) {
            console.error(`Email failed for ${user.email}:`, e);
            sendErrors.push(`${user.email}: ${e?.message || e}`);
          }
        }
        await db.update(emailCampaignsTable)
          .set({ status: "sent", sentCount, sentAt: new Date() })
          .where(eq(emailCampaignsTable.id, campaign.id));
      } else {
        await db.update(emailCampaignsTable)
          .set({ status: "sent", sentCount: recipients.length, sentAt: new Date() })
          .where(eq(emailCampaignsTable.id, campaign.id));
        sentCount = recipients.length;
      }

      return res.json({
        ok: true,
        campaignId: campaign.id,
        sent: sentCount,
        total: recipients.length,
        excluded: excludedCount,
        provider: resend ? "resend" : transporter ? "smtp" : "demo",
        errors: sendErrors.length > 0 ? sendErrors : undefined,
      });
    } catch (e: any) {
      console.error("Campaign send error:", e);
      return res.status(500).json({ error: "Kampanya gönderilemedi: " + (e?.message || "") });
    }
  }
);

// ─── Admin: List templates ────────────────────────────────────────────────────
router.get(
  "/admin/marketing/templates",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const templates = await db.select().from(emailTemplatesTable).orderBy(desc(emailTemplatesTable.createdAt));
      return res.json(templates);
    } catch {
      return res.status(500).json({ error: "Şablonlar alınamadı." });
    }
  }
);

// ─── Admin: Upload template ───────────────────────────────────────────────────
router.post(
  "/admin/marketing/templates",
  authMiddleware,
  requireRole("admin"),
  (req: AuthRequest, res: Response, next: NextFunction) => {
    upload.single("file")(req as any, res as any, next);
  },
  async (req: AuthRequest, res: Response) => {
    try {
      const file = (req as any).file;
      if (!file) return res.status(400).json({ error: "Dosya seçilmedi." });
      const { name, subject } = req.body;
      if (!name?.trim()) return res.status(400).json({ error: "Şablon adı zorunludur." });
      const ext = path.extname(file.originalname).toLowerCase();
      const fileType = ext === ".pdf" ? "pdf" : "html";
      let htmlContent: string | null = null;
      if (fileType === "html") {
        htmlContent = fs.readFileSync(file.path, "utf-8");
      }
      const [tpl] = await db.insert(emailTemplatesTable).values({
        name: name.trim(),
        subject: subject?.trim() || "",
        htmlContent,
        fileType,
        fileName: file.originalname,
        filePath: file.filename,
        createdBy: req.userId,
      }).returning();
      return res.json({ ok: true, template: tpl });
    } catch (e: any) {
      return res.status(500).json({ error: e.message || "Yükleme başarısız." });
    }
  }
);

// ─── Admin: Save HTML code as template ───────────────────────────────────────
router.post(
  "/admin/marketing/templates/html",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { name, subject, htmlContent } = req.body;
      if (!name?.trim()) return res.status(400).json({ error: "Şablon adı zorunludur." });
      if (!htmlContent?.trim()) return res.status(400).json({ error: "HTML içeriği boş olamaz." });
      const [tpl] = await db.insert(emailTemplatesTable).values({
        name: name.trim(),
        subject: subject?.trim() || "",
        htmlContent: htmlContent.trim(),
        fileType: "html",
        fileName: `${name.trim().replace(/\s+/g, "_")}.html`,
        filePath: null,
        createdBy: req.userId,
      }).returning();
      return res.json({ ok: true, template: tpl });
    } catch (e: any) {
      return res.status(500).json({ error: e.message || "Kaydetme başarısız." });
    }
  }
);

// ─── Admin: Delete template ───────────────────────────────────────────────────
router.delete(
  "/admin/marketing/templates/:id",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = Number((req.params.id as string));
      const [tpl] = await db.select().from(emailTemplatesTable).where(eq(emailTemplatesTable.id, id));
      if (tpl?.filePath) {
        const fp = path.join(TEMPLATES_DIR, tpl.filePath);
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
      }
      await db.delete(emailTemplatesTable).where(eq(emailTemplatesTable.id, id));
      return res.json({ ok: true });
    } catch {
      return res.status(500).json({ error: "Silme başarısız." });
    }
  }
);

// ─── Admin: Download/view PDF template ───────────────────────────────────────
router.get(
  "/admin/marketing/templates/:id/download",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = Number((req.params.id as string));
      const [tpl] = await db.select().from(emailTemplatesTable).where(eq(emailTemplatesTable.id, id));
      if (!tpl?.filePath) return res.status(404).json({ error: "Şablon bulunamadı." });
      const fp = path.resolve(TEMPLATES_DIR, path.basename(tpl.filePath));
      if (!fp.startsWith(path.resolve(TEMPLATES_DIR))) return res.status(400).json({ error: "Geçersiz dosya yolu." });
      if (!fs.existsSync(fp)) return res.status(404).json({ error: "Dosya bulunamadı." });
      const safeFileName = path.basename(tpl.fileName || "template").replace(/[^\w.\-]/g, "_");
      res.setHeader("Content-Disposition", `inline; filename="${safeFileName}"`);
      res.setHeader("Content-Type", tpl.fileType === "pdf" ? "application/pdf" : "text/html");
      return res.send(fs.readFileSync(fp));
    } catch {
      return res.status(500).json({ error: "İndirme başarısız." });
    }
  }
);

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildEmailHtml(subject: string, body: string, recipientName: string): string {
  const bodyHtml = escHtml(body).replace(/\n/g, "<br>");
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
  .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; }
  .header { background: #1B365D; padding: 24px 32px; }
  .header img { height: 40px; }
  .content { padding: 32px; color: #333; line-height: 1.6; }
  .footer { background: #f5f5f5; padding: 16px 32px; text-align: center; color: #999; font-size: 12px; }
</style></head>
<body>
  <div class="container">
    <div class="header">
      <span style="color:white;font-size:22px;font-weight:bold;">Sphere English</span>
    </div>
    <div class="content">
      <p>Merhaba ${escHtml(recipientName)},</p>
      <p>${bodyHtml}</p>
    </div>
    <div class="footer">
      <p>© 2025 Sphere English. Tüm hakları saklıdır.</p>
      <p><a href="https://app.sphereenglish.com" style="color:#0ea5e9;">app.sphereenglish.com</a></p>
    </div>
  </div>
</body>
</html>`;
}

export default router;
