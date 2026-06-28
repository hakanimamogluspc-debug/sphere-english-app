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

const router = Router();

router.get(
  "/admin/backups",
  authMiddleware,
  requireRole("admin"),
  async (_req: AuthRequest, res: Response) => {
    try {
      const list = await listBackups();
      return res.json({ backups: list });
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

export default router;
