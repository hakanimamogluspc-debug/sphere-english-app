import { useEffect, useRef, useState } from "react";
import { API } from "@/lib/api-url";
import {
  ModuleShell, LoadingState, MicButton, MicPermissionSheet,
  useMicRecorder, Toast, useToast, MobileModuleIntro,
  colors, fonts, radius,
} from "@/components/mobile";
import {
  Presentation, ChevronRight, Volume2, StopCircle,
  Sparkles, CheckCircle2, AlertCircle, Award, TrendingUp,
} from "lucide-react";

/**
 * /m/pratik/sunum-sim — Mobil Sunum Simülatörü
 * setup → recording → processing → qa → report
 */

const TOKEN_KEY = "sphere_token";
const MIN_PRESENTATION_MS = 30_000; // 30 sn
const MIN_QA_ANSWER_MS = 2_000;

interface Audience { id: string; label: string; questionerName: string; questionerRole: string; bio: string; }
interface QATurn { question: string; candidateAnswer: string; questionerName: string; questionerRole: string; }

interface PresentationReport {
  overallScore: number;
  estimatedCefr: string;
  structureScore: number;
  clarityScore: number;
  persuasivenessScore: number;
  englishFluencyScore: number;
  vocalDeliveryScore: number;
  qaHandlingScore: number;
  audienceVerdict: string;
  audienceVerdictLabel: string;
  wordCount: number;
  estimatedDurationSec: number;
  estimatedPaceWpm: number;
  fillerWordCount: number;
  fillerExamples?: string[];
  hookFeedback?: { yourOpening: string; rating: string; suggestion: string };
  closingFeedback?: { yourClosing: string; rating: string; suggestion: string };
  structureNotes?: string;
  strongPoints?: Array<{ title: string; detail: string }>;
  weakPoints?: Array<{ title: string; detail: string; suggestion: string }>;
  improvedOpeningHook?: string;
  improvedClosingCta?: string;
  vocabUpgrades?: Array<{ original: string; better: string; explanation: string }>;
  qaFeedback?: Array<{ question: string; yourAnswer: string; rating: string; modelAnswer: string; coaching: string }>;
  recommendedPracticeAreas?: string[];
  nextSteps?: string[];
  audienceImpression?: string;
}

const GOAL_OPTIONS = [
  { id: "inform",   label: "Bilgilendirme",  desc: "Karmaşık konu anlat" },
  { id: "persuade", label: "İkna",           desc: "Görüşü savun" },
  { id: "pitch",    label: "Pitch",          desc: "Yatırım / satış" },
  { id: "train",    label: "Eğitim",         desc: "Workshop öğret" },
  { id: "update",   label: "Güncelleme",     desc: "Proje raporu" },
] as const;

const TONE_OPTIONS = [
  { id: "formal",       label: "Formal" },
  { id: "neutral",      label: "Profesyonel" },
  { id: "energetic",    label: "Enerjik" },
  { id: "consultative", label: "Danışmanvari" },
] as const;

const VERDICT_STYLE: Record<string, { color: string; bg: string }> = {
  compelling: { color: "#047857", bg: "#d1fae5" },
  solid:      { color: "#0369a1", bg: "#dbeafe" },
  needs_work: { color: "#b45309", bg: "#fef3c7" },
  weak:       { color: "#b91c1c", bg: "#fee2e2" },
};

