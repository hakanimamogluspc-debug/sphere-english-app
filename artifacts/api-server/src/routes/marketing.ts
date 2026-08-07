import { Router, Request, Response } from "express";
import { db, pool, usersTable, contactLeadsTable, emailCampaignsTable, emailEventsTable, pageViewsTable, emailTemplatesTable } from "@workspace/db";
import { eq, desc, gte, count, and, or, inArray, sql } from "drizzle-orm";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth.js";
import nodemailer from "nodemailer";
import { Resend } from "resend";
import multer from "multer";
import path from "path";
import fs from "fs";

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
  transporter: ReturnType<typeof getTransporter>
): Promise<{ ok: boolean; error?: string; resendEmailId?: string }> {
  const from = `Sphere English <${fromEmail}>`;
  if (resend) {
    const { data, error } = await resend.emails.send({ from, to, subject, html });
    if (error) return { ok: false, error: error.message };
    return { ok: true, resendEmailId: data?.id };
  }
  if (transporter) {
    await transporter.sendMail({ from, to, subject, html });
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

      const [totalLeads] = await db.select({ count: count() }).from(contactLeadsTable);
      const [newLeads] = await db.select({ count: count() }).from(contactLeadsTable).where(gte(contactLeadsTable.createdAt, startOfWeek));
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
          total: Number(totalLeads.count),
          newThisWeek: Number(newLeads.count),
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
router.get(
  "/admin/marketing/leads",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      // ?source=contact_form | ebook_purchase | all (default: all)
      const source = String((req.query.source ?? "all")).toLowerCase();

      // Contact form lead'leri
      const contactLeads =
        source === "ebook_purchase"
          ? []
          : (await db
              .select()
              .from(contactLeadsTable)
              .orderBy(desc(contactLeadsTable.createdAt))
              .limit(500)
            ).map((l: any) => ({
              id: `contact-${l.id}`,
              rawId: l.id,
              source: "contact_form" as const,
              email: l.email,
              name: l.name,
              phone: l.phone ?? null,
              company: l.company ?? null,
              message: l.message ?? null,
              status: l.status ?? "new",
              notes: l.notes ?? null,
              createdAt: l.createdAt,
            }));

      // E-kitap alıcıları — success statülü satın alanlar, unique email
      let ebookLeads: any[] = [];
      if (source !== "contact_form") {
        const rows = await db.execute(sql`
          SELECT DISTINCT ON (buyer_email)
            buyer_email, buyer_name, buyer_phone, created_at
          FROM ebook_purchases
          WHERE payment_status = 'success' AND buyer_email IS NOT NULL AND buyer_email != ''
          ORDER BY buyer_email, created_at DESC
          LIMIT 1000
        `);
        ebookLeads = ((rows.rows ?? rows) as any[]).map((r: any) => ({
          id: `ebook-${r.buyer_email}`,
          rawId: r.buyer_email,
          source: "ebook_purchase" as const,
          email: r.buyer_email,
          name: r.buyer_name || null,
          phone: r.buyer_phone || null,
          company: null,
          message: null,
          status: "customer",
          notes: null,
          createdAt: r.created_at,
        }));
      }

      // Birleştir + email bazında deduplicate (contact form önce, ebook alıcı ikinci)
      const seen = new Set<string>();
      const merged: any[] = [];
      for (const l of [...contactLeads, ...ebookLeads]) {
        const key = String(l.email || "").toLowerCase();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        merged.push(l);
      }
      // Tarihe göre sırala (yeni önce)
      merged.sort((a, b) => {
        const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bt - at;
      });

      return res.json(merged.slice(0, 500));
    } catch (e: any) {
      console.error("[marketing/leads] HATA:", e?.message);
      return res.status(500).json({ error: "Leadler alınamadı." });
    }
  }
);

// ─── Admin: Update lead status ────────────────────────────────────────────────
router.patch(
  "/admin/marketing/leads/:id",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = Number(req.params.id);
      const { status, notes } = req.body;
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
      const users = await getFilteredUsers(filter, customEmails);
      return res.json({ count: users.length, sample: users.slice(0, 5).map(u => ({ email: u.email, name: `${u.firstName} ${u.lastName}`.trim() || u.email })) });
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

      const recipients = await getFilteredUsers(filter || "all", customEmails);
      if (recipients.length === 0) {
        return res.status(400).json({ error: "Bu filtreye uyan alıcı bulunamadı." });
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
            const result = await sendEmailViaResendOrSmtp(user.email, subject, personalizedBody, fromEmail, resend, transporter);
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
  (req: AuthRequest, res: Response, next) => {
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
      const id = Number(req.params.id);
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
      const id = Number(req.params.id);
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
