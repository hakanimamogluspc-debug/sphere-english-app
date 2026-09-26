/**
 * Sphere English — Mobile Design Tokens
 *
 * Marka kılavuzu v1.0 uyumlu + karanlık mod desteği.
 * Tüm renkler CSS custom properties üzerinden gelir → tema geçişi otomatik.
 * Global stil `index.css` içinde tanımlıdır.
 */

// CSS custom property referansları — HTML'de `[data-mobile-theme="dark"]`
// altında farklı değerler alırlar.
export const colors = {
  // Ana
  navy: "var(--m-navy)",
  navy700: "var(--m-navy)",
  navy400: "var(--m-navy-400)",
  navy200: "var(--m-navy-200)",
  navy100: "var(--m-navy-100)",
  navy50: "var(--m-navy-50)",

  // Vurgu (metin değil)
  turq: "var(--m-turq)",
  turqDeep: "var(--m-turq-deep)",
  turqLight: "var(--m-turq-light)",

  // Nötr
  neutral: "var(--m-neutral)",
  white: "var(--m-surface)",

  // Durum
  success: "var(--m-success)",
  warn: "var(--m-warn)",
  error: "var(--m-error)",

  // Dark mode (backward-compat — kullanılmıyor artık)
  darkBg: "#0a1428",
  darkBg2: "#12213e",
} as const;

// Boşluk — 8'in katları (kılavuz kuralı)
export const spacing = {
  s8: 8, s16: 16, s24: 24, s32: 32,
  s48: 48, s64: 64, s88: 88, s120: 120, s160: 160, s240: 240,
} as const;

// Yarıçap ailesi — bir tasarımda tek aile
export const radius = {
  hairline: 0,
  chip: 8,
  card: 16,
  panel: 24,
  pill: 999,
} as const;

// Gölge — minimum, tek
export const shadow = {
  card: "0 4px 16px rgba(30, 58, 110, 0.08)",
  device: "0 40px 100px rgba(30, 58, 110, 0.20)",
} as const;

// Tipografi
export const fonts = {
  heading: "'Outfit', -apple-system, BlinkMacSystemFont, sans-serif",
  body: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
} as const;

export const type = {
  hero: { family: fonts.heading, weight: 900, size: 56, lineHeight: 1.05, letterSpacing: "-0.02em" },
  h1: { family: fonts.heading, weight: 800, size: 36, lineHeight: 1.15, letterSpacing: "-0.02em" },
  h2: { family: fonts.heading, weight: 700, size: 24, lineHeight: 1.25, letterSpacing: "-0.02em" },
  h3: { family: fonts.heading, weight: 700, size: 18, lineHeight: 1.35, letterSpacing: "-0.01em" },
  body: { family: fonts.body, weight: 400, size: 16, lineHeight: 1.6 },
  bodyBold: { family: fonts.body, weight: 600, size: 16, lineHeight: 1.6 },
  small: { family: fonts.body, weight: 400, size: 14, lineHeight: 1.5 },
  caption: { family: fonts.body, weight: 500, size: 12, lineHeight: 1.5 },
  eyebrow: { family: fonts.heading, weight: 700, size: 11, lineHeight: 1, letterSpacing: "0.06em", textTransform: "uppercase" as const },
  meta: { family: fonts.heading, weight: 500, size: 11, lineHeight: 1, letterSpacing: "0.04em", textTransform: "uppercase" as const },
} as const;
