import { useState, useRef, useEffect, useCallback } from "react";
import { Mic, MicOff, Volume2, ChevronLeft, ChevronDown, ChevronUp, AlertCircle, BookOpen, Mic2, RotateCcw } from "lucide-react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";

const TOKEN_KEY = "sphere_token";

// ─── Coach Data ───────────────────────────────────────────────────────────────
interface Teacher {
  id: string; name: string; accent: string; accentLabel: string;
  gender: string; voice: string; image: string; flag: string;
  description: string; color: string; gradient: string; ringColor: string;
}

const TEACHERS: Teacher[] = [
  { id: "sarah", name: "Sarah", accent: "american", accentLabel: "Amerikan", gender: "Kadın",
    voice: "nova", image: "teacher-avatar.png", flag: "🇺🇸", description: "Sıcak ve teşvik edici",
    color: "#3B82F6", gradient: "from-blue-400 to-blue-600", ringColor: "ring-blue-400" },
  { id: "james", name: "James", accent: "american", accentLabel: "Amerikan", gender: "Erkek",
    voice: "onyx", image: "teacher-james.png", flag: "🇺🇸", description: "Güçlü ve özgüvenli",
    color: "#6366F1", gradient: "from-indigo-400 to-indigo-600", ringColor: "ring-indigo-400" },
  { id: "emma", name: "Emma", accent: "british", accentLabel: "İngiliz", gender: "Kadın",
    voice: "shimmer", image: "teacher-emma.png", flag: "🇬🇧", description: "Zarif ve sabırlı",
    color: "#F43F5E", gradient: "from-rose-400 to-rose-600", ringColor: "ring-rose-400" },
  { id: "oliver", name: "Oliver", accent: "british", accentLabel: "İngiliz", gender: "Erkek",
    voice: "echo", image: "teacher-oliver.png", flag: "🇬🇧", description: "Açık ve metodolojik",
    color: "#14B8A6", gradient: "from-teal-400 to-teal-600", ringColor: "ring-teal-400" },
];

interface WordScore { word: string; score: number; ok: boolean }
interface GrammarError { original: string; corrected: string; explanation: string }
interface VocabSuggestion { original: string; better: string; explanation: string }
interface SpeechAnalysis {
  grammarErrors: GrammarError[]; vocabularySuggestions: VocabSuggestion[];
  pronunciationTips: string[]; overallScore: number; correctedText: string;
}
interface Message {
  id: string; role: "user" | "teacher"; text: string;
  wordScores?: WordScore[]; audioBase64?: string; speechAnalysis?: SpeechAnalysis;
}
type Phase = "idle" | "recording" | "processing" | "speaking";

const MIN_RECORD_MS = 2000;

