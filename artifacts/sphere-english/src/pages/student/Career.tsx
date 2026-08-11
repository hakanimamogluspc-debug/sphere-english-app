import { useEffect, useRef, useState, useCallback } from "react";
import {
  Video, Headphones, Loader2, Compass, RefreshCw, ExternalLink, Globe2,
} from "lucide-react";
import { API } from "@/lib/api-url";

const TOKEN_KEY = "sphere_token";
async function apiFetch(path: string) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.error || `HTTP ${res.status}`);
  return data;
}

type Item = {
  id: number;
  source_slug: string;
  source_type: "video" | "podcast";
  url: string;
  audio_url: string | null;
  title: string;
  thumbnail_url: string | null;
  author: string | null;
  duration_sec: number | null;
  language: string;
  published_at: string | null;
  tr_summary: string | null;
  category: string | null;
  tags: string[] | null;
};

const CAT_LABEL: Record<string, string> = {
  career: "Kariyer", motivation: "Motivasyon", entrepreneurship: "Girişimcilik",
  leadership: "Liderlik", productivity: "Verimlilik",
};

function fmtDuration(sec: number | null): string {
  if (!sec) return "";
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}s ${m}dk` : `${m} dk`;
}

export default function Career() {
  const [type, setType] = useState("all");
  const [language, setLanguage] = useState("all");
  const [category, setCategory] = useState("all");
  const [items, setItems] = useState<Item[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  async function load(reset = false) {
    if (loading) return;
    setLoading(true);
    try {
      const p = new URLSearchParams({
        type, language, category, limit: "18",
        ...(reset ? {} : cursor ? { cursor: String(cursor) } : {}),
      });
      const d = await apiFetch(`/career/feed?${p}`);
      const newItems: Item[] = d.items ?? [];
      setItems(prev => reset ? newItems : [...prev, ...newItems]);
      setCursor(d.nextCursor);
      setHasMore(!!d.nextCursor);
    } catch (e: any) { console.warn(e); }
    finally { setLoading(false); }
  }

  useEffect(() => { setItems([]); setCursor(null); setHasMore(true); load(true); /* eslint-disable-next-line */ }, [type, language, category]);

  useEffect(() => {
    if (!sentinelRef.current || !hasMore || loading) return;
    const io = new IntersectionObserver((entries) => { if (entries[0].isIntersecting) load(false); }, { rootMargin: "300px" });
    io.observe(sentinelRef.current);
    return () => io.disconnect();
    // eslint-disable-next-line
  }, [hasMore, loading, cursor]);

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
          <Compass className="h-7 w-7 text-indigo-600" />
          Kariyer & Motivasyon
        </h1>
        <p className="text-sm text-gray-500 mt-1">Video ve podcast'lerle beslen — Türkçe özet ile hızlı tara.</p>
      </header>

      <div className="bg-white rounded-lg border p-3 space-y-2">
        <div className="flex flex-wrap gap-2">
          <Chip active={type === "all"} onClick={() => setType("all")} label="Tümü" />
          <Chip active={type === "video"} onClick={() => setType("video")} label="Videolar" icon={<Video className="h-3 w-3" />} />
          <Chip active={type === "podcast"} onClick={() => setType("podcast")} label="Podcast" icon={<Headphones className="h-3 w-3" />} />
          <span className="w-px bg-gray-200 mx-1 self-stretch" />
          <Chip active={language === "all"} onClick={() => setLanguage("all")} label="Tüm Diller" />
          <Chip active={language === "tr"} onClick={() => setLanguage("tr")} label="Türkçe" />
          <Chip active={language === "en"} onClick={() => setLanguage("en")} label="İngilizce" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip active={category === "all"} onClick={() => setCategory("all")} label="Tüm Konular" small />
          {Object.entries(CAT_LABEL).map(([v, l]) => (
            <Chip key={v} active={category === v} onClick={() => setCategory(v)} label={l} small />
          ))}
        </div>
      </div>

      {items.length === 0 && !loading ? (
        <div className="text-center py-16 bg-white rounded-lg border text-gray-500 text-sm">Bu filtreye uygun içerik yok.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(it => <ContentCard key={it.id} item={it} />)}
        </div>
      )}

      {hasMore && <div ref={sentinelRef} className="py-8 text-center">{loading && <Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-400" />}</div>}
    </div>
  );
}

function Chip({ active, onClick, label, icon, small }: any) {
  return (
    <button onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium border transition ${
        active ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-700 border-gray-300 hover:border-indigo-400 hover:text-indigo-700"
      } ${small ? "px-2.5 py-0.5" : ""}`}
    >
      {icon}{label}
    </button>
  );
}

function ContentCard({ item }: { item: Item }) {
  const isPodcast = item.source_type === "podcast";
  return (
    <a href={item.url} target="_blank" rel="noreferrer"
      className="bg-white rounded-xl border hover:border-indigo-400 hover:shadow-lg transition cursor-pointer overflow-hidden group flex flex-col">
      <div className="aspect-video bg-gray-100 relative overflow-hidden">
        {item.thumbnail_url ? (
          <img src={item.thumbnail_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-100 via-violet-50 to-emerald-100">
            {isPodcast ? <Headphones className="h-12 w-12 text-indigo-400" /> : <Video className="h-12 w-12 text-indigo-400" />}
          </div>
        )}
        <div className="absolute top-2 left-2 bg-black/70 backdrop-blur text-white text-[10px] px-2 py-1 rounded-full font-semibold flex items-center gap-1 uppercase">
          {isPodcast ? <Headphones className="h-3 w-3" /> : <Video className="h-3 w-3" />}
          {isPodcast ? "Podcast" : "Video"}
        </div>
        {item.duration_sec && (
          <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded font-mono">
            {fmtDuration(item.duration_sec)}
          </div>
        )}
      </div>
      <div className="p-4 space-y-2 flex-1 flex flex-col">
        <div className="flex items-center gap-1.5 flex-wrap">
          {item.category && <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-700">{CAT_LABEL[item.category]}</span>}
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-700 uppercase">
            <Globe2 className="h-2.5 w-2.5" /> {item.language}
          </span>
        </div>
        <h3 className="text-base font-semibold text-gray-900 line-clamp-2 leading-snug">{item.title}</h3>
        {item.tr_summary && <p className="text-sm text-gray-600 line-clamp-3">{item.tr_summary}</p>}
        <div className="flex-1" />
        <div className="text-[11px] text-gray-400 flex items-center gap-2 pt-1">
          {item.author && <span className="truncate max-w-[140px]">{item.author}</span>}
          {item.published_at && <span>· {new Date(item.published_at).toLocaleDateString("tr-TR")}</span>}
          <ExternalLink className="h-3 w-3 ml-auto text-gray-400 group-hover:text-indigo-500" />
        </div>
      </div>
    </a>
  );
}
