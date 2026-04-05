import { useState, useRef, useEffect, useCallback } from "react";
import { Mic, MicOff, Volume2, ChevronLeft, ChevronDown, ChevronUp, AlertCircle, BookOpen, Mic2, RotateCcw, Languages } from "lucide-react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";

const TOKEN_KEY = "sphere_token";

// ─── Coach Data ───────────────────────────────────────────────────────────────
interface Teacher {
  id: string; name: string; accent: string; accentLabel: string;
  gender: string; voice: string; image: string; flag: string;
  description: string; specialty: string; ageRange: string;
  color: string; gradient: string; ringColor: string;
  systemPrompt: string;
}

const TEACHERS: Teacher[] = [
  {
    id: "sterling", name: "Mr. Sterling", accent: "british-rp", accentLabel: "Üst Segment İngiliz (RP)",
    gender: "Erkek", voice: "onyx", image: "coach-sterling.png", flag: "🇬🇧",
    description: "Otoriter, az ve öz konuşan", specialty: "CEO & Stratejik Yönetim", ageRange: "55-60",
    color: "#1E3A5F", gradient: "from-slate-700 to-slate-900", ringColor: "ring-slate-700",
    systemPrompt: `You are Mr. Sterling, a 57-year-old British executive from London. Refined RP accent, impeccably dressed, a lover of single malt whisky, classical music, and weekend cricket. You spent 30 years in the boardroom of global firms and now coach executives. You can be surprisingly witty in a dry, understated way. You enjoy talking about life, travel, culture, and opinions on the world. When business, leadership, or strategy comes up, you naturally bring your executive depth.`,
  },
  {
    id: "jake", name: "Jake", accent: "american-west-coast", accentLabel: "Modern Amerikan (West Coast)",
    gender: "Erkek", voice: "echo", image: "coach-jake.png", flag: "🇺🇸",
    description: "Enerjik, kreatif jargon, hızlı konuşan", specialty: "Pazarlama & Dijital Medya", ageRange: "28-32",
    color: "#EA580C", gradient: "from-orange-500 to-orange-700", ringColor: "ring-orange-500",
    systemPrompt: `You are Jake, a 30-year-old San Francisco marketing guy. You surf on weekends, binge Netflix, love tacos, and obsess over the latest tech gadgets and apps. You grew up in California and everything about you is laid-back and upbeat. You work in digital marketing at a startup. You love talking about pop culture, travel, food, music, and life. When the conversation touches on marketing, social media, or branding, you light up with genuine enthusiasm.`,
  },
  {
    id: "david", name: "David", accent: "american-new-york", accentLabel: "New York (Wall Street)",
    gender: "Erkek", voice: "echo", image: "coach-david.png", flag: "🇺🇸",
    description: "Analitik, sayılarla konuşan, resmi ve ciddi", specialty: "Finans & Yatırım Analizi", ageRange: "40-45",
    color: "#0369A1", gradient: "from-sky-600 to-sky-800", ringColor: "ring-sky-600",
    systemPrompt: `You are David, a 43-year-old New Yorker who works in finance on Wall Street. You're a runner, a Yankees fan, and you make a mean espresso. You grew up in Brooklyn, moved to Manhattan for college, and never left. You're intense but also genuinely funny and curious about people. You talk about everything — city life, sports, relationships, food, travel — like a real New Yorker. When finance or investing comes up, you naturally shift into sharp, precise analyst mode.`,
  },
  {
    id: "emma", name: "Emma", accent: "british-standard", accentLabel: "Standart İngiliz (London)",
    gender: "Kadın", voice: "shimmer", image: "coach-emma-hr.png", flag: "🇬🇧",
    description: "Empatik, mülakat teknikleri uzmanı", specialty: "İnsan Kaynakları (HR)", ageRange: "35-38",
    color: "#BE185D", gradient: "from-pink-600 to-pink-800", ringColor: "ring-pink-600",
    systemPrompt: `You are Emma, a 37-year-old Londoner who works in HR. You're warm, a bit bookish, and you love weekend brunches, yoga, travelling Europe, and terrible reality TV you'd never admit to watching. You grew up in Bristol and moved to London for work. You're empathetic, a great listener, and always curious about people's stories. You'll chat about anything — relationships, travel, food, life choices. When the subject of careers, interviews, or workplace dynamics comes up, you naturally get into your element.`,
  },
  {
    id: "raj", name: "Raj", accent: "indian-english", accentLabel: "Hint-İngiliz (Global Tech)",
    gender: "Erkek", voice: "echo", image: "coach-raj.png", flag: "🇮🇳",
    description: "Teknik terimlere hakim, küresel teknoloji aksanı", specialty: "BT & Yazılım Geliştirme", ageRange: "30-35",
    color: "#7C3AED", gradient: "from-violet-600 to-violet-800", ringColor: "ring-violet-600",
    systemPrompt: `You are Raj, a 32-year-old software engineer from Bangalore who now works in London. You love cricket, Bollywood movies, spicy food, and building side projects on weekends. You're warm, a little nerdy, and great at explaining complicated things simply. You talk about daily life, culture clashes, food, relationships, and travel with genuine enthusiasm. When tech topics or software come up, you get excited and can geek out naturally.`,
  },
  {
    id: "hans", name: "Hans", accent: "euro-english", accentLabel: "Alman-İngiliz (Euro-English)",
    gender: "Erkek", voice: "onyx", image: "coach-hans.png", flag: "🇩🇪",
    description: "Metodik, yapılandırılmış cümleler, endüstriyel dil", specialty: "Lojistik & Operasyon", ageRange: "45-50",
    color: "#374151", gradient: "from-gray-600 to-gray-800", ringColor: "ring-gray-600",
    systemPrompt: `You are Hans, a 47-year-old German from Hamburg who works in logistics. You love hiking in Bavaria, watching Bundesliga football, cooking schnitzel, and reading history books. You're precise, calm, and reliable — a true German stereotype, but you know it and joke about it. You can talk about anything: travel, food, European culture, football, family life. When the conversation moves toward supply chains, operations, or business processes, you bring structured, practical insight naturally.`,
  },
  {
    id: "elena", name: "Elena", accent: "diplomatic-english", accentLabel: "Doğu Avrupa-İngiliz (Diplomatik)",
    gender: "Kadın", voice: "nova", image: "coach-elena.png", flag: "🇪🇺",
    description: "Hukuki terimler, sözleşme dili, net ve yavaş", specialty: "Uluslararası Hukuk", ageRange: "42-46",
    color: "#065F46", gradient: "from-emerald-700 to-emerald-900", ringColor: "ring-emerald-700",
    systemPrompt: `You are Elena, a 44-year-old international lawyer from Prague, now based in Brussels. You love classical piano, strong black coffee, detective novels, and travelling to coastal towns in summer. You are composed, thoughtful, and intellectually curious — you enjoy discussing philosophy, current events, history, and culture. You ask smart questions and listen carefully. When legal, contractual, or international affairs topics come up, your precision and depth emerge naturally.`,
  },
  {
    id: "alistair", name: "Alistair", accent: "scottish", accentLabel: "İskoç (Hafif ve Karizmatik)",
    gender: "Erkek", voice: "echo", image: "coach-alistair.png", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
    description: "İkna kabiliyeti yüksek, deyimsel kullanım", specialty: "Satış & Müzakere", ageRange: "38-42",
    color: "#B91C1C", gradient: "from-red-600 to-red-800", ringColor: "ring-red-600",
    systemPrompt: `You are Alistair, a 40-year-old Scotsman from Edinburgh who works in sales and loves a good laugh. You're into golf, pub quizzes, whisky tasting, and supporting Hibs no matter how painful it gets. You're naturally charismatic, tell great stories, and can find common ground with absolutely anyone. You talk about sport, life, relationships, food, and whatever's on your mind. When negotiations, persuasion, or sales strategy comes up, you slip into sharp, confident mode with ease.`,
  },
  {
    id: "chloe", name: "Chloe", accent: "australian", accentLabel: "Avusturalyalı (Friendly Business)",
    gender: "Kadın", voice: "nova", image: "coach-chloe.png", flag: "🇦🇺",
    description: "Çözüm odaklı, samimi ama profesyonel", specialty: "Müşteri İlişkileri (CRM)", ageRange: "25-30",
    color: "#D97706", gradient: "from-amber-500 to-amber-700", ringColor: "ring-amber-500",
    systemPrompt: `You are Chloe, a 27-year-old Australian from Melbourne. You love brunch, beach weekends, hiking, and going to live music events. You're genuinely positive, easy to talk to, and you find something interesting in everyone. You work in customer success at a tech company. You chat naturally about daily life, travel, food, hobbies, and all sorts of things. When customer service, communication, or relationship-building topics come up, you're enthusiastic and full of practical tips.`,
  },
  {
    id: "james", name: "James", accent: "american-midwest", accentLabel: "Amerikan (Midwest / Endüstriyel)",
    gender: "Erkek", voice: "onyx", image: "coach-james-mfg.png", flag: "🇺🇸",
    description: "Pratik, direkt, üretim süreçleri jargonu", specialty: "Üretim & Fabrika Yönetimi", ageRange: "50-55",
    color: "#78350F", gradient: "from-amber-900 to-stone-800", ringColor: "ring-amber-900",
    systemPrompt: `You are James, a 52-year-old guy from Ohio who manages a manufacturing plant. You love American football, grilling, fishing on weekends, and cold beer. You're straight-talking, down-to-earth, and you say what you mean. No fuss, no fancy words. You talk about everyday life — sports, family, weather, food, work-life balance — like a real regular American. When factory operations, safety, or industrial management topics come up, you get practical and direct about what works on the floor.`,
  },
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
  teacher, phase,
}: { teacher: Teacher; phase: Phase }) {
  const isListening = phase === "recording";
  const isSpeaking = phase === "speaking";
  const isProcessing = phase === "processing";

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
              style={{ width: 130, height: 130, border: `3px solid ${teacher.color}` }}
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
              style={{ width: 130, height: 130, border: `2px solid ${teacher.color}` }}
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
              style={{ width: 120, height: 120, border: "2px solid #EF4444" }}
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
              width: 125, height: 125,
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
          style={{ width: 100, height: 100 }}
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

        <div className="grid grid-cols-2 gap-3">
          {TEACHERS.map((t, i) => (
            <motion.button
              key={t.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07, duration: 0.35 }}
              onHoverStart={() => setHovered(t.id)}
              onHoverEnd={() => setHovered(null)}
              onClick={() => onSelect(t)}
              className="relative flex flex-col items-center gap-2.5 p-4 rounded-2xl bg-white shadow-sm border-2 border-gray-100 hover:shadow-xl transition-all overflow-hidden text-center"
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
                  style={{ width: 72, height: 72 }}
                  animate={hovered === t.id ? { scale: [1, 1.04, 1, 1.03, 1] } : { scale: 1 }}
                  transition={hovered === t.id ? { duration: 1.5, repeat: Infinity, ease: "easeInOut" } : { duration: 0.3 }}
                >
                  <img src={`/images/${t.image}`} alt={t.name} className="w-full h-full object-cover" />
                  <motion.div
                    className="absolute inset-0"
                    style={{ background: `radial-gradient(circle at 40% 35%, ${t.color}33, transparent 70%)` }}
                    animate={{ opacity: hovered === t.id ? 1 : 0 }}
                    transition={{ duration: 0.3 }}
                  />
                </motion.div>
                <AnimatePresence>
                  {hovered === t.id && (
                    <motion.div key="ring" className="absolute inset-0 rounded-full"
                      style={{ border: `2px solid ${t.color}` }}
                      initial={{ scale: 1, opacity: 0.8 }} animate={{ scale: 1.35, opacity: 0 }} exit={{ opacity: 0 }}
                      transition={{ duration: 0.9, repeat: Infinity }} />
                  )}
                </AnimatePresence>
              </div>

              {/* Info */}
              <div className="relative z-10 w-full">
                <p className="font-bold text-gray-900 text-sm">{t.flag} {t.name}</p>
                <p className="text-[10px] font-semibold mt-0.5 px-2 py-0.5 rounded-full inline-block" style={{ background: `${t.color}18`, color: t.color }}>{t.specialty}</p>
                <p className="text-[10px] text-gray-400 mt-1">{t.accentLabel}</p>
                <p className="text-[10px] mt-1 italic" style={{ color: t.color }}>{t.description}</p>
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

function TeacherBubble({ message, teacher, onPlay, getApiBase }: { message: Message; teacher: Teacher; onPlay: (b: string) => void; getApiBase: () => string }) {
  const [translation, setTranslation] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);

  const handleTranslate = async () => {
    if (translation !== null) { setTranslation(null); return; }
    setTranslating(true);
    try {
      const token = localStorage.getItem("sphere_token");
      const res = await fetch(`${getApiBase()}/api/pronunciation/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ text: message.text }),
      });
      const data = await res.json();
      setTranslation(data.translation || "Çeviri alınamadı.");
    } catch {
      setTranslation("Çeviri başarısız oldu.");
    } finally {
      setTranslating(false);
    }
  };

  return (
    <div className="flex items-end gap-2 mb-3">
      <img src={`/images/${teacher.image}`} alt={teacher.name}
        className="w-7 h-7 rounded-full object-cover flex-shrink-0 shadow ring-2 ring-white" />
      <div className="max-w-[80%]">
        <div className="rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-sm shadow-sm bg-white border border-gray-100 text-gray-800 leading-relaxed">
          {message.text}
        </div>
        {translation !== null && (
          <div className="mt-1.5 mx-0.5 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 leading-relaxed">
            {translation}
          </div>
        )}
        <div className="flex items-center gap-3 mt-1 ml-1">
          {message.audioBase64 && (
            <button onClick={() => onPlay(message.audioBase64!)}
              className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-600 transition">
              <Volume2 size={11} />Tekrar dinle
            </button>
          )}
          <button onClick={handleTranslate} disabled={translating}
            className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-600 transition disabled:opacity-50">
            <Languages size={11} />
            {translating ? "Çevriliyor..." : translation !== null ? "Gizle" : "Çevir"}
          </button>
        </div>
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
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ""; }

    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: "audio/mpeg" });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audioRef.current = audio;

    setPhase("speaking");

    audio.play().catch(() => {});
    audio.onended = () => {
      URL.revokeObjectURL(url);
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
      formData.append("systemPrompt", teacher.systemPrompt);
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
    stopStream(); stopTimer();
    if (audioRef.current) { audioRef.current.pause(); }
    setMessages([]); setScreen("select"); setPhase("idle"); setError("");
  };

  useEffect(() => {
    return () => {
      stopStream(); stopTimer();
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
      {/* ── Header (avatar + status entegre) ── */}
      <div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-gray-100 flex-shrink-0">
        <button onClick={handleBack} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
          <ChevronLeft size={20} />
        </button>

        {/* Avatar with phase ring */}
        <div className="relative flex-shrink-0">
          <AnimatePresence>
            {isSpeaking && (
              <motion.div key="hdr-speak" className="absolute inset-0 rounded-full"
                style={{ border: `2px solid ${teacher.color}` }}
                initial={{ opacity: 0.8, scale: 1 }} animate={{ opacity: 0, scale: 1.5 }} exit={{ opacity: 0 }}
                transition={{ duration: 1, repeat: Infinity, ease: "easeOut" }} />
            )}
            {isRecording && (
              <motion.div key="hdr-rec" className="absolute inset-0 rounded-full border-2 border-red-400"
                animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1, repeat: Infinity }} />
            )}
          </AnimatePresence>
          <img src={`/images/${teacher.image}`} alt={teacher.name}
            className="w-10 h-10 rounded-full object-cover shadow relative z-10" />
          {/* Status dot */}
          <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white z-20 ${
            isRecording ? "bg-red-500" : isSpeaking ? "bg-green-400" : isProcessing ? "bg-yellow-400" : "bg-gray-300"
          }`} />
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm leading-tight">{teacher.flag} {teacher.name}</p>
          <p className="text-xs leading-tight mt-0.5" style={{ color: isRecording ? "#EF4444" : isSpeaking ? "#10B981" : isProcessing ? "#F59E0B" : "#9CA3AF" }}>
            {isRecording ? "Dinliyorum..." : isSpeaking ? "Konuşuyor..." : isProcessing ? "Düşünüyor..." : `${teacher.accentLabel} · AI Koç`}
          </p>
        </div>

        <button onClick={() => { setMessages([]); }} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition" title="Sohbeti sıfırla">
          <RotateCcw size={15} />
        </button>
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
                : <TeacherBubble message={msg} teacher={teacher} onPlay={playAudio} getApiBase={getApiBase} />}
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
