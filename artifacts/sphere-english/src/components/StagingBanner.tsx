/**
 * Staging ortamı uyarı şeridi — VITE_APP_ENV=staging ile build edilmişse görünür.
 * Prod build'de (env yok) hiçbir şey render etmez.
 */
const APP_ENV = (import.meta.env.VITE_APP_ENV as string | undefined) ?? "production";

export default function StagingBanner() {
  if (APP_ENV !== "staging") return null;
  return (
    <div
      role="status"
      style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999,
        background: "repeating-linear-gradient(45deg,#f59e0b 0 12px,#fbbf24 12px 24px)",
        color: "#1f2937", fontSize: 12, fontWeight: 800, letterSpacing: "0.12em",
        textAlign: "center", padding: "3px 8px", textTransform: "uppercase",
        pointerEvents: "none",
      }}
    >
      Staging — test ortamı · veriler canlı değil · mail/push gönderilmez
    </div>
  );
}
