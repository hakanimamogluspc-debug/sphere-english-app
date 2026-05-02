import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { motion } from "framer-motion";
import {
  GraduationCap,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Clock,
  CheckCircle2,
  XCircle,
  Trophy,
  RotateCcw,
  ArrowLeft,
  Send,
} from "lucide-react";

const TOKEN_KEY = "sphere_token";
const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

interface Question { id: string; prompt: string; options: string[] }
interface Result {
  attemptId: number; level: string; score: number; total: number; percent: number;
  passed: boolean; passThresholdPercent: number; levelPromoted: boolean; newLevel: string | null;
  review: Array<{ questionId: string; prompt: string; options: string[]; selectedIndex: number | null; correctIndex: number; isCorrect: boolean }>;
}

export default function LevelExamTaking() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/student/level-exams/:level");
  const level = (params?.level || "").toUpperCase();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(25);
  const [passThreshold, setPassThreshold] = useState(70);

  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number | null>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const [secondsLeft, setSecondsLeft] = useState(0);
  const startedAtRef = useRef<number>(Date.now());

  useEffect(() => { load(); }, [level]);

  const load = async () => {
    setLoading(true); setError(null); setResult(null);
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const r = await fetch(`${API}/level-exams/${level}`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Sınav yüklenemedi.");
      setQuestions(d.questions || []);
      setTimeLimitMinutes(d.timeLimitMinutes || 25);
      setPassThreshold(d.passThresholdPercent || 70);
      setSecondsLeft((d.timeLimitMinutes || 25) * 60);
      startedAtRef.current = Date.now();
    } catch (e: any) {
      setError(e?.message || "Hata");
    } finally {
      setLoading(false);
    }
  };

  // Countdown
  useEffect(() => {
    if (loading || result || error) return;
    const iv = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAtRef.current) / 1000);
      const left = Math.max(0, timeLimitMinutes * 60 - elapsed);
      setSecondsLeft(left);
      if (left <= 0) {
        clearInterval(iv);
        submit();
      }
    }, 1000);
    return () => clearInterval(iv);
  }, [loading, result, error, timeLimitMinutes]);

  const totalAnswered = useMemo(
    () => Object.values(answers).filter((v) => v !== null && v !== undefined).length,
    [answers]
  );

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const payload = {
        answers: questions.map((q) => ({
          questionId: q.id,
          selectedIndex: answers[q.id] ?? null,
        })),
      };
      const r = await fetch(`${API}/level-exams/${level}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Gönderilemedi.");
      setResult(d);
    } catch (e: any) {
      setError(e?.message || "Hata");
    } finally {
      setSubmitting(false);
    }
  };

  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60);
    const ss = s % 60;
    return `${m}:${ss.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto py-12 flex flex-col items-center text-center">
        <Loader2 size={32} className="animate-spin text-blue-500" />
        <p className="text-sm text-gray-500 mt-3">{level} sınavı yükleniyor...</p>
      </div>
    );
  }

  if (error && !result) {
    return (
      <div className="max-w-3xl mx-auto py-12">
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center">
          <XCircle size={32} className="text-rose-500 mx-auto mb-2" />
          <p className="text-sm font-bold text-rose-800 mb-1">Sınav yüklenemedi</p>
          <p className="text-xs text-rose-700">{error}</p>
          <button onClick={() => navigate("/student/level-exams")} className="mt-4 px-4 py-2 rounded-lg bg-gray-200 text-gray-800 text-sm font-semibold hover:bg-gray-300">
            <ArrowLeft size={14} className="inline mr-1" /> Listeye Dön
          </button>
        </div>
      </div>
    );
  }

  if (result) {
    const passed = result.passed;
    return (
      <div className="max-w-3xl mx-auto pb-12">
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className={`rounded-2xl border p-6 mb-6 text-center ${
            passed ? "bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200" : "bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200"
          }`}
        >
          <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-3 ${passed ? "bg-emerald-100" : "bg-amber-100"}`}>
            {passed ? <Trophy size={40} className="text-emerald-600" /> : <RotateCcw size={36} className="text-amber-600" />}
          </div>
          <h2 className="text-2xl font-bold mb-1" style={{ color: passed ? "#047857" : "#b45309" }}>
            {passed ? "Tebrikler! Sınavı Geçtin" : "Maalesef Geçemedin"}
          </h2>
          <p className="text-sm text-gray-700 mb-4">
            {result.score} / {result.total} doğru · <span className="font-bold tabular-nums">{result.percent}%</span> · Geçer not: {result.passThresholdPercent}%
          </p>

          {result.levelPromoted && result.newLevel && (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold mb-3">
              <CheckCircle2 size={16} /> Seviyen <span className="tabular-nums">{result.newLevel}</span> olarak güncellendi!
            </div>
          )}

          <div className="flex items-center justify-center gap-2 mt-3">
            <button onClick={() => navigate("/student/level-exams")} className="px-4 py-2 rounded-lg bg-white border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50">
              <ArrowLeft size={14} className="inline mr-1" /> Listeye Dön
            </button>
            <button onClick={load} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700">
              <RotateCcw size={14} className="inline mr-1" /> Tekrar Çöz
            </button>
          </div>
        </motion.div>

        <h3 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wider">Cevap Anahtarı</h3>
        <div className="space-y-2">
          {result.review.map((r, i) => (
            <div
              key={r.questionId}
              className={`bg-white rounded-xl border p-3 ${r.isCorrect ? "border-emerald-200" : "border-rose-200"}`}
            >
              <div className="flex items-start gap-2">
                <span className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                  r.isCorrect ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                }`}>{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 mb-1.5">{r.prompt}</p>
                  <div className="grid grid-cols-1 gap-1">
                    {r.options.map((opt, oi) => {
                      const isCorrect = oi === r.correctIndex;
                      const isSelected = oi === r.selectedIndex;
                      return (
                        <div key={oi} className={`text-xs px-2 py-1 rounded ${
                          isCorrect ? "bg-emerald-50 text-emerald-800 font-semibold" :
                          isSelected ? "bg-rose-50 text-rose-800" : "text-gray-600"
                        }`}>
                          <span className="inline-block w-4">{["A","B","C","D"][oi] || "•"}</span> {opt}
                          {isCorrect && <CheckCircle2 size={11} className="inline ml-1.5 text-emerald-600" />}
                          {isSelected && !isCorrect && <XCircle size={11} className="inline ml-1.5 text-rose-600" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const q = questions[currentIdx];
  if (!q) return null;
  const isLast = currentIdx === questions.length - 1;
  const lowTime = secondsLeft <= 60;

  return (
    <div className="max-w-3xl mx-auto pb-12">
      <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-blue-600" /> {level} Seviye Sınavı
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">{questions.length} soru · Geçer not %{passThreshold}</p>
        </div>
        <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold tabular-nums ${
          lowTime ? "bg-rose-100 text-rose-800 animate-pulse" : "bg-blue-50 text-blue-700"
        }`}>
          <Clock size={14} /> {fmtTime(secondsLeft)}
        </div>
      </div>

      {/* progress */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
          <span>Soru {currentIdx + 1} / {questions.length}</span>
          <span className="tabular-nums">{totalAnswered} cevaplandı</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }} />
        </div>
      </div>

      <motion.div
        key={q.id}
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 mb-4"
      >
        <p className="text-base text-gray-900 mb-4">{q.prompt}</p>
        <div className="space-y-2">
          {q.options.map((opt, oi) => {
            const isSelected = answers[q.id] === oi;
            return (
              <button
                key={oi}
                onClick={() => setAnswers((p) => ({ ...p, [q.id]: oi }))}
                className={`w-full text-left px-3 py-2.5 rounded-lg border-2 transition flex items-center gap-3 ${
                  isSelected ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300 bg-white"
                }`}
              >
                <span className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                  isSelected ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-700"
                }`}>{["A","B","C","D"][oi] || "•"}</span>
                <span className="text-sm text-gray-900 flex-1">{opt}</span>
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* nav */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
          disabled={currentIdx === 0}
          className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-white border border-gray-200 text-sm font-semibold text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
        >
          <ChevronLeft size={14} /> Önceki
        </button>

        {isLast ? (
          <button
            onClick={submit}
            disabled={submitting}
            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-60"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Sınavı Bitir
          </button>
        ) : (
          <button
            onClick={() => setCurrentIdx((i) => Math.min(questions.length - 1, i + 1))}
            className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
          >
            Sonraki <ChevronRight size={14} />
          </button>
        )}
      </div>

      {/* question pad */}
      <div className="mt-5 bg-white rounded-xl border border-gray-100 p-3">
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Sorular</p>
        <div className="grid grid-cols-10 sm:grid-cols-12 gap-1">
          {questions.map((qq, i) => {
            const answered = answers[qq.id] !== undefined && answers[qq.id] !== null;
            const isActive = i === currentIdx;
            return (
              <button
                key={qq.id}
                onClick={() => setCurrentIdx(i)}
                className={`aspect-square rounded text-[10px] font-bold tabular-nums ${
                  isActive ? "bg-blue-600 text-white" :
                  answered ? "bg-emerald-100 text-emerald-700" :
                  "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >{i + 1}</button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
