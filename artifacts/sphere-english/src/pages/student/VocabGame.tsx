import { useAuth } from "@/hooks/use-auth";

export default function VocabGame() {
  const { user } = useAuth();
  const displayName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email
    : "";
  const src = `/vocab-game/${displayName ? `?username=${encodeURIComponent(displayName)}` : ""}`;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <iframe
        src={src}
        title="Kelime Oyunu"
        className="w-full flex-1 rounded-2xl border border-border shadow-lg bg-white"
        style={{ minHeight: "600px" }}
        allow="autoplay"
      />
    </div>
  );
}
