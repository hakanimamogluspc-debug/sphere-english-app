import { useEffect, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/core";
import {
  Heart, BookOpen, Brain, Target, Volume2, X, Check,
  CheckCircle2, Loader2, Sparkles,
} from "lucide-react";
import VocabWordDetailModal from "@/components/vocab/VocabWordDetailModal";

/**
 * VocabHub — Favoriler + Günlük Tekrar (SRS).
 * Tab'lı tek sayfa, hem desktop hem mobile uyumlu.
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
}

interface ReviewWord extends Word {
  streak: number;
  timesCorrect: number;
  timesWrong: number;
}

interface Stats {
  tracked: number;
  due: number;
  learned: number;
  favorites: number;
}

async function apiJson(path: string, init?: RequestInit) {
  const token = localStorage.getItem("sphere_token");
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
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

export default function VocabHub() {
  const [tab, setTab] = useState<"review" | "favorites">("review");
  const [selectedWordId, setSelectedWordId] = useState<number | null>(null);

  const { data: stats } = useQuery<Stats>({
    queryKey: ["/api/vocab/review/stats"],
    queryFn: () => apiJson("/api/vocab/review/stats"),
  });

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold font-display">Kelime Çalışma</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Günlük tekrar + favorilerin bir arada
        </p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="p-3 flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-blue-100 flex items-center justify-center">
              <Brain className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Takip edilen</p>
              <p className="text-lg font-bold">{stats.tracked}</p>
            </div>
          </Card>
          <Card className="p-3 flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-orange-100 flex items-center justify-center">
              <Target className="h-4 w-4 text-orange-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Vadesi gelen</p>
              <p className="text-lg font-bold">{stats.due}</p>
            </div>
          </Card>
          <Card className="p-3 flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Öğrenildi</p>
              <p className="text-lg font-bold">{stats.learned}</p>
            </div>
          </Card>
          <Card className="p-3 flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-red-100 flex items-center justify-center">
              <Heart className="h-4 w-4 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Favori</p>
              <p className="text-lg font-bold">{stats.favorites}</p>
            </div>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        <button
          type="button"
          onClick={() => setTab("review")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === "review" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Günlük Tekrar {stats && stats.due > 0 && `(${stats.due})`}
        </button>
        <button
          type="button"
          onClick={() => setTab("favorites")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === "favorites" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Favoriler {stats && stats.favorites > 0 && `(${stats.favorites})`}
        </button>
      </div>

      {tab === "review" ? (
        <ReviewTab onOpenWord={setSelectedWordId} />
      ) : (
        <FavoritesTab onOpenWord={setSelectedWordId} />
      )}

      {selectedWordId !== null && (
        <VocabWordDetailModal
          wordId={selectedWordId}
          onClose={() => setSelectedWordId(null)}
        />
      )}
    </div>
  );
}

// ─── Günlük Tekrar ─────────────────────────────────────────────────────

function ReviewTab({ onOpenWord }: { onOpenWord: (id: number) => void }) {
  const qc = useQueryClient();
  const { data, isLoading, refetch } = useQuery<{ words: ReviewWord[]; due: number }>({
    queryKey: ["/api/vocab/review"],
    queryFn: () => apiJson("/api/vocab/review"),
  });
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [sessionDone, setSessionDone] = useState(false);

  const words = data?.words ?? [];
  const current = words[idx];

  useEffect(() => { setIdx(0); setRevealed(false); setSessionDone(false); }, [data?.words?.length]);

  const answer = useMutation({
    mutationFn: ({ wordId, quality }: { wordId: number; quality: 0 | 1 | 2 }) =>
      apiJson(`/api/vocab/review/${wordId}`, { method: "POST", body: JSON.stringify({ quality }) }),
    onSuccess: () => {
      if (idx + 1 >= words.length) {
        setSessionDone(true);
        qc.invalidateQueries({ queryKey: ["/api/vocab/review/stats"] });
      } else {
        setIdx((i) => i + 1);
        setRevealed(false);
      }
    },
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (sessionDone || words.length === 0) {
    return (
      <Card className="p-12 text-center space-y-4">
        <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
        <div>
          <p className="font-semibold text-lg">
            {sessionDone ? "Harika! Oturum tamamlandı." : "Şu an tekrar edilecek kelime yok."}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {sessionDone ? "Yarın tekrar bekliyoruz." : "Yeni kelime öğren veya favorilere ekle, sonra buradan tekrar edebilirsin."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setSessionDone(false); refetch(); }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
        >
          <Sparkles className="h-4 w-4" /> Yenile
        </button>
      </Card>
    );
  }

  if (!current) return null;

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        {idx + 1} / {words.length}
      </p>

      <Card className="p-8 text-center space-y-4 min-h-[280px] flex flex-col justify-center">
        <div className="flex items-center justify-center gap-3">
          <h2 className="text-4xl font-bold font-display">{current.word}</h2>
          <button
            type="button"
            onClick={() => playTTS(current.word)}
            className="h-10 w-10 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center"
          >
            <Volume2 className="h-4 w-4 text-primary" />
          </button>
        </div>
        {current.pronunciation && (
          <p className="text-sm text-muted-foreground font-mono">{current.pronunciation}</p>
        )}

        {revealed ? (
          <div className="space-y-3 pt-2">
            <p className="text-2xl font-semibold text-primary">{current.turkish}</p>
            {current.exampleSentence && (
              <p className="text-sm italic text-muted-foreground">
                "{current.exampleSentence}"
              </p>
            )}
            {current.exampleSentenceTurkish && (
              <p className="text-xs text-muted-foreground">
                {current.exampleSentenceTurkish}
              </p>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="mt-4 px-6 py-2 rounded-lg bg-primary text-primary-foreground font-medium"
          >
            Göster
          </button>
        )}
      </Card>

      {revealed && (
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            disabled={answer.isPending}
            onClick={() => answer.mutate({ wordId: current.id, quality: 0 })}
            className="py-3 rounded-xl border-2 border-red-200 bg-red-50 text-red-700 font-medium hover:bg-red-100 transition-colors disabled:opacity-50"
          >
            <X className="h-4 w-4 inline mb-0.5" /> Bilmedim
          </button>
          <button
            type="button"
            disabled={answer.isPending}
            onClick={() => answer.mutate({ wordId: current.id, quality: 1 })}
            className="py-3 rounded-xl border-2 border-amber-200 bg-amber-50 text-amber-700 font-medium hover:bg-amber-100 transition-colors disabled:opacity-50"
          >
            Zor
          </button>
          <button
            type="button"
            disabled={answer.isPending}
            onClick={() => answer.mutate({ wordId: current.id, quality: 2 })}
            className="py-3 rounded-xl border-2 border-green-200 bg-green-50 text-green-700 font-medium hover:bg-green-100 transition-colors disabled:opacity-50"
          >
            <Check className="h-4 w-4 inline mb-0.5" /> Kolay
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => onOpenWord(current.id)}
        className="w-full text-xs text-muted-foreground hover:text-foreground py-2"
      >
        Detayları gör →
      </button>
    </div>
  );
}

// ─── Favoriler ─────────────────────────────────────────────────────────

function FavoritesTab({ onOpenWord }: { onOpenWord: (id: number) => void }) {
  const { data, isLoading } = useQuery<{ words: Word[] }>({
    queryKey: ["/api/vocab/favorites"],
    queryFn: () => apiJson("/api/vocab/favorites"),
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }
  const words = data?.words ?? [];

  if (words.length === 0) {
    return (
      <Card className="p-12 text-center">
        <Heart className="h-12 w-12 text-red-200 mx-auto mb-3" />
        <p className="font-medium">Henüz favorin yok</p>
        <p className="text-sm text-muted-foreground mt-1">
          Vocab kartlarında kalp simgesine tıklayarak favorilerine ekle.
        </p>
      </Card>
    );
  }

  return (
    <div className="grid gap-2">
      {words.map((w) => (
        <Card
          key={w.id}
          className="p-4 cursor-pointer hover:border-primary/30 transition-colors border-2 border-border"
          onClick={() => onOpenWord(w.id)}
        >
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-lg">{w.word}</p>
                {w.pronunciation && (
                  <span className="text-xs text-muted-foreground font-mono">{w.pronunciation}</span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{w.turkish}</p>
            </div>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-secondary">
              {w.level}
            </span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); playTTS(w.word); }}
              className="h-8 w-8 rounded-full hover:bg-secondary flex items-center justify-center"
              aria-label="Dinle"
            >
              <Volume2 className="h-4 w-4 text-primary" />
            </button>
          </div>
        </Card>
      ))}
    </div>
  );
}
