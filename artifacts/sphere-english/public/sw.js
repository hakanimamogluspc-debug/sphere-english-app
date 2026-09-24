/**
 * Sphere English — Service Worker
 * Web Push notification handler (R3.B)
 */

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

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
    icon: data.icon || "/images/logo-192.png",
    badge: data.badge || "/images/logo-72.png",
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
      // Zaten açık bir sphere tabı varsa oraya odaklan
      for (const client of clients) {
        if (client.url.includes(self.location.host) && "focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // Yoksa yeni sekme
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    }),
  );
});
