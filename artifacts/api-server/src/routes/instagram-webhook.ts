/**
 * Instagram webhook handler — Meta'dan gelen DM ve yorum eventleri.
 *
 * Meta iki tür request gönderir:
 *
 * 1. GET  /api/webhooks/instagram?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
 *    → Subscription doğrulama. Verify token eşleşirse challenge'ı geri döndür.
 *
 * 2. POST /api/webhooks/instagram
 *    → Yeni mesaj/yorum bildirimi. Body imzayla doğrulanır (X-Hub-Signature-256).
 *
 * Event türleri:
 *   - messaging       → DM gelmiş
 *   - comments        → Post'a yorum gelmiş
 *   - mentions        → Birisi seni etiketlemiş (henüz handle yok)
 *
 * Env var'lar:
 *   META_APP_SECRET            — webhook imza doğrulaması için
 *   IG_VERIFY_TOKEN            — subscription doğrulama
 *   IG_PAGE_ACCESS_TOKEN       — send/reply API çağrıları için
 *   IG_BUSINESS_ACCOUNT_ID     — bizim hesabımızın ID'si (self-mesaj filtreleme)
 */

import { Router, Request, Response } from "express";
import crypto from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { sendInstagramMessage, replyToInstagramComment, fetchUserProfile } from "../lib/instagram-api.js";
import { generateDmReply, generateCommentReply, shouldEscalate } from "../lib/instagram-ai.js";

const router = Router();

// ─── Webhook verify (Meta subscription onayı) ────────────────────────────
router.get("/webhooks/instagram", (req: Request, res: Response) => {
  const mode = String(req.query["hub.mode"] ?? "");
  const token = String(req.query["hub.verify_token"] ?? "");
  const challenge = String(req.query["hub.challenge"] ?? "");
  const expected = process.env["IG_VERIFY_TOKEN"] ?? "";

  if (!expected) {
    console.error("[ig-webhook] IG_VERIFY_TOKEN env tanımlı değil");
    return res.status(500).send("Server config error");
  }

  if (mode === "subscribe" && token === expected) {
    console.info("[ig-webhook] Subscription verified");
    return res.status(200).send(challenge);
  }
  console.warn("[ig-webhook] Verify FAİL — mode:", mode, "token mismatch");
  return res.status(403).send("Forbidden");
});

// ─── HMAC imza doğrulama ─────────────────────────────────────────────────
// Instagram login (yeni API): IG_APP_SECRET kullanılır
// Facebook login (eski): META_APP_SECRET kullanılır
// Her ikisini de dene — hangisi eşleşirse OK
function verifySignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
  const provided = signatureHeader.slice("sha256=".length);
  const providedBuf = Buffer.from(provided);

  const candidates = [
    process.env["IG_APP_SECRET"] ?? "",
    process.env["META_APP_SECRET"] ?? "",
  ].filter(Boolean);

  for (const secret of candidates) {
    try {
      const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
      if (crypto.timingSafeEqual(Buffer.from(expected), providedBuf)) {
        return true;
      }
    } catch {
      // Length mismatch — bir sonraki secret'i dene
      continue;
    }
  }
  return false;
}

