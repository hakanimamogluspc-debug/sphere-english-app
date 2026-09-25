import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { API } from "@/lib/api-url";
import { TabBar, colors, fonts, radius, type TabKey } from "@/components/mobile";
import {
  Mic, PenLine, Brain, Gamepad2, Briefcase, GraduationCap, Presentation,
  Wand2, Compass, Trophy, BookOpen, Users, BookMarked, Newspaper,
  ChevronRight,
} from "lucide-react";

/**
 * /m/pratik — Mobil pratik sekmesi
 * Genel keşif ilerlemesi + tüm modüllerin grid'i
 */

const TOKEN_KEY = "sphere_token";

const MODULES = [
  { key: "pronunciation_coach", name: "Konuşma Koçu",       icon: Mic,           color: "#a78bfa", href: "/m/pratik/konusma-kocu" },
  { key: "writing_coach",       name: "Yazma Koçu",         icon: PenLine,       color: "#60a5fa", href: "/m/pratik/yazma-kocu" },
  { key: "grammar_coach",       name: "Dilbilgisi Koçu",    icon: Brain,         color: "#6366f1", href: "/m/pratik/dilbilgisi-kocu" },
  { key: "vocab_game",          name: "Kelime Oyunu",       icon: Gamepad2,      color: "#f472b6", href: "/m/pratik/kelime-oyunu" },
  { key: "simulation_mode",     name: "İş Senaryoları",     icon: Briefcase,     color: "#fb923c", href: "/m/pratik/is-senaryolari" },
  { key: "interview_sim",       name: "Mülakat Simülatörü", icon: GraduationCap, color: "#34d399", href: "/student/interview-sim" },
  { key: "presentation_sim",    name: "Sunum Simülatörü",   icon: Presentation,  color: "#f97316", href: "/student/presentation-sim" },
  { key: "ai_quiz",             name: "Akıllı Quiz",        icon: Wand2,         color: "#8b5cf6", href: "/m/pratik/akilli-quiz" },
  { key: "ai_tutor",            name: "Kişisel AI Öğretmen", icon: GraduationCap, color: "#14b8a6", href: "/student/ai-tutor" },
  { key: "learning_path",       name: "Öğrenme Yolu",       icon: Compass,       color: "#0ea5e9", href: "/student/learning-path" },
  { key: "level_exams",         name: "Seviye Sınavları",   icon: Trophy,        color: "#eab308", href: "/student/level-exams" },
  { key: "speaking_scenes",     name: "Konuşma Sahneleri",  icon: Mic,           color: "#f43f5e", href: "/student/speaking-scenes" },
  { key: "student_materials",   name: "Materyallerim",      icon: BookOpen,      color: "#64748b", href: "/student/materials" },
  { key: "student_speaking_club", name: "Speaking Club",    icon: Users,         color: "#06b6d4", href: "/student/speaking-club" },
  { key: "business_cards",      name: "İş Kartları",        icon: BookMarked,    color: "#f59e0b", href: "/is-kartlari" },
  { key: "discover",            name: "Keşfet",             icon: Newspaper,     color: "#d946ef", href: "/kesfet" },
];

async function apiFetch(path: string) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.error || `HTTP ${res.status}`);
  return data;
}

