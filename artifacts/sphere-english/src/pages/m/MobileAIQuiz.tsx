import { useEffect, useRef, useState } from "react";
import { API } from "@/lib/api-url";
import { useAuth } from "@/hooks/use-auth";
import {
  ModuleShell, LoadingState, Toast, useToast, MobileModuleIntro,
  colors, fonts, radius,
} from "@/components/mobile";
import {
  BookOpen, Type, FileText, Check, X, Trophy,
  Sparkles, ChevronRight, ArrowLeft, ArrowRight,
} from "lucide-react";

/**
 * /m/pratik/akilli-quiz — Mobil Akıllı Quiz
 * setup → generating → taking → submitting → report
 */

const TOKEN_KEY = "sphere_token";
const DRAFT_KEY = "mobile_aiquiz_draft_v1";

type Category = "vocabulary" | "grammar" | "comprehension";
type Level = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

interface AIQuestion {
  id: string;
  type: "multiple_choice" | "true_false" | "fill_blank";
  category: Category;
  prompt: string;
  context?: string;
  options?: string[];
  correctAnswer?: string;
  explanationEn?: string;
  explanationTr?: string;
}

interface AIQuizReport {
  scoreCorrect: number; scoreTotal: number; scorePercent: number;
  passed: boolean; estimatedCefrFit: string; cefrConfidence: string;
  byCategory: Record<string, { correct: number; total: number }>;
  weakAreas: Array<{ area: string; detail: string; suggestion: string }>;
  studyPlan: string[];
  encouragement: string;
}

interface Draft {
  sessionId: number;
  title: string;
  questions: AIQuestion[];
  answers: Record<string, string>;
  startedAt: number;
}

const CEFR_LEVELS: Level[] = ["A1", "A2", "B1", "B2", "C1", "C2"];
const CATEGORY_OPTS = [
  { id: "vocabulary" as const, label: "Kelime", icon: BookOpen },
  { id: "grammar" as const, label: "Dilbilgisi", icon: Type },
  { id: "comprehension" as const, label: "Anlama", icon: FileText },
];
const CAT_LABEL: Record<string, string> = {
  vocabulary: "Kelime", grammar: "Dilbilgisi", comprehension: "Anlama",
};

async function apiFetch(path: string, opts: RequestInit = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(opts.headers || {}),
    },
  });
  return res;
}

function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}
function saveDraft(d: Draft | null) {
  try {
    if (d) localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    else localStorage.removeItem(DRAFT_KEY);
  } catch {}
}

type Stage = "setup" | "generating" | "taking" | "submitting" | "report";

