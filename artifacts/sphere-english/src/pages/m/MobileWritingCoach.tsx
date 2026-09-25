import { useEffect, useState } from "react";
import { API } from "@/lib/api-url";
import {
  ModuleShell, LoadingState, Toast, useToast, MobileModuleIntro,
  colors, fonts, radius,
} from "@/components/mobile";
import {
  PenLine, Mail, FileText, BookOpen, ClipboardList,
  Sparkles, ChevronDown, ChevronUp,
  CheckCircle2, AlertCircle, Star, Lightbulb, Copy,
} from "lucide-react";

/**
 * /m/pratik/yazma-kocu — Mobil Yazma Koçu
 *
 * Backend:
 *   POST /api/writing/analyze
 *   Body: { text, writingType, topic }
 *   Response: { analysis: {...} }
 */

const TOKEN_KEY = "sphere_token";
const DRAFT_KEY = "mobile_writing_draft_v1";

interface Draft {
  text: string;
  topic: string;
  writingType: string;
  updatedAt: number;
}

interface Analysis {
  overallScore: string;
  overallComment: string;
  grammarScore: number;
  vocabularyScore: number;
  coherenceScore: number;
  styleScore: number;
  strengths?: string[];
  improvements?: string[];
  grammarErrors?: Array<{ original: string; corrected: string; explanation: string }>;
  vocabularySuggestions?: Array<{ original: string; advanced: string; example: string }>;
  grammarFeedback?: string;
  vocabularyFeedback?: string;
  coherenceFeedback?: string;
  styleFeedback?: string;
  improvedVersion?: string;
}

const WRITING_TYPES = [
  { value: "general",        label: "Genel",       icon: PenLine,        color: "#64748b" },
  { value: "business-email", label: "İş E-postası", icon: Mail,           color: "#3b82f6" },
  { value: "formal-letter",  label: "Resmi Mektup", icon: FileText,       color: "#a855f7" },
  { value: "essay",          label: "Essay",        icon: BookOpen,       color: "#22c55e" },
  { value: "report",         label: "Rapor",        icon: ClipboardList,  color: "#f97316" },
];

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

