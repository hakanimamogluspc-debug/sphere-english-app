/**
 * B2B Outbound API — R7
 *
 * Endpoint'ler:
 *   Template CRUD:
 *     GET    /admin/outbound/templates
 *     POST   /admin/outbound/templates
 *     PATCH  /admin/outbound/templates/:id
 *     DELETE /admin/outbound/templates/:id
 *
 *   Campaign CRUD:
 *     GET    /admin/outbound/campaigns
 *     POST   /admin/outbound/campaigns
 *     GET    /admin/outbound/campaigns/:id
 *     PATCH  /admin/outbound/campaigns/:id
 *     DELETE /admin/outbound/campaigns/:id
 *     POST   /admin/outbound/campaigns/:id/start
 *     POST   /admin/outbound/campaigns/:id/pause
 *     POST   /admin/outbound/campaigns/:id/add-leads  (batch)
 *
 *   Sequence steps:
 *     POST   /admin/outbound/campaigns/:id/steps
 *     PATCH  /admin/outbound/steps/:stepId
 *     DELETE /admin/outbound/steps/:stepId
 *
 *   Test:
 *     POST   /admin/outbound/send-test  (single test email)
 *
 *   Tracking (public):
 *     GET    /outbound/track/open/:eventId.gif  (open tracker)
 *     GET    /outbound/track/click              (click tracker → redirect)
 *
 *   Webhooks (public):
 *     POST   /webhooks/sendgrid    (deliverability events)
 *     POST   /webhooks/postmark    (deliverability events)
 *     POST   /webhooks/calendly    (booking events)
 *
 *   Analytics:
 *     GET    /admin/outbound/stats
 *     GET    /admin/outbound/campaigns/:id/analytics
 */

import { Router, type Response, type Request } from "express";
import crypto from "crypto";
import {
  db,
  outboundTemplatesTable, outboundCampaignsTable,
  outboundSequenceStepsTable, outboundCampaignLeadsTable,
  outboundEmailEventsTable, outboundMeetingsTable,
  outreachLeadsTable,
} from "@workspace/db";
import { and, count, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth.js";
import { sendOutboundEmail, renderTemplate } from "../services/email-provider.js";

const router = Router();

// ═══════════════════════════════════════════════════════════════════════
// TEMPLATE CRUD
// ═══════════════════════════════════════════════════════════════════════

router.get("/admin/outbound/templates", authMiddleware, requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const rows = await db.select().from(outboundTemplatesTable)
        .where(eq(outboundTemplatesTable.isActive, true))
        .orderBy(desc(outboundTemplatesTable.updatedAt));
      return res.json({ ok: true, templates: rows });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message });
    }
  });

router.post("/admin/outbound/templates", authMiddleware, requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { name, subject, bodyHtml, bodyText, segment, variables } = req.body;
      if (!name || !subject || !bodyHtml) {
        return res.status(400).json({ error: "name, subject, bodyHtml zorunlu" });
      }
      const [row] = await db.insert(outboundTemplatesTable).values({
        name, subject, bodyHtml,
        bodyText: bodyText || bodyHtml.replace(/<[^>]+>/g, ""),
        segment: segment || null,
        variables: variables || {},
        createdBy: req.userId ?? null,
      }).returning();
      return res.json({ ok: true, template: row });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message });
    }
  });

router.patch("/admin/outbound/templates/:id", authMiddleware, requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const patch: any = {};
      for (const k of ["name", "subject", "bodyHtml", "bodyText", "segment", "isActive"]) {
        if (req.body[k] !== undefined) patch[k] = req.body[k];
      }
      patch.updatedAt = new Date();
      const [row] = await db.update(outboundTemplatesTable).set(patch)
        .where(eq(outboundTemplatesTable.id, id)).returning();
      return res.json({ ok: true, template: row });
    } catch (e: any) { return res.status(500).json({ error: e?.message }); }
  });

router.delete("/admin/outbound/templates/:id", authMiddleware, requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      await db.update(outboundTemplatesTable).set({ isActive: false })
        .where(eq(outboundTemplatesTable.id, id));
      return res.json({ ok: true });
    } catch (e: any) { return res.status(500).json({ error: e?.message }); }
  });

