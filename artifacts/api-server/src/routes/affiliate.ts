/**
 * Affiliate program — public + authenticated endpoints.
 *
 * PUBLIC:
 *   POST /api/affiliate/track     — Click kaydı (no auth, CORS açık)
 *   POST /api/affiliate/apply     — Başvuru formu (no auth)
 *   GET  /api/affiliate/code/:code — Kod geçerli mi? (no auth, www tarafı için)
 *
 * AUTHENTICATED (kendi affiliate hesabı):
 *   GET  /api/affiliate/me        — Affiliate kaydımı getir
 *   GET  /api/affiliate/me/stats  — Dashboard stats
 *   GET  /api/affiliate/me/commissions  — Komisyon listesi
 *   GET  /api/affiliate/me/payouts      — Ödeme geçmişi
 *   PATCH /api/affiliate/me/bank        — IBAN/TC güncelle
 */

import { Router, Request, Response } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { authMiddleware, type AuthRequest } from "../middlewares/auth.js";
import {
  normalizeCode,
  findActiveAffiliateByCode,
  generateUniqueCode,
  recordClick,
  getAffiliateStats,
} from "../lib/affiliate.js";

const router = Router();

// ─── PUBLIC: Click tracking ─────────────────────────────────────────────
router.post("/affiliate/track", async (req: Request, res: Response) => {
  try {
    const {
      code,
      landingPath,
      referrer,
      utmSource,
      utmMedium,
      utmCampaign,
      visitorId,
    } = (req.body ?? {}) as any;

    if (!code) return res.status(400).json({ error: "code gerekli" });
    const aff = await findActiveAffiliateByCode(String(code));
    if (!aff) return res.status(404).json({ error: "Kod bulunamadı" });

    await recordClick({
      affiliateId: aff.id,
      landingPath: landingPath ?? null,
      referrer: referrer ?? null,
      userAgent: req.headers["user-agent"] as string,
      utm: { source: utmSource, medium: utmMedium, campaign: utmCampaign },
      visitorId: visitorId ?? null,
    });

    return res.json({ ok: true, code: aff.code });
  } catch (e: any) {
    console.error("[affiliate/track] HATA:", e?.message);
    return res.status(500).json({ error: e?.message });
  }
});

// ─── PUBLIC: Kod geçerli mi? ────────────────────────────────────────────
router.get("/affiliate/code/:code", async (req: Request, res: Response) => {
  try {
    const aff = await findActiveAffiliateByCode(req.params.code ?? "");
    if (!aff) return res.status(404).json({ valid: false });
    return res.json({ valid: true, code: aff.code, fullName: aff.full_name });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
});

// ─── PUBLIC: Başvuru ─────────────────────────────────────────────────────
router.post("/affiliate/apply", async (req: Request, res: Response) => {
  try {
    const {
      fullName,
      email,
      phone,
      website,
      socialLinks,
      motivation,
      audienceDescription,
      desiredCode,
      userId,
    } = (req.body ?? {}) as any;

    if (!fullName || !email) {
      return res.status(400).json({ error: "Ad ve e-posta zorunlu" });
    }

    // Aynı e-posta için pending/active varsa engelle
    const existRows = await db.execute(sql`
      SELECT id, status FROM affiliates
      WHERE LOWER(email) = LOWER(${email})
        AND status IN ('pending', 'active')
      LIMIT 1
    `);
    if ((existRows.rows ?? existRows).length > 0) {
      return res.status(409).json({
        error: "Bu e-posta için zaten başvuru var",
        existingStatus: (existRows.rows ?? existRows)[0].status,
      });
    }

    // Kod üret: desiredCode varsa onu dene, yoksa isimden
    const codeBase = desiredCode || fullName.replace(/\s+/g, "");
    const code = await generateUniqueCode(codeBase);

    // userId gelmemişse e-posta ile mevcut kullanıcıyı bul
    let resolvedUserId = userId ?? null;
    if (!resolvedUserId && email) {
      const uRows = await db.execute(sql`
        SELECT id FROM users WHERE LOWER(email) = LOWER(${email}) LIMIT 1
      `);
      resolvedUserId = ((uRows.rows ?? uRows)[0] as any)?.id ?? null;
    }

    const inserted = await db.execute(sql`
      INSERT INTO affiliates (
        user_id, code, status, full_name, email, phone, website,
        social_links, motivation, audience_description
      ) VALUES (
        ${resolvedUserId}, ${code}, 'pending', ${fullName}, ${email}, ${phone ?? null},
        ${website ?? null}, ${socialLinks ?? null}, ${motivation ?? null},
        ${audienceDescription ?? null}
      )
      RETURNING id, code, status, full_name, email
    `);
    const aff = ((inserted.rows ?? inserted)[0] as any);

    console.info(`[affiliate/apply] Yeni başvuru: id=${aff.id} code=${aff.code} email=${aff.email}`);
    return res.json({ ok: true, affiliate: aff });
  } catch (e: any) {
    console.error("[affiliate/apply] HATA:", e?.message);
    return res.status(500).json({ error: e?.message });
  }
});

// ─── AUTH: Affiliate kaydımı getir ──────────────────────────────────────
router.get("/affiliate/me", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: "auth" });

    // Önce user_id ile dene
    let rows = await db.execute(sql`
      SELECT id, code, status, full_name, email, phone, website,
             social_links, motivation, audience_description,
             tc_number, iban, bank_name, account_holder_name,
             approved_at, rejected_at, rejection_reason,
             total_clicks, total_conversions, total_earned_kurus, total_paid_kurus,
             created_at
      FROM affiliates WHERE user_id = ${userId} LIMIT 1
    `);
    let aff = (rows.rows ?? rows)[0] ?? null;

    // Bulamazsa kullanıcının e-postasıyla agresif arama yap
    if (!aff) {
      const uRows = await db.execute(sql`SELECT email FROM users WHERE id = ${userId} LIMIT 1`);
      const userEmail = ((uRows.rows ?? uRows)[0] as any)?.email;
      console.info(`[affiliate/me] user_id=${userId} eşleşme yok, email ile arıyorum: ${userEmail}`);
      if (userEmail) {
        rows = await db.execute(sql`
          SELECT id, code, status, full_name, email, phone, website,
                 social_links, motivation, audience_description,
                 tc_number, iban, bank_name, account_holder_name,
                 approved_at, rejected_at, rejection_reason,
                 total_clicks, total_conversions, total_earned_kurus, total_paid_kurus,
                 created_at
          FROM affiliates
          WHERE LOWER(email) = LOWER(${userEmail})
          ORDER BY
            CASE WHEN status = 'active' THEN 0 WHEN status = 'pending' THEN 1 WHEN status = 'rejected' THEN 3 ELSE 2 END,
            CASE WHEN user_id IS NOT NULL THEN 0 ELSE 1 END,
            created_at DESC
          LIMIT 1
        `);
        aff = (rows.rows ?? rows)[0] ?? null;
        if (aff) {
          console.info(`[affiliate/me] Email match buldu: aff.id=${aff.id} status=${aff.status}, user_id'yi ${userId} olarak bağlıyorum`);
          await db.execute(sql`UPDATE affiliates SET user_id = ${userId} WHERE id = ${aff.id}`);
          // role'u da partner yap
          await db.execute(sql`UPDATE users SET role = 'partner' WHERE id = ${userId} AND role = 'student'`);
        } else {
          console.warn(`[affiliate/me] Email ile de affiliate bulamadım: ${userEmail}`);
        }
      }
    } else {
      console.info(`[affiliate/me] user_id=${userId} direkt eşleşti: aff.id=${aff.id} status=${aff.status}`);
    }
    return res.json({ affiliate: aff });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
});

