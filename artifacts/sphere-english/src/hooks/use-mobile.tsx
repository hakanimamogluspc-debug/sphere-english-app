import { useEffect, useState } from "react";

/**
 * Mobil viewport algılaması. 768px altı mobil sayılır.
 * Sadece client-side çalışır.
 */
export function useIsMobile(breakpoint: number = 768): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < breakpoint;
  });

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpoint);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [breakpoint]);

  return isMobile;
}

/**
 * Capacitor içinde mi çalışıyor? (Native mobil app olarak)
 * Web tarayıcı bunu her zaman false döner.
 */
export function useIsCapacitor(): boolean {
  return typeof window !== "undefined" && !!(window as any).Capacitor?.isNativePlatform?.();
}
