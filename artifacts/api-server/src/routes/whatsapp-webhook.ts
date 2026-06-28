/**
 * WhatsApp Cloud API webhook handler.
 *
 * 1. GET  /api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
 *    → Meta subscription doğrulama. Verify token eşleşirse challenge'ı geri döndür.
 *
 * 2. POST /api/webhooks/whatsapp
 *    → Yeni mesaj/status bildirimi. Body imza ile doğrulanır (X-Hub-Signature-256).
 *
 * Payload formatı:
 *   {
 *     object: "whatsapp_business_account",
 *     entry: [{
 *       id: "<waba-id>",
 *       changes: [{
 *         value: {
 *           messaging_product: "whatsapp",
 *           metadata: { display_phone_number, phone_number_id },
 *           contacts: [{ profile:{name}, wa_id }],
 *           messages: [{ from, id, timestamp, type:"text", text:{body} }]
 *         },
 *         field: "messages"
 *       }]
 *     }]
 *   }
 *
 * Env:
 *   WA_APP_SECRET         — imza doğrulama (Meta App secret, IG ile aynı App ise META_APP_SECRET fallback)
 *   WA_VERIFY_TOKEN       — subscription verify (keyfi string, Meta panelinde aynı set)
 *   WA_PHONE_NUMBER_ID    — kendi numara ID'miz (self-mesaj filtre)
 */

import { Router, Request, Response } from "express";
import crypto from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { sendWhatsAppMessage, markMessageAsRead } from "../lib/whatsapp-api.js";
import { generateWhatsAppReply, shouldEscalate } from "../lib/whatsapp-ai.js";

const router = Router();

// ─── Webhook verify (Meta subscription onayı) ────────────────────────────
router.get("/webhooks/whatsapp", (req: Request, res: Response) => {
  const mode = String(req.query["hub.mode"] ?? "");
  const token = String(req.query["hub.verify_token"] ?? "");
  const challenge = String(req.query["hub.challenge"] ?? "");
  const expected = process.env["WA_VERIFY_TOKEN"] ?? "";

  if (!expected) {
    console.error("[wa-webhook] WA_VERIFY_TOKEN env tanımlı değil");
    return res.status(500).send("Server config error");
  }

  if (mode === "subscribe" && token === expected) {
    console.info("[wa-webhook] Subscription verified");
    return res.status(200).send(challenge);
  }
  console.warn("[wa-webhook] Verify FAİL — mode:", mode, "token mismatch");
  return res.status(403).send("Forbidden");
});

// ─── HMAC imza doğrulama (Instagram ile aynı pattern) ───────────────────
function verifySignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
  const provided = signatureHeader.slice("sha256=".length);
  const providedBuf = Buffer.from(provided);

  const candidates = [
    process.env["WA_APP_SECRET"] ?? "",
    process.env["META_APP_SECRET"] ?? "",
  ].filter(Boolean);

  for (const secret of candidates) {
    try {
      const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
      if (crypto.timingSafeEqual(Buffer.from(expected), providedBuf)) {
        return true;
      }
    } catch {
      continue;
    }
  }
  return false;
}

// ─── Webhook event router (POST) ────────────────────────────────────────
router.post("/webhooks/whatsapp", async (req: Request, res: Response) => {
  const signature = req.headers["x-hub-signature-256"] as string | undefined;
  const rawBody = (req as any).rawBody as Buffer | undefined;

  if (rawBody && !verifySignature(rawBody, signature)) {
    console.warn("[wa-webhook] HMAC fail");
    return res.status(403).send("Forbidden");
  }

  // Meta 20 saniye içinde 200 bekler — fire-and-forget
  res.status(200).send("OK");

  try {
    const body = req.body as any;
    if (body?.object !== "whatsapp_business_account") {
      console.warn("[wa-webhook] Beklenmedik object:", body?.object);
      return;
    }

    for (const entry of (body.entry ?? []) as any[]) {
      for (const change of (entry.changes ?? []) as any[]) {
        if (change.field !== "messages") continue;
        const value = change.value ?? {};
        // contacts → profile name eşlemesi için
        const contacts: any[] = value.contacts ?? [];
        const contactsByWaId = new Map<string, any>();
        for (const c of contacts) {
          if (c?.wa_id) contactsByWaId.set(String(c.wa_id), c);
        }
        // messages → asıl mesaj eventleri
        for (const msg of (value.messages ?? []) as any[]) {
          const contact = contactsByWaId.get(String(msg?.from ?? ""));
          await handleMessageEvent(msg, contact).catch((e) =>
            console.error("[wa-webhook] message error:", e?.message),
          );
        }
        // statuses → delivery / read receipts (best-effort log)
        for (const status of (value.statuses ?? []) as any[]) {
          handleStatusUpdate(status).catch((e) =>
            console.error("[wa-webhook] status error:", e?.message),
          );
        }
      }
    }
  } catch (e: any) {
    console.error("[wa-webhook] HATA:", e?.message);
  }
});

