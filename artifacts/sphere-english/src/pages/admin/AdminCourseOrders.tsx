import { useEffect, useState, useMemo } from "react";
import {
  GraduationCap,
  RefreshCw,
  Loader2,
  AlertCircle,
  Search,
  Phone,
  Mail,
  CheckCircle2,
  Clock,
  XCircle,
  FileText,
  X as XIcon,
  Filter,
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

interface CourseOrder {
  id: number;
  order_token: string;
  programme_slug: string;
  programme_title: string;
  buyer_name: string;
  buyer_email: string;
  buyer_phone: string;
  iyzico_conversation_id: string | null;
  iyzico_payment_id: string | null;
  amount_kurus: number;
  currency: string;
  status: string; // pending / paid / failed / registered
  paid_at: string | null;
  tc_kimlik: string | null;
  age: number | null;
  sector: string | null;
  gender: string | null;
  registration_completed_at: string | null;
  admin_notes: string | null;
  assigned_group_id: number | null;
  contacted_at: string | null;
  created_at: string;
  updated_at: string;
}

function formatPrice(kurus: number) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 }).format(kurus / 100);
}
function formatDT(d: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  return dt.toLocaleString("tr-TR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function statusBadge(s: string) {
  const map: Record<string, { label: string; cls: string; Icon: any }> = {
    pending:    { label: "Bekliyor",   cls: "bg-amber-100 text-amber-800 border-amber-200",   Icon: Clock },
    paid:       { label: "Ödendi",     cls: "bg-blue-100 text-blue-800 border-blue-200",       Icon: CheckCircle2 },
    registered: { label: "Kayıt Tamam",cls: "bg-emerald-100 text-emerald-800 border-emerald-200", Icon: CheckCircle2 },
    failed:     { label: "Başarısız",  cls: "bg-red-100 text-red-800 border-red-200",          Icon: XCircle },
  };
  const b = map[s] ?? { label: s, cls: "bg-gray-100 text-gray-700 border-gray-200", Icon: AlertCircle };
  const Icon = b.Icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${b.cls}`}>
      <Icon className="w-3 h-3" />
      {b.label}
    </span>
  );
}

export default function AdminCourseOrders() {
  const [items, setItems] = useState<CourseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selected, setSelected] = useState<CourseOrder | null>(null);

  async function load() {
    setLoading(true);
    try {
      const qs = statusFilter === "all" ? "" : `?status=${encodeURIComponent(statusFilter)}`;
      const data = await apiFetch(`/admin/course-orders${qs}`);
      setItems(data.orders ?? []);
    } catch (e: any) {
      alert("Yüklenemedi: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [statusFilter]);

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.trim().toLowerCase();
    return items.filter((o) =>
      o.buyer_name?.toLowerCase().includes(q) ||
      o.buyer_email?.toLowerCase().includes(q) ||
      o.buyer_phone?.toLowerCase().includes(q) ||
      o.programme_title?.toLowerCase().includes(q) ||
      o.order_token?.toLowerCase().includes(q)
    );
  }, [items, search]);

  const stats = useMemo(() => {
    const totalPaid = items.filter((o) => o.status === "paid" || o.status === "registered").reduce((s, o) => s + Number(o.amount_kurus), 0);
    const counts = {
      pending: items.filter((o) => o.status === "pending").length,
      paid: items.filter((o) => o.status === "paid").length,
      registered: items.filter((o) => o.status === "registered").length,
      failed: items.filter((o) => o.status === "failed").length,
    };
    return { totalPaid, counts };
  }, [items]);

  async function markContacted(id: number) {
    setBusy(id);
    try {
      await apiFetch(`/admin/course-orders/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ contacted_at: new Date().toISOString() }),
      });
      await load();
      if (selected && selected.id === id) {
        setSelected({ ...selected, contacted_at: new Date().toISOString() });
      }
    } catch (e: any) {
      alert("Hata: " + e.message);
    } finally {
      setBusy(null);
    }
  }

  async function saveNotes(id: number, notes: string) {
    setBusy(id);
    try {
      await apiFetch(`/admin/course-orders/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ admin_notes: notes }),
      });
      await load();
    } catch (e: any) {
      alert("Hata: " + e.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#0ea5e9]/10 flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-[#0ea5e9]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#1B365D]">Kurs Satışları</h1>
            <p className="text-sm text-gray-500">Sipariş takibi, iletişim durumu, kayıt bilgileri</p>
          </div>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4" />
          Yenile
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Toplam Ciro</div>
          <div className="text-xl font-extrabold text-[#1B365D] mt-1">{formatPrice(stats.totalPaid)}</div>
        </div>
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
          <div className="text-[10px] uppercase tracking-widest text-amber-700 font-bold">Bekliyor</div>
          <div className="text-xl font-extrabold text-amber-900 mt-1">{stats.counts.pending}</div>
        </div>
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
          <div className="text-[10px] uppercase tracking-widest text-blue-700 font-bold">Ödendi</div>
          <div className="text-xl font-extrabold text-blue-900 mt-1">{stats.counts.paid}</div>
        </div>
        <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4">
          <div className="text-[10px] uppercase tracking-widest text-emerald-700 font-bold">Kayıt Tamam</div>
          <div className="text-xl font-extrabold text-emerald-900 mt-1">{stats.counts.registered}</div>
        </div>
        <div className="bg-red-50 rounded-xl border border-red-200 p-4">
          <div className="text-[10px] uppercase tracking-widest text-red-700 font-bold">Başarısız</div>
          <div className="text-xl font-extrabold text-red-900 mt-1">{stats.counts.failed}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ad, email, telefon, program ara..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-[#0ea5e9] focus:ring-2 focus:ring-[#0ea5e9]/20 outline-none"
          />
        </div>
        <div className="flex items-center gap-1 text-sm">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-[#0ea5e9] focus:ring-2 focus:ring-[#0ea5e9]/20 outline-none"
          >
            <option value="all">Tüm durumlar</option>
            <option value="pending">Bekliyor</option>
            <option value="paid">Ödendi</option>
            <option value="registered">Kayıt Tamam</option>
            <option value="failed">Başarısız</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-500">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
          <AlertCircle className="w-10 h-10" />
          <p>Sipariş bulunamadı.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-[11px] uppercase tracking-widest">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Alıcı</th>
                <th className="text-left px-4 py-3 font-semibold">Program</th>
                <th className="text-left px-4 py-3 font-semibold">Tutar</th>
                <th className="text-left px-4 py-3 font-semibold">Durum</th>
                <th className="text-left px-4 py-3 font-semibold">İletişim</th>
                <th className="text-left px-4 py-3 font-semibold">Tarih</th>
                <th className="text-right px-4 py-3 font-semibold">Aksiyon</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((o) => (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-[#1B365D]">{o.buyer_name}</div>
                    <div className="text-[12px] text-gray-500">{o.buyer_email}</div>
                    <div className="text-[12px] text-gray-500">{o.buyer_phone}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800">{o.programme_title}</div>
                    <div className="text-[11px] text-gray-400">{o.programme_slug}</div>
                  </td>
                  <td className="px-4 py-3 font-bold text-[#1B365D]">{formatPrice(o.amount_kurus)}</td>
                  <td className="px-4 py-3">{statusBadge(o.status)}</td>
                  <td className="px-4 py-3 text-[12px]">
                    {o.contacted_at ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="w-3.5 h-3.5" />İletişim Kuruldu</span>
                    ) : (
                      <span className="text-amber-700">Beklemede</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[12px] text-gray-500">{formatDT(o.paid_at ?? o.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setSelected(o)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-[12px] font-semibold text-[#1B365D]"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Detay
                      </button>
                      {(o.status === "paid" || o.status === "registered") && !o.contacted_at && (
                        <button
                          onClick={() => markContacted(o.id)}
                          disabled={busy === o.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-semibold disabled:opacity-50"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          Arandı
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Drawer */}
      {selected && (
        <DetailDrawer
          order={selected}
          onClose={() => setSelected(null)}
          onMarkContacted={() => markContacted(selected.id)}
          onSaveNotes={(notes) => saveNotes(selected.id, notes)}
          busy={busy === selected.id}
        />
      )}
    </div>
  );
}

function DetailDrawer({
  order, onClose, onMarkContacted, onSaveNotes, busy,
}: {
  order: CourseOrder;
  onClose: () => void;
  onMarkContacted: () => void;
  onSaveNotes: (notes: string) => void;
  busy: boolean;
}) {
  const [notes, setNotes] = useState(order.admin_notes ?? "");

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/40" onClick={onClose}>
      <div className="w-full max-w-xl bg-white shadow-2xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-[#0ea5e9] font-bold">Sipariş Detayı</div>
            <div className="font-bold text-[#1B365D] text-lg">{order.programme_title}</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center">
            <XIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Alıcı */}
          <section>
            <h3 className="text-sm font-bold text-[#1B365D] mb-3">Alıcı Bilgileri</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Field label="Ad Soyad" value={order.buyer_name} />
              <Field label="E-posta" value={order.buyer_email} />
              <Field label="Telefon" value={order.buyer_phone} />
              <Field label="TC Kimlik" value={order.tc_kimlik ?? "—"} />
              <Field label="Yaş" value={order.age?.toString() ?? "—"} />
              <Field label="Cinsiyet" value={order.gender ?? "—"} />
              <Field label="Sektör" value={order.sector ?? "—"} className="col-span-2" />
            </div>
          </section>

          {/* Ödeme */}
          <section>
            <h3 className="text-sm font-bold text-[#1B365D] mb-3">Ödeme Bilgileri</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Field label="Tutar" value={formatPrice(order.amount_kurus)} />
              <Field label="Durum" value={<>{statusBadge(order.status)}</>} />
              <Field label="Order Token" value={<code className="text-[10px] font-mono text-gray-600">{order.order_token}</code>} className="col-span-2" />
              <Field label="Iyzico Payment ID" value={order.iyzico_payment_id ?? "—"} className="col-span-2" />
              <Field label="Ödeme Tarihi" value={formatDT(order.paid_at)} />
              <Field label="Kayıt Tamam" value={formatDT(order.registration_completed_at)} />
            </div>
          </section>

          {/* Yönetim */}
          <section>
            <h3 className="text-sm font-bold text-[#1B365D] mb-3">Yönetim</h3>
            <div className="grid grid-cols-1 gap-3">
              <Field label="İletişim Durumu" value={
                order.contacted_at
                  ? <span className="text-emerald-700 font-semibold">İletişim kuruldu — {formatDT(order.contacted_at)}</span>
                  : <span className="text-amber-700 font-semibold">Henüz iletişime geçilmedi</span>
              } />
              <Field label="Atanan Grup ID" value={order.assigned_group_id?.toString() ?? "—"} />
              <div>
                <div className="text-[11px] uppercase tracking-widest text-gray-400 font-bold mb-1">Admin Notları</div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  placeholder="Konuşma özeti, sonraki adım, grup ataması vb."
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-[#0ea5e9] focus:ring-2 focus:ring-[#0ea5e9]/20 outline-none"
                />
              </div>
            </div>
          </section>

          {/* Aksiyon */}
          <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-100">
            {!order.contacted_at && (order.status === "paid" || order.status === "registered") && (
              <button
                onClick={onMarkContacted}
                disabled={busy}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                Arandı Olarak İşaretle
              </button>
            )}
            <button
              onClick={() => onSaveNotes(notes)}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0ea5e9] hover:bg-[#0284c7] text-white text-sm font-semibold disabled:opacity-50"
            >
              Notları Kaydet
            </button>
            <a
              href={`mailto:${order.buyer_email}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-[#1B365D] text-sm font-semibold"
            >
              <Mail className="w-4 h-4" />
              E-posta
            </a>
            <a
              href={`https://wa.me/${order.buyer_phone.replace(/\D/g, '')}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-[#1B365D] text-sm font-semibold"
            >
              <Phone className="w-4 h-4" />
              WhatsApp
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, className = "" }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="text-[11px] uppercase tracking-widest text-gray-400 font-bold">{label}</div>
      <div className="text-[#1B365D] mt-0.5">{value ?? "—"}</div>
    </div>
  );
}
