/**
 * E-kitap indirme bağlantısı kuralları — tek yerden yönetilir.
 *
 * Bağlantı DOWNLOAD_VALID_DAYS gün geçerli, en fazla MAX_DOWNLOADS kez indirilebilir.
 * Admin panelinden "Linki yenile ve gönder" ile süre baştan başlar ve sayaç sıfırlanır.
 */

export const DOWNLOAD_VALID_DAYS = 30;
export const MAX_DOWNLOADS = 10;

/** Şu andan itibaren geçerlilik bitişi. */
export function downloadExpiry(from = new Date()): Date {
  return new Date(from.getTime() + DOWNLOAD_VALID_DAYS * 24 * 60 * 60 * 1000);
}

/** Müşteriye gösterilen destek kanalları. */
export const SUPPORT_EMAIL = "info@sphereenglish.com";
export const SUPPORT_WHATSAPP = "https://wa.me/905066085810";