// ═══════════════════════════════════════════════════════════════════════
// CAMPAIGN CRUD
// ═══════════════════════════════════════════════════════════════════════

router.get("/admin/outbound/campaigns", authMiddleware, requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const rows = await db.select().from(outboundCampaignsTable)
        .orderBy(desc(outboundCampaignsTable.updatedAt));
      return res.json({ ok: true, campaigns: rows });
    } catch (e: any) { return res.status(500).json({ error: e?.message }); }
  });

router.post("/admin/outbound/campaigns", authMiddleware, requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { name, description, segment, targetCriteria, fromName, fromEmail, replyToEmail, dailySendLimit } = req.body;
      if (!name || !segment || !fromName || !fromEmail) {
        return res.status(400).json({ error: "name, segment, fromName, fromEmail zorunlu" });
      }
      const [row] = await db.insert(outboundCampaignsTable).values({
        name, description: description || null,
        segment,
        targetCriteria: targetCriteria || {},
        fromName, fromEmail,
        replyToEmail: replyToEmail || fromEmail,
        dailySendLimit: dailySendLimit || 50,
        createdBy: req.userId ?? null,
      }).returning();
      return res.json({ ok: true, campaign: row });
    } catch (e: any) { return res.status(500).json({ error: e?.message }); }
  });

router.get("/admin/outbound/campaigns/:id", authMiddleware, requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const [campaign] = await db.select().from(outboundCampaignsTable)
        .where(eq(outboundCampaignsTable.id, id));
      if (!campaign) return res.status(404).json({ error: "Kampanya bulunamadı" });
      const steps = await db.select().from(outboundSequenceStepsTable)
        .where(eq(outboundSequenceStepsTable.campaignId, id))
        .orderBy(outboundSequenceStepsTable.stepOrder);
      return res.json({ ok: true, campaign, steps });
    } catch (e: any) { return res.status(500).json({ error: e?.message }); }
  });

router.post("/admin/outbound/campaigns/:id/start", authMiddleware, requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const [row] = await db.update(outboundCampaignsTable)
        .set({ status: "active", startedAt: new Date(), updatedAt: new Date() })
        .where(eq(outboundCampaignsTable.id, id)).returning();
      return res.json({ ok: true, campaign: row });
    } catch (e: any) { return res.status(500).json({ error: e?.message }); }
  });

router.post("/admin/outbound/campaigns/:id/pause", authMiddleware, requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const [row] = await db.update(outboundCampaignsTable)
        .set({ status: "paused", updatedAt: new Date() })
        .where(eq(outboundCampaignsTable.id, id)).returning();
      return res.json({ ok: true, campaign: row });
    } catch (e: any) { return res.status(500).json({ error: e?.message }); }
  });

router.post("/admin/outbound/campaigns/:id/add-leads", authMiddleware, requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { leadIds } = req.body as { leadIds: number[] };
      if (!Array.isArray(leadIds) || leadIds.length === 0) {
        return res.status(400).json({ error: "leadIds boş" });
      }
      const inserts = leadIds.map(leadId => ({
        campaignId: id, leadId, currentStep: 0 as number,
        status: "pending" as const, nextSendAt: new Date(),
      }));
      // ON CONFLICT DO NOTHING — duplicate insert skip
      await db.insert(outboundCampaignLeadsTable).values(inserts)
        .onConflictDoNothing({
          target: [outboundCampaignLeadsTable.campaignId, outboundCampaignLeadsTable.leadId],
        });
      // Kampanya sayacını güncelle
      const [{ n }] = await db.select({ n: count() })
        .from(outboundCampaignLeadsTable)
        .where(eq(outboundCampaignLeadsTable.campaignId, id));
      await db.update(outboundCampaignsTable)
        .set({ totalRecipients: Number(n), updatedAt: new Date() })
        .where(eq(outboundCampaignsTable.id, id));
      return res.json({ ok: true, added: leadIds.length, totalRecipients: Number(n) });
    } catch (e: any) { return res.status(500).json({ error: e?.message }); }
  });

// ═══════════════════════════════════════════════════════════════════════
// SEQUENCE STEPS
// ═══════════════════════════════════════════════════════════════════════

