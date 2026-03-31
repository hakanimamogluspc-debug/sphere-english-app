import { Router, Request, Response } from "express";
import { db, usersTable, contactLeadsTable, emailCampaignsTable, pageViewsTable } from "@workspace/db";
import { eq, desc, gte, count, and, or, inArray, sql } from "drizzle-orm";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth.js";
import nodemailer from "nodemailer";

const router = Router();

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  return nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
}

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
        emailConfigured: !!process.env.SMTP_HOST && !!process.env.SMTP_USER && !!process.env.SMTP_PASS,
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
      const leads = await db.select().from(contactLeadsTable).orderBy(desc(contactLeadsTable.createdAt)).limit(200);
      return res.json(leads);
    } catch {
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
      const { filter } = req.body as { filter: string };
      const users = await getFilteredUsers(filter);
      return res.json({ count: users.length, sample: users.slice(0, 5).map(u => ({ email: u.email, name: `${u.firstName} ${u.lastName}` })) });
    } catch {
      return res.status(500).json({ error: "Önizleme başarısız." });
    }
  }
);

async function getFilteredUsers(filter: string) {
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
      const { subject, body, filter } = req.body as { subject: string; body: string; filter: string };

      if (!subject?.trim() || !body?.trim()) {
        return res.status(400).json({ error: "Konu ve içerik zorunludur." });
      }

      const recipients = await getFilteredUsers(filter || "all");
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

      const transporter = getTransporter();
      const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@sphereenglish.com";

      let sentCount = 0;

      if (transporter) {
        // Send emails in batches of 10
        for (const user of recipients) {
          try {
            await transporter.sendMail({
              from: `Sphere English <${fromEmail}>`,
              to: user.email,
              subject,
              html: buildEmailHtml(subject, body, `${user.firstName} ${user.lastName}`),
            });
            sentCount++;
          } catch (e) {
            console.error(`Email failed for ${user.email}:`, e);
          }
        }
        await db.update(emailCampaignsTable)
          .set({ status: "sent", sentCount, sentAt: new Date() })
          .where(eq(emailCampaignsTable.id, campaign.id));
      } else {
        // SMTP not configured — mark as sent (demo mode)
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
        smtpConfigured: !!transporter,
      });
    } catch (e: any) {
      console.error("Campaign send error:", e);
      return res.status(500).json({ error: "Kampanya gönderilemedi: " + (e?.message || "") });
    }
  }
);

function buildEmailHtml(subject: string, body: string, recipientName: string): string {
  const bodyHtml = body.replace(/\n/g, "<br>");
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
      <p>Merhaba ${recipientName},</p>
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
