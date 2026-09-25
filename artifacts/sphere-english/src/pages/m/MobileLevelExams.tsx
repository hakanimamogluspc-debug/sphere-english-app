import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { API } from "@/lib/api-url";
import {
  ModuleShell, LoadingState, ErrorState, Toast, useToast, MobileModuleIntro,
  colors, fonts, radius,
} from "@/components/mobile";
import {
  GraduationCap, Lock, CheckCircle2, Trophy, Clock, ListChecks,
  Sparkles, RotateCcw, ArrowRight,
} from "lucide-react";

/**
 * /m/pratik/seviye-sinavlari — Mobil Seviye Sınavları HUB
 */

const TOKEN_KEY = "sphere_token";

interface LevelInfo {
  level: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
  unlocked: boolean;
  passed: boolean;
  questionCount: number;
  passThresholdPercent: number;
  timeLimitMinutes: number;
  attempts: number;
  lastAttempt: { id: number; score: number; total: number; percent: number; passed: boolean; completedAt: string } | null;
}

const LEVEL_META: Record<string, { label: string; color: string }> = {
  A1: { label: "Başlangıç",  color: "#fca5a5" },
  A2: { label: "Temel",      color: "#fcd34d" },
  B1: { label: "Orta",       color: "#7dd3fc" },
  B2: { label: "Orta-İleri", color: "#86efac" },
  C1: { label: "İleri",      color: "#a78bfa" },
  C2: { label: "Yetkin",     color: "#f472b6" },
};

