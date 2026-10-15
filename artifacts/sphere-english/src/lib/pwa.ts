/**
 * PWA — service worker kaydı + yükleme (install) daveti durumu.
 *
 * registerServiceWorker(): sayfa yüklenince /sw.js'i kaydeder (push-notifications.ts
 * de aynı dosyayı kaydettiği için çakışmaz; tarayıcı tek registration tutar).
 * Yeni sürüm bulunduğunda sessizce aktive eder; kullanıcı bir sonraki açılışta yeni
 * sürümü alır. Zorla yenileme istemiyoruz (ders ortasında reload olmasın).
 */

export function registerServiceWorker(): void {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  if (import.meta.env.DEV) return; // dev'de SW cache karışıklığı yaratmasın
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).then((reg) => {
      // Yeni sürüm indiğinde bekletme — hemen aktive et
      reg.addEventListener("updatefound", () => {
        const nw = reg.installing;
        nw?.addEventListener("statechange", () => {
          if (nw.state === "installed" && navigator.serviceWorker.controller) {
            nw.postMessage("SKIP_WAITING");
          }
        });
      });
    }).catch(() => { /* SW desteklenmiyor / http — sessiz */ });
  });
}

/** Uygulama zaten "ana ekrana eklenmiş" modda mı açıldı? */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches
    || (navigator as any).standalone === true // iOS Safari
    || new URLSearchParams(window.location.search).get("source") === "pwa";
}

export function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream;
}

/** Capacitor (mağaza uygulaması) içinde miyiz? Orada install daveti anlamsız. */
export function isNativeShell(): boolean {
  return typeof window !== "undefined" && !!(window as any).Capacitor?.isNativePlatform?.();
}
