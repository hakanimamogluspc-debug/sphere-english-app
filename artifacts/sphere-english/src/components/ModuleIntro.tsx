import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { HelpCircle, X, ChevronRight, Play, Users, Clock, Target, Sparkles } from "lucide-react";

/**
 * ModuleIntro — Modül tanıtım wizard'ı.
 *
 * Her AI Studio modülü için 4 slaytlık tanıtım:
 *   1. Ne işe yarar? (name + tagline + value_prop)
 *   2. Nasıl kullanılır? (how_to 3 adım)
 *   3. Kimin için + süre (target_level + duration)
 *   4. İlk aksiyon + Başla (first_action + CTA)
 *
 * Davranış:
 * - İlk açılışta otomatik gösterilir (localStorage `module_intro_seen_${moduleKey}`)
 * - Sonra "?" ikonuyla yeniden açılabilir (sağ üst köşede)
 * - "Bunu atla" → kapatır ama seen olarak işaretlemez (bir dahaki sefere gene çıkar)
 * - "Hadi Başlayalım" → seen=true kaydeder + kapatır
 *
 * Kullanım:
 *   <ModuleIntro moduleKey="pronunciation_coach" />
 *
 * moduleKey — locales/tr/modules.json'daki namespace key'i
 * (writing_coach | pronunciation_coach | grammar_coach | vocab_game |
 *  simulation_mode | interview_sim | presentation_sim | ai_quiz |
 *  ai_tutor | learning_path | level_exams | materials |
 *  speaking_club | live_classes)
 */

interface ModuleIntroProps {
  moduleKey: string;
  /** Otomatik açılmayı devre dışı bırak — sadece "?" butonu göster (opsiyonel) */
  autoOpen?: boolean;
  /** "Hadi Başlayalım" tıklandığında çağrılır — genelde bir scroll veya focus için */
  onStart?: () => void;
}

const STORAGE_PREFIX = "module_intro_seen_";

function hasSeen(moduleKey: string): boolean {
  try {
    return localStorage.getItem(STORAGE_PREFIX + moduleKey) === "1";
  } catch {
    return false;
  }
}

function markSeen(moduleKey: string): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + moduleKey, "1");
  } catch {
    /* localStorage yoksa sessizce geç */
  }
}

export default function ModuleIntro({ moduleKey, autoOpen = true, onStart }: ModuleIntroProps) {
  const { t } = useTranslation(["modules", "common"]);
  const [open, setOpen] = useState(false);
  const [slideIdx, setSlideIdx] = useState(0);

  // İlk render'da localStorage kontrol → seen değilse otomatik aç
  useEffect(() => {
    if (!autoOpen) return;
    if (!hasSeen(moduleKey)) {
      setOpen(true);
    }
  }, [moduleKey, autoOpen]);

  const closeAndSkip = useCallback(() => {
    setOpen(false);
    setSlideIdx(0);
    // "atla" → seen işaretlemiyoruz, bir dahakine gene çıkar
  }, []);

  const startModule = useCallback(() => {
    markSeen(moduleKey);
    setOpen(false);
    setSlideIdx(0);
    onStart?.();
  }, [moduleKey, onStart]);

  const openManually = useCallback(() => {
    setSlideIdx(0);
    setOpen(true);
  }, []);

  // Module metinleri çek — key mevcut değilse fallback göster
  const name = t(`${moduleKey}.name`, { defaultValue: moduleKey });
  const tagline = t(`${moduleKey}.tagline`, { defaultValue: "" });
  const valueProp = t(`${moduleKey}.value_prop`, { defaultValue: "" });
  const howToRaw = t(`${moduleKey}.how_to`, { returnObjects: true, defaultValue: [] });
  const howTo: string[] = Array.isArray(howToRaw) ? (howToRaw as string[]) : [];
  const targetLevel = t(`${moduleKey}.target_level`, { defaultValue: "" });
  const firstAction = t(`${moduleKey}.first_action`, { defaultValue: "" });
  const duration = t(`${moduleKey}.duration`, { defaultValue: "" });

  const slides = [
    {
      icon: Sparkles,
      title: name,
      subtitle: tagline,
      body: valueProp,
    },
    {
      icon: Play,
      title: t("intro.how_to_use"),
      subtitle: name,
      list: howTo,
    },
    {
      icon: Users,
      title: t("intro.who_for"),
      subtitle: targetLevel,
      body: t("intro.duration", { duration }),
      iconRight: Clock,
    },
    {
      icon: Target,
      title: t("intro.first_action"),
      subtitle: firstAction,
    },
  ];

  const currentSlide = slides[slideIdx];
  const isLast = slideIdx === slides.length - 1;
  const Icon = currentSlide.icon;
  const IconRight = (currentSlide as any).iconRight;

  return (
    <>
      {/* Help butonu — sağ üst köşede sabit */}
      <button
        type="button"
        onClick={openManually}
        className="fixed top-4 right-4 z-40 w-10 h-10 rounded-full bg-white border border-slate-200 shadow-md hover:shadow-lg hover:border-indigo-300 flex items-center justify-center text-slate-500 hover:text-indigo-600 transition-all"
        aria-label={t("intro.show_again")}
        title={t("intro.show_again")}
      >
        <HelpCircle size={18} />
      </button>

      {/* Modal — z-50 */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="module-intro-title"
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                <span>{slideIdx + 1}</span>
                <span className="text-slate-300">/</span>
                <span>{slides.length}</span>
              </div>
              <button
                type="button"
                onClick={closeAndSkip}
                className="text-slate-400 hover:text-slate-600"
                aria-label={t("intro.skip")}
              >
                <X size={20} />
              </button>
            </div>

            {/* Progress bar */}
            <div className="h-1 bg-slate-100">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-sky-500 transition-all duration-300"
                style={{ width: `${((slideIdx + 1) / slides.length) * 100}%` }}
              />
            </div>

            {/* Content */}
            <div className="px-8 py-8 min-h-[280px]">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-100 to-sky-100 flex items-center justify-center text-indigo-600 shrink-0">
                  <Icon size={22} strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3
                    id="module-intro-title"
                    className="text-xl font-extrabold text-slate-900 leading-tight"
                  >
                    {currentSlide.title}
                  </h3>
                  {currentSlide.subtitle && (
                    <p className="text-sm text-slate-500 mt-1">{currentSlide.subtitle}</p>
                  )}
                </div>
                {IconRight && (
                  <div className="text-slate-400">
                    <IconRight size={18} />
                  </div>
                )}
              </div>

              {"body" in currentSlide && currentSlide.body && (
                <p className="text-[15px] text-slate-700 leading-relaxed mt-4">
                  {currentSlide.body}
                </p>
              )}

              {"list" in currentSlide && Array.isArray(currentSlide.list) && (
                <ol className="mt-4 space-y-3">
                  {(currentSlide.list as string[]).map((step: string, i: number) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">
                        {i + 1}
                      </span>
                      <span className="text-[15px] text-slate-700 leading-relaxed">{step}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={closeAndSkip}
                className="text-sm text-slate-500 hover:text-slate-700 font-medium"
              >
                {t("intro.skip")}
              </button>

              {isLast ? (
                <button
                  type="button"
                  onClick={startModule}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 text-white text-sm font-bold shadow-md hover:shadow-lg transition-all"
                >
                  {t("intro.start")}
                  <ChevronRight size={16} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setSlideIdx((v) => Math.min(v + 1, slides.length - 1))}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold transition-colors"
                >
                  {t("common:actions.next", { defaultValue: "İleri" })}
                  <ChevronRight size={16} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
