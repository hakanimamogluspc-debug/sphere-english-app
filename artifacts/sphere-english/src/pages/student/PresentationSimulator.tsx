import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Presentation,
  Mic,
  MicOff,
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronRight,
  ThumbsUp,
  AlertTriangle,
  RotateCcw,
  PlayCircle,
  History,
  TrendingUp,
  Sparkles,
  Volume2,
  Users,
  Target,
  Clock,
  MessageSquareQuote,
  BookOpen,
  Pause,
  Award,
} from "lucide-react";

const TOKEN_KEY = "sphere_token";
const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

interface Audience { id: string; label: string; questionerName: string; questionerRole: string; bio: string }

interface PresentationSetup {
  topic: string;
  audienceType: string;
  audienceTypeLabel: string;
  goal: "inform" | "persuade" | "pitch" | "train" | "update";
  goalLabel: string;
  toneStyle: "formal" | "neutral" | "energetic" | "consultative";
  durationTargetMin: number;
  contextNotes?: string;
}

interface QATurn {
  question: string;
  candidateAnswer: string;
  questionerName: string;
  questionerRole: string;
}

interface PresentationReport {
  overallScore: number;
  estimatedCefr: string;
  cefrConfidence: "low" | "medium" | "high";
  structureScore: number;
  clarityScore: number;
  persuasivenessScore: number;
  englishFluencyScore: number;
  vocalDeliveryScore: number;
  qaHandlingScore: number;
  audienceVerdict: "compelling" | "solid" | "needs_work" | "weak";
  audienceVerdictLabel: string;
  wordCount: number;
  estimatedDurationSec: number;
  estimatedPaceWpm: number;
  fillerWordCount: number;
  fillerExamples: string[];
  hookFeedback: { yourOpening: string; rating: "weak" | "ok" | "strong"; suggestion: string };
  closingFeedback: { yourClosing: string; rating: "weak" | "ok" | "strong"; suggestion: string };
  structureNotes: string;
  strongPoints: Array<{ title: string; detail: string }>;
  weakPoints: Array<{ title: string; detail: string; suggestion: string }>;
  improvedOpeningHook: string;
  improvedClosingCta: string;
  vocabUpgrades: Array<{ original: string; better: string; explanation: string }>;
  qaFeedback: Array<{
    question: string;
    yourAnswer: string;
    rating: "weak" | "ok" | "strong";
    modelAnswer: string;
    coaching: string;
  }>;
  recommendedPracticeAreas: string[];
  nextSteps: string[];
  audienceImpression: string;
}

interface SessionRow {
  id: number;
  status: string;
  setup: PresentationSetup;
  presentationTranscript: string | null;
  qaTurns: QATurn[];
  targetQaTurns: number;
  durationSec: number;
  startedAt: string;
  completedAt: string | null;
  report: PresentationReport | null;
}

const GOAL_OPTIONS = [
  { id: "inform", label: "Bilgilendirme", desc: "Karmaşık bir konuyu anlat" },
  { id: "persuade", label: "İkna", desc: "Bir görüşü/önerini savun" },
  { id: "pitch", label: "Pitch", desc: "Yatırım veya satış sunumu" },
  { id: "train", label: "Eğitim", desc: "Workshop ya da derinlemesine öğretim" },
  { id: "update", label: "Güncelleme", desc: "Durum / proje raporu" },
];

const TONE_OPTIONS = [
  { id: "formal", label: "Formal" },
  { id: "neutral", label: "Profesyonel" },
  { id: "energetic", label: "Enerjik" },
  { id: "consultative", label: "Danışmanvari" },
];

const VERDICT_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  compelling: { label: "Etkileyici", color: "#047857", bg: "#d1fae5" },
  solid: { label: "Sağlam", color: "#0369a1", bg: "#dbeafe" },
  needs_work: { label: "Geliştirilmeli", color: "#b45309", bg: "#fef3c7" },
  weak: { label: "Zayıf", color: "#b91c1c", bg: "#fee2e2" },
};

const RATING_COLOR: Record<string, string> = { strong: "#16a34a", ok: "#0369a1", weak: "#b45309" };
const RATING_LABEL: Record<string, string> = { strong: "Güçlü", ok: "Ortalama", weak: "Zayıf" };

const fetchAuth = (path: string, init?: RequestInit) => {
  const token = localStorage.getItem(TOKEN_KEY);
  return fetch(`${API}${path}`, {
    ...init,
    headers: { ...(init?.headers || {}), Authorization: `Bearer ${token}` },
  });
};

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

type Stage = "setup" | "recording" | "processing" | "qa" | "report" | "history";

