/**
 * B2B Outbound E-posta Sağlayıcı Wrapper
 *
 * SendGrid / Postmark / Resend arasında geçiş yapılabilir tek arayüz.
 * Provider env üzerinden seçilir: OUTBOUND_EMAIL_PROVIDER=sendgrid|postmark|resend
 */

type EmailPayload = {
  to: string;
  toName?: string;
  from: string;
  fromName?: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
  /** Kampanya + lead izleme için custom header */
  customArgs?: Record<string, string>;
  /** Reply-to threading için */
  headers?: Record<string, string>;
};

type SendResult = {
  ok: boolean;
  messageId?: string;
  error?: string;
};

/**
 * SendGrid v3 üzerinden gönderim.
 * ENV:
 *   SENDGRID_API_KEY
 *   SENDGRID_FROM_EMAIL (default from)
 */
async function sendViaSendGrid(payload: EmailPayload): Promise<SendResult> {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) return { ok: false, error: "SENDGRID_API_KEY yok" };

  try {
    const body = {
      personalizations: [
        {
          to: [{ email: payload.to, name: payload.toName }],
          custom_args: payload.customArgs,
          headers: payload.headers,
        },
      ],
      from: { email: payload.from, name: payload.fromName },
      reply_to: payload.replyTo ? { email: payload.replyTo } : undefined,
      subject: payload.subject,
      content: [
        { type: "text/plain", value: payload.text },
        { type: "text/html", value: payload.html },
      ],
      // Tracking — SendGrid'de default açık ama emin olalım
      tracking_settings: {
        click_tracking: { enable: true, enable_text: false },
        open_tracking: { enable: true },
      },
    };

    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (res.status === 202) {
      const messageId = res.headers.get("x-message-id") || undefined;
      return { ok: true, messageId };
    }

    const errText = await res.text();
    return { ok: false, error: `SendGrid ${res.status}: ${errText}` };
  } catch (e: any) {
    return { ok: false, error: e?.message || "sendgrid unknown error" };
  }
}

/**
 * Postmark v1 üzerinden gönderim.
 * ENV:
 *   POSTMARK_SERVER_TOKEN
 */
async function sendViaPostmark(payload: EmailPayload): Promise<SendResult> {
  const token = process.env.POSTMARK_SERVER_TOKEN;
  if (!token) return { ok: false, error: "POSTMARK_SERVER_TOKEN yok" };

  try {
    const res = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Postmark-Server-Token": token,
      },
      body: JSON.stringify({
        From: payload.fromName ? `${payload.fromName} <${payload.from}>` : payload.from,
        To: payload.toName ? `${payload.toName} <${payload.to}>` : payload.to,
        ReplyTo: payload.replyTo,
        Subject: payload.subject,
        HtmlBody: payload.html,
        TextBody: payload.text,
        MessageStream: "outbound",
        Headers: payload.headers
          ? Object.entries(payload.headers).map(([Name, Value]) => ({ Name, Value }))
          : undefined,
        Metadata: payload.customArgs,
        TrackOpens: true,
        TrackLinks: "HtmlOnly",
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      return { ok: true, messageId: (data as any)?.MessageID };
    }
    return { ok: false, error: `Postmark ${res.status}: ${(data as any)?.Message}` };
  } catch (e: any) {
    return { ok: false, error: e?.message || "postmark unknown error" };
  }
}

/**
 * Resend v1 üzerinden gönderim.
 * ENV:
 *   RESEND_API_KEY
 */
async function sendViaResend(payload: EmailPayload): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY yok" };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: payload.fromName ? `${payload.fromName} <${payload.from}>` : payload.from,
        to: [payload.to],
        // Resend geçersiz reply_to'ya 422 döndürüyor — sadece geçerli format geçir
        // Kabul: "email@x.com" veya "Name <email@x.com>"
        ...(payload.replyTo && /^([^<>]*<)?[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+>?$/.test(payload.replyTo.trim())
          ? { reply_to: payload.replyTo.trim() }
          : {}),
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
        headers: payload.headers,
        tags: payload.customArgs
          ? Object.entries(payload.customArgs).map(([name, value]) => ({ name, value }))
          : undefined,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, messageId: (data as any)?.id };
    return { ok: false, error: `Resend ${res.status}: ${(data as any)?.message}` };
  } catch (e: any) {
    return { ok: false, error: e?.message || "resend unknown error" };
  }
}

/**
 * Provider'ı env üzerinden seç ve gönder.
 */
export async function sendOutboundEmail(payload: EmailPayload): Promise<SendResult> {
  const provider = (process.env.OUTBOUND_EMAIL_PROVIDER || "sendgrid").toLowerCase();
  switch (provider) {
    case "sendgrid": return sendViaSendGrid(payload);
    case "postmark": return sendViaPostmark(payload);
    case "resend":   return sendViaResend(payload);
    default:
      return { ok: false, error: `Bilinmeyen provider: ${provider}` };
  }
}

/**
 * Template rendering — {{firstName}}, {{company}}, {{position}} vs.
 * lead objesinden değişkenleri doldurur.
 */
export function renderTemplate(
  template: string,
  lead: {
    firstName?: string | null; lastName?: string | null; fullName?: string | null;
    company?: string | null; jobTitle?: string | null;
    email?: string | null;
    [k: string]: any;
  },
  extra: Record<string, string> = {},
): string {
  const vars: Record<string, string> = {
    firstName: lead.firstName || lead.fullName?.split(" ")[0] || "",
    lastName: lead.lastName || lead.fullName?.split(" ").slice(1).join(" ") || "",
    fullName: lead.fullName || `${lead.firstName || ""} ${lead.lastName || ""}`.trim(),
    company: lead.company || "",
    position: lead.jobTitle || "",
    jobTitle: lead.jobTitle || "",
    email: lead.email || "",
    ...extra,
  };
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => vars[key] ?? "");
}
