import { useCallback, useEffect, useRef, useState } from "react";
import { API } from "@/lib/api-url";
import {
  ModuleShell, LoadingState, MicButton, MicPermissionSheet,
  useMicRecorder, Toast, useToast, MobileModuleIntro,
  colors, fonts, radius,
} from "@/components/mobile";
import {
  ChevronRight, Play, Volume2, StopCircle,
  Briefcase, Sparkles, Award, TrendingUp, CheckCircle2, AlertCircle,
} from "lucide-react";

/**
 * /m/pratik/mulakat-sim — Mobil Mülakat Simülatörü
 *
 * Ekranlar:
 *   setup → live (mic + transkript) → report
 */

const TOKEN_KEY = "sphere_token";
const MIN_RECORD_MS = 2000;

interface Coach { id: string; name: string; voice: string; bio: string; }

interface InterviewSetup {
  targetRole: string;
  seniority: "junior" | "mid" | "senior" | "lead" | "executive";
  industry: string;
  interviewerStyle: string;
  targetQuestions: number;
}

interface Turn {
  role: "interviewer" | "candidate";
  content: string;
}

interface InterviewReport {
  overallScore: number;
  hireRecommendation: string;
  hireRecommendationLabel: string;
  estimatedCefr: string;
  englishFluencyScore: number;
  technicalContentScore: number;
  communicationScore: number;
  professionalismScore: number;
  strongPoints?: Array<{ title: string; detail: string }>;
  weakPoints?: Array<{ title: string; detail: string; suggestion: string }>;
  bestAnswers?: Array<{ question: string; yourAnswer: string; modelAnswer: string; whyBetter: string }>;
  interviewerImpression?: string;
  recommendedPracticeAreas?: string[];
  nextSteps?: string[];
}

const SENIORITY_OPTIONS: Array<{ id: InterviewSetup["seniority"]; label: string }> = [
  { id: "junior",    label: "Junior (0-2 yıl)" },
  { id: "mid",       label: "Mid (2-5 yıl)" },
  { id: "senior",    label: "Senior (5-9 yıl)" },
  { id: "lead",      label: "Lead / Manager" },
  { id: "executive", label: "Executive" },
];

const INDUSTRY_OPTIONS = [
  "Teknoloji", "Finans", "Sağlık", "Üretim", "Perakende", "Lojistik",
  "İnşaat", "Eğitim", "Turizm", "Danışmanlık", "Hukuk", "Medya", "Enerji", "Diğer",
];

const HIRE_STYLES: Record<string, { color: string; bg: string }> = {
  strong_hire: { color: "#047857", bg: "#d1fae5" },
  hire:        { color: "#0369a1", bg: "#dbeafe" },
  lean_hire:   { color: "#b45309", bg: "#fef3c7" },
  no_hire:     { color: "#b91c1c", bg: "#fee2e2" },
};

