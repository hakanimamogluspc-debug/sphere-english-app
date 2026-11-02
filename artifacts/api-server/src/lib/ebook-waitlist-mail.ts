/**
 * "Haberdar ol" — kullanıcıya teşekkür / onay maili.
 * Non-blocking: hata fırlatmaz, {ok:false} döner.
 */

import crypto from "node:crypto";
import { sendEmail } from "./email.js";

const WWW = process.env.WWW_URL ?? "https://www.sphereenglish.com";

export async function sendEbookWaitlistConfirmation(opts: {
  email: string;
  interestLabel?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const subject = "Kaydın alındı — yeni iş İngilizcesi kitapları çıkınca haber vereceğiz";
  const interestLine = opts.interestLabel
    ? `<p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.6;">Seçtiğin alan: <strong style="color:#1B365D">${opts.interestLabel}</strong>. Bu alanda yeni bir kitap ya da seri yayınlandığında ilk sen öğreneceksin.</p>`
    : `<p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.6;">Yeni bir kitap ya da seri yayınlandığında ilk sen öğreneceksin.</p>`;

  const html = `<!DOCTYPE html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f4f6f9;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.05);">
  <tr><td style="background:linear-gradient(135deg,#1B365D 0%,#0ea5e9 100%);padding:32px;text-align:center;">
    <div style="font-size:26px;font-weight:800;color:#fff;letter-spacing:-.5px;margin-bottom:4px;">Sphere English</div>
    <div style="font-size:13px;color:rgba(255,255,255,.85);">E-Kitap bekleme listesi</div>
  </td></tr>
  <tr><td style="padding:32px 32px 16px;">
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#1B365D;line-height:1.3;">Teşekkürler, kaydın alındı ✅</h1>
    ${interestLine}
    <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6;">Bu arada mevcut kitaplara göz atabilirsin — her kitabın 5 sayfalık ücretsiz önizlemesi var.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td align="center">
      <a href="${WWW}/e-kitaplar" style="display:inline-block;background:#0ea5e9;color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:12px;">Kitapları incele</a>
    </td></tr></table>
    <p style="margin:28px 0 0;font-size:13px;color:#94a3b8;line-height:1.6;">Bu maili yanlışlıkla aldıysan görmezden gelebilirsin; <a href="${waitlistUnsubUrl(opts.email)}" style="color:#94a3b8;">listeden çıkmak için buraya tıkla</a>.</p>
  </td></tr>
  <tr><td style="padding:16px 32px 28px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;text-align:center;">Sphere English · info@sphereenglish.com</td></tr>
</table>
</td></tr></table>
</body></html>`;

  try {
    return await sendEmail(opts.email, subject, html);
  } catch (e: any) {
    console.error("[ebook-waitlist-mail] HATA:", e?.message);
    return { ok: false, error: e?.message ?? "send failed" };
  }
}

// ─── Yeni kitap duyurusu ─────────────────────────────────────────────────


const API_PUBLIC = (process.env.PUBLIC_API_URL || "https://app.sphereenglish.com/api").replace(/\/+$/, "");

function unsubSecret(): string {
  return process.env.UNSUBSCRIBE_SECRET || process.env.JWT_SECRET || process.env.INTERNAL_TOKEN || "sphere-unsubscribe";
}

/** Bekleme listesinden çıkış bağlantısının imzası (e-posta adresine bağlı; adres değiştirilerek başkası çıkarılamaz). */
export function waitlistUnsubSignature(email: string): string {
  return crypto.createHmac("sha256", unsubSecret()).update(`ewl:${email.toLowerCase()}`).digest("base64url").slice(0, 22);
}

export function verifyWaitlistUnsub(email: string, sig: unknown): boolean {
  if (typeof sig !== "string" || sig.length !== 22) return false;
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(waitlistUnsubSignature(email)));
}

