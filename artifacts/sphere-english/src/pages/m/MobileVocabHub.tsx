import { useEffect, useState } from "react";
import {
  ModuleShell, LoadingState, ErrorState,
  colors, fonts, radius,
} from "@/components/mobile";
import VocabWordDetailModal from "@/components/vocab/VocabWordDetailModal";
import {
  Heart, Volume2, X, Check, CheckCircle2, Target, Brain, Sparkles,
  BookOpen, Search, Compass,
} from "lucide-react";

/**
 * /m/kelime-hub — Mobil Kelime Hub (SRS tekrar + favoriler).
 *
 * Tasarım kılavuzu uyumlu (colors tokens, Outfit/PJS fontlar).
 * Dark mode otomatik — tüm renkler CSS var üzerinden.
 */

interface Word {
  id: number;
  word: string;
  turkish: string;
  level: string;
  category: string;
  pronunciation: string | null;
  exampleSentence: string | null;
  exampleSentenceTurkish: string | null;
  synonyms?: string[] | null;
}

interface ReviewWord extends Word {
  streak?: number;
}

interface Stats {
  tracked: number;
  due: number;
  learned: number;
  favorites: number;
}

const TOKEN_KEY = "sphere_token";
function authHeaders() {
  const t = localStorage.getItem(TOKEN_KEY);
  return t ? { Authorization: `Bearer ${t}` } : {};
}
async function apiJson(path: string, init?: RequestInit) {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...authHeaders(), ...(init?.headers || {}) },
  });
  if (!res.ok) throw new Error("Hata");
  return res.json();
}
function playTTS(text: string) {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 0.9;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch { /* ignore */ }
}

export default function MobileVocabHub() {
  const [tab, setTab] = useState<"review" | "favorites" | "explore">("review");
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedWordId, setSelectedWordId] = useState<number | null>(null);

  const loadStats = async () => {
    try {
      setStats(await apiJson("/api/vocab/review/stats"));
    } catch (e: any) {
      setError(e?.message || "Yüklenemedi");
    }
  };
  useEffect(() => { loadStats(); }, []);

  if (error && !stats) {
    return (
      <ModuleShell title="Kelime Çalışma" backTo="/m">
        <ErrorState message={error} />
      </ModuleShell>
    );
  }

  return (
    <ModuleShell title="Kelime Çalışma" subtitle="Günlük tekrar + favoriler" backTo="/m" withTabBar>
      {/* Stats */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginBottom: 16 }}>
          <StatCard icon={<Brain size={16} />} label="Takipte" value={stats.tracked} />
          <StatCard icon={<Target size={16} />} label="Bugün" value={stats.due} highlight={stats.due > 0} />
          <StatCard icon={<CheckCircle2 size={16} />} label="Öğrenildi" value={stats.learned} />
          <StatCard icon={<Heart size={16} />} label="Favori" value={stats.favorites} />
        </div>
      )}

      {/* Tabs */}
      <div style={{
        display: "flex", gap: 4, borderBottom: `1px solid ${colors.navy100}`,
        marginBottom: 16,
      }}>
        {[
          { key: "review", label: `Tekrar${stats?.due ? ` (${stats.due})` : ""}` },
          { key: "favorites", label: `Favoriler${stats?.favorites ? ` (${stats.favorites})` : ""}` },
          { key: "explore", label: "Keşfet" },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key as any)}
            style={{
              background: "none",
              border: "none",
              padding: "10px 14px",
              fontFamily: fonts.body,
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
              color: tab === t.key ? colors.navy : colors.neutral,
              borderBottom: tab === t.key ? `2px solid ${colors.turq}` : "2px solid transparent",
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "review"
        ? <ReviewTab onDone={loadStats} />
        : tab === "favorites"
        ? <FavoritesTab onOpenWord={setSelectedWordId} />
        : <ExploreTab onOpenWord={setSelectedWordId} />}

      {selectedWordId !== null && (
        <VocabWordDetailModal wordId={selectedWordId} onClose={() => {
          setSelectedWordId(null);
          loadStats(); // modalda favori değişmiş olabilir
        }} />
      )}
    </ModuleShell>
  );
}

