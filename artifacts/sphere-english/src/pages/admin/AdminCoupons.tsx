import { useEffect, useState } from "react";
import {
  Ticket, Plus, RefreshCw, Loader2, AlertCircle, X, Check,
  Calendar, Percent, DollarSign, Eye, EyeOff, Trash2,
} from "lucide-react";
import { API } from "@/lib/api-url";

const TOKEN_KEY = "sphere_token";

async function apiFetch(path: string, opts: RequestInit = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

function tl(kurus: number | null | undefined): string {
  const k = Number(kurus ?? 0);
  return (k / 100).toLocaleString("tr-TR", { minimumFractionDigits: 0 }) + " TL";
}

const SCOPE_LABELS: Record<string, string> = {
  subscription_all: "Tüm Abonelikler",
  subscription_monthly: "Aylık Abonelikler",
  subscription_yearly: "Yıllık Abonelikler",
  ebook: "E-Kitaplar",
};

export default function AdminCoupons() {
  const [coupons, setCoupons] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ status: filter });
      if (search.trim()) qs.set("search", search.trim());
      const data = await apiFetch(`/admin/coupons?${qs.toString()}`);
      setCoupons(data.coupons ?? []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [filter]);
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [search]);

  async function toggle(id: number) {
    try {
      await apiFetch(`/admin/coupons/${id}/toggle`, { method: "POST" });
      await load();
    } catch (e: any) { setError(e.message); }
  }

  async function openDetail(id: number) {
    try {
      const data = await apiFetch(`/admin/coupons/${id}`);
      setDetail(data);
    } catch (e: any) { setError(e.message); }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <header className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-blue-800 flex items-center gap-2">
            <Ticket size={26} /> Kupon Kodları
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Abonelik ve e-kitap satışları için indirim kuponları
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-white border border-slate-200 hover:bg-slate-50 text-sm">
            <RefreshCw size={14} /> Yenile
          </button>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-blue-700 text-white text-sm hover:bg-blue-800">
            <Plus size={14} /> Yeni Kupon
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700 flex justify-between items-center">
          <span className="flex items-center gap-2"><AlertCircle size={16} /> {error}</span>
          <button onClick={() => setError(null)}><X size={14} /></button>
        </div>
      )}

      <div className="flex gap-2 mb-4 items-center">
        <div className="flex gap-1">
          {([["all","Tümü"],["active","Aktif"],["inactive","Pasif"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)}
              className={`px-3 py-1.5 text-sm rounded-md ${filter === k ? "bg-blue-700 text-white" : "bg-white border border-slate-200 hover:bg-slate-50"}`}>
              {l}
            </button>
          ))}
        </div>
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Kod veya açıklama ara..."
          className="flex-1 max-w-sm px-3 py-1.5 text-sm border border-slate-200 rounded-md" />
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className={`col-span-12 ${detail ? "lg:col-span-7" : ""} bg-white border border-slate-200 rounded-lg overflow-hidden`}>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">Kod</th>
                <th className="px-3 py-2 text-left">İndirim</th>
                <th className="px-3 py-2 text-left">Kapsam</th>
                <th className="px-3 py-2 text-center">Kullanım</th>
                <th className="px-3 py-2 text-center">Geçerlilik</th>
                <th className="px-3 py-2 text-center">Durum</th>
                <th className="px-3 py-2 text-center"></th>
              </tr>
            </thead>
            <tbody>
              {loading && coupons.length === 0 ? (
                <tr><td colSpan={7} className="text-center p-6"><Loader2 className="animate-spin inline" /></td></tr>
              ) : coupons.length === 0 ? (
                <tr><td colSpan={7} className="text-center p-8 text-slate-400">Henüz kupon yok</td></tr>
              ) : coupons.map((c) => (
                <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                  onClick={() => openDetail(c.id)}>
                  <td className="px-3 py-2">
                    <div className="font-mono font-bold text-blue-800">{c.code}</div>
                    {c.description && <div className="text-xs text-slate-500">{c.description}</div>}
                  </td>
                  <td className="px-3 py-2">
                    {c.discount_type === "percentage"
                      ? <span className="font-semibold">%{Number(c.discount_value).toFixed(0)}</span>
                      : <span className="font-semibold">{Number(c.discount_value).toFixed(0)} TL</span>}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1 flex-wrap">
                      {(c.applies_to ?? []).map((a: string) => (
                        <span key={a} className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded">
                          {SCOPE_LABELS[a] ?? a}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center">
                    {c.total_used_count}
                    {c.max_uses && <span className="text-slate-400"> / {c.max_uses}</span>}
                  </td>
                  <td className="px-3 py-2 text-center text-xs text-slate-500">
                    {c.valid_until ? new Date(c.valid_until).toLocaleDateString("tr-TR") : "Süresiz"}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {c.is_active
                      ? <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">Aktif</span>
                      : <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">Pasif</span>}
                  </td>
                  <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => toggle(c.id)}
                      className="p-1.5 hover:bg-slate-100 rounded" title={c.is_active ? "Pasifleştir" : "Aktifleştir"}>
                      {c.is_active ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {detail && (
          <div className="col-span-12 lg:col-span-5 bg-white border border-slate-200 rounded-lg p-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between mb-3">
              <h3 className="font-bold text-lg font-mono">{detail.coupon.code}</h3>
              <button onClick={() => setDetail(null)}><X size={18} /></button>
            </div>
            <div className="space-y-2 text-sm">
              <div><strong>Tip:</strong> {detail.coupon.discount_type === "percentage" ? `%${detail.coupon.discount_value}` : `${detail.coupon.discount_value} TL`}</div>
              <div><strong>Kullanım:</strong> {detail.coupon.total_used_count} {detail.coupon.max_uses && `/ ${detail.coupon.max_uses}`}</div>
              {detail.coupon.min_purchase_kurus > 0 && (
                <div><strong>Min. alışveriş:</strong> {tl(detail.coupon.min_purchase_kurus)}</div>
              )}
              <div><strong>Geçerlilik:</strong> {detail.coupon.valid_until ? new Date(detail.coupon.valid_until).toLocaleString("tr-TR") : "Süresiz"}</div>
              {detail.coupon.notes && <div className="text-slate-600 italic">"{detail.coupon.notes}"</div>}

              <div className="pt-3 border-t border-slate-100">
                <div className="text-xs uppercase text-slate-400 font-medium mb-2">Kullanımlar ({detail.redemptions?.length ?? 0})</div>
                {detail.redemptions?.length === 0 ? (
                  <div className="text-slate-400 text-sm">Henüz kullanılmadı</div>
                ) : (
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {detail.redemptions.map((r: any) => (
                      <div key={r.id} className="text-xs p-2 bg-slate-50 rounded">
                        <div className="flex justify-between">
                          <span>{new Date(r.created_at).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })}</span>
                          <span className="font-semibold text-emerald-700">-{tl(r.discount_kurus)}</span>
                        </div>
                        <div className="text-slate-500 mt-0.5">{r.source_type === "subscription" ? "Abonelik" : "E-kitap"} · {r.buyer_email}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {showForm && <CouponForm onClose={() => setShowForm(false)} onCreated={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function CouponForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    code: "", description: "",
    discountType: "percentage" as "percentage" | "fixed",
    discountValue: "10",
    appliesTo: ["subscription_all", "ebook"] as string[],
    minPurchaseTl: "0",
    maxUses: "" as string,
    maxUsesPerUser: "1",
    validUntil: "",
    notes: "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function toggleScope(s: string) {
    setForm((f) => ({
      ...f,
      appliesTo: f.appliesTo.includes(s) ? f.appliesTo.filter((x) => x !== s) : [...f.appliesTo, s],
    }));
  }

  async function submit() {
    if (!form.code.trim()) return setErr("Kod gerekli");
    if (form.appliesTo.length === 0) return setErr("En az bir kapsam seç");
    const val = parseFloat(form.discountValue);
    if (!val || val <= 0) return setErr("Geçerli bir indirim değeri gir");
    if (form.discountType === "percentage" && val > 100) return setErr("Yüzde 0-100 arası");

    setBusy(true); setErr(null);
    try {
      await apiFetch("/admin/coupons", {
        method: "POST",
        body: JSON.stringify({
          code: form.code.trim().toUpperCase(),
          description: form.description.trim() || null,
          discountType: form.discountType,
          discountValue: val,
          appliesTo: form.appliesTo,
          minPurchaseKurus: Math.round(parseFloat(form.minPurchaseTl || "0") * 100),
          maxUses: form.maxUses ? parseInt(form.maxUses, 10) : null,
          maxUsesPerUser: parseInt(form.maxUsesPerUser || "1", 10),
          validUntil: form.validUntil || null,
          notes: form.notes.trim() || null,
        }),
      });
      onCreated();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-xl w-full max-h-[90vh] overflow-y-auto p-6">
        <div className="flex justify-between mb-4">
          <h2 className="text-xl font-bold">Yeni Kupon</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>

        {err && <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">{err}</div>}

        <div className="space-y-3 text-sm">
          <div>
            <label className="block text-xs font-medium mb-1">Kupon Kodu *</label>
            <input type="text" value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/[^A-Z0-9-_]/g, "") })}
              placeholder="HOSGELDIN10"
              className="w-full px-3 py-2 border border-slate-200 rounded-md font-mono uppercase" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Açıklama (admin için)</label>
            <input type="text" value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Hoşgeldin kampanyası"
              className="w-full px-3 py-2 border border-slate-200 rounded-md" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Tip</label>
              <select value={form.discountType}
                onChange={(e) => setForm({ ...form, discountType: e.target.value as any })}
                className="w-full px-3 py-2 border border-slate-200 rounded-md">
                <option value="percentage">Yüzdesel (%)</option>
                <option value="fixed">Sabit (TL)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">
                Değer ({form.discountType === "percentage" ? "%" : "TL"})
              </label>
              <input type="number" value={form.discountValue}
                onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
                min="0" max={form.discountType === "percentage" ? "100" : undefined}
                className="w-full px-3 py-2 border border-slate-200 rounded-md" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Geçerli olduğu ürünler</label>
            <div className="grid grid-cols-2 gap-1.5">
              {Object.entries(SCOPE_LABELS).map(([s, l]) => (
                <label key={s} className="flex items-center gap-2 p-2 border border-slate-200 rounded text-xs cursor-pointer hover:bg-slate-50">
                  <input type="checkbox" checked={form.appliesTo.includes(s)}
                    onChange={() => toggleScope(s)} />
                  {l}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Min. tutar (TL)</label>
              <input type="number" value={form.minPurchaseTl}
                onChange={(e) => setForm({ ...form, minPurchaseTl: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-md" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Toplam kullanım</label>
              <input type="number" value={form.maxUses}
                onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
                placeholder="∞ sınırsız"
                className="w-full px-3 py-2 border border-slate-200 rounded-md" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Kişi başı limit</label>
              <input type="number" value={form.maxUsesPerUser}
                onChange={(e) => setForm({ ...form, maxUsesPerUser: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-md" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Son geçerlilik (boş = süresiz)</label>
            <input type="datetime-local" value={form.validUntil}
              onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-md" />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">İç not (opsiyonel)</label>
            <textarea value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-md" />
          </div>

          <div className="flex gap-2 pt-3">
            <button onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-200 rounded-md hover:bg-slate-50">
              İptal
            </button>
            <button onClick={submit} disabled={busy}
              className="flex-1 px-4 py-2 bg-blue-700 text-white rounded-md hover:bg-blue-800 disabled:opacity-50">
              {busy ? "Kaydediliyor..." : "Kupon Oluştur"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
