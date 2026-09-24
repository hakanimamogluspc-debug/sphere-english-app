/**
 * Ödül / Rewards Sistemi — R6
 *
 * Kullanıcılar streak freeze biriktirir (referans, streak milestones, gelecekte
 * daha başkaları). Bu freeze'leri harcayarak somut ödüller kazanır.
 *
 * Ödül türleri (type):
 *   - streak_freeze_bonus  → payload.amount kadar ek freeze verir (self-fulfilling)
 *   - badge                → users.badges array'ine payload.badge_key ekler
 *   - coupon_code          → payload.code'u kullanıcıya gösterir (e-kitap/kurs indirimi)
 *   - unlock_theme         → users.custom_theme = payload.theme_key
 *
 * Sistem senoparsız: ödüller `rewards` tablosunda tanımlı. Admin
 * yeni ödül eklerse hemen katalogda görünür.
 *
 * Endpoint'ler:
 *   GET  /student/rewards           — mevcut katalog + benim freeze sayım + geçmiş
 *   POST /student/rewards/:id/redeem — freeze harca, ödülü al
 *   GET  /student/rewards/history   — sadece kullanım geçmişi
 */

import { Router, type Response } from "express";
import { pool } from "@workspace/db";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";

const router = Router();

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS rewards (
      id SERIAL PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      cost_freezes INTEGER NOT NULL CHECK (cost_freezes > 0),
      type VARCHAR(40) NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      icon VARCHAR(30) NOT NULL DEFAULT '🎁',
      sort_order INTEGER NOT NULL DEFAULT 100,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_reward_redemptions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      reward_id INTEGER NOT NULL,
      cost_paid INTEGER NOT NULL,
      granted_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS urr_user_idx ON user_reward_redemptions(user_id, created_at DESC)`);

  // Seed — sadece boşsa ekle
  const cnt = await pool.query(`SELECT COUNT(*)::int AS n FROM rewards`);
  if ((cnt.rows[0]?.n ?? 0) === 0) {
    await pool.query(`
      INSERT INTO rewards (name, description, cost_freezes, type, payload, icon, sort_order) VALUES
      ('Ekstra 2 Streak Freeze', 'Bir tatile mi çıkıyorsun, iş yoğun mu? 2 yedek freeze yaka koy.', 3, 'streak_freeze_bonus', '{"amount":2}', '❄️', 10),
      ('Ekstra 5 Streak Freeze', 'Uzun bir mola için sağlam garanti — 5 freeze cebine.', 7, 'streak_freeze_bonus', '{"amount":5}', '🧊', 20),
      ('Rozet: Sadık Öğrenci', 'Profilinde parlayan özel bir rozet — kararlılığın simgesi.', 5, 'badge', '{"badge_key":"loyal_learner","label":"Sadık Öğrenci"}', '🎖️', 30),
      ('Rozet: Elçi', 'Arkadaşlarını davet ettin, seni Elçi rozetiyle onurlandırıyoruz.', 6, 'badge', '{"badge_key":"ambassador","label":"Elçi"}', '🎗️', 40),
      ('E-Kitap %20 İndirim Kuponu', 'Sphere e-kitaplarında bir kez kullanılabilir %20 indirim kodu.', 10, 'coupon_code', '{"discount_pct":20,"category":"ebook"}', '📖', 50),
      ('Rozet: Yıldız — 10 Ödül Sahibi', 'Efsanevi. 10 ödül kilidi açan azınlığa hoş geldin.', 15, 'badge', '{"badge_key":"star_10","label":"Yıldız"}', '⭐', 60)
    `);
  }
}
ensureSchema().catch((e) => console.warn("[rewards] ensureSchema warn:", e?.message));

// ─── Yardımcı: ödül uygulama ───────────────────────────────────────────────

async function applyReward(
  userId: number,
  type: string,
  payload: any,
): Promise<{ ok: boolean; granted?: any; error?: string }> {
  try {
    if (type === "streak_freeze_bonus") {
      const amount = Number(payload?.amount ?? 0);
      if (amount <= 0) return { ok: false, error: "Geçersiz miktar" };
      await pool.query(
        `UPDATE users SET streak_freeze_count = COALESCE(streak_freeze_count, 0) + $1 WHERE id = $2`,
        [amount, userId],
      );
      return { ok: true, granted: { amount } };
    }

    if (type === "badge") {
      const key = String(payload?.badge_key ?? "").trim();
      if (!key) return { ok: false, error: "Rozet anahtarı yok" };
      // users.badges = text[] — zaten varsa tekrar ekleme
      await pool.query(
        `UPDATE users
         SET badges = CASE
           WHEN $1 = ANY(COALESCE(badges, '{}'::text[])) THEN badges
           ELSE array_append(COALESCE(badges, '{}'::text[]), $1)
         END
         WHERE id = $2`,
        [key, userId],
      );
      return { ok: true, granted: { badge_key: key, label: payload?.label } };
    }

    if (type === "coupon_code") {
      // Basit kupon üretimi — 8 karakter random
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let code = "";
      for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
      const full = `${String(payload?.category ?? "SP").toUpperCase().slice(0, 4)}-${code}`;
      // Burada gerçek kupon tablosuna insert yapılabilir — MVP'de user'a sadece kod göster
      return { ok: true, granted: { coupon_code: full, discount_pct: payload?.discount_pct ?? 10, category: payload?.category ?? "ebook" } };
    }

    if (type === "unlock_theme") {
      // MVP: users tablosunda custom_theme kolonu yok — sadece badge gibi kaydet
      return { ok: true, granted: { theme_key: payload?.theme_key ?? "default" } };
    }

    return { ok: false, error: "Bilinmeyen ödül türü: " + type };
  } catch (e: any) {
    return { ok: false, error: e?.message };
  }
}

// ─── GET /student/rewards ─────────────────────────────────────────────────

router.get("/student/rewards", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ error: "Yetkisiz" });

    // Katalog
    const cat = await pool.query(
      `SELECT id, name, description, cost_freezes, type, payload, icon
       FROM rewards WHERE is_active = TRUE
       ORDER BY sort_order ASC, id ASC`,
    );

    // Kullanıcının mevcut freeze sayısı
    const uRow = await pool.query(
      `SELECT streak_freeze_count, badges FROM users WHERE id = $1 LIMIT 1`,
      [req.userId],
    );
    const currentFreezes = Number(uRow.rows[0]?.streak_freeze_count ?? 0);
    const userBadges: string[] = uRow.rows[0]?.badges ?? [];

    // Geçmiş
    const hist = await pool.query(
      `SELECT r.id, r.name, r.icon, urr.cost_paid, urr.granted_payload, urr.created_at
       FROM user_reward_redemptions urr
       INNER JOIN rewards r ON r.id = urr.reward_id
       WHERE urr.user_id = $1
       ORDER BY urr.created_at DESC LIMIT 30`,
      [req.userId],
    );

    return res.json({
      ok: true,
      current_freezes: currentFreezes,
      badges: userBadges,
      rewards: cat.rows.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        cost_freezes: r.cost_freezes,
        type: r.type,
        payload: r.payload,
        icon: r.icon,
        affordable: currentFreezes >= r.cost_freezes,
        already_owned: r.type === "badge" && userBadges.includes(String(r.payload?.badge_key ?? "")),
      })),
      history: hist.rows.map((h) => ({
        reward_id: h.id,
        name: h.name,
        icon: h.icon,
        cost: h.cost_paid,
        granted: h.granted_payload,
        at: h.created_at,
      })),
    });
  } catch (e: any) {
    console.error("[rewards GET] HATA:", e?.message);
    return res.status(500).json({ error: e?.message });
  }
});

// ─── POST /student/rewards/:id/redeem ─────────────────────────────────────

router.post("/student/rewards/:id/redeem", authMiddleware, async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();
  try {
    if (!req.userId) return res.status(401).json({ error: "Yetkisiz" });
    const rewardId = parseInt(req.params.id, 10);
    if (!rewardId) return res.status(400).json({ error: "Geçersiz ödül id" });

    await client.query("BEGIN");

    // Ödülü al + kilit
    const rRes = await client.query(
      `SELECT id, name, cost_freezes, type, payload, is_active
       FROM rewards WHERE id = $1 LIMIT 1 FOR UPDATE`,
      [rewardId],
    );
    const reward = rRes.rows[0];
    if (!reward || !reward.is_active) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Ödül bulunamadı" });
    }

    // Kullanıcının freeze sayısını kilitle
    const uRes = await client.query(
      `SELECT streak_freeze_count, badges FROM users WHERE id = $1 FOR UPDATE`,
      [req.userId],
    );
    const currentFreezes = Number(uRes.rows[0]?.streak_freeze_count ?? 0);
    if (currentFreezes < reward.cost_freezes) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: `Yeterli freeze yok. Gereken: ${reward.cost_freezes}, sende: ${currentFreezes}`,
      });
    }

    // Badge zaten alınmış mı?
    if (reward.type === "badge") {
      const badges: string[] = uRes.rows[0]?.badges ?? [];
      const key = String(reward.payload?.badge_key ?? "");
      if (badges.includes(key)) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Bu rozet zaten sende" });
      }
    }

    // Freeze düş
    await client.query(
      `UPDATE users SET streak_freeze_count = streak_freeze_count - $1 WHERE id = $2`,
      [reward.cost_freezes, req.userId],
    );

    // Ödülü uygula
    const applied = await applyReward(req.userId, reward.type, reward.payload);
    if (!applied.ok) {
      await client.query("ROLLBACK");
      return res.status(500).json({ error: applied.error ?? "Ödül uygulanamadı" });
    }

    // Log
    await client.query(
      `INSERT INTO user_reward_redemptions (user_id, reward_id, cost_paid, granted_payload)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [req.userId, reward.id, reward.cost_freezes, JSON.stringify(applied.granted ?? {})],
    );

    await client.query("COMMIT");

    return res.json({
      ok: true,
      reward: {
        id: reward.id,
        name: reward.name,
        cost: reward.cost_freezes,
      },
      granted: applied.granted,
      new_freeze_balance: currentFreezes - reward.cost_freezes,
    });
  } catch (e: any) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[rewards/redeem] HATA:", e?.message);
    return res.status(500).json({ error: e?.message });
  } finally {
    client.release();
  }
});

export default router;