// ─── Webhook event router (POST) ─────────────────────────────────────────
// NOT: Express'in body parser'ından önce raw body alabilmek için
// app.ts'te bu route için ayrı bir middleware var (raw body keep).
router.post("/webhooks/instagram", async (req: Request, res: Response) => {
  // Meta 20 saniye içinde cevap bekler — uzun işlem yapma, fire-and-forget
  const signature = req.headers["x-hub-signature-256"] as string | undefined;
  const rawBody = (req as any).rawBody as Buffer | undefined;

  if (rawBody && !verifySignature(rawBody, signature)) {
    console.warn("[ig-webhook] HMAC fail");
    return res.status(403).send("Forbidden");
  }

  // Hemen 200 dön — event'leri arka planda işle
  res.status(200).send("OK");

  try {
    const body = req.body as any;
    // Instagram webhook payload formatı:
    // {
    //   object: "instagram",
    //   entry: [{
    //     id: "<page-id>",
    //     time: ...,
    //     messaging: [{ sender, recipient, timestamp, message: { mid, text }}],
    //     changes: [{ field: "comments", value: {...} }]
    //   }]
    // }
    if (body?.object !== "instagram") {
      console.warn("[ig-webhook] Beklenmedik object:", body?.object);
      return;
    }

    for (const entry of (body.entry ?? []) as any[]) {
      // ── DM mesajları ──
      for (const msg of (entry.messaging ?? []) as any[]) {
        await handleMessagingEvent(msg).catch((e) =>
          console.error("[ig-webhook] messaging error:", e?.message),
        );
      }
      // ── Post yorumları ──
      for (const change of (entry.changes ?? []) as any[]) {
        if (change.field === "comments") {
          await handleCommentEvent(change.value).catch((e) =>
            console.error("[ig-webhook] comment error:", e?.message),
          );
        }
      }
    }
  } catch (e: any) {
    console.error("[ig-webhook] HATA:", e?.message);
  }
});

// ─── DM event handler ───────────────────────────────────────────────────
async function handleMessagingEvent(msg: any): Promise<void> {
  const senderId = String(msg?.sender?.id ?? "");
  const recipientId = String(msg?.recipient?.id ?? "");
  const ourAccountId = process.env["IG_BUSINESS_ACCOUNT_ID"] ?? "";

  // Self-mesaj filtreleme (kendi gönderdiğimiz mesajlar webhook'ta da gelir)
  if (ourAccountId && senderId === ourAccountId) {
    return;
  }

  const igMessageId = String(msg?.message?.mid ?? "");
  const text = String(msg?.message?.text ?? "");
  const timestamp = msg?.timestamp ? new Date(msg.timestamp) : new Date();

  if (!senderId || !igMessageId) return;

  // Thread upsert
  const threadRes = await db.execute(sql`
    INSERT INTO instagram_threads (
      ig_user_id, last_message_text, last_message_at, last_inbound_at, unread_count
    ) VALUES (
      ${senderId}, ${text || null}, ${timestamp.toISOString()}, ${timestamp.toISOString()}, 1
    )
    ON CONFLICT (ig_user_id) DO UPDATE SET
      last_message_text = EXCLUDED.last_message_text,
      last_message_at = EXCLUDED.last_message_at,
      last_inbound_at = EXCLUDED.last_inbound_at,
      unread_count = instagram_threads.unread_count + 1,
      updated_at = NOW()
    RETURNING id, bot_enabled, escalated_at
  `);
  const thread = (threadRes.rows ?? threadRes)[0] as any;
  if (!thread) return;

  // Mesajı kaydet (duplicate'i ON CONFLICT ile yut)
  await db.execute(sql`
    INSERT INTO instagram_messages (
      thread_id, ig_message_id, direction, sender_id, message_text,
      attachments, delivery_status
    ) VALUES (
      ${thread.id}, ${igMessageId}, 'inbound', ${senderId}, ${text || null},
      ${JSON.stringify(msg?.message?.attachments ?? [])}::JSONB,
      'received'
    )
    ON CONFLICT (ig_message_id) DO NOTHING
  `);

  console.info(`[ig-webhook] DM in: thread=${thread.id} from=${senderId} text="${text?.slice(0, 80)}"`);

  // AI cevap üretimi — bot enabled + escalated değilse + bot global enabled ise
  if (!thread.bot_enabled || thread.escalated_at) return;
  const globalEnabled = await getBotSetting("bot_enabled");
  const dmEnabled = await getBotSetting("reply_to_dms");
  if (globalEnabled !== "true" || dmEnabled !== "true") return;

  // Fire-and-forget AI cevap üretimi + gönderim
  // TODO: bir sonraki commit'te ai-reply.ts ile entegre edilecek
  setImmediate(() => {
    triggerAiReply(thread.id, senderId, text).catch((e) =>
      console.error("[ig-webhook] AI reply HATA:", e?.message),
    );
  });
}

