import { colors, radius, fonts } from "./tokens";

/**
 * Ana sayfa üstündeki 3'lü stat bar: Seri · Seviye · Freeze.
 */

interface Stat {
  label: string;
  value: string | number;
  unit?: string;
}

interface Props {
  stats: Stat[];
}

export function StatRow({ stats }: Props) {
  return (
    <div style={{
      background: colors.navy50,
      borderRadius: radius.card,
      padding: "16px 20px",
      display: "flex",
      justifyContent: "space-between",
      marginBottom: 24,
    }}>
      {stats.map((s, i) => (
        <div key={i} style={{
          display: "flex", flexDirection: "column", gap: 4, flex: 1,
          borderLeft: i === 0 ? "none" : `1px solid ${colors.navy100}`,
          paddingLeft: i === 0 ? 0 : 20,
          marginLeft: i === 0 ? 0 : 20,
        }}>
          <div style={{
            fontFamily: fonts.heading, fontWeight: 600, fontSize: 11,
            color: colors.neutral, textTransform: "uppercase", letterSpacing: "0.06em",
          }}>{s.label}</div>
          <div style={{
            fontFamily: fonts.heading, fontWeight: 800, fontSize: 22,
            lineHeight: 1, letterSpacing: "-0.02em", color: colors.navy,
            display: "flex", alignItems: "baseline", gap: 4,
          }}>
            {s.value}
            {s.unit && (
              <small style={{
                fontFamily: fonts.body, fontWeight: 500, fontSize: 12,
                color: colors.neutral,
              }}>{s.unit}</small>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
