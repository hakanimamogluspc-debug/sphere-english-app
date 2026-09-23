/**
 * Streak — Duolingo tarzı günlük seri sistemi.
 *
 * Kullanıcının uzun süreli motivasyonu için — retention için kritik.
 *
 * Mevcut sistem:
 *   - users.streak (integer) — üst üste aktif gün sayısı
 *   - users.last_active_date (text YYYY-MM-DD) — son aktivite
 *   - applyActivityStreak() — herhangi bir modülde aktivite → streak +1
 *
 * Bu route:
 *   GET  /student/streak-status — streak, isAtRisk, hoursLeft, freezeRemaining
 *   POST /student/streak/freeze — 1 freeze kullan (streak koru, kaçırılan günü affet)
 *
 * Freeze mekaniği:
 *   - Kullanıcı haftada 1 freeze kazanır (streak_freeze_count kolonu)
 *   - Bir gün kaçırırsa freeze aktif olur → streak korunur
 *   - Manuel de "koru" butonuyla kullanılabilir
 */

import { Router, type Response } from "express";
import { pool } from "@workspace/db";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";

const router = Router();

// Tabloya freeze count ekle (idempotent)
async function ensureColumns() {
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS streak_freeze_count INTEGER NOT NULL DEFAULT 1`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS streak_freeze_reset_date DATE`);
}
ensureColumns().catch((e) => console.warn("[streak] ensureColumns warn:", e?.message));

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  const d1 = new Date(a + "T00:00:00Z").getTime();
  const d2 = new Date(b + "T00:00:00Z").getTime();
  return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
}

/** Haftalık freeze reset — pazartesi sıfırlanır (kullanıcı için weekly cap 1) */
function currentWeekMonday(): string {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun, 1=Mon ...
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() + diff);
  return monday.toISOString().slice(0, 10);
}

// ─── GET /student/streak-status ────────────────────────────────────────────

router.get("/student/streak-status", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ error: "Yetkisiz" });

    const r = await pool.query(
      `SELECT streak, last_active_date, streak_freeze_count, streak_freeze_reset_date
       FROM users WHERE id = $1 LIMIT 1`,
      [req.userId],
    );
    const u = r.rows[0];
    if (!u) return res.status(404).json({ error: "Kullanıcı bulunamadı" });

    const today = todayIsoDate();
    const lastActive: string | null = u.last_active_date ?? null;
    const streak = Number(u.streak ?? 0);

    // Weekly freeze reset — pazartesi geçtiyse count'u 1'e set et
    const weekMonday = currentWeekMonday();
    const resetDate: string | null = u.streak_freeze_reset_date ?? null;
    let freezeCount = Number(u.streak_freeze_count ?? 1);
    if (!resetDate || resetDate < weekMonday) {
      // Yeni hafta — freeze'u 1'e yükselt (birden fazla birikmesin)
      await pool.query(
        `UPDATE users SET streak_freeze_count = 1, streak_freeze_reset_date = $1 WHERE id = $2`,
        [weekMonday, req.userId],
      );
      freezeCount = 1;
    }

    // Streak durumu hesapla
    let isAtRisk = false;
    let daysSinceActive = 0;
    let hoursLeft = 24; // bugün henüz aktif olunmadıysa

    if (lastActive) {
      daysSinceActive = daysBetween(lastActive, today);

      if (daysSinceActive === 0) {
        // Bugün zaten aktif — streak safe
        isAtRisk = false;
        hoursLeft = 24 - new Date().getUTCHours();
      } else if (daysSinceActive === 1) {
        // Dün aktifti, bugün henüz değil — risk altında
        isAtRisk = true;
        hoursLeft = 24 - new Date().getUTCHours();
      } else if (daysSinceActive >= 2) {
        // Streak zaten kırıldı (freeze aktif değilse)
        // Bu durumda streak sıfırlanmış olmalı (applyActivityStreak veya cron job)
        isAtRisk = false;
      }
    } else {
      // Hiç aktif olmadıysa — kırılma yok, streak zaten 0
      isAtRisk = false;
    }

    return res.json({
      ok: true,
      streak,
      lastActiveDate: lastActive,
      daysSinceActive,
      isAtRisk,
      hoursLeft,
      freezeCount,
      canUseFreeze: freezeCount > 0 && (daysSinceActive === 1 || daysSinceActive === 2),
    });
  } catch (e: any) {
    console.error("[streak-status] HATA:", e?.message);
    return res.status(500).json({ error: e?.message });
  }
});

