import { useEffect, useState, type ReactNode } from "react";
import { BellRing, Loader2, AlertCircle, X, RefreshCw, Eye } from "lucide-react";
import { API } from "@/lib/api-url";

const TOKEN_KEY = "sphere_token";
async function apiFetch(path: string) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res;
}

interface Touch { key: string; day: number; label: string }
interface TouchRow { type: string; touchDay: number | null; sent: number; failed: number; returned: number; avgReturnDays: number | null }
interface VariantRow { type: string; variant: string; sent: number; returned: number }
interface WeekRow { week: string; sent: number; returned: number }
interface RecentRow { sentDate: string; type: string; variant: string | null; status: string; returnedDays: number | null; firstName: string | null; email: string | null }
interface Stats { days: number; touches: Touch[]; byTouch: TouchRow[]; byVariant: VariantRow[]; weekly: WeekRow[]; recent: RecentRow[]; pendingWindow: number }

const TYPE_LABEL: Record<string, string> = {
  streak_risk: "Seri riski (akşam)",
  comeback_3: "3. gün — kısa mola",
  comeback_7: "7. gün — kelimeler",
  comeback_14: "14. gün — yeni açı",
  comeback_30: "30. gün — hedef",
  comeback_60: "60. gün — son mesaj",
  comeback: "Eski comeback (tek şablon)",
};
const pct = (a: number, b: number) => (b > 0 ? `%${Math.round((a / b) * 100)}` : "—");
const fmtDate = (s: string) => new Date(s).toLocaleDateString("tr-TR", { day: "2-digit", month: "short" });