async function apiFetch(path: string, init: RequestInit = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  return fetch(`${API}${path}`, {
    ...init,
    headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` },
  });
}

type Stage = "setup" | "recording" | "processing" | "qa" | "ending" | "report";

export default function MobilePresentationSim() {
  const [stage, setStage] = useState<Stage>("setup");
  const [audiences, setAudiences] = useState<Audience[]>([]);
  const [setup, setSetup] = useState({
    topic: "",
    audienceType: "team",
    goal: "inform" as (typeof GOAL_OPTIONS)[number]["id"],
    toneStyle: "neutral" as (typeof TONE_OPTIONS)[number]["id"],
    durationTargetMin: 5,
    contextNotes: "",
    targetQaTurns: 2,
  });

  const [sessionId, setSessionId] = useState<number | null>(null);
  const [presentationTranscript, setPresentationTranscript] = useState("");
  const [qaTurns, setQaTurns] = useState<QATurn[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [questionerName, setQuestionerName] = useState("");
  const [questionerRole, setQuestionerRole] = useState("");
  const [targetQaTurns, setTargetQaTurns] = useState(2);
  const [completedTurns, setCompletedTurns] = useState(0);
  const [report, setReport] = useState<PresentationReport | null>(null);

  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [processingStep, setProcessingStep] = useState("Sunumun işleniyor…");
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [pendingResume, setPendingResume] = useState<any>(null);
  const [micPermSheet, setMicPermSheet] = useState(false);

  const rec = useMicRecorder();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { toast, show: showToast, hide: hideToast } = useToast();

  useEffect(() => {
    apiFetch("/presentation/audiences")
      .then((r) => (r.ok ? r.json() : { audiences: [] }))
      .then((d) => setAudiences(d.audiences || []))
      .catch(() => {});
    apiFetch("/presentation/active")
      .then((r) => (r.ok ? r.json() : { session: null }))
      .then((d) => {
        if (d?.session) setPendingResume({
          sessionId: d.session.id,
          topic: d.session.setup?.topic || "",
          completedTurns: d.completedTurns || 0,
          targetQaTurns: d.session.targetQaTurns,
          session: d.session,
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => () => {
    audioRef.current?.pause();
    audioRef.current = null;
  }, []);

  const playAudio = (b64: string) => new Promise<void>((resolve) => {
    try {
      audioRef.current?.pause();
      const a = new Audio(`data:audio/mpeg;base64,${b64}`);
      audioRef.current = a;
      setAiSpeaking(true);
      const done = () => { setAiSpeaking(false); resolve(); };
      a.onended = done; a.onerror = done;
      a.play().catch(done);
    } catch { setAiSpeaking(false); resolve(); }
  });

  const startMic = async () => {
    try { await rec.start(); }
    catch (e: any) {
      if (rec.error?.code === "permission-denied" || e?.name === "NotAllowedError") setMicPermSheet(true);
      else showToast(rec.error?.message || "Mikrofon başlatılamadı", "error");
    }
  };

  const discardResume = async () => {
    if (!pendingResume) return;
    try {
      await apiFetch(`/presentation/${pendingResume.sessionId}/abandon`, { method: "POST" });
      setPendingResume(null);
    } catch {}
  };

  const resumeSession = () => {
    if (!pendingResume) return;
    const s = pendingResume.session;
    setSessionId(s.id);
    setSetup({
      topic: s.setup?.topic || "",
      audienceType: s.setup?.audienceType || "team",
      goal: s.setup?.goal || "inform",
      toneStyle: s.setup?.toneStyle || "neutral",
      durationTargetMin: s.setup?.durationTargetMin || 5,
      contextNotes: s.setup?.contextNotes || "",
      targetQaTurns: s.targetQaTurns,
    });
    setTargetQaTurns(s.targetQaTurns);
    setQaTurns(s.qaTurns || []);
    setCompletedTurns(pendingResume.completedTurns);
    setPresentationTranscript(s.presentationTranscript || "");
    // Sunum kayıt aşamasında mı, QA aşamasında mı?
    if (s.presentationTranscript) setStage("qa");
    else setStage("recording");
    setPendingResume(null);
  };

  const handleStart = async () => {
    if (!setup.topic.trim()) {
      showToast("Sunum konusunu yaz", "warning");
      return;
    }
    setStarting(true);
    try {
      const res = await apiFetch("/presentation/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(setup),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as any)?.error || "Sunum başlatılamadı");
      }
      const data = await res.json();
      setSessionId(data.sessionId);
      setTargetQaTurns(data.targetQaTurns);
      const aud = audiences.find(a => a.id === setup.audienceType);
      setQuestionerName(aud?.questionerName || data.audienceProfile?.questionerName || "");
      setQuestionerRole(aud?.questionerRole || data.audienceProfile?.questionerRole || "");
      setStage("recording");
    } catch (e: any) {
      showToast(e?.message || "Bir hata oluştu", "error");
    } finally {
      setStarting(false);
    }
  };

  const stopPresentation = async () => {
    if (rec.duration * 1000 < MIN_PRESENTATION_MS) {
      const remaining = Math.ceil(MIN_PRESENTATION_MS / 1000 - rec.duration);
      showToast(`En az 30 saniye konuş — ${remaining}sn daha`, "warning");
      return;
    }
    const blob = await rec.stop();
    if (!blob || !sessionId) return;
    await submitPresentation(blob);
  };

  const submitPresentation = async (blob: Blob) => {
    setSubmitting(true);
    setStage("processing");
    setProcessingStep("Sunumun transkript ediliyor…");
    const startedAt = Date.now();
    const t = window.setInterval(() => {
      const s = Math.floor((Date.now() - startedAt) / 1000);
      if (s >= 15) setProcessingStep("İlk soru hazırlanıyor…");
      else if (s >= 8) setProcessingStep(questionerName + " sunumunu inceliyor…");
      else setProcessingStep("Sunumun transkript ediliyor…");
    }, 500);

    try {
      const fd = new FormData();
      const ext = blob.type.includes("mp4") ? "mp4" : "webm";
      fd.append("audio", blob, `presentation.${ext}`);
      const res = await apiFetch(`/presentation/${sessionId}/submit`, { method: "POST", body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as any)?.error || "Sunum işlenemedi");
      }
      const data = await res.json();
      setPresentationTranscript(data.transcript);
      setCurrentQuestion(data.firstQuestion);
      setQuestionerName(data.questionerName);
      setQuestionerRole(data.questionerRole);
      setQaTurns([{
        question: data.firstQuestion, candidateAnswer: "",
        questionerName: data.questionerName, questionerRole: data.questionerRole,
      }]);
      setStage("qa");
      if (data.audioBase64) await playAudio(data.audioBase64);
    } catch (e: any) {
      showToast(e?.message || "Bir hata oluştu", "error");
      setStage("recording");
    } finally {
      window.clearInterval(t);
      setSubmitting(false);
    }
  };

  const submitQaAnswer = async () => {
    if (rec.duration * 1000 < MIN_QA_ANSWER_MS) {
      showToast("En az 2 saniye konuş", "warning");
      rec.cancel();
      return;
    }
    const blob = await rec.stop();
    if (!blob || !sessionId) return;
    setSubmitting(true);
    setProcessingStep("Cevabın işleniyor…");
    try {
      const fd = new FormData();
      const ext = blob.type.includes("mp4") ? "mp4" : "webm";
      fd.append("audio", blob, `answer.${ext}`);
      const res = await apiFetch(`/presentation/${sessionId}/qa-turn`, { method: "POST", body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as any)?.error || "Cevap gönderilemedi");
      }
      const data = await res.json();
      setQaTurns((prev) => {
        const next = [...prev];
        const last = next.length - 1;
        if (last >= 0) next[last] = { ...next[last], candidateAnswer: data.answerText };
        if (data.nextQuestion) {
          next.push({
            question: data.nextQuestion, candidateAnswer: "",
            questionerName, questionerRole,
          });
        }
        return next;
      });
      setCompletedTurns(data.completedTurns);
      if (data.nextQuestion) {
        setCurrentQuestion(data.nextQuestion);
        if (data.audioBase64) await playAudio(data.audioBase64);
      } else {
        setCurrentQuestion("");
        await handleEnd();
      }
    } catch (e: any) {
      showToast(e?.message || "Bir hata oluştu", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEnd = async () => {
    if (!sessionId) return;
    setStage("ending");
    try {
      const res = await apiFetch(`/presentation/${sessionId}/end`, { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as any)?.error || "Rapor oluşturulamadı");
      }
      const data = await res.json();
      setReport(data.report);
      setStage("report");
    } catch (e: any) {
      showToast(e?.message || "Rapor oluşturulamadı", "error");
      setStage("qa");
    }
  };

  const reset = () => {
    setSessionId(null); setPresentationTranscript("");
    setQaTurns([]); setCurrentQuestion("");
    setCompletedTurns(0); setReport(null);
    setStage("setup");
  };

  // ─── PROCESSING ────────────────────────────────
  if (stage === "processing") {
    return (
      <ModuleShell title="Sunum Analizi" subtitle="İşleniyor…">
        <LoadingState
          messages={[processingStep, "Neredeyse hazır…"]}
          hint="Bu 10-30 saniye sürebilir"
        />
      </ModuleShell>
    );
  }

  // ─── ENDING ───────────────────────────────
  if (stage === "ending") {
    return (
      <ModuleShell title="Rapor Hazırlanıyor" subtitle="Değerlendirmen üretiliyor">
        <LoadingState
          messages={[
            "Sunumun analiz ediliyor…",
            "Hook & closing değerlendiriliyor…",
            "Vokal metrikler hesaplanıyor…",
            "Model açılış ve kapanış yazılıyor…",
            "Neredeyse hazır…",
          ]}
          hint="Bu 20-40 saniye sürebilir"
        />
      </ModuleShell>
    );
  }

  // ─── REPORT ─────────────────────────────
  if (stage === "report" && report) {
    const verdict = VERDICT_STYLE[report.audienceVerdict] || VERDICT_STYLE.solid;
    return (
      <ModuleShell
        title="Sunum Raporu"
        subtitle={setup.topic}
        rightAction={
          <button
            onClick={reset}
            style={{
              background: "transparent", border: "none",
              fontSize: 11, color: colors.turqDeep, cursor: "pointer",
              fontFamily: fonts.heading, fontWeight: 700,
              textTransform: "uppercase", letterSpacing: "0.06em",
              padding: 8,
            }}
          >Bitir</button>
        }
      >
        <div style={{
          background: colors.brand, color: colors.white,
          borderRadius: radius.panel, padding: 20, marginBottom: 12,
        }}>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "flex-start",
            marginBottom: 14,
          }}>
            <div>
              <div style={{
                fontFamily: fonts.heading, fontWeight: 700, fontSize: 10,
                color: colors.turq, textTransform: "uppercase", letterSpacing: "0.06em",
                marginBottom: 4,
              }}>Genel</div>
              <div style={{
                fontFamily: fonts.heading, fontWeight: 900, fontSize: 44,
                letterSpacing: "-0.03em", lineHeight: 1,
                color: report.overallScore >= 80 ? colors.turq : colors.white,
              }}>{report.overallScore}<span style={{ fontSize: 16, color: colors.turq }}>/100</span></div>
            </div>
            <div style={{
              padding: "6px 12px", borderRadius: 100,
              background: verdict.bg, color: verdict.color,
              fontFamily: fonts.heading, fontWeight: 800, fontSize: 11,
            }}>{report.audienceVerdictLabel}</div>
          </div>
          <div style={{
            fontSize: 11, color: colors.turq,
            fontFamily: fonts.heading, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: "0.06em",
          }}>Tahmini seviye: {report.estimatedCefr}</div>
        </div>

        {/* 6 alt skor */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6,
          marginBottom: 16,
        }}>
          <ScoreBox label="Yapı" score={report.structureScore} />
          <ScoreBox label="Netlik" score={report.clarityScore} />
          <ScoreBox label="İkna" score={report.persuasivenessScore} />
          <ScoreBox label="İngilizce" score={report.englishFluencyScore} />
          <ScoreBox label="Vokal" score={report.vocalDeliveryScore} />
          <ScoreBox label="Q&A" score={report.qaHandlingScore} />
        </div>

        {/* Delivery metrikler */}
        <div style={{
          padding: 14, background: colors.navy50,
          borderRadius: 12, marginBottom: 16,
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12,
        }}>
          <Metric label="Süre" value={`${Math.round(report.estimatedDurationSec / 60)}dk`} />
          <Metric label="Hız" value={`${report.estimatedPaceWpm} wpm`} />
          <Metric label="Dolgu" value={String(report.fillerWordCount)} />
        </div>

        {report.audienceImpression && (
          <div style={{
            padding: 14, background: colors.turq + "12",
            border: `1px solid ${colors.turq}44`,
            borderRadius: 12, marginBottom: 16,
            borderLeft: `4px solid ${colors.turq}`,
          }}>
            <div style={{
              fontFamily: fonts.heading, fontWeight: 800, fontSize: 10,
              color: colors.turqDeep, textTransform: "uppercase", letterSpacing: "0.06em",
              marginBottom: 6,
            }}>Dinleyicinin izlenimi</div>
            <div style={{ fontSize: 13, color: colors.navy, lineHeight: 1.5, fontStyle: "italic" }}>
              "{report.audienceImpression}"
            </div>
          </div>
        )}

        {/* Hook feedback */}
        {report.hookFeedback && (
          <ReportSection title="Açılış (Hook)" icon={<Sparkles size={14} />}>
            <FeedbackCard
              rating={report.hookFeedback.rating}
              yourText={report.hookFeedback.yourOpening}
              suggestion={report.hookFeedback.suggestion}
              improved={report.improvedOpeningHook}
              yourLabel="Senin açılışın"
              improvedLabel="Daha iyi açılış"
            />
          </ReportSection>
        )}

        {/* Closing feedback */}
        {report.closingFeedback && (
          <ReportSection title="Kapanış (CTA)" icon={<Award size={14} />}>
            <FeedbackCard
              rating={report.closingFeedback.rating}
              yourText={report.closingFeedback.yourClosing}
              suggestion={report.closingFeedback.suggestion}
              improved={report.improvedClosingCta}
              yourLabel="Senin kapanışın"
              improvedLabel="Daha iyi kapanış"
            />
          </ReportSection>
        )}

        {/* Güçlü / Zayıf */}
        {report.strongPoints && report.strongPoints.length > 0 && (
          <ReportSection title="Güçlü yönler" icon={<CheckCircle2 size={14} />}>
            {report.strongPoints.map((p, i) => (
              <div key={i} style={{
                padding: 12, marginBottom: 6, background: "#f0fdf4",
                borderRadius: 10, border: `1px solid #bbf7d0`,
              }}>
                <div style={{ fontFamily: fonts.heading, fontWeight: 700, fontSize: 13, color: "#166534", marginBottom: 2 }}>
                  {p.title}
                </div>
                <div style={{ fontSize: 12, color: "#166534", lineHeight: 1.4 }}>{p.detail}</div>
              </div>
            ))}
          </ReportSection>
        )}

        {report.weakPoints && report.weakPoints.length > 0 && (
          <ReportSection title="Geliştirilecek alanlar" icon={<AlertCircle size={14} />}>
            {report.weakPoints.map((p, i) => (
              <div key={i} style={{
                padding: 12, marginBottom: 6, background: "#fef3c7",
                borderRadius: 10, border: `1px solid #fcd34d`,
              }}>
                <div style={{ fontFamily: fonts.heading, fontWeight: 700, fontSize: 13, color: "#92400e", marginBottom: 4 }}>
                  {p.title}
                </div>
                <div style={{ fontSize: 12, color: "#92400e", lineHeight: 1.4, marginBottom: 6 }}>{p.detail}</div>
                <div style={{
                  fontSize: 12, color: colors.turqDeep, fontWeight: 600,
                  padding: "6px 10px", background: colors.turqDeep + "15",
                  borderRadius: 8,
                }}>💡 {p.suggestion}</div>
              </div>
            ))}
          </ReportSection>
        )}

        {/* Sonraki adımlar */}
        {report.nextSteps && report.nextSteps.length > 0 && (
          <ReportSection title="Sonraki adımlar" icon={<TrendingUp size={14} />}>
            {report.nextSteps.slice(0, 5).map((s, i) => (
              <div key={i} style={{
                padding: 10, marginBottom: 4, background: colors.navy50,
                borderRadius: 10, fontSize: 13, color: colors.navy,
                lineHeight: 1.4, display: "flex", gap: 8, alignItems: "flex-start",
              }}>
                <span style={{
                  background: colors.brand, color: colors.white,
                  minWidth: 20, height: 20, borderRadius: 10,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 800, flexShrink: 0,
                }}>{i + 1}</span>
                <span>{s}</span>
              </div>
            ))}
          </ReportSection>
        )}

        <button
          onClick={reset}
          style={{
            width: "100%", padding: "14px 20px", borderRadius: 100,
            background: colors.brand, color: colors.white, border: "none",
            fontFamily: fonts.heading, fontWeight: 800, fontSize: 14,
            cursor: "pointer", marginTop: 16,
          }}
        >Yeni sunum</button>

        <Toast {...toast} onClose={hideToast} />
      </ModuleShell>
    );
  }

  // ─── RECORDING ───────────────────────────
  if (stage === "recording") {
    const durSec = Math.floor(rec.duration);
    const mm = Math.floor(durSec / 60);
    const ss = durSec % 60;
    const reachedMin = rec.duration * 1000 >= MIN_PRESENTATION_MS;
    return (
      <ModuleShell
        title="Sunumunu yap"
        subtitle={setup.topic}
        backTo="/m/pratik"
        footer={
          <div style={{ display: "flex", justifyContent: "center", padding: "8px 0" }}>
            <MicButton
              recording={rec.recording}
              level={rec.level}
              duration={rec.duration}
              disabled={submitting}
              onStart={startMic}
              onStop={stopPresentation}
              size={92}
            />
          </div>
        }
      >
        <div style={{ padding: "32px 20px", textAlign: "center" }}>
          <div style={{
            width: 80, height: 80, borderRadius: 40,
            background: colors.turq + "18", color: colors.turqDeep,
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px",
          }}>
            <Presentation size={36} strokeWidth={2} />
          </div>
          <div style={{
            fontFamily: fonts.heading, fontWeight: 900, fontSize: 22,
            color: colors.navy, letterSpacing: "-0.02em", marginBottom: 6,
          }}>Hazırsan sunumunu yap</div>
          <div style={{
            fontSize: 13, color: colors.neutral, lineHeight: 1.5,
            maxWidth: 300, margin: "0 auto 20px",
          }}>
            Hedef süre: <strong>{setup.durationTargetMin} dk</strong>.
            En az <strong>30 saniye</strong> konuş, hem konuyu anlat hem net bir
            açılış ve kapanış yap.
          </div>

          {rec.recording && (
            <>
              <div style={{
                fontFamily: fonts.heading, fontWeight: 900, fontSize: 40,
                color: colors.navy, letterSpacing: "-0.02em", lineHeight: 1,
                marginBottom: 4,
              }}>{mm}:{ss.toString().padStart(2, "0")}</div>
              <div style={{
                fontSize: 11, color: reachedMin ? colors.turqDeep : colors.warn,
                fontFamily: fonts.heading, fontWeight: 700,
                textTransform: "uppercase", letterSpacing: "0.06em",
              }}>
                {reachedMin ? "Bitirmeye hazır" : "Min 30 sn"}
              </div>
            </>
          )}
        </div>

        <MicPermissionSheet
          visible={micPermSheet}
          onClose={() => setMicPermSheet(false)}
          onRetry={startMic}
        />
        <Toast {...toast} onClose={hideToast} />
      </ModuleShell>
    );
  }

  // ─── Q&A ────────────────────────────────
  if (stage === "qa") {
    const progress = targetQaTurns > 0 ? (completedTurns / targetQaTurns) * 100 : 0;
    return (
      <ModuleShell
        title={questionerName || "Dinleyici"}
        subtitle={questionerRole ? `${questionerRole} · Soru & Cevap` : "Soru & Cevap"}
        backTo="/m/pratik"
        rightAction={
          <button
            onClick={handleEnd}
            style={{
              background: colors.turq, border: "none",
              padding: "6px 10px", borderRadius: 100,
              display: "flex", alignItems: "center", gap: 4,
              fontSize: 11, color: colors.navy, cursor: "pointer",
              fontFamily: fonts.heading, fontWeight: 800,
              textTransform: "uppercase", letterSpacing: "0.04em",
            }}
          >
            <StopCircle size={12} strokeWidth={2.5} />
            Bitir
          </button>
        }
        footer={
          <div style={{ display: "flex", justifyContent: "center", padding: "8px 0" }}>
            <MicButton
              recording={rec.recording}
              level={rec.level}
              duration={rec.duration}
              disabled={submitting || aiSpeaking}
              onStart={startMic}
              onStop={submitQaAnswer}
              size={84}
            />
          </div>
        }
      >
        {/* Progress */}
        <div style={{ marginBottom: 16 }}>
          <div style={{
            display: "flex", justifyContent: "space-between",
            fontFamily: fonts.heading, fontSize: 11, fontWeight: 700,
            color: colors.neutral, textTransform: "uppercase", letterSpacing: "0.06em",
            marginBottom: 6,
          }}>
            <span>Soru {completedTurns} / {targetQaTurns}</span>
            <span>%{Math.round(progress)}</span>
          </div>
          <div style={{ height: 4, background: colors.navy50, borderRadius: 100, overflow: "hidden" }}>
            <div style={{
              height: "100%", background: colors.turq,
              width: `${progress}%`, transition: "width 0.3s",
            }} />
          </div>
        </div>

        {/* Q&A transkript */}
        {qaTurns.map((t, i) => (
          <div key={i} style={{ marginBottom: 16 }}>
            <div style={{
              padding: "12px 16px", borderRadius: 16,
              background: colors.navy50, color: colors.navy,
              fontFamily: fonts.body, fontSize: 14, lineHeight: 1.5,
              marginBottom: 8,
            }}>
              <div style={{
                fontFamily: fonts.heading, fontWeight: 700, fontSize: 10,
                color: colors.turqDeep, textTransform: "uppercase", letterSpacing: "0.06em",
                marginBottom: 4,
              }}>{t.questionerName}</div>
              {t.question}
            </div>
            {t.candidateAnswer && (
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <div style={{
                  maxWidth: "84%", padding: "12px 16px", borderRadius: 16,
                  background: colors.brand, color: colors.white,
                  fontFamily: fonts.body, fontSize: 14, lineHeight: 1.5,
                }}>{t.candidateAnswer}</div>
              </div>
            )}
          </div>
        ))}

        {submitting && (
          <LoadingState compact messages={[processingStep]} />
        )}
        {aiSpeaking && !submitting && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: 8, marginTop: 8, padding: 8,
          }}>
            <Volume2 size={14} color={colors.turq} strokeWidth={2.5} />
            <span style={{
              fontSize: 11, color: colors.turqDeep,
              fontFamily: fonts.heading, fontWeight: 700,
              textTransform: "uppercase", letterSpacing: "0.06em",
            }}>{questionerName} konuşuyor</span>
          </div>
        )}

        <MicPermissionSheet
          visible={micPermSheet}
          onClose={() => setMicPermSheet(false)}
          onRetry={startMic}
        />
        <Toast {...toast} onClose={hideToast} />
      </ModuleShell>
    );
  }

  // ─── SETUP (default) ──────────────────────
  return (
    <ModuleShell title="Sunum Simülatörü" subtitle="Kurulum">
      <MobileModuleIntro moduleKey="presentation_sim" />

      {pendingResume && (
        <div style={{
          padding: 14, marginBottom: 20,
          background: "#fef3c7", borderRadius: 12,
          border: `1px solid #fcd34d`,
        }}>
          <div style={{
            fontFamily: fonts.heading, fontWeight: 700, fontSize: 11,
            color: "#92400e", textTransform: "uppercase", letterSpacing: "0.06em",
            marginBottom: 4,
          }}>Devam eden sunum</div>
          <div style={{
            fontFamily: fonts.heading, fontWeight: 800, fontSize: 14,
            color: "#78350f", marginBottom: 8, letterSpacing: "-0.01em",
          }}>{pendingResume.topic}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={discardResume}
              style={{
                padding: "8px 14px", borderRadius: 100,
                background: colors.white, color: "#92400e",
                border: `1px solid #fcd34d`,
                fontFamily: fonts.heading, fontWeight: 700, fontSize: 12,
                cursor: "pointer",
              }}
            >Yeni Başlat</button>
            <button
              onClick={resumeSession}
              style={{
                flex: 1, padding: "8px 14px", borderRadius: 100,
                background: "#b45309", color: colors.white,
                border: "none", fontFamily: fonts.heading,
                fontWeight: 800, fontSize: 12, cursor: "pointer",
              }}
            >Devam et →</button>
          </div>
        </div>
      )}

      <div style={{
        fontFamily: fonts.heading, fontWeight: 700, fontSize: 11,
        color: colors.turqDeep, textTransform: "uppercase", letterSpacing: "0.06em",
        marginBottom: 6,
      }}>Sunum kurulumu</div>
      <div style={{
        fontFamily: fonts.heading, fontWeight: 900, fontSize: 24,
        color: colors.navy, letterSpacing: "-0.02em", lineHeight: 1.2,
        marginBottom: 20,
      }}>
        Ne{" "}
        <span style={{ position: "relative", display: "inline-block" }}>
          sunacaksın
          <span style={{
            position: "absolute", left: 0, right: 0, bottom: 2,
            height: 10, background: colors.turq, opacity: 0.85,
            transform: "skewY(-1deg)", zIndex: -1,
          }} />
        </span>?
      </div>

      <Label>Konu / Başlık</Label>
      <input
        type="text"
        value={setup.topic}
        onChange={(e) => setSetup({ ...setup, topic: e.target.value })}
        placeholder="Örn: Q4 gelir raporu ve gelecek stratejisi"
        style={{
          width: "100%", padding: "12px 14px", borderRadius: 12,
          border: `1px solid ${colors.navy100}`,
          fontFamily: fonts.body, fontSize: 14,
          background: colors.white, color: colors.navy,
          outline: "none", marginBottom: 20,
        }}
      />

      {/* Dinleyici */}
      {audiences.length > 0 && (
        <>
          <Label>Dinleyici</Label>
          <div style={{ display: "grid", gap: 6, marginBottom: 20 }}>
            {audiences.map((a) => (
              <button
                key={a.id}
                onClick={() => setSetup({ ...setup, audienceType: a.id })}
                style={{
                  padding: 12, borderRadius: 12,
                  background: setup.audienceType === a.id ? colors.navy : colors.white,
                  color: setup.audienceType === a.id ? colors.white : colors.navy,
                  border: `1px solid ${setup.audienceType === a.id ? colors.navy : colors.navy100}`,
                  cursor: "pointer", textAlign: "left",
                }}
              >
                <div style={{
                  fontFamily: fonts.heading, fontWeight: 800, fontSize: 13,
                  marginBottom: 2, letterSpacing: "-0.01em",
                }}>{a.label}</div>
                <div style={{ fontSize: 11, opacity: 0.75, lineHeight: 1.4 }}>{a.bio}</div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Amaç */}
      <Label>Amaç</Label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 20 }}>
        {GOAL_OPTIONS.map((g) => (
          <button
            key={g.id}
            onClick={() => setSetup({ ...setup, goal: g.id })}
            style={{
              padding: "10px 12px", borderRadius: 10,
              background: setup.goal === g.id ? colors.navy : colors.white,
              color: setup.goal === g.id ? colors.white : colors.navy,
              border: `1px solid ${setup.goal === g.id ? colors.navy : colors.navy100}`,
              cursor: "pointer", textAlign: "left",
            }}
          >
            <div style={{
              fontFamily: fonts.heading, fontWeight: 700, fontSize: 13,
              marginBottom: 2, letterSpacing: "-0.01em",
            }}>{g.label}</div>
            <div style={{ fontSize: 10, opacity: 0.7 }}>{g.desc}</div>
          </button>
        ))}
      </div>

      {/* Ton */}
      <Label>Ton</Label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 20 }}>
        {TONE_OPTIONS.map((t) => (
          <button
            key={t.id}
            onClick={() => setSetup({ ...setup, toneStyle: t.id })}
            style={{
              padding: "10px 12px", borderRadius: 10,
              background: setup.toneStyle === t.id ? colors.navy : colors.white,
              color: setup.toneStyle === t.id ? colors.white : colors.navy,
              border: `1px solid ${setup.toneStyle === t.id ? colors.navy : colors.navy100}`,
              fontFamily: fonts.heading, fontWeight: 700, fontSize: 13,
              cursor: "pointer",
            }}
          >{t.label}</button>
        ))}
      </div>

      {/* Süre */}
      <Label>Süre (hedef)</Label>
      <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
        {[3, 5, 7, 10].map((d) => (
          <button
            key={d}
            onClick={() => setSetup({ ...setup, durationTargetMin: d })}
            style={{
              flex: 1, padding: "10px 8px", borderRadius: 10,
              background: setup.durationTargetMin === d ? colors.navy : colors.white,
              color: setup.durationTargetMin === d ? colors.white : colors.navy,
              border: `1px solid ${setup.durationTargetMin === d ? colors.navy : colors.navy100}`,
              fontFamily: fonts.heading, fontWeight: 700, fontSize: 13,
              cursor: "pointer",
            }}
          >{d}dk</button>
        ))}
      </div>

      {/* Q&A turu */}
      <Label>Q&A soru sayısı</Label>
      <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
        {[1, 2, 3, 4].map((n) => (
          <button
            key={n}
            onClick={() => setSetup({ ...setup, targetQaTurns: n })}
            style={{
              flex: 1, padding: "10px 8px", borderRadius: 10,
              background: setup.targetQaTurns === n ? colors.navy : colors.white,
              color: setup.targetQaTurns === n ? colors.white : colors.navy,
              border: `1px solid ${setup.targetQaTurns === n ? colors.navy : colors.navy100}`,
              fontFamily: fonts.heading, fontWeight: 700, fontSize: 13,
              cursor: "pointer",
            }}
          >{n}</button>
        ))}
      </div>

      {/* Bağlam notu */}
      <Label>Bağlam notu (opsiyonel)</Label>
      <textarea
        value={setup.contextNotes}
        onChange={(e) => setSetup({ ...setup, contextNotes: e.target.value })}
        placeholder="Ek bilgi, dinleyici hakkında detay, öne çıkacak metrikler…"
        rows={3}
        style={{
          width: "100%", padding: "12px 14px", borderRadius: 12,
          border: `1px solid ${colors.navy100}`,
          fontFamily: fonts.body, fontSize: 13,
          background: colors.white, color: colors.navy,
          outline: "none", resize: "vertical",
          marginBottom: 24,
        }}
      />

      <button
        onClick={handleStart}
        disabled={starting || !setup.topic.trim()}
        style={{
          width: "100%", padding: "16px 20px", borderRadius: 100,
          background: colors.brand, color: colors.white, border: "none",
          fontFamily: fonts.heading, fontWeight: 800, fontSize: 15,
          cursor: starting ? "not-allowed" : "pointer",
          opacity: starting || !setup.topic.trim() ? 0.5 : 1,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}
      >
        {starting ? (
          <>
            <Sparkles size={16} strokeWidth={2.5} />
            Hazırlanıyor…
          </>
        ) : (
          <>
            <Presentation size={16} strokeWidth={2.5} />
            Sunuma başla
          </>
        )}
      </button>

      <Toast {...toast} onClose={hideToast} />
    </ModuleShell>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: fonts.heading, fontWeight: 700, fontSize: 11,
      color: colors.neutral, textTransform: "uppercase", letterSpacing: "0.06em",
      marginBottom: 8,
    }}>{children}</div>
  );
}

