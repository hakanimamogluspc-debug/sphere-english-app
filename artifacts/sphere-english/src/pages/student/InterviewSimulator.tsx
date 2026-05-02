import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Briefcase,
  Building2,
  Award,
  Mic,
  MicOff,
  Loader2,
  CheckCircle2,
  ChevronRight,
  XCircle,
  ThumbsUp,
  AlertTriangle,
  RotateCcw,
  PlayCircle,
  History,
  TrendingUp,
  GraduationCap,
  Sparkles,
  Volume2,
} from "lucide-react";

const TOKEN_KEY = "sphere_token";
const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

// ── Types ────────────────────────────────────────────────────────────────────

interface Coach { id: string; name: string; voice: string; bio: string }

interface InterviewSetup {
  targetRole: string;
  seniority: "junior" | "mid" | "senior" | "lead" | "executive";
  industry: string;
  interviewerStyle: string;
  jobDescription?: string;
  resumeText?: string;
  targetQuestions: number;
}

interface Turn {
  role: "interviewer" | "candidate";
  content: string;
  timestamp?: string;
}

interface InterviewReport {
  overallScore: number;
  hireRecommendation: "strong_hire" | "hire" | "lean_hire" | "no_hire";
  hireRecommendationLabel: string;
  estimatedCefr: string;
  cefrConfidence: "low" | "medium" | "high";
  englishFluencyScore: number;
  technicalContentScore: number;
  communicationScore: number;
  professionalismScore: number;
  strongPoints: Array<{ title: string; detail: string }>;
  weakPoints: Array<{ title: string; detail: string; suggestion: string }>;
  bestAnswers: Array<{ question: string; yourAnswer: string; modelAnswer: string; whyBetter: string }>;
  interviewerImpression: string;
  recommendedPracticeAreas: string[];
  nextSteps: string[];
}

interface SessionRow {
  id: number;
  status: string;
  setup: InterviewSetup;
  questionsAsked: number;
  targetQuestions: number;
  durationSec: number;
  startedAt: string;
  completedAt: string | null;
  report: InterviewReport | null;
}

// ── Constants ────────────────────────────────────────────────────────────────

const SENIORITY_OPTIONS = [
  { id: "junior", label: "Junior (0-2 yıl)" },
  { id: "mid", label: "Mid-level (2-5 yıl)" },
  { id: "senior", label: "Senior (5-9 yıl)" },
  { id: "lead", label: "Lead / Manager" },
  { id: "executive", label: "Executive / Director" },
];

const INDUSTRY_OPTIONS = [
  "Teknoloji",
  "Finans",
  "Sağlık",
  "Üretim",
  "Perakende",
  "Lojistik",
  "İnşaat",
  "Eğitim",
  "Turizm",
  "Danışmanlık",
  "Hukuk",
  "Medya",
  "Enerji",
  "Diğer",
];

const HIRE_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  strong_hire: { label: "Güçlü İşe Alım", color: "#047857", bg: "#d1fae5" },
  hire: { label: "İşe Alım", color: "#0369a1", bg: "#dbeafe" },
  lean_hire: { label: "Geliştirilmesi Gerek", color: "#b45309", bg: "#fef3c7" },
  no_hire: { label: "İşe Alım Önerilmez", color: "#b91c1c", bg: "#fee2e2" },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

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

// ── Main ─────────────────────────────────────────────────────────────────────

type Stage = "setup" | "live" | "report" | "history";

