import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { API } from "@/lib/api-url";
import { TabBar, StreakHero, colors, fonts, radius, type TabKey } from "@/components/mobile";
import { Snowflake, Award, Gift, Check } from "lucide-react";

/**
 * /m/kazanim — Mobil kazanımlar
 * Streak hero + kilometre taşları + ödül kataloğu
 */

const TOKEN_KEY = "sphere_token";

interface Reward {
  id: number;
  name: string;
  description: string;
  cost_freezes: number;
  type: string;
  icon: string;
  affordable: boolean;
  already_owned: boolean;
}

async function apiFetch(path: string, opts: RequestInit = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.error || `HTTP ${res.status}`);
  return data;
}

export default function MobileRewards() {
  const [, setLocation] = useLocation();
  const [streak, setStreak] = useState(0);
  const [freezes, setFreezes] = useState(0);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [flash, setFlash] = useState<string | null>(null);

  const load = () => {
    apiFetch("/student/streak-status").then((r) => {
      setStreak(r.streak ?? 0);
      setFreezes(r.freeze_count ?? 0);
    }).catch(() => {});
    apiFetch("/student/rewards").then((r) => {
      setFreezes(r.current_freezes ?? 0);
      setRewards(r.rewards ?? []);
    }).catch(() => {});
  };

  useEffect(() => { load(); }, []);

  const claim = async (r: Reward) => {
    if (!r.affordable || r.already_owned) return;
    if (!confirm(`"${r.name}" — ${r.cost_freezes} freeze kullanılacak. Onaylıyor musun?`)) return;
    try {
      await apiFetch(`/student/rewards/${r.id}/redeem`, { method: "POST" });
      setFlash(`✓ ${r.name} kazanıldı!`);
      load();
      setTimeout(() => setFlash(null), 2400);
    } catch (e: any) {
      setFlash(e?.message || "Ödül alınamadı");
      setTimeout(() => setFlash(null), 2400);
    }
  };

  const handleTab = (t: TabKey) => {
    if (t === "home") setLocation("/m/anasayfa");
    else if (t === "practice") setLocation("/m/pratik");
    else if (t === "library") setLocation("/m/kutuphane");
    else if (t === "rewards") setLocation("/m/kazanim");
    else if (t === "profile") setLocation("/m/profil");
  };

  const milestones = [7, 30, 100, 365];
  const nextMs = milestones.find((m) => streak < m) ?? 365;
  const daysToNext = nextMs - streak;
  const progressPct = Math.min(100, (streak / nextMs) * 100);

  return (
    <div style={{ minHeight: "100vh", background: colors.white, paddingBottom: 88 }}>
      <div style={{ padding: "24px 20px 0" }}>
        <div style={{
          fontFamily: fonts.heading, fontWeight: 700, fontSize: 11,
          color: colors.turqDeep, textTransform: "uppercase", letterSpacing: "0.06em",
          marginBottom: 6,
        }}>Kazanımlar</div>
        <div style={{
          fontFamily: fonts.heading, fontWeight: 900, fontSize: 26,
          letterSpacing: "-0.02em", color: colors.navy, lineHeight: 1.15,
          marginBottom: 20,
        }}>
          Yolun <span style={{ position: "relative", display: "inline-block" }}>
            şu ana kadar
            <span style={{
              position: "absolute", left: 0, right: 0, bottom: 2,
              height: 10, background: colors.turq, opacity: 0.85,
              transform: "skewY(-1deg)", zIndex: -1,
            }} />
          </span>
        </div>

        <StreakHero
          days={streak}
          subtitle={daysToNext > 0
            ? `Sonraki kilometre taşına ${daysToNext} gün kaldı.`
            : "Muhteşem serin!"}
        />

        {/* Kilometre taşı ilerleme çubuğu */}
        <div style={{
          background: colors.white, border: `1px solid ${colors.navy100}`,
          borderRadius: radius.panel, padding: 20, marginBottom: 24,
        }}>
          <div style={{
            fontFamily: fonts.heading, fontWeight: 700, fontSize: 11,
            color: colors.neutral, textTransform: "uppercase", letterSpacing: "0.06em",
            marginBottom: 16,
          }}>Kilometre taşları</div>
          <div style={{
            position: "relative", height: 4, background: colors.navy50,
            borderRadius: 100, marginBottom: 24,
          }}>
            <div style={{
              position: "absolute", left: 0, top: 0, height: "100%",
              background: colors.turq, borderRadius: 100,
              width: `${progressPct}%`,
            }} />
          </div>
          <div style={{
            display: "flex", justifyContent: "space-between",
            fontFamily: fonts.heading, fontWeight: 600, fontSize: 11,
            color: colors.neutral,
          }}>
            <span style={{ color: colors.navy, fontWeight: 800 }}>0g</span>
            {milestones.map((m) => (
              <span key={m} style={{
                color: streak >= m ? colors.navy : colors.neutral,
                fontWeight: streak >= m ? 800 : 600,
              }}>{m}g</span>
            ))}
          </div>
        </div>

        {/* Ödüller */}
        <div style={{
          fontFamily: fonts.heading, fontWeight: 700, fontSize: 18,
          color: colors.navy, marginBottom: 4,
        }}>Ödüller</div>
        <div style={{ fontSize: 13, color: colors.neutral, marginBottom: 16 }}>
          <strong style={{ color: colors.navy }}>{freezes} freeze</strong> harcayarak alabilecekler
        </div>

        {rewards.map((r) => (
          <div
            key={r.id}
            onClick={() => claim(r)}
            style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: 14, marginBottom: 8,
              background: colors.white,
              border: `1px solid ${r.affordable ? colors.navy100 : colors.navy50}`,
              borderRadius: 16,
              opacity: r.already_owned ? 0.55 : 1,
              cursor: r.affordable && !r.already_owned ? "pointer" : "not-allowed",
              transition: "all 0.2s ease",
            }}
          >
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: r.affordable ? colors.turq : colors.navy50,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: r.affordable ? colors.navy : colors.navy,
              flexShrink: 0, fontSize: 22,
            }}>
              {r.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: fonts.heading, fontWeight: 700, fontSize: 14,
                color: colors.navy,
              }}>
                {r.name}
                {r.already_owned && (
                  <span style={{
                    marginLeft: 8, padding: "2px 8px", fontSize: 10,
                    background: colors.success, color: colors.white,
                    borderRadius: 100, fontWeight: 700,
                  }}>Sende</span>
                )}
              </div>
              <div style={{ fontSize: 12, color: colors.neutral, marginTop: 2 }}>
                {r.description}
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{
                fontFamily: fonts.heading, fontWeight: 800, fontSize: 18,
                color: colors.navy, letterSpacing: "-0.02em", lineHeight: 1,
                display: "flex", alignItems: "center", gap: 4,
                justifyContent: "flex-end",
              }}>
                <Snowflake size={14} color={colors.turqDeep} strokeWidth={2} />
                {r.cost_freezes}
              </div>
            </div>
          </div>
        ))}

        {rewards.length === 0 && (
          <div style={{
            textAlign: "center", padding: 40, color: colors.neutral, fontSize: 14,
          }}>Ödüller yükleniyor…</div>
        )}
      </div>

      {/* Toast */}
      {flash && (
        <div style={{
          position: "fixed", left: "50%", bottom: 96, transform: "translateX(-50%)",
          background: colors.navy, color: colors.white,
          padding: "12px 20px", borderRadius: 100,
          fontFamily: fonts.heading, fontWeight: 700, fontSize: 13,
          boxShadow: "0 4px 16px rgba(30, 58, 110, 0.16)",
          zIndex: 40, whiteSpace: "nowrap",
        }}>
          {flash}
        </div>
      )}

      <TabBar active="rewards" onChange={handleTab} />
    </div>
  );
}
