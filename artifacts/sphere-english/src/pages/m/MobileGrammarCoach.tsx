import { useEffect, useMemo, useRef, useState } from "react";
import { API } from "@/lib/api-url";
import { useAuth } from "@/hooks/use-auth";
import {
  ModuleShell, LoadingState, Toast, useToast, MobileModuleIntro,
  colors, fonts, radius,
} from "@/components/mobile";
import {
  BookOpen, CheckCircle2, XCircle, ChevronRight,
  RotateCcw, Sparkles, Trophy, Star, Brain,
} from "lucide-react";

/**
 * /m/pratik/dilbilgisi-kocu — Mobil Dilbilgisi Koçu
 *
 * Ekranlar:
 *   1) hub — seviye + konu grid, yıldızlı ilerleme
 *   2) learn — konu özeti + kurallar + örnekler
 *   3) practice — soru-cevap + AI feedback
 *   4) complete — skor + retry
 */

const TOKEN_KEY = "sphere_token";
const LEVELS = ["A1", "A2", "B1", "B2", "C1"] as const;
type Level = typeof LEVELS[number];

type Topic = { id: number; bookId: number; title: string; level: string; hasLearnContent: boolean; };
type Example = { english: string; turkish: string; highlight: string; };
type LearnContent = { id: number; title: string; level: string; summary: string; examples: Example[]; ruleTable: string; };
type Question = { type: string; question: string; options: string[]; correct: number; explanation: string; };
type Progress = { topicId: number; correctAnswers: number; totalAnswered: number; completed: boolean; };
type Screen = "hub" | "learn" | "practice" | "complete";

