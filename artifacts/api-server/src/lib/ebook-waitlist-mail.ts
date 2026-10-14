/**
 * "Haberdar ol" — kullanıcıya teşekkür / onay maili.
 * Non-blocking: hata fırlatmaz, {ok:false} döner.
 */

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
    <p style="margin:28px 0 0;font-size:13px;color:#94a3b8;line-height:1.6;">Bu maili yanlışlıkla aldıysan görmezden gelebilirsin; listeden çıkmak için bu maile "çıkar" yazıp yanıtlaman yeterli.</p>
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
