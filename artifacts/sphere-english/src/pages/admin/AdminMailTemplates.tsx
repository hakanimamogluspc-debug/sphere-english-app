import { useEffect, useRef, useState } from "react";
import {
  Mail, Sparkles, Library, Copy, Check, Loader2,
  Monitor, Smartphone, Eye, Upload, X, Image as ImageIcon,
  Trash2,
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

async function apiUpload(path: string, formData: FormData) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.error || `HTTP ${res.status}`);
  return data;
}

type LibTemplate = {
  id: string;
  name: string;
  category: string;
  description: string;
  subject: string;
  previewText: string;
  html: string;
};

type MailType = "campaign" | "announcement" | "newsletter" | "abandoned_cart" | "welcome" | "generic";
type Tone = "profesyonel_sicak" | "formal" | "samimi" | "aciliyet";

type MailAsset = {
  id: number;
  filename: string;
  description: string | null;
  mime: string;
  size: number;
  url: string;
  created_at?: string;
};

const MAIL_TYPE_OPTIONS: { value: MailType; label: string }[] = [
  { value: "generic", label: "Genel" },
  { value: "campaign", label: "Kampanya / İndirim" },
  { value: "announcement", label: "Duyuru — Yeni Ürün" },
  { value: "newsletter", label: "Newsletter" },
  { value: "abandoned_cart", label: "Terk Sepet" },
  { value: "welcome", label: "Hoş Geldin" },
];

const TONE_OPTIONS: { value: Tone; label: string }[] = [
  { value: "profesyonel_sicak", label: "Profesyonel Sıcak" },
  { value: "formal", label: "Formal Kurumsal" },
  { value: "samimi", label: "Samimi Arkadaşça" },
  { value: "aciliyet", label: "Aciliyet" },
];

