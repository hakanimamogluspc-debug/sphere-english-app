/**
 * Hesap kurulum — magic link ile şifre belirleme.
 *
 * Pazarlama sitesinden Iyzico ile abone olunduğunda sistem otomatik bir
 * account_setup_tokens kaydı oluşturur ve kullanıcıya hoşgeldin maili gönderir.
 * Mail'deki butona tıklanınca LMS'in /sifre-belirle sayfasına yönlendirilir.
 *
 * Bu route'lar:
 *   GET  /api/auth/setup-password?token=X  → token geçerli mi? email döndür
 *   POST /api/auth/setup-password          → token + yeni şifre → JWT döndür
 */

import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { generateToken } from "../middlewares/auth.js";

const router = Router();

// ─── Token bilgisi: geçerli mi? hangi email? ─────────────────────────────
router.get("/auth/setup-password", async (req: Request, res: Response) => {
  const token = String(req.query?.token ?? "").trim();
  if (!token) return res.status(400).json({ error: "Token gerekli" });

  try {
    const rows = await db.execute(sql`
      SELECT
        ast.id, ast.user_id, ast.expires_at, ast.used_at, ast.purpose,
        u.email, u.first_name, u.last_name
      FROM account_setup_tokens ast
      JOIN users u ON u.id = ast.user_id
      WHERE ast.token = ${token}
      LIMIT 1
    `);
    const row = (rows.rows ?? rows)[0] as any;
    if (!row) return res.status(404).json({ error: "Bağlantı bulunamadı", code: "token_invalid" });

    if (row.used_at) {
      return res.status(410).json({
        error: "Bu bağlantı daha önce kullanılmış. Eğer şifreni unuttuysan giriş sayfasından 'Şifremi Unuttum' linkini kullan.",
        code: "token_used",
      });
    }
    if (new Date(row.expires_at) < new Date()) {
      return res.status(410).json({
        error: "Bağlantının süresi dolmuş (24 saat). Lütfen destek ile iletişime geç ya da yeniden satın al.",
        code: "token_expired",
      });
    }

    return res.json({
      ok: true,
      email: row.email,
      name: `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() || null,
      purpose: row.purpose,
    });
  } catch (e: any) {
    console.error("[auth/setup-password GET] HATA:", e?.message);
    return res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ─── Şifre belirle + otomatik giriş ──────────────────────────────────────
router.post("/auth/setup-password", async (req: Request, res: Response) => {
  const { token, newPassword } = (req.body ?? {}) as { token?: string; newPassword?: string };
  const tokenStr = String(token ?? "").trim();
  const passwordStr = String(newPassword ?? "");

  if (!tokenStr) return res.status(400).json({ error: "Token gerekli" });
  if (!passwordStr || passwordStr.length < 8) {
    return res.status(400).json({ error: "Şifre en az 8 karakter olmalı" });
  }

  try {
    const rows = await db.execute(sql`
      SELECT
        ast.id AS token_id, ast.user_id, ast.expires_at, ast.used_at,
        u.email, u.role, u.account_type
      FROM account_setup_tokens ast
      JOIN users u ON u.id = ast.user_id
      WHERE ast.token = ${tokenStr}
      LIMIT 1
    `);
    const row = (rows.rows ?? rows)[0] as any;
    if (!row) return res.status(404).json({ error: "Bağlantı bulunamadı", code: "token_invalid" });
    if (row.used_at) {
      return res.status(410).json({ error: "Bu bağlantı daha önce kullanılmış", code: "token_used" });
    }
    if (new Date(row.expires_at) < new Date()) {
      return res.status(410).json({ error: "Bağlantının süresi dolmuş", code: "token_expired" });
    }

    // Şifreyi hashle ve user'a yaz, token'ı kullanılmış olarak işaretle
    const hashed = await bcrypt.hash(passwordStr, 10);
    await db.execute(sql`UPDATE users SET password = ${hashed}, updated_at = NOW() WHERE id = ${row.user_id}`);
    await db.execute(sql`UPDATE account_setup_tokens SET used_at = NOW() WHERE id = ${row.token_id}`);

    // Otomatik giriş — JWT döndür
    const jwt = generateToken(row.user_id, row.role, row.account_type ?? null);
    console.info(`[auth/setup-password] Şifre belirlendi: user=${row.user_id} email=${row.email}`);

    return res.json({
      ok: true,
      token: jwt,
      user: {
        id: row.user_id,
        email: row.email,
        role: row.role,
        accountType: row.account_type,
      },
    });
  } catch (e: any) {
    console.error("[auth/setup-password POST] HATA:", e?.message);
    return res.status(500).json({ error: "Sunucu hatası: " + e?.message });
  }
});

export default router;
