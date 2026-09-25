import { useEffect, useState } from "react";
import { colors, fonts } from "./tokens";

/**
 * AI cevabı beklerken gösterilen full-screen loading.
 * Rotasyon halinde mesajlar + turuncu küre animasyonu.
 *
 * Kullanım:
 *   <LoadingState messages={["Cevap hazırlanıyor…", "Ses işleniyor…"]} />
 */

interface Props {
  messages?: string[];
  /** Marka rengiyle uyumlu küre yerine sadece spinner göster */
  compact?: boolean;
  /** Alt bilgi (opsiyonel) */
  hint?: string;
}

const DEFAULT_MESSAGES = [
  "Sphere düşünüyor…",
  "Cevap hazırlanıyor…",
  "İngilizcen üzerine çalışılıyor…",
  "Neredeyse hazır…",
];

export function LoadingState({ messages = DEFAULT_MESSAGES, compact, hint }: Props) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (messages.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % messages.length), 2200);
    return () => clearInterval(t);
  }, [messages.length]);

  const currentMessage = messages[idx] ?? messages[0];

  if (compact) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        gap: 12, padding: 24,
      }}>
        <div style={{
          width: 20, height: 20, borderRadius: 10,
          border: `2px solid ${colors.navy100}`,
          borderTopColor: colors.turq,
          animation: "sphere-spin 0.8s linear infinite",
        }} />
        <style>{`
          @keyframes sphere-spin { to { transform: rotate(360deg); } }
        `}</style>
        <span style={{
          fontFamily: fonts.body, fontSize: 14, color: colors.neutral,
        }}>{currentMessage}</span>
      </div>
    );
  }

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "48px 24px", minHeight: 320,
    }}>
      {/* Küre — Navy + turkuaz vurgu */}
      <div style={{
        width: 80, height: 80, position: "relative",
        marginBottom: 32,
      }}>
        <div style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          background: `radial-gradient(circle at 30% 30%, ${colors.turq}, ${colors.navy} 70%)`,
          animation: "sphere-pulse 2.4s ease-in-out infinite",
          boxShadow: `0 8px 32px ${colors.turq}40`,
        }} />
        <div style={{
          position: "absolute", inset: -8, borderRadius: "50%",
          border: `2px solid ${colors.turq}`, opacity: 0.3,
          animation: "sphere-ring 2.4s ease-in-out infinite",
        }} />
        <style>{`
          @keyframes sphere-pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.08); }
          }
          @keyframes sphere-ring {
            0%, 100% { transform: scale(1); opacity: 0.3; }
            50% { transform: scale(1.15); opacity: 0.1; }
          }
          @keyframes message-fade {
            from { opacity: 0; transform: translateY(4px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>

      <div
        key={idx}
        style={{
          fontFamily: fonts.heading, fontWeight: 700, fontSize: 16,
          color: colors.navy, letterSpacing: "-0.01em",
          textAlign: "center", marginBottom: 8,
          animation: "message-fade 0.4s ease-out",
        }}
      >{currentMessage}</div>

      {hint && (
        <div style={{
          fontSize: 12, color: colors.neutral, textAlign: "center",
          maxWidth: 280, lineHeight: 1.5,
        }}>{hint}</div>
      )}

      {/* Progress dots */}
      <div style={{
        display: "flex", gap: 6, marginTop: 24,
      }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{
            width: 6, height: 6, borderRadius: 3,
            background: colors.navy100,
            animation: `dot-bounce 1.4s ease-in-out infinite`,
            animationDelay: `${i * 0.16}s`,
          }} />
        ))}
        <style>{`
          @keyframes dot-bounce {
            0%, 60%, 100% { background: ${colors.navy100}; transform: scale(1); }
            30% { background: ${colors.turq}; transform: scale(1.4); }
          }
        `}</style>
      </div>
    </div>
  );
}
