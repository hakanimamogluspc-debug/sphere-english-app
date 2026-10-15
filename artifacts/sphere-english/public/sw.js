/**
 * Sphere English — Service Worker
 *
 *  1) PWA offline/cache katmanı
 *     - Navigasyon (sayfa) istekleri: network-first → başarısızsa /offline.html
 *     - /assets/* (Vite hash'li bundle): cache-first (dosya adı değişince yeni dosya iner)
 *     - Görsel / ikon / font: stale-while-revalidate
 *     - /api/* ve /api-server/*: ASLA cache'lenmez (canlı veri + auth)
 *  2) Web Push bildirimleri (R3.B)
 *
 * CACHE_VERSION'ı değiştirmek eski cache'leri siler.
 */

const CACHE_VERSION = "sphere-v2";
const RUNTIME = `${CACHE_VERSION}-runtime`;
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(RUNTIME).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(CACHE_VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function isApi(url) {
  return url.pathname.startsWith("/api/") || url.pathname.startsWith("/api-server/");
}
function isHashedAsset(url) {
  return url.pathname.startsWith("/assets/");
}
function isStaticMedia(url) {
  return /\.(png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf|mp3|json|webmanifest)$/i.test(url.pathname)
    || url.pathname.startsWith("/icons/") || url.pathname.startsWith("/images/");
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (isApi(url)) return; // canlı veri — tarayıcıya bırak

  // Sayfa navigasyonu: network-first, offline fallback
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // index.html'i yedekle (SPA shell) — ağ yokken son sürümü aç
          if (res.ok) caches.open(RUNTIME).then((c) => c.put("/", res.clone())).catch(() => {});
          return res;
        })
        .catch(async () => {
          const cache = await caches.open(RUNTIME);
          return (await cache.match("/")) || (await cache.match(OFFLINE_URL)) || Response.error();
        }),
    );
    return;
  }

  // Hash'li bundle: cache-first
  if (isHashedAsset(url)) {
    event.respondWith(
      caches.open(RUNTIME).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone()).catch(() => {});
        return res;
      }),
    );
    return;
  }

  // Medya / ikon / font: stale-while-revalidate
  if (isStaticMedia(url)) {
    event.respondWith(
      caches.open(RUNTIME).then(async (cache) => {
        const hit = await cache.match(req);
        const network = fetch(req).then((res) => {
          if (res.ok) cache.put(req, res.clone()).catch(() => {});
          return res;
        }).catch(() => hit);
        return hit || network;
      }),
    );
  }
});

// ─── Web Push ──────────────────────────────────────────────────────────────

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "Sphere English", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Sphere English";
  const options = {
    body: data.body || "",
    icon: data.icon || "/icons/icon-192.png",
    badge: data.badge || "/icons/icon-72.png",
    tag: data.tag || "sphere-notification",
    data: { url: data.url || "/dashboard" },
    renotify: true,
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/dashboard";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.host) && "focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    }),
  );
});

// Yeni sürüm hazır olduğunda sayfa "SKIP_WAITING" gönderirse hemen geç
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
