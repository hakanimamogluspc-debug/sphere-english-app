import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import { useState, useRef, useEffect } from "react";

/**
 * Dil değiştirme dropdown component'i.
 *
 * Kullanıcı tercihini localStorage'da (`sphere_lang`) saklar — i18n
 * detector otomatik olarak buradan okur.
 *
 * Kullanım: Header veya Settings sayfasına yerleştir.
 */

const LANGS = [
  { code: "tr", label: "Türkçe", flag: "🇹🇷" },
  { code: "en", label: "English", flag: "🇬🇧" },
] as const;

export default function LanguageSwitcher({
  compact = false,
}: {
  /** Sadece bayrak göster — header için. */
  compact?: boolean;
}) {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickAway = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, []);

  const current = LANGS.find((l) => l.code === i18n.resolvedLanguage) ?? LANGS[0];

  const handleChange = (code: string) => {
    void i18n.changeLanguage(code);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-700 transition-colors"
        aria-label="Dil değiştir"
        aria-expanded={open}
      >
        {compact ? (
          <>
            <span className="text-base leading-none">{current.flag}</span>
            <Globe size={14} className="text-slate-500" />
          </>
        ) : (
          <>
            <span className="text-base leading-none">{current.flag}</span>
            <span>{current.label}</span>
          </>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-40 rounded-lg border border-slate-200 bg-white shadow-lg z-50 overflow-hidden">
          {LANGS.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => handleChange(lang.code)}
              className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2 ${
                lang.code === current.code ? "font-bold text-[#1B365D] bg-slate-50" : "text-slate-700"
              }`}
            >
              <span className="text-base leading-none">{lang.flag}</span>
              <span>{lang.label}</span>
              {lang.code === current.code && (
                <span className="ml-auto text-[10px] text-emerald-600 font-bold">✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
