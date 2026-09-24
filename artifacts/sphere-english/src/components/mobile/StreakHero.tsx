import { colors, radius, fonts } from "./tokens";

/**
 * Kazanım sayfasındaki büyük streak paneli.
 * Navy zemin + turkuaz küre formu (marka öğesi).
 */

interface Props {
  days: number;
  subtitle?: string;
}

export function StreakHero({ days, subtitle }: Props) {
  return (
    <div style={{
      background: colors.navy,
      borderRadius: radius.panel,
      padding: "32px 24px",
      textAlign: "center",
      color: colors.white,
      marginBottom: 24,
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Turkuaz küre — marka öğesi */}
      <div style={{
        position: "absolute", left: -60, bottom: -60,
        width: 180, height: 180,
        background: colors.turq, borderRadius: "50%",
        opacity: 0.10,
      }} />

      <div style={{
        fontFamily: fonts.heading, fontWeight: 900, fontSize: 80,
        lineHeight: 1, letterSpacing: "-0.04em",
        color: colors.white, position: "relative",
      }}>{days}</div>

      <div style={{
        fontFamily: fonts.heading, fontWeight: 700, fontSize: 12,
        color: colors.turqLight, textTransform: "uppercase", letterSpacing: "0.06em",
        marginTop: 8, position: "relative",
      }}>Gün aralıksız</div>

      {subtitle && (
        <div style={{
          fontFamily: fonts.body, fontWeight: 500, fontSize: 13,
          color: colors.navy100, marginTop: 12, position: "relative",
        }}>{subtitle}</div>
      )}
    </div>
  );
}
