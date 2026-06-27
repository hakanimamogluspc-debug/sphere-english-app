/**
 * Instagram bot admin paneli endpoint'leri.
 *
 * Tüm endpoint'ler authMiddleware + requireRole('admin') guard altında.
 *
 *   GET    /api/admin/instagram-bot/overview         → İstatistikler
 *   GET    /api/admin/instagram-bot/threads          → DM thread listesi (filtre/arama)
 *   GET    /api/admin/instagram-bot/threads/:id      → Thread detay + mesaj geçmişi
 *   POST   /api/admin/instagram-bot/threads/:id/send → Manuel mesaj gönder
 *   PATCH  /api/admin/instagram-bot/threads/:id      → Bot enable/disable, escalation
 *   GET    /api/admin/instagram-bot/comments         → Yorum listesi
 *   GET    /api/admin/instagram-bot/settings         → Bot ayarları (key/value)
 *   PATCH  /api/admin/instagram-bot/settings         → Ayar güncelle
 */

import { Router, Response } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth.js";
import { sendInstagramMessage } from "../lib/instagram-api.js";

const router = Router();

// ─── ÖZET / İSTATİSTİKLER ───────────────────────────────────────────────
router.get(
  "/admin/instagram-bot/overview",
  authMiddleware,
  requireRole("admin"),
  async (_req: AuthRequest, res: Response) => {
    try {
      const stats = await db.execute(sql`
        SELECT
          (SELECT COUNT(*) FROM instagram_threads)::INT AS total_threads,
          (SELECT COUNT(*) FROM instagram_threads WHERE last_message_at >= NOW() - INTERVAL '24 hours')::INT AS active_24h,
          (SELECT COUNT(*) FROM instagram_threads WHERE escalated_at IS NOT NULL AND bot_enabled = FALSE)::INT AS escalated,
          (SELECT COUNT(*) FROM instagram_threads WHERE unread_count > 0)::INT AS unread,
          (SELECT COUNT(*) FROM instagram_messages WHERE direction = 'inbound' AND created_at >= NOW() - INTERVAL '24 hours')::INT AS dms_in_24h,
          (SELECT COUNT(*) FROM instagram_messages WHERE direction = 'outbound' AND created_at >= NOW() - INTERVAL '24 hours')::INT AS dms_out_24h,
          (SELECT COUNT(*) FROM instagram_comments WHERE created_at >= NOW() - INTERVAL '24 hours')::INT AS comments_24h,
          (SELECT COUNT(*) FROM instagram_comments WHERE reply_status = 'sent' AND replied_at >= NOW() - INTERVAL '24 hours')::INT AS comments_replied_24h,
          (SELECT COUNT(*) FROM instagram_messages WHERE delivery_status = 'failed' AND created_at >= NOW() - INTERVAL '24 hours')::INT AS failed_24h,
          (SELECT COALESCE(AVG(ai_latency_ms)::INT, 0) FROM instagram_messages WHERE direction = 'outbound' AND ai_generated = TRUE AND created_at >= NOW() - INTERVAL '24 hours') AS avg_latency_ms
      `);
      const row = (stats.rows ?? stats)[0];
      return res.json({ stats: row });
    } catch (e: any) {
      console.error("[admin-ig-bot/overview] HATA:", e?.message);
      return res.status(500).json({ error: e?.message });
    }
  },
);

// ─── THREAD LİSTESİ ─────────────────────────────────────────────────────
router.get(
  "/admin/instagram-bot/threads",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const filter = String(req.query?.filter ?? "all"); // all | unread | escalated | bot_off
      const search = String(req.query?.search ?? "").trim().toLowerCase();
      const limit = Math.min(parseInt(String(req.query?.limit ?? "50"), 10) || 50, 200);

      const conditions: any[] = [];
      if (filter === "unread") conditions.push(sql`unread_count > 0`);
      if (filter === "escalated") conditions.push(sql`escalated_at IS NOT NULL`);
      if (filter === "bot_off") conditions.push(sql`bot_enabled = FALSE`);
      if (search) {
        const like = `%${search}%`;
        conditions.push(sql`(
          LOWER(COALESCE(ig_username, '')) LIKE ${like}
          OR LOWER(COALESCE(ig_full_name, '')) LIKE ${like}
          OR LOWER(COALESCE(last_message_text, '')) LIKE ${like}
        )`);
      }

      const whereClause = conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``;

      const rows = await db.execute(sql`
        SELECT
          id, ig_user_id, ig_username, ig_full_name, profile_pic_url,
          last_message_text, last_message_at, last_inbound_at,
          unread_count, is_blocked, bot_enabled, escalated_at, escalation_reason,
          first_seen_at, updated_at
        FROM instagram_threads
        ${whereClause}
        ORDER BY COALESCE(last_message_at, first_seen_at) DESC
        LIMIT ${limit}
      `);
      return res.json({ threads: rows.rows ?? rows });
    } catch (e: any) {
      console.error("[admin-ig-bot/threads] HATA:", e?.message);
      return res.status(500).json({ error: e?.message });
    }
  },
);

