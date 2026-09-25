import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  ModuleHeader, MobileModuleIntro, ErrorState, LoadingState,
  colors, fonts,
} from "@/components/mobile";
import { RefreshCw } from "lucide-react";

/**
 * /m/pratik/kelime-oyunu — Mobil Kelime Oyunu
 * Iframe barındırır — /vocab-game/ altındaki HTML oyunu.
 */

export default function MobileVocabGame() {
  const { user } = useAuth();
  const [lockedSrc, setLockedSrc] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const initRef = useRef(false);

  const buildSrc = useCallback((u: typeof user) => {
    const displayName = [u?.firstName, u?.lastName].filter(Boolean).join(" ") || u?.email || "";
    const level = u?.currentLevel;
    const params = new URLSearchParams();
    if (displayName) params.set("username", displayName);
    if (level) params.set("level", level);
    const qs = params.toString();
    return `/vocab-game/${qs ? `?${qs}` : ""}`;
  }, []);

  useEffect(() => {
    if (user && !initRef.current) {
      initRef.current = true;
      setLockedSrc(buildSrc(user));
    }
  }, [user, buildSrc]);

  const handleRetry = () => {
    setLoadError(false);
    setLoaded(false);
    setRetryKey((k) => k + 1);
    if (user) setLockedSrc(buildSrc(user));
  };

  const src = lockedSrc ?? (user === null ? "/vocab-game/" : null);

  return (
    <div style={{
      minHeight: "100vh", background: colors.white,
      display: "flex", flexDirection: "column",
    }}>
      <ModuleHeader
        title="Kelime Oyunu"
        subtitle="İngilizce kelime pratiği"
        rightAction={
          <button
            onClick={handleRetry}
            aria-label="Oyunu yenile"
            style={{
              background: colors.navy50, border: "none",
              width: 36, height: 36, borderRadius: 18,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: colors.navy,
            }}
          >
            <RefreshCw size={16} strokeWidth={2.5} />
          </button>
        }
      />

      <MobileModuleIntro moduleKey="vocab_game" />

      <div style={{
        flex: 1, position: "relative",
        background: colors.white,
      }}>
        {!src && (
          <div style={{ padding: 40 }}>
            <LoadingState compact messages={["Kullanıcı bilgisi yükleniyor…"]} />
          </div>
        )}

        {src && loadError && (
          <div style={{ padding: 20 }}>
            <ErrorState
              title="Oyun yüklenemedi"
              message="Kelime oyunu şu an açılamıyor. Birkaç saniye bekleyip tekrar dener misin?"
              onRetry={handleRetry}
            />
          </div>
        )}

        {src && !loadError && !loaded && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            pointerEvents: "none",
          }}>
            <LoadingState messages={[
              "Oyun yükleniyor…",
              "Kelime havuzu hazırlanıyor…",
              "Neredeyse hazır…",
            ]} />
          </div>
        )}

        {src && !loadError && (
          <iframe
            key={retryKey}
            src={src}
            title="Kelime Oyunu"
            onLoad={() => setLoaded(true)}
            onError={() => setLoadError(true)}
            allow="autoplay"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
            style={{
              width: "100%", height: "100%",
              border: 0, background: colors.white,
              display: "block",
              minHeight: "calc(100vh - 56px)",
              opacity: loaded ? 1 : 0,
              transition: "opacity 0.24s ease-out",
            }}
          />
        )}
      </div>
    </div>
  );
}
