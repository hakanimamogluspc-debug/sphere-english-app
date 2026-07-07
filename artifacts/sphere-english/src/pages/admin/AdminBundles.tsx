import { useEffect, useState } from "react";
import {
  Package, Plus, Edit3, Trash2, Eye, EyeOff, Star, StarOff,
  RefreshCw, Loader2, AlertCircle, Layers, TrendingUp,
} from "lucide-react";
import { API } from "@/lib/api-url";
import AdminBundleForm from "./AdminBundleForm";

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

function tl(amount: number | string | null | undefined): string {
  const n = Number(amount ?? 0);
  return n.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + " TL";
}

interface BundleRow {
  id: number;
  slug: string;
  title: string;
  subtitle: string | null;
  cover_image_url: string | null;
  price_try: string;
  list_price_try: string | null;
  currency: string;
  is_active: boolean;
  is_featured: boolean;
  sort_order: number;
  item_count: number;
  sales_count: number;
  created_at: string;
  updated_at: string;
}

export default function AdminBundles() {
  const [bundles, setBundles] = useState<BundleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  async function loadBundles() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch("/admin/bundles");
      setBundles(data.bundles ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBundles();
  }, []);

  async function toggleActive(id: number) {
    try {
      await apiFetch(`/admin/bundles/${id}/toggle`, { method: "POST" });
      await loadBundles();
    } catch (e: any) {
      alert("Durum değiştirilemedi: " + e.message);
    }
  }

  async function toggleFeatured(bundle: BundleRow) {
    try {
      await apiFetch(`/admin/bundles/${bundle.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isFeatured: !bundle.is_featured }),
      });
      await loadBundles();
    } catch (e: any) {
      alert("Öne çıkarma değiştirilemedi: " + e.message);
    }
  }

  async function deleteBundle(bundle: BundleRow) {
    if (bundle.sales_count > 0) {
      alert(
        `Bu paketin ${bundle.sales_count} adet satışı var. Silinemez.\n\n` +
        `Bunun yerine "Aktif/Pasif" toggle ile gizleyebilirsiniz.`,
      );
      return;
    }
    if (!confirm(`"${bundle.title}" paketini silmek istediğinden emin misin?`)) return;
    try {
      await apiFetch(`/admin/bundles/${bundle.id}`, { method: "DELETE" });
      await loadBundles();
    } catch (e: any) {
      alert("Silinemedi: " + e.message);
    }
  }

  function openNewForm() {
    setEditingId(null);
    setFormOpen(true);
  }

  function openEditForm(id: number) {
    setEditingId(id);
    setFormOpen(true);
  }

  function onFormClose(saved: boolean) {
    setFormOpen(false);
    setEditingId(null);
    if (saved) loadBundles();
  }

  const totalSales = bundles.reduce((sum, b) => sum + Number(b.sales_count ?? 0), 0);
  const activeCount = bundles.filter((b) => b.is_active).length;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Package className="w-6 h-6 text-indigo-600" />
            E-Kitap Paketleri
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Birden fazla kitabı tek fiyata sat — indirimli paketler oluştur
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadBundles}
            className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" /> Yenile
          </button>
          <button
            onClick={openNewForm}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            <Plus className="w-4 h-4" /> Yeni Paket
          </button>
        </div>
      </div>

      {/* Özet kartlar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-lg border p-4">
          <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
            <Layers className="w-3 h-3" />
            Toplam Paket
          </div>
          <div className="text-2xl font-bold text-gray-900">{bundles.length}</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-xs text-green-600 mb-1">Aktif</div>
          <div className="text-2xl font-bold text-green-700">{activeCount}</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-xs text-amber-600 mb-1 flex items-center gap-1">
            <Star className="w-3 h-3" />
            Öne Çıkan
          </div>
          <div className="text-2xl font-bold text-amber-700">
            {bundles.filter((b) => b.is_featured).length}
          </div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-xs text-blue-600 mb-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            Toplam Satış
          </div>
          <div className="text-2xl font-bold text-blue-700">{totalSales}</div>
        </div>
      </div>

      {/* Hata */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-sm text-red-700">{error}</div>
        </div>
      )}

      {/* Yükleniyor */}
      {loading && (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto" />
          <p className="text-sm text-gray-500 mt-2">Paketler yükleniyor…</p>
        </div>
      )}

      {/* Boş durum */}
      {!loading && bundles.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg border-2 border-dashed">
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="font-medium text-gray-700 mb-1">Henüz paket yok</p>
          <p className="text-sm text-gray-500 mb-4">
            İlk paketini oluşturarak birden fazla kitabı tek fiyata satmaya başla.
          </p>
          <button
            onClick={openNewForm}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            <Plus className="w-4 h-4" /> İlk Paketi Oluştur
          </button>
        </div>
      )}

      {/* Bundle listesi */}
      {!loading && bundles.length > 0 && (
        <div className="bg-white rounded-lg border overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-gray-50 text-xs uppercase text-gray-600">
              <tr>
                <th className="text-left px-4 py-3">Paket</th>
                <th className="text-center px-2 py-3 whitespace-nowrap">Kitap</th>
                <th className="text-right px-3 py-3 whitespace-nowrap">Fiyat</th>
                <th className="text-center px-2 py-3 whitespace-nowrap">Satış</th>
                <th className="text-center px-2 py-3 whitespace-nowrap">Öne Çıkan</th>
                <th className="text-center px-2 py-3 whitespace-nowrap">Aktif</th>
                <th className="text-right px-4 py-3 whitespace-nowrap sticky right-0 bg-gray-50">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {bundles.map((b) => {
                const hasDiscount = b.list_price_try && Number(b.list_price_try) > Number(b.price_try);
                return (
                  <tr key={b.id} className={!b.is_active ? "bg-gray-50/50 opacity-70" : ""}>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => openEditForm(b.id)}
                        className="flex items-center gap-3 text-left hover:opacity-80 transition group w-full"
                        title="Düzenle"
                      >
                        {b.cover_image_url ? (
                          <img
                            src={b.cover_image_url.startsWith("http") ? b.cover_image_url : `${API}${b.cover_image_url}`}
                            alt={b.title}
                            className="w-10 h-14 object-cover rounded border"
                            onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
                          />
                        ) : (
                          <div className="w-10 h-14 bg-gradient-to-br from-indigo-100 to-purple-100 rounded border flex items-center justify-center">
                            <Package className="w-5 h-5 text-indigo-400" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900 truncate group-hover:text-indigo-600">
                            {b.title}
                          </div>
                          <div className="text-xs text-gray-500 font-mono truncate">/{b.slug}</div>
                          {b.subtitle && (
                            <div className="text-xs text-gray-500 truncate mt-0.5">{b.subtitle}</div>
                          )}
                        </div>
                      </button>
                    </td>
                    <td className="text-center px-2 py-3">
                      <span className="inline-block bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded font-semibold">
                        {b.item_count}
                      </span>
                    </td>
                    <td className="text-right px-3 py-3">
                      <div className="font-semibold text-gray-900">{tl(b.price_try)}</div>
                      {hasDiscount && (
                        <div className="text-xs text-gray-400 line-through">{tl(b.list_price_try)}</div>
                      )}
                    </td>
                    <td className="text-center px-2 py-3">
                      <span className={`text-sm font-medium ${b.sales_count > 0 ? "text-green-700" : "text-gray-400"}`}>
                        {b.sales_count}
                      </span>
                    </td>
                    <td className="text-center px-2 py-3">
                      <button
                        onClick={() => toggleFeatured(b)}
                        className="p-1 hover:bg-gray-100 rounded"
                        title={b.is_featured ? "Öne çıkarma kaldır" : "Öne çıkar"}
                      >
                        {b.is_featured ? (
                          <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                        ) : (
                          <StarOff className="w-5 h-5 text-gray-300" />
                        )}
                      </button>
                    </td>
                    <td className="text-center px-2 py-3">
                      <button
                        onClick={() => toggleActive(b.id)}
                        className="p-1 hover:bg-gray-100 rounded"
                        title={b.is_active ? "Pasifleştir" : "Aktifleştir"}
                      >
                        {b.is_active ? (
                          <Eye className="w-5 h-5 text-green-600" />
                        ) : (
                          <EyeOff className="w-5 h-5 text-gray-400" />
                        )}
                      </button>
                    </td>
                    <td className={`px-4 py-3 text-right sticky right-0 ${
                      !b.is_active ? "bg-gray-50/95" : "bg-white/95"
                    } backdrop-blur-sm border-l`}>
                      <div className="inline-flex gap-1">
                        <button
                          onClick={() => openEditForm(b.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded text-xs font-medium"
                          title="Düzenle"
                        >
                          <Edit3 className="w-3.5 h-3.5" /> Düzenle
                        </button>
                        <button
                          onClick={() => deleteBundle(b)}
                          className={`p-1.5 rounded ${
                            b.sales_count > 0
                              ? "text-gray-300 cursor-not-allowed"
                              : "text-red-600 hover:bg-red-50"
                          }`}
                          title={b.sales_count > 0 ? "Satış olduğu için silinemez" : "Sil"}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Form modal */}
      {formOpen && <AdminBundleForm bundleId={editingId} onClose={onFormClose} />}
    </div>
  );
}
