import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Loader2,
  XCircle,
  CheckCircle2,
  Circle,
  Target,
  Compass,
  RotateCcw,
  ChevronRight,
  Clock,
  Lightbulb,
  TrendingUp,
  Award,
  Calendar,
  BookOpen,
  Mic,
  Brain,
  PenLine,
  Headphones,
  GraduationCap,
} from "lucide-react";

const TOKEN_KEY = "sphere_token";
const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

const fetchAuth = (path: string, init?: RequestInit) => {
  const token = localStorage.getItem(TOKEN_KEY);
  return fetch(`${API}${path}`, {
    ...init,
    headers: { ...(init?.headers || {}), Authorization: `Bearer ${token}` },
  });
};

interface Step {
  id: string;
  weekNumber: number;
  dayLabel: string;
  titleTr: string;
  descriptionTr: string;
  estimatedMinutes: number;
  category: string;
  featureLink: string | null;
  featureLabel: string | null;
  rationaleTr: string;
  isCompleted: boolean;
  completedAt: string | null;
}
interface WeekSummary { weekNumber: number; themeTr: string; goalTr: string; }
interface Plan {
  overallGoalTr: string;
  cefrTarget: string;
  weeklySummaries: WeekSummary[];
  steps: Step[];
  recommendationsTr: string[];
  generationContextTr: string;
}
interface PathRow {
  id: number;
  title: string;
  cefrAtGeneration: string | null;
  plan: Plan;
  createdAt: string;
  updatedAt: string;
}

const CATEGORY_META: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  speaking: { label: "Konuşma", icon: Mic, color: "#7c3aed", bg: "#ede9fe" },
  listening: { label: "Dinleme", icon: Headphones, color: "#0369a1", bg: "#dbeafe" },
  vocabulary: { label: "Kelime", icon: BookOpen, color: "#0891b2", bg: "#cffafe" },
  grammar: { label: "Dilbilgisi", icon: Brain, color: "#9d174d", bg: "#fce7f3" },
  writing: { label: "Yazma", icon: PenLine, color: "#b45309", bg: "#fef3c7" },
  reading: { label: "Okuma", icon: BookOpen, color: "#15803d", bg: "#dcfce7" },
  exam_prep: { label: "Sınav", icon: Award, color: "#b91c1c", bg: "#fee2e2" },
  review: { label: "Tekrar", icon: RotateCcw, color: "#52525b", bg: "#f4f4f5" },
};