router.post("/admin/outbound/campaigns/:id/steps", authMiddleware, requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const campaignId = parseInt(req.params.id, 10);
      const { templateId, stepOrder, delayDays, condition } = req.body;
      if (!templateId) return res.status(400).json({ error: "templateId zorunlu" });
      const [row] = await db.insert(outboundSequenceStepsTable).values({
        campaignId, templateId,
        stepOrder: stepOrder || 1,
        delayDays: delayDays || 0,
        condition: condition || "always",
      }).returning();
      return res.json({ ok: true, step: row });
    } catch (e: any) { return res.status(500).json({ error: e?.message }); }
  });

router.delete("/admin/outbound/steps/:stepId", authMiddleware, requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const stepId = parseInt(req.params.stepId, 10);
      await db.delete(outboundSequenceStepsTable).where(eq(outboundSequenceStepsTable.id, stepId));
      return res.json({ ok: true });
    } catch (e: any) { return res.status(500).json({ error: e?.message }); }
  });

// ═══════════════════════════════════════════════════════════════════════
// SEND TEST
// ═══════════════════════════════════════════════════════════════════════

router.post("/admin/outbound/send-test", authMiddleware, requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { templateId, testEmail, fromName, fromEmail } = req.body;
      if (!templateId || !testEmail) {
        return res.status(400).json({ error: "templateId, testEmail zorunlu" });
      }
      const [tpl] = await db.select().from(outboundTemplatesTable)
        .where(eq(outboundTemplatesTable.id, Number(templateId)));
      if (!tpl) return res.status(404).json({ error: "Template bulunamadı" });

      const mockLead = {
        firstName: "Test", lastName: "Kullanıcı", fullName: "Test Kullanıcı",
        company: "Örnek Şirket A.Ş.", jobTitle: "İK Direktörü",
        email: testEmail,
      };
      const subject = renderTemplate(tpl.subject, mockLead);
      const html = renderTemplate(tpl.bodyHtml, mockLead);
      const text = renderTemplate(tpl.bodyText || tpl.bodyHtml.replace(/<[^>]+>/g, ""), mockLead);

      const result = await sendOutboundEmail({
        to: testEmail,
        toName: mockLead.fullName,
        from: fromEmail || process.env.SENDGRID_FROM_EMAIL || "hakan@sphereenglish.com",
        fromName: fromName || "Sphere English (Test)",
        subject: `[TEST] ${subject}`,
        html, text,
        customArgs: { test: "true", template_id: String(templateId) },
      });

      if (!result.ok) return res.status(500).json({ error: result.error });
      return res.json({ ok: true, messageId: result.messageId });
    } catch (e: any) { return res.status(500).json({ error: e?.message }); }
  });

// ═══════════════════════════════════════════════════════════════════════
// CALENDLY WEBHOOK
// ═══════════════════════════════════════════════════════════════════════

