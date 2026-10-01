import { useState, useRef, ReactNode, TouchEvent, MouseEvent, useEffect } from "react";
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

type Phase = "idle" | "exit-left" | "exit-right" | "enter-left" | "enter-right";

export function SwipeableCard({
  children, onSwipeLeft, onSwipeRight,
  disabled = false, threshold = 80,
}: Props) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const startX = useRef<number>(0);
  const screenWidth = typeof window !== "undefined" ? window.innerWidth : 400;

  const handleStart = (clientX: number) => {
    if (disabled || phase !== "idle") return;
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
      // Swipe kabul edildi — kartı dışarı uçur, callback'i çağır, yeni kart karşı taraftan girer
      if (offset < 0 && onSwipeLeft) {
        setPhase("exit-left");
        setOffset(-screenWidth * 1.2);
        setTimeout(() => {
          onSwipeLeft();                 // içerik değişir (yeni kart)
          setPhase("enter-right");       // yeni kart sağdan girer için başlangıç konumu set
          setOffset(screenWidth * 1.2);
          // bir sonraki frame'de 0'a doğru animasyon
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              setPhase("idle");
              setOffset(0);
            });
          });
        }, 220);
        return;
      }
      if (offset > 0 && onSwipeRight) {
        setPhase("exit-right");
        setOffset(screenWidth * 1.2);
        setTimeout(() => {
          onSwipeRight();                // içerik değişir (önceki kart)
          setPhase("enter-left");        // yeni kart soldan girer
          setOffset(-screenWidth * 1.2);
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              setPhase("idle");
              setOffset(0);
            });
          });
        }, 220);
        return;
      }
    }
    // Threshold altı → geri dön
    setOffset(0);
  };

  // Kaydırma sırasında hafif eğim + opaklık
  const rotation = offset / 60;
  const opacity = dragging ? 1 - Math.min(Math.abs(offset) / (threshold * 4), 0.15) : 1;

  // Enter fazında başlangıç pozisyonu için transition yok (snap)
  // Idle ve diğer fazlar için transition var
  const isSnap = phase === "enter-left" || phase === "enter-right";
  const transition = dragging || isSnap
    ? "none"
    : "transform 0.26s cubic-bezier(0.22, 0.61, 0.36, 1), opacity 0.26s ease-out";

  return (
    <div style={{ overflow: "hidden", position: "relative", width: "100%" }}>
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
          transition,
          opacity,
          touchAction: "pan-y",
          cursor: disabled ? "default" : "grab",
          position: "relative",
          zIndex: dragging ? 10 : 1,
          willChange: "transform",
        }}
      >
        {children}
      </div>
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
