/**
 * Admin — Mail Şablon Üretici
 *
 * İki mod:
 *   1. AI Üret — GPT-4o'ya brief ver, tam HTML mail üretir (subject + preview + body)
 *   2. Şablon Kütüphanesi — kod-içi hazır template'ler (kampanya, duyuru, terk sepet vs)
 *
 * Sadece HTML kopyala akışı — frontend Resend/Mailchimp'e elle yapıştırır,
 * bu endpoint gönderim yapmaz (kampanya aracı değil, template studio).
 *
 * Endpoints:
 *   GET  /admin/mail-templates/library         → hazır template listesi
 *   POST /admin/mail-templates/generate        → AI ile üret
 */

import { Router, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { authMiddleware } from "../middlewares/auth.js";
import OpenAI from "openai";

const router = Router();

async function requireAdmin(req: Request, res: Response, next: () => void) {
  const userId = (req as any).userId as number;
  const [me] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!me || me.role !== "admin") return res.status(403).json({ error: "Admin yetkisi gerekli" });
  next();
}

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY missing");
    _openai = new OpenAI({ apiKey });
  }
  return _openai;
}

// ─── Sphere marka rehberi (system prompt'a girer) ─────────────────────
const SPHERE_BRAND_GUIDE = `
Sphere English — Türkiye'nin kurumsal iş İngilizcesi eğitim platformu.

Marka tonu:
- Profesyonel ama sıcak — beyaz yakalı çalışanlara hitap ediyor
- Türkçe, samimi ama saygılı ("Merhaba" — "Merhabalar" değil)
- Kısa cümleler, aksiyon odaklı
- Buzzword'den kaçın (senkronize, sinerji, transforme)
- İş İngilizcesi başarısı vurgusu

Marka renkleri (mail'de kullan):
- Ana lacivert: #1B365D
- Aksan turkuaz: #0ea5e9
- Onay yeşili: #10b981
- Nötr gri: #64748b, #f1f5f9
- Beyaz arka plan: #ffffff
- Metin: #1e293b (koyu), #64748b (hafif)

Marka platformları:
- www.sphereenglish.com — pazarlama sitesi (e-kitap satışı, iletişim)
- app.sphereenglish.com — öğrenme platformu (login, dersler, AI Studio)

Öğrenci profili: 25-45 yaş beyaz yaka, ing öğrenmek isteyen (iş, toplantı, e-posta, sunum).
`.trim();

// ─── HTML mail teknik gereksinimleri ──────────────────────────────────
const HTML_MAIL_REQUIREMENTS = `
Teknik gereksinimler (BUNLARA UYMAK ZORUNLU):

1. **Table-based layout** — <div> yerine <table role="presentation">. Mail
   client'lar (Outlook, Gmail) modern CSS'i tam desteklemiyor.
2. **Inline CSS zorunlu** — <style> bloğu Outlook'ta yenmez. Her element'e
   style="..." attribute'i.
3. **Max width 600px** — masaüstünde ortalı, mobilde full-width.
4. **DOCTYPE + html + head** — tam belge, mail client "quirks mode"a düşmesin.
5. **UTF-8 charset + viewport meta** — Türkçe karakterler + mobil responsive.
6. **Görseller mutlaka absolute URL** (https://) — göreceli path çalışmaz.
7. **Font-family system fallback stack**: -apple-system, BlinkMacSystemFont,
   'Segoe UI', Roboto, Helvetica, Arial, sans-serif
8. **CTA butonu** — <a> ile, background + padding + border-radius inline.
   Butun genişliği auto, min-width: 200px. Metin beyaz.
9. **Preview text** — <body>'nin ilk element'i olarak gizli span:
   <span style="display:none;font-size:0;line-height:0;max-height:0;
   overflow:hidden;">PREVIEW TEXT HERE</span>
10. **Alt attribute** her <img>'de zorunlu.
11. **Class kullanma**, id kullanma — hiçbir mail client CSS class'ı garantili
    handle etmez. Her şey inline style.
`.trim();

