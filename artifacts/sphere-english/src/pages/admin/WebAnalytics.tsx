import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Users,
  Eye,
  MousePointer2,
  RefreshCw,
  Loader2,
  Monitor,
  Smartphone,
  Tablet,
  Globe,
  Clock,
  ChevronUp,
  ChevronDown,
  Minus,
  Bot,
  ExternalLink,
} from "lucide-react";
import { API } from "@/lib/api-url";

const TOKEN_KEY = "sphere_token";

async function apiFetch(path: string) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

type Range = "24h" | "7d" | "30d";

interface Overview {
  range: string;
  current: {
    visitors: number;
    sessions: number;
    pageviews: number;
    avgPvPerSession: number;
    bounceRate: number;
  };
  delta: {
    visitors: number | null;
    sessions: number | null;
    pageviews: number | null;
  };
}

interface TopPage {
  path: string;
  pageviews: number;
  unique_visitors: number;
  sample_title: string | null;
}

interface ReferrerDomain {
  source: string;
  sessions: number;
  visitors: number;
}

interface DeviceRow {
  device?: string;
  browser?: string;
  os?: string;
  sessions: number;
}

interface RecentVisit {
  id: number;
  viewed_at: string;
  path: string;
  page_title: string | null;
  visitor_id: string;
  device_type: string;
  browser: string;
  os: string;
  referrer_domain: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  is_bot: boolean;
}

