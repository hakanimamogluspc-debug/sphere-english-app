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
  /** Luca fatura viewer URL — kesildiyse mail'e "Faturayı Görüntüle" butonu eklenir */
  invoiceViewerUrl?: string | null;
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
                <td style="padding:16px 20px;">
                  <div style="font-size:12px;font-weight:700;color:#1e40af;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">🧾 Fatura</div>
                  ${opts.invoiceViewerUrl
                    ? `<div style="font-size:13px;color:#1e3a8a;line-height:1.6;margin-bottom:12px;">
                        e-Arşiv faturanız hazır. Aşağıdaki butondan görüntüleyebilir veya PDF olarak indirebilirsiniz.
                      </div>
                      <a href="${opts.invoiceViewerUrl}" style="display:inline-block;background:#1e40af;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:12px 24px;border-radius:10px;box-shadow:0 2px 8px rgba(30,64,175,0.25);">
                        📄 Faturayı Görüntüle
                      </a>
                      <div style="font-size:11px;color:#64748b;margin-top:8px;">
                        Ayrıca resmi e-Arşiv fatura PDF'i e-posta adresinize ayrıca ulaşacaktır.
                      </div>`
                    : `<div style="font-size:13px;color:#1e3a8a;line-height:1.6;">
                        ${invoiceMsg}
                      </div>`
                  }
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

// ─── TERKEDİLMİŞ SEPET HATIRLATMA MAİLİ ──────────────────────────────────

interface AbandonedMailOptions {
  buyerEmail: string;
  buyerName: string | null;
  items: Array<{
    title: string;
    author: string | null;
    priceTry: number;
    isBundle: boolean;
    coverUrl: string | null;
  }>;
  totalTry: number;
  cartUrl: string;
  couponCode?: string | null;
  couponPercent?: number | null;
}

/**
 * Terkedilmiş sepet hatırlatma maili — pending kalan sipariş için 4 saat sonra.
 * Kullanıcının form doldurduğu (dolayısıyla email verdiği) sepetler hedefleniyor.
 * cartUrl = /sepet linki (kullanıcı sepetteki ürünler localStorage'da olmasa da
 * pending kayıttan resume edebilir — MVP'de sadece sepet sayfasına yönlendir).
 */
