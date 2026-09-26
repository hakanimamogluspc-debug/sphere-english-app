import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { API } from "@/lib/api-url";
import {
  ModuleShell, LoadingState, ErrorState,
  MicButton, MicPermissionSheet, useMicRecorder,
  Toast, useToast,
  colors, fonts, radius,
} from "@/components/mobile";
import {
  Volume2, Play, ChevronRight, Sparkles, Award, StopCircle,
  RotateCcw, ArrowLeft,
} from "lucide-react";

/**
 * /m/pratik/konusma-sahneleri/:slug — Sahne çalıştırıcı
 */

const TOKEN_KEY = "sphere_token";
const MIN_RECORD_MS = 1500;

interface UserTurn { turnId: number; turnOrder: number; text: string; textTr?: string; notesTr?: string; phoneticHint?: string; }
interface AiTurn   { turnId: number; turnOrder: number; text: string; textTr?: string; audioBase64: string | null; }
interface Scores   { accuracy: number; fluency: number; pronunciation: number; completeness: number; overall: number; }
interface WordAnalysisItem { target: string | null; said: string | null; match: "exact" | "close" | "missing" | "extra"; gptScore?: number; gptIssue?: string | null; }
interface Feedback { issues: string[]; positives: string[]; }
interface CompleteResult {
  status: "completed" | "abandoned";
  totalScore: number;
  scores?: Omit<Scores, "overall">;
  turnCount?: number;
  durationSeconds?: number;
  weakAreas?: string[];
  aiSummary?: string;
}

interface SceneMeta {
  title_tr: string; title_en: string;
  user_role_tr: string | null; counterpart_role_tr: string | null;
}

