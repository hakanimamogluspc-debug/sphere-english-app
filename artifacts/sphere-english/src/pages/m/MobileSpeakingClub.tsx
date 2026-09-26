import { useEffect, useState } from "react";
import { API } from "@/lib/api-url";
import {
  ModuleShell, LoadingState, ErrorState, Toast, useToast, MobileModuleIntro,
  colors, fonts, radius,
} from "@/components/mobile";
import {
  Mic, Calendar, Clock, Users, Globe, ExternalLink,
  CheckCircle2, XCircle,
} from "lucide-react";

/**
 * /m/pratik/speaking-club — Mobil Speaking Club
 */

const TOKEN_KEY = "sphere_token";

interface Club {
  id: number; title: string; description: string | null;
  teacherId: number | null; teacherName: string | null;
  scheduledAt: string; durationMinutes: number;
  maxParticipants: number; level: string | null;
  meetingLink: string | null;
  participantCount: number; isJoined: boolean;
}

const LEVEL_COLORS: Record<string, { color: string; bg: string }> = {
  A1: { color: "#166534", bg: "#dcfce7" },
  A2: { color: "#15803d", bg: "#d9f99d" },
  B1: { color: "#1d4ed8", bg: "#dbeafe" },
  B2: { color: "#4338ca", bg: "#e0e7ff" },
  C1: { color: "#6b21a8", bg: "#f3e8ff" },
  C2: { color: "#9d174d", bg: "#fce7f3" },
};

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY)}`,
  };
}

function formatDate(s: string) {
  return new Date(s).toLocaleDateString("tr-TR", {
    weekday: "long", day: "numeric", month: "long",
  });
}
function formatTime(s: string) {
  return new Date(s).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}
function isUpcoming(scheduledAt: string, duration: number) {
  const end = new Date(new Date(scheduledAt).getTime() + duration * 60000);
  return end > new Date();
}

type Filter = "upcoming" | "joined" | "all";

export default function MobileSpeakingClub() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [filter, setFilter] = useState<Filter>("upcoming");
  const { toast, show: showToast, hide: hideToast } = useToast();

  useEffect(() => { fetchClubs(); }, []);

  const fetchClubs = async () => {
    setLoading(true); setError(null);
    try {
      const r = await fetch(`${API}/speaking-clubs`, { headers: authHeaders() });
      if (!r.ok) throw new Error("Veriler yüklenemedi");
      const d = await r.json();
      setClubs(Array.isArray(d) ? d : []);
    } catch (e: any) {
      setError(e?.message || "Bir hata oluştu");
    } finally {
      setLoading(false);
    }
  };

  const join = async (clubId: number) => {
    setPendingId(clubId);
    try {
      const r = await fetch(`${API}/speaking-clubs/${clubId}/join`, {
        method: "POST", headers: authHeaders(),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error((e as any)?.error || "Kayıt olunamadı");
      }
      showToast("Kayıt başarılı", "success");
      fetchClubs();
    } catch (e: any) {
      showToast(e?.message || "Bir hata oluştu", "error");
    } finally {
      setPendingId(null);
    }
  };

  const leave = async (clubId: number) => {
    if (!confirm("Kaydını iptal etmek istediğine emin misin?")) return;
    setPendingId(clubId);
    try {
      const r = await fetch(`${API}/speaking-clubs/${clubId}/leave`, {
        method: "DELETE", headers: authHeaders(),
      });
      if (!r.ok) throw new Error("İşlem başarısız");
      showToast("Kaydın iptal edildi", "success");
      fetchClubs();
    } catch (e: any) {
      showToast(e?.message || "Bir hata oluştu", "error");
    } finally {
      setPendingId(null);
    }
  };

  const openMeeting = (link: string | null) => {
    if (!link) {
      showToast("Toplantı linki henüz yok", "warning");
      return;
    }
    try { window.open(link, "_blank", "noopener,noreferrer"); }
    catch { window.location.href = link; }
  };

  const displayed = clubs.filter((c) => {
    if (filter === "upcoming") return isUpcoming(c.scheduledAt, c.durationMinutes);
    if (filter === "joined") return c.isJoined;
    return true;
  });

  const joinedCount = clubs.filter((c) => c.isJoined).length;
  const upcomingCount = clubs.filter((c) => isUpcoming(c.scheduledAt, c.durationMinutes)).length;

  return (
    <ModuleShell
      title="Speaking Club"
      subtitle="Canlı konuşma etkinlikleri"
    >
      <MobileModuleIntro moduleKey="speaking_club" />

      {/* Özet */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6,
        marginBottom: 16,
      }}>
        <StatBox label="Toplam" value={String(clubs.length)} icon={<Mic size={14} />} tint={colors.navy} />
        <StatBox label="Kayıtlı" value={String(joinedCount)} icon={<CheckCircle2 size={14} />} tint="#16a34a" />
        <StatBox label="Yaklaşan" value={String(upcomingCount)} icon={<Calendar size={14} />} tint={colors.turqDeep} />
      </div>

      {/* Filtre chip */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {([
          { key: "upcoming" as const, label: "Yaklaşan" },
          { key: "joined"   as const, label: "Kayıtlı" },
          { key: "all"      as const, label: "Tümü" },
        ]).map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              flex: 1, padding: "8px 12px", borderRadius: 100,
              background: filter === f.key ? colors.navy : colors.white,
              color: filter === f.key ? colors.white : colors.navy,
              border: `1px solid ${filter === f.key ? colors.navy : colors.navy100}`,
              fontFamily: fonts.heading, fontWeight: 700, fontSize: 12,
              cursor: "pointer",
            }}
          >{f.label}</button>
        ))}
      </div>

      {loading ? (
        <LoadingState compact messages={["Etkinlikler yükleniyor…"]} />
      ) : error ? (
        <ErrorState title="Yüklenemedi" message={error} onRetry={fetchClubs} />
      ) : displayed.length === 0 ? (
        <div style={{
          padding: 40, textAlign: "center",
          color: colors.neutral, fontSize: 13,
        }}>
          <Mic size={32} color={colors.navy100} style={{ marginBottom: 12 }} />
          <div>Bu filtreyle etkinlik bulunamadı</div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {displayed.map((c) => {
            const upcoming = isUpcoming(c.scheduledAt, c.durationMinutes);
            const full = c.participantCount >= c.maxParticipants;
            const pending = pendingId === c.id;
            const levelStyle = c.level ? LEVEL_COLORS[c.level] : null;
            const fillPct = Math.min(100, (c.participantCount / c.maxParticipants) * 100);
            return (
              <div key={c.id} style={{
                background: colors.white,
                border: `1px solid ${c.isJoined ? "#86efac" : upcoming ? colors.navy100 : colors.navy50}`,
                borderRadius: radius.card,
                borderLeft: `4px solid ${c.isJoined ? "#22c55e" : upcoming ? colors.turq : colors.navy100}`,
                padding: 14,
                opacity: !upcoming ? 0.7 : 1,
              }}>
                {/* Başlık + rozetler */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 6,
                  flexWrap: "wrap", marginBottom: 8,
                }}>
                  <div style={{
                    fontFamily: fonts.heading, fontWeight: 800, fontSize: 15,
                    color: colors.navy, letterSpacing: "-0.01em",
                    flex: "1 1 auto", minWidth: 0,
                  }}>{c.title}</div>
                  {c.level && levelStyle && (
                    <span style={{
                      padding: "2px 6px", borderRadius: 6,
                      background: levelStyle.bg, color: levelStyle.color,
                      fontFamily: fonts.heading, fontWeight: 800, fontSize: 9,
                      letterSpacing: "0.04em",
                    }}>{c.level}</span>
                  )}
                  {c.isJoined && (
                    <span style={{
                      padding: "2px 6px", borderRadius: 6,
                      background: "#dcfce7", color: "#166534",
                      fontFamily: fonts.heading, fontWeight: 800, fontSize: 9,
                      display: "flex", alignItems: "center", gap: 2,
                      textTransform: "uppercase", letterSpacing: "0.04em",
                    }}>
                      <CheckCircle2 size={9} strokeWidth={3} />
                      Kayıtlı
                    </span>
                  )}
                  {!upcoming && (
                    <span style={{
                      padding: "2px 6px", borderRadius: 6,
                      background: colors.navy50, color: colors.neutral,
                      fontFamily: fonts.heading, fontWeight: 700, fontSize: 9,
                      textTransform: "uppercase", letterSpacing: "0.04em",
                    }}>Bitti</span>
                  )}
                </div>

                {/* Açıklama */}
                {c.description && (
                  <div style={{
                    fontSize: 12, color: colors.neutral,
                    lineHeight: 1.5, marginBottom: 10,
                  }}>{c.description}</div>
                )}

                {/* Bilgiler grid */}
                <div style={{
                  display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6,
                  fontSize: 11, color: colors.navy400, marginBottom: 8,
                }}>
                  <InfoLine icon={<Calendar size={11} />} text={formatDate(c.scheduledAt)} />
                  <InfoLine icon={<Clock size={11} />} text={`${formatTime(c.scheduledAt)} · ${c.durationMinutes}dk`} />
                  <InfoLine icon={<Users size={11} />} text={`${c.participantCount}/${c.maxParticipants}`} highlight={full && !c.isJoined ? colors.error : undefined} />
                  {c.teacherName && <InfoLine icon={<Globe size={11} />} text={c.teacherName} />}
                </div>

                {/* Doluluk çubuğu */}
                <div style={{
                  height: 3, background: colors.navy50,
                  borderRadius: 100, overflow: "hidden", marginBottom: 12,
                }}>
                  <div style={{
                    height: "100%",
                    background: full ? colors.error : colors.turq,
                    width: `${fillPct}%`, borderRadius: 100,
                    transition: "width 0.3s",
                  }} />
                </div>

                {/* Aksiyonlar */}
                {upcoming && (
                  <div style={{ display: "flex", gap: 6 }}>
                    {c.isJoined ? (
                      <>
                        <button
                          onClick={() => leave(c.id)}
                          disabled={pending}
                          style={{
                            padding: "10px 14px", borderRadius: 100,
                            background: colors.white,
                            color: colors.error,
                            border: `1px solid ${colors.error}55`,
                            fontFamily: fonts.heading, fontWeight: 700, fontSize: 12,
                            cursor: pending ? "not-allowed" : "pointer",
                            opacity: pending ? 0.5 : 1,
                            display: "flex", alignItems: "center", gap: 4,
                          }}
                        >
                          <XCircle size={12} strokeWidth={2.5} />
                          İptal
                        </button>
                        {c.meetingLink && (
                          <button
                            onClick={() => openMeeting(c.meetingLink)}
                            style={{
                              flex: 1, padding: "10px 14px", borderRadius: 100,
                              background: colors.brand, color: colors.white, border: "none",
                              fontFamily: fonts.heading, fontWeight: 800, fontSize: 13,
                              cursor: "pointer",
                              display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                            }}
                          >
                            <ExternalLink size={12} strokeWidth={2.5} />
                            Etkinliğe Katıl
                          </button>
                        )}
                      </>
                    ) : (
                      <button
                        onClick={() => join(c.id)}
                        disabled={full || pending}
                        style={{
                          flex: 1, padding: "10px 14px", borderRadius: 100,
                          background: full ? colors.navy50 : colors.navy,
                          color: full ? colors.neutral : colors.white,
                          border: "none",
                          fontFamily: fonts.heading, fontWeight: 800, fontSize: 13,
                          cursor: (full || pending) ? "not-allowed" : "pointer",
                          opacity: pending ? 0.5 : 1,
                        }}
                      >{pending ? "…" : full ? "Dolu" : "Kayıt Ol"}</button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Toast {...toast} onClose={hideToast} />
    </ModuleShell>
  );
}

function StatBox({ label, value, icon, tint }: { label: string; value: string; icon: React.ReactNode; tint: string }) {
  return (
    <div style={{
      padding: 12, background: colors.white,
      border: `1px solid ${colors.navy50}`, borderRadius: 12,
      textAlign: "center",
    }}>
      <div style={{ color: tint, marginBottom: 4, display: "flex", justifyContent: "center" }}>{icon}</div>
      <div style={{
        fontFamily: fonts.heading, fontWeight: 900, fontSize: 18,
        color: colors.navy, letterSpacing: "-0.01em", lineHeight: 1,
      }}>{value}</div>
      <div style={{
        fontFamily: fonts.heading, fontWeight: 700, fontSize: 9,
        color: colors.neutral, textTransform: "uppercase", letterSpacing: "0.04em",
        marginTop: 4,
      }}>{label}</div>
    </div>
  );
}

function InfoLine({ icon, text, highlight }: { icon: React.ReactNode; text: string; highlight?: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 4,
      color: highlight || colors.navy400,
      fontWeight: highlight ? 700 : 500,
      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
    }}>
      {icon}
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{text}</span>
    </div>
  );
}
