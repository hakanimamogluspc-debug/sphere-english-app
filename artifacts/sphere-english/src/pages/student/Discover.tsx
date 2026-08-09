import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Newspaper, Search, Bookmark, BookmarkCheck, Loader2, X, ExternalLink,
  Sparkles, Clock, RefreshCw, Compass, Save,
} from "lucide-react";
import { API } from "@/lib/api-url";
import { ClickableText, type VocabHint } from "@/components/ClickableText";

const TOKEN_KEY = "sphere_token";

async function apiFetch(path: string, opts: RequestInit = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(opts.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.error || `HTTP ${res.status}`);
  return data;
}

type FeedItem = {
  id: number;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  tr_summary: string | null;
  cefr_level: string | null;
  category: string | null;
  tags: string[] | null;
  published_at: string | null;
  author: string | null;
  saved?: boolean;
};

type ArticleFull = FeedItem & {
  url: string;
  body_html?: string | null;
  body_text?: string | null;
  snippet: string | null;
  key_vocab: Array<{ word: string; meaning_tr: string; context: string }> | null;
  saved_at: string | null;
  user_note: string | null;
  source: string;
};

const CAT_LABEL: Record<string, string> = {
  finance: "Finans", tech: "Teknoloji", leadership: "Liderlik", negotiation: "Müzakere", general: "Genel",
};
const CAT_CLR: Record<string, string> = {
  finance: "bg-blue-100 text-blue-700",
  tech: "bg-violet-100 text-violet-700",
  leadership: "bg-orange-100 text-orange-700",
  negotiation: "bg-teal-100 text-teal-700",
  general: "bg-gray-100 text-gray-700",
};

export default function Discover() {
  const [category, setCategory] = useState("all");
  const [cefr, setCefr] = useState("all");
  const [q, setQ] = useState("");
  const [savedOnly, setSavedOnly] = useState(false);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  async function load(reset = false) {
    if (loading) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        category, cefr, q,
        limit: "12",
        ...(reset ? {} : cursor ? { cursor: String(cursor) } : {}),
        ...(savedOnly ? { saved: "1" } : {}),
      });
      const d = await apiFetch(`/content/feed?${params}`);
      const newItems: FeedItem[] = d.items ?? [];
      setItems(prev => reset ? newItems : [...prev, ...newItems]);
      setCursor(d.nextCursor);
      setHasMore(!!d.nextCursor);
    } catch (e: any) { console.warn(e); }
    finally { setLoading(false); }
  }

  // Filter/search değişince baştan yükle
  useEffect(() => {
    setItems([]); setCursor(null); setHasMore(true);
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, cefr, q, savedOnly]);

  // Infinite scroll
  const observe = useCallback((node: HTMLDivElement | null) => {
    if (!node || !hasMore || loading) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) load(false);
    }, { rootMargin: "300px" });
    io.observe(node);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, loading, cursor]);

  useEffect(() => {
    const cleanup = observe(sentinelRef.current);
    return cleanup;
  }, [observe, items.length]);

  function toggleSaved(id: number, saved: boolean) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, saved } : i));
  }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
          <Compass className="h-7 w-7 text-indigo-600" />
          Keşfet
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Güncel iş dünyası haberleri — Türkçe özet, seviyene göre filtreli, kelime kartlarıyla.
        </p>
      </header>

      {/* Filter bar */}
      <div className="bg-white rounded-lg border p-3 space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text" value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Konu veya kelime ara..."
              className="w-full rounded-lg border-gray-300 pl-9 pr-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={() => { setItems([]); setCursor(null); load(true); }}
            className="rounded-lg border border-gray-300 p-2 hover:bg-gray-50"
            title="Yenile"
          >
            <RefreshCw className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <ToggleBtn active={!savedOnly} onClick={() => setSavedOnly(false)} label="Tümü" />
          <ToggleBtn active={savedOnly} onClick={() => setSavedOnly(true)} icon={<Bookmark className="h-3 w-3" />} label="Kaydettiklerim" />
          <span className="w-px bg-gray-200 mx-1" />
          {[
            { v: "all", l: "Tüm Kategoriler" },
            { v: "finance", l: "Finans" },
            { v: "tech", l: "Teknoloji" },
            { v: "leadership", l: "Liderlik" },
            { v: "negotiation", l: "Müzakere" },
            { v: "general", l: "Genel" },
          ].map(c => (
            <ToggleBtn key={c.v} active={category === c.v} onClick={() => setCategory(c.v)} label={c.l} />
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-gray-500 self-center mr-1">Seviye:</span>
          {["all", "A2", "B1", "B2", "C1", "C2"].map(c => (
            <ToggleBtn key={c} active={cefr === c} onClick={() => setCefr(c)} label={c === "all" ? "Tümü" : c} small />
          ))}
        </div>
      </div>

      {/* Grid */}
      {items.length === 0 && !loading ? (
        <div className="text-center py-16 bg-white rounded-lg border text-gray-500">
          <Newspaper className="mx-auto h-10 w-10 mb-2 opacity-40" />
          <p className="text-sm">
            {savedOnly ? "Henüz makale kaydetmedin." : "Bu filtreye uygun makale yok."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(item => (
            <ArticleCard key={item.id} item={item} onClick={() => setSelectedId(item.id)} />
          ))}
        </div>
      )}

      {hasMore && (
        <div ref={sentinelRef} className="py-8 text-center">
          {loading && <Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-400" />}
        </div>
      )}

      {selectedId && (
        <ArticleModal
          articleId={selectedId}
          onClose={() => setSelectedId(null)}
          onSavedChange={(s) => toggleSaved(selectedId, s)}
        />
      )}
    </div>
  );
}

function ToggleBtn({ active, onClick, label, icon, small }: any) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium border transition ${
        active
          ? "bg-indigo-600 text-white border-indigo-600"
          : "bg-white text-gray-700 border-gray-300 hover:border-indigo-400 hover:text-indigo-700"
      } ${small ? "px-2.5 py-0.5" : ""}`}
    >
      {icon}{label}
    </button>
  );
}

function ArticleCard({ item, onClick }: { item: FeedItem; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl border hover:border-indigo-400 hover:shadow-lg transition cursor-pointer overflow-hidden group flex flex-col"
    >
      {item.image_url ? (
        <div className="aspect-video bg-gray-100 relative overflow-hidden">
          <img src={item.image_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition" />
          {item.saved && (
            <div className="absolute top-2 right-2 bg-white/95 rounded-full p-1.5 shadow">
              <BookmarkCheck className="h-4 w-4 text-indigo-600" />
            </div>
          )}
        </div>
      ) : (
        <div className="aspect-video bg-gradient-to-br from-indigo-100 via-violet-50 to-emerald-100 flex items-center justify-center">
          <Newspaper className="h-8 w-8 text-indigo-300" />
        </div>
      )}
      <div className="p-4 space-y-2 flex-1 flex flex-col">
        <div className="flex items-center gap-1.5 flex-wrap">
          {item.category && (
            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${CAT_CLR[item.category]}`}>
              {CAT_LABEL[item.category]}
            </span>
          )}
          {item.cefr_level && (
            <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-800">
              {item.cefr_level}
            </span>
          )}
        </div>
        <h3 className="text-base font-semibold text-gray-900 line-clamp-2 leading-snug">{item.title}</h3>
        {item.tr_summary && (
          <p className="text-sm text-gray-600 line-clamp-3">{item.tr_summary}</p>
        )}
        <div className="flex-1" />
        <div className="text-[11px] text-gray-400 flex items-center gap-2 pt-1">
          {item.published_at && <span>{new Date(item.published_at).toLocaleDateString("tr-TR")}</span>}
          {item.author && <span className="truncate">· {item.author}</span>}
        </div>
      </div>
    </div>
  );
}

