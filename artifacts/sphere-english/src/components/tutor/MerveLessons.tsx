import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Mic, Square, Keyboard, Send, Volume2, VolumeX, Play, ChevronLeft, Clock, CheckCircle2,
  Sparkles, Lightbulb, Loader2, X, RotateCcw, Trophy, Target, AlertCircle,
} from "lucide-react";
import { API } from "@/lib/api-url";
import { useMicRecorder } from "@/components/mobile/useMicRecorder";

/**
 * Lara ile Ders — sesli, öğretmenin yönettiği adım adım dersler.
 * Hem web (/student/ai-tutor) hem mobil (/m/pratik/ai-ogretmen) kullanır.
 *
 * Marka: navy #1e3a6e (ana), turkuaz #13a9e0 (yalnız vurgu), açık zeminde turkuaz metin #0e7da6.
 */

const TOKEN_KEY = "sphere_token";
const NAVY = "#1e3a6e";
const TURQ = "#13a9e0";
const TURQ_DEEP = "#0e7da6";
const MAX_RECORD_SEC = 30;

type LessonCard = {
  slug: string; title: string; summary: string; category: string;
  levelMin: string; levelMax: string; estMinutes: number; stepCount: number;
  completedCount: number; recommended: boolean; aboveLevel: boolean;
};
type SessionInfo = {
  id: number; kind: "library" | "personal"; status: string; title: string; summary: string;
  stepIndex: number; totalSteps: number; steps: { key: string; goalTr: string }[];
  phase?: "steps" | "roleplay"; roleplayTurns?: number; roleplayMaxTurns?: number;
  currentGoal: string | null; currentHint: string | null;
};
type Correction = { original: string; corrected: string; whyTr: string };
type Turn = {
  id: string; role: "merve" | "user"; text: string; inputMode?: "voice" | "text" | null;
  audioBase64?: string | null; verdict?: string | null; correction?: Correction | null;
};
type Summary = {
  title: string; completed: boolean; stepsDone: number; totalSteps: number; turns: number;
  corrections: Correction[]; learned: { goalTr: string; phrase: string }[]; durationSec: number;
};
type LibraryResponse = {
  lessons: LessonCard[]; activeSession: SessionInfo | null; personalAvailable: boolean;
  voice: { usedToday: number; dailyLimit: number; available: boolean };
};

async function api(path: string, init: RequestInit = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error || "Bir hata oluştu.") as Error & { code?: string; status?: number };
    err.code = data?.code;
    err.status = res.status;
    throw err;
  }
  return data;
}

const CATEGORY_LABEL: Record<string, string> = {
  tanisma: "Tanışma", toplanti: "Toplantı", musteri: "Müşteri", telefon: "Telefon",
  satis: "Satış", sunum: "Sunum", ofis: "Ofis",
};

let uid = 0;
const nid = () => `t${Date.now()}_${uid++}`;

// ─── Ses çalma ────────────────────────────────────────────────────────────────

/**
 * Ses çalma — tarayıcıların otomatik oynatma kuralına takılmamak için Web Audio kullanır.
 *
 * Sorun: Lara'nın sesi butona basıldıktan SANİYELER sonra (sunucudan) gelir; iPhone Safari ve
 * bazı Android tarayıcılar "kullanıcı dokunuşu dışında" başlatılan sesi sessizce engeller.
 * Çözüm: her dokunuşta unlock() çağrılır → AudioContext dokunuşun içinde açılır/sürdürülür;
 * sonradan gelen ses aynı (artık kilidi açık) context'te çalınır.
 * iPhone sessiz modda Web Audio susar; navigator.audioSession.type = "playback" bunu aşar (iOS 17+).
 * AudioContext yoksa klasik <audio> ile denenir.
 */
function setAudioSession(type: "playback" | "play-and-record" | "auto") {
  try {
    const nav = navigator as any;
    if (nav.audioSession && nav.audioSession.type !== type) nav.audioSession.type = type;
  } catch { /* desteklenmiyor (iOS 17 öncesi / Android / masaüstü) */ }
}

