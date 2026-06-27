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
import crypto from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { generateToken } from "../middlewares/auth.js";
import { sendPasswordResetMail } from "../lib/forgot-password-mail.js";

const router = Router();

const RESET_TOKEN_TTL_HOURS = 1;
const RESET_TOKEN_TTL_MS = RESET_TOKEN_TTL_HOURS * 60 * 60 * 1000;
const LMS_BASE_URL = process.env["LMS_BASE_URL"] ?? "https://app.sphereenglish.com";

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

// ─── ŞİFREMİ UNUTTUM: Sıfırlama maili gönder ─────────────────────────────
// Email'e magic link gönderir. Güvenlik: kullanıcı yoksa bile 200 dön —
// email enumeration (saldırgan hangi mail'lerin kayıtlı olduğunu öğrenemez).
router.post("/auth/forgot-password", async (req: Request, res: Response) => {
  const email = String((req.body ?? {})?.email ?? "").trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ error: "Geçerli e-posta gerekli" });
  }

  // Her zaman 200 dön — saldırgan email enumeration yapamasın
  const genericResponse = {
    ok: true,
    message: "Eğer bu e-posta sistemimizde kayıtlıysa, şifre sıfırlama bağlantısı gönderildi. Mail kutunu (ve spam) kontrol et.",
  };

  try {
    const userRows = await db.execute(sql`
      SELECT id, email, first_name, last_name FROM users WHERE LOWER(email) = ${email} LIMIT 1
    `);
    const user = (userRows.rows ?? userRows)[0] as any;

    if (!user) {
      // Kullanıcı yok — sessizce başarılı dön
      console.info(`[auth/forgot-password] email kayıtlı değil: ${email}`);
      return res.json(genericResponse);
    }

    // Token üret + DB'ye yaz (purpose='reset', 1 saat geçerli)
    const token = crypto.randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString();
    await db.execute(sql`
      INSERT INTO account_setup_tokens (user_id, token, purpose, expires_at)
      VALUES (${user.id}, ${token}, 'reset', ${expiresAt})
    `);

    const resetUrl = `${LMS_BASE_URL.replace(/\/$/, "")}/sifre-belirle?token=${encodeURIComponent(token)}`;
    const buyerName = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() || null;

    // Fire-and-forget — mail başarısız olsa da 200 dön (kullanıcı tarafında belirleme)
    sendPasswordResetMail({
      buyerEmail: user.email,
      buyerName,
      resetUrl,
      ttlHours: RESET_TOKEN_TTL_HOURS,
    })
      .then((result) => {
        if (!result.ok) {
          console.error(`[auth/forgot-password] mail başarısız: ${result.error}`);
        } else {
          console.info(`[auth/forgot-password] mail gönderildi: ${user.email}`);
        }
      })
      .catch((err) => {
        console.error("[auth/forgot-password] mail HATA:", err?.message);
      });

    return res.json(genericResponse);
  } catch (e: any) {
    console.error("[auth/forgot-password] HATA:", e?.message);
    // Hatayı bile gizle — kullanıcıya generic mesaj
    return res.json(genericResponse);
  }
});

export default router;
