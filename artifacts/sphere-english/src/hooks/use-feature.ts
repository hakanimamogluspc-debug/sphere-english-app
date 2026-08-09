/**
 * useFeature — bir modülün mevcut kullanıcı için aktif olup olmadığını döndürür.
 * Admin panelinden modül kapalıysa false, kullanıcıya görünmemeli.
 *
 * Kullanım:
 *   const showCourses = useFeature("student-courses");
 *   {showCourses && <MyCoursesCard />}
 *
 * Global cache — tüm sayfalar aynı fetch'i paylaşır (localStorage).
 */

import { useEffect, useState } from "react";
import { useAuth } from "./use-auth";
import { API } from "@/lib/api-url";

type FeatureSetting = { key: string; isEnabled: boolean; visibleTo: string[] };

const CACHE_KEY = "sphere_feature_settings_cache";
const CACHE_TTL_MS = 60_000; // 1 dk cache

let inMemoryCache: { settings: FeatureSetting[]; fetchedAt: number } | null = null;
let inflight: Promise<FeatureSetting[]> | null = null;

async function fetchSettings(): Promise<FeatureSetting[]> {
  // Cache hit
  if (inMemoryCache && Date.now() - inMemoryCache.fetchedAt < CACHE_TTL_MS) {
    return inMemoryCache.settings;
  }
  // Inflight guard
  if (inflight) return inflight;

  const token = typeof window !== "undefined" ? localStorage.getItem("sphere_token") : null;
  if (!token) return [];

  inflight = fetch(`${API}/feature-settings`, {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then(r => (r.ok ? r.json() : []))
    .then(d => {
      const arr = Array.isArray(d) ? d : [];
      inMemoryCache = { settings: arr, fetchedAt: Date.now() };
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(inMemoryCache)); } catch {}
      return arr;
    })
    .catch(() => [])
    .finally(() => { inflight = null; });

  return inflight;
}

// LocalStorage'dan initial okuma (SSR/reload'da flash olmasın diye)
function readCachedSync(): FeatureSetting[] | null {
  if (typeof window === "undefined") return null;
  if (inMemoryCache) return inMemoryCache.settings;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.settings) && Date.now() - parsed.fetchedAt < 5 * 60_000) {
      inMemoryCache = parsed;
      return parsed.settings;
    }
  } catch {}
  return null;
}

/** Bir moduleKey için kullanıcıya görünür mü? Default: görünür (setting tanımlı değilse). */
export function useFeature(moduleKey: string | undefined): boolean {
  const { user } = useAuth();
  const initial = readCachedSync();
  const [settings, setSettings] = useState<FeatureSetting[] | null>(initial);

  useEffect(() => {
    if (settings) return; // Cache'ten geldi
    fetchSettings().then(setSettings);
  }, [settings]);

  if (!moduleKey) return true;
  if (!settings) return true; // yükleniyor → default görünür (flicker olmasın)

  const setting = settings.find(s => s.key === moduleKey);
  if (!setting) return true;
  if (!setting.isEnabled) return false;

  const role = (user as any)?.role ?? "student";
  const accountType = (user as any)?.accountType as string | undefined;

  if (role === "student") {
    if (setting.visibleTo.includes("student")) return true;
    if (accountType === "bireysel" && setting.visibleTo.includes("bireysel_ogrenci")) return true;
    if (accountType === "kurumsal" && setting.visibleTo.includes("kurumsal_ogrenci")) return true;
    return false;
  }
  if (role === "corporate" && setting.visibleTo.includes("corporate")) return true;
  if (role === "teacher" && setting.visibleTo.includes("teacher")) return true;
  if (role === "admin" && setting.visibleTo.includes("admin")) return true;
  return false;
}
