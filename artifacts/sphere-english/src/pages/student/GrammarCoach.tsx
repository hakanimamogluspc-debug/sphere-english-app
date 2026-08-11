import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen, Zap, CheckCircle2, XCircle, ChevronRight, RotateCcw,
  MessageCircle, X, Star, Loader2, ArrowLeft, Sparkles, Trophy,
  Brain, ChevronLeft, Volume2
} from "lucide-react";

const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

const LEVELS = ["A1", "A2", "B1", "B2", "C1"] as const;
type Level = typeof LEVELS[number];

const LEVEL_COLOR: Record<string, string> = {
  A1: "bg-emerald-100 text-emerald-700 border-emerald-200",
  A2: "bg-teal-100 text-teal-700 border-teal-200",
  B1: "bg-blue-100 text-blue-700 border-blue-200",
  B2: "bg-violet-100 text-violet-700 border-violet-200",
  C1: "bg-orange-100 text-orange-700 border-orange-200",
};

const TYPE_LABEL: Record<string, string> = {
  fill_blank: "Boşluk Doldurma",
  multiple_choice: "Çoktan Seçmeli",
  sentence_fix: "Cümle Düzeltme",
  translate: "Çeviri",
  word_order: "Kelime Sıralama",
};

type Topic = { id: number; bookId: number; title: string; level: string; hasLearnContent: boolean };
type Example = { english: string; turkish: string; highlight: string };
type LearnContent = { id: number; title: string; level: string; summary: string; examples: Example[]; ruleTable: string };
type Question = { type: string; question: string; options: string[]; correct: number; explanation: string };
type Progress = { topicId: number; correctAnswers: number; totalAnswered: number; completed: boolean };

type Screen = "hub" | "learn" | "practice" | "complete";

