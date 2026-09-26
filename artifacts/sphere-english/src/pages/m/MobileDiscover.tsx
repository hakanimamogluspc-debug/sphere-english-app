import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API } from "@/lib/api-url";
import {
  ModuleShell, LoadingState, Toast, useToast, MobileModuleIntro,
  colors, fonts, radius,
} from "@/components/mobile";
import {
  Newspaper, Search, Bookmark, BookmarkCheck, X, ExternalLink,
  Sparkles, Filter, Save,
} from "lucide-react";

/**
 * /m/pratik/kesfet — Mobil Keşfet
 * İş dünyası haberleri + TR özet + kelime kartları + kaydet + not.
 */

const TOKEN_KEY = "sphere_token";

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
  audio_url?: string | null;
  duration_sec?: number | null;
  content_type?: string | null;
};

const CATEGORIES = [
  { v: "all",         l: "Tümü" },
  { v: "finance",     l: "Finans",     bg: "#dbeafe", color: "#1e40af" },
  { v: "tech",        l: "Teknoloji",  bg: "#ede9fe", color: "#6b21a8" },
  { v: "leadership",  l: "Liderlik",   bg: "#ffedd5", color: "#c2410c" },
  { v: "negotiation", l: "Müzakere",   bg: "#ccfbf1", color: "#0f766e" },
  { v: "general",     l: "Genel",      bg: "#f3f4f6", color: "#374151" },
];

const CAT_META: Record<string, { label: string; bg: string; color: string }> = Object.fromEntries(
  CATEGORIES.filter((c) => c.v !== "all").map((c) => [c.v, { label: c.l, bg: c.bg!, color: c.color! }])
);

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

