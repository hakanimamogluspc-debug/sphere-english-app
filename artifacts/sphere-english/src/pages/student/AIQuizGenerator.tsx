import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  Brain,
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Wand2,
  History,
  RotateCcw,
  Trophy,
  TrendingUp,
  AlertTriangle,
  BookOpen,
  Clock,
  Type,
  FileText,
  Award,
  Target,
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

interface AIQuestion {
  id: string;
  type: "multiple_choice" | "true_false" | "fill_blank";
  category: "vocabulary" | "grammar" | "comprehension";
  prompt: string;
  context?: string;
  options?: string[];
  correctAnswer?: string;
  explanationEn?: string;
  explanationTr?: string;
}

interface AIQuizSetup {
  sourceMode: "topic" | "text";
  topic?: string;
  sourceText?: string;
  level: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
  numQuestions: number;
  categories: Array<"vocabulary" | "grammar" | "comprehension">;
}

interface AIQuizReport {
  scoreCorrect: number;
  scoreTotal: number;
  scorePercent: number;
  passed: boolean;
  estimatedCefrFit: string;
  cefrConfidence: "low" | "medium" | "high";
  byCategory: Record<string, { correct: number; total: number }>;
  weakAreas: Array<{ area: string; detail: string; suggestion: string }>;
  studyPlan: string[];
  encouragement: string;
}

interface SessionRow {
  id: number;
  title: string;
  status: string;
  setup: AIQuizSetup;
  report: AIQuizReport | null;
  createdAt: string;
  submittedAt: string | null;
  timeTakenSec: number | null;
}

const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
const CATEGORY_OPTS: Array<{ id: "vocabulary" | "grammar" | "comprehension"; label: string; icon: any }> = [
  { id: "vocabulary", label: "Kelime", icon: BookOpen },
  { id: "grammar", label: "Dilbilgisi", icon: Type },
  { id: "comprehension", label: "Anlama", icon: FileText },
];

const CATEGORY_LABEL_TR: Record<string, string> = {
  vocabulary: "Kelime",
  grammar: "Dilbilgisi",
  comprehension: "Anlama",
};

type Stage = "setup" | "generating" | "taking" | "submitting" | "report" | "history";

