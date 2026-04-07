import { useAuth } from "@/hooks/use-auth";
import { useRef, useState, useEffect } from "react";

export default function VocabGame() {
  const { user } = useAuth();
  // Lock the src once user is available — prevents iframe reload on auth refetch
  const [lockedSrc, setLockedSrc] = useState<string | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (user && !initializedRef.current) {
      initializedRef.current = true;
      const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "";
      const src = `/vocab-game/${displayName ? `?username=${encodeURIComponent(displayName)}` : ""}`;
      setLockedSrc(src);
    }
  }, [user]);

  // Fallback: if user never loads, use a generic src
  const src = lockedSrc ?? (user === null ? "/vocab-game/" : null);

  if (!src) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 -mt-8 -mb-8" style={{ height: "calc(100vh - 4rem)" }}>
      <iframe
        src={src}
        title="Kelime Oyunu"
        className="w-full h-full border-0 bg-white"
        allow="autoplay"
      />
    </div>
  );
}
