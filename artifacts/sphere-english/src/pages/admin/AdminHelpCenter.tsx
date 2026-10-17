import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link } from "wouter";
import {
  LifeBuoy, RefreshCw, Loader2, AlertCircle, X, Plus, Trash2, Eye, EyeOff, Pencil, Check,
  Search, ThumbsUp, ThumbsDown, ExternalLink, BarChart3, FolderOpen, FileText,
} from "lucide-react";
import { API } from "@/lib/api-url";
import Markdown from "@/components/help/Markdown";

const TOKEN_KEY = "sphere_token";
async function apiFetch(path: string, opts: RequestInit = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

type Tab = "articles" | "categories" | "stats";
interface Category { id: number; slug: string; title: string; description: string | null; icon: string | null; audience: string; sortOrder: number; isActive: boolean; articleCount: number }
interface ArticleRow {
  id: number; slug: string; title: string; summary: string; audience: string; tags: string[]; isPublished: boolean;
  sortOrder: number; viewCount: number; helpfulYes: number; helpfulNo: number; categoryId: number | null; categoryTitle: string | null; updatedAt: string;
}
interface ArticleForm {
  id?: number; categoryId: number | null; slug: string; title: string; summary: string; bodyMd: string;
  audience: string; tags: string; isPublished: boolean; sortOrder: number;
}
const emptyForm = (): ArticleForm => ({ categoryId: null, slug: "", title: "", summary: "", bodyMd: "", audience: "all", tags: "", isPublished: false, sortOrder: 100 });

const AUD_LABEL: Record<string, string> = { all: "Herkes", student: "Öğrenci", corporate: "Kurumsal yönetici" };
const ICON_OPTIONS = ["Rocket", "UserCircle", "Video", "Sparkles", "TrendingUp", "BookOpen", "CreditCard", "Building2", "ShieldCheck"];

export default function AdminHelpCenter() {
  const [tab, setTab] = useState<Tab>("articles");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-blue-800 flex items-center gap-2"><LifeBuoy size={26} /> Yardım Merkezi</h1>
          <p className="text-sm text-slate-500 mt-1">
            app.sphereenglish.com/yardim ve www.sphereenglish.com/yardim — makaleler, kategoriler, arama istatistikleri. Chatbot da bu makaleleri kaynak olarak kullanır.
          </p>
        </div>
        <a href="/yardim" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-sky-700 hover:underline">
          Canlı sayfayı aç <ExternalLink size={14} />
        </a>
      </header>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700 flex justify-between items-center">
          <span className="flex items-center gap-2"><AlertCircle size={16} /> {error}</span>
          <button onClick={() => setError(null)}><X size={14} /></button>
        </div>
      )}

      <div className="flex gap-1 border-b border-slate-200 mb-6">
        {([["articles", "Makaleler", FileText], ["categories", "Kategoriler", FolderOpen], ["stats", "İstatistik", BarChart3]] as const).map(([k, label, Icon]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px inline-flex items-center gap-1.5 ${tab === k ? "border-blue-700 text-blue-800" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {tab === "articles" && <ArticlesTab onError={setError} />}
      {tab === "categories" && <CategoriesTab onError={setError} />}
      {tab === "stats" && <StatsTab onError={setError} />}
    </div>
  );
}

// ─── Makaleler ───────────────────────────────────────────────────────────────
function ArticlesTab({ onError }: { onError: (m: string) => void }) {
  const [rows, setRows] = useState<ArticleRow[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [form, setForm] = useState<ArticleForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, c] = await Promise.all([apiFetch(`/admin/help/articles${q ? `?q=${encodeURIComponent(q)}` : ""}`), apiFetch("/admin/help/categories")]);
      setRows(a.articles); setCats(c.categories);
    } catch (e: any) { onError(e.message); } finally { setLoading(false); }
  }, [q, onError]);
  useEffect(() => { load(); }, [load]);

  const edit = async (id: number) => {
    try {
      const d = await apiFetch(`/admin/help/articles/${id}`);
      const a = d.article;
      setForm({ id: a.id, categoryId: a.categoryId, slug: a.slug, title: a.title, summary: a.summary, bodyMd: a.bodyMd, audience: a.audience, tags: (a.tags ?? []).join(", "), isPublished: a.isPublished, sortOrder: a.sortOrder });
      setPreview(false);
    } catch (e: any) { onError(e.message); }
  };

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const payload = { ...form, tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean), slug: form.slug || undefined };
      if (form.id) await apiFetch(`/admin/help/articles/${form.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      else await apiFetch("/admin/help/articles", { method: "POST", body: JSON.stringify(payload) });
      setForm(null); await load();
    } catch (e: any) { onError(e.message); } finally { setSaving(false); }
  };

  const togglePublish = async (r: ArticleRow) => {
    try { await apiFetch(`/admin/help/articles/${r.id}`, { method: "PATCH", body: JSON.stringify({ isPublished: !r.isPublished }) }); await load(); }
    catch (e: any) { onError(e.message); }
  };
  const remove = async (r: ArticleRow) => {
    if (!confirm(`"${r.title}" silinsin mi? Geri alınamaz.`)) return;
    try { await apiFetch(`/admin/help/articles/${r.id}`, { method: "DELETE" }); await load(); } catch (e: any) { onError(e.message); }
  };

  if (form) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">{form.id ? "Makaleyi düzenle" : "Yeni makale"}</h2>
          <div className="flex gap-2">
            <button onClick={() => setPreview(!preview)} className="px-3 py-1.5 rounded-lg border text-sm font-semibold">{preview ? "Düzenle" : "Önizle"}</button>
            <button onClick={() => setForm(null)} className="px-3 py-1.5 rounded-lg border text-sm font-semibold">Vazgeç</button>
            <button onClick={save} disabled={saving || !form.title.trim()} className="px-4 py-1.5 rounded-lg bg-blue-700 text-white text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Kaydet
            </button>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-[1fr_280px]">
          <div className="space-y-3">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Başlık (soru biçiminde: 'Şifremi unuttum, ne yapmalıyım?')" className="w-full border rounded-lg px-3 py-2 font-semibold" />
            <textarea value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} placeholder="Özet — liste kartında ve chatbot'ta görünür (1–2 cümle)" rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" />
            {preview ? (
              <div className="border rounded-lg p-4 bg-slate-50 min-h-[300px]"><Markdown source={form.bodyMd} /></div>
            ) : (
              <textarea value={form.bodyMd} onChange={(e) => setForm({ ...form, bodyMd: e.target.value })} placeholder={"Markdown: ## Başlık, **kalın**, - madde, 1. adım, > not, [link](/yardim/baska-makale)"} rows={18} className="w-full border rounded-lg px-3 py-2 text-sm font-mono" />
            )}
          </div>
          <div className="space-y-3 text-sm">
            <label className="block">Kategori
              <select value={form.categoryId ?? ""} onChange={(e) => setForm({ ...form, categoryId: e.target.value ? Number(e.target.value) : null })} className="mt-1 w-full border rounded-lg px-2 py-2">
                <option value="">— yok —</option>
                {cats.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </label>
            <label className="block">Hedef kitle
              <select value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })} className="mt-1 w-full border rounded-lg px-2 py-2">
                {Object.entries(AUD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="block">Etiketler (virgülle)
              <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} className="mt-1 w-full border rounded-lg px-2 py-2" placeholder="şifre, giriş, parola" />
            </label>
            <label className="block">URL slug
              <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="mt-1 w-full border rounded-lg px-2 py-2 font-mono text-xs" placeholder="boş bırakılırsa başlıktan üretilir" />
            </label>
            <label className="block">Sıra (küçük önce)
              <input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} className="mt-1 w-full border rounded-lg px-2 py-2" />
            </label>
            <label className="flex items-center gap-2 font-semibold">
              <input type="checkbox" checked={form.isPublished} onChange={(e) => setForm({ ...form, isPublished: e.target.checked })} /> Yayında
            </label>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Makale ara…" className="w-full border rounded-lg pl-9 pr-3 py-2 text-sm" />
        </div>
        <button onClick={load} className="px-3 py-2 rounded-lg border text-sm inline-flex items-center gap-1.5"><RefreshCw size={14} /> Yenile</button>
        <button onClick={() => { setForm(emptyForm()); setPreview(false); }} className="px-3 py-2 rounded-lg bg-blue-700 text-white text-sm font-semibold inline-flex items-center gap-1.5"><Plus size={14} /> Yeni makale</button>
      </div>
      {loading ? <div className="py-10 text-center text-slate-400"><Loader2 className="animate-spin inline" /></div> : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-3 py-2">Makale</th>
                <th className="text-left px-3 py-2">Kategori</th>
                <th className="text-left px-3 py-2">Kitle</th>
                <th className="text-right px-3 py-2">Görüntülenme</th>
                <th className="text-right px-3 py-2">Faydalı</th>
                <th className="text-center px-3 py-2">Durum</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <div className="font-semibold text-slate-800">{r.title}</div>
                    <div className="text-xs text-slate-400 font-mono">/yardim/{r.slug}</div>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{r.categoryTitle ?? "—"}</td>
                  <td className="px-3 py-2 text-slate-600">{AUD_LABEL[r.audience] ?? r.audience}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.viewCount}</td>
                  <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                    <span className="text-emerald-700">{r.helpfulYes}</span> / <span className="text-red-600">{r.helpfulNo}</span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button onClick={() => togglePublish(r)} title={r.isPublished ? "Yayından kaldır" : "Yayınla"} className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${r.isPublished ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      {r.isPublished ? <Eye size={12} /> : <EyeOff size={12} />} {r.isPublished ? "Yayında" : "Taslak"}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <Link href={`/yardim/${r.slug}`} className="inline-block p-1.5 text-slate-400 hover:text-sky-700" title="Görüntüle"><ExternalLink size={15} /></Link>
                    <button onClick={() => edit(r.id)} className="p-1.5 text-slate-500 hover:text-blue-700" title="Düzenle"><Pencil size={15} /></button>
                    <button onClick={() => remove(r)} className="p-1.5 text-slate-400 hover:text-red-600" title="Sil"><Trash2 size={15} /></button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-400">Makale yok</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Kategoriler ─────────────────────────────────────────────────────────────
function CategoriesTab({ onError }: { onError: (m: string) => void }) {
  const [cats, setCats] = useState<Category[]>([]);
  const [editing, setEditing] = useState<Partial<Category> | null>(null);
  const load = useCallback(async () => {
    try { const d = await apiFetch("/admin/help/categories"); setCats(d.categories); } catch (e: any) { onError(e.message); }
  }, [onError]);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!editing?.title) return;
    try {
      if (editing.id) await apiFetch(`/admin/help/categories/${editing.id}`, { method: "PATCH", body: JSON.stringify(editing) });
      else await apiFetch("/admin/help/categories", { method: "POST", body: JSON.stringify(editing) });
      setEditing(null); await load();
    } catch (e: any) { onError(e.message); }
  };
  const remove = async (c: Category) => {
    if (!confirm(`"${c.title}" silinsin mi?`)) return;
    try { await apiFetch(`/admin/help/categories/${c.id}`, { method: "DELETE" }); await load(); } catch (e: any) { onError(e.message); }
  };

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_320px]">
      <div className="bg-white rounded-xl border border-slate-200 divide-y">
        {cats.map((c) => (
          <div key={c.id} className="flex items-center gap-3 px-4 py-3">
            <div className="flex-1">
              <div className="font-semibold text-slate-800">{c.title} <span className="text-xs text-slate-400 font-normal">· {c.articleCount} makale · sıra {c.sortOrder}</span></div>
              <div className="text-xs text-slate-500">{c.description}</div>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full ${c.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{c.isActive ? "Aktif" : "Pasif"}</span>
            <button onClick={() => setEditing(c)} className="p-1.5 text-slate-500 hover:text-blue-700"><Pencil size={15} /></button>
            <button onClick={() => remove(c)} className="p-1.5 text-slate-400 hover:text-red-600"><Trash2 size={15} /></button>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 text-sm h-fit">
        <div className="flex items-center justify-between">
          <h3 className="font-bold">{editing?.id ? "Kategoriyi düzenle" : "Yeni kategori"}</h3>
          {editing && <button onClick={() => setEditing(null)} className="text-xs text-slate-500">Vazgeç</button>}
        </div>
        <input value={editing?.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="Başlık" className="w-full border rounded-lg px-2 py-2" />
        <input value={editing?.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} placeholder="Kısa açıklama" className="w-full border rounded-lg px-2 py-2" />
        <select value={editing?.icon ?? ""} onChange={(e) => setEditing({ ...editing, icon: e.target.value })} className="w-full border rounded-lg px-2 py-2">
          <option value="">İkon</option>
          {ICON_OPTIONS.map((i) => <option key={i} value={i}>{i}</option>)}
        </select>
        <select value={editing?.audience ?? "all"} onChange={(e) => setEditing({ ...editing, audience: e.target.value })} className="w-full border rounded-lg px-2 py-2">
          {Object.entries(AUD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input type="number" value={editing?.sortOrder ?? 100} onChange={(e) => setEditing({ ...editing, sortOrder: Number(e.target.value) })} className="w-full border rounded-lg px-2 py-2" placeholder="Sıra" />
        <label className="flex items-center gap-2"><input type="checkbox" checked={editing?.isActive ?? true} onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })} /> Aktif</label>
        <button onClick={save} disabled={!editing?.title} className="w-full px-3 py-2 rounded-lg bg-blue-700 text-white font-semibold disabled:opacity-50">Kaydet</button>
      </div>
    </div>
  );
}

// ─── İstatistik ──────────────────────────────────────────────────────────────
function StatsTab({ onError }: { onError: (m: string) => void }) {
  const [d, setD] = useState<any>(null);
  useEffect(() => { apiFetch("/admin/help/overview").then(setD).catch((e) => onError(e.message)); }, [onError]);
  if (!d) return <div className="py-10 text-center text-slate-400"><Loader2 className="animate-spin inline" /></div>;
  const t = d.totals;
  const ratio = t.helpfulYes + t.helpfulNo > 0 ? Math.round((t.helpfulYes / (t.helpfulYes + t.helpfulNo)) * 100) : null;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[["Makale", `${t.published}/${t.articles}`, "yayında / toplam"], ["Görüntülenme", t.views, "toplam"], ["Faydalı oyu", ratio == null ? "—" : `%${ratio}`, `${t.helpfulYes} evet · ${t.helpfulNo} hayır`], ["Sıfır sonuçlu arama", d.zeroResultSearches.length, "son 30 gün · eksik konu sinyali"]].map(([l, v, s]) => (
          <div key={String(l)} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-xs text-slate-500">{l}</div>
            <div className="text-2xl font-bold text-slate-800 mt-1">{v as any}</div>
            <div className="text-xs text-slate-400">{s}</div>
          </div>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="En çok okunan">
          {d.topArticles.map((a: any) => <Row key={a.slug} left={a.title} right={`${a.viewCount} · ${a.helpfulYes}/${a.helpfulNo}`} />)}
        </Panel>
        <Panel title="En düşük puanlı (≥3 oy)">
          {d.lowRated.length === 0 ? <p className="text-sm text-slate-400">Henüz yeterli oy yok.</p> : d.lowRated.map((a: any) => <Row key={a.slug} left={a.title} right={<><ThumbsUp size={12} className="inline" /> {a.helpfulYes} <ThumbsDown size={12} className="inline ml-1" /> {a.helpfulNo}</>} />)}
        </Panel>
        <Panel title="En çok aranan (30 gün)">
          {d.topSearches.map((s: any) => <Row key={s.query} left={s.query} right={`${s.n}×`} />)}
        </Panel>
        <Panel title="Sonuç bulunamayan aramalar — makale yazılacak konular">
          {d.zeroResultSearches.length === 0 ? <p className="text-sm text-slate-400">Yok.</p> : d.zeroResultSearches.map((s: any) => <Row key={s.query} left={s.query} right={`${s.n}×`} />)}
        </Panel>
      </div>
    </div>
  );
}
function Panel({ title, children }: { title: string; children: ReactNode }) {
  return <div className="bg-white rounded-xl border border-slate-200 p-4"><h3 className="font-bold text-sm mb-2">{title}</h3><div className="divide-y divide-slate-100">{children}</div></div>;
}
function Row({ left, right }: { left: ReactNode; right: ReactNode }) {
  return <div className="flex items-center justify-between gap-3 py-1.5 text-sm"><span className="text-slate-700 truncate">{left}</span><span className="text-slate-500 tabular-nums whitespace-nowrap">{right}</span></div>;
}
