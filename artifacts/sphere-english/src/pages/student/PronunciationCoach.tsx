import { useState, useRef, useEffect } from "react";
import { Mic, MicOff, Volume2, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const TOKEN_KEY = "sphere_token";

interface AnalysisResult {
  hasErrors: boolean;
  corrected: string;
  original: string;
  feedback: string;
  errorType: string;
  score: number;
  audioBase64: string;
}

function TeacherAvatar({ isSpeaking, isListening }: { isSpeaking: boolean; isListening: boolean }) {
  return (
    <div className="relative flex items-center justify-center">
      <motion.div
        animate={isSpeaking ? { scale: [1, 1.02, 1] } : { scale: 1 }}
        transition={{ repeat: isSpeaking ? Infinity : 0, duration: 0.6 }}
        className="relative"
      >
        {isSpeaking && (
          <motion.div
            className="absolute inset-0 rounded-full bg-blue-400 blur-xl opacity-30"
            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
            transition={{ repeat: Infinity, duration: 1.2 }}
          />
        )}
        {isListening && (
          <motion.div
            className="absolute inset-0 rounded-full bg-red-400 blur-xl opacity-20"
            animate={{ scale: [1, 1.15, 1], opacity: [0.2, 0.4, 0.2] }}
            transition={{ repeat: Infinity, duration: 0.8 }}
          />
        )}

        <svg width="200" height="200" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="100" cy="100" r="98" fill="url(#bgGrad)" stroke="#e2e8f0" strokeWidth="2" />
          <ellipse cx="100" cy="170" rx="55" ry="35" fill="#1e3a5f" />
          <rect x="68" y="148" width="64" height="32" rx="8" fill="#1e3a5f" />
          <path d="M85 148 L100 162 L115 148" fill="white" stroke="#e2e8f0" strokeWidth="1" />
          <rect x="88" y="130" width="24" height="22" rx="5" fill="#FDBCB4" />
          <ellipse cx="100" cy="98" rx="42" ry="45" fill="#FDBCB4" />
          <path d="M58 90 Q60 55 100 52 Q140 55 142 90 Q138 60 100 58 Q62 60 58 90Z" fill="#4a2c0a" />
          <path d="M60 88 Q55 110 58 130 Q60 118 62 108Z" fill="#4a2c0a" />
          <path d="M140 88 Q145 110 142 130 Q140 118 138 108Z" fill="#4a2c0a" />
          <ellipse cx="58" cy="100" rx="8" ry="10" fill="#FDBCB4" />
          <ellipse cx="142" cy="100" rx="8" ry="10" fill="#FDBCB4" />
          <ellipse cx="58" cy="100" rx="5" ry="7" fill="#f4a896" />
          <ellipse cx="142" cy="100" rx="5" ry="7" fill="#f4a896" />
          <ellipse cx="82" cy="95" rx="9" ry="10" fill="white" />
          <ellipse cx="118" cy="95" rx="9" ry="10" fill="white" />
          <circle cx="84" cy="95" r="6" fill="#3d2b1f" />
          <circle cx="120" cy="95" r="6" fill="#3d2b1f" />
          <circle cx="85" cy="93" r="2" fill="white" />
          <circle cx="121" cy="93" r="2" fill="white" />
          <path d="M73 83 Q82 79 91 82" stroke="#4a2c0a" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M109 82 Q118 79 127 83" stroke="#4a2c0a" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M97 105 Q100 112 103 105" stroke="#d4958a" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          {isSpeaking ? (
            <motion.ellipse
              cx="100" cy="122" rx="12" ry="6" fill="#c0392b"
              animate={{ ry: [6, 10, 4, 8, 5, 6] }}
              transition={{ repeat: Infinity, duration: 0.4, ease: "easeInOut" }}
            />
          ) : (
            <path d="M88 120 Q100 128 112 120" stroke="#c0392b" strokeWidth="2" strokeLinecap="round" fill="none" />
          )}
          {isSpeaking && (
            <motion.rect x="91" y="122" width="18" height="5" rx="2" fill="white"
              animate={{ opacity: [1, 0.8, 1] }}
              transition={{ repeat: Infinity, duration: 0.4 }}
            />
          )}
          <ellipse cx="72" cy="108" rx="8" ry="5" fill="#ffb3a0" opacity="0.4" />
          <ellipse cx="128" cy="108" rx="8" ry="5" fill="#ffb3a0" opacity="0.4" />
          <circle cx="58" cy="112" r="3" fill="#f59e0b" />
          <circle cx="142" cy="112" r="3" fill="#f59e0b" />
          <defs>
            <radialGradient id="bgGrad" cx="50%" cy="40%" r="60%">
              <stop offset="0%" stopColor="#dbeafe" />
              <stop offset="100%" stopColor="#eff6ff" />
            </radialGradient>
          </defs>
        </svg>

        {isSpeaking && (
          <motion.div
            className="absolute bottom-2 right-2 bg-blue-500 rounded-full p-1.5 shadow-lg"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 0.5 }}
          >
            <Volume2 className="w-3.5 h-3.5 text-white" />
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

type Phase = "idle" | "listening" | "processing" | "done";

export default function PronunciationCoach() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [transcript, setTranscript] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState("");

  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeRef = useRef(false); // tracks if we're still in listening mode

  const getApiBase = () => {
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    return base.replace("/sphere-english", "/api-server");
  };

  const playAudio = (audioBase64: string) => {
    const blob = new Blob(
      [Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0))],
      { type: "audio/mpeg" }
    );
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audioRef.current = audio;
    setIsSpeaking(true);
    audio.play();
    audio.onended = () => {
      setIsSpeaking(false);
      URL.revokeObjectURL(url);
    };
    audio.onerror = () => {
      setIsSpeaking(false);
    };
  };

  const analyzeText = async (text: string) => {
    if (!text.trim()) return;
    setPhase("processing");
    setError("");
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const res = await fetch(`${getApiBase()}/api/pronunciation/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error("Analysis failed");
      const data: AnalysisResult = await res.json();
      setResult(data);
      setPhase("done");
      if (data.audioBase64) playAudio(data.audioBase64);
    } catch {
      setError("Analiz yapılamadı. Lütfen tekrar deneyin.");
      setPhase("idle");
    }
  };

  const stopRecognition = () => {
    activeRef.current = false;
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
  };

  const handleStop = () => {
    stopRecognition();
    setPhase("idle");
  };

  const handleStart = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError("Tarayıcınız ses tanımayı desteklemiyor. Chrome veya Edge kullanın.");
      return;
    }

    setResult(null);
    setTranscript("");
    setError("");
    setPhase("listening");
    activeRef.current = true;

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onresult = (event: any) => {
      if (!activeRef.current) return;
      const last = event.results.length - 1;
      const text = event.results[last][0].transcript;
      setTranscript(text);
      if (event.results[last].isFinal) {
        activeRef.current = false;
        recognitionRef.current = null;
        analyzeText(text);
      }
    };

    recognition.onerror = (event: any) => {
      if (!activeRef.current) return;
      if (event.error === "no-speech") return;
      if (event.error === "not-allowed") {
        setError("Mikrofon erişimi reddedildi. Tarayıcı ayarlarından mikrofona izin verin.");
      } else {
        setError("Ses algılanamadı. Tekrar deneyin.");
      }
      activeRef.current = false;
      recognitionRef.current = null;
      setPhase("idle");
    };

    recognition.onend = () => {
      if (activeRef.current) {
        // ended unexpectedly while still listening → go back to idle
        activeRef.current = false;
        setPhase("idle");
      }
    };

    recognition.start();
  };

  const reset = () => {
    stopRecognition();
    if (audioRef.current) {
      audioRef.current.pause();
      setIsSpeaking(false);
    }
    setResult(null);
    setTranscript("");
    setError("");
    setPhase("idle");
  };

  useEffect(() => {
    return () => {
      stopRecognition();
      if (audioRef.current) audioRef.current.pause();
    };
  }, []);

  const stateLabel: Record<Phase, string> = {
    idle: "Konuşmak için butona basın",
    listening: "Dinliyorum... İngilizce konuşun",
    processing: "Analiz ediliyor...",
    done: "Analiz tamamlandı",
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">AI Telaffuz Koçu</h1>
        <p className="text-gray-500 text-sm mt-1">
          İngilizce konuşun — yapay zeka gramer ve telaffuzunuzu analiz edip sesli geri bildirim verecek.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-b from-blue-50 to-white px-6 pt-8 pb-4 flex flex-col items-center">
          <TeacherAvatar isSpeaking={isSpeaking} isListening={phase === "listening"} />
          <motion.p
            key={isSpeaking ? "speaking" : phase}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mt-3 text-sm font-medium ${
              phase === "listening" ? "text-red-500" :
              phase === "processing" ? "text-blue-500" :
              phase === "done" ? "text-green-600" : "text-gray-400"
            }`}
          >
            {isSpeaking ? "Geri bildirim veriliyor..." : stateLabel[phase]}
          </motion.p>
        </div>

        {/* Transcript */}
        <div className="px-6 py-4 min-h-[72px] flex items-center justify-center bg-gray-50 border-y border-gray-100">
          <AnimatePresence mode="wait">
            {transcript ? (
              <motion.div
                key="transcript"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-center"
              >
                <p className="text-xs text-gray-400 mb-1">Söyledikleriniz</p>
                <p className="text-gray-700 font-medium text-base italic">"{transcript}"</p>
              </motion.div>
            ) : (
              <motion.p
                key="placeholder"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-gray-300 text-sm"
              >
                Altyazı burada görünecek...
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Result */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="px-6 py-5"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  {result.hasErrors ? (
                    <AlertCircle className="w-5 h-5 text-amber-500" />
                  ) : (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  )}
                  <span className="font-semibold text-gray-800">
                    {result.hasErrors ? "Düzeltme Önerisi" : "Mükemmel!"}
                  </span>
                </div>
                <div className={`text-2xl font-bold ${
                  result.score >= 85 ? "text-green-600" :
                  result.score >= 65 ? "text-amber-500" : "text-red-500"
                }`}>
                  {result.score}/100
                </div>
              </div>

              {result.hasErrors && (
                <div className="mb-4 p-4 rounded-xl bg-blue-50 border border-blue-100">
                  <p className="text-xs font-medium text-blue-400 mb-1">Doğru İfade</p>
                  <p className="text-blue-900 font-semibold text-base">"{result.corrected}"</p>
                </div>
              )}

              <div className={`p-4 rounded-xl ${
                result.hasErrors ? "bg-amber-50 border border-amber-100" : "bg-green-50 border border-green-100"
              }`}>
                <p className="text-xs font-medium mb-1 text-gray-400">Geri Bildirim</p>
                <p className={`text-sm ${result.hasErrors ? "text-amber-800" : "text-green-800"}`}>
                  {result.feedback}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <div className="mx-6 mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Controls */}
        <div className="px-6 pb-6 pt-2 flex items-center justify-center gap-4">
          {phase === "done" ? (
            <button
              onClick={reset}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Tekrar Dene
            </button>
          ) : phase === "listening" ? (
            <motion.button
              onClick={handleStop}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-3 px-8 py-4 rounded-2xl font-semibold text-white shadow-md bg-red-500 hover:bg-red-600 shadow-red-200 transition-all"
            >
              <motion.div
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ repeat: Infinity, duration: 0.6 }}
              >
                <MicOff className="w-5 h-5" />
              </motion.div>
              Durdurun
            </motion.button>
          ) : phase === "processing" ? (
            <button
              disabled
              className="flex items-center gap-3 px-8 py-4 rounded-2xl font-semibold text-white bg-blue-400 opacity-80 cursor-not-allowed"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              >
                <RefreshCw className="w-5 h-5" />
              </motion.div>
              Analiz ediliyor...
            </button>
          ) : (
            <motion.button
              onClick={handleStart}
              disabled={isSpeaking}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-3 px-8 py-4 rounded-2xl font-semibold text-white shadow-md bg-blue-600 hover:bg-blue-700 shadow-blue-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Mic className="w-5 h-5" />
              Konuşmaya Başla
            </motion.button>
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3">
        {[
          { emoji: "🎯", title: "Cümle Kurun", desc: "Tek kelime değil, tam cümle konuşun" },
          { emoji: "🔊", title: "Net Konuşun", desc: "Mikrofona yakın ve net konuşun" },
          { emoji: "📈", title: "Pratik Yapın", desc: "Her gün 5 dakika büyük ilerleme sağlar" },
        ].map((tip) => (
          <div key={tip.title} className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm text-center">
            <div className="text-2xl mb-1">{tip.emoji}</div>
            <p className="text-xs font-semibold text-gray-700">{tip.title}</p>
            <p className="text-xs text-gray-400 mt-0.5">{tip.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
