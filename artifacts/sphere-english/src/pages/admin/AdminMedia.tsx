import { useCallback, useEffect, useRef, useState } from "react";
import {
  Image as ImageIcon, Upload, Loader2, AlertCircle, X, Trash2, Link2, Code2, Check, RefreshCw, Search, Info,
} from "lucide-react";
import { API } from "@/lib/api-url";
import { prepareMailImage, mailImgTag } from "@/lib/prepare-mail-image";

const TOKEN_KEY = "sphere_token";

async function apiFetch(path: string, opts: RequestInit = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const isForm = opts.body instanceof FormData;
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      ...(isForm ? {} : { "Content-Type": "application/json" }),
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

interface MediaAsset {
  id: number; filename: string; description: string | null; mime: string; size: number;
  width: number | null; height: number | null; storage: "bucket" | "db"; created_at: string; url: string;
}

const fmtSize = (b: number) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export default function AdminMedia() {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [meta, setMeta] = useState<{ total: number; inDb: number; storageEnabled: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [drag, setDrag] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [migrating, setMigrating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ limit: "300" });
      if (q.trim()) qs.set("q", q.trim());
      const r = await apiFetch(`/admin/mail-assets?${qs}`);
      setAssets(r.assets ?? []);
      setMeta({ total: r.total ?? 0, inDb: r.inDb ?? 0, storageEnabled: !!r.storageEnabled });
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [q]);

  useEffect(() => { const t = setTimeout(load, q ? 300 : 0); return () => clearTimeout(t); }, [load, q]);

  async function handleFiles(files: FileList | File[] | null) {
    if (!files) return;
    const list = Array.from(files).filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
    if (list.length === 0) { setError("Sadece görsel dosyaları yüklenebilir"); return; }
    setError(null); setNotice(null);
    let converted = 0;
    const added: MediaAsset[] = [];
    try {
      for (const f of list) {
        setUploading(f.name);
        const p = await prepareMailImage(f);
        if (p.converted) converted++;
        const fd = new FormData();
        fd.append("image", p.file);
        fd.append("width", String(p.width));
        fd.append("height", String(p.height));
        fd.append("description", f.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim());
        const r = await apiFetch(`/admin/mail-assets/upload`, { method: "POST", body: fd });
        if (r.asset) added.push(r.asset);
      }
      setAssets((prev) => [...added, ...prev]);
      setNotice(`${added.length} görsel yüklendi${converted ? ` (${converted} tanesi maile uygun formata/boyuta çevrildi)` : ""}.`);
      load();
    } catch (e: any) { setError(e.message); }
    finally {
      setUploading(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1800);
    } catch { setError("Kopyalanamadı — tarayıcı izin vermedi"); }
  }

  async function saveAlt(a: MediaAsset, description: string) {
    if ((a.description ?? "") === description) return;
    try {
      await apiFetch(`/admin/mail-assets/${a.id}`, { method: "PATCH", body: JSON.stringify({ description }) });
      setAssets((prev) => prev.map((x) => (x.id === a.id ? { ...x, description } : x)));
    } catch (e: any) { setError(e.message); }
  }

  async function remove(a: MediaAsset) {
    if (!confirm(`"${a.filename}" silinsin mi?\n\nBu görseli kullanan eski mailler ve sayfalarda görsel artık görünmez.`)) return;
    try {
      await apiFetch(`/admin/mail-assets/${a.id}`, { method: "DELETE" });
      setAssets((prev) => prev.filter((x) => x.id !== a.id));
    } catch (e: any) { setError(e.message); }
  }

  async function migrate() {
    setMigrating(true);
    try {
      const r = await apiFetch(`/admin/mail-assets/migrate-storage`, { method: "POST" });
      setNotice(`${r.moved} görsel depoya taşındı${r.errors?.length ? `, ${r.errors.length} hata` : ""}. Linkleri değişmedi.`);
      load();
    } catch (e: any) { setError(e.message); }
    finally { setMigrating(false); }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <header className="mb-5 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-blue-800 flex items-center gap-2"><ImageIcon size={26} /> Medya Kütüphanesi</h1>
          <p className="text-sm text-slate-500 mt-1">
            Maillerde, duyurularda ve kendi HTML'lerinde kullanacağın görseller. Her görselin kalıcı, herkese açık bir linki olur.
          </p>
        </div>
        <button onClick={load} className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-white border border-slate-200 hover:bg-slate-50 text-sm">
          <RefreshCw size={14} /> Yenile
        </button>
      </header>

      <div className="mb-4 p-3 rounded-md bg-sky-50 border border-sky-200 text-[13px] text-sky-900 flex gap-2">
        <Info size={16} className="flex-shrink-0 mt-0.5" />
        <div>
          Görseller yüklenirken otomatik olarak <b>JPEG/PNG</b>'ye çevrilir ve en fazla <b>1200 px</b> genişliğe küçültülür
          (WebP Outlook'ta görünmüyor). HTML'de yalnızca buradaki linkleri kullan; Canva, Google Drive veya ChatGPT
          linkleri bir süre sonra kırılır. "HTML kodu" düğmesi Outlook'un da doğru gösterdiği hazır bir <code>&lt;img&gt;</code> kodu kopyalar.
        </div>
      </div>

      {error && (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700 flex justify-between items-center">
          <span className="flex items-center gap-2"><AlertCircle size={16} /> {error}</span>
          <button onClick={() => setError(null)}><X size={14} /></button>
        </div>
      )}
      {notice && (
        <div className="mb-3 p-3 bg-emerald-50 border border-emerald-200 rounded-md text-sm text-emerald-800 flex justify-between items-center">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)}><X size={14} /></button>
        </div>
      )}
      {meta && meta.inDb > 0 && meta.storageEnabled && (
        <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-900 flex justify-between items-center gap-3 flex-wrap">
          <span>{meta.inDb} eski görsel hâlâ veritabanında duruyor. Depoya taşımak veritabanını hafifletir; linkler değişmez.</span>
          <button onClick={migrate} disabled={migrating}
            className="px-3 py-1.5 rounded-md bg-amber-600 text-white text-sm hover:bg-amber-700 disabled:opacity-50 flex items-center gap-1">
            {migrating && <Loader2 size={14} className="animate-spin" />} Depoya taşı
          </button>
        </div>
      )}

      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`mb-5 rounded-lg border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
          drag ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-white hover:border-blue-400"}`}
      >
        <input ref={inputRef} type="file" accept="image/*,.heic,.heif" multiple className="hidden"
          onChange={(e) => handleFiles(e.target.files)} />
        {uploading ? (
          <div className="flex items-center justify-center gap-2 text-sm text-slate-600">
            <Loader2 size={18} className="animate-spin" /> Yükleniyor: {uploading}
          </div>
        ) : (
          <div className="text-sm text-slate-600">
            <Upload size={22} className="mx-auto mb-2 text-blue-700" />
            Görselleri buraya sürükle ya da <span className="text-blue-700 font-semibold">seçmek için tıkla</span>
            <div className="text-xs text-slate-400 mt-1">Birden fazla dosya seçebilirsin · en fazla 8 MB</div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Dosya adı veya açıklama ara…"
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-md" />
        </div>
        <span className="text-xs text-slate-500">{meta?.total ?? assets.length} görsel</span>
      </div>

      {loading && assets.length === 0 ? (
        <div className="py-16 text-center text-slate-400"><Loader2 className="animate-spin inline" /></div>
      ) : assets.length === 0 ? (
        <div className="py-16 text-center text-slate-400 bg-white border border-slate-200 rounded-lg">Henüz görsel yok</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {assets.map((a) => {
            const risky = !["image/jpeg", "image/png", "image/gif"].includes(a.mime);
            return (
              <div key={a.id} className="bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col">
                <a href={a.url} target="_blank" rel="noreferrer"
                  className="block aspect-[4/3] bg-[repeating-conic-gradient(#f1f5f9_0%_25%,#fff_0%_50%)] bg-[length:16px_16px]">
                  <img src={a.url} alt={a.description ?? ""} loading="lazy" className="w-full h-full object-contain" />
                </a>
                <div className="p-3 flex flex-col gap-2 flex-1">
                  <div className="text-xs font-semibold text-slate-800 truncate" title={a.filename}>{a.filename}</div>
                  <div className="text-[11px] text-slate-500 flex flex-wrap gap-x-2">
                    {a.width && a.height ? <span>{a.width}×{a.height}</span> : null}
                    <span>{fmtSize(a.size)}</span>
                    <span>{a.mime.replace("image/", "").toUpperCase()}</span>
                    {a.storage === "db" && <span className="text-amber-700">veritabanında</span>}
                  </div>
                  {risky && (
                    <div className="text-[11px] text-red-700">Bu format bazı mail programlarında görünmez. Görseli yeniden yükle.</div>
                  )}
                  <input defaultValue={a.description ?? ""} placeholder="Açıklama (alt metin)"
                    onBlur={(e) => saveAlt(a, e.target.value.trim())}
                    className="px-2 py-1 text-xs border border-slate-200 rounded" />
                  <div className="mt-auto flex gap-1.5">
                    <button onClick={() => copy(a.url, `u${a.id}`)}
                      className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs rounded border border-slate-200 hover:bg-slate-50">
                      {copied === `u${a.id}` ? <Check size={12} className="text-emerald-600" /> : <Link2 size={12} />} Link
                    </button>
                    <button onClick={() => copy(mailImgTag(a.url, a.description ?? "", a.width), `h${a.id}`)}
                      className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs rounded border border-slate-200 hover:bg-slate-50">
                      {copied === `h${a.id}` ? <Check size={12} className="text-emerald-600" /> : <Code2 size={12} />} HTML kodu
                    </button>
                    <button onClick={() => remove(a)} title="Sil"
                      className="px-2 py-1.5 text-xs rounded border border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-200">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