function useSpeaker() {
  const ctxRef = useRef<AudioContext | null>(null);
  const srcRef = useRef<AudioBufferSourceNode | null>(null);
  const htmlRef = useRef<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);

  /**
   * mode="playback": Lara konuşacak (iPhone sessiz modda da çalsın).
   * mode="record": mikrofon açılacak — iOS "playback" oturumunda mikrofona İZİN VERMEZ,
   * bu yüzden kayıttan önce "play-and-record"a geçilmeli.
   */
  const unlock = useCallback((mode: "playback" | "record" = "playback") => {
    setAudioSession(mode === "record" ? "play-and-record" : "playback");
    try {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      if (!ctxRef.current || ctxRef.current.state === "closed") ctxRef.current = new AC();
      const ctx = ctxRef.current!;
      if (ctx.state === "suspended") void ctx.resume();
      // iOS: dokunuş içinde boş bir tampon çalmak context'in kilidini kalıcı açar
      const b = ctx.createBuffer(1, 1, 22050);
      const s = ctx.createBufferSource();
      s.buffer = b;
      s.connect(ctx.destination);
      s.start(0);
    } catch { /* yoksay */ }
  }, []);

  const stop = useCallback(() => {
    try { srcRef.current?.stop(); } catch { /* zaten durdu */ }
    srcRef.current = null;
    if (htmlRef.current) { htmlRef.current.pause(); htmlRef.current = null; }
    setPlayingId(null);
  }, []);

  const playHtml = useCallback((id: string, base64: string) => {
    const a = new Audio(`data:audio/mpeg;base64,${base64}`);
    htmlRef.current = a;
    setPlayingId(id);
    a.onended = () => setPlayingId((p) => (p === id ? null : p));
    a.play().then(() => setBlocked(false)).catch(() => { setPlayingId(null); setBlocked(true); });
  }, []);

  const play = useCallback(async (id: string, base64: string) => {
    stop();
    const ctx = ctxRef.current;
    if (!ctx) return playHtml(id, base64);
    try {
      if (ctx.state === "suspended") await ctx.resume();
      const bin = atob(base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const buffer = await ctx.decodeAudioData(bytes.buffer);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ctx.destination);
      src.onended = () => setPlayingId((p) => (p === id ? null : p));
      srcRef.current = src;
      setPlayingId(id);
      src.start(0);
      setBlocked(ctx.state !== "running");
    } catch {
      playHtml(id, base64);
    }
  }, [stop, playHtml]);

  useEffect(() => () => {
    stop();
    ctxRef.current?.close().catch(() => {});
  }, [stop]);
  return { play, stop, unlock, playingId, blocked };
}

// ─── Ana bileşen ──────────────────────────────────────────────────────────────

