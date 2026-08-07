import { useEffect, useMemo, useState } from "react";
import {
  Calendar, Clock, Users, Ban, Mail, Phone, MessageSquare,
  X, Loader2, RefreshCw, Check, Trash2, Plus, ExternalLink,
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
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.error || `HTTP ${res.status}`);
  return data;
}

// ─── Types ────────────────────────────────────────────────────────────
type Booking = {
  id: number;
  booking_date: string;
  start_time: string;
  end_time: string;
  duration_min: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  customer_company: string | null;
  message: string | null;
  status: "confirmed" | "cancelled" | "completed";
  admin_notes: string | null;
  meeting_link: string | null;
  created_at: string;
};

type Availability = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
};

type Block = {
  id: number;
  block_date: string;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
  created_at: string;
};

const DAY_NAMES = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("tr-TR", {
    day: "2-digit", month: "long", year: "numeric", weekday: "long",
  });
}
function fmtDateShort(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("tr-TR", {
    day: "2-digit", month: "short", year: "numeric",
  });
}
function fmtTime(t: string) {
  return t.slice(0, 5);
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("tr-TR", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

// ─── Ana bileşen ──────────────────────────────────────────────────────
export default function AdminDemo() {
  const [tab, setTab] = useState<"bookings" | "hours" | "blocks">("bookings");

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Calendar className="h-6 w-6 text-indigo-600" />
            Demo Randevu Sistemi
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Rezervasyonları yönet, mesai saatlerini ayarla, izin günlerini blockla.
          </p>
        </div>

        <div className="mb-4 flex gap-1 rounded-lg bg-white p-1 shadow-sm ring-1 ring-gray-200 w-fit">
          <TabBtn icon={Users} label="Rezervasyonlar" active={tab === "bookings"} onClick={() => setTab("bookings")} />
          <TabBtn icon={Clock} label="Mesai Saatleri" active={tab === "hours"} onClick={() => setTab("hours")} />
          <TabBtn icon={Ban} label="İzin & Blok" active={tab === "blocks"} onClick={() => setTab("blocks")} />
        </div>

        {tab === "bookings" && <BookingsTab />}
        {tab === "hours" && <HoursTab />}
        {tab === "blocks" && <BlocksTab />}
      </div>
    </div>
  );
}

function TabBtn({ icon: Icon, label, active, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${
        active ? "bg-indigo-600 text-white shadow" : "text-gray-600 hover:bg-gray-100"
      }`}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}

// ─── TAB 1: Rezervasyonlar ────────────────────────────────────────────
function BookingsTab() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"all" | "confirmed" | "cancelled" | "completed">("all");
  const [selected, setSelected] = useState<Booking | null>(null);

  async function load() {
    setLoading(true);
    try {
      const d = await apiFetch(`/admin/demo/bookings?status=${status}`);
      setBookings(d.bookings ?? []);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [status]);

  const upcoming = bookings.filter(b => b.status === "confirmed" && b.booking_date >= new Date().toISOString().slice(0, 10));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label="Toplam" count={bookings.length} color="indigo" />
        <StatTile label="Onaylı" count={bookings.filter(b => b.status === "confirmed").length} color="emerald" />
        <StatTile label="Bekleyen" count={upcoming.length} color="amber" />
        <StatTile label="İptal" count={bookings.filter(b => b.status === "cancelled").length} color="red" />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-1 rounded-lg bg-white p-1 shadow-sm ring-1 ring-gray-200 w-fit">
          {(["all", "confirmed", "cancelled", "completed"] as const).map((s) => (
            <button key={s} onClick={() => setStatus(s)} className={`px-3 py-1.5 text-xs font-medium rounded ${
              status === s ? "bg-indigo-600 text-white shadow" : "text-gray-600 hover:bg-gray-100"
            }`}>
              {s === "all" ? "Tümü" : s === "confirmed" ? "Onaylı" : s === "cancelled" ? "İptal" : "Tamamlandı"}
            </button>
          ))}
        </div>
        <button onClick={load} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <RefreshCw className="h-4 w-4" /> Yenile
        </button>
      </div>

      <div className="overflow-hidden rounded-lg bg-white shadow ring-1 ring-gray-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <Th>Tarih</Th><Th>Saat</Th><Th>Müşteri</Th><Th>İletişim</Th><Th>Durum</Th><Th></Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && <tr><td colSpan={6} className="p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-gray-400" /></td></tr>}
              {!loading && bookings.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-gray-500">Henüz rezervasyon yok.</td></tr>
              )}
              {!loading && bookings.map(b => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="p-3 text-xs text-gray-700">
                    <div className="font-medium">{fmtDateShort(b.booking_date)}</div>
                    <div className="text-gray-400">{DAY_NAMES[new Date(b.booking_date + "T00:00:00").getDay()]}</div>
                  </td>
                  <td className="p-3 text-xs font-mono font-semibold text-gray-900">
                    {fmtTime(b.start_time)} – {fmtTime(b.end_time)}
                  </td>
                  <td className="p-3">
                    <div className="font-medium text-gray-900">{b.customer_name}</div>
                    {b.customer_company && <div className="text-xs text-gray-500">{b.customer_company}</div>}
                  </td>
                  <td className="p-3 text-xs">
                    <a href={`mailto:${b.customer_email}`} className="text-indigo-600 hover:underline block">{b.customer_email}</a>
                    {b.customer_phone && (
                      <span className="text-gray-500">
                        {b.customer_phone} · <a href={`https://wa.me/${b.customer_phone.replace(/[^\d]/g, "")}`} target="_blank" rel="noreferrer" className="text-emerald-600 hover:underline">WA</a>
                      </span>
                    )}
                  </td>
                  <td className="p-3"><StatusChip status={b.status} /></td>
                  <td className="p-3 text-right">
                    <button onClick={() => setSelected(b)} className="text-xs font-medium text-indigo-600 hover:text-indigo-700">
                      Detay
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && <BookingDetailModal booking={selected} onClose={() => setSelected(null)} onChanged={load} />}
    </div>
  );
}

