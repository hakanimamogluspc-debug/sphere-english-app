import { Router, type Request, type Response } from "express";
import { authMiddleware } from "../middlewares/auth.js";
import { db } from "@workspace/db";
import { notificationPreferencesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import {
  ensurePreferences,
  listNotifications,
  unreadCount,
  markAllRead,
  markRead,
  deleteNotification,
  runDailyNotificationChecker,
} from "../lib/notifications.js";

const router = Router();

// List notifications + unread count (single endpoint for bell)
router.get("/notifications", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as number;
    const limit = Math.min(50, parseInt(String(req.query.limit ?? "20"), 10) || 20);

    // opportunistic daily scan (cheap if recently ran)
    runDailyNotificationChecker().catch(() => {});

    const [items, unread] = await Promise.all([listNotifications(userId, limit), unreadCount(userId)]);
    return res.json({ notifications: items, unreadCount: unread });
  } catch (err: any) {
    console.error("List notifications error:", err?.message || err);
    return res.status(500).json({ error: "Bildirimler alınamadı." });
  }
});

router.post("/notifications/mark-all-read", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as number;
    await markAllRead(userId);
    return res.json({ ok: true });
  } catch (err: any) {
    console.error("Mark all read error:", err?.message || err);
    return res.status(500).json({ error: "Bildirimler okundu olarak işaretlenemedi." });
  }
});

router.post("/notifications/:id/read", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as number;
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Geçersiz id." });
    const ok = await markRead(userId, id);
    if (!ok) return res.status(404).json({ error: "Bildirim bulunamadı." });
    return res.json({ ok: true });
  } catch (err: any) {
    console.error("Mark read error:", err?.message || err);
    return res.status(500).json({ error: "İşaretlenemedi." });
  }
});

router.delete("/notifications/:id", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as number;
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Geçersiz id." });
    const ok = await deleteNotification(userId, id);
    if (!ok) return res.status(404).json({ error: "Bildirim bulunamadı." });
    return res.json({ ok: true });
  } catch (err: any) {
    console.error("Delete notification error:", err?.message || err);
    return res.status(500).json({ error: "Silinemedi." });
  }
});

// ── Preferences ──
router.get("/notifications/preferences", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as number;
    const prefs = await ensurePreferences(userId);
    return res.json({ preferences: prefs });
  } catch (err: any) {
    console.error("Get preferences error:", err?.message || err);
    return res.status(500).json({ error: "Tercihler alınamadı." });
  }
});

router.put("/notifications/preferences", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as number;
    await ensurePreferences(userId); // ensure row exists

    const allowed: (keyof typeof notificationPreferencesTable._.columns)[] = [
      "emailEnabled",
      "inAppEnabled",
      "streakRiskEmail",
      "inactivityEmail",
      "newAssessmentEmail",
      "levelUpEmail",
      "newQuizEmail",
      "weeklyDigestEmail",
    ];
    const updates: Record<string, any> = { updatedAt: new Date() };
    for (const key of allowed) {
      if (typeof req.body?.[key] === "boolean") {
        updates[key] = req.body[key];
      }
    }
    if (Object.keys(updates).length === 1) {
      return res.status(400).json({ error: "Güncellenecek tercih yok." });
    }

    const [updated] = await db
      .update(notificationPreferencesTable)
      .set(updates)
      .where(eq(notificationPreferencesTable.userId, userId))
      .returning();
    return res.json({ preferences: updated });
  } catch (err: any) {
    console.error("Update preferences error:", err?.message || err);
    return res.status(500).json({ error: "Tercihler güncellenemedi." });
  }
});

export default router;
