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

const originalFetch = window.fetch;

window.fetch = async (...args) => {
  let [resource, config] = args;

  if (_token) {
    config = config || {};
    const existing =
      config.headers instanceof Headers
        ? Object.fromEntries((config.headers as Headers).entries())
        : (config.headers as Record<string, string>) || {};

    if (!existing["authorization"] && !existing["Authorization"]) {
      config.headers = { ...existing, Authorization: `Bearer ${_token}` };
    }
  }

  return originalFetch(resource, config);
};

export {};
