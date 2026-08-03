import { useEffect, useMemo, useRef, useState } from "react";
import {
  Mail, Sparkles, Library, LayoutDashboard, Copy, Check, Loader2,
  Monitor, Smartphone, Eye, RefreshCw, ExternalLink,
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
  const [tab, setTab] = useState<"ai" | "library" | "editor">("ai");

  // Ortak "current template" state — hangi tab'dan gelirse gelsin preview burayı gösterir
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
            AI ile üret, kütüphaneden seç veya sıfırdan tasarla. HTML kopyala → Resend/Mailchimp'e yapıştır.
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-4 flex gap-1 rounded-lg bg-white p-1 shadow-sm ring-1 ring-gray-200 w-fit">
          <TabButton icon={Sparkles} label="AI Üret" active={tab === "ai"} onClick={() => setTab("ai")} />
          <TabButton icon={Library} label="Şablon Kütüphanesi" active={tab === "library"} onClick={() => setTab("library")} />
          <TabButton icon={LayoutDashboard} label="Görsel Editor" active={tab === "editor"} onClick={() => setTab("editor")} />
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
            {tab === "editor" && <EditorPlaceholder />}
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

// ─── Tab butonu ───────────────────────────────────────────────────────
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

// ─── Tab 1: AI Üret ───────────────────────────────────────────────────
function AiGenerateTab({ onGenerated }: { onGenerated: (r: { subject: string; previewText: string; html: string }) => void }) {
  const [brief, setBrief] = useState("");
  const [mailType, setMailType] = useState<MailType>("generic");
  const [tone, setTone] = useState<Tone>("profesyonel_sicak");
  const [ctaText, setCtaText] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [includeImage, setIncludeImage] = useState(false);
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
        body: JSON.stringify({ brief, mailType, tone, ctaText, ctaUrl, includeImage }),
      });
      onGenerated({ subject: r.subject, previewText: r.previewText, html: r.html });
    } catch (e: any) {
      setError(e?.message ?? "Üretim başarısız");
    } finally {
      setLoading(false);
    }
  }

  return (
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
            rows={5}
            placeholder="Örn: Yeni yayınladığımız 'Toplantı İngilizcesi' e-kitabı için duyuru maili. Kitap 199 TL, 47 diyalog + 150 kalıp içeriyor. Kurumsal İK yöneticilerine yönelik olsun, indirim vurgusu olmasın."
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
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

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={includeImage}
            onChange={(e) => setIncludeImage(e.target.checked)}
            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          Bir görsel yer tutucusu ekle (mock)
        </label>

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
          GPT-4o kullanılır. Marka renkleri (lacivert #1B365D, turkuaz #0ea5e9) + inline CSS + mobile responsive otomatik uygulanır.
        </p>
      </div>
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
            <div className="mt-1 text-[11px] text-gray-400 italic truncate">
              {t.subject}
            </div>
          </button>
        ))}
      </div>

      <p className="mt-4 text-xs text-gray-500">
        Şablon seç → sağda düzenle → HTML'i kopyala. Yer tutucular (<code className="bg-gray-100 px-1 rounded text-[10px]">[Kitap Adı]</code> gibi) gerçek verilerinle değiştir.
      </p>
    </div>
  );
}

// ─── Tab 3: Görsel Editor placeholder ─────────────────────────────────
function EditorPlaceholder() {
  return (
    <div className="rounded-lg bg-white p-8 shadow ring-1 ring-gray-200 text-center">
      <LayoutDashboard className="mx-auto mb-3 h-10 w-10 text-gray-300" />
      <h3 className="mb-2 font-semibold text-gray-900">Görsel Editor — Yakında</h3>
      <p className="text-sm text-gray-500">
        Drag-drop WYSIWYG editor (GrapesJS) sonraki güncellemede eklenecek. Şu anda AI Üret veya Şablon Kütüphanesi yeterli.
      </p>
      <p className="mt-3 text-xs text-gray-400">
        Bu arada: Sağdaki preview kısmında HTML'i manuel düzenleyebilirsin (Ham HTML sekmesi).
      </p>
    </div>
  );
}

// ─── Preview panel (sağ taraf) ────────────────────────────────────────
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

  // HTML değişince iframe'e yeniden yaz
  useEffect(() => {
    if (view !== "preview") return;
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(props.html || "<html><body style='margin:0;padding:40px;text-align:center;font-family:sans-serif;color:#94a3b8;background:#f9fafb;'>Şablon oluştur veya kütüphaneden seç → preview burada gösterilecek</body></html>");
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
            {props.subject.length}/60 karakter · mobil inbox'ta bu kadar görünür
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Preview Text (inbox altı)</label>
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
            {props.previewText.length}/90 karakter · konuyu tamamlayan cümle
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
                title="Desktop görünüm"
                className={`rounded p-1.5 ${props.previewMode === "desktop" ? "bg-indigo-100 text-indigo-700" : "text-gray-400 hover:bg-gray-200"}`}
              >
                <Monitor className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => props.setPreviewMode("mobile")}
                title="Mobil görünüm"
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

      {/* Test uyarı */}
      <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-900">
        💡 <strong>İpucu:</strong> HTML'i kopyaladıktan sonra Resend / Mailchimp / Brevo'ya yapıştır.
        Test için önce kendine gönder — Gmail mobil + Outlook web'de nasıl göründüğünü doğrula.
      </div>
    </div>
  );
}

// ─── Copy button ─────────────────────────────────────────────────────
function CopyButton({ value, label, small = false }: { value: string; label?: string; small?: boolean }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  if (small) {
    return (
      <button
        onClick={copy}
        disabled={!value}
        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-gray-500 hover:bg-gray-100 disabled:opacity-40"
        title="Kopyala"
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