// ─── Mesaj event handler ────────────────────────────────────────────────
async function handleMessageEvent(msg: any, contact: any): Promise<void> {
  const senderPhone = String(msg?.from ?? "");
  const waMessageId = String(msg?.id ?? "");
  const msgType = String(msg?.type ?? "text");
  const profileName = contact?.profile?.name ? String(contact.profile.name) : null;

  // Self-mesaj filtreleme — kendi numaramızdan değil, gelen mesajlardan emin ol
  // (WhatsApp Cloud API'sinde inbound webhook zaten self-loop yapmıyor genelde)
  if (!senderPhone || !waMessageId) return;

  // Sadece text mesajları AI ile cevapla; media/audio/sticker için "anladım, ekibimiz dönecek" benzeri basit cevap
  let text = "";
  if (msgType === "text") {
    text = String(msg?.text?.body ?? "");
  } else if (msgType === "button") {
    text = String(msg?.button?.text ?? "");
  } else if (msgType === "interactive") {
    text =
      String(msg?.interactive?.button_reply?.title ?? "") ||
      String(msg?.interactive?.list_reply?.title ?? "");
  } else {
    // Media — şimdilik AI tetikleme
    text = "";
  }

  const timestamp = msg?.timestamp ? new Date(Number(msg.timestamp) * 1000) : new Date();

  // Thread upsert
  const threadRes = await db.execute(sql`
    INSERT INTO whatsapp_threads (
      wa_phone_number, wa_profile_name, last_message_text, last_message_at, last_inbound_at, unread_count
    ) VALUES (
      ${senderPhone}, ${profileName}, ${text || `[${msgType}]`}, ${timestamp.toISOString()}, ${timestamp.toISOString()}, 1
    )
    ON CONFLICT (wa_phone_number) DO UPDATE SET
      wa_profile_name = COALESCE(EXCLUDED.wa_profile_name, whatsapp_threads.wa_profile_name),
      last_message_text = EXCLUDED.last_message_text,
      last_message_at = EXCLUDED.last_message_at,
      last_inbound_at = EXCLUDED.last_inbound_at,
      unread_count = whatsapp_threads.unread_count + 1,
      updated_at = NOW()
    RETURNING id, bot_enabled, escalated_at
  `);
  const thread = (threadRes.rows ?? threadRes)[0] as any;
  if (!thread) return;

  await db.execute(sql`
    INSERT INTO whatsapp_messages (
      thread_id, wa_message_id, direction, sender_phone, message_text,
      message_type, attachments, delivery_status
    ) VALUES (
      ${thread.id}, ${waMessageId}, 'inbound', ${senderPhone}, ${text || null},
      ${msgType}, ${JSON.stringify(extractAttachments(msg))}::JSONB, 'received'
    )
    ON CONFLICT (wa_message_id) DO NOTHING
  `);

  // Read receipt (best-effort)
  markMessageAsRead(waMessageId).catch(() => {});

  console.info(
    `[wa-webhook] Msg in: thread=${thread.id} from=${senderPhone} type=${msgType} text="${text?.slice(0, 80)}"`,
  );

  // AI cevap üretimi
  if (!thread.bot_enabled || thread.escalated_at) return;
  if (!text) return; // media için AI yok
  const globalEnabled = await getBotSetting("bot_enabled");
  const dmEnabled = await getBotSetting("reply_to_dms");
  if (globalEnabled !== "true" || dmEnabled !== "true") return;

  setImmediate(() => {
    triggerAiReply(thread.id, senderPhone, text).catch((e) =>
      console.error("[wa-webhook] AI reply HATA:", e?.message),
    );
  });
}