function authHeaders() {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function MobileGrammarCoach() {
  const { user } = useAuth();
  const username = user ? [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "" : "";

  const [screen, setScreen] = useState<Screen>("hub");
  const [activeLevel, setActiveLevel] = useState<Level>((user?.currentLevel as Level) || "A1");
  const [topics, setTopics] = useState<Topic[]>([]);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [learnContent, setLearnContent] = useState<LearnContent | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [learnLoading, setLearnLoading] = useState(false);
  const [practiceLoading, setPracticeLoading] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<{ visible: boolean; message: string; loading: boolean }>({
    visible: false, message: "", loading: false,
  });
  const scoreRef = useRef(0);
  const { toast, show: showToast, hide: hideToast } = useToast();

  useEffect(() => { loadTopics(); }, []);
  useEffect(() => { if (username) loadProgress(); }, [username]);

  const loadTopics = async () => {
    setLoadingTopics(true);
    try {
      const r = await fetch(`${API}/grammar/topics`, { headers: authHeaders() });
      if (r.ok) setTopics(await r.json());
      else throw new Error("Konular yüklenemedi");
    } catch (e: any) {
      showToast(e?.message || "Bir hata oluştu", "error");
    } finally {
      setLoadingTopics(false);
    }
  };

  const loadProgress = async () => {
    try {
      const r = await fetch(`${API}/grammar/progress?username=${encodeURIComponent(username)}`, { headers: authHeaders() });
      if (r.ok) setProgress(await r.json());
    } catch {}
  };

  const getTopicProgress = (topicId: number) => progress.find((p) => p.topicId === topicId);

  const starsFor = (p: Progress | undefined): number => {
    if (!p || p.totalAnswered === 0) return 0;
    const pct = p.correctAnswers / p.totalAnswered;
    if (pct >= 0.9) return 3;
    if (pct >= 0.6) return 2;
    return 1;
  };

  const openTopic = async (topic: Topic) => {
    setSelectedTopic(topic);
    setLearnContent(null);
    setScreen("learn");
    setLearnLoading(true);
    try {
      const r = await fetch(`${API}/grammar/topics/${topic.id}/learn`, { headers: authHeaders() });
      if (r.ok) setLearnContent(await r.json());
      else throw new Error("İçerik yüklenemedi");
    } catch (e: any) {
      showToast(e?.message || "Bir hata oluştu", "error");
    } finally {
      setLearnLoading(false);
    }
  };

  const startPractice = async () => {
    if (!selectedTopic) return;
    setPracticeLoading(true);
    try {
      const r = await fetch(`${API}/grammar/topics/${selectedTopic.id}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({}),
      });
      if (r.ok) {
        const data = await r.json();
        setQuestions(data.questions || []);
        setCurrentQ(0);
        setSelected(null);
        setAnswers([]);
        setAiFeedback({ visible: false, message: "", loading: false });
        scoreRef.current = 0;
        setScreen("practice");
      } else {
        throw new Error("Sorular oluşturulamadı");
      }
    } catch (e: any) {
      showToast(e?.message || "Bir hata oluştu", "error");
    } finally {
      setPracticeLoading(false);
    }
  };

  const answerQuestion = async (optIdx: number) => {
    if (selected !== null) return;
    setSelected(optIdx);
    const q = questions[currentQ];
    const isCorrect = optIdx === q.correct;
    setAnswers((prev) => [...prev, isCorrect]);
    if (isCorrect) scoreRef.current++;

    if (!isCorrect) {
      setAiFeedback({ visible: true, message: "", loading: true });
      try {
        const r = await fetch(`${API}/grammar/ai-coach`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({
            topicId: selectedTopic?.id,
            topicTitle: selectedTopic?.title,
            question: q.question,
            userAnswer: q.options[optIdx],
            correctAnswer: q.options[q.correct],
            questionType: q.type,
          }),
        });
        const data = r.ok ? await r.json() : {};
        setAiFeedback({ visible: true, message: (data as any)?.message || q.explanation, loading: false });
      } catch {
        setAiFeedback({ visible: true, message: q.explanation, loading: false });
      }
    }
  };

  const nextQuestion = async () => {
    if (currentQ + 1 >= questions.length) {
      await saveProgress();
      setScreen("complete");
    } else {
      setCurrentQ((c) => c + 1);
      setSelected(null);
      setAiFeedback({ visible: false, message: "", loading: false });
    }
  };

  const saveProgress = async () => {
    if (!username || !selectedTopic) return;
    const total = questions.length;
    const correct = scoreRef.current;
    const completed = correct / total >= 0.6;
    try {
      await fetch(`${API}/grammar/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ username, topicId: selectedTopic.id, correctAnswers: correct, totalAnswered: total, completed }),
      });
      await loadProgress();
    } catch {}
  };

  const backToHub = () => {
    setSelectedTopic(null);
    setLearnContent(null);
    setQuestions([]);
    setAnswers([]);
    setCurrentQ(0);
    setSelected(null);
    setScreen("hub");
  };

  const filteredTopics = useMemo(
    () => topics.filter((t) => t.level === activeLevel),
    [topics, activeLevel]
  );

  // ─── HUB ───────────────────────────────────────────────
  if (screen === "hub") {
    const completedCount = progress.filter((p) => p.completed).length;
    return (
      <ModuleShell
        title="Dilbilgisi Koçu"
        subtitle={`${completedCount} konu tamamlandı`}
      >
        <MobileModuleIntro moduleKey="grammar_coach" />

        {/* Level tabs */}
        <div style={{
          display: "flex", gap: 6, marginBottom: 20,
          overflowX: "auto", paddingBottom: 4,
        }}>
          {LEVELS.map((l) => (
            <button
              key={l}
              onClick={() => setActiveLevel(l)}
              style={{
                padding: "10px 18px", borderRadius: 100,
                background: activeLevel === l ? colors.navy : colors.white,
                color: activeLevel === l ? colors.white : colors.navy,
                border: `1px solid ${activeLevel === l ? colors.navy : colors.navy100}`,
                fontFamily: fonts.heading, fontWeight: 800, fontSize: 13,
                cursor: "pointer", flexShrink: 0,
              }}
            >{l}</button>
          ))}
        </div>

        {loadingTopics ? (
          <LoadingState compact messages={["Konular yükleniyor…"]} />
        ) : filteredTopics.length === 0 ? (
          <div style={{
            padding: 40, textAlign: "center",
            color: colors.neutral, fontSize: 13,
          }}>
            <BookOpen size={32} color={colors.navy100} style={{ marginBottom: 12 }} />
            <div>Bu seviyede konu bulunamadı</div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {filteredTopics.map((t) => {
              const p = getTopicProgress(t.id);
              const s = starsFor(p);
              return (
                <button
                  key={t.id}
                  onClick={() => openTopic(t)}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: 14, background: colors.white,
                    border: `1px solid ${p?.completed ? colors.turq : colors.navy100}`,
                    borderRadius: radius.card, cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: p?.completed ? colors.turq : colors.navy50,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: p?.completed ? colors.navy : colors.navy,
                    flexShrink: 0,
                  }}>
                    {p?.completed
                      ? <CheckCircle2 size={18} strokeWidth={2.5} />
                      : <Brain size={18} strokeWidth={2} />
                    }
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: fonts.heading, fontWeight: 700, fontSize: 14,
                      color: colors.navy, letterSpacing: "-0.01em",
                      lineHeight: 1.3,
                      overflow: "hidden", textOverflow: "ellipsis",
                    }}>{t.title}</div>
                    {p && p.totalAnswered > 0 && (
                      <div style={{
                        fontSize: 11, color: colors.neutral, marginTop: 2,
                      }}>
                        {p.correctAnswers}/{p.totalAnswered} doğru
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                    {[1, 2, 3].map((i) => (
                      <Star
                        key={i}
                        size={12}
                        fill={i <= s ? colors.turq : "none"}
                        color={i <= s ? colors.turq : colors.navy100}
                        strokeWidth={2}
                      />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <Toast {...toast} onClose={hideToast} />
      </ModuleShell>
    );
  }

  // ─── LEARN ──────────────────────────────────────────────
  if (screen === "learn") {
    return (
      <ModuleShell
        title={selectedTopic?.title || "Konu"}
        subtitle={selectedTopic?.level}
        backTo={undefined}
        rightAction={
          <button
            onClick={backToHub}
            style={{
              background: "transparent", border: "none",
              fontSize: 11, color: colors.turqDeep, cursor: "pointer",
              fontFamily: fonts.heading, fontWeight: 700,
              textTransform: "uppercase", letterSpacing: "0.06em",
              padding: 8,
            }}
          >Hub</button>
        }
        footer={
          <button
            onClick={startPractice}
            disabled={practiceLoading || !learnContent}
            style={{
              width: "100%", padding: "14px 20px", borderRadius: 100,
              background: colors.navy, color: colors.white, border: "none",
              fontFamily: fonts.heading, fontWeight: 800, fontSize: 14,
              cursor: practiceLoading ? "not-allowed" : "pointer",
              opacity: practiceLoading || !learnContent ? 0.5 : 1,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            {practiceLoading ? (
              <>
                <Sparkles size={16} strokeWidth={2.5} />
                Sorular hazırlanıyor…
              </>
            ) : (
              <>
                Pratik yap
                <ChevronRight size={16} strokeWidth={2.5} />
              </>
            )}
          </button>
        }
      >
        {learnLoading ? (
          <LoadingState messages={["Konu içeriği yükleniyor…"]} compact />
        ) : learnContent ? (
          <>
            {/* Özet */}
            {learnContent.summary && (
              <div style={{
                padding: 16, background: colors.navy50,
                borderRadius: radius.card, marginBottom: 16,
                fontSize: 14, color: colors.navy, lineHeight: 1.6,
              }}>{learnContent.summary}</div>
            )}

            {/* Kural tablosu */}
            {learnContent.ruleTable && (
              <div style={{ marginBottom: 16 }}>
                <div style={{
                  fontFamily: fonts.heading, fontWeight: 700, fontSize: 11,
                  color: colors.neutral, textTransform: "uppercase", letterSpacing: "0.06em",
                  marginBottom: 10,
                }}>Kurallar</div>
                <div
                  style={{
                    padding: 14, background: colors.white,
                    border: `1px solid ${colors.navy50}`, borderRadius: 12,
                    fontSize: 13, color: colors.navy, lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                    fontFamily: fonts.body,
                  }}
                  dangerouslySetInnerHTML={{ __html: learnContent.ruleTable }}
                />
              </div>
            )}

            {/* Örnekler */}
            {learnContent.examples && learnContent.examples.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{
                  fontFamily: fonts.heading, fontWeight: 700, fontSize: 11,
                  color: colors.neutral, textTransform: "uppercase", letterSpacing: "0.06em",
                  marginBottom: 10,
                }}>Örnekler</div>
                {learnContent.examples.map((ex, i) => (
                  <div key={i} style={{
                    padding: 12, marginBottom: 8,
                    background: colors.white,
                    border: `1px solid ${colors.navy50}`, borderRadius: 12,
                  }}>
                    <div style={{
                      fontSize: 14, color: colors.navy, lineHeight: 1.5,
                      marginBottom: 4, fontFamily: fonts.body,
                    }}>
                      {ex.highlight
                        ? renderWithHighlight(ex.english, ex.highlight)
                        : ex.english}
                    </div>
                    {ex.turkish && (
                      <div style={{
                        fontSize: 12, color: colors.neutral, fontStyle: "italic",
                      }}>{ex.turkish}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div style={{
            padding: 40, textAlign: "center",
            color: colors.neutral, fontSize: 13,
          }}>Konu içeriği bulunamadı.</div>
        )}

        <Toast {...toast} onClose={hideToast} />
      </ModuleShell>
    );
  }

  // ─── PRACTICE ────────────────────────────────────────────
  if (screen === "practice") {
    const q = questions[currentQ];
    if (!q) return null;
    const pct = questions.length > 0 ? ((currentQ + 1) / questions.length) * 100 : 0;
    const isCorrect = selected !== null && selected === q.correct;

    return (
      <ModuleShell
        title={selectedTopic?.title || "Pratik"}
        subtitle={`Soru ${currentQ + 1} / ${questions.length}`}
        rightAction={
          <div style={{
            fontFamily: fonts.heading, fontWeight: 800, fontSize: 12,
            color: colors.navy, padding: "4px 10px",
            background: colors.navy50, borderRadius: 100,
          }}>
            {scoreRef.current}/{currentQ + (selected !== null ? 1 : 0)}
          </div>
        }
        footer={
          selected !== null ? (
            <button
              onClick={nextQuestion}
              style={{
                width: "100%", padding: "14px 20px", borderRadius: 100,
                background: colors.navy, color: colors.white, border: "none",
                fontFamily: fonts.heading, fontWeight: 800, fontSize: 14,
                cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              {currentQ + 1 >= questions.length ? "Bitir" : "Sonraki"}
              <ChevronRight size={16} strokeWidth={2.5} />
            </button>
          ) : (
            <div style={{
              padding: 8, textAlign: "center",
              fontSize: 11, color: colors.neutral,
              fontFamily: fonts.heading, fontWeight: 600,
              textTransform: "uppercase", letterSpacing: "0.06em",
            }}>
              Cevabını seç
            </div>
          )
        }
      >
        {/* Progress bar */}
        <div style={{
          height: 4, background: colors.navy50, borderRadius: 100,
          marginBottom: 20, overflow: "hidden",
        }}>
          <div style={{
            height: "100%", background: colors.turq,
            width: `${pct}%`, transition: "width 0.3s",
          }} />
        </div>

        {/* Soru */}
        <div style={{
          fontFamily: fonts.heading, fontWeight: 700, fontSize: 18,
          color: colors.navy, letterSpacing: "-0.01em", lineHeight: 1.35,
          marginBottom: 20,
        }}>{q.question}</div>

        {/* Seçenekler */}
        <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
          {q.options.map((opt, i) => {
            const isChosen = selected === i;
            const isCorrectOpt = selected !== null && i === q.correct;
            const isWrongChosen = isChosen && !isCorrectOpt;
            let bg = colors.white;
            let border = colors.navy100;
            let textColor = colors.navy;
            if (selected !== null) {
              if (isCorrectOpt) {
                bg = "#dcfce7"; border = "#22c55e"; textColor = "#166534";
              } else if (isWrongChosen) {
                bg = "#fee2e2"; border = colors.error; textColor = "#991b1b";
              } else {
                bg = colors.white; border = colors.navy100; textColor = colors.neutral;
              }
            }
            return (
              <button
                key={i}
                onClick={() => answerQuestion(i)}
                disabled={selected !== null}
                style={{
                  padding: "14px 16px", borderRadius: 12,
                  background: bg, color: textColor,
                  border: `2px solid ${border}`,
                  fontFamily: fonts.body, fontSize: 14, lineHeight: 1.4,
                  textAlign: "left",
                  cursor: selected !== null ? "default" : "pointer",
                  display: "flex", alignItems: "center", gap: 10,
                }}
              >
                <div style={{
                  width: 22, height: 22, borderRadius: 11,
                  background: isCorrectOpt ? "#22c55e" : isWrongChosen ? colors.error : colors.navy50,
                  color: isCorrectOpt || isWrongChosen ? colors.white : colors.navy,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 800,
                  fontFamily: fonts.heading, flexShrink: 0,
                }}>
                  {isCorrectOpt ? <CheckCircle2 size={12} strokeWidth={3} />
                    : isWrongChosen ? <XCircle size={12} strokeWidth={3} />
                    : String.fromCharCode(65 + i)}
                </div>
                <span style={{ flex: 1 }}>{opt}</span>
              </button>
            );
          })}
        </div>

        {/* Doğru cevap açıklaması */}
        {selected !== null && isCorrect && (
          <div style={{
            padding: 14, background: "#dcfce7",
            border: `1px solid #86efac`, borderRadius: 12,
            marginBottom: 16,
          }}>
            <div style={{
              fontFamily: fonts.heading, fontWeight: 800, fontSize: 12,
              color: "#166534", marginBottom: 4,
              display: "flex", alignItems: "center", gap: 6,
              textTransform: "uppercase", letterSpacing: "0.06em",
            }}>
              <CheckCircle2 size={14} />
              Doğru!
            </div>
            {q.explanation && (
              <div style={{ fontSize: 13, color: "#166534", lineHeight: 1.5 }}>
                {q.explanation}
              </div>
            )}
          </div>
        )}

        {/* AI Coach feedback (yanlışta) */}
        {aiFeedback.visible && (
          <div style={{
            padding: 14, background: colors.turq + "15",
            border: `1px solid ${colors.turq}55`, borderRadius: 12,
            marginBottom: 16,
          }}>
            <div style={{
              fontFamily: fonts.heading, fontWeight: 800, fontSize: 12,
              color: colors.navy, marginBottom: 6,
              display: "flex", alignItems: "center", gap: 6,
              textTransform: "uppercase", letterSpacing: "0.06em",
            }}>
              <Sparkles size={14} color={colors.turqDeep} />
              Koç açıklıyor
            </div>
            {aiFeedback.loading ? (
              <LoadingState compact messages={["AI koç açıklıyor…"]} />
            ) : (
              <div style={{ fontSize: 13, color: colors.navy, lineHeight: 1.5 }}>
                {aiFeedback.message}
              </div>
            )}
          </div>
        )}

        <Toast {...toast} onClose={hideToast} />
      </ModuleShell>
    );
  }

  // ─── COMPLETE ────────────────────────────────────────────
  if (screen === "complete") {
    const total = questions.length;
    const correct = scoreRef.current;
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    const passed = pct >= 60;
    const stars = pct >= 90 ? 3 : pct >= 60 ? 2 : 1;

    return (
      <ModuleShell
        title="Tamamlandı"
        subtitle={selectedTopic?.title}
        rightAction={
          <button
            onClick={backToHub}
            style={{
              background: "transparent", border: "none",
              fontSize: 11, color: colors.turqDeep, cursor: "pointer",
              fontFamily: fonts.heading, fontWeight: 700,
              textTransform: "uppercase", letterSpacing: "0.06em",
              padding: 8,
            }}
          >Hub</button>
        }
      >
        <div style={{
          padding: "32px 20px", textAlign: "center",
        }}>
          <div style={{
            width: 88, height: 88, borderRadius: 44,
            background: passed ? colors.turq : colors.navy50,
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px",
          }}>
            <Trophy size={40} color={passed ? colors.navy : colors.neutral} strokeWidth={2} />
          </div>

          {/* Yıldızlar */}
          <div style={{
            display: "flex", justifyContent: "center", gap: 6,
            marginBottom: 20,
          }}>
            {[1, 2, 3].map((i) => (
              <Star
                key={i}
                size={28}
                fill={i <= stars ? colors.turq : "none"}
                color={i <= stars ? colors.turq : colors.navy100}
                strokeWidth={2}
              />
            ))}
          </div>

          <div style={{
            fontFamily: fonts.heading, fontWeight: 900, fontSize: 44,
            color: colors.navy, letterSpacing: "-0.03em", lineHeight: 1,
          }}>%{pct}</div>
          <div style={{ fontSize: 14, color: colors.neutral, marginTop: 6 }}>
            {correct} / {total} doğru
          </div>
          <div style={{
            fontFamily: fonts.heading, fontWeight: 700, fontSize: 14,
            color: passed ? colors.turqDeep : colors.warn,
            marginTop: 20, lineHeight: 1.5,
          }}>
            {passed
              ? "Harikaydı! Bu konuyu iyi kavramışsın."
              : "Biraz daha çalışma gerekiyor. Konuyu tekrar oku ve yeniden dene."}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => { setScreen("learn"); }}
            style={{
              flex: 1, padding: "14px 20px", borderRadius: 100,
              background: colors.navy50, color: colors.navy, border: "none",
              fontFamily: fonts.heading, fontWeight: 700, fontSize: 14,
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            <BookOpen size={14} strokeWidth={2.5} />
            Konuyu tekrar oku
          </button>
          <button
            onClick={startPractice}
            disabled={practiceLoading}
            style={{
              flex: 1, padding: "14px 20px", borderRadius: 100,
              background: colors.navy, color: colors.white, border: "none",
              fontFamily: fonts.heading, fontWeight: 800, fontSize: 14,
              cursor: practiceLoading ? "not-allowed" : "pointer",
              opacity: practiceLoading ? 0.5 : 1,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            <RotateCcw size={14} strokeWidth={2.5} />
            Tekrar dene
          </button>
        </div>
        <button
          onClick={backToHub}
          style={{
            marginTop: 8, width: "100%",
            padding: "12px 20px", borderRadius: 100,
            background: "transparent", color: colors.neutral,
            border: `1px solid ${colors.navy100}`,
            fontFamily: fonts.heading, fontWeight: 700, fontSize: 13,
            cursor: "pointer",
          }}
        >Başka konu seç</button>

        <Toast {...toast} onClose={hideToast} />
      </ModuleShell>
    );
  }

  return null;
}

function renderWithHighlight(text: string, highlight: string): React.ReactNode {
  if (!highlight) return text;
  const parts = text.split(new RegExp(`(${escapeReg(highlight)})`, "gi"));
  return parts.map((p, i) =>
    p.toLowerCase() === highlight.toLowerCase() ? (
      <span key={i} style={{
        background: colors.turq + "44",
        borderRadius: 4, padding: "0 3px",
        fontWeight: 700, color: colors.navy,
      }}>{p}</span>
    ) : p
  );
}

function escapeReg(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
