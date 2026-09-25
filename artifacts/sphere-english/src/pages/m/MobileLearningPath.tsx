import { useEffect, useMemo, useState } from "react";
import { API } from "@/lib/api-url";
import {
  ModuleShell, LoadingState, Toast, useToast, MobileModuleIntro,
  colors, fonts, radius,
} from "@/components/mobile";
import {
  Compass, Sparkles, ChevronDown, ChevronUp, Check,
  Mic, Headphones, BookOpen, Brain, PenLine, Award, RotateCcw,
  Clock, Target, Zap, ExternalLink,
} from "lucide-react";

/**
 * /m/pratik/ogrenme-yolu — Mobil Öğrenme Yolu
 * AI ile haftalık kişisel plan üretir, adımları check'lersin.
 */

const TOKEN_KEY = "sphere_token";

interface Step {
  id: string; weekNumber: number; dayLabel: string;
  titleTr: string; descriptionTr: string;
  estimatedMinutes: number; category: string;
  featureLink: string | null; featureLabel: string | null;
  rationaleTr: string; isCompleted: boolean; completedAt: string | null;
}
interface WeekSummary { weekNumber: number; themeTr: string; goalTr: string; }
interface Plan {
  overallGoalTr: string;
  cefrTarget: string;
  weeklySummaries: WeekSummary[];
  steps: Step[];
  recommendationsTr: string[];
  generationContextTr: string;
}
interface PathRow {
  id: number; title: string; cefrAtGeneration: string | null;
  plan: Plan; createdAt: string; updatedAt: string;
}

const CATEGORY_META: Record<string, { label: string; icon: any; color: string; bg: string; href: string }> = {
  speaking:   { label: "Konuşma",   icon: Mic,        color: "#7c3aed", bg: "#ede9fe", href: "/m/pratik/konusma-kocu" },
  listening:  { label: "Dinleme",   icon: Headphones, color: "#0369a1", bg: "#dbeafe", href: "/m/kutuphane" },
  vocabulary: { label: "Kelime",    icon: BookOpen,   color: "#0891b2", bg: "#cffafe", href: "/m/pratik/kelime-oyunu" },
  grammar:    { label: "Dilbilgisi",icon: Brain,      color: "#9d174d", bg: "#fce7f3", href: "/m/pratik/dilbilgisi-kocu" },
  writing:    { label: "Yazma",     icon: PenLine,    color: "#b45309", bg: "#fef3c7", href: "/m/pratik/yazma-kocu" },
  reading:    { label: "Okuma",     icon: BookOpen,   color: "#15803d", bg: "#dcfce7", href: "/m/kutuphane" },
  exam_prep:  { label: "Sınav",     icon: Award,      color: "#b91c1c", bg: "#fee2e2", href: "/m/pratik/akilli-quiz" },
  review:     { label: "Tekrar",    icon: RotateCcw,  color: "#52525b", bg: "#f4f4f5", href: "/m/pratik" },
};

