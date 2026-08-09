/**
 * Admin Bildirim Sistemi
 *
 * Yeni event'lerde admin'lere mail atar. Non-blocking — mail başarısız
 * olsa bile event akışı devam eder. Tüm fonksiyonlar void Promise döner
 * ve hata fırlatmaz (try/catch içeride yapılır).
 *
 * Çevresel değişkenler:
 *   ADMIN_NOTIFICATION_EMAILS — virgülle ayrılmış admin mailleri
 *                               (örn. "admin@sphereenglish.com,hakan@...")
 *   APP_URL — admin panel URL'i, mail'de "Görüntüle" linki için
 *             default: https://app.sphereenglish.com
 */

import { sendEmail } from "./email.js";
import { captureException } from "./sentry.js";

function getRecipients(): string[] {
  const raw = process.env.ADMIN_NOTIFICATION_EMAILS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.includes("@"));
}

function getAppUrl(): string {
  return process.env.APP_URL ?? "https://app.sphereenglish.com";
}

/**
 * Tüm admin maillerine paralel olarak mail at.
 * Hatalar Sentry'ye düşer, çağıran fonksiyon etkilenmez.
 */
async function notifyAll(subject: string, html: string): Promise<void> {
  const recipients = getRecipients();
  console.info(`[admin-notify] Subject="${subject}" — ${recipients.length} alıcı: [${recipients.join(", ")}]`);

  if (recipients.length === 0) {
    console.warn("[admin-notify] ADMIN_NOTIFICATION_EMAILS env var tanımlı değil — bildirim atlandı");
    return;
  }

  try {
    const results = await Promise.allSettled(
      recipients.map(async (to) => {
        try {
          const r = await sendEmail(to, subject, html);
          if (r?.ok) {
            console.info(`[admin-notify] ✓ ${to} OK`);
          } else {
            console.error(`[admin-notify] ✗ ${to} FAIL:`, r?.error ?? "unknown");
          }
          return r;
        } catch (e: any) {
          console.error(`[admin-notify] ✗ ${to} EXCEPTION:`, e?.message ?? e);
          throw e;
        }
      }),
    );
    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed > 0) {
      console.warn(`[admin-notify] ${failed}/${recipients.length} alıcıya gönderilemedi`);
    }
  } catch (e: any) {
    console.error("[admin-notify] notifyAll EXCEPTION:", e?.message);
    captureException(e, { context: "admin-notify", subject });
  }
}