function ScoreBox({ label, score }: { label: string; score: number }) {
  const color = score >= 80 ? "#22c55e" : score >= 60 ? colors.turq : score >= 40 ? colors.warn : colors.error;
  return (
    <div style={{
      padding: 10, background: colors.white,
      border: `1px solid ${colors.navy50}`, borderRadius: 10,
      textAlign: "center",
    }}>
      <div style={{
        fontFamily: fonts.heading, fontWeight: 900, fontSize: 18,
        color, letterSpacing: "-0.01em", lineHeight: 1,
      }}>{score}</div>
      <div style={{
        fontFamily: fonts.heading, fontWeight: 700, fontSize: 9,
        color: colors.neutral, textTransform: "uppercase", letterSpacing: "0.04em",
        marginTop: 4,
      }}>{label}</div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{
        fontFamily: fonts.heading, fontWeight: 900, fontSize: 16,
        color: colors.navy, letterSpacing: "-0.01em",
      }}>{value}</div>
      <div style={{
        fontFamily: fonts.heading, fontWeight: 700, fontSize: 10,
        color: colors.neutral, textTransform: "uppercase", letterSpacing: "0.04em",
        marginTop: 2,
      }}>{label}</div>
    </div>
  );
}

function ReportSection({ title, icon, children }: {
  title: string; icon: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        fontFamily: fonts.heading, fontWeight: 700, fontSize: 11,
        color: colors.navy, textTransform: "uppercase", letterSpacing: "0.06em",
        marginBottom: 10,
      }}>
        <span style={{ color: colors.turqDeep }}>{icon}</span>
        {title}
      </div>
      {children}
    </div>
  );
}

