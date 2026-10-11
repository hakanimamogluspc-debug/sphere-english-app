import { useEffect, useState } from "react";
import { Heart, Volume2, X, Loader2, BookOpen, Hash, Target } from "lucide-react";

/**
 * VocabWordDetailModal — her yerden açılabilir kelime detay modalı.
 *
 * Props:
 *   - wordId: hangi kelimeyi göster
 *   - onClose: kapat
 * Fetch: /vocab/words/:id
 * Favorite toggle: POST/DELETE /vocab/favorites/:wordId
 * TTS: window.speechSynthesis (ek bağımlılık yok)
 */

interface Word {
  id: number;
  word: string;
  turkish: string;
  level: string;
  category: string;
  pronunciation: string | null;
  partOfSpeech: string | null;
  exampleSentence: string | null;
  exampleSentenceTurkish: string | null;
  synonyms: string[] | null;
  antonyms: string[] | null;
  difficulty: number | null;
}

interface Progress {
  isFavorite: boolean;
  isLearned: boolean;
  timesCorrect: number;
  timesWrong: number;
  streak: number;
  intervalDays: number;
  nextReviewAt: string | null;
}

const LEVEL_COLORS: Record<string, string> = {
  A1: "bg-emerald-100 text-emerald-700",
  A2: "bg-green-100 text-green-700",
  B1: "bg-blue-100 text-blue-700",
  B2: "bg-orange-100 text-orange-700",
  C1: "bg-red-100 text-red-700",
  C2: "bg-pink-100 text-pink-700",
};

function playTTS(text: string) {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 0.9;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {
    // ignore
  }
}

export default function VocabWordDetailModal({
  wordId, onClose,
}: {
  wordId: number;
  onClose: () => void;
}) {
  const [word, setWord] = useState<Word | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [favToggling, setFavToggling] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("sphere_token");
        const res = await fetch(`/api/vocab/words/${wordId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error("Yüklenemedi");
        const data = await res.json();
        if (!cancelled) {
          setWord(data.word);
          setProgress(data.progress);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Hata");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [wordId]);

  const toggleFavorite = async () => {
    if (!word || favToggling) return;
    setFavToggling(true);
    const current = progress?.isFavorite ?? false;
    try {
      const token = localStorage.getItem("sphere_token");
      const res = await fetch(`/api/vocab/favorites/${word.id}`, {
        method: current ? "DELETE" : "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Favori güncellenemedi");
      setProgress((p) => ({ ...(p || {} as Progress), isFavorite: !current, isLearned: p?.isLearned ?? false, timesCorrect: p?.timesCorrect ?? 0, timesWrong: p?.timesWrong ?? 0, streak: p?.streak ?? 0, intervalDays: p?.intervalDays ?? 0, nextReviewAt: p?.nextReviewAt ?? null }));
    } catch (e: any) {
      alert(e?.message || "Hata");
    } finally {
      setFavToggling(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg bg-background border-t sm:border sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            {word?.level && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${LEVEL_COLORS[word.level] ?? "bg-slate-100 text-slate-700"}`}>
                {word.level}
              </span>
            )}
            {word?.category && (
              <span className="text-xs font-medium text-muted-foreground">
                {word.category}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-full hover:bg-secondary flex items-center justify-center"
            aria-label="Kapat"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="text-red-600 text-sm">{error}</div>
          ) : word ? (
            <>
              {/* Word + pronunciation */}
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="text-3xl font-bold font-display">{word.word}</h2>
                  <button
                    type="button"
                    onClick={() => playTTS(word.word)}
                    className="h-9 w-9 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center transition-colors"
                    aria-label="Telaffuz dinle"
                  >
                    <Volume2 className="h-4 w-4 text-primary" />
                  </button>
                  <button
                    type="button"
                    onClick={toggleFavorite}
                    disabled={favToggling}
                    className="h-9 w-9 rounded-full flex items-center justify-center transition-colors ml-auto hover:bg-red-50"
                    aria-label={progress?.isFavorite ? "Favoriden çıkar" : "Favorilere ekle"}
                  >
                    <Heart
                      className={`h-5 w-5 ${progress?.isFavorite ? "fill-red-500 text-red-500" : "text-muted-foreground"}`}
                    />
                  </button>
                </div>
                {word.pronunciation && (
                  <p className="text-sm text-muted-foreground font-mono">{word.pronunciation}</p>
                )}
                {word.partOfSpeech && (
                  <p className="text-xs italic text-muted-foreground mt-1">{word.partOfSpeech}</p>
                )}
              </div>

              {/* Turkish */}
              <div className="bg-primary/5 rounded-xl p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  Türkçe
                </p>
                <p className="text-xl font-semibold">{word.turkish}</p>
              </div>

              {/* Example */}
              {word.exampleSentence && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <BookOpen className="h-3 w-3" />
                    Örnek Cümle
                  </p>
                  <div className="bg-secondary/40 rounded-xl p-4 space-y-2">
                    <div className="flex items-start gap-2">
                      <p className="flex-1">{word.exampleSentence}</p>
                      <button
                        type="button"
                        onClick={() => playTTS(word.exampleSentence!)}
                        className="h-7 w-7 rounded-full hover:bg-background flex items-center justify-center shrink-0"
                        aria-label="Cümleyi dinle"
                      >
                        <Volume2 className="h-3.5 w-3.5 text-primary" />
                      </button>
                    </div>
                    {word.exampleSentenceTurkish && (
                      <p className="text-sm text-muted-foreground italic">
                        {word.exampleSentenceTurkish}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Synonyms */}
              {word.synonyms && word.synonyms.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
                    <Hash className="h-3 w-3" />
                    Eş Anlamlı
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {word.synonyms.map((s, i) => (
                      <span
                        key={i}
                        className="text-sm px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Progress — if user has studied this before */}
              {progress && (progress.timesCorrect > 0 || progress.timesWrong > 0) && (
                <div className="pt-4 border-t">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
                    <Target className="h-3 w-3" />
                    İlerleme
                  </p>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-green-600">
                      ✓ {progress.timesCorrect} doğru
                    </span>
                    <span className="text-red-600">
                      ✗ {progress.timesWrong} yanlış
                    </span>
                    {progress.streak > 0 && (
                      <span className="text-orange-500">
                        🔥 {progress.streak}
                      </span>
                    )}
                    {progress.isLearned && (
                      <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                        Öğrenildi ✓
                      </span>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
