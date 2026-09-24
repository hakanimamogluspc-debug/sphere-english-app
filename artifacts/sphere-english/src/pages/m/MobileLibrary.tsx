import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { API } from "@/lib/api-url";
import { TabBar, BusinessCard, Button, colors, fonts, radius, type TabKey, type BusinessCardData } from "@/components/mobile";
import { Search, X, ArrowLeft } from "lucide-react";

/**
 * /m/kutuphane — Mobil kütüphane
 * 3 sekme: Bugün (5 kart) · Kütüphane (tüm liste + filtre) · Favoriler
 * Bir kart seçilince tam ekran BusinessCard gösterilir.
 */

const TOKEN_KEY = "sphere_token";

const CEFR = ["A1", "A2", "B1", "B2", "C1", "C2"];
const CATEGORIES = [
  { id: "", label: "Tümü" },
  { id: "meetings", label: "Toplantı" },
  { id: "emails", label: "E-posta" },
  { id: "phone_calls", label: "Telefon" },
  { id: "presentations", label: "Sunum" },
  { id: "sales", label: "Satış" },
  { id: "interview", label: "Mülakat" },
];

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

type Tab = "today" | "library" | "favs";

export default function MobileLibrary() {
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<Tab>("today");
  const [cards, setCards] = useState<BusinessCardData[]>([]);
  const [favMap, setFavMap] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [filterLevel, setFilterLevel] = useState<string>("");
  const [filterCat, setFilterCat] = useState<string>("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<BusinessCardData | null>(null);

  const loadCards = () => {
    setLoading(true);
    let endpoint = "/student/business-cards/daily";
    if (tab === "library") {
      const q = new URLSearchParams();
      if (filterLevel) q.set("level", filterLevel);
      if (filterCat) q.set("category", filterCat);
      q.set("limit", "50");
      endpoint = `/student/business-cards?${q.toString()}`;
    } else if (tab === "favs") {
      endpoint = "/student/business-cards/favorites";
    }
    apiFetch(endpoint)
      .then((r) => {
        const list = r.cards ?? [];
        setCards(list);
        const favs: Record<number, boolean> = {};
        list.forEach((c: any) => {
          favs[c.id] = tab === "favs" ? true : !!c.favorited;
        });
        setFavMap(favs);
      })
      .catch(() => setCards([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadCards(); /* eslint-disable-next-line */ }, [tab, filterLevel, filterCat]);

  const toggleFav = async (id: number) => {
    const newVal = !favMap[id];
    setFavMap((m) => ({ ...m, [id]: newVal }));
    try {
      await apiFetch(`/student/business-cards/${id}/favorite`, { method: "POST" });
    } catch {}
  };

  const handleTab = (t: TabKey) => {
    if (t === "home") setLocation("/m/anasayfa");
    else if (t === "practice") setLocation("/m/pratik");
    else if (t === "library") setLocation("/m/kutuphane");
    else if (t === "rewards") setLocation("/m/kazanim");
    else if (t === "profile") setLocation("/m/profil");
  };

  // Arama filtresi
  const filteredCards = search
    ? cards.filter((c) =>
        c.phrase_en.toLowerCase().includes(search.toLowerCase()) ||
        c.context_tr.toLowerCase().includes(search.toLowerCase())
      )
    : cards;

  // Kart seçili — tam ekran görünüm
  if (selected) {
    return (
      <div style={{ minHeight: "100vh", background: colors.white, paddingBottom: 88 }}>
        <div style={{
          padding: "24px 20px 8px",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <button
            onClick={() => setSelected(null)}
            style={{
              width: 40, height: 40, background: "transparent", border: "none",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <ArrowLeft size={22} strokeWidth={2} color={colors.navy} />
          </button>
          <div style={{
            flex: 1, textAlign: "center",
          }}>
            <div style={{
              fontFamily: fonts.heading, fontWeight: 700, fontSize: 10,
              color: colors.turqDeep, textTransform: "uppercase", letterSpacing: "0.06em",
            }}>İş Kartı</div>
            <div style={{
              fontFamily: fonts.heading, fontWeight: 700, fontSize: 15,
              color: colors.navy, marginTop: 2,
            }}>
              {CATEGORIES.find(c => c.id === selected.category)?.label ?? selected.category} · {selected.level}
            </div>
          </div>
          <div style={{ width: 40 }} />
        </div>
        <div style={{ padding: "16px 20px" }}>
          <BusinessCard
            card={selected}
            isFavorite={favMap[selected.id]}
            onToggleFav={() => toggleFav(selected.id)}
          />
        </div>
        <TabBar active="library" onChange={handleTab} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: colors.white, paddingBottom: 88 }}>
      <div style={{ padding: "24px 20px 0" }}>
        <div style={{
          fontFamily: fonts.heading, fontWeight: 700, fontSize: 11,
          color: colors.turqDeep, textTransform: "uppercase", letterSpacing: "0.06em",
          marginBottom: 6,
        }}>Kütüphane</div>
        <div style={{
          fontFamily: fonts.heading, fontWeight: 900, fontSize: 26,
          letterSpacing: "-0.02em", color: colors.navy, lineHeight: 1.15,
        }}>
          Ne <span style={{ position: "relative", display: "inline-block" }}>
            öğrenmek
            <span style={{
              position: "absolute", left: 0, right: 0, bottom: 2,
              height: 10, background: colors.turq, opacity: 0.85,
              transform: "skewY(-1deg)", zIndex: -1,
            }} />
          </span> istersin?
        </div>

        {/* Alt sekmeler */}
        <div style={{
          display: "flex", gap: 4, margin: "20px 0 16px",
          background: colors.navy50, borderRadius: 100, padding: 4,
        }}>
          {[
            { id: "today", label: "Bugün" },
            { id: "library", label: "Tümü" },
            { id: "favs", label: "Favoriler" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as Tab)}
              style={{
                flex: 1, padding: "10px 8px",
                background: tab === t.id ? colors.navy : "transparent",
                color: tab === t.id ? colors.white : colors.navy,
                border: "none", borderRadius: 100,
                fontFamily: fonts.heading, fontWeight: 700, fontSize: 13,
                cursor: "pointer", transition: "all 0.2s ease",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Arama */}
        {tab !== "today" && (
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "12px 16px", background: colors.navy50, borderRadius: 16,
            marginBottom: 12,
          }}>
            <Search size={18} color={colors.neutral} strokeWidth={2} />
            <input
              type="text"
              placeholder="Kalıp veya konu ara…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                flex: 1, border: "none", background: "transparent",
                fontFamily: fonts.body, fontWeight: 500, fontSize: 14,
                color: colors.navy, outline: "none",
              }}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                style={{ background: "transparent", border: "none", cursor: "pointer" }}
              >
                <X size={16} color={colors.neutral} strokeWidth={2} />
              </button>
            )}
          </div>
        )}

        {/* Filtre chip'leri */}
        {tab === "library" && (
          <>
            <div style={{
              display: "flex", gap: 6, marginBottom: 8, overflowX: "auto",
            }}>
              {CEFR.map((l) => (
                <button
                  key={l}
                  onClick={() => setFilterLevel(filterLevel === l ? "" : l)}
                  style={{
                    padding: "6px 14px", borderRadius: 100, whiteSpace: "nowrap",
                    background: filterLevel === l ? colors.navy : colors.white,
                    color: filterLevel === l ? colors.white : colors.navy,
                    border: `1px solid ${filterLevel === l ? colors.navy : colors.navy100}`,
                    fontFamily: fonts.heading, fontWeight: 700, fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  {l}
                </button>
              ))}
            </div>
            <div style={{
              display: "flex", gap: 6, marginBottom: 16, overflowX: "auto",
            }}>
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setFilterCat(c.id)}
                  style={{
                    padding: "6px 14px", borderRadius: 100, whiteSpace: "nowrap",
                    background: filterCat === c.id ? colors.navy : colors.white,
                    color: filterCat === c.id ? colors.white : colors.navy,
                    border: `1px solid ${filterCat === c.id ? colors.navy : colors.navy100}`,
                    fontFamily: fonts.heading, fontWeight: 700, fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Kart listesi */}
      <div style={{ padding: "0 20px" }}>
        {loading && (
          <div style={{
            textAlign: "center", padding: 40, color: colors.neutral, fontSize: 14,
          }}>Yükleniyor…</div>
        )}
        {!loading && filteredCards.length === 0 && (
          <div style={{
            textAlign: "center", padding: 40, color: colors.neutral, fontSize: 14,
          }}>
            {tab === "favs" ? "Henüz favori kartın yok." : "Kart bulunamadı."}
          </div>
        )}
        {!loading && filteredCards.map((card) => (
          <button
            key={card.id}
            onClick={() => setSelected(card)}
            style={{
              width: "100%", padding: 16, marginBottom: 10, textAlign: "left",
              background: colors.white,
              border: `1px solid ${colors.navy100}`,
              borderRadius: 16, cursor: "pointer",
              transition: "border-color 0.2s ease",
            }}
          >
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              marginBottom: 6,
            }}>
              <span style={{
                fontFamily: fonts.heading, fontWeight: 700, fontSize: 10,
                color: colors.neutral, textTransform: "uppercase", letterSpacing: "0.06em",
              }}>
                {CATEGORIES.find(c => c.id === card.category)?.label ?? card.category}
              </span>
              <span style={{
                padding: "3px 8px", background: colors.navy50, color: colors.navy,
                borderRadius: 6, fontFamily: fonts.heading, fontWeight: 700, fontSize: 10,
              }}>{card.level}</span>
            </div>
            <div style={{
              fontFamily: fonts.heading, fontWeight: 800, fontSize: 16,
              lineHeight: 1.3, letterSpacing: "-0.01em", color: colors.navy,
            }}>
              {card.phrase_en}
            </div>
            {favMap[card.id] && (
              <div style={{
                marginTop: 6, fontSize: 11, color: colors.turqDeep,
                fontFamily: fonts.heading, fontWeight: 600,
              }}>★ Favori</div>
            )}
          </button>
        ))}
      </div>

      <TabBar active="library" onChange={handleTab} />
    </div>
  );
}
