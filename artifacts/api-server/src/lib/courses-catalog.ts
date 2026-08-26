/**
 * Kurumsal Grup Programları katalog — DB-backed.
 *
 * Artık admin panelden yönetiliyor. `courses` tablosu source of truth.
 * course-orders (pre-create) burada `findProgramme(slug)` çağırıyor.
 *
 * Legacy senkron API'yi korumak için memory cache kullanıyoruz —
 * ilk load'ta DB'den çekilir, sonra cache'ten okunur. Cache süresi 60 sn.
 * Cache miss durumunda hardcoded fallback verir (safety net).
 */

import { pool } from "@workspace/db";

export type CourseProgramme = {
  slug: string;
  title: string;
  titleEn: string;
  level: string;
  priceKurus: number;
};

// Fallback — DB bağlantı yoksa veya seed henüz çalışmadıysa
const FALLBACK_PROGRAMMES: CourseProgramme[] = [
  { slug: "foundation", title: "İş İngilizcesine Sıfırdan Başla", titleEn: "Business English Foundation (A1-A2)", level: "A1-A2", priceKurus: 499900 },
  { slug: "diplomacy",  title: "Toplantıyı Sen Yönet", titleEn: "Corporate Diplomacy & Crisis Management (B1-B2)", level: "B1-B2", priceKurus: 499900 },
];

// Memory cache
let _cache: { data: CourseProgramme[]; ts: number } | null = null;
const CACHE_TTL_MS = 60_000;

async function loadFromDb(): Promise<CourseProgramme[]> {
  try {
    const r: any = await pool.query(
      `SELECT slug, title, title_en, level, price_kurus
         FROM marketing_courses
         WHERE is_active = true
         ORDER BY sort_order ASC, id ASC`,
    );
    if (!r.rows || r.rows.length === 0) return FALLBACK_PROGRAMMES;
    return r.rows.map((row: any): CourseProgramme => ({
      slug: String(row.slug),
      title: String(row.title),
      titleEn: String(row.title_en ?? row.title),
      level: String(row.level ?? ""),
      priceKurus: Number(row.price_kurus),
    }));
  } catch (e: any) {
    console.warn("[courses-catalog] DB load hata, fallback kullanılıyor:", e?.message);
    return FALLBACK_PROGRAMMES;
  }
}

/**
 * Cache-aware programme list.
 * Async — ideal, ama sync findProgramme için de kullanılabilir (aşağı bak).
 */
export async function loadProgrammes(): Promise<CourseProgramme[]> {
  const now = Date.now();
  if (_cache && (now - _cache.ts) < CACHE_TTL_MS) return _cache.data;
  const data = await loadFromDb();
  _cache = { data, ts: now };
  return data;
}

/** Cache'i manuel invalidate — admin update sonrası çağrılabilir */
export function invalidateCoursesCache(): void {
  _cache = null;
}

/**
 * Sync findProgramme — mevcut caller'lar sync (course-orders route pre-create HMAC).
 * Cache'ten okur, cache boşsa fallback döner + arka planda cache'i doldurur.
 */
export function findProgramme(slug: string): CourseProgramme | null {
  const list = _cache?.data ?? FALLBACK_PROGRAMMES;
  const match = list.find((p) => p.slug === slug) ?? null;
  // Async refresh — sync caller'ı bekletmez
  if (!_cache || (Date.now() - _cache.ts) >= CACHE_TTL_MS) {
    void loadProgrammes().catch(() => {});
  }
  return match;
}

/**
 * DEPRECATED — geriye dönük uyumluluk için export ediliyor.
 * Yeni kod loadProgrammes() kullanmalı.
 */
export const COURSE_PROGRAMMES: CourseProgramme[] = FALLBACK_PROGRAMMES;
