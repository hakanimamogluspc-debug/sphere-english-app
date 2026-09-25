import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { API } from "@/lib/api-url";
import { useAuth } from "@/hooks/use-auth";
import {
  ModuleShell, LoadingState, ErrorState, Toast, useToast, MobileModuleIntro,
  colors, fonts, radius,
} from "@/components/mobile";
import { Mic, Lock, Clock, ChevronRight, Filter } from "lucide-react";

/**
 * /m/pratik/konusma-sahneleri — Speaking Scenes hub
 */

const TOKEN_KEY = "sphere_token";
const CEFR_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"];
const cefrIdx = (l: string) => { const i = CEFR_ORDER.indexOf(l); return i === -1 ? 2 : i; };

interface Scene {
  id: number; slug: string; category: string;
  title_en: string; title_tr: string;
  description_tr: string;
  user_role_tr: string | null; counterpart_role_tr: string | null;
  difficulty: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
  min_plan: "free" | "pro";
  avg_duration_min: number;
  sort_order: number;
  locked: boolean;
  lock_reason: "pro_only" | "category_locked" | null;
}

interface ListResponse {
  tier: "free" | "pro";
  dailyRemaining: number | null;
  dailyLimit: number | null;
  scenes: Scene[];
}

const CATEGORY_META: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  general_business: { label: "Genel İş",   icon: "💼", color: "#1e40af", bg: "#dbeafe" },
  meetings:         { label: "Toplantı",    icon: "🗓️", color: "#4338ca", bg: "#e0e7ff" },
  presentations:    { label: "Sunum",       icon: "🎤", color: "#6b21a8", bg: "#f3e8ff" },
  negotiation:      { label: "Müzakere",    icon: "🤝", color: "#c2410c", bg: "#ffedd5" },
  sales:            { label: "Satış",       icon: "📈", color: "#047857", bg: "#d1fae5" },
  phone_calls:      { label: "Telefon",     icon: "📞", color: "#0e7490", bg: "#cffafe" },
  tech:             { label: "Teknoloji",   icon: "💻", color: "#334155", bg: "#f1f5f9" },
  hr:               { label: "İK",          icon: "👥", color: "#9d174d", bg: "#fce7f3" },
  finance:          { label: "Finans",      icon: "💰", color: "#a16207", bg: "#fef3c7" },
  healthcare:       { label: "Sağlık",      icon: "🏥", color: "#b91c1c", bg: "#fee2e2" },
};

const DIFF_COLORS: Record<string, { color: string; bg: string }> = {
  A1: { color: "#166534", bg: "#dcfce7" },
  A2: { color: "#15803d", bg: "#d9f99d" },
  B1: { color: "#1d4ed8", bg: "#dbeafe" },
  B2: { color: "#c2410c", bg: "#ffedd5" },
  C1: { color: "#b91c1c", bg: "#fee2e2" },
  C2: { color: "#9d174d", bg: "#fce7f3" },
};

