import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";

const TOKEN_KEY = "sphere_token";
const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

export type SubStatus = "none" | "trialing" | "active" | "past_due" | "canceled" | "expired";

export interface Entitlement {
  active: boolean;
  status: SubStatus;
  planKey: "pro_monthly" | "pro_yearly" | null;
  daysLeft: number | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  hasUsedTrial: boolean;
}

interface Ctx {
  loading: boolean;
  entitlement: Entitlement | null;
  proModuleKeys: string[];
  isProModule: (key?: string | null) => boolean;
  isLockedForMe: (key?: string | null) => boolean;
  refresh: () => Promise<void>;
  startTrial: (planKey?: "pro_monthly" | "pro_yearly") => Promise<{ ok: boolean; error?: string }>;
  cancelSub: () => Promise<{ ok: boolean; error?: string }>;
  resumeSub: () => Promise<{ ok: boolean; error?: string }>;
}

const SubscriptionContext = createContext<Ctx | null>(null);

function getRole(): string | null {
  try {
    const u = localStorage.getItem("sphere_user");
    return u ? JSON.parse(u).role : null;
  } catch {
    return null;
  }
}

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [proModuleKeys, setProModuleKeys] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setEntitlement(null);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${API}/subscription/me`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setEntitlement(data.entitlement);
        setProModuleKeys(data.proModuleKeys || []);
      }
    } catch (e) {
      console.error("subscription/me failed", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const isProModule = useCallback(
    (key?: string | null) => !!key && proModuleKeys.includes(key),
    [proModuleKeys]
  );

  const isLockedForMe = useCallback(
    (key?: string | null) => {
      if (!key || !proModuleKeys.includes(key)) return false;
      const role = getRole();
      if (role === "admin" || role === "teacher") return false;
      return !entitlement?.active;
    },
    [proModuleKeys, entitlement]
  );

  const startTrial = useCallback(
    async (planKey: "pro_monthly" | "pro_yearly" = "pro_monthly") => {
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) return { ok: false, error: "Giriş gerekli." };
      const res = await fetch(`${API}/subscription/start-trial`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ planKey }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: data.error || "Deneme başlatılamadı." };
      await refresh();
      return { ok: true };
    },
    [refresh]
  );

  const cancelSub = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return { ok: false, error: "Giriş gerekli." };
    const res = await fetch(`${API}/subscription/cancel`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error || "İptal edilemedi." };
    await refresh();
    return { ok: true };
  }, [refresh]);

  const resumeSub = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return { ok: false, error: "Giriş gerekli." };
    const res = await fetch(`${API}/subscription/resume`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error || "Devam ettirilemedi." };
    await refresh();
    return { ok: true };
  }, [refresh]);

  return (
    <SubscriptionContext.Provider
      value={{ loading, entitlement, proModuleKeys, isProModule, isLockedForMe, refresh, startTrial, cancelSub, resumeSub }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error("useSubscription must be used within SubscriptionProvider");
  return ctx;
}