// ─── Yorum event handler ────────────────────────────────────────────────
async function handleCommentEvent(comment: any): Promise<void> {
  const commentId = String(comment?.id ?? "");
  const mediaId = String(comment?.media?.id ?? "");
  const parentCommentId = String(comment?.parent_id ?? "") || null;
  const senderId = String(comment?.from?.id ?? "");
  const senderUsername = String(comment?.from?.username ?? "");
  const text = String(comment?.text ?? "");

  if (!commentId || !senderId) return;

  // Kendi yorumumuzsa skip (cevaplara cevap döngüsünü engelle)
  const ourAccountId = process.env["IG_BUSINESS_ACCOUNT_ID"] ?? "";
  if (ourAccountId && senderId === ourAccountId) return;

  await db.execute(sql`
    INSERT INTO instagram_comments (
      ig_comment_id, ig_media_id, ig_parent_comment_id,
      sender_id, sender_username, comment_text, reply_status
    ) VALUES (
      ${commentId}, ${mediaId || null}, ${parentCommentId},
      ${senderId}, ${senderUsername || null}, ${text || null}, 'pending'
    )
    ON CONFLICT (ig_comment_id) DO NOTHING
  `);

  console.info(`[ig-webhook] Comment in: id=${commentId} from=${senderUsername} text="${text?.slice(0, 80)}"`);

  const globalEnabled = await getBotSetting("bot_enabled");
  const commentEnabled = await getBotSetting("reply_to_comments");
  if (globalEnabled !== "true" || commentEnabled !== "true") return;

  // AI cevap fire-and-forget
  setImmediate(() => {
    triggerAiCommentReply(commentId, text).catch((e) =>
      console.error("[ig-webhook] AI comment reply HATA:", e?.message),
    );
  });
}

// ─── Bot ayarı oku ──────────────────────────────────────────────────────
async function getBotSetting(key: string): Promise<string | null> {
  try {
    const rows = await db.execute(sql`
      SELECT value FROM instagram_bot_settings WHERE key = ${key} LIMIT 1
    `);
    return ((rows.rows ?? rows)[0] as any)?.value ?? null;
  } catch {
    return null;
  }
}

