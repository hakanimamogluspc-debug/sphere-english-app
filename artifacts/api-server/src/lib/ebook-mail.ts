/**
 * E-kitap satın alma mail bildirimleri.
 *
 * Mail içeriği:
 *   - Sipariş özeti (kitap + tutar)
 *   - Büyük "PDF'i İndir" butonu (token URL)
 *   - Süre + indirme limiti uyarısı
 *   - Fatura bilgisi (e-Arşiv ayrıca gönderilecek)
 *   - Destek iletişim
 *
 * Token URL formatı:
 *   https://app.sphereenglish.com/api/ebooks/download?token=<base64url-32byte>
 */

import { sendEmail } from "./email.js";

interface EbookMailOptions {
  buyerEmail: string;
  buyerName: string | null;
  ebookTitle: string;
  ebookAuthor: string;
  amountPaid: number | string;
  currency: string;
  downloadToken: string;
  downloadExpiresAt: Date;
  /** Fatura tipi — mailde "e-Arşiv faturanız ayrıca gönderilecek" mesajı için */
  invoiceType: "individual" | "corporate";
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

/**
 * Satın alma sonrası alıcıya indirme linki mailini gönderir.
 * Token zaten unique + 7 gün süreli + 10 indirme limiti var.
 */
export async function sendEbookDownloadMail(opts: EbookMailOptions): Promise<{
  ok: boolean;
  error?: string;
}> {
  const downloadBase = process.env.PUBLIC_DOWNLOAD_BASE_URL
    ?? process.env.PUBLIC_API_BASE_URL
    ?? "https://app.sphereenglish.com";
  const downloadUrl = `${downloadBase.replace(/\/$/, "")}/api/ebooks/download?token=${encodeURIComponent(opts.downloadToken)}`;

  const greeting = opts.buyerName ? `Merhaba ${opts.buyerName},` : "Merhaba,";
  const subject = `📚 Kitabın hazır — ${opts.ebookTitle}`;
  const expiresFormatted = formatDate(opts.downloadExpiresAt);
  const invoiceMsg =
    opts.invoiceType === "corporate"
      ? "Kurumsal faturanız e-Arşiv olarak en geç 7 iş günü içinde e-posta adresinize gönderilecektir."
      : "e-Arşiv faturanız en geç 7 iş günü içinde e-posta adresinize gönderilecektir.";

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
            <div style="font-size:13px;color:rgba(255,255,255,0.85);">Kitabın hazır 🎉</div>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 32px 16px;">
            <h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#1B365D;line-height:1.3;">
              ${greeting}
            </h1>
            <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.6;">
              Ödemen başarıyla alındı. Aşağıdaki butondan kitabını hemen indirebilirsin.
              İndirme bağlantın sadece <strong>sana özel</strong>, başkasıyla paylaşma.
            </p>

            <!-- Sipariş kutusu -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;margin:20px 0 24px;">
              <tr>
                <td style="padding:18px 20px;">
                  <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Sipariş Özeti</div>
                  <div style="font-size:16px;font-weight:700;color:#1B365D;margin-bottom:4px;">${opts.ebookTitle}</div>
                  <div style="font-size:13px;color:#64748b;margin-bottom:12px;">${opts.ebookAuthor}</div>
                  <div style="font-size:20px;font-weight:800;color:#0ea5e9;">${formatTRY(opts.amountPaid)}</div>
                </td>
              </tr>
            </table>

            <!-- İndirme butonu -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:24px 0;">
              <tr>
                <td align="center">
                  <a href="${downloadUrl}" style="display:inline-block;background:#10b981;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:16px 36px;border-radius:12px;box-shadow:0 4px 12px rgba(16,185,129,0.3);">
                    📄 PDF'i İndir
                  </a>
                  <div style="margin-top:12px;font-size:11px;color:#94a3b8;">
                    Yukarıdaki buton çalışmıyorsa:<br>
                    <a href="${downloadUrl}" style="color:#0ea5e9;word-break:break-all;font-size:10px;">${downloadUrl}</a>
                  </div>
                </td>
              </tr>
            </table>

            <!-- Uyarı kutusu -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#fef3c7;border:1px solid #fcd34d;border-radius:12px;margin:16px 0;">
              <tr>
                <td style="padding:14px 18px;">
                  <div style="font-size:12px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">⏰ Önemli</div>
                  <ul style="margin:0;padding-left:18px;font-size:13px;color:#78350f;line-height:1.7;">
                    <li>Bağlantı <strong>${expiresFormatted}</strong> tarihine kadar geçerli (7 gün)</li>
                    <li>Maksimum <strong>10 kez</strong> indirme hakkın var</li>
                    <li>Bağlantı sadece sana özel — paylaşırsan limit hızlı dolar</li>
                    <li>PDF'i indirip kendi cihazına kaydetmeni öneririz</li>
                  </ul>
                </td>
              </tr>
            </table>

            <!-- Fatura bilgisi -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;margin:16px 0;">
              <tr>
                <td style="padding:14px 18px;">
                  <div style="font-size:12px;font-weight:700;color:#1e40af;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">🧾 Fatura</div>
                  <div style="font-size:13px;color:#1e3a8a;line-height:1.6;">
                    ${invoiceMsg}
                  </div>
                </td>
              </tr>
            </table>

            <p style="margin:24px 0 0;font-size:14px;color:#475569;line-height:1.6;">
              Sorun yaşarsan, kayboldun veya yeni bağlantı istersen yanıtla — birkaç saat içinde dönüş yapıyoruz.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:24px 32px;border-top:1px solid #e2e8f0;text-align:center;">
            <p style="margin:0 0 8px;font-size:12px;color:#64748b;">
              <strong style="color:#1B365D;">Sphere English</strong> · Dijital Yayıncılık
            </p>
            <p style="margin:0 0 4px;font-size:11px;color:#94a3b8;">
              <a href="mailto:info@sphereenglish.com" style="color:#0ea5e9;text-decoration:none;">info@sphereenglish.com</a>
              ·
              <a href="https://wa.me/905066085810" style="color:#0ea5e9;text-decoration:none;">WhatsApp</a>
            </p>
            <p style="margin:8px 0 0;font-size:10px;color:#cbd5e1;">
              Bu mail satın aldığın e-kitabın teslimatı için gönderildi. Yanıtla, hemen okuruz.
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
