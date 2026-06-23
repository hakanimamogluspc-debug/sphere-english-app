import { useEffect, useState } from "react";
import { Check, Crown, Loader2, ShieldCheck, Sparkles, ExternalLink } from "lucide-react";

const TOKEN_KEY = "sphere_token";
const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

/**
 * LMS abonelik plan kartları.
 *
 * Ödeme akışı LMS içinde DEĞİL, www.sphereenglish.com/abonelik tarafında alınır.
 * "Satın Al" butonuna basınca kullanıcı pazarlama sitesine yönlendirilir;
 * email/isim parametre olarak prefill edilir.
 *
 * Bu ayrım iki sebepten:
 *   1) Iyzico sanal POS başvurusu www.sphereenglish.com için yapıldı, ödeme
 *      akışı o domain'de olmalı (denetim tutarlılığı).
 *   2) Aynı altyapı dijital kitap satışı vb. için de pazarlama sitesinde
 *      kullanılacak.
 */

export interface PaymentPlan {
  code: string;
  label: string;
  tier: "core" | "pro" | "premium";
  billingType: "monthly" | "yearly";
  amount: number;
  durationMonths?: number;
  features: string[];
  popular?: boolean;
  discountPercent?: number;
}

interface CurrentSubscription {
  id: number | null;
  plan_key: string | null;
  plan_label: string | null;
  status: string | null;
  expires_at: string | null;
  billing_type: string | null;
}

interface CurrentUser {
  email?: string;
  name?: string;
}

const MARKETING_BASE = "https://www.sphereenglish.com";

const TIER_STYLE: Record<PaymentPlan["tier"], { color: string; bg: string; ring: string; chip: string }> = {
  core:    { color: "#475569", bg: "#f8fafc", ring: "#cbd5e1", chip: "#64748b" },
  pro:     { color: "#4f46e5", bg: "#eef2ff", ring: "#818cf8", chip: "#6366f1" },
  premium: { color: "#7c3aed", bg: "#faf5ff", ring: "#c4b5fd", chip: "#a855f7" },
};

function formatTRY(amount: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function IyzicoPlanPicker() {
  const [plans, setPlans] = useState<PaymentPlan[]>([]);
  const [tab, setTab] = useState<"monthly" | "yearly">("monthly");
  const [current, setCurrent] = useState<CurrentSubscription | null>(null);
  const [user, setUser] = useState<CurrentUser | null>(null);

  // Plan kataloğu + mevcut abonelik + kullanıcı bilgisi
  useEffect(() => {
    // LMS api-server'daki katalog endpoint'inden çek (LMS ile sync)
    fetch(`${API}/payment/plans`)
      .then((r) => r.json())
      .then((d) => setPlans(d.plans ?? []))
      .catch(() => {});

    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      const auth = { Authorization: `Bearer ${token}` };
      fetch(`${API}/payment/me/subscription`, { headers: auth })
        .then((r) => r.json())
        .then((d) => setCurrent(d.subscription ?? null))
        .catch(() => {});
      // Kullanıcı bilgisi — pazarlama sitesinde prefill için
      fetch(`${API}/auth/me`, { headers: auth })
        .then((r) => r.json())
        .then((d) => setUser({ email: d?.user?.email, name: d?.user?.name }))
        .catch(() => {});
    }
  }, []);

  function redirectToPayment(planCode: string) {
    const params = new URLSearchParams({ plan: planCode });
    if (user?.email) params.set("email", user.email);
    if (user?.name) params.set("name", user.name);
    window.location.href = `${MARKETING_BASE}/abonelik?${params.toString()}`;
  }

  const visiblePlans = plans.filter((p) => p.billingType === tab);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6">
      <div className="flex items-center gap-2 mb-1">
        <Crown size={18} className="text-purple-600" />
        <h2 className="text-xl font-bold text-slate-900">Premium Planlar</h2>
      </div>
      <p className="text-sm text-slate-500 mb-6">
        Tüm AI Studio modüllerine sınırsız erişim. Ödeme adımı www.sphereenglish.com üzerinden
        Iyzico ile güvenli olarak alınır.
      </p>

      {current && current.status === "active" && (
        <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck size={16} className="text-emerald-700" />
            <span className="font-bold text-sm text-emerald-900">
              Aktif Aboneliğin: {current.plan_label}
            </span>
          </div>
          {current.expires_at && (
            <p className="text-xs text-emerald-700">
              Geçerlilik: {new Date(current.expires_at).toLocaleDateString("tr-TR", {
                day: "2-digit", month: "long", year: "numeric",
              })}
            </p>
          )}
        </div>
      )}

      {/* Tab */}
      <div className="flex gap-2 mb-6 p-1 rounded-xl bg-slate-100 w-fit">
        <button
          onClick={() => setTab("monthly")}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            tab === "monthly" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
          }`}
        >
          Aylık
        </button>
        <button
          onClick={() => setTab("yearly")}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            tab === "yearly" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
          }`}
        >
          Yıllık (2 ay bedava)
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {visiblePlans.map((p) => {
          const style = TIER_STYLE[p.tier];
          const isCurrent = current?.plan_key === p.code && current?.status === "active";
          return (
            <div
              key={p.code}
              className="relative rounded-2xl border-2 p-5 flex flex-col"
              style={{
                borderColor: p.popular ? style.chip : style.ring,
                background: p.popular ? style.bg : "#fff",
                boxShadow: p.popular ? "0 6px 24px rgba(0,0,0,0.06)" : undefined,
              }}
            >
              {p.popular && (
                <div className="absolute -top-2 left-4 px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase text-white" style={{ background: style.chip }}>
                  <Sparkles size={10} className="inline mr-1" /> En Popüler
                </div>
              )}
              {p.discountPercent && (
                <div className="self-start text-[10px] font-bold tracking-wide uppercase px-2 py-1 rounded mb-2" style={{ background: "#fef3c7", color: "#92400e" }}>
                  %{p.discountPercent} indirim
                </div>
              )}
              <h3 className="font-bold text-base text-slate-900 mb-1">{p.label}</h3>
              <div className="text-3xl font-bold mb-1" style={{ color: style.color }}>
                {formatTRY(p.amount)}
              </div>
              <div className="text-xs text-slate-500 mb-4">
                {p.billingType === "monthly" ? "aylık" : "yıllık"}
              </div>
              <ul className="space-y-2 mb-5 text-xs text-slate-700 flex-1">
                {p.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <Check size={12} className="mt-0.5 flex-shrink-0" style={{ color: style.color }} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => redirectToPayment(p.code)}
                disabled={isCurrent}
                className="w-full py-2.5 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5"
                style={{ background: style.color }}
              >
                {isCurrent ? (
                  "Mevcut Planın"
                ) : (
                  <>
                    Satın Al
                    <ExternalLink size={12} />
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex items-start gap-2 text-xs text-slate-500">
        <ShieldCheck size={14} className="text-emerald-600 mt-0.5 flex-shrink-0" />
        <span>
          Ödemen www.sphereenglish.com&apos;da Iyzico ile alınır. Kart bilgileri sunucularımıza ulaşmaz,
          3D Secure korumalı işlenir. Aboneliğin hemen sonra Sphere English hesabına tanımlanır.
        </span>
      </div>
    </div>
  );
}
