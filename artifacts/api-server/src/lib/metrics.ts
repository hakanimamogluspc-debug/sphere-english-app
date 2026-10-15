/**
 * API istek metrikleri — route bazlı dakikalık toplama.
 *
 * - requestContext (AsyncLocalStorage): o anki isteğin route'unu tutar; ai-usage.ts
 *   OpenAI çağrısını hangi route'un başlattığını buradan öğrenir.
 * - metricsMiddleware: her isteğin süresini ölçer, bellekte dakikalık toplar.
 * - Her 60 sn'de DB'ye flush (api_metrics_minute, UPSERT ile toplanır → cluster'daki
 *   her worker kendi payını ekler).
 * - 30 günden eski satırlar günde bir prune edilir.
 *
 * Maliyet: istek başına ~birkaç µs; DB yazımı dakikada tek toplu sorgu.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import type { Request, Response, NextFunction } from "express";
import { pool } from "@workspace/db";

export const requestContext = new AsyncLocalStorage<{ route: string; method: string }>();

type Agg = { count: number; totalMs: number; maxMs: number; err: number; b: [number, number, number, number] };
const buffer = new Map<string, Agg>(); // key: tsMinuteISO|method|route

/** /api/users/123/progress → /api/users/:id/progress (route tanımı yoksa) */
function normalizePath(p: string): string {
  return p
    .replace(/\/\d+(?=\/|$)/g, "/:id")
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\/|$)/gi, "/:uuid")
    .replace(/\/[A-Za-z0-9_-]{24,}(?=\/|$)/g, "/:token")
    .slice(0, 200);
}

export function routeLabel(req: Request): string {
  const r = (req as any).route?.path as string | undefined;
  if (r) return normalizePath(`${req.baseUrl ?? ""}${r}`);
  return normalizePath(`${req.baseUrl ?? ""}${req.path ?? ""}`);
}

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Statik dosya / health gürültüsü sayılmasın
  const p = req.path || "";
  if (!p.startsWith("/api") && !p.startsWith("/api-server")) return next();
  if (p.endsWith("/healthz")) return next();

  const start = process.hrtime.bigint();
  const ctx = { route: normalizePath(`${req.baseUrl ?? ""}${req.path}`), method: req.method };
  (req as any).__metricsCtx = ctx;

  res.on("finish", () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    const route = routeLabel(req);
    const minute = new Date(); minute.setSeconds(0, 0);
    const key = `${minute.toISOString()}|${req.method}|${route}`;
    const a = buffer.get(key) ?? { count: 0, totalMs: 0, maxMs: 0, err: 0, b: [0, 0, 0, 0] };
    a.count++; a.totalMs += ms; if (ms > a.maxMs) a.maxMs = ms;
    if (res.statusCode >= 500) a.err++;
    a.b[ms < 100 ? 0 : ms < 300 ? 1 : ms < 1000 ? 2 : 3]++;
    buffer.set(key, a);
  });

  requestContext.run(ctx, () => next());
}

/**
 * multer gibi stream tabanlı middleware'ler AsyncLocalStorage bağlamını düşürüyor;
 * upload.single(...) sonrasına eklenince route bilgisi OpenAI çağrılarına geri gelir.
 *   router.post("/x", authMiddleware, upload.single("audio"), rebindRequestContext, handler)
 */
export function rebindRequestContext(req: Request, _res: Response, next: NextFunction): void {
  const ctx = (req as any).__metricsCtx;
  if (!ctx) return next();
  requestContext.run(ctx, () => next());
}

async function flush(): Promise<void> {
  if (buffer.size === 0) return;
  const rows = [...buffer.entries()];
  buffer.clear();
  const values: unknown[] = [];
  const tuples = rows.map(([key, a], i) => {
    const [ts, method, route] = key.split("|");
    const o = i * 11;
    values.push(ts, route, method, a.count, Math.round(a.totalMs), Math.round(a.maxMs), a.err, a.b[0], a.b[1], a.b[2], a.b[3]);
    return `($${o + 1},$${o + 2},$${o + 3},$${o + 4},$${o + 5},$${o + 6},$${o + 7},$${o + 8},$${o + 9},$${o + 10},$${o + 11})`;
  });
  try {
    await pool.query(
      `INSERT INTO api_metrics_minute
         (ts_minute, route, method, count, total_ms, max_ms, err_count, b_fast, b_ok, b_slow, b_very_slow)
       VALUES ${tuples.join(",")}
       ON CONFLICT (ts_minute, route, method) DO UPDATE SET
         count = api_metrics_minute.count + EXCLUDED.count,
         total_ms = api_metrics_minute.total_ms + EXCLUDED.total_ms,
         max_ms = GREATEST(api_metrics_minute.max_ms, EXCLUDED.max_ms),
         err_count = api_metrics_minute.err_count + EXCLUDED.err_count,
         b_fast = api_metrics_minute.b_fast + EXCLUDED.b_fast,
         b_ok = api_metrics_minute.b_ok + EXCLUDED.b_ok,
         b_slow = api_metrics_minute.b_slow + EXCLUDED.b_slow,
         b_very_slow = api_metrics_minute.b_very_slow + EXCLUDED.b_very_slow`,
      values,
    );
  } catch (e: any) {
    // Tablo yoksa (migration çalışmadı) sessizce geç — uygulamayı etkilemesin
    if (e?.code !== "42P01") console.warn("[metrics] flush HATA:", e?.message);
  }
}

let started = false;
export function startMetricsFlusher(): void {
  if (started) return;
  started = true;
  setInterval(() => { flush().catch(() => {}); }, 60_000).unref();
  // Günde bir prune (30 gün) — sadece cluster primary ya da tek süreç çağırır
  setInterval(() => {
    pool.query(`DELETE FROM api_metrics_minute WHERE ts_minute < NOW() - INTERVAL '30 days'`).catch(() => {});
    pool.query(`DELETE FROM ai_usage_log WHERE ts < NOW() - INTERVAL '90 days'`).catch(() => {});
  }, 24 * 60 * 60 * 1000).unref();
}

/** Graceful shutdown'da son dakikayı kaybetme */
export const flushMetricsNow = flush;