function extractAttachments(msg: any): any[] {
  const out: any[] = [];
  const t = msg?.type;
  if (t === "image" && msg?.image) out.push({ type: "image", ...msg.image });
  if (t === "audio" && msg?.audio) out.push({ type: "audio", ...msg.audio });
  if (t === "video" && msg?.video) out.push({ type: "video", ...msg.video });
  if (t === "document" && msg?.document) out.push({ type: "document", ...msg.document });
  if (t === "sticker" && msg?.sticker) out.push({ type: "sticker", ...msg.sticker });
  return out;
}

// ─── Status update (delivered/read) ─────────────────────────────────────
async function handleStatusUpdate(status: any): Promise<void> {
  const waMessageId = String(status?.id ?? "");
  const newStatus = String(status?.status ?? "");
  if (!waMessageId || !newStatus) return;

  // delivered/read → outbound mesajımızın durumu
  if (["delivered", "read", "failed"].includes(newStatus)) {
    await db.execute(sql`
      UPDATE whatsapp_messages
      SET delivery_status = ${newStatus}
      WHERE wa_message_id = ${waMessageId}
    `);
  }
}

// ─── Bot ayarı oku ──────────────────────────────────────────────────────
async function getBotSetting(key: string): Promise<string | null> {
  try {
    const rows = await db.execute(sql`
      SELECT value FROM whatsapp_bot_settings WHERE key = ${key} LIMIT 1
    `);
    return ((rows.rows ?? rows)[0] as any)?.value ?? null;
  } catch {
    return null;
  }
}

// ─── DM AI cevap akışı ──────────────────────────────────────────────────
async function triggerAiReply(threadId: number, senderPhone: string, text: string): Promise<void> {
  // Eskalasyon kontrolü
  const esc = shouldEscalate(text);
  if (esc.escalate) {
    await db.execute(sql`
      UPDATE whatsapp_threads SET
        escalated_at = NOW(),
        escalation_reason = ${esc.reason ?? "Otomatik"},
        bot_enabled = FALSE,
        updated_at = NOW()
      WHERE id = ${threadId}
    `);
    console.info(`[wa-webhook] Thread ${threadId} ESCALATED: ${esc.reason}`);
    return;
  }

  // AI cevap üret
  const reply = await generateWhatsAppReply(threadId, text);
  if (!reply) {
    console.warn(`[wa-webhook] AI cevap üretilemedi thread=${threadId}`);
    return;
  }

  // Pre-insert outbound
  const inserted = await db.execute(sql`
    INSERT INTO whatsapp_messages (
      thread_id, direction, sender_phone, message_text,
      ai_generated, ai_confidence, ai_model, ai_latency_ms, delivery_status
    ) VALUES (
      ${threadId}, 'outbound', ${process.env["WA_PHONE_NUMBER_ID"] ?? ""}, ${reply.text},
      TRUE, ${reply.confidence}, ${reply.model}, ${reply.latencyMs}, 'pending'
    )
    RETURNING id
  `);
  const messageRowId = ((inserted.rows ?? inserted)[0] as any)?.id;

  const send = await sendWhatsAppMessage(senderPhone, reply.text);
  if (send.ok) {
    await db.execute(sql`
      UPDATE whatsapp_messages SET
        wa_message_id = ${send.waMessageId ?? null},
        delivery_status = 'sent',
        sent_at = NOW()
      WHERE id = ${messageRowId}
    `);
    await db.execute(sql`
      UPDATE whatsapp_threads SET
        last_message_text = ${reply.text},
        last_message_at = NOW(),
        unread_count = 0,
        updated_at = NOW()
      WHERE id = ${threadId}
    `);
    console.info(`[wa-webhook] Mesaj gönderildi thread=${threadId} to=${senderPhone}`);
  } else {
    await db.execute(sql`
      UPDATE whatsapp_messages SET
        delivery_status = 'failed',
        delivery_error = ${send.error ?? "bilinmeyen"}
      WHERE id = ${messageRowId}
    `);
    console.error(`[wa-webhook] Gönderim BAŞARISIZ thread=${threadId}: ${send.error}`);
  }
}

export default router;
