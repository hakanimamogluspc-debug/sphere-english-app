export default function VocabGame() {
  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <iframe
        src="/vocab-game/"
        title="Kelime Oyunu"
        className="w-full flex-1 rounded-2xl border border-border shadow-lg bg-white"
        style={{ minHeight: "600px" }}
        allow="autoplay"
      />
    </div>
  );
}