function fmtDate(d: string) {
  const date = new Date(d);
  const diff = Date.now() - date.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "az önce";
  if (m < 60) return `${m} dk önce`;
  if (m < 1440) return `${Math.floor(m / 60)} sa önce`;
  return date.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtNumber(n: number) {
  return new Intl.NumberFormat("tr-TR").format(n);
}

function DeviceIcon({ type }: { type: string }) {
  const t = type?.toLowerCase();
  if (t === "mobile") return <Smartphone size={12} />;
  if (t === "tablet") return <Tablet size={12} />;
  return <Monitor size={12} />;
}

function Delta({ value }: { value: number | null }) {
  if (value === null || value === undefined) {
    return <span className="text-[10px] text-slate-400">—</span>;
  }
  if (value > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700">
        <ChevronUp size={11} />%{value}
      </span>
    );
  }
  if (value < 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-red-700">
        <ChevronDown size={11} />%{Math.abs(value)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-slate-500">
      <Minus size={11} />%0
    </span>
  );
}

export default function WebAnalytics() {
  const [range, setRange] = useState<Range>("7d");
  const [includeBots, setIncludeBots] = useState(false);
  const [loading, setLoading] = useState(true);

  const [overview, setOverview] = useState<Overview | null>(null);
  const [topPages, setTopPages] = useState<TopPage[]>([]);
  const [referrers, setReferrers] = useState<ReferrerDomain[]>([]);
  const [devices, setDevices] = useState<{
    devices: DeviceRow[];
    browsers: DeviceRow[];
    oses: DeviceRow[];
  }>({ devices: [], browsers: [], oses: [] });
  const [recent, setRecent] = useState<RecentVisit[]>([]);

  const bots = includeBots ? "1" : "0";

  async function loadAll() {
    setLoading(true);
    try {
      const [o, t, r, d, rec] = await Promise.all([
        apiFetch(`/admin/analytics/web/overview?range=${range}&includeBots=${bots}`),
        apiFetch(`/admin/analytics/web/top-pages?range=${range}&includeBots=${bots}&limit=15`),
        apiFetch(`/admin/analytics/web/referrers?range=${range}&includeBots=${bots}`),
        apiFetch(`/admin/analytics/web/devices?range=${range}&includeBots=${bots}`),
        apiFetch(`/admin/analytics/web/recent?limit=50&includeBots=${bots}`),
      ]);
      setOverview(o as Overview);
      setTopPages(t.pages ?? []);
      setReferrers(r.domains ?? []);
      setDevices(d);
      setRecent(rec.visits ?? []);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, includeBots]);

  // 30 sn auto-refresh
  useEffect(() => {
    const t = setInterval(() => {
      loadAll();
    }, 30_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, includeBots]);

  const maxPageviews = useMemo(
    () => topPages.reduce((max, p) => Math.max(max, p.pageviews), 0),
    [topPages],
  );
  const maxReferrer = useMemo(
    () => referrers.reduce((max, r) => Math.max(max, r.sessions), 0),
    [referrers],
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Activity className="w-7 h-7 text-sky-600" />
          <h1 className="text-2xl font-bold text-slate-900">Web Analiz</h1>
        </div>
        <div className="flex items-center gap-2">
          {(["24h", "7d", "30d"] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                range === r
                  ? "bg-sky-600 text-white"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {r === "24h" ? "24 Saat" : r === "7d" ? "7 Gün" : "30 Gün"}
            </button>
          ))}
          <label className="ml-2 inline-flex items-center gap-1.5 text-[11px] text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={includeBots}
              onChange={(e) => setIncludeBots(e.target.checked)}
              className="accent-sky-600"
            />
            <Bot size={12} /> Bot'ları dahil et
          </label>
          <button
            onClick={loadAll}
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
          >
            <RefreshCw size={14} /> Yenile
          </button>
        </div>
      </div>
      <p className="text-sm text-slate-500 mb-6">
        sphereenglish.com ziyaretçi takibi — KVKK uyumlu, self-hosted, çerez gerekmez. 30 saniyede
        bir otomatik yenilenir.
      </p>

      {loading && !overview ? (
        <div className="text-center py-16 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin inline-block mr-2" />
          Yükleniyor…
        </div>
      ) : (
        <>
          {/* ─── Stat kartları ───────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <StatCard
              label="Tekil Ziyaretçi"
              value={fmtNumber(overview?.current.visitors ?? 0)}
              icon={<Users size={18} />}
              delta={overview?.delta.visitors ?? null}
              color="sky"
            />
            <StatCard
              label="Oturum"
              value={fmtNumber(overview?.current.sessions ?? 0)}
              icon={<MousePointer2 size={18} />}
              delta={overview?.delta.sessions ?? null}
              color="violet"
            />
            <StatCard
              label="Sayfa Görüntüleme"
              value={fmtNumber(overview?.current.pageviews ?? 0)}
              icon={<Eye size={18} />}
              delta={overview?.delta.pageviews ?? null}
              color="emerald"
            />
            <StatCard
              label="Sayfa / Oturum"
              value={(overview?.current.avgPvPerSession ?? 0).toFixed(1)}
              sub={`Hemen çıkma: %${(overview?.current.bounceRate ?? 0).toFixed(0)}`}
              icon={<Activity size={18} />}
              color="amber"
            />
          </div>

          {/* ─── 2 sütun: Top pages + Referrers ─────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <Panel
              title="En Popüler Sayfalar"
              icon={<Eye size={16} />}
              empty={topPages.length === 0}
            >
              <div className="space-y-1.5">
                {topPages.map((p) => (
                  <div key={p.path} className="group">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <a
                        href={`https://www.sphereenglish.com${p.path}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 truncate text-slate-700 hover:text-sky-600 group-hover:underline"
                        title={p.path}
                      >
                        <div className="truncate font-medium">
                          {p.sample_title || p.path}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">{p.path}</div>
                      </a>
                      <div className="text-right">
                        <div className="font-bold text-slate-900 text-sm">
                          {fmtNumber(p.pageviews)}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {fmtNumber(p.unique_visitors)} ziyaretçi
                        </div>
                      </div>
                    </div>
                    <div className="mt-1 h-1 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full bg-sky-500"
                        style={{
                          width: `${maxPageviews ? (p.pageviews / maxPageviews) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel
              title="Trafik Kaynakları"
              icon={<Globe size={16} />}
              empty={referrers.length === 0}
            >
              <div className="space-y-1.5">
                {referrers.map((r) => (
                  <div key={r.source}>
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <div className="flex-1 truncate text-slate-700 font-medium">
                        {r.source === "Direkt" ? (
                          <span className="text-slate-500">Doğrudan trafik</span>
                        ) : (
                          r.source
                        )}
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-slate-900 text-sm">
                          {fmtNumber(r.sessions)}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {fmtNumber(r.visitors)} ziyaretçi
                        </div>
                      </div>
                    </div>
                    <div className="mt-1 h-1 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full bg-violet-500"
                        style={{
                          width: `${maxReferrer ? (r.sessions / maxReferrer) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          {/* ─── 3 sütun: Cihaz/Tarayıcı/OS ──────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            <Panel title="Cihaz Tipi" icon={<Monitor size={16} />} empty={devices.devices.length === 0}>
              <SmallList
                rows={devices.devices.map((d) => ({ label: d.device ?? "—", value: d.sessions }))}
              />
            </Panel>
            <Panel title="Tarayıcılar" icon={<Globe size={16} />} empty={devices.browsers.length === 0}>
              <SmallList
                rows={devices.browsers.map((d) => ({ label: d.browser ?? "—", value: d.sessions }))}
              />
            </Panel>
            <Panel title="İşletim Sistemleri" icon={<Monitor size={16} />} empty={devices.oses.length === 0}>
              <SmallList rows={devices.oses.map((d) => ({ label: d.os ?? "—", value: d.sessions }))} />
            </Panel>
          </div>

          {/* ─── Son ziyaretler ───────────────────────────── */}
          <Panel
            title="Son Ziyaretler"
            icon={<Clock size={16} />}
            subtitle="Gerçek zamanlı — son 50 sayfa görüntüleme"
            empty={recent.length === 0}
          >
            <div className="space-y-1.5 max-h-[460px] overflow-y-auto pr-1">
              {recent.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center gap-3 text-sm py-2 border-b border-slate-100 last:border-b-0"
                >
                  <div
                    className="flex items-center gap-1 text-slate-500 text-xs w-24 flex-shrink-0"
                    title={v.visitor_id}
                  >
                    <DeviceIcon type={v.device_type} />
                    <span className="truncate">{v.browser}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <a
                      href={`https://www.sphereenglish.com${v.path}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block truncate font-medium text-slate-700 hover:text-sky-600"
                      title={v.path}
                    >
                      {v.page_title || v.path}
                    </a>
                    <div className="text-[11px] text-slate-400 truncate">
                      {v.referrer_domain ? (
                        <>
                          <ExternalLink size={9} className="inline" /> {v.referrer_domain}
                          {v.utm_source && (
                            <span className="ml-2 text-violet-600">
                              utm: {v.utm_source}
                              {v.utm_campaign ? ` / ${v.utm_campaign}` : ""}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-slate-400">doğrudan</span>
                      )}
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-500 w-20 text-right flex-shrink-0">
                    {fmtDate(v.viewed_at)}
                  </div>
                  {v.is_bot && (
                    <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                      bot
                    </span>
                  )}
                </div>
              ))}
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon,
  delta,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: JSX.Element;
  delta?: number | null;
  color: "sky" | "violet" | "emerald" | "amber";
}) {
  const colors: Record<string, string> = {
    sky: "bg-sky-50 text-sky-700 border-sky-100",
    violet: "bg-violet-50 text-violet-700 border-violet-100",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
  };
  return (
    <div className={`p-4 rounded-xl border ${colors[color]}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="text-[11px] font-bold uppercase tracking-wider opacity-70">{label}</div>
        {icon}
      </div>
      <div className="flex items-end gap-2">
        <div className="text-2xl font-extrabold">{value}</div>
        {delta !== undefined && <Delta value={delta ?? null} />}
      </div>
      {sub && <div className="text-[11px] opacity-70 mt-1">{sub}</div>}
    </div>
  );
}

function Panel({
  title,
  icon,
  subtitle,
  empty,
  children,
}: {
  title: string;
  icon?: JSX.Element;
  subtitle?: string;
  empty?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
            {icon} {title}
          </h3>
          {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {empty ? (
        <div className="text-center py-8 text-slate-400 text-xs">Henüz veri yok</div>
      ) : (
        children
      )}
    </div>
  );
}

function SmallList({ rows }: { rows: { label: string; value: number }[] }) {
  const total = rows.reduce((sum, r) => sum + r.value, 0);
  return (
    <div className="space-y-1.5">
      {rows.map((r) => {
        const pct = total ? Math.round((r.value / total) * 100) : 0;
        return (
          <div key={r.label} className="text-sm">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-slate-700 truncate font-medium">{r.label}</span>
              <span className="text-slate-500 text-xs">
                {fmtNumber(r.value)} <span className="text-slate-400">· %{pct}</span>
              </span>
            </div>
            <div className="h-1 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full bg-sky-500" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
