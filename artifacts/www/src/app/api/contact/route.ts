import { NextRequest, NextResponse } from 'next/server';
import {
  TransactionalEmailsApi,
  TransactionalEmailsApiApiKeys,
  SendSmtpEmail,
} from '@getbrevo/brevo';
import crypto from 'crypto';

const SPHERE_API_URL = 'https://app.sphereenglish.com/api/marketing/contact';
const META_PIXEL_ID  = '2156406151837976';
const META_API_VER   = 'v19.0';

async function sendMetaLead({
  email, firstName, lastName, phone, clientIp, clientUserAgent, fbc, fbp,
}: {
  email: string; firstName?: string; lastName?: string; phone?: string;
  clientIp?: string; clientUserAgent?: string; fbc?: string; fbp?: string;
}) {
  const token = process.env.META_CONVERSIONS_API_TOKEN;
  if (!token) return;

  const sha256 = (v: string) =>
    crypto.createHash('sha256').update(v.trim().toLowerCase()).digest('hex');

  const userData: Record<string, string> = {};
  if (email)     userData.em = sha256(email);
  if (firstName) userData.fn = sha256(firstName);
  if (lastName)  userData.ln = sha256(lastName);
  if (phone)     userData.ph = sha256(phone.replace(/\D/g, ''));
  if (clientIp)  userData.client_ip_address = clientIp;
  if (clientUserAgent) userData.client_user_agent = clientUserAgent;
  if (fbc) userData.fbc = fbc;
  if (fbp) userData.fbp = fbp;

  const body = {
    data: [{
      event_name: 'Lead',
      event_time: Math.floor(Date.now() / 1000),
      event_source_url: 'https://www.sphereenglish.com/iletisim',
      action_source: 'website',
      user_data: userData,
    }],
  };

  try {
    const res = await fetch(
      `https://graph.facebook.com/${META_API_VER}/${META_PIXEL_ID}/events?access_token=${token}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    );
    if (!res.ok) console.error('[Meta CAPI] Hata:', await res.text());
    else console.log('[Meta CAPI] Lead eventi gönderildi:', email ? sha256(email).slice(0, 8) + '...' : '?');
  } catch (e) {
    console.error('[Meta CAPI] Bağlantı hatası:', e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, company, sector, teamSize, message } = body;

    if (!name || !email || !company) {
      return NextResponse.json({ error: 'Zorunlu alanlar eksik.' }, { status: 400 });
    }

    // ── 1. Lead'i Sphere English veritabanına kaydet (arka planda) ──
    fetch(SPHERE_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        email,
        phone: '',
        company,
        message: `Sektör: ${sector || '—'} | Çalışan: ${teamSize || '—'} | Mesaj: ${message || '—'}`,
        source: 'website-iletisim',
      }),
    }).catch((err) => console.error('Lead kayıt hatası:', err));

    // ── 2. Meta Conversions API — Lead eventi (ad/soyad/e-posta ile gelişmiş eşleştirme) ──
    const nameParts  = name.trim().split(' ');
    const firstName  = nameParts[0] || undefined;
    const lastName   = nameParts.length > 1 ? nameParts.slice(1).join(' ') : undefined;
    const forwardedIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    const clientIp    = forwardedIp || req.headers.get('x-real-ip') || undefined;
    sendMetaLead({
      email,
      firstName,
      lastName,
      clientIp,
      clientUserAgent: req.headers.get('user-agent') || undefined,
      fbc: req.cookies.get('_fbc')?.value,
      fbp: req.cookies.get('_fbp')?.value,
    }).catch(() => {});

    // ── 3. Brevo ile e-posta gönder ──
    const apiKey = (process.env.BREVO_API_KEY || '').trim();
    if (!apiKey) {
      console.error('BREVO_API_KEY is not set');
      return NextResponse.json({ error: 'E-posta servisi yapılandırılmamış.' }, { status: 500 });
    }

    const emailApi = new TransactionalEmailsApi();
    emailApi.setApiKey(TransactionalEmailsApiApiKeys.apiKey, apiKey);

    const htmlContent = `
      <html>
        <body style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #082567; padding: 24px; border-radius: 4px; margin-bottom: 24px;">
            <h1 style="color: white; margin: 0; font-size: 22px;">Yeni Teklif Talebi</h1>
            <p style="color: rgba(255,255,255,0.7); margin: 8px 0 0; font-size: 14px;">sphereenglish.com üzerinden gönderildi</p>
          </div>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 12px 0; border-bottom: 1px solid #eee; font-weight: bold; width: 140px; color: #555; font-size: 14px;">Ad Soyad</td>
              <td style="padding: 12px 0; border-bottom: 1px solid #eee; font-size: 14px;">${name}</td>
            </tr>
            <tr>
              <td style="padding: 12px 0; border-bottom: 1px solid #eee; font-weight: bold; color: #555; font-size: 14px;">E-posta</td>
              <td style="padding: 12px 0; border-bottom: 1px solid #eee; font-size: 14px;"><a href="mailto:${email}" style="color: #082567;">${email}</a></td>
            </tr>
            <tr>
              <td style="padding: 12px 0; border-bottom: 1px solid #eee; font-weight: bold; color: #555; font-size: 14px;">Şirket</td>
              <td style="padding: 12px 0; border-bottom: 1px solid #eee; font-size: 14px;">${company}</td>
            </tr>
            <tr>
              <td style="padding: 12px 0; border-bottom: 1px solid #eee; font-weight: bold; color: #555; font-size: 14px;">Sektör</td>
              <td style="padding: 12px 0; border-bottom: 1px solid #eee; font-size: 14px;">${sector || '—'}</td>
            </tr>
            <tr>
              <td style="padding: 12px 0; border-bottom: 1px solid #eee; font-weight: bold; color: #555; font-size: 14px;">Çalışan Sayısı</td>
              <td style="padding: 12px 0; border-bottom: 1px solid #eee; font-size: 14px;">${teamSize || '—'}</td>
            </tr>
            <tr>
              <td style="padding: 12px 0; font-weight: bold; color: #555; font-size: 14px; vertical-align: top;">Mesaj</td>
              <td style="padding: 12px 0; font-size: 14px;">${message ? message.replace(/\n/g, '<br>') : '—'}</td>
            </tr>
          </table>
          <div style="margin-top: 24px; padding: 16px; background: #f5f5f5; border-radius: 4px; font-size: 12px; color: #888;">
            Bu e-posta Sphere English teklif formu aracılığıyla otomatik olarak gönderilmiştir.
          </div>
        </body>
      </html>
    `;

    const sendSmtpEmail: SendSmtpEmail = {
      sender: { name: 'Sphere English Form', email: 'info@sphereenglish.com' },
      to: [{ email: 'info@sphereenglish.com', name: 'Sphere English' }],
      replyTo: { email: email, name: name },
      subject: `Yeni Teklif Talebi — ${company}`,
      htmlContent,
      textContent: `Yeni Teklif Talebi\n\nAd Soyad: ${name}\nE-posta: ${email}\nŞirket: ${company}\nSektör: ${sector || '—'}\nÇalışan Sayısı: ${teamSize || '—'}\nMesaj: ${message || '—'}`,
    };

    const result = await emailApi.sendTransacEmail(sendSmtpEmail);
    console.log('Email sent successfully. Message ID:', result.body?.messageId);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    const errBody = error?.response?.body || error?.body;
    const errMessage = errBody?.message || error?.message || 'Bilinmeyen hata';
    console.error('Brevo SDK error:', JSON.stringify(errBody || error));
    return NextResponse.json(
      { error: `E-posta gönderilemedi: ${errMessage}` },
      { status: 500 }
    );
  }
}