async function fetchAuth(path: string, init: RequestInit = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  return fetch(`${API}${path}`, {
    ...init,
    headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` },
  });
}

export default function MobileLearningPath() {
  const [path, setPath] = useState<PathRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [focusInput, setFocusInput] = useState("");
  const [expandedWeek, setExpandedWeek] = useState<number>(1);
  const [showRegenerate, setShowRegenerate] = useState(false);
  const { toast, show: showToast, hide: hideToast } = useToast();

  useEffect(() => { refresh(); }, []);

  const refresh = async () => {
    setLoading(true);
    try {
      const r = await fetchAuth("/learning-path/current");
      if (r.ok) {
        const d = await r.json();
        setPath(d.path);
        if (d.path?.plan?.steps?.length) {
          const first = d.path.plan.steps.find((s: Step) => !s.isCompleted);
          setExpandedWeek(first?.weekNumber || 1);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const generate = async () => {
    setGenerating(true);
    try {
      const r = await fetchAuth("/learning-path/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ focusTr: focusInput.trim() || undefined }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error((j as any)?.error || "Plan oluşturulamadı");
      }
      const d = await r.json();
      setPath(d.path);
      setExpandedWeek(1);
      setFocusInput("");
      setShowRegenerate(false);
    } catch (e: any) {
      showToast(e?.message || "Bir hata oluştu", "error");
    } finally {
      setGenerating(false);
    }
  };

  const toggleStep = async (stepId: string) => {
    if (!path) return;
    const orig = path;
    const newSteps = path.plan.steps.map((s) =>
      s.id === stepId
        ? { ...s, isCompleted: !s.isCompleted, completedAt: !s.isCompleted ? new Date().toISOString() : null }
        : s
    );
    setPath({ ...path, plan: { ...path.plan, steps: newSteps } });
    try {
      const r = await fetchAuth(`/learning-path/${path.id}/step/${stepId}/toggle`, { method: "POST" });
      if (!r.ok) throw new Error();
      const d = await r.json();
      setPath(d.path);
    } catch {
      setPath(orig);
      showToast("İşaretlenemedi", "error");
    }
  };

  const stats = useMemo(() => {
    if (!path) return { total: 0, done: 0, pct: 0, totalMin: 0, doneMin: 0 };
    const total = path.plan.steps.length;
    const done = path.plan.steps.filter((s) => s.isCompleted).length;
    const totalMin = path.plan.steps.reduce((sum, s) => sum + s.estimatedMinutes, 0);
    const doneMin = path.plan.steps.filter((s) => s.isCompleted).reduce((sum, s) => sum + s.estimatedMinutes, 0);
    return { total, done, pct: total ? Math.round((done / total) * 100) : 0, totalMin, doneMin };
  }, [path]);

  const stepsByWeek = useMemo(() => {
    if (!path) return new Map<number, Step[]>();
    const m = new Map<number, Step[]>();
    for (const s of path.plan.steps) {
      if (!m.has(s.weekNumber)) m.set(s.weekNumber, []);
      m.get(s.weekNumber)!.push(s);
    }
    return m;
  }, [path]);

  // ─── Loading ─────────────────────────────────
  if (loading) {
    return (
      <ModuleShell title="Öğrenme Yolu" subtitle="Yükleniyor…">
        <LoadingState messages={["Planın kontrol ediliyor…"]} compact />
      </ModuleShell>
    );
  }

  // ─── Generating ─────────────────────────────
  if (generating) {
    return (
      <ModuleShell title="Öğrenme Yolu" subtitle="Plan oluşturuluyor…">
        <LoadingState
          messages={[
            "İngilizce seviyenle hedeflerin analiz ediliyor…",
            "Haftalar tasarlanıyor…",
            "Kişisel adımlar hazırlanıyor…",
            "Öneriler yazılıyor…",
            "Neredeyse hazır…",
          ]}
          hint="Bu 20-40 saniye sürebilir"
        />
      </ModuleShell>
    );
  }

  // ─── Empty state — plan yok ────────────────
  if (!path) {
    return (
      <ModuleShell title="Öğrenme Yolu" subtitle="Sana özel plan oluştur">
        <MobileModuleIntro moduleKey="learning_path" />

        <div style={{ padding: "16px 0 24px" }}>
          <div style={{
            width: 72, height: 72, borderRadius: 36,
            background: colors.turq + "18",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 20px",
          }}>
            <Compass size={34} color={colors.turqDeep} strokeWidth={2} />
          </div>
          <div style={{
            fontFamily: fonts.heading, fontWeight: 900, fontSize: 24,
            color: colors.navy, letterSpacing: "-0.02em", lineHeight: 1.2,
            textAlign: "center", marginBottom: 8,
          }}>
            Kişisel yol{" "}
            <span style={{ position: "relative", display: "inline-block" }}>
              haritan
              <span style={{
                position: "absolute", left: 0, right: 0, bottom: 2,
                height: 10, background: colors.turq, opacity: 0.85,
                transform: "skewY(-1deg)", zIndex: -1,
              }} />
            </span>
          </div>
          <div style={{
            fontSize: 13, color: colors.neutral, lineHeight: 1.55,
            textAlign: "center", maxWidth: 320, margin: "0 auto 24px",
          }}>
            AI, seviyene ve hedeflerine göre 4 haftalık kişisel bir plan hazırlar.
            İstersen özel bir odak ekleyebilirsin.
          </div>

          <div style={{
            fontFamily: fonts.heading, fontWeight: 700, fontSize: 11,
            color: colors.neutral, textTransform: "uppercase", letterSpacing: "0.06em",
            marginBottom: 8,
          }}>
            Özel odak <span style={{ opacity: 0.6, textTransform: "none" }}>(opsiyonel)</span>
          </div>
          <input
            type="text"
            value={focusInput}
            onChange={(e) => setFocusInput(e.target.value)}
            placeholder="Örn: İş görüşmelerine hazırlık"
            style={{
              width: "100%", padding: "12px 14px", borderRadius: 12,
              border: `1px solid ${colors.navy100}`,
              fontFamily: fonts.body, fontSize: 14,
              background: colors.white, color: colors.navy,
              outline: "none", marginBottom: 20,
            }}
          />
          <button
            onClick={generate}
            style={{
              width: "100%", padding: "16px 20px", borderRadius: 100,
              background: colors.navy, color: colors.white, border: "none",
              fontFamily: fonts.heading, fontWeight: 800, fontSize: 15,
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            <Sparkles size={16} strokeWidth={2.5} />
            Planı Oluştur
          </button>
        </div>

        <Toast {...toast} onClose={hideToast} />
      </ModuleShell>
    );
  }

  // ─── Plan görünümü ─────────────────────────
  return (
    <ModuleShell
      title="Öğrenme Yolu"
      subtitle={`${stats.done}/${stats.total} adım · %${stats.pct}`}
      rightAction={
        <button
          onClick={() => setShowRegenerate((v) => !v)}
          aria-label="Yeni plan"
          style={{
            background: colors.navy50, border: "none",
            width: 36, height: 36, borderRadius: 18,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: colors.navy,
          }}
        >
          <Sparkles size={14} strokeWidth={2.5} />
        </button>
      }
    >
      <MobileModuleIntro moduleKey="learning_path" />

      {/* Yeni plan üretme paneli */}
      {showRegenerate && (
        <div style={{
          padding: 14, background: colors.navy50, borderRadius: 12,
          marginBottom: 16,
        }}>
          <div style={{
            fontFamily: fonts.heading, fontWeight: 800, fontSize: 12,
            color: colors.navy, marginBottom: 8,
            textTransform: "uppercase", letterSpacing: "0.06em",
          }}>Yeni plan oluştur</div>
          <div style={{ fontSize: 12, color: colors.neutral, marginBottom: 10, lineHeight: 1.5 }}>
            Mevcut planın üstüne yenisini yazacak. Emin misin?
          </div>
          <input
            type="text"
            value={focusInput}
            onChange={(e) => setFocusInput(e.target.value)}
            placeholder="Özel odak (opsiyonel)"
            style={{
              width: "100%", padding: "10px 12px", borderRadius: 10,
              border: `1px solid ${colors.navy100}`,
              fontFamily: fonts.body, fontSize: 13,
              background: colors.white, color: colors.navy,
              outline: "none", marginBottom: 8,
            }}
          />
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => setShowRegenerate(false)}
              style={{
                padding: "8px 14px", borderRadius: 100,
                background: colors.white, color: colors.navy,
                border: `1px solid ${colors.navy100}`,
                fontFamily: fonts.heading, fontWeight: 700, fontSize: 12,
                cursor: "pointer",
              }}
            >Vazgeç</button>
            <button
              onClick={generate}
              style={{
                flex: 1, padding: "8px 14px", borderRadius: 100,
                background: colors.navy, color: colors.white, border: "none",
                fontFamily: fonts.heading, fontWeight: 800, fontSize: 12,
                cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}
            >
              <Sparkles size={12} strokeWidth={2.5} />
              Yeni plan
            </button>
          </div>
        </div>
      )}

      {/* Hedef kartı */}
      <div style={{
        background: colors.navy, color: colors.white,
        borderRadius: radius.panel, padding: 20, marginBottom: 16,
      }}>
        <div style={{
          fontFamily: fonts.heading, fontWeight: 700, fontSize: 10,
          color: colors.turq, textTransform: "uppercase", letterSpacing: "0.06em",
          marginBottom: 6,
        }}>Hedef</div>
        <div style={{
          fontFamily: fonts.heading, fontWeight: 900, fontSize: 18,
          letterSpacing: "-0.01em", lineHeight: 1.3, marginBottom: 12,
        }}>{path.plan.overallGoalTr}</div>
        <div style={{
          fontSize: 12, opacity: 0.85, lineHeight: 1.5, marginBottom: 14,
        }}>{path.plan.generationContextTr}</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <StatMini label="Tamamlanan" value={`${stats.done}/${stats.total}`} />
          <StatMini label="Süre" value={`${Math.round(stats.doneMin)}/${Math.round(stats.totalMin)}dk`} />
          <StatMini label="Seviye" value={path.plan.cefrTarget} />
        </div>

        {/* Progress */}
        <div style={{
          height: 4, background: "rgba(255,255,255,0.16)",
          borderRadius: 100, overflow: "hidden", marginTop: 12,
        }}>
          <div style={{
            height: "100%", background: colors.turq,
            width: `${stats.pct}%`, transition: "width 0.4s",
          }} />
        </div>
      </div>

      {/* Öneriler */}
      {path.plan.recommendationsTr && path.plan.recommendationsTr.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{
            fontFamily: fonts.heading, fontWeight: 700, fontSize: 11,
            color: colors.neutral, textTransform: "uppercase", letterSpacing: "0.06em",
            marginBottom: 8,
          }}>Genel öneriler</div>
          <div style={{ display: "grid", gap: 6 }}>
            {path.plan.recommendationsTr.slice(0, 3).map((r, i) => (
              <div key={i} style={{
                padding: 10, background: colors.turq + "10",
                borderLeft: `3px solid ${colors.turq}`,
                borderRadius: 8,
                fontSize: 13, color: colors.navy, lineHeight: 1.5,
              }}>💡 {r}</div>
            ))}
          </div>
        </div>
      )}

      {/* Haftalar */}
      <div style={{
        fontFamily: fonts.heading, fontWeight: 700, fontSize: 11,
        color: colors.neutral, textTransform: "uppercase", letterSpacing: "0.06em",
        marginBottom: 10,
      }}>Haftalar</div>

      {path.plan.weeklySummaries.map((wk) => {
        const steps = stepsByWeek.get(wk.weekNumber) || [];
        const weekDone = steps.filter((s) => s.isCompleted).length;
        const weekPct = steps.length > 0 ? (weekDone / steps.length) * 100 : 0;
        const isExpanded = expandedWeek === wk.weekNumber;
        return (
          <div key={wk.weekNumber} style={{
            marginBottom: 8,
            background: colors.white,
            border: `1px solid ${colors.navy50}`,
            borderRadius: 14, overflow: "hidden",
          }}>
            <button
              onClick={() => setExpandedWeek(isExpanded ? -1 : wk.weekNumber)}
              style={{
                width: "100%", padding: 14,
                background: "transparent", border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 12, textAlign: "left",
              }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: weekPct === 100 ? colors.turq : colors.navy50,
                color: weekPct === 100 ? colors.navy : colors.navy,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: fonts.heading, fontWeight: 900, fontSize: 14,
                flexShrink: 0,
              }}>
                {weekPct === 100 ? <Check size={16} strokeWidth={3} /> : wk.weekNumber}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: fonts.heading, fontWeight: 800, fontSize: 14,
                  color: colors.navy, letterSpacing: "-0.01em",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>Hafta {wk.weekNumber}: {wk.themeTr}</div>
                <div style={{
                  fontSize: 11, color: colors.neutral, marginTop: 2,
                }}>{weekDone}/{steps.length} tamamlandı</div>
                <div style={{
                  height: 3, background: colors.navy50, borderRadius: 100,
                  overflow: "hidden", marginTop: 6,
                }}>
                  <div style={{
                    height: "100%", background: colors.turq,
                    width: `${weekPct}%`, transition: "width 0.3s",
                  }} />
                </div>
              </div>
              {isExpanded
                ? <ChevronUp size={16} color={colors.neutral} />
                : <ChevronDown size={16} color={colors.neutral} />
              }
            </button>

            {isExpanded && (
              <div style={{ padding: "0 12px 12px" }}>
                <div style={{
                  fontSize: 12, color: colors.neutral, lineHeight: 1.5,
                  padding: "8px 12px", background: colors.navy50, borderRadius: 8,
                  marginBottom: 10, fontStyle: "italic",
                }}>{wk.goalTr}</div>

                {steps.map((s) => (
                  <StepCard key={s.id} step={s} onToggle={() => toggleStep(s.id)} />
                ))}
              </div>
            )}
          </div>
        );
      })}

      <div style={{ height: 12 }} />
      <Toast {...toast} onClose={hideToast} />
    </ModuleShell>
  );
}

function StatMini({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      padding: 8, background: "rgba(255,255,255,0.12)",
      borderRadius: 10, textAlign: "center",
    }}>
      <div style={{
        fontFamily: fonts.heading, fontWeight: 900, fontSize: 15,
        color: colors.white, letterSpacing: "-0.01em", lineHeight: 1,
      }}>{value}</div>
      <div style={{
        fontSize: 9, color: colors.turq, marginTop: 4,
        fontFamily: fonts.heading, fontWeight: 700,
        textTransform: "uppercase", letterSpacing: "0.06em",
      }}>{label}</div>
    </div>
  );
}

function StepCard({ step, onToggle }: { step: Step; onToggle: () => void }) {
  const cat = CATEGORY_META[step.category] || CATEGORY_META.review;
  const Icon = cat.icon;
  const href = step.featureLink || cat.href;
  return (
    <div style={{
      display: "flex", gap: 10, alignItems: "flex-start",
      padding: 12, marginBottom: 6,
      background: step.isCompleted ? colors.navy50 : colors.white,
      border: `1px solid ${step.isCompleted ? colors.turq + "88" : colors.navy100}`,
      borderRadius: 12,
      opacity: step.isCompleted ? 0.85 : 1,
    }}>
      <button
        onClick={onToggle}
        aria-label={step.isCompleted ? "Tamamlanmadı olarak işaretle" : "Tamamlandı olarak işaretle"}
        style={{
          width: 22, height: 22, borderRadius: 11,
          background: step.isCompleted ? colors.turq : colors.white,
          border: `2px solid ${step.isCompleted ? colors.turq : colors.navy100}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", flexShrink: 0, marginTop: 2, padding: 0,
        }}
      >
        {step.isCompleted && <Check size={12} color={colors.navy} strokeWidth={3} />}
      </button>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 4, marginBottom: 4,
        }}>
          <span style={{
            padding: "2px 6px", borderRadius: 6,
            background: cat.bg, color: cat.color,
            fontFamily: fonts.heading, fontWeight: 800, fontSize: 9,
            textTransform: "uppercase", letterSpacing: "0.04em",
            display: "flex", alignItems: "center", gap: 3,
          }}>
            <Icon size={9} strokeWidth={2.5} />
            {cat.label}
          </span>
          <span style={{
            fontSize: 10, color: colors.neutral,
            display: "flex", alignItems: "center", gap: 2,
          }}>
            <Clock size={9} strokeWidth={2.5} />
            {step.estimatedMinutes}dk
          </span>
          <span style={{
            fontFamily: fonts.heading, fontWeight: 700, fontSize: 10,
            color: colors.neutral, marginLeft: "auto",
            textTransform: "uppercase", letterSpacing: "0.04em",
          }}>{step.dayLabel}</span>
        </div>
        <div style={{
          fontFamily: fonts.heading, fontWeight: 700, fontSize: 13,
          color: colors.navy, letterSpacing: "-0.01em",
          lineHeight: 1.3, marginBottom: 4,
          textDecoration: step.isCompleted ? "line-through" : "none",
        }}>{step.titleTr}</div>
        <div style={{
          fontSize: 12, color: colors.neutral, lineHeight: 1.4, marginBottom: 6,
        }}>{step.descriptionTr}</div>

        {step.rationaleTr && (
          <div style={{
            fontSize: 11, color: colors.turqDeep, fontStyle: "italic",
            marginBottom: 6, lineHeight: 1.4,
          }}>Neden: {step.rationaleTr}</div>
        )}

        {(step.featureLink || cat.href) && (
          <button
            onClick={() => { window.location.href = href; }}
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "6px 10px", borderRadius: 100,
              background: colors.white, color: colors.navy,
              border: `1px solid ${colors.navy100}`,
              fontFamily: fonts.heading, fontWeight: 700, fontSize: 11,
              cursor: "pointer",
            }}
          >
            {step.featureLabel || "Modüle git"}
            <ExternalLink size={11} strokeWidth={2.5} />
          </button>
        )}
      </div>
    </div>
  );
}
