import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  PenLine, Send, Loader2, ChevronDown, ChevronUp,
  CheckCircle2, AlertCircle, Lightbulb, Star, BookOpen, FileText, Mail, ClipboardList, Sparkles
} from "lucide-react";

const getApiBase = () => import.meta.env.BASE_URL.replace(/\/$/, "");

const WRITING_TYPES = [
  { value: "general", label: "Genel Yazı", icon: PenLine, color: "from-slate-500 to-slate-700" },
  { value: "business-email", label: "İş E-postası", icon: Mail, color: "from-blue-500 to-blue-700" },
  { value: "formal-letter", label: "Resmi Mektup", icon: FileText, color: "from-purple-500 to-purple-700" },
  { value: "essay", label: "Essay / Kompozisyon", icon: BookOpen, color: "from-green-500 to-green-700" },
  { value: "report", label: "Rapor", icon: ClipboardList, color: "from-orange-500 to-orange-700" },
];

const LEVEL_COLORS: Record<string, string> = {
  A1: "bg-red-100 text-red-700 border-red-200",
  A2: "bg-orange-100 text-orange-700 border-orange-200",
  B1: "bg-yellow-100 text-yellow-700 border-yellow-200",
  B2: "bg-blue-100 text-blue-700 border-blue-200",
  C1: "bg-green-100 text-green-700 border-green-200",
  C2: "bg-purple-100 text-purple-700 border-purple-200",
};

const SCORE_COLOR = (score: number) => {
  if (score >= 8) return "text-green-600";
  if (score >= 6) return "text-blue-600";
  if (score >= 4) return "text-yellow-600";
  return "text-red-500";
};

