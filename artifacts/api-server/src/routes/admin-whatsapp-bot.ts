/**
 * WhatsApp bot admin paneli endpoint'leri.
 *
 *   GET    /api/admin/whatsapp-bot/overview         → İstatistikler
 *   GET    /api/admin/whatsapp-bot/threads          → Thread listesi (filtre/arama)
 *   GET    /api/admin/whatsapp-bot/threads/:id      → Thread detay + mesaj geçmişi
 *   POST   /api/admin/whatsapp-bot/threads/:id/send → Manuel mesaj gönder
 *   PATCH  /api/admin/whatsapp-bot/threads/:id      → Bot enable/disable, escalation
 *   GET    /api/admin/whatsapp-bot/settings         → Bot ayarları (key/value)
 *   PATCH  /api/admin/whatsapp-bot/settings         → Ayar güncelle
 */

import { Router, Response } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth.js";
import { sendWhatsAppMessage } from "../lib/whatsapp-api.js";

const router = Router();

// ─── ÖZET / İSTATİSTİKLER ───────────────────────────────────────────────
router.get(
  "/admin/whatsapp-bot/overview",
  authMiddleware,
  requireRole("admin"),
  async (_req: AuthRequest, res: Response) => {
    try {
      const stats = await db.execute(sql`
        SELECT
          (SELECT COUNT(*) FROM whatsapp_threads)::INT AS total_threads,
          (SELECT COUNT(*) FROM whatsapp_threads WHERE last_message_at >= NOW() - INTERVAL '24 hours')::INT AS active_24h,
          (SELECT COUNT(*) FROM whatsapp_threads WHERE escalated_at IS NOT NULL AND bot_enabled = FALSE)::INT AS escalated,
          (SELECT COUNT(*) FROM whatsapp_threads WHERE unread_count > 0)::INT AS unread,
          (SELECT COUNT(*) FROM whatsapp_messages WHERE direction = 'inbound' AND created_at >= NOW() - INTERVAL '24 hours')::INT AS msgs_in_24h,
          (SELECT COUNT(*) FROM whatsapp_messages WHERE direction = 'outbound' AND created_at >= NOW() - INTERVAL '24 hours')::INT AS msgs_out_24h,
          (SELECT COUNT(*) FROM whatsapp_messages WHERE delivery_status = 'failed' AND created_at >= NOW() - INTERVAL '24 hours')::INT AS failed_24h,
          (SELECT COALESCE(AVG(ai_latency_ms)::INT, 0) FROM whatsapp_messages WHERE direction = 'outbound' AND ai_generated = TRUE AND created_at >= NOW() - INTERVAL '24 hours') AS avg_latency_ms
      `);
      const row = (stats.rows ?? stats)[0];
      return res.json({ stats: row });
    } catch (e: any) {
      console.error("[admin-wa-bot/overview] HATA:", e?.message);
      return res.status(500).json({ error: e?.message });
    }
  },
);

// ─── THREAD LİSTESİ ─────────────────────────────────────────────────────
router.get(
  "/admin/whatsapp-bot/threads",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const filter = String(req.query?.filter ?? "all");
      const search = String(req.query?.search ?? "").trim().toLowerCase();
      const limit = Math.min(parseInt(String(req.query?.limit ?? "50"), 10) || 50, 200);

      const conditions: any[] = [];
      if (filter === "unread") conditions.push(sql`unread_count > 0`);
      if (filter === "escalated") conditions.push(sql`escalated_at IS NOT NULL`);
      if (filter === "bot_off") conditions.push(sql`bot_enabled = FALSE`);
      if (search) {
        const like = `%${search}%`;
        conditions.push(sql`(
          LOWER(COALESCE(wa_profile_name, '')) LIKE ${like}
          OR LOWER(COALESCE(wa_phone_number, '')) LIKE ${like}
          OR LOWER(COALESCE(last_message_text, '')) LIKE ${like}
        )`);
      }

      const whereClause = conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``;

      const rows = await db.execute(sql`
        SELECT
          id, wa_phone_number, wa_profile_name,
          last_message_text, last_message_at, last_inbound_at,
          unread_count, is_blocked, bot_enabled, escalated_at, escalation_reason,
          first_seen_at, updated_at
        FROM whatsapp_threads
        ${whereClause}
        ORDER BY COALESCE(last_message_at, first_seen_at) DESC
        LIMIT ${limit}
      `);
      return res.json({ threads: rows.rows ?? rows });
    } catch (e: any) {
      console.error("[admin-wa-bot/threads] HATA:", e?.message);
      return res.status(500).json({ error: e?.message });
    }
  },
);

// ─── THREAD DETAY + MESAJ GEÇMİŞİ ───────────────────────────────────────
router.get(
  "/admin/whatsapp-bot/threads/:id",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id ?? "", 10);
    if (!id) return res.status(400).json({ error: "id geçersiz" });

    try {
      const threadRows = await db.execute(sql`
        SELECT * FROM whatsapp_threads WHERE id = ${id} LIMIT 1
      `);
      const thread = (threadRows.rows ?? threadRows)[0];
      if (!thread) return res.status(404).json({ error: "Thread bulunamadı" });

      const msgRows = await db.execute(sql`
        SELECT id, direction, message_text, message_type, attachments,
               ai_generated, ai_confidence, ai_model, ai_latency_ms,
               delivery_status, delivery_error,
               created_at, sent_at
        FROM whatsapp_messages
        WHERE thread_id = ${id}
        ORDER BY created_at ASC
        LIMIT 200
      `);

      await db.execute(sql`
        UPDATE whatsapp_threads SET unread_count = 0 WHERE id = ${id} AND unread_count > 0
      `);

      return res.json({ thread, messages: msgRows.rows ?? msgRows });
    } catch (e: any) {
      console.error("[admin-wa-bot/threads/:id] HATA:", e?.message);
      return res.status(500).json({ error: e?.message });
    }
  },
);

