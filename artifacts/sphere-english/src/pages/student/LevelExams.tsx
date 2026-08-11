import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  GraduationCap,
  Lock,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRight,
  Trophy,
  Clock,
  ListChecks,
  Sparkles,
  RotateCcw,
} from "lucide-react";

const TOKEN_KEY = "sphere_token";
const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

interface LevelInfo {
  level: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
  unlocked: boolean;
  passed: boolean;
  questionCount: number;
  passThresholdPercent: number;
  timeLimitMinutes: number;
  attempts: number;
  lastAttempt: {
    id: number; score: number; total: number; percent: number; passed: boolean; completedAt: string;
  } | null;
}

const LEVEL_BADGES: Record<string, { label: string; color: string; gradient: string }> = {
  A1: { label: "Başlangıç",            color: "#fca5a5", gradient: "from-rose-50 to-rose-100" },
  A2: { label: "Temel",                color: "#fcd34d", gradient: "from-amber-50 to-amber-100" },
  B1: { label: "Orta",                 color: "#7dd3fc", gradient: "from-sky-50 to-sky-100" },
  B2: { label: "Orta-İleri",          color: "#86efac", gradient: "from-emerald-50 to-emerald-100" },
  C1: { label: "İleri",                color: "#a78bfa", gradient: "from-violet-50 to-violet-100" },
  C2: { label: "Yetkin (Proficient)",  color: "#f472b6", gradient: "from-pink-50 to-pink-100" },
};

export default function LevelExams() {
  const [, navigate] = useLocation();
  const [levels, setLevels] = useState<LevelInfo[]>([]);
  const [currentLevel, setCurrentLevel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const r = await fetch(`${API}/level-exams`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || "Liste yüklenemedi.");
      }
      const d = await r.json();
      setLevels(d.levels || []);
      setCurrentLevel(d.currentLevel || null);
    } catch (e: any) {
      setError(e?.message || "Hata");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-12 flex flex-col items-center text-center">
        <Loader2 size={32} className="animate-spin text-purple-500" />
        <p className="text-sm text-gray-500 mt-3">Sınavlar yükleniyor...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto py-12">
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center">
          <XCircle size={32} className="text-rose-500 mx-auto mb-2" />
          <p className="text-sm font-bold text-rose-800 mb-1">Yüklenemedi</p>
          <p className="text-xs text-rose-700">{error}</p>
          <button onClick={load} className="mt-4 px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700">
            <RotateCcw size={14} className="inline mr-1" /> Tekrar Dene
          </button>
        </div>
      </div>
    );
  }

  const passedCount = levels.filter((l) => l.passed).length;

  return (
    <div className="max-w-5xl mx-auto pb-12">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold tracking-wider uppercase">
            <Sparkles size={10} /> Oxford Business Result Tabanlı
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
          <GraduationCap className="h-7 w-7 text-blue-600" />
          Seviye Geçme Sınavları
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Her CEFR seviyesi için yeterlilik sınavı. %70 ve üzeri puanla geçer ve seviyeni yükseltirsin.
        </p>
        <div className="mt-3 flex items-center gap-3 text-xs text-gray-600">
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-purple-50 text-purple-700 font-semibold">
            <Trophy size={12} /> Mevcut Seviye: {currentLevel || "—"}
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 font-semibold">
            <CheckCircle2 size={12} /> Geçilen: {passedCount} / 6
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {levels.map((lv, i) => {
          const meta = LEVEL_BADGES[lv.level];
          return (
            <motion.div
              key={lv.level}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className={`relative rounded-2xl border ${
                lv.passed ? "border-emerald-200" : lv.unlocked ? "border-gray-200" : "border-gray-100"
              } overflow-hidden bg-white shadow-sm flex flex-col`}
            >
              <div className={`bg-gradient-to-br ${meta.gradient} p-4 flex items-start justify-between`}>
                <div>
                  <div className="text-3xl font-bold tabular-nums" style={{ color: meta.color }}>
                    {lv.level}
                  </div>
                  <p className="text-xs text-gray-700 font-semibold mt-0.5">{meta.label}</p>
                </div>
                {lv.passed ? (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-700 text-[10px] font-bold uppercase tracking-wider">
                    <CheckCircle2 size={10} /> Geçildi
                  </span>
                ) : !lv.unlocked ? (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-200 text-gray-600 text-[10px] font-bold uppercase tracking-wider">
                    <Lock size={10} /> Kilitli
                  </span>
                ) : null}
              </div>

              <div className="p-4 flex-1 flex flex-col">
                <div className="grid grid-cols-3 gap-2 text-center mb-3">
                  <div className="bg-gray-50 rounded-md py-1.5">
                    <div className="text-sm font-bold text-gray-900 tabular-nums">{lv.questionCount}</div>
                    <p className="text-[9px] text-gray-500 uppercase tracking-wider mt-0.5">Soru</p>
                  </div>
                  <div className="bg-gray-50 rounded-md py-1.5">
                    <div className="text-sm font-bold text-gray-900 tabular-nums">{lv.timeLimitMinutes}<span className="text-[9px] font-normal">dk</span></div>
                    <p className="text-[9px] text-gray-500 uppercase tracking-wider mt-0.5">Süre</p>
                  </div>
                  <div className="bg-gray-50 rounded-md py-1.5">
                    <div className="text-sm font-bold text-gray-900 tabular-nums">{lv.passThresholdPercent}%</div>
                    <p className="text-[9px] text-gray-500 uppercase tracking-wider mt-0.5">Geçer</p>
                  </div>
                </div>

                {lv.lastAttempt && (
                  <div className={`text-xs px-2 py-1.5 rounded-md mb-3 ${
                    lv.lastAttempt.passed ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Son deneme:</span>
                      <span className="tabular-nums font-bold">{lv.lastAttempt.percent}%</span>
                    </div>
                    <p className="text-[10px] opacity-75 mt-0.5">
                      {new Date(lv.lastAttempt.completedAt).toLocaleDateString("tr-TR")} · {lv.attempts} deneme
                    </p>
                  </div>
                )}

                <button
                  disabled={!lv.unlocked}
                  onClick={() => navigate(`/student/level-exams/${lv.level}`)}
                  className={`mt-auto w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition ${
                    !lv.unlocked
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                      : lv.passed
                      ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  {!lv.unlocked ? (
                    <><Lock size={14} /> Bir önceki seviyeyi geç</>
                  ) : lv.passed ? (
                    <><RotateCcw size={14} /> Tekrar Çöz</>
                  ) : (
                    <><ListChecks size={14} /> Sınava Başla <ArrowRight size={14} /></>
                  )}
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="mt-6 bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-900">
        <p className="font-bold mb-1 flex items-center gap-1.5"><Clock size={14} /> Nasıl çalışır?</p>
        <ul className="space-y-1 text-xs text-blue-800 list-disc list-inside">
          <li>Soruların büyük kısmı Oxford Business Result Placement Test'ten alınmıştır.</li>
          <li>%70 ve üzeri puanla geçersin; geçince mevcut seviyen yükselir.</li>
          <li>Bir üst seviyenin sınavı, mevcut seviyenden 1 üst seviyeye kadar açıktır.</li>
          <li>Seviyeyi geçtikçe bir sonraki sınav otomatik olarak açılır.</li>
        </ul>
      </div>
    </div>
  );
}
