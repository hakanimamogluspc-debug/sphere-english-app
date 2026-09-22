import { useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import { API } from "@/lib/api-url";
import {
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Sparkles,
  Loader2,
  Target,
  Briefcase,
  Languages,
  Rocket,
} from "lucide-react";

/**
 * Onboarding Wizard — Kayıt sonrası ilk 5 adım.
 *
 * Akış:
 *   1. Dil seçimi (Türkçe / English)
 *   2. Hoş geldin + isim doğrulama
 *   3. Sektör seçimi
 *   4. Hedef seçimi
 *   5. Placement test'e hazırlık
 *
 * Tamamlandığında:
 *   - Backend'e POST /api/student/onboarding → 3 alan + onboarding_completed=true
 *   - Otomatik /placement-test'e yönlendirilir
 */

const TOKEN_KEY = "sphere_token";

const SECTORS = [
  { id: "finance", labelTr: "Finans / Bankacılık", labelEn: "Finance / Banking", emoji: "💰" },
  { id: "tech", labelTr: "Teknoloji / Yazılım", labelEn: "Technology / Software", emoji: "💻" },
  { id: "manufacturing", labelTr: "Üretim / İhracat", labelEn: "Manufacturing / Export", emoji: "🏭" },
  { id: "consulting", labelTr: "Danışmanlık", labelEn: "Consulting", emoji: "📊" },
  { id: "healthcare", labelTr: "Sağlık / İlaç", labelEn: "Healthcare / Pharma", emoji: "⚕️" },
  { id: "hospitality", labelTr: "Turizm / Hospitality", labelEn: "Tourism / Hospitality", emoji: "✈️" },
  { id: "hr", labelTr: "İnsan Kaynakları", labelEn: "Human Resources", emoji: "🤝" },
  { id: "sales", labelTr: "Satış / Pazarlama", labelEn: "Sales / Marketing", emoji: "📈" },
  { id: "legal", labelTr: "Hukuk", labelEn: "Legal", emoji: "⚖️" },
  { id: "education", labelTr: "Eğitim", labelEn: "Education", emoji: "🎓" },
  { id: "other", labelTr: "Diğer", labelEn: "Other", emoji: "🔹" },
];

const GOALS = [
  { id: "interview", labelTr: "İş görüşmelerine hazırlanmak", labelEn: "Prepare for job interviews", emoji: "🎯" },
  { id: "meetings", labelTr: "Toplantılarda daha etkili olmak", labelEn: "Be more effective in meetings", emoji: "🗣️" },
  { id: "presentation", labelTr: "Sunum yapmak", labelEn: "Give presentations", emoji: "📣" },
  { id: "email", labelTr: "İş email'lerini iyi yazmak", labelEn: "Write great business emails", emoji: "✉️" },
  { id: "customer", labelTr: "Uluslararası müşterilerle iletişim", labelEn: "Communicate with international clients", emoji: "🌍" },
  { id: "certificate", labelTr: "CEFR sertifikası almak", labelEn: "Get a CEFR certificate", emoji: "📜" },
  { id: "general", labelTr: "Genel akıcılık kazanmak", labelEn: "Gain overall fluency", emoji: "✨" },
];

const TOTAL_STEPS = 5;

export default function Onboarding() {
  const { t, i18n } = useTranslation(["onboarding", "common"]);
  const { user, refresh } = useAuth();
  const [, navigate] = useLocation();

  const [step, setStep] = useState(1);
  const [language, setLanguage] = useState<"tr" | "en">((i18n.resolvedLanguage as "tr" | "en") ?? "tr");
  const [sector, setSector] = useState<string>("");
  const [goal, setGoal] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const firstName = user?.firstName ?? "";
  const isTr = language === "tr";

  const changeLanguage = (lang: "tr" | "en") => {
    setLanguage(lang);
    void i18n.changeLanguage(lang);
  };

  const canNext =
    (step === 1) ||
    (step === 2) ||
    (step === 3 && !!sector) ||
    (step === 4 && !!goal) ||
    (step === 5);

  const next = () => {
    if (!canNext) return;
    if (step < TOTAL_STEPS) {
      setStep((s) => s + 1);
    } else {
      submit();
    }
  };

  const back = () => {
    if (step > 1) setStep((s) => s - 1);
  };

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const res = await fetch(`${API}/student/onboarding`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          preferredLanguage: language,
          sector,
          learningGoal: goal,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Onboarding tamamlanamadı");
      // Refresh auth state
      await refresh?.();
      // Placement test'e yönlendir
      navigate("/placement-test");
    } catch (e: any) {
      setError(e?.message ?? "Bir hata oluştu");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
        {/* Progress bar */}
        <div className="h-1 bg-slate-100">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-sky-500 transition-all duration-300"
            style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
          />
        </div>

        {/* Header — step counter */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
            <span>{isTr ? "Adım" : "Step"} {step}</span>
            <span className="text-slate-300">/</span>
            <span>{TOTAL_STEPS}</span>
          </div>
          <div className="text-xs text-slate-400">
            {isTr ? "Sphere English" : "Sphere English"} ✨
          </div>
        </div>

        {/* Content */}
        <div className="px-8 py-8 min-h-[400px]">
          {step === 1 && (
            <StepLanguage
              language={language}
              onChange={changeLanguage}
              isTr={isTr}
            />
          )}
          {step === 2 && <StepWelcome firstName={firstName} isTr={isTr} />}
          {step === 3 && <StepSector value={sector} onChange={setSector} isTr={isTr} />}
          {step === 4 && <StepGoal value={goal} onChange={setGoal} isTr={isTr} />}
          {step === 5 && <StepPlacement isTr={isTr} sector={sector} goal={goal} />}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-8 mb-4 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={back}
            disabled={step === 1 || submitting}
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={16} />
            {isTr ? "Geri" : "Back"}
          </button>

          <button
            type="button"
            onClick={next}
            disabled={!canNext || submitting}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 text-white text-sm font-bold shadow-md hover:shadow-lg transition-all disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none"
          >
            {submitting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                {isTr ? "Kaydediliyor…" : "Saving…"}
              </>
            ) : step === TOTAL_STEPS ? (
              <>
                {isTr ? "Seviye Testine Başla" : "Start Placement Test"}
                <Rocket size={14} />
              </>
            ) : (
              <>
                {isTr ? "Devam" : "Continue"}
                <ChevronRight size={16} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Step 1: Language ────────────────────────────────────────────

function StepLanguage({
  language,
  onChange,
  isTr,
}: {
  language: "tr" | "en";
  onChange: (l: "tr" | "en") => void;
  isTr: boolean;
}) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-100 to-sky-100 flex items-center justify-center text-indigo-600">
          <Languages size={22} />
        </div>
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">
            {isTr ? "Hoş geldin! Hangi dilde öğrenmek istiyorsun?" : "Welcome! Which language would you like to use?"}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {isTr
              ? "Arayüz dilini seç — istediğin zaman değiştirebilirsin"
              : "Choose the interface language — you can change it anytime"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[
          { code: "tr" as const, flag: "🇹🇷", label: "Türkçe" },
          { code: "en" as const, flag: "🇬🇧", label: "English" },
        ].map((opt) => (
          <button
            key={opt.code}
            type="button"
            onClick={() => onChange(opt.code)}
            className={`p-5 rounded-xl border-2 transition-all text-left ${
              language === opt.code
                ? "border-indigo-500 bg-indigo-50 shadow-md"
                : "border-slate-200 hover:border-slate-300 bg-white"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-3xl leading-none">{opt.flag}</span>
              <div className="flex-1">
                <div className="font-bold text-slate-900">{opt.label}</div>
              </div>
              {language === opt.code && <CheckCircle2 className="text-indigo-500" size={20} />}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Step 2: Welcome ─────────────────────────────────────────────

function StepWelcome({ firstName, isTr }: { firstName: string; isTr: boolean }) {
  return (
    <div className="text-center py-8">
      <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-indigo-100 to-sky-100 flex items-center justify-center text-indigo-600 mb-6">
        <Sparkles size={36} />
      </div>
      <h2 className="text-2xl font-extrabold text-slate-900 mb-3">
        {isTr
          ? `Sphere English'e hoş geldin, ${firstName}!`
          : `Welcome to Sphere English, ${firstName}!`}
      </h2>
      <p className="text-slate-600 max-w-md mx-auto leading-relaxed">
        {isTr
          ? "3 dakikada seni tanıyıp sana özel bir yol haritası oluşturacağız. Sonra kısa bir seviye tespit sınavıyla başlayacaksın."
          : "In 3 minutes we'll get to know you and build a personalized roadmap. Then you'll start with a short placement test."}
      </p>
    </div>
  );
}

// ─── Step 3: Sector ──────────────────────────────────────────────

function StepSector({
  value,
  onChange,
  isTr,
}: {
  value: string;
  onChange: (v: string) => void;
  isTr: boolean;
}) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-100 to-sky-100 flex items-center justify-center text-indigo-600">
          <Briefcase size={22} />
        </div>
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">
            {isTr ? "Hangi sektörde çalışıyorsun?" : "Which industry do you work in?"}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {isTr
              ? "Sektörüne özel iş İngilizcesi senaryoları hazırlayacağız"
              : "We'll prepare business English scenarios for your industry"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {SECTORS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onChange(s.id)}
            className={`p-3 rounded-xl border-2 transition-all text-left ${
              value === s.id
                ? "border-indigo-500 bg-indigo-50 shadow-sm"
                : "border-slate-200 hover:border-slate-300 bg-white"
            }`}
          >
            <div className="text-2xl mb-1">{s.emoji}</div>
            <div className="text-xs font-semibold text-slate-800 leading-tight">
              {isTr ? s.labelTr : s.labelEn}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Step 4: Goal ────────────────────────────────────────────────

function StepGoal({
  value,
  onChange,
  isTr,
}: {
  value: string;
  onChange: (v: string) => void;
  isTr: boolean;
}) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-100 to-sky-100 flex items-center justify-center text-indigo-600">
          <Target size={22} />
        </div>
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">
            {isTr ? "Ana hedefin ne?" : "What is your main goal?"}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {isTr
              ? "Sana en çok faydası olacak modülleri öne çıkaracağız"
              : "We'll highlight the modules that benefit you the most"}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {GOALS.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => onChange(g.id)}
            className={`w-full p-3 rounded-xl border-2 transition-all text-left flex items-center gap-3 ${
              value === g.id
                ? "border-indigo-500 bg-indigo-50 shadow-sm"
                : "border-slate-200 hover:border-slate-300 bg-white"
            }`}
          >
            <span className="text-2xl">{g.emoji}</span>
            <span className="text-sm font-semibold text-slate-800 flex-1">
              {isTr ? g.labelTr : g.labelEn}
            </span>
            {value === g.id && <CheckCircle2 className="text-indigo-500 shrink-0" size={18} />}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Step 5: Placement ───────────────────────────────────────────

function StepPlacement({ isTr, sector, goal }: { isTr: boolean; sector: string; goal: string }) {
  const sec = SECTORS.find((s) => s.id === sector);
  const g = GOALS.find((x) => x.id === goal);
  return (
    <div className="text-center py-6">
      <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-emerald-100 to-sky-100 flex items-center justify-center text-emerald-600 mb-4">
        <Rocket size={36} />
      </div>
      <h2 className="text-2xl font-extrabold text-slate-900 mb-3">
        {isTr ? "Neredeyse hazır! 🎉" : "Almost ready! 🎉"}
      </h2>
      <p className="text-slate-600 max-w-md mx-auto leading-relaxed mb-6">
        {isTr
          ? "Şimdi 25 dakikalık kısa bir seviye tespit sınavıyla mevcut CEFR seviyeni belirleyeceğiz. Sonra sana özel öğrenme yolu hazırlanacak."
          : "Now we'll determine your CEFR level with a short 25-minute placement test. Then a personalized learning path will be built for you."}
      </p>

      <div className="max-w-sm mx-auto bg-slate-50 border border-slate-200 rounded-xl p-4 text-left space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <Briefcase size={14} className="text-slate-400" />
          <span className="text-slate-600">
            {isTr ? "Sektör:" : "Industry:"}
          </span>
          <span className="font-semibold text-slate-900">
            {sec ? (isTr ? sec.labelTr : sec.labelEn) : "—"}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Target size={14} className="text-slate-400" />
          <span className="text-slate-600">
            {isTr ? "Hedef:" : "Goal:"}
          </span>
          <span className="font-semibold text-slate-900">
            {g ? (isTr ? g.labelTr : g.labelEn) : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}