// ─── MANUEL MESAJ GÖNDER (admin override) ───────────────────────────────
router.post(
  "/admin/whatsapp-bot/threads/:id/send",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id ?? "", 10);
    const text = String(req.body?.text ?? "").trim();
    if (!id) return res.status(400).json({ error: "id geçersiz" });
    if (!text) return res.status(400).json({ error: "Mesaj boş olamaz" });

    try {
      const threadRows = await db.execute(sql`
        SELECT id, wa_phone_number FROM whatsapp_threads WHERE id = ${id} LIMIT 1
      `);
      const thread = (threadRows.rows ?? threadRows)[0] as any;
      if (!thread) return res.status(404).json({ error: "Thread bulunamadı" });

      const inserted = await db.execute(sql`
        INSERT INTO whatsapp_messages (
          thread_id, direction, sender_phone, message_text,
          ai_generated, delivery_status
        ) VALUES (
          ${id}, 'outbound', ${process.env["WA_PHONE_NUMBER_ID"] ?? ""}, ${text},
          FALSE, 'pending'
        )
        RETURNING id
      `);
      const messageRowId = ((inserted.rows ?? inserted)[0] as any)?.id;

      const send = await sendWhatsAppMessage(thread.wa_phone_number, text);
      if (!send.ok) {
        await db.execute(sql`
          UPDATE whatsapp_messages SET
            delivery_status = 'failed',
            delivery_error = ${send.error ?? "bilinmeyen"}
          WHERE id = ${messageRowId}
        `);
        return res.status(502).json({ error: send.error ?? "Gönderim başarısız" });
      }

      await db.execute(sql`
        UPDATE whatsapp_messages SET
          wa_message_id = ${send.waMessageId ?? null},
          delivery_status = 'sent',
          sent_at = NOW()
        WHERE id = ${messageRowId}
      `);
      await db.execute(sql`
        UPDATE whatsapp_threads SET
          last_message_text = ${text},
          last_message_at = NOW(),
          unread_count = 0,
          updated_at = NOW()
        WHERE id = ${id}
      `);

      return res.json({ ok: true, messageId: messageRowId });
    } catch (e: any) {
      console.error("[admin-wa-bot/threads/:id/send] HATA:", e?.message);
      return res.status(500).json({ error: e?.message });
    }
  },
);

// ─── THREAD AYARI: bot enable/disable, escalation reset ─────────────────
router.patch(
  "/admin/whatsapp-bot/threads/:id",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id ?? "", 10);
    if (!id) return res.status(400).json({ error: "id geçersiz" });

    const { botEnabled, clearEscalation, isBlocked } = (req.body ?? {}) as any;

    try {
      const sets: any[] = [];
      if (typeof botEnabled === "boolean") sets.push(sql`bot_enabled = ${botEnabled}`);
      if (clearEscalation === true)
        sets.push(sql`escalated_at = NULL, escalation_reason = NULL`);
      if (typeof isBlocked === "boolean") sets.push(sql`is_blocked = ${isBlocked}`);
      if (sets.length === 0) return res.status(400).json({ error: "Güncellenecek alan yok" });

      sets.push(sql`updated_at = NOW()`);
      await db.execute(sql`
        UPDATE whatsapp_threads SET ${sql.join(sets, sql`, `)}
        WHERE id = ${id}
      `);
      const rows = await db.execute(sql`SELECT * FROM whatsapp_threads WHERE id = ${id} LIMIT 1`);
      return res.json({ thread: (rows.rows ?? rows)[0] });
    } catch (e: any) {
      console.error("[admin-wa-bot/threads PATCH] HATA:", e?.message);
      return res.status(500).json({ error: e?.message });
    }
  },
);

// ─── BOT AYARLARI ───────────────────────────────────────────────────────
router.get(
  "/admin/whatsapp-bot/settings",
  authMiddleware,
  requireRole("admin"),
  async (_req: AuthRequest, res: Response) => {
    try {
      const rows = await db.execute(sql`
        SELECT key, value, updated_at FROM whatsapp_bot_settings ORDER BY key
      `);
      return res.json({ settings: rows.rows ?? rows });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message });
    }
  },
);

router.patch(
  "/admin/whatsapp-bot/settings",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    const { key, value } = (req.body ?? {}) as { key?: string; value?: string };
    if (!key) return res.status(400).json({ error: "key gerekli" });

    try {
      await db.execute(sql`
        INSERT INTO whatsapp_bot_settings (key, value, updated_at)
        VALUES (${key}, ${value ?? null}, NOW())
        ON CONFLICT (key) DO UPDATE SET
          value = EXCLUDED.value,
          updated_at = NOW()
      `);
      return res.json({ ok: true });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message });
    }
  },
);

export default router;
