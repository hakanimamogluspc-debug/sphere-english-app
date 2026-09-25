import { useState, useRef, ReactNode, TouchEvent, MouseEvent } from "react";
import { colors } from "./tokens";

/**
 * Native mobil swipe gesture wrapper.
 * Kartı sola/sağa kaydırınca callback tetiklenir.
 * Kısmi drag'da geri döner, threshold aşılınca aksiyon.
 */

interface Props {
  children: ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  disabled?: boolean;
  threshold?: number; // px — bu değerin üstünde swipe kabul
}

export function SwipeableCard({
  children, onSwipeLeft, onSwipeRight,
  disabled = false, threshold = 100,
}: Props) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef<number>(0);

  const handleStart = (clientX: number) => {
    if (disabled) return;
    startX.current = clientX;
    setDragging(true);
  };

  const handleMove = (clientX: number) => {
    if (!dragging) return;
    const delta = clientX - startX.current;
    setOffset(delta);
  };

  const handleEnd = () => {
    if (!dragging) return;
    setDragging(false);

    if (Math.abs(offset) >= threshold) {
      // Swipe kabul edildi
      if (offset < 0 && onSwipeLeft) {
        setOffset(-window.innerWidth); // Ekrandan uçur
        setTimeout(() => {
          onSwipeLeft();
          setOffset(0);
        }, 200);
      } else if (offset > 0 && onSwipeRight) {
        setOffset(window.innerWidth);
        setTimeout(() => {
          onSwipeRight();
          setOffset(0);
        }, 200);
      } else {
        setOffset(0);
      }
    } else {
      // Threshold altında, geri dön
      setOffset(0);
    }
  };

  // Kaydırma sırasında opaklık + rotasyon
  const rotation = offset / 20; // hafif eğim
  const opacity = 1 - Math.min(Math.abs(offset) / (threshold * 3), 0.3);

  return (
    <div
      onTouchStart={(e: TouchEvent) => handleStart(e.touches[0].clientX)}
      onTouchMove={(e: TouchEvent) => handleMove(e.touches[0].clientX)}
      onTouchEnd={handleEnd}
      onMouseDown={(e: MouseEvent) => handleStart(e.clientX)}
      onMouseMove={(e: MouseEvent) => e.buttons === 1 && handleMove(e.clientX)}
      onMouseUp={handleEnd}
      onMouseLeave={handleEnd}
      style={{
        transform: `translateX(${offset}px) rotate(${rotation}deg)`,
        transition: dragging ? "none" : "transform 0.24s ease-out, opacity 0.24s ease-out",
        opacity,
        touchAction: "pan-y",
        cursor: disabled ? "default" : "grab",
        position: "relative",
        zIndex: dragging ? 10 : 1,
      }}
    >
      {children}
    </div>
  );
}

/**
 * Swipe hint göstergesi — "sola / sağa kaydır" ipucu.
 */
export function SwipeHint({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div style={{
      textAlign: "center",
      fontSize: 11,
      color: colors.neutral,
      fontWeight: 500,
      marginTop: 8,
      opacity: 0.7,
    }}>
      ← Kaydırarak geç →
    </div>
  );
}
