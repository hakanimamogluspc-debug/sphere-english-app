import { Mic, X } from "lucide-react";
import { colors, fonts } from "./tokens";

/**
 * Mikrofon izni sistemden reddedildiğinde gösterilen açıklayıcı sheet.
 * Kullanıcıya nereden açacağını anlatır — çünkü Chrome/Android
 * ikinci defa izin istemez, ayarlardan açması gerek.
 */

interface Props {
  visible: boolean;
  onClose: () => void;
  onRetry?: () => void;
}

export function MicPermissionSheet({ visible, onClose, onRetry }: Props) {
  if (!visible) return null;
  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, background: "rgba(10, 20, 40, 0.5)",
          zIndex: 100, animation: "mps-fade 0.2s ease-out",
        }}
      />
      <div style={{
        position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 101,
        background: colors.white, borderRadius: "24px 24px 0 0",
        padding: "24px 20px 32px",
        boxShadow: "0 -8px 32px rgba(30, 58, 110, 0.16)",
        animation: "mps-up 0.28s cubic-bezier(0.16, 1, 0.3, 1)",
      }}>
        <style>{`
          @keyframes mps-fade { from { opacity: 0; } to { opacity: 1; } }
          @keyframes mps-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
        `}</style>

        <div style={{
          width: 36, height: 4, background: colors.navy100, borderRadius: 100,
          margin: "0 auto 20px",
        }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 24,
            background: colors.navy50,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Mic size={22} color={colors.navy} strokeWidth={2} />
          </div>
          <button
            onClick={onClose}
            aria-label="Kapat"
            style={{
              background: "transparent", border: "none", padding: 4, cursor: "pointer",
              color: colors.neutral,
            }}
          >
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>

        <div style={{
          fontFamily: fonts.heading, fontWeight: 800, fontSize: 20,
          color: colors.navy, letterSpacing: "-0.02em",
          marginBottom: 8, lineHeight: 1.2,
        }}>
          Mikrofon izni gerekli
        </div>
        <div style={{
          fontSize: 14, color: colors.neutral, lineHeight: 1.5,
          marginBottom: 20,
        }}>
          Konuşma pratiği için mikrofonuna erişmemiz gerekiyor.
          Cihaz ayarlarından izni açtıktan sonra tekrar dene.
        </div>

        <div style={{
          background: colors.navy50, borderRadius: 12,
          padding: "12px 16px", marginBottom: 20,
          fontSize: 13, color: colors.navy, lineHeight: 1.5,
        }}>
          <strong style={{ fontFamily: fonts.heading, fontWeight: 700 }}>Nasıl açılır?</strong><br/>
          Android: Ayarlar → Uygulamalar → Sphere English → İzinler → Mikrofon
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: "14px 20px", borderRadius: 100,
              background: colors.navy50, color: colors.navy, border: "none",
              fontFamily: fonts.heading, fontWeight: 700, fontSize: 14,
              cursor: "pointer",
            }}
          >Kapat</button>
          {onRetry && (
            <button
              onClick={() => { onRetry(); onClose(); }}
              style={{
                flex: 1, padding: "14px 20px", borderRadius: 100,
                background: colors.brand, color: colors.white, border: "none",
                fontFamily: fonts.heading, fontWeight: 800, fontSize: 14,
                cursor: "pointer",
              }}
            >Tekrar dene</button>
          )}
        </div>
      </div>
    </>
  );
}
