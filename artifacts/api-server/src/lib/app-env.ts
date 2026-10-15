/**
 * Ortam ayrımı — production / staging / development.
 *
 * APP_ENV=staging (Easypanel staging servislerinde set edilir) olduğunda:
 *   - Arka plan cron'ları ÇALIŞMAZ (terk edilen sepet, comeback, yedek, outbound…)
 *     → canlıdan kopyalanan DB'deki gerçek müşterilere mail/işlem gitmesin.
 *   - sendEmail yalnızca STAGING_EMAIL_ALLOWLIST'teki adreslere gönderir,
 *     diğerlerini loglar (bkz. email.ts).
 *   - Tüm yanıtlara X-Robots-Tag: noindex eklenir (bkz. app.ts).
 *
 * NODE_ENV her iki ortamda da "production" kalır (build/perf davranışı aynı).
 */

export type AppEnv = "production" | "staging" | "development";

export function appEnv(): AppEnv {
  const v = (process.env.APP_ENV ?? "").toLowerCase();
  if (v === "staging") return "staging";
  if (v === "development" || process.env.NODE_ENV === "development") return "development";
  return "production";
}

export const isStaging = (): boolean => appEnv() === "staging";

/** Staging'de arka plan işleri kapalı — tek yerden karar */
export function backgroundJobsEnabled(): boolean {
  if (isStaging()) return false;
  if (process.env.DISABLE_BACKGROUND_JOBS === "1") return false;
  return true;
}

/** Staging'de mail gönderilebilecek adresler (virgülle ayrılmış, küçük harf) */
export function stagingEmailAllowlist(): Set<string> {
  return new Set(
    (process.env.STAGING_EMAIL_ALLOWLIST ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}
