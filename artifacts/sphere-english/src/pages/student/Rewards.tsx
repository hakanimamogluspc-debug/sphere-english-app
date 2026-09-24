import { useEffect, useState } from "react";
import { API } from "@/lib/api-url";
import { Award, Snowflake, Loader2, Check, X, Sparkles, Copy, ChevronDown, ChevronRight } from "lucide-react";

const TOKEN_KEY = "sphere_token";

interface Reward {
  id: number;
  name: string;
  description: string;
  cost_freezes: number;
  type: string;
  payload: any;
  icon: string;
  affordable: boolean;
  already_owned: boolean;
}

interface Redemption {
  reward_id: number;
  name: string;
  icon: string;
  cost: number;
  granted: any;
  at: string;
}

interface RewardsData {
  current_freezes: number;
  badges: string[];
  rewards: Reward[];
  history: Redemption[];
}

async function apiFetch(path: string, opts: RequestInit = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.error || `HTTP ${res.status}`);
  return data;
}

export default function RewardsPage() {
  const [data, setData] = useState<RewardsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [redeeming, setRedeeming] = useState<number | null>(null);
  const [flash, setFlash] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [copiedCoupon, setCopiedCoupon] = useState<string | null>(null);

  const load = () =>
    apiFetch("/student/rewards")
      .then(setData)
      .catch((e) => setError(e?.message));

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const redeem = async (reward: Reward) => {
    if (!reward.affordable || reward.already_owned) return;
    if (!confirm(`"${reward.name}" için ${reward.cost_freezes} freeze kullanılacak. Onaylıyor musun?`)) return;
    setRedeeming(reward.id);
    setFlash(null);
    try {
      const r = await apiFetch(`/student/rewards/${reward.id}/redeem`, { method: "POST" });
      let successMsg = `🎉 ${reward.name} kazanıldı!`;
      if (r.granted?.coupon_code) {
        successMsg = `🎉 Kupon kodun: ${r.granted.coupon_code}`;
        setCopiedCoupon(r.granted.coupon_code);
      }
      setFlash({ type: "success", text: successMsg });
      await load();
    } catch (e: any) {
      setFlash({ type: "error", text: e?.message ?? "Ödül alınamadı" });
    } finally {
      setRedeeming(null);
      setTimeout(() => setFlash(null), 6000);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6 flex justify-center">
        <Loader2 className="animate-spin text-slate-400" size={24} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">{error ?? "Yüklenemedi"}</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6">
      <div className="flex items-center gap-3 mb-2">
        <Award className="text-amber-600" size={26} />
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900">Ödüllerim</h1>
      </div>
      <p className="text-sm text-slate-600 mb-4">
        Kazandığın <strong>streak freeze</strong>'leri harcayarak somut ödüller kilidi aç.
      </p>

      {/* Freeze balance */}
      <div className="bg-gradient-to-br from-sky-50 to-cyan-50 border border-sky-200 rounded-xl p-4 mb-5 flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-sky-500">
          <Snowflake size={24} />
        </div>
        <div className="flex-1">
          <p className="text-xs text-sky-800 font-semibold uppercase tracking-wider">Mevcut Bakiye</p>
          <div className="text-3xl font-extrabold text-sky-900 tabular-nums leading-tight">
            {data.current_freezes} <span className="text-sm font-semibold text-sky-700">freeze</span>
          </div>
        </div>
        <a
          href="/davet"
          className="text-xs text-sky-700 font-bold hover:text-sky-900 underline underline-offset-2"
        >
          Daha fazla →
        </a>
      </div>

      {/* Flash */}
      {flash && (
        <div
          className={`mb-4 rounded-lg px-3 py-2.5 text-sm font-semibold flex items-center gap-2 ${
            flash.type === "success"
              ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
              : "bg-red-50 border border-red-200 text-red-800"
          }`}
        >
          {flash.type === "success" ? <Check size={16} /> : <X size={16} />}
          <span className="flex-1">{flash.text}</span>
          {copiedCoupon && flash.text.includes(copiedCoupon) && (
            <button
              onClick={() => {
                navigator.clipboard.writeText(copiedCoupon).catch(() => {});
              }}
              className="inline-flex items-center gap-1 bg-white border border-emerald-300 rounded-md px-2 py-1 text-xs text-emerald-800"
            >
              <Copy size={12} /> Kopyala
            </button>
          )}
        </div>
      )}

      {/* Ödül katalogu */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        {data.rewards.map((r) => (
          <div
            key={r.id}
            className={`border rounded-xl p-4 flex flex-col ${
              r.already_owned
                ? "border-emerald-300 bg-emerald-50/50"
                : r.affordable
                ? "border-amber-300 bg-white hover:shadow-md transition-shadow"
                : "border-slate-200 bg-slate-50 opacity-70"
            }`}
          >
            <div className="flex items-start gap-3 mb-2">
              <div className="text-3xl">{r.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-extrabold text-slate-900 leading-tight">{r.name}</div>
                <p className="text-xs text-slate-600 leading-snug mt-0.5">{r.description}</p>
              </div>
            </div>
            <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-100">
              <div className="flex items-center gap-1 text-sm font-bold text-sky-700">
                <Snowflake size={14} />
                {r.cost_freezes}
              </div>
              {r.already_owned ? (
                <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-full">
                  <Check size={12} /> Sende
                </span>
              ) : (
                <button
                  onClick={() => redeem(r)}
                  disabled={!r.affordable || redeeming === r.id}
                  className={`inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${
                    r.affordable
                      ? "bg-amber-500 hover:bg-amber-600 text-white"
                      : "bg-slate-200 text-slate-500 cursor-not-allowed"
                  }`}
                >
                  {redeeming === r.id ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Sparkles size={12} />
                  )}
                  {r.affordable ? "Al" : "Yetersiz"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Geçmiş */}
      {data.history.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl">
          <button
            onClick={() => setShowHistory((s) => !s)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            <span>Kullanım Geçmişin ({data.history.length})</span>
            {showHistory ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          {showHistory && (
            <div className="border-t border-slate-100 divide-y divide-slate-100">
              {data.history.map((h, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="text-lg">{h.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-800 truncate">{h.name}</div>
                    <div className="text-[10px] text-slate-500">
                      {new Date(h.at).toLocaleDateString("tr-TR", {
                        day: "2-digit", month: "short", year: "numeric",
                      })}
                      {h.granted?.coupon_code && (
                        <span className="ml-2 font-mono text-slate-600">· {h.granted.coupon_code}</span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs font-bold text-sky-700 tabular-nums flex items-center gap-0.5">
                    <Snowflake size={11} />-{h.cost}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