export function waitlistUnsubUrl(email: string): string {
  return `${API_PUBLIC}/ebook-marketing/waitlist/unsubscribe?e=${encodeURIComponent(email.toLowerCase())}&s=${waitlistUnsubSignature(email)}`;
}

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

export interface AnnouncementEbook {
  title: string;
  subtitle: string | null;
  description: string | null;
  slug: string;
  coverImageUrl: string | null;
  priceTry: number | null;
}

export function renderEbookAnnouncement(ebook: AnnouncementEbook, email: string, intro?: string | null): { subject: string; html: string } {
  const subject = `Yeni kitap çıktı: ${ebook.title}`;
  const url = `${WWW}/e-kitaplar/${encodeURIComponent(ebook.slug)}?utm_source=waitlist&utm_medium=email&utm_campaign=yeni-kitap`;
  const price = ebook.priceTry
    ? new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(ebook.priceTry)
    : null;
  const introText = intro?.trim()
    || "Haberdar olmak için kaydolduğun e-kitap kütüphanemize yeni bir kitap eklendi.";
  const desc = (ebook.description ?? "").trim();
  const shortDesc = desc.length > 420 ? `${desc.slice(0, 417).trimEnd()}…` : desc;
  const html = `<!DOCTYPE html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f4f6f9;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.05);">
  <tr><td style="background:#1e3a6e;padding:28px 32px;">
    <div style="font-size:22px;font-weight:800;color:#fff;letter-spacing:-.3px;">Sphere English</div>
    <div style="font-size:13px;color:#4dcfff;margin-top:2px;">E-kitap kütüphanesi · yeni kitap</div>
  </td></tr>
  <tr><td style="padding:28px 32px 8px;">
    <p style="margin:0 0 18px;font-size:15px;color:#475569;line-height:1.6;">Merhaba,<br>${esc(introText)}</p>
    ${ebook.coverImageUrl ? `<div style="text-align:center;margin:0 0 18px;"><a href="${url}"><img src="${esc(ebook.coverImageUrl)}" alt="${esc(ebook.title)}" width="220" style="max-width:220px;width:100%;border-radius:10px;border:1px solid #e2e8f0;"></a></div>` : ""}
    <h1 style="margin:0 0 6px;font-size:22px;font-weight:800;color:#1e3a6e;line-height:1.3;">${esc(ebook.title)}</h1>
    ${ebook.subtitle ? `<p style="margin:0 0 12px;font-size:14px;color:#64748b;">${esc(ebook.subtitle)}</p>` : ""}
    ${shortDesc ? `<p style="margin:0 0 18px;font-size:15px;color:#334155;line-height:1.65;">${esc(shortDesc)}</p>` : ""}
    ${price ? `<p style="margin:0 0 18px;font-size:15px;color:#1e3a6e;"><strong>${esc(price)}</strong> · PDF, ödemeden hemen sonra e-postanda</p>` : ""}
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td align="center" style="padding:4px 0 8px;">
      <a href="${url}" style="display:inline-block;background:#1e3a6e;color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:12px;">Kitabı incele</a>
    </td></tr></table>
    <p style="margin:14px 0 0;font-size:13px;color:#64748b;line-height:1.6;text-align:center;">Kitap sayfasında ücretsiz önizlemeye de göz atabilirsin.</p>
  </td></tr>
  <tr><td style="padding:20px 32px 26px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;text-align:center;line-height:1.6;">
    Bu e-postayı www.sphereenglish.com/e-kitaplar sayfasında "haberdar ol" listesine kaydolduğun için aldın.<br>
    <a href="${waitlistUnsubUrl(email)}" style="color:#64748b;">Listeden çık</a> · Sphere English · info@sphereenglish.com
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
  return { subject, html };
}

export async function sendEbookAnnouncement(ebook: AnnouncementEbook, email: string, intro?: string | null): Promise<{ ok: boolean; error?: string }> {
  const { subject, html } = renderEbookAnnouncement(ebook, email, intro);
  try {
    return await sendEmail(email, subject, html);
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "send failed" };
  }
}
