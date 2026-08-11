import crypto from "crypto";

const PIXEL_ID   = "2156406151837976";
const API_VERSION = "v19.0";
const BASE_URL    = `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events`;

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

interface MetaEventPayload {
  eventName: string;
  email?: string;
  phone?: string;
  sourceUrl?: string;
  clientIp?: string;
  clientUserAgent?: string;
  fbc?: string;
  fbp?: string;
}

export async function sendMetaEvent(payload: MetaEventPayload): Promise<void> {
  const token = process.env.META_CONVERSIONS_API_TOKEN;
  if (!token) {
    console.warn("[Meta CAPI] META_CONVERSIONS_API_TOKEN eksik, event gönderilmedi.");
    return;
  }

  const userData: Record<string, string> = {};
  if (payload.email)          userData.em  = sha256(payload.email);
  if (payload.phone)          userData.ph  = sha256(payload.phone.replace(/\D/g, ""));
  if (payload.clientIp)       userData.client_ip_address   = payload.clientIp;
  if (payload.clientUserAgent) userData.client_user_agent  = payload.clientUserAgent;
  if (payload.fbc)            userData.fbc = payload.fbc;
  if (payload.fbp)            userData.fbp = payload.fbp;

  const body = {
    data: [
      {
        event_name:       payload.eventName,
        event_time:       Math.floor(Date.now() / 1000),
        event_source_url: payload.sourceUrl ?? "https://app.sphereenglish.com",
        action_source:    "website",
        user_data:        userData,
      },
    ],
  };

  try {
    const res = await fetch(`${BASE_URL}?access_token=${token}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[Meta CAPI] Hata:", err);
    } else {
      console.log(`[Meta CAPI] Event gönderildi: ${payload.eventName}`);
    }
  } catch (e) {
    console.error("[Meta CAPI] Bağlantı hatası:", e);
  }
}