export default function AIQuizGenerator() {
  const [stage, setStage] = useState<Stage>("setup");
  const [history, setHistory] = useState<SessionRow[]>([]);

  const [sourceMode, setSourceMode] = useState<"topic" | "text">("topic");
  const [topic, setTopic] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [level, setLevel] = useState<AIQuizSetup["level"]>("B1");
  const [numQuestions, setNumQuestions] = useState(8);
  const [categories, setCategories] = useState<AIQuizSetup["categories"]>(["vocabulary", "grammar", "comprehension"]);

  const [sessionId, setSessionId] = useState<number | null>(null);
  const [quizTitle, setQuizTitle] = useState("");
  const [questions, setQuestions] = useState<AIQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentIdx, setCurrentIdx] = useState(0);

  const [report, setReport] = useState<AIQuizReport | null>(null);
  const [reportQuestions, setReportQuestions] = useState<AIQuestion[]>([]);
  const [reportAnswers, setReportAnswers] = useState<Array<{ questionId: string; userAnswer: string; isCorrect: boolean }>>([]);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const startedAtRef = useRef<number | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const tickRef = useRef<number | null>(null);

  useEffect(() => {
    refreshHistory();
  }, []);

  useEffect(() => {
    if (stage === "taking") {
      startedAtRef.current = Date.now();
      setElapsedSec(0);
      tickRef.current = window.setInterval(() => {
        setElapsedSec(Math.floor((Date.now() - (startedAtRef.current || Date.now())) / 1000));
      }, 1000);
    } else if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [stage]);

  const refreshHistory = () => {
    fetchAuth("/ai-quiz/sessions")
      .then((r) => (r.ok ? r.json() : { sessions: [] }))
      .then((d) => setHistory(d.sessions || []))
      .catch(() => {});
  };

  const toggleCategory = (id: AIQuizSetup["categories"][number]) => {
    setCategories((prev) => {
      if (prev.includes(id)) {
        const next = prev.filter((c) => c !== id);
        return next.length ? next : prev; // require at least 1
      }
      return [...prev, id];
    });
  };

  const handleGenerate = async () => {
    setError(null);
    if (sourceMode === "topic" && !topic.trim()) {
      setError("Lütfen bir konu girin.");
      return;
    }
    if (sourceMode === "text" && sourceText.trim().length < 80) {
      setError("Lütfen en az 80 karakterlik bir metin yapıştırın.");
      return;
    }
    setLoading(true);
    setStage("generating");
    try {
      const res = await fetchAuth("/ai-quiz/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceMode,
          topic: sourceMode === "topic" ? topic : undefined,
          sourceText: sourceMode === "text" ? sourceText : undefined,
          level,
          numQuestions,
          categories,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Quiz oluşturulamadı.");
      }
      const data = await res.json();
      setSessionId(data.sessionId);
      setQuizTitle(data.title);
      setQuestions(data.questions);
      setAnswers({});
      setCurrentIdx(0);
      setStage("taking");
    } catch (e: any) {
      setError(e?.message || "Hata oluştu.");
      setStage("setup");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!sessionId) return;
    setError(null);
    setLoading(true);
    setStage("submitting");
    try {
      const payload = {
        answers: questions.map((q) => ({ questionId: q.id, userAnswer: answers[q.id] || "" })),
        timeTakenSec: elapsedSec,
      };
      const res = await fetchAuth(`/ai-quiz/${sessionId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Quiz gönderilemedi.");
      }
      const data = await res.json();
      setReport(data.report);
      setReportQuestions(data.questions);
      setReportAnswers(data.answers);
      setStage("report");
      refreshHistory();
    } catch (e: any) {
      setError(e?.message || "Hata oluştu.");
      setStage("taking");
    } finally {
      setLoading(false);
    }
  };

  const resetAll = () => {
    setSessionId(null);
    setQuizTitle("");
    setQuestions([]);
    setAnswers({});
    setCurrentIdx(0);
    setReport(null);
    setReportQuestions([]);
    setReportAnswers([]);
    setError(null);
    setStage("setup");
  };

  const openHistorySession = async (id: number) => {
    try {
      const res = await fetchAuth(`/ai-quiz/sessions/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      const s = data.session;
      if (s?.report) {
        setQuizTitle(s.title);
        setReport(s.report);
        setReportQuestions(s.questions);
        setReportAnswers(s.answers);
        setStage("report");
      }
    } catch {}
  };

  const answeredCount = useMemo(
    () => questions.filter((q) => (answers[q.id] || "").trim().length > 0).length,
    [answers, questions],
  );
  const allAnswered = answeredCount === questions.length && questions.length > 0;

  return (
    <div className="max-w-5xl mx-auto pb-12">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-[10px] font-bold tracking-wider uppercase">
              <Sparkles size={10} /> Sphere AI Studio
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Wand2 className="h-7 w-7 text-purple-600" />
            Akıllı Quiz Üretici
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Kendine konu seç ya da bir metin yapıştır — AI sana özel quiz hazırlayıp seviyeni ölçsün.
          </p>
        </div>
        <button
          onClick={() => setStage(stage === "history" ? "setup" : "history")}
          className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
        >
          <History size={14} />
          Geçmiş ({history.length})
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-rose-50 border border-rose-200 rounded-xl p-3 text-sm text-rose-700 flex items-start gap-2">
          <XCircle size={16} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {stage === "setup" && (
        <SetupPanel
          sourceMode={sourceMode} setSourceMode={setSourceMode}
          topic={topic} setTopic={setTopic}
          sourceText={sourceText} setSourceText={setSourceText}
          level={level} setLevel={setLevel}
          numQuestions={numQuestions} setNumQuestions={setNumQuestions}
          categories={categories} toggleCategory={toggleCategory}
          loading={loading} onGenerate={handleGenerate}
        />
      )}

      {stage === "generating" && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 flex flex-col items-center text-center">
          <div className="relative">
            <Loader2 size={48} className="text-purple-500 animate-spin" />
            <Sparkles size={20} className="text-purple-300 absolute -top-1 -right-1 animate-pulse" />
          </div>
          <p className="font-bold text-gray-900 mt-4">Quiz hazırlanıyor...</p>
          <p className="text-sm text-gray-500 mt-1">Sana özel sorular yazılıyor (5-15 saniye).</p>
        </div>
      )}

      {(stage === "taking" || stage === "submitting") && questions.length > 0 && (
        <TakingPanel
          title={quizTitle}
          questions={questions}
          answers={answers}
          setAnswers={setAnswers}
          currentIdx={currentIdx}
          setCurrentIdx={setCurrentIdx}
          elapsedSec={elapsedSec}
          allAnswered={allAnswered}
          answeredCount={answeredCount}
          submitting={stage === "submitting"}
          onSubmit={handleSubmit}
          onCancel={resetAll}
        />
      )}

      {stage === "report" && report && (
        <ReportPanel
          title={quizTitle}
          report={report}
          questions={reportQuestions}
          answers={reportAnswers}
          onRestart={resetAll}
        />
      )}

      {stage === "history" && (
        <HistoryPanel sessions={history} onOpen={openHistorySession} onNew={() => setStage("setup")} />
      )}
    </div>
  );
}

