/**
 * Admin sistem sağlığı.
 *   GET /api/admin/monitoring/overview?range=1h|24h|7d
 *     → api (istek/dk, ort/max süre, hata oranı, yavaş & yoğun route'lar, saatlik seri)
 *     → db  (bağlantı sayısı, boyut, cache hit, uzun sorgular, en büyük tablolar)
 *     → ai  (bugün/7g/30g maliyet, model & route kırılımı, fiyatsız modeller)
 *     → process (uptime, bellek, env, gitSha)
 */

import { Router, Response } from "express";
import os from "node:os";
import { pool } from "@workspace/db";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth.js";
import { appEnv } from "../lib/app-env.js";

const router = Router();

const RANGES: Record<string, string> = { "1h": "1 hour", "24h": "24 hours", "7d": "7 days" };

async function q<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
  try { return (await pool.query(sql, params)).rows as T[]; }
  catch (e: any) { if (e?.code === "42P01") return []; throw e; }
}

router.get("/admin/monitoring/overview", authMiddleware, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  const range = RANGES[String(req.query.range ?? "24h")] ?? "24 hours";
  try {
    const [apiTotals, slowest, busiest, series, errRoutes] = await Promise.all([
      q(`SELECT COALESCE(SUM(count),0)::int AS count, COALESCE(SUM(total_ms),0)::bigint AS total_ms,
                COALESCE(MAX(max_ms),0)::int AS max_ms, COALESCE(SUM(err_count),0)::int AS err,
                COALESCE(SUM(b_fast),0)::int AS b_fast, COALESCE(SUM(b_ok),0)::int AS b_ok,
                COALESCE(SUM(b_slow),0)::int AS b_slow, COALESCE(SUM(b_very_slow),0)::int AS b_very_slow,
                EXTRACT(EPOCH FROM (NOW() - (NOW() - INTERVAL '${range}')))/60 AS minutes
         FROM api_metrics_minute WHERE ts_minute >= NOW() - INTERVAL '${range}'`),
      q(`SELECT method, route, SUM(count)::int AS count, (SUM(total_ms)/NULLIF(SUM(count),0))::int AS avg_ms, MAX(max_ms)::int AS max_ms
         FROM api_metrics_minute WHERE ts_minute >= NOW() - INTERVAL '${range}'
         GROUP BY method, route HAVING SUM(count) >= 3 ORDER BY avg_ms DESC LIMIT 10`),
      q(`SELECT method, route, SUM(count)::int AS count, (SUM(total_ms)/NULLIF(SUM(count),0))::int AS avg_ms, SUM(err_count)::int AS err
         FROM api_metrics_minute WHERE ts_minute >= NOW() - INTERVAL '${range}'
         GROUP BY method, route ORDER BY count DESC LIMIT 10`),
      q(`SELECT date_trunc(${range === "1 hour" ? "'minute'" : "'hour'"}, ts_minute) AS t,
                SUM(count)::int AS count, (SUM(total_ms)/NULLIF(SUM(count),0))::int AS avg_ms, SUM(err_count)::int AS err
         FROM api_metrics_minute WHERE ts_minute >= NOW() - INTERVAL '${range}'
         GROUP BY 1 ORDER BY 1`),
      q(`SELECT method, route, SUM(err_count)::int AS err, SUM(count)::int AS count
         FROM api_metrics_minute WHERE ts_minute >= NOW() - INTERVAL '${range}' AND err_count > 0
         GROUP BY method, route ORDER BY err DESC LIMIT 10`),
    ]);

    const [conns, dbSize, cacheHit, longRunning, bigTables, dbVersion] = await Promise.all([
      q(`SELECT state, COUNT(*)::int AS n FROM pg_stat_activity WHERE datname = current_database() GROUP BY state`),
      q(`SELECT pg_database_size(current_database())::bigint AS bytes`),
      q(`SELECT ROUND(100.0 * SUM(blks_hit) / NULLIF(SUM(blks_hit)+SUM(blks_read),0), 2) AS pct,
                SUM(xact_commit)::bigint AS commits, SUM(xact_rollback)::bigint AS rollbacks
         FROM pg_stat_database WHERE datname = current_database()`),
      q(`SELECT pid, EXTRACT(EPOCH FROM (NOW()-query_start))::int AS seconds, state, LEFT(query, 160) AS query
         FROM pg_stat_activity
         WHERE datname = current_database() AND state <> 'idle' AND query_start < NOW() - INTERVAL '5 seconds'
           AND pid <> pg_backend_pid() ORDER BY query_start LIMIT 10`),
      q(`SELECT relname AS table, pg_total_relation_size(relid)::bigint AS bytes, n_live_tup::bigint AS rows
         FROM pg_stat_user_tables ORDER BY pg_total_relation_size(relid) DESC LIMIT 8`),
      q(`SELECT version()`),
    ]);

    const [aiToday, ai7d, ai30d, aiByModel, aiByRoute, aiUnpriced, aiSeries] = await Promise.all([
      q(`SELECT COUNT(*)::int AS calls, COALESCE(SUM(cost_usd),0)::float AS cost, COALESCE(SUM(prompt_tokens+completion_tokens),0)::bigint AS tokens
         FROM ai_usage_log WHERE ts >= date_trunc('day', NOW() AT TIME ZONE 'Europe/Istanbul') AT TIME ZONE 'Europe/Istanbul'`),
      q(`SELECT COUNT(*)::int AS calls, COALESCE(SUM(cost_usd),0)::float AS cost FROM ai_usage_log WHERE ts >= NOW() - INTERVAL '7 days'`),
      q(`SELECT COUNT(*)::int AS calls, COALESCE(SUM(cost_usd),0)::float AS cost FROM ai_usage_log WHERE ts >= NOW() - INTERVAL '30 days'`),
      q(`SELECT COALESCE(model,'?') AS model, endpoint, COUNT(*)::int AS calls, SUM(prompt_tokens)::bigint AS prompt_tokens,
                SUM(completion_tokens)::bigint AS completion_tokens, COALESCE(SUM(cost_usd),0)::float AS cost, (AVG(duration_ms))::int AS avg_ms
         FROM ai_usage_log WHERE ts >= NOW() - INTERVAL '30 days' GROUP BY model, endpoint ORDER BY cost DESC`),
      q(`SELECT COALESCE(route,'(cron / arka plan)') AS route, COUNT(*)::int AS calls, COALESCE(SUM(cost_usd),0)::float AS cost
         FROM ai_usage_log WHERE ts >= NOW() - INTERVAL '30 days' GROUP BY route ORDER BY cost DESC LIMIT 15`),
      q(`SELECT COALESCE(model,'?') AS model, endpoint, COUNT(*)::int AS calls FROM ai_usage_log
         WHERE ts >= NOW() - INTERVAL '30 days' AND priced = false GROUP BY model, endpoint ORDER BY calls DESC`),
      q(`SELECT date_trunc('day', ts AT TIME ZONE 'Europe/Istanbul') AS day, COALESCE(SUM(cost_usd),0)::float AS cost, COUNT(*)::int AS calls
         FROM ai_usage_log WHERE ts >= NOW() - INTERVAL '30 days' GROUP BY 1 ORDER BY 1`),
    ]);

    const t = apiTotals[0] ?? {};
    const minutes = Number(t.minutes) || 1;
    const count = Number(t.count ?? 0);
    const connMap: Record<string, number> = {};
    for (const c of conns) connMap[c.state ?? "null"] = c.n;
    const totalConns = Object.values(connMap).reduce((a, b) => a + b, 0);

    return res.json({
      range: String(req.query.range ?? "24h"),
      generatedAt: new Date().toISOString(),
      process: {
        env: appEnv(),
        gitSha: process.env.GIT_SHA ?? null,
        uptimeSec: Math.round(process.uptime()),
        node: process.version,
        rssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
        heapMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        cpus: os.cpus().length,
        loadAvg1: Number(os.loadavg()[0].toFixed(2)),
        totalMemMb: Math.round(os.totalmem() / 1024 / 1024),
        freeMemMb: Math.round(os.freemem() / 1024 / 1024),
      },
      api: {
        count,
        reqPerMin: Number((count / minutes).toFixed(2)),
        avgMs: count ? Math.round(Number(t.total_ms) / count) : 0,
        maxMs: Number(t.max_ms ?? 0),
        errCount: Number(t.err ?? 0),
        errRatePct: count ? Number(((Number(t.err) / count) * 100).toFixed(2)) : 0,
        buckets: { fast: t.b_fast ?? 0, ok: t.b_ok ?? 0, slow: t.b_slow ?? 0, verySlow: t.b_very_slow ?? 0 },
        slowest, busiest, errRoutes, series,
        tracked: slowest.length > 0 || count > 0,
      },
      db: {
        connections: { total: totalConns, active: connMap.active ?? 0, idle: connMap.idle ?? 0, idleInTx: connMap["idle in transaction"] ?? 0, poolMaxPerWorker: 25 },
        sizeBytes: Number(dbSize[0]?.bytes ?? 0),
        cacheHitPct: cacheHit[0]?.pct != null ? Number(cacheHit[0].pct) : null,
        commits: Number(cacheHit[0]?.commits ?? 0),
        rollbacks: Number(cacheHit[0]?.rollbacks ?? 0),
        longRunning,
        bigTables: bigTables.map((b) => ({ ...b, bytes: Number(b.bytes), rows: Number(b.rows) })),
        version: String(dbVersion[0]?.version ?? "").split(" on ")[0],
      },
      ai: {
        today: aiToday[0] ?? { calls: 0, cost: 0, tokens: 0 },
        last7d: ai7d[0] ?? { calls: 0, cost: 0 },
        last30d: ai30d[0] ?? { calls: 0, cost: 0 },
        byModel: aiByModel.map((m) => ({ ...m, prompt_tokens: Number(m.prompt_tokens), completion_tokens: Number(m.completion_tokens) })),
        byRoute: aiByRoute,
        unpriced: aiUnpriced,
        series: aiSeries,
        tracked: ai30d[0]?.calls > 0,
      },
    });
  } catch (e: any) {
    console.error("[monitoring] HATA:", e?.message);
    return res.status(500).json({ error: e?.message ?? "Monitoring verisi alınamadı" });
  }
});

export default router;