/** Ortak HTML wrapper — basit, marka renkli */
function wrapHtml(title: string, body: string, ctaUrl?: string, ctaLabel?: string): string {
  const cta = ctaUrl
    ? `<p style="margin:24px 0 0"><a href="${ctaUrl}" style="background:#1B365D;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:600">${ctaLabel ?? "Admin Panelinde Aç"}</a></p>`
    : "";

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;background:#f5f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:560px;margin:24px auto;background:#fff;border-radius:8px;padding:32px;border:1px solid #e5e7eb">
    <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#0ea5e9;font-weight:700">Sphere English — Yönetici Bildirimi</p>
    <h1 style="margin:0 0 16px;font-size:22px;color:#1B365D;line-height:1.3">${title}</h1>
    <div style="color:#374151;font-size:15px;line-height:1.6">${body}</div>
    ${cta}
    <hr style="border:0;border-top:1px solid #e5e7eb;margin:32px 0 16px">
    <p style="margin:0;font-size:12px;color:#6b7280">
      Bu otomatik bir bildirimdir. Yanıtlamayın.<br>
      Sphere English Admin Sistem · ${new Date().toLocaleString("tr-TR")}
    </p>
  </div>
</body></html>`;
}

function fieldList(items: Array<{ label: string; value: string }>): string {
  return items
    .map(
      (it) =>
        `<div style="margin:6px 0"><span style="color:#6b7280;font-size:13px">${it.label}:</span> <strong style="color:#111827">${it.value}</strong></div>`,
    )
    .join("");
}

// ─── Event handler'ları ───────────────────────────────────────────────────

export async function notifyNewTeacherApplication(opts: {
  applicationId: number;
  fullName: string;
  email: string;
  experience?: string;
  englishLevel?: string;
}): Promise<void> {
  const url = `${getAppUrl()}/admin/teacher-applications`;
  const html = wrapHtml(
    "Yeni Eğitmen Başvurusu",
    `Yeni bir eğitmen başvurusu alındı.<br><br>${fieldList([
      { label: "Ad Soyad", value: opts.fullName },
      { label: "E-posta", value: opts.email },
      { label: "Tecrübe", value: opts.experience ?? "Belirtilmemiş" },
      { label: "İngilizce Seviyesi", value: opts.englishLevel ?? "Belirtilmemiş" },
      { label: "Başvuru ID", value: `#${opts.applicationId}` },
    ])}`,
    url,
    "Başvuruyu İncele",
  );
  await notifyAll(`[Sphere] Yeni eğitmen başvurusu — ${opts.fullName}`, html);
}

export async function notifyNewPartnerApplication(opts: {
  affiliateId?: number;
  fullName: string;
  email: string;
  promotionPlan?: string;
}): Promise<void> {
  const url = `${getAppUrl()}/admin/affiliates`;
  const html = wrapHtml(
    "Yeni Partner Başvurusu",
    `Yeni bir partner programı başvurusu var.<br><br>${fieldList([
      { label: "Ad Soyad", value: opts.fullName },
      { label: "E-posta", value: opts.email },
      { label: "Tanıtım planı", value: opts.promotionPlan ?? "Belirtilmemiş" },
    ])}`,
    url,
    "Onay Bekleyenleri Aç",
  );
  await notifyAll(`[Sphere] Yeni partner başvurusu — ${opts.fullName}`, html);
}

export async function notifyNewSubscription(opts: {
  userEmail: string;
  planLabel: string;
  amountTl: number;
  couponCode?: string | null;
  partnerCode?: string | null;
}): Promise<void> {
  const url = `${getAppUrl()}/admin/subscriptions`;
  const html = wrapHtml(
    "Yeni Abonelik 🎉",
    `Yeni bir Pro abonelik satın alındı.<br><br>${fieldList([
      { label: "Müşteri", value: opts.userEmail },
      { label: "Plan", value: opts.planLabel },
      { label: "Tutar", value: `${opts.amountTl.toLocaleString("tr-TR")} TL` },
      ...(opts.couponCode ? [{ label: "Kupon", value: opts.couponCode }] : []),
      ...(opts.partnerCode ? [{ label: "Partner kodu", value: opts.partnerCode }] : []),
    ])}`,
    url,
  );
  await notifyAll(`[Sphere] Yeni abonelik — ${opts.amountTl} TL`, html);
}

export async function notifyNewEbookPurchase(opts: {
  purchaseId: number;
  buyerEmail: string;
  ebookTitle: string;
  amountTl: number;
  couponCode?: string | null;
  partnerCode?: string | null;
}): Promise<void> {
  const url = `${getAppUrl()}/admin/ebook-purchases`;
  const html = wrapHtml(
    "Yeni E-Kitap Satışı 📚",
    `Yeni bir e-kitap satışı tamamlandı.<br><br>${fieldList([
      { label: "Alıcı", value: opts.buyerEmail },
      { label: "E-kitap", value: opts.ebookTitle },
      { label: "Tutar", value: `${opts.amountTl.toLocaleString("tr-TR")} TL` },
      { label: "Sipariş ID", value: `#${opts.purchaseId}` },
      ...(opts.couponCode ? [{ label: "Kupon", value: opts.couponCode }] : []),
      ...(opts.partnerCode ? [{ label: "Partner kodu", value: opts.partnerCode }] : []),
    ])}`,
    url,
  );
  await notifyAll(`[Sphere] Yeni e-kitap satışı — ${opts.amountTl} TL`, html);
}

export async function notifyNewCartPurchase(opts: {
  orderId: string;
  buyerEmail: string;
  itemCount: number;
  totalTl: number;
}): Promise<void> {
  const url = `${getAppUrl()}/admin/ebook-purchases`;
  const html = wrapHtml(
    "Yeni Sepet Satışı 🛒",
    `Yeni bir çoklu ürün siparişi tamamlandı.<br><br>${fieldList([
      { label: "Alıcı", value: opts.buyerEmail },
      { label: "Ürün Sayısı", value: `${opts.itemCount} kitap` },
      { label: "Toplam Tutar", value: `${opts.totalTl.toLocaleString("tr-TR")} TL` },
      { label: "Sipariş Ref", value: opts.orderId },
    ])}`,
    url,
  );
  await notifyAll(
    `[Sphere] Yeni sepet satışı — ${opts.totalTl} TL / ${opts.itemCount} kitap`,
    html,
  );
}

export async function notifyNewUserRegistration(opts: {
  userId: number;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  role: string;
  accountType?: string | null;
  companyName?: string | null;
  studentNumber?: string | null;
}): Promise<void> {
  const roleLabel: Record<string, string> = {
    student: "Öğrenci",
    corporate: "Kurumsal Yetkili",
    partner: "Partner",
    teacher: "Öğretmen",
    admin: "Yönetici",
  };
  const accountLabel: Record<string, string> = {
    bireysel: "Bireysel",
    kurumsal: "Kurumsal",
  };

  const fields: Array<{ label: string; value: string }> = [
    { label: "Ad Soyad", value: `${opts.firstName} ${opts.lastName}` },
    { label: "E-posta", value: `<a href="mailto:${opts.email}" style="color:#0ea5e9;text-decoration:none">${opts.email}</a>` },
  ];
  if (opts.phone) {
    const cleanPhone = opts.phone.replace(/[^\d+]/g, "");
    fields.push({
      label: "Telefon",
      value: `<a href="tel:${cleanPhone}" style="color:#0ea5e9;text-decoration:none">${opts.phone}</a> · <a href="https://wa.me/${cleanPhone.replace(/^\+?/, "")}" style="color:#25D366;text-decoration:none">WhatsApp</a>`,
    });
  }
  fields.push({ label: "Rol", value: roleLabel[opts.role] ?? opts.role });
  if (opts.accountType) fields.push({ label: "Hesap Tipi", value: accountLabel[opts.accountType] ?? opts.accountType });
  if (opts.companyName) fields.push({ label: "Kurum", value: opts.companyName });
  if (opts.studentNumber) fields.push({ label: "Öğrenci No", value: opts.studentNumber });
  fields.push({ label: "Kullanıcı ID", value: `#${opts.userId}` });

  const url = `${getAppUrl()}/admin/users`;
  const html = wrapHtml(
    "Yeni Kullanıcı Kaydı 🎉",
    `Uygulamaya yeni bir kullanıcı kayıt oldu.<br><br>${fieldList(fields)}
    <div style="margin-top:20px;text-align:center">
      <a href="${url}" style="display:inline-block;background:#0ea5e9;color:#fff;padding:10px 22px;border-radius:6px;text-decoration:none;font-weight:600">Kullanıcıyı Görüntüle</a>
    </div>`,
  );
  await notifyAll(`[Sphere] Yeni kayıt — ${opts.firstName} ${opts.lastName}`, html);
}

