import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { colors, fonts, radius } from "@/components/mobile";
import { Check, ChevronRight, Sparkles } from "lucide-react";

/**
 * MobileGuidedJourneyCard — Post-placement 7 günlük plan (mobile versiyonu).
 * MobileHome'da FocusCard'ın altına mount edilir.
 */

interface Task {
  id: string;
  label: string;
  href: string;
  icon: string;
  completed: boolean;
}

interface JourneyToday {
  dayNumber: number;
  totalDays: number;
  isCompletedWeek: boolean;
  title: string;
  subtitle: string;
  tasks: Task[];
  allDone: boolean;
}

const TOKEN_KEY = "sphere_token";

export default function MobileGuidedJourneyCard() {
  const [, navigate] = useLocation();
  const [data, setData] = useState<JourneyToday | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem(TOKEN_KEY);
        const res = await fetch("/api/journey/today", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) setData(await res.json());
      } catch { /* ignore */ }
    })();
  }, []);

  if (!data) return null;

  // Haftalık plan tamamlandıysa küçük "başardın" rozeti
  if (data.isCompletedWeek) {
    return (
      <div style={{
        marginTop: 16,
        background: `linear-gradient(135deg, ${colors.success}, ${colors.turqDeep})`,
        borderRadius: radius.panel,
        padding: "16px 18px",
        display: "flex", alignItems: "center", gap: 12,
        color: colors.onBrand,
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: "50%",
          background: "rgba(255,255,255,0.2)",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <Sparkles size={20} />
        </div>
        <div>
          <div style={{ fontFamily: fonts.heading, fontWeight: 800, fontSize: 15 }}>
            Başlangıç haftanı tamamladın 🎉
          </div>
          <div style={{ fontFamily: fonts.body, fontSize: 12, opacity: 0.9, marginTop: 2 }}>
            Günlük tekrar ve pratik yapmaya devam et.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      marginTop: 16,
      background: colors.white,
      borderRadius: radius.panel,
      border: `2px solid ${colors.turq}44`,
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, ${colors.brand}, ${colors.turqDeep})`,
        color: colors.onBrand,
        padding: "14px 16px",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{
              fontFamily: fonts.heading, fontWeight: 700, fontSize: 10,
              textTransform: "uppercase", letterSpacing: "0.14em", opacity: 0.85,
            }}>
              Başlangıç Planı · {data.dayNumber} / {data.totalDays}
            </div>
            <div style={{
              fontFamily: fonts.heading, fontWeight: 800, fontSize: 15, marginTop: 2,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {data.title}
            </div>
          </div>
          {/* Day pills */}
          <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
            {Array.from({ length: data.totalDays }, (_, i) => (
              <div key={i} style={{
                width: 6, height: 6, borderRadius: "50%",
                background: i + 1 < data.dayNumber ? "rgba(255,255,255,0.8)"
                  : i + 1 === data.dayNumber ? "#ffffff"
                  : "rgba(255,255,255,0.3)",
              }} />
            ))}
          </div>
        </div>
        <div style={{
          fontFamily: fonts.body, fontSize: 12, opacity: 0.9, marginTop: 4, lineHeight: 1.4,
        }}>
          {data.subtitle}
        </div>
      </div>

      {/* Tasks */}
      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 6 }}>
        {data.tasks.map((task) => (
          <div
            key={task.id}
            onClick={() => navigate(task.href)}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px", borderRadius: radius.chip,
              border: `2px solid ${task.completed ? colors.success + "55" : colors.navy100}`,
              background: task.completed ? colors.successBg : colors.white,
              cursor: "pointer",
            }}
          >
            <div style={{ fontSize: 20, flexShrink: 0 }}>{task.icon}</div>
            <div style={{
              flex: 1, minWidth: 0,
              fontFamily: fonts.body, fontSize: 13,
              fontWeight: 600,
              color: task.completed ? colors.successText : colors.navy,
              textDecoration: task.completed ? "line-through" : "none",
            }}>
              {task.label}
            </div>
            {task.completed ? (
              <Check size={16} color={colors.success} />
            ) : (
              <ChevronRight size={16} color={colors.neutral} />
            )}
          </div>
        ))}

        {data.allDone && (
          <div style={{
            marginTop: 6, padding: 10,
            background: colors.successBg,
            border: `1px solid ${colors.successBorder}`,
            borderRadius: radius.chip,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <Sparkles size={14} color={colors.success} />
            <div style={{
              fontFamily: fonts.body, fontSize: 12, color: colors.successText, flex: 1,
            }}>
              Bugünkü planı tamamladın! Yarın yeni görevler bekliyor.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