export default function PresentationSimulator() {
  const [stage, setStage] = useState<Stage>("setup");
  const [audiences, setAudiences] = useState<Audience[]>([]);
  const [history, setHistory] = useState<SessionRow[]>([]);

  const [setup, setSetup] = useState<PresentationSetup & { targetQaTurns: number }>({
    topic: "",
    audienceType: "team",
    audienceTypeLabel: "Şirket içi Ekip",
    goal: "inform",
    goalLabel: "Bilgilendirme",
    toneStyle: "neutral",
    durationTargetMin: 5,
    contextNotes: "",
    targetQaTurns: 2,
  });

  const [sessionId, setSessionId] = useState<number | null>(null);
  const [presentationTranscript, setPresentationTranscript] = useState<string>("");
  const [qaTurns, setQaTurns] = useState<QATurn[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<string>("");
  const [questionerName, setQuestionerName] = useState<string>("");
  const [questionerRole, setQuestionerRole] = useState<string>("");
  const [targetQaTurns, setTargetQaTurns] = useState(2);
  const [completedTurns, setCompletedTurns] = useState(0);
  const [report, setReport] = useState<PresentationReport | null>(null);
  const [reportSession, setReportSession] = useState<SessionRow | null>(null);

  const [starting, setStarting] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingSec, setRecordingSec] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const recordTimerRef = useRef<number | null>(null);

  useEffect(() => {
    fetchAuth("/presentation/audiences").then((r) => (r.ok ? r.json() : { audiences: [] }))
      .then((d) => setAudiences(d.audiences || []))
      .catch(() => {});
    refreshHistory();
  }, []);

  const refreshHistory = () => {
    fetchAuth("/presentation/sessions")
      .then((r) => (r.ok ? r.json() : { sessions: [] }))
      .then((d) => setHistory(d.sessions || []))
      .catch(() => {});
  };

  const playAudio = (base64: string) =>
    new Promise<void>((resolve) => {
      try {
        if (audioPlayerRef.current) {
          audioPlayerRef.current.pause();
          audioPlayerRef.current.src = "";
        }
        const audio = new Audio(`data:audio/mpeg;base64,${base64}`);
        audioPlayerRef.current = audio;
        setAiSpeaking(true);
        audio.onended = () => { setAiSpeaking(false); resolve(); };
        audio.onerror = () => { setAiSpeaking(false); resolve(); };
        audio.play().catch(() => { setAiSpeaking(false); resolve(); });
      } catch {
        setAiSpeaking(false);
        resolve();
      }
    });

  const handleStart = async () => {
    if (!setup.topic.trim()) { setError("Lütfen sunum konusunu girin."); return; }
    setError(null);
    setStarting(true);
    try {
      const aud = audiences.find((a) => a.id === setup.audienceType);
      const body = {
        topic: setup.topic,
        audienceType: setup.audienceType,
        goal: setup.goal,
        toneStyle: setup.toneStyle,
        durationTargetMin: setup.durationTargetMin,
        contextNotes: setup.contextNotes,
        targetQaTurns: setup.targetQaTurns,
      };
      const res = await fetchAuth("/presentation/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Sunum başlatılamadı.");
      }
      const data = await res.json();
      setSessionId(data.sessionId);
      setTargetQaTurns(data.targetQaTurns);
      setQuestionerName(aud?.questionerName || data.audienceProfile?.questionerName || "");
      setQuestionerRole(aud?.questionerRole || data.audienceProfile?.questionerRole || "");
      setStage("recording");
    } catch (e: any) {
      setError(e?.message || "Hata oluştu");
    } finally {
      setStarting(false);
    }
  };

  const startRecording = async () => {
    if (recording || submitting) return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mr;
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (recordTimerRef.current) { clearInterval(recordTimerRef.current); recordTimerRef.current = null; }
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        if (stage === "recording") {
          if (blob.size < 8000) {
            setError("Sunum çok kısa. Lütfen en az 30 saniye konuş.");
            setRecordingSec(0);
            return;
          }
          await submitPresentation(blob);
        } else if (stage === "qa") {
          if (blob.size < 3000) {
            setError("Cevap çok kısa. En az 2 saniye konuş.");
            setRecordingSec(0);
            return;
          }
          await submitQAAnswer(blob);
        }
        setRecordingSec(0);
      };
      mr.start();
      setRecording(true);
      setRecordingSec(0);
      recordTimerRef.current = window.setInterval(() => setRecordingSec((s) => s + 1), 1000);
    } catch {
      setError("Mikrofon erişimi reddedildi. Lütfen tarayıcı izinlerini kontrol edin.");
    }
  };

  const stopRecording = () => {
    if (!recording) return;
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const submitPresentation = async (blob: Blob) => {
    if (!sessionId) return;
    setSubmitting(true);
    setStage("processing");
    try {
      const fd = new FormData();
      fd.append("audio", blob, "presentation.webm");
      const res = await fetchAuth(`/presentation/${sessionId}/submit`, { method: "POST", body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Sunum işlenemedi.");
      }
      const data = await res.json();
      setPresentationTranscript(data.transcript);
      setCurrentQuestion(data.firstQuestion);
      setQuestionerName(data.questionerName);
      setQuestionerRole(data.questionerRole);
      setQaTurns([{ question: data.firstQuestion, candidateAnswer: "", questionerName: data.questionerName, questionerRole: data.questionerRole }]);
      setCompletedTurns(0);
      setStage("qa");
      await playAudio(data.audioBase64);
    } catch (e: any) {
      setError(e?.message || "Hata oluştu");
      setStage("recording");
    } finally {
      setSubmitting(false);
    }
  };

  const submitQAAnswer = async (blob: Blob) => {
    if (!sessionId) return;
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("audio", blob, "answer.webm");
      const res = await fetchAuth(`/presentation/${sessionId}/qa-turn`, { method: "POST", body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Cevap gönderilemedi.");
      }
      const data = await res.json();
      // patch the last answer in qaTurns
      setQaTurns((prev) => {
        const next = [...prev];
        const last = next.length - 1;
        if (last >= 0) next[last] = { ...next[last], candidateAnswer: data.answerText };
        if (data.nextQuestion) {
          next.push({ question: data.nextQuestion, candidateAnswer: "", questionerName: questionerName, questionerRole: questionerRole });
        }
        return next;
      });
      setCompletedTurns(data.completedTurns);
      if (data.nextQuestion) {
        setCurrentQuestion(data.nextQuestion);
        await playAudio(data.audioBase64);
      } else {
        // All Q&A done — auto-end
        setCurrentQuestion("");
        await handleEnd();
      }
    } catch (e: any) {
      setError(e?.message || "Hata oluştu");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEnd = async () => {
    if (!sessionId || ending) return;
    setEnding(true);
    setError(null);
    try {
      const res = await fetchAuth(`/presentation/${sessionId}/end`, { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Rapor oluşturulamadı.");
      }
      const data = await res.json();
      setReport(data.report);
      setReportSession(data.session);
      setStage("report");
      refreshHistory();
    } catch (e: any) {
      setError(e?.message || "Rapor oluşturulamadı.");
    } finally {
      setEnding(false);
    }
  };

  const resetAll = () => {
    setSessionId(null);
    setPresentationTranscript("");
    setQaTurns([]);
    setCurrentQuestion("");
    setCompletedTurns(0);
    setReport(null);
    setReportSession(null);
    setStage("setup");
    setError(null);
  };

  const openHistorySession = async (id: number) => {
    try {
      const res = await fetchAuth(`/presentation/sessions/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.session?.report) {
        setReport(data.session.report);
        setReportSession(data.session);
        setStage("report");
      }
    } catch {}
  };

  // ── Render ───────────────────────────────────────────────

  return (
    <div className="max-w-6xl mx-auto pb-12">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-[10px] font-bold tracking-wider uppercase">
              <Sparkles size={10} /> Sphere AI Studio
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Presentation className="h-7 w-7 text-purple-600" />
            Sunum Simülatörü
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Bir hedef kitleye sunumunu yap, soru-cevap turunu yönet, sonunda etki & dil raporu al.
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
          setup={setup}
          setSetup={setSetup}
          audiences={audiences}
          starting={starting}
          onStart={handleStart}
        />
      )}

      {(stage === "recording" || stage === "processing") && (
        <RecordingPanel
          setup={setup}
          recording={recording}
          recordingSec={recordingSec}
          submitting={submitting}
          processing={stage === "processing"}
          onStart={startRecording}
          onStop={stopRecording}
          onCancel={resetAll}
        />
      )}

      {stage === "qa" && (
        <QAPanel
          questionerName={questionerName}
          questionerRole={questionerRole}
          currentQuestion={currentQuestion}
          qaTurns={qaTurns}
          completedTurns={completedTurns}
          targetQaTurns={targetQaTurns}
          recording={recording}
          recordingSec={recordingSec}
          submitting={submitting}
          aiSpeaking={aiSpeaking}
          ending={ending}
          onStart={startRecording}
          onStop={stopRecording}
          onEnd={handleEnd}
          presentationTranscript={presentationTranscript}
        />
      )}

      {stage === "report" && report && reportSession && (
        <ReportPanel report={report} session={reportSession} onRestart={resetAll} />
      )}

      {stage === "history" && (
        <HistoryPanel sessions={history} onOpen={openHistorySession} onNew={() => setStage("setup")} />
      )}
    </div>
  );
}

// ── Setup ───────────────────────────────────────────────

function SetupPanel({
  setup, setSetup, audiences, starting, onStart,
}: {
  setup: PresentationSetup & { targetQaTurns: number };
  setSetup: (s: PresentationSetup & { targetQaTurns: number }) => void;
  audiences: Audience[];
  starting: boolean;
  onStart: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6">
        <h2 className="font-bold text-gray-900 mb-1">1. Sunum Konusu</h2>
        <p className="text-xs text-gray-500 mb-4">Konu ve amacın ne kadar net olursa rapor o kadar isabetli olur.</p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Konu <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={setup.topic}
              onChange={(e) => setSetup({ ...setup, topic: e.target.value })}
              placeholder="Örn: Q4 2026 ürün yol haritası, AI içerik aracımızın pitch'i, yeni süreç eğitimi..."
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2">Amaç</label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {GOAL_OPTIONS.map((g) => {
                const sel = setup.goal === g.id;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setSetup({ ...setup, goal: g.id as any, goalLabel: g.label })}
                    className={`p-2.5 rounded-xl border-2 text-left transition-all ${
                      sel ? "border-purple-500 bg-purple-50/40" : "border-gray-100 hover:border-gray-300"
                    }`}
                  >
                    <p className="font-semibold text-xs text-gray-900">{g.label}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5 leading-snug">{g.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2">Ton</label>
              <div className="grid grid-cols-2 gap-2">
                {TONE_OPTIONS.map((t) => {
                  const sel = setup.toneStyle === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSetup({ ...setup, toneStyle: t.id as any })}
                      className={`p-2 rounded-lg border text-xs font-semibold transition-all ${
                        sel ? "border-purple-500 bg-purple-50/40 text-purple-700" : "border-gray-200 text-gray-700 hover:border-gray-300"
                      }`}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Hedef süre: <span className="text-purple-600">{setup.durationTargetMin} dk</span>
              </label>
              <input
                type="range" min={1} max={15} value={setup.durationTargetMin}
                onChange={(e) => setSetup({ ...setup, durationTargetMin: Number(e.target.value) })}
                className="w-full"
              />
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 mt-3">
                Q&A soru sayısı: <span className="text-purple-600">{setup.targetQaTurns}</span>
              </label>
              <input
                type="range" min={1} max={4} value={setup.targetQaTurns}
                onChange={(e) => setSetup({ ...setup, targetQaTurns: Number(e.target.value) })}
                className="w-full"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Bağlam notları (opsiyonel)</label>
            <textarea
              rows={3}
              value={setup.contextNotes}
              onChange={(e) => setSetup({ ...setup, contextNotes: e.target.value })}
              placeholder="Sunumun iskeletini, ana mesajını, kullanmak istediğin sayıları yapıştırabilirsin..."
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none text-sm resize-y"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6">
        <h2 className="font-bold text-gray-900 mb-1">2. Hedef Kitlen</h2>
        <p className="text-xs text-gray-500 mb-4">Q&A turunda bu kitleden bir kişi sana soru soracak.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {audiences.map((a) => {
            const sel = setup.audienceType === a.id;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setSetup({ ...setup, audienceType: a.id, audienceTypeLabel: a.label })}
                className={`text-left p-3 rounded-xl border-2 transition-all ${
                  sel ? "border-purple-500 bg-purple-50/40 shadow-sm" : "border-gray-100 hover:border-gray-300"
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="font-bold text-gray-900 text-sm">{a.label}</p>
                  {sel && <CheckCircle2 size={14} className="text-purple-600 mt-0.5" />}
                </div>
                <p className="text-[11px] text-purple-700 font-semibold">{a.questionerName} · {a.questionerRole}</p>
                <p className="text-[11px] text-gray-500 leading-snug mt-1 line-clamp-2">{a.bio}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={onStart}
          disabled={starting || !setup.topic.trim()}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-purple-600 text-white font-semibold text-sm hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          {starting ? <Loader2 size={16} className="animate-spin" /> : <PlayCircle size={16} />}
          {starting ? "Hazırlanıyor..." : "Sunuma Geç"}
        </button>
      </div>
    </div>
  );
}

// ── Recording ───────────────────────────────────────────

function RecordingPanel({
  setup, recording, recordingSec, submitting, processing, onStart, onStop, onCancel,
}: {
  setup: PresentationSetup & { targetQaTurns: number };
  recording: boolean;
  recordingSec: number;
  submitting: boolean;
  processing: boolean;
  onStart: () => void;
  onStop: () => void;
  onCancel: () => void;
}) {
  const targetSec = setup.durationTargetMin * 60;
  const progress = Math.min(100, Math.round((recordingSec / targetSec) * 100));

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-br from-purple-50 via-white to-indigo-50 rounded-2xl border border-purple-100 p-6">
        <div className="flex items-center gap-2 text-xs font-semibold text-purple-700 uppercase tracking-wider mb-2">
          <Target size={14} />
          Sunum Briefi
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-2">{setup.topic}</h2>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="px-2 py-1 rounded-md bg-white border border-purple-100 text-purple-700 font-semibold flex items-center gap-1">
            <Users size={12} /> {setup.audienceTypeLabel}
          </span>
          <span className="px-2 py-1 rounded-md bg-white border border-gray-200 text-gray-600">{setup.goalLabel}</span>
          <span className="px-2 py-1 rounded-md bg-white border border-gray-200 text-gray-600 flex items-center gap-1">
            <Clock size={12} /> Hedef: {setup.durationTargetMin} dk
          </span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
        {processing ? (
          <div className="flex flex-col items-center text-center">
            <Loader2 size={48} className="text-purple-500 animate-spin mb-4" />
            <p className="font-bold text-gray-900">Sunum analiz ediliyor...</p>
            <p className="text-sm text-gray-500 mt-1">Transkript çıkarılıyor ve hedef kitle ilk sorusunu hazırlıyor.</p>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center">
            <p className="text-sm text-gray-500 mb-2">
              {recording ? "Sunumunu yapıyorsun..." : "Hazır olduğunda mikrofona bas ve sunumunu İngilizce olarak yap."}
            </p>
            <div className="text-5xl font-bold text-gray-900 my-3 font-mono">
              {formatDuration(recordingSec)}
            </div>
            <div className="w-full max-w-md mb-5">
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full ${progress > 100 ? "bg-amber-500" : "bg-purple-500"}`}
                  animate={{ width: `${Math.min(100, progress)}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                <span>0:00</span>
                <span>{Math.floor(targetSec / 60)}:00 hedef</span>
              </div>
            </div>

            {!recording ? (
              <button
                onClick={onStart}
                disabled={submitting}
                className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-purple-600 text-white font-bold text-base hover:bg-purple-700 disabled:opacity-50 shadow-md"
              >
                <Mic size={20} />
                Sunuma Başla
              </button>
            ) : (
              <motion.button
                onClick={onStop}
                animate={{ scale: [1, 1.06, 1] }}
                transition={{ repeat: Infinity, duration: 1.4 }}
                className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-rose-600 text-white font-bold text-base hover:bg-rose-700 shadow-md"
              >
                <MicOff size={20} />
                Sunumu Bitir
              </motion.button>
            )}

            <p className="text-[11px] text-gray-400 mt-5 max-w-md">
              İpucu: Açılış cümlesi → ana mesaj → 2-3 destekleyici nokta → kapanış / call-to-action akışını koru. En az 30 saniye konuş.
            </p>

            <button onClick={onCancel} className="text-xs text-gray-400 hover:text-gray-600 mt-4">
              İptal et ve briefe dön
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Q&A ────────────────────────────────────────────────

function QAPanel({
  questionerName, questionerRole, currentQuestion, qaTurns, completedTurns, targetQaTurns,
  recording, recordingSec, submitting, aiSpeaking, ending, onStart, onStop, onEnd, presentationTranscript,
}: {
  questionerName: string;
  questionerRole: string;
  currentQuestion: string;
  qaTurns: QATurn[];
  completedTurns: number;
  targetQaTurns: number;
  recording: boolean;
  recordingSec: number;
  submitting: boolean;
  aiSpeaking: boolean;
  ending: boolean;
  onStart: () => void;
  onStop: () => void;
  onEnd: () => void;
  presentationTranscript: string;
}) {
  const progress = Math.min(100, Math.round((completedTurns / targetQaTurns) * 100));
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
            {questionerName.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="font-bold text-gray-900">{questionerName}</p>
            <p className="text-xs text-gray-500">{questionerRole}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs">
            <p className="font-semibold text-gray-700">
              Q&A {completedTurns} / {targetQaTurns}
            </p>
            <div className="w-40 h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1">
              <div className="h-full bg-purple-500 transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
          <button
            onClick={onEnd}
            disabled={ending || submitting}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {ending ? "Rapor hazırlanıyor..." : "Q&A'yı bitir & rapor al"}
          </button>
        </div>
      </div>

      {presentationTranscript && (
        <details className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <summary className="text-xs font-semibold text-gray-700 cursor-pointer flex items-center gap-1 select-none">
            <BookOpen size={12} /> Sunum transkriptini göster
          </summary>
          <p className="text-xs text-gray-600 mt-3 leading-relaxed whitespace-pre-wrap">{presentationTranscript}</p>
        </details>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-5 space-y-4 max-h-[420px] overflow-y-auto">
          {qaTurns.map((t, i) => (
            <div key={i} className="space-y-2">
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-[11px] font-bold shrink-0">
                  Q
                </div>
                <div className="bg-purple-50/50 rounded-xl px-3 py-2 text-sm text-gray-800 max-w-[85%]">
                  {t.question}
                </div>
              </div>
              {t.candidateAnswer ? (
                <div className="flex gap-2 flex-row-reverse">
                  <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[11px] font-bold shrink-0">
                    Sen
                  </div>
                  <div className="bg-emerald-50 rounded-xl px-3 py-2 text-sm text-emerald-900 max-w-[85%]">
                    {t.candidateAnswer}
                  </div>
                </div>
              ) : (
                aiSpeaking ? (
                  <div className="flex items-center gap-2 text-xs text-purple-600 ml-9">
                    <Volume2 size={14} className="animate-pulse" /> {questionerName} soruyor...
                  </div>
                ) : null
              )}
            </div>
          ))}
          {submitting && !aiSpeaking && (
            <div className="flex gap-2 items-center text-xs text-gray-500">
              <Loader2 size={14} className="animate-spin" />
              {recording ? "..." : "İşleniyor..."}
            </div>
          )}
        </div>

        <div className="border-t border-gray-100 px-5 py-4 bg-gray-50/50 flex items-center justify-center gap-4">
          {!recording ? (
            <button
              onClick={onStart}
              disabled={submitting || aiSpeaking || ending}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-purple-600 text-white font-semibold text-sm hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              <Mic size={16} />
              {aiSpeaking ? "Soru dinleniyor..." : submitting ? "İşleniyor..." : "Cevaplamak için bas"}
            </button>
          ) : (
            <motion.button
              onClick={onStop}
              animate={{ scale: [1, 1.06, 1] }}
              transition={{ repeat: Infinity, duration: 1.4 }}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-rose-600 text-white font-semibold text-sm hover:bg-rose-700 shadow-md"
            >
              <MicOff size={16} />
              Cevabı bitir ({formatDuration(recordingSec)})
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Report ───────────────────────────────────────────────

function ReportPanel({
  report, session, onRestart,
}: {
  report: PresentationReport;
  session: SessionRow;
  onRestart: () => void;
}) {
  const badge = VERDICT_BADGE[report.audienceVerdict] || VERDICT_BADGE.solid;
  const overallColor = report.overallScore >= 80 ? "#16a34a" : report.overallScore >= 65 ? "#0369a1" : report.overallScore >= 50 ? "#b45309" : "#b91c1c";

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-br from-purple-50 via-white to-indigo-50 rounded-2xl border border-purple-100 shadow-sm p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-semibold text-purple-600 uppercase tracking-wider mb-1">Sunum Raporu</p>
            <h2 className="text-xl font-bold text-gray-900">{session.setup.topic}</h2>
            <p className="text-sm text-gray-500">{session.setup.audienceTypeLabel} · {session.setup.goalLabel}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-center">
              <div className="text-3xl font-bold" style={{ color: overallColor }}>
                {report.overallScore}
              </div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Genel Skor</p>
            </div>
            <span className="px-3 py-1.5 rounded-full text-xs font-bold" style={{ background: badge.bg, color: badge.color }}>
              {report.audienceVerdictLabel || badge.label}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mt-5">
          <ScoreTile label="Yapı" value={report.structureScore} />
          <ScoreTile label="Anlaşılırlık" value={report.clarityScore} />
          <ScoreTile label="İkna" value={report.persuasivenessScore} />
          <ScoreTile label="İngilizce" value={report.englishFluencyScore} />
          <ScoreTile label="Vokal Akış" value={report.vocalDeliveryScore} />
          <ScoreTile label="Q&A" value={report.qaHandlingScore} />
        </div>

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <StatPill icon={<Award size={12} />} label={`CEFR ${report.estimatedCefr}`} sub={report.cefrConfidence} />
          <StatPill icon={<MessageSquareQuote size={12} />} label={`${report.wordCount} kelime`} sub={`~${formatDuration(report.estimatedDurationSec)}`} />
          <StatPill icon={<TrendingUp size={12} />} label={`${report.estimatedPaceWpm} wpm`} sub="hız" />
          <StatPill icon={<Pause size={12} />} label={`${report.fillerWordCount} dolgu`} sub={report.fillerExamples.slice(0, 3).join(", ") || "—"} />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2 mb-2">
          <Users size={16} className="text-purple-600" />
          Hedef Kitlenin İzlenimi
        </h3>
        <p className="text-sm text-gray-700 leading-relaxed italic">"{report.audienceImpression}"</p>
      </div>

      {/* Hook & closing */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <FeedbackBlock
          title="Açılış (Hook)"
          quote={report.hookFeedback?.yourOpening}
          rating={report.hookFeedback?.rating}
          suggestion={report.hookFeedback?.suggestion}
          improvedTitle="Önerilen güçlü açılış"
          improvedText={report.improvedOpeningHook}
        />
        <FeedbackBlock
          title="Kapanış (CTA)"
          quote={report.closingFeedback?.yourClosing}
          rating={report.closingFeedback?.rating}
          suggestion={report.closingFeedback?.suggestion}
          improvedTitle="Önerilen güçlü kapanış"
          improvedText={report.improvedClosingCta}
        />
      </div>

      {/* Structure notes */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-bold text-gray-900 text-sm mb-2">Yapı Değerlendirmesi</h3>
        <p className="text-sm text-gray-700 leading-relaxed">{report.structureNotes}</p>
      </div>

      {/* Strong & weak */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2 mb-3">
            <ThumbsUp size={16} className="text-emerald-600" /> Güçlü Yönler
          </h3>
          <div className="space-y-3">
            {report.strongPoints.map((p, i) => (
              <div key={i} className="flex gap-2">
                <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-gray-800">{p.title}</p>
                  <p className="text-xs text-gray-500 leading-relaxed">{p.detail}</p>
                </div>
              </div>
            ))}
            {report.strongPoints.length === 0 && <p className="text-xs text-gray-400">Belirgin bir güçlü yön bulunamadı.</p>}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-amber-600" /> Geliştirilecek Alanlar
          </h3>
          <div className="space-y-3">
            {report.weakPoints.map((p, i) => (
              <div key={i} className="flex gap-2">
                <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-gray-800">{p.title}</p>
                  <p className="text-xs text-gray-500 leading-relaxed">{p.detail}</p>
                  {p.suggestion && <p className="text-xs text-amber-700 mt-1 leading-relaxed">→ {p.suggestion}</p>}
                </div>
              </div>
            ))}
            {report.weakPoints.length === 0 && <p className="text-xs text-gray-400">Belirgin bir zayıf yön bulunamadı.</p>}
          </div>
        </div>
      </div>

      {/* Vocab upgrades */}
      {report.vocabUpgrades.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2 mb-3">
            <Sparkles size={16} className="text-purple-600" /> Daha Profesyonel Kelime Önerileri
          </h3>
          <div className="space-y-2">
            {report.vocabUpgrades.map((v, i) => (
              <div key={i} className="flex items-start gap-3 text-sm border-l-2 border-purple-100 pl-3 py-1">
                <span className="text-rose-500 line-through">{v.original}</span>
                <span className="text-gray-300">→</span>
                <span className="text-emerald-600 font-semibold">{v.better}</span>
                <span className="text-xs text-gray-500 ml-auto">{v.explanation}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Q&A feedback */}
      {report.qaFeedback.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2 mb-4">
            <MessageSquareQuote size={16} className="text-indigo-600" /> Q&A Değerlendirmesi
          </h3>
          <div className="space-y-5">
            {report.qaFeedback.map((q, i) => (
              <div key={i} className="border-l-2 border-indigo-200 pl-4">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-xs font-semibold text-indigo-700 uppercase">Soru {i + 1}</p>
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                    style={{ color: RATING_COLOR[q.rating] || "#6b7280", background: `${RATING_COLOR[q.rating] || "#6b7280"}1a` }}
                  >
                    {RATING_LABEL[q.rating] || q.rating}
                  </span>
                </div>
                <p className="text-sm text-gray-700 italic mb-2">"{q.question}"</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Senin Cevabın</p>
                    <p className="text-xs text-gray-700 leading-relaxed">{q.yourAnswer}</p>
                  </div>
                  <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
                    <p className="text-[10px] font-bold text-emerald-700 uppercase mb-1">Önerilen Cevap</p>
                    <p className="text-xs text-emerald-900 leading-relaxed">{q.modelAnswer}</p>
                  </div>
                </div>
                {q.coaching && <p className="text-[11px] text-indigo-700 mt-2 leading-relaxed"><b>Koçluk:</b> {q.coaching}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2 mb-3">
            <TrendingUp size={16} className="text-blue-600" /> Pratik Önerileri
          </h3>
          <ul className="space-y-2">
            {report.recommendedPracticeAreas.map((p, i) => (
              <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                <ChevronRight size={14} className="text-blue-400 shrink-0 mt-0.5" /> {p}
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2 mb-3">
            <CheckCircle2 size={16} className="text-emerald-600" /> Sonraki Adımlar
          </h3>
          <ul className="space-y-2">
            {report.nextSteps.map((p, i) => (
              <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                {p}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex justify-center">
        <button
          onClick={onRestart}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-purple-600 text-white font-semibold text-sm hover:bg-purple-700 shadow-sm"
        >
          <RotateCcw size={16} />
          Yeni Sunum Başlat
        </button>
      </div>
    </div>
  );
}

function ScoreTile({ label, value }: { label: string; value: number }) {
  const color = value >= 80 ? "#16a34a" : value >= 65 ? "#0369a1" : value >= 50 ? "#b45309" : "#b91c1c";
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-2.5 text-center">
      <div className="text-lg font-bold" style={{ color }}>{value}</div>
      <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5 leading-tight">{label}</p>
    </div>
  );
}

function StatPill({ icon, label, sub }: { icon: React.ReactNode; label: string; sub: string }) {
  return (
    <div className="px-2 py-1.5 rounded-md bg-white border border-gray-200 text-gray-700">
      <div className="flex items-center gap-1 font-semibold text-xs">{icon} {label}</div>
      <p className="text-[10px] text-gray-400 mt-0.5 truncate">{sub}</p>
    </div>
  );
}

function FeedbackBlock({
  title, quote, rating, suggestion, improvedTitle, improvedText,
}: {
  title: string;
  quote?: string;
  rating?: "weak" | "ok" | "strong";
  suggestion?: string;
  improvedTitle: string;
  improvedText: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-gray-900 text-sm">{title}</h3>
        {rating && (
          <span
            className="px-2 py-0.5 rounded-full text-[10px] font-bold"
            style={{ color: RATING_COLOR[rating] || "#6b7280", background: `${RATING_COLOR[rating] || "#6b7280"}1a` }}
          >
            {RATING_LABEL[rating] || rating}
          </span>
        )}
      </div>
      {quote && <p className="text-xs text-gray-600 italic mb-2 line-clamp-3">"{quote}"</p>}
      {suggestion && <p className="text-xs text-amber-700 mb-3">→ {suggestion}</p>}
      <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
        <p className="text-[10px] font-bold text-emerald-700 uppercase mb-1">{improvedTitle}</p>
        <p className="text-xs text-emerald-900 leading-relaxed">{improvedText}</p>
      </div>
    </div>
  );
}

// ── History ─────────────────────────────────────────────

function HistoryPanel({
  sessions, onOpen, onNew,
}: {
  sessions: SessionRow[];
  onOpen: (id: number) => void;
  onNew: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-gray-900">Sunum Geçmişin</h2>
        <button onClick={onNew} className="text-xs px-3 py-1.5 rounded-lg bg-purple-600 text-white font-semibold hover:bg-purple-700">
          + Yeni Sunum
        </button>
      </div>
      {sessions.length === 0 ? (
        <p className="text-sm text-gray-500 py-12 text-center">Henüz tamamlanmış bir sunumun yok.</p>
      ) : (
        <div className="space-y-2">
          {sessions.map((s) => {
            const badge = s.report ? VERDICT_BADGE[s.report.audienceVerdict] || VERDICT_BADGE.solid : null;
            return (
              <button
                key={s.id}
                disabled={!s.report}
                onClick={() => onOpen(s.id)}
                className={`w-full text-left p-4 rounded-xl border border-gray-100 hover:border-purple-200 hover:bg-purple-50/30 transition-all flex items-center justify-between gap-3 ${
                  !s.report ? "opacity-60 cursor-not-allowed" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                    <Presentation size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-gray-900 truncate">{s.setup.topic}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {s.setup.audienceTypeLabel} · {new Date(s.startedAt).toLocaleDateString("tr-TR")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {s.report && (
                    <>
                      <span className="text-lg font-bold text-gray-700">{s.report.overallScore}</span>
                      {badge && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: badge.bg, color: badge.color }}>
                          {badge.label}
                        </span>
                      )}
                    </>
                  )}
                  {!s.report && <span className="text-[10px] text-gray-400 italic">tamamlanmadı</span>}
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