export default function MobileLevelExams() {
  const [, navigate] = useLocation();
  const [levels, setLevels] = useState<LevelInfo[]>([]);
  const [currentLevel, setCurrentLevel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast, show: showToast, hide: hideToast } = useToast();

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const r = await fetch(`${API}/level-exams`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error((j as any)?.error || "Liste yüklenemedi");
      }
      const d = await r.json();
      setLevels(d.levels || []);
      setCurrentLevel(d.currentLevel || null);
    } catch (e: any) {
      setError(e?.message || "Bir hata oluştu");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <ModuleShell title="Seviye Sınavları" subtitle="Yükleniyor…">
        <LoadingState compact messages={["Sınavlar yükleniyor…"]} />
      </ModuleShell>
    );
  }

  if (error) {
    return (
      <ModuleShell title="Seviye Sınavları">
        <ErrorState title="Yüklenemedi" message={error} onRetry={load} />
      </ModuleShell>
    );
  }

  const passedCount = levels.filter((l) => l.passed).length;

  return (
    <ModuleShell
      title="Seviye Sınavları"
      subtitle={`${passedCount}/6 geçildi · Mevcut: ${currentLevel || "—"}`}
    >
      <MobileModuleIntro moduleKey="level_exams" />

      <div style={{
        fontFamily: fonts.heading, fontWeight: 700, fontSize: 11,
        color: colors.turqDeep, textTransform: "uppercase", letterSpacing: "0.06em",
        marginBottom: 6,
      }}>Oxford Business Result Tabanlı</div>
      <div style={{
        fontFamily: fonts.heading, fontWeight: 900, fontSize: 24,
        color: colors.navy, letterSpacing: "-0.02em", lineHeight: 1.2,
        marginBottom: 16,
      }}>
        <span style={{ position: "relative", display: "inline-block" }}>
          Seviyeni
          <span style={{
            position: "absolute", left: 0, right: 0, bottom: 2,
            height: 10, background: colors.turq, opacity: 0.85,
            transform: "skewY(-1deg)", zIndex: -1,
          }} />
        </span>{" "}
        yükselt
      </div>

      {/* Genel özet */}
      <div style={{
        background: colors.navy, color: colors.white,
        borderRadius: radius.panel, padding: 16, marginBottom: 20,
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12,
      }}>
        <div>
          <div style={{
            fontFamily: fonts.heading, fontWeight: 700, fontSize: 10,
            color: colors.turq, textTransform: "uppercase", letterSpacing: "0.06em",
            marginBottom: 4,
          }}>Mevcut seviye</div>
          <div style={{
            fontFamily: fonts.heading, fontWeight: 900, fontSize: 26,
            color: colors.turq, letterSpacing: "-0.02em", lineHeight: 1,
          }}>{currentLevel || "—"}</div>
        </div>
        <div>
          <div style={{
            fontFamily: fonts.heading, fontWeight: 700, fontSize: 10,
            color: colors.turq, textTransform: "uppercase", letterSpacing: "0.06em",
            marginBottom: 4,
          }}>Geçilen</div>
          <div style={{
            fontFamily: fonts.heading, fontWeight: 900, fontSize: 26,
            color: colors.white, letterSpacing: "-0.02em", lineHeight: 1,
          }}>{passedCount}<span style={{ fontSize: 14, color: colors.turq }}>/6</span></div>
        </div>
      </div>

      {/* Seviyeler */}
      <div style={{ display: "grid", gap: 8 }}>
        {levels.map((lv) => {
          const meta = LEVEL_META[lv.level];
          const disabled = !lv.unlocked;
          return (
            <div key={lv.level} style={{
              padding: 14,
              background: lv.passed ? "#f0fdf4" : colors.white,
              border: `1px solid ${lv.passed ? "#86efac" : disabled ? colors.navy50 : colors.navy100}`,
              borderRadius: radius.card,
              opacity: disabled ? 0.6 : 1,
            }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 12, marginBottom: 10,
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: `${meta.color}30`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: fonts.heading, fontWeight: 900, fontSize: 15,
                  color: meta.color,
                  flexShrink: 0,
                }}>{lv.level}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: fonts.heading, fontWeight: 800, fontSize: 14,
                    color: colors.navy, letterSpacing: "-0.01em",
                  }}>{meta.label}</div>
                  <div style={{ fontSize: 11, color: colors.neutral, marginTop: 2 }}>
                    {lv.questionCount} soru · {lv.timeLimitMinutes}dk · Geçer: %{lv.passThresholdPercent}
                  </div>
                </div>
                {lv.passed ? (
                  <span style={{
                    padding: "3px 8px", borderRadius: 100,
                    background: "#dcfce7", color: "#166534",
                    fontFamily: fonts.heading, fontWeight: 800, fontSize: 10,
                    textTransform: "uppercase", letterSpacing: "0.04em",
                    display: "flex", alignItems: "center", gap: 3,
                  }}>
                    <CheckCircle2 size={10} strokeWidth={3} />
                    Geçildi
                  </span>
                ) : disabled ? (
                  <span style={{
                    padding: "3px 8px", borderRadius: 100,
                    background: colors.navy50, color: colors.neutral,
                    fontFamily: fonts.heading, fontWeight: 800, fontSize: 10,
                    textTransform: "uppercase", letterSpacing: "0.04em",
                    display: "flex", alignItems: "center", gap: 3,
                  }}>
                    <Lock size={10} strokeWidth={2.5} />
                    Kilitli
                  </span>
                ) : null}
              </div>

              {lv.lastAttempt && (
                <div style={{
                  padding: "8px 10px", borderRadius: 8,
                  background: lv.lastAttempt.passed ? "#dcfce7" : "#fef3c7",
                  color: lv.lastAttempt.passed ? "#166534" : "#92400e",
                  fontSize: 11, marginBottom: 10,
                  display: "flex", justifyContent: "space-between",
                }}>
                  <span style={{ fontWeight: 700 }}>Son: {lv.lastAttempt.percent}%</span>
                  <span style={{ opacity: 0.8 }}>
                    {new Date(lv.lastAttempt.completedAt).toLocaleDateString("tr-TR")} · {lv.attempts} deneme
                  </span>
                </div>
              )}

              <button
                disabled={disabled}
                onClick={() => navigate(`/m/pratik/seviye-sinavlari/${lv.level}`)}
                style={{
                  width: "100%", padding: "10px 16px", borderRadius: 100,
                  background: disabled ? colors.navy50 : lv.passed ? "#dcfce7" : colors.navy,
                  color: disabled ? colors.neutral : lv.passed ? "#166534" : colors.white,
                  border: "none",
                  fontFamily: fonts.heading, fontWeight: 800, fontSize: 13,
                  cursor: disabled ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                }}
              >
                {disabled ? (
                  <><Lock size={12} strokeWidth={2.5} /> Bir önceki seviyeyi geç</>
                ) : lv.passed ? (
                  <><RotateCcw size={12} strokeWidth={2.5} /> Tekrar çöz</>
                ) : (
                  <><ListChecks size={12} strokeWidth={2.5} /> Sınava başla <ArrowRight size={12} strokeWidth={2.5} /></>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Nasıl çalışır */}
      <div style={{
        marginTop: 20, padding: 14, background: colors.navy50,
        borderRadius: 12,
      }}>
        <div style={{
          fontFamily: fonts.heading, fontWeight: 800, fontSize: 12,
          color: colors.navy, marginBottom: 8,
          display: "flex", alignItems: "center", gap: 6,
          textTransform: "uppercase", letterSpacing: "0.06em",
        }}>
          <Clock size={12} strokeWidth={2.5} />
          Nasıl çalışır?
        </div>
        <ul style={{
          margin: 0, paddingLeft: 18,
          fontSize: 12, color: colors.navy, lineHeight: 1.6,
        }}>
          <li>Sorular Oxford Business Result Placement Test'ten alınır.</li>
          <li>%70+ puanla geçersin, seviyen otomatik yükselir.</li>
          <li>Bir üst seviye sınav, mevcutundan 1 üste kadar açıktır.</li>
        </ul>
      </div>

      <Toast {...toast} onClose={hideToast} />
    </ModuleShell>
  );
}
