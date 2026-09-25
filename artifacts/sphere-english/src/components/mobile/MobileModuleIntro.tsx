import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HelpCircle, X, ChevronRight, Play, Users, Clock, Target, Sparkles } from "lucide-react";
import { colors, fonts, radius } from "./tokens";

/**
 * Mobil modül tanıtım wizard'ı.
 * Desktop'taki ModuleIntro'nun mobile karşılığı — aynı i18n key'lerini kullanır
 * (locales/tr/modules.json), aynı localStorage anahtarı ile senkron:
 * user web'de gördüyse mobilde tekrar çıkmaz.
 *
 * 4 slayt:
 *   1. Ne işe yarar? (name + tagline + value_prop)
 *   2. Nasıl kullanılır? (how_to 3 adım)
 *   3. Kimin için + süre (target_level + duration)
 *   4. İlk aksiyon + Başla (first_action)
 *
 * Kullanım:
 *   <MobileModuleIntro moduleKey="pronunciation_coach" />
 */

interface Props {
  moduleKey: string;
  autoOpen?: boolean;
  onStart?: () => void;
}

const STORAGE_PREFIX = "module_intro_seen_";

function hasSeen(key: string): boolean {
  try { return localStorage.getItem(STORAGE_PREFIX + key) === "1"; } catch { return false; }
}
function markSeen(key: string): void {
  try { localStorage.setItem(STORAGE_PREFIX + key, "1"); } catch {}
}

