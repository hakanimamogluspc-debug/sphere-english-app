import { useEffect, useState } from "react";

/**
 * Sphere Mobile Theme — light / dark / system.
 * CSS custom properties ile tema geçişi. Global CSS'te `[data-mobile-theme="dark"]`
 * seçicisi altındaki değerler dark palet.
 */

export type ThemeMode = "light" | "dark" | "system";
const STORAGE_KEY = "sphere_mobile_theme";

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readSaved(): ThemeMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {}
  return "system";
}

function applyTheme(mode: ThemeMode) {
  const effective = mode === "system" ? getSystemTheme() : mode;
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-mobile-theme", effective);
  }
}

// İlk yüklemede uygula (flicker'ı azalt)
if (typeof window !== "undefined") {
  applyTheme(readSaved());
}

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(readSaved);

  useEffect(() => {
    applyTheme(mode);
    try { localStorage.setItem(STORAGE_KEY, mode); } catch {}
  }, [mode]);

  // System modda kullanıcı OS tema değiştirirse takip et
  useEffect(() => {
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => applyTheme("system");
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, [mode]);

  const effective: "light" | "dark" = mode === "system" ? getSystemTheme() : mode;
  return { mode, setMode, effective };
}