export async function sendCartAbandonedMail(opts: AbandonedMailOptions): Promise<{
  ok: boolean;
  error?: string;
}> {
  const greeting = opts.buyerName ? `Merhaba ${opts.buyerName},` : "Merhaba,";
  const itemLabel = opts.items.length === 1 ? "1 kitap" : `${opts.items.length} ürün`;
  const subject = `📚 ${itemLabel} sepetinde bekliyor — Sphere English`;

  const couponBlock = opts.couponCode
    ? `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:linear-gradient(135deg,#10b981 0%,#059669 100%);border-radius:14px;margin:20px 0;">
      <tr>
        <td style="padding:22px 24px;color:#ffffff;text-align:center;">
          <div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;opacity:0.9;margin-bottom:6px;">Bu maile özel</div>
          <div style="font-size:32px;font-weight:800;margin-bottom:4px;">%${opts.couponPercent ?? 10} İNDİRİM</div>
          <div style="font-size:14px;opacity:0.95;margin-bottom:12px;">Kupon kodu:</div>
          <div style="display:inline-block;background:rgba(255,255,255,0.95);color:#059669;padding:10px 22px;border-radius:10px;font-size:18px;font-weight:800;letter-spacing:2px;font-family:monospace;">
            ${opts.couponCode}
          </div>
          <div style="font-size:11px;opacity:0.85;margin-top:10px;">Sepette otomatik uygulanır. 48 saat geçerli.</div>
        </td>
      </tr>
    </table>`
    : "";

  const itemsHtml = opts.items
    .map((it) => {
      const badge = it.isBundle
        ? `<div style="display:inline-block;background:#dcfce7;color:#166534;font-size:10px;font-weight:700;padding:2px 7px;border-radius:5px;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;">📦 Paket</div>`
        : "";
      const coverImg = it.coverUrl
        ? `<img src="${it.coverUrl}" alt="${it.title}" width="70" style="width:70px;border-radius:6px;border:1px solid #e2e8f0;display:block;" />`
        : `<div style="width:70px;height:94px;background:linear-gradient(135deg,#dbeafe,#bfdbfe);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:28px;">📚</div>`;
      return `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:10px 0;">
          <tr>
            <td width="80" valign="top" style="padding-right:12px;">
              ${coverImg}
            </td>
            <td valign="middle" style="padding:6px 0;">
              ${badge}
              <div style="font-size:15px;font-weight:700;color:#1B365D;line-height:1.3;">${it.title}</div>
              ${it.author ? `<div style="font-size:12px;color:#64748b;margin-top:2px;">${it.author}</div>` : ""}
              <div style="font-size:15px;font-weight:800;color:#0ea5e9;margin-top:6px;">${formatTRY(it.priceTry)}</div>
            </td>
          </tr>
        </table>`;
    })
    .join("");

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

        <tr>
          <td style="background:linear-gradient(135deg,#0ea5e9 0%,#0284c7 100%);padding:32px 32px 28px;text-align:center;">
            <div style="font-size:26px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;margin-bottom:4px;">Sphere English</div>
            <div style="font-size:13px;color:rgba(255,255,255,0.9);">Sepetinde bir şeyler var 👀</div>
          </td>
        </tr>

        <tr>
          <td style="padding:32px 32px 20px;">
            <h1 style="margin:0 0 12px;font-size:22px;font-weight:800;color:#1B365D;line-height:1.3;">
              ${greeting}
            </h1>
            <p style="margin:0 0 6px;font-size:15px;color:#475569;line-height:1.6;">
              Az önce sepette bir sipariş başlattın ama tamamlayamadın. Belki bir sorun oldu, belki
              bir şeyi kontrol etmek istedin — biz sepetini kaybolmasın diye sakladık.
            </p>
            <p style="margin:0 0 8px;font-size:15px;color:#475569;line-height:1.6;">
              <strong>Kaldığın yerden</strong> devam etmek için tek tıkla ödemeye geç.
            </p>

            <!-- Sepet özeti -->
            <div style="margin:22px 0 8px;padding:16px 18px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
              <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Sepetin</div>
              ${itemsHtml}
              <div style="display:flex;justify-content:space-between;align-items:center;padding-top:12px;margin-top:6px;border-top:1px dashed #cbd5e1;">
                <span style="font-size:13px;color:#64748b;">Toplam</span>
                <span style="font-size:22px;font-weight:800;color:#0ea5e9;">${formatTRY(opts.totalTry)}</span>
              </div>
            </div>

            ${couponBlock}

            <!-- CTA -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:24px 0;">
              <tr>
                <td align="center">
                  <a href="${opts.cartUrl}" style="display:inline-block;background:#0ea5e9;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:16px 44px;border-radius:12px;box-shadow:0 4px 12px rgba(14,165,233,0.3);">
                    🛒 Ödemeyi Tamamla
                  </a>
                  <div style="margin-top:12px;font-size:11px;color:#94a3b8;">
                    veya sepete gitmek için:<br>
                    <a href="${opts.cartUrl}" style="color:#0ea5e9;word-break:break-all;font-size:10px;">${opts.cartUrl}</a>
                  </div>
                </td>
              </tr>
            </table>

            <p style="margin:20px 0 0;font-size:13px;color:#64748b;line-height:1.6;text-align:center;">
              Sepetini kapatmak veya değiştirmek mi istiyorsun? Sepet sayfasında dilediğin gibi düzenleyebilirsin.
            </p>
          </td>
        </tr>

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
            <p style="margin:10px 0 0;font-size:10px;color:#cbd5e1;">
              Bu maili sepette bilgilerini bıraktığın için gönderdik. Bir daha almak istemezsen
              <a href="mailto:info@sphereenglish.com?subject=Sepet%20maili%20almak%20istemiyorum" style="color:#94a3b8;text-decoration:underline;">buradan bize yaz</a>.
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

// ─── SEPET (MULTI-ITEM) MAIL ─────────────────────────────────────────────

interface CartMailOptions {
  buyerEmail: string;
  buyerName: string | null;
  orderId: string;
  totalAmount: number;
  currency: string;
  invoiceType: "individual" | "corporate";
  items: Array<{
    ebookTitle: string;
    ebookAuthor: string | null;
    downloadToken: string;
    downloadExpiresAt: Date;
    bundleTitle: string | null;
  }>;
  /** Luca fatura viewer URL — kesildiyse mail'e "Faturayı Görüntüle" butonu */
  invoiceViewerUrl?: string | null;
}

/**
 * Sepet ödemesi sonrası TEK mailde tüm PDF linklerini gönderir.
 * Her item için ayrı bir "PDF'i İndir" butonu + kendi token URL'i.
 */
export async function sendCartDownloadMail(opts: CartMailOptions): Promise<{
  ok: boolean;
  error?: string;
}> {
  const downloadBase = process.env.PUBLIC_DOWNLOAD_BASE_URL
    ?? process.env.PUBLIC_API_BASE_URL
    ?? "https://app.sphereenglish.com";

  const greeting = opts.buyerName ? `Merhaba ${opts.buyerName},` : "Merhaba,";
  const itemCountLabel =
    opts.items.length === 1 ? "1 kitap" : `${opts.items.length} kitap`;
  const subject = `📚 Siparişin hazır — ${itemCountLabel} indirilebilir`;

  const invoiceMsg =
    opts.invoiceType === "corporate"
      ? "Kurumsal faturanız e-Arşiv olarak en geç 7 iş günü içinde e-posta adresinize gönderilecektir."
      : "e-Arşiv faturanız en geç 7 iş günü içinde e-posta adresinize gönderilecektir.";

  // Item HTML'ini kur
  const itemsHtml = opts.items
    .map((it) => {
      const downloadUrl = `${downloadBase.replace(/\/$/, "")}/api/ebooks/download?token=${encodeURIComponent(it.downloadToken)}`;
      const expiresFormatted = formatDate(it.downloadExpiresAt);
      const bundleBadge = it.bundleTitle
        ? `<div style="display:inline-block;background:#dcfce7;color:#166534;font-size:10px;font-weight:700;padding:3px 8px;border-radius:6px;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">📦 ${it.bundleTitle}</div>`
        : "";
      return `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;margin:12px 0;">
          <tr>
            <td style="padding:18px 20px;">
              ${bundleBadge}
              <div style="font-size:16px;font-weight:700;color:#1B365D;margin-bottom:4px;">${it.ebookTitle}</div>
              <div style="font-size:13px;color:#64748b;margin-bottom:14px;">${it.ebookAuthor ?? "Sphere English"}</div>
              <a href="${downloadUrl}" style="display:inline-block;background:#10b981;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:12px 24px;border-radius:10px;box-shadow:0 2px 8px rgba(16,185,129,0.25);">
                📄 PDF'i İndir
              </a>
              <div style="margin-top:10px;font-size:10px;color:#94a3b8;">
                Süre: <strong>${expiresFormatted}</strong> · Maks 10 indirme
              </div>
            </td>
          </tr>
        </table>`;
    })
    .join("");

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

        <tr>
          <td style="background:linear-gradient(135deg,#0ea5e9 0%,#0284c7 100%);padding:32px 32px 28px;text-align:center;">
            <div style="font-size:26px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;margin-bottom:4px;">Sphere English</div>
            <div style="font-size:13px;color:rgba(255,255,255,0.85);">Siparişin hazır 🎉</div>
          </td>
        </tr>

        <tr>
          <td style="padding:32px 32px 16px;">
            <h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#1B365D;line-height:1.3;">
              ${greeting}
            </h1>
            <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.6;">
              Ödemen başarıyla alındı. Toplam <strong>${itemCountLabel}</strong> için indirme linklerini
              aşağıda bulabilirsin. Her link <strong>sana özel</strong> — başkasıyla paylaşma.
            </p>

            <!-- Sipariş özeti -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;margin:20px 0;">
              <tr>
                <td style="padding:16px 20px;">
                  <div style="font-size:11px;font-weight:700;color:#0369a1;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Sipariş #${opts.orderId.slice(-8)}</div>
                  <div style="display:flex;justify-content:space-between;align-items:center;">
                    <div style="font-size:13px;color:#0c4a6e;">${itemCountLabel}</div>
                    <div style="font-size:22px;font-weight:800;color:#0ea5e9;">${formatTRY(opts.totalAmount)}</div>
                  </div>
                </td>
              </tr>
            </table>

            <!-- Kitap listesi (her biri için ayrı download butonu) -->
            <div style="margin:24px 0;">
              <div style="font-size:14px;font-weight:700;color:#1B365D;margin-bottom:12px;">📚 Kitaplarınız (${opts.items.length})</div>
              ${itemsHtml}
            </div>

            <!-- Uyarı -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#fef3c7;border:1px solid #fcd34d;border-radius:12px;margin:16px 0;">
              <tr>
                <td style="padding:14px 18px;">
                  <div style="font-size:12px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">⏰ Önemli</div>
                  <ul style="margin:0;padding-left:18px;font-size:13px;color:#78350f;line-height:1.7;">
                    <li>Bağlantılar <strong>7 gün</strong> süreyle geçerli</li>
                    <li>Her kitap için maksimum <strong>10 kez</strong> indirme hakkın var</li>
                    <li>Linkler sadece sana özel — paylaşırsan limit hızlı dolar</li>
                    <li>PDF'leri indirip kendi cihazına kaydetmeni öneririz</li>
                  </ul>
                </td>
              </tr>
            </table>

            <!-- Fatura -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;margin:16px 0;">
              <tr>
                <td style="padding:16px 20px;">
                  <div style="font-size:12px;font-weight:700;color:#1e40af;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">🧾 Fatura</div>
                  ${opts.invoiceViewerUrl
                    ? `<div style="font-size:13px;color:#1e3a8a;line-height:1.6;margin-bottom:12px;">
                        Sipariş faturanız hazır. Aşağıdaki butondan görüntüleyebilir veya PDF olarak indirebilirsiniz.
                      </div>
                      <a href="${opts.invoiceViewerUrl}" style="display:inline-block;background:#1e40af;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:12px 24px;border-radius:10px;box-shadow:0 2px 8px rgba(30,64,175,0.25);">
                        📄 Faturayı Görüntüle
                      </a>
                      <div style="font-size:11px;color:#64748b;margin-top:8px;">
                        Ayrıca resmi e-Arşiv fatura PDF'i e-posta adresinize ayrıca ulaşacaktır.
                      </div>`
                    : `<div style="font-size:13px;color:#1e3a8a;line-height:1.6;">
                        ${invoiceMsg}
                      </div>`
                  }
                </td>
              </tr>
            </table>

            <p style="margin:24px 0 0;font-size:14px;color:#475569;line-height:1.6;">
              Sorun yaşarsan, kaybolduysan veya yeni bağlantı istersen bu maili yanıtla — birkaç saat içinde dönüş yapıyoruz.
            </p>
          </td>
        </tr>

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
              Bu mail satın aldığınız e-kitapların teslimatı için gönderildi.
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
