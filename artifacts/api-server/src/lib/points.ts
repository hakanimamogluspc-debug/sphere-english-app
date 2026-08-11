/**
 * Merkezi puan verme sistemi.
 *
 * awardPoints(userId, source, amount, opts)
 *   - dailyCap: bir gün içinde bu source'tan alınabilecek max puan
 *   - refId: aynı kaynak+ref bir kere sayılsın (idempotent)
 *   - silent: hata durumunda throw etme
 *
 * Puanlar users.total_points'e eklenir + points_events tablosuna log yazılır.
 */

import { pool } from "@workspace/db";

export const POINT_VALUES = {
  // Micro (engagement)
  daily_login: 2,
  module_open: 1,               // ders/scene/quiz açılışı — günde max 5
  dashboard_visit: 1,           // günlük ilk dashboard

  // Content interaction
  article_view: 2,              // Keşfet makale — günde max 10 puan
  article_complete_read: 3,     // makale sonuna kadar
  article_save: 3,              // kaydet
  career_open: 2,               // video/podcast tık — günde max 10
  dictionary_click: 1,          // kelime sözlük — günde max 10 puan

  // AI coaches (mevcut sistemleri koruyalım — bu ekstra bonus)
  ai_tutor_message: 1,          // her mesaj — günde max 15
  writing_submit: 3,
  scene_turn: 5,                // konuşma turu — günde max 30
  scene_complete: 15,           // tam sahne bitirme
  pronunciation_practice: 2,

  // Learning (mevcut)
  quiz_correct: 3,
  quiz_complete: 10,
  lesson_complete: 15,

  // Milestones (bir kereye mahsus)
  placement_test_complete: 50,
  first_speaking_scene: 10,
  first_article_read: 5,
  first_ai_tutor_chat: 5,

  // Mistake ledger
  mistake_resolve: 3,           // hata "anladım" işaretleme

  // Streaks (mevcut sistemi güçlendir)
  streak_7day: 25,              // 7 gün üst üste
  streak_30day: 100,            // 30 gün
} as const;

export type PointSource = keyof typeof POINT_VALUES;

type AwardOptions = {
  dailyCap?: number;             // aynı source'tan gün başına max toplam puan
  onceEverForRef?: boolean;      // aynı source+refId sadece 1 kere
  refId?: string | number;
  silent?: boolean;
};

/**
 * Güvenli puan ver. Cap dolmuşsa 0 döner.
 * Returns: verilen puan miktarı (0 ise cap doldu veya idempotent skip)
 */
export async function awardPoints(
  userId: number | undefined,
  source: PointSource,
  opts: AwardOptions = {},
): Promise<number> {
  if (!userId || !Number.isFinite(userId)) return 0;
  const base = POINT_VALUES[source] ?? 0;
  if (base <= 0) return 0;

  try {
    // Idempotency
    if (opts.onceEverForRef && opts.refId !== undefined) {
      const check: any = await pool.query(
        `SELECT id FROM points_events WHERE user_id = $1 AND source = $2 AND ref_id = $3 LIMIT 1`,
        [userId, source, String(opts.refId)],
      );
      if (check.rows[0]) return 0;
    }

    // Daily cap
    if (opts.dailyCap && opts.dailyCap > 0) {
      const today: any = await pool.query(
        `SELECT COALESCE(SUM(amount), 0)::int AS total FROM points_events
           WHERE user_id = $1 AND source = $2 AND created_at::date = CURRENT_DATE`,
        [userId, source],
      );
      const already = today.rows[0]?.total ?? 0;
      if (already >= opts.dailyCap) return 0;
      const room = opts.dailyCap - already;
      const grant = Math.min(base, room);
      if (grant <= 0) return 0;

      await pool.query(
        `INSERT INTO points_events (user_id, source, amount, ref_id) VALUES ($1, $2, $3, $4)`,
        [userId, source, grant, opts.refId ? String(opts.refId) : null],
      );
      await pool.query(
        `UPDATE users SET total_points = COALESCE(total_points, 0) + $2 WHERE id = $1`,
        [userId, grant],
      );
      return grant;
    }

    // No cap
    await pool.query(
      `INSERT INTO points_events (user_id, source, amount, ref_id) VALUES ($1, $2, $3, $4)`,
      [userId, source, base, opts.refId ? String(opts.refId) : null],
    );
    await pool.query(
      `UPDATE users SET total_points = COALESCE(total_points, 0) + $2 WHERE id = $1`,
      [userId, base],
    );
    return base;
  } catch (e: any) {
    if (!opts.silent) console.warn(`[points] ${source} userId=${userId} hata:`, e?.message);
    return 0;
  }
}

/** Kullanıcının bu haftaki toplam puanı */
export async function getWeeklyPoints(userId: number): Promise<number> {
  const r: any = await pool.query(
    `SELECT COALESCE(SUM(amount), 0)::int AS total FROM points_events
       WHERE user_id = $1 AND created_at > NOW() - INTERVAL '7 days'`,
    [userId],
  );
  return r.rows[0]?.total ?? 0;
}

/** Kullanıcının bugünkü puan kaynak dağılımı */
export async function getTodayBreakdown(userId: number): Promise<Array<{ source: string; total: number }>> {
  const r: any = await pool.query(
    `SELECT source, SUM(amount)::int AS total FROM points_events
       WHERE user_id = $1 AND created_at::date = CURRENT_DATE
       GROUP BY source ORDER BY total DESC`,
    [userId],
  );
  return r.rows;
}
