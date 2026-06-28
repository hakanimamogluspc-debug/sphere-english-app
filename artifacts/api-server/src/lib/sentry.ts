/**
 * Sentry hata izleme — backend.
 *
 * Env:
 *   SENTRY_DSN          — Sentry'den alınan DSN. Boşsa devre dışı kalır.
 *   SENTRY_ENVIRONMENT  — production / staging / development
 *   SENTRY_TRACES_SAMPLE_RATE — performance traces oranı (0-1, default 0.1)
 *   GIT_SHA             — release tag (build sırasında set ediliyor)
 *
 * Sentry @sentry/node v8+ otomatik instrumentation kullanır.
 * app.ts'in EN ÜSTÜNDE require edilmeli (önce Sentry, sonra Express).
 */

let sentryAvailable = false;
let Sentry: any = null;

export async function initSentry(): Promise<void> {
  const dsn = process.env["SENTRY_DSN"];
  if (!dsn) {
    console.info("[sentry] SENTRY_DSN tanımlı değil — hata izleme devre dışı");
    return;
  }
  try {
    // Lazy import — paket yoksa hata olmasın
    Sentry = await import("@sentry/node");
    Sentry.init({
      dsn,
      environment: process.env["SENTRY_ENVIRONMENT"] ?? process.env.NODE_ENV ?? "production",
      release: process.env["GIT_SHA"] ?? undefined,
      tracesSampleRate: parseFloat(process.env["SENTRY_TRACES_SAMPLE_RATE"] ?? "0.1"),
      profilesSampleRate: 0,
      sendDefaultPii: false,
      beforeSend(event: any) {
        // Sentry'ye giden veriden hassas bilgi temizle
        if (event.request?.headers) {
          delete event.request.headers["authorization"];
          delete event.request.headers["cookie"];
          delete event.request.headers["x-internal-signature"];
        }
        if (event.request?.cookies) delete event.request.cookies;
        if (event.extra?.body) {
          // Body'deki password, token gibi alanları temizle
          const blacklist = ["password", "token", "secret", "apiKey", "iyzicoPaymentId"];
          for (const k of blacklist) {
            if (event.extra.body[k]) event.extra.body[k] = "[REDACTED]";
          }
        }
        return event;
      },
    });
    sentryAvailable = true;
    console.info("[sentry] Hata izleme aktif:", dsn.split("@")[1]?.split("/")[0]);
  } catch (e: any) {
    console.warn("[sentry] @sentry/node bulunamadı veya init başarısız:", e?.message);
    sentryAvailable = false;
  }
}

export function captureException(err: unknown, context?: Record<string, any>): void {
  if (!sentryAvailable || !Sentry) return;
  try {
    Sentry.captureException(err, context ? { extra: context } : undefined);
  } catch { /* yutarsak yutarız */ }
}

export function captureMessage(message: string, level: "info" | "warning" | "error" = "info"): void {
  if (!sentryAvailable || !Sentry) return;
  try { Sentry.captureMessage(message, level); } catch {}
}

export function setUser(user: { id?: number; email?: string; role?: string } | null): void {
  if (!sentryAvailable || !Sentry) return;
  try {
    if (user) Sentry.setUser({ id: user.id, email: user.email, segment: user.role });
    else Sentry.setUser(null);
  } catch {}
}

/** Express error middleware — son middleware olarak ekle. */
export function sentryErrorHandler() {
  return (err: any, _req: any, res: any, next: any) => {
    captureException(err, {
      url: _req?.originalUrl,
      method: _req?.method,
      userId: _req?.userId,
    });
    next(err);
  };
}

/** Express request handler — req.user ile Sentry user binding. */
export function sentryRequestHandler() {
  return (req: any, _res: any, next: any) => {
    if (sentryAvailable && Sentry && req.userId) {
      try {
        Sentry.setUser({ id: req.userId, segment: req.userRole });
      } catch {}
    }
    next();
  };
}

export function isSentryAvailable(): boolean { return sentryAvailable; }
