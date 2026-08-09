/**
 * Yeni kullanıcı kayıt olduğunda gönderilen hoş geldin maili.
 */

const APP_URL = process.env.APP_URL || "https://app.sphereenglish.com";
const API_URL = process.env.PUBLIC_API_URL || "https://api.sphereenglish.com";
const WWW_URL = process.env.WWW_URL || "https://www.sphereenglish.com";
const SUPPORT_EMAIL = "info@sphereenglish.com";
const SUPPORT_WHATSAPP = "905066085810"; // +90 506 608 58 10
const SUPPORT_WHATSAPP_DISPLAY = "+90 506 608 58 10";
const ICON_BASE = `${API_URL}/email-icons`;

export function renderWelcomeEmail(opts: {
  firstName: string;
}): { subject: string; html: string; preheader: string } {
  const name = (opts.firstName || "").trim() || "hoş geldin";
  const subject = `Sphere English ailesine hoş geldin, ${name}!`;
  const preheader = "İngilizce yolculuğun burada başlıyor — canlı dersler, 7/24 AI koçlar ve daha fazlası seni bekliyor.";

  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;">
  <div style="display:none;font-size:1px;color:#f1f5f9;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.05);">

        <!-- Header -->
        <tr><td style="padding:36px 32px;background:linear-gradient(135deg,#1B365D 0%,#0ea5e9 100%);text-align:center;">
          <h1 style="margin:0;color:#fff;font-size:26px;font-weight:700;letter-spacing:-0.5px;">Sphere English'e Hoş Geldin</h1>
          <p style="margin:12px 0 0;color:rgba(255,255,255,.9);font-size:15px;">Yolculuğun burada başlıyor</p>
        </td></tr>

        <!-- Intro -->
        <tr><td style="padding:32px 32px 8px;">
          <p style="margin:0 0 16px;font-size:16px;">Merhaba <strong>${escapeHtml(name)}</strong>,</p>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#334155;">
            Sphere English'e hoş geldin. Aramızda olduğun için çok mutluyuz.
          </p>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#334155;">
            Artık sadece bir uygulamayla değil, seni hedefine götürecek <strong>komple bir öğrenme sistemiyle</strong> tanışıyorsun.
            İşte içeride seni neler bekliyor:
          </p>
        </td></tr>

        <!-- Feature 1 -->
        <tr><td style="padding:0 32px 4px;">
          ${featureRow("live-lessons.svg", "Canlı Dersler", "Uzman eğitmenlerimizle birebir veya küçük grup canlı derslerde konuş, pratik yap, anlık geri bildirim al. Ezber değil, gerçek iletişim.")}
        </td></tr>
        <tr><td style="padding:0 32px 4px;">
          ${featureRow("ai-coach.svg", "7/24 Yapay Zeka Koçları", "Ders dışında da yalnız değilsin. AI koçlarımızla dilediğin zaman konuşma pratiği yap, kelime çalış, yazdıklarını düzelt.")}
        </td></tr>
        <tr><td style="padding:0 32px 4px;">
          ${featureRow("target.svg", "Sana Özel Program", "Seviye testin ve hedeflerinle sana özel bir yol haritası çıkarıyoruz. İş İngilizcesi mi, günlük konuşma mı, sınav hazırlığı mı — sana göre.")}
        </td></tr>
        <tr><td style="padding:0 32px 4px;">
          ${featureRow("book.svg", "Zengin İçerik Kütüphanesi", "İnteraktif alıştırmalar, kelime oyunları, dinleme etkinlikleri, okuma pratikleri ve daha fazlası. Her öğrenme stiline uygun.")}
        </td></tr>
        <tr><td style="padding:0 32px 20px;">
          ${featureRow("chart.svg", "İlerlemeni Takip Et", "Ne kadar ilerleme kaydettiğini gör, günlük çalışma serini büyüt, rozetlerini topla. Öğrenmek keyifli olsun.")}
        </td></tr>

        <!-- CTA -->
        <tr><td style="padding:8px 32px 32px;">
          <div style="background:#f0f9ff;border:2px solid #0ea5e9;border-radius:10px;padding:24px;text-align:center;">
            <p style="margin:0 0 8px;font-size:13px;color:#0369a1;font-weight:700;text-transform:uppercase;letter-spacing:.05em;">İlk Adım</p>
            <p style="margin:0 0 16px;font-size:18px;font-weight:700;color:#0c4a6e;">Seviye Tesitini Tamamla</p>
            <p style="margin:0 0 20px;font-size:14px;color:#334155;line-height:1.6;">
              Yolculuğuna doğru noktadan başlamak için sadece <strong>5 dakikanı</strong> ayır. Sistem sana en uygun modülleri açacak.
            </p>
            <a href="${APP_URL}/placement-test" style="display:inline-block;background:#0ea5e9;color:#fff;padding:14px 36px;border-radius:8px;font-weight:700;text-decoration:none;font-size:16px;box-shadow:0 4px 12px rgba(14,165,233,.3);">
              Seviye Tesitine Başla
            </a>
          </div>
        </td></tr>

        <!-- Support -->
        <tr><td style="padding:0 32px 32px;">
          <div style="border-top:1px solid #e2e8f0;padding-top:24px;">
            <p style="margin:0 0 12px;font-size:15px;font-weight:600;color:#1e293b;">Sorun mu var? Yardıma ihtiyacın mı var?</p>
            <p style="margin:0;font-size:14px;color:#64748b;line-height:1.7;">
              Bize her zaman ulaşabilirsin:<br>
              <span style="color:#0ea5e9;font-weight:700;">E-posta:</span> <a href="mailto:${SUPPORT_EMAIL}" style="color:#0ea5e9;text-decoration:none;">${SUPPORT_EMAIL}</a><br>
              <span style="color:#0ea5e9;font-weight:700;">WhatsApp:</span> <a href="https://wa.me/${SUPPORT_WHATSAPP}" style="color:#0ea5e9;text-decoration:none;">${SUPPORT_WHATSAPP_DISPLAY}</a>
            </p>
          </div>
        </td></tr>

        <!-- Signature -->
        <tr><td style="padding:0 32px 32px;">
          <p style="margin:0;font-size:15px;color:#334155;">
            Başarılar dileriz,<br>
            <strong style="color:#1B365D;">Sphere English Ekibi</strong>
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;font-size:12px;color:#94a3b8;">
          Sphere English · <a href="${WWW_URL}" style="color:#0ea5e9;text-decoration:none;">sphereenglish.com</a>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, html, preheader };
}

function featureRow(iconFile: string, title: string, body: string): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:18px;">
      <tr>
        <td style="width:56px;vertical-align:top;padding-top:2px;">
          <img src="${ICON_BASE}/${iconFile}" width="42" height="42" alt="" style="display:block;width:42px;height:42px;border:0;outline:none;">
        </td>
        <td style="vertical-align:top;padding-top:6px;">
          <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:#1B365D;">${escapeHtml(title)}</p>
          <p style="margin:0;font-size:14px;line-height:1.6;color:#475569;">${escapeHtml(body)}</p>
        </td>
      </tr>
    </table>
  `;
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