// ─── AUTH: Stats ────────────────────────────────────────────────────────
router.get("/affiliate/me/stats", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const aRows = await db.execute(sql`
      SELECT id FROM affiliates WHERE user_id = ${userId} AND status = 'active' LIMIT 1
    `);
    const aff = (aRows.rows ?? aRows)[0] as any;
    if (!aff) return res.status(404).json({ error: "Aktif affiliate kaydı yok" });

    const stats = await getAffiliateStats(aff.id);
    return res.json({ stats });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
});

// ─── AUTH: Komisyonlar ──────────────────────────────────────────────────
router.get("/affiliate/me/commissions", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const limit = Math.min(parseInt(String(req.query?.limit ?? "100"), 10) || 100, 500);

    const aRows = await db.execute(sql`
      SELECT id FROM affiliates WHERE user_id = ${userId} LIMIT 1
    `);
    const aff = (aRows.rows ?? aRows)[0] as any;
    if (!aff) return res.json({ commissions: [] });

    const rows = await db.execute(sql`
      SELECT id, source_type, source_id, sale_amount_kurus, commission_rate,
             commission_kurus, billing_cycle, status,
             approved_at, paid_at, refunded_at, created_at
      FROM affiliate_commissions
      WHERE affiliate_id = ${aff.id}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `);
    return res.json({ commissions: rows.rows ?? rows });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
});

// ─── AUTH: Ödeme geçmişi ────────────────────────────────────────────────
router.get("/affiliate/me/payouts", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const aRows = await db.execute(sql`
      SELECT id FROM affiliates WHERE user_id = ${userId} LIMIT 1
    `);
    const aff = (aRows.rows ?? aRows)[0] as any;
    if (!aff) return res.json({ payouts: [] });

    const rows = await db.execute(sql`
      SELECT id, amount_kurus, commission_count, period_start, period_end,
             status, payment_reference, paid_at, notes, created_at
      FROM affiliate_payouts
      WHERE affiliate_id = ${aff.id}
      ORDER BY created_at DESC
      LIMIT 50
    `);
    return res.json({ payouts: rows.rows ?? rows });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
});

// ─── AUTH: IBAN/TC güncelle ─────────────────────────────────────────────
router.patch("/affiliate/me/bank", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const { tcNumber, iban, bankName, accountHolderName } = (req.body ?? {}) as any;

    if (iban && !/^TR\d{24}$/.test(String(iban).replace(/\s/g, "").toUpperCase())) {
      return res.status(400).json({ error: "IBAN formatı geçersiz (TR + 24 rakam)" });
    }
    if (tcNumber && !/^\d{11}$/.test(String(tcNumber))) {
      return res.status(400).json({ error: "TC kimlik 11 rakam olmalı" });
    }

    const normIban = iban ? String(iban).replace(/\s/g, "").toUpperCase() : null;

    // Conditional SET — COALESCE(NULL, col) Postgres'te tip belirleyemiyor
    const sets: any[] = [];
    if (tcNumber) sets.push(sql`tc_number = ${String(tcNumber)}`);
    if (normIban) sets.push(sql`iban = ${normIban}`);
    if (bankName) sets.push(sql`bank_name = ${String(bankName)}`);
    if (accountHolderName) sets.push(sql`account_holder_name = ${String(accountHolderName)}`);
    if (sets.length === 0) return res.status(400).json({ error: "Güncellenecek alan yok" });
    sets.push(sql`updated_at = NOW()`);

    await db.execute(sql`
      UPDATE affiliates SET ${sql.join(sets, sql`, `)}
      WHERE user_id = ${userId}
    `);
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
});

export default router;