// ─── Animated Coach Avatar ────────────────────────────────────────────────────
function CoachAvatar({
  teacher, phase, mouthLevel,
}: { teacher: Teacher; phase: Phase; mouthLevel: number }) {
  const isListening = phase === "recording";
  const isSpeaking = phase === "speaking";
  const isProcessing = phase === "processing";

  const mouthOpenPct = Math.min(mouthLevel * 2.5, 1);

  return (
    <div className="flex flex-col items-center gap-3 select-none">
      {/* Avatar ring stack */}
      <div className="relative flex items-center justify-center">
        {/* Outer pulse ring — speaking */}
        <AnimatePresence>
          {isSpeaking && (
            <motion.div
              key="speak-ring"
              className="absolute rounded-full"
              style={{ width: 220, height: 220, border: `3px solid ${teacher.color}` }}
              initial={{ opacity: 0.8, scale: 1 }}
              animate={{ opacity: 0, scale: 1.4 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.1, repeat: Infinity, ease: "easeOut" }}
            />
          )}
          {isSpeaking && (
            <motion.div
              key="speak-ring2"
              className="absolute rounded-full"
              style={{ width: 220, height: 220, border: `2px solid ${teacher.color}` }}
              initial={{ opacity: 0.6, scale: 1 }}
              animate={{ opacity: 0, scale: 1.25 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.1, repeat: Infinity, ease: "easeOut", delay: 0.4 }}
            />
          )}
        </AnimatePresence>

        {/* Listening wave rings */}
        <AnimatePresence>
          {isListening && [0, 1, 2].map(i => (
            <motion.div
              key={`listen-${i}`}
              className="absolute rounded-full"
              style={{ width: 200, height: 200, border: "2px solid #EF4444" }}
              initial={{ opacity: 0.7, scale: 1 }}
              animate={{ opacity: 0, scale: 1.3 + i * 0.15 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut", delay: i * 0.35 }}
            />
          ))}
        </AnimatePresence>

        {/* Processing spinner ring */}
        {isProcessing && (
          <motion.div
            className="absolute rounded-full"
            style={{
              width: 210, height: 210,
              border: `3px solid transparent`,
              borderTopColor: teacher.color,
              borderRightColor: teacher.color,
            }}
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          />
        )}

        {/* Avatar image */}
        <motion.div
          className="relative rounded-full overflow-hidden shadow-2xl"
          style={{ width: 180, height: 180 }}
          animate={isSpeaking
            ? { scale: [1, 1.015, 1, 1.01, 1] }
            : isListening
            ? { scale: [1, 1.025, 1] }
            : { scale: 1 }
          }
          transition={isSpeaking || isListening
            ? { duration: 0.8, repeat: Infinity, ease: "easeInOut" }
            : {}}
        >
          <img
            src={`/images/${teacher.image}`}
            alt={teacher.name}
            className="w-full h-full object-cover"
          />

          {/* Mouth animation overlay — speaking */}
          <AnimatePresence>
            {isSpeaking && mouthOpenPct > 0.05 && (
              <motion.div
                key="mouth"
                className="absolute bottom-[28%] left-1/2 -translate-x-1/2"
                style={{
                  width: 28 + mouthOpenPct * 14,
                  height: 6 + mouthOpenPct * 14,
                  background: "rgba(0,0,0,0.55)",
                  borderRadius: "50%",
                  filter: "blur(1px)",
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.7 }}
                exit={{ opacity: 0 }}
              />
            )}
          </AnimatePresence>

          {/* Gradient overlay at bottom */}
          <div
            className="absolute bottom-0 left-0 right-0 h-1/3"
            style={{ background: `linear-gradient(to top, ${teacher.color}44, transparent)` }}
          />
        </motion.div>

        {/* Status badge */}
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2">
          <AnimatePresence mode="wait">
            {isListening && (
              <motion.div key="listening" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                className="flex items-center gap-1.5 bg-red-500 text-white text-[11px] font-semibold px-3 py-1 rounded-full shadow-lg">
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
                Dinliyorum
              </motion.div>
            )}
            {isSpeaking && (
              <motion.div key="speaking" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                className="flex items-center gap-1.5 text-white text-[11px] font-semibold px-3 py-1 rounded-full shadow-lg"
                style={{ backgroundColor: teacher.color }}>
                <SoundWave color="white" />
                Konuşuyor
              </motion.div>
            )}
            {isProcessing && (
              <motion.div key="processing" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                className="flex items-center gap-1.5 bg-gray-700 text-white text-[11px] font-semibold px-3 py-1 rounded-full shadow-lg">
                <ThinkingDots />
                Düşünüyor
              </motion.div>
            )}
            {phase === "idle" && (
              <motion.div key="idle" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                className="flex items-center gap-1.5 bg-green-500 text-white text-[11px] font-semibold px-3 py-1 rounded-full shadow-lg">
                <span className="w-1.5 h-1.5 bg-white rounded-full" />
                Hazır
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Coach info */}
      <div className="text-center">
        <p className="font-bold text-gray-900 text-lg">{teacher.flag} {teacher.name}</p>
        <p className="text-xs text-gray-400">{teacher.accentLabel} · {teacher.description}</p>
      </div>
    </div>
  );
}

// ─── Mini helpers ─────────────────────────────────────────────────────────────
function SoundWave({ color = "#3B82F6" }: { color?: string }) {
  return (
    <svg width="20" height="12" viewBox="0 0 20 12">
      {[1.5, 4.5, 7.5, 10.5, 13.5, 16.5, 19.5].map((cx, i) => (
        <motion.rect key={i} x={cx - 1} y={0} width={2} rx={1}
          fill={color}
          animate={{ height: [3, 10, 3], y: [4.5, 0, 4.5] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.08, ease: "easeInOut" }}
        />
      ))}
    </svg>
  );
}

function ThinkingDots() {
  return (
    <span className="flex gap-0.5">
      {[0, 0.15, 0.3].map((d, i) => (
        <motion.span key={i} className="w-1 h-1 bg-white rounded-full"
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
          transition={{ duration: 0.8, repeat: Infinity, delay: d }} />
      ))}
    </span>
  );
}

// ─── Selection Screen ─────────────────────────────────────────────────────────
function TeacherSelectScreen({ onSelect }: { onSelect: (t: Teacher) => void }) {
  const [hovered, setHovered] = useState<string | null>(null);
  return (
    <div className="min-h-full bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="mb-10 text-center">
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <h1 className="text-3xl font-bold text-gray-900 font-display">AI Konuşma Koçu</h1>
            <p className="text-gray-500 text-sm mt-2 max-w-sm mx-auto">
              Koçunu seç, İngilizce konuş. Telaffuz, gramer ve kelime hatalarını gerçek zamanlı analiz eder.
            </p>
          </motion.div>
        </div>

        <div className="grid grid-cols-2 gap-5">
          {TEACHERS.map((t, i) => (
            <motion.button
              key={t.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1, duration: 0.4 }}
              onHoverStart={() => setHovered(t.id)}
              onHoverEnd={() => setHovered(null)}
              onClick={() => onSelect(t)}
              className="relative flex flex-col items-center gap-4 p-6 rounded-2xl bg-white shadow-sm border-2 border-gray-100 hover:shadow-xl transition-all overflow-hidden text-center"
              style={{ borderColor: hovered === t.id ? t.color : undefined }}
            >
              {/* Gradient bg on hover */}
              <motion.div
                className="absolute inset-0 opacity-0"
                style={{ background: `linear-gradient(135deg, ${t.color}18, ${t.color}08)` }}
                animate={{ opacity: hovered === t.id ? 1 : 0 }}
                transition={{ duration: 0.3 }}
              />

              {/* Avatar with animated ring */}
              <div className="relative z-10">
                <motion.div
                  className="relative rounded-full overflow-hidden shadow-lg"
                  style={{ width: 96, height: 96 }}
                  animate={hovered === t.id
                    ? { scale: [1, 1.04, 1, 1.03, 1] }
                    : { scale: 1 }}
                  transition={hovered === t.id
                    ? { duration: 1.5, repeat: Infinity, ease: "easeInOut" }
                    : { duration: 0.3 }}
                >
                  <img src={`/images/${t.image}`} alt={t.name} className="w-full h-full object-cover" />
                  {/* Subtle glow overlay */}
                  <motion.div
                    className="absolute inset-0"
                    style={{ background: `radial-gradient(circle at 40% 35%, ${t.color}33, transparent 70%)` }}
                    animate={{ opacity: hovered === t.id ? 1 : 0 }}
                    transition={{ duration: 0.3 }}
                  />
                </motion.div>

                {/* Pulse ring on hover */}
                <AnimatePresence>
                  {hovered === t.id && (
                    <motion.div
                      key="ring"
                      className="absolute inset-0 rounded-full"
                      style={{ border: `2px solid ${t.color}` }}
                      initial={{ scale: 1, opacity: 0.8 }}
                      animate={{ scale: 1.35, opacity: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.9, repeat: Infinity }}
                    />
                  )}
                </AnimatePresence>
              </div>

              {/* Info */}
              <div className="relative z-10">
                <p className="font-bold text-gray-900 text-base">{t.flag} {t.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{t.accentLabel} · {t.gender}</p>
                <p className="text-xs mt-2 italic" style={{ color: t.color }}>{t.description}</p>
              </div>

              {/* Hover CTA */}
              <AnimatePresence>
                {hovered === t.id && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    className="relative z-10 text-xs font-semibold px-4 py-1.5 rounded-full text-white shadow"
                    style={{ backgroundColor: t.color }}
                  >
                    Seç & Başla
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Analysis Panel ───────────────────────────────────────────────────────────
function AnalysisPanel({ analysis }: { analysis: SpeechAnalysis }) {
  const [open, setOpen] = useState(false);
  const hasIssues = analysis.grammarErrors.length > 0 || analysis.vocabularySuggestions.length > 0 || analysis.pronunciationTips.length > 0;
  const scoreColor = analysis.overallScore >= 80 ? "text-green-600 bg-green-50 border-green-200"
    : analysis.overallScore >= 60 ? "text-amber-600 bg-amber-50 border-amber-200"
    : "text-red-600 bg-red-50 border-red-200";

  return (
    <div className="mt-1.5 rounded-xl border border-gray-200 bg-white/80 backdrop-blur overflow-hidden text-xs">
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2 font-medium text-gray-600 hover:bg-gray-50 transition">
        <span className="flex items-center gap-1.5">
          <BookOpen size={11} className="text-blue-500" />Analiz
          {hasIssues && (
            <span className="bg-orange-100 text-orange-600 rounded-full px-1.5 py-0.5 text-[10px] font-bold">
              {analysis.grammarErrors.length + analysis.vocabularySuggestions.length}
            </span>
          )}
        </span>
        <div className="flex items-center gap-2">
          <span className={`font-bold px-2 py-0.5 rounded-full border ${scoreColor}`}>{analysis.overallScore}/100</span>
          {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="px-3 pb-3 space-y-2 border-t border-gray-100">
              {analysis.grammarErrors.length > 0 && (
                <div className="mt-2">
                  <p className="text-[10px] uppercase tracking-wide font-semibold text-orange-500 mb-1 flex items-center gap-1">
                    <AlertCircle size={9} />Gramer Hataları
                  </p>
                  {analysis.grammarErrors.map((e, i) => (
                    <div key={i} className="bg-orange-50 rounded-lg px-2.5 py-1.5 mb-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="line-through text-red-500 font-medium">{e.original}</span>
                        <span className="text-gray-400">→</span>
                        <span className="text-green-600 font-semibold">{e.corrected}</span>
                      </div>
                      <p className="text-gray-500 mt-0.5">{e.explanation}</p>
                    </div>
                  ))}
                </div>
              )}
              {analysis.vocabularySuggestions.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide font-semibold text-blue-500 mb-1 flex items-center gap-1">
                    <BookOpen size={9} />Kelime Önerileri
                  </p>
                  {analysis.vocabularySuggestions.map((s, i) => (
                    <div key={i} className="bg-blue-50 rounded-lg px-2.5 py-1.5 mb-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-gray-500">"{s.original}"</span>
                        <span className="text-gray-400">→</span>
                        <span className="text-blue-600 font-semibold">"{s.better}"</span>
                      </div>
                      <p className="text-gray-500 mt-0.5">{s.explanation}</p>
                    </div>
                  ))}
                </div>
              )}
              {analysis.pronunciationTips.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide font-semibold text-purple-500 mb-1 flex items-center gap-1">
                    <Mic2 size={9} />Telaffuz İpuçları
                  </p>
                  {analysis.pronunciationTips.map((tip, i) => (
                    <div key={i} className="bg-purple-50 rounded-lg px-2.5 py-1.5 mb-1 text-gray-600">{tip}</div>
                  ))}
                </div>
              )}
              {!hasIssues && <p className="text-center text-green-600 py-1">✅ Harika! Gramer ve kelime doğru.</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Message Bubbles ──────────────────────────────────────────────────────────
function getGrammarErrorWords(errors: GrammarError[]) {
  const s = new Set<string>();
  for (const e of errors) e.original.toLowerCase().split(/\s+/).forEach(w => { const c = w.replace(/[^a-z']/g,""); if(c) s.add(c); });
  return s;
}

function UserBubble({ message }: { message: Message }) {
  const words = message.wordScores || [];
  const grammarWords = message.speechAnalysis ? getGrammarErrorWords(message.speechAnalysis.grammarErrors) : new Set<string>();
  return (
    <div className="flex justify-end mb-2">
      <div className="max-w-[85%]">
        {words.length > 0 ? (
          <div className="bg-blue-50 border border-blue-100 rounded-2xl rounded-tr-sm px-3.5 py-2.5 text-sm shadow-sm leading-relaxed">
            {words.map((ws, i) => {
              const clean = ws.word.toLowerCase().replace(/[^a-z']/g,"");
              const isGram = grammarWords.has(clean);
              return (
                <span key={i} title={isGram ? "Gramer hatası" : `${ws.score}% doğruluk`}
                  className={`cursor-default ${isGram ? "text-orange-600 font-semibold underline decoration-wavy decoration-orange-400" : !ws.ok ? "text-red-600 underline decoration-dotted decoration-red-400" : ws.score < 90 ? "text-amber-600" : "text-green-700"}`}>
                  {ws.word}{" "}
                </span>
              );
            })}
            <div className="flex gap-3 mt-2 pt-1.5 border-t border-blue-100 text-[10px] text-gray-400">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />Doğru</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400" />Gramer</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />Telaffuz</span>
            </div>
          </div>
        ) : (
          <div className="bg-blue-600 text-white rounded-2xl rounded-tr-sm px-3.5 py-2.5 text-sm shadow-sm">{message.text}</div>
        )}
        {message.speechAnalysis && <AnalysisPanel analysis={message.speechAnalysis} />}
      </div>
    </div>
  );
}

function TeacherBubble({ message, teacher, onPlay }: { message: Message; teacher: Teacher; onPlay: (b: string) => void }) {
  return (
    <div className="flex items-end gap-2 mb-3">
      <img src={`/images/${teacher.image}`} alt={teacher.name}
        className="w-7 h-7 rounded-full object-cover flex-shrink-0 shadow ring-2 ring-white" />
      <div className="max-w-[80%]">
        <div className="rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-sm shadow-sm bg-white border border-gray-100 text-gray-800 leading-relaxed">
          {message.text}
        </div>
        {message.audioBase64 && (
          <button onClick={() => onPlay(message.audioBase64!)}
            className="mt-1 ml-1 flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-600 transition">
            <Volume2 size={11} />Tekrar dinle
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PronunciationCoach() {
  const [screen, setScreen] = useState<"select" | "chat">("select");
  const [teacher, setTeacher] = useState<Teacher>(TEACHERS[0]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [mouthLevel, setMouthLevel] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const recordStartRef = useRef<number>(0);
  const [recordSecs, setRecordSecs] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getApiBase = () => {
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    return base.replace("/sphere-english", "/api-server");
  };

  // ── Web Audio mouth animation ──────────────────────────────────────────────
  const startMouthAnimation = (audio: HTMLAudioElement) => {
    try {
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaElementSource(audio);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.slice(0, 20).reduce((a, b) => a + b, 0) / 20;
        setMouthLevel(avg / 255);
        animFrameRef.current = requestAnimationFrame(tick);
      };
      animFrameRef.current = requestAnimationFrame(tick);
    } catch { setMouthLevel(0); }
  };

  const stopMouthAnimation = () => {
    cancelAnimationFrame(animFrameRef.current);
    setMouthLevel(0);
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
  };

  const playAudio = useCallback((base64: string) => {
    stopMouthAnimation();
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ""; }

    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: "audio/mpeg" });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.crossOrigin = "anonymous";
    audioRef.current = audio;

    setPhase("speaking");
    startMouthAnimation(audio);

    audio.play().catch(() => {});
    audio.onended = () => {
      URL.revokeObjectURL(url);
      stopMouthAnimation();
      setPhase("idle");
    };
  }, []);

  const scrollToBottom = () => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
  };

  const stopStream = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  };

  const startTimer = () => {
    recordStartRef.current = Date.now();
    setRecordSecs(0);
    timerRef.current = setInterval(() => {
      setRecordSecs(Math.floor((Date.now() - recordStartRef.current) / 1000));
    }, 200);
  };

  const stopTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setRecordSecs(0);
  };

  const sendAudio = useCallback(async (blob: Blob) => {
    setPhase("processing");
    setError("");

    const history = messages.map(m => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.text,
    }));

    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const formData = new FormData();
      formData.append("audio", blob, "audio.webm");
      formData.append("voice", teacher.voice);
      formData.append("teacherName", teacher.name);
      formData.append("history", JSON.stringify(history));

      const res = await fetch(`${getApiBase()}/api/pronunciation/chat`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || "Bir hata oluştu.");
      }

      const data = await res.json() as {
        userText: string; wordScores: WordScore[]; reply: string;
        audioBase64: string; speechAnalysis?: SpeechAnalysis;
      };

      setMessages(prev => [
        ...prev,
        { id: `u-${Date.now()}`, role: "user", text: data.userText, wordScores: data.wordScores, speechAnalysis: data.speechAnalysis },
        { id: `t-${Date.now() + 1}`, role: "teacher", text: data.reply, audioBase64: data.audioBase64 },
      ]);

      scrollToBottom();
      if (data.audioBase64) playAudio(data.audioBase64);
    } catch (e: any) {
      setError(e?.message || "Bir hata oluştu.");
      setPhase("idle");
    }
  }, [messages, teacher, playAudio]);

  const handleMicPress = async () => {
    if (phase === "speaking") {
      audioRef.current?.pause();
      stopMouthAnimation();
      setPhase("idle");
      return;
    }
    if (phase === "recording") {
      if ((Date.now() - recordStartRef.current) < MIN_RECORD_MS) return;
      const mr = mediaRecorderRef.current;
      if (mr?.state === "recording") {
        mr.onstop = () => {
          const blob = new Blob(audioChunksRef.current, { type: mr.mimeType || "audio/webm" });
          stopStream(); stopTimer();
          sendAudio(blob);
        };
        mr.stop();
      } else {
        stopStream(); stopTimer(); setPhase("idle");
      }
      mediaRecorderRef.current = null;
      return;
    }

    if (phase !== "idle") return;

    setError("");
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorder.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.start(100);
      mediaRecorderRef.current = recorder;
      startTimer();
      setPhase("recording");
    } catch {
      setError("Mikrofon erişimi reddedildi.");
    }
  };

  const handleSelectTeacher = (t: Teacher) => {
    setTeacher(t); setMessages([]); setScreen("chat");
  };

  const handleBack = () => {
    stopStream(); stopTimer(); stopMouthAnimation();
    if (audioRef.current) { audioRef.current.pause(); }
    setMessages([]); setScreen("select"); setPhase("idle"); setError("");
  };

  useEffect(() => {
    return () => {
      stopStream(); stopTimer(); stopMouthAnimation();
      if (audioRef.current) audioRef.current.pause();
    };
  }, []);

  if (screen === "select") return <TeacherSelectScreen onSelect={handleSelectTeacher} />;

  const isRecording = phase === "recording";
  const isSpeaking = phase === "speaking";
  const isProcessing = phase === "processing";
  const canTap = phase === "idle" || (isRecording && (Date.now() - recordStartRef.current) >= MIN_RECORD_MS) || isSpeaking;

  const micColor = isRecording ? "#EF4444" : isSpeaking ? "#6B7280" : teacher.color;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-gray-50">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-white border-b border-gray-100 flex-shrink-0">
        <button onClick={handleBack} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
          <ChevronLeft size={20} />
        </button>
        <img src={`/images/${teacher.image}`} alt={teacher.name} className="w-8 h-8 rounded-full object-cover shadow" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm">{teacher.flag} {teacher.name}</p>
          <p className="text-xs text-gray-400">{teacher.accentLabel} · AI Konuşma Koçu</p>
        </div>
        <button onClick={() => { setMessages([]); }} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition" title="Sohbeti sıfırla">
          <RotateCcw size={15} />
        </button>
      </div>

      {/* ── Coach Avatar Area ── */}
      <div className="flex-shrink-0 flex flex-col items-center pt-5 pb-4 bg-white border-b border-gray-100"
        style={{ background: `linear-gradient(180deg, ${teacher.color}08 0%, white 100%)` }}>
        <CoachAvatar teacher={teacher} phase={phase} mouthLevel={mouthLevel} />
      </div>

      {/* ── Chat Messages ── */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
            className="flex flex-col items-center justify-center h-full text-center gap-2 py-8">
            <p className="text-gray-600 font-medium">Merhaba! Ben {teacher.name}.</p>
            <p className="text-gray-400 text-sm">Mikrofona bas ve İngilizce konuşmaya başla.</p>
            <p className="text-gray-400 text-sm">Telaffuz, gramer ve kelime hatalarını analiz edeceğim.</p>
          </motion.div>
        )}

        <AnimatePresence initial={false}>
          {messages.map(msg => (
            <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
              {msg.role === "user"
                ? <UserBubble message={msg} />
                : <TeacherBubble message={msg} teacher={teacher} onPlay={playAudio} />}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Processing typing indicator */}
        {isProcessing && (
          <div className="flex items-end gap-2 mb-3">
            <img src={`/images/${teacher.image}`} alt={teacher.name} className="w-7 h-7 rounded-full object-cover shadow ring-2 ring-white" />
            <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm flex items-center gap-1.5">
              {[0, 0.15, 0.3].map((d, i) => (
                <motion.span key={i} className="w-2 h-2 rounded-full bg-gray-300"
                  animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: d }} />
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Error ── */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
            className="mx-4 mb-2 px-3 py-2 bg-red-50 text-red-600 text-xs rounded-xl border border-red-100 flex items-center gap-1.5">
            <AlertCircle size={12} />{error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Mic Controls ── */}
      <div className="flex-shrink-0 pb-5 pt-2 flex flex-col items-center gap-2 bg-white border-t border-gray-100">
        {/* Recording timer */}
        <AnimatePresence>
          {isRecording && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="text-xs text-red-500 font-mono">
              {recordSecs}s — durdurmak için tekrar dokun
            </motion.p>
          )}
          {isSpeaking && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex items-center gap-2 text-xs text-gray-400">
              <SoundWave color={teacher.color} />
              <span>Dokunarak durdur</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mic button */}
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={handleMicPress}
          disabled={isProcessing}
          className="relative w-16 h-16 rounded-full flex items-center justify-center shadow-xl transition-colors disabled:opacity-40"
          style={{ backgroundColor: micColor }}
        >
          {/* Recording pulse ring */}
          {isRecording && (
            <motion.div className="absolute inset-0 rounded-full"
              animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
              transition={{ duration: 1.2, repeat: Infinity }}
              style={{ backgroundColor: "#EF4444" }}
            />
          )}
          <div className="relative z-10">
            {isProcessing
              ? <div className="w-5 h-5 border-2 border-white/60 border-t-white rounded-full animate-spin" />
              : isRecording
              ? <MicOff size={24} className="text-white" />
              : isSpeaking
              ? <Volume2 size={24} className="text-white" />
              : <Mic size={24} className="text-white" />}
          </div>
        </motion.button>

        <p className="text-[11px] text-gray-400">
          {isProcessing ? "Analiz ediliyor..." : isRecording ? "Konuşmayı durdur" : isSpeaking ? "Koç konuşuyor" : "Konuşmak için bas"}
        </p>
      </div>
    </div>
  );
}
