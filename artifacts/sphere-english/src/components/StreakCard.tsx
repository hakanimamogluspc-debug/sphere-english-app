import { useEffect, useState } from "react";
import { API } from "@/lib/api-url";
import { Flame, AlertTriangle, Shield, Loader2, CheckCircle2 } from "lucide-react";

/**
 * StreakCard — Duolingo tarzı büyük streak sayacı + kayıp korkusu + freeze
 *
 * Kullanıcının uzun süreli motivasyonu için — retention için kritik.
 *
 * Görsel durumlar:
 *   - Streak safe (bugün aktif): büyük yeşil 🔥
 *   - Streak at risk (dün aktif, bugün yok): kırmızı uyarı + freeze butonu
 *   - Streak broken: hüzünlü ton + "yeniden başlat"
 *   - Streak = 0: davetkar "streak başlat"
 */

const TOKEN_KEY = "sphere_token";

interface StreakStatus {
  streak: number;
  lastActiveDate: string | null;
  daysSinceActive: number;
  isAtRisk: boolean;
  hoursLeft: number;
  freezeCount: number;
  canUseFreeze: boolean;
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

export default function StreakCard() {
  const [data, setData] = useState<StreakStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [freezing, setFreezing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const d = await apiFetch("/student/streak-status");
      setData(d);
    } catch (e: any) {
      console.warn("[StreakCard] load hata:", e?.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleFreeze = async () => {
    setFreezing(true);
    setMessage(null);
    try {
      const d = await apiFetch("/student/streak/freeze", { method: "POST" });
      setMessage(d.message ?? "Streak korundu!");
      await load();
    } catch (e: any) {
      setMessage(e?.message ?? "Koruma başarısız");
    } finally {
      setFreezing(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center justify-center min-h-[110px]">
        <Loader2 className="animate-spin text-orange-500" size={20} />
      </div>
    );
  }

  if (!data) return null;

  const { streak, isAtRisk, freezeCount, canUseFreeze, hoursLeft } = data;

  // Streak = 0 — davetkar CTA
  if (streak === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-orange-200 bg-orange-50/50 p-5 text-center">
        <Flame className="mx-auto text-orange-400 mb-2" size={32} />
        <p className="text-sm font-bold text-slate-800">
          Streak'ini başlat 🔥
        </p>
        <p className="text-xs text-slate-500 mt-1">
          Bugün 10 dakika çalış, seriyi başlat
        </p>
      </div>
    );
  }

  // Risk altında — kırmızı uyarı + freeze butonu
  if (isAtRisk) {
    return (
      <div className="rounded-xl border-2 border-red-300 bg-gradient-to-br from-red-50 to-orange-50 p-5">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-11 h-11 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <Flame className="text-red-500" size={22} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-3xl font-extrabold text-red-600 tabular-nums">{streak}</span>
              <span className="text-sm font-bold text-red-700">gün</span>
              <AlertTriangle size={16} className="text-red-500" />
            </div>
            <p className="text-xs font-semibold text-red-700 leading-tight">
              Streak tehlikede! {hoursLeft} saatin kaldı.
            </p>
          </div>
        </div>

        {canUseFreeze && freezeCount > 0 ? (
          <button
            onClick={handleFreeze}
            disabled={freezing}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white border-2 border-red-300 hover:bg-red-100 text-red-700 text-sm font-bold transition-colors disabled:opacity-50"
          >
            {freezing ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Shield size={14} />
            )}
            Streak'i Koru ({freezeCount} hakkın var)
          </button>
        ) : (
          <p className="text-xs text-red-600 text-center">
            🎯 Bugün hızlıca bir görev tamamla — streak'in devam etsin!
          </p>
        )}

        {message && (
          <p className="text-xs text-emerald-700 mt-2 text-center font-semibold">{message}</p>
        )}
      </div>
    );
  }

  // Streak safe — büyük yeşil-turuncu 🔥
  return (
    <div className="rounded-xl border-2 border-orange-200 bg-gradient-to-br from-orange-50 via-white to-amber-50 p-5">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center shadow-lg">
          <Flame className="text-white" size={24} strokeWidth={2.2} />
        </div>
        <div className="flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-orange-600 tabular-nums">{streak}</span>
            <span className="text-sm font-bold text-slate-700">gün üst üste 🔥</span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {data.daysSinceActive === 0
              ? "Bugün de aktif oldun, harika!"
              : "Streak'in devam ediyor"}
          </p>
        </div>
        {freezeCount > 0 && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-white border border-slate-200 text-slate-600 text-[10px] font-bold">
            <Shield size={11} /> {freezeCount}
          </div>
        )}
      </div>

      {/* Milestone rozeti */}
      {streak >= 7 && streak < 30 && (
        <div className="mt-3 pt-3 border-t border-orange-100 flex items-center gap-2 text-xs">
          <CheckCircle2 size={13} className="text-emerald-500" />
          <span className="text-slate-600">
            <strong className="text-emerald-700">1 haftalık seri!</strong> 30 güne 🎯 {30 - streak} gün kaldı.
          </span>
        </div>
      )}
      {streak >= 30 && streak < 100 && (
        <div className="mt-3 pt-3 border-t border-orange-100 flex items-center gap-2 text-xs">
          <CheckCircle2 size={13} className="text-emerald-500" />
          <span className="text-slate-600">
            <strong className="text-emerald-700">1 aylık seri!</strong> 100'e 🎯 {100 - streak} gün.
          </span>
        </div>
      )}
      {streak >= 100 && (
        <div className="mt-3 pt-3 border-t border-orange-100 flex items-center gap-2 text-xs">
          <CheckCircle2 size={13} className="text-emerald-500" />
          <span className="text-slate-600">
            <strong className="text-emerald-700">💯 Efsane! {streak} gün üst üste.</strong>
          </span>
        </div>
      )}
    </div>
  );
}
