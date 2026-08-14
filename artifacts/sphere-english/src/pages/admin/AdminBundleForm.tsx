import { useEffect, useState, useRef } from "react";
import {
  X, Save, Loader2, AlertCircle, Check, BookOpen, Star,
  Search, Package, Upload, Image as ImageIcon, Trash2,
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

interface Ebook {
  id: number;
  slug: string;
  title: string;
  author: string;
  price_try: string;
  cover_image_url: string | null;
  is_active: boolean;
}

interface FormState {
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  coverImageUrl: string;
  priceTry: string;
  listPriceTry: string;
  discountEndsAt: string;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: string;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
}

const emptyForm: FormState = {
  slug: "",
  title: "",
  subtitle: "",
  description: "",
  coverImageUrl: "",
  priceTry: "",
  listPriceTry: "",
  discountEndsAt: "",
  isActive: true,
  isFeatured: false,
  sortOrder: "0",
  seoTitle: "",
  seoDescription: "",
  seoKeywords: "",
};

export default function AdminBundleForm({
  bundleId,
  onClose,
}: {
  bundleId: number | null;
  onClose: (saved: boolean) => void;
}) {
  const isEdit = bundleId !== null;
  const [form, setForm] = useState<FormState>(emptyForm);
  const [selectedEbookIds, setSelectedEbookIds] = useState<number[]>([]);
  const [ebooks, setEbooks] = useState<Ebook[]>([]);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tüm kitapları yükle
  useEffect(() => {
    (async () => {
      try {
        const data = await apiFetch("/admin/ebooks");
        setEbooks((data.ebooks ?? []).filter((e: Ebook) => e.is_active));
      } catch (e: any) {
        setError("Kitaplar yüklenemedi: " + e.message);
      }
    })();
  }, []);

  // Mevcut bundle bilgilerini yükle (düzenleme modu)
  useEffect(() => {
    if (!bundleId) return;
    (async () => {
      setLoading(true);
      try {
        const data = await apiFetch(`/admin/bundles/${bundleId}`);
        const b = data.bundle;
        setForm({
          slug: b.slug ?? "",
          title: b.title ?? "",
          subtitle: b.subtitle ?? "",
          description: b.description ?? "",
          coverImageUrl: b.cover_image_url ?? "",
          priceTry: String(b.price_try ?? ""),
          listPriceTry: b.list_price_try ? String(b.list_price_try) : "",
          discountEndsAt: b.discount_ends_at ? new Date(b.discount_ends_at).toISOString().slice(0, 16) : "",
          isActive: !!b.is_active,
          isFeatured: !!b.is_featured,
          sortOrder: String(b.sort_order ?? 0),
          seoTitle: b.seo_title ?? "",
          seoDescription: b.seo_description ?? "",
          seoKeywords: b.seo_keywords ?? "",
        });
        setSelectedEbookIds((data.items ?? []).map((i: any) => Number(i.id)));
      } catch (e: any) {
        setError("Paket yüklenemedi: " + e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [bundleId]);

  function update<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function toggleEbook(id: number) {
    setSelectedEbookIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  const filteredEbooks = ebooks.filter((e) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      e.title.toLowerCase().includes(q) ||
      e.author.toLowerCase().includes(q) ||
      e.slug.toLowerCase().includes(q)
    );
  });

  const individualTotal = selectedEbookIds.reduce((sum, id) => {
    const e = ebooks.find((x) => x.id === id);
    return sum + (e ? Number(e.price_try) : 0);
  }, 0);

  const bundlePrice = Number(form.priceTry || 0);
  const savings = individualTotal - bundlePrice;
  const savingsPercent = individualTotal > 0 ? Math.round((savings / individualTotal) * 100) : 0;

  async function uploadCover(file: File) {
    if (!bundleId) {
      setError("Kapak yüklemek için önce paketi kaydet");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("Sadece görsel dosyaları (JPG/PNG/WebP)");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Dosya boyutu 5 MB'ı aşıyor");
      return;
    }

    setUploadingCover(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);

      const token = localStorage.getItem(TOKEN_KEY);
      const res = await fetch(`${API}/admin/bundles/${bundleId}/cover`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();

      // Form'daki cover URL'i güncelle + preview göster
      update("coverImageUrl", data.url);
      const previewUrl = URL.createObjectURL(file);
      setCoverPreviewUrl(previewUrl);
      setMessage("Kapak yüklendi");
    } catch (e: any) {
      setError("Kapak yüklenemedi: " + e.message);
    } finally {
      setUploadingCover(false);
    }
  }

  async function deleteCover() {
    if (!bundleId) return;
    if (!confirm("Kapak görselini silmek istediğinden emin misin?")) return;
    try {
      await apiFetch(`/admin/bundles/${bundleId}/cover`, { method: "DELETE" });
      update("coverImageUrl", "");
      setCoverPreviewUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setMessage("Kapak silindi");
    } catch (e: any) {
      setError("Silme hatası: " + e.message);
    }
  }

  async function handleSave() {
    setError(null);
    setMessage(null);

    if (!form.title.trim()) return setError("Başlık zorunlu");
    if (!form.priceTry || Number(form.priceTry) <= 0) return setError("Geçerli bir fiyat gir");
    if (selectedEbookIds.length < 2) return setError("Pakete en az 2 kitap eklemelisin");

    setSaving(true);
    try {
      const payload = {
        slug: form.slug.trim() || undefined,
        title: form.title.trim(),
        subtitle: form.subtitle.trim() || null,
        description: form.description.trim() || null,
        coverImageUrl: form.coverImageUrl.trim() || null,
        priceTry: Number(form.priceTry),
        listPriceTry: form.listPriceTry ? Number(form.listPriceTry) : null,
        discountEndsAt: form.discountEndsAt ? new Date(form.discountEndsAt).toISOString() : null,
        isActive: form.isActive,
        isFeatured: form.isFeatured,
        sortOrder: Number(form.sortOrder || 0),
        seoTitle: form.seoTitle.trim() || null,
        seoDescription: form.seoDescription.trim() || null,
        seoKeywords: form.seoKeywords.trim() || null,
        ebookIds: selectedEbookIds,
      };

      if (isEdit) {
        await apiFetch(`/admin/bundles/${bundleId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        // Item'ları ayrı endpoint ile güncelle
        await apiFetch(`/admin/bundles/${bundleId}/items`, {
          method: "POST",
          body: JSON.stringify({ ebookIds: selectedEbookIds }),
        });
        setMessage("Paket güncellendi");
      } else {
        await apiFetch("/admin/bundles", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setMessage("Paket oluşturuldu");
      }

      setTimeout(() => onClose(true), 500);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[92vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center z-10">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Package className="w-5 h-5 text-indigo-600" />
              {isEdit ? "Paketi Düzenle" : "Yeni Paket"}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Birden fazla kitabı tek fiyata sat
            </p>
          </div>
          <button
            onClick={() => onClose(false)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto" />
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Alerts */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div className="text-sm text-red-700">{error}</div>
              </div>
            )}
            {message && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
                <Check className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                <div className="text-sm text-green-700">{message}</div>
              </div>
            )}

            {/* Temel bilgi */}
            <section>
              <h3 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wider">
                Temel Bilgi
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Başlık <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={form.title}
                    onChange={(e) => update("title", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    placeholder="İş İngilizcesi Seti — 5 Kitap"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Slug (URL)
                  </label>
                  <input
                    value={form.slug}
                    onChange={(e) => update("slug", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono"
                    placeholder="is-ingilizcesi-seti (boş bırak → otomatik)"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Sıralama
                  </label>
                  <input
                    type="number"
                    value={form.sortOrder}
                    onChange={(e) => update("sortOrder", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    placeholder="0"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Alt başlık
                  </label>
                  <input
                    value={form.subtitle}
                    onChange={(e) => update("subtitle", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    placeholder="Kariyerine yön veren 5 kitaplık seri"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Açıklama
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) => update("description", e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    placeholder="Bu paket şunları kapsar…"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-2">
                    Kapak Görseli
                  </label>

                  {/* Mevcut kapak preview */}
                  {(coverPreviewUrl || form.coverImageUrl) && (
                    <div className="mb-3 flex items-start gap-3 p-3 bg-gray-50 rounded-lg border">
                      <img
                        src={coverPreviewUrl || (form.coverImageUrl.startsWith("http")
                          ? form.coverImageUrl
                          : `${API}${form.coverImageUrl}`)}
                        alt="Kapak"
                        className="w-24 h-32 object-cover rounded border"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                      <div className="flex-1 text-xs text-gray-600">
                        <div className="font-mono break-all mb-2">{form.coverImageUrl}</div>
                        {isEdit && (
                          <button
                            type="button"
                            onClick={deleteCover}
                            className="inline-flex items-center gap-1 px-2 py-1 text-red-600 hover:bg-red-50 rounded text-xs"
                          >
                            <Trash2 className="w-3 h-3" /> Kapağı Sil
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Upload alanı — sadece kaydettikten sonra */}
                  {isEdit ? (
                    <div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) uploadCover(file);
                        }}
                        className="hidden"
                        id="cover-upload-input"
                      />
                      <label
                        htmlFor="cover-upload-input"
                        className={`inline-flex items-center gap-2 px-3 py-2 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition ${
                          uploadingCover ? "opacity-50 pointer-events-none" : ""
                        }`}
                      >
                        {uploadingCover ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4 text-gray-600" />
                        )}
                        <span className="text-sm">
                          {uploadingCover ? "Yükleniyor…" : "Bilgisayardan Yükle (JPG/PNG, max 5MB)"}
                        </span>
                      </label>
                      <div className="mt-2 text-xs text-gray-500">
                        veya harici URL kullan:
                      </div>
                      <input
                        value={form.coverImageUrl}
                        onChange={(e) => update("coverImageUrl", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono mt-1"
                        placeholder="https://…"
                      />
                    </div>
                  ) : (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                      💡 <strong>Not:</strong> Dosya yükleme sadece paketi kaydettikten sonra çalışır.
                      Şimdilik harici URL girebilir veya sonra Düzenle'den yükleyebilirsin.
                      <input
                        value={form.coverImageUrl}
                        onChange={(e) => update("coverImageUrl", e.target.value)}
                        className="w-full px-3 py-2 border border-amber-200 rounded-lg text-sm font-mono mt-2 bg-white"
                        placeholder="https://… (opsiyonel)"
                      />
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Fiyatlandırma */}
            <section>
              <h3 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wider">
                Fiyatlandırma
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Paket Fiyatı (TL) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.priceTry}
                    onChange={(e) => update("priceTry", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    placeholder="499"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Liste Fiyatı (üstü çizili — opsiyonel)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.listPriceTry}
                    onChange={(e) => update("listPriceTry", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    placeholder="799"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    İndirim Bitiş Tarihi (geri sayım için — opsiyonel)
                  </label>
                  <input
                    type="datetime-local"
                    value={form.discountEndsAt}
                    onChange={(e) => update("discountEndsAt", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                  <div className="text-[11px] text-gray-500 mt-1">
                    Belirlerse ürün sayfasında "X gün Y saat kaldı" geri sayımı gösterilir.
                  </div>
                </div>
              </div>

              {selectedEbookIds.length > 0 && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-xs text-gray-500">Tekil toplam</div>
                      <div className="font-semibold">{individualTotal.toFixed(0)} TL</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Paket fiyatı</div>
                      <div className="font-semibold text-indigo-700">
                        {(bundlePrice || 0).toFixed(0)} TL
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Kazanç</div>
                      <div className={`font-semibold ${savings > 0 ? "text-green-700" : "text-gray-500"}`}>
                        {savings > 0 ? `${savings.toFixed(0)} TL (%${savingsPercent})` : "—"}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* Kitap seçimi */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
                  Kitaplar
                  <span className="ml-2 text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-normal">
                    {selectedEbookIds.length} seçili
                  </span>
                </h3>
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Ara…"
                    className="pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm w-48"
                  />
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg max-h-96 overflow-y-auto divide-y">
                {filteredEbooks.length === 0 ? (
                  <div className="text-center py-8 text-sm text-gray-500">
                    {search ? "Arama sonucu yok" : "Aktif kitap yok"}
                  </div>
                ) : (
                  filteredEbooks.map((e) => {
                    const selected = selectedEbookIds.includes(e.id);
                    return (
                      <label
                        key={e.id}
                        className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50 ${
                          selected ? "bg-indigo-50" : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleEbook(e.id)}
                          className="w-4 h-4 text-indigo-600 rounded"
                        />
                        {e.cover_image_url ? (
                          <img
                            src={e.cover_image_url}
                            alt={e.title}
                            className="w-8 h-11 object-cover rounded border"
                            onError={(ev) => ((ev.target as HTMLImageElement).style.display = "none")}
                          />
                        ) : (
                          <div className="w-8 h-11 bg-gray-100 rounded border flex items-center justify-center">
                            <BookOpen className="w-4 h-4 text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">{e.title}</div>
                          <div className="text-xs text-gray-500 truncate">
                            {e.author} · /{e.slug}
                          </div>
                        </div>
                        <div className="text-sm font-semibold text-gray-700 shrink-0">
                          {Number(e.price_try).toFixed(0)} TL
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                💡 Pakete en az <strong>2 kitap</strong> eklemelisin. İşaretlediğin sıra kaydedildiği pozisyon olur.
              </p>
            </section>

            {/* Görünürlük */}
            <section>
              <h3 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wider">
                Görünürlük
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => update("isActive", e.target.checked)}
                    className="w-4 h-4 text-green-600 rounded"
                  />
                  <div>
                    <div className="text-sm font-medium">Aktif</div>
                    <div className="text-xs text-gray-500">www'de görünür</div>
                  </div>
                </label>
                <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={form.isFeatured}
                    onChange={(e) => update("isFeatured", e.target.checked)}
                    className="w-4 h-4 text-amber-600 rounded"
                  />
                  <div>
                    <div className="text-sm font-medium flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 text-amber-500" /> Öne Çıkan
                    </div>
                    <div className="text-xs text-gray-500">Ana sayfada ilk sırada</div>
                  </div>
                </label>
              </div>
            </section>

            {/* SEO — collapsible */}
            <details className="group">
              <summary className="cursor-pointer text-sm font-bold text-gray-700 uppercase tracking-wider">
                SEO Ayarları <span className="text-xs text-gray-400 font-normal">(opsiyonel)</span>
              </summary>
              <div className="mt-3 grid grid-cols-1 gap-3">
                <input
                  value={form.seoTitle}
                  onChange={(e) => update("seoTitle", e.target.value)}
                  placeholder="SEO Title"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
                <textarea
                  value={form.seoDescription}
                  onChange={(e) => update("seoDescription", e.target.value)}
                  placeholder="SEO Description (160 karakter)"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
                <input
                  value={form.seoKeywords}
                  onChange={(e) => update("seoKeywords", e.target.value)}
                  placeholder="SEO Keywords (virgülle ayır)"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
            </details>
          </div>
        )}

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex justify-end gap-2">
          <button
            onClick={() => onClose(false)}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
          >
            İptal
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-indigo-300"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Kaydediliyor…" : isEdit ? "Güncelle" : "Oluştur"}
          </button>
        </div>
      </div>
    </div>
  );
}
