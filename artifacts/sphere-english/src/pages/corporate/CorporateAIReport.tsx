import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  Building2,
  Users,
  TrendingUp,
  AlertTriangle,
  Award,
  Loader2,
  XCircle,
  RotateCcw,
  Lightbulb,
  Activity,
  Trophy,
  BarChart3,
  Calendar,
  Target,
  Brain,
} from "lucide-react";

const TOKEN_KEY = "sphere_token";
const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

const fetchAuth = (path: string) => {
  const token = localStorage.getItem(TOKEN_KEY);
  return fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
};

interface Report {
  company: { id: number; name: string; companyTitle: string | null };
  generatedAt: string;
  cohort: {
    total: number;
    activeLast7d: number;
    activeLast30d: number;
    avgStreak: number;
    avgTotalPoints: number;
    cefrDistribution: Record<string, number>;
    avgCefrLabel: string;
  };
  activity: {
    pronunciationCount: number;
    interviewCount: number;
    presentationCount: number;
    quizCount: number;
    tutorConvos: number;
    learningPaths: number;
  };
  averages: {
    pronunciation: number | null;
    interview: number | null;
    presentation: number | null;
    quiz: number | null;
  };
  topPerformers: Array<{
    id: number; fullName: string; cefr: string | null; totalPoints: number; streak: number; score: number;
  }>;
  topWeakAreas: Array<{ area: string; mentions: number }>;
  ai: {
    executiveSummaryTr: string;
    bulletInsightsTr: string[];
    recommendationsForManagerTr: string[];
  } | null;
}

const CEFR_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2", "?"];
const CEFR_COLOR: Record<string, string> = {
  A1: "#fca5a5", A2: "#fcd34d", B1: "#7dd3fc", B2: "#86efac", C1: "#a78bfa", C2: "#f472b6", "?": "#d4d4d8",
};

