import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import {
  db, pool,
  outboundEmailEventsTable, outboundCampaignsTable, outboundCampaignLeadsTable,
} from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { logger } from "../lib/logger.js";

const router = Router();

// ─── Resend Webhook — hem eski email_campaigns hem yeni B2B outbound sistemi ────
// Resend dashboard URL: https://app.sphereenglish.com/webhooks/resend
// Events: hepsi (email.sent, delivered, opened, clicked, bounced, complained)
router.post("/webhooks/resend", async (req: Request, res: Response) => {
  try {
    // ─── İmza doğrulaması (opsiyonel — RESEND_WEBHOOK_SECRET set edildiğinde) ──
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
        logger.warn("[resend webhook] rawBody yok — imza atlandı");
      } else {
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

    const event = req.body;
    if (!event || !event.type) {
      return res.status(400).json({ error: "Geçersiz webhook verisi" });
    }

    const eventType: string = event.type;
    const data = event.data || {};
    const resendEmailId: string = data.email_id || "";
    const toArray: string[] = Array.isArray(data.to) ? data.to : [];
    const recipientEmail: string = toArray[0] || "";

    logger.info({ eventType, resendEmailId, recipientEmail }, "Resend webhook alındı");

    // ─── Eski marketing email_campaigns sistemi ─────────────────────────
    try {
      await pool.query(
        `INSERT INTO email_events (resend_email_id, recipient_email, event_type, created_at)
         VALUES ($1, $2, $3, NOW())`,
        [resendEmailId || null, recipientEmail || null, eventType]
      );

      if (resendEmailId) {
        const { rows } = await pool.query(
          `SELECT campaign_id FROM email_events WHERE resend_email_id = $1 AND campaign_id IS NOT NULL LIMIT 1`,
          [resendEmailId]
        );
        const campaignId = rows[0]?.campaign_id;

        if (campaignId) {
          const colMap: Record<string, string> = {
            "email.opened":    "opened_count",
            "email.clicked":   "clicked_count",
            "email.delivered": "delivered_count",
            "email.bounced":   "bounced_count",
            "email.spam_complaint": "bounced_count",
          };
          const col = colMap[eventType];
          if (col) {
            await pool.query(
              `UPDATE email_campaigns SET ${col} = ${col} + 1 WHERE id = $1`,
              [campaignId]
            );
          }
          await pool.query(
            `UPDATE email_events SET campaign_id = $1
             WHERE resend_email_id = $2 AND campaign_id IS NULL`,
            [campaignId, resendEmailId]
          );
        }
      }
    } catch (e: any) {
      logger.warn({ err: e.message }, "[resend webhook] eski email_events kayıt atlandı");
    }

    // ─── Yeni B2B Outbound sistemi ─────────────────────────────────────
    // Resend'e gönderilen tag'lerde campaign_id + lead_id varsa outbound sistemine yaz
    // NOT: Resend send API'de tags array ({name,value}[]), ama webhook payload'ında OBJE olarak dönüyor
    const tagMap: Record<string, string> = {};
    if (Array.isArray(data.tags)) {
      for (const t of data.tags) {
        if (t?.name && t?.value != null) tagMap[t.name] = String(t.value);
      }
    } else if (data.tags && typeof data.tags === "object") {
      for (const [k, v] of Object.entries(data.tags)) {
        if (v != null) tagMap[k] = String(v);
      }
    }

    const obCampaignId = Number(tagMap.campaign_id);
    const obLeadId = Number(tagMap.lead_id);
    if (obCampaignId && obLeadId) {
      const obEventType = mapResendToOutbound(eventType);
      if (obEventType) {
        const stepId = tagMap.step_id ? Number(tagMap.step_id) : null;
        const templateId = tagMap.template_id ? Number(tagMap.template_id) : null;
        const occurredAt = event.created_at ? new Date(event.created_at) : new Date();

        await db.insert(outboundEmailEventsTable).values({
          campaignId: obCampaignId,
          leadId: obLeadId,
          stepId, templateId,
          eventType: obEventType,
          providerMessageId: resendEmailId || null,
          userAgent: data.user_agent || null,
          ipAddress: data.ip || null,
          clickUrl: data.click?.link || data.click?.url || null,
          bounceReason: data.bounce?.message || data.bounce?.reason || null,
          rawData: event,
          occurredAt,
        });

        // Kampanya sayacı
        const fieldMap: Record<string, string> = {
          opened: "emails_opened", clicked: "emails_clicked",
          replied: "replies", bounced: "bounces", unsubscribed: "unsubscribes",
        };
        const field = fieldMap[obEventType];
        if (field) {
          await db.execute(sql.raw(
            `UPDATE outbound_campaigns SET ${field} = ${field} + 1, updated_at = NOW() WHERE id = ${obCampaignId}`
          ));
        }

        // Lead durumu (bounced/unsubscribed/replied)
        if (obEventType === "bounced" || obEventType === "unsubscribed" || obEventType === "replied") {
          const newStatus = obEventType === "replied" ? "replied" : obEventType;
          await db.update(outboundCampaignLeadsTable)
            .set({ status: newStatus as any, lastEventAt: new Date() })
            .where(and(
              eq(outboundCampaignLeadsTable.campaignId, obCampaignId),
              eq(outboundCampaignLeadsTable.leadId, obLeadId),
            ));
        }
      }
    }

    return res.json({ ok: true });
  } catch (err: any) {
    logger.error({ err: err.message }, "Resend webhook hatası");
    return res.status(500).json({ error: "Webhook işleme hatası" });
  }
});

function mapResendToOutbound(type: string): string | null {
  const map: Record<string, string> = {
    "email.sent": "sent",
    "email.delivered": "delivered",
    "email.opened": "opened",
    "email.clicked": "clicked",
    "email.bounced": "bounced",
    "email.complained": "spam",
    "email.spam_complaint": "spam",
    "email.failed": "bounced",
  };
  return map[type] || null;
}

export default router;
