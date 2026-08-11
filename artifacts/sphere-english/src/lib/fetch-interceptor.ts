// Module-level token store — updated synchronously on login/logout
let _token: string | null = null;

try {
  _token = localStorage.getItem("sphere_token");
} catch { /* localStorage blocked in some iframe contexts */ }

export function setInterceptorToken(token: string | null) {
  _token = token;
  try {
    if (token) localStorage.setItem("sphere_token", token);
    else localStorage.removeItem("sphere_token");
  } catch { /* ignore */ }
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

  return originalFetch(resource, config);
};

export {};