// ─── THREAD DETAY + MESAJ GEÇMİŞİ ───────────────────────────────────────
router.get(
  "/admin/instagram-bot/threads/:id",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id ?? "", 10);
    if (!id) return res.status(400).json({ error: "id geçersiz" });

    try {
      const threadRows = await db.execute(sql`
        SELECT * FROM instagram_threads WHERE id = ${id} LIMIT 1
      `);
      const thread = (threadRows.rows ?? threadRows)[0];
      if (!thread) return res.status(404).json({ error: "Thread bulunamadı" });

      const msgRows = await db.execute(sql`
        SELECT id, direction, message_text, attachments,
               ai_generated, ai_confidence, ai_model, ai_latency_ms,
               delivery_status, delivery_error,
               created_at, sent_at
        FROM instagram_messages
        WHERE thread_id = ${id}
        ORDER BY created_at ASC
        LIMIT 200
      `);

      // Unread'i sıfırla
      await db.execute(sql`
        UPDATE instagram_threads SET unread_count = 0 WHERE id = ${id} AND unread_count > 0
      `);

      return res.json({ thread, messages: msgRows.rows ?? msgRows });
    } catch (e: any) {
      console.error("[admin-ig-bot/threads/:id] HATA:", e?.message);
      return res.status(500).json({ error: e?.message });
    }
  },
);

// ─── MANUEL MESAJ GÖNDER (admin override) ───────────────────────────────
router.post(
  "/admin/instagram-bot/threads/:id/send",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id ?? "", 10);
    const text = String(req.body?.text ?? "").trim();
    if (!id) return res.status(400).json({ error: "id geçersiz" });
    if (!text) return res.status(400).json({ error: "Mesaj boş olamaz" });

    try {
      const threadRows = await db.execute(sql`
        SELECT id, ig_user_id FROM instagram_threads WHERE id = ${id} LIMIT 1
      `);
      const thread = (threadRows.rows ?? threadRows)[0] as any;
      if (!thread) return res.status(404).json({ error: "Thread bulunamadı" });

      // DB'ye pending olarak yaz
      const inserted = await db.execute(sql`
        INSERT INTO instagram_messages (
          thread_id, direction, sender_id, message_text,
          ai_generated, delivery_status
        ) VALUES (
          ${id}, 'outbound', ${process.env["IG_BUSINESS_ACCOUNT_ID"] ?? ""}, ${text},
          FALSE, 'pending'
        )
        RETURNING id
      `);
      const messageRowId = ((inserted.rows ?? inserted)[0] as any)?.id;

      const send = await sendInstagramMessage(thread.ig_user_id, text);
      if (!send.ok) {
        await db.execute(sql`
          UPDATE instagram_messages SET
            delivery_status = 'failed',
            delivery_error = ${send.error ?? "bilinmeyen"}
          WHERE id = ${messageRowId}
        `);
        return res.status(502).json({ error: send.error ?? "Gönderim başarısız" });
      }

      await db.execute(sql`
        UPDATE instagram_messages SET
          ig_message_id = ${send.igMessageId ?? null},
          delivery_status = 'sent',
          sent_at = NOW()
        WHERE id = ${messageRowId}
      `);
      await db.execute(sql`
        UPDATE instagram_threads SET
          last_message_text = ${text},
          last_message_at = NOW(),
          unread_count = 0,
          updated_at = NOW()
        WHERE id = ${id}
      `);

      return res.json({ ok: true, messageId: messageRowId });
    } catch (e: any) {
      console.error("[admin-ig-bot/threads/:id/send] HATA:", e?.message);
      return res.status(500).json({ error: e?.message });
    }
  },
);

// ─── THREAD AYARI: bot enable/disable, escalation reset ─────────────────
router.patch(
  "/admin/instagram-bot/threads/:id",
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
        UPDATE instagram_threads SET ${sql.join(sets, sql`, `)}
        WHERE id = ${id}
      `);
      const rows = await db.execute(sql`SELECT * FROM instagram_threads WHERE id = ${id} LIMIT 1`);
      return res.json({ thread: (rows.rows ?? rows)[0] });
    } catch (e: any) {
      console.error("[admin-ig-bot/threads PATCH] HATA:", e?.message);
      return res.status(500).json({ error: e?.message });
    }
  },
);

// ─── YORUM LİSTESİ ──────────────────────────────────────────────────────
router.get(
  "/admin/instagram-bot/comments",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const status = String(req.query?.status ?? "all"); // all | sent | pending | failed | skipped
      const limit = Math.min(parseInt(String(req.query?.limit ?? "50"), 10) || 50, 200);

      const where = status !== "all" ? sql`WHERE reply_status = ${status}` : sql``;
      const rows = await db.execute(sql`
        SELECT id, ig_comment_id, ig_media_id, sender_id, sender_username,
               comment_text, reply_text, ai_generated, ai_confidence,
               reply_status, reply_error, skipped_reason,
               created_at, replied_at
        FROM instagram_comments
        ${where}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `);
      return res.json({ comments: rows.rows ?? rows });
    } catch (e: any) {
      console.error("[admin-ig-bot/comments] HATA:", e?.message);
      return res.status(500).json({ error: e?.message });
    }
  },
);

// ─── BOT AYARLARI ───────────────────────────────────────────────────────
router.get(
  "/admin/instagram-bot/settings",
  authMiddleware,
  requireRole("admin"),
  async (_req: AuthRequest, res: Response) => {
    try {
      const rows = await db.execute(sql`
        SELECT key, value, updated_at FROM instagram_bot_settings ORDER BY key
      `);
      return res.json({ settings: rows.rows ?? rows });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message });
    }
  },
);

router.patch(
  "/admin/instagram-bot/settings",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    const { key, value } = (req.body ?? {}) as { key?: string; value?: string };
    if (!key) return res.status(400).json({ error: "key gerekli" });

    try {
      await db.execute(sql`
        INSERT INTO instagram_bot_settings (key, value, updated_at)
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