export default function MobilePractice() {
  const [, setLocation] = useLocation();
  const [summary, setSummary] = useState<any>(null);
  const [moduleStats, setModuleStats] = useState<Record<string, any>>({});

  useEffect(() => {
    apiFetch("/student/learning-map")
      .then((r) => {
        setSummary(r.summary ?? null);
        const stats: Record<string, any> = {};
        (r.modules ?? []).forEach((m: any) => {
          stats[m.key] = m;
        });
        setModuleStats(stats);
      })
      .catch(() => {});
  }, []);

  const handleTab = (t: TabKey) => {
    if (t === "home") setLocation("/m/anasayfa");
    else if (t === "practice") setLocation("/m/pratik");
    else if (t === "library") setLocation("/m/kutuphane");
    else if (t === "rewards") setLocation("/m/kazanim");
    else if (t === "profile") setLocation("/m/profil");
  };

  const explorationPct = summary?.exploration_pct ?? 0;

  return (
    <div style={{ minHeight: "100vh", background: colors.white, paddingBottom: 88 }}>
      <div style={{ padding: "24px 20px 0" }}>
        <div style={{
          fontFamily: fonts.heading, fontWeight: 700, fontSize: 11,
          color: colors.turqDeep, textTransform: "uppercase", letterSpacing: "0.06em",
          marginBottom: 6,
        }}>Pratik</div>
        <div style={{
          fontFamily: fonts.heading, fontWeight: 900, fontSize: 26,
          letterSpacing: "-0.02em", color: colors.navy, lineHeight: 1.15,
          marginBottom: 20,
        }}>
          Yolculuğun,<br/>
          <span style={{ position: "relative", display: "inline-block" }}>
            bir bakışta
            <span style={{
              position: "absolute", left: 0, right: 0, bottom: 2,
              height: 10, background: colors.turq, opacity: 0.85,
              transform: "skewY(-1deg)", zIndex: -1,
            }} />
          </span>.
        </div>

        {/* Özet */}
        {summary && (
          <div style={{
            background: colors.navy50, borderRadius: radius.panel, padding: 20,
            marginBottom: 24,
          }}>
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
              gap: 12, marginBottom: 16,
            }}>
              <StatBlock label="Toplam" value={summary.total_hours ?? 0} unit="s" />
              <StatBlock label="Keşif" value={`${summary.modules_visited ?? 0}`} unit={`/${summary.modules_total ?? 18}`} />
              <StatBlock label="Seviye" value={summary.current_level ?? "—"} />
            </div>
            <div style={{
              height: 6, background: colors.navy100, borderRadius: 100,
              overflow: "hidden",
            }}>
              <div style={{
                height: "100%", background: colors.turq, borderRadius: 100,
                width: `${explorationPct}%`,
              }} />
            </div>
            <div style={{
              display: "flex", justifyContent: "space-between",
              marginTop: 8, fontFamily: fonts.heading, fontWeight: 600, fontSize: 11,
              color: colors.neutral,
            }}>
              <span style={{ color: colors.navy }}>%{explorationPct} keşfedildi</span>
              <span>{(summary.modules_total ?? 18) - (summary.modules_visited ?? 0)} kaldı</span>
            </div>
          </div>
        )}

        {/* Modül grid */}
        <div style={{
          fontFamily: fonts.heading, fontWeight: 700, fontSize: 11,
          color: colors.neutral, textTransform: "uppercase", letterSpacing: "0.06em",
          marginBottom: 12,
        }}>Modüller</div>

        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10,
        }}>
          {MODULES.map((m) => {
            const stat = moduleStats[m.key];
            const visited = stat?.visited;
            const Icon = m.icon;
            return (
              <button
                key={m.key}
                onClick={() => {
                  if (m.href.startsWith("/m/")) setLocation(m.href);
                  else window.location.href = m.href;
                }}
                style={{
                  padding: 14, background: colors.white,
                  border: `1px solid ${visited ? colors.navy100 : colors.navy50}`,
                  borderRadius: 16, cursor: "pointer",
                  textAlign: "left", position: "relative",
                  opacity: visited ? 1 : 0.6,
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: `${m.color}20`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: m.color, marginBottom: 10,
                }}>
                  <Icon size={20} strokeWidth={2} />
                </div>
                <div style={{
                  fontFamily: fonts.heading, fontWeight: 700, fontSize: 13,
                  color: colors.navy, lineHeight: 1.25, marginBottom: 4,
                  letterSpacing: "-0.01em",
                }}>
                  {m.name}
                </div>
                {visited ? (
                  <div style={{
                    fontFamily: fonts.heading, fontWeight: 500, fontSize: 10,
                    color: colors.neutral, textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}>
                    {stat.total_minutes ?? 0} dk · {stat.days_visited ?? 0} gün
                  </div>
                ) : (
                  <div style={{
                    fontFamily: fonts.body, fontStyle: "italic", fontSize: 11,
                    color: colors.neutral,
                  }}>
                    Henüz keşfetmedin
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div style={{ height: 16 }} />
      </div>

      <TabBar active="practice" onChange={handleTab} />
    </div>
  );
}

function StatBlock({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <div>
      <div style={{
        fontFamily: fonts.heading, fontWeight: 800, fontSize: 22,
        color: colors.navy, letterSpacing: "-0.02em", lineHeight: 1,
        display: "flex", alignItems: "baseline", gap: 2,
      }}>
        {value}
        {unit && (
          <small style={{
            fontFamily: fonts.body, fontWeight: 500, fontSize: 11,
            color: colors.neutral,
          }}>{unit}</small>
        )}
      </div>
      <div style={{
        fontFamily: fonts.heading, fontWeight: 600, fontSize: 10,
        color: colors.neutral, textTransform: "uppercase", letterSpacing: "0.06em",
        marginTop: 4,
      }}>{label}</div>
    </div>
  );
}