function FeedbackCard({
  rating, yourText, suggestion, improved, yourLabel, improvedLabel,
}: {
  rating: string; yourText: string; suggestion: string; improved?: string;
  yourLabel: string; improvedLabel: string;
}) {
  const ratingColor = rating === "strong" ? "#16a34a" : rating === "ok" ? colors.turqDeep : colors.warn;
  const ratingLabel = rating === "strong" ? "Güçlü" : rating === "ok" ? "Ortalama" : "Zayıf";
  return (
    <div style={{
      padding: 12, background: colors.white,
      border: `1px solid ${colors.navy50}`, borderRadius: 10,
      marginBottom: 8,
    }}>
      <div style={{
        display: "inline-block", padding: "2px 8px", borderRadius: 100,
        background: ratingColor + "22", color: ratingColor,
        fontFamily: fonts.heading, fontWeight: 800, fontSize: 10,
        textTransform: "uppercase", letterSpacing: "0.04em",
        marginBottom: 8,
      }}>{ratingLabel}</div>
      <div style={{
        padding: 10, background: colors.navy50, borderRadius: 8,
        fontSize: 12, color: colors.navy, marginBottom: 6, lineHeight: 1.5,
      }}>
        <strong>{yourLabel}:</strong> {yourText}
      </div>
      {improved && (
        <div style={{
          padding: 10, background: colors.turq + "15", borderRadius: 8,
          fontSize: 12, color: colors.navy, marginBottom: 6, lineHeight: 1.5,
        }}>
          <strong>{improvedLabel}:</strong> {improved}
        </div>
      )}
      <div style={{
        fontSize: 12, color: colors.turqDeep, lineHeight: 1.4,
        padding: "6px 10px", background: colors.turqDeep + "10", borderRadius: 6,
      }}>💡 {suggestion}</div>
    </div>
  );
}
