import { useEffect, useState } from "react";
import {
  Crown,
  Sparkles,
  Check,
  Clock,
  Loader2,
  AlertTriangle,
  RefreshCw,
  X,
  CreditCard,
  ShieldCheck,
} from "lucide-react";
import { useSubscription } from "../../lib/subscription-context";
import IyzicoPlanPicker from "../../components/subscription/IyzicoPlanPicker";

const TOKEN_KEY = "sphere_token";
const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

interface Plan {
  key: string;
  name: string;
  /** core | pro | premium */
  tier?: "core" | "pro" | "premium";
  description: string;
  priceCents: number;
  currency: "TRY";
  interval: "month" | "year";
  intervalCount?: number;
  trialDays: number;
  durationMonths?: number;
  /** Backend'den gelen tier'a özel özellik listesi (varsa FEATURES yerine bunu kullan) */
  features?: string[];
  monthlyEquivalentCents?: number;
  savingsPercent?: number;
  popular?: boolean;
}

const FEATURES = [
  "AI Öğretmen (kişisel sohbet asistanı)",
  "Telaffuz Koçu + CEFR raporları",
  "Yazma Koçu (gramer & stil önerileri)",
  "Kelime Oyunu (oyunlaştırılmış vocab)",
  "Dilbilgisi Koçu",
  "İş Senaryoları (rol play)",
  "Mülakat Simülatörü",
  "Sunum Simülatörü",
  "AI Quiz Üretici",
  "Adaptive Öğrenme Yolu",
];

function formatTRY(cents: number) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(cents / 100);
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });
}

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  none: { label: "Abonelik Yok", color: "#6b7280", bg: "#f3f4f6" },
  trialing: { label: "Ücretsiz Deneme", color: "#4338ca", bg: "#e0e7ff" },
  active: { label: "Aktif", color: "#047857", bg: "#d1fae5" },
  past_due: { label: "Ödeme Bekleniyor", color: "#b45309", bg: "#fef3c7" },
  canceled: { label: "İptal Edildi", color: "#991b1b", bg: "#fee2e2" },
  expired: { label: "Süresi Doldu", color: "#7f1d1d", bg: "#fee2e2" },
};