export default function MobileDiscover() {
  const [category, setCategory] = useState("all");
  const [cefr, setCefr] = useState("all");
  const [q, setQ] = useState("");
  const [savedOnly, setSavedOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const { toast, show: showToast, hide: hideToast } = useToast();

  const load = useCallback(async (reset = false) => {
    if (loading) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        category, cefr, q, limit: "12",
        ...(reset ? {} : cursor ? { cursor: String(cursor) } : {}),
        ...(savedOnly ? { saved: "1" } : {}),
      });
      const d = await apiFetch(`/content/feed?${params}`);
      const newItems: FeedItem[] = d.items ?? [];
      setItems((prev) => (reset ? newItems : [...prev, ...newItems]));
      setCursor(d.nextCursor);
      setHasMore(!!d.nextCursor);
    } catch (e: any) {
      showToast(e?.message || "Yüklenemedi", "error");
    } finally {
      setLoading(false);
    }
  }, [category, cefr, q, savedOnly, cursor, loading]);

  useEffect(() => {
    setItems([]); setCursor(null); setHasMore(true);
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, cefr, q, savedOnly]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore || loading) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) load(false);
    }, { rootMargin: "200px" });
    io.observe(node);
    return () => io.disconnect();
  }, [hasMore, loading, cursor, load]);

  const toggleSaved = (id: number, saved: boolean) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, saved } : i)));
  };

  return (
    <ModuleShell
      title="Keşfet"
      subtitle="İş dünyası haberleri · Türkçe özet"
      rightAction={
        <button
          onClick={() => setShowFilters((v) => !v)}
          aria-label="Filtre"
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
      <MobileModuleIntro moduleKey="discover" />

      {/* Arama */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "10px 14px", borderRadius: 12,
        border: `1px solid ${colors.navy100}`,
        background: colors.white, marginBottom: 12,
      }}>
        <Search size={16} color={colors.neutral} strokeWidth={2} />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Konu veya kelime ara…"
          style={{
            flex: 1, border: "none", outline: "none",
            fontFamily: fonts.body, fontSize: 14,
            background: "transparent", color: colors.navy,
          }}
        />
      </div>

      {/* Sadece kaydedilenler toggle */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        <button
          onClick={() => setSavedOnly(false)}
          style={{
            flex: 1, padding: "8px 12px", borderRadius: 100,
            background: !savedOnly ? colors.navy : colors.white,
            color: !savedOnly ? colors.white : colors.navy,
            border: `1px solid ${!savedOnly ? colors.navy : colors.navy100}`,
            fontFamily: fonts.heading, fontWeight: 700, fontSize: 12,
            cursor: "pointer",
          }}
        >Tümü</button>
        <button
          onClick={() => setSavedOnly(true)}
          style={{
            flex: 1, padding: "8px 12px", borderRadius: 100,
            background: savedOnly ? colors.navy : colors.white,
            color: savedOnly ? colors.white : colors.navy,
            border: `1px solid ${savedOnly ? colors.navy : colors.navy100}`,
            fontFamily: fonts.heading, fontWeight: 700, fontSize: 12,
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
          }}
        >
          <Bookmark size={12} strokeWidth={2.5} />
          Kayıtlılar
        </button>
      </div>

      {/* Filtre paneli */}
      {showFilters && (
        <div style={{
          padding: 12, marginBottom: 16,
          background: colors.navy50, borderRadius: 12,
        }}>
          <div style={{
            fontFamily: fonts.heading, fontWeight: 700, fontSize: 10,
            color: colors.neutral, textTransform: "uppercase", letterSpacing: "0.06em",
            marginBottom: 8,
          }}>Kategori</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
            {CATEGORIES.map((c) => (
              <button
                key={c.v}
                onClick={() => setCategory(c.v)}
                style={{
                  padding: "6px 12px", borderRadius: 100,
                  background: category === c.v ? colors.navy : colors.white,
                  color: category === c.v ? colors.white : colors.navy,
                  border: `1px solid ${category === c.v ? colors.navy : colors.navy100}`,
                  fontFamily: fonts.heading, fontWeight: 700, fontSize: 11,
                  cursor: "pointer",
                }}
              >{c.l}</button>
            ))}
          </div>

          <div style={{
            fontFamily: fonts.heading, fontWeight: 700, fontSize: 10,
            color: colors.neutral, textTransform: "uppercase", letterSpacing: "0.06em",
            marginBottom: 8,
          }}>Seviye</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {["all", "A2", "B1", "B2", "C1", "C2"].map((c) => (
              <button
                key={c}
                onClick={() => setCefr(c)}
                style={{
                  padding: "6px 10px", borderRadius: 100,
                  background: cefr === c ? colors.navy : colors.white,
                  color: cefr === c ? colors.white : colors.navy,
                  border: `1px solid ${cefr === c ? colors.navy : colors.navy100}`,
                  fontFamily: fonts.heading, fontWeight: 700, fontSize: 11,
                  cursor: "pointer",
                }}
              >{c === "all" ? "Tümü" : c}</button>
            ))}
          </div>
        </div>
      )}

      {/* Grid */}
      {items.length === 0 && !loading ? (
        <div style={{
          padding: 40, textAlign: "center",
          color: colors.neutral, fontSize: 13,
        }}>
          <Newspaper size={40} color={colors.navy100} style={{ marginBottom: 12 }} />
          <div>{savedOnly ? "Henüz makale kaydetmedin." : "Bu filtreye uygun makale yok."}</div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {items.map((item) => (
            <ArticleCard key={item.id} item={item} onClick={() => setSelectedId(item.id)} />
          ))}
        </div>
      )}

      {/* Sentinel + loading */}
      {hasMore && (
        <div ref={sentinelRef} style={{ padding: "20px 0" }}>
          {loading && <LoadingState compact messages={["Daha fazla yükleniyor…"]} />}
        </div>
      )}
      {loading && items.length === 0 && (
        <LoadingState compact messages={["Haberler yükleniyor…"]} />
      )}

      {selectedId && (
        <ArticleSheet
          articleId={selectedId}
          onClose={() => setSelectedId(null)}
          onSavedChange={(s) => toggleSaved(selectedId, s)}
        />
      )}

      <Toast {...toast} onClose={hideToast} />
    </ModuleShell>
  );
}