export default function AdminReminders() {
  const [days, setDays] = useState(90);
  const [data, setData] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<{ key: string; variant: "A" | "B" } | null>(null);
  const [previewHtml, setPreviewHtml] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const r = await apiFetch(`/admin/notifications/reminder-stats?days=${days}`);
      setData(await r.json()); setError(null);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [days]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!preview) return;
    apiFetch(`/admin/notifications/reminder-preview?touch=${preview.key}&variant=${preview.variant}`)
      .then((r) => r.text()).then(setPreviewHtml).catch((e) => setError(e.message));
  }, [preview]);

  const totalSent = data?.byTouch.reduce((s, r) => s + r.sent, 0) ?? 0;
  const totalRet = data?.byTouch.reduce((s, r) => s + r.returned, 0) ?? 0;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-blue-800 flex items-center gap-2"><BellRing size={26} /> Hatırlatma Etkisi</h1>
          <p className="text-sm text-slate-500 mt-1">
            Geri dönüş dizisi (3/7/14/30/60. gün) ve seri riski mailleri — gönderim ve 7 gün içinde geri dönüş.
            "Geri döndü" = mailden sonraki 7 günde uygulamaya girdi (korelasyon; mailden bağımsız da dönmüş olabilir).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="border rounded-lg px-2 py-1.5 text-sm">
            {[30, 60, 90, 180, 365].map((d) => <option key={d} value={d}>Son {d} gün</option>)}
          </select>
          <button onClick={load} className="px-3 py-1.5 rounded-lg border text-sm inline-flex items-center gap-1.5"><RefreshCw size={14} /> Yenile</button>
        </div>
      </header>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700 flex justify-between items-center">
          <span className="flex items-center gap-2"><AlertCircle size={16} /> {error}</span>
          <button onClick={() => setError(null)}><X size={14} /></button>
        </div>
      )}

      {loading || !data ? <div className="py-16 text-center text-slate-400"><Loader2 className="animate-spin inline" /></div> : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Gönderilen (pencere dolmuş)" value={totalSent} sub={`son ${data.days} gün`} />
            <Stat label="7 günde geri dönen" value={totalRet} sub={pct(totalRet, totalSent)} />
            <Stat label="Değerlendirme bekleyen" value={data.pendingWindow} sub="son 7 gün — pencere dolmadı" />
            <Stat label="Dokunuş sayısı" value={data.touches.length} sub="3 · 7 · 14 · 30 · 60" />
          </div>

          <Panel title="Dokunuş bazında (sadece 7 günlük penceresi dolmuş gönderimler)">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-slate-500"><tr>
                <th className="text-left py-1.5">Dokunuş</th><th className="text-right">Gönderim</th><th className="text-right">Hata</th><th className="text-right">Geri dönüş</th><th className="text-right">Oran</th><th className="text-right">Ort. dönüş günü</th><th className="text-right">Önizle</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {[...data.touches.map((t) => t.key), "streak_risk"].map((key) => {
                  const r = data.byTouch.find((x) => x.type === key);
                  return (
                    <tr key={key}>
                      <td className="py-2 font-medium text-slate-800">{TYPE_LABEL[key] ?? key}</td>
                      <td className="text-right tabular-nums">{r?.sent ?? 0}</td>
                      <td className="text-right tabular-nums text-red-600">{r?.failed ?? 0}</td>
                      <td className="text-right tabular-nums">{r?.returned ?? 0}</td>
                      <td className="text-right tabular-nums font-semibold">{pct(r?.returned ?? 0, r?.sent ?? 0)}</td>
                      <td className="text-right tabular-nums text-slate-500">{r?.avgReturnDays ?? "—"}</td>
                      <td className="text-right whitespace-nowrap">
                        <button onClick={() => setPreview({ key, variant: "A" })} className="text-xs font-semibold text-sky-700 hover:underline mr-2">A</button>
                        <button onClick={() => setPreview({ key, variant: "B" })} className="text-xs font-semibold text-sky-700 hover:underline">B</button>
                      </td>
                    </tr>
                  );
                })}
                {data.byTouch.filter((r) => !TYPE_LABEL[r.type] || r.type === "comeback").map((r) => (
                  <tr key={r.type} className="text-slate-400">
                    <td className="py-2">{TYPE_LABEL[r.type] ?? r.type}</td>
                    <td className="text-right tabular-nums">{r.sent}</td><td className="text-right">{r.failed}</td><td className="text-right">{r.returned}</td>
                    <td className="text-right">{pct(r.returned, r.sent)}</td><td className="text-right">{r.avgReturnDays ?? "—"}</td><td></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          <div className="grid gap-4 md:grid-cols-2">
            <Panel title="Konu satırı A/B">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-slate-500"><tr><th className="text-left py-1.5">Dokunuş</th><th>Varyant</th><th className="text-right">Gönderim</th><th className="text-right">Dönüş</th><th className="text-right">Oran</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {data.byVariant.map((r, i) => (
                    <tr key={i}>
                      <td className="py-1.5 text-slate-700">{TYPE_LABEL[r.type] ?? r.type}</td>
                      <td className="text-center font-mono">{r.variant}</td>
                      <td className="text-right tabular-nums">{r.sent}</td>
                      <td className="text-right tabular-nums">{r.returned}</td>
                      <td className="text-right tabular-nums font-semibold">{pct(r.returned, r.sent)}</td>
                    </tr>
                  ))}
                  {data.byVariant.length === 0 && <tr><td colSpan={5} className="py-4 text-center text-slate-400">Henüz veri yok — ilk sonuçlar 7 gün sonra.</td></tr>}
                </tbody>
              </table>
              <p className="text-xs text-slate-400 mt-2">30'ar gönderim altında fark anlamlı sayılmaz.</p>
            </Panel>
            <Panel title="Haftalık gönderim / dönüş">
              <div className="flex items-end gap-1 h-32">
                {data.weekly.map((w) => {
                  const max = Math.max(1, ...data.weekly.map((x) => x.sent));
                  return (
                    <div key={w.week} className="flex-1 flex flex-col items-center gap-0.5" title={`${fmtDate(w.week)}: ${w.sent} gönderim, ${w.returned} dönüş`}>
                      <div className="w-full bg-sky-100 rounded-t" style={{ height: `${(w.sent / max) * 100}px` }}>
                        <div className="w-full bg-sky-600 rounded-t" style={{ height: `${w.sent ? (w.returned / w.sent) * 100 : 0}%` }} />
                      </div>
                      <span className="text-[10px] text-slate-400">{fmtDate(w.week)}</span>
                    </div>
                  );
                })}
                {data.weekly.length === 0 && <p className="text-sm text-slate-400">Veri yok.</p>}
              </div>
              <p className="text-xs text-slate-400 mt-2">Açık: gönderim · koyu: geri dönüş</p>
            </Panel>
          </div>

          <Panel title="Son gönderimler">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-slate-500"><tr><th className="text-left py-1.5">Tarih</th><th className="text-left">Kullanıcı</th><th className="text-left">Dokunuş</th><th>V</th><th>Durum</th><th className="text-right">Dönüş</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {data.recent.map((r, i) => (
                  <tr key={i}>
                    <td className="py-1.5 text-slate-500 whitespace-nowrap">{fmtDate(r.sentDate)}</td>
                    <td className="text-slate-700">{r.firstName} <span className="text-slate-400 text-xs">{r.email}</span></td>
                    <td>{TYPE_LABEL[r.type] ?? r.type}</td>
                    <td className="text-center font-mono">{r.variant ?? "-"}</td>
                    <td className="text-center"><span className={`text-xs px-2 py-0.5 rounded-full ${r.status === "sent" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{r.status}</span></td>
                    <td className="text-right tabular-nums">{r.returnedDays != null ? `${r.returnedDays} gün` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div className="font-semibold text-sm flex items-center gap-2"><Eye size={16} /> {TYPE_LABEL[preview.key] ?? preview.key} · Varyant {preview.variant}</div>
              <div className="flex items-center gap-2">
                <button onClick={() => setPreview({ ...preview, variant: preview.variant === "A" ? "B" : "A" })} className="text-xs font-semibold text-sky-700">Diğer varyant</button>
                <button onClick={() => setPreview(null)}><X size={16} /></button>
              </div>
            </div>
            <div className="px-4 py-2 text-xs text-slate-500 border-b">Konu: <span className="font-semibold text-slate-700">{/<!-- subject: (.*?) -->/.exec(previewHtml)?.[1] ?? "…"}</span></div>
            <iframe title="önizleme" srcDoc={previewHtml} className="flex-1 min-h-[480px] w-full" sandbox="" />
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-2xl font-bold text-slate-800 mt-1">{value}</div>
      {sub && <div className="text-xs text-slate-400">{sub}</div>}
    </div>
  );
}
function Panel({ title, children }: { title: string; children: ReactNode }) {
  return <div className="bg-white rounded-xl border border-slate-200 p-4 overflow-x-auto"><h3 className="font-bold text-sm mb-3">{title}</h3>{children}</div>;
}