// ─── POST /student/streak/freeze ───────────────────────────────────────────

router.post("/student/streak/freeze", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ error: "Yetkisiz" });

    const r = await pool.query(
      `SELECT streak, last_active_date, streak_freeze_count FROM users WHERE id = $1 LIMIT 1`,
      [req.userId],
    );
    const u = r.rows[0];
    if (!u) return res.status(404).json({ error: "Kullanıcı bulunamadı" });

    const freezeCount = Number(u.streak_freeze_count ?? 0);
    if (freezeCount <= 0) {
      return res.status(400).json({ error: "Bu hafta streak koruma hakkın kalmadı" });
    }

    const today = todayIsoDate();
    const lastActive: string | null = u.last_active_date ?? null;
    if (!lastActive) {
      return res.status(400).json({ error: "Henüz streak başlatılmamış" });
    }

    const daysSince = daysBetween(lastActive, today);
    if (daysSince === 0) {
      return res.status(400).json({ error: "Bugün zaten aktifsin — koruma gereksiz" });
    }
    if (daysSince > 2) {
      return res.status(400).json({ error: "Streak koruma için çok geç — yeni bir streak başlat" });
    }

    // Freeze uygula: last_active_date'i dün olarak set et → streak korunur
    // Yani sanki dün aktifmiş gibi davran (streak korumalı)
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    await pool.query(
      `UPDATE users
         SET last_active_date = $1,
             streak_freeze_count = streak_freeze_count - 1
       WHERE id = $2`,
      [yesterdayStr, req.userId],
    );

    return res.json({
      ok: true,
      message: "Streak korundu! Bugün de aktif ol ki seri devam etsin.",
      streak: Number(u.streak ?? 0),
      freezeCount: freezeCount - 1,
    });
  } catch (e: any) {
    console.error("[streak/freeze] HATA:", e?.message);
    return res.status(500).json({ error: e?.message });
  }
});

// ─── GET /student/leaderboard/weekly ──────────────────────────────────────
// Kullanıcının seviye + sektöründen benzerleri arasında haftalık puan sıralaması

router.get("/student/leaderboard/weekly", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ error: "Yetkisiz" });

    const meRow = await pool.query(
      `SELECT current_level, sector, total_points, first_name, last_name FROM users WHERE id = $1 LIMIT 1`,
      [req.userId],
    );
    const me = meRow.rows[0];
    if (!me) return res.status(404).json({ error: "Kullanıcı bulunamadı" });

    // Aynı seviye + benzer sektör (varsa) — yoksa sadece seviyeye göre
    const level = me.current_level;
    const sector = me.sector;

    // Bu haftaki puan artışını hesaplamak zor (activity_logs vs) — şimdilik toplam puana göre sırala
    // İleride weekly_points kolonu eklenirse iyileştirilir
    // Gizlilik: isim değil öğrenci numarası dönüyor (SE-YYYY-NNNN formatı)
    const query = sector
      ? `SELECT id, student_number, total_points, streak, current_level, sector
         FROM users
         WHERE role = 'student'
           AND current_level = $1
           AND sector = $2
         ORDER BY total_points DESC
         LIMIT 20`
      : `SELECT id, student_number, total_points, streak, current_level, sector
         FROM users
         WHERE role = 'student'
           AND current_level = $1
         ORDER BY total_points DESC
         LIMIT 20`;

    const args = sector ? [level, sector] : [level];
    const r = await pool.query(query, args);

    const rows = r.rows.map((u, idx) => ({
      rank: idx + 1,
      userId: u.id,
      // Gizlilik: student_number gösterilir (ör. SE-2026-0007). Yoksa fallback "Öğrenci #ID"
      studentNumber: u.student_number ?? `Öğrenci #${u.id}`,
      totalPoints: Number(u.total_points ?? 0),
      streak: Number(u.streak ?? 0),
      isMe: u.id === req.userId,
    }));

    return res.json({
      ok: true,
      cohort: { level, sector },
      leaderboard: rows,
    });
  } catch (e: any) {
    console.error("[leaderboard/weekly] HATA:", e?.message);
    return res.status(500).json({ error: e?.message });
  }
});

export default router;
