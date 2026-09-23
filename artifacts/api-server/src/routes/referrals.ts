/**
 * Referans / Davet sistemi — Faz R4
 *
 * Kurgu:
 *   Her kullanıcının kısa bir referans kodu var (users.referral_code).
 *   Yeni bir kullanıcı bu kodla kayıt olursa:
 *     - Davet eden: +3 streak freeze
 *     - Yeni kayıt: +3 streak freeze
 *     - Ödül log'a yazılır (referrals tablosu)
 *
 * Kayıt akışı `auth.ts` register endpoint'ini genişletir — referral_code gelirse
 * bu router'daki helper `linkReferral` çağrılır.
 *
 * Endpoint'ler:
 *   GET  /student/referral        — benim kod + istatistiklerim + kimleri davet ettim
 *   GET  /public/referral/:code   — kod geçerli mi (register sayfası için)
 */

import { Router, type Response } from "express";
import crypto from "node:crypto";
import { pool } from "@workspace/db";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";

const router = Router();

async function ensureSchema() {
  // referrals tablosu
  await pool.query(`
    CREATE TABLE IF NOT EXISTS referrals (
      id SERIAL PRIMARY KEY,
      referrer_user_id INTEGER NOT NULL,
      invited_user_id INTEGER NOT NULL UNIQUE,
      code_used VARCHAR(16) NOT NULL,
      reward_status VARCHAR(20) NOT NULL DEFAULT 'rewarded',
      reward_type VARCHAR(40) NOT NULL DEFAULT 'streak_freeze_3',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS referrals_referrer_idx ON referrals(referrer_user_id, created_at DESC)`);

  // users tablosuna referral_code kolonu (yoksa)
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(16)`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS users_referral_code_idx ON users(referral_code) WHERE referral_code IS NOT NULL`);
}
ensureSchema().catch((e) => console.warn("[referrals] ensureSchema warn:", e?.message));

// ─── Yardımcı: kod üret ────────────────────────────────────────────────────

function makeCode(): string {
  // 6 karakter — büyük harf + rakam (I, O, 0, 1 hariç: karışıklık önleme)
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const buf = crypto.randomBytes(6);
  let out = "";
  for (let i = 0; i < 6; i++) out += chars[buf[i] % chars.length];
  return out;
}

async function getOrCreateCode(userId: number): Promise<string> {
  const r = await pool.query(`SELECT referral_code FROM users WHERE id = $1 LIMIT 1`, [userId]);
  const existing = r.rows[0]?.referral_code as string | null;
  if (existing) return existing;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = makeCode();
    try {
      await pool.query(`UPDATE users SET referral_code = $1 WHERE id = $2 AND referral_code IS NULL`, [code, userId]);
      const check = await pool.query(`SELECT referral_code FROM users WHERE id = $1 LIMIT 1`, [userId]);
      const saved = check.rows[0]?.referral_code as string | null;
      if (saved) return saved;
    } catch (e: any) {
      // Duplicate — tekrar dene
      if (!/duplicate/i.test(e?.message ?? "")) throw e;
    }
  }
  throw new Error("Referans kodu üretilemedi");
}

// ─── Referral bağlama (auth.ts register'dan çağrılacak) ─────────────────────

export async function linkReferral(newUserId: number, code: string | undefined | null): Promise<void> {
  if (!code) return;
  const clean = String(code).trim().toUpperCase();
  if (!/^[A-Z0-9]{4,16}$/.test(clean)) return;

  try {
    // Referans sahibini bul
    const ref = await pool.query(`SELECT id FROM users WHERE referral_code = $1 LIMIT 1`, [clean]);
    const referrerId = ref.rows[0]?.id as number | undefined;
    if (!referrerId || referrerId === newUserId) return;

    // Zaten kaydedilmiş mi?
    const dup = await pool.query(`SELECT 1 FROM referrals WHERE invited_user_id = $1 LIMIT 1`, [newUserId]);
    if (dup.rows.length > 0) return;

    // Kayıt
    await pool.query(
      `INSERT INTO referrals (referrer_user_id, invited_user_id, code_used, reward_status, reward_type)
       VALUES ($1, $2, $3, 'rewarded', 'streak_freeze_3')`,
      [referrerId, newUserId, clean],
    );

    // Ödül: her iki tarafa 3 streak freeze
    await pool.query(
      `UPDATE users SET streak_freeze_count = COALESCE(streak_freeze_count, 0) + 3 WHERE id = ANY($1)`,
      [[referrerId, newUserId]],
    );
  } catch (e: any) {
    console.warn("[referrals] linkReferral warn:", e?.message);
  }
}

// ─── GET /public/referral/:code — kod geçerli mi ───────────────────────────

router.get("/public/referral/:code", async (req, res: Response) => {
  try {
    const code = String(req.params.code ?? "").trim().toUpperCase();
    if (!/^[A-Z0-9]{4,16}$/.test(code)) {
      return res.status(400).json({ ok: false, error: "Geçersiz kod formatı" });
    }
    const r = await pool.query(
      `SELECT first_name FROM users WHERE referral_code = $1 LIMIT 1`,
      [code],
    );
    if (r.rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Kod bulunamadı" });
    }
    return res.json({
      ok: true,
      code,
      referrer_first_name: r.rows[0].first_name,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
});

// ─── GET /student/referral — benim durumum ─────────────────────────────────

router.get("/student/referral", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ error: "Yetkisiz" });
    const code = await getOrCreateCode(req.userId);

    // İstatistik
    const counts = await pool.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE reward_status = 'rewarded')::int AS rewarded
       FROM referrals WHERE referrer_user_id = $1`,
      [req.userId],
    );
    const totalRewardsFreezes = (counts.rows[0]?.rewarded ?? 0) * 3;

    // Son davetliler (isim değil, öğrenci numarası — gizlilik)
    const invited = await pool.query(
      `SELECT r.created_at, r.reward_status, u.student_number
       FROM referrals r
       INNER JOIN users u ON u.id = r.invited_user_id
       WHERE r.referrer_user_id = $1
       ORDER BY r.created_at DESC
       LIMIT 20`,
      [req.userId],
    );

    // Kendimin şu anki freeze sayısı
    const meRow = await pool.query(
      `SELECT streak_freeze_count FROM users WHERE id = $1 LIMIT 1`,
      [req.userId],
    );

    return res.json({
      ok: true,
      code,
      share_url: `https://app.sphereenglish.com/register?ref=${code}`,
      stats: {
        total_invited: counts.rows[0]?.total ?? 0,
        rewarded: counts.rows[0]?.rewarded ?? 0,
        total_freezes_earned: totalRewardsFreezes,
        current_freezes: meRow.rows[0]?.streak_freeze_count ?? 0,
      },
      invited: invited.rows.map((r) => ({
        student_number: r.student_number ?? "—",
        status: r.reward_status,
        created_at: r.created_at,
      })),
    });
  } catch (e: any) {
    console.error("[referrals GET] HATA:", e?.message);
    return res.status(500).json({ error: e?.message });
  }
});

export default router;