export default function MerveLessons({ compact = false, simulationHref = "/student/simulation-mode" }: { compact?: boolean; simulationHref?: string }) {
  const [lib, setLib] = useState<LibraryResponse | null>(null);
  const [libError, setLibError] = useState<string | null>(null);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [busy, setBusy] = useState<false | "starting" | "sending">(false);
  const [error, setError] = useState<string | null>(null);
  const [voiceOn, setVoiceOn] = useState(true);
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState("");
  const [showHint, setShowHint] = useState(false);
  const [quotaNote, setQuotaNote] = useState<string | null>(null);

  const mic = useMicRecorder();
  const speaker = useSpeaker();
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const loadLibrary = useCallback(async () => {
    setLibError(null);
    try {
      setLib(await api("/tutor/lessons"));
    } catch (e: any) {
      setLibError(e.message);
    }
  }, []);

  useEffect(() => { loadLibrary(); }, [loadLibrary]);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [turns, busy]);
  useEffect(() => { if (!mic.supported) setTyping(true); }, [mic.supported]);

  // Kayıt üst sınırı
  useEffect(() => {
    if (mic.recording && mic.duration >= MAX_RECORD_SEC) void stopAndSend();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mic.recording, mic.duration]);

  const addMerve = (t: { text: string; audioBase64?: string | null }) => {
    const turn: Turn = { id: nid(), role: "merve", text: t.text, audioBase64: t.audioBase64 ?? null };
    setTurns((prev) => [...prev, turn]);
    if (t.audioBase64 && voiceOn) speaker.play(turn.id, t.audioBase64);
  };

  // ── Başlat / devam ──
  const start = async (slug: string | "personal") => {
    if (voiceOn) speaker.unlock(); // dokunuşun içinde — sesin sonradan çalabilmesi için
    setBusy("starting");
    setError(null);
    setSummary(null);
    setTurns([]);
    setShowHint(false);
    setQuotaNote(null);
    try {
      const path = slug === "personal" ? "/tutor/lessons/personal/start" : `/tutor/lessons/${encodeURIComponent(slug)}/start`;
      const d = await api(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ speak: voiceOn }),
      });
      setSession(d.session);
      if (d.voiceQuotaReached) setQuotaNote("Bugünlük sesli hakkın doldu; Lara yazıyla devam edecek.");
      else if (d.voiceFailed) setQuotaNote("Lara'nın sesi şu an oluşturulamadı; ders yazıyla devam ediyor.");
      addMerve(d.reply);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const resume = async (id: number) => {
    if (voiceOn) speaker.unlock();
    setBusy("starting");
    setError(null);
    try {
      const d = await api(`/tutor/lesson-sessions/${id}`);
      setSession(d.session);
      setSummary(d.summary);
      setTurns(d.turns.map((t: any) => ({
        id: `s${t.id}`, role: t.role, text: t.text, inputMode: t.inputMode,
        verdict: t.verdict, correction: t.correction, audioBase64: null,
      })));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const [finishing, setFinishing] = useState(false);
  const finishLesson = async () => {
    if (!session || finishing) return;
    speaker.stop();
    mic.cancel();
    setFinishing(true);
    try {
      const d = await api(`/tutor/lesson-sessions/${session.id}/finish`, { method: "POST" });
      setSummary(d.summary);
      setSession({ ...session, status: "completed" });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setFinishing(false);
    }
  };

  const leave = async () => {
    speaker.stop();
    mic.cancel();
    // Yarım bırakılan ders kapatılmaz: 24 saat içinde kütüphaneden "Yarım kalan ders" ile devam edilir.
    setSession(null);
    setTurns([]);
    setSummary(null);
    setError(null);
    loadLibrary();
  };

  // ── Cevap gönder ──
  const handleTurnResponse = (d: any, pendingId: string) => {
    setTurns((prev) => prev.map((t) => (t.id === pendingId
      ? { ...t, text: d.learnerText, verdict: d.verdict, correction: d.correction }
      : t)));
    setSession(d.session);
    setShowHint(false);
    if (d.voiceQuotaReached) setQuotaNote("Bugünlük sesli hakkın doldu; yazarak devam edebilirsin.");
    else if (d.voiceFailed) setQuotaNote("Lara'nın sesi şu an oluşturulamadı; ders yazıyla devam ediyor.");
    addMerve(d.reply);
    if (d.completed && d.summary) setSummary(d.summary);
  };

  const sendText = async () => {
    const msg = text.trim();
    if (!msg || !session || busy) return;
    speaker.stop();
    if (voiceOn) speaker.unlock();
    const pendingId = nid();
    setTurns((prev) => [...prev, { id: pendingId, role: "user", text: msg, inputMode: "text" }]);
    setText("");
    setBusy("sending");
    setError(null);
    try {
      const d = await api(`/tutor/lesson-sessions/${session.id}/turn?speak=${voiceOn ? 1 : 0}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: msg }),
      });
      handleTurnResponse(d, pendingId);
    } catch (e: any) {
      setTurns((prev) => prev.filter((t) => t.id !== pendingId));
      setText(msg);
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const startRecording = async () => {
    if (busy || !session) return;
    speaker.stop();
    speaker.unlock("record"); // iOS: mikrofon için ses oturumu "play-and-record" olmalı
    setError(null);
    try {
      await mic.start();
    } catch (e: any) {
      // Bazı iOS sürümleri oturum türünü sevmiyor → varsayılana dönüp bir kez daha dene
      setAudioSession("auto");
      try {
        await mic.start();
        return;
      } catch (e2: any) {
        const name = e2?.name || e?.name || "";
        setError(
          name === "NotAllowedError" || name === "SecurityError"
            ? "Mikrofon izni verilmedi. Tarayıcı ayarlarından bu siteye mikrofon izni verip tekrar dene; yazarak da cevap verebilirsin."
            : name === "NotFoundError"
              ? "Mikrofon bulunamadı. Yazarak cevap verebilirsin."
              : name === "NotReadableError"
                ? "Mikrofon başka bir uygulama tarafından kullanılıyor (arama, kayıt vb.). Onu kapatıp tekrar dene."
                : `Mikrofon başlatılamadı${name ? ` (${name})` : ""}. Sayfayı yenileyip tekrar dene; yazarak da cevap verebilirsin.`,
        );
      }
    }
  };

  async function stopAndSend() {
    if (!session) return;
    const blob = await mic.stop();
    if (voiceOn) speaker.unlock("playback"); // kayıt bitti → Lara'nın cevabı için çalma moduna dön
    if (!blob || blob.size < 2500) {
      setError("Kayıt çok kısa geldi. Düğmeye dokun, cümleni söyle, sonra tekrar dokun.");
      return;
    }
    const pendingId = nid();
    setTurns((prev) => [...prev, { id: pendingId, role: "user", text: "…", inputMode: "voice" }]);
    setBusy("sending");
    try {
      const fd = new FormData();
      fd.append("audio", blob, blob.type.includes("mp4") ? "speech.mp4" : "speech.webm");
      const d = await api(`/tutor/lesson-sessions/${session.id}/turn?speak=${voiceOn ? 1 : 0}`, { method: "POST", body: fd });
      handleTurnResponse(d, pendingId);
    } catch (e: any) {
      setTurns((prev) => prev.filter((t) => t.id !== pendingId));
      if (e.code === "voice_quota") { setTyping(true); setQuotaNote(e.message); }
      else setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  // ─── Görünümler ──────────────────────────────────────────────────────────

  if (!session) {
    return (
      <Library
        lib={lib}
        error={libError || error}
        busy={busy === "starting"}
        compact={compact}
        voiceOn={voiceOn}
        onToggleVoice={() => setVoiceOn((v) => !v)}
        onStart={start}
        onResume={resume}
        onRetry={loadLibrary}
      />
    );
  }

  const roleplay = session.phase === "roleplay";
  const progress = roleplay || summary?.completed ? 1 : session.totalSteps ? Math.min(1, session.stepIndex / session.totalSteps) : 0;
  const finished = Boolean(summary) || session.status !== "active";

  return (
    <div className={`flex flex-col bg-white ${compact ? "h-full" : "h-[calc(100vh-170px)] min-h-[560px] rounded-2xl border border-slate-200"} overflow-hidden`}>
      {/* Başlık + ilerleme */}
      <div className="px-4 pt-3 pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <button onClick={leave} className="p-1.5 -ml-1 rounded-lg hover:bg-slate-100 text-slate-500" aria-label="Derslere dön">
            <ChevronLeft size={18} />
          </button>
          <MerveAvatar size={34} speaking={Boolean(speaker.playingId)} />
          <div className="min-w-0 flex-1">
            <p className="font-bold text-sm truncate" style={{ color: NAVY, fontFamily: "Outfit, sans-serif" }}>{session.title}</p>
            <p className="text-[11px] text-slate-500">
              Lara ile ders · {finished ? "tamamlandı" : roleplay ? `Gerçek konuşma · ${(session.roleplayTurns ?? 0) + 1}. tur` : `Adım ${Math.min(session.stepIndex + 1, session.totalSteps)}/${session.totalSteps}`}
            </p>
          </div>
          <button
            onClick={() => { if (!voiceOn) speaker.unlock(); setVoiceOn((v) => !v); speaker.stop(); }}
            className="p-2 rounded-lg hover:bg-slate-100"
            style={{ color: voiceOn ? TURQ_DEEP : "#94a3b8" }}
            title={voiceOn ? "Lara sesli konuşuyor" : "Lara'nın sesi kapalı"}
            aria-label="Sesi aç/kapat"
          >
            {voiceOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress * 100}%`, background: TURQ }} />
        </div>
      </div>

      {speaker.blocked && voiceOn && (
        <button
          onClick={() => {
            speaker.unlock();
            const last = [...turns].reverse().find((t) => t.role === "merve" && t.audioBase64);
            if (last?.audioBase64) void speaker.play(last.id, last.audioBase64);
          }}
          className="mx-4 mt-2 rounded-lg px-3 py-2 text-xs font-semibold flex items-center gap-2 text-left"
          style={{ background: "#e8eef8", color: NAVY }}
        >
          <Volume2 size={14} /> Tarayıcın sesi engelledi. Lara'yı dinlemek için dokun. (iPhone'da sessiz modu da kontrol et.)
        </button>
      )}

      {/* Konuşma */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ background: "#f8fafc" }}>
        {turns.map((t) => (
          <TurnBubble key={t.id} turn={t} playing={speaker.playingId === t.id} onPlay={() => { speaker.unlock(); if (t.audioBase64) void speaker.play(t.id, t.audioBase64); }} />
        ))}
        {busy === "sending" && (
          <div className="flex items-center gap-2 text-xs text-slate-500 pl-11">
            <Loader2 size={14} className="animate-spin" /> Lara dinliyor…
          </div>
        )}
        {summary && <SummaryCard summary={summary} simulationHref={simulationHref} onAgain={leave} />}
      </div>

      {/* Görev + giriş */}
      {!finished && (
        <div className="border-t border-slate-100 bg-white px-4 pt-3 pb-4">
          {session.currentGoal && (
            <div className="mb-3 rounded-xl px-3 py-2 flex items-start gap-2" style={{ background: "#e8eef8" }}>
              <Target size={15} className="mt-0.5 shrink-0" style={{ color: NAVY }} />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{roleplay ? "Serbest konuşma" : "Görevin"}</p>
                <p className="text-sm font-medium" style={{ color: NAVY }}>{session.currentGoal}</p>
                {showHint && session.currentHint && <p className="text-xs mt-1 text-slate-600">{session.currentHint}</p>}
              </div>
              {session.currentHint && (
                <button onClick={() => setShowHint((s) => !s)} className="text-xs font-semibold flex items-center gap-1 shrink-0" style={{ color: TURQ_DEEP }}>
                  <Lightbulb size={13} /> {showHint ? "Gizle" : roleplay ? "Kalıplar" : "İpucu"}
                </button>
              )}
            </div>
          )}
          {roleplay && (
            <div className="mb-3 flex justify-end">
              <button
                onClick={() => void finishLesson()}
                disabled={finishing || Boolean(busy)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border disabled:opacity-50"
                style={{ borderColor: NAVY, color: NAVY }}
              >
                {finishing ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} Dersi bitir
              </button>
            </div>
          )}

          {(error || quotaNote) && (
            <div className={`mb-2 text-xs rounded-lg px-3 py-2 flex items-start gap-2 ${error ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-800"}`}>
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span className="flex-1">{error || quotaNote}</span>
              <button onClick={() => { setError(null); setQuotaNote(null); }} aria-label="Kapat"><X size={13} /></button>
            </div>
          )}

          {typing ? (
            <div className="flex items-end gap-2">
              {mic.supported && (
                <button onClick={() => setTyping(false)} className="p-3 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50" aria-label="Sesle cevap ver">
                  <Mic size={18} />
                </button>
              )}
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendText(); } }}
                rows={1}
                placeholder="Cevabını İngilizce yaz…"
                className="flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
                style={{ maxHeight: 120 }}
                disabled={Boolean(busy)}
              />
              <button
                onClick={() => void sendText()}
                disabled={!text.trim() || Boolean(busy)}
                className="p-3 rounded-xl text-white disabled:opacity-40"
                style={{ background: NAVY }}
                aria-label="Gönder"
              >
                <Send size={18} />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-6">
              <button onClick={() => setTyping(true)} className="p-3 rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50" aria-label="Yazarak cevap ver">
                <Keyboard size={18} />
              </button>
              <button
                onClick={() => (mic.recording ? void stopAndSend() : void startRecording())}
                disabled={Boolean(busy)}
                className="relative w-20 h-20 rounded-full text-white flex items-center justify-center shadow-lg disabled:opacity-50 transition-transform active:scale-95"
                style={{ background: mic.recording ? "#ef4444" : NAVY }}
                aria-label={mic.recording ? "Gönder" : "Konuşmaya başla"}
              >
                {mic.recording && (
                  <span
                    className="absolute inset-0 rounded-full"
                    style={{ boxShadow: `0 0 0 ${6 + mic.level * 22}px rgba(19,169,224,0.25)`, transition: "box-shadow 80ms linear" }}
                  />
                )}
                {busy === "sending" ? <Loader2 size={28} className="animate-spin" /> : mic.recording ? <Square size={26} /> : <Mic size={30} />}
              </button>
              <div className="w-[46px] text-center text-xs text-slate-500 tabular-nums">
                {mic.recording ? `${Math.floor(mic.duration)} sn` : ""}
              </div>
            </div>
          )}
          {!typing && (
            <p className="text-center text-[11px] text-slate-400 mt-2">
              {mic.recording ? "Bitince tekrar dokun" : "Dokun, İngilizce söyle, tekrar dokun"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Parçalar ─────────────────────────────────────────────────────────────────

function MerveAvatar({ size = 40, speaking = false }: { size?: number; speaking?: boolean }) {
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold shrink-0 relative"
      style={{ width: size, height: size, background: NAVY, fontFamily: "Outfit, sans-serif", fontSize: size * 0.42 }}
      aria-hidden
    >
      M
      {speaking && (
        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white animate-pulse" style={{ background: TURQ }} />
      )}
    </div>
  );
}

function TurnBubble({ turn, playing, onPlay }: { turn: Turn; playing: boolean; onPlay: () => void }) {
  if (turn.role === "merve") {
    return (
      <div className="flex items-start gap-2 max-w-[92%]">
        <MerveAvatar size={30} speaking={playing} />
        <div className="rounded-2xl rounded-tl-sm bg-white border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 leading-relaxed shadow-sm">
          <MerveText text={turn.text} />
          {turn.audioBase64 && (
            <button onClick={onPlay} className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: TURQ_DEEP }}>
              {playing ? <Volume2 size={12} className="animate-pulse" /> : <Play size={12} />} {playing ? "Konuşuyor" : "Tekrar dinle"}
            </button>
          )}
        </div>
      </div>
    );
  }
  const verdictColor = turn.verdict === "correct" ? "#22c55e" : turn.verdict === "almost" ? "#f59e0b" : undefined;
  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="max-w-[85%] rounded-2xl rounded-tr-sm px-3.5 py-2.5 text-sm text-white" style={{ background: NAVY }}>
        {turn.text === "…" ? <span className="inline-flex items-center gap-1"><Loader2 size={13} className="animate-spin" /> Ses yazıya çevriliyor</span> : turn.text}
        {verdictColor && (
          <CheckCircle2 size={14} className="inline ml-1.5 -mt-0.5" style={{ color: verdictColor }} />
        )}
      </div>
      {turn.correction && (
        <div className="max-w-[85%] rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs">
          {turn.correction.original && <p className="text-rose-700 line-through decoration-rose-400">{turn.correction.original}</p>}
          <p className="font-semibold text-emerald-700">{turn.correction.corrected}</p>
          {turn.correction.whyTr && <p className="text-slate-600 mt-0.5">{turn.correction.whyTr}</p>}
        </div>
      )}
    </div>
  );
}