export async function notifyNewContactMessage(opts: {
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
}): Promise<void> {
  const fields: Array<{ label: string; value: string }> = [
    { label: "Ad", value: opts.name },
    { label: "E-posta", value: opts.email },
  ];
  if (opts.phone) {
    // Telefon tıklanabilir olsun
    const cleanPhone = opts.phone.replace(/[^\d+]/g, "");
    fields.push({
      label: "Telefon",
      value: `<a href="tel:${cleanPhone}" style="color:#0ea5e9;text-decoration:none">${opts.phone}</a> · <a href="https://wa.me/${cleanPhone.replace(/^\+?/, "")}" style="color:#25D366;text-decoration:none">WhatsApp</a>`,
    });
  }
  fields.push({ label: "Konu", value: opts.subject ?? "Belirtilmemiş" });

  const html = wrapHtml(
    "Yeni İletişim Mesajı",
    `Web sitesinden yeni bir mesaj geldi.<br><br>${fieldList(fields)}
    <div style="margin-top:16px;padding:12px;background:#f9fafb;border-left:3px solid #0ea5e9;border-radius:4px">
      <div style="color:#6b7280;font-size:12px;margin-bottom:4px">Mesaj:</div>
      <div style="white-space:pre-wrap;color:#111827">${opts.message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
    </div>`,
  );
  await notifyAll(`[Sphere] İletişim formu — ${opts.name}`, html);
}

