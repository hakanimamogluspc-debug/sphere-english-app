import { useState, useRef, useEffect } from "react";
import { Mic, MicOff, Volume2, CheckCircle, AlertCircle, RefreshCw, Play } from "lucide-react";
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
  color: string;
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
    color: "blue",
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
    color: "indigo",
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
    description: "Zarif ve profesyonel",
    color: "violet",
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
    description: "Deneyimli ve sakin",
    color: "slate",
  },
];

interface AnalysisResult {
  hasErrors: boolean;
  corrected: string;
  original: string;
  whisperText: string;
  feedback: string;
  score: number;
  pronunciationIssues: string[];
  audioBase64: string;
}

function SoundWave({ active }: { active: boolean }) {
  const bars = [0.4, 0.7, 1, 0.8, 0.5, 0.9, 0.6, 1, 0.7, 0.4];
  return (
    <div className="flex items-center justify-center gap-0.5 h-8">
      {bars.map((h, i) => (
        <motion.div
          key={i}
          className="w-1 rounded-full bg-blue-400"
          animate={active ? { scaleY: [h, h * 0.3, h * 1.2, h * 0.5, h] } : { scaleY: 0.15 }}
          transition={active ? {
            repeat: Infinity,
            duration: 0.6,
            delay: i * 0.06,
            ease: "easeInOut",
          } : { duration: 0.3 }}
          style={{ height: 28, originY: "bottom" }}
        />
      ))}
    </div>
  );
}