function StatCard({ icon, label, value, highlight }: {
  icon: React.ReactNode; label: string; value: number; highlight?: boolean;
}) {
  return (
    <div style={{
      background: highlight ? colors.turq + "15" : colors.white,
      border: `1px solid ${highlight ? colors.turq + "55" : colors.navy100}`,
      borderRadius: radius.card,
      padding: 12,
      display: "flex", alignItems: "center", gap: 10,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: radius.chip,
        background: highlight ? colors.turq : colors.navy50,
        color: highlight ? colors.white : colors.navy,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 11, color: colors.neutral, fontFamily: fonts.body }}>{label}</div>
        <div style={{ fontSize: 18, fontWeight: 800, fontFamily: fonts.heading, color: colors.navy }}>{value}</div>
      </div>
    </div>
  );
}

// ─── Günlük Tekrar ─────────────────────────────────────────────────────

function ReviewTab({ onDone }: { onDone: () => void }) {
  const [words, setWords] = useState<ReviewWord[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sessionDone, setSessionDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const data = await apiJson("/api/vocab/review");
      setWords(data.words || []);
      setIdx(0); setRevealed(false); setSessionDone(false);
    } catch (e: any) {
      setError(e?.message || "Yüklenemedi");
    }
  };
  useEffect(() => { load(); }, []);

  const current = words?.[idx];

  const answer = async (quality: 0 | 1 | 2) => {
    if (!current) return;
    setSubmitting(true);
    try {
      await apiJson(`/api/vocab/review/${current.id}`, {
        method: "POST",
        body: JSON.stringify({ quality }),
      });
      if (idx + 1 >= (words?.length || 0)) {
        setSessionDone(true);
        onDone();
      } else {
        setIdx(i => i + 1);
        setRevealed(false);
      }
    } catch (e: any) {
      alert(e?.message || "Kaydedilemedi");
    } finally {
      setSubmitting(false);
    }
  };

  if (error) return <ErrorState message={error} />;
  if (!words) return <LoadingState message="Yükleniyor..." />;

  if (sessionDone || words.length === 0) {
    return (
      <div style={{
        padding: 32, textAlign: "center",
        background: colors.white, borderRadius: radius.panel,
        border: `1px solid ${colors.navy100}`,
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: "50%",
          background: colors.success + "22", color: colors.success,
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 12px",
        }}>
          <CheckCircle2 size={28} />
        </div>
        <div style={{ fontFamily: fonts.heading, fontWeight: 800, fontSize: 18, color: colors.navy, marginBottom: 4 }}>
          {sessionDone ? "Harika iş!" : "Şu an tekrar yok"}
        </div>
        <div style={{ fontFamily: fonts.body, fontSize: 13, color: colors.neutral, marginBottom: 16, lineHeight: 1.5 }}>
          {sessionDone
            ? "Bugünkü tekrar tamam. Yarın görüşürüz."
            : "Kelime kartlarında kalbe basarak favorilere ekle, buradan tekrar edebilirsin."}
        </div>
        <button
          type="button"
          onClick={load}
          style={{
            background: colors.brand, color: colors.onBrand,
            border: "none", padding: "10px 16px", borderRadius: radius.pill,
            fontFamily: fonts.heading, fontWeight: 700, fontSize: 13,
            display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer",
          }}
        >
          <Sparkles size={14} /> Yenile
        </button>
      </div>
    );
  }

  if (!current) return null;

  return (
    <div>
      <div style={{
        fontSize: 11, color: colors.neutral, fontFamily: fonts.body,
        textAlign: "center", marginBottom: 12,
        textTransform: "uppercase", letterSpacing: "0.06em",
      }}>
        {idx + 1} / {words.length}
      </div>

      {/* Kart */}
      <div style={{
        background: colors.white,
        borderRadius: radius.panel,
        border: `1px solid ${colors.navy100}`,
        padding: 28,
        textAlign: "center",
        minHeight: 240,
        display: "flex", flexDirection: "column", justifyContent: "center",
        marginBottom: 16,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 6 }}>
          <div style={{
            fontFamily: fonts.heading, fontWeight: 900, fontSize: 32,
            color: colors.navy, letterSpacing: "-0.02em",
          }}>
            {current.word}
          </div>
          <button
            type="button"
            onClick={() => playTTS(current.word)}
            style={{
              background: colors.turq + "15", color: colors.turqDeep,
              border: "none", width: 36, height: 36, borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
            }}
          >
            <Volume2 size={16} />
          </button>
        </div>
        {current.pronunciation && (
          <div style={{
            fontFamily: "monospace", fontSize: 13, color: colors.neutral, marginBottom: 10,
          }}>
            {current.pronunciation}
          </div>
        )}

        {revealed ? (
          <>
            <div style={{
              fontFamily: fonts.heading, fontWeight: 700, fontSize: 22,
              color: colors.turqDeep, marginTop: 8,
            }}>
              {current.turkish}
            </div>
            {current.exampleSentence && (
              <div style={{
                fontFamily: fonts.body, fontSize: 13, color: colors.neutral,
                marginTop: 10, lineHeight: 1.5, fontStyle: "italic",
              }}>
                "{current.exampleSentence}"
              </div>
            )}
            {current.exampleSentenceTurkish && (
              <div style={{
                fontFamily: fonts.body, fontSize: 12, color: colors.navy400,
                marginTop: 4,
              }}>
                {current.exampleSentenceTurkish}
              </div>
            )}
          </>
        ) : (
          <button
            type="button"
            onClick={() => setRevealed(true)}
            style={{
              marginTop: 16,
              background: colors.brand, color: colors.onBrand,
              border: "none", padding: "10px 24px", borderRadius: radius.pill,
              fontFamily: fonts.heading, fontWeight: 700, fontSize: 14,
              cursor: "pointer", alignSelf: "center",
            }}
          >
            Göster
          </button>
        )}
      </div>

      {revealed && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          <AnswerButton
            variant="error"
            icon={<X size={14} />}
            label="Bilmedim"
            disabled={submitting}
            onClick={() => answer(0)}
          />
          <AnswerButton
            variant="warn"
            label="Zor"
            disabled={submitting}
            onClick={() => answer(1)}
          />
          <AnswerButton
            variant="success"
            icon={<Check size={14} />}
            label="Kolay"
            disabled={submitting}
            onClick={() => answer(2)}
          />
        </div>
      )}
    </div>
  );
}