export default function LearningPath() {
  const [path, setPath] = useState<PathRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [focusInput, setFocusInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [expandedWeek, setExpandedWeek] = useState<number>(1);

  useEffect(() => {
    refresh();
  }, []);

  const refresh = async () => {
    setLoading(true);
    try {
      const r = await fetchAuth("/learning-path/current");
      if (r.ok) {
        const d = await r.json();
        setPath(d.path);
        if (d.path?.plan?.steps?.length) {
          // expand first incomplete week
          const firstIncomplete = d.path.plan.steps.find((s: Step) => !s.isCompleted);
          setExpandedWeek(firstIncomplete?.weekNumber || 1);
        }
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  const generate = async () => {
    setError(null);
    setGenerating(true);
    try {
      const r = await fetchAuth("/learning-path/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ focusTr: focusInput.trim() || undefined }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || "Plan oluşturulamadı.");
      }
      const d = await r.json();
      setPath(d.path);
      setExpandedWeek(1);
      setFocusInput("");
    } catch (e: any) {
      setError(e?.message || "Hata");
    } finally {
      setGenerating(false);
    }
  };

  const toggleStep = async (stepId: string) => {
    if (!path) return;
    // optimistic
    const orig = path;
    const newSteps = path.plan.steps.map((s) => (s.id === stepId ? { ...s, isCompleted: !s.isCompleted, completedAt: !s.isCompleted ? new Date().toISOString() : null } : s));
    setPath({ ...path, plan: { ...path.plan, steps: newSteps } });
    try {
      const r = await fetchAuth(`/learning-path/${path.id}/step/${stepId}/toggle`, { method: "POST" });
      if (!r.ok) throw new Error();
      const d = await r.json();
      setPath(d.path);
    } catch {
      setPath(orig);
    }
  };

  const stats = useMemo(() => {
    if (!path) return { total: 0, done: 0, pct: 0, totalMin: 0, doneMin: 0 };
    const total = path.plan.steps.length;
    const done = path.plan.steps.filter((s) => s.isCompleted).length;
    const totalMin = path.plan.steps.reduce((sum, s) => sum + s.estimatedMinutes, 0);
    const doneMin = path.plan.steps.filter((s) => s.isCompleted).reduce((sum, s) => sum + s.estimatedMinutes, 0);
    return { total, done, pct: total ? Math.round((done / total) * 100) : 0, totalMin, doneMin };
  }, [path]);

  const stepsByWeek = useMemo(() => {
    if (!path) return new Map<number, Step[]>();
    const m = new Map<number, Step[]>();
    for (const s of path.plan.steps) {
      if (!m.has(s.weekNumber)) m.set(s.weekNumber, []);
      m.get(s.weekNumber)!.push(s);
    }
    return m;
  }, [path]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto py-12 flex flex-col items-center text-center">
        <Loader2 size={32} className="animate-spin text-purple-500" />
        <p className="text-sm text-gray-500 mt-3">Planın yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto pb-12">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-[10px] font-bold tracking-wider uppercase">
            <Sparkles size={10} /> Sphere AI Studio
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
          <Compass className="h-7 w-7 text-purple-600" />
          Adaptif Öğrenme Yolu
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Yaptığın çalışmalara, zayıf alanlarına ve hedefine göre AI sana özel 4 haftalık plan üretir.
        </p>
      </div>

      {error && (
        <div className="mb-4 bg-rose-50 border border-rose-200 rounded-xl p-3 text-sm text-rose-700 flex items-start gap-2">
          <XCircle size={16} className="shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {!path && !generating && (
        <EmptyState focusInput={focusInput} setFocusInput={setFocusInput} onGenerate={generate} />
      )}

      {generating && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 flex flex-col items-center text-center">
          <div className="relative">
            <Loader2 size={48} className="text-purple-500 animate-spin" />
            <Sparkles size={20} className="text-purple-300 absolute -top-1 -right-1 animate-pulse" />
          </div>
          <p className="font-bold text-gray-900 mt-4">Sana özel plan hazırlanıyor...</p>
          <p className="text-sm text-gray-500 mt-1">Tüm aktivite geçmişin analiz ediliyor (10-20 sn).</p>
        </div>
      )}

      {path && !generating && (
        <div className="space-y-5">
          <PlanHeader path={path} stats={stats} onRegenerate={generate} focusInput={focusInput} setFocusInput={setFocusInput} />

          {path.plan.recommendationsTr.length > 0 && (
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
              <div className="flex items-center gap-1.5 mb-2 text-xs font-bold text-amber-800 uppercase tracking-wider">
                <Lightbulb size={12} /> Genel Hatırlatmalar
              </div>
              <ul className="space-y-1">
                {path.plan.recommendationsTr.map((r, i) => (
                  <li key={i} className="text-sm text-amber-900 flex items-start gap-1.5">
                    <span className="text-amber-500 mt-1">•</span> {r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {path.plan.weeklySummaries.map((week) => {
            const steps = stepsByWeek.get(week.weekNumber) || [];
            const wDone = steps.filter((s) => s.isCompleted).length;
            const wTotal = steps.length;
            const wPct = wTotal ? Math.round((wDone / wTotal) * 100) : 0;
            const expanded = expandedWeek === week.weekNumber;
            return (
              <div key={week.weekNumber} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <button
                  className="w-full p-4 flex items-center justify-between gap-3 hover:bg-gray-50/40 transition-all"
                  onClick={() => setExpandedWeek(expanded ? 0 : week.weekNumber)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold shrink-0">
                      H{week.weekNumber}
                    </div>
                    <div className="text-left min-w-0">
                      <p className="font-bold text-gray-900 text-sm truncate">{week.themeTr}</p>
                      <p className="text-xs text-gray-500 truncate">{week.goalTr}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full ${wPct === 100 ? "bg-emerald-500" : "bg-purple-500"} transition-all`} style={{ width: `${wPct}%` }} />
                    </div>
                    <span className="text-xs font-bold text-gray-700 tabular-nums">{wDone}/{wTotal}</span>
                    <ChevronRight size={16} className={`text-gray-400 transition-transform ${expanded ? "rotate-90" : ""}`} />
                  </div>
                </button>
                <AnimatePresence>
                  {expanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden border-t border-gray-100"
                    >
                      <div className="p-4 space-y-2">
                        {steps.map((s) => (
                          <StepCard key={s.id} step={s} onToggle={() => toggleStep(s.id)} />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EmptyState({ focusInput, setFocusInput, onGenerate }: any) {
  return (
    <div className="bg-gradient-to-br from-purple-50 via-white to-indigo-50 rounded-2xl border border-purple-100 p-8 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white shadow-sm mb-4">
        <Compass className="h-8 w-8 text-purple-600" />
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">Henüz bir öğrenme yolun yok</h2>
      <p className="text-sm text-gray-600 max-w-lg mx-auto mb-6">
        Sphere AI tüm aktivite geçmişini, telaffuz raporlarını, mülakat/sunum sonuçlarını ve quiz performansını analiz ederek sana özel 4 haftalık bir plan hazırlasın.
      </p>
      <div className="max-w-lg mx-auto mb-4">
        <label className="block text-xs font-semibold text-gray-700 mb-1.5 text-left">
          Özel bir odak ister misin? (opsiyonel)
        </label>
        <input
          type="text"
          value={focusInput}
          onChange={(e) => setFocusInput(e.target.value)}
          placeholder="Örn: 'TOEFL hazırlığı', 'iş İngilizcesi', 'günlük konuşma akıcılığı'..."
          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none text-sm"
        />
      </div>
      <button
        onClick={onGenerate}
        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-purple-600 text-white font-semibold text-sm hover:bg-purple-700 shadow-sm"
      >
        <Sparkles size={16} /> Planımı Oluştur
      </button>
    </div>
  );
}

function PlanHeader({ path, stats, onRegenerate, focusInput, setFocusInput }: any) {
  const [showRegen, setShowRegen] = useState(false);
  return (
    <div className="bg-gradient-to-br from-purple-50 via-white to-indigo-50 rounded-2xl border border-purple-100 p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-purple-700 uppercase tracking-wider mb-1 flex items-center gap-1">
            <Target size={12} /> Hedefin
          </p>
          <h2 className="text-base sm:text-lg font-bold text-gray-900">{path.plan.overallGoalTr}</h2>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-purple-100 text-purple-700 text-[11px] font-semibold">
              <Award size={11} /> {path.plan.cefrTarget}
            </span>
            <span className="text-[11px] text-gray-500">
              Oluşturuldu: {new Date(path.createdAt).toLocaleDateString("tr-TR")}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="text-right">
            <div className="text-2xl font-bold text-purple-600 tabular-nums">{stats.pct}%</div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Tamamlandı</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{stats.done}/{stats.total} adım · {stats.doneMin}/{stats.totalMin} dk</p>
          </div>
          <button
            onClick={() => setShowRegen(!showRegen)}
            className="text-[11px] text-purple-700 hover:text-purple-900 font-semibold inline-flex items-center gap-1"
          >
            <RotateCcw size={11} /> Planı Yeniden Üret
          </button>
        </div>
      </div>

      {path.plan.generationContextTr && (
        <p className="text-xs text-gray-600 italic mt-3 border-t border-purple-100 pt-3">
          {path.plan.generationContextTr}
        </p>
      )}

      <AnimatePresence>
        {showRegen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mt-3 border-t border-purple-100 pt-3"
          >
            <p className="text-[11px] text-gray-600 mb-2">
              İstersen yeni bir odak belirleyip planı baştan oluşturabilirsin. Mevcut ilerleme silinecek.
            </p>
            <div className="flex gap-2">
              <input
                type="text" value={focusInput} onChange={(e) => setFocusInput(e.target.value)}
                placeholder="Yeni odak (opsiyonel)..."
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm"
              />
              <button onClick={onRegenerate} className="px-3 py-2 rounded-lg bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 inline-flex items-center gap-1">
                <Sparkles size={12} /> Yeniden Üret
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StepCard({ step, onToggle }: { step: Step; onToggle: () => void }) {
  const meta = CATEGORY_META[step.category] || CATEGORY_META.review;
  const Icon = meta.icon;
  return (
    <div className={`p-3 rounded-xl border transition-all ${step.isCompleted ? "border-emerald-200 bg-emerald-50/30" : "border-gray-100 hover:border-purple-200"}`}>
      <div className="flex items-start gap-3">
        <button onClick={onToggle} className="shrink-0 mt-0.5 text-gray-300 hover:text-purple-600 transition-colors">
          {step.isCompleted ? (
            <CheckCircle2 size={20} className="text-emerald-500" />
          ) : (
            <Circle size={20} />
          )}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1" style={{ background: meta.bg, color: meta.color }}>
              <Icon size={10} /> {meta.label}
            </span>
            <span className="text-[10px] text-gray-500 inline-flex items-center gap-1">
              <Calendar size={10} /> {step.dayLabel}
            </span>
            <span className="text-[10px] text-gray-500 inline-flex items-center gap-1">
              <Clock size={10} /> {step.estimatedMinutes} dk
            </span>
          </div>
          <p className={`text-sm font-bold text-gray-900 ${step.isCompleted ? "line-through text-gray-500" : ""}`}>
            {step.titleTr}
          </p>
          <p className="text-xs text-gray-600 leading-relaxed mt-0.5">{step.descriptionTr}</p>
          {step.rationaleTr && (
            <p className="text-[11px] text-purple-700 mt-1.5 italic flex items-start gap-1">
              <TrendingUp size={10} className="shrink-0 mt-0.5" /> {step.rationaleTr}
            </p>
          )}
          {step.featureLink && step.featureLabel && (
            <Link
              href={step.featureLink}
              className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-purple-700 hover:text-purple-900"
            >
              <GraduationCap size={12} /> {step.featureLabel} →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
