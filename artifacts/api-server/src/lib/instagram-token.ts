/**
 * Instagram erişim anahtarı (token) yönetimi — süresi dolmasın diye otomatik yenileme.
 *
 * Neden: Instagram Login API'nin "long-lived" token'ı 60 gün geçerli. Yenilenmezse
 * bot mesajları alır ama CEVAP GÖNDEREMEZ ("Session has expired"). Ağustos 2026'da bu oldu.
 *
 * Nasıl:
 *  - Geçerli token veritabanında (instagram_bot_settings.access_token) tutulur.
 *  - Ortam değişkenindeki IG_PAGE_ACCESS_TOKEN değişirse (elle yeni token girildiyse) o benimsenir.
 *  - Zamanlayıcı her gün kontrol eder; token 7 günden eskiyse Meta'dan yenisini alır (60 gün daha).
 *    Yenileme yalnızca token HENÜZ GEÇERLİYKEN yapılabilir — süresi dolmuş token elle yenilenmeli.
 *  - Süre bitmesine 10 günden az kalmışsa ve yenilenemiyorsa yöneticiye e-posta gider.
 */

import crypto from "node:crypto";
import { pool } from "@workspace/db";

const IG_API_BASE = "https://graph.instagram.com";

async function getSetting(key: string): Promise<string | null> {
  const r = await pool.query(`SELECT value FROM instagram_bot_settings WHERE key = $1`, [key]);
  return (r.rows[0]?.value as string | undefined) ?? null;
}

async function setSetting(key: string, value: string): Promise<void> {
  await pool.query(
    `INSERT INTO instagram_bot_settings (key, value, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [key, value],
  );
}

const hash = (t: string) => crypto.createHash("sha256").update(t).digest("hex").slice(0, 16);

/**
 * Kullanılacak token. Ortam değişkeni değiştiyse onu benimser (yeni elle girilen token),
 * aksi hâlde veritabanındaki (otomatik yenilenmiş) token'ı kullanır.
 */
export async function getInstagramToken(): Promise<string> {
  const envToken = process.env["IG_PAGE_ACCESS_TOKEN"] ?? "";
  try {
    const [dbToken, envHash] = await Promise.all([getSetting("access_token"), getSetting("access_token_env_hash")]);
    if (envToken && hash(envToken) !== envHash) {
      // Ortamdaki token yeni → benimse; yenileme saatini sıfırla
      await setSetting("access_token", envToken);
      await setSetting("access_token_env_hash", hash(envToken));
      await setSetting("access_token_refreshed_at", new Date().toISOString());
      return envToken;
    }
    if (dbToken) return dbToken;
  } catch {
    /* veritabanı okunamazsa ortamdakiyle devam */
  }
  if (!envToken) throw new Error("IG_PAGE_ACCESS_TOKEN env tanımlı değil");
  return envToken;
}

export interface TokenStatus {
  refreshedAt: string | null;
  expiresAt: string | null;
  lastError: string | null;
}

export async function getInstagramTokenStatus(): Promise<TokenStatus> {
  const [refreshedAt, expiresAt, lastError] = await Promise.all([
    getSetting("access_token_refreshed_at"),
    getSetting("access_token_expires_at"),
    getSetting("access_token_last_error"),
  ]);
  return { refreshedAt, expiresAt, lastError };
}

/** Meta'dan yeni 60 günlük token al. Token henüz geçerli olmalı. */
export async function refreshInstagramToken(): Promise<{ ok: boolean; expiresAt?: string; error?: string }> {
  try {
    const current = await getInstagramToken();
    const url = `${IG_API_BASE}/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(current)}`;
    const r = await fetch(url);
    const body: any = await r.json().catch(() => ({}));
    if (!r.ok || !body?.access_token) {
      const error = body?.error?.message ?? `HTTP ${r.status}`;
      await setSetting("access_token_last_error", `${new Date().toISOString()} ${error}`);
      return { ok: false, error };
    }
    const expiresAt = new Date(Date.now() + Number(body.expires_in ?? 60 * 86400) * 1000).toISOString();
    await setSetting("access_token", String(body.access_token));
    await setSetting("access_token_refreshed_at", new Date().toISOString());
    await setSetting("access_token_expires_at", expiresAt);
    await setSetting("access_token_last_error", "");
    return { ok: true, expiresAt };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "bilinmeyen" };
  }
}

/** Günlük kontrol: 7 günden eskiyse yenile. Yenilenemiyor ve süre azsa uyarı döndür. */
export async function maybeRefreshInstagramToken(): Promise<{ action: string; error?: string; warn?: boolean }> {
  if (!process.env["IG_PAGE_ACCESS_TOKEN"]) return { action: "token-yok" };
  await getInstagramToken(); // ortamdaki yeni token varsa önce benimse
  const refreshedAt = await getSetting("access_token_refreshed_at");
  const ageDays = refreshedAt ? (Date.now() - new Date(refreshedAt).getTime()) / 86400000 : Infinity;
  if (ageDays < 7) return { action: "gerek-yok" };
  const r = await refreshInstagramToken();
  if (r.ok) return { action: "yenilendi" };
  const expiresAt = await getSetting("access_token_expires_at");
  const daysLeft = expiresAt ? (new Date(expiresAt).getTime() - Date.now()) / 86400000 : null;
  // Son geçerlilik bilinmiyorsa (ilk kurulum) ya da 10 günden azsa uyar
  return { action: "yenilenemedi", error: r.error, warn: daysLeft === null || daysLeft < 10 };
}

/** Gönderim token hatasıyla başarısız olduysa yöneticiyi günde en fazla bir kez uyar. */
export async function alertInstagramTokenFailure(error: string): Promise<void> {
  if (!/access token|session has expired|OAuthException|code\s*190/i.test(error)) return;
  try {
    const today = new Date().toISOString().slice(0, 10);
    if ((await getSetting("token_alert_date")) === today) return;
    await setSetting("token_alert_date", today);
    const { notifyInstagramTokenProblem } = await import("./admin-notifications.js");
    await notifyInstagramTokenProblem({ error });
  } catch { /* uyarı gönderilemezse sessiz geç */ }
}
