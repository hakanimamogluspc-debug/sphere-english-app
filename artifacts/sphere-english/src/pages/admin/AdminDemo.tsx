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
  const [tab, setTab] = useState<"calendar" | "bookings" | "hours" | "blocks">("calendar");

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Calendar className="h-6 w-6 text-indigo-600" />
            Demo Randevu Sistemi
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Takvimden randevu ekle, rezervasyonları yönet, mesai saatlerini ayarla.
          </p>
        </div>

        <div className="mb-4 flex gap-1 rounded-lg bg-white p-1 shadow-sm ring-1 ring-gray-200 w-fit">
          <TabBtn icon={Calendar} label="Takvim" active={tab === "calendar"} onClick={() => setTab("calendar")} />
          <TabBtn icon={Users} label="Rezervasyonlar" active={tab === "bookings"} onClick={() => setTab("bookings")} />
          <TabBtn icon={Clock} label="Mesai Saatleri" active={tab === "hours"} onClick={() => setTab("hours")} />
          <TabBtn icon={Ban} label="İzin & Blok" active={tab === "blocks"} onClick={() => setTab("blocks")} />
        </div>

        {tab === "calendar" && <CalendarTab />}
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

  async function saveAndSendLink() {
    if (!link.trim()) { alert("Önce görüşme linkini gir"); return; }
    if (!confirm(`Görüşme linki ${booking.customer_email} adresine mail olarak gönderilsin mi?`)) return;
    setSaving(true);
    try {
      // Önce kaydet (status/notes değişmiş olabilir)
      await apiFetch(`/admin/demo/bookings/${booking.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, admin_notes: notes, meeting_link: link }),
      });
      // Sonra maille
      const r = await apiFetch(`/admin/demo/bookings/${booking.id}/send-meeting-link`, {
        method: "POST",
        body: JSON.stringify({ meeting_link: link }),
      });
      alert(`Link gönderildi: ${r.sent_to}`);
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

          <div className="flex flex-wrap gap-2 border-t pt-4">
            <button onClick={cancel} disabled={saving} className="rounded bg-red-50 hover:bg-red-100 px-3 py-2 text-sm font-medium text-red-700 disabled:opacity-50">
              İptal Et
            </button>
            <button
              onClick={saveAndSendLink}
              disabled={saving || !link.trim()}
              title={!link.trim() ? "Önce Zoom/Meet linkini gir" : "Kaydet + linki müşteriye maille"}
              className="ml-auto rounded bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <>📧 Kaydet + Linki Gönder</>}
            </button>
            <button onClick={save} disabled={saving} className="rounded bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin inline" /> : "Sadece Kaydet"}
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

// ─── TAB 0: Takvim (admin görünümü) ───────────────────────────────────
const MONTH_LABELS = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

function fmtMonthKey(y: number, m: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}`;
}
function fmtDateKey(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

type CalSlot = {
  start: string;
  end: string;
  available: boolean;
  reason?: string;
  booking?: Booking;
  isBlocked?: boolean;
};

function CalendarTab() {
  const today = useMemo(() => new Date(), []);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [days, setDays] = useState<Record<string, string>>({});
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<CalSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotAction, setSlotAction] = useState<{ slot: CalSlot; date: string } | null>(null);

  async function loadMonth() {
    setLoadingMonth(true);
    try {
      const key = fmtMonthKey(year, month);
      const d = await apiFetch(`/demo/availability?month=${key}`);
      setDays(d.days ?? {});
    } finally { setLoadingMonth(false); }
  }
  useEffect(() => { loadMonth(); }, [year, month]);

  async function loadSlotsForDate(date: string) {
    setLoadingSlots(true);
    try {
      const [slotsRes, bookRes] = await Promise.all([
        apiFetch(`/demo/slots?date=${date}`),
        apiFetch(`/admin/demo/bookings?status=confirmed`).catch(() => ({ bookings: [] })),
      ]);
      const rawSlots: CalSlot[] = slotsRes.slots ?? [];
      const bookings: Booking[] = (bookRes.bookings ?? []).filter((b: Booking) => b.booking_date === date);

      const enriched: CalSlot[] = rawSlots.map((s) => {
        const booking = bookings.find((b) => fmtTime(b.start_time) === s.start);
        return {
          ...s,
          booking,
          isBlocked: !s.available && !booking && s.reason !== "too-soon",
        };
      });
      setSlots(enriched);
    } finally { setLoadingSlots(false); }
  }

  useEffect(() => {
    if (selectedDate) loadSlotsForDate(selectedDate);
    else setSlots([]);
  }, [selectedDate]);

  function prevMonth() {
    const d = new Date(year, month - 1, 1);
    setYear(d.getFullYear()); setMonth(d.getMonth());
    setSelectedDate(null); setSlots([]);
  }
  function nextMonth() {
    const d = new Date(year, month + 1, 1);
    setYear(d.getFullYear()); setMonth(d.getMonth());
    setSelectedDate(null); setSlots([]);
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const startOffset = (firstDayOfMonth + 6) % 7;

  const cells: Array<{ day: number | null; date?: string; status?: string }> = [];
  for (let i = 0; i < startOffset; i++) cells.push({ day: null });
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = fmtDateKey(year, month, d);
    cells.push({ day: d, date: dateStr, status: days[dateStr] });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white rounded-lg shadow ring-1 ring-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600">‹</button>
          <div className="text-lg font-bold text-gray-900">{MONTH_LABELS[month]} {year}</div>
          <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600">›</button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-2 text-center text-[11px] font-semibold text-gray-500">
          {["Pzt", "Sal", "Çar", "Per", "Cum", "Cts", "Pzr"].map((d) => <div key={d}>{d}</div>)}
        </div>

        <div className="grid grid-cols-7 gap-1 relative">
          {loadingMonth && <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10 text-xs text-gray-500">Yükleniyor…</div>}
          {cells.map((c, i) => {
            if (c.day === null) return <div key={i} className="aspect-square" />;
            const isSelected = selectedDate === c.date;
            const status = c.status;

            let cls = "aspect-square rounded-lg flex items-center justify-center text-sm cursor-pointer transition ";
            if (isSelected) cls += "bg-indigo-600 text-white font-bold shadow-md";
            else if (status === "available") cls += "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-semibold";
            else if (status === "full") cls += "bg-amber-100 text-amber-700 hover:bg-amber-200 font-semibold";
            else if (status === "blocked") cls += "bg-red-50 text-red-600 hover:bg-red-100";
            else if (status === "closed") cls += "bg-gray-50 text-gray-400 hover:bg-gray-100";
            else if (status === "past") cls += "bg-gray-100 text-gray-400 hover:bg-gray-200 italic";
            else cls += "text-gray-400";

            return (
              <button key={i} onClick={() => setSelectedDate(c.date!)} className={cls}>{c.day}</button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap gap-3 text-[11px]">
          <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300"></span>Müsait</div>
          <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-200"></span>Dolu</div>
          <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-100"></span>Engelli</div>
          <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-gray-100"></span>Mesai dışı</div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow ring-1 ring-gray-200 p-5">
        {!selectedDate ? (
          <div className="text-center py-16 text-gray-400 text-sm">
            <Calendar className="mx-auto h-10 w-10 mb-2 opacity-40" />
            <p>Takvimden bir gün seçin</p>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">Seçili gün</p>
                <h3 className="text-lg font-bold text-gray-900">{fmtDate(selectedDate)}</h3>
              </div>
            </div>

            {loadingSlots ? (
              <div className="text-center py-8"><Loader2 className="mx-auto h-5 w-5 animate-spin text-gray-400" /></div>
            ) : slots.length === 0 ? (
              <div className="text-center py-8 text-sm text-gray-500">
                Bu gün için mesai tanımlı değil. Yine de manuel randevu eklemek için aşağıdaki butonu kullanabilirsin.
                <button
                  onClick={() => setSlotAction({ slot: { start: "10:00", end: "10:30", available: true }, date: selectedDate })}
                  className="mt-3 inline-flex items-center gap-1 rounded bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white"
                >
                  <Plus className="h-3.5 w-3.5" /> Manuel Randevu Ekle
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {slots.map((slot) => {
                  let cls = "py-2 px-2 rounded border-2 text-xs font-semibold text-center transition cursor-pointer ";
                  let label = slot.start;
                  let title = "";
                  if (slot.booking) {
                    cls += "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100";
                    label = `${slot.start} · ${slot.booking.customer_name.split(" ")[0]}`;
                    title = `${slot.booking.customer_name} — ${slot.booking.customer_email}`;
                  } else if (slot.isBlocked) {
                    cls += "border-red-200 bg-red-50 text-red-700 hover:bg-red-100";
                    title = "Engelli / mesai dışı";
                  } else if (slot.reason === "too-soon") {
                    cls += "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 opacity-70";
                    title = "24 saatten yakın — public'e görünmez ama admin manuel ekleyebilir";
                  } else {
                    cls += "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100";
                    title = "Boş — tıklayıp manuel randevu ekle veya engelleyebilirsin";
                  }
                  return (
                    <button
                      key={slot.start}
                      onClick={() => setSlotAction({ slot, date: selectedDate })}
                      className={cls}
                      title={title}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-3 text-[11px] text-gray-600">
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-50 border border-emerald-300"></span>Boş</div>
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-50 border border-amber-300"></span>Randevu var</div>
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-50 border border-red-300"></span>Engelli</div>
            </div>
          </>
        )}
      </div>

      {slotAction && (
        <SlotActionModal
          date={slotAction.date}
          slot={slotAction.slot}
          onClose={() => setSlotAction(null)}
          onChanged={() => { setSlotAction(null); loadMonth(); if (selectedDate) loadSlotsForDate(selectedDate); }}
        />
      )}
    </div>
  );
}

function SlotActionModal({
  date, slot, onClose, onChanged,
}: { date: string; slot: CalSlot; onClose: () => void; onChanged: () => void }) {
  const [mode, setMode] = useState<"select" | "add" | "block" | "view">(slot.booking ? "view" : "select");
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addCompany, setAddCompany] = useState("");
  const [addMessage, setAddMessage] = useState("");
  const [addTime, setAddTime] = useState(slot.start);
  const [addNotes, setAddNotes] = useState("Sistem dışı — telefon/WhatsApp");
  const [sendMail, setSendMail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [blockStart, setBlockStart] = useState(slot.start);
  const [blockEnd, setBlockEnd] = useState(slot.end);

  async function addBooking() {
    if (!addName.trim()) { alert("İsim gerekli"); return; }
    setSaving(true);
    try {
      await apiFetch("/admin/demo/bookings", {
        method: "POST",
        body: JSON.stringify({
          date, time: addTime, name: addName, email: addEmail, phone: addPhone,
          company: addCompany, message: addMessage, admin_notes: addNotes,
          skip_email: !sendMail, force: !!slot.booking,
        }),
      });
      onChanged();
    } catch (e: any) { alert(e?.message); }
    finally { setSaving(false); }
  }

  async function addBlock() {
    setSaving(true);
    try {
      await apiFetch("/admin/demo/blocks", {
        method: "POST",
        body: JSON.stringify({
          block_date: date, start_time: blockStart, end_time: blockEnd,
          reason: blockReason || "Admin engel",
        }),
      });
      onChanged();
    } catch (e: any) { alert(e?.message); }
    finally { setSaving(false); }
  }

  async function cancelBooking() {
    if (!slot.booking) return;
    if (!confirm(`${slot.booking.customer_name} — bu randevu iptal edilsin mi?`)) return;
    setSaving(true);
    try {
      await apiFetch(`/admin/demo/bookings/${slot.booking.id}`, { method: "DELETE" });
      onChanged();
    } catch (e: any) { alert(e?.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b px-5 py-3">
          <div>
            <h3 className="text-lg font-semibold">
              {mode === "add" ? "Manuel Randevu Ekle"
                : mode === "block" ? "Zaman Engelle"
                : mode === "view" ? "Rezervasyon Detayı"
                : "Slot İşlemi"}
            </h3>
            <p className="text-xs text-gray-500">{fmtDate(date)} · {slot.start}</p>
          </div>
          <button onClick={onClose}><X className="h-5 w-5 text-gray-400" /></button>
        </div>

        {mode === "select" && (
          <div className="p-5 space-y-3">
            <p className="text-sm text-gray-600 mb-2"><strong>{slot.start} – {slot.end}</strong> için ne yapmak istersin?</p>
            <button onClick={() => setMode("add")} className="w-full flex items-center gap-3 p-3 rounded-lg border-2 border-emerald-200 hover:bg-emerald-50 text-left">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center"><Plus className="h-5 w-5 text-emerald-700" /></div>
              <div>
                <div className="font-semibold text-gray-900">Manuel Randevu Ekle</div>
                <div className="text-xs text-gray-500">Sistem dışı (telefon, WhatsApp) alınan randevu</div>
              </div>
            </button>
            <button onClick={() => setMode("block")} className="w-full flex items-center gap-3 p-3 rounded-lg border-2 border-red-200 hover:bg-red-50 text-left">
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center"><Ban className="h-5 w-5 text-red-700" /></div>
              <div>
                <div className="font-semibold text-gray-900">Bu Saati Engelle</div>
                <div className="text-xs text-gray-500">Kimse rezervasyon alamasın (izin/toplantı)</div>
              </div>
            </button>
          </div>
        )}

        {mode === "add" && (
          <div className="p-5 space-y-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Saat</label>
              <input type="time" value={addTime} onChange={(e) => setAddTime(e.target.value)} className="rounded border-gray-300 px-3 py-2 text-sm font-mono" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Müşteri Adı *</label>
              <input type="text" required value={addName} onChange={(e) => setAddName(e.target.value)} className="w-full rounded border-gray-300 px-3 py-2 text-sm" placeholder="Ad Soyad" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">E-posta</label>
                <input type="email" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} className="w-full rounded border-gray-300 px-3 py-2 text-sm" placeholder="opsiyonel" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Telefon</label>
                <input type="tel" value={addPhone} onChange={(e) => setAddPhone(e.target.value)} className="w-full rounded border-gray-300 px-3 py-2 text-sm" placeholder="+90 5XX..." />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Şirket (opsiyonel)</label>
              <input type="text" value={addCompany} onChange={(e) => setAddCompany(e.target.value)} className="w-full rounded border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Mesaj / Not</label>
              <textarea rows={2} value={addMessage} onChange={(e) => setAddMessage(e.target.value)} className="w-full rounded border-gray-300 px-3 py-2 text-sm" placeholder="Müşterinin talebi" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Dahili Not (Müşteri Görmez)</label>
              <input type="text" value={addNotes} onChange={(e) => setAddNotes(e.target.value)} className="w-full rounded border-gray-300 px-3 py-2 text-sm" />
            </div>
            {addEmail && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={sendMail} onChange={(e) => setSendMail(e.target.checked)} />
                Müşteriye onay maili gönder
              </label>
            )}
            <div className="flex gap-2 border-t pt-3">
              <button onClick={() => setMode("select")} className="rounded border border-gray-300 px-3 py-1.5 text-sm">Geri</button>
              <button onClick={addBooking} disabled={saving} className="ml-auto rounded bg-emerald-600 hover:bg-emerald-700 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin inline" /> : "Randevuyu Ekle"}
              </button>
            </div>
          </div>
        )}

        {mode === "block" && (
          <div className="p-5 space-y-3">
            <p className="text-sm text-gray-600 mb-2">Bu saat aralığını public rezervasyona kapat.</p>
            <div className="flex items-center gap-2">
              <input type="time" value={blockStart} onChange={(e) => setBlockStart(e.target.value)} className="rounded border-gray-300 px-2 py-1 text-sm font-mono" />
              <span>–</span>
              <input type="time" value={blockEnd} onChange={(e) => setBlockEnd(e.target.value)} className="rounded border-gray-300 px-2 py-1 text-sm font-mono" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Sebep (opsiyonel)</label>
              <input type="text" value={blockReason} onChange={(e) => setBlockReason(e.target.value)} className="w-full rounded border-gray-300 px-3 py-2 text-sm" placeholder="Örn: Toplantı, doktor, dış görüşme" />
            </div>
            <div className="flex gap-2 border-t pt-3">
              <button onClick={() => setMode("select")} className="rounded border border-gray-300 px-3 py-1.5 text-sm">Geri</button>
              <button onClick={addBlock} disabled={saving} className="ml-auto rounded bg-red-600 hover:bg-red-700 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin inline" /> : "Engelle"}
              </button>
            </div>
          </div>
        )}

        {mode === "view" && slot.booking && (
          <div className="p-5 space-y-3">
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
              <div className="text-xs text-amber-700 font-semibold uppercase tracking-wide mb-1">Rezervasyon</div>
              <div className="font-bold text-gray-900">{slot.booking.customer_name}</div>
              {slot.booking.customer_company && <div className="text-xs text-gray-600">{slot.booking.customer_company}</div>}
            </div>
            <Field label="E-posta" value={<a href={`mailto:${slot.booking.customer_email}`} className="text-indigo-600 hover:underline">{slot.booking.customer_email}</a>} />
            {slot.booking.customer_phone && (
              <Field label="Telefon" value={<>
                <a href={`tel:${slot.booking.customer_phone.replace(/[^\d+]/g, "")}`} className="text-indigo-600 hover:underline">{slot.booking.customer_phone}</a>
                {" · "}
                <a href={`https://wa.me/${slot.booking.customer_phone.replace(/[^\d]/g, "")}`} target="_blank" rel="noreferrer" className="text-emerald-600 hover:underline">WhatsApp</a>
              </>} />
            )}
            {slot.booking.message && (
              <div className="rounded border-l-4 border-indigo-500 bg-gray-50 p-3 text-sm">{slot.booking.message}</div>
            )}
            {slot.booking.admin_notes && (
              <div className="rounded bg-yellow-50 border border-yellow-200 p-2 text-xs text-yellow-900">
                <strong>Dahili not:</strong> {slot.booking.admin_notes}
              </div>
            )}
            <div className="flex gap-2 border-t pt-3">
              <button onClick={cancelBooking} disabled={saving} className="rounded bg-red-50 hover:bg-red-100 px-3 py-1.5 text-sm font-medium text-red-700 disabled:opacity-50">
                Randevuyu İptal Et
              </button>
              <button onClick={onClose} className="ml-auto rounded border border-gray-300 px-3 py-1.5 text-sm">Kapat</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
