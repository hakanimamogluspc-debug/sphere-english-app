import { useEffect, useState } from "react";
import {
  Video, Headphones, Loader2, RefreshCw, Sparkles, Check, X, Search,
  ExternalLink, PlayCircle, Archive, Trash2, Rss, Plus, Globe2,
} from "lucide-react";
import { API } from "@/lib/api-url";

const TOKEN_KEY = "sphere_token";
async function apiFetch(path: string, opts: RequestInit = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.error || `HTTP ${res.status}`);
  return data;
}

const CAT_LABEL: Record<string, string> = {
  career: "Kariyer", motivation: "Motivasyon", entrepreneurship: "Girişimcilik",
  leadership: "Liderlik", productivity: "Verimlilik",
};
const STATUS_LABEL: Record<string, string> = { draft: "Taslak", published: "Yayında", archived: "Arşiv" };
const STATUS_CLR: Record<string, string> = {
  draft: "bg-amber-100 text-amber-800 border-amber-300",
  published: "bg-emerald-100 text-emerald-800 border-emerald-300",
  archived: "bg-gray-100 text-gray-600 border-gray-300",
};

type Item = {
  id: number;
  source_slug: string;
  source_type: "video" | "podcast";
  url: string;
  audio_url: string | null;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  author: string | null;
  duration_sec: number | null;
  language: string;
  published_at: string | null;
  tr_summary: string | null;
  category: string | null;
  tags: string[] | null;
  status: string;
  admin_notes: string | null;
};

