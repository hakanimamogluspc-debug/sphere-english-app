/**
 * Admin DB yedek yönetimi.
 *
 *   GET  /api/admin/backups            — Yedek listesi
 *   POST /api/admin/backups/run        — Manuel yedek tetikle
 *   POST /api/admin/backups/prune      — Eski yedekleri sil
 */

import { Router, Response } from "express";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth.js";
import { listBackups, runBackup, pruneOldBackups } from "../lib/db-backup.js";
import { offsiteConfigured, offsiteMissing, listRemote, recentRuns } from "../lib/backup-offsite.js";
import { storageEnabled, checkStorage } from "../lib/object-storage.js";
import { migrateAssetsToStorage, storageStats } from "../lib/ebook-asset-store.js";

const router = Router();

router.get(
  "/admin/backups",
  authMiddleware,
  requireRole("admin"),
  async (_req: AuthRequest, res: Response) => {
    try {
      const list = await listBackups();
      let remote: Array<{ name: string; sizeBytes: number | null }> = [];
      let remoteError: string | null = null;
      if (offsiteConfigured()) {
        try { remote = await listRemote(); } catch (e: any) { remoteError = e?.message ?? "listelenemedi"; }
      }
      return res.json({
        backups: list,
        offsite: { configured: offsiteConfigured(), missing: offsiteMissing(), remote, remoteError },
        runs: await recentRuns(10),
      });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message });
    }
  },
);

router.post(
  "/admin/backups/run",
  authMiddleware,
  requireRole("admin"),
  async (_req: AuthRequest, res: Response) => {
    try {
      const r = await runBackup();
      return res.json(r);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message });
    }
  },
);

router.post(
  "/admin/backups/prune",
  authMiddleware,
  requireRole("admin"),
  async (_req: AuthRequest, res: Response) => {
    try {
      const r = await pruneOldBackups();
      return res.json(r);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message });
    }
  },
);

// ─── Nesne deposu (Hetzner Object Storage) ──────────────────────────────────

router.get(
  "/admin/storage/status",
  authMiddleware,
  requireRole("admin"),
  async (_req: AuthRequest, res: Response) => {
    try {
      return res.json({
        enabled: storageEnabled(),
        connection: await checkStorage(),
        ebooks: await storageStats(),
      });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message });
    }
  },
);

/** Veritabanındaki e-kitap dosyalarını bucket'a taşı (parti parti; "remaining" 0 olana dek tekrar çağır). */
router.post(
  "/admin/storage/migrate-ebooks",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!storageEnabled()) return res.status(400).json({ error: "Nesne deposu yapılandırılmamış (S3_* ortam değişkenleri)." });
      const limit = Math.min(100, Math.max(1, Number(req.body?.limit) || 20));
      return res.json(await migrateAssetsToStorage(limit));
    } catch (e: any) {
      return res.status(500).json({ error: e?.message });
    }
  },
);

export default router;
