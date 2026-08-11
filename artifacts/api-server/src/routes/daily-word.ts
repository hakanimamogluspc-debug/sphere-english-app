/**
 * Daily Word (Word of the Day) endpoints.
 *
 *   GET  /word-of-day/today                  → bugünün kelimesi
 *   GET  /word-of-day/recent?limit=7         → son N kelime
 *   POST /admin/word-of-day/fetch            → manuel tetikle (admin)
 */

import { Router, type Response } from "express";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth";
import { getTodaysWord, getRecentWords, fetchTodaysWord } from "../lib/daily-word";

const router = Router();

router.get("/word-of-day/today", authMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    const w = await getTodaysWord();
    if (!w) return res.json({ word: null });
    return res.json({ word: w });
  } catch (e: any) { return res.status(500).json({ error: e?.message }); }
});

router.get("/word-of-day/recent", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? "7"), 10) || 7, 30);
    const words = await getRecentWords(limit);
    return res.json({ words });
  } catch (e: any) { return res.status(500).json({ error: e?.message }); }
});

router.post("/admin/word-of-day/fetch", authMiddleware, requireRole("admin"), async (_req: AuthRequest, res: Response) => {
  try {
    const r = await fetchTodaysWord();
    return res.json(r);
  } catch (e: any) { return res.status(500).json({ error: e?.message }); }
});

export default router;
