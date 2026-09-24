import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { API } from "@/lib/api-url";
import { useAuth } from "@/hooks/use-auth";
import { TabBar, colors, fonts, radius, type TabKey } from "@/components/mobile";
import {
  Settings, Bell, LogOut, HelpCircle, Gift, MapPin,
  ChevronRight, User as UserIcon,
} from "lucide-react";

/**
 * /m/profil — Mobil profil
 * Kimlik + istatistik + menü
 */

const TOKEN_KEY = "sphere_token";

async function apiFetch(path: string) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.error || `HTTP ${res.status}`);
  return data;
}

export default function MobileProfile() {
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    apiFetch("/student/learning-map")
      .then((r) => setStats(r.summary ?? null))
      .catch(() => {});
  }, []);

  const handleTab = (t: TabKey) => {
    if (t === "home") setLocation("/m/anasayfa");
    else if (t === "practice") setLocation("/m/pratik");
    else if (t === "library") setLocation("/m/kutuphane");
    else if (t === "rewards") setLocation("/m/kazanim");
    else if (t === "profile") setLocation("/m/profil");
  };

  const firstName = user?.firstName ?? "";
  const lastName = user?.lastName ?? "";
  const fullName = `${firstName} ${lastName}`.trim() || "Sphere Öğrenci";
  const initial = firstName[0]?.toUpperCase() ?? "S";
  const level = user?.currentLevel ?? "—";

  return (
    <div style={{ minHeight: "100vh", background: colors.white, paddingBottom: 88 }}>
      <div style={{ padding: "32px 20px 0" }}>
        {/* Kimlik */}
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          textAlign: "center", marginBottom: 24,
        }}>
          <div style={{
            width: 88, height: 88, borderRadius: 24,
            background: colors.navy, color: colors.white,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: fonts.heading, fontWeight: 800, fontSize: 36,
            letterSpacing: "-0.02em", position: "relative", marginBottom: 16,
          }}>
            {initial}
            <div style={{
              position: "absolute", bottom: -4, right: -4,
              width: 20, height: 20, borderRadius: "50%",
              background: colors.turq, border: `3px solid ${colors.white}`,
            }} />
          </div>
          <div style={{
            fontFamily: fonts.heading, fontWeight: 800, fontSize: 22,
            letterSpacing: "-0.02em", color: colors.navy,
          }}>{fullName}</div>
          <div style={{ fontSize: 13, color: colors.neutral, marginTop: 4 }}>
            {user?.accountType === "kurumsal" ? "Kurumsal" : "Bireysel"} · {level} seviyesi
          </div>
        </div>

        {/* Stat grid */}
        {stats && (
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12,
            marginBottom: 24,
          }}>
            <div style={{
              background: colors.white, border: `1px solid ${colors.navy100}`,
              borderRadius: 16, padding: 16,
            }}>
              <div style={{
                fontFamily: fonts.heading, fontWeight: 600, fontSize: 10,
                color: colors.neutral, textTransform: "uppercase", letterSpacing: "0.06em",
                marginBottom: 6,
              }}>Toplam süre</div>
              <div style={{
                fontFamily: fonts.heading, fontWeight: 800, fontSize: 22,
                color: colors.navy, letterSpacing: "-0.02em", lineHeight: 1,
                display: "flex", alignItems: "baseline", gap: 4,
              }}>
                {stats.total_hours || 0}
                <small style={{ fontFamily: fonts.body, fontWeight: 500, fontSize: 12, color: colors.neutral }}>
                  saat
                </small>
              </div>
            </div>
            <div style={{
              background: colors.white, border: `1px solid ${colors.navy100}`,
              borderRadius: 16, padding: 16,
            }}>
              <div style={{
                fontFamily: fonts.heading, fontWeight: 600, fontSize: 10,
                color: colors.neutral, textTransform: "uppercase", letterSpacing: "0.06em",
                marginBottom: 6,
              }}>Keşif</div>
              <div style={{
                fontFamily: fonts.heading, fontWeight: 800, fontSize: 22,
                color: colors.navy, letterSpacing: "-0.02em", lineHeight: 1,
                display: "flex", alignItems: "baseline", gap: 4,
              }}>
                {stats.modules_visited || 0}
                <small style={{ fontFamily: fonts.body, fontWeight: 500, fontSize: 12, color: colors.neutral }}>
                  /{stats.modules_total || 18}
                </small>
              </div>
            </div>
            <div style={{
              background: colors.white, border: `1px solid ${colors.navy100}`,
              borderRadius: 16, padding: 16,
            }}>
              <div style={{
                fontFamily: fonts.heading, fontWeight: 600, fontSize: 10,
                color: colors.neutral, textTransform: "uppercase", letterSpacing: "0.06em",
                marginBottom: 6,
              }}>Seri</div>
              <div style={{
                fontFamily: fonts.heading, fontWeight: 800, fontSize: 22,
                color: colors.navy, letterSpacing: "-0.02em", lineHeight: 1,
                display: "flex", alignItems: "baseline", gap: 4,
              }}>
                {stats.streak || 0}
                <small style={{ fontFamily: fonts.body, fontWeight: 500, fontSize: 12, color: colors.neutral }}>
                  gün
                </small>
              </div>
            </div>
            <div style={{
              background: colors.white, border: `1px solid ${colors.navy100}`,
              borderRadius: 16, padding: 16,
            }}>
              <div style={{
                fontFamily: fonts.heading, fontWeight: 600, fontSize: 10,
                color: colors.neutral, textTransform: "uppercase", letterSpacing: "0.06em",
                marginBottom: 6,
              }}>Freeze</div>
              <div style={{
                fontFamily: fonts.heading, fontWeight: 800, fontSize: 22,
                color: colors.navy, letterSpacing: "-0.02em", lineHeight: 1,
              }}>
                {String(stats.streak_freezes || 0).padStart(2, "0")}
              </div>
            </div>
          </div>
        )}

        {/* Menü */}
        <div>
          <MenuItem icon={<MapPin size={20} strokeWidth={2} />} label="Öğrenme Yolculuğum" onClick={() => window.location.href = "/yolculugum"} />
          <MenuItem icon={<Gift size={20} strokeWidth={2} />} label="Arkadaşını Davet Et" onClick={() => window.location.href = "/davet"} />
          <MenuItem icon={<Bell size={20} strokeWidth={2} />} label="Bildirim Ayarları" onClick={() => window.location.href = "/ayarlar/bildirimler"} />
          <MenuItem icon={<UserIcon size={20} strokeWidth={2} />} label="Hesap Bilgileri" onClick={() => window.location.href = "/dashboard"} />
          <MenuItem icon={<HelpCircle size={20} strokeWidth={2} />} label="Yardım & Destek" onClick={() => window.location.href = "/dashboard"} />
          <MenuItem
            icon={<LogOut size={20} strokeWidth={2} />}
            label="Çıkış Yap"
            onClick={() => { if (confirm("Çıkış yapmak istediğine emin misin?")) logout(); }}
            danger
          />
        </div>

        <div style={{
          textAlign: "center", marginTop: 32, marginBottom: 16,
          fontSize: 11, color: colors.neutral,
        }}>
          Sphere English · Kurumsal İş İngilizcesi
        </div>
      </div>

      <TabBar active="profile" onChange={handleTab} />
    </div>
  );
}

function MenuItem({
  icon, label, onClick, danger,
}: {
  icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: 14,
        padding: "16px 0",
        background: "transparent", border: "none",
        borderBottom: `1px solid ${colors.navy50}`,
        cursor: "pointer",
      }}
    >
      <div style={{
        width: 36, height: 36, display: "flex",
        alignItems: "center", justifyContent: "center",
        color: danger ? colors.error : colors.navy,
      }}>
        {icon}
      </div>
      <div style={{
        flex: 1, textAlign: "left",
        fontFamily: fonts.heading, fontWeight: 600, fontSize: 14,
        color: danger ? colors.error : colors.navy,
      }}>
        {label}
      </div>
      <ChevronRight size={16} strokeWidth={2} color={colors.navy200} />
    </button>
  );
}
