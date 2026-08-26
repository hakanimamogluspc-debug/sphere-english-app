import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  GraduationCap, Plus, Edit3, Trash2, Eye, EyeOff, RefreshCw, Loader2, AlertCircle, Calendar, Users,
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
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
  return res.json();
}

interface CourseRow {
  id: number;
  slug: string;
  title: string;
  title_en: string | null;
  subtitle: string | null;
  level: string | null;
  level_cefr: string | null;
  price_kurus: number;
  price_display: string | null;
  cohort_status: string;
  cohort_start_display: string | null;
  cohort_capacity: number;
  cohort_registrations: number;
  is_active: boolean;
  sort_order: number;
  updated_at: string;
}

function formatPrice(kurus: number) {
  const tl = kurus / 100;
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(tl);
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });
}

function cohortBadge(status: string) {
  const map: Record<string, { label: string; cls: string }> = {
    open: { label: "Kayıt Açık", cls: "bg-emerald-100 text-emerald-800 border-emerald-200" },
    waitlist: { label: "Ön Kayıt", cls: "bg-amber-100 text-amber-800 border-amber-200" },
    full: { label: "Dolu", cls: "bg-red-100 text-red-800 border-red-200" },
    closed: { label: "Kapalı", cls: "bg-gray-100 text-gray-700 border-gray-200" },
  };
  const b = map[status] ?? { label: status, cls: "bg-gray-100 text-gray-700 border-gray-200" };
  return <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold border ${b.cls}`}>{b.label}</span>;
}

export default function AdminCourses() {
  const [, setLocation] = useLocation();
  const [items, setItems] = useState<CourseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await apiFetch("/admin/courses");
      setItems(data.courses ?? []);
    } catch (e: any) {
      alert("Yüklenemedi: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function toggleActive(id: number, current: boolean) {
    setBusy(id);
    try {
      await apiFetch(`/admin/courses/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !current }),
      });
      await load();
    } catch (e: any) {
      alert("Hata: " + e.message);
    } finally {
      setBusy(null);
    }
  }

  async function softDelete(id: number, title: string) {
    if (!confirm(`"${title}" kursunu pasif hale getirmek istediğine emin misin?`)) return;
    setBusy(id);
    try {
      await apiFetch(`/admin/courses/${id}`, { method: "DELETE" });
      await load();
    } catch (e: any) {
      alert("Hata: " + e.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#0ea5e9]/10 flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-[#0ea5e9]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#1B365D]">Kurs Yönetimi</h1>
            <p className="text-sm text-gray-500">Kursları düzenle, yeni kurs oluştur, kohort/tarih ayarla</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
            title="Yenile"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setLocation("/admin/kurslar/yeni")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0ea5e9] hover:bg-[#0284c7] text-white text-sm font-semibold"
          >
            <Plus className="w-4 h-4" />
            Yeni Kurs
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-500">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
          <AlertCircle className="w-10 h-10" />
          <p>Henüz kurs yok. "Yeni Kurs" ile başla.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {items.map((c) => (
            <div key={c.id} className={`rounded-xl border ${c.is_active ? "border-gray-200 bg-white" : "border-gray-200 bg-gray-50 opacity-60"} p-5`}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#0ea5e9]">{c.level_cefr ?? c.level ?? "—"}</span>
                    {cohortBadge(c.cohort_status)}
                  </div>
                  <h3 className="font-bold text-[#1B365D] text-lg leading-tight truncate">{c.title}</h3>
                  {c.title_en && <p className="text-xs text-gray-500 italic mt-0.5 truncate">{c.title_en}</p>}
                  {c.subtitle && <p className="text-sm text-gray-600 mt-2 line-clamp-2">{c.subtitle}</p>}
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-[10px] uppercase tracking-wide text-gray-400">Fiyat</div>
                  <div className="text-xl font-extrabold text-[#1B365D]">{formatPrice(c.price_kurus)}</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 mb-4 text-xs text-gray-500">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {c.cohort_start_display ?? "Tarih yok"}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  {c.cohort_registrations}/{c.cohort_capacity} kayıt
                </span>
                <span className="text-gray-400">Güncellendi: {formatDate(c.updated_at)}</span>
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                <button
                  onClick={() => setLocation(`/admin/kurslar/${c.id}`)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1B365D] hover:bg-[#0F2547] text-white text-xs font-semibold"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Düzenle
                </button>
                <button
                  onClick={() => toggleActive(c.id, c.is_active)}
                  disabled={busy === c.id}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold disabled:opacity-50 ${
                    c.is_active
                      ? "border-gray-300 text-gray-700 hover:bg-gray-100"
                      : "border-emerald-500 text-emerald-700 hover:bg-emerald-50"
                  }`}
                >
                  {c.is_active ? <><EyeOff className="w-3.5 h-3.5" />Pasif Yap</> : <><Eye className="w-3.5 h-3.5" />Aktif Yap</>}
                </button>
                <button
                  onClick={() => softDelete(c.id, c.title)}
                  disabled={busy === c.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-300 text-red-700 hover:bg-red-50 text-xs font-semibold disabled:opacity-50 ml-auto"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Sil
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
