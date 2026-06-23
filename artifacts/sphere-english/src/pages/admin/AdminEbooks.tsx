import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  BookOpen, Plus, Edit3, Trash2, Eye, EyeOff, Star, RefreshCw, Loader2, AlertCircle,
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

interface EbookRow {
  id: number;
  slug: string;
  title: string;
  subtitle: string | null;
  author: string;
  price_try: string;
  list_price_try: string | null;
  is_active: boolean;
  is_featured: boolean;
  published_at: string;
  updated_at: string;
  asset_count: number;
}

function formatTRY(amount: string | number | null) {
  if (amount == null) return "—";
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(n);
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function AdminEbooks() {
  const [, setLocation] = useLocation();
  const [items, setItems] = useState<EbookRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await apiFetch("/admin/ebooks");
      setItems(data.ebooks ?? []);
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
      await apiFetch(`/admin/ebooks/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !current }),
      });
      await load();
    } catch (e: any) {
      alert("Hata: " + e.message);
    } finally {
      setBusy(null);
    }
  }

  async function toggleFeatured(id: number, current: boolean) {
    setBusy(id);
    try {
      await apiFetch(`/admin/ebooks/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isFeatured: !current }),
      });
      await load();
    } catch (e: any) {
      alert("Hata: " + e.message);
    } finally {
      setBusy(null);
    }
  }

  async function deleteEbook(id: number, title: string) {
    if (!confirm(`"${title}" kitabını ve tüm görsellerini silmek istediğine emin misin?`)) return;
    setBusy(id);
    try {
      await apiFetch(`/admin/ebooks/${id}`, { method: "DELETE" });
      await load();
    } catch (e: any) {
      alert("Silinemedi: " + e.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <BookOpen className="w-7 h-7 text-purple-600" />
          <h1 className="text-2xl font-bold text-slate-900">E-Kitap Yönetimi</h1>
        </div>
        <button
          onClick={() => setLocation("/admin/ebooks/yeni")}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold shadow-sm"
        >
          <Plus size={16} /> Yeni Kitap
        </button>
      </div>
      <p className="text-sm text-slate-500 mb-6">
        Pazarlama sitesinde satışa sunulan dijital kitap kataloğu. Görseller ve PDF buradan yüklenir.
      </p>

      <div className="flex items-center justify-end mb-3">
        <button onClick={load} className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700">
          <RefreshCw size={14} /> Yenile
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin inline-block mr-2" />
          Yükleniyor…
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-xl">
          <AlertCircle className="w-10 h-10 mx-auto text-slate-300 mb-3" />
          <div className="text-slate-500 mb-4">Henüz kitap eklenmemiş.</div>
          <button
            onClick={() => setLocation("/admin/ebooks/yeni")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold"
          >
            <Plus size={14} /> İlk Kitabı Ekle
          </button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="text-left p-3">Kitap</th>
                <th className="text-left p-3">Yazar</th>
                <th className="text-left p-3">Fiyat</th>
                <th className="text-center p-3">Asset</th>
                <th className="text-center p-3">Durum</th>
                <th className="text-left p-3">Güncellendi</th>
                <th className="text-right p-3">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {items.map((b) => (
                <tr key={b.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50">
                  <td className="p-3">
                    <div className="font-bold text-sm text-slate-900">{b.title}</div>
                    {b.subtitle && <div className="text-xs text-slate-500 line-clamp-1">{b.subtitle}</div>}
                    <div className="text-[11px] text-slate-400 mt-0.5">/{b.slug}</div>
                  </td>
                  <td className="p-3 text-sm text-slate-700">{b.author}</td>
                  <td className="p-3">
                    {b.list_price_try && parseFloat(b.list_price_try) > parseFloat(b.price_try) && (
                      <div className="text-[10px] text-slate-400 line-through">{formatTRY(b.list_price_try)}</div>
                    )}
                    <div className="font-bold text-sm text-slate-900">{formatTRY(b.price_try)}</div>
                  </td>
                  <td className="p-3 text-center">
                    <span className="px-2 py-1 rounded bg-slate-100 text-slate-700 text-xs font-bold">
                      {b.asset_count}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => toggleActive(b.id, b.is_active)}
                        disabled={busy === b.id}
                        className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                          b.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                        }`}
                        title={b.is_active ? "Yayında — pasif yap" : "Pasif — yayına al"}
                      >
                        {b.is_active ? "Yayında" : "Pasif"}
                      </button>
                      <button
                        onClick={() => toggleFeatured(b.id, b.is_featured)}
                        disabled={busy === b.id}
                        className={`p-1 rounded ${b.is_featured ? "text-amber-500" : "text-slate-300"}`}
                        title={b.is_featured ? "Öne çıkarıldı" : "Öne çıkar"}
                      >
                        <Star size={14} fill={b.is_featured ? "currentColor" : "none"} />
                      </button>
                    </div>
                  </td>
                  <td className="p-3 text-xs text-slate-500">{formatDate(b.updated_at)}</td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setLocation(`/admin/ebooks/${b.id}`)}
                        className="p-1.5 rounded hover:bg-slate-100 text-slate-600"
                        title="Düzenle"
                      >
                        <Edit3 size={16} />
                      </button>
                      <a
                        href={`https://www.sphereenglish.com/e-kitaplar/${b.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded hover:bg-slate-100 text-slate-600"
                        title="Sitede gör"
                      >
                        {b.is_active ? <Eye size={16} /> : <EyeOff size={16} />}
                      </a>
                      <button
                        onClick={() => deleteEbook(b.id, b.title)}
                        disabled={busy === b.id}
                        className="p-1.5 rounded hover:bg-red-50 text-red-500"
                        title="Sil"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
