import { useEffect, useState, useRef } from "react";
import { useLocation, useRoute } from "wouter";
import {
  ArrowLeft, Save, Loader2, Upload, Trash2, Image as ImageIcon, FileText, Star,
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

async function uploadFile(ebookId: number, file: File, assetType: string) {
  const token = localStorage.getItem(TOKEN_KEY);
  const fd = new FormData();
  fd.append("file", file);
  fd.append("assetType", assetType);
  const res = await fetch(`${API}/admin/ebooks/${ebookId}/assets`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
  return res.json();
}

interface Asset {
  id: number;
  asset_type: string;
  position: number;
  filename: string;
  mime_type: string;
  size_bytes: number;
}

interface FormState {
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  longDescription: string;
  tableOfContents: string;
  author: string;
  publisher: string;
  isbn: string;
  language: string;
  contentLanguage: string;
  seriesSlug: string;
  seriesOrder: string;
  seriesTitle: string;
  pageCount: string;
  readingTimeMin: string;
  category: string;
  tagsText: string;
  priceTry: string;
  listPriceTry: string;
  isActive: boolean;
  isFeatured: boolean;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
}

const EMPTY_FORM: FormState = {
  slug: "", title: "", subtitle: "", description: "", longDescription: "", tableOfContents: "",
  author: "", publisher: "Sphere English", isbn: "", language: "tr", contentLanguage: "",
  seriesSlug: "", seriesOrder: "", seriesTitle: "",
  pageCount: "", readingTimeMin: "", category: "", tagsText: "",
  priceTry: "", listPriceTry: "",
  isActive: true, isFeatured: false,
  seoTitle: "", seoDescription: "", seoKeywords: "",
};

export default function AdminEbookForm() {
  const [, setLocation] = useLocation();
  const [matchEdit, paramsEdit] = useRoute("/admin/ebooks/:id");
  const isNew = !matchEdit || paramsEdit?.id === "yeni";
  const editId = isNew ? null : parseInt(paramsEdit?.id ?? "0", 10);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<number | null>(editId);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const coverInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const previewInputRef = useRef<HTMLInputElement>(null);
  const fullInputRef = useRef<HTMLInputElement>(null);

  async function load(id: number) {
    setLoading(true);
    try {
      const data = await apiFetch(`/admin/ebooks/${id}`);
      const e = data.ebook;
      setForm({
        slug: e.slug ?? "",
        title: e.title ?? "",
        subtitle: e.subtitle ?? "",
        description: e.description ?? "",
        longDescription: e.long_description ?? "",
        tableOfContents: e.table_of_contents ?? "",
        author: e.author ?? "",
        publisher: e.publisher ?? "",
        isbn: e.isbn ?? "",
        language: e.language ?? "tr",
        contentLanguage: e.content_language ?? "",
        seriesSlug: e.series_slug ?? "",
        seriesOrder: e.series_order != null ? String(e.series_order) : "",
        seriesTitle: e.series_title ?? "",
        pageCount: e.page_count != null ? String(e.page_count) : "",
        readingTimeMin: e.reading_time_min != null ? String(e.reading_time_min) : "",
        category: e.category ?? "",
        tagsText: Array.isArray(e.tags) ? e.tags.join(", ") : "",
        priceTry: e.price_try != null ? String(e.price_try) : "",
        listPriceTry: e.list_price_try != null ? String(e.list_price_try) : "",
        isActive: !!e.is_active,
        isFeatured: !!e.is_featured,
        seoTitle: e.seo_title ?? "",
        seoDescription: e.seo_description ?? "",
        seoKeywords: e.seo_keywords ?? "",
      });
      setAssets(data.assets ?? []);
      setSavedId(id);
    } catch (e: any) {
      setMsg({ type: "err", text: e.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (editId) load(editId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  function update<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function saveEbook() {
    setSaving(true);
    setMsg(null);
    const body: any = {
      slug: form.slug.trim(),
      title: form.title.trim(),
      subtitle: form.subtitle.trim() || null,
      description: form.description.trim(),
      longDescription: form.longDescription.trim() || null,
      tableOfContents: form.tableOfContents.trim() || null,
      author: form.author.trim(),
      publisher: form.publisher.trim() || "Sphere English",
      isbn: form.isbn.trim() || null,
      language: form.language || "tr",
      contentLanguage: form.contentLanguage.trim() || null,
      seriesSlug: form.seriesSlug.trim() || null,
      seriesOrder: form.seriesOrder ? parseInt(form.seriesOrder, 10) : null,
      seriesTitle: form.seriesTitle.trim() || null,
      pageCount: form.pageCount ? parseInt(form.pageCount, 10) : null,
      readingTimeMin: form.readingTimeMin ? parseInt(form.readingTimeMin, 10) : null,
      category: form.category.trim() || null,
      tags: form.tagsText.split(",").map((t) => t.trim()).filter(Boolean),
      priceTry: form.priceTry ? parseFloat(form.priceTry) : null,
      listPriceTry: form.listPriceTry ? parseFloat(form.listPriceTry) : null,
      isActive: form.isActive,
      isFeatured: form.isFeatured,
      seoTitle: form.seoTitle.trim() || null,
      seoDescription: form.seoDescription.trim() || null,
      seoKeywords: form.seoKeywords.trim() || null,
    };

    try {
      if (isNew && !savedId) {
        const data = await apiFetch("/admin/ebooks", {
          method: "POST",
          body: JSON.stringify(body),
        });
        const newId = data.ebook?.id;
        setSavedId(newId);
        setMsg({ type: "ok", text: "Kitap oluşturuldu. Artık görsel ve PDF yükleyebilirsin." });
        // URL'i değiştir ki F5'te de düzenleme moduna gelsin
        window.history.replaceState({}, "", `/admin/ebooks/${newId}`);
      } else {
        await apiFetch(`/admin/ebooks/${savedId}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        setMsg({ type: "ok", text: "Değişiklikler kaydedildi." });
      }
    } catch (e: any) {
      setMsg({ type: "err", text: e.message });
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(file: File, assetType: string) {
    if (!savedId) {
      alert("Önce kitabı kaydet, sonra görsel/PDF yükle.");
      return;
    }
    setUploadingType(assetType);
    try {
      await uploadFile(savedId, file, assetType);
      // Asset listesini yenile
      const data = await apiFetch(`/admin/ebooks/${savedId}`);
      setAssets(data.assets ?? []);
      setMsg({ type: "ok", text: `${assetType} yüklendi.` });
    } catch (e: any) {
      setMsg({ type: "err", text: e.message });
    } finally {
      setUploadingType(null);
    }
  }

  async function deleteAsset(id: number) {
    if (!confirm("Bu dosyayı silmek istediğine emin misin?")) return;
    try {
      await apiFetch(`/admin/ebook-assets/${id}`, { method: "DELETE" });
      if (savedId) {
        const data = await apiFetch(`/admin/ebooks/${savedId}`);
        setAssets(data.assets ?? []);
      }
    } catch (e: any) {
      alert("Silinemedi: " + e.message);
    }
  }

  const cover = assets.find((a) => a.asset_type === "cover");
  const preview = assets.find((a) => a.asset_type === "preview");
  const full = assets.find((a) => a.asset_type === "full");
  const gallery = assets.filter((a) => a.asset_type === "gallery").sort((a, b) => a.position - b.position);

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin inline-block mr-2" />
        Yükleniyor…
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={() => setLocation("/admin/ebooks")} className="p-2 rounded-lg hover:bg-slate-100">
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-2xl font-bold text-slate-900">
          {isNew && !savedId ? "Yeni E-Kitap" : "Kitabı Düzenle"}
        </h1>
      </div>
      <p className="text-sm text-slate-500 mb-6">
        Önce metin alanlarını doldur ve <strong>Kaydet</strong>. Sonra görseller + PDF yükle (yüklemek için kitabın kayıtlı olması lazım).
      </p>

      {msg && (
        <div className={`mb-4 p-3 rounded-xl text-sm ${
          msg.type === "ok" ? "bg-emerald-50 border border-emerald-200 text-emerald-900" : "bg-red-50 border border-red-200 text-red-900"
        }`}>
          {msg.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* SOL: TEXT FORM */}
        <div className="space-y-5">
          {/* Temel bilgi */}
          <Section title="Temel Bilgi">
            <Field label="Slug (URL)" required value={form.slug} onChange={(v) => update("slug", v)} placeholder="kurumsal-iletisim-toplantilar" />
            <Field label="Başlık" required value={form.title} onChange={(v) => update("title", v)} />
            <Field label="Alt Başlık" value={form.subtitle} onChange={(v) => update("subtitle", v)} placeholder="İş İngilizcesinde Kullanılan 1000 Kelime — Kitap 01" />
            <TextArea label="Kısa Açıklama" required rows={3} value={form.description} onChange={(v) => update("description", v)} placeholder="Liste sayfasında ve meta'da görünür (~200 karakter)" />
            <TextArea label="Uzun Açıklama" rows={5} value={form.longDescription} onChange={(v) => update("longDescription", v)} placeholder="Detay sayfasında görünür (markdown destekli)" />
            <TextArea label="İçindekiler" rows={6} value={form.tableOfContents} onChange={(v) => update("tableOfContents", v)} placeholder="Bölüm 1 — ...\nBölüm 2 — ...\nMarkdown destekli" />
          </Section>

          {/* Yazar / yayın */}
          <Section title="Yazar & Yayın">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Yazar" required value={form.author} onChange={(v) => update("author", v)} />
              <Field label="Yayıncı" value={form.publisher} onChange={(v) => update("publisher", v)} />
              <Field label="ISBN (opsiyonel)" value={form.isbn} onChange={(v) => update("isbn", v)} />
              <Field label="Dil" value={form.language} onChange={(v) => update("language", v)} placeholder="tr / en" />
            </div>
            <Field label="İçerik Dili" value={form.contentLanguage} onChange={(v) => update("contentLanguage", v)} placeholder="TR-EN" />
          </Section>

          {/* Seri */}
          <Section title="Seri (opsiyonel)">
            <div className="grid grid-cols-[1fr_100px] gap-4">
              <Field label="Seri Adı" value={form.seriesTitle} onChange={(v) => update("seriesTitle", v)} />
              <Field label="Sıra No" type="number" value={form.seriesOrder} onChange={(v) => update("seriesOrder", v)} />
            </div>
            <Field label="Seri Slug" value={form.seriesSlug} onChange={(v) => update("seriesSlug", v)} placeholder="is-ingilizcesinde-1000-kelime" />
          </Section>

          {/* Meta */}
          <Section title="Meta">
            <div className="grid grid-cols-3 gap-4">
              <Field label="Sayfa Sayısı" type="number" value={form.pageCount} onChange={(v) => update("pageCount", v)} />
              <Field label="Okuma Süresi (dk)" type="number" value={form.readingTimeMin} onChange={(v) => update("readingTimeMin", v)} />
              <Field label="Kategori" value={form.category} onChange={(v) => update("category", v)} placeholder="İş İngilizcesi" />
            </div>
            <Field label="Etiketler (virgülle)" value={form.tagsText} onChange={(v) => update("tagsText", v)} placeholder="toplantı, e-posta, B2" />
          </Section>

          {/* Fiyat */}
          <Section title="Fiyat">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Satış Fiyatı (TL)" required type="number" value={form.priceTry} onChange={(v) => update("priceTry", v)} />
              <Field label="Liste Fiyatı (indirim öncesi, opsiyonel)" type="number" value={form.listPriceTry} onChange={(v) => update("listPriceTry", v)} />
            </div>
          </Section>

          {/* SEO */}
          <Section title="SEO (opsiyonel)">
            <Field label="SEO Başlık" value={form.seoTitle} onChange={(v) => update("seoTitle", v)} />
            <TextArea label="SEO Açıklama" rows={2} value={form.seoDescription} onChange={(v) => update("seoDescription", v)} />
            <Field label="SEO Anahtar Kelimeler (virgülle)" value={form.seoKeywords} onChange={(v) => update("seoKeywords", v)} />
          </Section>

          {/* Durum */}
          <Section title="Durum">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.isActive} onChange={(e) => update("isActive", e.target.checked)} className="w-4 h-4" />
              <span className="text-sm text-slate-700">Yayında (sitede görünür)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer mt-2">
              <input type="checkbox" checked={form.isFeatured} onChange={(e) => update("isFeatured", e.target.checked)} className="w-4 h-4" />
              <span className="text-sm text-slate-700">Öne çıkar <Star size={12} className="inline text-amber-500" /></span>
            </label>
          </Section>

          {/* KAYDET */}
          <div className="sticky bottom-4 bg-white border border-slate-200 rounded-xl shadow-lg p-4 flex items-center justify-between">
            <span className="text-sm text-slate-500">
              {savedId ? "Kayıtlı kitap (ID: " + savedId + ")" : "Yeni kitap — kaydetmeden görsel yükleyemezsin"}
            </span>
            <button
              onClick={saveEbook}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold disabled:opacity-50"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? "Kaydediliyor…" : "Kaydet"}
            </button>
          </div>
        </div>

        {/* SAĞ: ASSET YÖNETİMİ */}
        <div className="space-y-4">
          <h2 className="font-bold text-sm text-slate-900 uppercase tracking-wider">Görseller & Dosyalar</h2>

          {!savedId && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
              Görseller ve PDF yükleyebilmek için önce kitabı kaydet.
            </div>
          )}

          {/* Cover */}
          <AssetSlot
            label="Kapak Görseli"
            icon={<ImageIcon size={14} />}
            accept="image/*"
            asset={cover}
            uploading={uploadingType === "cover"}
            disabled={!savedId}
            inputRef={coverInputRef}
            onUpload={(f) => handleUpload(f, "cover")}
            onDelete={() => cover && deleteAsset(cover.id)}
          />

          {/* Gallery */}
          <div>
            <label className="text-xs font-semibold text-slate-700 mb-1.5 inline-flex items-center gap-1.5">
              <ImageIcon size={14} /> Galeri Görselleri ({gallery.length})
            </label>
            <div className="space-y-2">
              {gallery.map((g) => (
                <div key={g.id} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-xs text-slate-700 flex-1 truncate">{g.filename}</span>
                  <span className="text-[10px] text-slate-400">{(g.size_bytes / 1024).toFixed(0)} KB</span>
                  <button onClick={() => deleteAsset(g.id)} className="p-1 text-red-500 hover:bg-red-50 rounded">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              <button
                disabled={!savedId || uploadingType === "gallery"}
                onClick={() => galleryInputRef.current?.click()}
                className="w-full py-2 rounded-lg border-2 border-dashed border-slate-300 text-xs text-slate-500 hover:border-purple-500 hover:text-purple-600 disabled:opacity-50"
              >
                {uploadingType === "gallery" ? "Yükleniyor…" : "+ Galeri görseli ekle"}
              </button>
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f, "gallery");
                  e.target.value = "";
                }}
              />
            </div>
          </div>

          {/* Preview PDF */}
          <AssetSlot
            label="Önizleme PDF (5 sayfa)"
            icon={<FileText size={14} />}
            accept="application/pdf"
            asset={preview}
            uploading={uploadingType === "preview"}
            disabled={!savedId}
            inputRef={previewInputRef}
            onUpload={(f) => handleUpload(f, "preview")}
            onDelete={() => preview && deleteAsset(preview.id)}
          />

          {/* Full PDF */}
          <AssetSlot
            label="Tam PDF (satılan)"
            icon={<FileText size={14} />}
            accept="application/pdf"
            asset={full}
            uploading={uploadingType === "full"}
            disabled={!savedId}
            inputRef={fullInputRef}
            onUpload={(f) => handleUpload(f, "full")}
            onDelete={() => full && deleteAsset(full.id)}
          />

          <p className="text-[10px] text-slate-400">
            Tüm dosyalar veritabanına bytea olarak yüklenir. Maksimum 15 MB per dosya.
          </p>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({
  label, value, onChange, required, type = "text", placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void;
  required?: boolean; type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 text-sm"
      />
    </div>
  );
}

function TextArea({
  label, value, onChange, required, rows = 3, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void;
  required?: boolean; rows?: number; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        required={required}
        className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 text-sm resize-vertical"
      />
    </div>
  );
}

function AssetSlot({
  label, icon, accept, asset, uploading, disabled, inputRef, onUpload, onDelete,
}: {
  label: string; icon: React.ReactNode; accept: string; asset?: Asset;
  uploading: boolean; disabled: boolean;
  inputRef: React.RefObject<HTMLInputElement>;
  onUpload: (f: File) => void; onDelete: () => void;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-700 mb-1.5 inline-flex items-center gap-1.5">
        {icon} {label}
      </label>
      {asset ? (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50 border border-emerald-200">
          <span className="text-xs text-emerald-900 flex-1 truncate">{asset.filename}</span>
          <span className="text-[10px] text-emerald-700">{(asset.size_bytes / 1024).toFixed(0)} KB</span>
          <button onClick={onDelete} className="p-1 text-red-500 hover:bg-red-50 rounded">
            <Trash2 size={12} />
          </button>
        </div>
      ) : (
        <button
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
          className="w-full py-2 rounded-lg border-2 border-dashed border-slate-300 text-xs text-slate-500 hover:border-purple-500 hover:text-purple-600 disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
        >
          {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
          {uploading ? "Yükleniyor…" : "Yükle"}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUpload(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