export async function notifyNewDemoBooking(opts: {
  bookingId: number;
  dateFormatted: string;
  startTime: string;
  endTime: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  customerCompany?: string | null;
  message?: string | null;
}): Promise<void> {
  const url = `${getAppUrl()}/admin/demo`;
  const fields: Array<{ label: string; value: string }> = [
    { label: "Tarih", value: opts.dateFormatted },
    { label: "Saat", value: `${opts.startTime} – ${opts.endTime}` },
    { label: "Müşteri", value: opts.customerName },
    { label: "E-posta", value: `<a href="mailto:${opts.customerEmail}" style="color:#0ea5e9;text-decoration:none">${opts.customerEmail}</a>` },
  ];
  if (opts.customerPhone) {
    const clean = opts.customerPhone.replace(/[^\d+]/g, "");
    const waNum = clean.replace(/^\+/, "");
    fields.push({
      label: "Telefon",
      value: `<a href="tel:${clean}" style="color:#0ea5e9;text-decoration:none">${opts.customerPhone}</a> · <a href="https://wa.me/${waNum}" style="color:#25D366;text-decoration:none">WhatsApp</a>`,
    });
  }
  if (opts.customerCompany) fields.push({ label: "Şirket", value: opts.customerCompany });

  const html = wrapHtml(
    "Yeni Demo Randevusu 📅",
    `<strong>${opts.customerName}</strong> yeni bir demo randevusu aldı.<br><br>${fieldList(fields)}
    ${opts.message ? `<div style="margin-top:16px;padding:12px;background:#f9fafb;border-left:3px solid #0ea5e9;border-radius:4px"><div style="color:#6b7280;font-size:12px;margin-bottom:4px">Müşterinin Mesajı:</div><div style="white-space:pre-wrap;color:#111827">${opts.message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div></div>` : ""}
    <p style="margin-top:16px;font-size:13px;color:#64748b">Görüşme linki eklemeyi unutmayın.</p>`,
    url,
    "Admin Panelde Aç",
  );
  await notifyAll(`[Sphere] Yeni demo randevusu — ${opts.customerName} · ${opts.dateFormatted} ${opts.startTime}`, html);
}

export async function notifyAffiliateCommission(opts: {
  affiliateEmail: string;
  affiliateName: string;
  commissionTl: number;
  saleType: "subscription" | "ebook";
}): Promise<void> {
  const url = `${getAppUrl()}/admin/affiliates`;
  const html = wrapHtml(
    "Yeni Affiliate Komisyonu 💰",
    `Bir partnerin satışından komisyon kazanıldı.<br><br>${fieldList([
      { label: "Partner", value: `${opts.affiliateName} (${opts.affiliateEmail})` },
      { label: "Satış Tipi", value: opts.saleType === "subscription" ? "Abonelik" : "E-kitap" },
      { label: "Komisyon", value: `${opts.commissionTl.toLocaleString("tr-TR")} TL` },
    ])}`,
    url,
  );
  await notifyAll(`[Sphere] Affiliate komisyon — ${opts.commissionTl} TL`, html);
}

export async function notifyBackupFailure(opts: { error: string; timestamp: string }): Promise<void> {
  const html = wrapHtml(
    "⚠️ DB Yedekleme Hatası",
    `Otomatik veritabanı yedekleme başarısız oldu. Hemen kontrol edilmesi önerilir.<br><br>${fieldList([
      { label: "Zaman", value: opts.timestamp },
      { label: "Hata", value: opts.error },
    ])}`,
    `${getAppUrl()}/admin/backups`,
    "Yedekleri Aç",
  );
  await notifyAll(`[Sphere] ⚠️ DB Backup HATA`, html);
}
