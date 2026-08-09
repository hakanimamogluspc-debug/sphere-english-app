import { useEffect, useState } from "react";
import {
  BarChart3, Loader2, CheckCircle2, XCircle, Sparkles, RefreshCw,
  Flame, BookOpen, MessageCircle, AlertCircle, TrendingUp, Clock,
} from "lucide-react";
import { API } from "@/lib/api-url";

const TOKEN_KEY = "sphere_token";
async function apiFetch(path: string, opts: RequestInit = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.error || `HTTP ${res.status}`);
  return data;
}

type Report = {
  weekStart: string;
  weekEnd: string;
  activityMinutes: number;
  activeDays: number;
  articlesRead: number;
  articlesSaved: number;
  aiTutorMessages: number;
  newMistakes: number;
  topMistakeTypes: Array<{ type: string; count: number }>;
  recurrentMistakes: Array<{ wrong_text: string; correct_text: string | null; explanation: string | null; occurrence_count: number }>;
  suggestions: string[];
};

type Mistake = {
  id: number;
  mistake_type: string;
  wrong_text: string;
  correct_text: string | null;
  explanation: string | null;
  context: string | null;
  source_module: string;
  cefr_tag: string | null;
  tags: string[] | null;
  occurrence_count: number;
  first_seen_at: string;
  last_seen_at: string;
  resolved_at: string | null;
};

const TYPE_LABEL: Record<string, string> = {
  grammar: "Dilbilgisi", vocab: "Kelime", collocation: "Kalıp",
  spelling: "Yazım", register: "Ton", pronunciation: "Telaffuz", other: "Diğer",
};
const TYPE_CLR: Record<string, string> = {
  grammar: "bg-red-100 text-red-700 border-red-200",
  vocab: "bg-blue-100 text-blue-700 border-blue-200",
  collocation: "bg-purple-100 text-purple-700 border-purple-200",
  spelling: "bg-amber-100 text-amber-700 border-amber-200",
  register: "bg-teal-100 text-teal-700 border-teal-200",
  pronunciation: "bg-pink-100 text-pink-700 border-pink-200",
  other: "bg-gray-100 text-gray-700 border-gray-200",
};
const SOURCE_LABEL: Record<string, string> = {
  placement_test: "Seviye Testi", ai_tutor: "AI Öğretmen", grammar_coach: "Dilbilgisi Koçu",
  writing_coach: "Yazma Koçu", pronunciation: "Telaffuz", quiz: "Quiz", speaking_scene: "Konuşma",
};