// ─── DM AI cevap akışı ──────────────────────────────────────────────────
async function triggerAiReply(threadId: number, senderId: string, text: string): Promise<void> {
  // Eskalasyon kontrolü
  const esc = shouldEscalate(text);
  if (esc.escalate) {
    await db.execute(sql`
      UPDATE instagram_threads SET
        escalated_at = NOW(),
        escalation_reason = ${esc.reason ?? "Otomatik"},
        bot_enabled = FALSE,
        updated_at = NOW()
      WHERE id = ${threadId}
    `);
    console.info(`[ig-webhook] Thread ${threadId} ESCALATED: ${esc.reason}`);
    return;
  }

  // Profil bilgisini fetch et + güncelle (ilk seferde isim/avatar boş)
  fetchUserProfile(senderId)
    .then((profile) => {
      if (profile?.username) {
        // Conditional SET — COALESCE(NULL param, col) Postgres tip belirsizliği yaratıyor
        const sets: any[] = [sql`ig_username = ${String(profile.username)}`];
        if (profile.name) sets.push(sql`ig_full_name = ${String(profile.name)}`);
        if (profile.profilePicUrl) sets.push(sql`profile_pic_url = ${String(profile.profilePicUrl)}`);
        sets.push(sql`updated_at = NOW()`);
        return db.execute(sql`
          UPDATE instagram_threads SET ${sql.join(sets, sql`, `)}
          WHERE id = ${threadId}
        `);
      }
    })
    .catch(() => {});

  // AI cevap üret
  const reply = await generateDmReply(threadId, text);
  if (!reply) {
    console.warn(`[ig-webhook] AI cevap üretilemedi thread=${threadId}`);
    return;
  }

  // Mesajı send öncesi DB'ye kaydet (pending), sonra gönder, durumu güncelle
  const inserted = await db.execute(sql`
    INSERT INTO instagram_messages (
      thread_id, direction, sender_id, message_text,
      ai_generated, ai_confidence, ai_model, ai_latency_ms, delivery_status
    ) VALUES (
      ${threadId}, 'outbound', ${process.env["IG_BUSINESS_ACCOUNT_ID"] ?? ""}, ${reply.text},
      TRUE, ${reply.confidence}, ${reply.model}, ${reply.latencyMs}, 'pending'
    )
    RETURNING id
  `);
  const messageRowId = ((inserted.rows ?? inserted)[0] as any)?.id;

  const send = await sendInstagramMessage(senderId, reply.text);
  if (send.ok) {
    await db.execute(sql`
      UPDATE instagram_messages SET
        ig_message_id = ${send.igMessageId ?? null},
        delivery_status = 'sent',
        sent_at = NOW()
      WHERE id = ${messageRowId}
    `);
    // Thread'in last_message_at'i güncelle + unread sıfırla
    await db.execute(sql`
      UPDATE instagram_threads SET
        last_message_text = ${reply.text},
        last_message_at = NOW(),
        unread_count = 0,
        updated_at = NOW()
      WHERE id = ${threadId}
    `);
    console.info(`[ig-webhook] DM gönderildi thread=${threadId} to=${senderId}`);
  } else {
    await db.execute(sql`
      UPDATE instagram_messages SET
        delivery_status = 'failed',
        delivery_error = ${send.error ?? "bilinmeyen"}
      WHERE id = ${messageRowId}
    `);
    console.error(`[ig-webhook] DM gönderim BAŞARISIZ thread=${threadId}: ${send.error}`);
  }
}

// ─── Yorum AI cevap akışı ──────────────────────────────────────────────
async function triggerAiCommentReply(commentId: string, text: string): Promise<void> {
  // Eskalasyon kontrolü — şikayet yorumlarına cevap verme, admin'e bırak
  const esc = shouldEscalate(text);
  if (esc.escalate) {
    await db.execute(sql`
      UPDATE instagram_comments SET
        reply_status = 'skipped',
        skipped_reason = ${"Eskalasyon: " + (esc.reason ?? "")}
      WHERE ig_comment_id = ${commentId}
    `);
    console.info(`[ig-webhook] Yorum ${commentId} skip (eskalasyon)`);
    return;
  }

  const reply = await generateCommentReply(text);
  if (!reply) {
    await db.execute(sql`
      UPDATE instagram_comments SET
        reply_status = 'skipped',
        skipped_reason = ${"AI SKIP (spam/troll/anlamsız)"}
      WHERE ig_comment_id = ${commentId}
    `);
    return;
  }

  const send = await replyToInstagramComment(commentId, reply.text);
  if (send.ok) {
    await db.execute(sql`
      UPDATE instagram_comments SET
        reply_text = ${reply.text},
        reply_ig_id = ${send.igMessageId ?? null},
        ai_generated = TRUE,
        ai_confidence = ${reply.confidence},
        reply_status = 'sent',
        replied_at = NOW()
      WHERE ig_comment_id = ${commentId}
    `);
    console.info(`[ig-webhook] Yorum cevap gönderildi commentId=${commentId}`);
  } else {
    await db.execute(sql`
      UPDATE instagram_comments SET
        reply_status = 'failed',
        reply_error = ${send.error ?? "bilinmeyen"}
      WHERE ig_comment_id = ${commentId}
    `);
    console.error(`[ig-webhook] Yorum cevap BAŞARISIZ commentId=${commentId}: ${send.error}`);
  }
}

export default router;
