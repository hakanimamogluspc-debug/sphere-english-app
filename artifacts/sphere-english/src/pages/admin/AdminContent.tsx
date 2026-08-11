import { useEffect, useMemo, useState } from "react";
import {
  Newspaper, Loader2, RefreshCw, Check, X, Search, ExternalLink, Sparkles,
  Trash2, Archive, Filter, PlayCircle, Clock, Tag as TagIcon, Plus,
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

// ─── Types ────────────────────────────────────────────────────────────
type Article = {
  id: number;
  source: string;
  external_id: string | null;
  url: string;
  title: string;
  subtitle: string | null;
  snippet: string | null;
  body_html?: string | null;
  body_text?: string | null;
  image_url: string | null;
  author: string | null;
  published_at: string | null;
  tr_summary: string | null;
  cefr_level: string | null;
  category: string | null;
  tags: string[] | null;
  key_vocab?: Array<{ word: string; meaning_tr: string; context: string }> | null;
  status: string;
  admin_notes: string | null;
  enriched_at: string | null;
  published_admin_at: string | null;
  created_at: string;
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Taslak",
  published: "Yayında",
  archived: "Arşiv",
  failed: "Hatalı",
};
const STATUS_CLR: Record<string, string> = {
  draft: "bg-amber-100 text-amber-800 border-amber-300",
  published: "bg-emerald-100 text-emerald-800 border-emerald-300",
  archived: "bg-gray-100 text-gray-600 border-gray-300",
  failed: "bg-red-100 text-red-700 border-red-300",
};
const CATEGORY_LABEL: Record<string, string> = {
  finance: "Finans",
  tech: "Teknoloji",
  leadership: "Liderlik",
  negotiation: "Müzakere",
  general: "Genel",
};
const CATEGORY_CLR: Record<string, string> = {
  finance: "bg-blue-100 text-blue-800",
  tech: "bg-violet-100 text-violet-800",
  leadership: "bg-orange-100 text-orange-800",
  negotiation: "bg-teal-100 text-teal-800",
  general: "bg-gray-100 text-gray-700",
};

export default function AdminContent() {
  const [tab, setTab] = useState<"library" | "logs">("library");
  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2 text-gray-900">
            <Newspaper className="h-7 w-7 text-indigo-600" />
            İçerik Kütüphanesi
          </h1>
          <p className="text-sm text-gray-500 mt-1">Guardian + manuel makaleler — LLM ile zenginleştirilmiş.</p>
        </div>
      </header>

      <div className="flex gap-1 border-b border-gray-200">
        <TabBtn active={tab === "library"} onClick={() => setTab("library")} icon={Newspaper} label="Makaleler" />
        <TabBtn active={tab === "logs"} onClick={() => setTab("logs")} icon={Clock} label="İngestion Log" />
      </div>

      {tab === "library" && <LibraryTab />}
      {tab === "logs" && <LogsTab />}
    </div>
  );
}

