/**
 * Instagram Graph API client (yeni Instagram Login akışı).
 *
 * 2024'te Meta Instagram API'sini yeniledi — artık eski Facebook Page Access Token
 * yerine direkt Instagram User Access Token kullanıyoruz.
 *
 * Endpoint base: https://graph.instagram.com/<version>/...
 *
 * İki ana fonksiyon:
 *   - sendInstagramMessage()  → DM cevap
 *   - replyToInstagramComment() → Post yorumuna cevap
 *
 * Env:
 *   IG_PAGE_ACCESS_TOKEN     — Long-lived Instagram User Access Token
 *   IG_BUSINESS_ACCOUNT_ID   — Bizim Instagram hesabımızın ID'si
 *   IG_API_VERSION           — opsiyonel, default "v21.0"
 */

const IG_API_BASE = "https://graph.instagram.com";
const DEFAULT_API_VERSION = "v21.0";

function getApiVersion(): string {
  return process.env["IG_API_VERSION"] ?? DEFAULT_API_VERSION;
}

function getAccessToken(): string {
  const t = process.env["IG_PAGE_ACCESS_TOKEN"] ?? "";
  if (!t) throw new Error("IG_PAGE_ACCESS_TOKEN env tanımlı değil");
  return t;
}

function getBusinessAccountId(): string {
  const id = process.env["IG_BUSINESS_ACCOUNT_ID"] ?? "";
  if (!id) throw new Error("IG_BUSINESS_ACCOUNT_ID env tanımlı değil");
  return id;
}

export interface SendResult {
  ok: boolean;
  igMessageId?: string;
  error?: string;
  errorCode?: number;
  errorSubcode?: number;
}

/**
 * Bir Instagram kullanıcısına DM gönder.
 *
 * @param recipientIgId  Alıcının IG kullanıcı ID'si (webhook'tan gelir)
 * @param text           Mesaj metni (max 1000 karakter Instagram limit)
 */
export async function sendInstagramMessage(
  recipientIgId: string,
  text: string,
): Promise<SendResult> {
  const ourId = getBusinessAccountId();
  const token = getAccessToken();
  const url = `${IG_API_BASE}/${getApiVersion()}/${ourId}/messages?access_token=${encodeURIComponent(token)}`;

  // Instagram message text limit ~1000; yine de 950'de kesip cümle bitirelim
  const safeText = text.length > 950 ? text.slice(0, 950).replace(/\s+\S*$/, "") + "…" : text;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: recipientIgId },
        message: { text: safeText },
      }),
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = data?.error ?? {};
      console.error("[ig-api] sendMessage başarısız:", res.status, err?.message);
      return {
        ok: false,
        error: err?.message ?? `HTTP ${res.status}`,
        errorCode: err?.code,
        errorSubcode: err?.error_subcode,
      };
    }
    return {
      ok: true,
      igMessageId: data?.message_id,
    };
  } catch (e: any) {
    console.error("[ig-api] sendMessage HATA:", e?.message);
    return { ok: false, error: e?.message ?? "Bağlantı hatası" };
  }
}

/**
 * Bir post yorumuna cevap gönder.
 *
 * @param commentId  Webhook'tan gelen yorum ID'si
 * @param text       Cevap metni
 */
export async function replyToInstagramComment(
  commentId: string,
  text: string,
): Promise<SendResult> {
  const token = getAccessToken();
  const url = `${IG_API_BASE}/${getApiVersion()}/${commentId}/replies?access_token=${encodeURIComponent(token)}`;

  const safeText = text.length > 280 ? text.slice(0, 280).replace(/\s+\S*$/, "") + "…" : text;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: safeText }),
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = data?.error ?? {};
      console.error("[ig-api] replyToComment başarısız:", res.status, err?.message);
      return {
        ok: false,
        error: err?.message ?? `HTTP ${res.status}`,
        errorCode: err?.code,
        errorSubcode: err?.error_subcode,
      };
    }
    return {
      ok: true,
      igMessageId: data?.id,
    };
  } catch (e: any) {
    console.error("[ig-api] replyToComment HATA:", e?.message);
    return { ok: false, error: e?.message ?? "Bağlantı hatası" };
  }
}

/**
 * Bir kullanıcının profil bilgisini al (username, name, profile pic).
 * Thread oluştururken faydalı — admin panelinde isim görmek için.
 */
export async function fetchUserProfile(igUserId: string): Promise<{
  username?: string;
  name?: string;
  profilePicUrl?: string;
} | null> {
  const token = getAccessToken();
  const url = `${IG_API_BASE}/${getApiVersion()}/${igUserId}?fields=username,name,profile_pic&access_token=${encodeURIComponent(token)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data: any = await res.json();
    return {
      username: data?.username,
      name: data?.name,
      profilePicUrl: data?.profile_pic,
    };
  } catch {
    return null;
  }
}