export default function AdminMailTemplates() {
  const [tab, setTab] = useState<"ai" | "library">("ai");

  const [subject, setSubject] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [html, setHtml] = useState("");
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Mail className="h-6 w-6 text-indigo-600" />
            Mail Şablonları
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Görselleri yükle → AI Sphere marka stilinde HTML mail üretsin → kopyala + Resend/Mailchimp'e yapıştır.
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-4 flex gap-1 rounded-lg bg-white p-1 shadow-sm ring-1 ring-gray-200 w-fit">
          <TabButton icon={Sparkles} label="AI Üret" active={tab === "ai"} onClick={() => setTab("ai")} />
          <TabButton icon={Library} label="Şablon Kütüphanesi" active={tab === "library"} onClick={() => setTab("library")} />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Sol — Tab içeriği */}
          <div className="lg:col-span-5">
            {tab === "ai" && (
              <AiGenerateTab
                onGenerated={(r) => {
                  setSubject(r.subject);
                  setPreviewText(r.previewText);
                  setHtml(r.html);
                }}
              />
            )}
            {tab === "library" && (
              <LibraryTab
                onSelect={(t) => {
                  setSubject(t.subject);
                  setPreviewText(t.previewText);
                  setHtml(t.html);
                }}
              />
            )}
          </div>

          {/* Sağ — Preview + kopyala */}
          <div className="lg:col-span-7">
            <PreviewPanel
              subject={subject}
              previewText={previewText}
              html={html}
              onSubjectChange={setSubject}
              onPreviewTextChange={setPreviewText}
              onHtmlChange={setHtml}
              previewMode={previewMode}
              setPreviewMode={setPreviewMode}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function TabButton({
  icon: Icon, label, active, onClick,
}: { icon: any; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${
        active ? "bg-indigo-600 text-white shadow" : "text-gray-600 hover:bg-gray-100"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

// ─── Tab 1: AI Üret (görsel yükleme entegre) ─────────────────────────
function AiGenerateTab({ onGenerated }: { onGenerated: (r: { subject: string; previewText: string; html: string }) => void }) {
  const [brief, setBrief] = useState("");
  const [mailType, setMailType] = useState<MailType>("generic");
  const [tone, setTone] = useState<Tone>("profesyonel_sicak");
  const [ctaText, setCtaText] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [selectedAssets, setSelectedAssets] = useState<MailAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    if (!brief.trim()) {
      setError("Brief yazmadan üretim başlayamaz");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const r = await apiFetch("/admin/mail-templates/generate", {
        method: "POST",
        body: JSON.stringify({
          brief,
          mailType,
          tone,
          ctaText,
          ctaUrl,
          images: selectedAssets.map((a) => ({
            url: a.url,
            description: a.description ?? a.filename,
            filename: a.filename,
          })),
        }),
      });
      onGenerated({ subject: r.subject, previewText: r.previewText, html: r.html });
    } catch (e: any) {
      setError(e?.message ?? "Üretim başarısız");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Görsel yükleme alanı */}
      <AssetPicker selected={selectedAssets} onChange={setSelectedAssets} />

      {/* AI form */}
      <div className="rounded-lg bg-white p-5 shadow ring-1 ring-gray-200">
        <div className="mb-4 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-indigo-600" />
          <h2 className="font-semibold text-gray-900">AI ile HTML mail üret</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Brief — ne mail'i yazacaksın?</label>
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              rows={4}
              placeholder="Örn: Yeni yayınladığımız 'Toplantı İngilizcesi' e-kitabı için duyuru maili. Kitap 199 TL, 47 diyalog + 150 kalıp içeriyor. Kurumsal İK yöneticilerine yönelik, indirim vurgusu olmasın."
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
            {selectedAssets.length > 0 && (
              <div className="mt-1 text-[11px] text-emerald-700">
                ✓ {selectedAssets.length} görsel bu maile yerleştirilecek
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Mail Türü</label>
              <select
                value={mailType}
                onChange={(e) => setMailType(e.target.value as MailType)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              >
                {MAIL_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Ton</label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value as Tone)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              >
                {TONE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">CTA metni (opsiyonel)</label>
              <input
                type="text"
                value={ctaText}
                onChange={(e) => setCtaText(e.target.value)}
                placeholder="Kitabı İncele"
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">CTA link (opsiyonel)</label>
              <input
                type="url"
                value={ctaUrl}
                onChange={(e) => setCtaUrl(e.target.value)}
                placeholder="https://www.sphereenglish.com/..."
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {error && (
            <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
          )}

          <button
            onClick={generate}
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? "Üretiliyor…" : "Mail Üret"}
          </button>

          <p className="text-xs text-gray-500">
            GPT-4o kullanılır. Marka renkleri (lacivert #1B365D, turkuaz #0ea5e9), inline CSS, mobile responsive otomatik uygulanır. Yüklenen görsellerin URL'leri mail'e yerleştirilir.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Görsel Kütüphanesi + Upload (AssetPicker) ───────────────────────
function AssetPicker({
  selected, onChange,
}: { selected: MailAsset[]; onChange: (v: MailAsset[]) => void }) {
  const [assets, setAssets] = useState<MailAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await apiFetch("/admin/mail-assets?limit=50");
      setAssets(r.assets ?? []);
    } catch (e: any) {
      setError(e?.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);
    const newAssets: MailAsset[] = [];
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) {
          setError(`${file.name}: sadece görsel dosyası`);
          continue;
        }
        const fd = new FormData();
        fd.append("image", file);
        // Basit varsayılan açıklama — kullanıcı sonra edit edebilir
        fd.append("description", "");
        const r = await apiUpload("/admin/mail-assets/upload", fd);
        if (r.asset) newAssets.push(r.asset);
      }
      setAssets((prev) => [...newAssets, ...prev]);
      // Yeni yüklenenleri otomatik seç
      onChange([...newAssets, ...selected]);
    } catch (e: any) {
      setError(e?.message ?? "Yükleme hatası");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function updateDescription(assetId: number, newDesc: string) {
    // Local update — DB'ye şu an yazmıyoruz; description sadece frontend'de tutulur
    // (Backend'de DELETE + POST ile yeniden yükleme mümkün ama şimdilik gerek yok)
    setAssets((prev) => prev.map((a) => (a.id === assetId ? { ...a, description: newDesc } : a)));
    onChange(selected.map((a) => (a.id === assetId ? { ...a, description: newDesc } : a)));
  }

  function toggleSelect(a: MailAsset) {
    const isSel = selected.some((s) => s.id === a.id);
    if (isSel) {
      onChange(selected.filter((s) => s.id !== a.id));
    } else {
      onChange([...selected, a]);
    }
  }

  async function deleteAsset(id: number) {
    if (!confirm("Bu görsel silinsin mi? (Daha önce gönderilmiş maillerdeki linkler kırılır)")) return;
    try {
      await apiFetch(`/admin/mail-assets/${id}`, { method: "DELETE" });
      setAssets((prev) => prev.filter((a) => a.id !== id));
      onChange(selected.filter((a) => a.id !== id));
    } catch (e: any) {
      alert("Silme hatası: " + e?.message);
    }
  }

  return (
    <div className="rounded-lg bg-white p-4 shadow ring-1 ring-gray-200">
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center gap-2 text-left"
        >
          <ImageIcon className="h-5 w-5 text-indigo-600" />
          <h2 className="font-semibold text-gray-900">
            Görseller {selected.length > 0 && <span className="ml-1 text-sm font-normal text-indigo-600">({selected.length} seçili)</span>}
          </h2>
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-1.5 rounded bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {uploading ? "Yükleniyor…" : "Görsel Yükle"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />
      </div>

      {error && <div className="mb-2 rounded bg-red-50 px-2 py-1.5 text-xs text-red-800">{error}</div>}

      {expanded && (
        <>
          {loading ? (
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-gray-400" />
          ) : assets.length === 0 ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded p-6 text-center cursor-pointer hover:border-indigo-400 hover:bg-gray-50"
            >
              <Upload className="mx-auto h-6 w-6 text-gray-400 mb-1" />
              <p className="text-xs text-gray-500">
                Henüz görsel yok. Tıkla veya sürükle-bırak ile yükle (JPG, PNG, WebP, GIF · max 8MB)
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[300px] overflow-y-auto">
              {assets.map((a) => {
                const isSel = selected.some((s) => s.id === a.id);
                return (
                  <div
                    key={a.id}
                    className={`relative group rounded border overflow-hidden cursor-pointer transition ${
                      isSel ? "border-indigo-500 ring-2 ring-indigo-200" : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div onClick={() => toggleSelect(a)} className="aspect-square bg-gray-100 relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={a.url}
                        alt={a.filename}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      {isSel && (
                        <div className="absolute top-1 right-1 bg-indigo-600 text-white rounded-full p-1">
                          <Check className="h-3 w-3" />
                        </div>
                      )}
                    </div>
                    <div className="p-1.5 bg-white">
                      <input
                        type="text"
                        value={a.description ?? ""}
                        onChange={(e) => updateDescription(a.id, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="Açıklama (ör: banner)"
                        className="w-full text-[10px] px-1 py-0.5 border border-transparent rounded focus:border-gray-300 focus:outline-none"
                      />
                      <div className="mt-0.5 flex items-center justify-between">
                        <span className="text-[9px] text-gray-400 truncate flex-1" title={a.filename}>
                          {a.filename}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteAsset(a.id); }}
                          title="Sil"
                          className="ml-1 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {selected.length > 0 && (
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="text-gray-500">{selected.length} görsel mail'e yerleştirilecek</span>
              <button onClick={() => onChange([])} className="text-gray-500 hover:text-gray-700 underline">
                Seçimi temizle
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Tab 2: Şablon Kütüphanesi ────────────────────────────────────────
function LibraryTab({ onSelect }: { onSelect: (t: LibTemplate) => void }) {
  const [templates, setTemplates] = useState<LibTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await apiFetch("/admin/mail-templates/library");
        setTemplates(r.templates ?? []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="rounded-lg bg-white p-5 shadow ring-1 ring-gray-200">
      <div className="mb-4 flex items-center gap-2">
        <Library className="h-5 w-5 text-indigo-600" />
        <h2 className="font-semibold text-gray-900">Hazır Şablon Kütüphanesi</h2>
      </div>

      {loading && <Loader2 className="mx-auto h-5 w-5 animate-spin text-gray-400" />}

      <div className="space-y-2">
        {templates.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setSelected(t.id);
              onSelect(t);
            }}
            className={`w-full rounded-lg border p-3 text-left transition ${
              selected === t.id
                ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500"
                : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="font-medium text-sm text-gray-900">{t.name}</div>
              {selected === t.id && <Check className="h-4 w-4 text-indigo-600" />}
            </div>
            <div className="mt-0.5 text-xs text-gray-500">{t.description}</div>
            <div className="mt-1 text-[11px] text-gray-400 italic truncate">{t.subject}</div>
          </button>
        ))}
      </div>

      <p className="mt-4 text-xs text-gray-500">
        Şablon seç → sağda düzenle → HTML'i kopyala. Yer tutucular (<code className="bg-gray-100 px-1 rounded text-[10px]">[Kitap Adı]</code> gibi) gerçek verilerinle değiştir.
      </p>
    </div>
  );
}

// ─── Preview panel ────────────────────────────────────────────────────
function PreviewPanel(props: {
  subject: string;
  previewText: string;
  html: string;
  onSubjectChange: (v: string) => void;
  onPreviewTextChange: (v: string) => void;
  onHtmlChange: (v: string) => void;
  previewMode: "desktop" | "mobile";
  setPreviewMode: (m: "desktop" | "mobile") => void;
}) {
  const [view, setView] = useState<"preview" | "html">("preview");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (view !== "preview") return;
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(props.html || "<html><body style='margin:0;padding:0;'></body></html>");
    doc.close();
  }, [props.html, view]);

  const emptyState = !props.html;

  return (
    <div className="space-y-3">
      {/* Subject + Preview text */}
      <div className="rounded-lg bg-white p-4 shadow ring-1 ring-gray-200">
        <div className="mb-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Konu (Subject)</label>
            <CopyButton value={props.subject} small />
          </div>
          <input
            type="text"
            value={props.subject}
            onChange={(e) => props.onSubjectChange(e.target.value)}
            placeholder="[Konu buraya]"
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm font-medium focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
          <div className="mt-0.5 text-[11px] text-gray-400">
            {props.subject.length}/60 karakter · mobil inbox bu kadar gösterir
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Preview Text</label>
            <CopyButton value={props.previewText} small />
          </div>
          <input
            type="text"
            value={props.previewText}
            onChange={(e) => props.onPreviewTextChange(e.target.value)}
            placeholder="[Konudan sonra görünen ilk satır]"
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
          <div className="mt-0.5 text-[11px] text-gray-400">
            {props.previewText.length}/90 karakter
          </div>
        </div>
      </div>

      {/* Preview / HTML */}
      <div className="rounded-lg bg-white shadow ring-1 ring-gray-200 overflow-hidden">
        <div className="flex items-center justify-between border-b bg-gray-50 px-3 py-2">
          <div className="flex gap-1">
            <button
              onClick={() => setView("preview")}
              className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium ${
                view === "preview" ? "bg-white shadow ring-1 ring-gray-200 text-gray-900" : "text-gray-500 hover:bg-white"
              }`}
            >
              <Eye className="h-3.5 w-3.5" /> Preview
            </button>
            <button
              onClick={() => setView("html")}
              className={`rounded px-2.5 py-1 text-xs font-medium ${
                view === "html" ? "bg-white shadow ring-1 ring-gray-200 text-gray-900" : "text-gray-500 hover:bg-white"
              }`}
            >
              Ham HTML
            </button>
          </div>
          {view === "preview" && (
            <div className="flex gap-1">
              <button
                onClick={() => props.setPreviewMode("desktop")}
                title="Desktop"
                className={`rounded p-1.5 ${props.previewMode === "desktop" ? "bg-indigo-100 text-indigo-700" : "text-gray-400 hover:bg-gray-200"}`}
              >
                <Monitor className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => props.setPreviewMode("mobile")}
                title="Mobil"
                className={`rounded p-1.5 ${props.previewMode === "mobile" ? "bg-indigo-100 text-indigo-700" : "text-gray-400 hover:bg-gray-200"}`}
              >
                <Smartphone className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <CopyButton value={props.html} label="HTML Kopyala" />
        </div>

        {view === "preview" && (
          <div className={`bg-gray-100 flex justify-center p-4 ${emptyState ? "min-h-[400px]" : "min-h-[600px]"}`}>
            <iframe
              ref={iframeRef}
              title="Mail preview"
              className={`bg-white border border-gray-200 rounded shadow-sm transition-all ${
                props.previewMode === "mobile" ? "w-[375px]" : "w-full max-w-[700px]"
              }`}
              style={{ height: emptyState ? 400 : 700 }}
            />
          </div>
        )}

        {view === "html" && (
          <textarea
            value={props.html}
            onChange={(e) => props.onHtmlChange(e.target.value)}
            placeholder="<!DOCTYPE html>..."
            className="w-full font-mono text-xs p-3 border-0 focus:outline-none focus:ring-0 resize-none"
            style={{ minHeight: 600, height: 700 }}
          />
        )}
      </div>

      <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-900">
        💡 <strong>İpucu:</strong> HTML'i kopyalayıp Resend / Mailchimp / Brevo'ya yapıştır. Test için önce kendine gönder — Gmail mobil + Outlook web'de nasıl göründüğünü doğrula.
      </div>
    </div>
  );
}

function CopyButton({ value, label, small = false }: { value: string; label?: string; small?: boolean }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  }

  if (small) {
    return (
      <button
        onClick={copy}
        disabled={!value}
        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-gray-500 hover:bg-gray-100 disabled:opacity-40"
      >
        {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
        {copied ? "Kopyalandı" : "Kopyala"}
      </button>
    );
  }

  return (
    <button
      onClick={copy}
      disabled={!value}
      className="inline-flex items-center gap-1.5 rounded bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Kopyalandı" : label ?? "Kopyala"}
    </button>
  );
}
