import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { API } from "@/lib/api-url";
import {
  ModuleShell, LoadingState, ErrorState, Toast, useToast,
  colors, fonts, radius,
} from "@/components/mobile";
import {
  Trophy, RotateCcw, CheckCircle2, XCircle, ArrowLeft, ArrowRight,
  Send, Clock, Check,
} from "lucide-react";

/**
 * /m/pratik/seviye-sinavlari/:level — Sınav çözme sayfası
 */

const TOKEN_KEY = "sphere_token";

interface Question { id: string; prompt: string; options: string[]; }

interface ExamResult {
  score: number; total: number; percent: number;
  passed: boolean; passThresholdPercent: number;
  levelPromoted?: boolean; newLevel?: string;
  review: Array<{
    questionId: string; prompt: string; options: string[];
    correctIndex: number; selectedIndex: number | null; isCorrect: boolean;
  }>;
}

export default function MobileLevelExamTaking() {
  const [, params] = useRoute("/m/pratik/seviye-sinavlari/:level");
  const [, navigate] = useLocation();
  const level = params?.level as string;
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [timeLimit, setTimeLimit] = useState<number>(0);
  const [remaining, setRemaining] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ExamResult | null>(null);
  const startedAtRef = useRef<number>(Date.now());
  const timerRef = useRef<number | null>(null);
  const { toast, show: showToast, hide: hideToast } = useToast();

  useEffect(() => { load(); }, [level]);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const load = async () => {
    setLoading(true); setError(null); setResult(null);
    setAnswers({}); setCurrentIdx(0);
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const r = await fetch(`${API}/level-exams/${level}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error((j as any)?.error || "Sınav yüklenemedi");
      }
      const d = await r.json();
      setQuestions(d.questions || []);
      setTimeLimit(d.timeLimitMinutes || 15);
      const total = (d.timeLimitMinutes || 15) * 60;
      setRemaining(total);
      startedAtRef.current = Date.now();
      // Timer
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - startedAtRef.current) / 1000);
        const left = Math.max(0, total - elapsed);
        setRemaining(left);
        if (left === 0) {
          if (timerRef.current) clearInterval(timerRef.current);
          submit();
        }
      }, 1000) as unknown as number;
    } catch (e: any) {
      setError(e?.message || "Bir hata oluştu");
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const payload = {
        answers: questions.map((q) => ({
          questionId: q.id, selectedIndex: answers[q.id] ?? null,
        })),
      };
      const r = await fetch(`${API}/level-exams/${level}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (!r.ok) throw new Error((d as any)?.error || "Gönderilemedi");
      setResult(d);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e: any) {
      showToast(e?.message || "Bir hata oluştu", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const answeredCount = useMemo(
    () => Object.keys(answers).filter((k) => answers[k] !== undefined && answers[k] !== null).length,
    [answers]
  );

  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60);
    const ss = s % 60;
    return `${m}:${ss.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <ModuleShell title={`${level} Sınavı`} subtitle="Yükleniyor…">
        <LoadingState messages={["Sınav sorularını hazırlıyoruz…"]} />
      </ModuleShell>
    );
  }

  if (error) {
    return (
      <ModuleShell title={`${level} Sınavı`}>
        <ErrorState title="Yüklenemedi" message={error} onRetry={load} />
      </ModuleShell>
    );
  }

  // ─── Sonuç ────────────────────────────
  if (result) {
    const passed = result.passed;
    return (
      <ModuleShell
        title="Sınav Sonucu"
        subtitle={`${level} · ${passed ? "Geçti" : "Kaldı"}`}
        rightAction={
          <button
            onClick={() => navigate("/m/pratik/seviye-sinavlari")}
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
        {/* Ana sonuç */}
        <div style={{
          padding: 24, textAlign: "center",
          background: passed ? "#dcfce7" : "#fef3c7",
          border: `1px solid ${passed ? "#86efac" : "#fcd34d"}`,
          borderRadius: radius.panel, marginBottom: 16,
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: 36,
            background: passed ? "#22c55e" : "#f59e0b",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 12px",
          }}>
            {passed
              ? <Trophy size={34} color={colors.white} strokeWidth={2} />
              : <RotateCcw size={30} color={colors.white} strokeWidth={2.5} />
            }
          </div>
          <div style={{
            fontFamily: fonts.heading, fontWeight: 900, fontSize: 22,
            color: passed ? "#166534" : "#92400e", letterSpacing: "-0.02em",
            marginBottom: 6,
          }}>
            {passed ? "Tebrikler, geçtin!" : "Bu sefer olmadı"}
          </div>
          <div style={{
            fontSize: 13, color: passed ? "#166534" : "#92400e",
            marginBottom: 6,
          }}>
            {result.score} / {result.total} doğru · <strong>%{result.percent}</strong>
          </div>
          <div style={{
            fontSize: 11, color: passed ? "#166534" : "#92400e", opacity: 0.75,
            marginBottom: 12,
          }}>Geçer not: %{result.passThresholdPercent}</div>

          {result.levelPromoted && result.newLevel && (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "8px 14px", borderRadius: 100,
              background: "#22c55e", color: colors.white,
              fontFamily: fonts.heading, fontWeight: 800, fontSize: 12,
            }}>
              <CheckCircle2 size={12} strokeWidth={3} />
              Yeni seviyen: {result.newLevel}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          <button
            onClick={() => navigate("/m/pratik/seviye-sinavlari")}
            style={{
              flex: 1, padding: "12px 16px", borderRadius: 100,
              background: colors.navy50, color: colors.navy, border: "none",
              fontFamily: fonts.heading, fontWeight: 700, fontSize: 13,
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            <ArrowLeft size={12} strokeWidth={2.5} />
            Listeye dön
          </button>
          <button
            onClick={load}
            style={{
              flex: 1, padding: "12px 16px", borderRadius: 100,
              background: colors.brand, color: colors.white, border: "none",
              fontFamily: fonts.heading, fontWeight: 800, fontSize: 13,
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            <RotateCcw size={12} strokeWidth={2.5} />
            Tekrar çöz
          </button>
        </div>

        {/* Cevap anahtarı */}
        <div style={{
          fontFamily: fonts.heading, fontWeight: 700, fontSize: 11,
          color: colors.neutral, textTransform: "uppercase", letterSpacing: "0.06em",
          marginBottom: 10,
        }}>Cevap anahtarı</div>
        {result.review.map((r, i) => (
          <div key={r.questionId} style={{
            padding: 12, marginBottom: 8,
            background: colors.white,
            border: `1px solid ${r.isCorrect ? "#86efac" : "#fca5a5"}`,
            borderRadius: 12,
          }}>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 6 }}>
              <span style={{
                width: 22, height: 22, borderRadius: 11,
                background: r.isCorrect ? "#22c55e" : colors.error,
                color: colors.white,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: fonts.heading, fontWeight: 800, fontSize: 11,
                flexShrink: 0,
              }}>{i + 1}</span>
              <div style={{
                flex: 1, fontSize: 13, color: colors.navy, lineHeight: 1.4,
              }}>{r.prompt}</div>
            </div>
            <div style={{ marginLeft: 28 }}>
              {r.options.map((opt, oi) => {
                const isCorrect = oi === r.correctIndex;
                const isSelected = oi === r.selectedIndex;
                let bg = "transparent"; let color = colors.neutral; let fw = 400;
                if (isCorrect) { bg = "#dcfce7"; color = "#166534"; fw = 700; }
                else if (isSelected) { bg = "#fee2e2"; color = "#991b1b"; }
                return (
                  <div key={oi} style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "4px 8px", borderRadius: 6,
                    background: bg, color, fontWeight: fw as any,
                    fontSize: 12, marginBottom: 2,
                  }}>
                    <span style={{ fontFamily: fonts.heading, fontWeight: 700, opacity: 0.7, minWidth: 14 }}>
                      {String.fromCharCode(65 + oi)}
                    </span>
                    <span style={{ flex: 1 }}>{opt}</span>
                    {isCorrect && <CheckCircle2 size={11} color="#166534" strokeWidth={3} />}
                    {isSelected && !isCorrect && <XCircle size={11} color={colors.error} strokeWidth={3} />}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <Toast {...toast} onClose={hideToast} />
      </ModuleShell>
    );
  }

  // ─── Sınav ────────────────────────────
  const q = questions[currentIdx];
  if (!q) return null;
  const answered = answers[q.id] !== undefined;
  const isLast = currentIdx === questions.length - 1;
  const remainingPct = timeLimit > 0 ? (remaining / (timeLimit * 60)) * 100 : 0;
  const timeLow = remaining <= 60;

  return (
    <ModuleShell
      title={`${level} Sınavı`}
      subtitle={`Soru ${currentIdx + 1} / ${questions.length}`}
      rightAction={
        <div style={{
          display: "flex", alignItems: "center", gap: 4,
          padding: "4px 10px", borderRadius: 100,
          background: timeLow ? colors.error + "22" : colors.navy50,
          color: timeLow ? colors.error : colors.navy,
          fontFamily: fonts.heading, fontWeight: 800, fontSize: 12,
        }}>
          <Clock size={12} strokeWidth={2.5} />
          {fmtTime(remaining)}
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
              display: "flex", alignItems: "center", gap: 4,
            }}
          >
            <ArrowLeft size={14} strokeWidth={2.5} />
            Önceki
          </button>
          {isLast ? (
            <button
              onClick={submit}
              disabled={submitting || answeredCount === 0}
              style={{
                flex: 1, padding: "14px 20px", borderRadius: 100,
                background: colors.turq, color: colors.navy, border: "none",
                fontFamily: fonts.heading, fontWeight: 800, fontSize: 14,
                cursor: submitting ? "not-allowed" : "pointer",
                opacity: submitting || answeredCount === 0 ? 0.5 : 1,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}
            >
              <Send size={14} strokeWidth={2.5} />
              {submitting ? "Gönderiliyor…" : "Bitir ve gönder"}
            </button>
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
      {/* Progress bar (question) */}
      <div style={{
        height: 4, background: colors.navy50, borderRadius: 100,
        marginBottom: 8, overflow: "hidden",
      }}>
        <div style={{
          height: "100%", background: colors.turq,
          width: `${((currentIdx + 1) / questions.length) * 100}%`,
          transition: "width 0.3s",
        }} />
      </div>
      <div style={{
        display: "flex", justifyContent: "space-between",
        fontSize: 11, color: colors.neutral,
        fontFamily: fonts.heading, fontWeight: 700,
        textTransform: "uppercase", letterSpacing: "0.06em",
        marginBottom: 16,
      }}>
        <span>Cevaplanan: {answeredCount}/{questions.length}</span>
        <span style={{ color: timeLow ? colors.error : colors.neutral }}>
          %{Math.round(remainingPct)} kaldı
        </span>
      </div>

      {/* Soru */}
      <div style={{
        fontFamily: fonts.heading, fontWeight: 700, fontSize: 17,
        color: colors.navy, letterSpacing: "-0.01em", lineHeight: 1.4,
        marginBottom: 20,
      }}>{q.prompt}</div>

      {/* Seçenekler */}
      <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
        {q.options.map((opt, i) => {
          const selected = answers[q.id] === i;
          return (
            <button
              key={i}
              onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: i }))}
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
                fontFamily: fonts.heading, fontWeight: 800, fontSize: 11,
                flexShrink: 0,
              }}>{String.fromCharCode(65 + i)}</span>
              <span style={{ flex: 1 }}>{opt}</span>
              {selected && <Check size={16} strokeWidth={3} style={{ marginTop: 3 }} />}
            </button>
          );
        })}
      </div>

      {/* Soru navigatör */}
      <div style={{
        display: "flex", flexWrap: "wrap", gap: 6,
        marginTop: 8,
      }}>
        {questions.map((qq, i) => {
          const isCurrent = i === currentIdx;
          const isAnswered = answers[qq.id] !== undefined;
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