export default function CorporateAIReport() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setError(null);
    if (!report) setLoading(true); else setRefreshing(true);
    try {
      const r = await fetchAuth("/corporate/ai-performance-report");
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || "Rapor yüklenemedi.");
      }
      const d = await r.json();
      setReport(d.report);
    } catch (e: any) {
      setError(e?.message || "Hata");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto py-12 flex flex-col items-center text-center">
        <Loader2 size={32} className="animate-spin text-purple-500" />
        <p className="text-sm text-gray-500 mt-3">AI raporun hazırlanıyor...</p>
        <p className="text-xs text-gray-400 mt-1">Tüm öğrenci aktiviteleri analiz ediliyor (10-25 sn)</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto py-12">
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center">
          <XCircle size={32} className="text-rose-500 mx-auto mb-2" />
          <p className="text-sm font-bold text-rose-800 mb-1">Rapor yüklenemedi</p>
          <p className="text-xs text-rose-700">{error}</p>
          <button onClick={load} className="mt-4 px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700">
            Tekrar Dene
          </button>
        </div>
      </div>
    );
  }

  if (!report) return null;

  return (
    <div className="max-w-6xl mx-auto pb-12">
      <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-[10px] font-bold tracking-wider uppercase">
              <Sparkles size={10} /> Sphere AI Studio
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-purple-600" />
            AI Performans Raporu
          </h1>
          <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
            <Building2 size={13} /> {report.company.companyTitle || report.company.name} —{" "}
            <Calendar size={11} className="ml-1" /> {new Date(report.generatedAt).toLocaleString("tr-TR")}
          </p>
        </div>
        <button
          onClick={load} disabled={refreshing}
          className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
        >
          {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
          Yenile
        </button>
      </div>

      {/* Cohort overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <KpiCard icon={<Users size={16} />} label="Toplam Öğrenci" value={report.cohort.total.toString()} accent="#7c3aed" />
        <KpiCard icon={<Activity size={16} />} label="Son 7 Gün Aktif"
          value={`${report.cohort.activeLast7d}/${report.cohort.total}`}
          sub={`${report.cohort.total ? Math.round((report.cohort.activeLast7d / report.cohort.total) * 100) : 0}%`}
          accent={report.cohort.activeLast7d / Math.max(1, report.cohort.total) >= 0.5 ? "#16a34a" : "#b45309"}
        />
        <KpiCard icon={<Award size={16} />} label="Ortalama Seviye" value={report.cohort.avgCefrLabel} accent="#0369a1" />
        <KpiCard icon={<Trophy size={16} />} label="Ortalama Puan" value={report.cohort.avgTotalPoints.toString()} sub={`Streak: ${report.cohort.avgStreak} gün`} accent="#b45309" />
      </div>

      {report.cohort.total === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 mb-5 text-center">
          Şirketinizde henüz öğrenci yok. Önce öğrencilerinizi ekleyin, ardından bu rapor anlamlı olacak.
        </div>
      )}

      {/* AI summary */}
      {report.ai && (
        <motion.div
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-purple-50 via-white to-indigo-50 rounded-2xl border border-purple-100 p-5 mb-5"
        >
          <div className="flex items-center gap-1.5 text-xs font-bold text-purple-700 uppercase tracking-wider mb-3">
            <Brain size={12} /> Yönetici Özeti (AI)
          </div>
          <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-line mb-4">
            {report.ai.executiveSummaryTr}
          </div>

          {report.ai.bulletInsightsTr.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Lightbulb size={10} /> Öne Çıkan Bulgular
              </p>
              <ul className="space-y-1">
                {report.ai.bulletInsightsTr.map((b, i) => (
                  <li key={i} className="text-sm text-gray-800 flex items-start gap-1.5">
                    <span className="text-purple-500 mt-0.5">•</span> {b}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {report.ai.recommendationsForManagerTr.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Target size={10} /> Yönetici Olarak Bu Ay Yapmanız Gerekenler
              </p>
              <ul className="space-y-1">
                {report.ai.recommendationsForManagerTr.map((r, i) => (
                  <li key={i} className="text-sm text-gray-800 flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        {/* CEFR distribution */}
        <Card title="CEFR Seviye Dağılımı" icon={<Award size={16} className="text-blue-600" />}>
          <CefrChart distribution={report.cohort.cefrDistribution} total={report.cohort.total} />
        </Card>

        {/* Average scores */}
        <Card title="Ortalama Performans Skorları" icon={<TrendingUp size={16} className="text-emerald-600" />}>
          <div className="space-y-2">
            <ScoreRow label="Telaffuz" value={report.averages.pronunciation} max={100} />
            <ScoreRow label="Mülakat" value={report.averages.interview} max={100} />
            <ScoreRow label="Sunum" value={report.averages.presentation} max={100} />
            <ScoreRow label="AI Quiz" value={report.averages.quiz} max={100} suffix="%" />
          </div>
        </Card>

        {/* Activity volumes */}
        <Card title="AI Aktivite Hacmi" icon={<Activity size={16} className="text-purple-600" />}>
          <div className="grid grid-cols-2 gap-2">
            <Mini label="Telaffuz" value={report.activity.pronunciationCount} />
            <Mini label="Mülakat" value={report.activity.interviewCount} />
            <Mini label="Sunum" value={report.activity.presentationCount} />
            <Mini label="Quiz" value={report.activity.quizCount} />
            <Mini label="AI Sohbet" value={report.activity.tutorConvos} />
            <Mini label="Plan" value={report.activity.learningPaths} />
          </div>
        </Card>

        {/* Top weak areas */}
        <Card title="Kohortta Öne Çıkan Zayıf Alanlar" icon={<AlertTriangle size={16} className="text-amber-600" />}>
          {report.topWeakAreas.length === 0 ? (
            <p className="text-xs text-gray-400 italic">Henüz değerlendirme verisi yok.</p>
          ) : (
            <div className="space-y-1.5">
              {report.topWeakAreas.map((w, i) => (
                <div key={i} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-gray-800 truncate">{w.area}</span>
                  <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded shrink-0">
                    ×{w.mentions}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Top performers */}
      <Card title="En Aktif Öğrenciler" icon={<Trophy size={16} className="text-amber-600" />}>
        {report.topPerformers.length === 0 ? (
          <p className="text-xs text-gray-400 italic">Henüz performans verisi yok.</p>
        ) : (
          <div className="space-y-1">
            {report.topPerformers.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                  i === 0 ? "bg-amber-100 text-amber-700" :
                  i === 1 ? "bg-gray-100 text-gray-700" :
                  i === 2 ? "bg-orange-100 text-orange-700" : "bg-gray-50 text-gray-500"
                }`}>{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{p.fullName}</p>
                  <p className="text-[11px] text-gray-500">
                    {p.cefr || "—"} · {p.totalPoints} puan · {p.streak} gün streak
                  </p>
                </div>
                <span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                  {p.score} skor
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function KpiCard({ icon, label, value, sub, accent }: any) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
      <div className="flex items-center gap-1 text-gray-500 text-[10px] font-semibold uppercase tracking-wider mb-1">
        <span style={{ color: accent }}>{icon}</span> {label}
      </div>
      <div className="text-2xl font-bold" style={{ color: accent }}>{value}</div>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function Card({ title, icon, children }: any) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h3 className="font-bold text-sm text-gray-900 mb-3 flex items-center gap-1.5">{icon} {title}</h3>
      {children}
    </div>
  );
}

function CefrChart({ distribution, total }: { distribution: Record<string, number>; total: number }) {
  const ordered = CEFR_ORDER.map((l) => ({ level: l, count: distribution[l] || 0 })).filter((x) => x.count > 0);
  if (ordered.length === 0 || total === 0) return <p className="text-xs text-gray-400 italic">Veri yok.</p>;
  const max = Math.max(...ordered.map((o) => o.count));
  return (
    <div className="space-y-1.5">
      {ordered.map((o) => {
        const pct = Math.round((o.count / total) * 100);
        const wpct = Math.round((o.count / max) * 100);
        return (
          <div key={o.level} className="flex items-center gap-2">
            <span className="w-7 text-[11px] font-bold text-gray-600">{o.level}</span>
            <div className="flex-1 h-5 bg-gray-50 rounded-md overflow-hidden">
              <div className="h-full rounded-md transition-all" style={{ width: `${wpct}%`, background: CEFR_COLOR[o.level] || "#a78bfa" }} />
            </div>
            <span className="text-[11px] text-gray-600 tabular-nums w-16 text-right">{o.count} ({pct}%)</span>
          </div>
        );
      })}
    </div>
  );
}

function ScoreRow({ label, value, max, suffix }: { label: string; value: number | null; max: number; suffix?: string }) {
  if (value === null) {
    return (
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-gray-700">{label}</span>
        <span className="text-xs text-gray-400 italic">veri yok</span>
      </div>
    );
  }
  const pct = Math.round((value / max) * 100);
  const c = pct >= 80 ? "#16a34a" : pct >= 65 ? "#0369a1" : pct >= 50 ? "#b45309" : "#b91c1c";
  return (
    <div>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-sm text-gray-700">{label}</span>
        <span className="text-sm font-bold tabular-nums" style={{ color: c }}>{value}{suffix || ""}</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: c }} />
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-gray-50 rounded-lg p-2.5 text-center">
      <div className="text-lg font-bold text-purple-700 tabular-nums">{value}</div>
      <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">{label}</p>
    </div>
  );
}
