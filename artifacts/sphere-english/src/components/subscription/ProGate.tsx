import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Lock, Sparkles, Crown, Loader2 } from "lucide-react";
import { useSubscription } from "../../lib/subscription-context";
import type { ComponentType } from "react";

interface Props {
  moduleKey: string;
  featureName: string;
  children: React.ReactNode;
}

export default function ProGate({ children }: Props) {
  // Abonelik sistemi kaldırıldı — kilit yok, direkt içerik göster
  return <>{children}</>;
  // eslint-disable-next-line no-unreachable
  const { loading, isLockedForMe, entitlement, startTrial, refresh } = useSubscription();
  const [, setLocation] = useLocation();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: "center" }}>
        <Loader2 size={32} className="animate-spin" style={{ color: "#6366f1" }} />
      </div>
    );
  }

  if (!isLockedForMe(moduleKey)) {
    return <>{children}</>;
  }

  const expired =
    entitlement?.status === "expired" ||
    entitlement?.status === "past_due" ||
    entitlement?.status === "canceled";

  // Yeni kullanıcı (hiç trial kullanmadıysa) → butona basınca direkt trial başlat
  async function handleTryFree() {
    setStarting(true);
    setError(null);
    try {
      const r = await startTrial("pro_monthly");
      if (r.ok) {
        // Trial başladı, entitlement güncellendi → kilit açıldı, sayfa otomatik render
        await refresh();
      } else {
        // Eğer otomatik başlatamadıysak abonelik sayfasına yönlendir
        if (r.error?.includes("zaten") || r.error?.includes("kullandın")) {
          setLocation("/student/subscription");
          return;
        }
        setError(r.error ?? "Deneme başlatılamadı");
      }
    } catch (e: any) {
      setError(e?.message ?? "Beklenmeyen hata");
    } finally {
      setStarting(false);
    }
  }

  const isFirstTimeUser = !entitlement?.hasUsedTrial && !expired;

  return (
    <div style={{ maxWidth: 720, margin: "40px auto", padding: 24 }}>
      <div
        style={{
          background: "linear-gradient(135deg,#ffffff,#f5f3ff)",
          border: "2px solid #c7d2fe",
          borderRadius: 20,
          padding: 40,
          textAlign: "center",
          boxShadow: "0 12px 40px rgba(99,102,241,0.15)",
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: "linear-gradient(135deg,#4f46e5,#7c3aed)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px",
            boxShadow: "0 8px 24px rgba(79,70,229,0.3)",
          }}
        >
          {starting ? <Loader2 size={32} color="#fff" className="animate-spin" /> : <Lock size={32} color="#fff" />}
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 10, color: "#1f2937" }}>
          {featureName} — Pro Üyelere Özel
        </h1>
        <p style={{ color: "#6b7280", fontSize: 15, lineHeight: 1.6, marginBottom: 24 }}>
          {expired
            ? "Pro aboneliğin sona erdi. Bu özelliğe erişmek için aboneliğini yenilemen yeterli."
            : entitlement?.hasUsedTrial
            ? "Bu özellik Pro abonelere açıktır. Aşağıdaki planlardan birini seçerek devam edebilirsin."
            : "7 günlük ücretsiz deneme ile bu özelliği ve tüm diğer AI Studio modüllerini hemen kullanmaya başla. Kart bilgisi gerekmez."}
        </p>

        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: 16,
            marginBottom: 24,
            textAlign: "left",
          }}
        >
          <div style={{ fontWeight: 600, color: "#374151", marginBottom: 10, fontSize: 14 }}>
            Pro ile açılan özellikler:
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 13, color: "#4b5563" }}>
            {[
              "AI Öğretmen (sohbet asistanı)",
              "Telaffuz Koçu + raporlar",
              "Yazma Koçu",
              "Kelime Oyunu",
              "Dilbilgisi Koçu",
              "İş Senaryoları",
              "Mülakat Simülatörü",
              "Sunum Simülatörü",
              "AI Quiz Üretici",
              "Adaptive Öğrenme Yolu",
            ].map((f) => (
              <div key={f} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <Sparkles size={12} color="#7c3aed" /> {f}
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div
            style={{
              background: "#fee2e2",
              border: "1px solid #fecaca",
              color: "#991b1b",
              padding: "10px 14px",
              borderRadius: 10,
              marginBottom: 16,
              fontSize: 13,
              textAlign: "left",
            }}
          >
            {error}
          </div>
        )}

        {/* Yeni kullanıcı → butona basınca direkt trial başlat */}
        {isFirstTimeUser ? (
          <button
            onClick={handleTryFree}
            disabled={starting}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: starting
                ? "#a5b4fc"
                : "linear-gradient(135deg,#4f46e5,#7c3aed)",
              color: "#fff",
              padding: "12px 28px",
              borderRadius: 10,
              border: "none",
              fontWeight: 700,
              fontSize: 15,
              cursor: starting ? "not-allowed" : "pointer",
              boxShadow: starting ? "none" : "0 8px 24px rgba(79,70,229,0.3)",
            }}
          >
            {starting ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Hazırlanıyor…
              </>
            ) : (
              <>
                <Crown size={18} />
                7 Gün Ücretsiz Dene
              </>
            )}
          </button>
        ) : (
          <Link
            href="/student/subscription"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "linear-gradient(135deg,#4f46e5,#7c3aed)",
              color: "#fff",
              padding: "12px 28px",
              borderRadius: 10,
              textDecoration: "none",
              fontWeight: 700,
              fontSize: 15,
              boxShadow: "0 8px 24px rgba(79,70,229,0.3)",
            }}
          >
            <Crown size={18} />
            {expired ? "Aboneliği Yenile" : "Planları Gör"}
          </Link>
        )}

        {isFirstTimeUser && (
          <p style={{ marginTop: 14, fontSize: 11, color: "#9ca3af" }}>
            Kart bilgisi gerekmez · 7 gün sonunda otomatik kesinti olmaz
          </p>
        )}
      </div>
    </div>
  );
}

export function withProGate<P extends object>(
  Component: ComponentType<P>,
  moduleKey: string,
  featureName: string
) {
  return function Wrapped(props: P) {
    return (
      <ProGate moduleKey={moduleKey} featureName={featureName}>
        <Component {...props} />
      </ProGate>
    );
  };
}