export default function MobileWritingCoach() {
  const [writingType, setWritingType] = useState("general");
  const [topic, setTopic] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Analysis | null>(null);
  const { toast, show: showToast, hide: hideToast } = useToast();

  // Draft yükle
  useEffect(() => {
    const d = loadDraft();
    if (d) {
      setText(d.text || "");
      setTopic(d.topic || "");
      setWritingType(d.writingType || "general");
    }
  }, []);

  // Draft kaydet (debounce)
  useEffect(() => {
    const t = setTimeout(() => {
      if (text || topic) {
        saveDraft({ text, topic, writingType, updatedAt: Date.now() });
      }
    }, 400);
    return () => clearTimeout(t);
  }, [text, topic, writingType]);

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const charCount = text.length;
  const overLimit = charCount > 3000;

  const analyze = async () => {
    if (text.trim().length < 20) {
      showToast("En az 20 karakter yaz", "warning");
      return;
    }
    if (overLimit) {
      showToast("3000 karakter sınırını aştın", "warning");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const res = await fetch(`${API}/writing/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text, writingType, topic }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any)?.error || "Analiz başarısız");
      setResult(data.analysis);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e: any) {
      showToast(e?.message || "Bir hata oluştu", "error");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setResult(null);
    setText("");
    setTopic("");
    saveDraft(null);
  };

  const copyImproved = async () => {
    if (!result?.improvedVersion) return;
    try {
      await navigator.clipboard.writeText(result.improvedVersion);
      showToast("Geliştirilmiş versiyon kopyalandı", "success");
    } catch {
      showToast("Kopyalanamadı", "error");
    }
  };

  if (loading) {
    return (
      <ModuleShell title="Yazma Koçu" subtitle="Analiz ediliyor…">
        <LoadingState
          messages={[
            "Metnin okunuyor…",
            "Dilbilgisi ve kelime incelenmesi…",
            "Bağlantı ve stil değerlendirmesi…",
            "Öneriler hazırlanıyor…",
          ]}
          hint={`${wordCount} kelime · ${WRITING_TYPES.find((t) => t.value === writingType)?.label}`}
        />
      </ModuleShell>
    );
  }

  // ─── Sonuç ekranı ─────────────────────────────────────────────
  if (result) {
    return (
      <ModuleShell
        title="Analiz Raporu"
        subtitle={topic || WRITING_TYPES.find((t) => t.value === writingType)?.label}
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
          >Yeni</button>
        }
      >
        {/* Ana skor kartı */}
        <div style={{
          background: colors.navy, color: colors.white,
          borderRadius: radius.panel, padding: 20, marginBottom: 16,
        }}>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "flex-start",
            gap: 12, marginBottom: 16,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: fonts.heading, fontWeight: 700, fontSize: 11,
                color: colors.turq, textTransform: "uppercase", letterSpacing: "0.06em",
                marginBottom: 6,
              }}>Genel değerlendirme</div>
              <div style={{ fontSize: 13, lineHeight: 1.5, opacity: 0.92 }}>
                {result.overallComment}
              </div>
            </div>
            <div style={{
              flexShrink: 0, textAlign: "center",
              background: colors.turq, color: colors.navy,
              padding: "10px 14px", borderRadius: 12,
              minWidth: 60,
            }}>
              <div style={{
                fontFamily: fonts.heading, fontWeight: 900, fontSize: 22,
                lineHeight: 1, letterSpacing: "-0.02em",
              }}>{result.overallScore}</div>
              <div style={{
                fontSize: 9, fontWeight: 700, marginTop: 2,
                textTransform: "uppercase", letterSpacing: "0.04em",
              }}>Seviye</div>
            </div>
          </div>

          {/* 4 skor */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6 }}>
            <MiniScore label="Gramer" score={result.grammarScore} />
            <MiniScore label="Kelime" score={result.vocabularyScore} />
            <MiniScore label="Bağlantı" score={result.coherenceScore} />
            <MiniScore label="Stil" score={result.styleScore} />
          </div>
        </div>

        {/* Skor çubukları */}
        <div style={{
          background: colors.white, border: `1px solid ${colors.navy50}`,
          borderRadius: 16, padding: 14, marginBottom: 16,
        }}>
          <ScoreBar label="Dilbilgisi" score={result.grammarScore} />
          <ScoreBar label="Kelime Hazinesi" score={result.vocabularyScore} />
          <ScoreBar label="Bağlantı" score={result.coherenceScore} />
          <ScoreBar label="Stil" score={result.styleScore} last />
        </div>

        {/* Güçlü / Geliştirilecek */}
        {(result.strengths?.length || result.improvements?.length) && (
          <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
            {result.strengths && result.strengths.length > 0 && (
              <div style={{
                padding: 14, background: "#dcfce7",
                borderRadius: 12, border: `1px solid #86efac`,
              }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 6,
                  fontFamily: fonts.heading, fontWeight: 800, fontSize: 12,
                  color: "#166534", marginBottom: 8,
                  textTransform: "uppercase", letterSpacing: "0.06em",
                }}>
                  <CheckCircle2 size={14} />
                  Güçlü yönler
                </div>
                {result.strengths.map((s, i) => (
                  <div key={i} style={{
                    display: "flex", gap: 6, alignItems: "flex-start",
                    fontSize: 13, color: "#166534", lineHeight: 1.5,
                    marginBottom: 4,
                  }}>
                    <Star size={12} style={{ marginTop: 3, flexShrink: 0 }} />
                    <span>{s}</span>
                  </div>
                ))}
              </div>
            )}
            {result.improvements && result.improvements.length > 0 && (
              <div style={{
                padding: 14, background: "#fef3c7",
                borderRadius: 12, border: `1px solid #fcd34d`,
              }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 6,
                  fontFamily: fonts.heading, fontWeight: 800, fontSize: 12,
                  color: "#92400e", marginBottom: 8,
                  textTransform: "uppercase", letterSpacing: "0.06em",
                }}>
                  <Lightbulb size={14} />
                  Geliştirilecek alanlar
                </div>
                {result.improvements.map((s, i) => (
                  <div key={i} style={{
                    display: "flex", gap: 6, alignItems: "flex-start",
                    fontSize: 13, color: "#92400e", lineHeight: 1.5,
                    marginBottom: 4,
                  }}>
                    <AlertCircle size={12} style={{ marginTop: 3, flexShrink: 0 }} />
                    <span>{s}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Gramer hataları */}
        {result.grammarErrors && result.grammarErrors.length > 0 && (
          <CollapsibleSection
            title={`Dilbilgisi hataları (${result.grammarErrors.length})`}
            icon={<AlertCircle size={14} />}
            defaultOpen
          >
            {result.grammarFeedback && (
              <div style={{
                fontSize: 12, color: colors.neutral, fontStyle: "italic",
                marginBottom: 10, lineHeight: 1.4,
              }}>{result.grammarFeedback}</div>
            )}
            {result.grammarErrors.map((err, i) => (
              <div key={i} style={{
                padding: 12, marginBottom: 8,
                background: colors.white, borderRadius: 10,
                border: `1px solid ${colors.navy50}`,
              }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginBottom: 6 }}>
                  <span style={{
                    background: "#fee2e2", color: "#991b1b",
                    padding: "2px 8px", borderRadius: 6,
                    fontSize: 12, textDecoration: "line-through", fontFamily: "monospace",
                  }}>{err.original}</span>
                  <span style={{ color: colors.neutral }}>→</span>
                  <span style={{
                    background: "#dcfce7", color: "#166534",
                    padding: "2px 8px", borderRadius: 6,
                    fontSize: 12, fontFamily: "monospace", fontWeight: 700,
                  }}>{err.corrected}</span>
                </div>
                <div style={{ fontSize: 12, color: colors.neutral, lineHeight: 1.4 }}>
                  {err.explanation}
                </div>
              </div>
            ))}
          </CollapsibleSection>
        )}

        {/* Kelime önerileri */}
        {result.vocabularySuggestions && result.vocabularySuggestions.length > 0 && (
          <CollapsibleSection
            title={`Kelime önerileri (${result.vocabularySuggestions.length})`}
            icon={<BookOpen size={14} />}
            defaultOpen
          >
            {result.vocabularyFeedback && (
              <div style={{
                fontSize: 12, color: colors.neutral, fontStyle: "italic",
                marginBottom: 10, lineHeight: 1.4,
              }}>{result.vocabularyFeedback}</div>
            )}
            {result.vocabularySuggestions.map((s, i) => (
              <div key={i} style={{
                padding: 12, marginBottom: 8,
                background: colors.white, borderRadius: 10,
                border: `1px solid ${colors.navy50}`,
              }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginBottom: 6 }}>
                  <span style={{
                    background: colors.navy50, color: colors.navy400,
                    padding: "2px 8px", borderRadius: 6,
                    fontSize: 12, fontFamily: "monospace",
                  }}>{s.original}</span>
                  <span style={{ color: colors.neutral }}>→</span>
                  <span style={{
                    background: colors.turq + "22", color: colors.turqDeep,
                    padding: "2px 8px", borderRadius: 6,
                    fontSize: 12, fontFamily: "monospace", fontWeight: 700,
                  }}>{s.advanced}</span>
                </div>
                {s.example && (
                  <div style={{
                    fontSize: 12, color: colors.neutral, lineHeight: 1.4,
                    fontStyle: "italic",
                  }}>"{s.example}"</div>
                )}
              </div>
            ))}
          </CollapsibleSection>
        )}

        {result.coherenceFeedback && (
          <CollapsibleSection title="Bağlantı & Akış" icon={<ClipboardList size={14} />}>
            <div style={{ fontSize: 13, color: colors.navy, lineHeight: 1.5 }}>
              {result.coherenceFeedback}
            </div>
          </CollapsibleSection>
        )}

        {result.styleFeedback && (
          <CollapsibleSection title="Yazı stili" icon={<Star size={14} />}>
            <div style={{ fontSize: 13, color: colors.navy, lineHeight: 1.5 }}>
              {result.styleFeedback}
            </div>
          </CollapsibleSection>
        )}

        {result.improvedVersion && (
          <CollapsibleSection title="Geliştirilmiş versiyon" icon={<Sparkles size={14} />} defaultOpen>
            <div style={{
              padding: 14, background: colors.turq + "12",
              border: `1px solid ${colors.turq}55`,
              borderRadius: 10,
              fontSize: 13, color: colors.navy, lineHeight: 1.6,
              whiteSpace: "pre-wrap",
              marginBottom: 8,
            }}>{result.improvedVersion}</div>
            <button
              onClick={copyImproved}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 12px", borderRadius: 100,
                background: colors.white, color: colors.navy,
                border: `1px solid ${colors.navy100}`,
                fontFamily: fonts.heading, fontWeight: 700, fontSize: 12,
                cursor: "pointer",
              }}
            >
              <Copy size={12} strokeWidth={2.5} />
              Kopyala
            </button>
          </CollapsibleSection>
        )}

        <button
          onClick={reset}
          style={{
            width: "100%", padding: "14px 20px", borderRadius: 100,
            background: colors.navy, color: colors.white, border: "none",
            fontFamily: fonts.heading, fontWeight: 800, fontSize: 14,
            cursor: "pointer", marginTop: 16,
          }}
        >Yeni analiz</button>

        <Toast {...toast} onClose={hideToast} />
      </ModuleShell>
    );
  }

  // ─── Setup ekranı ─────────────────────────────────────────
  return (
    <ModuleShell
      title="Yazma Koçu"
      subtitle="AI destekli yazı analizi"
    >
      <MobileModuleIntro moduleKey="writing_coach" />

      <div style={{
        fontFamily: fonts.heading, fontWeight: 700, fontSize: 11,
        color: colors.turqDeep, textTransform: "uppercase", letterSpacing: "0.06em",
        marginBottom: 6,
      }}>Yeni analiz</div>
      <div style={{
        fontFamily: fonts.heading, fontWeight: 900, fontSize: 26,
        color: colors.navy, letterSpacing: "-0.02em", lineHeight: 1.15,
        marginBottom: 20,
      }}>
        Yazını{" "}
        <span style={{ position: "relative", display: "inline-block" }}>
          değerlendirelim
          <span style={{
            position: "absolute", left: 0, right: 0, bottom: 2,
            height: 10, background: colors.turq, opacity: 0.85,
            transform: "skewY(-1deg)", zIndex: -1,
          }} />
        </span>.
      </div>

      {/* Yazı türü */}
      <div style={{
        fontFamily: fonts.heading, fontWeight: 700, fontSize: 11,
        color: colors.neutral, textTransform: "uppercase", letterSpacing: "0.06em",
        marginBottom: 8,
      }}>Yazı türü</div>
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6,
        marginBottom: 20,
      }}>
        {WRITING_TYPES.map(({ value, label, icon: Icon, color }) => {
          const selected = writingType === value;
          return (
            <button
              key={value}
              onClick={() => setWritingType(value)}
              style={{
                padding: "12px 6px", borderRadius: 12,
                background: selected ? colors.navy : colors.white,
                color: selected ? colors.white : colors.navy,
                border: `1px solid ${selected ? colors.navy : colors.navy100}`,
                fontFamily: fonts.heading, fontWeight: 700, fontSize: 11,
                cursor: "pointer",
                display: "flex", flexDirection: "column",
                alignItems: "center", gap: 6, minHeight: 68,
              }}
            >
              <div style={{
                width: 26, height: 26, borderRadius: 8,
                background: selected ? colors.turq : `${color}22`,
                color: selected ? colors.navy : color,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Icon size={14} strokeWidth={2.5} />
              </div>
              {label}
            </button>
          );
        })}
      </div>

      {/* Konu */}
      <div style={{
        fontFamily: fonts.heading, fontWeight: 700, fontSize: 11,
        color: colors.neutral, textTransform: "uppercase", letterSpacing: "0.06em",
        marginBottom: 8,
      }}>
        Konu <span style={{ opacity: 0.6, textTransform: "none" }}>(isteğe bağlı)</span>
      </div>
      <input
        type="text"
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        placeholder='Örn: "Uzaktan çalışmanın etkileri"'
        style={{
          width: "100%", padding: "12px 14px", borderRadius: 12,
          border: `1px solid ${colors.navy100}`,
          fontFamily: fonts.body, fontSize: 14,
          background: colors.white, color: colors.navy,
          outline: "none", marginBottom: 20,
        }}
      />

      {/* Metin */}
      <div style={{
        display: "flex", justifyContent: "space-between",
        marginBottom: 8,
      }}>
        <span style={{
          fontFamily: fonts.heading, fontWeight: 700, fontSize: 11,
          color: colors.neutral, textTransform: "uppercase", letterSpacing: "0.06em",
        }}>Metnin</span>
        <span style={{
          fontFamily: fonts.heading, fontSize: 11, fontWeight: 600,
          color: overLimit ? colors.error : colors.neutral,
        }}>{wordCount} kelime · {charCount}/3000</span>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="İngilizce yazını buraya yaz veya yapıştır…"
        rows={12}
        style={{
          width: "100%", padding: "12px 14px", borderRadius: 12,
          border: `1px solid ${overLimit ? colors.error : colors.navy100}`,
          fontFamily: fonts.body, fontSize: 14, lineHeight: 1.6,
          background: colors.white, color: colors.navy,
          outline: "none", resize: "vertical",
          marginBottom: 20, minHeight: 200,
        }}
      />

      <button
        onClick={analyze}
        disabled={text.trim().length < 20 || overLimit}
        style={{
          width: "100%", padding: "16px 20px", borderRadius: 100,
          background: colors.navy, color: colors.white, border: "none",
          fontFamily: fonts.heading, fontWeight: 800, fontSize: 15,
          cursor: text.trim().length < 20 ? "not-allowed" : "pointer",
          opacity: text.trim().length < 20 || overLimit ? 0.5 : 1,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}
      >
        <Sparkles size={16} strokeWidth={2.5} />
        Metni Analiz Et
      </button>

      <Toast {...toast} onClose={hideToast} />
    </ModuleShell>
  );
}

function MiniScore({ label, score }: { label: string; score: number }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.12)", borderRadius: 10,
      padding: "8px 6px", textAlign: "center",
    }}>
      <div style={{
        fontFamily: fonts.heading, fontWeight: 900, fontSize: 16,
        color: colors.white, letterSpacing: "-0.01em", lineHeight: 1,
      }}>
        {score}
        <span style={{ fontSize: 9, color: colors.turq, marginLeft: 1 }}>/10</span>
      </div>
      <div style={{
        fontSize: 9, color: colors.turq, marginTop: 3,
        fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em",
      }}>{label}</div>
    </div>
  );
}

