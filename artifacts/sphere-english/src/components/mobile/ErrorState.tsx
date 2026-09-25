import { AlertCircle, RefreshCw } from "lucide-react";
import { colors, fonts } from "./tokens";

interface Props {
  title?: string;
  message?: string;
  onRetry?: () => void;
  compact?: boolean;
}

export function ErrorState({
  title = "Bir şey ters gitti",
  message = "İnternet bağlantını kontrol edip tekrar dener misin?",
  onRetry,
  compact,
}: Props) {
  if (compact) {
    return (
      <div style={{
        padding: 16, background: `${colors.error}12`,
        borderRadius: 12, border: `1px solid ${colors.error}33`,
        display: "flex", gap: 12, alignItems: "flex-start",
      }}>
        <AlertCircle size={18} color={colors.error} strokeWidth={2.5} style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ flex: 1 }}>
          <div style={{
            fontFamily: fonts.heading, fontWeight: 700, fontSize: 13,
            color: colors.navy, marginBottom: 2,
          }}>{title}</div>
          <div style={{ fontSize: 12, color: colors.neutral, lineHeight: 1.4 }}>{message}</div>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            style={{
              background: "transparent", border: "none", padding: 6, cursor: "pointer",
              color: colors.navy,
            }}
            aria-label="Tekrar dene"
          >
            <RefreshCw size={16} strokeWidth={2.5} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "48px 24px", textAlign: "center",
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: 28,
        background: `${colors.error}15`,
        display: "flex", alignItems: "center", justifyContent: "center",
        marginBottom: 20,
      }}>
        <AlertCircle size={26} color={colors.error} strokeWidth={2} />
      </div>
      <div style={{
        fontFamily: fonts.heading, fontWeight: 800, fontSize: 18,
        color: colors.navy, marginBottom: 6, letterSpacing: "-0.01em",
      }}>{title}</div>
      <div style={{
        fontSize: 13, color: colors.neutral, lineHeight: 1.5,
        maxWidth: 280, marginBottom: 24,
      }}>{message}</div>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            background: colors.navy, color: colors.white,
            border: "none", borderRadius: 100,
            padding: "12px 24px", cursor: "pointer",
            fontFamily: fonts.heading, fontWeight: 700, fontSize: 14,
            display: "flex", alignItems: "center", gap: 8,
          }}
        >
          <RefreshCw size={16} strokeWidth={2.5} />
          Tekrar dene
        </button>
      )}
    </div>
  );
}
