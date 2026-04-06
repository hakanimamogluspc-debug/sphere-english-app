import { Router } from "express";
import { db, featureSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth.js";

const router = Router();

// GET /feature-settings — tüm oturum açmış kullanıcılar okuyabilir (nav filtreleme için)
router.get("/feature-settings", authMiddleware, async (_req, res) => {
  const rows = await db.select().from(featureSettingsTable);
  res.json(rows);
});

// GET /admin/feature-settings — admin'e özel (aynı veri, gelecekte ek admin bilgisi eklenebilir)
router.get("/admin/feature-settings", authMiddleware, requireRole("admin"), async (_req, res) => {
  const rows = await db.select().from(featureSettingsTable);
  res.json(rows);
});

// PATCH /admin/feature-settings/:key — bir modülü güncelle
router.patch("/admin/feature-settings/:key", authMiddleware, requireRole("admin"), async (req: AuthRequest, res) => {
  const { key } = req.params;
  const { isEnabled, visibleTo } = req.body as { isEnabled?: boolean; visibleTo?: string[] };

  const updates: Partial<{ isEnabled: boolean; visibleTo: string[]; updatedAt: Date }> = {
    updatedAt: new Date(),
  };
  if (isEnabled !== undefined) updates.isEnabled = isEnabled;
  if (visibleTo !== undefined) updates.visibleTo = visibleTo;

  const [updated] = await db
    .update(featureSettingsTable)
    .set(updates)
    .where(eq(featureSettingsTable.key, key))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Modül bulunamadı" });
    return;
  }
  res.json(updated);
});

export default router;
