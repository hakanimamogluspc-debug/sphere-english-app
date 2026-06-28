/**
 * WhatsApp Cloud API client (Meta resmi).
 *
 * Endpoint base: https://graph.facebook.com/<version>/<phone-number-id>/messages
 *
 * Instagram'dan farkı:
 *   - Token: System User Access Token (Meta Business Manager'dan)
 *   - Phone Number ID: WhatsApp Business hesabındaki numaranın ID'si
 *   - Body formatı: {messaging_product:"whatsapp", to, type, text:{body}}
 *
 * Env:
 *   WA_PHONE_NUMBER_ID    — WhatsApp numarasının Meta ID'si (kendi numaramız)
 *   WA_ACCESS_TOKEN       — System User long-lived token
 *   WA_BUSINESS_ACCOUNT_ID — WABA ID (self-mesaj filtre için)
 *   WA_API_VERSION        — opsiyonel, default "v21.0"
 */

const WA_API_BASE = "https://graph.facebook.com";
const DEFAULT_API_VERSION = "v21.0";

function getApiVersion(): string {
  return process.env["WA_API_VERSION"] ?? DEFAULT_API_VERSION;
}

function getAccessToken(): string {
  const t = process.env["WA_ACCESS_TOKEN"] ?? "";
  if (!t) throw new Error("WA_ACCESS_TOKEN env tanımlı değil");
  return t;
}

function getPhoneNumberId(): string {
  const id = process.env["WA_PHONE_NUMBER_ID"] ?? "";
  if (!id) throw new Error("WA_PHONE_NUMBER_ID env tanımlı değil");
  return id;
}

export interface WaSendResult {
  ok: boolean;
  waMessageId?: string;
  error?: string;
  errorCode?: number;
  errorSubcode?: number;
}

/**
 * Bir WhatsApp kullanıcısına text mesajı gönder.
 *
 * @param recipientPhone E.164 format (örn. "905551112233", + ve boşluksuz)
 * @param text           Mesaj metni (max ~4096 karakter)
 */
export async function sendWhatsAppMessage(
  recipientPhone: string,
  text: string,
): Promise<WaSendResult> {
  const token = getAccessToken();
  const phoneNumberId = getPhoneNumberId();
  const url = `${WA_API_BASE}/${getApiVersion()}/${phoneNumberId}/messages`;

  // WhatsApp text limit 4096 ama UX için 1500'de kes
  const safeText = text.length > 1500
    ? text.slice(0, 1500).replace(/\s+\S*$/, "") + "…"
    : text;

  // Telefon numarasını normalize: + ve boşluklar kalksın, sadece rakam
  const normalizedPhone = recipientPhone.replace(/[^\d]/g, "");

  const requestBody = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: normalizedPhone,
    type: "text",
    text: { preview_url: true, body: safeText },
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(requestBody),
    });
    const rawText = await res.text();
    let data: any = {};
    try { data = JSON.parse(rawText); } catch { data = { raw: rawText }; }

    if (!res.ok) {
      const err = data?.error ?? {};
      console.error(
        `[wa-api] sendMessage başarısız: status=${res.status} ` +
          `to=${normalizedPhone} message="${err?.message ?? rawText.slice(0, 200)}" ` +
          `code=${err?.code} subcode=${err?.error_subcode} ` +
          `fbtrace_id=${err?.fbtrace_id}`,
      );
      console.error("[wa-api] Full response body:", rawText.slice(0, 500));
      return {
        ok: false,
        error: err?.message ?? rawText.slice(0, 200) ?? `HTTP ${res.status}`,
        errorCode: err?.code,
        errorSubcode: err?.error_subcode,
      };
    }

    // Cloud API response: { messaging_product, contacts:[], messages:[{id}] }
    const messageId = data?.messages?.[0]?.id;
    console.info(`[wa-api] sendMessage OK: messageId=${messageId}`);
    return { ok: true, waMessageId: messageId };
  } catch (e: any) {
    console.error("[wa-api] sendMessage HATA (network):", e?.message);
    return { ok: false, error: e?.message ?? "Bağlantı hatası" };
  }
}

/**
 * Read receipt — kullanıcı mesajını "görüldü" işaretle.
 * Opsiyonel ama WhatsApp UX'i için iyi.
 */
export async function markMessageAsRead(waMessageId: string): Promise<void> {
  const token = getAccessToken();
  const phoneNumberId = getPhoneNumberId();
  const url = `${WA_API_BASE}/${getApiVersion()}/${phoneNumberId}/messages`;

  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        status: "read",
        message_id: waMessageId,
      }),
    });
  } catch {
    // Best-effort, fail silently
  }
}