router.post("/webhooks/calendly", async (req: Request, res: Response) => {
  try {
    const { event, payload } = req.body as { event?: string; payload?: any };
    if (event === "invitee.created" && payload) {
      // Bulmaya çalış: e-posta üzerinden lead + kampanya
      const inviteeEmail: string = payload.email;
      const [lead] = inviteeEmail
        ? await db.select().from(outreachLeadsTable).where(eq(outreachLeadsTable.email, inviteeEmail))
        : [null];

      // Toplantıyı kaydet
      await db.insert(outboundMeetingsTable).values({
        leadId: lead?.id ?? null,
        campaignId: null, // custom query param üzerinden gelirse doldur
        calendlyEventUri: payload.event?.uri || payload.uri || String(payload.event_uuid || ""),
        calendlyInviteeUri: payload.uri,
        calendlyEventType: payload.event_type?.name || null,
        inviteeName: payload.name || null,
        inviteeEmail,
        inviteeCompany: payload.questions_and_answers?.find((q: any) =>
          /company|şirket/i.test(q.question))?.answer || null,
        inviteePhone: payload.questions_and_answers?.find((q: any) =>
          /phone|telefon/i.test(q.question))?.answer || null,
        scheduledAt: new Date(payload.event?.start_time || payload.start_time),
        durationMinutes: null,
        meetingUrl: payload.event?.location?.join_url || null,
        location: payload.event?.location?.type || null,
        questionsAnswers: payload.questions_and_answers || [],
      }).onConflictDoNothing({ target: outboundMeetingsTable.calendlyEventUri });

      // Lead varsa status'ü qualified yap
      if (lead) {
        await db.update(outreachLeadsTable)
          .set({ status: "qualified", updatedAt: new Date() })
          .where(eq(outreachLeadsTable.id, lead.id));
      }
    }
    return res.json({ ok: true });
  } catch (e: any) {
    console.error("[calendly webhook]", e?.message);
    return res.json({ ok: false, error: e?.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// SENDGRID WEBHOOK (open, click, bounce, spam, etc.)
// ═══════════════════════════════════════════════════════════════════════

router.post("/webhooks/sendgrid", async (req: Request, res: Response) => {
  try {
    const events = Array.isArray(req.body) ? req.body : [req.body];
    for (const ev of events) {
      // custom_args'tan campaign_id + lead_id çıkar
      const campaignId = Number(ev.campaign_id);
      const leadId = Number(ev.lead_id);
      const stepId = ev.step_id ? Number(ev.step_id) : null;
      if (!campaignId || !leadId) continue;

      const type = mapSendGridEvent(ev.event);
      if (!type) continue;

      await db.insert(outboundEmailEventsTable).values({
        campaignId, leadId, stepId,
        templateId: ev.template_id ? Number(ev.template_id) : null,
        eventType: type,
        providerMessageId: ev.sg_message_id || null,
        userAgent: ev.useragent || null,
        ipAddress: ev.ip || null,
        clickUrl: ev.url || null,
        bounceReason: ev.reason || null,
        rawData: ev,
        occurredAt: ev.timestamp ? new Date(ev.timestamp * 1000) : new Date(),
      });

      // Kampanya sayaçlarını güncelle
      await incrementCampaignCounter(campaignId, type);

      // Lead status güncelle (reply, bounce, unsub)
      if (type === "replied") {
        await db.update(outboundCampaignLeadsTable)
          .set({ status: "replied", lastEventAt: new Date() })
          .where(and(eq(outboundCampaignLeadsTable.campaignId, campaignId), eq(outboundCampaignLeadsTable.leadId, leadId)));
      } else if (type === "bounced") {
        await db.update(outboundCampaignLeadsTable)
          .set({ status: "bounced", lastEventAt: new Date() })
          .where(and(eq(outboundCampaignLeadsTable.campaignId, campaignId), eq(outboundCampaignLeadsTable.leadId, leadId)));
      } else if (type === "unsubscribed") {
        await db.update(outboundCampaignLeadsTable)
          .set({ status: "unsubscribed", lastEventAt: new Date() })
          .where(and(eq(outboundCampaignLeadsTable.campaignId, campaignId), eq(outboundCampaignLeadsTable.leadId, leadId)));
      }
    }
    return res.json({ ok: true });
  } catch (e: any) {
    console.error("[sendgrid webhook]", e?.message);
    return res.json({ ok: false, error: e?.message });
  }
});

function mapSendGridEvent(e: string): any {
  const map: Record<string, string> = {
    delivered: "delivered", open: "opened", click: "clicked",
    bounce: "bounced", dropped: "bounced", spamreport: "spam",
    unsubscribe: "unsubscribed", group_unsubscribe: "unsubscribed",
  };
  return map[e] || null;
}

// NOT: /webhooks/resend routes/webhooks.ts'te tanımlı (her iki sistem için de handle eder)
// Aşağıdaki eski handler dead-code — orada tutuluyor ki merge conflict çıkmasın
router.post("/webhooks/resend-DEPRECATED", async (req: Request, res: Response) => {
  try {
    // İmza doğrulaması (opsiyonel — RESEND_WEBHOOK_SECRET set edildiğinde)
    // Resend Svix formatı: svix-id, svix-timestamp, svix-signature başlıkları
    // ÖNEMLİ: HMAC hesaplaması için raw body lazım. `req.rawBody`'yi index.ts'de
    // capture ediyoruz (express.json({ verify: (req, _res, buf) => req.rawBody = buf })).
    const secret = process.env.RESEND_WEBHOOK_SECRET;
    if (secret) {
      const svixId = req.header("svix-id");
      const svixTimestamp = req.header("svix-timestamp");
      const svixSignature = req.header("svix-signature");
      const rawBody: Buffer | string | undefined = (req as any).rawBody;

      if (!svixId || !svixTimestamp || !svixSignature) {
        return res.status(401).json({ error: "İmza başlıkları eksik" });
      }
      if (!rawBody) {
        console.warn("[resend webhook] rawBody yok — imza atlandı");
      } else {
        // Timestamp tazelik kontrolü (5 dk tolerans)
        const ts = Number(svixTimestamp);
        if (!ts || Math.abs(Date.now() / 1000 - ts) > 300) {
          return res.status(401).json({ error: "Timestamp geçersiz" });
        }
        const bodyStr = Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : String(rawBody);
        const signed = `${svixId}.${svixTimestamp}.${bodyStr}`;
        const secretBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
        const expected = "v1," + crypto.createHmac("sha256", secretBytes).update(signed).digest("base64");
        const provided = svixSignature.split(" ").map((s) => s.trim());
        if (!provided.includes(expected)) {
          return res.status(401).json({ error: "İmza doğrulanamadı" });
        }
      }
    }

    const payload = req.body || {};
    const eventType = mapResendEvent(payload.type);
    if (!eventType) return res.json({ ok: true, skipped: payload.type });

    const data = payload.data || {};
    const tags: Array<{ name: string; value: string }> = Array.isArray(data.tags) ? data.tags : [];
    const tagMap: Record<string, string> = {};
    for (const t of tags) if (t?.name && t?.value != null) tagMap[t.name] = String(t.value);

    const campaignId = Number(tagMap.campaign_id);
    const leadId = Number(tagMap.lead_id);
    const stepId = tagMap.step_id ? Number(tagMap.step_id) : null;
    const templateId = tagMap.template_id ? Number(tagMap.template_id) : null;
    if (!campaignId || !leadId) return res.json({ ok: true, skipped: "no campaign/lead tag" });

    const occurredAt = payload.created_at ? new Date(payload.created_at) : new Date();

    await db.insert(outboundEmailEventsTable).values({
      campaignId, leadId, stepId, templateId,
      eventType,
      providerMessageId: data.email_id || null,
      userAgent: data.user_agent || null,
      ipAddress: data.ip || null,
      clickUrl: data.click?.link || data.click?.url || null,
      bounceReason: data.bounce?.message || data.bounce?.reason || null,
      rawData: payload,
      occurredAt,
    });

    // Kampanya sayaç
    await incrementCampaignCounter(campaignId, eventType);

    // Lead durumu
    if (eventType === "replied") {
      await db.update(outboundCampaignLeadsTable)
        .set({ status: "replied", lastEventAt: new Date() })
        .where(and(eq(outboundCampaignLeadsTable.campaignId, campaignId), eq(outboundCampaignLeadsTable.leadId, leadId)));
    } else if (eventType === "bounced") {
      await db.update(outboundCampaignLeadsTable)
        .set({ status: "bounced", lastEventAt: new Date() })
        .where(and(eq(outboundCampaignLeadsTable.campaignId, campaignId), eq(outboundCampaignLeadsTable.leadId, leadId)));
    } else if (eventType === "unsubscribed") {
      await db.update(outboundCampaignLeadsTable)
        .set({ status: "unsubscribed", lastEventAt: new Date() })
        .where(and(eq(outboundCampaignLeadsTable.campaignId, campaignId), eq(outboundCampaignLeadsTable.leadId, leadId)));
    }

    return res.json({ ok: true });
  } catch (e: any) {
    console.error("[resend webhook]", e?.message);
    return res.status(500).json({ ok: false, error: e?.message });
  }
});

function mapResendEvent(type: string | undefined): any {
  if (!type) return null;
  const map: Record<string, string> = {
    "email.sent": "sent",
    "email.delivered": "delivered",
    "email.delivery_delayed": null as any, // ignore
    "email.opened": "opened",
    "email.clicked": "clicked",
    "email.bounced": "bounced",
    "email.complained": "spam",
    // Resend'in bazı sürümlerinde `email.failed` de olabilir
    "email.failed": "bounced",
  };
  return map[type] || null;
}

async function incrementCampaignCounter(campaignId: number, eventType: string) {
  const fieldMap: Record<string, string> = {
    opened: "emails_opened", clicked: "emails_clicked",
    replied: "replies", bounced: "bounces", unsubscribed: "unsubscribes",
  };
  const field = fieldMap[eventType];
  if (!field) return;
  await db.execute(sql.raw(
    `UPDATE outbound_campaigns SET ${field} = ${field} + 1, updated_at = NOW() WHERE id = ${campaignId}`
  ));
}

// ═══════════════════════════════════════════════════════════════════════
// UNSUBSCRIBE (public — KVKK zorunlu)
// ═══════════════════════════════════════════════════════════════════════

router.get("/outbound/unsubscribe", async (req: Request, res: Response) => {
  try {
    const campaignId = Number(req.query.c);
    const leadId = Number(req.query.l);
    if (!campaignId || !leadId) {
      return res.status(400).send("Geçersiz link.");
    }
    // Kayıt: unsubscribe event + tüm aktif kampanyalardan çıkar
    await db.insert(outboundEmailEventsTable).values({
      campaignId, leadId,
      eventType: "unsubscribed",
      occurredAt: new Date(),
    });
    // Lead'i tüm kampanyalarda unsubscribed işaretle
    await db.update(outboundCampaignLeadsTable)
      .set({ status: "unsubscribed", lastEventAt: new Date() })
      .where(eq(outboundCampaignLeadsTable.leadId, leadId));
    // Lead'i archive et
    await db.update(outreachLeadsTable)
      .set({ status: "rejected", updatedAt: new Date() })
      .where(eq(outreachLeadsTable.id, leadId));

    return res.send(`
      <!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8">
      <title>Abonelikten Çıktınız — Sphere English</title>
      <style>body{font-family:sans-serif;max-width:520px;margin:80px auto;padding:24px;text-align:center;color:#1e3a6e}
      h1{font-weight:800;color:#1e3a6e}a{color:#0e7da6}</style></head>
      <body><h1>Abonelikten Çıktınız</h1>
      <p>E-posta listemizden çıkarıldınız. Bir daha e-posta almayacaksınız.</p>
      <p>Fikrinizi değiştirirseniz veya sorunuz varsa <a href="mailto:destek@sphereenglish.com">destek@sphereenglish.com</a> adresine yazabilirsiniz.</p>
      <p style="color:#8ba7d9;font-size:12px;margin-top:32px">Sphere English · İş İngilizcesi Eğitim Platformu</p>
      </body></html>
    `);
  } catch (e: any) {
    return res.status(500).send("Bir hata oluştu.");
  }
});

// ═══════════════════════════════════════════════════════════════════════
// ANALYTICS
// ═══════════════════════════════════════════════════════════════════════

router.get("/admin/outbound/stats", authMiddleware, requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const [tplCount] = await db.select({ n: count() }).from(outboundTemplatesTable)
        .where(eq(outboundTemplatesTable.isActive, true));
      const [campActive] = await db.select({ n: count() }).from(outboundCampaignsTable)
        .where(eq(outboundCampaignsTable.status, "active"));
      const [campAll] = await db.select({ n: count() }).from(outboundCampaignsTable);
      const [meetings] = await db.select({ n: count() }).from(outboundMeetingsTable);

      // Son 7 gün gönderim + açılma
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const events = await db.select({
        type: outboundEmailEventsTable.eventType,
        n: count(),
      }).from(outboundEmailEventsTable)
        .where(gte(outboundEmailEventsTable.occurredAt, sevenDaysAgo))
        .groupBy(outboundEmailEventsTable.eventType);

      return res.json({
        ok: true,
        stats: {
          templates: Number(tplCount.n),
          campaignsActive: Number(campActive.n),
          campaignsTotal: Number(campAll.n),
          meetings: Number(meetings.n),
          last7days: events.reduce((acc, r) => ({ ...acc, [r.type]: Number(r.n) }), {}),
        },
      });
    } catch (e: any) { return res.status(500).json({ error: e?.message }); }
  });

// Seed hazır şablonlar (yalnızca boşsa)
router.post("/admin/outbound/seed", authMiddleware, requireRole("admin"),
  async (_req: AuthRequest, res: Response) => {
    try {
      const { seedOutboundTemplates } = await import("../seeds/outbound-templates.js");
      await seedOutboundTemplates();
      return res.json({ ok: true });
    } catch (e: any) { return res.status(500).json({ error: e?.message }); }
  });

export default router;