// ─── Article Reader Modal ─────────────────────────────────────────────
function ArticleModal({ articleId, onClose, onSavedChange }: {
  articleId: number; onClose: () => void; onSavedChange: (saved: boolean) => void;
}) {
  const [article, setArticle] = useState<ArticleFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const d = await apiFetch(`/content/${articleId}`);
        const a: ArticleFull = d.article;
        setArticle(a);
        setNote(a.user_note ?? "");
      } catch (e: any) { alert(e?.message); onClose(); }
      finally { setLoading(false); }
    })();
  }, [articleId]);

  async function toggleSave() {
    if (!article) return;
    setSaving(true);
    try {
      if (article.saved_at) {
        await apiFetch(`/content/${articleId}/save`, { method: "DELETE" });
        setArticle({ ...article, saved_at: null });
        onSavedChange(false);
      } else {
        await apiFetch(`/content/${articleId}/save`, { method: "POST", body: JSON.stringify({ note }) });
        setArticle({ ...article, saved_at: new Date().toISOString() });
        onSavedChange(true);
      }
    } catch (e: any) { alert(e?.message); }
    finally { setSaving(false); }
  }

  async function saveNote() {
    if (!article) return;
    setSaving(true);
    try {
      await apiFetch(`/content/${articleId}/save`, { method: "POST", body: JSON.stringify({ note }) });
      setArticle({ ...article, saved_at: article.saved_at ?? new Date().toISOString(), user_note: note });
      onSavedChange(true);
      setShowNote(false);
    } catch (e: any) { alert(e?.message); }
    finally { setSaving(false); }
  }

  // key_vocab kelimelerini lookup için map'e al
  const vocabMap = useMemo(() => {
    const m = new Map<string, VocabHint>();
    (article?.key_vocab ?? []).forEach(v => m.set(v.word.toLowerCase(), { meaning_tr: v.meaning_tr, context: v.context }));
    return m;
  }, [article]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <div className="h-full w-full max-w-3xl overflow-y-auto bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center gap-2 border-b bg-white/95 backdrop-blur px-5 py-3">
          <button onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
          <div className="flex-1" />
          {article?.url && (
            <a href={article.url} target="_blank" rel="noreferrer" className="text-xs text-gray-500 hover:text-indigo-600 inline-flex items-center gap-1">
              <ExternalLink className="h-3 w-3" /> Orijinal
            </a>
          )}
          <button
            onClick={toggleSave}
            disabled={saving || !article}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium inline-flex items-center gap-1.5 ${
              article?.saved_at
                ? "bg-indigo-600 text-white hover:bg-indigo-500"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" />
              : article?.saved_at ? <><BookmarkCheck className="h-4 w-4" /> Kaydedildi</>
              : <><Bookmark className="h-4 w-4" /> Kaydet</>}
          </button>
        </div>

        {loading || !article ? (
          <div className="p-8 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-400" /></div>
        ) : (
          <article className="p-5 md:p-8 space-y-6">
            {/* Hero */}
            {article.image_url && (
              <img src={article.image_url} alt="" className="w-full aspect-video object-cover rounded-xl" />
            )}

            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap text-xs">
                {article.category && (
                  <span className={`inline-flex px-2 py-0.5 rounded-full font-semibold ${CAT_CLR[article.category]}`}>
                    {CAT_LABEL[article.category]}
                  </span>
                )}
                {article.cefr_level && (
                  <span className="inline-flex px-2 py-0.5 rounded-full font-semibold bg-indigo-100 text-indigo-800">
                    {article.cefr_level}
                  </span>
                )}
                <span className="text-gray-400">·</span>
                <span className="text-gray-500">{article.source}</span>
                {article.published_at && <>
                  <span className="text-gray-400">·</span>
                  <span className="text-gray-500">{new Date(article.published_at).toLocaleDateString("tr-TR")}</span>
                </>}
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 leading-tight">{article.title}</h1>
              {article.subtitle && (
                <p className="text-lg text-gray-600 leading-relaxed">{article.subtitle}</p>
              )}
              {article.author && (
                <p className="text-sm text-gray-500">— {article.author}</p>
              )}
            </div>

            {/* TR özet */}
            {article.tr_summary && (
              <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200 p-5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 mb-2">
                  Türkçe Özet
                </div>
                <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">{article.tr_summary}</p>
              </div>
            )}

            {/* Key vocab */}
            {article.key_vocab && article.key_vocab.length > 0 && (
              <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-violet-700 mb-3 flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> Anahtar Kelimeler ({article.key_vocab.length})
                </div>
                <div className="space-y-2">
                  {article.key_vocab.map((v, i) => (
                    <div key={i} className="bg-white rounded-lg p-3 border border-violet-100">
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="font-bold text-violet-900">{v.word}</span>
                        <span className="text-sm text-gray-700">— {v.meaning_tr}</span>
                      </div>
                      <p className="text-xs italic text-gray-600 leading-relaxed">"{v.context}"</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Full body (İngilizce, tıklanabilir kelime sözlüğü) */}
            {article.body_text && (
              <details className="rounded-xl border border-gray-200 group" open>
                <summary className="cursor-pointer px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                  <Clock className="h-4 w-4" /> Makalenin Tamamı (İngilizce)
                  <span className="text-xs font-normal text-gray-500 ml-auto">
                    kelimeye tıkla → Türkçe anlam + telaffuz
                  </span>
                </summary>
                <div className="px-5 py-4 text-gray-800 leading-relaxed whitespace-pre-wrap text-sm md:text-base border-t relative">
                  <ClickableText text={article.body_text} vocab={vocabMap} />
                </div>
              </details>
            )}

            {/* Not */}
            <div className="rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="text-xs font-bold text-gray-600 uppercase tracking-wide">Notum</div>
                {!showNote && !article.user_note && (
                  <button onClick={() => setShowNote(true)} className="ml-auto text-xs text-indigo-600 hover:underline">
                    + Not ekle
                  </button>
                )}
              </div>
              {showNote || article.user_note ? (
                <>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    placeholder="Bu makale hakkında notların..."
                    className="w-full rounded-lg border-gray-300 px-3 py-2 text-sm"
                  />
                  <div className="flex gap-2 mt-2">
                    <button onClick={saveNote} disabled={saving}
                      className="ml-auto rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 text-sm font-medium disabled:opacity-50 inline-flex items-center gap-1">
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Notu Kaydet
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-400 italic">Henüz not yok.</p>
              )}
            </div>
          </article>
        )}
      </div>
    </div>
  );
}

