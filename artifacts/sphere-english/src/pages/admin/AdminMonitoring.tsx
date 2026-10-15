import { useCallback, useEffect, useState } from "react";
import { Activity, RefreshCw, Loader2, AlertCircle, X, Database, Cpu, Sparkles, Clock, AlertTriangle } from "lucide-react";
import { API } from "@/lib/api-url";

const TOKEN_KEY = "sphere_token";

async function apiFetch(path: string) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `HTTP ${res.status}`); }
  return res.json();
}

type Range = "1h" | "24h" | "7d";
type Overview = any;

const fmtBytes = (b: number) => b >= 1e9 ? `${(b / 1e9).toFixed(2)} GB` : b >= 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${(b / 1e3).toFixed(0)} KB`;
const fmtUsd = (n: number) => `$${Number(n ?? 0).toFixed(n >= 10 ? 2 : 4)}`;
const fmtUptime = (s: number) => s >= 86400 ? `${Math.floor(s / 86400)}g ${Math.floor((s % 86400) / 3600)}s` : s >= 3600 ? `${Math.floor(s / 3600)}s ${Math.floor((s % 3600) / 60)}dk` : `${Math.floor(s / 60)}dk`;
const fmtInt = (n: number) => Number(n ?? 0).toLocaleString("tr-TR");

function Stat({ label, value, sub, tone }: { label: string; value: string | number; sub?: string; tone?: "ok" | "warn" | "bad" }) {
  const color = tone === "bad" ? "text-red-600" : tone === "warn" ? "text-amber-600" : "text-blue-800";
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-4 py-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-2xl font-bold tabular-nums ${color}`}>{value}</div>
      {sub && <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function Section({ icon: Icon, title, children, right }: { icon: any; title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-blue-800 flex items-center gap-2"><Icon size={18} /> {title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function Table({ cols, rows, empty }: { cols: Array<{ k: string; label: string; right?: boolean; fmt?: (v: any, r: any) => React.ReactNode }>; rows: any[]; empty: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-600 text-left">
          <tr>{cols.map((c) => <th key={c.k} className={`px-3 py-2 font-medium ${c.right ? "text-right" : ""}`}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={cols.length} className="px-3 py-6 text-center text-slate-400">{empty}</td></tr>
          ) : rows.map((r, i) => (
            <tr key={i} className="border-t border-slate-100">
              {cols.map((c) => <td key={c.k} className={`px-3 py-2 ${c.right ? "text-right tabular-nums" : ""}`}>{c.fmt ? c.fmt(r[c.k], r) : r[c.k]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Basit çubuk grafik — kütüphane gerektirmez */
function Bars({ data, valueKey, labelKey, fmt, color = "bg-blue-500" }: { data: any[]; valueKey: string; labelKey: string; fmt: (v: number) => string; color?: string }) {
  const max = Math.max(1, ...data.map((d) => Number(d[valueKey] ?? 0)));
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3">
      <div className="flex items-end gap-[2px] h-28">
        {data.map((d, i) => {
          const v = Number(d[valueKey] ?? 0);
          return (
            <div key={i} className="flex-1 flex flex-col justify-end group relative" title={`${new Date(d[labelKey]).toLocaleString("tr-TR")}: ${fmt(v)}`}>
              <div className={`${color} rounded-t-sm opacity-80 group-hover:opacity-100`} style={{ height: `${Math.max(2, (v / max) * 100)}%` }} />
            </div>
          );
        })}
      </div>
      {data.length > 0 && (
        <div className="flex justify-between text-[10px] text-slate-400 mt-1">
          <span>{new Date(data[0][labelKey]).toLocaleString("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
          <span>{new Date(data[data.length - 1][labelKey]).toLocaleString("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
        </div>
      )}
    </div>
  );
}

export default function AdminMonitoring() {
  const [range, setRange] = useState<Range>("24h");
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [auto, setAuto] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await apiFetch(`/admin/monitoring/overview?range=${range}`)); setError(null); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [range]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!auto) return undefined;
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [auto, load]);

  const api = data?.api; const db = data?.db; const ai = data?.ai; const proc = data?.process;
  const errTone = api?.errRatePct > 5 ? "bad" : api?.errRatePct > 1 ? "warn" : "ok";
  const latTone = api?.avgMs > 1000 ? "bad" : api?.avgMs > 400 ? "warn" : "ok";
  const connTone = db?.connections?.total > 80 ? "bad" : db?.connections?.total > 50 ? "warn" : "ok";
  const cacheTone = db?.cacheHitPct != null && db.cacheHitPct < 95 ? "warn" : "ok";

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <header className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-blue-800 flex items-center gap-2"><Activity size={26} /> Sistem Sağlığı</h1>
          <p className="text-sm text-slate-500 mt-1">
            API gecikmesi · veritabanı · OpenAI maliyeti
            {proc && <> · <span className="font-mono">{proc.env}</span> · {proc.gitSha?.slice(0, 7)} · uptime {fmtUptime(proc.uptimeSec)}</>}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <div className="flex gap-1">
            {(["1h", "24h", "7d"] as Range[]).map((r) => (
              <button key={r} onClick={() => setRange(r)}
                className={`px-3 py-1.5 text-sm rounded-md ${range === r ? "bg-blue-700 text-white" : "bg-white border border-slate-200 hover:bg-slate-50"}`}>{r}</button>
            ))}
          </div>
          <label className="flex items-center gap-1.5 text-xs text-slate-500 ml-2">
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> 60 sn'de bir yenile
          </label>
          <button onClick={load} className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-white border border-slate-200 hover:bg-slate-50 text-sm">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Yenile
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700 flex justify-between items-center">
          <span className="flex items-center gap-2"><AlertCircle size={16} /> {error}</span>
          <button onClick={() => setError(null)}><X size={14} /></button>
        </div>
      )}

      {!data ? (
        <div className="py-16 text-center text-slate-400"><Loader2 className="animate-spin inline" size={22} /></div>
      ) : (
        <>
          {/* ── API ── */}
          <Section icon={Clock} title={`API — son ${range}`}>
            {!api.tracked && (
              <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800 flex gap-2">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" /> Henüz veri yok. `202610_monitoring.sql` migration'ı çalıştı mı? Veri deploy sonrası 1-2 dakikada birikmeye başlar.
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
              <Stat label="İstek" value={fmtInt(api.count)} sub={`${api.reqPerMin} / dk`} />
              <Stat label="Ortalama süre" value={`${api.avgMs} ms`} sub={`max ${fmtInt(api.maxMs)} ms`} tone={latTone} />
              <Stat label="Hata oranı (5xx)" value={`%${api.errRatePct}`} sub={`${api.errCount} hata`} tone={errTone} />
              <Stat label="Hızlı (<100ms)" value={api.count ? `%${Math.round((api.buckets.fast / api.count) * 100)}` : "—"} />
              <Stat label="Yavaş (≥1s)" value={api.count ? `%${((api.buckets.verySlow / api.count) * 100).toFixed(1)}` : "—"} sub={`${api.buckets.verySlow} istek`} tone={api.count && api.buckets.verySlow / api.count > 0.05 ? "warn" : "ok"} />
            </div>
            {api.series?.length > 0 && (
              <div className="grid md:grid-cols-2 gap-3 mb-4">
                <div><div className="text-xs text-slate-500 mb-1">İstek sayısı</div><Bars data={api.series} valueKey="count" labelKey="t" fmt={(v) => `${v} istek`} /></div>
                <div><div className="text-xs text-slate-500 mb-1">Ortalama süre (ms)</div><Bars data={api.series} valueKey="avg_ms" labelKey="t" fmt={(v) => `${v} ms`} color="bg-amber-500" /></div>
              </div>
            )}
            <div className="grid lg:grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-slate-500 mb-1">En yavaş route'lar (≥3 istek)</div>
                <Table empty="Veri yok" rows={api.slowest} cols={[
                  { k: "route", label: "Route", fmt: (v, r) => <span className="font-mono text-xs"><b>{r.method}</b> {v}</span> },
                  { k: "count", label: "İstek", right: true, fmt: fmtInt },
                  { k: "avg_ms", label: "Ort. ms", right: true, fmt: (v) => <span className={v > 1000 ? "text-red-600 font-semibold" : v > 400 ? "text-amber-600" : ""}>{v}</span> },
                  { k: "max_ms", label: "Max ms", right: true, fmt: fmtInt },
                ]} />
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">En yoğun route'lar</div>
                <Table empty="Veri yok" rows={api.busiest} cols={[
                  { k: "route", label: "Route", fmt: (v, r) => <span className="font-mono text-xs"><b>{r.method}</b> {v}</span> },
                  { k: "count", label: "İstek", right: true, fmt: fmtInt },
                  { k: "avg_ms", label: "Ort. ms", right: true },
                  { k: "err", label: "5xx", right: true, fmt: (v) => <span className={v > 0 ? "text-red-600 font-semibold" : ""}>{v}</span> },
                ]} />
              </div>
            </div>
            {api.errRoutes?.length > 0 && (
              <div className="mt-3">
                <div className="text-xs text-red-600 mb-1 font-semibold">5xx üreten route'lar</div>
                <Table empty="" rows={api.errRoutes} cols={[
                  { k: "route", label: "Route", fmt: (v, r) => <span className="font-mono text-xs"><b>{r.method}</b> {v}</span> },
                  { k: "err", label: "Hata", right: true },
                  { k: "count", label: "Toplam", right: true },
                ]} />
              </div>
            )}
          </Section>

          {/* ── DB ── */}
          <Section icon={Database} title="Veritabanı" right={<span className="text-xs text-slate-400">{db.version}</span>}>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
              <Stat label="Bağlantı" value={db.connections.total} sub={`aktif ${db.connections.active} · boşta ${db.connections.idle}${db.connections.idleInTx ? ` · idle-in-tx ${db.connections.idleInTx}` : ""}`} tone={connTone} />
              <Stat label="Boyut" value={fmtBytes(db.sizeBytes)} />
              <Stat label="Cache hit" value={db.cacheHitPct != null ? `%${db.cacheHitPct}` : "—"} sub="≥%99 ideal" tone={cacheTone} />
              <Stat label="Commit / rollback" value={fmtInt(db.commits)} sub={`${fmtInt(db.rollbacks)} rollback`} />
              <Stat label="Uzun sorgu (>5s)" value={db.longRunning.length} tone={db.longRunning.length > 0 ? "warn" : "ok"} />
            </div>
            <div className="grid lg:grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-slate-500 mb-1">En büyük tablolar</div>
                <Table empty="—" rows={db.bigTables} cols={[
                  { k: "table", label: "Tablo", fmt: (v) => <span className="font-mono text-xs">{v}</span> },
                  { k: "rows", label: "Satır", right: true, fmt: fmtInt },
                  { k: "bytes", label: "Boyut", right: true, fmt: fmtBytes },
                ]} />
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">Şu an çalışan uzun sorgular</div>
                <Table empty="Yok — iyi" rows={db.longRunning} cols={[
                  { k: "seconds", label: "sn", right: true },
                  { k: "state", label: "Durum" },
                  { k: "query", label: "Sorgu", fmt: (v) => <span className="font-mono text-[11px] break-all">{v}</span> },
                ]} />
              </div>
            </div>
          </Section>

          {/* ── AI ── */}
          <Section icon={Sparkles} title="OpenAI kullanımı">
            {!ai.tracked && (
              <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800 flex gap-2">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" /> Henüz kayıt yok. İlk AI çağrısından sonra görünür.
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <Stat label="Bugün" value={fmtUsd(ai.today.cost)} sub={`${fmtInt(ai.today.calls)} çağrı · ${fmtInt(ai.today.tokens)} token`} />
              <Stat label="Son 7 gün" value={fmtUsd(ai.last7d.cost)} sub={`${fmtInt(ai.last7d.calls)} çağrı`} />
              <Stat label="Son 30 gün" value={fmtUsd(ai.last30d.cost)} sub={`${fmtInt(ai.last30d.calls)} çağrı`} />
              <Stat label="Aylık projeksiyon" value={fmtUsd((ai.last7d.cost / 7) * 30)} sub="son 7 gün ortalamasından" tone={(ai.last7d.cost / 7) * 30 > 100 ? "warn" : "ok"} />
            </div>
            {ai.series?.length > 0 && (
              <div className="mb-4"><div className="text-xs text-slate-500 mb-1">Günlük maliyet (30 gün)</div><Bars data={ai.series} valueKey="cost" labelKey="day" fmt={fmtUsd} color="bg-emerald-500" /></div>
            )}
            {ai.unpriced?.length > 0 && (
              <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800">
                <b>Fiyatı bilinmeyen çağrılar</b> (maliyete dahil değil): {ai.unpriced.map((u: any) => `${u.model} / ${u.endpoint} (${u.calls})`).join(", ")}.
                Stream yanıtlar ve ses süresi bilinmeyen STT çağrıları buraya düşer.
              </div>
            )}
            <div className="grid lg:grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-slate-500 mb-1">Model bazında (30 gün)</div>
                <Table empty="—" rows={ai.byModel} cols={[
                  { k: "model", label: "Model", fmt: (v, r) => <span className="font-mono text-xs">{v}<span className="text-slate-400"> · {r.endpoint}</span></span> },
                  { k: "calls", label: "Çağrı", right: true, fmt: fmtInt },
                  { k: "prompt_tokens", label: "In", right: true, fmt: fmtInt },
                  { k: "completion_tokens", label: "Out", right: true, fmt: fmtInt },
                  { k: "avg_ms", label: "Ort. ms", right: true },
                  { k: "cost", label: "Maliyet", right: true, fmt: fmtUsd },
                ]} />
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">Hangi özellik harcıyor (30 gün)</div>
                <Table empty="—" rows={ai.byRoute} cols={[
                  { k: "route", label: "Route", fmt: (v) => <span className="font-mono text-xs">{v}</span> },
                  { k: "calls", label: "Çağrı", right: true, fmt: fmtInt },
                  { k: "cost", label: "Maliyet", right: true, fmt: fmtUsd },
                ]} />
              </div>
            </div>
          </Section>

          {/* ── Process ── */}
          <Section icon={Cpu} title="Süreç / sunucu">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Stat label="Uptime" value={fmtUptime(proc.uptimeSec)} sub={`node ${proc.node}`} />
              <Stat label="Bellek (bu worker)" value={`${proc.rssMb} MB`} sub={`heap ${proc.heapMb} MB`} />
              <Stat label="Sunucu RAM" value={`${Math.round((1 - proc.freeMemMb / proc.totalMemMb) * 100)}%`} sub={`${fmtInt(proc.totalMemMb - proc.freeMemMb)} / ${fmtInt(proc.totalMemMb)} MB`} tone={1 - proc.freeMemMb / proc.totalMemMb > 0.9 ? "bad" : 1 - proc.freeMemMb / proc.totalMemMb > 0.75 ? "warn" : "ok"} />
              <Stat label="CPU yükü (1dk)" value={proc.loadAvg1} sub={`${proc.cpus} çekirdek`} tone={proc.loadAvg1 > proc.cpus ? "bad" : proc.loadAvg1 > proc.cpus * 0.7 ? "warn" : "ok"} />
              <Stat label="Ortam" value={proc.env} sub={proc.gitSha?.slice(0, 12)} />
            </div>
          </Section>
        </>
      )}
    </div>
  );
}