function ArticleCard({ item, onClick }: { item: FeedItem; onClick: () => void }) {
  const cat = item.category ? CAT_META[item.category] : null;
  return (
    <button
      onClick={onClick}
      style={{
        background: colors.white,
        border: `1px solid ${colors.navy100}`,
        borderRadius: radius.card, overflow: "hidden",
        cursor: "pointer", textAlign: "left",
        display: "flex", flexDirection: "column", padding: 0,
      }}
    >
      {item.image_url ? (
        <div style={{
          aspectRatio: "16/9", position: "relative",
          background: colors.navy50, overflow: "hidden",
        }}>
          <img src={item.image_url} alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            loading="lazy"
          />
          {item.saved && (
            <div style={{
              position: "absolute", top: 8, right: 8,
              background: colors.white, padding: 6, borderRadius: "50%",
              display: "flex",
              boxShadow: "0 2px 6px rgba(30, 58, 110, 0.16)",
            }}>
              <BookmarkCheck size={14} color={colors.turqDeep} strokeWidth={2.5} />
            </div>
          )}
        </div>
      ) : (
        <div style={{
          aspectRatio: "16/9",
          background: `linear-gradient(135deg, ${colors.navy50}, ${colors.turq}22)`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Newspaper size={30} color={colors.navy100} />
        </div>
      )}

      <div style={{ padding: 12 }}>
        <div style={{
          display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6,
        }}>
          {cat && (
            <span style={{
              padding: "2px 6px", borderRadius: 6,
              background: cat.bg, color: cat.color,
              fontFamily: fonts.heading, fontWeight: 800, fontSize: 9,
              letterSpacing: "0.04em",
            }}>{cat.label}</span>
          )}
          {item.cefr_level && (
            <span style={{
              padding: "2px 6px", borderRadius: 6,
              background: colors.navy50, color: colors.navy,
              fontFamily: fonts.heading, fontWeight: 800, fontSize: 9,
              letterSpacing: "0.04em",
            }}>{item.cefr_level}</span>
          )}
        </div>
        <div style={{
          fontFamily: fonts.heading, fontWeight: 800, fontSize: 15,
          color: colors.navy, letterSpacing: "-0.01em",
          lineHeight: 1.3, marginBottom: 4,
          display: "-webkit-box", WebkitLineClamp: 2 as any,
          WebkitBoxOrient: "vertical" as any, overflow: "hidden",
        }}>{item.title}</div>
        {item.tr_summary && (
          <div style={{
            fontSize: 12, color: colors.neutral,
            lineHeight: 1.5, marginBottom: 6,
            display: "-webkit-box", WebkitLineClamp: 3 as any,
            WebkitBoxOrient: "vertical" as any, overflow: "hidden",
          }}>{item.tr_summary}</div>
        )}
        {item.published_at && (
          <div style={{ fontSize: 10, color: colors.navy400 }}>
            {new Date(item.published_at).toLocaleDateString("tr-TR")}
            {item.author && <> · {item.author}</>}
          </div>
        )}
      </div>
    </button>
  );
}

function ArticleSheet({
  articleId, onClose, onSavedChange,
}: {
  articleId: number;
  onClose: () => void;
  onSavedChange: (s: boolean) => void;
}) {
  const [article, setArticle] = useState<ArticleFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const { toast, show, hide } = useToast();

  useEffect(() => {
    (async () => {
      try {
        const d = await apiFetch(`/content/${articleId}`);
        const a: ArticleFull = d.article;
        setArticle(a);
        setNote(a.user_note ?? "");
      } catch (e: any) {
        show(e?.message || "Yüklenemedi", "error");
        onClose();
      } finally { setLoading(false); }
    })();
  }, [articleId]);

  const toggleSave = async () => {
    if (!article) return;
    setSaving(true);
    try {
      if (article.saved_at) {
        await apiFetch(`/content/${articleId}/save`, { method: "DELETE" });
        setArticle({ ...article, saved_at: null });
        onSavedChange(false);
        show("Kaldırıldı", "info");
      } else {
        await apiFetch(`/content/${articleId}/save`, {
          method: "POST", body: JSON.stringify({ note }),
        });
        setArticle({ ...article, saved_at: new Date().toISOString() });
        onSavedChange(true);
        show("Kaydedildi", "success");
      }
    } catch (e: any) {
      show(e?.message || "Bir hata oluştu", "error");
    } finally { setSaving(false); }
  };

  const saveNote = async () => {
    if (!article) return;
    setSaving(true);
    try {
      await apiFetch(`/content/${articleId}/save`, {
        method: "POST", body: JSON.stringify({ note }),
      });
      setArticle({ ...article, saved_at: article.saved_at ?? new Date().toISOString(), user_note: note });
      onSavedChange(true);
      setShowNote(false);
      show("Not kaydedildi", "success");
    } catch (e: any) {
      show(e?.message || "Bir hata oluştu", "error");
    } finally { setSaving(false); }
  };

  const cat = article?.category ? CAT_META[article.category] : null;

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(10,20,40,0.6)", zIndex: 200 }}
      />
      <div style={{
        position: "fixed", left: 0, right: 0, bottom: 0, top: 40,
        background: colors.white, borderRadius: "24px 24px 0 0",
        zIndex: 201, overflow: "auto",
        animation: "sheet-up 0.28s cubic-bezier(0.16, 1, 0.3, 1)",
      }}>
        <style>{`
          @keyframes sheet-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
        `}</style>

        {/* Sticky header */}
        <div style={{
          position: "sticky", top: 0, zIndex: 5,
          background: colors.white,
          borderBottom: `1px solid ${colors.navy50}`,
          padding: "10px 14px",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <button
            onClick={onClose}
            aria-label="Kapat"
            style={{
              background: colors.navy50, border: "none",
              width: 36, height: 36, borderRadius: 18,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: colors.navy,
            }}
          >
            <X size={16} strokeWidth={2.5} />
          </button>
          <div style={{ flex: 1 }} />
          {article?.url && (
            <a
              href={article.url}
              target="_blank" rel="noreferrer"
              style={{
                fontSize: 11, color: colors.turqDeep,
                fontFamily: fonts.heading, fontWeight: 700,
                textTransform: "uppercase", letterSpacing: "0.06em",
                display: "flex", alignItems: "center", gap: 4,
                padding: 8, textDecoration: "none",
              }}
            >
              <ExternalLink size={11} strokeWidth={2.5} />
              Orijinal
            </a>
          )}
          <button
            onClick={toggleSave}
            disabled={saving || !article}
            style={{
              display: "flex", alignItems: "center", gap: 4,
              padding: "8px 12px", borderRadius: 100,
              background: article?.saved_at ? colors.navy : colors.navy50,
              color: article?.saved_at ? colors.white : colors.navy,
              border: "none",
              fontFamily: fonts.heading, fontWeight: 800, fontSize: 12,
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.5 : 1,
            }}
          >
            {article?.saved_at
              ? <><BookmarkCheck size={12} strokeWidth={2.5} /> Kaydedildi</>
              : <><Bookmark size={12} strokeWidth={2.5} /> Kaydet</>
            }
          </button>
        </div>

        {loading || !article ? (
          <div style={{ padding: 40 }}>
            <LoadingState messages={["Makale yükleniyor…"]} />
          </div>
        ) : (
          <div style={{ padding: 16, paddingBottom: 32 }}>
            {/* Hero */}
            {article.image_url && (
              <img
                src={article.image_url} alt=""
                style={{
                  width: "100%", aspectRatio: "16/9",
                  objectFit: "cover", borderRadius: 12,
                  marginBottom: 14,
                }}
              />
            )}

            {/* Rozetler */}
            <div style={{
              display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10,
              fontSize: 10, color: colors.navy400,
            }}>
              {cat && (
                <span style={{
                  padding: "2px 6px", borderRadius: 6,
                  background: cat.bg, color: cat.color,
                  fontFamily: fonts.heading, fontWeight: 800, letterSpacing: "0.04em",
                }}>{cat.label}</span>
              )}
              {article.cefr_level && (
                <span style={{
                  padding: "2px 6px", borderRadius: 6,
                  background: colors.navy50, color: colors.navy,
                  fontFamily: fonts.heading, fontWeight: 800, letterSpacing: "0.04em",
                }}>{article.cefr_level}</span>
              )}
              <span style={{ padding: "2px 0" }}>{article.source}</span>
              {article.published_at && (
                <span style={{ padding: "2px 0" }}>
                  · {new Date(article.published_at).toLocaleDateString("tr-TR")}
                </span>
              )}
            </div>

            {/* Başlık */}
            <div style={{
              fontFamily: fonts.heading, fontWeight: 900, fontSize: 22,
              color: colors.navy, letterSpacing: "-0.02em",
              lineHeight: 1.25, marginBottom: 8,
            }}>{article.title}</div>
            {article.subtitle && (
              <div style={{
                fontSize: 15, color: colors.navy400,
                lineHeight: 1.5, marginBottom: 8,
              }}>{article.subtitle}</div>
            )}
            {article.author && (
              <div style={{
                fontSize: 12, color: colors.neutral, marginBottom: 16,
              }}>— {article.author}</div>
            )}

            {/* TR özet */}
            {article.tr_summary && (
              <div style={{
                padding: 14, marginBottom: 16,
                background: colors.turq + "12",
                border: `1px solid ${colors.turq}44`,
                borderRadius: 12,
              }}>
                <div style={{
                  fontFamily: fonts.heading, fontWeight: 800, fontSize: 10,
                  color: colors.turqDeep, textTransform: "uppercase", letterSpacing: "0.06em",
                  marginBottom: 6,
                }}>Türkçe özet</div>
                <div style={{
                  fontSize: 14, color: colors.navy, lineHeight: 1.6,
                  whiteSpace: "pre-wrap",
                }}>{article.tr_summary}</div>
              </div>
            )}

            {/* Podcast player */}
            {article.audio_url && (
              <div style={{
                padding: 14, marginBottom: 16,
                background: "#ecfeff",
                border: `1px solid #67e8f9`, borderRadius: 12,
              }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 6,
                  fontFamily: fonts.heading, fontWeight: 800, fontSize: 11,
                  color: "#0e7490", textTransform: "uppercase", letterSpacing: "0.06em",
                  marginBottom: 8,
                }}>
                  🎧 Podcast
                  {article.duration_sec && (
                    <span style={{ marginLeft: "auto", fontFamily: "monospace", fontWeight: 700 }}>
                      {Math.floor(article.duration_sec / 60)}:{String(article.duration_sec % 60).padStart(2, "0")}
                    </span>
                  )}
                </div>
                <audio controls src={article.audio_url} style={{ width: "100%" }} preload="none" />
              </div>
            )}

            {/* Anahtar kelimeler */}
            {article.key_vocab && article.key_vocab.length > 0 && (
              <div style={{
                padding: 14, marginBottom: 16,
                background: "#f5f3ff",
                border: `1px solid #ddd6fe`, borderRadius: 12,
              }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 4,
                  fontFamily: fonts.heading, fontWeight: 800, fontSize: 11,
                  color: "#6b21a8", textTransform: "uppercase", letterSpacing: "0.06em",
                  marginBottom: 10,
                }}>
                  <Sparkles size={11} strokeWidth={2.5} />
                  Anahtar kelimeler ({article.key_vocab.length})
                </div>
                {article.key_vocab.map((v, i) => (
                  <div key={i} style={{
                    padding: 10, marginBottom: 6,
                    background: colors.white, borderRadius: 10,
                    border: `1px solid #ede9fe`,
                  }}>
                    <div style={{
                      fontFamily: fonts.heading, fontWeight: 800, fontSize: 14,
                      color: "#6b21a8", marginBottom: 2,
                    }}>{v.word} <span style={{
                      color: colors.navy, fontWeight: 500,
                    }}>— {v.meaning_tr}</span></div>
                    {v.context && (
                      <div style={{
                        fontSize: 12, color: colors.neutral,
                        fontStyle: "italic", lineHeight: 1.5,
                      }}>"{v.context}"</div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Full body / orijinal link */}
            {article.body_text && article.body_text.length > 200 ? (
              <details style={{
                marginBottom: 16, border: `1px solid ${colors.navy50}`,
                borderRadius: 12, overflow: "hidden",
              }}>
                <summary style={{
                  padding: 12, cursor: "pointer",
                  fontFamily: fonts.heading, fontWeight: 800, fontSize: 12,
                  color: colors.navy, textTransform: "uppercase", letterSpacing: "0.06em",
                }}>Makalenin tamamı (İngilizce)</summary>
                <div style={{
                  padding: 14, borderTop: `1px solid ${colors.navy50}`,
                  fontSize: 14, color: colors.navy, lineHeight: 1.7,
                  whiteSpace: "pre-wrap",
                }}>{article.body_text}</div>
              </details>
            ) : article.url ? (
              <a
                href={article.url} target="_blank" rel="noreferrer"
                style={{
                  display: "block", padding: 16, marginBottom: 16,
                  background: colors.brand, color: colors.white,
                  borderRadius: 12, textAlign: "center",
                  textDecoration: "none",
                }}
              >
                <div style={{
                  fontFamily: fonts.heading, fontWeight: 700, fontSize: 10,
                  color: colors.turq, textTransform: "uppercase", letterSpacing: "0.06em",
                  marginBottom: 4,
                }}>Orijinal kaynak</div>
                <div style={{
                  fontFamily: fonts.heading, fontWeight: 800, fontSize: 14,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  letterSpacing: "-0.01em",
                }}>
                  {article.content_type === "podcast" ? "Kaynakta dinle" : "Kaynakta oku"}
                  <ExternalLink size={14} strokeWidth={2.5} />
                </div>
              </a>
            ) : null}

            {/* Not */}
            <div style={{
              padding: 14, background: colors.white,
              border: `1px solid ${colors.navy50}`, borderRadius: 12,
              marginBottom: 8,
            }}>
              <div style={{
                display: "flex", alignItems: "center", marginBottom: 8,
              }}>
                <div style={{
                  fontFamily: fonts.heading, fontWeight: 800, fontSize: 11,
                  color: colors.navy, textTransform: "uppercase", letterSpacing: "0.06em",
                }}>Notum</div>
                {!showNote && !article.user_note && (
                  <button
                    onClick={() => setShowNote(true)}
                    style={{
                      marginLeft: "auto", background: "transparent",
                      border: "none", cursor: "pointer",
                      fontSize: 11, color: colors.turqDeep,
                      fontFamily: fonts.heading, fontWeight: 700,
                    }}
                  >+ Not ekle</button>
                )}
              </div>
              {(showNote || article.user_note) ? (
                <>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    placeholder="Bu makale hakkında notların…"
                    style={{
                      width: "100%", padding: 10, borderRadius: 10,
                      border: `1px solid ${colors.navy100}`,
                      fontFamily: fonts.body, fontSize: 13,
                      resize: "vertical", outline: "none",
                    }}
                  />
                  <button
                    onClick={saveNote}
                    disabled={saving}
                    style={{
                      marginTop: 8, marginLeft: "auto", display: "flex",
                      padding: "8px 14px", borderRadius: 100,
                      background: colors.brand, color: colors.white, border: "none",
                      fontFamily: fonts.heading, fontWeight: 800, fontSize: 12,
                      cursor: saving ? "not-allowed" : "pointer",
                      opacity: saving ? 0.5 : 1,
                      alignItems: "center", gap: 4,
                    }}
                  >
                    <Save size={12} strokeWidth={2.5} />
                    Notu kaydet
                  </button>
                </>
              ) : (
                <div style={{
                  fontSize: 12, color: colors.neutral, fontStyle: "italic",
                }}>Henüz not yok.</div>
              )}
            </div>
          </div>
        )}

        <Toast {...toast} onClose={hide} />
      </div>
    </>
  );
}
