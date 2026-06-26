/**
 * Abonelik satın alma hoşgeldin maili.
 *
 * Pazarlama sitesinden Iyzico ile abone olunduğunda gönderilir.
 * Hesap otomatik oluşur, kullanıcı maildeki magic link ile şifresini belirler.
 */

import { sendEmail } from "./email.js";

export interface WelcomeMailOptions {
  buyerEmail: string;
  buyerName: string | null;
  planLabel: string;
  /** Geçerlilik bitiş tarihi (kullanıcıya gösterim için) */
  planExpiry?: Date | null;
  /** Tutar (ödenen) */
  amount: number;
  currency: string;
  /** Şifre belirleme magic link URL'i */
  setupPasswordUrl: string;
  /** Magic link süresi (saat) — kullanıcıya gösterim */
  setupTtlHours: number;
  /** İlk hesap mı, yoksa mevcut hesap mı (yeni → şifre belirle, mevcut → giriş yap) */
  isNewAccount: boolean;
}

function formatTRY(amount: number | string): string {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export async function sendWelcomeMail(opts: WelcomeMailOptions): Promise<{ ok: boolean; error?: string }> {
  const greeting = opts.buyerName ? `Merhaba ${opts.buyerName},` : "Merhaba,";
  const subject = opts.isNewAccount
    ? `🎉 Sphere English'e Hoşgeldin — ${opts.planLabel}`
    : `✅ Aboneliğin Aktif Edildi — ${opts.planLabel}`;
  const expiryText = opts.planExpiry ? formatDate(opts.planExpiry) : null;

  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f4f6f9;padding:32px 16px;">
  <tr>
    <td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.05);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#0ea5e9 0%,#0284c7 100%);padding:32px 32px 28px;text-align:center;">
            <div style="font-size:26px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;margin-bottom:4px;">Sphere English</div>
            <div style="font-size:13px;color:rgba(255,255,255,0.9);">
              ${opts.isNewAccount ? "Hoşgeldin! 🎉" : "Aboneliğin aktif edildi ✅"}
            </div>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 32px 16px;">
            <h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#1B365D;line-height:1.3;">
              ${greeting}
            </h1>
            <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.6;">
              ${opts.isNewAccount
                ? `Sphere English ailesine katıldığın için teşekkürler. Aboneliğin başarıyla alındı ve <strong>${opts.planLabel}</strong> planın hemen aktif edildi.`
                : `Aboneliğini yeniledin / değiştirdin. Yeni planın aktif: <strong>${opts.planLabel}</strong>.`}
            </p>

            <!-- Plan kutusu -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;margin:20px 0 24px;">
              <tr>
                <td style="padding:18px 20px;">
                  <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Plan Özeti</div>
                  <div style="font-size:18px;font-weight:800;color:#0ea5e9;margin-bottom:6px;">${opts.planLabel}</div>
                  <div style="font-size:14px;color:#1B365D;margin-bottom:6px;">
                    <strong>${formatTRY(opts.amount)}</strong> ödendi
                  </div>
                  ${expiryText ? `<div style="font-size:13px;color:#64748b;">Geçerlilik: <strong>${expiryText}</strong> tarihine kadar</div>` : ""}
                </td>
              </tr>
            </table>

            ${
              opts.isNewAccount
                ? `
            <!-- Şifre belirleme butonu (yeni hesap için) -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:24px 0;">
              <tr>
                <td align="center">
                  <a href="${opts.setupPasswordUrl}" style="display:inline-block;background:#10b981;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:16px 36px;border-radius:12px;box-shadow:0 4px 12px rgba(16,185,129,0.3);">
                    🔐 Şifremi Belirle ve Giriş Yap
                  </a>
                  <div style="margin-top:12px;font-size:11px;color:#94a3b8;">
                    Yukarıdaki buton çalışmıyorsa bağlantıyı kopyala:<br>
                    <a href="${opts.setupPasswordUrl}" style="color:#0ea5e9;word-break:break-all;font-size:10px;">${opts.setupPasswordUrl}</a>
                  </div>
                </td>
              </tr>
            </table>

            <!-- Uyarı (yeni hesap için) -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#fef3c7;border:1px solid #fcd34d;border-radius:12px;margin:16px 0;">
              <tr>
                <td style="padding:14px 18px;">
                  <div style="font-size:12px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">⏰ Önemli</div>
                  <ul style="margin:0;padding-left:18px;font-size:13px;color:#78350f;line-height:1.7;">
                    <li>Bu bağlantı <strong>${opts.setupTtlHours} saat</strong> geçerli</li>
                    <li>Şifreni belirledikten sonra <strong>app.sphereenglish.com</strong> adresinden giriş yapabilirsin</li>
                    <li>E-postan: <strong>${opts.buyerEmail}</strong></li>
                  </ul>
                </td>
              </tr>
            </table>
            `
                : `
            <!-- Giriş butonu (mevcut hesap için) -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:24px 0;">
              <tr>
                <td align="center">
                  <a href="https://app.sphereenglish.com/login" style="display:inline-block;background:#0ea5e9;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:16px 36px;border-radius:12px;box-shadow:0 4px 12px rgba(14,165,233,0.3);">
                    Sphere English'e Giriş Yap
                  </a>
                  <div style="margin-top:12px;font-size:11px;color:#94a3b8;">
                    E-postan: <strong>${opts.buyerEmail}</strong>
                  </div>
                </td>
              </tr>
            </table>
            `
            }

            <!-- Faydalı bağlantılar -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;margin:16px 0;">
              <tr>
                <td style="padding:14px 18px;">
                  <div style="font-size:12px;font-weight:700;color:#1e40af;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">🚀 Başlangıç</div>
                  <ol style="margin:0;padding-left:18px;font-size:13px;color:#1e3a8a;line-height:1.7;">
                    ${opts.isNewAccount ? '<li>Yukarıdaki butona tıklayıp şifreni belirle</li>' : "<li>app.sphereenglish.com'a giriş yap</li>"}
                    <li>Seviye belirleme testini yap (5 dakika sürer)</li>
                    <li>AI Studio'da konuşma + yazma + dilbilgisi koçunla pratiğe başla</li>
                    <li>Haftalık ilerlemeni dashboard'da takip et</li>
                  </ol>
                </td>
              </tr>
            </table>

            <p style="margin:24px 0 0;font-size:14px;color:#475569;line-height:1.6;">
              Sorun yaşarsan, bu mail'i yanıtla — birkaç saat içinde dönüş yapıyoruz.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:24px 32px;border-top:1px solid #e2e8f0;text-align:center;">
            <p style="margin:0 0 8px;font-size:12px;color:#64748b;">
              <strong style="color:#1B365D;">Sphere English</strong> · Kurumsal İş İngilizcesi Eğitimi
            </p>
            <p style="margin:0 0 4px;font-size:11px;color:#94a3b8;">
              <a href="mailto:info@sphereenglish.com" style="color:#0ea5e9;text-decoration:none;">info@sphereenglish.com</a>
              ·
              <a href="https://wa.me/905066085810" style="color:#0ea5e9;text-decoration:none;">WhatsApp</a>
              ·
              <a href="https://www.sphereenglish.com/iletisim" style="color:#0ea5e9;text-decoration:none;">İletişim</a>
            </p>
            <p style="margin:8px 0 0;font-size:10px;color:#cbd5e1;">
              Bu mail aboneliğin için gönderildi. Yanıtla, hemen okuruz.
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  return await sendEmail(opts.buyerEmail, subject, html);
}