export default function MobileSpeakingSceneRunner() {
  const [, params] = useRoute("/m/pratik/konusma-sahneleri/:slug");
  const [, navigate] = useLocation();
  const slug = params?.slug as string;

  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [sceneMeta, setSceneMeta] = useState<SceneMeta | null>(null);
  const [currentAi, setCurrentAi] = useState<AiTurn | null>(null);
  const [currentUser, setCurrentUser] = useState<UserTurn | null>(null);

  const [initLoading, setInitLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [micPermSheet, setMicPermSheet] = useState(false);

  const [lastScores, setLastScores] = useState<Scores | null>(null);
  const [lastWordAnalysis, setLastWordAnalysis] = useState<WordAnalysisItem[]>([]);
  const [lastTranscript, setLastTranscript] = useState("");
  const [lastTarget, setLastTarget] = useState("");
  const [lastFeedback, setLastFeedback] = useState<Feedback | null>(null);
  const [showScoreCard, setShowScoreCard] = useState(false);

  const [completing, setCompleting] = useState(false);
  const [completeResult, setCompleteResult] = useState<CompleteResult | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rec = useMicRecorder();
  const { toast, show: showToast, hide: hideToast } = useToast();

  useEffect(() => { boot(); return () => { audioRef.current?.pause(); }; }, [slug]);

  const boot = async () => {
    setInitLoading(true); setError(null);
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const metaR = await fetch(`${API}/scenes/${slug}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!metaR.ok) throw new Error("Sahne yüklenemedi");
      const metaD = await metaR.json();
      setSceneMeta(metaD.scene);

      const startR = await fetch(`${API}/scenes/${slug}/start`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` },
      });
      const startD = await startR.json();
      if (!startR.ok) throw new Error(startD?.error || "Sahne başlatılamadı");

      setAttemptId(startD.attemptId);
      setCurrentAi(startD.aiTurn);
      setCurrentUser(startD.nextUserTurn);
      if (startD.aiTurn?.audioBase64) playAudio(startD.aiTurn.audioBase64);
    } catch (e: any) {
      setError(e?.message || "Beklenmedik hata");
    } finally {
      setInitLoading(false);
    }
  };

  const playAudio = useCallback((b64: string) => {
    try {
      audioRef.current?.pause();
      const audio = new Audio(`data:audio/mp3;base64,${b64}`);
      audioRef.current = audio;
      setAiSpeaking(true);
      audio.onended = () => setAiSpeaking(false);
      audio.onerror = () => setAiSpeaking(false);
      audio.play().catch(() => setAiSpeaking(false));
    } catch { setAiSpeaking(false); }
  }, []);

  const replayAi = () => currentAi?.audioBase64 && playAudio(currentAi.audioBase64);

  const startMic = async () => {
    setShowScoreCard(false);
    try { await rec.start(); }
    catch (e: any) {
      if (rec.error?.code === "permission-denied" || e?.name === "NotAllowedError") setMicPermSheet(true);
      else showToast(rec.error?.message || "Mikrofon başlatılamadı", "error");
    }
  };

  const stopMicAndSend = async () => {
    if (rec.duration * 1000 < MIN_RECORD_MS) {
      rec.cancel();
      showToast("Biraz daha uzun konuş", "warning");
      return;
    }
    const blob = await rec.stop();
    if (!blob) return;
    await submitRecording(blob);
  };

  const submitRecording = async (blob: Blob) => {
    if (!attemptId || !currentUser) return;
    setAnalyzing(true);
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const fd = new FormData();
      const ext = blob.type.includes("mp4") ? "mp4" : "webm";
      fd.append("audio", blob, `recording.${ext}`);
      fd.append("turnId", String(currentUser.turnId));
      const r = await fetch(`${API}/scenes/attempts/${attemptId}/speak`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd,
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || "Ses analiz edilemedi");
      setLastScores(d.scores);
      setLastWordAnalysis(d.wordAnalysis || []);
      setLastTranscript(d.transcript);
      setLastTarget(d.target);
      setLastFeedback(d.feedback || null);
      setShowScoreCard(true);
      setCurrentAi(d.aiTurn);
      setCurrentUser(d.nextUserTurn);
      if (d.aiTurn?.audioBase64) {
        setTimeout(() => playAudio(d.aiTurn.audioBase64), 800);
      }
    } catch (e: any) {
      showToast(e?.message || "Kayıt gönderilemedi", "error");
    } finally {
      setAnalyzing(false);
    }
  };

  const completeScene = async () => {
    if (!attemptId || completing) return;
    setCompleting(true);
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const r = await fetch(`${API}/scenes/attempts/${attemptId}/complete`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || "Sahne kapatılamadı");
      setCompleteResult(d);
    } catch (e: any) {
      showToast(e?.message || "Kapatma hatası", "error");
    } finally {
      setCompleting(false);
    }
  };

  if (initLoading) {
    return (
      <ModuleShell title="Sahne Yükleniyor" subtitle="Hazırlanıyor…">
        <LoadingState messages={["Sahne hazırlanıyor…", "İlk soru geliyor…"]} />
      </ModuleShell>
    );
  }

  if (error) {
    return (
      <ModuleShell title="Sahne">
        <ErrorState title="Yüklenemedi" message={error} onRetry={boot} />
      </ModuleShell>
    );
  }

  // ─── Tamamlandı ekranı ────────────────
  if (completeResult) {
    const s = completeResult;
    return (
      <ModuleShell
        title="Sahne Bitti"
        subtitle={sceneMeta?.title_tr}
        rightAction={
          <button
            onClick={() => navigate("/m/pratik/konusma-sahneleri")}
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
          padding: 24, textAlign: "center",
          background: colors.brand, borderRadius: radius.panel,
          color: colors.white, marginBottom: 16,
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: 36,
            background: colors.turq, color: colors.navy,
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px",
          }}>
            <Award size={34} strokeWidth={2} />
          </div>
          <div style={{
            fontFamily: fonts.heading, fontWeight: 700, fontSize: 10,
            color: colors.turq, textTransform: "uppercase", letterSpacing: "0.06em",
            marginBottom: 8,
          }}>Toplam skor</div>
          <div style={{
            fontFamily: fonts.heading, fontWeight: 900, fontSize: 52,
            color: s.totalScore >= 80 ? colors.turq : colors.white,
            letterSpacing: "-0.03em", lineHeight: 1,
          }}>{s.totalScore}<span style={{ fontSize: 20, color: colors.turq }}>/100</span></div>
        </div>

        {s.scores && (
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6,
            marginBottom: 16,
          }}>
            <MiniScore label="Doğruluk" score={s.scores.accuracy} />
            <MiniScore label="Akıcılık" score={s.scores.fluency} />
            <MiniScore label="Telaffuz" score={s.scores.pronunciation} />
            <MiniScore label="Tamlık" score={s.scores.completeness} />
          </div>
        )}

        {s.aiSummary && (
          <div style={{
            padding: 14, background: colors.navy50, borderRadius: 12,
            marginBottom: 16, borderLeft: `4px solid ${colors.turq}`,
          }}>
            <div style={{
              fontFamily: fonts.heading, fontWeight: 800, fontSize: 10,
              color: colors.turqDeep, textTransform: "uppercase", letterSpacing: "0.06em",
              marginBottom: 6,
            }}>Genel değerlendirme</div>
            <div style={{ fontSize: 13, color: colors.navy, lineHeight: 1.5 }}>{s.aiSummary}</div>
          </div>
        )}

        {s.weakAreas && s.weakAreas.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{
              fontFamily: fonts.heading, fontWeight: 700, fontSize: 11,
              color: colors.neutral, textTransform: "uppercase", letterSpacing: "0.06em",
              marginBottom: 8,
            }}>Odaklan</div>
            {s.weakAreas.slice(0, 3).map((w, i) => (
              <div key={i} style={{
                padding: 10, marginBottom: 6,
                background: "#fef3c7", borderRadius: 10,
                fontSize: 13, color: "#92400e", lineHeight: 1.4,
              }}>💡 {w}</div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => navigate("/m/pratik/konusma-sahneleri")}
            style={{
              flex: 1, padding: "14px 16px", borderRadius: 100,
              background: colors.navy50, color: colors.navy, border: "none",
              fontFamily: fonts.heading, fontWeight: 700, fontSize: 13,
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            <ArrowLeft size={12} strokeWidth={2.5} />
            Sahnelere dön
          </button>
          <button
            onClick={boot}
            style={{
              flex: 1, padding: "14px 16px", borderRadius: 100,
              background: colors.brand, color: colors.white, border: "none",
              fontFamily: fonts.heading, fontWeight: 800, fontSize: 13,
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            <RotateCcw size={12} strokeWidth={2.5} />
            Tekrar dene
          </button>
        </div>

        <Toast {...toast} onClose={hideToast} />
      </ModuleShell>
    );
  }

  // ─── Runner ────────────────────────
  const canComplete = !currentUser && !!currentAi; // Sahnenin sonundayız
  return (
    <ModuleShell
      title={sceneMeta?.title_tr || "Sahne"}
      subtitle={sceneMeta?.user_role_tr ? `Rol: ${sceneMeta.user_role_tr}` : undefined}
      backTo="/m/pratik/konusma-sahneleri"
      rightAction={
        canComplete && (
          <button
            onClick={completeScene}
            disabled={completing}
            style={{
              background: colors.turq, border: "none",
              padding: "6px 10px", borderRadius: 100,
              display: "flex", alignItems: "center", gap: 4,
              fontSize: 11, color: colors.navy, cursor: "pointer",
              fontFamily: fonts.heading, fontWeight: 800,
              textTransform: "uppercase", letterSpacing: "0.04em",
              opacity: completing ? 0.5 : 1,
            }}
          >
            <StopCircle size={12} strokeWidth={2.5} />
            Bitir
          </button>
        )
      }
      footer={
        currentUser ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "8px 0" }}>
            <MicButton
              recording={rec.recording}
              level={rec.level}
              duration={rec.duration}
              disabled={analyzing || aiSpeaking}
              onStart={startMic}
              onStop={stopMicAndSend}
              size={84}
            />
          </div>
        ) : (
          <button
            onClick={completeScene}
            disabled={completing}
            style={{
              width: "100%", padding: "14px 20px", borderRadius: 100,
              background: colors.brand, color: colors.white, border: "none",
              fontFamily: fonts.heading, fontWeight: 800, fontSize: 14,
              cursor: completing ? "not-allowed" : "pointer",
              opacity: completing ? 0.5 : 1,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            {completing ? <><Sparkles size={14} strokeWidth={2.5} /> Değerlendiriliyor…</> : <><Award size={14} strokeWidth={2.5} /> Sahneyi bitir & rapor al</>}
          </button>
        )
      }
    >
      {/* AI mesajı */}
      {currentAi && (
        <div style={{ marginBottom: 14 }}>
          <div style={{
            padding: "12px 16px", borderRadius: 16,
            background: colors.navy50, color: colors.navy,
            fontFamily: fonts.body, fontSize: 14, lineHeight: 1.5,
          }}>
            <div style={{
              fontFamily: fonts.heading, fontWeight: 700, fontSize: 10,
              color: colors.turqDeep, textTransform: "uppercase", letterSpacing: "0.06em",
              marginBottom: 4,
            }}>{sceneMeta?.counterpart_role_tr || "Karşındaki"}</div>
            {currentAi.text}
            {currentAi.textTr && (
              <div style={{
                marginTop: 8, paddingTop: 8,
                borderTop: `1px solid ${colors.navy100}`,
                fontSize: 12, color: colors.neutral, fontStyle: "italic",
              }}>{currentAi.textTr}</div>
            )}
          </div>
          {currentAi.audioBase64 && (
            <button
              onClick={replayAi}
              style={{
                marginTop: 6,
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "4px 10px", borderRadius: 100,
                background: colors.white, border: `1px solid ${colors.navy100}`,
                fontFamily: fonts.heading, fontWeight: 700, fontSize: 11,
                color: colors.navy400, cursor: "pointer",
              }}
            >
              <Play size={11} strokeWidth={2.5} />
              Tekrar dinle
            </button>
          )}
        </div>
      )}

      {/* Kullanıcı hedefi */}
      {currentUser && !showScoreCard && (
        <div style={{
          padding: 14, marginBottom: 16,
          background: colors.turq + "12",
          border: `1px solid ${colors.turq}55`,
          borderRadius: radius.card,
        }}>
          <div style={{
            fontFamily: fonts.heading, fontWeight: 800, fontSize: 10,
            color: colors.turqDeep, textTransform: "uppercase", letterSpacing: "0.06em",
            marginBottom: 6,
          }}>Şimdi sen söyle</div>
          <div style={{
            fontFamily: fonts.heading, fontWeight: 700, fontSize: 16,
            color: colors.navy, lineHeight: 1.4, letterSpacing: "-0.01em",
            marginBottom: 6,
          }}>{currentUser.text}</div>
          {currentUser.textTr && (
            <div style={{
              fontSize: 12, color: colors.neutral, fontStyle: "italic",
              marginBottom: 6,
            }}>{currentUser.textTr}</div>
          )}
          {currentUser.notesTr && (
            <div style={{
              fontSize: 11, color: colors.turqDeep,
              padding: "6px 10px", background: colors.white,
              borderRadius: 6, marginTop: 6, lineHeight: 1.4,
            }}>💡 {currentUser.notesTr}</div>
          )}
          {currentUser.phoneticHint && (
            <div style={{
              fontSize: 11, color: colors.neutral,
              fontFamily: "monospace", marginTop: 6,
            }}>{currentUser.phoneticHint}</div>
          )}
        </div>
      )}

      {/* Skor kartı */}
      {showScoreCard && lastScores && (
        <div style={{ marginBottom: 16 }}>
          <div style={{
            padding: 14, background: colors.brand, color: colors.white,
            borderRadius: radius.card, marginBottom: 8,
          }}>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              marginBottom: 10,
            }}>
              <div style={{
                fontFamily: fonts.heading, fontWeight: 700, fontSize: 10,
                color: colors.turq, textTransform: "uppercase", letterSpacing: "0.06em",
              }}>Bu tur skoru</div>
              <div style={{
                fontFamily: fonts.heading, fontWeight: 900, fontSize: 22,
                color: lastScores.overall >= 80 ? colors.turq : colors.white,
                letterSpacing: "-0.02em",
              }}>{lastScores.overall}<span style={{ fontSize: 12, color: colors.turq }}>/100</span></div>
            </div>
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6,
              fontSize: 11,
            }}>
              <ScoreCell label="Doğr" v={lastScores.accuracy} />
              <ScoreCell label="Akıcı" v={lastScores.fluency} />
              <ScoreCell label="Telf" v={lastScores.pronunciation} />
              <ScoreCell label="Tam" v={lastScores.completeness} />
            </div>
          </div>

          {lastTranscript && (
            <div style={{
              padding: 10, background: colors.navy50, borderRadius: 10,
              fontSize: 12, color: colors.navy, marginBottom: 6, lineHeight: 1.5,
            }}>
              <strong>Söylediğin:</strong> "{lastTranscript}"
            </div>
          )}
          {lastFeedback && (lastFeedback.issues?.length > 0 || lastFeedback.positives?.length > 0) && (
            <div style={{ display: "grid", gap: 6 }}>
              {lastFeedback.positives?.map((p, i) => (
                <div key={`p-${i}`} style={{
                  padding: 8, borderRadius: 8,
                  background: "#dcfce7", color: "#166534",
                  fontSize: 11, lineHeight: 1.4,
                }}>✓ {p}</div>
              ))}
              {lastFeedback.issues?.map((iss, i) => (
                <div key={`i-${i}`} style={{
                  padding: 8, borderRadius: 8,
                  background: "#fef3c7", color: "#92400e",
                  fontSize: 11, lineHeight: 1.4,
                }}>💡 {iss}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {analyzing && <LoadingState compact messages={["Sesin analiz ediliyor…"]} />}
      {aiSpeaking && !analyzing && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: 8, padding: 8,
        }}>
          <Volume2 size={14} color={colors.turq} strokeWidth={2.5} />
          <span style={{
            fontSize: 11, color: colors.turqDeep,
            fontFamily: fonts.heading, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: "0.06em",
          }}>Konuşuyor</span>
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

function MiniScore({ label, score }: { label: string; score: number }) {
  const c = score >= 80 ? "#22c55e" : score >= 60 ? colors.turq : score >= 40 ? colors.warn : colors.error;
  return (
    <div style={{
      padding: 12, background: colors.white,
      border: `1px solid ${colors.navy50}`, borderRadius: 12,
      textAlign: "center",
    }}>
      <div style={{
        fontFamily: fonts.heading, fontWeight: 900, fontSize: 22,
        color: c, letterSpacing: "-0.01em", lineHeight: 1,
      }}>{score}</div>
      <div style={{
        fontFamily: fonts.heading, fontWeight: 700, fontSize: 10,
        color: colors.neutral, textTransform: "uppercase", letterSpacing: "0.04em",
        marginTop: 4,
      }}>{label}</div>
    </div>
  );
}

function ScoreCell({ label, v }: { label: string; v: number }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.14)", padding: "6px 4px",
      borderRadius: 8, textAlign: "center",
    }}>
      <div style={{
        fontFamily: fonts.heading, fontWeight: 800, fontSize: 13,
        color: colors.white, lineHeight: 1,
      }}>{v}</div>
      <div style={{
        fontSize: 8, color: colors.turq, marginTop: 2,
        fontFamily: fonts.heading, fontWeight: 700,
        textTransform: "uppercase", letterSpacing: "0.04em",
      }}>{label}</div>
    </div>
  );
}