export default function MyReport() {
  const [tab, setTab] = useState<"summary" | "mistakes">("summary");
  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
          <BarChart3 className="h-7 w-7 text-indigo-600" />
          Raporum
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          İlerlemeni takip et — hatalarını göz ardı etme, tekrar edenleri fark et.
        </p>
      </header>

      <div className="flex gap-1 border-b border-gray-200">
        {[
          { v: "summary", l: "Haftalık Özet", icon: TrendingUp },
          { v: "mistakes", l: "Hata Defteri", icon: AlertCircle },
        ].map((t: any) => (
          <button key={t.v} onClick={() => setTab(t.v)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px ${
              tab === t.v ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-900"
            }`}
          >
            <t.icon className="h-4 w-4" /> {t.l}
          </button>
        ))}
      </div>

      {tab === "summary" ? <SummaryTab /> : <MistakesTab />}
    </div>
  );
}

function SummaryTab() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const d = await apiFetch("/my/report/latest");
      setReport(d.report);
    } catch (e: any) { console.warn(e); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  if (loading) return <div className="text-center py-16"><Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-400" /></div>;
  if (!report) return <div className="text-center py-16 text-gray-500">Rapor bulunamadı.</div>;

  const fmtDate = (s: string) => new Date(s + "T00:00:00").toLocaleDateString("tr-TR", { day: "2-digit", month: "short" });

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-br from-indigo-600 to-blue-600 text-white rounded-xl p-5 md:p-6">
        <div className="text-xs opacity-90 uppercase tracking-wider font-semibold">
          {fmtDate(report.weekStart)} – {fmtDate(report.weekEnd)}
        </div>
        <h2 className="text-2xl md:text-3xl font-bold mt-1">Bu Haftanın Özeti</h2>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Flame} label="Aktif Gün" value={`${report.activeDays}/7`} accent="text-orange-600" />
        <StatCard icon={Clock} label="Toplam Süre" value={`${report.activityMinutes} dk`} accent="text-indigo-600" />
        <StatCard icon={BookOpen} label="Makale" value={String(report.articlesRead)} accent="text-blue-600" />
        <StatCard icon={MessageCircle} label="AI Öğretmen" value={String(report.aiTutorMessages)} accent="text-emerald-600" />
      </div>

      {report.suggestions.length > 0 && (
        <div className="bg-sky-50 border border-sky-200 rounded-xl p-5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-sky-700 mb-2 flex items-center gap-1">
            <Sparkles className="h-3 w-3" /> Bu Hafta İçin
          </div>
          <ul className="space-y-1.5">
            {report.suggestions.map((s, i) => (
              <li key={i} className="text-sm text-sky-900 leading-relaxed">• {s}</li>
            ))}
          </ul>
        </div>
      )}

      {report.recurrentMistakes.length > 0 && (
        <div className="bg-white rounded-xl border p-5">
          <h3 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            Sık Tekrar Eden Hataların
          </h3>
          <div className="space-y-2">
            {report.recurrentMistakes.map((m, i) => (
              <div key={i} className="rounded-lg bg-red-50 border-l-4 border-red-400 p-3">
                <div className="text-sm">
                  <span className="line-through text-red-800 font-semibold">{m.wrong_text}</span>
                  <span className="mx-2 text-gray-400">→</span>
                  <span className="text-emerald-800 font-bold">{m.correct_text || "?"}</span>
                  <span className="ml-2 text-xs text-gray-500">· {m.occurrence_count} kez</span>
                </div>
                {m.explanation && <div className="text-xs text-gray-600 mt-1.5">{m.explanation}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {report.topMistakeTypes.length > 0 && (
        <div className="bg-white rounded-xl border p-5">
          <h3 className="text-base font-bold text-gray-900 mb-3">Hata Kategorileri</h3>
          <div className="flex flex-wrap gap-2">
            {report.topMistakeTypes.map(t => (
              <span key={t.type} className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border ${TYPE_CLR[t.type] || TYPE_CLR.other}`}>
                {TYPE_LABEL[t.type] || t.type} · {t.count}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }: any) {
  return (
    <div className="bg-white rounded-xl border p-4">
      <Icon className={`h-5 w-5 ${accent}`} />
      <div className="text-2xl font-bold text-gray-900 mt-2 leading-tight">{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}

function MistakesTab() {
  const [type, setType] = useState<string>("all");
  const [unresolved, setUnresolved] = useState(true);
  const [items, setItems] = useState<Mistake[]>([]);
  const [stats, setStats] = useState<Array<{ mistake_type: string; n: number }>>([]);
  const [loading, setLoading] = useState(false);
  const [resolvingId, setResolvingId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ type, unresolved: unresolved ? "1" : "0", limit: "100" });
      const d = await apiFetch(`/my/mistakes?${params}`);
      setItems(d.mistakes ?? []);
      setStats(d.stats ?? []);
    } catch (e: any) { console.warn(e); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [type, unresolved]);

  async function resolve(id: number) {
    setResolvingId(id);
    try {
      await apiFetch(`/my/mistakes/${id}/resolve`, { method: "POST" });
      setItems(prev => prev.filter(m => m.id !== id));
    } catch (e: any) { alert(e?.message); }
    finally { setResolvingId(null); }
  }

  const total = stats.reduce((s, x) => s + x.n, 0);

  return (
    <div className="space-y-4">
      {/* Stats + filter */}
      <div className="bg-white rounded-xl border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="text-sm text-gray-600">
            <strong className="text-gray-900">{total}</strong> çözümlenmemiş hatan var
          </div>
          <button onClick={load} className="ml-auto rounded p-1.5 hover:bg-gray-100 text-gray-500">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <FilterChip active={type === "all"} onClick={() => setType("all")} label={`Tümü (${total})`} />
          {stats.map(s => (
            <FilterChip
              key={s.mistake_type}
              active={type === s.mistake_type}
              onClick={() => setType(s.mistake_type)}
              label={`${TYPE_LABEL[s.mistake_type] || s.mistake_type} (${s.n})`}
            />
          ))}
          <div className="ml-auto flex items-center gap-2">
            <label className="text-xs text-gray-500 inline-flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={unresolved} onChange={(e) => setUnresolved(e.target.checked)}
                className="rounded border-gray-300" />
              Sadece çözümlenmemişler
            </label>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16"><Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-400" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border text-gray-500">
          <CheckCircle2 className="mx-auto h-10 w-10 mb-2 text-emerald-400" />
          <p className="text-sm">
            {unresolved ? "Bu kategoride açık hatan yok — devam et!" : "Bu filtreye uygun hata bulunamadı."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(m => (
            <div key={m.id} className="bg-white rounded-xl border p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap mb-2">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${TYPE_CLR[m.mistake_type] || TYPE_CLR.other}`}>
                      {TYPE_LABEL[m.mistake_type] || m.mistake_type}
                    </span>
                    <span className="text-[10px] text-gray-500">{SOURCE_LABEL[m.source_module] || m.source_module}</span>
                    {m.occurrence_count > 1 && (
                      <span className="text-[10px] font-semibold text-red-600">{m.occurrence_count}× tekrar</span>
                    )}
                    {m.cefr_tag && <span className="text-[10px] text-indigo-600 font-semibold">{m.cefr_tag}</span>}
                    <span className="ml-auto text-[10px] text-gray-400">
                      {new Date(m.last_seen_at).toLocaleDateString("tr-TR")}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-baseline gap-2 mb-2">
                    <span className="text-sm text-red-800 font-semibold line-through decoration-red-300">{m.wrong_text}</span>
                    {m.correct_text && (
                      <>
                        <span className="text-gray-400">→</span>
                        <span className="text-sm text-emerald-800 font-bold">{m.correct_text}</span>
                      </>
                    )}
                  </div>

                  {m.explanation && (
                    <p className="text-xs text-gray-600 leading-relaxed">{m.explanation}</p>
                  )}

                  {m.context && (
                    <div className="mt-2 rounded bg-gray-50 border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 italic">
                      "{m.context}"
                    </div>
                  )}
                </div>

                {!m.resolved_at && (
                  <button
                    onClick={() => resolve(m.id)}
                    disabled={resolvingId === m.id}
                    title="Bu hatayı anladım — hata defterimden kaldır"
                    className="flex-shrink-0 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 p-2 disabled:opacity-50"
                  >
                    {resolvingId === m.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({ active, onClick, label }: any) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border transition ${
        active
          ? "bg-indigo-600 text-white border-indigo-600"
          : "bg-white text-gray-700 border-gray-300 hover:border-indigo-400"
      }`}
    >
      {label}
    </button>
  );
}