// ── Setup ───────────────────────────────────────────────

function SetupPanel({
  sourceMode, setSourceMode, topic, setTopic, sourceText, setSourceText,
  level, setLevel, numQuestions, setNumQuestions, categories, toggleCategory,
  loading, onGenerate,
}: any) {
  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6">
        <h2 className="font-bold text-gray-900 mb-1">1. Quiz Kaynağı</h2>
        <p className="text-xs text-gray-500 mb-4">Bir konu yaz veya bir İngilizce metin yapıştır — AI ona göre soru üretir.</p>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setSourceMode("topic")}
            className={`flex-1 p-3 rounded-xl border-2 transition-all text-left ${
              sourceMode === "topic" ? "border-purple-500 bg-purple-50/40" : "border-gray-100 hover:border-gray-300"
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-sm text-gray-900">
              <Target size={14} /> Konu
            </div>
            <p className="text-[11px] text-gray-500 mt-1">İlgilendiğin bir konuyu yaz.</p>
          </button>
          <button
            onClick={() => setSourceMode("text")}
            className={`flex-1 p-3 rounded-xl border-2 transition-all text-left ${
              sourceMode === "text" ? "border-purple-500 bg-purple-50/40" : "border-gray-100 hover:border-gray-300"
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-sm text-gray-900">
              <FileText size={14} /> Metin
            </div>
            <p className="text-[11px] text-gray-500 mt-1">Makale ya da ders notunu yapıştır.</p>
          </button>
        </div>

        {sourceMode === "topic" ? (
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Örn: Sustainable energy, Modal verbs, Job interviews, Climate change..."
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none text-sm"
          />
        ) : (
          <textarea
            rows={6}
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            placeholder="Buraya İngilizce makale, ders notu ya da herhangi bir metin yapıştır (en az 80 karakter, en fazla ~8000)..."
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none text-sm font-mono resize-y"
          />
        )}
        {sourceMode === "text" && (
          <p className="text-[10px] text-gray-400 mt-1 text-right">{sourceText.length} / 8000 karakter</p>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6">
        <h2 className="font-bold text-gray-900 mb-3">2. Seviye & Türler</h2>

        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-700 mb-2">CEFR Seviyesi</label>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {CEFR_LEVELS.map((l) => {
              const sel = level === l;
              return (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLevel(l)}
                  className={`py-2 rounded-lg border-2 font-bold text-sm transition-all ${
                    sel ? "border-purple-500 bg-purple-50/40 text-purple-700" : "border-gray-100 text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {l}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-700 mb-2">Soru Türleri (en az 1)</label>
          <div className="grid grid-cols-3 gap-2">
            {CATEGORY_OPTS.map((c) => {
              const Icon = c.icon;
              const sel = categories.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleCategory(c.id)}
                  className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1 ${
                    sel ? "border-purple-500 bg-purple-50/40 text-purple-700" : "border-gray-100 text-gray-700 hover:border-gray-300"
                  }`}
                >
                  <Icon size={18} />
                  <span className="text-xs font-semibold">{c.label}</span>
                  {sel && <CheckCircle2 size={12} className="text-purple-600" />}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">
            Soru sayısı: <span className="text-purple-600">{numQuestions}</span>
          </label>
          <input
            type="range" min={4} max={20} step={2} value={numQuestions}
            onChange={(e) => setNumQuestions(Number(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-[10px] text-gray-400 mt-1">
            <span>4</span><span>10</span><span>20</span>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={onGenerate}
          disabled={loading}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-purple-600 text-white font-semibold text-sm hover:bg-purple-700 disabled:opacity-50 shadow-sm"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
          {loading ? "Hazırlanıyor..." : "Quiz Üret"}
        </button>
      </div>
    </div>
  );
}

// ── Taking ──────────────────────────────────────────────

function TakingPanel({
  title, questions, answers, setAnswers, currentIdx, setCurrentIdx,
  elapsedSec, allAnswered, answeredCount, submitting, onSubmit, onCancel,
}: any) {
  const q: AIQuestion = questions[currentIdx];
  const total = questions.length;
  const progress = Math.round(((currentIdx + 1) / total) * 100);
  const answered = !!(answers[q.id] || "").trim();

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <p className="text-xs text-purple-600 font-semibold uppercase tracking-wider">{title}</p>
          <p className="text-sm font-bold text-gray-900">
            Soru {currentIdx + 1} / {total} · {answeredCount} cevaplandı
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1 text-gray-500">
            <Clock size={12} /> {Math.floor(elapsedSec / 60)}:{String(elapsedSec % 60).padStart(2, "0")}
          </span>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">İptal et</button>
        </div>
      </div>

      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <motion.div className="h-full bg-purple-500" animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
      </div>

      <motion.div
        key={q.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6"
      >
        <div className="flex items-center gap-2 mb-3">
          <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-bold uppercase tracking-wider">
            {CATEGORY_LABEL_TR[q.category] || q.category}
          </span>
          <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 text-[10px] font-bold uppercase tracking-wider">
            {q.type === "multiple_choice" ? "Çoktan Seçmeli" : q.type === "true_false" ? "Doğru/Yanlış" : "Boşluk Doldurma"}
          </span>
        </div>

        {q.context && (
          <div className="bg-gray-50 border-l-4 border-purple-200 p-3 rounded-md text-xs text-gray-700 italic mb-3">
            {q.context}
          </div>
        )}

        <p className="text-base text-gray-900 font-medium leading-relaxed mb-4">{q.prompt}</p>

        {q.type === "fill_blank" ? (
          <input
            type="text"
            value={answers[q.id] || ""}
            onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
            placeholder="Cevabını yaz..."
            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none text-sm"
          />
        ) : (
          <div className="space-y-2">
            {(q.options || []).map((opt) => {
              const sel = answers[q.id] === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setAnswers({ ...answers, [q.id]: opt })}
                  className={`w-full text-left p-3 rounded-xl border-2 transition-all flex items-center gap-3 ${
                    sel ? "border-purple-500 bg-purple-50/40" : "border-gray-100 hover:border-gray-300"
                  }`}
                >
                  <span className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center ${
                    sel ? "border-purple-500 bg-purple-500" : "border-gray-300"
                  }`}>
                    {sel && <CheckCircle2 size={14} className="text-white" />}
                  </span>
                  <span className="text-sm text-gray-800">{opt}</span>
                </button>
              );
            })}
          </div>
        )}
      </motion.div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <button
          onClick={() => setCurrentIdx(Math.max(0, currentIdx - 1))}
          disabled={currentIdx === 0}
          className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40"
        >
          ← Önceki
        </button>

        <div className="flex flex-wrap gap-1 justify-center">
          {questions.map((qq: AIQuestion, i: number) => {
            const a = !!(answers[qq.id] || "").trim();
            const cur = i === currentIdx;
            return (
              <button
                key={qq.id}
                onClick={() => setCurrentIdx(i)}
                className={`w-7 h-7 rounded-md text-[11px] font-bold transition-all ${
                  cur ? "bg-purple-600 text-white" : a ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
                }`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>

        {currentIdx < total - 1 ? (
          <button
            onClick={() => setCurrentIdx(currentIdx + 1)}
            disabled={!answered}
            className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 disabled:opacity-40"
          >
            Sonraki →
          </button>
        ) : (
          <button
            onClick={onSubmit}
            disabled={!allAnswered || submitting}
            className="px-5 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-40 inline-flex items-center gap-2"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            {submitting ? "Değerlendiriliyor..." : "Quiz'i Bitir"}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Report ──────────────────────────────────────────────

function ReportPanel({
  title, report, questions, answers, onRestart,
}: {
  title: string;
  report: AIQuizReport;
  questions: AIQuestion[];
  answers: Array<{ questionId: string; userAnswer: string; isCorrect: boolean }>;
  onRestart: () => void;
}) {
  const scoreColor = report.scorePercent >= 85 ? "#16a34a" : report.scorePercent >= 70 ? "#0369a1" : report.scorePercent >= 50 ? "#b45309" : "#b91c1c";
  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-br from-purple-50 via-white to-indigo-50 rounded-2xl border border-purple-100 shadow-sm p-6">
        <div className="flex items-center gap-2 text-xs font-semibold text-purple-700 uppercase tracking-wider mb-1">
          <Trophy size={14} /> Quiz Raporu
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-4">{title}</h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
            <div className="text-3xl font-bold" style={{ color: scoreColor }}>
              {report.scorePercent}%
            </div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">Skor</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{report.scoreCorrect}/{report.scoreTotal} doğru</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
            <div className="text-3xl font-bold text-purple-600 inline-flex items-center gap-1">
              <Award size={20} /> {report.estimatedCefrFit}
            </div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">CEFR Fit</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{report.cefrConfidence} güven</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-3 text-center col-span-2 sm:col-span-2">
            <div className="flex justify-around items-end gap-2 h-full">
              {Object.entries(report.byCategory).map(([cat, val]) => {
                const pct = Math.round((val.correct / Math.max(1, val.total)) * 100);
                const c = pct >= 70 ? "#16a34a" : pct >= 50 ? "#b45309" : "#b91c1c";
                return (
                  <div key={cat} className="flex-1 text-center">
                    <div className="text-base font-bold" style={{ color: c }}>{pct}%</div>
                    <div className="h-12 w-full bg-gray-100 rounded-md overflow-hidden flex items-end mt-1">
                      <div className="w-full" style={{ height: `${pct}%`, background: c }} />
                    </div>
                    <p className="text-[10px] text-gray-500 mt-1 leading-tight">{CATEGORY_LABEL_TR[cat] || cat}</p>
                    <p className="text-[10px] text-gray-400">{val.correct}/{val.total}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <p className="text-sm text-gray-700 italic leading-relaxed">"{report.encouragement}"</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {report.weakAreas.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2 mb-3">
              <AlertTriangle size={16} className="text-amber-600" /> Zayıf Alanlar
            </h3>
            <div className="space-y-3">
              {report.weakAreas.map((w, i) => (
                <div key={i} className="border-l-2 border-amber-200 pl-3">
                  <p className="text-sm font-semibold text-gray-900">{w.area}</p>
                  <p className="text-xs text-gray-600 leading-relaxed mt-0.5">{w.detail}</p>
                  <p className="text-xs text-amber-700 mt-1 leading-relaxed">→ {w.suggestion}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {report.studyPlan.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2 mb-3">
              <TrendingUp size={16} className="text-emerald-600" /> Çalışma Planın
            </h3>
            <ul className="space-y-2">
              {report.studyPlan.map((s, i) => (
                <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2 mb-4">
          <Brain size={16} className="text-purple-600" /> Soru Detayları
        </h3>
        <div className="space-y-4">
          {questions.map((q, i) => {
            const ans = answers.find((a) => a.questionId === q.id);
            const ok = ans?.isCorrect;
            return (
              <div key={q.id} className={`border-l-4 pl-3 ${ok ? "border-emerald-300" : "border-rose-300"}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${ok ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                    {ok ? <CheckCircle2 size={10} className="inline" /> : <XCircle size={10} className="inline" />} {i + 1}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px] uppercase">{CATEGORY_LABEL_TR[q.category] || q.category}</span>
                </div>
                <p className="text-sm text-gray-900 font-medium">{q.prompt}</p>
                {q.context && <p className="text-xs text-gray-500 italic mt-1">"{q.context}"</p>}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 text-xs">
                  <div className={`p-2 rounded ${ok ? "bg-emerald-50" : "bg-rose-50"}`}>
                    <p className="font-bold text-[10px] uppercase text-gray-500 mb-0.5">Cevabın</p>
                    <p className="text-gray-800">{ans?.userAnswer || "(boş)"}</p>
                  </div>
                  {!ok && (
                    <div className="p-2 rounded bg-emerald-50">
                      <p className="font-bold text-[10px] uppercase text-emerald-700 mb-0.5">Doğru</p>
                      <p className="text-emerald-900 font-semibold">{q.correctAnswer}</p>
                    </div>
                  )}
                </div>
                {q.explanationTr && (
                  <p className="text-xs text-indigo-700 mt-2 leading-relaxed">
                    <b>Açıklama:</b> {q.explanationTr}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-center">
        <button
          onClick={onRestart}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-purple-600 text-white font-semibold text-sm hover:bg-purple-700 shadow-sm"
        >
          <RotateCcw size={16} />
          Yeni Quiz Üret
        </button>
      </div>
    </div>
  );
}

// ── History ─────────────────────────────────────────────

function HistoryPanel({ sessions, onOpen, onNew }: { sessions: SessionRow[]; onOpen: (id: number) => void; onNew: () => void }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-gray-900">Quiz Geçmişin</h2>
        <button onClick={onNew} className="text-xs px-3 py-1.5 rounded-lg bg-purple-600 text-white font-semibold hover:bg-purple-700">
          + Yeni Quiz
        </button>
      </div>
      {sessions.length === 0 ? (
        <p className="text-sm text-gray-500 py-12 text-center">Henüz tamamlanmış bir quiz'in yok.</p>
      ) : (
        <div className="space-y-2">
          {sessions.map((s) => {
            const pct = s.report?.scorePercent ?? null;
            const color = pct === null ? "#9ca3af" : pct >= 85 ? "#16a34a" : pct >= 70 ? "#0369a1" : pct >= 50 ? "#b45309" : "#b91c1c";
            return (
              <button
                key={s.id}
                disabled={!s.report}
                onClick={() => onOpen(s.id)}
                className={`w-full text-left p-4 rounded-xl border border-gray-100 hover:border-purple-200 hover:bg-purple-50/30 transition-all flex items-center justify-between gap-3 ${
                  !s.report ? "opacity-60 cursor-not-allowed" : ""
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                    <Wand2 size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-gray-900 truncate">{s.title}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {s.setup.level} · {s.setup.numQuestions} soru · {new Date(s.createdAt).toLocaleDateString("tr-TR")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {pct !== null ? (
                    <span className="text-base font-bold" style={{ color }}>{pct}%</span>
                  ) : (
                    <span className="text-[10px] text-gray-400 italic">tamamlanmadı</span>
                  )}
                  <ChevronRight size={16} className="text-gray-400" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