function TeacherAvatar({ isSpeaking, isListening, image }: { isSpeaking: boolean; isListening: boolean; image: string }) {
  const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
  return (
    <div className="relative flex items-center justify-center">
      {/* Outer pulse rings */}
      {(isSpeaking || isListening) && (
        <>
          <motion.div
            className={`absolute rounded-full ${isSpeaking ? "bg-blue-400" : "bg-red-400"}`}
            style={{ width: 220, height: 220 }}
            animate={{ scale: [1, 1.15, 1], opacity: [0.15, 0.3, 0.15] }}
            transition={{ repeat: Infinity, duration: isSpeaking ? 1.2 : 0.8 }}
          />
          <motion.div
            className={`absolute rounded-full ${isSpeaking ? "bg-blue-300" : "bg-red-300"}`}
            style={{ width: 200, height: 200 }}
            animate={{ scale: [1, 1.08, 1], opacity: [0.2, 0.4, 0.2] }}
            transition={{ repeat: Infinity, duration: isSpeaking ? 1.2 : 0.8, delay: 0.15 }}
          />
        </>
      )}

      {/* Photo in circle */}
      <motion.div
        className="relative rounded-full overflow-hidden shadow-xl border-4 border-white"
        style={{ width: 180, height: 180 }}
        animate={isSpeaking ? { scale: [1, 1.015, 1] } : { scale: 1 }}
        transition={{ repeat: isSpeaking ? Infinity : 0, duration: 0.7 }}
      >
        <img
          src={`${BASE}/images/${image}`}
          alt="Teacher"
          className="w-full h-full object-cover object-top"
        />
        {/* Subtle overlay when listening */}
        {isListening && (
          <motion.div
            className="absolute inset-0 bg-red-500 opacity-10"
            animate={{ opacity: [0.05, 0.15, 0.05] }}
            transition={{ repeat: Infinity, duration: 0.8 }}
          />
        )}
      </motion.div>

      {/* Speaking badge */}
      {isSpeaking && (
        <motion.div
          className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-white rounded-full px-3 py-1 shadow-lg border border-blue-100 flex items-center gap-1.5"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <SoundWave active={isSpeaking} />
        </motion.div>
      )}

      {/* Mic active badge */}
      {isListening && (
        <motion.div
          className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-red-500 rounded-full px-3 py-1.5 shadow-lg"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 0.5 }}
          >
            <Mic className="w-4 h-4 text-white" />
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}

type Phase = "select" | "idle" | "listening" | "processing" | "done";

export default function PronunciationCoach() {
  const [phase, setPhase] = useState<Phase>("select");
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher>(TEACHERS[0]);
  const [transcript, setTranscript] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState("");

  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeRef = useRef(false);
  const lastAudioBase64Ref = useRef<string>("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const getApiBase = () => {
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    return base.replace("/sphere-english", "/api-server");
  };

  const playAudio = (audioBase64: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    lastAudioBase64Ref.current = audioBase64;
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

  const replayAudio = () => {
    if (lastAudioBase64Ref.current) {
      playAudio(lastAudioBase64Ref.current);
    }
  };

  const analyzeText = async (text: string, audioBlob?: Blob) => {
    if (!text.trim()) return;
    setPhase("processing");
    setError("");
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const formData = new FormData();
      formData.append("text", text.trim());
      formData.append("voice", selectedTeacher.voice);
      if (audioBlob && audioBlob.size > 1000) {
        formData.append("audio", audioBlob, "audio.webm");
      }
      const res = await fetch(`${getApiBase()}/api/pronunciation/analyze`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
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
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      try { mediaRecorderRef.current.stop(); } catch {}
    }
  };

  const handleStop = () => {
    stopRecognition();
    setPhase("idle");
  };

  const handleStart = async () => {
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
    audioChunksRef.current = [];

    // Start MediaRecorder for audio capture (for Whisper)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.start(200);
      mediaRecorderRef.current = recorder;
    } catch {
      // MediaRecorder failed — continue without audio (grammar-only mode)
      mediaRecorderRef.current = null;
    }

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
        // Stop recorder and get audio blob
        const mr = mediaRecorderRef.current;
        if (mr && mr.state === "recording") {
          mr.onstop = () => {
            const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
            // Stop all tracks
            (mr as any).stream?.getTracks?.()?.forEach((t: MediaStreamTrack) => t.stop());
            analyzeText(text, blob);
          };
          mr.stop();
        } else {
          analyzeText(text);
        }
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
    select: "Öğretmen seçin",
    idle: "Konuşmak için butona basın",
    listening: "Dinliyorum... İngilizce konuşun",
    processing: "Analiz ediliyor...",
    done: "Analiz tamamlandı",
  };

  if (phase === "select") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">AI Telaffuz Koçu</h1>
          <p className="text-gray-500 text-sm mt-1">
            Sizi koçluk yapacak öğretmeni seçin. Her öğretmenin farklı aksanı ve sesi var.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {TEACHERS.map((teacher) => (
            <motion.button
              key={teacher.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setSelectedTeacher(teacher);
                setPhase("idle");
              }}
              className="bg-white border-2 border-gray-100 hover:border-blue-300 rounded-2xl p-5 flex flex-col items-center gap-3 shadow-sm hover:shadow-md transition-all text-left group"
            >
              <div className="relative">
                <img
                  src={`/images/${teacher.image}`}
                  alt={teacher.name}
                  className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-md group-hover:shadow-blue-100 transition-shadow"
                />
                <span className="absolute -bottom-1 -right-1 text-xl">{teacher.flag}</span>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-gray-900">{teacher.name}</p>
                <p className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full inline-block mt-1">
                  {teacher.flag} {teacher.accentLabel} Aksanı
                </p>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">AI Telaffuz Koçu</h1>
            <p className="text-gray-500 text-sm mt-1">
              İngilizce konuşun — yapay zeka gramer ve telaffuzunuzu analiz edip sesli geri bildirim verecek.
            </p>
          </div>
          <button
            onClick={() => {
              reset();
              setPhase("select");
            }}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-200 px-3 py-1.5 rounded-xl transition-all mt-1 shrink-0"
          >
            <img
              src={`/images/${selectedTeacher.image}`}
              alt={selectedTeacher.name}
              className="w-5 h-5 rounded-full object-cover"
            />
            {selectedTeacher.name} {selectedTeacher.flag}
            <span className="text-gray-300">|</span>
            <span>Değiştir</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-b from-blue-50 to-white px-6 pt-8 pb-4 flex flex-col items-center">
          <TeacherAvatar isSpeaking={isSpeaking} isListening={phase === "listening"} image={selectedTeacher.image} />
          <p className="mt-3 text-sm font-semibold text-gray-700">
            {selectedTeacher.name} {selectedTeacher.flag}
            <span className="ml-1.5 text-xs font-normal text-gray-400">{selectedTeacher.accentLabel} Aksanı</span>
          </p>
          <motion.p
            key={isSpeaking ? "speaking" : phase}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mt-1 text-sm font-medium ${
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

              {/* Correct sentence — always shown, with replay button */}
              <div className="mb-4 p-4 rounded-xl bg-blue-50 border border-blue-100">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-blue-400">
                    {result.hasErrors ? "Doğru İfade" : "Söylediğiniz (Doğru!)"}
                  </p>
                  <button
                    onClick={replayAudio}
                    disabled={isSpeaking}
                    className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 disabled:opacity-40 font-medium transition-colors"
                  >
                    {isSpeaking ? (
                      <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 0.5 }}>
                        <Volume2 className="w-3.5 h-3.5" />
                      </motion.div>
                    ) : (
                      <Play className="w-3.5 h-3.5" />
                    )}
                    {isSpeaking ? "Oynatılıyor..." : "Tekrar Dinle"}
                  </button>
                </div>
                <p className="text-blue-900 font-semibold text-lg">"{result.corrected}"</p>
              </div>

              {result.pronunciationIssues && result.pronunciationIssues.length > 0 && (
                <div className="mb-4 p-4 rounded-xl bg-orange-50 border border-orange-100">
                  <p className="text-xs font-medium text-orange-400 mb-2">⚠️ Telaffuz Sorunu Tespit Edildi</p>
                  <div className="flex flex-wrap gap-2">
                    {result.pronunciationIssues.map((word) => (
                      <span key={word} className="bg-orange-100 text-orange-700 text-sm font-semibold px-2.5 py-1 rounded-lg">
                        {word}
                      </span>
                    ))}
                  </div>
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
