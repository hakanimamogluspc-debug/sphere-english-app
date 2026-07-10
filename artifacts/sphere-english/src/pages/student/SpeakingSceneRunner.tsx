import { useEffect, useRef, useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import { API } from "@/lib/api-url";
import {
  Loader2, Mic, Square, ArrowLeft, Volume2, Sparkles,
  ChevronRight, RefreshCw, Play, Award, MessageSquare,
} from "lucide-react";

/**
 * Speaking sahne çalıştırıcı.
 * Akış:
 *   1) /scenes/:slug ile sahne bilgisi al
 *   2) /scenes/:slug/start → attemptId + ilk AI opening (autoplay TTS)
 *   3) Her user turu: mikrofon kayıt → POST /scenes/attempts/:id/speak
 *      → skor + AI cevabı (autoplay TTS) + sonraki user hedefi
 *   4) Son tur → complete → sonuç ekranı
 */

interface UserTurn {
  turnId: number;
  turnOrder: number;
  text: string;
  textTr?: string;
  notesTr?: string;
  phoneticHint?: string;
}

interface AiTurn {
  turnId: number;
  turnOrder: number;
  text: string;
  textTr?: string;
  audioBase64: string | null;
}

interface Scores {
  accuracy: number;
  fluency: number;
  pronunciation: number;
  completeness: number;
  overall: number;
}

interface WordAnalysisItem {
  target: string | null;
  said: string | null;
  match: "exact" | "close" | "missing" | "extra";
  gptScore?: number;
  gptIssue?: string | null;
}

interface Feedback {
  issues: string[];
  positives: string[];
}

interface CompleteResult {
  status: "completed" | "abandoned";
  totalScore: number;
  scores?: Omit<Scores, "overall">;
  turnCount?: number;
  durationSeconds?: number;
  weakAreas?: string[];
  aiSummary?: string;
}

export default function SpeakingSceneRunner() {
  const params = useParams();
  const slug = params.slug as string;
  const [, navigate] = useLocation();

  // Sahne + tur state
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [currentAi, setCurrentAi] = useState<AiTurn | null>(null);
  const [currentUser, setCurrentUser] = useState<UserTurn | null>(null);
  const [sceneMeta, setSceneMeta] = useState<{
    title_tr: string;
    title_en: string;
    user_role_tr: string | null;
    counterpart_role_tr: string | null;
  } | null>(null);

  // Recording
  const [recording, setRecording] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Last score + tur geçmişi
  const [lastScores, setLastScores] = useState<Scores | null>(null);
  const [lastWordAnalysis, setLastWordAnalysis] = useState<WordAnalysisItem[]>([]);
  const [lastTranscript, setLastTranscript] = useState<string>("");
  const [lastTarget, setLastTarget] = useState<string>("");
  const [lastFeedback, setLastFeedback] = useState<Feedback | null>(null);
  const [showScoreCard, setShowScoreCard] = useState(false);

  // Complete state
  const [completing, setCompleting] = useState(false);
  const [completeResult, setCompleteResult] = useState<CompleteResult | null>(null);

  // Genel error + init
  const [initLoading, setInitLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // ── Sahne başlat ──
  useEffect(() => {
    let cancel = false;

    async function boot() {
      try {
        const token = localStorage.getItem("sphere_token");

        // 1) Sahne meta
        const metaR = await fetch(`${API}/scenes/${slug}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!metaR.ok) throw new Error("Sahne yüklenemedi");
        const metaD = await metaR.json();
        if (cancel) return;
        setSceneMeta(metaD.scene);

        // 2) Başlat
        const startR = await fetch(`${API}/scenes/${slug}/start`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        const startD = await startR.json();
        if (!startR.ok) throw new Error(startD?.error || "Sahne başlatılamadı");
        if (cancel) return;

        setAttemptId(startD.attemptId);
        setCurrentAi(startD.aiTurn);
        setCurrentUser(startD.nextUserTurn);

        // AI opening'i otomatik oynat
        if (startD.aiTurn?.audioBase64) {
          playAudio(startD.aiTurn.audioBase64);
        }
      } catch (e: any) {
        if (!cancel) setError(e?.message || "Beklenmedik hata");
      } finally {
        if (!cancel) setInitLoading(false);
      }
    }

    boot();
    return () => {
      cancel = true;
      stopMicStream();
    };
  }, [slug]);

  function playAudio(base64: string) {
    try {
      const audio = new Audio(`data:audio/mp3;base64,${base64}`);
      audioRef.current = audio;
      audio.play().catch(() => {
        /* autoplay engellenirse sessizce geç */
      });
    } catch {
      /* ignore */
    }
  }

  function replayAiAudio() {
    if (currentAi?.audioBase64) playAudio(currentAi.audioBase64);
  }

  // ── Kayıt ──
  async function startRecording() {
    setError(null);
    setShowScoreCard(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      // MediaRecorder MIME desteği kontrol
      const mimeTypes = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
      let mimeType = "";
      for (const m of mimeTypes) {
        if (MediaRecorder.isTypeSupported(m)) {
          mimeType = m;
          break;
        }
      }

      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType || "audio/webm" });
        void submitRecording(blob);
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
      setRecordingSeconds(0);

      timerRef.current = setInterval(() => {
        setRecordingSeconds((s) => {
          if (s + 1 >= 30) {
            stopRecording();
            return 30;
          }
          return s + 1;
        });
      }, 1000);
    } catch (e: any) {
      setError("Mikrofon erişimi reddedildi. Tarayıcı ayarlarından izin ver.");
    }
  }

  function stopRecording() {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    stopMicStream();
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRecording(false);
  }

  function stopMicStream() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  async function submitRecording(blob: Blob) {
    if (!attemptId || !currentUser) return;
    setAnalyzing(true);
    try {
      const token = localStorage.getItem("sphere_token");
      const form = new FormData();
      form.append("audio", blob, "recording.webm");
      form.append("turnId", String(currentUser.turnId));

      const r = await fetch(`${API}/scenes/attempts/${attemptId}/speak`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || "Ses analiz edilemedi");

      setLastScores(d.scores);
      setLastWordAnalysis(d.wordAnalysis || []);
      setLastTranscript(d.transcript);
      setLastTarget(d.target);
      setLastFeedback(d.feedback || null);
      setShowScoreCard(true);

      // Sonraki AI turu + sonraki user turu
      setCurrentAi(d.aiTurn);
      setCurrentUser(d.nextUserTurn);

      if (d.aiTurn?.audioBase64) {
        // Kullanıcı skoru görmesi için 1 sn bekle, sonra AI oynat
        setTimeout(() => playAudio(d.aiTurn.audioBase64), 800);
      }

      if (d.isLastTurn && !d.nextUserTurn) {
        // Sahne bitmek üzere
      }
    } catch (e: any) {
      setError(e?.message || "Kayıt gönderilemedi");
    } finally {
      setAnalyzing(false);
    }
  }

  // ── Sahneyi kapat ──
  async function completeScene() {
    if (!attemptId || completing) return;
    setCompleting(true);
    try {
      const token = localStorage.getItem("sphere_token");
      const r = await fetch(`${API}/scenes/attempts/${attemptId}/complete`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || "Sahne kapatılamadı");
      setCompleteResult(d);
    } catch (e: any) {
      setError(e?.message || "Kapatma hatası");
    } finally {
      setCompleting(false);
    }
  }

  // ── Render ──

  if (initLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  if (error && !attemptId) {
    return (
      <div className="max-w-xl mx-auto mt-12 p-6 bg-red-50 border border-red-200 rounded-xl">
        <p className="font-semibold text-red-900 mb-2">Sahne başlatılamadı</p>
        <p className="text-sm text-red-800 mb-4">{error}</p>
        <Link
          href="/student/speaking-scenes"
          className="inline-flex items-center gap-1 text-sm font-semibold text-red-900 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" /> Sahnelere dön
        </Link>
      </div>
    );
  }

  // ── Sonuç ekranı ──
  if (completeResult) {
    return <ResultScreen result={completeResult} sceneTitle={sceneMeta?.title_tr || ""} slug={slug} />;
  }

  const isFinal = !currentUser && !currentAi;

  return (
    <div className="max-w-3xl mx-auto px-4 lg:px-6 py-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <Link
            href="/student/speaking-scenes"
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-2"
          >
            <ArrowLeft className="w-4 h-4" /> Sahnelere dön
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">{sceneMeta?.title_tr}</h1>
          <p className="text-xs text-slate-500 italic mt-0.5">{sceneMeta?.title_en}</p>
          {(sceneMeta?.user_role_tr || sceneMeta?.counterpart_role_tr) && (
            <div className="mt-2 text-xs text-slate-600 flex items-center gap-3">
              {sceneMeta.user_role_tr && (
                <span>
                  <strong>Sen:</strong> {sceneMeta.user_role_tr}
                </span>
              )}
              {sceneMeta.counterpart_role_tr && (
                <span>
                  <strong>AI:</strong> {sceneMeta.counterpart_role_tr}
                </span>
              )}
            </div>
          )}
        </div>
        {!isFinal && (
          <button
            onClick={completeScene}
            disabled={completing}
            className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold whitespace-nowrap"
          >
            Sahneyi Bitir
          </button>
        )}
      </div>

      {/* AI turu (varsa) */}
      {currentAi && (
        <div className="mb-4 p-5 rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div className="text-xs font-bold text-indigo-700 uppercase tracking-wider">
              {sceneMeta?.counterpart_role_tr || "AI"}
            </div>
            <button
              onClick={replayAiAudio}
              className="ml-auto p-1.5 rounded-md hover:bg-indigo-100 text-indigo-600"
              title="Tekrar dinle"
            >
              <Volume2 className="w-4 h-4" />
            </button>
          </div>
          <p className="text-slate-900 text-lg leading-relaxed">{currentAi.text}</p>
          {currentAi.textTr && (
            <p className="text-slate-500 text-sm mt-2 italic">{currentAi.textTr}</p>
          )}
        </div>
      )}

      {/* Skor kartı — son user turu için */}
      {showScoreCard && lastScores && (
        <ScoreCard
          scores={lastScores}
          target={lastTarget}
          transcript={lastTranscript}
          wordAnalysis={lastWordAnalysis}
          feedback={lastFeedback}
        />
      )}

      {/* User turu (varsa) */}
      {currentUser && (
        <div className="mb-4 p-5 rounded-2xl bg-white border-2 border-cyan-200">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-cyan-500 flex items-center justify-center text-white">
              <Mic className="w-4 h-4" />
            </div>
            <div className="text-xs font-bold text-cyan-700 uppercase tracking-wider">
              Sen söyle
            </div>
          </div>

          <div className="mb-4">
            <p className="text-2xl font-semibold text-slate-900 leading-relaxed">
              {currentUser.text}
            </p>
            {currentUser.textTr && (
              <p className="text-slate-500 text-sm mt-2 italic">{currentUser.textTr}</p>
            )}
          </div>

          {(currentUser.notesTr || currentUser.phoneticHint) && (
            <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
              {currentUser.phoneticHint && (
                <div>
                  <span className="font-bold">🔊 </span>
                  {currentUser.phoneticHint}
                </div>
              )}
              {currentUser.notesTr && (
                <div className="mt-1">
                  <span className="font-bold">💡 </span>
                  {currentUser.notesTr}
                </div>
              )}
            </div>
          )}

          {/* Kayıt butonu */}
          {analyzing ? (
            <div className="flex items-center justify-center gap-3 py-4 text-cyan-700">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="font-semibold text-sm">Sesin analiz ediliyor...</span>
            </div>
          ) : recording ? (
            <div className="text-center">
              <button
                onClick={stopRecording}
                className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-red-500 hover:bg-red-600 text-white font-bold shadow-lg animate-pulse"
              >
                <Square className="w-5 h-5" /> Bitir ({recordingSeconds}s)
              </button>
              <p className="mt-2 text-xs text-slate-500">
                Max 30 saniye · net konuş
              </p>
            </div>
          ) : (
            <div className="text-center">
              <button
                onClick={startRecording}
                className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-cyan-500 hover:bg-cyan-600 text-white font-bold shadow-lg transition"
              >
                <Mic className="w-5 h-5" /> Kaydı Başlat
              </button>
              <p className="mt-2 text-xs text-slate-500">
                Yukarıdaki cümleyi net söyle
              </p>
            </div>
          )}
        </div>
      )}

      {/* Sahne bitti */}
      {isFinal && (
        <div className="text-center py-8">
          <div className="mb-4 w-16 h-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center">
            <Award className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">
            Sahne tamamlandı! 🎉
          </h2>
          <p className="text-slate-600 mb-6">
            Aşağıdaki butondan raporunu görebilirsin.
          </p>
          <button
            onClick={completeScene}
            disabled={completing}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white font-bold disabled:opacity-60"
          >
            {completing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Hazırlanıyor...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" /> Sonucu Gör
              </>
            )}
          </button>
        </div>
      )}

      {error && attemptId && (
        <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-900">
          {error}
        </div>
      )}
    </div>
  );
}

// ─── Skor kartı ─────────────────────────────────────────────────────
function ScoreCard({
  scores,
  target,
  transcript,
  wordAnalysis,
  feedback,
}: {
  scores: Scores;
  target: string;
  transcript: string;
  wordAnalysis: WordAnalysisItem[];
  feedback: Feedback | null;
}) {
  const overallColor =
    scores.overall >= 85
      ? "from-emerald-500 to-green-500"
      : scores.overall >= 70
        ? "from-cyan-500 to-blue-500"
        : "from-amber-500 to-orange-500";

  return (
    <div className="mb-4 p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div
          className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${overallColor} flex items-center justify-center text-white font-extrabold text-xl shadow-md`}
        >
          {scores.overall}
        </div>
        <div className="flex-1">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Genel Skor
          </div>
          <div className="text-sm text-slate-700">
            {scores.overall >= 85
              ? "Harika!"
              : scores.overall >= 70
                ? "İyi"
                : "Tekrar dene"}
          </div>
        </div>
      </div>

      {/* 4 detay skor */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        <ScoreBar label="Doğruluk" score={scores.accuracy} />
        <ScoreBar label="Telaffuz" score={scores.pronunciation} />
        <ScoreBar label="Akıcılık" score={scores.fluency} />
        <ScoreBar label="Tamlık" score={scores.completeness} />
      </div>

      {/* Kelime karşılaştırma */}
      <div>
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
          Sen dedin
        </div>
        <p className="text-sm bg-slate-50 rounded-lg p-2.5 mb-2 text-slate-700">
          {transcript || <em className="text-slate-400">Ses anlaşılamadı</em>}
        </p>

        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
          Kelime karşılaştırma
        </div>
        <div className="flex flex-wrap gap-1 p-2.5 bg-slate-50 rounded-lg">
          {wordAnalysis.map((w, idx) => {
            let cls = "";
            let showTarget = w.target;
            if (w.match === "exact") cls = "bg-emerald-100 text-emerald-900 border-emerald-300";
            else if (w.match === "close") cls = "bg-amber-100 text-amber-900 border-amber-300";
            else if (w.match === "missing")
              cls = "bg-red-100 text-red-900 border-red-300 line-through";
            else if (w.match === "extra") {
              cls = "bg-red-50 text-red-700 border-red-200 italic";
              showTarget = `+${w.said}`;
            }
            return (
              <span
                key={idx}
                className={`px-1.5 py-0.5 rounded border text-xs font-mono ${cls}`}
                title={w.match}
              >
                {showTarget}
              </span>
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-slate-500">
          <span>
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 mr-1" /> Doğru
          </span>
          <span>
            <span className="inline-block w-2 h-2 rounded-full bg-amber-400 mr-1" /> Yakın
          </span>
          <span>
            <span className="inline-block w-2 h-2 rounded-full bg-red-400 mr-1" /> Eksik / fazla
          </span>
        </div>
      </div>

      {/* GPT-4o word-level issues — düşük skorlu kelimeler */}
      {wordAnalysis.some((w) => w.gptIssue && w.gptScore !== undefined && w.gptScore < 80) && (
        <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200">
          <div className="text-[10px] font-bold text-red-900 uppercase tracking-wider mb-2">
            🎯 Kelime Bazlı Telaffuz Notları
          </div>
          <ul className="space-y-1.5">
            {wordAnalysis
              .filter((w) => w.gptIssue && w.gptScore !== undefined && w.gptScore < 80)
              .slice(0, 4)
              .map((w, i) => (
                <li key={i} className="text-xs text-red-900 flex items-start gap-2">
                  <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-red-200 text-red-800 flex-shrink-0">
                    {w.target}
                  </span>
                  <span className="flex-1">
                    <span className="font-semibold">{w.gptScore}/100 — </span>
                    {w.gptIssue}
                  </span>
                </li>
              ))}
          </ul>
        </div>
      )}

      {/* GPT-4o genel geri bildirim */}
      {feedback && (feedback.issues.length > 0 || feedback.positives.length > 0) && (
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
          {feedback.issues.length > 0 && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
              <div className="text-[10px] font-bold text-amber-900 uppercase tracking-wider mb-1.5">
                ⚠️ Geliştirilecek
              </div>
              <ul className="space-y-1">
                {feedback.issues.map((iss, i) => (
                  <li key={i} className="text-xs text-amber-900 flex items-start gap-1.5">
                    <span className="text-amber-600">→</span> {iss}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {feedback.positives.length > 0 && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
              <div className="text-[10px] font-bold text-emerald-900 uppercase tracking-wider mb-1.5">
                ✓ İyi Yaptığın
              </div>
              <ul className="space-y-1">
                {feedback.positives.map((pos, i) => (
                  <li key={i} className="text-xs text-emerald-900 flex items-start gap-1.5">
                    <span className="text-emerald-600">→</span> {pos}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  const color =
    score >= 85
      ? "bg-emerald-500"
      : score >= 70
        ? "bg-cyan-500"
        : score >= 50
          ? "bg-amber-500"
          : "bg-red-500";
  return (
    <div className="bg-slate-50 rounded-lg p-2.5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-600 font-medium">{label}</span>
        <span className="text-sm font-bold text-slate-900">{score}</span>
      </div>
      <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} transition-all`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

// ─── Sonuç ekranı ───────────────────────────────────────────────────
function ResultScreen({
  result,
  sceneTitle,
  slug,
}: {
  result: CompleteResult;
  sceneTitle: string;
  slug: string;
}) {
  if (result.status === "abandoned") {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center px-4">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
          <RefreshCw className="w-8 h-8 text-slate-400" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">
          Sahne yarım kaldı
        </h2>
        <p className="text-slate-600 mb-6">
          Hiç ses göndermeden sahneyi kapattın. Tekrar deneyebilirsin.
        </p>
        <div className="flex gap-3 justify-center">
          <Link
            href={`/student/speaking-scenes/${slug}`}
            className="px-4 py-2 rounded-lg bg-cyan-500 text-white font-semibold text-sm hover:bg-cyan-600"
          >
            <Play className="w-4 h-4 inline mr-1" /> Tekrar Başla
          </Link>
          <Link
            href="/student/speaking-scenes"
            className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 font-semibold text-sm hover:bg-slate-200"
          >
            Sahnelere Dön
          </Link>
        </div>
      </div>
    );
  }

  const total = result.totalScore;
  const overallColor =
    total >= 85 ? "from-emerald-500 to-green-500" : total >= 70 ? "from-cyan-500 to-blue-500" : "from-amber-500 to-orange-500";
  const overallEmoji = total >= 85 ? "🏆" : total >= 70 ? "💪" : "📚";

  return (
    <div className="max-w-2xl mx-auto px-4 lg:px-6 py-8">
      <Link
        href="/student/speaking-scenes"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Sahnelere dön
      </Link>

      <h1 className="text-2xl font-bold text-slate-900 mb-1">{sceneTitle}</h1>
      <p className="text-sm text-slate-500 mb-6">Sahne Raporu</p>

      {/* Toplam skor */}
      <div
        className={`p-8 rounded-3xl bg-gradient-to-br ${overallColor} text-white text-center mb-4 shadow-lg`}
      >
        <div className="text-6xl mb-2">{overallEmoji}</div>
        <div className="text-6xl font-black mb-1">{total}</div>
        <div className="text-sm font-semibold opacity-90">Toplam Skor</div>
      </div>

      {/* 4 skor */}
      {result.scores && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <ScoreBar label="Doğruluk" score={result.scores.accuracy} />
          <ScoreBar label="Telaffuz" score={result.scores.pronunciation} />
          <ScoreBar label="Akıcılık" score={result.scores.fluency} />
          <ScoreBar label="Tamlık" score={result.scores.completeness} />
        </div>
      )}

      {/* İstatistikler */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-4 rounded-xl bg-slate-50">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Konuşulan Tur
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {result.turnCount}
          </div>
        </div>
        <div className="p-4 rounded-xl bg-slate-50">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Süre
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {Math.floor((result.durationSeconds ?? 0) / 60)}dk{" "}
            {(result.durationSeconds ?? 0) % 60}s
          </div>
        </div>
      </div>

      {/* Zayıf alanlar */}
      {result.weakAreas && result.weakAreas.length > 0 && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 mb-4">
          <div className="text-xs font-bold text-amber-900 uppercase tracking-wider mb-2">
            Gelişim Alanları
          </div>
          <ul className="space-y-1">
            {result.weakAreas.map((w, i) => (
              <li key={i} className="text-sm text-amber-900 flex items-start gap-2">
                <span className="text-amber-600">→</span> {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* AI özet */}
      {result.aiSummary && (
        <div className="p-4 rounded-xl bg-gradient-to-br from-cyan-50 to-blue-50 border border-cyan-200 mb-6">
          <div className="text-xs font-bold text-cyan-900 uppercase tracking-wider mb-2 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" /> AI Yorumu
          </div>
          <p className="text-sm text-slate-800 leading-relaxed">
            {result.aiSummary}
          </p>
        </div>
      )}

      {/* Aksiyon butonları */}
      <div className="flex flex-wrap gap-3">
        <Link
          href={`/student/speaking-scenes/${slug}`}
          className="flex-1 min-w-[160px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white font-bold text-sm"
        >
          <RefreshCw className="w-4 h-4" /> Tekrar Dene
        </Link>
        <Link
          href="/student/speaking-scenes"
          className="flex-1 min-w-[160px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-sm"
        >
          <ChevronRight className="w-4 h-4" /> Diğer Sahneler
        </Link>
      </div>
    </div>
  );
}