async function apiFetch(path: string, init: RequestInit = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  return fetch(`${API}${path}`, {
    ...init,
    headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` },
  });
}

type Stage = "setup" | "live" | "ending" | "report";

export default function MobileInterviewSim() {
  const [stage, setStage] = useState<Stage>("setup");
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [setup, setSetup] = useState<InterviewSetup>({
    targetRole: "",
    seniority: "mid",
    industry: "Teknoloji",
    interviewerStyle: "emma",
    targetQuestions: 6,
  });
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [transcript, setTranscript] = useState<Turn[]>([]);
  const [questionsAsked, setQuestionsAsked] = useState(0);
  const [targetQuestions, setTargetQuestions] = useState(6);
  const [interviewerName, setInterviewerName] = useState("");
  const [report, setReport] = useState<InterviewReport | null>(null);
  const [starting, setStarting] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState("Cevabın işleniyor…");
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [pendingResume, setPendingResume] = useState<any>(null);
  const [micPermSheet, setMicPermSheet] = useState(false);

  const rec = useMicRecorder();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const { toast, show: showToast, hide: hideToast } = useToast();

  useEffect(() => {
    apiFetch("/interview/coaches")
      .then((r) => (r.ok ? r.json() : { coaches: [] }))
      .then((d) => setCoaches(d.coaches || []))
      .catch(() => {});
    apiFetch("/interview/active")
      .then((r) => (r.ok ? r.json() : { session: null }))
      .then((d) => {
        if (d?.session) {
          setPendingResume({
            sessionId: d.session.id,
            targetRole: d.session.setup?.targetRole || "",
            questionsAsked: d.session.questionsAsked,
            targetQuestions: d.session.targetQuestions,
            interviewerName: d.interviewerName || "",
            session: d.session,
          });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 60);
  }, [transcript.length, processing]);

  useEffect(() => () => {
    audioRef.current?.pause();
    audioRef.current = null;
  }, []);

  const playAudio = useCallback((b64: string) => new Promise<void>((resolve) => {
    try {
      audioRef.current?.pause();
      const audio = new Audio(`data:audio/mpeg;base64,${b64}`);
      audioRef.current = audio;
      setAiSpeaking(true);
      const done = () => { setAiSpeaking(false); resolve(); };
      audio.onended = done;
      audio.onerror = done;
      audio.play().catch(done);
    } catch { setAiSpeaking(false); resolve(); }
  }), []);

  const handleResume = () => {
    if (!pendingResume) return;
    const s = pendingResume.session;
    setSessionId(s.id);
    setSetup({
      targetRole: s.setup?.targetRole || "",
      seniority: s.setup?.seniority || "mid",
      industry: s.setup?.industry || "Teknoloji",
      interviewerStyle: s.setup?.interviewerStyle || "emma",
      targetQuestions: s.targetQuestions,
    });
    setTranscript(s.transcript || []);
    setQuestionsAsked(s.questionsAsked);
    setTargetQuestions(s.targetQuestions);
    setInterviewerName(pendingResume.interviewerName);
    setStage("live");
    setPendingResume(null);
  };

  const discardResume = async () => {
    if (!pendingResume) return;
    try {
      await apiFetch(`/interview/${pendingResume.sessionId}/abandon`, { method: "POST" });
      setPendingResume(null);
    } catch {}
  };

  const handleStart = async () => {
    if (!setup.targetRole.trim()) {
      showToast("Hedef pozisyonu yaz", "warning");
      return;
    }
    setStarting(true);
    try {
      const res = await apiFetch("/interview/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(setup),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as any)?.error || "Mülakat başlatılamadı");
      }
      const data = await res.json();
      setSessionId(data.sessionId);
      setQuestionsAsked(data.questionsAsked);
      setTargetQuestions(data.targetQuestions);
      setInterviewerName(data.interviewerName);
      setTranscript([{ role: "interviewer", content: data.reply }]);
      setStage("live");
      if (data.audioBase64) playAudio(data.audioBase64);
    } catch (e: any) {
      showToast(e?.message || "Bir hata oluştu", "error");
    } finally {
      setStarting(false);
    }
  };

  const startMic = async () => {
    if (rec.recording || processing || aiSpeaking) return;
    try { await rec.start(); }
    catch (e: any) {
      if (rec.error?.code === "permission-denied" || e?.name === "NotAllowedError") setMicPermSheet(true);
      else showToast(rec.error?.message || "Mikrofon başlatılamadı", "error");
    }
  };

  const stopMicAndSend = async () => {
    if (rec.duration * 1000 < MIN_RECORD_MS) {
      rec.cancel();
      showToast("En az 2 saniye konuş", "warning");
      return;
    }
    const blob = await rec.stop();
    if (!blob || !sessionId) return;
    setProcessing(true);
    setProcessingStep("Cevabın işleniyor…");
    const startedAt = Date.now();
    const procTimer = window.setInterval(() => {
      const s = Math.floor((Date.now() - startedAt) / 1000);
      if (s >= 12) setProcessingStep("Sesli yanıt hazırlanıyor…");
      else if (s >= 6) setProcessingStep(interviewerName + " değerlendiriyor…");
      else setProcessingStep("Cevabın işleniyor…");
    }, 500);

    try {
      const fd = new FormData();
      const ext = blob.type.includes("mp4") ? "mp4" : "webm";
      fd.append("audio", blob, `answer.${ext}`);
      const res = await apiFetch(`/interview/${sessionId}/turn`, { method: "POST", body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as any)?.error || "Cevap gönderilemedi");
      }
      const data = await res.json();
      setTranscript((prev) => [
        ...prev,
        { role: "candidate", content: data.userText },
        { role: "interviewer", content: data.reply },
      ]);
      setQuestionsAsked(data.questionsAsked);
      if (data.audioBase64) await playAudio(data.audioBase64);
      if (data.isFinalTurn) {
        await handleEnd();
      }
    } catch (e: any) {
      showToast(e?.message || "Bir hata oluştu", "error");
    } finally {
      window.clearInterval(procTimer);
      setProcessing(false);
    }
  };

  const handleEnd = async () => {
    if (!sessionId) return;
    setStage("ending");
    try {
      const res = await apiFetch(`/interview/${sessionId}/end`, { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as any)?.error || "Rapor oluşturulamadı");
      }
      const data = await res.json();
      setReport(data.report);
      setStage("report");
    } catch (e: any) {
      showToast(e?.message || "Rapor oluşturulamadı", "error");
      setStage("live");
    }
  };

  const reset = () => {
    setSessionId(null);
    setTranscript([]);
    setQuestionsAsked(0);
    setReport(null);
    setStage("setup");
  };

  // ─── ENDING ──────────────────────────────
  if (stage === "ending") {
    return (
      <ModuleShell title="Mülakat Bitiyor" subtitle="Rapor hazırlanıyor…">
        <LoadingState
          messages={[
            "Cevaplarını değerlendiriliyor…",
            "İngilizce akıcılığın ölçülüyor…",
            "Güçlü/zayıf yönler çıkarılıyor…",
            "Model cevaplar hazırlanıyor…",
            "Neredeyse hazır…",
          ]}
          hint="Bu 15-30 saniye sürebilir"
        />
      </ModuleShell>
    );
  }

  // ─── REPORT ──────────────────────────────
  if (stage === "report" && report) {
    const badge = HIRE_STYLES[report.hireRecommendation] || HIRE_STYLES.hire;
    return (
      <ModuleShell
        title="Mülakat Raporu"
        subtitle={setup.targetRole}
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
        {/* Genel skor */}
        <div style={{
          background: colors.brand, color: colors.white,
          borderRadius: radius.panel, padding: 20, marginBottom: 12,
        }}>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "flex-start",
            marginBottom: 14,
          }}>
            <div style={{ flex: 1 }}>
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
              background: badge.bg, color: badge.color,
              fontFamily: fonts.heading, fontWeight: 800, fontSize: 11,
              flexShrink: 0,
            }}>{report.hireRecommendationLabel}</div>
          </div>
          <div style={{
            fontSize: 11, color: colors.turq,
            fontFamily: fonts.heading, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: "0.06em",
          }}>Tahmini seviye: {report.estimatedCefr}</div>
        </div>

        {/* 4 skor */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6,
          marginBottom: 16,
        }}>
          <ScoreBox label="İngilizce" score={report.englishFluencyScore} />
          <ScoreBox label="Teknik" score={report.technicalContentScore} />
          <ScoreBox label="İletişim" score={report.communicationScore} />
          <ScoreBox label="Profesyonellik" score={report.professionalismScore} />
        </div>

        {report.interviewerImpression && (
          <div style={{
            padding: 14, background: colors.navy50,
            borderRadius: 12, marginBottom: 16,
            borderLeft: `4px solid ${colors.turq}`,
          }}>
            <div style={{
              fontFamily: fonts.heading, fontWeight: 800, fontSize: 10,
              color: colors.turqDeep, textTransform: "uppercase", letterSpacing: "0.06em",
              marginBottom: 6,
            }}>Mülakatçının izlenimi</div>
            <div style={{ fontSize: 13, color: colors.navy, lineHeight: 1.5, fontStyle: "italic" }}>
              "{report.interviewerImpression}"
            </div>
          </div>
        )}

        {/* Güçlü yönler */}
        {report.strongPoints && report.strongPoints.length > 0 && (
          <ReportSection title="Güçlü yönler" icon={<CheckCircle2 size={14} />} tint="#22c55e">
            {report.strongPoints.map((p, i) => (
              <div key={i} style={{
                padding: 12, marginBottom: 6,
                background: "#f0fdf4", borderRadius: 10,
                border: `1px solid #bbf7d0`,
              }}>
                <div style={{ fontFamily: fonts.heading, fontWeight: 700, fontSize: 13, color: "#166534", marginBottom: 2 }}>
                  {p.title}
                </div>
                <div style={{ fontSize: 12, color: "#166534", lineHeight: 1.4 }}>{p.detail}</div>
              </div>
            ))}
          </ReportSection>
        )}

        {/* Zayıf yönler */}
        {report.weakPoints && report.weakPoints.length > 0 && (
          <ReportSection title="Geliştirilecek alanlar" icon={<AlertCircle size={14} />} tint={colors.warn}>
            {report.weakPoints.map((p, i) => (
              <div key={i} style={{
                padding: 12, marginBottom: 6,
                background: "#fef3c7", borderRadius: 10,
                border: `1px solid #fcd34d`,
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

        {/* Model cevaplar */}
        {report.bestAnswers && report.bestAnswers.length > 0 && (
          <ReportSection title="Daha iyi cevaplar" icon={<Sparkles size={14} />} tint={colors.turq}>
            {report.bestAnswers.slice(0, 3).map((b, i) => (
              <div key={i} style={{
                padding: 12, marginBottom: 8,
                background: colors.white, border: `1px solid ${colors.navy50}`,
                borderRadius: 10,
              }}>
                <div style={{
                  fontFamily: fonts.heading, fontWeight: 800, fontSize: 12,
                  color: colors.navy, marginBottom: 8,
                  textTransform: "uppercase", letterSpacing: "0.04em",
                }}>S: {b.question}</div>
                <div style={{
                  padding: 10, background: "#fef2f2", borderRadius: 8,
                  fontSize: 12, color: "#7f1d1d", marginBottom: 6, lineHeight: 1.5,
                }}>
                  <strong>Senin cevabın:</strong> {b.yourAnswer}
                </div>
                <div style={{
                  padding: 10, background: "#ecfdf5", borderRadius: 8,
                  fontSize: 12, color: "#065f46", marginBottom: 6, lineHeight: 1.5,
                }}>
                  <strong>Model cevap:</strong> {b.modelAnswer}
                </div>
                <div style={{
                  fontSize: 11, color: colors.neutral, fontStyle: "italic", lineHeight: 1.4,
                }}>{b.whyBetter}</div>
              </div>
            ))}
          </ReportSection>
        )}

        {/* Sonraki adımlar */}
        {report.nextSteps && report.nextSteps.length > 0 && (
          <ReportSection title="Sonraki adımlar" icon={<TrendingUp size={14} />} tint={colors.navy}>
            {report.nextSteps.slice(0, 5).map((s, i) => (
              <div key={i} style={{
                padding: 10, marginBottom: 4,
                background: colors.navy50, borderRadius: 10,
                fontSize: 13, color: colors.navy, lineHeight: 1.4,
                display: "flex", gap: 8, alignItems: "flex-start",
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
        >Yeni mülakat</button>

        <Toast {...toast} onClose={hideToast} />
      </ModuleShell>
    );
  }

  // ─── LIVE ──────────────────────────────
  if (stage === "live") {
    const progress = targetQuestions > 0 ? (questionsAsked / targetQuestions) * 100 : 0;
    return (
      <ModuleShell
        title={interviewerName || "Mülakatçı"}
        subtitle={setup.targetRole}
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
              disabled={processing || aiSpeaking}
              onStart={startMic}
              onStop={stopMicAndSend}
              size={84}
            />
          </div>
        }
      >
        {/* İlerleme */}
        <div style={{ marginBottom: 16 }}>
          <div style={{
            display: "flex", justifyContent: "space-between",
            fontFamily: fonts.heading, fontSize: 11, fontWeight: 700,
            color: colors.neutral, textTransform: "uppercase", letterSpacing: "0.06em",
            marginBottom: 6,
          }}>
            <span>Soru {questionsAsked} / {targetQuestions}</span>
            <span>%{Math.round(progress)}</span>
          </div>
          <div style={{ height: 4, background: colors.navy50, borderRadius: 100, overflow: "hidden" }}>
            <div style={{
              height: "100%", background: colors.turq,
              width: `${progress}%`, transition: "width 0.3s",
            }} />
          </div>
        </div>

        {/* Transkript */}
        {transcript.map((t, i) => (
          <div key={i} style={{
            display: "flex",
            justifyContent: t.role === "candidate" ? "flex-end" : "flex-start",
            marginBottom: 10,
          }}>
            <div style={{
              maxWidth: "84%",
              padding: "12px 16px", borderRadius: 16,
              background: t.role === "candidate" ? colors.navy : colors.navy50,
              color: t.role === "candidate" ? colors.white : colors.navy,
              fontFamily: fonts.body, fontSize: 14, lineHeight: 1.5,
            }}>
              {t.role === "interviewer" && (
                <div style={{
                  fontFamily: fonts.heading, fontWeight: 700, fontSize: 10,
                  color: colors.turqDeep, textTransform: "uppercase", letterSpacing: "0.06em",
                  marginBottom: 4,
                }}>{interviewerName}</div>
              )}
              {t.content}
            </div>
          </div>
        ))}

        {processing && (
          <LoadingState compact messages={[processingStep]} />
        )}
        {aiSpeaking && !processing && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: 8, marginTop: 8, padding: 8,
          }}>
            <Volume2 size={14} color={colors.turq} strokeWidth={2.5} />
            <span style={{
              fontSize: 11, color: colors.turqDeep,
              fontFamily: fonts.heading, fontWeight: 700,
              textTransform: "uppercase", letterSpacing: "0.06em",
            }}>{interviewerName} konuşuyor</span>
          </div>
        )}

        <div ref={bottomRef} style={{ height: 8 }} />

        <MicPermissionSheet
          visible={micPermSheet}
          onClose={() => setMicPermSheet(false)}
          onRetry={startMic}
        />
        <Toast {...toast} onClose={hideToast} />
      </ModuleShell>
    );
  }

  // ─── SETUP ──────────────────────────────
  return (
    <ModuleShell title="Mülakat Simülatörü" subtitle="Kendi rolünde pratik yap">
      <MobileModuleIntro moduleKey="interview_sim" />

      {/* Devam eden mülakat */}
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
          }}>Devam eden mülakat</div>
          <div style={{
            fontFamily: fonts.heading, fontWeight: 800, fontSize: 14,
            color: "#78350f", marginBottom: 8, letterSpacing: "-0.01em",
          }}>{pendingResume.targetRole}</div>
          <div style={{ fontSize: 12, color: "#92400e", marginBottom: 12 }}>
            {pendingResume.questionsAsked} / {pendingResume.targetQuestions} soru cevaplandı
          </div>
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
              onClick={handleResume}
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
      }}>Mülakat kurulumu</div>
      <div style={{
        fontFamily: fonts.heading, fontWeight: 900, fontSize: 24,
        color: colors.navy, letterSpacing: "-0.02em", lineHeight: 1.15,
        marginBottom: 20,
      }}>
        Hangi{" "}
        <span style={{ position: "relative", display: "inline-block" }}>
          rol için
          <span style={{
            position: "absolute", left: 0, right: 0, bottom: 2,
            height: 10, background: colors.turq, opacity: 0.85,
            transform: "skewY(-1deg)", zIndex: -1,
          }} />
        </span>{" "}
        pratik?
      </div>

      {/* Hedef pozisyon */}
      <Label>Hedef pozisyon</Label>
      <input
        type="text"
        value={setup.targetRole}
        onChange={(e) => setSetup({ ...setup, targetRole: e.target.value })}
        placeholder="Örn: Senior Product Manager"
        style={{
          width: "100%", padding: "12px 14px", borderRadius: 12,
          border: `1px solid ${colors.navy100}`,
          fontFamily: fonts.body, fontSize: 14,
          background: colors.white, color: colors.navy,
          outline: "none", marginBottom: 20,
        }}
      />

      {/* Kıdem */}
      <Label>Kıdem</Label>
      <div style={{ display: "grid", gap: 6, marginBottom: 20 }}>
        {SENIORITY_OPTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSetup({ ...setup, seniority: s.id })}
            style={{
              padding: "10px 14px", borderRadius: 10,
              background: setup.seniority === s.id ? colors.navy : colors.white,
              color: setup.seniority === s.id ? colors.white : colors.navy,
              border: `1px solid ${setup.seniority === s.id ? colors.navy : colors.navy100}`,
              fontFamily: fonts.heading, fontWeight: 700, fontSize: 13,
              cursor: "pointer", textAlign: "left",
            }}
          >{s.label}</button>
        ))}
      </div>

      {/* Sektör */}
      <Label>Sektör</Label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 20 }}>
        {INDUSTRY_OPTIONS.map((ind) => (
          <button
            key={ind}
            onClick={() => setSetup({ ...setup, industry: ind })}
            style={{
              padding: "8px 10px", borderRadius: 8,
              background: setup.industry === ind ? colors.navy : colors.white,
              color: setup.industry === ind ? colors.white : colors.navy,
              border: `1px solid ${setup.industry === ind ? colors.navy : colors.navy100}`,
              fontFamily: fonts.heading, fontWeight: 600, fontSize: 12,
              cursor: "pointer",
            }}
          >{ind}</button>
        ))}
      </div>

      {/* Mülakatçı stili */}
      {coaches.length > 0 && (
        <>
          <Label>Mülakatçı</Label>
          <div style={{ display: "grid", gap: 6, marginBottom: 20 }}>
            {coaches.map((c) => (
              <button
                key={c.id}
                onClick={() => setSetup({ ...setup, interviewerStyle: c.id })}
                style={{
                  padding: 12, borderRadius: 12,
                  background: setup.interviewerStyle === c.id ? colors.navy : colors.white,
                  color: setup.interviewerStyle === c.id ? colors.white : colors.navy,
                  border: `1px solid ${setup.interviewerStyle === c.id ? colors.navy : colors.navy100}`,
                  cursor: "pointer", textAlign: "left",
                }}
              >
                <div style={{
                  fontFamily: fonts.heading, fontWeight: 800, fontSize: 13,
                  marginBottom: 2, letterSpacing: "-0.01em",
                }}>{c.name}</div>
                <div style={{
                  fontSize: 11, opacity: 0.75, lineHeight: 1.4,
                }}>{c.bio}</div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Soru sayısı */}
      <Label>Soru sayısı: <strong>{setup.targetQuestions}</strong></Label>
      <div style={{ display: "flex", gap: 6, marginBottom: 28 }}>
        {[4, 6, 8, 10].map((n) => (
          <button
            key={n}
            onClick={() => setSetup({ ...setup, targetQuestions: n })}
            style={{
              flex: 1, padding: "10px 8px", borderRadius: 10,
              background: setup.targetQuestions === n ? colors.navy : colors.white,
              color: setup.targetQuestions === n ? colors.white : colors.navy,
              border: `1px solid ${setup.targetQuestions === n ? colors.navy : colors.navy100}`,
              fontFamily: fonts.heading, fontWeight: 700, fontSize: 13,
              cursor: "pointer",
            }}
          >{n}</button>
        ))}
      </div>

      <button
        onClick={handleStart}
        disabled={starting || !setup.targetRole.trim()}
        style={{
          width: "100%", padding: "16px 20px", borderRadius: 100,
          background: colors.brand, color: colors.white, border: "none",
          fontFamily: fonts.heading, fontWeight: 800, fontSize: 15,
          cursor: starting ? "not-allowed" : "pointer",
          opacity: starting || !setup.targetRole.trim() ? 0.5 : 1,
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
            <Briefcase size={16} strokeWidth={2.5} />
            Mülakatı başlat
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
      padding: 12, background: colors.white,
      border: `1px solid ${colors.navy50}`, borderRadius: 12,
    }}>
      <div style={{
        fontFamily: fonts.heading, fontWeight: 900, fontSize: 22,
        color, letterSpacing: "-0.02em", lineHeight: 1,
      }}>{score}<span style={{ fontSize: 11, color: colors.neutral, marginLeft: 2 }}>/100</span></div>
      <div style={{
        fontFamily: fonts.heading, fontWeight: 700, fontSize: 10,
        color: colors.neutral, textTransform: "uppercase", letterSpacing: "0.04em",
        marginTop: 4,
      }}>{label}</div>
    </div>
  );
}

function ReportSection({ title, icon, tint, children }: {
  title: string; icon: React.ReactNode; tint: string; children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        fontFamily: fonts.heading, fontWeight: 700, fontSize: 11,
        color: colors.navy, textTransform: "uppercase", letterSpacing: "0.06em",
        marginBottom: 10,
      }}>
        <span style={{ color: tint }}>{icon}</span>
        {title}
      </div>
      {children}
    </div>
  );
}