type LevelFilter = "my_level" | "all" | "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export default function MobileSpeakingScenes() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const userLevel = (user?.currentLevel as string | undefined) ?? "B1";
  const userIdx = cefrIdx(userLevel);
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | "all">("all");
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("my_level");
  const [showFilters, setShowFilters] = useState(false);
  const { toast, show: showToast, hide: hideToast } = useToast();

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const r = await fetch(`${API}/scenes`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json() as ListResponse;
      setData(d);
    } catch (e: any) {
      setError(e?.message || "Sahneler yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  const scenes = data?.scenes ?? [];
  const categories = useMemo(() => Array.from(new Set(scenes.map((s) => s.category))), [scenes]);

  const filtered = useMemo(() => {
    let list = selectedCategory === "all" ? scenes : scenes.filter((s) => s.category === selectedCategory);
    if (levelFilter === "my_level") list = list.filter((s) => cefrIdx(s.difficulty) <= userIdx);
    else if (levelFilter !== "all") list = list.filter((s) => s.difficulty === levelFilter);
    return [...list].sort((a, b) => {
      const ai = cefrIdx(a.difficulty);
      const bi = cefrIdx(b.difficulty);
      const aDist = ai === userIdx ? 0 : ai < userIdx ? 1 : 100 + (ai - userIdx);
      const bDist = bi === userIdx ? 0 : bi < userIdx ? 1 : 100 + (bi - userIdx);
      if (aDist !== bDist) return aDist - bDist;
      return a.sort_order - b.sort_order;
    });
  }, [scenes, selectedCategory, levelFilter, userIdx]);

  if (loading) {
    return (
      <ModuleShell title="Konuşma Sahneleri" subtitle="Yükleniyor…">
        <LoadingState compact messages={["Sahneler yükleniyor…"]} />
      </ModuleShell>
    );
  }

  if (error) {
    return (
      <ModuleShell title="Konuşma Sahneleri">
        <ErrorState title="Yüklenemedi" message={error} onRetry={load} />
      </ModuleShell>
    );
  }

  return (
    <ModuleShell
      title="Konuşma Sahneleri"
      subtitle={`${filtered.length} sahne · Seviyen: ${userLevel}`}
      rightAction={
        <button
          onClick={() => setShowFilters((v) => !v)}
          aria-label="Filtrele"
          style={{
            background: showFilters ? colors.navy : colors.navy50,
            color: showFilters ? colors.white : colors.navy,
            border: "none", width: 36, height: 36, borderRadius: 18,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <Filter size={16} strokeWidth={2.5} />
        </button>
      }
    >
      <MobileModuleIntro moduleKey="speaking_scenes" />

      {/* Filtre paneli */}
      {showFilters && (
        <div style={{
          padding: 14, marginBottom: 16,
          background: colors.navy50, borderRadius: 12,
        }}>
          <div style={{
            fontFamily: fonts.heading, fontWeight: 700, fontSize: 10,
            color: colors.neutral, textTransform: "uppercase", letterSpacing: "0.06em",
            marginBottom: 8,
          }}>Seviye</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
            {(["my_level", "all", ...CEFR_ORDER] as LevelFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setLevelFilter(f)}
                style={{
                  padding: "6px 12px", borderRadius: 100,
                  background: levelFilter === f ? colors.navy : colors.white,
                  color: levelFilter === f ? colors.white : colors.navy,
                  border: `1px solid ${levelFilter === f ? colors.navy : colors.navy100}`,
                  fontFamily: fonts.heading, fontWeight: 700, fontSize: 11,
                  cursor: "pointer",
                }}
              >{f === "my_level" ? "Seviyem" : f === "all" ? "Tümü" : f}</button>
            ))}
          </div>

          <div style={{
            fontFamily: fonts.heading, fontWeight: 700, fontSize: 10,
            color: colors.neutral, textTransform: "uppercase", letterSpacing: "0.06em",
            marginBottom: 8,
          }}>Kategori</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button
              onClick={() => setSelectedCategory("all")}
              style={{
                padding: "6px 12px", borderRadius: 100,
                background: selectedCategory === "all" ? colors.navy : colors.white,
                color: selectedCategory === "all" ? colors.white : colors.navy,
                border: `1px solid ${selectedCategory === "all" ? colors.navy : colors.navy100}`,
                fontFamily: fonts.heading, fontWeight: 700, fontSize: 11,
                cursor: "pointer",
              }}
            >Tümü</button>
            {categories.map((c) => {
              const meta = CATEGORY_META[c];
              const active = selectedCategory === c;
              return (
                <button
                  key={c}
                  onClick={() => setSelectedCategory(c)}
                  style={{
                    padding: "6px 12px", borderRadius: 100,
                    background: active ? colors.navy : colors.white,
                    color: active ? colors.white : colors.navy,
                    border: `1px solid ${active ? colors.navy : colors.navy100}`,
                    fontFamily: fonts.heading, fontWeight: 700, fontSize: 11,
                    cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 4,
                  }}
                >{meta?.icon} {meta?.label || c}</button>
              );
            })}
          </div>
        </div>
      )}

      {/* Sahne listesi */}
      {filtered.length === 0 ? (
        <div style={{
          padding: 40, textAlign: "center",
          color: colors.neutral, fontSize: 13,
        }}>
          <Mic size={32} color={colors.navy100} style={{ marginBottom: 12 }} />
          <div>Filtreyle eşleşen sahne yok</div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {filtered.map((s) => {
            const cat = CATEGORY_META[s.category];
            const diff = DIFF_COLORS[s.difficulty];
            const higher = cefrIdx(s.difficulty) > userIdx;
            return (
              <button
                key={s.id}
                onClick={() => {
                  if (s.locked) {
                    showToast(s.lock_reason === "pro_only" ? "Pro üyelik gerekli" : "Bu kategori kilitli", "warning");
                    return;
                  }
                  navigate(`/m/pratik/konusma-sahneleri/${s.slug}`);
                }}
                style={{
                  padding: 14, textAlign: "left",
                  background: colors.white,
                  border: `1px solid ${s.locked ? colors.navy50 : colors.navy100}`,
                  borderRadius: radius.card,
                  opacity: s.locked ? 0.55 : higher ? 0.85 : 1,
                  cursor: "pointer",
                  display: "flex", gap: 10, alignItems: "flex-start",
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: cat?.bg || colors.navy50,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 20, flexShrink: 0,
                }}>{cat?.icon}</div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap",
                  }}>
                    <span style={{
                      padding: "2px 6px", borderRadius: 6,
                      background: diff.bg, color: diff.color,
                      fontFamily: fonts.heading, fontWeight: 800, fontSize: 9,
                      letterSpacing: "0.04em",
                    }}>{s.difficulty}</span>
                    <span style={{
                      fontSize: 10, color: colors.neutral,
                      display: "flex", alignItems: "center", gap: 2,
                    }}>
                      <Clock size={9} strokeWidth={2.5} />
                      {s.avg_duration_min}dk
                    </span>
                    {s.locked && (
                      <span style={{
                        padding: "2px 6px", borderRadius: 6,
                        background: colors.navy50, color: colors.neutral,
                        fontFamily: fonts.heading, fontWeight: 800, fontSize: 9,
                        display: "flex", alignItems: "center", gap: 3,
                      }}>
                        <Lock size={9} strokeWidth={2.5} />
                        Kilitli
                      </span>
                    )}
                  </div>
                  <div style={{
                    fontFamily: fonts.heading, fontWeight: 700, fontSize: 14,
                    color: colors.navy, letterSpacing: "-0.01em",
                    lineHeight: 1.3, marginBottom: 4,
                  }}>{s.title_tr}</div>
                  <div style={{
                    fontSize: 11, color: colors.neutral, lineHeight: 1.4,
                    display: "-webkit-box", WebkitLineClamp: 2 as any,
                    WebkitBoxOrient: "vertical" as any, overflow: "hidden",
                  }}>{s.description_tr}</div>
                  {s.user_role_tr && (
                    <div style={{
                      fontSize: 10, color: colors.turqDeep, marginTop: 4,
                      fontFamily: fonts.heading, fontWeight: 700,
                    }}>Rol: {s.user_role_tr}</div>
                  )}
                </div>

                <ChevronRight size={16} color={colors.navy400} strokeWidth={2} style={{ marginTop: 6, flexShrink: 0 }} />
              </button>
            );
          })}
        </div>
      )}

      <Toast {...toast} onClose={hideToast} />
    </ModuleShell>
  );
}
