import { Link } from "wouter";
import { Sparkles, Clock, AlertTriangle, Crown } from "lucide-react";
import { useSubscription } from "../../lib/subscription-context";

export default function TrialBanner() {
  // Abonelik sistemi kaldırıldı — banner hiç gösterilmez
  return null;
  // eslint-disable-next-line no-unreachable
  const { entitlement, loading } = useSubscription();
  if (loading || !entitlement) return null;

  const role = (() => {
    try {
      return JSON.parse(localStorage.getItem("sphere_user") || "{}").role;
    } catch {
      return null;
    }
  })();
  if (role !== "student") return null;

  const { status, daysLeft, hasUsedTrial, cancelAtPeriodEnd } = entitlement;

  if (status === "trialing") {
    const urgent = (daysLeft ?? 7) <= 2;
    return (
      <div
        style={{
          background: urgent
            ? "linear-gradient(135deg,#fff7ed,#ffedd5)"
            : "linear-gradient(135deg,#eef2ff,#e0e7ff)",
          border: `1px solid ${urgent ? "#fdba74" : "#c7d2fe"}`,
          borderRadius: 12,
          padding: "12px 16px",
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <Clock size={20} color={urgent ? "#c2410c" : "#4338ca"} />
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontWeight: 700, color: urgent ? "#9a3412" : "#3730a3" }}>
            {urgent ? `Pro denemen ${daysLeft} gün içinde bitiyor!` : `Pro deneme aktif — ${daysLeft} gün kaldı`}
          </div>
          <div style={{ fontSize: 13, color: urgent ? "#9a3412" : "#4338ca", opacity: 0.85 }}>
            Tüm AI Studio özellikleri açık. Süre dolduğunda erişim kapatılır.
          </div>
        </div>
        <Link
          href="/student/subscription"
          style={{
            background: urgent ? "#c2410c" : "#4f46e5",
            color: "#fff",
            padding: "8px 16px",
            borderRadius: 8,
            textDecoration: "none",
            fontWeight: 600,
            fontSize: 14,
            whiteSpace: "nowrap",
          }}
        >
          Aboneliği Yönet
        </Link>
      </div>
    );
  }

  if (status === "active" && cancelAtPeriodEnd) {
    return (
      <div
        style={{
          background: "linear-gradient(135deg,#fef3c7,#fde68a)",
          border: "1px solid #fcd34d",
          borderRadius: 12,
          padding: "12px 16px",
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <AlertTriangle size={20} color="#92400e" />
        <div style={{ flex: 1, minWidth: 220, color: "#78350f" }}>
          <div style={{ fontWeight: 700 }}>Aboneliğin dönem sonunda bitecek</div>
          <div style={{ fontSize: 13, opacity: 0.9 }}>Devam etmek istersen tek tıkla geri alabilirsin.</div>
        </div>
        <Link
          href="/student/subscription"
          style={{
            background: "#92400e",
            color: "#fff",
            padding: "8px 16px",
            borderRadius: 8,
            textDecoration: "none",
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          Aboneliğim
        </Link>
      </div>
    );
  }

  if (status === "active") return null;

  // none / expired / past_due / canceled
  const expired = status === "expired" || status === "past_due" || status === "canceled";
  return (
    <div
      style={{
        background: "linear-gradient(135deg,#4f46e5,#7c3aed)",
        color: "#fff",
        borderRadius: 12,
        padding: "14px 18px",
        marginBottom: 16,
        display: "flex",
        alignItems: "center",
        gap: 14,
        flexWrap: "wrap",
        boxShadow: "0 8px 24px rgba(79,70,229,0.25)",
      }}
    >
      {expired ? <Crown size={22} /> : <Sparkles size={22} />}
      <div style={{ flex: 1, minWidth: 220 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>
          {expired ? "Pro aboneliğin sona erdi" : hasUsedTrial ? "Pro'ya geç, AI Studio'yu aç" : "7 gün ücretsiz Pro dene"}
        </div>
        <div style={{ fontSize: 13, opacity: 0.92 }}>
          AI Öğretmen, Telaffuz Koçu, Mülakat & Sunum Simülatörü, AI Quiz ve daha fazlası.
        </div>
      </div>
      <Link
        href="/student/subscription"
        style={{
          background: "#fff",
          color: "#4f46e5",
          padding: "8px 18px",
          borderRadius: 8,
          textDecoration: "none",
          fontWeight: 700,
          fontSize: 14,
          whiteSpace: "nowrap",
        }}
      >
        {expired ? "Yenile" : hasUsedTrial ? "Planları Gör" : "Denemeyi Başlat"}
      </Link>
    </div>
  );
}