export default function GrammarCoach() {
  const { user } = useAuth();
  const username = user ? [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "" : "";

  const [screen, setScreen] = useState<Screen>("hub");
  const [activeLevel, setActiveLevel] = useState<Level>("A1");
  const [topics, setTopics] = useState<Topic[]>([]);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [learnContent, setLearnContent] = useState<LearnContent | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [loading, setLoading] = useState(false);
  const [learnLoading, setLearnLoading] = useState(false);
  const [practiceLoading, setPracticeLoading] = useState(false);
  const [aiPanel, setAiPanel] = useState<{ visible: boolean; message: string; loading: boolean }>({ visible: false, message: "", loading: false });

  const scoreRef = useRef(0);

  const authHeaders = () => {
    const token = localStorage.getItem("sphere_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  useEffect(() => { loadTopics(); }, []);
  useEffect(() => { if (username) loadProgress(); }, [username]);

  async function loadTopics() {
    setLoading(true);
    try {
      const r = await fetch(`${API}/grammar/topics`, { headers: authHeaders() });
      if (r.ok) setTopics(await r.json());
    } finally { setLoading(false); }
  }

  async function loadProgress() {
    if (!username) return;
    try {
      const r = await fetch(`${API}/grammar/progress?username=${encodeURIComponent(username)}`, { headers: authHeaders() });
      if (r.ok) setProgress(await r.json());
    } catch {}
  }

  function getTopicProgress(topicId: number): Progress | undefined {
    return progress.find(p => p.topicId === topicId);
  }

  function stars(p: Progress | undefined): number {
    if (!p || p.totalAnswered === 0) return 0;
    const pct = p.correctAnswers / p.totalAnswered;
    if (pct >= 0.9) return 3;
    if (pct >= 0.6) return 2;
    return 1;
  }

  async function openTopic(topic: Topic) {
    setSelectedTopic(topic);
    setLearnContent(null);
    setScreen("learn");
    setLearnLoading(true);
    try {
      const r = await fetch(`${API}/grammar/topics/${topic.id}/learn`, { headers: authHeaders() });
      if (r.ok) setLearnContent(await r.json());
    } finally { setLearnLoading(false); }
  }

  async function startPractice() {
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
        setAiPanel({ visible: false, message: "", loading: false });
        scoreRef.current = 0;
        setScreen("practice");
      }
    } finally { setPracticeLoading(false); }
  }

  async function handleAnswer(optIdx: number) {
    if (selected !== null) return;
    setSelected(optIdx);
    const q = questions[currentQ];
    const isCorrect = optIdx === q.correct;
    const newAnswers = [...answers, isCorrect];
    setAnswers(newAnswers);
    if (isCorrect) scoreRef.current++;

    if (!isCorrect) {
      setAiPanel({ visible: true, message: "", loading: true });
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
        setAiPanel({ visible: true, message: data.message || q.explanation, loading: false });
      } catch {
        setAiPanel({ visible: true, message: q.explanation, loading: false });
      }
    }
  }

  async function nextQuestion() {
    if (currentQ + 1 >= questions.length) {
      await saveProgress();
      setScreen("complete");
    } else {
      setCurrentQ(c => c + 1);
      setSelected(null);
      setAiPanel({ visible: false, message: "", loading: false });
    }
  }

  async function saveProgress() {
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
  }

  const filteredTopics = topics.filter(t => t.level === activeLevel);
  const q = questions[currentQ];
  const pct = questions.length > 0 ? ((currentQ) / questions.length) * 100 : 0;

  return (
    <div className="min-h-full">
      <AnimatePresence mode="wait">

        {/* ── HUB ──────────────────────────────────────────────── */}
        {screen === "hub" && (
          <motion.div key="hub" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Brain className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground font-display">AI Dilbilgisi Koçu</h2>
                <p className="text-sm text-muted-foreground">Seviyene göre dilbilgisi kurallarını öğren ve pratik yap</p>
              </div>
            </div>

            {/* Level Tabs */}
            <div className="flex gap-2 border-b border-border pb-4">
              {LEVELS.map(lv => (
                <button key={lv} onClick={() => setActiveLevel(lv)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${activeLevel === lv ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:bg-secondary/60"}`}>
                  {lv}
                </button>
              ))}
            </div>

            {/* Topics Grid */}
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
              </div>
            ) : filteredTopics.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>Bu seviyede konu bulunamadı</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredTopics.map((topic, i) => {
                  const p = getTopicProgress(topic.id);
                  const s = stars(p);
                  return (
                    <motion.button key={topic.id} onClick={() => openTopic(topic)}
                      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                      className="text-left p-5 rounded-2xl border border-border bg-card hover:border-primary/30 hover:shadow-md transition-all group">
                      <div className="flex items-start justify-between mb-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${LEVEL_COLOR[topic.level] || "bg-secondary text-secondary-foreground border-border"}`}>
                          {topic.level}
                        </span>
                        <div className="flex gap-0.5">
                          {[1,2,3].map(n => (
                            <Star key={n} className={`h-3.5 w-3.5 ${n <= s ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/30"}`} />
                          ))}
                        </div>
                      </div>
                      <h3 className="font-semibold text-foreground text-sm leading-snug mb-2 group-hover:text-primary transition-colors">{topic.title}</h3>
                      <div className="flex items-center justify-between">
                        {p ? (
                          <span className="text-xs text-muted-foreground">{p.correctAnswers}/{p.totalAnswered} doğru</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Henüz başlanmadı</span>
                        )}
                        <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* ── LEARN ─────────────────────────────────────────────── */}
        {screen === "learn" && (
          <motion.div key="learn" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5 max-w-2xl mx-auto">
            <div className="flex items-center gap-3">
              <button onClick={() => setScreen("hub")} className="p-2 rounded-xl hover:bg-secondary/60 transition-colors">
                <ArrowLeft className="h-5 w-5 text-muted-foreground" />
              </button>
              <div className="flex-1">
                {selectedTopic && (
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${LEVEL_COLOR[selectedTopic.level] || "bg-secondary"}`}>{selectedTopic.level}</span>
                    <h2 className="text-lg font-bold text-foreground font-display">{selectedTopic.title}</h2>
                  </div>
                )}
              </div>
            </div>

            {/* Progress Indicator */}
            <div className="flex gap-3">
              {["Öğren", "Pratik Yap"].map((step, i) => (
                <div key={step} className={`flex-1 py-2 rounded-xl text-center text-xs font-semibold border transition-all ${
                  i === 0 ? "bg-primary text-white border-primary" : "bg-secondary/50 text-muted-foreground border-border"
                }`}>
                  {i === 0 && <BookOpen className="h-3.5 w-3.5 inline mr-1.5" />}
                  {i === 1 && <Zap className="h-3.5 w-3.5 inline mr-1.5" />}
                  {step}
                </div>
              ))}
            </div>

            {learnLoading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
                <p className="text-sm text-muted-foreground">AI içerik hazırlıyor...</p>
              </div>
            ) : learnContent ? (
              <div className="space-y-5">
                {/* Summary */}
                <div className="p-5 rounded-2xl bg-primary/5 border border-primary/10">
                  <div className="flex items-center gap-2 mb-3">
                    <BookOpen className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold text-primary">Kural Özeti</span>
                  </div>
                  <p className="text-sm text-foreground leading-relaxed">{learnContent.summary}</p>
                </div>

                {/* Examples */}
                {learnContent.examples.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-accent" />
                      <span className="text-sm font-semibold text-foreground">Örnekler</span>
                    </div>
                    {learnContent.examples.map((ex, i) => (
                      <div key={i} className="p-4 rounded-xl border border-border bg-card">
                        <p className="text-sm font-medium text-foreground mb-1">
                          {ex.english.split(ex.highlight).map((part, idx, arr) => (
                            <span key={idx}>
                              {part}
                              {idx < arr.length - 1 && (
                                <span className="text-primary font-bold underline decoration-primary/40 underline-offset-2">{ex.highlight}</span>
                              )}
                            </span>
                          ))}
                        </p>
                        <p className="text-xs text-muted-foreground">{ex.turkish}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Rule Table */}
                {learnContent.ruleTable && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Brain className="h-4 w-4 text-accent" />
                      <span className="text-sm font-semibold text-foreground">Kural Tablosu</span>
                    </div>
                    <div className="rounded-2xl border border-border overflow-hidden bg-card p-1">
                      <div className="overflow-x-auto text-sm" dangerouslySetInnerHTML={{ __html: learnContent.ruleTable }} />
                    </div>
                  </div>
                )}

                {/* Start Practice */}
                <button
                  onClick={startPractice}
                  disabled={practiceLoading}
                  className="w-full py-4 rounded-2xl bg-primary text-white font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-60 transition-all shadow-lg shadow-primary/20"
                >
                  {practiceLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Zap className="h-5 w-5" />}
                  {practiceLoading ? "Sorular hazırlanıyor..." : "Pratik Yap →"}
                </button>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <p>İçerik yüklenemedi. Tekrar deneyin.</p>
              </div>
            )}
          </motion.div>
        )}

        {/* ── PRACTICE ──────────────────────────────────────────── */}
        {screen === "practice" && q && (
          <motion.div key="practice" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="max-w-2xl mx-auto space-y-5">
            {/* Header */}
            <div className="flex items-center gap-3">
              <button onClick={() => { setScreen("learn"); setAiPanel({ visible: false, message: "", loading: false }); }} className="p-2 rounded-xl hover:bg-secondary/60 transition-colors">
                <ArrowLeft className="h-5 w-5 text-muted-foreground" />
              </button>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-muted-foreground font-medium">Soru {currentQ + 1}/{questions.length}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full bg-secondary`}>{TYPE_LABEL[q.type] || q.type}</span>
                </div>
                <div className="h-2 rounded-full bg-secondary overflow-hidden">
                  <motion.div className="h-full bg-primary rounded-full" animate={{ width: `${pct}%` }} transition={{ duration: 0.4 }} />
                </div>
              </div>
            </div>

            {/* Question Card */}
            <motion.div key={currentQ} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-6 rounded-2xl border border-border bg-card shadow-sm">
              <p className="text-base font-medium text-foreground leading-relaxed mb-6">{q.question}</p>

              <div className="space-y-3">
                {q.options.map((opt, idx) => {
                  const isSelected = selected === idx;
                  const isCorrect = idx === q.correct;
                  const showResult = selected !== null;

                  let cls = "w-full text-left px-4 py-3.5 rounded-xl border text-sm font-medium transition-all ";
                  if (!showResult) {
                    cls += "border-border bg-secondary/30 hover:border-primary/40 hover:bg-primary/5";
                  } else if (isCorrect) {
                    cls += "border-emerald-400 bg-emerald-50 text-emerald-800";
                  } else if (isSelected && !isCorrect) {
                    cls += "border-red-400 bg-red-50 text-red-800";
                  } else {
                    cls += "border-border bg-secondary/10 text-muted-foreground";
                  }

                  return (
                    <button key={idx} className={cls} onClick={() => handleAnswer(idx)} disabled={selected !== null}>
                      <div className="flex items-center gap-3">
                        <span className={`h-6 w-6 rounded-full border flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                          showResult && isCorrect ? "border-emerald-500 bg-emerald-500 text-white" :
                          showResult && isSelected ? "border-red-500 bg-red-500 text-white" :
                          "border-current"
                        }`}>{["A","B","C","D"][idx]}</span>
                        <span>{opt}</span>
                        {showResult && isCorrect && <CheckCircle2 className="h-4 w-4 ml-auto text-emerald-600" />}
                        {showResult && isSelected && !isCorrect && <XCircle className="h-4 w-4 ml-auto text-red-600" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Correct feedback */}
              {selected !== null && selected === q.correct && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-emerald-800">{q.explanation}</p>
                </motion.div>
              )}
            </motion.div>

            {/* Next Button */}
            {selected !== null && (
              <motion.button initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                onClick={nextQuestion}
                className="w-full py-3.5 rounded-2xl bg-primary text-white font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition-all">
                {currentQ + 1 >= questions.length ? (
                  <><Trophy className="h-5 w-5" /> Sonucu Gör</>
                ) : (
                  <>Sonraki Soru <ChevronRight className="h-5 w-5" /></>
                )}
              </motion.button>
            )}

            {/* AI Coach Panel */}
            <AnimatePresence>
              {aiPanel.visible && (
                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.97 }}
                  className="fixed bottom-6 right-6 left-6 sm:left-auto sm:w-80 z-50"
                >
                  <div className="rounded-2xl border border-primary/20 bg-card shadow-2xl shadow-primary/10 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 bg-primary/5 border-b border-primary/10">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center">
                          <Sparkles className="h-3.5 w-3.5 text-white" />
                        </div>
                        <span className="text-sm font-semibold text-primary">AI Dilbilgisi Koçu</span>
                      </div>
                      <button onClick={() => setAiPanel(p => ({ ...p, visible: false }))} className="p-1 rounded-lg hover:bg-secondary/60 transition-colors">
                        <X className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </div>
                    <div className="p-4">
                      {aiPanel.loading ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          Analiz ediliyor...
                        </div>
                      ) : (
                        <p className="text-sm text-foreground leading-relaxed">{aiPanel.message}</p>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ── COMPLETE ──────────────────────────────────────────── */}
        {screen === "complete" && (
          <motion.div key="complete" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            className="max-w-md mx-auto text-center space-y-6 py-8">
            {(() => {
              const correct = scoreRef.current;
              const total = questions.length;
              const pct = total > 0 ? correct / total : 0;
              const s = pct >= 0.9 ? 3 : pct >= 0.6 ? 2 : 1;
              return (
                <>
                  <div className="relative">
                    <div className="h-28 w-28 mx-auto rounded-full bg-primary/10 flex flex-col items-center justify-center border-4 border-primary/20">
                      <span className="text-3xl font-bold text-primary">{correct}</span>
                      <span className="text-xs text-muted-foreground">/ {total}</span>
                    </div>
                    <div className="absolute top-0 right-1/2 translate-x-16 -translate-y-2">
                      <Trophy className="h-8 w-8 text-yellow-500" />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-center gap-2 mb-3">
                      {[1,2,3].map(n => (
                        <motion.div key={n} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: n * 0.15, type: "spring" }}>
                          <Star className={`h-8 w-8 ${n <= s ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/30"}`} />
                        </motion.div>
                      ))}
                    </div>
                    <h2 className="text-xl font-bold text-foreground font-display mb-1">
                      {pct >= 0.9 ? "Mükemmel! 🎉" : pct >= 0.6 ? "İyi iş! 👍" : "Biraz daha pratik yapman gerekiyor"}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {total} sorudan {correct} tanesini doğru yanıtladın.
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <button onClick={() => startPractice()}
                      className="flex-1 py-3 rounded-2xl border border-border bg-secondary/50 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-secondary transition-colors">
                      <RotateCcw className="h-4 w-4" /> Tekrar
                    </button>
                    <button onClick={() => setScreen("hub")}
                      className="flex-1 py-3 rounded-2xl bg-primary text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors">
                      <BookOpen className="h-4 w-4" /> Başka Konu
                    </button>
                  </div>
                </>
              );
            })()}
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
