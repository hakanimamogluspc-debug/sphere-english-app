/**
 * Kitaplarım — e-kitap alıcısını uygulama hesabına bağlama.
 *
 * Kural (KVKK açısından temkinli):
 *  - Satın alma e-postasıyla zaten bir hesap varsa kitaplar o hesaba bağlanır (pre-create zaten yapıyor;
 *    burada geriye dönük olanları da tamamlıyoruz).
 *  - Hesabı yoksa hesap KENDİLİĞİNDEN AÇILMAZ. Satın alma mailinde kişiye özel, imzalı bir
 *    "Kitaplarını uygulamada aç" bağlantısı gider. Kişi bağlantıya tıklayıp şifresini belirler ve
 *    kullanım koşullarını kendisi onaylarsa hesap açılır, kitapları bağlanır.
 *  - İmza, bağlantının o e-posta adresine gönderildiğini (adresin sahibinin tıkladığını) kanıtlar.
 */

import crypto from "node:crypto";
import { pool } from "@workspace/db";

const APP_URL = (process.env.LMS_BASE_URL || process.env.APP_URL || "https://app.sphereenglish.com").replace(/\/+$/, "");

function secret(): string {
  return process.env.EBOOK_LIBRARY_SECRET || process.env.JWT_SECRET || process.env.INTERNAL_TOKEN || "sphere-ebook-library";
}

function hmac(data: string): string {
  return crypto.createHmac("sha256", secret()).update(data).digest("base64url");
}

export function ebookClaimSig(email: string): string {
  return hmac(`ebook-claim:${email.trim().toLowerCase()}`).slice(0, 24);
}

export function verifyEbookClaim(email: unknown, sig: unknown): boolean {
  if (typeof email !== "string" || typeof sig !== "string" || sig.length !== 24) return false;
  const expected = ebookClaimSig(email);
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

/** Satın alma mailindeki "Kitaplarını uygulamada aç" bağlantısı */
export function ebookClaimUrl(email: string): string {
  const e = email.trim().toLowerCase();
  return `${APP_URL}/kitaplarim/etkinlestir?e=${encodeURIComponent(e)}&s=${ebookClaimSig(e)}`;
}

export function libraryUrl(): string {
  return `${APP_URL}/kitaplarim`;
}

/** Bu e-postayla yapılmış, henüz bir hesaba bağlanmamış başarılı satın almaları kullanıcıya bağlar. */
export async function linkEbookPurchases(userId: number, email: string): Promise<number> {
  const r = await pool.query(
    `UPDATE ebook_purchases SET user_id = $1, updated_at = NOW()
     WHERE lower(buyer_email) = $2 AND user_id IS NULL`,
    [userId, email.trim().toLowerCase()],
  );
  return r.rowCount ?? 0;
}

export async function userIdByEmail(email: string): Promise<number | null> {
  const r = await pool.query(`SELECT id FROM users WHERE lower(email) = $1 LIMIT 1`, [email.trim().toLowerCase()]);
  return r.rows[0]?.id ?? null;
}

/**
 * Satın alma mailine eklenecek "uygulamada aç" bölümü.
 * Hesabı varsa: kitaplar zaten bağlanır, bağlantı doğrudan Kitaplarım'a gider.
 * Hesabı yoksa: imzalı etkinleştirme bağlantısı.
 */
export async function libraryMailSection(buyerEmail: string): Promise<string> {
  let hasAccount = false;
  try {
    const uid = await userIdByEmail(buyerEmail);
    if (uid) {
      hasAccount = true;
      await linkEbookPurchases(uid, buyerEmail);
    }
  } catch { /* mail yine gitsin */ }
  const url = hasAccount ? libraryUrl() : ebookClaimUrl(buyerEmail);
  const text = hasAccount
    ? "Kitapların Sphere English hesabındaki <strong>Kitaplarım</strong> bölümüne eklendi. İndirme hakkı derdi olmadan oradan okuyabilirsin."
    : "Kitaplarını ücretsiz Sphere English hesabında da tutabilirsin: indirme hakkı derdi olmadan uygulamadan okursun. Hesap ancak sen bağlantıya tıklayıp şifreni belirlersen açılır.";
  const btn = hasAccount ? "Kitaplarım'a git" : "Kitaplarımı uygulamada aç";
  return `
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#e8eef8;border:1px solid #c7d4ea;border-radius:12px;margin:16px 0;">
              <tr>
                <td style="padding:16px 20px;">
                  <div style="font-size:12px;font-weight:700;color:#1e3a6e;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">📱 Uygulamada oku</div>
                  <div style="font-size:13px;color:#1e3a6e;line-height:1.6;margin-bottom:12px;">${text}</div>
                  <a href="${url}" style="display:inline-block;background:#1e3a6e;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:12px 24px;border-radius:10px;">${btn}</a>
                </td>
              </tr>
            </table>`;
}

/** Okuma bağlantısı için kısa ömürlü imza (mobil kabuk çerez taşımadığı için) */
export function readLinkSig(userId: number, ebookId: number, exp: number): string {
  return hmac(`ebook-read:${userId}:${ebookId}:${exp}`).slice(0, 32);
}

export function verifyReadLink(userId: number, ebookId: number, exp: number, sig: unknown): boolean {
  if (typeof sig !== "string" || sig.length !== 32) return false;
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(readLinkSig(userId, ebookId, exp)));
}

