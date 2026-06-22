/**
 * Plan kataloğu — Sphere English bireysel + kurumsal paketler.
 *
 * Fiyat politikası: pricing araştırması (task #40, #41) sonucu onaylanmış.
 * Recurring (her ay otomatik) ve one-time (peşin paket) seçenekler birlikte sunulur.
 * Kurumsal teklif sales tarafından Iyzilink ile elle oluşturulur — bu listede
 * sadece görsel placeholder olarak yer alır.
 *
 * Frontend bu listeyi `GET /api/payment/plans` ile çeker, kullanıcıya gösterir.
 * Backend ödeme initialize ederken sadece bu listede olan kodları kabul eder.
 *
 * Yeni plan eklemek için: bu dosyaya yeni satır + frontend görseli yeterli.
 * Iyzico Subscription API tarafında ayrıca bir "pricing plan" oluşturmak
 * gerekecek — onu admin paneliyle yapacağız (sonraki faz).
 */

export type PlanCode =
  // Bireysel aylık recurring (auto-renew)
  | "bireysel-basic-aylik"
  | "bireysel-standard-aylik"
  | "bireysel-premium-aylik"
  | "bireysel-executive-aylik"
  // Bireysel peşin paket (one-time, expiresAt'a kadar geçerli)
  | "bireysel-standard-3aylik"
  | "bireysel-standard-6aylik"
  | "bireysel-standard-yillik"
  | "bireysel-premium-3aylik"
  | "bireysel-premium-6aylik"
  | "bireysel-premium-yillik";

export interface PlanDefinition {
  code: PlanCode;
  label: string;
  tier: "basic" | "standard" | "premium" | "executive";
  billingType: "recurring" | "one-time";
  amount: number;                  // TRY, KDV dahil
  durationMonths?: number;         // one-time için zorunlu
  features: string[];
  popular?: boolean;
  /** İndirim — peşin paketlerde aylık ortalamaya göre kazanç oranı */
  discountPercent?: number;
}

export const PLAN_CATALOG: PlanDefinition[] = [
  // ── AYLIK RECURRING ──────────────────────────────────────────────────────
  {
    code: "bireysel-basic-aylik",
    label: "Basic — Aylık",
    tier: "basic",
    billingType: "recurring",
    amount: 599,
    features: [
      "AI Studio temel modüller (Telaffuz, Dilbilgisi, Kelime)",
      "Aylık 1 canlı grup dersi",
      "Forum erişimi",
      "Mobil + web",
    ],
  },
  {
    code: "bireysel-standard-aylik",
    label: "Standard — Aylık",
    tier: "standard",
    billingType: "recurring",
    amount: 1799,
    features: [
      "Tüm AI Studio modülleri",
      "Aylık 2 canlı birebir ders",
      "İş Senaryoları + Mülakat Simülatörü",
      "Aylık ilerleme raporu",
    ],
  },
  {
    code: "bireysel-premium-aylik",
    label: "Premium — Aylık",
    tier: "premium",
    billingType: "recurring",
    amount: 4499,
    popular: true,
    features: [
      "Standard'daki tüm özellikler",
      "Haftalık 1 birebir koç oturumu (toplam 4/ay)",
      "Sunum Simülatörü + Yazma Koçu derinleştirilmiş geri bildirim",
      "Öncelikli destek",
      "Sertifikalı program çıktısı",
    ],
  },
  {
    code: "bireysel-executive-aylik",
    label: "Executive — Aylık",
    tier: "executive",
    billingType: "recurring",
    amount: 9999,
    features: [
      "Premium'daki tüm özellikler",
      "Haftalık 2 birebir executive coach (8/ay)",
      "Kişiye özel öğrenme planı + 1-on-1 değerlendirme",
      "Anında destek + dedicated success manager",
      "Liderlik / C-suite konuşma simülasyonları",
    ],
  },

  // ── PEŞİN PAKET (TEK SEFERLİK) ──────────────────────────────────────────
  // Aylık fiyat × ay − %indirim. %5 / %12 / %20 hesaplaması.
  {
    code: "bireysel-standard-3aylik",
    label: "Standard — 3 Aylık Peşin",
    tier: "standard",
    billingType: "one-time",
    amount: Math.round(1799 * 3 * 0.95),    // ~5127
    durationMonths: 3,
    discountPercent: 5,
    features: [
      "Standard plan, 3 ay süreyle aktif",
      "Aylık 1799 ₺ yerine ortalama ~1709 ₺",
      "Otomatik yenileme yok — süre bitince yenilersin",
    ],
  },
  {
    code: "bireysel-standard-6aylik",
    label: "Standard — 6 Aylık Peşin",
    tier: "standard",
    billingType: "one-time",
    amount: Math.round(1799 * 6 * 0.88),    // ~9499
    durationMonths: 6,
    discountPercent: 12,
    features: [
      "Standard plan, 6 ay süreyle aktif",
      "Aylık 1799 ₺ yerine ortalama ~1583 ₺",
    ],
  },
  {
    code: "bireysel-standard-yillik",
    label: "Standard — Yıllık Peşin",
    tier: "standard",
    billingType: "one-time",
    amount: Math.round(1799 * 12 * 0.8),    // ~17270
    durationMonths: 12,
    discountPercent: 20,
    features: [
      "Standard plan, 12 ay süreyle aktif",
      "Aylık 1799 ₺ yerine ortalama ~1439 ₺",
      "En çok kazandıran seçenek",
    ],
  },
  {
    code: "bireysel-premium-3aylik",
    label: "Premium — 3 Aylık Peşin",
    tier: "premium",
    billingType: "one-time",
    amount: Math.round(4499 * 3 * 0.95),    // ~12822
    durationMonths: 3,
    discountPercent: 5,
    features: ["Premium plan, 3 ay aktif"],
  },
  {
    code: "bireysel-premium-6aylik",
    label: "Premium — 6 Aylık Peşin",
    tier: "premium",
    billingType: "one-time",
    amount: Math.round(4499 * 6 * 0.88),    // ~23755
    durationMonths: 6,
    discountPercent: 12,
    features: ["Premium plan, 6 ay aktif"],
  },
  {
    code: "bireysel-premium-yillik",
    label: "Premium — Yıllık Peşin",
    tier: "premium",
    billingType: "one-time",
    amount: Math.round(4499 * 12 * 0.8),    // ~43190
    durationMonths: 12,
    discountPercent: 20,
    features: ["Premium plan, 12 ay aktif", "En kazançlı paket"],
  },
];

export function getPlan(code: string): PlanDefinition | undefined {
  return PLAN_CATALOG.find((p) => p.code === code);
}
