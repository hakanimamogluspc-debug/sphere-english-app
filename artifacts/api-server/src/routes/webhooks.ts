import { Router, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger.js";

const router = Router();

// ─── Resend Webhook — açılma/tıklama/teslimat olaylarını alır ─────────────────
// Resend dashboard'da webhook URL: https://app.sphereenglish.com/webhooks/resend
router.post("/webhooks/resend", async (req: Request, res: Response) => {
  try {
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

    // Olayı email_events tablosuna kaydet
    await pool.query(
      `INSERT INTO email_events (resend_email_id, recipient_email, event_type, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [resendEmailId || null, recipientEmail || null, eventType]
    );

    // campaign_id varsa bul — resend_email_id ile eşleştir
    if (resendEmailId) {
      const { rows } = await pool.query(
        `SELECT campaign_id FROM email_events WHERE resend_email_id = $1 AND campaign_id IS NOT NULL LIMIT 1`,
        [resendEmailId]
      );
      const campaignId = rows[0]?.campaign_id;

      if (campaignId) {
        // İlgili kampanya sayacını artır
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
        // campaign_id'yi bu olaya da yaz
        await pool.query(
          `UPDATE email_events SET campaign_id = $1
           WHERE resend_email_id = $2 AND campaign_id IS NULL`,
          [campaignId, resendEmailId]
        );
      }
    }

    return res.json({ ok: true });
  } catch (err: any) {
    logger.error({ err: err.message }, "Resend webhook hatası");
    return res.status(500).json({ error: "Webhook işleme hatası" });
  }
});

export default router;
