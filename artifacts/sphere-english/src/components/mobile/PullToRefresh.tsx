import { useState, useRef, ReactNode, TouchEvent } from "react";
import { colors } from "./tokens";
import { RefreshCw } from "lucide-react";

/**
 * Pull-to-refresh wrapper — native mobil hissi.
 * Sayfayı aşağı çekince veri yenilenir.
 */

interface Props {
  children: ReactNode;
  onRefresh: () => void | Promise<void>;
  threshold?: number;
  disabled?: boolean;
}

export function PullToRefresh({ children, onRefresh, threshold = 80, disabled = false }: Props) {
  const [pullDist, setPullDist] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);

  const handleTouchStart = (e: TouchEvent) => {
    if (disabled || refreshing) return;
    // Sadece scroll top'ta pull aktif
    if (window.scrollY > 0) return;
    startY.current = e.touches[0].clientY;
    pulling.current = true;
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!pulling.current || refreshing) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta > 0) {
      // Direnç hissi — gerçek mobilde parmakla daha yavaş gelir
      setPullDist(Math.min(delta * 0.5, threshold * 1.5));
    }
  };

  const handleTouchEnd = async () => {
    if (!pulling.current) return;
    pulling.current = false;

    if (pullDist >= threshold) {
      setRefreshing(true);
      setPullDist(threshold);
      try {
        await onRefresh();
      } finally {
        setTimeout(() => {
          setRefreshing(false);
          setPullDist(0);
        }, 300);
      }
    } else {
      setPullDist(0);
    }
  };

  const iconRotation = refreshing ? "" : `rotate(${Math.min((pullDist / threshold) * 180, 180)}deg)`;
  const iconOpacity = Math.min(pullDist / (threshold * 0.6), 1);

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ position: "relative", minHeight: "100vh" }}
    >
      {/* Refresh indicator */}
      <div style={{
        position: "absolute",
        top: 0,
        left: "50%",
        transform: `translate(-50%, ${pullDist - 40}px)`,
        transition: pulling.current ? "none" : "transform 0.24s ease-out",
        opacity: iconOpacity,
        zIndex: 5,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 18,
          background: colors.white,
          border: `1px solid ${colors.navy100}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 12px rgba(30, 58, 110, 0.12)",
        }}>
          <RefreshCw
            size={16}
            color={colors.navy}
            strokeWidth={2.5}
            style={{
              transform: iconRotation,
              transition: pulling.current ? "none" : "transform 0.24s ease-out",
              animation: refreshing ? "spin 0.8s linear infinite" : undefined,
            }}
          />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>

      {/* İçerik */}
      <div style={{
        transform: `translateY(${pullDist}px)`,
        transition: pulling.current ? "none" : "transform 0.24s ease-out",
      }}>
        {children}
      </div>
    </div>
  );
}
