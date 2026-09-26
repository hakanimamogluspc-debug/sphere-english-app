import { ReactNode } from "react";
import { colors, radius, fonts } from "./tokens";
import { Button } from "./Button";

/**
 * Ana sayfadaki "Bugün için odak" büyük Navy kart.
 * Turkuaz küre formu (marka öğesi) sağ üstte.
 */

interface MetaItem {
  label: string;
  value: string;
}

interface Props {
  eyebrow?: string;
  title: string;
  description?: string;
  meta?: MetaItem[];
  ctaText: string;
  onCta: () => void;
  ctaIcon?: ReactNode;
}

export function FocusCard({
  eyebrow = "Bugün için odak",
  title, description, meta = [], ctaText, onCta, ctaIcon,
}: Props) {
  return (
    <div style={{
      background: colors.brand,
      borderRadius: radius.panel,
      padding: "32px 24px",
      color: colors.onBrand,
      marginBottom: 24,
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Turkuaz küre — marka öğesi */}
      <div style={{
        position: "absolute", right: -80, top: -80,
        width: 200, height: 200,
        background: colors.turq, borderRadius: "50%",
        opacity: 0.14,
      }} />

      <div style={{
        fontFamily: fonts.heading, fontWeight: 700, fontSize: 11,
        color: colors.turqLight, textTransform: "uppercase", letterSpacing: "0.06em",
        marginBottom: 16, display: "flex", alignItems: "center", gap: 8,
        position: "relative",
      }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: colors.turq }} />
        {eyebrow}
      </div>

      <div style={{
        fontFamily: fonts.heading, fontWeight: 800, fontSize: 22,
        lineHeight: 1.2, letterSpacing: "-0.02em",
        marginBottom: 8, color: colors.onBrand, position: "relative",
      }}>{title}</div>

      {description && (
        <div style={{
          fontSize: 14, color: colors.navy100, lineHeight: 1.5, marginBottom: 24,
          position: "relative",
        }}>{description}</div>
      )}

      {meta.length > 0 && (
        <div style={{
          display: "flex", gap: 24, paddingBottom: 20,
          borderBottom: "1px solid rgba(197, 211, 237, 0.15)",
          marginBottom: 20, position: "relative",
        }}>
          {meta.map((m, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{
                fontFamily: fonts.heading, fontWeight: 600, fontSize: 10,
                color: colors.navy200, textTransform: "uppercase", letterSpacing: "0.06em",
              }}>{m.label}</span>
              <span style={{
                fontFamily: fonts.heading, fontWeight: 700, fontSize: 14,
                color: colors.onBrand,
              }}>{m.value}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ position: "relative" }}>
        <Button variant="secondary" fullWidth onClick={onCta} iconRight={ctaIcon}>
          {ctaText}
        </Button>
      </div>
    </div>
  );
}
