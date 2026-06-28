import { useEffect, useState } from "react";
import {
  Award, Check, X, RefreshCw, Loader2, AlertCircle, Users, TrendingUp,
  DollarSign, Clock, Eye, CreditCard, Search,
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

function tl(kurus: number | string | undefined | null): string {
  const k = Number(kurus ?? 0);
  return (k / 100).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " TL";
}

export default function AdminAffiliates() {
  const [tab, setTab] = useState<"pending" | "active" | "payouts" | "all">("pending");
  const [stats, setStats] = useState<any>(null);
  const [list, setList] = useState<any[]>([]);
  const [payoutsReady, setPayoutsReady] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<any>(null);

  async function loadStats() {
    try {
      const data = await apiFetch("/admin/affiliates/overview");
      setStats(data.stats);
    } catch {}
  }

  async function loadList() {
    setLoading(true);
    try {
      const statusFilter = tab === "pending" ? "pending" : tab === "active" ? "active" : "all";
      const qs = new URLSearchParams({ status: statusFilter, limit: "200" });
      if (search.trim()) qs.set("search", search.trim());
      const data = await apiFetch(`/admin/affiliates?${qs.toString()}`);
      setList(data.affiliates ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadPayoutsReady() {
    try {
      const data = await apiFetch("/admin/affiliates/payouts/pending");
      setPayoutsReady(data.ready ?? []);
    } catch (e: any) {
      setError(e.message);
    }
  }

  useEffect(() => {
    loadStats();
    if (tab === "payouts") loadPayoutsReady();
    else loadList();
  }, [tab]);

  useEffect(() => {
    if (tab !== "payouts") {
      const t = setTimeout(loadList, 350);
      return () => clearTimeout(t);
    }
  }, [search]);

  async function approve(id: number) {
    if (!confirm("Bu affiliate'i onaylamak istediğine emin misin?")) return;
    try {
      await apiFetch(`/admin/affiliates/${id}/approve`, { method: "POST" });
      await loadList();
      await loadStats();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function reject(id: number) {
    const reason = prompt("Red sebebi:");
    if (!reason) return;
    try {
      await apiFetch(`/admin/affiliates/${id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      await loadList();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function approveMatured() {
    try {
      const r = await apiFetch("/admin/affiliates/commissions/approve-matured", { method: "POST" });
      alert(`${r.approved} komisyon onaylandı`);
      await loadStats();
      if (tab === "payouts") await loadPayoutsReady();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function createPayout(affId: number) {
    if (!confirm("Bu affiliate için ödeme kaydı oluşturulsun mu? (Onaylı komisyonların tümü)")) return;
    try {
      const r = await apiFetch(`/admin/affiliates/${affId}/payout`, { method: "POST" });
      alert(`Payout oluşturuldu: ID=${r.payoutId} Tutar=${tl(r.amountKurus)}`);
      await loadPayoutsReady();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function markPaid(payoutId: number) {
    const ref = prompt("Ödeme referansı (banka dekontu, açıklama vb.):");
    if (ref === null) return;
    try {
      await apiFetch(`/admin/affiliates/payouts/${payoutId}/mark-paid`, {
        method: "POST",
        body: JSON.stringify({ paymentReference: ref }),
      });
      alert("Ödendi olarak işaretlendi");
      if (detail) await openDetail(detail.affiliate.id);
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function openDetail(id: number) {
    try {
      const data = await apiFetch(`/admin/affiliates/${id}`);
      setDetail(data);
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <header className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-blue-800 flex items-center gap-2">
            <Award size={26} /> Affiliate Program
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Başvuru onayları, komisyon takibi, aylık ödemeler
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { loadStats(); if (tab === "payouts") loadPayoutsReady(); else loadList(); }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-white border border-slate-200 hover:bg-slate-50 text-sm">
            <RefreshCw size={14} /> Yenile
          </button>
          <button onClick={approveMatured}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700">
            <Clock size={14} /> 14g dolanları onayla
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700 flex justify-between items-center">
          <span className="flex items-center gap-2"><AlertCircle size={16} /> {error}</span>
          <button onClick={() => setError(null)}><X size={14} /></button>
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-4">
          <StatCard label="Toplam" value={stats.total} icon={<Users size={14} />} color="slate" />
          <StatCard label="Onay Bekliyor" value={stats.pending} icon={<Clock size={14} />} color="amber" />
          <StatCard label="Aktif" value={stats.active} icon={<Check size={14} />} color="emerald" />
          <StatCard label="14g Hazır" value={stats.ready_to_approve} icon={<Eye size={14} />} color="blue" />
          <StatCard label="Borç" value={tl(stats.owed_kurus)} icon={<DollarSign size={14} />} color="rose" />
          <StatCard label="Ödenmiş" value={tl(stats.paid_kurus)} icon={<CreditCard size={14} />} color="violet" />
          <StatCard label="Tıklama (30g)" value={stats.clicks_30d} icon={<TrendingUp size={14} />} color="sky" />
        </div>
      )}

      <div className="flex gap-1 mb-4 border-b border-slate-200">
        {([
          ["pending", `Başvurular (${stats?.pending ?? 0})`],
          ["active", `Aktif (${stats?.active ?? 0})`],
          ["payouts", "Ödeme Hazır"],
          ["all", "Tümü"],
        ] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${
              tab === k ? "border-blue-700 text-blue-800" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {tab !== "payouts" && (
        <div className="mb-3 relative max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="İsim, e-posta, kod ara..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-md focus:ring-2 focus:ring-blue-500" />
        </div>
      )}

      <div className="grid grid-cols-12 gap-4">
        <div className={`col-span-12 ${detail ? "lg:col-span-7" : ""} bg-white border border-slate-200 rounded-lg overflow-hidden`}>
          {tab === "payouts" ? (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Affiliate</th>
                  <th className="px-3 py-2 text-left">IBAN</th>
                  <th className="px-3 py-2 text-right">Tutar</th>
                  <th className="px-3 py-2 text-center">Komisyon</th>
                  <th className="px-3 py-2 text-center">Aksiyon</th>
                </tr>
              </thead>
              <tbody>
                {payoutsReady.length === 0 ? (
                  <tr><td colSpan={5} className="text-center p-8 text-slate-400">Min 500 TL'ye ulaşan affiliate yok</td></tr>
                ) : payoutsReady.map((p) => (
                  <tr key={p.id} className="border-t border-slate-100">
                    <td className="px-3 py-2">
                      <div className="font-medium">{p.full_name}</div>
                      <div className="text-xs text-slate-500">{p.code} · {p.email}</div>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{p.iban}<br/>
                      <span className="text-slate-500">{p.account_holder_name} · TC: {p.tc_number}</span>
                    </td>
                    <td className="px-3 py-2 text-right font-medium">{tl(p.payable_kurus)}</td>
                    <td className="px-3 py-2 text-center">{p.commission_count}</td>
                    <td className="px-3 py-2 text-center">
                      <button onClick={() => createPayout(p.id)}
                        className="px-3 py-1 text-xs bg-blue-700 text-white rounded hover:bg-blue-800">
                        Payout Oluştur
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Affiliate</th>
                  <th className="px-3 py-2 text-center">Durum</th>
                  <th className="px-3 py-2 text-center">Tıklama</th>
                  <th className="px-3 py-2 text-center">Müşteri</th>
                  <th className="px-3 py-2 text-right">Kazanç</th>
                  <th className="px-3 py-2 text-center">Aksiyon</th>
                </tr>
              </thead>
              <tbody>
                {loading && list.length === 0 ? (
                  <tr><td colSpan={6} className="text-center p-6"><Loader2 className="animate-spin inline" size={20} /></td></tr>
                ) : list.length === 0 ? (
                  <tr><td colSpan={6} className="text-center p-8 text-slate-400">Kayıt yok</td></tr>
                ) : list.map((a) => (
                  <tr key={a.id} className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                    onClick={() => openDetail(a.id)}>
                    <td className="px-3 py-2">
                      <div className="font-medium">{a.full_name}</div>
                      <div className="text-xs text-slate-500">{a.code} · {a.email}</div>
                    </td>
                    <td className="px-3 py-2 text-center"><StatusBadge status={a.status} /></td>
                    <td className="px-3 py-2 text-center text-slate-600">{a.total_clicks}</td>
                    <td className="px-3 py-2 text-center text-slate-600">{a.total_conversions}</td>
                    <td className="px-3 py-2 text-right font-medium">{tl(a.total_earned_kurus)}</td>
                    <td className="px-3 py-2 text-center">
                      {a.status === "pending" && (
                        <div className="flex gap-1 justify-center" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => approve(a.id)}
                            className="px-2 py-1 text-xs bg-blue-700 text-white rounded hover:bg-blue-800">Onayla</button>
                          <button onClick={() => reject(a.id)}
                            className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200">Reddet</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {detail && (
          <div className="col-span-12 lg:col-span-5 bg-white border border-slate-200 rounded-lg p-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-bold text-lg">{detail.affiliate.full_name}</h3>
                <div className="text-sm text-slate-500">{detail.affiliate.code} · {detail.affiliate.email}</div>
              </div>
              <button onClick={() => setDetail(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>

            <div className="space-y-3 text-sm">
              <Section label="Başvuru">
                {detail.affiliate.website && <div><strong>Web:</strong> {detail.affiliate.website}</div>}
                {detail.affiliate.social_links && <div><strong>Sosyal:</strong> {detail.affiliate.social_links}</div>}
                {detail.affiliate.audience_description && <div className="italic text-slate-600 mt-1">"{detail.affiliate.audience_description}"</div>}
                {detail.affiliate.motivation && <div className="italic text-slate-600 mt-1">"{detail.affiliate.motivation}"</div>}
              </Section>

              <Section label="Kullanıcı Bağı">
                <div className="text-xs space-y-2">
                  <div><strong>Başvuru e-posta:</strong> <span className="font-mono">{detail.affiliate.email}</span></div>
                  <div>
                    <strong>affiliates.user_id:</strong>{" "}
                    {detail.affiliate.user_id ?? <em className="text-red-600">NULL — bağlı değil</em>}
                  </div>
                  {detail.affiliate.linkedUser && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded p-2">
                      ✓ <strong>Bağlı user:</strong> {detail.affiliate.linkedUser.first_name} {detail.affiliate.linkedUser.last_name}
                      <br /><span className="font-mono">{detail.affiliate.linkedUser.email}</span> · role: <strong>{detail.affiliate.linkedUser.role}</strong>
                    </div>
                  )}
                  {detail.affiliate.emailMatchUser && (
                    <div className={`border rounded p-2 ${detail.affiliate.user_id === detail.affiliate.emailMatchUser.id ? "bg-slate-50 border-slate-200" : "bg-amber-50 border-amber-200"}`}>
                      <strong>E-postayla bulunan user:</strong>{" "}
                      {detail.affiliate.emailMatchUser.first_name} {detail.affiliate.emailMatchUser.last_name} (id: {detail.affiliate.emailMatchUser.id})
                      <br /><span className="font-mono">{detail.affiliate.emailMatchUser.email}</span> · role: <strong>{detail.affiliate.emailMatchUser.role}</strong>
                      {detail.affiliate.user_id !== detail.affiliate.emailMatchUser.id && (
                        <button
                          onClick={async () => {
                            if (!confirm(`Affiliate'i user id=${detail.affiliate.emailMatchUser.id} ile bağla?`)) return;
                            try {
                              await apiFetch(`/admin/affiliates/${detail.affiliate.id}/bind-user`, {
                                method: "POST",
                                body: JSON.stringify({ userId: detail.affiliate.emailMatchUser.id }),
                              });
                              alert("Bağlandı + role=partner yapıldı");
                              await openDetail(detail.affiliate.id);
                            } catch (e: any) { setError(e.message); }
                          }}
                          className="mt-2 px-3 py-1 text-xs bg-blue-700 text-white rounded hover:bg-blue-800"
                        >
                          ✓ Bu user'a bağla
                        </button>
                      )}
                    </div>
                  )}
                  {!detail.affiliate.emailMatchUser && !detail.affiliate.user_id && (
                    <div className="bg-red-50 border border-red-200 rounded p-2 text-red-800">
                      ⚠ Bu e-posta ile kayıtlı bir kullanıcı YOK. Kullanıcının önce /register'dan bu e-postayla kayıt olması gerek.
                    </div>
                  )}
                </div>
              </Section>

              <Section label="Banka Bilgisi">
                {detail.affiliate.iban ? (
                  <div className="font-mono text-xs">
                    {detail.affiliate.iban}<br/>
                    {detail.affiliate.account_holder_name} · TC: {detail.affiliate.tc_number}
                  </div>
                ) : <span className="text-slate-400">Henüz girilmedi</span>}
              </Section>

              <Section label={`Komisyonlar (${detail.commissions?.length ?? 0})`}>
                {detail.commissions?.length === 0 ? <span className="text-slate-400">Yok</span> : (
                  <table className="w-full text-xs">
                    <tbody>
                      {detail.commissions.slice(0, 30).map((c: any) => (
                        <tr key={c.id} className="border-t border-slate-100">
                          <td className="py-1">{new Date(c.created_at).toLocaleDateString("tr-TR")}</td>
                          <td className="py-1">{c.source_type === "subscription" ? `Sub #${c.billing_cycle}` : "Ebook"}</td>
                          <td className="py-1 text-right">{tl(c.commission_kurus)}</td>
                          <td className="py-1 text-center"><StatusBadge status={c.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Section>

              <Section label={`Ödemeler (${detail.payouts?.length ?? 0})`}>
                {detail.payouts?.length === 0 ? <span className="text-slate-400">Yok</span> : detail.payouts.map((p: any) => (
                  <div key={p.id} className="border border-slate-100 rounded p-2 mb-2">
                    <div className="flex justify-between">
                      <span>{p.period_start} → {p.period_end}</span>
                      <span className="font-medium">{tl(p.amount_kurus)}</span>
                    </div>
                    <div className="flex justify-between mt-1 text-xs">
                      <StatusBadge status={p.status} />
                      {p.status === "pending" && (
                        <button onClick={() => markPaid(p.id)} className="text-blue-800 underline">Ödendi işaretle</button>
                      )}
                    </div>
                  </div>
                ))}
              </Section>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: any; icon: React.ReactNode; color: string }) {
  const m: Record<string, string> = {
    slate: "bg-slate-50 text-slate-700 border-slate-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    emerald: "bg-blue-50 text-blue-800 border-blue-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    rose: "bg-rose-50 text-rose-700 border-rose-200",
    violet: "bg-violet-50 text-violet-700 border-violet-200",
    sky: "bg-sky-50 text-sky-700 border-sky-200",
  };
  return (
    <div className={`border rounded-lg p-3 ${m[color]}`}>
      <div className="flex items-center gap-1.5 text-xs opacity-80 mb-1">{icon} {label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const m: Record<string, { c: string; t: string }> = {
    pending: { c: "bg-amber-100 text-amber-700", t: "Bekliyor" },
    active: { c: "bg-blue-100 text-blue-800", t: "Aktif" },
    approved: { c: "bg-blue-100 text-blue-700", t: "Onaylı" },
    paid: { c: "bg-blue-100 text-blue-800", t: "Ödendi" },
    suspended: { c: "bg-slate-100 text-slate-700", t: "Askıda" },
    rejected: { c: "bg-red-100 text-red-700", t: "Red" },
    refunded: { c: "bg-red-100 text-red-700", t: "İade" },
    cancelled: { c: "bg-slate-100 text-slate-700", t: "İptal" },
  };
  const x = m[status] ?? { c: "bg-slate-100", t: status };
  return <span className={`text-xs px-2 py-0.5 rounded-full ${x.c}`}>{x.t}</span>;
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase text-slate-400 font-medium mb-1">{label}</div>
      <div>{children}</div>
    </div>
  );
}
