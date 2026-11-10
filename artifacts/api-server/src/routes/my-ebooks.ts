/**
 * Kitaplarım — e-kitap alıcısının uygulamadaki kitaplığı.
 *
 * Public (imzalı bağlantıyla):
 *   GET  /api/ebook-library/claim?e=&s=      → bağlantı geçerli mi, hesabı var mı, hangi kitaplar
 *   POST /api/ebook-library/activate         → hesabı yoksa: ad/soyad/şifre + koşul onayı → hesap açılır, kitaplar bağlanır
 * Oturumlu:
 *   POST /api/me/ebooks/claim                → (hesabı olan) imzalı bağlantıyla başka e-postadaki alımları da bağlar
 *   GET  /api/me/ebooks                      → sahip olunan kitaplar
 *   POST /api/me/ebooks/:id/read-link        → 10 dk geçerli okuma bağlantısı
 * Public (imzalı, kısa ömürlü):
 *   GET  /api/me/ebooks/:id/file?u=&x=&s=    → PDF'i tarayıcıda aç (indirme hakkından düşmez)
 */

import { Router, type Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { pool, db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authMiddleware, generateToken, type AuthRequest } from "../middlewares/auth.js";
import { schemas } from "../middlewares/validate.js";
import {
  verifyEbookClaim, linkEbookPurchases, userIdByEmail, ownedEbooks, ownsEbook,
  readLinkSig, verifyReadLink,
} from "../lib/ebook-library.js";
import { getObjectStream } from "../lib/object-storage.js";
import { TERMS_VERSION } from "./auth.js";

const router = Router();

async function purchasedTitles(email: string): Promise<string[]> {
  const r = await pool.query(
    `SELECT DISTINCT e.title FROM ebook_purchases p JOIN ebooks e ON e.id = p.ebook_id
     WHERE lower(p.buyer_email) = $1 AND p.payment_status = 'success' ORDER BY e.title`,
    [email],
  );
  return r.rows.map((x: any) => x.title);
}

router.get("/ebook-library/claim", async (req, res) => {
  const e = String(req.query.e ?? "").trim().toLowerCase();
  if (!verifyEbookClaim(e, req.query.s)) return res.status(400).json({ error: "Bağlantı geçersiz", code: "invalid" });
  try {
    const [titles, uid] = await Promise.all([purchasedTitles(e), userIdByEmail(e)]);
    if (uid) await linkEbookPurchases(uid, e); // hesabı varsa zaten bağla; giriş yapınca görecek
    return res.json({ ok: true, email: e, hasAccount: !!uid, books: titles });
  } catch (err: any) {
    console.error("[ebook-library/claim]", err?.message);
    return res.status(500).json({ error: "Sunucu hatası" });
  }
});

const activateSchema = z.object({
  e: z.string(),
  s: z.string(),
  firstName: z.string().trim().min(1, "Ad gerekli").max(100),
  lastName: z.string().trim().min(1, "Soyad gerekli").max(100),
  password: schemas.password,
  termsAccepted: z.literal(true, { errorMap: () => ({ message: "Devam etmek için Kullanım Koşulları ve Gizlilik Politikası'nı kabul etmelisin." }) }),
});

router.post("/ebook-library/activate", async (req, res: Response) => {
  const parsed = activateSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Geçersiz bilgi" });
  const { s, firstName, lastName, password } = parsed.data;
  const email = parsed.data.e.trim().toLowerCase();
  if (!verifyEbookClaim(email, s)) return res.status(400).json({ error: "Bağlantı geçersiz", code: "invalid" });

  try {
    if (await userIdByEmail(email)) {
      return res.status(409).json({ error: "Bu e-postayla zaten bir hesabın var. Giriş yap; kitapların Kitaplarım bölümünde.", code: "has_account" });
    }
    const hashed = await bcrypt.hash(password, 10);
    const [user] = await db.insert(usersTable).values({
      email, password: hashed, firstName, lastName,
      role: "student", companyId: null, accountType: "bireysel",
      termsAcceptedAt: new Date(), termsVersion: TERMS_VERSION,
    } as any).returning();
    const studentNumber = `SE-${new Date(user.createdAt).getFullYear()}-${String(user.id).padStart(4, "0")}`;
    await db.update(usersTable).set({ studentNumber } as any).where(eq(usersTable.id, user.id));
    const linked = await linkEbookPurchases(user.id, email);

    const token = generateToken(user.id, user.role, "bireysel");
    res.cookie("sphere_token", token, {
      httpOnly: true, sameSite: "lax", maxAge: 30 * 24 * 60 * 60 * 1000,
      secure: process.env.NODE_ENV === "production",
    });
    console.info(`[ebook-library] hesap açıldı user=${user.id}, ${linked} kitap bağlandı`);
    const { password: _p, ...safe } = user as any;
    return res.status(201).json({ ok: true, token, user: { ...safe, studentNumber, company: null }, linked });
  } catch (err: any) {
    console.error("[ebook-library/activate]", err?.message);
    return res.status(500).json({ error: "Hesap şu an açılamadı, birazdan tekrar dene." });
  }
});

router.post("/me/ebooks/claim", authMiddleware, async (req: AuthRequest, res) => {
  const e = String(req.body?.e ?? "").trim().toLowerCase();
  if (!verifyEbookClaim(e, req.body?.s)) return res.status(400).json({ error: "Bağlantı geçersiz" });
  const linked = await linkEbookPurchases(req.userId!, e);
  return res.json({ ok: true, linked });
});

router.get("/me/ebooks", authMiddleware, async (req: AuthRequest, res) => {
  try {
    // Hesap e-postasıyla yapılmış ama bağlanmamış alımlar varsa (ör. kayıt sonrası alım) bağla
    const u = await pool.query(`SELECT email FROM users WHERE id = $1`, [req.userId]);
    if (u.rows[0]?.email) await linkEbookPurchases(req.userId!, u.rows[0].email);
    return res.json({ ebooks: await ownedEbooks(req.userId!) });
  } catch (err: any) {
    console.error("[me/ebooks]", err?.message);
    return res.status(500).json({ error: "Kitaplar yüklenemedi" });
  }
});

router.post("/me/ebooks/:id/read-link", authMiddleware, async (req: AuthRequest, res) => {
  const ebookId = Number(req.params.id);
  if (!Number.isInteger(ebookId) || !(await ownsEbook(req.userId!, ebookId))) {
    return res.status(404).json({ error: "Bu kitap kitaplığında yok" });
  }
  const exp = Math.floor(Date.now() / 1000) + 600;
  // API kökünden göreli yol — istemci kendi API adresinin önüne ekler (web: /api, mobil: tam adres)
  const path = `/me/ebooks/${ebookId}/file?u=${req.userId}&x=${exp}&s=${readLinkSig(req.userId!, ebookId, exp)}`;
  return res.json({ path, expiresAt: new Date(exp * 1000).toISOString() });
});

// Uygulama içi okuyucu — kaldığı sayfa
router.get("/me/ebooks/:id/position", authMiddleware, async (req: AuthRequest, res) => {
  const ebookId = Number(req.params.id);
  if (!Number.isInteger(ebookId) || !(await ownsEbook(req.userId!, ebookId))) return res.status(404).json({ error: "Bu kitap kitaplığında yok" });
  const r = await pool.query(`SELECT page, page_count FROM ebook_reading_positions WHERE user_id = $1 AND ebook_id = $2`, [req.userId, ebookId]);
  const title = (await pool.query(`SELECT title FROM ebooks WHERE id = $1`, [ebookId])).rows[0]?.title ?? "";
  return res.json({ title, page: r.rows[0]?.page ?? 1, pageCount: r.rows[0]?.page_count ?? null });
});

router.put("/me/ebooks/:id/position", authMiddleware, async (req: AuthRequest, res) => {
  const ebookId = Number(req.params.id);
  const page = Number(req.body?.page);
  const pageCount = Number(req.body?.pageCount);
  if (!Number.isInteger(page) || page < 1 || page > 5000) return res.status(400).json({ error: "Geçersiz sayfa" });
  if (!Number.isInteger(ebookId) || !(await ownsEbook(req.userId!, ebookId))) return res.status(404).json({ error: "Bu kitap kitaplığında yok" });
  await pool.query(
    `INSERT INTO ebook_reading_positions (user_id, ebook_id, page, page_count, updated_at) VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (user_id, ebook_id) DO UPDATE SET page = $3, page_count = COALESCE($4, ebook_reading_positions.page_count), updated_at = NOW()`,
    [req.userId, ebookId, page, Number.isInteger(pageCount) && pageCount > 0 ? pageCount : null],
  );
  return res.json({ ok: true });
});

router.get("/me/ebooks/:id/file", async (req, res) => {
  const ebookId = Number(req.params.id);
  const userId = Number(req.query.u);
  const exp = Number(req.query.x);
  if (!Number.isInteger(ebookId) || !Number.isInteger(userId) || !verifyReadLink(userId, ebookId, exp, req.query.s)) {
    return res.status(403).send("Bağlantının süresi dolmuş. Kitaplarım sayfasından kitabı yeniden aç.");
  }
  try {
    if (!(await ownsEbook(userId, ebookId))) return res.status(404).send("Kitap bulunamadı");
    const a = (await pool.query(
      `SELECT filename, mime_type, size_bytes, data_base64, storage_key FROM ebook_assets
       WHERE ebook_id = $1 AND asset_type = 'full' LIMIT 1`, [ebookId],
    )).rows[0];
    if (!a) return res.status(404).send("Kitap dosyası henüz yüklenmemiş");

    const safeName = String(a.filename).replace(/[^a-zA-Z0-9._-]/g, "_");
    res.setHeader("Content-Type", a.mime_type || "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${safeName}"`);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Robots-Tag", "noindex");
    if (a.storage_key) {
      const { stream, contentLength } = await getObjectStream(a.storage_key);
      if (contentLength) res.setHeader("Content-Length", String(contentLength));
      stream.on("error", () => res.destroy());
      return stream.pipe(res);
    }
    const buf = Buffer.from(a.data_base64 ?? "", "base64");
    res.setHeader("Content-Length", String(buf.length));
    return res.send(buf);
  } catch (err: any) {
    console.error("[me/ebooks/file]", err?.message);
    if (!res.headersSent) return res.status(500).send("Kitap şu an açılamadı");
    return;
  }
});

export default router;