function TabBtn({ active, onClick, icon: Icon, label }: any) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px ${
        active ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-900"
      }`}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}

// ─── LIBRARY TAB ─────────────────────────────────────────────────────
function LibraryTab() {
  const [status, setStatus] = useState<string>("all");
  const [category, setCategory] = useState<string>("all");
  const [cefr, setCefr] = useState<string>("all");
  const [q, setQ] = useState("");
  const [articles, setArticles] = useState<Article[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [ingesting, setIngesting] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status, category, cefr, q, limit: "100" });
      const d = await apiFetch(`/admin/content-articles?${params}`);
      setArticles(d.articles ?? []);
      setTotal(d.total ?? 0);
    } catch (e: any) { alert(e?.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [status, category, cefr, q]);

  async function runIngest() {
    if (!confirm("Guardian'dan yeni makaleler çekilsin mi? (yaklaşık 1-2 dk sürer, GPT enrichment dahil)")) return;
    setIngesting(true);
    try {
      const r = await apiFetch("/admin/content-ingest/run", { method: "POST" });
      alert(`Fetch: ${r.fetched} · Yeni: ${r.inserted} · Enrich: ${r.enriched}/${r.enrichFailed} hata`);
      load();
    } catch (e: any) { alert(e?.message); }
    finally { setIngesting(false); }
  }

  async function runLearningIngest() {
    if (!confirm("BBC Learning English + VOA Learning English'ten seviye-uyumlu makaleler çekilsin mi?")) return;
    setIngesting(true);
    try {
      const r = await apiFetch("/admin/content-ingest/learning-english", { method: "POST" });
      alert(`Fetch: ${r.fetched} · Yeni: ${r.inserted} · Enrich: ${r.enriched}/${r.enrichFailed} hata`);
      load();
    } catch (e: any) { alert(e?.message); }
    finally { setIngesting(false); }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 bg-white rounded-lg border p-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Başlık veya özet ara..."
            className="w-full rounded border-gray-300 pl-9 pr-3 py-2 text-sm"
          />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded border-gray-300 px-3 py-2 text-sm">
          <option value="all">Tüm Durumlar</option>
          <option value="draft">Taslak</option>
          <option value="published">Yayında</option>
          <option value="archived">Arşiv</option>
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded border-gray-300 px-3 py-2 text-sm">
          <option value="all">Tüm Kategoriler</option>
          <option value="finance">Finans</option>
          <option value="tech">Teknoloji</option>
          <option value="leadership">Liderlik</option>
          <option value="negotiation">Müzakere</option>
          <option value="general">Genel</option>
        </select>
        <select value={cefr} onChange={(e) => setCefr(e.target.value)} className="rounded border-gray-300 px-3 py-2 text-sm">
          <option value="all">Tüm Seviyeler</option>
          {["A2","B1","B2","C1","C2"].map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={load} className="rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50">
          <RefreshCw className="h-4 w-4" />
        </button>
        <div className="flex-1" />
        <span className="text-sm text-gray-500">{total} makale</span>
        <button
          onClick={() => setAddOpen(true)}
          className="rounded bg-white border border-gray-300 hover:bg-gray-50 px-3 py-2 text-sm inline-flex items-center gap-1"
        >
          <Plus className="h-4 w-4" /> Manuel Ekle
        </button>
        <button
          onClick={runLearningIngest}
          disabled={ingesting}
          className="rounded bg-teal-600 hover:bg-teal-500 text-white px-4 py-2 text-sm font-medium disabled:opacity-50 inline-flex items-center gap-1.5"
        >
          {ingesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
          BBC + VOA Çek
        </button>
        <button
          onClick={runIngest}
          disabled={ingesting}
          className="rounded bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 text-sm font-medium disabled:opacity-50 inline-flex items-center gap-1.5"
        >
          {ingesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
          Guardian'dan Çek
        </button>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="text-center py-16"><Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-400" /></div>
      ) : articles.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border text-gray-500">
          <Newspaper className="mx-auto h-10 w-10 mb-2 opacity-40" />
          <p className="text-sm">Bu filtreye uyan makale yok. "Guardian'dan Çek" ile başlayabilirsin.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {articles.map(a => (
            <ArticleCard key={a.id} article={a} onClick={() => setSelectedId(a.id)} />
          ))}
        </div>
      )}

      {selectedId && (
        <ArticleDetailDrawer
          articleId={selectedId}
          onClose={() => setSelectedId(null)}
          onChanged={() => { setSelectedId(null); load(); }}
        />
      )}

      {addOpen && (
        <ManualAddModal onClose={() => setAddOpen(false)} onCreated={() => { setAddOpen(false); load(); }} />
      )}
    </div>
  );
}

function ArticleCard({ article, onClick }: { article: Article; onClick: () => void }) {
  const status = STATUS_LABEL[article.status] || article.status;
  const cat = article.category ? CATEGORY_LABEL[article.category] || article.category : null;

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg border hover:border-indigo-400 hover:shadow-md transition cursor-pointer overflow-hidden group"
    >
      {article.image_url && (
        <div className="aspect-video bg-gray-100 relative overflow-hidden">
          <img src={article.image_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition" />
          {!article.enriched_at && (
            <div className="absolute top-2 right-2 bg-yellow-100 text-yellow-800 text-[10px] font-semibold px-2 py-0.5 rounded-full">
              enrich bekliyor
            </div>
          )}
        </div>
      )}
      <div className="p-4 space-y-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STATUS_CLR[article.status]}`}>
            {status}
          </span>
          {cat && (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${CATEGORY_CLR[article.category!]}`}>
              {cat}
            </span>
          )}
          {article.cefr_level && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-800">
              {article.cefr_level}
            </span>
          )}
          <span className="ml-auto text-[10px] text-gray-400">{article.source}</span>
        </div>
        <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 leading-snug">{article.title}</h3>
        {article.tr_summary ? (
          <p className="text-xs text-gray-600 line-clamp-3">{article.tr_summary}</p>
        ) : article.snippet ? (
          <p className="text-xs text-gray-500 italic line-clamp-3">EN: {article.snippet}</p>
        ) : null}
        <div className="text-[10px] text-gray-400 flex items-center gap-2 pt-1">
          {article.published_at && <span>{new Date(article.published_at).toLocaleDateString("tr-TR")}</span>}
          {article.author && <span>· {article.author}</span>}
        </div>
      </div>
    </div>
  );
}

// ─── Article Detail Drawer ────────────────────────────────────────────
function ArticleDetailDrawer({ articleId, onClose, onChanged }: {
  articleId: number; onClose: () => void; onChanged: () => void;
}) {
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reenriching, setReenriching] = useState(false);

  // Editable fields
  const [title, setTitle] = useState("");
  const [trSummary, setTrSummary] = useState("");
  const [cefr, setCefr] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState("");
  const [adminNotes, setAdminNotes] = useState("");

  async function load() {
    setLoading(true);
    try {
      const d = await apiFetch(`/admin/content-articles/${articleId}`);
      const a: Article = d.article;
      setArticle(a);
      setTitle(a.title);
      setTrSummary(a.tr_summary ?? "");
      setCefr(a.cefr_level ?? "");
      setCategory(a.category ?? "");
      setTags((a.tags ?? []).join(", "));
      setAdminNotes(a.admin_notes ?? "");
    } catch (e: any) { alert(e?.message); onClose(); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [articleId]);

  async function save() {
    setSaving(true);
    try {
      await apiFetch(`/admin/content-articles/${articleId}`, {
        method: "PATCH",
        body: JSON.stringify({
          title,
          tr_summary: trSummary,
          cefr_level: cefr,
          category,
          tags: tags.split(",").map(t => t.trim()).filter(Boolean),
          admin_notes: adminNotes,
        }),
      });
      onChanged();
    } catch (e: any) { alert(e?.message); }
    finally { setSaving(false); }
  }

  async function publish() {
    setSaving(true);
    try {
      await save();
      await apiFetch(`/admin/content-articles/${articleId}/publish`, { method: "POST" });
      onChanged();
    } catch (e: any) { alert(e?.message); }
    finally { setSaving(false); }
  }

  async function archive() {
    if (!confirm("Arşive alınsın mı?")) return;
    setSaving(true);
    try {
      await apiFetch(`/admin/content-articles/${articleId}/archive`, { method: "POST" });
      onChanged();
    } catch (e: any) { alert(e?.message); }
    finally { setSaving(false); }
  }

  async function reenrich() {
    if (!confirm("GPT ile TR özet + CEFR + kategori yeniden üretilsin mi?")) return;
    setReenriching(true);
    try {
      const r = await apiFetch(`/admin/content-articles/${articleId}/reenrich`, { method: "POST" });
      if (!r.ok) alert(`Hata: ${r.error}`);
      else load();
    } catch (e: any) { alert(e?.message); }
    finally { setReenriching(false); }
  }

  async function del() {
    if (!confirm("Bu makale kalıcı silinsin mi?")) return;
    setSaving(true);
    try {
      await apiFetch(`/admin/content-articles/${articleId}`, { method: "DELETE" });
      onChanged();
    } catch (e: any) { alert(e?.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <div className="h-full w-full max-w-3xl overflow-y-auto bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-5 py-3">
          <h3 className="text-lg font-semibold">Makale Detayı</h3>
          <button onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
        </div>

        {loading || !article ? (
          <div className="p-8 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-400" /></div>
        ) : (
          <div className="p-5 space-y-5">
            {/* Header */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-semibold border ${STATUS_CLR[article.status]}`}>
                {STATUS_LABEL[article.status]}
              </span>
              <span className="text-gray-400">·</span>
              <span className="text-gray-600">{article.source}</span>
              {article.published_at && <>
                <span className="text-gray-400">·</span>
                <span className="text-gray-600">{new Date(article.published_at).toLocaleDateString("tr-TR")}</span>
              </>}
              <a href={article.url} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-indigo-600 hover:underline">
                <ExternalLink className="h-3 w-3" /> Orijinal
              </a>
            </div>

            {article.image_url && (
              <img src={article.image_url} alt="" className="w-full aspect-video object-cover rounded-lg" />
            )}

            {/* Editable */}
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Başlık (İngilizce)</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded border-gray-300 px-3 py-2 text-sm" />
            </div>

            {article.subtitle && (
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Alt Başlık</label>
                <div className="rounded bg-gray-50 border px-3 py-2 text-sm text-gray-700">{article.subtitle}</div>
              </div>
            )}

            {article.snippet && (
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Snippet (EN)</label>
                <div className="rounded bg-gray-50 border px-3 py-2 text-sm text-gray-700">{article.snippet}</div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-gray-500">TR Özet & Enrichment</label>
              <button
                onClick={reenrich}
                disabled={reenriching}
                className="ml-auto text-xs rounded bg-violet-50 hover:bg-violet-100 text-violet-700 px-2 py-1 font-medium inline-flex items-center gap-1 disabled:opacity-50"
              >
                {reenriching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                GPT ile yeniden üret
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Türkçe Özet</label>
              <textarea value={trSummary} onChange={(e) => setTrSummary(e.target.value)} rows={4}
                className="w-full rounded border-gray-300 px-3 py-2 text-sm" placeholder="3 satır özet..." />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">CEFR Seviye</label>
                <select value={cefr} onChange={(e) => setCefr(e.target.value)}
                  className="w-full rounded border-gray-300 px-3 py-2 text-sm">
                  <option value="">— seç —</option>
                  {["A2","B1","B2","C1","C2"].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Kategori</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded border-gray-300 px-3 py-2 text-sm">
                  <option value="">— seç —</option>
                  <option value="finance">Finans</option>
                  <option value="tech">Teknoloji</option>
                  <option value="leadership">Liderlik</option>
                  <option value="negotiation">Müzakere</option>
                  <option value="general">Genel</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Etiketler (virgülle)</label>
              <input type="text" value={tags} onChange={(e) => setTags(e.target.value)}
                className="w-full rounded border-gray-300 px-3 py-2 text-sm font-mono" />
            </div>

            {/* Key vocab */}
            {article.key_vocab && article.key_vocab.length > 0 && (
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-2">
                  <Sparkles className="inline h-3 w-3 mr-1" /> Anahtar Kelimeler
                </label>
                <div className="space-y-2">
                  {article.key_vocab.map((v, i) => (
                    <div key={i} className="rounded border border-gray-200 bg-gray-50 p-3">
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="font-bold text-gray-900">{v.word}</span>
                        <span className="text-gray-500 text-sm">— {v.meaning_tr}</span>
                      </div>
                      <div className="text-xs italic text-gray-600">"{v.context}"</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Body preview */}
            {article.body_text && (
              <details className="rounded border">
                <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50">
                  Makale gövdesi (İngilizce) — {article.body_text.length} karakter
                </summary>
                <div className="px-3 py-3 text-sm text-gray-700 max-h-80 overflow-y-auto whitespace-pre-wrap">
                  {article.body_text}
                </div>
              </details>
            )}

            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Dahili Notlar</label>
              <input type="text" value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)}
                className="w-full rounded border-gray-300 px-3 py-2 text-sm" />
            </div>

            <div className="flex flex-wrap gap-2 border-t pt-4">
              <button onClick={del} disabled={saving}
                className="rounded bg-red-50 hover:bg-red-100 text-red-700 px-3 py-2 text-sm font-medium inline-flex items-center gap-1 disabled:opacity-50">
                <Trash2 className="h-4 w-4" /> Sil
              </button>
              {article.status !== "archived" && (
                <button onClick={archive} disabled={saving}
                  className="rounded bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 text-sm font-medium inline-flex items-center gap-1 disabled:opacity-50">
                  <Archive className="h-4 w-4" /> Arşivle
                </button>
              )}
              <div className="flex-1" />
              <button onClick={save} disabled={saving}
                className="rounded bg-white border border-indigo-600 text-indigo-600 hover:bg-indigo-50 px-4 py-2 text-sm font-medium disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin inline" /> : "Kaydet"}
              </button>
              {article.status !== "published" && (
                <button onClick={publish} disabled={saving}
                  className="rounded bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 text-sm font-medium inline-flex items-center gap-1 disabled:opacity-50">
                  <Check className="h-4 w-4" /> Kaydet + Yayınla
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Manuel Ekleme Modal ──────────────────────────────────────────────
function ManualAddModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [snippet, setSnippet] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!title.trim() || !url.trim()) { alert("Başlık + URL gerekli"); return; }
    setSaving(true);
    try {
      await apiFetch("/admin/content-articles", {
        method: "POST",
        body: JSON.stringify({ title, url, snippet, body_text: bodyText, image_url: imageUrl }),
      });
      onCreated();
    } catch (e: any) { alert(e?.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-xl rounded-lg bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h3 className="text-lg font-semibold">Manuel Makale Ekle</h3>
          <button onClick={onClose}><X className="h-5 w-5 text-gray-400" /></button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-xs text-gray-500">Ekledikten sonra detay ekranında "GPT ile üret" ile enrichment yapabilirsin.</p>
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">Başlık *</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">URL *</label>
            <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} className="w-full rounded border-gray-300 px-3 py-2 text-sm font-mono" placeholder="https://..." />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">Görsel URL</label>
            <input type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="w-full rounded border-gray-300 px-3 py-2 text-sm font-mono" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">Snippet (kısa özet)</label>
            <textarea value={snippet} onChange={(e) => setSnippet(e.target.value)} rows={2} className="w-full rounded border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">Makale Gövdesi (opsiyonel — enrichment için kullanılır)</label>
            <textarea value={bodyText} onChange={(e) => setBodyText(e.target.value)} rows={6} className="w-full rounded border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div className="flex gap-2 border-t pt-3">
            <button onClick={onClose} className="rounded border border-gray-300 px-3 py-1.5 text-sm">İptal</button>
            <button onClick={save} disabled={saving} className="ml-auto rounded bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 text-sm font-medium disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin inline" /> : "Ekle"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── LOGS TAB ─────────────────────────────────────────────────────────
function LogsTab() {
  const [data, setData] = useState<{ runs: any[]; stats: any[] }>({ runs: [], stats: [] });
  const [loading, setLoading] = useState(false);
  const [enriching, setEnriching] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const d = await apiFetch("/admin/content-ingest/status");
      setData(d);
    } catch (e: any) { alert(e?.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const statsMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of data.stats) m[s.status] = s.n;
    return m;
  }, [data.stats]);

  async function enrichPending() {
    setEnriching(true);
    try {
      const r = await apiFetch("/admin/content-ingest/enrich-pending?limit=20", { method: "POST" });
      alert(`İşlendi: ${r.processed} · Başarılı: ${r.ok} · Hata: ${r.failed}`);
      load();
    } catch (e: any) { alert(e?.message); }
    finally { setEnriching(false); }
  }

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {["draft", "published", "archived", "failed"].map(s => (
          <div key={s} className="bg-white rounded-lg border p-4">
            <div className="text-xs text-gray-500 uppercase font-semibold">{STATUS_LABEL[s]}</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{statsMap[s] ?? 0}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button onClick={load} className="rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 inline-flex items-center gap-1">
          <RefreshCw className="h-4 w-4" /> Yenile
        </button>
        <button onClick={enrichPending} disabled={enriching}
          className="rounded bg-violet-600 hover:bg-violet-500 text-white px-3 py-2 text-sm font-medium disabled:opacity-50 inline-flex items-center gap-1">
          {enriching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Bekleyenleri Enrich Et
        </button>
      </div>

      {/* Runs table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-600">
            <tr>
              <th className="px-4 py-2 text-left">Zaman</th>
              <th className="px-4 py-2 text-left">Kaynak</th>
              <th className="px-4 py-2 text-right">Fetch</th>
              <th className="px-4 py-2 text-right">Yeni</th>
              <th className="px-4 py-2 text-right">Enrich</th>
              <th className="px-4 py-2 text-right">Hata</th>
              <th className="px-4 py-2 text-right">Süre</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={7} className="text-center py-6 text-gray-400"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>
            ) : data.runs.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-6 text-gray-500 text-sm">Henüz ingestion çalışmadı.</td></tr>
            ) : data.runs.map(r => (
              <tr key={r.id}>
                <td className="px-4 py-2">{new Date(r.run_at).toLocaleString("tr-TR")}</td>
                <td className="px-4 py-2">{r.source}</td>
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
    </div>
  );
}
