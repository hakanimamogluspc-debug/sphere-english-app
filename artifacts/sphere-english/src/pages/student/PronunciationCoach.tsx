import { useState, useRef, useEffect, useCallback } from "react";
import { Mic, MicOff, Volume2, ChevronLeft, ChevronDown, ChevronUp, AlertCircle, BookOpen, Mic2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const TOKEN_KEY = "sphere_token";

interface Teacher {
  id: string;
  name: string;
  accent: string;
  accentLabel: string;
  gender: string;
  voice: string;
  image: string;
  flag: string;
  description: string;
  colorClass: string;
  bgClass: string;
}

const TEACHERS: Teacher[] = [
  {
    id: "sarah",
    name: "Sarah",
    accent: "american",
    accentLabel: "Amerikan",
    gender: "Kadın",
    voice: "nova",
    image: "teacher-avatar.png",
    flag: "🇺🇸",
    description: "Sıcak ve teşvik edici",
    colorClass: "text-blue-600",
    bgClass: "bg-blue-50 border-blue-200",
  },
  {
    id: "james",
    name: "James",
    accent: "american",
    accentLabel: "Amerikan",
    gender: "Erkek",
    voice: "onyx",
    image: "teacher-james.png",
    flag: "🇺🇸",
    description: "Güçlü ve özgüvenli",
    colorClass: "text-indigo-600",
    bgClass: "bg-indigo-50 border-indigo-200",
  },
  {
    id: "emma",
    name: "Emma",
    accent: "british",
    accentLabel: "İngiliz",
    gender: "Kadın",
    voice: "shimmer",
    image: "teacher-emma.png",
    flag: "🇬🇧",
    description: "Zarif ve sabırlı",
    colorClass: "text-rose-600",
    bgClass: "bg-rose-50 border-rose-200",
  },
  {
    id: "oliver",
    name: "Oliver",
    accent: "british",
    accentLabel: "İngiliz",
    gender: "Erkek",
    voice: "echo",
    image: "teacher-oliver.png",
    flag: "🇬🇧",
    description: "Açık ve metodolojik",
    colorClass: "text-teal-600",
    bgClass: "bg-teal-50 border-teal-200",
  },
];

interface WordScore { word: string; score: number; ok: boolean }

interface GrammarError { original: string; corrected: string; explanation: string }
interface VocabSuggestion { original: string; better: string; explanation: string }
interface SpeechAnalysis {
  grammarErrors: GrammarError[];
  vocabularySuggestions: VocabSuggestion[];
  pronunciationTips: string[];
  overallScore: number;
  correctedText: string;
}

interface Message {
  id: string;
  role: "user" | "teacher";
  text: string;
  wordScores?: WordScore[];
  audioBase64?: string;
  speechAnalysis?: SpeechAnalysis;
}

type Phase = "idle" | "recording" | "processing";

const MIN_RECORD_MS = 2000;

function getGrammarErrorWords(grammarErrors: GrammarError[]): Set<string> {
  const errorWords = new Set<string>();
  for (const err of grammarErrors) {
    err.original.toLowerCase().split(/\s+/).forEach(w => {
      const clean = w.replace(/[^a-z']/g, "");
      if (clean.length > 0) errorWords.add(clean);
    });
  }
  return errorWords;
}

function WordScoreSpan({
  word,
  score,
  ok,
  hasGrammarError,
}: WordScore & { hasGrammarError: boolean }) {
  let color = "text-green-700";
  let underline = "";
  let title = `${score}% telaffuz doğruluğu`;

  if (hasGrammarError) {
    color = "text-orange-600 font-semibold";
    underline = "underline decoration-wavy decoration-orange-400";
    title = "Gramer hatası";
  } else if (!ok) {
    color = "text-red-600";
    underline = "underline decoration-dotted decoration-red-400";
    title = `Telaffuz dikkat (${score}%)`;
  } else if (score < 90) {
    color = "text-amber-600";
  }

  return (
    <span className={`${color} ${underline} cursor-default`} title={title}>
      {word}{" "}
    </span>
  );
}

function AnalysisPanel({ analysis }: { analysis: SpeechAnalysis }) {
  const [open, setOpen] = useState(true);
  const hasIssues =
    analysis.grammarErrors.length > 0 ||
    analysis.vocabularySuggestions.length > 0 ||
    analysis.pronunciationTips.length > 0;

  const scoreColor =
    analysis.overallScore >= 80
      ? "text-green-600 bg-green-50 border-green-200"
      : analysis.overallScore >= 60
      ? "text-amber-600 bg-amber-50 border-amber-200"
      : "text-red-600 bg-red-50 border-red-200";

  return (
    <div className="mt-1.5 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 transition"
      >
        <span className="flex items-center gap-1.5">
          <BookOpen size={12} className="text-blue-500" />
          Konuşma Analizi
          {hasIssues && (
            <span className="bg-orange-100 text-orange-600 rounded-full px-1.5 py-0.5 text-[10px] font-bold">
              {analysis.grammarErrors.length + analysis.vocabularySuggestions.length} hata
            </span>
          )}
        </span>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${scoreColor}`}>
            {analysis.overallScore}/100
          </span>
          {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-2.5 border-t border-gray-100">

              {/* Grammar Errors */}
              {analysis.grammarErrors.length > 0 && (
                <div className="mt-2">
                  <p className="text-[10px] uppercase tracking-wide font-semibold text-orange-500 mb-1.5 flex items-center gap-1">
                    <AlertCircle size={10} /> Gramer Hataları
                  </p>
                  <div className="space-y-1.5">
                    {analysis.grammarErrors.map((err, i) => (
                      <div key={i} className="bg-orange-50 rounded-lg px-2.5 py-1.5 text-xs">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="line-through text-red-500 font-medium">{err.original}</span>
                          <span className="text-gray-400">→</span>
                          <span className="text-green-600 font-semibold">{err.corrected}</span>
                        </div>
                        <p className="text-gray-500 mt-0.5">{err.explanation}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Vocabulary */}
              {analysis.vocabularySuggestions.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide font-semibold text-blue-500 mb-1.5 flex items-center gap-1">
                    <BookOpen size={10} /> Kelime Önerileri
                  </p>
                  <div className="space-y-1.5">
                    {analysis.vocabularySuggestions.map((sug, i) => (
                      <div key={i} className="bg-blue-50 rounded-lg px-2.5 py-1.5 text-xs">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-gray-500 font-medium">"{sug.original}"</span>
                          <span className="text-gray-400">→</span>
                          <span className="text-blue-600 font-semibold">"{sug.better}"</span>
                        </div>
                        <p className="text-gray-500 mt-0.5">{sug.explanation}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pronunciation Tips */}
              {analysis.pronunciationTips.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide font-semibold text-purple-500 mb-1.5 flex items-center gap-1">
                    <Mic2 size={10} /> Telaffuz İpuçları
                  </p>
                  <div className="space-y-1">
                    {analysis.pronunciationTips.map((tip, i) => (
                      <div key={i} className="bg-purple-50 rounded-lg px-2.5 py-1.5 text-xs text-gray-600">
                        {tip}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Corrected version if different */}
              {analysis.correctedText &&
                analysis.correctedText.toLowerCase().trim() !==
                  analysis.correctedText.toLowerCase().trim() && (
                <div className="bg-green-50 rounded-lg px-2.5 py-1.5 text-xs">
                  <p className="text-[10px] uppercase tracking-wide font-semibold text-green-600 mb-0.5">Doğru Hali</p>
                  <p className="text-green-700 italic">"{analysis.correctedText}"</p>
                </div>
              )}

              {!hasIssues && (
                <p className="text-xs text-green-600 text-center py-1 flex items-center justify-center gap-1">
                  ✅ Harika! Gramer ve kelime kullanımı doğru.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function UserBubble({ message }: { message: Message }) {
  const words = message.wordScores || [];
  const hasScores = words.length > 0;
  const grammarErrorWords = message.speechAnalysis
    ? getGrammarErrorWords(message.speechAnalysis.grammarErrors)
    : new Set<string>();

  return (
    <div className="flex justify-end mb-2">
      <div className="max-w-[80%] w-full">
        {hasScores ? (
          <div className="bg-blue-50 border border-blue-100 rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm shadow-sm">
            <span>
              {words.map((ws, i) => {
                const cleanWord = ws.word.toLowerCase().replace(/[^a-z']/g, "");
                const hasGrammarError = grammarErrorWords.has(cleanWord);
                return (
                  <WordScoreSpan key={i} {...ws} hasGrammarError={hasGrammarError} />
                );
              })}
            </span>
            <div className="flex gap-3 mt-2 pt-2 border-t border-gray-100 text-xs text-gray-400">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />İyi telaffuz</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />Gramer hatası</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />Telaffuz hatası</span>
            </div>
          </div>
        ) : (
          <div className="bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm shadow-sm">
            {message.text}
          </div>
        )}

        {message.speechAnalysis && (
          <AnalysisPanel analysis={message.speechAnalysis} />
        )}
      </div>
    </div>
  );
}

function TeacherBubble({
  message,
  teacher,
  onPlay,
}: {
  message: Message;
  teacher: Teacher;
  onPlay: (base64: string) => void;
}) {
  const imageSrc = `/images/${teacher.image}`;
  return (
    <div className="flex items-start gap-2.5 mb-3">
      <img
        src={imageSrc}
        alt={teacher.name}
        className="w-8 h-8 rounded-full object-cover flex-shrink-0 mt-0.5 border-2 border-white shadow"
      />
      <div className="max-w-[75%]">
        <div className={`rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm border shadow-sm ${teacher.bgClass}`}>
          <p className="text-gray-800 leading-relaxed">{message.text}</p>
        </div>
        {message.audioBase64 && (
          <button
            onClick={() => onPlay(message.audioBase64!)}
            className={`mt-1 ml-1 flex items-center gap-1 text-xs ${teacher.colorClass} opacity-70 hover:opacity-100`}
          >
            <Volume2 size={12} /> Tekrar dinle
          </button>
        )}
      </div>
    </div>
  );
}

function TeacherSelectScreen({ onSelect }: { onSelect: (t: Teacher) => void }) {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900">AI Konuşma Koçu</h1>
        <p className="text-gray-500 text-sm mt-2">
          Seçtiğin öğretmenle İngilizce sohbet et. Telaffuz, gramer ve kelime hatalarını analiz eder.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {TEACHERS.map((t) => (
          <button
            key={t.id}
            onClick={() => onSelect(t)}
            className="flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-gray-100 hover:border-blue-300 hover:shadow-md bg-white transition-all text-left"
          >
            <img
              src={`/images/${t.image}`}
              alt={t.name}
              className="w-20 h-20 rounded-full object-cover shadow"
            />
            <div className="text-center">
              <p className="font-semibold text-gray-900">{t.flag} {t.name}</p>
              <p className="text-xs text-gray-400 mt-0.5">{t.accentLabel} · {t.gender}</p>
              <p className="text-xs text-gray-500 mt-1 italic">{t.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function PronunciationCoach() {
  const [screen, setScreen] = useState<"select" | "chat">("select");
  const [teacher, setTeacher] = useState<Teacher>(TEACHERS[0]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const recordStartRef = useRef<number>(0);
  const [recordSecs, setRecordSecs] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getApiBase = () => {
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    return base.replace("/sphere-english", "/api-server");
  };

  const playAudio = useCallback((base64: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: "audio/mpeg" });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.play().catch(() => {});
    audio.onended = () => URL.revokeObjectURL(url);
  }, []);

  const scrollToBottom = () => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
  };

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
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

    const history = messages.map((m) => ({
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
        userText: string;
        wordScores: WordScore[];
        reply: string;
        audioBase64: string;
        speechAnalysis?: SpeechAnalysis;
      };

      const userId = `u-${Date.now()}`;
      const teacherId = `t-${Date.now() + 1}`;

      setMessages((prev) => [
        ...prev,
        {
          id: userId,
          role: "user",
          text: data.userText,
          wordScores: data.wordScores,
          speechAnalysis: data.speechAnalysis,
        },
        { id: teacherId, role: "teacher", text: data.reply, audioBase64: data.audioBase64 },
      ]);

      scrollToBottom();
      if (data.audioBase64) playAudio(data.audioBase64);
    } catch (e: any) {
      setError(e?.message || "Bir hata oluştu.");
    } finally {
      setPhase("idle");
    }
  }, [messages, teacher, playAudio]);

  const handleMicPress = async () => {
    if (phase === "recording") {
      const elapsed = Date.now() - recordStartRef.current;
      if (elapsed < MIN_RECORD_MS) return;
      const mr = mediaRecorderRef.current;
      if (mr && mr.state === "recording") {
        mr.onstop = () => {
          const mimeType = mr.mimeType || "audio/webm";
          const blob = new Blob(audioChunksRef.current, { type: mimeType });
          stopStream();
          stopTimer();
          sendAudio(blob);
        };
        mr.stop();
      } else {
        stopStream();
        stopTimer();
        setPhase("idle");
      }
      mediaRecorderRef.current = null;
      return;
    }

    setError("");
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "";
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.start(100);
      mediaRecorderRef.current = recorder;
      startTimer();
      setPhase("recording");
    } catch {
      setError("Mikrofon erişimi reddedildi.");
    }
  };

  const handleSelectTeacher = (t: Teacher) => {
    setTeacher(t);
    setMessages([]);
    setScreen("chat");
  };

  const handleBack = () => {
    stopStream();
    stopTimer();
    if (audioRef.current) { audioRef.current.pause(); }
    setMessages([]);
    setScreen("select");
    setPhase("idle");
    setError("");
  };

  useEffect(() => {
    return () => {
      stopStream();
      stopTimer();
      if (audioRef.current) audioRef.current.pause();
    };
  }, []);

  if (screen === "select") {
    return <TeacherSelectScreen onSelect={handleSelectTeacher} />;
  }

  const isRecording = phase === "recording";
  const isProcessing = phase === "processing";
  const canStop = isRecording && (Date.now() - recordStartRef.current) >= MIN_RECORD_MS;
  const canTap = phase === "idle" || canStop;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] w-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white">
        <button
          onClick={handleBack}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
        >
          <ChevronLeft size={20} />
        </button>
        <img
          src={`/images/${teacher.image}`}
          alt={teacher.name}
          className="w-9 h-9 rounded-full object-cover shadow"
        />
        <div>
          <p className="font-semibold text-gray-900 text-sm">{teacher.flag} {teacher.name}</p>
          <p className="text-xs text-gray-400">{teacher.accentLabel} · AI Konuşma & Analiz Koçu</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          {isProcessing && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
              Analiz ediliyor...
            </span>
          )}
          {isRecording && (
            <span className="flex items-center gap-1 text-xs text-red-500">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping" />
              Dinliyorum
            </span>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 bg-gray-50">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3">
            <img
              src={`/images/${teacher.image}`}
              alt={teacher.name}
              className="w-20 h-20 rounded-full shadow-lg"
            />
            <div>
              <p className="text-gray-700 font-medium">Merhaba! Ben {teacher.name}.</p>
              <p className="text-gray-400 text-sm mt-1">Benimle İngilizce konuşmaya başla.</p>
              <p className="text-gray-400 text-sm">Telaffuz, gramer ve kelime hatalarını analiz edeceğim.</p>
            </div>
          </div>
        )}
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              {msg.role === "user" ? (
                <UserBubble message={msg} />
              ) : (
                <TeacherBubble message={msg} teacher={teacher} onPlay={playAudio} />
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        {isProcessing && (
          <div className="flex items-start gap-2.5 mb-3">
            <img
              src={`/images/${teacher.image}`}
              alt={teacher.name}
              className="w-8 h-8 rounded-full object-cover flex-shrink-0 border-2 border-white shadow"
            />
            <div className={`rounded-2xl rounded-tl-sm px-4 py-3 border shadow-sm ${teacher.bgClass}`}>
              <div className="flex gap-1 items-center">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="px-4 py-2 bg-red-50 border-t border-red-100 text-red-600 text-xs text-center"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input bar */}
      <div className="px-4 py-4 bg-white border-t border-gray-100 flex items-center justify-center gap-4">
        <div className="text-center text-xs text-gray-400 w-28">
          {isRecording && !canStop
            ? <span className="text-amber-500 font-medium">Konuşmaya devam et...</span>
            : isRecording
            ? "Durdurmak için bas"
            : isProcessing
            ? "Analiz ediliyor..."
            : "Konuşmak için bas"}
        </div>

        <div className="flex flex-col items-center gap-1">
          <button
            onClick={canTap ? handleMicPress : undefined}
            disabled={isProcessing || (isRecording && !canStop)}
            className={`relative w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 ${
              isRecording && canStop
                ? "bg-red-500 hover:bg-red-600 scale-110 cursor-pointer"
                : isRecording && !canStop
                ? "bg-red-400 scale-110 cursor-not-allowed"
                : isProcessing
                ? "bg-gray-300 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 hover:scale-105 cursor-pointer"
            }`}
          >
            {isRecording ? (
              <MicOff size={26} className="text-white" />
            ) : (
              <Mic size={26} className="text-white" />
            )}
            {isRecording && (
              <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-30" />
            )}
          </button>
          {isRecording && (
            <span className={`text-xs font-mono font-semibold tabular-nums ${canStop ? "text-red-500" : "text-amber-500"}`}>
              {recordSecs}s
            </span>
          )}
        </div>

        <div className="w-28 text-xs text-gray-400 text-center">
          {messages.length > 0 && !isRecording && !isProcessing && (
            <span>{Math.ceil(messages.length / 2)} tur</span>
          )}
        </div>
      </div>
    </div>
  );
}