/** "tırnak içindeki" İngilizce kalıpları vurgula */
function MerveText({ text }: { text: string }) {
  const parts = text.split(/("[^"]{3,200}")/g);
  return (
    <span>
      {parts.map((p, i) =>
        p.startsWith("\"") && p.endsWith("\"") ? (
          <strong key={i} style={{ color: TURQ_DEEP }}>{p}</strong>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </span>
  );
}

function SummaryCard({ summary, simulationHref, onAgain }: { summary: Summary; simulationHref: string; onAgain: () => void }) {
  const mins = Math.max(1, Math.round(summary.durationSec / 60));
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Trophy size={20} style={{ color: TURQ }} />
        <p className="font-bold" style={{ color: NAVY, fontFamily: "Outfit, sans-serif" }}>
          {summary.completed ? "Ders tamamlandı" : "Ders özeti"}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-3 text-center">
        <Stat label="Kalıp" value={String(summary.learned.length)} />
        <Stat label="Düzeltme" value={String(summary.corrections.length)} />
        <Stat label="Süre" value={`${mins} dk`} />
      </div>
      {summary.learned.length > 0 && (
        <div className="mb-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Bugün öğrendiklerin</p>
          <ul className="space-y-1">
            {summary.learned.map((l, i) => (
              <li key={i} className="text-sm">
                <span className="font-semibold" style={{ color: NAVY }}>{l.phrase}</span>
                <span className="text-slate-500"> — {l.goalTr}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {summary.corrections.length > 0 && (
        <div className="mb-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Düzelttiklerimiz</p>
          <ul className="space-y-1">
            {summary.corrections.map((c, i) => (
              <li key={i} className="text-sm">
                {c.original && <span className="text-rose-600 line-through mr-1">{c.original}</span>}
                <span className="font-semibold text-emerald-700">{c.corrected}</span>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-slate-400 mt-1">Bunlar hata defterine eklendi; Kelime Tekrarı ve "Sana özel ders" bunları tekrar getirecek.</p>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button onClick={onAgain} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: NAVY }}>
          <RotateCcw size={14} /> Başka ders
        </button>
        <a href={simulationHref} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border" style={{ borderColor: TURQ, color: TURQ_DEEP }}>
          <Sparkles size={14} /> Bir koçla gerçek görüşmede dene
        </a>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl py-2" style={{ background: "#e8eef8" }}>
      <p className="text-lg font-bold" style={{ color: NAVY, fontFamily: "Outfit, sans-serif" }}>{value}</p>
      <p className="text-[11px] text-slate-500">{label}</p>
    </div>
  );
}

function Library({
  lib, error, busy, compact, voiceOn, onToggleVoice, onStart, onResume, onRetry,
}: {
  lib: LibraryResponse | null; error: string | null; busy: boolean; compact: boolean; voiceOn: boolean;
  onToggleVoice: () => void; onStart: (slug: string) => void; onResume: (id: number) => void; onRetry: () => void;
}) {
  if (!lib && !error) {
    return <div className="flex items-center justify-center py-20 text-slate-400"><Loader2 className="animate-spin" /></div>;
  }
  if (!lib) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-slate-600 mb-3">{error}</p>
        <button onClick={onRetry} className="px-4 py-2 rounded-lg text-white text-sm font-semibold" style={{ background: NAVY }}>Tekrar dene</button>
      </div>
    );
  }
  const recommended = lib.lessons.filter((l) => l.recommended);
  const rest = lib.lessons.filter((l) => !l.recommended);
  return (
    <div className={compact ? "px-4 py-4" : ""}>
      {/* Karşılama */}
      <div className="rounded-2xl p-4 sm:p-5 mb-4 text-white flex items-start gap-3" style={{ background: NAVY }}>
        <MerveAvatar size={48} />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-lg" style={{ fontFamily: "Outfit, sans-serif" }}>Lara ile Ders</p>
          <p className="text-sm text-white/80">
            Bir iş anı seç, Lara seni adım adım konuştursun. Hatanı anında düzeltir, takılırsan ipucu verir. Bir ders 5–8 dakika.
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-3 text-xs">
            <button onClick={onToggleVoice} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20">
              {voiceOn ? <Volume2 size={13} /> : <VolumeX size={13} />} {voiceOn ? "Sesli" : "Sessiz (yazıyla)"}
            </button>
            {lib.voice.available && (
              <span className="text-white/70">Bugün sesli: {lib.voice.usedToday}/{lib.voice.dailyLimit}</span>
            )}
          </div>
        </div>
      </div>

      {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}

      {lib.activeSession && (
        <button
          onClick={() => onResume(lib.activeSession!.id)}
          disabled={busy}
          className="w-full text-left mb-4 rounded-2xl border-2 p-4 flex items-center gap-3 bg-white hover:shadow-md transition-shadow"
          style={{ borderColor: TURQ }}
        >
          <Play size={20} style={{ color: TURQ_DEEP }} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: TURQ_DEEP }}>Yarım kalan ders</p>
            <p className="font-semibold truncate" style={{ color: NAVY }}>{lib.activeSession.title}</p>
            <p className="text-xs text-slate-500">Adım {lib.activeSession.stepIndex + 1}/{lib.activeSession.totalSteps}</p>
          </div>
        </button>
      )}

      {lib.personalAvailable && (
        <button
          onClick={() => onStart("personal")}
          disabled={busy}
          className="w-full text-left mb-4 rounded-2xl border border-slate-200 p-4 flex items-center gap-3 bg-white hover:shadow-md transition-shadow"
        >
          <Sparkles size={20} style={{ color: TURQ }} />
          <div className="flex-1">
            <p className="font-semibold" style={{ color: NAVY }}>Sana özel ders</p>
            <p className="text-xs text-slate-500">Lara son hatalarından kısa bir tekrar dersi hazırlasın.</p>
          </div>
        </button>
      )}

      {busy && (
        <div className="mb-4 flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> Lara dersi hazırlıyor…</div>
      )}

      {recommended.length > 0 && <SectionTitle>Senin için önerilen</SectionTitle>}
      <LessonGrid lessons={recommended} busy={busy} onStart={onStart} compact={compact} />
      {rest.length > 0 && <SectionTitle>Tüm dersler</SectionTitle>}
      <LessonGrid lessons={rest} busy={busy} onStart={onStart} compact={compact} />
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mt-2 mb-2">{children}</p>;
}

function LessonGrid({ lessons, busy, onStart, compact }: { lessons: LessonCard[]; busy: boolean; onStart: (slug: string) => void; compact: boolean }) {
  if (lessons.length === 0) return null;
  return (
    <div className={`grid gap-3 mb-4 ${compact ? "grid-cols-1" : "sm:grid-cols-2 xl:grid-cols-3"}`}>
      {lessons.map((l) => (
        <button
          key={l.slug}
          onClick={() => onStart(l.slug)}
          disabled={busy}
          className="text-left rounded-2xl border border-slate-200 bg-white p-4 hover:shadow-md hover:border-slate-300 transition-all disabled:opacity-60"
        >
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full" style={{ background: "#e8eef8", color: NAVY }}>
              {CATEGORY_LABEL[l.category] ?? l.category}
            </span>
            <span className="text-[10px] text-slate-400">{l.levelMin}–{l.levelMax}</span>
            {l.completedCount > 0 && <CheckCircle2 size={14} className="ml-auto text-emerald-500" />}
          </div>
          <p className="font-semibold text-sm mb-1" style={{ color: NAVY }}>{l.title}</p>
          <p className="text-xs text-slate-500 line-clamp-2 mb-2">{l.summary}</p>
          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            <span className="inline-flex items-center gap-1"><Clock size={11} /> {l.estMinutes} dk</span>
            <span>{l.stepCount} adım</span>
            {l.aboveLevel && <span className="text-amber-600">Seviyenin üstünde</span>}
          </div>
        </button>
      ))}
    </div>
  );
}
