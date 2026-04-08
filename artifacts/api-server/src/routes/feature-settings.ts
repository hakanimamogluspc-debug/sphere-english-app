import { Router } from "express";
import { db, featureSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth.js";

const router = Router();

// ─── In-memory cache — feature_settings nadiren değişir, 60 sn TTL yeterli ──
interface CacheEntry { data: unknown[]; expiresAt: number }
let cache: CacheEntry | null = null;
const CACHE_TTL_MS = 60_000; // 60 saniye

function getCached(): unknown[] | null {
  if (cache && Date.now() < cache.expiresAt) return cache.data;
  return null;
}
function setCache(data: unknown[]) {
  cache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
}
function invalidateCache() {
  cache = null;
}

// GET /feature-settings — tüm oturum açmış kullanıcılar okuyabilir (nav filtreleme için)
router.get("/feature-settings", authMiddleware, async (_req, res) => {
  const cached = getCached();
  if (cached) {
    res.json(cached);
    return;
  }
  const rows = await db.select().from(featureSettingsTable);
  setCache(rows);
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

  invalidateCache(); // güncelleme sonrası önbelleği temizle
  res.json(updated);
});

export default router;
