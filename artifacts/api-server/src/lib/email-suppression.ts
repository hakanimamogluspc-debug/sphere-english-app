/**
 * Pazarlama e-postası engel listesi — "listeden çıkar" talebinde bulunanlar.
 *
 * Bu listedeki adreslere Pazarlama → E-posta Gönder üzerinden HİÇBİR toplu e-posta gitmez
 * (hangi segment seçilirse seçilsin). Sipariş / indirme / şifre gibi işlem e-postaları etkilenmez.
 *
 * Kaynaklar: admin'in Leads ekranından elle çıkarması + e-postalardaki imzalı "listeden çık" bağlantısı.
 */

import crypto from "node:crypto";
import { pool } from "@workspace/db";

const API_PUBLIC = (process.env.PUBLIC_API_URL || "https://app.sphereenglish.com/api").replace(/\/+$/, "");

function secret(): string {
  return process.env.UNSUBSCRIBE_SECRET || process.env.JWT_SECRET || process.env.INTERNAL_TOKEN || "sphere-unsubscribe";
}

export function marketingUnsubSig(email: string): string {
  return crypto.createHmac("sha256", secret()).update(`mk:${email.toLowerCase()}`).digest("base64url").slice(0, 22);
}

export function verifyMarketingUnsub(email: string, sig: unknown): boolean {
  if (typeof sig !== "string" || sig.length !== 22) return false;
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(marketingUnsubSig(email)));
}

export function marketingUnsubUrl(email: string): string {
  return `${API_PUBLIC}/marketing/unsubscribe?e=${encodeURIComponent(email.toLowerCase())}&s=${marketingUnsubSig(email)}`;
}

export async function suppressedEmails(): Promise<Map<string, { reason: string | null; createdAt: string }>> {
  const r = await pool.query(`SELECT email, reason, created_at FROM email_suppressions`);
  return new Map(r.rows.map((x: any) => [String(x.email).toLowerCase(), { reason: x.reason, createdAt: x.created_at }]));
}

export async function suppress(emails: string[], reason: string, source: "admin" | "link", by?: number | null): Promise<number> {
  const clean = [...new Set(emails.map((e) => String(e).trim().toLowerCase()).filter((e) => e.includes("@")))];
  if (clean.length === 0) return 0;
  const r = await pool.query(
    `INSERT INTO email_suppressions (email, reason, source, created_by)
     SELECT unnest($1::text[]), $2, $3, $4
     ON CONFLICT ((lower(email))) DO NOTHING`,
    [clean, reason.slice(0, 300) || null, source, by ?? null],
  );
  return r.rowCount ?? 0;
}

export async function unsuppress(email: string): Promise<void> {
  await pool.query(`DELETE FROM email_suppressions WHERE lower(email) = $1`, [email.trim().toLowerCase()]);
}

/** Toplu gönderim e-postasının altına eklenen "listeden çık" bölümü */
export function unsubscribeFooterHtml(email: string): string {
  return `<div style="margin-top:28px;padding-top:14px;border-top:1px solid #e2e8f0;font-family:Arial,sans-serif;font-size:12px;color:#94a3b8;text-align:center;line-height:1.6;">
Bu e-postayı Sphere English ile paylaştığın adres üzerinden aldın.<br>
Almak istemiyorsan <a href="${marketingUnsubUrl(email)}" style="color:#64748b;">listeden çık</a>.</div>`;
}
