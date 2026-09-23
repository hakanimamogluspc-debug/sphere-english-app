/**
 * Öğrenme Haritası — R5
 *
 * Kullanıcının 15 modül üzerindeki yolculuğunu gösterir:
 *   - Her modüle toplam kaç dakika harcadı
 *   - Kaç farklı gün girdi
 *   - İlk giriş ve son giriş tarihi
 *   - En çok girdiği modül (favori)
 *
 * Veri kaynağı: user_daily_activity (index.ts'te tanımlı — user_id, date, module, minutes).
 *
 * Endpoint:
 *   GET /student/learning-map — kullanıcının modül bazlı istatistikleri + genel özet
 */

import { Router, type Response } from "express";
import { pool } from "@workspace/db";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";

const router = Router();

// 15 modül key'leri — modules.json ile birebir eşleşir
const MODULE_KEYS = [
  "pronunciation_coach",
  "writing_coach",
  "grammar_coach",
  "vocab_game",
  "simulation_mode",
  "interview_sim",
  "presentation_sim",
  "ai_quiz",
  "ai_tutor",
  "learning_path",
  "level_exams",
  "speaking_scenes",
  "student_materials",
  "student_speaking_club",
  "career",
  "discover",
  "watch_listen",
  "business_cards",
] as const;

router.get("/student/learning-map", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ error: "Yetkisiz" });

    const rows = await pool.query(
      `SELECT module,
              SUM(minutes)::int AS total_minutes,
              COUNT(DISTINCT date)::int AS days_visited,
              MIN(date) AS first_visit,
              MAX(date) AS last_visit
       FROM user_daily_activity
       WHERE user_id = $1
       GROUP BY module`,
      [req.userId],
    );

    // Map -> module key -> stats
    const byModule = new Map<string, {
      total_minutes: number;
      days_visited: number;
      first_visit: string | null;
      last_visit: string | null;
    }>();
    for (const r of rows.rows) {
      byModule.set(String(r.module), {
        total_minutes: Number(r.total_minutes || 0),
        days_visited: Number(r.days_visited || 0),
        first_visit: r.first_visit,
        last_visit: r.last_visit,
      });
    }

    // 15 modülün her biri için doldur (visited olmasa bile 0'lı gelsin)
    const modules = MODULE_KEYS.map((key) => {
      const s = byModule.get(key);
      return {
        key,
        total_minutes: s?.total_minutes ?? 0,
        days_visited: s?.days_visited ?? 0,
        first_visit: s?.first_visit ?? null,
        last_visit: s?.last_visit ?? null,
        visited: !!s,
      };
    });

    // Genel özet
    const totals = modules.reduce(
      (acc, m) => ({
        total_minutes: acc.total_minutes + m.total_minutes,
        total_days: Math.max(acc.total_days, m.days_visited),
        modules_visited: acc.modules_visited + (m.visited ? 1 : 0),
      }),
      { total_minutes: 0, total_days: 0, modules_visited: 0 },
    );

    // Favori modül
    const favorite = [...modules]
      .filter((m) => m.visited)
      .sort((a, b) => b.total_minutes - a.total_minutes)[0] ?? null;

    // Kullanıcının seviye + streak bilgileri
    const uRow = await pool.query(
      `SELECT current_level, streak, streak_freeze_count, created_at
       FROM users WHERE id = $1 LIMIT 1`,
      [req.userId],
    );
    const u = uRow.rows[0] ?? {};

    return res.json({
      ok: true,
      summary: {
        total_minutes: totals.total_minutes,
        total_hours: Math.round((totals.total_minutes / 60) * 10) / 10,
        modules_visited: totals.modules_visited,
        modules_total: MODULE_KEYS.length,
        exploration_pct: Math.round((totals.modules_visited / MODULE_KEYS.length) * 100),
        current_level: u.current_level ?? null,
        streak: u.streak ?? 0,
        streak_freezes: u.streak_freeze_count ?? 0,
        member_since: u.created_at ?? null,
      },
      favorite_module: favorite?.key ?? null,
      modules,
    });
  } catch (e: any) {
    console.error("[learning-map] HATA:", e?.message);
    return res.status(500).json({ error: e?.message });
  }
});

export default router;
