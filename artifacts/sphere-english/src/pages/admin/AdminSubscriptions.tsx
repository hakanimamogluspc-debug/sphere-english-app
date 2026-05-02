import { useEffect, useState, useMemo } from "react";
import { Crown, Search, Plus, X, Loader2, Users, Sparkles, Clock, AlertTriangle } from "lucide-react";

const TOKEN_KEY = "sphere_token";
const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

interface Row {
  userId: number;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  currentLevel: string | null;
  subscription: {
    id: number;
    planKey: string | null;
    status: string;
    trialEndsAt: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    grantedByAdminId: number | null;
    notes: string | null;
  } | null;
}

interface Stats {
  trialing: number;
  active: number;
  expired: number;
  canceled: number;
  total: number;
}

const STATUS_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  trialing: { bg: "#e0e7ff", color: "#4338ca", label: "Deneme" },
  active: { bg: "#d1fae5", color: "#047857", label: "Aktif" },
  past_due: { bg: "#fef3c7", color: "#b45309", label: "Beklemede" },
  canceled: { bg: "#fee2e2", color: "#991b1b", label: "İptal" },
  expired: { bg: "#f3f4f6", color: "#6b7280", label: "Süresi Doldu" },
  none: { bg: "#f9fafb", color: "#9ca3af", label: "Yok" },
};

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function AdminSubscriptions() {
  const [rows, setRows] = useState<Row[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [busy, setBusy] = useState<number | null>(null);
  const [grantFor, setGrantFor] = useState<Row | null>(null);
  const [grantPlan, setGrantPlan] = useState<"pro_monthly" | "pro_yearly">("pro_monthly");
  const [grantNotes, setGrantNotes] = useState("");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const headers = useMemo(() => ({ Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY) || ""}` }), []);

  async function load() {
    setLoading(true);
    try {
      const [r, s] = await Promise.all([
        fetch(`${API}/admin/subscriptions`, { headers }).then((x) => x.json()),
        fetch(`${API}/admin/subscriptions/stats`, { headers }).then((x) => x.json()),
      ]);
      setRows(r.users || []);
      setStats(s);
    } catch (e) {
      setMsg({ type: "err", text: "Veri yüklenemedi." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const status = r.subscription?.status || "none";
      if (filter !== "all" && status !== filter) return false;
      if (!q) return true;
      const t = q.toLowerCase();
      return (
        r.email.toLowerCase().includes(t) ||
        (r.firstName || "").toLowerCase().includes(t) ||
        (r.lastName || "").toLowerCase().includes(t)
      );
    });
  }, [rows, q, filter]);

  async function grant() {
    if (!grantFor) return;
    setBusy(grantFor.userId);
    setMsg(null);
    try {
      const res = await fetch(`${API}/admin/subscriptions/${grantFor.userId}/grant`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ planKey: grantPlan, notes: grantNotes || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMsg({ type: "ok", text: `${grantFor.email} kullanıcısına ${grantPlan === "pro_yearly" ? "yıllık" : "aylık"} abonelik atandı.` });
      setGrantFor(null);
      setGrantNotes("");
      await load();
    } catch (e: any) {
      setMsg({ type: "err", text: e.message || "Atama başarısız." });
    } finally {
      setBusy(null);
    }
  }

  async function revoke(userId: number, email: string) {
    if (!confirm(`${email} kullanıcısının aboneliğini iptal et?`)) return;
    setBusy(userId);
    setMsg(null);
    try {
      const res = await fetch(`${API}/admin/subscriptions/${userId}/revoke`, { method: "POST", headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMsg({ type: "ok", text: "Abonelik iptal edildi." });
      await load();
    } catch (e: any) {
      setMsg({ type: "err", text: e.message || "İşlem başarısız." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: "#1f2937", marginBottom: 6, display: "flex", alignItems: "center", gap: 10 }}>
          <Crown size={26} color="#7c3aed" /> Abonelik Yönetimi
        </h1>
        <p style={{ color: "#6b7280", fontSize: 14 }}>
          Manuel abonelik atama (Iyzico entegrasyonu öncesi). Atadığın aboneler tüm Pro AI özelliklerini kullanabilir.
        </p>
      </div>

      {msg && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            marginBottom: 16,
            background: msg.type === "ok" ? "#d1fae5" : "#fee2e2",
            color: msg.type === "ok" ? "#065f46" : "#991b1b",
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          {msg.text}
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Toplam Öğrenci", value: rows.length, color: "#6366f1", icon: Users },
            { label: "Aktif Pro", value: stats.active, color: "#10b981", icon: Sparkles },
            { label: "Deneme", value: stats.trialing, color: "#4338ca", icon: Clock },
            { label: "Süresi Dolan", value: stats.expired + stats.canceled, color: "#b45309", icon: AlertTriangle },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                padding: 16,
                display: "flex",
                gap: 12,
                alignItems: "center",
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: `${s.color}15`,
                  color: s.color,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <s.icon size={20} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>{s.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#1f2937" }}>{s.value}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "1 1 240px", minWidth: 200 }}>
          <Search size={16} style={{ position: "absolute", left: 12, top: 12, color: "#9ca3af" }} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="E-posta veya isim ara..."
            style={{
              width: "100%",
              padding: "10px 12px 10px 36px",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              fontSize: 14,
            }}
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 14 }}
        >
          <option value="all">Tüm Durumlar</option>
          <option value="active">Aktif</option>
          <option value="trialing">Deneme</option>
          <option value="expired">Süresi Dolan</option>
          <option value="canceled">İptal</option>
          <option value="none">Aboneliği Yok</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            <Loader2 size={28} className="animate-spin" style={{ color: "#6366f1" }} />
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead style={{ background: "#f9fafb" }}>
                <tr>
                  <th style={{ textAlign: "left", padding: "12px 14px", fontWeight: 600, color: "#374151" }}>Öğrenci</th>
                  <th style={{ textAlign: "left", padding: "12px 14px", fontWeight: 600, color: "#374151" }}>Seviye</th>
                  <th style={{ textAlign: "left", padding: "12px 14px", fontWeight: 600, color: "#374151" }}>Plan</th>
                  <th style={{ textAlign: "left", padding: "12px 14px", fontWeight: 600, color: "#374151" }}>Durum</th>
                  <th style={{ textAlign: "left", padding: "12px 14px", fontWeight: 600, color: "#374151" }}>Bitiş</th>
                  <th style={{ textAlign: "right", padding: "12px 14px", fontWeight: 600, color: "#374151" }}>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const status = r.subscription?.status || "none";
                  const sc = STATUS_COLORS[status];
                  const periodEnd = r.subscription?.status === "trialing" ? r.subscription.trialEndsAt : r.subscription?.currentPeriodEnd;
                  return (
                    <tr key={r.userId} style={{ borderTop: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "12px 14px" }}>
                        <div style={{ fontWeight: 600, color: "#1f2937" }}>
                          {r.firstName} {r.lastName}
                        </div>
                        <div style={{ fontSize: 12, color: "#6b7280" }}>{r.email}</div>
                      </td>
                      <td style={{ padding: "12px 14px", color: "#4b5563" }}>{r.currentLevel || "—"}</td>
                      <td style={{ padding: "12px 14px", color: "#4b5563" }}>
                        {r.subscription?.planKey === "pro_yearly" ? "Pro Yıllık" : r.subscription?.planKey === "pro_monthly" ? "Pro Aylık" : "—"}
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <span
                          style={{
                            background: sc.bg,
                            color: sc.color,
                            padding: "3px 10px",
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          {sc.label}
                        </span>
                        {r.subscription?.cancelAtPeriodEnd && (
                          <span style={{ marginLeft: 6, fontSize: 11, color: "#b45309" }}>↓ iptal kuyruğunda</span>
                        )}
                      </td>
                      <td style={{ padding: "12px 14px", color: "#4b5563", fontSize: 13 }}>{formatDate(periodEnd)}</td>
                      <td style={{ padding: "12px 14px", textAlign: "right" }}>
                        <button
                          onClick={() => {
                            setGrantFor(r);
                            setGrantPlan("pro_monthly");
                            setGrantNotes("");
                          }}
                          disabled={busy === r.userId}
                          style={{
                            background: "#4f46e5",
                            color: "#fff",
                            border: "none",
                            padding: "6px 12px",
                            borderRadius: 6,
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: "pointer",
                            marginRight: 6,
                          }}
                        >
                          {status === "active" || status === "trialing" ? "Yenile" : "Pro Ver"}
                        </button>
                        {(status === "active" || status === "trialing") && (
                          <button
                            onClick={() => revoke(r.userId, r.email)}
                            disabled={busy === r.userId}
                            style={{
                              background: "#fff",
                              color: "#dc2626",
                              border: "1px solid #fca5a5",
                              padding: "6px 12px",
                              borderRadius: 6,
                              fontSize: 13,
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            İptal
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
                      Sonuç bulunamadı.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Grant modal */}
      {grantFor && (
        <div
          onClick={() => setGrantFor(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 14, padding: 24, width: "100%", maxWidth: 460, boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "#1f2937", display: "flex", alignItems: "center", gap: 8 }}>
                <Plus size={18} /> Pro Abonelik Ata
              </h3>
              <button onClick={() => setGrantFor(null)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#9ca3af" }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ marginBottom: 14, padding: 12, background: "#f9fafb", borderRadius: 8 }}>
              <div style={{ fontWeight: 600, color: "#1f2937" }}>
                {grantFor.firstName} {grantFor.lastName}
              </div>
              <div style={{ fontSize: 13, color: "#6b7280" }}>{grantFor.email}</div>
            </div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Plan</label>
            <select
              value={grantPlan}
              onChange={(e) => setGrantPlan(e.target.value as any)}
              style={{ width: "100%", padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 14, marginBottom: 14 }}
            >
              <option value="pro_monthly">Pro Aylık (1 ay)</option>
              <option value="pro_yearly">Pro Yıllık (12 ay)</option>
            </select>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Not (opsiyonel)</label>
            <textarea
              value={grantNotes}
              onChange={(e) => setGrantNotes(e.target.value)}
              placeholder="Örn: Havale ile ödeme alındı (#1234)"
              rows={2}
              style={{ width: "100%", padding: 10, border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 14, marginBottom: 18, resize: "vertical" }}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => setGrantFor(null)}
                style={{ background: "#fff", color: "#374151", border: "1px solid #e5e7eb", padding: "10px 18px", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}
              >
                Vazgeç
              </button>
              <button
                onClick={grant}
                disabled={busy === grantFor.userId}
                style={{ background: "#4f46e5", color: "#fff", border: "none", padding: "10px 18px", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}
              >
                {busy === grantFor.userId ? "..." : "Aboneliği Ata"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