function StatTile({ label, count, color }: { label: string; count: number; color: "indigo" | "emerald" | "amber" | "red" }) {
  const bg = { indigo: "bg-indigo-50 text-indigo-700", emerald: "bg-emerald-50 text-emerald-700", amber: "bg-amber-50 text-amber-700", red: "bg-red-50 text-red-700" }[color];
  return (
    <div className={`rounded-lg p-3 ${bg}`}>
      <div className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</div>
      <div className="mt-1 text-2xl font-bold">{count}</div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">{children}</th>;
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    confirmed: { label: "Onaylı", className: "bg-emerald-100 text-emerald-800" },
    cancelled: { label: "İptal", className: "bg-red-100 text-red-800" },
    completed: { label: "Tamamlandı", className: "bg-gray-200 text-gray-800" },
  };
  const it = map[status] ?? { label: status, className: "bg-gray-100 text-gray-600" };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${it.className}`}>{it.label}</span>;
}

function BookingDetailModal({ booking, onClose, onChanged }: { booking: Booking; onClose: () => void; onChanged: () => void }) {
  const [status, setStatus] = useState(booking.status);
  const [notes, setNotes] = useState(booking.admin_notes || "");
  const [link, setLink] = useState(booking.meeting_link || "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await apiFetch(`/admin/demo/bookings/${booking.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, admin_notes: notes, meeting_link: link }),
      });
      onChanged();
      onClose();
    } catch (e: any) { alert(e?.message); }
    finally { setSaving(false); }
  }

  async function cancel() {
    if (!confirm("Bu randevu iptal edilsin mi?")) return;
    setSaving(true);
    try {
      await apiFetch(`/admin/demo/bookings/${booking.id}`, { method: "DELETE" });
      onChanged();
      onClose();
    } catch (e: any) { alert(e?.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <div className="h-full w-full max-w-lg overflow-y-auto bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-5 py-3">
          <h3 className="text-lg font-semibold">Randevu #{booking.id}</h3>
          <button onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="rounded-lg bg-indigo-50 border border-indigo-200 p-4 text-center">
            <div className="text-xs text-indigo-700 font-semibold uppercase tracking-wide">Tarih & Saat</div>
            <div className="mt-1 text-lg font-bold text-indigo-900">{fmtDate(booking.booking_date)}</div>
            <div className="text-indigo-700 font-mono">{fmtTime(booking.start_time)} – {fmtTime(booking.end_time)}</div>
          </div>

          <div className="space-y-2">
            <Field label="Müşteri" value={booking.customer_name} />
            <Field label="E-posta" value={<a href={`mailto:${booking.customer_email}`} className="text-indigo-600 hover:underline">{booking.customer_email}</a>} />
            {booking.customer_phone && (
              <Field label="Telefon" value={<>
                <a href={`tel:${booking.customer_phone.replace(/[^\d+]/g, "")}`} className="text-indigo-600 hover:underline">{booking.customer_phone}</a>
                {" · "}
                <a href={`https://wa.me/${booking.customer_phone.replace(/[^\d]/g, "")}`} target="_blank" rel="noreferrer" className="text-emerald-600 hover:underline">WhatsApp</a>
              </>} />
            )}
            {booking.customer_company && <Field label="Şirket" value={booking.customer_company} />}
            {booking.message && (
              <div className="rounded border-l-4 border-indigo-500 bg-gray-50 p-3">
                <div className="text-xs font-semibold text-gray-500 mb-1">Müşterinin Mesajı</div>
                <div className="text-sm text-gray-700 whitespace-pre-wrap">{booking.message}</div>
              </div>
            )}
          </div>

          <div className="border-t pt-4 space-y-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Durum</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="w-full rounded border-gray-300 px-3 py-2 text-sm">
                <option value="confirmed">Onaylı</option>
                <option value="completed">Tamamlandı</option>
                <option value="cancelled">İptal</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Görüşme Linki (Zoom/Meet/Jitsi)</label>
              <input type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://zoom.us/..." className="w-full rounded border-gray-300 px-3 py-2 text-sm font-mono" />
              {booking.meeting_link && (
                <a href={booking.meeting_link} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline">
                  <ExternalLink className="h-3 w-3" /> Mevcut linki aç
                </a>
              )}
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Dahili Notlar (müşteri görmez)</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full rounded border-gray-300 px-3 py-2 text-sm" />
            </div>
          </div>

          <div className="flex gap-2 border-t pt-4">
            <button onClick={cancel} disabled={saving} className="rounded bg-red-50 hover:bg-red-100 px-3 py-2 text-sm font-medium text-red-700 disabled:opacity-50">
              İptal Et
            </button>
            <button onClick={save} disabled={saving} className="ml-auto rounded bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin inline" /> : "Kaydet"}
            </button>
          </div>
          <div className="text-[11px] text-gray-400 text-center">
            Oluşturuldu: {fmtDateTime(booking.created_at)}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="text-sm"><span className="text-gray-500">{label}:</span> <span className="text-gray-900">{value}</span></div>;
}

// ─── TAB 2: Mesai Saatleri ────────────────────────────────────────────
function HoursTab() {
  const [items, setItems] = useState<Availability[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const d = await apiFetch("/admin/demo/availability");
      // Pazartesi'den başlayacak şekilde sırala (Türkiye standart)
      const sorted = [...(d.availability ?? [])].sort((a: any, b: any) => {
        const order = [1, 2, 3, 4, 5, 6, 0]; // Pzt, Sal, ..., Pzr
        return order.indexOf(a.day_of_week) - order.indexOf(b.day_of_week);
      });
      setItems(sorted);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  function updateItem(dow: number, patch: Partial<Availability>) {
    setItems(prev => prev.map(it => it.day_of_week === dow ? { ...it, ...patch } : it));
  }

  async function save() {
    setSaving(true); setMsg(null);
    try {
      await apiFetch("/admin/demo/availability", {
        method: "PUT",
        body: JSON.stringify({ items }),
      });
      setMsg("Kaydedildi ✓");
      setTimeout(() => setMsg(null), 2000);
    } catch (e: any) { alert(e?.message); }
    finally { setSaving(false); }
  }

  if (loading) return <Loader2 className="h-5 w-5 animate-spin text-gray-400 mx-auto" />;

  return (
    <div className="rounded-lg bg-white shadow ring-1 ring-gray-200 p-5">
      <div className="mb-4">
        <h3 className="font-semibold text-gray-900">Haftalık Mesai Saatleri</h3>
        <p className="text-xs text-gray-500 mt-1">
          Her gün için müsait olduğunuz saat aralığını belirleyin. Kapalı günler için "Kapalı" olarak işaretleyin.
          Randevular 30 dakikalık slot'lara bölünür.
        </p>
      </div>

      <div className="space-y-2">
        {items.map(it => (
          <div key={it.day_of_week} className="flex items-center gap-3 p-3 rounded border border-gray-200 hover:border-gray-300">
            <label className="flex items-center gap-2 min-w-[130px]">
              <input
                type="checkbox"
                checked={it.is_active}
                onChange={(e) => updateItem(it.day_of_week, { is_active: e.target.checked })}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className={`font-medium ${it.is_active ? "text-gray-900" : "text-gray-400 line-through"}`}>
                {DAY_NAMES[it.day_of_week]}
              </span>
            </label>
            <input
              type="time"
              value={fmtTime(it.start_time)}
              disabled={!it.is_active}
              onChange={(e) => updateItem(it.day_of_week, { start_time: e.target.value })}
              className="rounded border-gray-300 px-2 py-1 text-sm font-mono disabled:opacity-40 disabled:bg-gray-100"
            />
            <span className="text-gray-400">–</span>
            <input
              type="time"
              value={fmtTime(it.end_time)}
              disabled={!it.is_active}
              onChange={(e) => updateItem(it.day_of_week, { end_time: e.target.value })}
              className="rounded border-gray-300 px-2 py-1 text-sm font-mono disabled:opacity-40 disabled:bg-gray-100"
            />
            {it.is_active && (
              <span className="ml-auto text-xs text-gray-400">
                {Math.floor((parseInt(it.end_time.slice(0, 2)) * 60 + parseInt(it.end_time.slice(3, 5)) - parseInt(it.start_time.slice(0, 2)) * 60 - parseInt(it.start_time.slice(3, 5))) / 30)} slot
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-end gap-3">
        {msg && <span className="text-sm text-emerald-600 font-medium">{msg}</span>}
        <button onClick={save} disabled={saving} className="rounded bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin inline" /> : "Değişiklikleri Kaydet"}
        </button>
      </div>
    </div>
  );
}

// ─── TAB 3: İzin & Blok ───────────────────────────────────────────────
function BlocksTab() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const d = await apiFetch("/admin/demo/blocks");
      setBlocks(d.blocks ?? []);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function del(id: number) {
    if (!confirm("Bu engel silinsin mi?")) return;
    try {
      await apiFetch(`/admin/demo/blocks/${id}`, { method: "DELETE" });
      load();
    } catch (e: any) { alert(e?.message); }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-semibold text-gray-900">Engellenen Tarih/Saatler</h3>
          <p className="text-xs text-gray-500 mt-1">İzinli olduğunuz tarihleri, tatilleri veya belirli saatleri buraya ekleyin.</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-1.5 rounded bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white">
          <Plus className="h-4 w-4" /> Yeni Engel
        </button>
      </div>

      {loading ? <Loader2 className="h-5 w-5 animate-spin text-gray-400 mx-auto" /> : (
        <div className="rounded-lg bg-white shadow ring-1 ring-gray-200">
          {blocks.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">Şu an aktif bir engel yok.</div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr><Th>Tarih</Th><Th>Saat Aralığı</Th><Th>Sebep</Th><Th></Th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {blocks.map(b => (
                  <tr key={b.id} className="hover:bg-gray-50">
                    <td className="p-3 font-medium">{fmtDateShort(b.block_date)}</td>
                    <td className="p-3 text-sm text-gray-700">
                      {b.start_time && b.end_time
                        ? <span className="font-mono">{fmtTime(b.start_time)} – {fmtTime(b.end_time)}</span>
                        : <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full font-medium">Tüm gün</span>}
                    </td>
                    <td className="p-3 text-sm text-gray-600">{b.reason || "—"}</td>
                    <td className="p-3 text-right">
                      <button onClick={() => del(b.id)} className="text-xs text-red-600 hover:text-red-700 inline-flex items-center gap-1">
                        <Trash2 className="h-3 w-3" /> Sil
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {showAdd && <AddBlockModal onClose={() => setShowAdd(false)} onAdded={() => { setShowAdd(false); load(); }} />}
    </div>
  );
}

function AddBlockModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [fullDay, setFullDay] = useState(true);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await apiFetch("/admin/demo/blocks", {
        method: "POST",
        body: JSON.stringify({
          block_date: date,
          start_time: fullDay ? undefined : startTime,
          end_time: fullDay ? undefined : endTime,
          reason,
        }),
      });
      onAdded();
    } catch (e: any) { alert(e?.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h3 className="text-lg font-semibold">Yeni Engel Ekle</h3>
          <button onClick={onClose}><X className="h-5 w-5 text-gray-400" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Tarih</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded border-gray-300 px-3 py-2 text-sm" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={fullDay} onChange={(e) => setFullDay(e.target.checked)} />
            Tüm gün engelle
          </label>
          {!fullDay && (
            <div className="flex gap-2 items-center">
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="rounded border-gray-300 px-2 py-1 text-sm font-mono" />
              <span>–</span>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="rounded border-gray-300 px-2 py-1 text-sm font-mono" />
            </div>
          )}
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Sebep (opsiyonel)</label>
            <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Örn: Yıllık izin, konferans, doktor" className="w-full rounded border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div className="flex justify-end gap-2 border-t pt-3">
            <button onClick={onClose} className="rounded border border-gray-300 px-3 py-1.5 text-sm">Kapat</button>
            <button onClick={save} disabled={saving} className="rounded bg-indigo-600 hover:bg-indigo-500 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin inline" /> : "Kaydet"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