function AnswerButton({ variant, icon, label, onClick, disabled }: {
  variant: "error" | "warn" | "success";
  icon?: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  const bg = variant === "error" ? colors.errorBg : variant === "warn" ? colors.warnBg : colors.successBg;
  const text = variant === "error" ? colors.errorText : variant === "warn" ? colors.warnText : colors.successText;
  const border = variant === "error" ? colors.errorBorder : variant === "warn" ? colors.warnBorder : colors.successBorder;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        background: bg, color: text,
        border: `2px solid ${border}`,
        padding: "12px 8px", borderRadius: radius.card,
        fontFamily: fonts.heading, fontWeight: 700, fontSize: 13,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {icon}
      {label}
    </button>
  );
}

// ─── Favoriler ─────────────────────────────────────────────────────────

function FavoritesTab({ onOpenWord }: { onOpenWord: (id: number) => void }) {
  const [words, setWords] = useState<Word[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiJson("/api/vocab/favorites");
        setWords(data.words || []);
      } catch (e: any) {
        setError(e?.message || "Yüklenemedi");
      }
    })();
  }, []);

  if (error) return <ErrorState message={error} />;
  if (!words) return <LoadingState message="Yükleniyor..." />;

  if (words.length === 0) {
    return (
      <div style={{
        padding: 32, textAlign: "center",
        background: colors.white, borderRadius: radius.panel,
        border: `1px solid ${colors.navy100}`,
      }}>
        <Heart size={40} color={colors.navy100} style={{ margin: "0 auto 10px" }} />
        <div style={{ fontFamily: fonts.heading, fontWeight: 700, fontSize: 15, color: colors.navy }}>
          Henüz favorin yok
        </div>
        <div style={{ fontFamily: fonts.body, fontSize: 12, color: colors.neutral, marginTop: 6, lineHeight: 1.5 }}>
          Kelime oyununda veya tekrar oturumunda kalbe basarak favorilerine ekle.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {words.map((w) => (
        <div
          key={w.id}
          onClick={() => onOpenWord(w.id)}
          style={{
            background: colors.white,
            borderRadius: radius.card,
            border: `1px solid ${colors.navy100}`,
            padding: 14,
            display: "flex", alignItems: "center", gap: 10,
            cursor: "pointer",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <div style={{ fontFamily: fonts.heading, fontWeight: 700, fontSize: 16, color: colors.navy }}>
                {w.word}
              </div>
              {w.pronunciation && (
                <div style={{ fontFamily: "monospace", fontSize: 11, color: colors.neutral }}>
                  {w.pronunciation}
                </div>
              )}
            </div>
            <div style={{ fontFamily: fonts.body, fontSize: 13, color: colors.navy400, marginTop: 2 }}>
              {w.turkish}
            </div>
          </div>
          <div style={{
            fontSize: 10, fontWeight: 700, fontFamily: fonts.heading,
            padding: "3px 8px", borderRadius: radius.pill,
            background: colors.turq + "15", color: colors.turqDeep,
          }}>
            {w.level}
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); playTTS(w.word); }}
            style={{
              background: "none", border: "none", padding: 6, cursor: "pointer",
              color: colors.turqDeep,
            }}
          >
            <Volume2 size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Keşfet ─────────────────────────────────────────────────────────────

function ExploreTab({ onOpenWord }: { onOpenWord: (id: number) => void }) {
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState<string>("");
  const [letter, setLetter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [words, setWords] = useState<Word[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [favorites, setFavorites] = useState<Set<number>>(new Set());

  const loadFavorites = async () => {
    try {
      const data = await apiJson("/api/vocab/favorites");
      setFavorites(new Set((data.words || []).map((w: Word) => w.id)));
    } catch { /* ignore */ }
  };
  useEffect(() => { loadFavorites(); }, []);

  const toggleFav = async (wordId: number, isFav: boolean) => {
    // Optimistik güncelle
    setFavorites((prev) => {
      const next = new Set(prev);
      if (isFav) next.delete(wordId); else next.add(wordId);
      return next;
    });
    try {
      await apiJson(`/api/vocab/favorites/${wordId}`, { method: isFav ? "DELETE" : "POST" });
    } catch {
      // revert on error
      loadFavorites();
    }
  };

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const qp = new URLSearchParams();
        if (search.trim()) qp.set("q", search.trim());
        if (level) qp.set("level", level);
        if (letter) qp.set("startsWith", letter);
        qp.set("page", String(page));
        qp.set("limit", "20");
        const data = await apiJson(`/api/vocab/words?${qp.toString()}`);
        setWords(data.words || []);
        setTotal(data.total || 0);
      } catch (e) {
        /* ignore */
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [search, level, letter, page]);

  const totalPages = Math.max(1, Math.ceil(total / 20));

  return (
    <div>
      {/* Search + level filter */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1, position: "relative" }}>
          <Search size={14} style={{
            position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
            color: colors.neutral,
          }} />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="İngilizce veya Türkçe ara..."
            style={{
              width: "100%", padding: "8px 10px 8px 30px",
              border: `1px solid ${colors.navy100}`,
              borderRadius: radius.chip,
              fontFamily: fonts.body, fontSize: 13,
              background: colors.white, color: colors.navy,
              outline: "none",
            }}
          />
        </div>
        <select
          value={level}
          onChange={(e) => { setLevel(e.target.value); setPage(1); }}
          style={{
            padding: "8px 10px",
            border: `1px solid ${colors.navy100}`,
            borderRadius: radius.chip,
            fontFamily: fonts.body, fontSize: 13,
            background: colors.white, color: colors.navy,
          }}
        >
          <option value="">Hepsi</option>
          {["A1","A2","B1","B2","C1","C2"].map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>

      {/* Alfabe filtresi — yatay scroll */}
      <div style={{
        display: "flex", gap: 4, marginBottom: 12,
        overflowX: "auto", paddingBottom: 4,
        WebkitOverflowScrolling: "touch",
      }}>
        <button
          type="button"
          onClick={() => { setLetter(""); setPage(1); }}
          style={{
            flexShrink: 0,
            padding: "6px 10px",
            borderRadius: radius.chip,
            border: "none",
            background: letter === "" ? colors.brand : colors.navy50,
            color: letter === "" ? colors.onBrand : colors.navy,
            fontFamily: fonts.heading, fontWeight: 700, fontSize: 11,
            cursor: "pointer",
          }}
        >
          Hepsi
        </button>
        {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => { setLetter(l.toLowerCase()); setPage(1); }}
            style={{
              flexShrink: 0,
              width: 28, height: 28,
              borderRadius: radius.chip,
              border: "none",
              background: letter === l.toLowerCase() ? colors.brand : colors.navy50,
              color: letter === l.toLowerCase() ? colors.onBrand : colors.navy,
              fontFamily: fonts.heading, fontWeight: 700, fontSize: 12,
              cursor: "pointer",
            }}
          >
            {l}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingState message="Yükleniyor..." />
      ) : words.length === 0 ? (
        <div style={{
          padding: 32, textAlign: "center",
          background: colors.white, borderRadius: radius.panel,
          border: `1px solid ${colors.navy100}`,
        }}>
          <Compass size={32} color={colors.navy100} style={{ margin: "0 auto 10px" }} />
          <div style={{ fontFamily: fonts.body, fontSize: 13, color: colors.neutral }}>
            Sonuç bulunamadı
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {words.map((w) => {
              const isFav = favorites.has(w.id);
              return (
                <div
                  key={w.id}
                  onClick={() => onOpenWord(w.id)}
                  style={{
                    background: colors.white,
                    borderRadius: radius.card,
                    border: `1px solid ${colors.navy100}`,
                    padding: 12,
                    display: "flex", alignItems: "center", gap: 10,
                    cursor: "pointer",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                      <div style={{ fontFamily: fonts.heading, fontWeight: 700, fontSize: 15, color: colors.navy }}>
                        {w.word}
                      </div>
                      {w.pronunciation && (
                        <div style={{ fontFamily: "monospace", fontSize: 10, color: colors.neutral }}>
                          {w.pronunciation}
                        </div>
                      )}
                    </div>
                    <div style={{ fontFamily: fonts.body, fontSize: 12, color: colors.navy400, marginTop: 2 }}>
                      {w.turkish}
                    </div>
                  </div>
                  <div style={{
                    fontSize: 10, fontWeight: 700, fontFamily: fonts.heading,
                    padding: "2px 6px", borderRadius: radius.pill,
                    background: colors.navy50, color: colors.navy,
                  }}>
                    {w.level}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggleFav(w.id, isFav); }}
                    style={{
                      background: "none", border: "none", padding: 6, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                    aria-label={isFav ? "Favoriden çıkar" : "Favorilere ekle"}
                  >
                    <Heart
                      size={16}
                      color={isFav ? "#ef4444" : colors.neutral}
                      fill={isFav ? "#ef4444" : "none"}
                    />
                  </button>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div style={{
              display: "flex", justifyContent: "center", alignItems: "center",
              gap: 10, marginTop: 16,
            }}>
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{
                  padding: "6px 12px", borderRadius: radius.chip,
                  border: `1px solid ${colors.navy100}`,
                  background: colors.white, color: colors.navy,
                  fontFamily: fonts.body, fontSize: 12,
                  opacity: page === 1 ? 0.5 : 1,
                  cursor: page === 1 ? "default" : "pointer",
                }}
              >
                Önceki
              </button>
              <div style={{ fontFamily: fonts.body, fontSize: 12, color: colors.neutral }}>
                {page} / {totalPages}
              </div>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={{
                  padding: "6px 12px", borderRadius: radius.chip,
                  border: `1px solid ${colors.navy100}`,
                  background: colors.white, color: colors.navy,
                  fontFamily: fonts.body, fontSize: 12,
                  opacity: page === totalPages ? 0.5 : 1,
                  cursor: page === totalPages ? "default" : "pointer",
                }}
              >
                Sonraki
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
