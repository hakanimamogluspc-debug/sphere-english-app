import { useAuth } from "@/hooks/use-auth";
import { useRef, useState, useEffect, useCallback } from "react";
import { RefreshCw, Gamepad2 } from "lucide-react";

export default function VocabGame() {
  const { user } = useAuth();
  const [lockedSrc, setLockedSrc] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const initializedRef = useRef(false);

  const buildSrc = useCallback((u: typeof user) => {
    const displayName = [u?.firstName, u?.lastName].filter(Boolean).join(" ") || u?.email || "";
    return `/vocab-game/${displayName ? `?username=${encodeURIComponent(displayName)}` : ""}`;
  }, []);

  useEffect(() => {
    if (user && !initializedRef.current) {
      initializedRef.current = true;
      setLockedSrc(buildSrc(user));
    }
  }, [user, buildSrc]);

  const handleRetry = () => {
    setLoadError(false);
    setRetryKey(k => k + 1);
    // Yeniden başlatmada src'yi de tazele
    if (user) setLockedSrc(buildSrc(user));
  };

  const src = lockedSrc ?? (user === null ? "/vocab-game/" : null);

  if (!src) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Gamepad2 className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground text-sm text-center max-w-xs">
          Kelime Oyunu şu an yüklenemiyor. Lütfen birkaç saniye bekleyip tekrar deneyin.
        </p>
        <button
          onClick={handleRetry}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
        >
          <RefreshCw className="h-4 w-4" />
          Tekrar Dene
        </button>
      </div>
    );
  }

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 -mt-8 -mb-8" style={{ height: "calc(100vh - 4rem)" }}>
      <iframe
        key={retryKey}
        src={src}
        title="Kelime Oyunu"
        className="w-full h-full border-0 bg-white"
        allow="autoplay"
        // sandbox: iframe'in ana sayfayı yönlendirmesini engeller
        // allow-same-origin: localStorage erişimi için gerekli
        // allow-scripts + allow-forms: oyun işlevselliği için
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
        onError={() => setLoadError(true)}
      />
    </div>
  );
}