export default function MobileAIQuiz() {
  const { user } = useAuth();
  const userLevel = (user?.currentLevel as Level | undefined) ?? "B1";

  const [stage, setStage] = useState<Stage>("setup");
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState<Level>(userLevel);
  const [numQuestions, setNumQuestions] = useState(8);
  const [categories, setCategories] = useState<Category[]>(["vocabulary", "grammar", "comprehension"]);

  const [sessionId, setSessionId] = useState<number | null>(null);
  const [quizTitle, setQuizTitle] = useState("");
  const [questions, setQuestions] = useState<AIQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentIdx, setCurrentIdx] = useState(0);

  const [report, setReport] = useState<AIQuizReport | null>(null);
  const [reportQuestions, setReportQuestions] = useState<AIQuestion[]>([]);
  const [reportAnswers, setReportAnswers] = useState<Array<{ questionId: string; userAnswer: string; isCorrect: boolean }>>([]);

  const [pendingResume, setPendingResume] = useState<Draft | null>(null);
  const startedAtRef = useRef<number>(Date.now());
  const [elapsedSec, setElapsedSec] = useState(0);
  const tickRef = useRef<number | null>(null);
  const { toast, show: showToast, hide: hideToast } = useToast();

  // İlk yüklemede yarıda kalmış quiz varsa göster
  useEffect(() => {
    const d = loadDraft();
    if (d && d.questions?.length > 0) {
      setPendingResume(d);
    }
  }, []);

  // Timer
  useEffect(() => {
    if (stage === "taking") {
      startedAtRef.current = startedAtRef.current || Date.now();
      tickRef.current = window.setInterval(() => {
        setElapsedSec(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }, 500) as unknown as number;
    } else if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [stage]);

  // Cevap değiştiğinde draft güncelle
  useEffect(() => {
    if (stage === "taking" && sessionId && questions.length > 0) {
      saveDraft({
        sessionId, title: quizTitle,
        questions, answers,
        startedAt: startedAtRef.current,
      });
    }
  }, [answers, stage, sessionId, quizTitle, questions]);

  const toggleCategory = (c: Category) => {
    setCategories((prev) =>
      prev.includes(c)
        ? prev.filter((x) => x !== c)
        : [...prev, c]
    );
  };

  const generateQuiz = async () => {
    if (!topic.trim()) {
      showToast("Bir konu yaz", "warning");
      return;
    }
    if (categories.length === 0) {
      showToast("En az bir kategori seç", "warning");
      return;
    }
    setStage("generating");
    try {
      const res = await apiFetch("/ai-quiz/generate", {
        method: "POST",
        body: JSON.stringify({
          sourceMode: "topic",
          topic: topic.trim(),
          level,
          numQuestions,
          categories,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Quiz oluşturulamadı");
      }
      const data = await res.json();
      setSessionId(data.sessionId);
      setQuizTitle(data.title || topic);
      setQuestions(data.questions);
      setAnswers({});
      setCurrentIdx(0);
      startedAtRef.current = Date.now();
      setElapsedSec(0);
      setStage("taking");
    } catch (e: any) {
      showToast(e?.message || "Bir hata oluştu", "error");
      setStage("setup");
    }
  };

  const resumeQuiz = () => {
    if (!pendingResume) return;
    setSessionId(pendingResume.sessionId);
    setQuizTitle(pendingResume.title);
    setQuestions(pendingResume.questions);
    setAnswers(pendingResume.answers);
    setCurrentIdx(0);
    startedAtRef.current = pendingResume.startedAt;
    setPendingResume(null);
    setStage("taking");
  };

  const discardResume = () => {
    saveDraft(null);
    setPendingResume(null);
  };

  const submitQuiz = async () => {
    if (!sessionId) return;
    setStage("submitting");
    try {
      const res = await apiFetch(`/ai-quiz/${sessionId}/submit`, {
        method: "POST",
        body: JSON.stringify({
          answers: questions.map((q) => ({ questionId: q.id, userAnswer: answers[q.id] || "" })),
          timeTakenSec: elapsedSec,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Quiz gönderilemedi");
      }
      const data = await res.json();
      setReport(data.report);
      setReportQuestions(data.questions || questions);
      setReportAnswers(data.answers || []);
      saveDraft(null);
      setStage("report");
    } catch (e: any) {
      showToast(e?.message || "Bir hata oluştu", "error");
      setStage("taking");
    }
  };

  const resetAll = () => {
    saveDraft(null);
    setSessionId(null); setQuestions([]); setAnswers({});
    setCurrentIdx(0); setReport(null);
    setReportQuestions([]); setReportAnswers([]);
    setElapsedSec(0);
    setStage("setup");
  };

  // ─── Loading Stages ─────────────────────────────────────────────────
  if (stage === "generating") {
    return (
      <ModuleShell title="Akıllı Quiz" subtitle="Oluşturuluyor…">
        <LoadingState
          messages={[
            "Konun analiz ediliyor…",
            "Sorular hazırlanıyor…",
            "Zorluk ayarlanıyor…",
            "Neredeyse hazır…",
          ]}
          hint={`${numQuestions} soru • ${level} seviyesinde • ${categories.length} kategori`}
        />
      </ModuleShell>
    );
  }

  if (stage === "submitting") {
    return (
      <ModuleShell title="Akıllı Quiz" subtitle="Değerlendiriliyor…">
        <LoadingState
          messages={[
            "Cevapların kontrol ediliyor…",
            "Skor hesaplanıyor…",
            "Kişisel raporun hazırlanıyor…",
          ]}
          hint="Bu 5-10 saniye sürebilir"
        />
      </ModuleShell>
    );
  }

  // ─── Rapor ─────────────────────────────────────────────────────────
  if (stage === "report" && report) {
    return (
      <ModuleShell
        title="Quiz Raporu"
        subtitle={quizTitle}
        rightAction={
          <button
            onClick={resetAll}
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
        {/* Ana skor */}
        <div style={{
          background: report.passed ? colors.navy : `linear-gradient(135deg, ${colors.navy}, ${colors.error})`,
          color: colors.white,
          borderRadius: radius.panel, padding: 24, marginBottom: 16, textAlign: "center",
        }}>
          <div style={{
            fontFamily: fonts.heading, fontWeight: 700, fontSize: 11,
            color: colors.turq, textTransform: "uppercase", letterSpacing: "0.06em",
            marginBottom: 8,
          }}>Skor</div>
          <div style={{
            fontFamily: fonts.heading, fontWeight: 900, fontSize: 56,
            letterSpacing: "-0.03em", lineHeight: 1,
            color: report.passed ? colors.turq : colors.white,
          }}>%{report.scorePercent}</div>
          <div style={{ marginTop: 6, fontSize: 13, opacity: 0.9 }}>
            {report.scoreCorrect} / {report.scoreTotal} doğru
            {report.passed && (
              <span style={{
                marginLeft: 8, padding: "2px 8px", fontSize: 10,
                background: colors.turq, color: colors.navy,
                borderRadius: 100, fontWeight: 800,
              }}>Geçtin</span>
            )}
          </div>
        </div>

        {/* Kategori dağılımı */}
        {Object.keys(report.byCategory).length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{
              fontFamily: fonts.heading, fontWeight: 700, fontSize: 11,
              color: colors.navy, textTransform: "uppercase", letterSpacing: "0.06em",
              marginBottom: 10,
            }}>Kategori bazında</div>
            {Object.entries(report.byCategory).map(([cat, s]) => {
              const pct = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
              return (
                <div key={cat} style={{
                  padding: 12, marginBottom: 6,
                  background: colors.white, borderRadius: 12,
                  border: `1px solid ${colors.navy50}`,
                }}>
                  <div style={{
                    display: "flex", justifyContent: "space-between",
                    marginBottom: 6,
                  }}>
                    <span style={{
                      fontFamily: fonts.heading, fontWeight: 700, fontSize: 13, color: colors.navy,
                    }}>{CAT_LABEL[cat] || cat}</span>
                    <span style={{ fontSize: 12, color: colors.neutral }}>
                      {s.correct} / {s.total} · <strong style={{ color: colors.navy }}>%{pct}</strong>
                    </span>
                  </div>
                  <div style={{ height: 4, background: colors.navy50, borderRadius: 100, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", width: `${pct}%`,
                      background: pct >= 70 ? colors.turq : pct >= 50 ? colors.warn : colors.error,
                      borderRadius: 100, transition: "width 0.3s",
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Zayıf alanlar */}
        {report.weakAreas && report.weakAreas.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{
              fontFamily: fonts.heading, fontWeight: 700, fontSize: 11,
              color: colors.navy, textTransform: "uppercase", letterSpacing: "0.06em",
              marginBottom: 10,
            }}>Odaklanman gereken alanlar</div>
            {report.weakAreas.slice(0, 3).map((w, i) => (
              <div key={i} style={{
                padding: 12, marginBottom: 8,
                background: colors.white, borderRadius: 12,
                border: `1px solid ${colors.navy50}`,
              }}>
                <div style={{ fontFamily: fonts.heading, fontWeight: 700, fontSize: 13, color: colors.navy, marginBottom: 4 }}>
                  {w.area}
                </div>
                <div style={{ fontSize: 12, color: colors.neutral, lineHeight: 1.4, marginBottom: 6 }}>{w.detail}</div>
                <div style={{
                  fontSize: 12, color: colors.turqDeep, fontWeight: 600,
                  padding: "6px 10px", background: colors.turqDeep + "10",
                  borderRadius: 8, lineHeight: 1.4,
                }}>💡 {w.suggestion}</div>
              </div>
            ))}
          </div>
        )}

        {/* Çalışma önerileri */}
        {report.studyPlan && report.studyPlan.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{
              fontFamily: fonts.heading, fontWeight: 700, fontSize: 11,
              color: colors.navy, textTransform: "uppercase", letterSpacing: "0.06em",
              marginBottom: 10,
            }}>Sıradaki adımlar</div>
            {report.studyPlan.slice(0, 4).map((s, i) => (
              <div key={i} style={{
                padding: 10, marginBottom: 6,
                background: colors.navy50, borderRadius: 12,
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
          </div>
        )}

        {/* Cevapları göz at */}
        <details style={{ marginBottom: 20 }}>
          <summary style={{
            cursor: "pointer",
            fontFamily: fonts.heading, fontWeight: 700, fontSize: 13,
            color: colors.navy, padding: "12px 0",
            borderTop: `1px solid ${colors.navy50}`,
            borderBottom: `1px solid ${colors.navy50}`,
          }}>
            Tüm cevaplarımı göster ({reportAnswers.length})
          </summary>
          <div style={{ marginTop: 12 }}>
            {reportQuestions.map((q, i) => {
              const a = reportAnswers.find((x) => x.questionId === q.id);
              const isCorrect = a?.isCorrect;
              return (
                <div key={q.id} style={{
                  padding: 12, marginBottom: 8,
                  background: colors.white, borderRadius: 12,
                  border: `1px solid ${isCorrect ? colors.turq + "55" : colors.error + "55"}`,
                }}>
                  <div style={{
                    display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 6,
                  }}>
                    <span style={{
                      background: isCorrect ? colors.turq : colors.error,
                      color: colors.white, minWidth: 20, height: 20, borderRadius: 10,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 10, fontWeight: 800, flexShrink: 0,
                    }}>{i + 1}</span>
                    <div style={{ flex: 1, fontSize: 13, color: colors.navy, lineHeight: 1.4 }}>{q.prompt}</div>
                  </div>
                  <div style={{ marginLeft: 28, fontSize: 12, lineHeight: 1.5 }}>
                    <div style={{ color: isCorrect ? colors.turqDeep : colors.error }}>
                      <strong>Cevabın:</strong> {a?.userAnswer || <em>(boş)</em>}
                    </div>
                    {!isCorrect && (
                      <div style={{ color: colors.navy, marginTop: 2 }}>
                        <strong>Doğru:</strong> {q.correctAnswer}
                      </div>
                    )}
                    {q.explanationTr && (
                      <div style={{ marginTop: 6, color: colors.neutral, fontStyle: "italic" }}>
                        {q.explanationTr}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </details>

        {report.encouragement && (
          <div style={{
            padding: 16, background: colors.turq + "18",
            borderRadius: 12, marginBottom: 20,
            fontSize: 13, color: colors.navy, lineHeight: 1.5,
            fontStyle: "italic",
          }}>{report.encouragement}</div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={resetAll}
            style={{
              flex: 1, padding: "14px 20px", borderRadius: 100,
              background: colors.navy50, color: colors.navy, border: "none",
              fontFamily: fonts.heading, fontWeight: 700, fontSize: 14,
              cursor: "pointer",
            }}
          >Yeni quiz</button>
        </div>
        <Toast {...toast} onClose={hideToast} />
      </ModuleShell>
    );
  }

  // ─── Taking (Quiz sırasında) ─────────────────────────────────────
  if (stage === "taking") {
    const q = questions[currentIdx];
    if (!q) return null;
    const answered = !!answers[q.id];
    const answeredCount = Object.keys(answers).filter((k) => !!answers[k]).length;
    const isLast = currentIdx === questions.length - 1;
    const mm = Math.floor(elapsedSec / 60);
    const ss = elapsedSec % 60;

    const setAnswer = (val: string) => {
      setAnswers((prev) => ({ ...prev, [q.id]: val }));
    };

    return (
      <ModuleShell
        title={quizTitle}
        subtitle={`Soru ${currentIdx + 1} / ${questions.length} · ${mm}:${ss.toString().padStart(2, "0")}`}
        rightAction={
          <div style={{
            fontFamily: fonts.heading, fontWeight: 800, fontSize: 12,
            color: colors.navy, padding: "4px 10px",
            background: colors.navy50, borderRadius: 100,
          }}>
            {answeredCount}/{questions.length}
          </div>
        }
        footer={
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
              disabled={currentIdx === 0}
              style={{
                padding: "14px 16px", borderRadius: 100,
                background: colors.navy50, color: colors.navy, border: "none",
                fontFamily: fonts.heading, fontWeight: 700, fontSize: 13,
                cursor: currentIdx === 0 ? "not-allowed" : "pointer",
                opacity: currentIdx === 0 ? 0.5 : 1,
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              <ArrowLeft size={14} strokeWidth={2.5} />
              Önceki
            </button>
            {isLast ? (
              <button
                onClick={submitQuiz}
                disabled={answeredCount === 0}
                style={{
                  flex: 1, padding: "14px 20px", borderRadius: 100,
                  background: colors.turq, color: colors.navy, border: "none",
                  fontFamily: fonts.heading, fontWeight: 800, fontSize: 14,
                  cursor: "pointer",
                  opacity: answeredCount === 0 ? 0.5 : 1,
                }}
              >Bitir ve gönder →</button>
            ) : (
              <button
                onClick={() => setCurrentIdx((i) => Math.min(questions.length - 1, i + 1))}
                style={{
                  flex: 1, padding: "14px 20px", borderRadius: 100,
                  background: colors.brand, color: colors.white, border: "none",
                  fontFamily: fonts.heading, fontWeight: 800, fontSize: 14,
                  cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                }}
              >
                Sonraki
                <ArrowRight size={14} strokeWidth={2.5} />
              </button>
            )}
          </div>
        }
      >
        {/* İlerleme çubuğu */}
        <div style={{
          height: 4, background: colors.navy50, borderRadius: 100,
          marginBottom: 20, overflow: "hidden",
        }}>
          <div style={{
            height: "100%", background: colors.turq,
            width: `${((currentIdx + 1) / questions.length) * 100}%`,
            transition: "width 0.3s",
          }} />
        </div>

        {/* Kategori etiketi */}
        <div style={{
          display: "inline-block",
          padding: "4px 10px", borderRadius: 100,
          background: colors.navy50,
          fontFamily: fonts.heading, fontWeight: 700, fontSize: 10,
          color: colors.navy, textTransform: "uppercase", letterSpacing: "0.06em",
          marginBottom: 14,
        }}>{CAT_LABEL[q.category] || q.category}</div>

        {/* Context (varsa) */}
        {q.context && (
          <div style={{
            padding: 14, background: colors.navy50, borderRadius: 12,
            marginBottom: 16, fontSize: 13, color: colors.navy400,
            lineHeight: 1.5, fontStyle: "italic",
          }}>{q.context}</div>
        )}

        {/* Soru */}
        <div style={{
          fontFamily: fonts.heading, fontWeight: 700, fontSize: 18,
          color: colors.navy, letterSpacing: "-0.01em", lineHeight: 1.35,
          marginBottom: 20,
        }}>{q.prompt}</div>

        {/* Cevap alanı */}
        {q.type === "multiple_choice" && q.options && (
          <div style={{ display: "grid", gap: 8 }}>
            {q.options.map((opt, i) => {
              const selected = answers[q.id] === opt;
              return (
                <button
                  key={i}
                  onClick={() => setAnswer(opt)}
                  style={{
                    padding: "14px 16px", borderRadius: 12,
                    background: selected ? colors.navy : colors.white,
                    color: selected ? colors.white : colors.navy,
                    border: `2px solid ${selected ? colors.navy : colors.navy100}`,
                    fontFamily: fonts.body, fontSize: 14, lineHeight: 1.4,
                    textAlign: "left", cursor: "pointer",
                    display: "flex", alignItems: "flex-start", gap: 10,
                  }}
                >
                  <span style={{
                    width: 22, height: 22, borderRadius: 11,
                    background: selected ? colors.turq : colors.navy50,
                    color: selected ? colors.navy : colors.navy,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 800, flexShrink: 0,
                    fontFamily: fonts.heading,
                  }}>{String.fromCharCode(65 + i)}</span>
                  <span style={{ flex: 1 }}>{opt}</span>
                  {selected && <Check size={16} strokeWidth={3} style={{ marginTop: 3 }} />}
                </button>
              );
            })}
          </div>
        )}

        {q.type === "true_false" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {["True", "False"].map((opt) => {
              const selected = answers[q.id] === opt;
              return (
                <button
                  key={opt}
                  onClick={() => setAnswer(opt)}
                  style={{
                    padding: "20px 16px", borderRadius: 12,
                    background: selected ? colors.navy : colors.white,
                    color: selected ? colors.white : colors.navy,
                    border: `2px solid ${selected ? colors.navy : colors.navy100}`,
                    fontFamily: fonts.heading, fontWeight: 700, fontSize: 15,
                    cursor: "pointer",
                  }}
                >
                  {opt === "True" ? "Doğru" : "Yanlış"}
                </button>
              );
            })}
          </div>
        )}

        {q.type === "fill_blank" && (
          <input
            type="text"
            value={answers[q.id] || ""}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Cevabını yaz…"
            style={{
              width: "100%", padding: "14px 16px", borderRadius: 12,
              border: `2px solid ${answers[q.id] ? colors.navy : colors.navy100}`,
              fontFamily: fonts.body, fontSize: 15,
              background: colors.white, color: colors.navy,
              outline: "none",
            }}
          />
        )}

        <div style={{ height: 16 }} />

        {/* Soru gezinimi (dot) */}
        <div style={{
          display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8,
        }}>
          {questions.map((qq, i) => {
            const isCurrent = i === currentIdx;
            const isAnswered = !!answers[qq.id];
            return (
              <button
                key={qq.id}
                onClick={() => setCurrentIdx(i)}
                style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: isCurrent ? colors.navy : isAnswered ? colors.turq : colors.navy50,
                  color: isCurrent ? colors.white : isAnswered ? colors.navy : colors.neutral,
                  border: "none", cursor: "pointer",
                  fontFamily: fonts.heading, fontWeight: 800, fontSize: 11,
                }}
              >{i + 1}</button>
            );
          })}
        </div>

        <Toast {...toast} onClose={hideToast} />
      </ModuleShell>
    );
  }

  // ─── Setup (default) ────────────────────────────────────────────────
  return (
    <ModuleShell
      title="Akıllı Quiz"
      subtitle="AI ile kişisel quiz oluştur"
      rightAction={
        <div style={{ width: 40, height: 40 }} />
      }
    >
      <MobileModuleIntro moduleKey="ai_quiz" />
      {/* Kaldığın yerden devam kartı */}
      {pendingResume && (
        <div style={{
          padding: 14, marginBottom: 20,
          background: colors.navy50, borderRadius: 12,
          border: `1px solid ${colors.turq}`,
        }}>
          <div style={{
            fontFamily: fonts.heading, fontWeight: 700, fontSize: 11,
            color: colors.turqDeep, textTransform: "uppercase", letterSpacing: "0.06em",
            marginBottom: 4,
          }}>Devam eden quiz</div>
          <div style={{
            fontFamily: fonts.heading, fontWeight: 800, fontSize: 14,
            color: colors.navy, marginBottom: 8, letterSpacing: "-0.01em",
          }}>{pendingResume.title}</div>
          <div style={{ fontSize: 12, color: colors.neutral, marginBottom: 12 }}>
            {Object.keys(pendingResume.answers).length} / {pendingResume.questions.length} soru cevaplandı
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={discardResume}
              style={{
                padding: "8px 14px", borderRadius: 100,
                background: colors.white, color: colors.navy,
                border: `1px solid ${colors.navy100}`,
                fontFamily: fonts.heading, fontWeight: 700, fontSize: 12,
                cursor: "pointer",
              }}
            >Sil</button>
            <button
              onClick={resumeQuiz}
              style={{
                flex: 1, padding: "8px 14px", borderRadius: 100,
                background: colors.brand, color: colors.white, border: "none",
                fontFamily: fonts.heading, fontWeight: 800, fontSize: 12,
                cursor: "pointer",
              }}
            >Devam et →</button>
          </div>
        </div>
      )}

      <div style={{
        fontFamily: fonts.heading, fontWeight: 700, fontSize: 11,
        color: colors.turqDeep, textTransform: "uppercase", letterSpacing: "0.06em",
        marginBottom: 6,
      }}>Yeni quiz</div>
      <div style={{
        fontFamily: fonts.heading, fontWeight: 900, fontSize: 26,
        color: colors.navy, letterSpacing: "-0.02em", lineHeight: 1.15,
        marginBottom: 20,
      }}>
        Bugün ne{" "}
        <span style={{ position: "relative", display: "inline-block" }}>
          çalışalım
          <span style={{
            position: "absolute", left: 0, right: 0, bottom: 2,
            height: 10, background: colors.turq, opacity: 0.85,
            transform: "skewY(-1deg)", zIndex: -1,
          }} />
        </span>?
      </div>

      {/* Konu */}
      <Label>Konu</Label>
      <input
        type="text"
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        placeholder="Örn: iş görüşmelerinde used to..."
        style={{
          width: "100%", padding: "14px 16px", borderRadius: 12,
          border: `1px solid ${colors.navy100}`,
          fontFamily: fonts.body, fontSize: 15,
          background: colors.white, color: colors.navy,
          outline: "none", marginBottom: 20,
        }}
      />

      {/* Seviye */}
      <Label>Seviye</Label>
      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        {CEFR_LEVELS.map((l) => (
          <button
            key={l}
            onClick={() => setLevel(l)}
            style={{
              padding: "8px 14px", borderRadius: 100,
              background: level === l ? colors.navy : colors.white,
              color: level === l ? colors.white : colors.navy,
              border: `1px solid ${level === l ? colors.navy : colors.navy100}`,
              fontFamily: fonts.heading, fontWeight: 700, fontSize: 12,
              cursor: "pointer",
            }}
          >{l}</button>
        ))}
      </div>

      {/* Kategori */}
      <Label>Kategori</Label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 20 }}>
        {CATEGORY_OPTS.map(({ id, label, icon: Icon }) => {
          const selected = categories.includes(id);
          return (
            <button
              key={id}
              onClick={() => toggleCategory(id)}
              style={{
                padding: "12px 8px", borderRadius: 12,
                background: selected ? colors.navy : colors.white,
                color: selected ? colors.white : colors.navy,
                border: `1px solid ${selected ? colors.navy : colors.navy100}`,
                fontFamily: fonts.heading, fontWeight: 700, fontSize: 12,
                cursor: "pointer",
                display: "flex", flexDirection: "column",
                alignItems: "center", gap: 6,
              }}
            >
              <Icon size={18} strokeWidth={2} />
              {label}
            </button>
          );
        })}
      </div>

      {/* Soru sayısı */}
      <Label>Soru sayısı: <strong style={{ color: colors.navy }}>{numQuestions}</strong></Label>
      <div style={{ display: "flex", gap: 6, marginBottom: 28 }}>
        {[5, 8, 10, 15, 20].map((n) => (
          <button
            key={n}
            onClick={() => setNumQuestions(n)}
            style={{
              flex: 1, padding: "10px 8px", borderRadius: 10,
              background: numQuestions === n ? colors.navy : colors.white,
              color: numQuestions === n ? colors.white : colors.navy,
              border: `1px solid ${numQuestions === n ? colors.navy : colors.navy100}`,
              fontFamily: fonts.heading, fontWeight: 700, fontSize: 13,
              cursor: "pointer",
            }}
          >{n}</button>
        ))}
      </div>

      <button
        onClick={generateQuiz}
        style={{
          width: "100%", padding: "16px 20px", borderRadius: 100,
          background: colors.brand, color: colors.white, border: "none",
          fontFamily: fonts.heading, fontWeight: 800, fontSize: 15,
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          letterSpacing: "-0.01em",
        }}
      >
        <Sparkles size={18} strokeWidth={2.5} />
        Quiz'i Oluştur
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
