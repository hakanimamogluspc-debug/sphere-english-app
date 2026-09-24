/**
 * Web Push helper — service worker registration + subscription lifecycle.
 */

import { API } from "@/lib/api-url";
const TOKEN_KEY = "sphere_token";

// Base64 URL-safe → Uint8Array (VAPID public key için)
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) output[i] = rawData.charCodeAt(i);
  return output;
}

async function apiFetch(path: string, opts: RequestInit = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.error || `HTTP ${res.status}`);
  return data;
}

export function isPushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function currentPushPermission(): NotificationPermission {
  if (!("Notification" in window)) return "denied";
  return Notification.permission;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js");
  } catch (e) {
    console.warn("[push] SW register hata:", e);
    return null;
  }
}

/**
 * Kullanıcı bildirimlere izin verir ve subscription oluşturur. Başarı: true.
 */
export async function subscribePush(): Promise<boolean> {
  if (!isPushSupported()) return false;
  try {
    const reg = await registerServiceWorker();
    if (!reg) return false;

    // İzin iste
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return false;

    // VAPID public key al
    const { publicKey } = await fetch("/api/public/push/vapid-key").then((r) => r.json());
    if (!publicKey) return false;

    // Subscription oluştur (varsa mevcut)
    const existing = await reg.pushManager.getSubscription();
    const sub =
      existing ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      }));

    // Backend'e gönder
    await apiFetch("/student/push/subscribe", {
      method: "POST",
      body: JSON.stringify({ subscription: sub.toJSON() }),
    });
    return true;
  } catch (e: any) {
    console.warn("[push] subscribe hata:", e?.message);
    return false;
  }
}

export async function unsubscribePush(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await apiFetch("/student/push/unsubscribe", {
        method: "POST",
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
      await sub.unsubscribe();
    }
  } catch (e: any) {
    console.warn("[push] unsubscribe hata:", e?.message);
  }
}