function ScoreBar({ label, score, last }: { label: string; score: number; last?: boolean }) {
  const barColor = score >= 8 ? "#22c55e" : score >= 6 ? colors.turq : score >= 4 ? colors.warn : colors.error;
  return (
    <div style={{ marginBottom: last ? 0 : 10 }}>
      <div style={{
        display: "flex", justifyContent: "space-between", marginBottom: 4,
      }}>
        <span style={{ fontSize: 12, color: colors.navy, fontWeight: 600 }}>{label}</span>
        <span style={{
          fontFamily: fonts.heading, fontWeight: 800, fontSize: 12,
          color: barColor,
        }}>{score}/10</span>
      </div>
      <div style={{
        height: 5, background: colors.navy50, borderRadius: 100,
        overflow: "hidden",
      }}>
        <div style={{
          height: "100%", background: barColor,
          width: `${score * 10}%`, borderRadius: 100,
          transition: "width 0.4s ease",
        }} />
      </div>
    </div>
  );
}

function CollapsibleSection({
  title, icon, defaultOpen, children,
}: {
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div style={{
      border: `1px solid ${colors.navy50}`, borderRadius: 12,
      overflow: "hidden", marginBottom: 8, background: colors.white,
    }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%", display: "flex", alignItems: "center",
          justifyContent: "space-between", padding: 14,
          background: "transparent", border: "none", cursor: "pointer",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 8,
            background: colors.navy50, color: colors.navy,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>{icon}</div>
          <span style={{
            fontFamily: fonts.heading, fontWeight: 700, fontSize: 13,
            color: colors.navy, textAlign: "left",
          }}>{title}</span>
        </div>
        {open
          ? <ChevronUp size={16} color={colors.neutral} />
          : <ChevronDown size={16} color={colors.neutral} />
        }
      </button>
      {open && (
        <div style={{
          padding: "0 14px 14px",
        }}>{children}</div>
      )}
    </div>
  );
}