export default function InterviewSimulator() {
  const [stage, setStage] = useState<Stage>("setup");
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [history, setHistory] = useState<SessionRow[]>([]);

  const [setup, setSetup] = useState<InterviewSetup>({
    targetRole: "",
    seniority: "mid",
    industry: "Teknoloji",
    interviewerStyle: "emma",
    jobDescription: "",
    resumeText: "",
    targetQuestions: 6,
  });

  const [sessionId, setSessionId] = useState<number | null>(null);
  const [transcript, setTranscript] = useState<Turn[]>([]);
  const [questionsAsked, setQuestionsAsked] = useState(0);
  const [targetQuestions, setTargetQuestions] = useState(6);
  const [phase, setPhase] = useState<string>("intro");
  const [interviewerName, setInterviewerName] = useState("");
  const [report, setReport] = useState<InterviewReport | null>(null);
  const [reportSession, setReportSession] = useState<SessionRow | null>(null);

  const [starting, setStarting] = useState(false);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiSpeaking, setAiSpeaking] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const transcriptScrollRef = useRef<HTMLDivElement | null>(null);

  // Fetch coaches + history once
  useEffect(() => {
    fetchAuth("/interview/coaches")
      .then((r) => (r.ok ? r.json() : { coaches: [] }))
      .then((d) => setCoaches(d.coaches || []))
      .catch(() => {});
    fetchAuth("/interview/sessions")
      .then((r) => (r.ok ? r.json() : { sessions: [] }))
      .then((d) => setHistory(d.sessions || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (transcriptScrollRef.current) {
      transcriptScrollRef.current.scrollTop = transcriptScrollRef.current.scrollHeight;
    }
  }, [transcript]);

  const refreshHistory = () => {
    fetchAuth("/interview/sessions")
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
        audio.onended = () => {
          setAiSpeaking(false);
          resolve();
        };
        audio.onerror = () => {
          setAiSpeaking(false);
          resolve();
        };
        audio.play().catch(() => {
          setAiSpeaking(false);
          resolve();
        });
      } catch {
        setAiSpeaking(false);
        resolve();
      }
    });

  const handleStart = async () => {
    if (!setup.targetRole.trim()) {
      setError("Lütfen hedef pozisyonu girin.");
      return;
    }
    setError(null);
    setStarting(true);
    try {
      const res = await fetchAuth("/interview/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(setup),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Mülakat başlatılamadı.");
      }
      const data = await res.json();
      setSessionId(data.sessionId);
      setPhase(data.phase);
      setQuestionsAsked(data.questionsAsked);
      setTargetQuestions(data.targetQuestions);
      setInterviewerName(data.interviewerName);
      setTranscript([{ role: "interviewer", content: data.reply, timestamp: new Date().toISOString() }]);
      setStage("live");
      // play opening audio
      playAudio(data.audioBase64);
    } catch (e: any) {
      setError(e?.message || "Hata oluştu");
    } finally {
      setStarting(false);
    }
  };

  const startRecording = async () => {
    if (recording || processing || aiSpeaking) return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mr;
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        if (blob.size < 3000) {
          setError("Ses kaydı çok kısa. En az 2 saniye konuşun.");
          return;
        }
        await sendTurn(blob);
      };
      mr.start();
      setRecording(true);
    } catch {
      setError("Mikrofon erişimi reddedildi. Lütfen tarayıcı izinlerini kontrol edin.");
    }
  };

  const stopRecording = () => {
    if (!recording) return;
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const sendTurn = async (blob: Blob) => {
    if (!sessionId) return;
    setProcessing(true);
    try {
      const fd = new FormData();
      fd.append("audio", blob, "answer.webm");
      const res = await fetchAuth(`/interview/${sessionId}/turn`, { method: "POST", body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Cevap gönderilemedi.");
      }
      const data = await res.json();
      setTranscript((prev) => [
        ...prev,
        { role: "candidate", content: data.userText, timestamp: new Date().toISOString() },
        { role: "interviewer", content: data.reply, timestamp: new Date().toISOString() },
      ]);
      setQuestionsAsked(data.questionsAsked);
      setPhase(data.phase);
      await playAudio(data.audioBase64);
      if (data.isFinalTurn) {
        // auto-end and show report
        await handleEnd();
      }
    } catch (e: any) {
      setError(e?.message || "Hata oluştu");
    } finally {
      setProcessing(false);
    }
  };

  const handleEnd = async () => {
    if (!sessionId || ending) return;
    setEnding(true);
    setError(null);
    try {
      const res = await fetchAuth(`/interview/${sessionId}/end`, { method: "POST" });
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
    setTranscript([]);
    setQuestionsAsked(0);
    setPhase("intro");
    setReport(null);
    setReportSession(null);
    setStage("setup");
    setError(null);
  };

  const openHistorySession = async (id: number) => {
    try {
      const res = await fetchAuth(`/interview/sessions/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.session?.report) {
        setReport(data.session.report);
        setReportSession(data.session);
        setStage("report");
      }
    } catch {}
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="max-w-6xl mx-auto pb-12">
      {/* HEADER */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-bold tracking-wider uppercase">
              <Sparkles size={10} /> Sphere AI Studio
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Briefcase className="h-7 w-7 text-indigo-600" />
            Mülakat Simülatörü
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Gerçek bir mülakatçıyla sesli pratik yap, sonunda detaylı işe alım raporunu al.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setStage(stage === "history" ? "setup" : "history")}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
          >
            <History size={14} />
            Geçmiş ({history.length})
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-rose-50 border border-rose-200 rounded-xl p-3 text-sm text-rose-700 flex items-start gap-2">
          <XCircle size={16} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* SETUP */}
      {stage === "setup" && (
        <SetupPanel
          setup={setup}
          setSetup={setSetup}
          coaches={coaches}
          starting={starting}
          onStart={handleStart}
        />
      )}

      {/* LIVE */}
      {stage === "live" && (
        <LivePanel
          interviewerName={interviewerName}
          coaches={coaches}
          coachId={setup.interviewerStyle}
          phase={phase}
          questionsAsked={questionsAsked}
          targetQuestions={targetQuestions}
          transcript={transcript}
          recording={recording}
          processing={processing}
          aiSpeaking={aiSpeaking}
          ending={ending}
          transcriptScrollRef={transcriptScrollRef}
          onStartRecording={startRecording}
          onStopRecording={stopRecording}
          onEnd={handleEnd}
        />
      )}

      {/* REPORT */}
      {stage === "report" && report && reportSession && (
        <ReportPanel report={report} session={reportSession} onRestart={resetAll} />
      )}

      {/* HISTORY */}
      {stage === "history" && (
        <HistoryPanel
          sessions={history}
          onOpen={openHistorySession}
          onNew={() => setStage("setup")}
        />
      )}
    </div>
  );
}

// ── Setup Panel ──────────────────────────────────────────────────────────────

function SetupPanel({
  setup,
  setSetup,
  coaches,
  starting,
  onStart,
}: {
  setup: InterviewSetup;
  setSetup: (s: InterviewSetup) => void;
  coaches: Coach[];
  starting: boolean;
  onStart: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6">
        <h2 className="font-bold text-gray-900 mb-1">1. Pozisyon Bilgileri</h2>
        <p className="text-xs text-gray-500 mb-4">AI mülakatçı, bu bilgilere göre soru soracak.</p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Hedef pozisyon <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={setup.targetRole}
              onChange={(e) => setSetup({ ...setup, targetRole: e.target.value })}
              placeholder="Örn: Senior Backend Engineer, Marketing Manager, Product Designer..."
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Seviye</label>
              <select
                value={setup.seniority}
                onChange={(e) => setSetup({ ...setup, seniority: e.target.value as InterviewSetup["seniority"] })}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none text-sm bg-white"
              >
                {SENIORITY_OPTIONS.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Sektör</label>
              <select
                value={setup.industry}
                onChange={(e) => setSetup({ ...setup, industry: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none text-sm bg-white"
              >
                {INDUSTRY_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              İlan açıklaması (opsiyonel)
            </label>
            <textarea
              rows={3}
              value={setup.jobDescription}
              onChange={(e) => setSetup({ ...setup, jobDescription: e.target.value })}
              placeholder="Yapıştırırsan AI mülakatçı bu ilana göre özelleşir..."
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none text-sm resize-y"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              CV özeti (opsiyonel)
            </label>
            <textarea
              rows={3}
              value={setup.resumeText}
              onChange={(e) => setSetup({ ...setup, resumeText: e.target.value })}
              placeholder="Önceki deneyimini birkaç satırla özetle. Mülakatçı CV'ne göre takip soruları sorar."
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none text-sm resize-y"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Soru sayısı: <span className="text-indigo-600">{setup.targetQuestions}</span>
            </label>
            <input
              type="range" min={4} max={12} value={setup.targetQuestions}
              onChange={(e) => setSetup({ ...setup, targetQuestions: Number(e.target.value) })}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-gray-400 mt-1">
              <span>Hızlı (4)</span>
              <span>Standart (8)</span>
              <span>Detaylı (12)</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6">
        <h2 className="font-bold text-gray-900 mb-1">2. Mülakatçını Seç</h2>
        <p className="text-xs text-gray-500 mb-4">Her mülakatçının farklı bir aksanı ve sorgulama tarzı var.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {coaches.map((c) => {
            const selected = setup.interviewerStyle === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSetup({ ...setup, interviewerStyle: c.id })}
                className={`text-left p-3 rounded-xl border-2 transition-all ${
                  selected ? "border-indigo-500 bg-indigo-50/40 shadow-sm" : "border-gray-100 hover:border-gray-300"
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="font-bold text-gray-900 text-sm">{c.name}</p>
                  {selected && <CheckCircle2 size={14} className="text-indigo-600 mt-0.5" />}
                </div>
                <p className="text-[11px] text-gray-500 leading-snug line-clamp-3">{c.bio}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={onStart}
          disabled={starting || !setup.targetRole.trim()}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          {starting ? <Loader2 size={16} className="animate-spin" /> : <PlayCircle size={16} />}
          {starting ? "Mülakat hazırlanıyor..." : "Mülakatı Başlat"}
        </button>
      </div>
    </div>
  );
}

// ── Live Panel ───────────────────────────────────────────────────────────────

function LivePanel({
  interviewerName,
  coaches,
  coachId,
  phase,
  questionsAsked,
  targetQuestions,
  transcript,
  recording,
  processing,
  aiSpeaking,
  ending,
  transcriptScrollRef,
  onStartRecording,
  onStopRecording,
  onEnd,
}: {
  interviewerName: string;
  coaches: Coach[];
  coachId: string;
  phase: string;
  questionsAsked: number;
  targetQuestions: number;
  transcript: Turn[];
  recording: boolean;
  processing: boolean;
  aiSpeaking: boolean;
  ending: boolean;
  transcriptScrollRef: React.RefObject<HTMLDivElement>;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onEnd: () => void;
}) {
  const coach = coaches.find((c) => c.id === coachId);
  const progress = Math.min(100, Math.round((questionsAsked / targetQuestions) * 100));
  const phaseLabel: Record<string, string> = {
    intro: "Tanışma",
    experience: "Deneyim",
    behavioral: "Davranışsal",
    technical: "Teknik / Rol",
    candidate_q: "Senin Soruların",
    closing: "Kapanış",
  };

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
            {(interviewerName || "AI").slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="font-bold text-gray-900">{interviewerName}</p>
            <p className="text-xs text-gray-500">{coach?.bio?.slice(0, 80) || "AI Mülakatçı"}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs">
            <p className="font-semibold text-gray-700">
              Soru {questionsAsked} / {targetQuestions} <span className="text-gray-400">· {phaseLabel[phase] || phase}</span>
            </p>
            <div className="w-40 h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1">
              <div className="h-full bg-indigo-500 transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
          <button
            onClick={onEnd}
            disabled={ending}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {ending ? "Rapor hazırlanıyor..." : "Bitir & Rapor Al"}
          </button>
        </div>
      </div>

      {/* Transcript */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div ref={transcriptScrollRef} className="h-[420px] overflow-y-auto px-5 py-4 space-y-4">
          {transcript.map((t, i) => (
            <div key={i} className={`flex gap-3 ${t.role === "candidate" ? "flex-row-reverse" : ""}`}>
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  t.role === "interviewer" ? "bg-indigo-100 text-indigo-700" : "bg-emerald-100 text-emerald-700"
                }`}
              >
                {t.role === "interviewer" ? (interviewerName || "AI").slice(0, 1) : "S"}
              </div>
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  t.role === "interviewer"
                    ? "bg-gray-50 text-gray-800"
                    : "bg-emerald-50 text-emerald-900"
                }`}
              >
                {t.content}
              </div>
            </div>
          ))}

          {processing && (
            <div className="flex gap-3 items-center text-xs text-gray-500">
              <Loader2 size={14} className="animate-spin" />
              Cevabın değerlendiriliyor ve mülakatçı düşünüyor...
            </div>
          )}
          {aiSpeaking && (
            <div className="flex items-center gap-2 text-xs text-indigo-600">
              <Volume2 size={14} className="animate-pulse" />
              {interviewerName} konuşuyor...
            </div>
          )}
        </div>

        {/* Mic control */}
        <div className="border-t border-gray-100 px-5 py-4 bg-gray-50/50 flex items-center justify-center gap-4">
          {!recording ? (
            <button
              onClick={onStartRecording}
              disabled={processing || aiSpeaking || ending}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              <Mic size={16} />
              {aiSpeaking ? "Mülakatçı konuşuyor..." : processing ? "İşleniyor..." : "Cevaplamak için bas"}
            </button>
          ) : (
            <motion.button
              onClick={onStopRecording}
              animate={{ scale: [1, 1.06, 1] }}
              transition={{ repeat: Infinity, duration: 1.4 }}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-rose-600 text-white font-semibold text-sm hover:bg-rose-700 shadow-md"
            >
              <MicOff size={16} />
              Konuşmayı bitir
            </motion.button>
          )}
        </div>
      </div>

      <p className="text-[11px] text-gray-400 text-center">
        İpucu: Soruyu dinle, cevaplamak için butona bas, bitirince tekrar bas. Doğal konuş — düzeltmeleri sonunda raporda alacaksın.
      </p>
    </div>
  );
}

// ── Report Panel ─────────────────────────────────────────────────────────────

function ReportPanel({
  report,
  session,
  onRestart,
}: {
  report: InterviewReport;
  session: SessionRow;
  onRestart: () => void;
}) {
  const badge = HIRE_BADGE[report.hireRecommendation] || HIRE_BADGE.lean_hire;
  const overallColor = report.overallScore >= 80 ? "#16a34a" : report.overallScore >= 65 ? "#0369a1" : report.overallScore >= 50 ? "#b45309" : "#b91c1c";

  return (
    <div className="space-y-5">
      {/* Top summary */}
      <div className="bg-gradient-to-br from-indigo-50 via-white to-purple-50 rounded-2xl border border-indigo-100 shadow-sm p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-1">Mülakat Raporu</p>
            <h2 className="text-xl font-bold text-gray-900">{session.setup.targetRole}</h2>
            <p className="text-sm text-gray-500">
              {session.setup.industry} · {SENIORITY_OPTIONS.find((s) => s.id === session.setup.seniority)?.label || session.setup.seniority}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-center">
              <div className="text-3xl font-bold" style={{ color: overallColor }}>
                {report.overallScore}
              </div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Genel Skor</p>
            </div>
            <span
              className="px-3 py-1.5 rounded-full text-xs font-bold"
              style={{ background: badge.bg, color: badge.color }}
            >
              {report.hireRecommendationLabel || badge.label}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          <ScoreTile label="İngilizce Akıcılık" value={report.englishFluencyScore} />
          <ScoreTile label="Teknik İçerik" value={report.technicalContentScore} />
          <ScoreTile label="İletişim" value={report.communicationScore} />
          <ScoreTile label="Profesyonellik" value={report.professionalismScore} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span className="px-2 py-1 rounded-md bg-white border border-indigo-100 text-indigo-700 font-semibold flex items-center gap-1">
            <Award size={12} /> CEFR: {report.estimatedCefr} ({report.cefrConfidence})
          </span>
          <span className="px-2 py-1 rounded-md bg-white border border-gray-200 text-gray-600">
            {session.questionsAsked} soru · {formatDuration(session.durationSec)}
          </span>
        </div>
      </div>

      {/* Interviewer impression */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2 mb-2">
          <GraduationCap size={16} className="text-indigo-600" />
          Mülakatçının İzlenimi
        </h3>
        <p className="text-sm text-gray-700 leading-relaxed italic">"{report.interviewerImpression}"</p>
      </div>

      {/* Strong & weak */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2 mb-3">
            <ThumbsUp size={16} className="text-emerald-600" />
            Güçlü Yönlerin
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
            {report.strongPoints.length === 0 && (
              <p className="text-xs text-gray-400">Belirgin bir güçlü yön tespit edilemedi.</p>
            )}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-amber-600" />
            Geliştirilecek Alanlar
          </h3>
          <div className="space-y-3">
            {report.weakPoints.map((p, i) => (
              <div key={i}>
                <div className="flex gap-2">
                  <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{p.title}</p>
                    <p className="text-xs text-gray-500 leading-relaxed">{p.detail}</p>
                    {p.suggestion && (
                      <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                        <span className="font-semibold">→</span> {p.suggestion}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {report.weakPoints.length === 0 && (
              <p className="text-xs text-gray-400">Belirgin bir zayıf yön tespit edilemedi.</p>
            )}
          </div>
        </div>
      </div>

      {/* Better answers */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2 mb-4">
          <Sparkles size={16} className="text-purple-600" />
          Örnek Cevaplar — Daha İyi Nasıl Cevaplayabilirdin?
        </h3>
        <div className="space-y-5">
          {report.bestAnswers.map((b, i) => (
            <div key={i} className="border-l-2 border-purple-200 pl-4">
              <p className="text-xs font-semibold text-purple-700 uppercase tracking-wider mb-1">Soru {i + 1}</p>
              <p className="text-sm text-gray-700 italic mb-2">"{b.question}"</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Senin Cevabın</p>
                  <p className="text-xs text-gray-700 leading-relaxed">{b.yourAnswer}</p>
                </div>
                <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
                  <p className="text-[10px] font-bold text-emerald-700 uppercase mb-1">Önerilen Cevap</p>
                  <p className="text-xs text-emerald-900 leading-relaxed">{b.modelAnswer}</p>
                </div>
              </div>
              <p className="text-[11px] text-purple-700 mt-2 leading-relaxed">
                <span className="font-bold">Neden daha iyi:</span> {b.whyBetter}
              </p>
            </div>
          ))}
          {report.bestAnswers.length === 0 && (
            <p className="text-xs text-gray-400">Önerilen cevap üretilemedi.</p>
          )}
        </div>
      </div>

      {/* Practice areas + next steps */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2 mb-3">
            <TrendingUp size={16} className="text-blue-600" />
            Önerilen Pratik Alanları
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
            <CheckCircle2 size={16} className="text-emerald-600" />
            Sonraki Adımlar
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
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 shadow-sm"
        >
          <RotateCcw size={16} />
          Yeni Mülakat Başlat
        </button>
      </div>
    </div>
  );
}

function ScoreTile({ label, value }: { label: string; value: number }) {
  const color = value >= 80 ? "#16a34a" : value >= 65 ? "#0369a1" : value >= 50 ? "#b45309" : "#b91c1c";
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
      <div className="text-xl font-bold" style={{ color }}>{value}</div>
      <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">{label}</p>
    </div>
  );
}

// ── History Panel ────────────────────────────────────────────────────────────

function HistoryPanel({
  sessions,
  onOpen,
  onNew,
}: {
  sessions: SessionRow[];
  onOpen: (id: number) => void;
  onNew: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-gray-900">Mülakat Geçmişin</h2>
        <button onClick={onNew} className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700">
          + Yeni Mülakat
        </button>
      </div>
      {sessions.length === 0 ? (
        <p className="text-sm text-gray-500 py-12 text-center">Henüz tamamlanmış bir mülakatın yok.</p>
      ) : (
        <div className="space-y-2">
          {sessions.map((s) => {
            const badge = s.report ? HIRE_BADGE[s.report.hireRecommendation] || HIRE_BADGE.lean_hire : null;
            return (
              <button
                key={s.id}
                disabled={!s.report}
                onClick={() => onOpen(s.id)}
                className={`w-full text-left p-4 rounded-xl border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all flex items-center justify-between gap-3 ${
                  !s.report ? "opacity-60 cursor-not-allowed" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Briefcase size={16} />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-gray-900">{s.setup.targetRole}</p>
                    <p className="text-xs text-gray-500">
                      {s.setup.industry} · {new Date(s.startedAt).toLocaleDateString("tr-TR")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
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
