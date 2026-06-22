/**
 * Iyzico SDK wrapper — singleton + promisified yardımcılar.
 *
 * iyzipay paketi callback-based bir API sunuyor. Modern async/await ile
 * çalışabilmek için her metodu Promise'e sarıyoruz. Ayrıca env validation,
 * conversation id üretimi ve basit log helper'ları burada toplanıyor.
 *
 * Gerekli ortam değişkenleri (Easypanel → api-server → Environment):
 *   IYZICO_API_KEY          sandbox-... veya production API key
 *   IYZICO_SECRET_KEY       sandbox-... veya production secret
 *   IYZICO_BASE_URL         https://sandbox-api.iyzipay.com (sandbox)
 *                           https://api.iyzipay.com         (production)
 *   APP_BASE_URL            Callback geri dönüş URL'i (örn. https://app.sphereenglish.com)
 *
 * Subscription / recurring tahsilat için Iyzico paneli üstünden
 * "Subscription" modülünün aktif olması gerekir. Bu modül kapalı iken
 * yine de Checkout Form ile tek seferlik ödeme alabiliriz.
 */

// iyzipay tipi yok — runtime'da require ile yüklenir, TS için 'any' kullanırız
// @ts-ignore — iyzipay'in @types paketi yok
import Iyzipay from "iyzipay";
import crypto from "node:crypto";

let _client: any | null = null;

export function getIyzicoClient(): any {
  if (_client) return _client;

  const apiKey = process.env["IYZICO_API_KEY"];
  const secretKey = process.env["IYZICO_SECRET_KEY"];
  const baseUrl = process.env["IYZICO_BASE_URL"] ?? "https://sandbox-api.iyzipay.com";

  if (!apiKey || !secretKey) {
    throw new Error(
      "Iyzico ortam değişkenleri eksik. IYZICO_API_KEY ve IYZICO_SECRET_KEY tanımlı olmalı.",
    );
  }

  _client = new (Iyzipay as any)({
    apiKey,
    secretKey,
    uri: baseUrl,
  });
  return _client;
}

/**
 * Iyzico'nun "conversation id" alanı için tekil string üretir.
 * Geri çağrım/webhook geldiğinde bizim DB kaydımızla eşleşmek için kullanılır.
 */
export function newConversationId(prefix = "sphere"): string {
  const ts = Date.now().toString(36);
  const rand = crypto.randomBytes(6).toString("hex");
  return `${prefix}_${ts}_${rand}`;
}

/**
 * iyzipay callback-style metodunu Promise'e sarar.
 */
export function iyzicoCall<T = any>(
  fn: (req: any, cb: (err: any, result: T) => void) => void,
  req: any,
): Promise<T> {
  return new Promise((resolve, reject) => {
    try {
      fn(req, (err, result) => {
        if (err) return reject(err);
        // Iyzico bazen status alanında "failure" döner ama err null olur;
        // arayanın status kontrolü yapması beklenir.
        resolve(result);
      });
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * APP_BASE_URL yardımcısı — callback URL üretmek için.
 */
export function appBaseUrl(): string {
  const u = process.env["APP_BASE_URL"] ?? "https://app.sphereenglish.com";
  return u.replace(/\/$/, "");
}
