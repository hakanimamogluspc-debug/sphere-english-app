import { Mic, Square } from "lucide-react";
import { colors, fonts } from "./tokens";

/**
 * Büyük yuvarlak mikrofon butonu — kayıt ekranlarının merkezinde.
 * Aktif kayıtta ses seviyesine göre pulse yapar.
 * Sphere marka: Navy dolgu + turkuaz halo.
 */

interface Props {
  recording: boolean;
  level?: number;     // 0-1
  duration?: number;  // saniye
  disabled?: boolean;
  onStart: () => void;
  onStop: () => void;
  size?: number;      // varsayılan 96
}

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function MicButton({
  recording, level = 0, duration = 0,
  disabled, onStart, onStop, size = 96,
}: Props) {
  const haloScale = 1 + Math.min(level * 1.5, 0.6);

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center", gap: 12,
    }}>
      <div style={{
        position: "relative",
        width: size, height: size,
      }}>
        {/* Level halo — kayıt aktifken */}
        {recording && (
          <>
            <div style={{
              position: "absolute", inset: 0, borderRadius: "50%",
              background: colors.turq, opacity: 0.16,
              transform: `scale(${haloScale})`,
              transition: "transform 0.08s ease-out",
            }} />
            <div style={{
              position: "absolute", inset: 0, borderRadius: "50%",
              border: `2px solid ${colors.turq}`, opacity: 0.35,
              animation: "mic-ring 1.6s ease-in-out infinite",
            }} />
            <style>{`
              @keyframes mic-ring {
                0%, 100% { transform: scale(1); opacity: 0.35; }
                50% { transform: scale(1.25); opacity: 0.1; }
              }
            `}</style>
          </>
        )}

        <button
          onClick={recording ? onStop : onStart}
          disabled={disabled}
          aria-label={recording ? "Kaydı durdur" : "Kayda başla"}
          style={{
            position: "relative",
            width: "100%", height: "100%",
            borderRadius: "50%",
            background: recording ? colors.error : colors.navy,
            border: "none",
            color: colors.white,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.5 : 1,
            boxShadow: recording
              ? `0 8px 32px ${colors.error}55`
              : `0 8px 32px ${colors.navy}55`,
            transition: "background 0.2s ease, box-shadow 0.2s ease",
          }}
        >
          {recording
            ? <Square size={28} fill={colors.white} />
            : <Mic size={32} strokeWidth={2} />}
        </button>
      </div>

      <div style={{
        fontFamily: fonts.heading, fontWeight: 700, fontSize: 13,
        color: recording ? colors.error : colors.neutral,
        textTransform: "uppercase", letterSpacing: "0.06em",
        minHeight: 16,
      }}>
        {recording ? `Kayıt · ${fmtTime(duration)}` : "Konuşmaya başla"}
      </div>
    </div>
  );
}