/**
 * Sahiplik koşulu (SQL parçası): kullanıcı kitabı satın almış YA DA admin ona tanımlamış.
 * `userParam` kullanıcı id'sinin parametresi ("$1"), `ebookExpr` kitap id ifadesi ("e.id").
 */
export function ownsSql(userParam: string, ebookExpr: string): string {
  return `(EXISTS (SELECT 1 FROM ebook_purchases op WHERE op.user_id = ${userParam} AND op.ebook_id = ${ebookExpr} AND op.payment_status = 'success')
        OR EXISTS (SELECT 1 FROM ebook_grants og WHERE og.user_id = ${userParam} AND og.ebook_id = ${ebookExpr}))`;
}

/** Kullanıcının kitaplığı: satın aldıkları + admin'in tanımladıkları (tekilleştirilmiş) */
export async function ownedEbooks(userId: number) {
  const r = await pool.query(
    `SELECT e.id, e.slug, e.title, e.subtitle, e.author, e.category, e.cover_image_url, e.page_count, e.practice_published,
            MIN(o.at) AS purchased_at,
            BOOL_AND(o.granted) AS granted_only,
            (SELECT rp.page FROM ebook_reading_positions rp WHERE rp.user_id = $1 AND rp.ebook_id = e.id) AS last_page,
            EXISTS (SELECT 1 FROM ebook_assets a WHERE a.ebook_id = e.id AND a.asset_type = 'full') AS has_file
     FROM (
       SELECT p.ebook_id, p.paid_at AS at, FALSE AS granted FROM ebook_purchases p
        WHERE p.user_id = $1 AND p.payment_status = 'success'
       UNION ALL
       SELECT g.ebook_id, g.created_at AS at, TRUE AS granted FROM ebook_grants g WHERE g.user_id = $1
     ) o
     JOIN ebooks e ON e.id = o.ebook_id
     GROUP BY e.id
     ORDER BY MIN(o.at) DESC NULLS LAST, e.id`,
    [userId],
  );
  return r.rows.map((x: any) => ({
    id: x.id, slug: x.slug, title: x.title, subtitle: x.subtitle, author: x.author, category: x.category,
    coverImageUrl: x.cover_image_url, pageCount: x.page_count, purchasedAt: x.purchased_at, hasFile: x.has_file,
    practiceReady: x.practice_published === true,
    /** true: satın alınmadı, admin tanımladı */
    granted: x.granted_only === true,
    lastPage: x.last_page ?? null,
  }));
}

export async function ownsEbook(userId: number, ebookId: number): Promise<boolean> {
  const r = await pool.query(
    `SELECT ${ownsSql("$1", "$2")} AS owns`,
    [userId, ebookId],
  );
  return r.rows[0]?.owns === true;
}
