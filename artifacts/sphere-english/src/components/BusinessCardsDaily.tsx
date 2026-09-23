import { useEffect, useState } from "react";
import { API } from "@/lib/api-url";
import { Link } from "wouter";
import { BookMarked, Loader2, ArrowRight, Star, ChevronLeft, ChevronRight } from "lucide-react";

/**
 * BusinessCardsDaily — Dashboard mini kart:
 *   Bugünkü 3-5 iş kartını carousel gibi gösterir. Retention için
 *   "hızlı 2 dakikalık öğrenim" hissi verir.
 */

const TOKEN_KEY = "sphere_token";

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
  seen: boolean;
  favorited: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  meetings: "Toplantılar",
  emails: "E-posta",
  phone_calls: "Telefon",
  presentations: "Sunum",
  sales: "Satış",
  interview: "Mülakat",
  self_intro: "Kendini Tanıtma",
  customer_service: "Müşteri İlişkileri",
  business_general: "Genel İş",
  everyday: "Günlük",
  vocabulary_expansion: "Kelime Hazinesi",
};

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

export default function BusinessCardsDaily() {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    apiFetch("/student/business-cards/daily")
      .then((r) => setCards(r.cards ?? []))
      .catch((e) => console.warn("[BusinessCards] hata:", e?.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    // Görüldü olarak işaretle (best-effort)
    const c = cards[idx];
    if (c && !c.seen) {
      apiFetch(`/student/business-cards/${c.id}/seen`, { method: "POST" }).catch(() => {});
      setCards((prev) => prev.map((cc, i) => (i === idx ? { ...cc, seen: true } : cc)));
    }
    setFlipped(false);
  }, [idx, cards.length]);

  const toggleFav = async (cardId: number) => {
    try {
      const r = await apiFetch(`/student/business-cards/${cardId}/favorite`, { method: "POST" });
      setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, favorited: r.favorited } : c)));
    } catch {}
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center justify-center min-h-[160px]">
        <Loader2 className="animate-spin text-slate-400" size={20} />
      </div>
    );
  }

  if (cards.length === 0) return null;

  const c = cards[idx];
  const total = cards.length;

  return (
    <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-amber-50 to-orange-50 overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <BookMarked className="text-amber-600" size={18} />
          <h3 className="font-extrabold text-slate-900 text-sm">Günün İş Kartları</h3>
        </div>
        <span className="text-[10px] text-amber-700 font-bold uppercase tracking-wider">
          {idx + 1} / {total}
        </span>
      </div>

      <div
        className="mx-5 my-3 bg-white rounded-xl border border-amber-200 p-4 min-h-[180px] cursor-pointer relative"
        onClick={() => setFlipped((f) => !f)}
      >
        {!flipped ? (
          <>
            <p className="text-xs text-slate-500 mb-2 leading-snug">{c.context_tr}</p>
            <div className="text-lg font-extrabold text-slate-900 mb-1 leading-tight">{c.phrase_en}</div>
            <p className="text-[11px] text-amber-700 font-semibold mt-2 italic">
              Karta dokun → çevir
            </p>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-bold uppercase">
                {c.level}
              </span>
              <span className="text-[10px] text-slate-500 font-semibold">
                {CATEGORY_LABELS[c.category] ?? c.category}
              </span>
            </div>
            <p className="text-sm text-slate-800 font-semibold mb-1 italic">"{c.example_en}"</p>
            <p className="text-xs text-slate-600 mb-3">{c.translation_tr}</p>
            {c.alternatives_en?.length > 0 && (
              <div className="border-t border-slate-100 pt-2 mt-2">
                <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Alternatifler</p>
                <ul className="space-y-0.5">
                  {c.alternatives_en.slice(0, 3).map((alt, i) => (
                    <li key={i} className="text-xs text-slate-700">
                      • {alt}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex items-center justify-between px-5 pb-4 gap-2">
        <button
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          disabled={idx === 0}
          className="p-1.5 rounded-lg bg-white border border-amber-200 text-amber-700 hover:bg-amber-100 disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Önceki kart"
        >
          <ChevronLeft size={14} />
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleFav(c.id);
          }}
          className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg transition-colors ${
            c.favorited
              ? "bg-amber-500 text-white hover:bg-amber-600"
              : "bg-white text-amber-700 border border-amber-200 hover:bg-amber-100"
          }`}
        >
          <Star size={12} className={c.favorited ? "fill-current" : ""} />
          {c.favorited ? "Favoride" : "Favorile"}
        </button>

        <Link
          href="/is-kartlari"
          className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 hover:text-amber-900"
        >
          Tümü <ArrowRight size={12} />
        </Link>

        <button
          onClick={() => setIdx((i) => Math.min(total - 1, i + 1))}
          disabled={idx === total - 1}
          className="p-1.5 rounded-lg bg-white border border-amber-200 text-amber-700 hover:bg-amber-100 disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Sonraki kart"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
