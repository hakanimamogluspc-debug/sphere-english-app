import { ReactNode } from "react";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { colors, fonts } from "./tokens";

/**
 * Sticky mobil modül header — sol: geri, orta: başlık, sağ: aksiyon slot.
 * Tüm mobil modüllerde tutarlı üst çerçeve.
 */

interface Props {
  title: string;
  subtitle?: string;
  backTo?: string;      // Belirtilmezse history.back veya /m/pratik
  rightAction?: ReactNode;
  transparent?: boolean; // Full-bleed sayfalarda beyaz zemini kaldır
}

export function ModuleHeader({ title, subtitle, backTo, rightAction, transparent }: Props) {
  const [, setLocation] = useLocation();

  const handleBack = () => {
    if (backTo) {
      setLocation(backTo);
      return;
    }
    if (window.history.length > 1) {
      const startPath = window.location.pathname;
      window.history.back();
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
    <header style={{
      position: "sticky",
      top: 0,
      zIndex: 50,
      background: transparent ? "transparent" : colors.white,
      borderBottom: transparent ? "none" : `1px solid ${colors.navy50}`,
      padding: "12px 16px",
      display: "flex",
      alignItems: "center",
      gap: 12,
      minHeight: 56,
    }}>
      <button
        onClick={handleBack}
        aria-label="Geri"
        style={{
          width: 40, height: 40, borderRadius: 20,
          background: colors.navy50, border: "none",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", flexShrink: 0, padding: 0,
        }}
      >
        <ArrowLeft size={18} strokeWidth={2.5} color={colors.navy} />
      </button>

      <div style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
        <div style={{
          fontFamily: fonts.heading, fontWeight: 800, fontSize: 15,
          color: colors.navy, letterSpacing: "-0.01em",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>{title}</div>
        {subtitle && (
          <div style={{
            fontSize: 11, color: colors.neutral, marginTop: 2,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>{subtitle}</div>
        )}
      </div>

      <div style={{
        minWidth: 40, height: 40, display: "flex",
        alignItems: "center", justifyContent: "flex-end", flexShrink: 0,
      }}>
        {rightAction}
      </div>
    </header>
  );
}
