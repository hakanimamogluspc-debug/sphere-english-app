import { useAuth } from "@/hooks/use-auth";

export default function VocabGame() {
  const { user } = useAuth();
  const displayName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email
    : "";
  const src = `/vocab-game/${displayName ? `?username=${encodeURIComponent(displayName)}` : ""}`;

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
