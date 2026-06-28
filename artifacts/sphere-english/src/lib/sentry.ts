/**
 * Sentry hata izleme — frontend.
 *
 * Env: VITE_SENTRY_DSN
 */

let sentryReady = false;
let Sentry: any = null;

export async function initSentry(): Promise<void> {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;
  try {
    Sentry = await import("@sentry/react");
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      tracesSampleRate: 0.1,
      beforeSend(event: any) {
        // hassas alanları temizle
        if (event.request?.headers) {
          delete event.request.headers["authorization"];
          delete event.request.headers["cookie"];
        }
        return event;
      },
    });
    sentryReady = true;
    console.info("[sentry] aktif");
  } catch (e) {
    console.warn("[sentry] init başarısız", e);
  }
}

export function captureError(err: unknown, context?: Record<string, any>): void {
  if (!sentryReady || !Sentry) {
    console.error("[error]", err, context);
    return;
  }
  try { Sentry.captureException(err, context ? { extra: context } : undefined); } catch {}
}

export function setSentryUser(user: { id?: number; email?: string; role?: string } | null): void {
  if (!sentryReady || !Sentry) return;
  try {
    if (user) Sentry.setUser({ id: user.id, email: user.email, segment: user.role });
    else Sentry.setUser(null);
  } catch {}
}
