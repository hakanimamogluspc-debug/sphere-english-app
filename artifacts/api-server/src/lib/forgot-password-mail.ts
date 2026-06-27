/**
 * Şifre sıfırlama maili.
 *
 * Kullanıcı /sifremi-unuttum sayfasında email girip submit eder.
 * Backend bu mail'i gönderir — mevcut /sifre-belirle?token=X sayfasına götüren
 * linki içerir.
 */

import { sendEmail } from "./email.js";

export interface ResetMailOptions {
  buyerEmail: string;
  buyerName: string | null;
  /** /sifre-belirle?token=X formatında tam URL */
  resetUrl: string;
  /** Geçerlilik süresi (saat) — kullanıcıya gösterim */
  ttlHours: number;
}

export async function sendPasswordResetMail(opts: ResetMailOptions): Promise<{ ok: boolean; error?: string }> {
  const greeting = opts.buyerName ? `Merhaba ${opts.buyerName},` : "Merhaba,";
  const subject = "🔑 Sphere English — Şifre Sıfırlama Talebi";

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
          <td style="background:linear-gradient(135deg,#0ea5e9 0%,#0284c7 100%);padding:28px 32px;text-align:center;">
            <div style="font-size:24px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;margin-bottom:4px;">Sphere English</div>
            <div style="font-size:13px;color:rgba(255,255,255,0.9);">Şifre Sıfırlama</div>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 32px 16px;">
            <h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#1B365D;line-height:1.3;">
              ${greeting}
            </h1>
            <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.6;">
              Sphere English hesabın için <strong>şifre sıfırlama talebi</strong> aldık.
              Aşağıdaki butona tıklayarak yeni bir şifre belirleyebilirsin.
            </p>

            <!-- Buton -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:24px 0;">
              <tr>
                <td align="center">
                  <a href="${opts.resetUrl}" style="display:inline-block;background:#0ea5e9;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:16px 36px;border-radius:12px;box-shadow:0 4px 12px rgba(14,165,233,0.3);">
                    🔐 Yeni Şifre Belirle
                  </a>
                  <div style="margin-top:12px;font-size:11px;color:#94a3b8;">
                    Yukarıdaki buton çalışmıyorsa bağlantıyı kopyala:<br>
                    <a href="${opts.resetUrl}" style="color:#0ea5e9;word-break:break-all;font-size:10px;">${opts.resetUrl}</a>
                  </div>
                </td>
              </tr>
            </table>

            <!-- Süre uyarısı -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#fef3c7;border:1px solid #fcd34d;border-radius:12px;margin:16px 0;">
              <tr>
                <td style="padding:14px 18px;">
                  <div style="font-size:12px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">⏰ Önemli</div>
                  <ul style="margin:0;padding-left:18px;font-size:13px;color:#78350f;line-height:1.7;">
                    <li>Bu bağlantı <strong>${opts.ttlHours} saat</strong> geçerlidir</li>
                    <li>Bağlantı tek kullanımlıktır</li>
                    <li>Bağlantıyı kimseyle paylaşma</li>
                  </ul>
                </td>
              </tr>
            </table>

            <!-- Güvenlik notu -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f1f5f9;border:1px solid #cbd5e1;border-radius:12px;margin:16px 0;">
              <tr>
                <td style="padding:14px 18px;">
                  <div style="font-size:12px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">🛡️ Güvenlik</div>
                  <p style="margin:0;font-size:12px;color:#475569;line-height:1.6;">
                    Bu talebi <strong>sen yapmadıysan</strong> bu maili güvenle yok sayabilirsin —
                    şifren değiştirilmedi ve hesabın güvende. Şüphelendiğin bir aktivite varsa
                    bizimle iletişime geç.
                  </p>
                </td>
              </tr>
            </table>

            <p style="margin:24px 0 0;font-size:13px;color:#94a3b8;line-height:1.6;">
              E-postan: <strong>${opts.buyerEmail}</strong>
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
            </p>
            <p style="margin:8px 0 0;font-size:10px;color:#cbd5e1;">
              Bu mail şifre sıfırlama talebine cevap olarak gönderildi.
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
