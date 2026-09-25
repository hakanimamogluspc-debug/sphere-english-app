import { colors, radius } from "./tokens";

/**
 * Loading skeleton — spinner yerine, native mobil hissi.
 * Shimmer animasyonlu placeholder.
 */

interface Props {
  width?: string | number;
  height?: string | number;
  radius?: number;
  style?: React.CSSProperties;
}

export function Skeleton({ width = "100%", height = 16, radius: r = 8, style }: Props) {
  return (
    <div
      style={{
        width, height, borderRadius: r,
        background: `linear-gradient(90deg, ${colors.navy50} 25%, ${colors.navy100} 50%, ${colors.navy50} 75%)`,
        backgroundSize: "200% 100%",
        animation: "shimmer 1.4s ease-in-out infinite",
        ...style,
      }}
    >
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </div>
  );
}

/**
 * Ana sayfada iş kartı yerine gösterilecek skeleton.
 */
export function BusinessCardSkeleton() {
  return (
    <div style={{
      background: colors.white,
      borderRadius: radius.panel,
      padding: "28px 24px",
      border: `1px solid ${colors.navy100}`,
      marginBottom: 12,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24 }}>
        <Skeleton width={100} height={24} radius={8} />
        <Skeleton width={36} height={36} radius={18} />
      </div>
      <Skeleton width="90%" height={28} radius={6} style={{ marginBottom: 12 }} />
      <Skeleton width="60%" height={28} radius={6} style={{ marginBottom: 24 }} />
      <Skeleton width="100%" height={12} radius={4} style={{ marginBottom: 8 }} />
      <Skeleton width="80%" height={12} radius={4} style={{ marginBottom: 20 }} />
      <Skeleton width="100%" height={80} radius={16} />
    </div>
  );
}

/**
 * Stat row skeleton.
 */
export function StatRowSkeleton() {
  return (
    <div style={{
      background: colors.navy50, borderRadius: 16, padding: "16px 20px",
      display: "flex", justifyContent: "space-between", marginBottom: 24,
    }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{
          flex: 1,
          borderLeft: i === 0 ? "none" : `1px solid ${colors.navy100}`,
          paddingLeft: i === 0 ? 0 : 20,
          marginLeft: i === 0 ? 0 : 20,
        }}>
          <Skeleton width={40} height={11} radius={4} style={{ marginBottom: 6 }} />
          <Skeleton width={60} height={22} radius={6} />
        </div>
      ))}
    </div>
  );
}

/**
 * Modül kart skeleton — Pratik sayfası için.
 */
export function ModuleCardSkeleton() {
  return (
    <div style={{
      padding: 14, background: colors.white,
      border: `1px solid ${colors.navy50}`,
      borderRadius: 16,
    }}>
      <Skeleton width={36} height={36} radius={10} style={{ marginBottom: 10 }} />
      <Skeleton width="80%" height={13} radius={4} style={{ marginBottom: 6 }} />
      <Skeleton width="60%" height={10} radius={4} />
    </div>
  );
}
