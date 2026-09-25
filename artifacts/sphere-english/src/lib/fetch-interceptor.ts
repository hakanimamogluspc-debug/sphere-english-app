// Module-level token store — updated synchronously on login/logout
let _token: string | null = null;

// Cookie helpers — Capacitor WebView'de localStorage bazen resetleniyor;
// cookie ile fallback persist sağlıyoruz (2 yıl geçerli).
const COOKIE_NAME = "sphere_token";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 730; // 2 yıl

function readCookie(name: string): string | null {
  try {
    const parts = document.cookie.split(";");
    for (const p of parts) {
      const [k, ...rest] = p.trim().split("=");
      if (k === name) return decodeURIComponent(rest.join("="));
    }
  } catch { /* ignore */ }
  return null;
}

function writeCookie(name: string, value: string | null) {
  try {
    if (value) {
      document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax`;
    } else {
      document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
    }
  } catch { /* ignore */ }
}

// İlk yüklemede: önce localStorage, olmazsa cookie'den al.
// Cookie'den geldiyse hemen localStorage'a da yaz (senkronize kalsın).
try {
  _token = localStorage.getItem("sphere_token");
  if (!_token) {
    const fromCookie = readCookie(COOKIE_NAME);
    if (fromCookie) {
      _token = fromCookie;
      try { localStorage.setItem("sphere_token", fromCookie); } catch {}
    }
  }
} catch { /* localStorage blocked in some iframe contexts */ }

export function setInterceptorToken(token: string | null) {
  _token = token;
  try {
    if (token) localStorage.setItem("sphere_token", token);
    else localStorage.removeItem("sphere_token");
  } catch { /* ignore */ }
  // Cookie'yi de senkronize et
  writeCookie(COOKIE_NAME, token);
}

export function getInterceptorToken(): string | null {
  return _token;
}

// GÜVENLİK: Authorization header SADECE kendi API'mıza gönderilmeli.
// Aksi halde Google Analytics, Meta Pixel, image CDN gibi 3. partilere JWT sızar.
function shouldAttachAuth(url: string): boolean {
  try {
    // Göreli URL'ler aynı origin'de — güvenle ekleyebiliriz.
    if (url.startsWith("/")) return true;

    const parsed = new URL(url, window.location.origin);

    // Aynı origin → kendi API'mız
    if (parsed.origin === window.location.origin) return true;

    // Üretimde API farklı subdomain'de olabilir (app.sphereenglish.com → api.sphereenglish.com).
    // Burada izin verilen API host'larını whitelist'liyoruz.
    const apiAllowlist = [
      "app.sphereenglish.com",
      "api.sphereenglish.com",
    ];
    if (apiAllowlist.includes(parsed.hostname)) return true;

    // VITE_API_URL ile özel bir API host varsa onu da ekle (build-time injected).
    const customApi = (import.meta as any).env?.VITE_API_URL as string | undefined;
    if (customApi) {
      try {
        const customHost = new URL(customApi).hostname;
        if (parsed.hostname === customHost) return true;
      } catch { /* invalid VITE_API_URL */ }
    }

    return false;
  } catch {
    // URL parse edilemezse, güvenli tarafta kal — token ekleme.
    return false;
  }
}

const originalFetch = window.fetch;

window.fetch = async (...args) => {
  let [resource, config] = args;

  if (_token) {
    const url =
      typeof resource === "string"
        ? resource
        : resource instanceof URL
          ? resource.href
          : (resource as Request).url;

    if (shouldAttachAuth(url)) {
      config = config || {};
      const existing =
        config.headers instanceof Headers
          ? Object.fromEntries((config.headers as Headers).entries())
          : (config.headers as Record<string, string>) || {};

      if (!existing["authorization"] && !existing["Authorization"]) {
        config.headers = { ...existing, Authorization: `Bearer ${_token}` };
      }
    }
  }

  const response = await originalFetch(resource, config);

  // Sliding session: backend x-refreshed-token header'ında yeni token gönderirse
  // localStorage'ı güncelle — kullanıcı hiç logout olmaz.
  try {
    const refreshed = response.headers.get("x-refreshed-token");
    if (refreshed && refreshed !== _token) {
      setInterceptorToken(refreshed);
    }
  } catch { /* ignore */ }

  return response;
};

export {};
