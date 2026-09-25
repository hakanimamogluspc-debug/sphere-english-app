import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { colors } from "./tokens";

/**
 * Sadece mobil viewport'ta ve /m/* olmayan sayfalarda görünen
 * floating geri butonu. Öğrenciler modüle girip dönemediklerinde
 * /m/pratik'e döner.
 *
 * Auth veya public sayfalar için gizlenir.
 */

const HIDE_PATHS = [
  "/login", "/register", "/sifremi-unuttum", "/sifre-belirle",
  "/onboarding", "/placement-test", "/logout",
];

export function MobileBackFab() {
  const [location, setLocation] = useLocation();
  const isMobile = useIsMobile();

  // Mobil değilse görünmesin
  if (!isMobile) return null;

  // Mobil sayfalar zaten tabbar'a sahip
  if (location.startsWith("/m/")) return null;

  // Public/auth sayfalar
  if (HIDE_PATHS.some((p) => location.startsWith(p))) return null;

  // Kök / dashboard'da görünmesin (zaten mobilde /m/anasayfa'ya yönlenir)
  if (location === "/" || location === "/dashboard") return null;

  const goBack = () => {
    // Tarayıcı history varsa geri git; yoksa mobil pratik'e
    if (window.history.length > 1) {
      window.history.back();
      // Emniyet: 300ms sonra hala aynı yerdeysek /m/pratik'e
      const startPath = window.location.pathname;
      setTimeout(() => {
        if (window.location.pathname === startPath) {
          setLocation("/m/pratik");
        }
      }, 350);
    } else {
      setLocation("/m/pratik");
    }
  };

  return (
    <button
      onClick={goBack}
      aria-label="Geri"
      style={{
        position: "fixed",
        top: 12,
        left: 12,
        width: 44,
        height: 44,
        borderRadius: 22,
        background: colors.white,
        border: `1px solid ${colors.navy100}`,
        boxShadow: "0 4px 16px rgba(30, 58, 110, 0.16)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        zIndex: 9999,
        padding: 0,
        transition: "transform 0.15s ease",
      }}
      onTouchStart={(e) => { (e.currentTarget.style.transform = "scale(0.92)"); }}
      onTouchEnd={(e) => { (e.currentTarget.style.transform = "scale(1)"); }}
    >
      <ArrowLeft size={20} strokeWidth={2.5} color={colors.navy} />
    </button>
  );
}
