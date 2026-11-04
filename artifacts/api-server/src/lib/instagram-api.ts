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

import { getInstagramToken } from "./instagram-token.js";

const IG_API_BASE = "https://graph.instagram.com";
const FB_API_BASE = "https://graph.facebook.com";

/**
 * İki tür token desteklenir:
 *  - Instagram Login token'ı ("IG…", 60 gün, otomatik yenilenir) → graph.instagram.com, /me/messages
 *  - Meta Business / sistem kullanıcısı token'ı ("EAA…", süresiz) → graph.facebook.com.
 *    Bu durumda Instagram mesajları, Instagram hesabının bağlı olduğu Facebook SAYFASI üzerinden
 *    gönderilir: sistem kullanıcısına atanmış sayfalar arasından Instagram hesabımıza bağlı olanı
 *    bulunur, o sayfanın token'ı ile /{sayfa-id}/messages çağrılır.
 */
function isInstagramLoginToken(token: string): boolean {
  return token.startsWith("IG");
}

interface Sender { base: string; path: string; token: string }
let pageCache: { at: number; userToken: string; pageId: string; pageToken: string } | null = null;

/** Sistem kullanıcısı token'ından, Instagram hesabımıza bağlı Facebook Sayfası'nın token'ını bul (1 saat önbellek). */
async function resolvePage(userToken: string): Promise<{ pageId: string; pageToken: string }> {
  if (pageCache && pageCache.userToken === userToken && Date.now() - pageCache.at < 3600_000) {
    return { pageId: pageCache.pageId, pageToken: pageCache.pageToken };
  }
  const url = `${FB_API_BASE}/${getApiVersion()}/me/accounts?fields=id,name,access_token,instagram_business_account&limit=100&access_token=${encodeURIComponent(userToken)}`;
  const r = await fetch(url);
  const body: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body?.error?.message ?? `Sayfa listesi alınamadı (HTTP ${r.status})`);
  const pages: any[] = body?.data ?? [];
  const igId = process.env["IG_BUSINESS_ACCOUNT_ID"] ?? "";
  const page = pages.find((p) => p?.instagram_business_account?.id === igId) ?? (pages.length === 1 ? pages[0] : null);
  if (!page?.access_token) {
    throw new Error(
      pages.length === 0
        ? "Token'ın sahibine hiçbir Facebook Sayfası atanmamış (Business ayarları → Sistem kullanıcısı → Varlık ata → Sayfa)"
        : `Instagram hesabına (${igId}) bağlı sayfa bulunamadı; atanmış sayfalar: ${pages.map((p) => p.name).join(", ")}`,
    );
  }
  pageCache = { at: Date.now(), userToken, pageId: String(page.id), pageToken: String(page.access_token) };
  return { pageId: pageCache.pageId, pageToken: pageCache.pageToken };
}

/** Bu token için hangi adres / yol / token ile çağrı yapılacağı */
async function sender(token: string): Promise<Sender> {
  if (isInstagramLoginToken(token)) return { base: IG_API_BASE, path: "me", token };
  const { pageId, pageToken } = await resolvePage(token);
  return { base: FB_API_BASE, path: pageId, token: pageToken };
}

const DEFAULT_API_VERSION = "v21.0";

function getApiVersion(): string {
  return process.env["IG_API_VERSION"] ?? DEFAULT_API_VERSION;
}

/** Otomatik yenilenen token (bkz. lib/instagram-token.ts) — ilk değer IG_PAGE_ACCESS_TOKEN */
function getAccessToken(): Promise<string> {
  return getInstagramToken();
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
  const token = await getAccessToken();
  // Yeni Instagram Login API: `me/messages` kullanılır (token'a bağlı, kestirme)
  // Eski Page-based API: `<page-id>/messages`. Bizim yeni Instagram Login API var.
  let sd: Sender;
  try {
    sd = await sender(token);
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Gönderim adresi belirlenemedi" };
  }
  const url = `${sd.base}/${getApiVersion()}/${sd.path}/messages?access_token=${encodeURIComponent(sd.token)}`;

  // Instagram message text limit ~1000; yine de 950'de kesip cümle bitirelim
  const safeText = text.length > 950 ? text.slice(0, 950).replace(/\s+\S*$/, "") + "…" : text;

  const requestBody = {
    recipient: { id: recipientIgId },
    message: { text: safeText },
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });
    // Hatayı tam yakalamak için önce text olarak oku
    const rawText = await res.text();
    let data: any = {};
    try {
      data = JSON.parse(rawText);
    } catch {
      data = { raw: rawText };
    }

    if (!res.ok) {
      const err = data?.error ?? {};
      // Detaylı log — recipient ID, status, body hepsi
      console.error(
        `[ig-api] sendMessage başarısız: status=${res.status} ` +
          `recipient=${recipientIgId} ` +
          `message="${err?.message ?? rawText.slice(0, 200)}" ` +
          `code=${err?.code} subcode=${err?.error_subcode} ` +
          `type=${err?.type} ` +
          `fbtrace_id=${err?.fbtrace_id}`,
      );
      console.error("[ig-api] Full response body:", rawText.slice(0, 500));
      return {
        ok: false,
        error: err?.message ?? rawText.slice(0, 200) ?? `HTTP ${res.status}`,
        errorCode: err?.code,
        errorSubcode: err?.error_subcode,
      };
    }
    console.info(`[ig-api] sendMessage OK: messageId=${data?.message_id}`);
    return {
      ok: true,
      igMessageId: data?.message_id,
    };
  } catch (e: any) {
    console.error("[ig-api] sendMessage HATA (network):", e?.message);
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
  const token = await getAccessToken();
  let sd: Sender;
  try {
    sd = await sender(token);
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Gönderim adresi belirlenemedi" };
  }
  const url = `${sd.base}/${getApiVersion()}/${commentId}/replies?access_token=${encodeURIComponent(sd.token)}`;

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
  const token = await getAccessToken();
  const sd = await sender(token).catch(() => null);
  if (!sd) return null;
  const url = `${sd.base}/${getApiVersion()}/${igUserId}?fields=username,name,profile_pic&access_token=${encodeURIComponent(sd.token)}`;
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