export default function Subscription() {
  const { entitlement, loading, startTrial, cancelSub, resumeSub, refresh } = useSubscription();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    fetch(`${API}/subscription/plans`)
      .then((r) => r.json())
      .then((d) => setPlans(d.plans || []))
      .catch(() => {});
  }, []);

  async function handleStart(planKey: string) {
    setBusy(planKey);
    setMsg(null);
    const r = await startTrial(planKey as any);
    setBusy(null);
    setMsg(r.ok ? { type: "ok", text: "7 günlük denemen başladı! AI Studio'nun tamamı açıldı." } : { type: "err", text: r.error || "Hata" });
  }

  async function handleCancel() {
    if (!confirm("Aboneliğini dönem sonunda iptal etmek istediğine emin misin?")) return;
    setBusy("cancel");
    setMsg(null);
    const r = await cancelSub();
    setBusy(null);
    setMsg(r.ok ? { type: "ok", text: "İptal isteğin alındı. Dönem sonuna kadar erişimin sürer." } : { type: "err", text: r.error || "Hata" });
  }

  async function handleResume() {
    setBusy("resume");
    setMsg(null);
    const r = await resumeSub();
    setBusy(null);
    setMsg(r.ok ? { type: "ok", text: "İptal geri alındı. Aboneliğin yenilenmeye devam edecek." } : { type: "err", text: r.error || "Hata" });
  }

  if (loading || !entitlement) {
    return (
      <div style={{ padding: 60, textAlign: "center" }}>
        <Loader2 size={32} className="animate-spin" style={{ color: "#6366f1" }} />
      </div>
    );
  }

  const sl = STATUS_LABEL[entitlement.status] || STATUS_LABEL.none;
  const showPlans = !entitlement.active;
  const periodEnd = entitlement.status === "trialing" ? entitlement.trialEndsAt : entitlement.currentPeriodEnd;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "#1f2937", marginBottom: 6, display: "flex", alignItems: "center", gap: 10 }}>
          <Crown size={28} color="#7c3aed" /> Aboneliğim
        </h1>
        <p style={{ color: "#6b7280", fontSize: 15 }}>Pro plan, deneme süren ve faturalama tercihlerini buradan yönet.</p>
      </div>

      {msg && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: 10,
            marginBottom: 16,
            background: msg.type === "ok" ? "#d1fae5" : "#fee2e2",
            color: msg.type === "ok" ? "#065f46" : "#991b1b",
            border: `1px solid ${msg.type === "ok" ? "#6ee7b7" : "#fca5a5"}`,
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          {msg.text}
        </div>
      )}

      {/* Current status card */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          padding: 24,
          marginBottom: 24,
          boxShadow: "0 4px 12px rgba(0,0,0,0.04)",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 13, color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
              Mevcut Durum
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <span
                style={{
                  background: sl.bg,
                  color: sl.color,
                  padding: "6px 14px",
                  borderRadius: 999,
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >
                {sl.label}
              </span>
              {entitlement.daysLeft != null && entitlement.active && (
                <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#374151", fontSize: 14 }}>
                  <Clock size={16} /> {entitlement.daysLeft} gün kaldı
                </span>
              )}
              {entitlement.cancelAtPeriodEnd && (
                <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#b45309", fontSize: 13, fontWeight: 600 }}>
                  <AlertTriangle size={14} /> Dönem sonunda iptal
                </span>
              )}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 13, color: "#6b7280" }}>
              {entitlement.status === "trialing" ? "Deneme bitiş" : "Yenileme tarihi"}
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#1f2937" }}>{formatDate(periodEnd)}</div>
          </div>
        </div>

        {/* Action buttons */}
        {entitlement.active && (
          <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
            {entitlement.cancelAtPeriodEnd ? (
              <button
                onClick={handleResume}
                disabled={busy === "resume"}
                style={{
                  background: "#10b981",
                  color: "#fff",
                  border: "none",
                  padding: "10px 20px",
                  borderRadius: 8,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <RefreshCw size={16} /> {busy === "resume" ? "..." : "Aboneliği Sürdür"}
              </button>
            ) : (
              <button
                onClick={handleCancel}
                disabled={busy === "cancel"}
                style={{
                  background: "#fff",
                  color: "#dc2626",
                  border: "1px solid #fca5a5",
                  padding: "10px 20px",
                  borderRadius: 8,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <X size={16} /> {busy === "cancel" ? "..." : "Aboneliği İptal Et"}
              </button>
            )}
            <button
              onClick={refresh}
              style={{
                background: "transparent",
                color: "#6366f1",
                border: "1px solid #c7d2fe",
                padding: "10px 20px",
                borderRadius: 8,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <RefreshCw size={16} /> Yenile
            </button>
          </div>
        )}
      </div>

      {/* Plans */}
      {showPlans && (
        <>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#1f2937", marginBottom: 6 }}>Planlar</h2>
          <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 20 }}>
            {entitlement.hasUsedTrial
              ? "Daha önce deneme süreni kullandın. Devam etmek için bir Pro plan seç."
              : "İlk seferinde 7 gün ücretsiz dene. Kart bilgisi istemiyoruz, istediğin an iptal edebilirsin."}
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 16, marginBottom: 24 }}>
            {plans.map((p) => {
              const isYearly = p.interval === "year";
              const planFeatures = p.features && p.features.length > 0 ? p.features : FEATURES;
              return (
                <div
                  key={p.key}
                  style={{
                    background: "#fff",
                    border: `2px solid ${p.popular ? "#7c3aed" : "#e5e7eb"}`,
                    borderRadius: 16,
                    padding: 24,
                    position: "relative",
                    boxShadow: p.popular ? "0 12px 32px rgba(124,58,237,0.18)" : "0 4px 12px rgba(0,0,0,0.04)",
                  }}
                >
                  {p.popular && (
                    <div
                      style={{
                        position: "absolute",
                        top: -12,
                        right: 16,
                        background: "linear-gradient(135deg,#7c3aed,#4f46e5)",
                        color: "#fff",
                        padding: "4px 12px",
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      EN POPÜLER
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <Crown size={20} color="#7c3aed" />
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: "#1f2937" }}>{p.name}</h3>
                  </div>
                  <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 16, minHeight: 36 }}>{p.description}</p>
                  <div style={{ marginBottom: 4 }}>
                    <span style={{ fontSize: 32, fontWeight: 800, color: "#1f2937" }}>{formatTRY(p.priceCents)}</span>
                    <span style={{ color: "#6b7280", fontSize: 14 }}> / {isYearly ? "yıl" : "ay"}</span>
                  </div>
                  {isYearly && p.monthlyEquivalentCents && (
                    <div style={{ fontSize: 13, color: "#059669", fontWeight: 600, marginBottom: 16 }}>
                      Ayda yaklaşık {formatTRY(p.monthlyEquivalentCents)} (%{p.savingsPercent} tasarruf)
                    </div>
                  )}
                  {!isYearly && <div style={{ height: 20, marginBottom: 16 }} />}

                  <button
                    onClick={() => handleStart(p.key)}
                    disabled={busy === p.key || entitlement.hasUsedTrial}
                    title={entitlement.hasUsedTrial ? "Deneme hakkın kullanıldı — iyzico entegrasyonu yakında" : ""}
                    style={{
                      width: "100%",
                      background: entitlement.hasUsedTrial
                        ? "#e5e7eb"
                        : p.popular
                        ? "linear-gradient(135deg,#7c3aed,#4f46e5)"
                        : "#1f2937",
                      color: entitlement.hasUsedTrial ? "#9ca3af" : "#fff",
                      border: "none",
                      padding: "12px 16px",
                      borderRadius: 10,
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: entitlement.hasUsedTrial ? "not-allowed" : "pointer",
                      marginBottom: 16,
                    }}
                  >
                    {busy === p.key
                      ? "..."
                      : entitlement.hasUsedTrial
                      ? "Ödeme yakında (Iyzico)"
                      : `7 Gün Ücretsiz Dene`}
                  </button>

                  <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 12 }}>
                    {planFeatures.map((f) => (
                      <div
                        key={f}
                        style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", fontSize: 13, color: "#374151" }}
                      >
                        <Check size={14} color="#10b981" /> {f}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div
            style={{
              background: "#f9fafb",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: 16,
              display: "flex",
              alignItems: "center",
              gap: 12,
              fontSize: 13,
              color: "#4b5563",
            }}
          >
            <CreditCard size={18} color="#6b7280" />
            <div>
              <strong>Ödeme entegrasyonu yakında:</strong> Iyzico altyapısı eklendiğinde plan seçimi otomatik tahsilatla
              başlayacak. Şimdilik denemeyi başlatabilir veya sistem yöneticinden manuel tanımlama isteyebilirsin.
            </div>
          </div>
        </>
      )}

      {/* Iyzico Premium Planlar — onaylı 4 plan + peşin paketler */}
      <div style={{ marginTop: 32 }}>
        <IyzicoPlanPicker />
      </div>

      {/* Always-shown trust footer */}
      <div
        style={{
          marginTop: 32,
          padding: 16,
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          display: "flex",
          alignItems: "center",
          gap: 12,
          color: "#374151",
          fontSize: 13,
        }}
      >
        <ShieldCheck size={18} color="#10b981" />
        Sphere English aboneliği istediğin an iptal edilebilir. Deneme süresi içinde ücret tahsil edilmez.
      </div>
    </div>
  );
}
