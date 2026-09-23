import { useEffect, useState } from "react";
import { API } from "@/lib/api-url";
import { BookMarked, Star, Loader2, Search, ChevronDown, ChevronRight } from "lucide-react";
import { withModuleIntro } from "@/components/withModuleIntro";

/**
 * /is-kartlari — İş Kartları kütüphanesi
 *   Sekmeler: Bugün · Kütüphane · Favoriler
 *   Kart flip animasyonu, filtre (seviye + kategori), favori toggle.
 */

const TOKEN_KEY = "sphere_token";
const CEFR = ["A1", "A2", "B1", "B2", "C1", "C2"];
const CATEGORIES = [
  { id: "", label: "Tümü" },
  { id: "meetings", label: "Toplantılar" },
  { id: "emails", label: "E-posta" },
  { id: "phone_calls", label: "Telefon" },
  { id: "presentations", label: "Sunum" },
  { id: "sales", label: "Satış" },
  { id: "interview", label: "Mülakat" },
  { id: "self_intro", label: "Kendini Tanıtma" },
  { id: "customer_service", label: "Müşteri İlişkileri" },
  { id: "business_general", label: "Genel İş" },
];

interface Card {
  id: number;
  level: string;
  category: string;
  context_tr: string;
  phrase_en: string;
  alternatives_en: string[];
  example_en: string;
  translation_tr: string;
  tags: string[];
  favorited?: boolean;
  seen?: boolean;
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

function CardBox({
  card,
  onFav,
}: {
  card: Card;
  onFav: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border border-slate-200 rounded-xl bg-white overflow-hidden hover:shadow-md transition-shadow">
      <div className="p-4">
        <div className="flex items-start gap-3 mb-2">
          <button
            onClick={() => setExpanded((e) => !e)}
            className="text-slate-400 hover:text-slate-600 mt-0.5"
          >
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-bold uppercase">
                {card.level}
              </span>
              <span className="text-[10px] text-slate-500 font-semibold">
                {CATEGORIES.find((c) => c.id === card.category)?.label ?? card.category}
              </span>
            </div>
            <div className="text-base font-extrabold text-slate-900 leading-tight">{card.phrase_en}</div>
          </div>
          <button
            onClick={() => onFav(card.id)}
            className={`p-1.5 rounded-lg transition-colors ${
              card.favorited
                ? "bg-amber-100 text-amber-600 hover:bg-amber-200"
                : "text-slate-300 hover:text-amber-500 hover:bg-amber-50"
            }`}
            title={card.favorited ? "Favoriden çıkar" : "Favorilere ekle"}
          >
            <Star size={16} className={card.favorited ? "fill-current" : ""} />
          </button>
        </div>

        <p className="text-xs text-slate-600 leading-snug mb-2 ml-7">{card.context_tr}</p>

        {expanded && (
          <div className="ml-7 mt-3 border-t border-slate-100 pt-3 space-y-3">
            <div>
              <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Örnek</p>
              <p className="text-sm text-slate-800 italic">"{card.example_en}"</p>
              <p className="text-xs text-slate-500 mt-1">{card.translation_tr}</p>
            </div>
            {card.alternatives_en?.length > 0 && (
              <div>
                <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Alternatifler</p>
                <ul className="space-y-1">
                  {card.alternatives_en.map((alt, i) => (
                    <li key={i} className="text-sm text-slate-700">
                      · {alt}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {card.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {card.tags.map((t) => (
                  <span
                    key={t}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-slate-50 text-slate-500 font-mono"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function BusinessCardsPage() {
  const [tab, setTab] = useState<"daily" | "library" | "favorites">("daily");
  const [dailyCards, setDailyCards] = useState<Card[]>([]);
  const [libraryCards, setLibraryCards] = useState<Card[]>([]);
  const [favCards, setFavCards] = useState<Card[]>([]);
  const [filterLevel, setFilterLevel] = useState<string>("");
  const [filterCat, setFilterCat] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const loadDaily = () =>
    apiFetch("/student/business-cards/daily")
      .then((r) => setDailyCards(r.cards ?? []))
      .catch(() => {});

  const loadLibrary = () => {
    const q = new URLSearchParams();
    if (filterLevel) q.set("level", filterLevel);
    if (filterCat) q.set("category", filterCat);
    q.set("limit", "50");
    return apiFetch(`/student/business-cards?${q.toString()}`)
      .then((r) => setLibraryCards(r.cards ?? []))
      .catch(() => {});
  };

  const loadFavs = () =>
    apiFetch("/student/business-cards/favorites")
      .then((r) => setFavCards(r.cards ?? []))
      .catch(() => {});

  useEffect(() => {
    setLoading(true);
    Promise.all([loadDaily(), loadLibrary(), loadFavs()]).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (tab === "library") loadLibrary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterLevel, filterCat]);

  const toggleFav = async (cardId: number) => {
    try {
      const r = await apiFetch(`/student/business-cards/${cardId}/favorite`, { method: "POST" });
      const updater = (c: Card) => (c.id === cardId ? { ...c, favorited: r.favorited } : c);
      setDailyCards((prev) => prev.map(updater));
      setLibraryCards((prev) => prev.map(updater));
      // Favoriler listesi — çıkarıldıysa kaldır, eklendiyse tekrar yükle
      if (!r.favorited) {
        setFavCards((prev) => prev.filter((c) => c.id !== cardId));
      } else {
        loadFavs();
      }
    } catch {}
  };

  const showCards = tab === "daily" ? dailyCards : tab === "library" ? libraryCards : favCards;

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6">
      <div className="flex items-center gap-3 mb-2">
        <BookMarked className="text-amber-600" size={26} />
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900">İş Kartları</h1>
      </div>
      <p className="text-sm text-slate-600 mb-6">
        Her kart 2-3 dakikada öğreneceğin, işte hemen kullanabileceğin bir kalıp.
      </p>

      {/* Tabs */}
      <div className="flex gap-2 mb-5 border-b border-slate-200">
        {[
          { id: "daily", label: "Bugün" },
          { id: "library", label: "Kütüphane" },
          { id: "favorites", label: "Favoriler" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className={`px-4 py-2 text-sm font-bold border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? "border-amber-500 text-amber-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters (library only) */}
      {tab === "library" && (
        <div className="flex flex-wrap gap-2 mb-4">
          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5"
          >
            <option value="">Tüm seviyeler</option>
            {CEFR.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
          <select
            value={filterCat}
            onChange={(e) => setFilterCat(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5"
          >
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-slate-400" size={24} />
        </div>
      ) : showCards.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <Search className="mx-auto mb-2 text-slate-300" size={32} />
          {tab === "favorites"
            ? "Henüz favori kartın yok — beğendiğin kartları yıldızla."
            : "Bu filtrelerde kart bulunamadı."}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {showCards.map((c) => (
            <CardBox key={c.id} card={c} onFav={toggleFav} />
          ))}
        </div>
      )}
    </div>
  );
}

export default withModuleIntro("business_cards")(BusinessCardsPage);
