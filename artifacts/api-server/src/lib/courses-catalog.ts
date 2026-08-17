/**
 * Kurumsal Grup Programları katalog (statik).
 * Şimdilik iki program var — DB'ye taşımak yerine kodda tutuyoruz (nadir değişecek).
 */

export type CourseProgramme = {
  slug: string;
  title: string;
  titleEn: string;
  level: string;
  priceKurus: number; // 4.999 TL = 499900
};

export const COURSE_PROGRAMMES: CourseProgramme[] = [
  {
    slug: "foundation",
    title: "Business English Foundation",
    titleEn: "Business English Foundation (A1-A2)",
    level: "A1-A2",
    priceKurus: 499900,
  },
  {
    slug: "diplomacy",
    title: "Corporate Diplomacy & Crisis Management",
    titleEn: "Corporate Diplomacy & Crisis Management (B1-B2)",
    level: "B1-B2",
    priceKurus: 499900,
  },
];

export function findProgramme(slug: string): CourseProgramme | null {
  return COURSE_PROGRAMMES.find(p => p.slug === slug) ?? null;
}
