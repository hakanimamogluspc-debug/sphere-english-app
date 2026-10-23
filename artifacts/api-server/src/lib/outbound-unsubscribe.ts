/**
 * B2B outbound mailleri için "abonelikten çık" bağlantısı.
 *
 * Bağlantı imzalıdır: sadece c/l numaralarını değiştirerek başkası adına abonelikten çıkılamaz.
 * Adres: PUBLIC_API_URL (ör. https://app.sphereenglish.com/api) — yoksa app.sphereenglish.com/api.
 * (Eski varsayılan "https://api.sphereenglish.com" diye bir alan adı yoktu; bağlantılar çalışmıyordu.)
 */

import crypto from "node:crypto";

function secret(): string {
  return process.env.UNSUBSCRIBE_SECRET || process.env.JWT_SECRET || process.env.INTERNAL_TOKEN || "sphere-unsubscribe";
}

export function unsubscribeSignature(campaignId: number, leadId: number): string {
  return crypto.createHmac("sha256", secret()).update(`unsub:${campaignId}:${leadId}`).digest("base64url").slice(0, 22);
}

export function verifyUnsubscribe(campaignId: number, leadId: number, sig: unknown): boolean {
  if (typeof sig !== "string" || sig.length !== 22) return false;
  const expected = unsubscribeSignature(campaignId, leadId);
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

export function publicApiBase(): string {
  return (process.env.PUBLIC_API_URL || "https://app.sphereenglish.com/api").replace(/\/+$/, "");
}

export function unsubscribeUrl(campaignId: number, leadId: number): string {
  return `${publicApiBase()}/outbound/unsubscribe?c=${campaignId}&l=${leadId}&s=${unsubscribeSignature(campaignId, leadId)}`;
}