function ScoreBar({ score, label }: { score: number; label: string }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className={`text-sm font-bold ${SCORE_COLOR(score)}`}>{score}/10</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score * 10}%` }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
          className={`h-full rounded-full ${score >= 8 ? "bg-green-500" : score >= 6 ? "bg-blue-500" : score >= 4 ? "bg-yellow-500" : "bg-red-500"}`}
        />
      </div>
    </div>
  );
}

function CollapsibleSection({ title, icon: Icon, color, children, defaultOpen = false }: {
  title: string; icon: any; color: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 bg-white hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center`}>
            <Icon className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-gray-800">{title}</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
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
            <div className="p-4 bg-gray-50 border-t border-gray-200">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function WritingCoach() {
  const [writingType, setWritingType] = useState("general");
  const [topic, setTopic] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  const charCount = text.length;
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  async function analyze() {
    if (text.trim().length < 20) {
      setError("Lütfen en az 20 karakterlik bir metin girin.");
      return;
    }
    setError("");
    setLoading(true);
    setResult(null);
    try {
      const token = localStorage.getItem("sphere_token");
      const res = await fetch(`${getApiBase()}/api/writing/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text, writingType, topic }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Bir hata oluştu.");
      setResult(data.analysis);
    } catch (err: any) {
      setError(err.message || "Analiz sırasında bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-10">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
          <PenLine className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Yazma Koçu</h1>
          <p className="text-gray-500 text-sm">AI destekli İngilizce yazı analizi ve geri bildirim</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">Yazı Türü</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {WRITING_TYPES.map((type) => {
              const Icon = type.icon;
              const selected = writingType === type.value;
              return (
                <button
                  key={type.value}
                  onClick={() => setWritingType(type.value)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all text-center ${
                    selected
                      ? "border-indigo-500 bg-indigo-50"
                      : "border-gray-200 hover:border-indigo-300 bg-white"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${type.color} flex items-center justify-center`}>
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <span className={`text-xs font-medium leading-tight ${selected ? "text-indigo-700" : "text-gray-600"}`}>
                    {type.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Konu / Başlık <span className="text-gray-400 font-normal">(isteğe bağlı)</span>
          </label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder='Örn: "The impact of remote work on productivity"'
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-semibold text-gray-700">Metniniz</label>
            <span className={`text-xs ${charCount > 3000 ? "text-red-500 font-semibold" : "text-gray-400"}`}>
              {wordCount} kelime · {charCount}/3000 karakter
            </span>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="İngilizce yazınızı buraya yapıştırın veya yazın..."
            rows={10}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent resize-none leading-relaxed"
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <button
          onClick={analyze}
          disabled={loading || charCount > 3000}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Analiz ediliyor...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Metni Analiz Et
            </>
          )}
        </button>
      </div>

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-6 text-white shadow-lg">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-indigo-200 text-sm font-medium mb-1">Genel Değerlendirme</p>
                  <p className="text-white text-base leading-relaxed">{result.overallComment}</p>
                </div>
                <div className="flex-shrink-0 text-center">
                  <div className={`inline-flex items-center px-4 py-2 rounded-xl border-2 font-bold text-2xl ${LEVEL_COLORS[result.overallScore] || "bg-white/20 text-white border-white/30"}`}>
                    {result.overallScore}
                  </div>
                  <p className="text-indigo-200 text-xs mt-1">Seviye</p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
                {[
                  { label: "Dilbilgisi", score: result.grammarScore },
                  { label: "Kelime Hazinesi", score: result.vocabularyScore },
                  { label: "Bağlantı", score: result.coherenceScore },
                  { label: "Stil", score: result.styleScore },
                ].map((item) => (
                  <div key={item.label} className="bg-white/15 rounded-xl p-3 text-center">
                    <div className="text-2xl font-bold text-white">{item.score}<span className="text-sm text-indigo-200">/10</span></div>
                    <div className="text-xs text-indigo-200 mt-0.5">{item.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {result.strengths?.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <span className="font-semibold text-green-800">Güçlü Yönler</span>
                  </div>
                  <ul className="space-y-2">
                    {result.strengths.map((s: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-green-700">
                        <Star className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-green-500" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {result.improvements?.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Lightbulb className="w-5 h-5 text-amber-600" />
                    <span className="font-semibold text-amber-800">Geliştirilecek Alanlar</span>
                  </div>
                  <ul className="space-y-2">
                    {result.improvements.map((s: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-amber-700">
                        <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-amber-500" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="space-y-3">
              {result.grammarErrors?.length > 0 && (
                <CollapsibleSection title={`Dilbilgisi Hataları (${result.grammarErrors.length})`} icon={AlertCircle} color="bg-red-500" defaultOpen>
                  <div className="space-y-3">
                    <p className="text-sm text-gray-600 italic">{result.grammarFeedback}</p>
                    {result.grammarErrors.map((err: any, i: number) => (
                      <div key={i} className="bg-white rounded-lg border border-gray-200 p-3">
                        <div className="flex flex-wrap gap-2 items-center text-sm mb-1">
                          <span className="bg-red-100 text-red-700 line-through px-2 py-0.5 rounded font-mono">{err.original}</span>
                          <span className="text-gray-400">→</span>
                          <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded font-mono">{err.corrected}</span>
                        </div>
                        <p className="text-xs text-gray-500">{err.explanation}</p>
                      </div>
                    ))}
                  </div>
                </CollapsibleSection>
              )}

              {result.vocabularySuggestions?.length > 0 && (
                <CollapsibleSection title={`Kelime Önerileri (${result.vocabularySuggestions.length})`} icon={BookOpen} color="bg-blue-500" defaultOpen>
                  <div className="space-y-3">
                    <p className="text-sm text-gray-600 italic">{result.vocabularyFeedback}</p>
                    {result.vocabularySuggestions.map((sug: any, i: number) => (
                      <div key={i} className="bg-white rounded-lg border border-gray-200 p-3">
                        <div className="flex flex-wrap gap-2 items-center text-sm mb-1">
                          <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">{sug.original}</span>
                          <span className="text-gray-400">→</span>
                          <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-mono font-semibold">{sug.advanced}</span>
                        </div>
                        <p className="text-xs text-gray-500 italic">"{sug.example}"</p>
                      </div>
                    ))}
                  </div>
                </CollapsibleSection>
              )}

              <CollapsibleSection title="Bağlantı & Akış" icon={ClipboardList} color="bg-purple-500">
                <p className="text-sm text-gray-700">{result.coherenceFeedback}</p>
              </CollapsibleSection>

              <CollapsibleSection title="Yazı Stili" icon={Star} color="bg-orange-500">
                <p className="text-sm text-gray-700">{result.styleFeedback}</p>
              </CollapsibleSection>

              {result.improvedVersion && (
                <CollapsibleSection title="Geliştirilmiş Versiyon" icon={Sparkles} color="bg-green-600">
                  <div className="bg-white border border-green-200 rounded-lg p-4">
                    <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{result.improvedVersion}</p>
                  </div>
                  <button
                    onClick={() => navigator.clipboard.writeText(result.improvedVersion)}
                    className="mt-2 text-xs text-green-600 hover:text-green-800 font-medium"
                  >
                    Kopyala
                  </button>
                </CollapsibleSection>
              )}
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <ScoreBar score={result.grammarScore} label="Dilbilgisi" />
                <ScoreBar score={result.vocabularyScore} label="Kelime Hazinesi" />
                <ScoreBar score={result.coherenceScore} label="Bağlantı" />
                <ScoreBar score={result.styleScore} label="Stil" />
              </div>
            </div>

            <button
              onClick={() => { setResult(null); setText(""); setTopic(""); }}
              className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:text-gray-700 hover:border-gray-400 transition-colors text-sm font-medium"
            >
              Yeni Analiz Yap
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
