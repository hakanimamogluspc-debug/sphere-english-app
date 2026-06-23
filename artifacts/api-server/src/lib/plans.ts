/**
 * Sphere English plan kataloğu — LMS api-server.
 *
 * sphereenglish-www/src/lib/plans.ts ile BİREBİR senkron tutulmalı.
 * Bir tarafı güncelleyince diğeri de güncellensin.
 */

export type PlanCode =
  | "sphere-core-aylik"
  | "sphere-core-yillik"
  | "sphere-pro-aylik"
  | "sphere-pro-yillik"
  | "sphere-premium-aylik"
  | "sphere-premium-yillik";

export interface PlanDefinition {
  code: PlanCode;
  label: string;
  tier: "core" | "pro" | "premium";
  billingType: "monthly" | "yearly";
  amount: number;
  durationMonths: number;
  features: string[];
  popular?: boolean;
}

export const PLAN_CATALOG: PlanDefinition[] = [
  {
    code: "sphere-core-aylik",
    label: "Sphere Core",
    tier: "core",
    billingType: "monthly",
    amount: 349,
    durationMonths: 1,
    features: [
      "Standart AI Coach (günlük pratik)",
      "Oxford müfredatı A1–B1",
      "Temel seviye tespiti",
      "Temel ilerleme paneli",
      "E-posta destek",
    ],
  },
  {
    code: "sphere-core-yillik",
    label: "Sphere Core",
    tier: "core",
    billingType: "yearly",
    amount: 3490,
    durationMonths: 12,
    features: [
      "Standart AI Coach (günlük pratik)",
      "Oxford müfredatı A1–B1",
      "Temel seviye tespiti",
      "Temel ilerleme paneli",
      "E-posta destek",
      "Aylığa göre %17 indirim",
    ],
  },
  {
    code: "sphere-pro-aylik",
    label: "Sphere Pro",
    tier: "pro",
    billingType: "monthly",
    amount: 699,
    durationMonths: 1,
    popular: true,
    features: [
      "Sınırsız AI Coach",
      "Oxford müfredatı A1–C1 (tüm seviyeler)",
      "AI Studio: toplantı, e-mail, sunum, müzakere",
      "Adaptif kişisel öğrenme planı",
      "Haftalık hedef + detaylı rapor",
      "Öncelikli destek",
    ],
  },
  {
    code: "sphere-pro-yillik",
    label: "Sphere Pro",
    tier: "pro",
    billingType: "yearly",
    amount: 6990,
    durationMonths: 12,
    popular: true,
    features: [
      "Sınırsız AI Coach",
      "Oxford müfredatı A1–C1 (tüm seviyeler)",
      "AI Studio: toplantı, e-mail, sunum, müzakere",
      "Adaptif kişisel öğrenme planı",
      "Haftalık hedef + detaylı rapor",
      "Öncelikli destek",
      "Aylığa göre %17 indirim",
    ],
  },
  {
    code: "sphere-premium-aylik",
    label: "Sphere Premium",
    tier: "premium",
    billingType: "monthly",
    amount: 1199,
    durationMonths: 1,
    features: [
      "Sınırsız AI Coach + telaffuz/aksan analizi",
      "Oxford müfredatı tüm seviyeler + sektörel modüller",
      "AI Studio gelişmiş + sektöre özel senaryolar",
      "Tam kişiselleştirilmiş plan + hedef takibi",
      "Derin analiz + öneri raporu",
      "Öncelikli destek + aylık canlı koçluk",
    ],
  },
  {
    code: "sphere-premium-yillik",
    label: "Sphere Premium",
    tier: "premium",
    billingType: "yearly",
    amount: 11990,
    durationMonths: 12,
    features: [
      "Sınırsız AI Coach + telaffuz/aksan analizi",
      "Oxford müfredatı tüm seviyeler + sektörel modüller",
      "AI Studio gelişmiş + sektöre özel senaryolar",
      "Tam kişiselleştirilmiş plan + hedef takibi",
      "Derin analiz + öneri raporu",
      "Öncelikli destek + aylık canlı koçluk",
      "Aylığa göre %17 indirim",
    ],
  },
];

export function getPlan(code: string): PlanDefinition | undefined {
  return PLAN_CATALOG.find((p) => p.code === code);
}
