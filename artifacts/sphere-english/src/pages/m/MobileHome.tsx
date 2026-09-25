import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { API } from "@/lib/api-url";
import { useAuth } from "@/hooks/use-auth";
import {
  StatRow, FocusCard, BusinessCard, TabBar, Button,
  PullToRefresh, SwipeableCard,
  colors, fonts, radius,
  type TabKey, type BusinessCardData,
} from "@/components/mobile";
import { ArrowRight } from "lucide-react";

/**
 * Mobil Ana Sayfa — /m/anasayfa
 *
 * TabBar + üst hero (selam + stat row) + FocusCard (bugünkü görev) +
 * günün iş kartı önizleme.
 *
 * Veri: /student/today-task + /student/streak-status +
 *       /student/business-cards/daily
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

export default function MobileHome() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const [streak, setStreak] = useState<number>(0);
  const [freezeCount, setFreezeCount] = useState<number>(0);
  const [level, setLevel] = useState<string>("—");

  const [todayTask, setTodayTask] = useState<any>(null);
  const [businessCards, setBusinessCards] = useState<BusinessCardData[]>([]);
  const [cardIdx, setCardIdx] = useState<number>(0);
  const [favMap, setFavMap] = useState<Record<number, boolean>>({});

  const loadAll = async () => {
    await Promise.allSettled([
      apiFetch("/student/streak-status").then((r) => {
        setStreak(r.streak ?? 0);
        setFreezeCount(r.freeze_count ?? 0);
      }),
      apiFetch("/student/today-task").then((r) => setTodayTask(r.task ?? null)),
      apiFetch("/student/business-cards/daily").then((r) => {
        setBusinessCards(r.cards ?? []);
        const favs: Record<number, boolean> = {};
        (r.cards ?? []).forEach((c: any) => { favs[c.id] = !!c.favorited; });
        setFavMap(favs);
      }),
    ]);
  };

  useEffect(() => { loadAll().catch(() => {}); }, []);

  useEffect(() => {
    if (user?.currentLevel) setLevel(user.currentLevel);
  }, [user]);

  const currentCard = businessCards[cardIdx] ?? null;

  const toggleFav = async () => {
    if (!currentCard) return;
    const newVal = !favMap[currentCard.id];
    setFavMap((m) => ({ ...m, [currentCard.id]: newVal }));
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      await fetch(`${API}/student/business-cards/${currentCard.id}/favorite`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {}
  };

  const handleTab = (t: TabKey) => {
    if (t === "home") setLocation("/m/anasayfa");
    else if (t === "practice") setLocation("/m/pratik");
    else if (t === "library") setLocation("/m/kutuphane");
    else if (t === "rewards") setLocation("/m/kazanim");
    else if (t === "profile") setLocation("/m/profil");
  };

  const firstName = (user?.firstName || "Merhaba").split(" ")[0];
  const initial = firstName[0]?.toUpperCase() ?? "H";

  const now = new Date();
  const dateStr = now.toLocaleDateString("tr-TR", {
    weekday: "long", day: "numeric", month: "long",
  });

  const goNext = () => setCardIdx((i) => Math.min(businessCards.length - 1, i + 1));
  const goPrev = () => setCardIdx((i) => Math.max(0, i - 1));

  return (
    <div style={{
      minHeight: "100vh",
      background: colors.white,
      paddingBottom: 88, // TabBar için
    }}>
     <PullToRefresh onRefresh={loadAll}>
      {/* HERO */}
      <div style={{ padding: "24px 20px 8px" }}>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: 20,
        }}>
          <div>
            <div style={{
              fontFamily: fonts.heading,
              fontWeight: 800,
              fontSize: 24,
              letterSpacing: "-0.02em",
              color: colors.navy,
              lineHeight: 1.1,
            }}>
              Merhaba,<br/>
              <span style={{ position: "relative", display: "inline-block" }}>
                {firstName}
                <span style={{
                  position: "absolute",
                  left: 0, right: 0, bottom: 2,
                  height: 8, background: colors.turq,
                  opacity: 0.9, zIndex: -1,
                }} />
              </span>.
            </div>
            <div style={{
              fontSize: 12,
              color: colors.neutral,
              marginTop: 4,
              textTransform: "capitalize",
            }}>
              {dateStr}
            </div>
          </div>
          <div style={{
            width: 44, height: 44, borderRadius: 14,
            background: colors.navy, color: colors.white,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: fonts.heading, fontWeight: 800, fontSize: 18,
          }}>
            {initial}
          </div>
        </div>

        <StatRow
          stats={[
            { label: "Seri", value: streak, unit: "gün" },
            { label: "Seviye", value: level },
            { label: "Freeze", value: String(freezeCount).padStart(2, "0") },
          ]}
        />

        {/* Focus Card - bugünkü görev */}
        {todayTask ? (
          <FocusCard
            title={todayTask.title || "Bugün için görevin hazır"}
            description={todayTask.description || "5 dakikada tamamla"}
            meta={[
              { label: "Süre", value: (todayTask.duration_min ?? 5) + " dk" },
              { label: "Seviye", value: todayTask.level || level },
              { label: "Modül", value: todayTask.type || "AI" },
            ]}
            ctaText="Başla"
            ctaIcon={<ArrowRight size={18} strokeWidth={2.5} />}
            onCta={() => {
              const href = todayTask.href || "/dashboard";
              window.location.href = href;
            }}
          />
        ) : (
          <FocusCard
            title="Bugün için hazırlanıyor"
            description="Görev yükleniyor…"
            meta={[]}
            ctaText="Devam"
            onCta={() => setLocation("/m/pratik")}
          />
        )}

        {/* Günün iş kartı */}
        {currentCard && (
          <>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "8px 0 16px",
            }}>
              <div style={{
                fontFamily: fonts.heading, fontWeight: 700, fontSize: 18,
                color: colors.navy,
              }}>Günün iş kartı</div>
              <button
                onClick={() => setLocation("/m/kutuphane")}
                style={{
                  fontFamily: fonts.heading, fontWeight: 600, fontSize: 12,
                  color: colors.turqDeep, textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  background: "transparent", border: "none", cursor: "pointer",
                }}
              >
                TÜMÜ →
              </button>
            </div>

            <SwipeableCard
              onSwipeLeft={cardIdx < businessCards.length - 1 ? goNext : undefined}
              onSwipeRight={cardIdx > 0 ? goPrev : undefined}
            >
              <BusinessCard
                card={currentCard}
                cardNumber={String(cardIdx + 1).padStart(2, "0")}
                totalCards={businessCards.length}
                isFavorite={favMap[currentCard.id]}
                onToggleFav={toggleFav}
              />
            </SwipeableCard>

            {/* Prev / Next */}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <Button
                variant="tertiary"
                fullWidth
                disabled={cardIdx === 0}
                onClick={goPrev}
              >
                ← Önceki
              </Button>
              <Button
                variant="primary"
                fullWidth
                disabled={cardIdx >= businessCards.length - 1}
                onClick={goNext}
              >
                Sonraki →
              </Button>
            </div>
            <div style={{
              textAlign: "center", fontSize: 11, color: colors.neutral,
              marginTop: 10, opacity: 0.7,
            }}>← Kaydırarak geç →</div>
          </>
        )}
      </div>
     </PullToRefresh>

      <TabBar active="home" onChange={handleTab} />
    </div>
  );
}
