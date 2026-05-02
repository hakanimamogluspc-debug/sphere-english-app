import type { Request, Response, NextFunction } from "express";
import { getEntitlement } from "../lib/subscription.js";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

/**
 * Gate behind an active subscription (trial or paid). Admins always pass.
 * Must be mounted AFTER authMiddleware — it relies on req.userId.
 */
export async function requireSubscription(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).userId as number | undefined;
    if (!userId) return res.status(401).json({ error: "Yetkisiz." });

    // Admins / teachers bypass — they need access for management/preview.
    const [me] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!me) return res.status(401).json({ error: "Yetkisiz." });
    if (me.role === "admin" || me.role === "teacher") return next();

    const { entitlement } = await getEntitlement(userId);
    if (entitlement.active) return next();

    return res.status(402).json({
      error: "Bu özellik Pro abonelere açıktır.",
      code: "subscription_required",
      status: entitlement.status,
      hasUsedTrial: entitlement.hasUsedTrial,
    });
  } catch (err: any) {
    console.error("requireSubscription error:", err?.message || err);
    return res.status(500).json({ error: "Abonelik kontrol edilemedi." });
  }
}