export default function AdminCareer() {
  const [tab, setTab] = useState<"library" | "sources" | "logs">("library");
  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-3xl font-bold flex items-center gap-2 text-gray-900">
          <Video className="h-7 w-7 text-indigo-600" />
          Kariyer & Motivasyon İçerikleri
        </h1>
        <p className="text-sm text-gray-500 mt-1">Video + podcast — RSS ile otomatik çekilir, TR özet + kategori üretilir.</p>
      </header>

      <div className="flex gap-1 border-b border-gray-200">
        {[
          { v: "library", l: "İçerikler", icon: Video },
          { v: "sources", l: "Kaynaklar", icon: Rss },
          { v: "logs", l: "Log", icon: RefreshCw },
        ].map((t: any) => (
          <button key={t.v} onClick={() => setTab(t.v)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px ${
              tab === t.v ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-900"
            }`}
          >
            <t.icon className="h-4 w-4" /> {t.l}
          </button>
        ))}
      </div>

      {tab === "library" && <LibraryTab />}
      {tab === "sources" && <SourcesTab />}
      {tab === "logs" && <LogsTab />}
    </div>
  );
}

function LibraryTab() {
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [language, setLanguage] = useState("all");
  const [category, setCategory] = useState("all");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [stats, setStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [ingesting, setIngesting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const p = new URLSearchParams({ status, type, language, category, q, limit: "100" });
      const d = await apiFetch(`/admin/career-content?${p}`);
      setItems(d.items ?? []); setStats(d.stats ?? []);
    } catch (e: any) { alert(e?.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [status, type, language, category, q]);

  async function ingest() {
    if (!confirm("Tüm aktif kaynaklardan yeni içerikler çekilsin mi? (~2-3 dk sürer, GPT enrichment dahil)")) return;
    setIngesting(true);
    try {
      const r = await apiFetch("/admin/career-ingest/run", { method: "POST" });
      alert(`Fetch: ${r.fetched} · Yeni: ${r.inserted} · Enrich: ${r.enriched}/${r.enrichFailed} hata`);
      load();
    } catch (e: any) { alert(e?.message); }
    finally { setIngesting(false); }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border p-3 flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Başlık/özet ara..."
            className="w-full rounded border-gray-300 pl-9 pr-3 py-2 text-sm" />
        </div>
        <select value={type} onChange={(e) => setType(e.target.value)} className="rounded border-gray-300 px-3 py-2 text-sm">
          <option value="all">Tümü</option>
          <option value="video">Video</option>
          <option value="podcast">Podcast</option>
        </select>
        <select value={language} onChange={(e) => setLanguage(e.target.value)} className="rounded border-gray-300 px-3 py-2 text-sm">
          <option value="all">Tüm Diller</option>
          <option value="en">İngilizce</option>
          <option value="tr">Türkçe</option>
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded border-gray-300 px-3 py-2 text-sm">
          <option value="all">Tüm Kategoriler</option>
          {Object.entries(CAT_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded border-gray-300 px-3 py-2 text-sm">
          <option value="all">Tümü</option>
          <option value="draft">Taslak</option>
          <option value="published">Yayında</option>
          <option value="archived">Arşiv</option>
        </select>
        <button onClick={load} className="rounded border border-gray-300 p-2 hover:bg-gray-50"><RefreshCw className="h-4 w-4" /></button>
        <div className="flex-1" />
        <span className="text-sm text-gray-500">{items.length} içerik</span>
        <button onClick={ingest} disabled={ingesting}
          className="rounded bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 text-sm font-medium disabled:opacity-50 inline-flex items-center gap-1.5">
          {ingesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
          Kaynaklardan Çek
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {["draft", "published", "archived"].map(s => {
          const n = stats.find(x => x.status === s)?.n ?? 0;
          return (
            <div key={s} className="bg-white rounded border p-3">
              <div className="text-xs text-gray-500 uppercase">{STATUS_LABEL[s]}</div>
              <div className="text-xl font-bold text-gray-900">{n}</div>
            </div>
          );
        })}
      </div>

      {loading ? <div className="text-center py-12"><Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-400" /></div>
        : items.length === 0 ? <div className="text-center py-16 bg-white rounded-lg border text-gray-500 text-sm">İçerik yok. "Kaynaklardan Çek" ile başla.</div>
        : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map(it => <ItemCard key={it.id} item={it} onClick={() => setSelectedId(it.id)} />)}
          </div>
        )}

      {selectedId && <ItemDrawer id={selectedId} onClose={() => setSelectedId(null)} onChanged={() => { setSelectedId(null); load(); }} />}
    </div>
  );
}

function ItemCard({ item, onClick }: { item: Item; onClick: () => void }) {
  return (
    <div onClick={onClick}
      className="bg-white rounded-lg border hover:border-indigo-400 hover:shadow-md transition cursor-pointer overflow-hidden group">
      <div className="aspect-video bg-gray-100 relative overflow-hidden">
        {item.thumbnail_url ? (
          <img src={item.thumbnail_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-100 to-violet-100">
            {item.source_type === "podcast" ? <Headphones className="h-10 w-10 text-indigo-300" /> : <Video className="h-10 w-10 text-indigo-300" />}
          </div>
        )}
        <div className="absolute top-2 left-2 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded uppercase font-semibold flex items-center gap-1">
          {item.source_type === "podcast" ? <Headphones className="h-3 w-3" /> : <Video className="h-3 w-3" />}
          {item.source_type}
        </div>
        {!item.enriched_at && (
          <div className="absolute top-2 right-2 bg-yellow-100 text-yellow-800 text-[10px] px-2 py-0.5 rounded-full font-semibold">
            enrich bekliyor
          </div>
        )}
      </div>
      <div className="p-3 space-y-1">
        <div className="flex items-center gap-1 flex-wrap text-[10px]">
          <span className={`px-2 py-0.5 rounded-full font-semibold border ${STATUS_CLR[item.status]}`}>{STATUS_LABEL[item.status]}</span>
          {item.category && <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-semibold">{CAT_LABEL[item.category]}</span>}
          <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 font-semibold uppercase">{item.language}</span>
          {item.author && <span className="text-gray-400 truncate">· {item.author}</span>}
        </div>
        <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 leading-snug">{item.title}</h3>
        {item.tr_summary && <p className="text-xs text-gray-600 line-clamp-2">{item.tr_summary}</p>}
      </div>
    </div>
  );
}

function ItemDrawer({ id, onClose, onChanged }: { id: number; onClose: () => void; onChanged: () => void }) {
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({});

  useEffect(() => {
    (async () => {
      try {
        const d = await apiFetch(`/admin/career-content?q=&limit=100`);
        const found = (d.items ?? []).find((x: Item) => x.id === id);
        if (found) { setItem(found); setForm(found); }
      } catch { }
      finally { setLoading(false); }
    })();
  }, [id]);

  async function save() {
    setSaving(true);
    try {
      await apiFetch(`/admin/career-content/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: form.title, description: form.description,
          tr_summary: form.tr_summary, category: form.category,
          tags: Array.isArray(form.tags) ? form.tags : String(form.tags ?? "").split(",").map((s: string) => s.trim()).filter(Boolean),
          language: form.language, thumbnail_url: form.thumbnail_url,
          admin_notes: form.admin_notes,
        }),
      });
      onChanged();
    } catch (e: any) { alert(e?.message); }
    finally { setSaving(false); }
  }

  async function publish() { setSaving(true); try { await save(); await apiFetch(`/admin/career-content/${id}/publish`, { method: "POST" }); onChanged(); } catch (e: any) { alert(e?.message); } finally { setSaving(false); } }
  async function archive() { if (!confirm("Arşive alınsın mı?")) return; try { await apiFetch(`/admin/career-content/${id}/archive`, { method: "POST" }); onChanged(); } catch (e: any) { alert(e?.message); } }
  async function reenrich() { if (!confirm("GPT ile TR özet yeniden üretilsin mi?")) return; try { const r = await apiFetch(`/admin/career-content/${id}/reenrich`, { method: "POST" }); if (r.ok) window.location.reload(); else alert(`Hata: ${r.error}`); } catch (e: any) { alert(e?.message); } }
  async function del() { if (!confirm("Kalıcı silinsin mi?")) return; try { await apiFetch(`/admin/career-content/${id}`, { method: "DELETE" }); onChanged(); } catch (e: any) { alert(e?.message); } }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <div className="h-full w-full max-w-3xl overflow-y-auto bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-5 py-3">
          <h3 className="text-lg font-semibold">İçerik Detayı</h3>
          <button onClick={onClose}><X className="h-5 w-5 text-gray-400" /></button>
        </div>
        {loading || !item ? <div className="p-8 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-400" /></div>
          : (
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-2 text-xs flex-wrap">
                <span className={`px-2 py-0.5 rounded-full font-semibold border ${STATUS_CLR[item.status]}`}>{STATUS_LABEL[item.status]}</span>
                <span className="text-gray-400">·</span>
                <span className="text-gray-600">{item.source_type} · {item.language}</span>
                <a href={item.url} target="_blank" rel="noreferrer" className="ml-auto text-indigo-600 hover:underline inline-flex items-center gap-1">
                  <ExternalLink className="h-3 w-3" /> Kaynağı aç
                </a>
              </div>
              {item.thumbnail_url && <img src={item.thumbnail_url} alt="" className="w-full aspect-video object-cover rounded-lg" />}

              <Field label="Başlık" value={form.title} onChange={v => setForm({ ...form, title: v })} />
              <Field label="Türkçe Özet" value={form.tr_summary} onChange={v => setForm({ ...form, tr_summary: v })} textarea rows={4} />
              <div className="grid grid-cols-2 gap-3">
                <Select label="Kategori" value={form.category ?? ""} options={[["", "—"], ...Object.entries(CAT_LABEL)]} onChange={v => setForm({ ...form, category: v })} />
                <Select label="Dil" value={form.language ?? ""} options={[["en", "İngilizce"], ["tr", "Türkçe"]]} onChange={v => setForm({ ...form, language: v })} />
              </div>
              <Field label="Etiketler (virgülle)" value={Array.isArray(form.tags) ? form.tags.join(", ") : (form.tags ?? "")} onChange={v => setForm({ ...form, tags: v })} />
              <Field label="Görsel URL" value={form.thumbnail_url ?? ""} onChange={v => setForm({ ...form, thumbnail_url: v })} />
              {form.description && <details className="text-xs border rounded"><summary className="px-3 py-2 cursor-pointer">Açıklama (orijinal)</summary><div className="px-3 py-2 whitespace-pre-wrap max-h-60 overflow-y-auto">{form.description}</div></details>}

              <div className="flex flex-wrap gap-2 border-t pt-4">
                <button onClick={del} className="rounded bg-red-50 hover:bg-red-100 text-red-700 px-3 py-2 text-sm font-medium inline-flex items-center gap-1"><Trash2 className="h-4 w-4" /></button>
                <button onClick={archive} className="rounded bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 text-sm font-medium inline-flex items-center gap-1"><Archive className="h-4 w-4" /></button>
                <button onClick={reenrich} className="rounded bg-violet-50 hover:bg-violet-100 text-violet-700 px-3 py-2 text-sm font-medium inline-flex items-center gap-1"><Sparkles className="h-4 w-4" /> Yeniden Üret</button>
                <div className="flex-1" />
                <button onClick={save} disabled={saving} className="rounded border border-indigo-600 text-indigo-600 hover:bg-indigo-50 px-4 py-2 text-sm font-medium">{saving ? <Loader2 className="h-4 w-4 animate-spin inline" /> : "Kaydet"}</button>
                {item.status !== "published" && <button onClick={publish} disabled={saving} className="rounded bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 text-sm font-medium inline-flex items-center gap-1"><Check className="h-4 w-4" /> Yayınla</button>}
              </div>
            </div>
          )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, textarea, rows }: any) {
  return (
    <div>
      <label className="text-xs font-semibold text-gray-500 mb-1 block">{label}</label>
      {textarea
        ? <textarea value={value ?? ""} onChange={e => onChange(e.target.value)} rows={rows ?? 2} className="w-full rounded border-gray-300 px-3 py-2 text-sm" />
        : <input value={value ?? ""} onChange={e => onChange(e.target.value)} className="w-full rounded border-gray-300 px-3 py-2 text-sm" />}
    </div>
  );
}
function Select({ label, value, options, onChange }: any) {
  return (
    <div>
      <label className="text-xs font-semibold text-gray-500 mb-1 block">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} className="w-full rounded border-gray-300 px-3 py-2 text-sm">
        {options.map(([v, l]: any) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}

// ─── SOURCES TAB ────────────────────────────────────────────
function SourcesTab() {
  const [sources, setSources] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  async function load() {
    setLoading(true);
    try { const d = await apiFetch("/admin/career-sources"); setSources(d.sources ?? []); }
    catch (e: any) { alert(e?.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function toggle(s: any) {
    try { await apiFetch(`/admin/career-sources/${s.id}`, { method: "PATCH", body: JSON.stringify({ is_active: !s.is_active }) }); load(); }
    catch (e: any) { alert(e?.message); }
  }
  async function del(s: any) {
    if (!confirm(`${s.name} kaynağı silinsin mi? İçerikler kalır ama yeni fetch olmaz.`)) return;
    try { await apiFetch(`/admin/career-sources/${s.id}`, { method: "DELETE" }); load(); }
    catch (e: any) { alert(e?.message); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600">{sources.length} kaynak</span>
        <div className="flex-1" />
        <button onClick={load} className="rounded border border-gray-300 p-2 hover:bg-gray-50"><RefreshCw className="h-4 w-4" /></button>
        <button onClick={() => setAddOpen(true)} className="rounded bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 text-sm font-medium inline-flex items-center gap-1">
          <Plus className="h-4 w-4" /> Kaynak Ekle
        </button>
      </div>

      {loading ? <div className="text-center py-8"><Loader2 className="mx-auto h-5 w-5 animate-spin text-gray-400" /></div>
        : (
          <div className="bg-white rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-600">
                <tr>
                  <th className="text-left px-4 py-2">Kaynak</th>
                  <th className="text-left px-4 py-2">Tür</th>
                  <th className="text-left px-4 py-2">Dil</th>
                  <th className="text-right px-4 py-2">İçerik</th>
                  <th className="text-left px-4 py-2">Son Çekim</th>
                  <th className="text-right px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sources.map(s => (
                  <tr key={s.id} className={s.is_active ? "" : "opacity-50"}>
                    <td className="px-4 py-2">
                      <div className="font-semibold">{s.name}</div>
                      <div className="text-[10px] text-gray-500 font-mono truncate max-w-[400px]">{s.feed_url}</div>
                    </td>
                    <td className="px-4 py-2 text-xs">{s.source_type}</td>
                    <td className="px-4 py-2 text-xs uppercase">{s.language}</td>
                    <td className="px-4 py-2 text-right font-semibold">{s.content_count}</td>
                    <td className="px-4 py-2 text-xs text-gray-500">{s.last_fetched_at ? new Date(s.last_fetched_at).toLocaleString("tr-TR") : "—"}</td>
                    <td className="px-4 py-2 text-right space-x-1">
                      <button onClick={() => toggle(s)} className={`rounded px-2 py-1 text-xs font-medium ${s.is_active ? "bg-amber-50 text-amber-700 hover:bg-amber-100" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"}`}>
                        {s.is_active ? "Durdur" : "Aktifleştir"}
                      </button>
                      <button onClick={() => del(s)} className="rounded p-1 text-red-500 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      {addOpen && <AddSourceModal onClose={() => setAddOpen(false)} onCreated={() => { setAddOpen(false); load(); }} />}
    </div>
  );
}

function AddSourceModal({ onClose, onCreated }: any) {
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [source_type, setType] = useState("video");
  const [language, setLanguage] = useState("en");
  const [feed_url, setFeedUrl] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!slug.trim() || !name.trim() || !feed_url.trim()) return;
    setSaving(true);
    try {
      await apiFetch("/admin/career-sources", { method: "POST", body: JSON.stringify({ slug, name, source_type, language, feed_url }) });
      onCreated();
    } catch (e: any) { alert(e?.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h3 className="text-lg font-semibold">Kaynak Ekle</h3>
          <button onClick={onClose}><X className="h-5 w-5 text-gray-400" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Slug (uniquue)" value={slug} onChange={setSlug} />
            <Field label="Görünen Ad" value={name} onChange={setName} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Tür" value={source_type} options={[["video", "Video"], ["podcast", "Podcast"]]} onChange={setType} />
            <Select label="Dil" value={language} options={[["en", "İngilizce"], ["tr", "Türkçe"]]} onChange={setLanguage} />
          </div>
          <Field label="RSS/Feed URL" value={feed_url} onChange={setFeedUrl} />
          <div className="text-[11px] text-gray-500 -mt-2">
            YouTube kanalı için: <code className="bg-gray-100 px-1">https://www.youtube.com/feeds/videos.xml?channel_id=UC...</code>
          </div>
          <div className="flex gap-2 border-t pt-3">
            <button onClick={onClose} className="rounded border border-gray-300 px-3 py-1.5 text-sm">İptal</button>
            <button onClick={submit} disabled={saving} className="ml-auto rounded bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 text-sm font-medium">{saving ? <Loader2 className="h-4 w-4 animate-spin inline" /> : "Ekle"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LogsTab() {
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => { (async () => { setLoading(true); try { const d = await apiFetch("/admin/career-ingest/status"); setRuns(d.runs ?? []); } catch (e: any) { alert(e?.message); } finally { setLoading(false); } })(); }, []);
  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-xs uppercase text-gray-600">
          <tr>
            <th className="text-left px-4 py-2">Zaman</th>
            <th className="text-right px-4 py-2">Fetch</th>
            <th className="text-right px-4 py-2">Yeni</th>
            <th className="text-right px-4 py-2">Enrich</th>
            <th className="text-right px-4 py-2">Hata</th>
            <th className="text-right px-4 py-2">Süre</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {loading ? <tr><td colSpan={6} className="text-center py-6 text-gray-400"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>
            : runs.length === 0 ? <tr><td colSpan={6} className="text-center py-6 text-gray-500 text-sm">Henüz ingestion çalışmadı</td></tr>
            : runs.map(r => (
              <tr key={r.id}>
                <td className="px-4 py-2">{new Date(r.run_at).toLocaleString("tr-TR")}</td>
                <td className="px-4 py-2 text-right">{r.fetched_count}</td>
                <td className="px-4 py-2 text-right font-semibold text-emerald-700">{r.new_count}</td>
                <td className="px-4 py-2 text-right">{r.enriched_count}</td>
                <td className="px-4 py-2 text-right">{r.error_count > 0 ? <span className="text-red-600 font-semibold">{r.error_count}</span> : 0}</td>
                <td className="px-4 py-2 text-right text-gray-500">{(r.duration_ms / 1000).toFixed(1)}s</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