// ─── AI Üret endpoint ──────────────────────────────────────────────────
router.post(
  "/admin/mail-templates/generate",
  authMiddleware,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const {
        brief = "",
        mailType = "generic", // 'campaign', 'announcement', 'newsletter', 'abandoned_cart', 'welcome', 'generic'
        tone = "profesyonel_sicak", // 'profesyonel_sicak', 'formal', 'samimi', 'aciliyet'
        ctaText = "",
        ctaUrl = "",
        includeImage = false, // legacy — placeholder image
        images = [], // yeni: [{url, description, filename?}] — mail asset'ler
      } = (req.body ?? {}) as any;

      // images validation
      const validImages: Array<{ url: string; description: string; filename?: string }> = [];
      if (Array.isArray(images)) {
        for (const img of images) {
          if (img && typeof img.url === "string" && img.url.startsWith("http")) {
            validImages.push({
              url: img.url,
              description: String(img.description ?? "").slice(0, 500),
              filename: img.filename ? String(img.filename).slice(0, 200) : undefined,
            });
          }
        }
      }

      if (!brief.trim()) {
        return res.status(400).json({ error: "Brief boş olamaz" });
      }

      const mailTypeMap: Record<string, string> = {
        campaign: "Kampanya / indirim maili",
        announcement: "Yeni e-kitap veya paket duyurusu",
        newsletter: "Newsletter / haftalık bülten",
        abandoned_cart: "Terk edilmiş sepet hatırlatması",
        welcome: "Hoş geldin / onboarding maili",
        generic: "Genel amaçlı mail",
      };

      const toneMap: Record<string, string> = {
        profesyonel_sicak: "Profesyonel ama sıcak — samimi ve saygılı",
        formal: "Formal — kurumsal, mesafeli, resmi dil",
        samimi: "Çok samimi — arkadaşça, esprili, günlük dil",
        aciliyet: "Aciliyet — kısa cümleler, harekete geçirici, süre baskısı",
      };

      const systemPrompt = `Sen Sphere English'in uzman mail template tasarımcısısın.
Türkçe HTML mail template'leri üretiyorsun.

${SPHERE_BRAND_GUIDE}

${HTML_MAIL_REQUIREMENTS}

Response formatı — SADECE aşağıdaki JSON, başka hiçbir şey yazma:
{
  "subject": "Mail konusu (max 60 karakter, emoji opsiyonel)",
  "previewText": "Inbox'ta konudan sonra görünen ilk satır (max 90 karakter, konuyu tamamlayan)",
  "html": "Tam HTML belgesi — DOCTYPE'dan </html>'e"
}`;

      // Görsel açıklamalarını prompt'a hazırla
      const imagesSection =
        validImages.length > 0
          ? `\n\nKullanıcı şu görselleri yükledi — MUTLAKA bu URL'leri <img src="URL" alt="ACIKLAMA" style="display:block;width:100%;max-width:536px;height:auto;border-radius:8px;"> olarak mail'e YERLEŞTİR. Görselleri kaynak URL değiştirmeden aynen kullan. Her görseli açıklamasına en uygun yerde konumlandır (banner en başta, ürün görseli detayın yanında, testimonyal görseli alıntının yanında vb):\n\n${validImages
              .map(
                (img, i) =>
                  `${i + 1}. URL: ${img.url}\n   Açıklama: ${img.description || "(açıklama yok — uygun yerde kullan)"}${img.filename ? `\n   Dosya: ${img.filename}` : ""}`,
              )
              .join("\n\n")}`
          : includeImage
            ? "\n\nBir görsel yer tutucusu ekle (https://placehold.co/600x200/1B365D/ffffff?text=Görsel+Placeholder)."
            : "";

      const userPrompt = `
Mail türü: ${mailTypeMap[mailType] ?? mailTypeMap.generic}
Ton: ${toneMap[tone] ?? toneMap.profesyonel_sicak}
${ctaText ? `CTA buton metni: "${ctaText}"` : ""}
${ctaUrl ? `CTA buton URL'si: ${ctaUrl}` : ""}${imagesSection}

Brief:
${brief}

Yukarıdaki brief için Sphere marka stilinde profesyonel bir HTML mail template üret.
Marka renklerini kullan, inline CSS, table-based layout, mobil responsive, preview text ile.
${validImages.length > 0 ? "Verilen görsel URL'lerini MUTLAKA mail'e yerleştir — atlama." : ""}
JSON dışında hiçbir şey yazma.
`.trim();

      const openaiRes: any = await getOpenAI().chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 4000,
      });

      const raw = openaiRes?.choices?.[0]?.message?.content ?? "{}";
      let parsed: any;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return res.status(500).json({ error: "AI JSON parse hatası", raw });
      }

      if (!parsed?.html || !parsed?.subject) {
        return res.status(500).json({ error: "AI eksik alan döndü", parsed });
      }

      return res.json({
        ok: true,
        subject: String(parsed.subject).slice(0, 100),
        previewText: String(parsed.previewText ?? "").slice(0, 150),
        html: String(parsed.html),
        meta: {
          model: "gpt-4o",
          mailType,
          tone,
          usage: openaiRes?.usage,
        },
      });
    } catch (e: any) {
      console.error("[mail-templates/generate] HATA:", e?.message);
      return res.status(500).json({ error: e?.message ?? "Bilinmeyen hata" });
    }
  },
);

// ─── Şablon kütüphanesi ────────────────────────────────────────────────
// Kod-içi hazır template'ler — sadece HTML iskeleti + placeholder text
// Kullanıcı bunlardan birini seçer, düzenler, kopyalar.

interface LibraryTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  subject: string;
  previewText: string;
  html: string;
}

function baseTemplate(
  subject: string,
  previewText: string,
  bodyHtml: string,
  ctaText = "Detaylara Bak",
  ctaUrl = "https://www.sphereenglish.com",
): string {
  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;">
<span style="display:none;font-size:0;line-height:0;max-height:0;overflow:hidden;">${previewText}</span>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f1f5f9;padding:32px 16px;">
  <tr>
    <td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.05);">
        <tr>
          <td style="padding:32px 32px 24px 32px;text-align:center;background:#1B365D;">
            <h1 style="margin:0;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">Sphere English</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            ${bodyHtml}
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:32px;">
              <tr>
                <td align="center">
                  <a href="${ctaUrl}" style="display:inline-block;background:#0ea5e9;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:700;font-size:15px;min-width:200px;text-align:center;">${ctaText}</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;font-size:12px;color:#64748b;">
            <p style="margin:0 0 8px 0;">Sphere English · Kurumsal İş İngilizcesi</p>
            <p style="margin:0;"><a href="https://www.sphereenglish.com" style="color:#0ea5e9;text-decoration:none;">sphereenglish.com</a> · <a href="mailto:info@sphereenglish.com" style="color:#0ea5e9;text-decoration:none;">info@sphereenglish.com</a></p>
            <p style="margin:12px 0 0 0;font-size:11px;color:#94a3b8;">Bu maili aboneliğinizi iptal etmek için <a href="{{UNSUBSCRIBE_URL}}" style="color:#94a3b8;text-decoration:underline;">tıklayın</a>.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

function libraryTemplates(): LibraryTemplate[] {
  return [
    {
      id: "campaign_discount",
      name: "Kampanya — Yüzde İndirim",
      category: "campaign",
      description: "İndirim kampanyası, kupon kodu ve süre baskısı ile",
      subject: "🔥 3 gün özel: Tüm e-kitaplarda %30 indirim",
      previewText: "SPHERE30 kodu ile kasada — 3 gün sonra biter",
      html: baseTemplate(
        "🔥 3 gün özel: Tüm e-kitaplarda %30 indirim",
        "SPHERE30 kodu ile kasada — 3 gün sonra biter",
        `
        <h2 style="margin:0 0 16px 0;font-size:22px;font-weight:700;color:#1B365D;">%30 indirim — 3 gün özel</h2>
        <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#334155;">Merhaba,</p>
        <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#334155;">Tüm iş İngilizcesi e-kitaplarında <strong style="color:#0ea5e9;">%30 indirim</strong> başladı. 3 gün için geçerli.</p>
        <div style="background:#f0f9ff;border:2px dashed #0ea5e9;border-radius:8px;padding:20px;text-align:center;margin:24px 0;">
          <p style="margin:0 0 8px 0;font-size:13px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Kupon Kodu</p>
          <p style="margin:0;font-size:28px;font-weight:800;color:#1B365D;letter-spacing:0.1em;">SPHERE30</p>
        </div>
        <p style="margin:0;font-size:14px;color:#64748b;">Kod kasada otomatik uygulanır.</p>
        `,
        "Kitapları Görüntüle",
        "https://www.sphereenglish.com/e-kitaplar",
      ),
    },
    {
      id: "announcement_new_ebook",
      name: "Duyuru — Yeni E-Kitap",
      category: "announcement",
      description: "Yeni yayınlanan e-kitap için duyuru",
      subject: "📚 Yeni: [Kitap Adı] yayında",
      previewText: "İş toplantılarında akıcı konuşmak için pratik rehber",
      html: baseTemplate(
        "📚 Yeni: [Kitap Adı] yayında",
        "İş toplantılarında akıcı konuşmak için pratik rehber",
        `
        <h2 style="margin:0 0 16px 0;font-size:22px;font-weight:700;color:#1B365D;">Yeni e-kitabımız yayında</h2>
        <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#334155;">Merhaba,</p>
        <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#334155;"><strong>[Kitap Adı]</strong> artık Sphere English'te. [Kısa açıklama — 1-2 cümle].</p>
        <img src="https://placehold.co/600x300/1B365D/ffffff?text=Kitap+Kapak" alt="[Kitap Adı]" style="display:block;width:100%;max-width:536px;height:auto;border-radius:8px;margin:24px 0;">
        <ul style="margin:0 0 16px 0;padding-left:20px;font-size:15px;line-height:1.7;color:#334155;">
          <li>[Öne çıkan özellik 1]</li>
          <li>[Öne çıkan özellik 2]</li>
          <li>[Öne çıkan özellik 3]</li>
        </ul>
        <p style="margin:16px 0 0 0;font-size:14px;color:#64748b;">Fiyat: <strong style="color:#1B365D;">[XX] TL</strong> — anında PDF indirme</p>
        `,
        "Kitabı İncele",
        "https://www.sphereenglish.com/e-kitaplar/[slug]",
      ),
    },
    {
      id: "newsletter_weekly",
      name: "Newsletter — Haftalık Bülten",
      category: "newsletter",
      description: "Haftalık blog özetleri ve tips",
      subject: "🌟 Sphere Haftalık: Bu haftaki 3 iş İngilizcesi ipucu",
      previewText: "Toplantı, e-posta ve sunum için pratik cümleler",
      html: baseTemplate(
        "🌟 Sphere Haftalık: Bu haftaki 3 iş İngilizcesi ipucu",
        "Toplantı, e-posta ve sunum için pratik cümleler",
        `
        <h2 style="margin:0 0 16px 0;font-size:22px;font-weight:700;color:#1B365D;">Bu haftanın ipuçları</h2>
        <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#334155;">Merhaba, işte bu haftanın iş İngilizcesi ipuçları:</p>

        <div style="border-left:4px solid #0ea5e9;padding:12px 16px;margin:0 0 20px 0;background:#f0f9ff;">
          <h3 style="margin:0 0 8px 0;font-size:16px;font-weight:700;color:#1B365D;">1. [Başlık]</h3>
          <p style="margin:0;font-size:14px;line-height:1.6;color:#475569;">[İpucu açıklaması — 2-3 cümle]</p>
        </div>

        <div style="border-left:4px solid #10b981;padding:12px 16px;margin:0 0 20px 0;background:#f0fdf4;">
          <h3 style="margin:0 0 8px 0;font-size:16px;font-weight:700;color:#1B365D;">2. [Başlık]</h3>
          <p style="margin:0;font-size:14px;line-height:1.6;color:#475569;">[İpucu açıklaması]</p>
        </div>

        <div style="border-left:4px solid #f59e0b;padding:12px 16px;margin:0 0 20px 0;background:#fffbeb;">
          <h3 style="margin:0 0 8px 0;font-size:16px;font-weight:700;color:#1B365D;">3. [Başlık]</h3>
          <p style="margin:0;font-size:14px;line-height:1.6;color:#475569;">[İpucu açıklaması]</p>
        </div>
        `,
        "Blog'da Devamını Oku",
        "https://www.sphereenglish.com/blog",
      ),
    },
    {
      id: "abandoned_cart",
      name: "Terk Sepet — Hatırlatma",
      category: "abandoned_cart",
      description: "Sepette kitap bırakan kullanıcıya nazik hatırlatma",
      subject: "Sepetinde unuttuğun kitap seni bekliyor",
      previewText: "İndirme linkini oluşturmak için ödemeni tamamla",
      html: baseTemplate(
        "Sepetinde unuttuğun kitap seni bekliyor",
        "İndirme linkini oluşturmak için ödemeni tamamla",
        `
        <h2 style="margin:0 0 16px 0;font-size:22px;font-weight:700;color:#1B365D;">Sepetinde bıraktığın kitap</h2>
        <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#334155;">Merhaba,</p>
        <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#334155;">Kısa süre önce sepetine eklediğin kitabı görüyoruz ama ödeme adımını tamamlamamışsın. Sepetin hâlâ hazır — dilediğin zaman kaldığın yerden devam edebilirsin.</p>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin:24px 0;">
          <p style="margin:0 0 4px 0;font-size:13px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Sepette</p>
          <p style="margin:0;font-size:16px;font-weight:700;color:#1B365D;">[Kitap Adı]</p>
          <p style="margin:8px 0 0 0;font-size:14px;color:#64748b;">Tutar: <strong style="color:#1B365D;">[XX] TL</strong></p>
        </div>
        <p style="margin:0;font-size:14px;color:#64748b;line-height:1.6;">Ödemeni tamamlar tamamlamaz kitabın PDF olarak e-posta adresine gönderilir.</p>
        `,
        "Ödemeyi Tamamla",
        "https://www.sphereenglish.com/sepet",
      ),
    },
    {
      id: "welcome",
      name: "Hoş Geldin — Yeni Kullanıcı",
      category: "welcome",
      description: "Kayıt sonrası hoş geldin ve ilk adımlar",
      subject: "Sphere English'e hoş geldin 👋",
      previewText: "İlk dersine 3 adımda başla",
      html: baseTemplate(
        "Sphere English'e hoş geldin 👋",
        "İlk dersine 3 adımda başla",
        `
        <h2 style="margin:0 0 16px 0;font-size:22px;font-weight:700;color:#1B365D;">Aramıza hoş geldin!</h2>
        <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#334155;">Merhaba,</p>
        <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#334155;">Sphere English'e kaydın için teşekkürler. İş İngilizcesi yolculuğuna başlaman için üç kısa adım:</p>

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 20px 0;">
          <tr>
            <td width="40" style="vertical-align:top;padding-right:12px;">
              <div style="width:32px;height:32px;background:#0ea5e9;color:#ffffff;border-radius:50%;text-align:center;line-height:32px;font-weight:700;font-size:14px;">1</div>
            </td>
            <td style="vertical-align:top;padding-bottom:16px;">
              <p style="margin:0 0 4px 0;font-size:15px;font-weight:700;color:#1B365D;">Seviye belirleme testini yap</p>
              <p style="margin:0;font-size:14px;color:#64748b;line-height:1.5;">10 dakikada seviyeni belirle, sana özel öğrenme yolu oluşturalım.</p>
            </td>
          </tr>
          <tr>
            <td width="40" style="vertical-align:top;padding-right:12px;">
              <div style="width:32px;height:32px;background:#0ea5e9;color:#ffffff;border-radius:50%;text-align:center;line-height:32px;font-weight:700;font-size:14px;">2</div>
            </td>
            <td style="vertical-align:top;padding-bottom:16px;">
              <p style="margin:0 0 4px 0;font-size:15px;font-weight:700;color:#1B365D;">AI Konuşma Koçu ile pratik yap</p>
              <p style="margin:0;font-size:14px;color:#64748b;line-height:1.5;">Gerçek zamanlı geri bildirimli konuşma sahneleri seni bekliyor.</p>
            </td>
          </tr>
          <tr>
            <td width="40" style="vertical-align:top;padding-right:12px;">
              <div style="width:32px;height:32px;background:#0ea5e9;color:#ffffff;border-radius:50%;text-align:center;line-height:32px;font-weight:700;font-size:14px;">3</div>
            </td>
            <td style="vertical-align:top;">
              <p style="margin:0 0 4px 0;font-size:15px;font-weight:700;color:#1B365D;">İlerlemeni takip et</p>
              <p style="margin:0;font-size:14px;color:#64748b;line-height:1.5;">Haftalık rapor ve rozetlerle gelişimini gör.</p>
            </td>
          </tr>
        </table>
        `,
        "Platforma Giriş Yap",
        "https://app.sphereenglish.com/login",
      ),
    },
    {
      id: "generic",
      name: "Boş İskelet",
      category: "generic",
      description: "Sıfırdan başlamak için minimal template",
      subject: "[Konu]",
      previewText: "[Preview text — konuyu tamamlayan cümle]",
      html: baseTemplate(
        "[Konu]",
        "[Preview text]",
        `
        <h2 style="margin:0 0 16px 0;font-size:22px;font-weight:700;color:#1B365D;">[Başlık]</h2>
        <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#334155;">Merhaba,</p>
        <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#334155;">[İçerik metni]</p>
        `,
      ),
    },
  ];
}

router.get(
  "/admin/mail-templates/library",
  authMiddleware,
  requireAdmin,
  async (_req: Request, res: Response) => {
    return res.json({ templates: libraryTemplates() });
  },
);

export default router;