export function MobileModuleIntro({ moduleKey, autoOpen = true, onStart }: Props) {
  const { t } = useTranslation(["modules", "common"]);
  const [open, setOpen] = useState(false);
  const [slideIdx, setSlideIdx] = useState(0);

  useEffect(() => {
    if (!autoOpen) return;
    if (!hasSeen(moduleKey)) setOpen(true);
  }, [moduleKey, autoOpen]);

  const close = useCallback(() => {
    setOpen(false);
    setSlideIdx(0);
  }, []);

  const start = useCallback(() => {
    markSeen(moduleKey);
    setOpen(false);
    setSlideIdx(0);
    onStart?.();
  }, [moduleKey, onStart]);

  const reopen = useCallback(() => {
    setSlideIdx(0);
    setOpen(true);
  }, []);

  // i18n değerleri (locales/tr/modules.json)
  const name = t(`${moduleKey}.name`, { defaultValue: moduleKey });
  const tagline = t(`${moduleKey}.tagline`, { defaultValue: "" });
  const valueProp = t(`${moduleKey}.value_prop`, { defaultValue: "" });
  const howToRaw = t(`${moduleKey}.how_to`, { returnObjects: true, defaultValue: [] });
  const howTo: string[] = Array.isArray(howToRaw) ? (howToRaw as string[]) : [];
  const targetLevel = t(`${moduleKey}.target_level`, { defaultValue: "" });
  const firstAction = t(`${moduleKey}.first_action`, { defaultValue: "" });
  const duration = t(`${moduleKey}.duration`, { defaultValue: "" });

  const slides = [
    { icon: Sparkles, title: name, subtitle: tagline, body: valueProp },
    { icon: Play, title: t("intro.how_to_use", { defaultValue: "Nasıl kullanılır?" }), subtitle: name, list: howTo },
    { icon: Users, title: t("intro.who_for", { defaultValue: "Kimin için?" }), subtitle: targetLevel, body: t("intro.duration", { duration, defaultValue: `Süre: ${duration}` }), iconRight: Clock },
    { icon: Target, title: t("intro.first_action", { defaultValue: "İlk adım" }), subtitle: firstAction },
  ];

  const currentSlide = slides[slideIdx];
  const isLast = slideIdx === slides.length - 1;
  const Icon = currentSlide.icon;

  return (
    <>
      {/* Sağ üst köşede küçük "?" — modül header'ının sağında konumlanır.
          Position:fixed olduğu için ModuleHeader'ın sağ actiondan bağımsız. */}
      <button
        type="button"
        onClick={reopen}
        aria-label="Tanıtımı tekrar aç"
        style={{
          position: "fixed",
          top: 66, // header altı — çakışmasın
          right: 12,
          width: 36, height: 36, borderRadius: 18,
          background: colors.white,
          border: `1px solid ${colors.navy100}`,
          boxShadow: "0 4px 12px rgba(30, 58, 110, 0.12)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer",
          zIndex: 40,
          padding: 0,
        }}
      >
        <HelpCircle size={16} color={colors.navy} strokeWidth={2.5} />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            onClick={close}
            style={{
              position: "fixed", inset: 0,
              background: "rgba(10, 20, 40, 0.68)",
              zIndex: 200,
              animation: "mmi-fade 0.24s ease-out",
            }}
          />

          {/* Full-screen mobil kart */}
          <div style={{
            position: "fixed",
            left: 12, right: 12, top: "50%",
            transform: "translateY(-50%)",
            zIndex: 201,
            background: colors.white,
            borderRadius: radius.panel,
            overflow: "hidden",
            boxShadow: "0 24px 48px rgba(10, 20, 40, 0.32)",
            maxHeight: "88vh",
            display: "flex", flexDirection: "column",
            animation: "mmi-pop 0.32s cubic-bezier(0.16, 1, 0.3, 1)",
          }}>
            <style>{`
              @keyframes mmi-fade { from { opacity: 0; } to { opacity: 1; } }
              @keyframes mmi-pop {
                from { opacity: 0; transform: translateY(-46%) scale(0.96); }
                to { opacity: 1; transform: translateY(-50%) scale(1); }
              }
            `}</style>

            {/* Header: slayt sayacı + kapat */}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "14px 20px",
              borderBottom: `1px solid ${colors.navy50}`,
            }}>
              <div style={{
                fontFamily: fonts.heading, fontWeight: 800, fontSize: 11,
                color: colors.neutral,
                textTransform: "uppercase", letterSpacing: "0.08em",
              }}>
                <span style={{ color: colors.navy }}>{slideIdx + 1}</span>
                {" / "}
                {slides.length}
              </div>
              <button
                onClick={close}
                aria-label="Kapat"
                style={{
                  background: "transparent", border: "none", padding: 4, cursor: "pointer",
                  color: colors.neutral,
                }}
              >
                <X size={20} strokeWidth={2.5} />
              </button>
            </div>

            {/* Progress bar */}
            <div style={{ height: 3, background: colors.navy50 }}>
              <div style={{
                height: "100%", background: colors.turq,
                width: `${((slideIdx + 1) / slides.length) * 100}%`,
                transition: "width 0.24s ease",
              }} />
            </div>

            {/* İçerik (kaydırılabilir) */}
            <div style={{
              flex: 1, overflowY: "auto",
              padding: "28px 24px 20px",
            }}>
              {/* İkon + başlık */}
              <div style={{
                width: 56, height: 56, borderRadius: 16,
                background: colors.navy,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: colors.turq,
                marginBottom: 20,
                boxShadow: `0 8px 24px ${colors.navy}22`,
              }}>
                <Icon size={26} strokeWidth={2} />
              </div>

              <div style={{
                fontFamily: fonts.heading, fontWeight: 900, fontSize: 22,
                color: colors.navy, letterSpacing: "-0.02em",
                lineHeight: 1.2, marginBottom: 6,
              }}>{currentSlide.title}</div>

              {currentSlide.subtitle && (
                <div style={{
                  fontFamily: fonts.heading, fontWeight: 700, fontSize: 11,
                  color: colors.turqDeep,
                  textTransform: "uppercase", letterSpacing: "0.06em",
                  marginBottom: 16,
                }}>{currentSlide.subtitle}</div>
              )}

              {"body" in currentSlide && currentSlide.body && (
                <div style={{
                  fontFamily: fonts.body, fontSize: 14,
                  color: colors.navy400, lineHeight: 1.6,
                  marginTop: 4,
                }}>{currentSlide.body}</div>
              )}

              {"list" in currentSlide && Array.isArray(currentSlide.list) && currentSlide.list.length > 0 && (
                <div style={{ marginTop: 8, display: "grid", gap: 12 }}>
                  {(currentSlide.list as string[]).map((step, i) => (
                    <div key={i} style={{
                      display: "flex", gap: 12, alignItems: "flex-start",
                    }}>
                      <div style={{
                        minWidth: 26, height: 26, borderRadius: 13,
                        background: colors.turq, color: colors.navy,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontFamily: fonts.heading, fontWeight: 800, fontSize: 12,
                        flexShrink: 0,
                      }}>{i + 1}</div>
                      <div style={{
                        flex: 1, fontFamily: fonts.body, fontSize: 14,
                        color: colors.navy, lineHeight: 1.5, paddingTop: 3,
                      }}>{step}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer aksiyon */}
            <div style={{
              padding: "14px 20px 20px",
              borderTop: `1px solid ${colors.navy50}`,
              background: colors.white,
              display: "flex", gap: 8,
            }}>
              <button
                onClick={close}
                style={{
                  padding: "12px 16px", borderRadius: 100,
                  background: colors.navy50, color: colors.navy400, border: "none",
                  fontFamily: fonts.heading, fontWeight: 700, fontSize: 13,
                  cursor: "pointer",
                }}
              >Atla</button>
              {isLast ? (
                <button
                  onClick={start}
                  style={{
                    flex: 1, padding: "12px 20px", borderRadius: 100,
                    background: colors.turq, color: colors.navy, border: "none",
                    fontFamily: fonts.heading, fontWeight: 800, fontSize: 14,
                    cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    letterSpacing: "-0.01em",
                  }}
                >
                  Hadi başlayalım
                  <ChevronRight size={16} strokeWidth={2.5} />
                </button>
              ) : (
                <button
                  onClick={() => setSlideIdx((v) => Math.min(v + 1, slides.length - 1))}
                  style={{
                    flex: 1, padding: "12px 20px", borderRadius: 100,
                    background: colors.navy, color: colors.white, border: "none",
                    fontFamily: fonts.heading, fontWeight: 800, fontSize: 14,
                    cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  }}
                >
                  İleri
                  <ChevronRight size={16} strokeWidth={2.5} />
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
