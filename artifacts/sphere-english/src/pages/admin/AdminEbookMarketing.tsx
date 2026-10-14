import { useCallback, useEffect, useState } from "react";
import {
  Megaphone, RefreshCw, Loader2, AlertCircle, X, Plus, Trash2,
  ArrowUp, ArrowDown, Eye, EyeOff, Download, Mail, HelpCircle, Compass, Pencil, Check,
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

type Tab = "waitlist" | "faq" | "guide";

interface WaitlistEntry {
  id: number; email: string; interestArea: string | null; interestLabel: string;
  source: string; notifiedAt: string | null; createdAt: string;
}
interface Faq { id: number; question: string; answer: string; displayOrder: number; isActive: boolean }
interface Guide {
  id: number; roleLabel: string; description: string; ctaText: string | null;
  ctaHref: string | null; icon: string | null; displayOrder: number; isActive: boolean;
}

const fmtDate = (s: string) =>
  new Date(s).toLocaleString("tr-TR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default function AdminEbookMarketing() {
  const [tab, setTab] = useState<Tab>("waitlist");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-blue-800 flex items-center gap-2">
          <Megaphone size={26} /> E-Kitap Sayfası
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          www.sphereenglish.com/e-kitaplar — bekleme listesi, SSS ve "Nereden başlamalıyım" rehberi
        </p>
      </header>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700 flex justify-between items-center">
          <span className="flex items-center gap-2"><AlertCircle size={16} /> {error}</span>
          <button onClick={() => setError(null)}><X size={14} /></button>
        </div>
      )}

      <div className="flex gap-1 mb-5 border-b border-slate-200">
        {([
          ["waitlist", "Haberdar ol listesi", Mail],
          ["faq", "Sıkça sorulan sorular", HelpCircle],
          ["guide", "Nereden başlamalıyım", Compass],
        ] as const).map(([k, label, Icon]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm border-b-2 -mb-px transition-colors ${
              tab === k ? "border-blue-700 text-blue-800 font-semibold" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {tab === "waitlist" && <WaitlistTab onError={setError} />}
      {tab === "faq" && <FaqTab onError={setError} />}
      {tab === "guide" && <GuideTab onError={setError} />}
    </div>
  );
}

// ─── WAITLIST ────────────────────────────────────────────────────────────

function WaitlistTab({ onError }: { onError: (m: string | null) => void }) {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [stats, setStats] = useState<{ total: number; last7Days: number; byArea: { key: string | null; label: string; count: number }[]; areas: { key: string; label: string }[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [area, setArea] = useState("");
  const [q, setQ] = useState("");
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const LIMIT = 50;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ limit: String(LIMIT), offset: String(offset) });
      if (area) qs.set("area", area);
      if (q.trim()) qs.set("q", q.trim());
      const [list, st] = await Promise.all([
        apiFetch(`/admin/ebook-waitlist?${qs}`),
        apiFetch(`/admin/ebook-waitlist/stats`),
      ]);
      setEntries(list.entries ?? []);
      setTotal(list.total ?? 0);
      setStats(st);
    } catch (e: any) { onError(e.message); }
    finally { setLoading(false); }
  }, [area, q, offset, onError]);

  useEffect(() => { const t = setTimeout(load, q ? 300 : 0); return () => clearTimeout(t); }, [load, q]);

  async function remove(id: number) {
    if (!confirm("Bu kaydı silmek istiyor musun?")) return;
    try { await apiFetch(`/admin/ebook-waitlist/${id}`, { method: "DELETE" }); await load(); }
    catch (e: any) { onError(e.message); }
  }

  function exportCsv() {
    const token = localStorage.getItem(TOKEN_KEY);
    fetch(`${API}/admin/ebook-waitlist/export.csv`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((b) => {
        const url = URL.createObjectURL(b);
        const a = document.createElement("a");
        a.href = url; a.download = `ebook-waitlist-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
        URL.revokeObjectURL(url);
      })
      .catch((e) => onError(e.message));
  }

  return (
    <div>
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <Stat label="Toplam kayıt" value={stats.total} />
          <Stat label="Son 7 gün" value={stats.last7Days} />
          {stats.byArea.slice(0, 2).map((a) => <Stat key={a.key ?? "none"} label={a.label} value={a.count} />)}
        </div>
      )}

      <div className="flex gap-2 mb-4 items-center flex-wrap">
        <select value={area} onChange={(e) => { setArea(e.target.value); setOffset(0); }}
          className="px-3 py-1.5 text-sm border border-slate-200 rounded-md bg-white">
          <option value="">Tüm alanlar</option>
          <option value="__none__">Genel (alan seçmemiş)</option>
          {stats?.areas.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
        </select>
        <input value={q} onChange={(e) => { setQ(e.target.value); setOffset(0); }} placeholder="E-posta ara…"
          className="flex-1 max-w-sm px-3 py-1.5 text-sm border border-slate-200 rounded-md" />
        <button onClick={load} className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-white border border-slate-200 hover:bg-slate-50 text-sm">
          <RefreshCw size={14} /> Yenile
        </button>
        <button onClick={exportCsv} className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-blue-700 text-white text-sm hover:bg-blue-800">
          <Download size={14} /> CSV indir
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">E-posta</th>
              <th className="px-3 py-2 font-medium">İlgi alanı</th>
              <th className="px-3 py-2 font-medium">Kaynak</th>
              <th className="px-3 py-2 font-medium">Tarih</th>
              <th className="px-3 py-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {loading && entries.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-400"><Loader2 className="animate-spin inline" size={18} /></td></tr>
            ) : entries.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-400">Henüz kayıt yok</td></tr>
            ) : entries.map((e) => (
              <tr key={e.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2 font-medium text-slate-800">{e.email}</td>
                <td className="px-3 py-2"><span className="px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 text-xs">{e.interestLabel}</span></td>
                <td className="px-3 py-2 text-slate-500 text-xs">{e.source}</td>
                <td className="px-3 py-2 text-slate-500 text-xs whitespace-nowrap">{fmtDate(e.createdAt)}</td>
                <td className="px-3 py-2">
                  <button onClick={() => remove(e.id)} className="text-slate-400 hover:text-red-600" title="Sil"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {total > LIMIT && (
        <div className="flex justify-between items-center mt-3 text-sm text-slate-500">
          <span>{offset + 1}–{Math.min(offset + LIMIT, total)} / {total}</span>
          <div className="flex gap-2">
            <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - LIMIT))}
              className="px-3 py-1 border border-slate-200 rounded-md bg-white disabled:opacity-40">Önceki</button>
            <button disabled={offset + LIMIT >= total} onClick={() => setOffset(offset + LIMIT)}
              className="px-3 py-1 border border-slate-200 rounded-md bg-white disabled:opacity-40">Sonraki</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-4 py-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-2xl font-bold text-blue-800 tabular-nums">{value}</div>
    </div>
  );
}

// ─── FAQ ─────────────────────────────────────────────────────────────────

function FaqTab({ onError }: { onError: (m: string | null) => void }) {
  const [items, setItems] = useState<Faq[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Partial<Faq> | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { const d = await apiFetch("/admin/ebook-faq"); setItems(d.faq ?? []); }
    catch (e: any) { onError(e.message); }
    finally { setLoading(false); }
  }, [onError]);
  useEffect(() => { load(); }, [load]);

  async function save() {
    if (!editing?.question?.trim() || !editing?.answer?.trim()) { onError("Soru ve cevap zorunlu"); return; }
    setSaving(true);
    try {
      if (editing.id) await apiFetch(`/admin/ebook-faq/${editing.id}`, { method: "PATCH", body: JSON.stringify(editing) });
      else await apiFetch("/admin/ebook-faq", { method: "POST", body: JSON.stringify(editing) });
      setEditing(null); await load();
    } catch (e: any) { onError(e.message); }
    finally { setSaving(false); }
  }

  async function toggle(f: Faq) {
    try { await apiFetch(`/admin/ebook-faq/${f.id}`, { method: "PATCH", body: JSON.stringify({ isActive: !f.isActive }) }); await load(); }
    catch (e: any) { onError(e.message); }
  }
  async function remove(id: number) {
    if (!confirm("Bu soruyu silmek istiyor musun?")) return;
    try { await apiFetch(`/admin/ebook-faq/${id}`, { method: "DELETE" }); await load(); }
    catch (e: any) { onError(e.message); }
  }
  async function move(idx: number, dir: -1 | 1) {
    const next = [...items];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    setItems(next);
    try { await apiFetch("/admin/ebook-faq/reorder", { method: "PUT", body: JSON.stringify({ ids: next.map((x) => x.id) }) }); }
    catch (e: any) { onError(e.message); await load(); }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-slate-500">Sıra, sayfadaki görünüm sırasıdır. Pasif sorular sayfada görünmez.</p>
        <button onClick={() => setEditing({ question: "", answer: "", isActive: true })}
          className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-blue-700 text-white text-sm hover:bg-blue-800">
          <Plus size={14} /> Yeni soru
        </button>
      </div>

      {editing && (
        <div className="bg-white border-2 border-blue-200 rounded-lg p-4 mb-4">
          <input value={editing.question ?? ""} onChange={(e) => setEditing({ ...editing, question: e.target.value })}
            placeholder="Soru" maxLength={300}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md mb-2 font-medium" />
          <textarea value={editing.answer ?? ""} onChange={(e) => setEditing({ ...editing, answer: e.target.value })}
            placeholder="Cevap" rows={4}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md mb-3" />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setEditing(null)} className="px-3 py-1.5 text-sm border border-slate-200 rounded-md bg-white">İptal</button>
            <button onClick={save} disabled={saving} className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-md bg-blue-700 text-white disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Kaydet
            </button>
          </div>
        </div>
      )}

      {loading && items.length === 0 ? (
        <div className="py-8 text-center text-slate-400"><Loader2 className="animate-spin inline" size={18} /></div>
      ) : (
        <div className="space-y-2">
          {items.map((f, i) => (
            <div key={f.id} className={`bg-white border rounded-lg p-3 flex gap-3 ${f.isActive ? "border-slate-200" : "border-dashed border-slate-300 opacity-60"}`}>
              <div className="flex flex-col gap-1 text-slate-400">
                <button onClick={() => move(i, -1)} disabled={i === 0} className="hover:text-blue-700 disabled:opacity-30"><ArrowUp size={14} /></button>
                <button onClick={() => move(i, 1)} disabled={i === items.length - 1} className="hover:text-blue-700 disabled:opacity-30"><ArrowDown size={14} /></button>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-slate-800">{f.question}</div>
                <div className="text-sm text-slate-500 mt-1 whitespace-pre-line">{f.answer}</div>
              </div>
              <div className="flex gap-1 items-start text-slate-400">
                <button onClick={() => setEditing(f)} className="p-1 hover:text-blue-700" title="Düzenle"><Pencil size={14} /></button>
                <button onClick={() => toggle(f)} className="p-1 hover:text-blue-700" title={f.isActive ? "Pasife al" : "Aktif et"}>{f.isActive ? <Eye size={14} /> : <EyeOff size={14} />}</button>
                <button onClick={() => remove(f.id)} className="p-1 hover:text-red-600" title="Sil"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
          {items.length === 0 && <div className="py-8 text-center text-slate-400 text-sm">Henüz soru yok</div>}
        </div>
      )}
    </div>
  );
}

// ─── GUIDE ───────────────────────────────────────────────────────────────

function GuideTab({ onError }: { onError: (m: string | null) => void }) {
  const [items, setItems] = useState<Guide[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Partial<Guide> | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { const d = await apiFetch("/admin/ebook-guide"); setItems(d.guide ?? []); }
    catch (e: any) { onError(e.message); }
    finally { setLoading(false); }
  }, [onError]);
  useEffect(() => { load(); }, [load]);

  async function save() {
    if (!editing?.roleLabel?.trim() || !editing?.description?.trim()) { onError("Rol ve açıklama zorunlu"); return; }
    setSaving(true);
    try {
      if (editing.id) await apiFetch(`/admin/ebook-guide/${editing.id}`, { method: "PATCH", body: JSON.stringify(editing) });
      else await apiFetch("/admin/ebook-guide", { method: "POST", body: JSON.stringify(editing) });
      setEditing(null); await load();
    } catch (e: any) { onError(e.message); }
    finally { setSaving(false); }
  }
  async function toggle(g: Guide) {
    try { await apiFetch(`/admin/ebook-guide/${g.id}`, { method: "PATCH", body: JSON.stringify({ isActive: !g.isActive }) }); await load(); }
    catch (e: any) { onError(e.message); }
  }
  async function remove(id: number) {
    if (!confirm("Bu kartı silmek istiyor musun?")) return;
    try { await apiFetch(`/admin/ebook-guide/${id}`, { method: "DELETE" }); await load(); }
    catch (e: any) { onError(e.message); }
  }
  async function move(idx: number, dir: -1 | 1) {
    const next = [...items];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    setItems(next);
    try { await apiFetch("/admin/ebook-guide/reorder", { method: "PUT", body: JSON.stringify({ ids: next.map((x) => x.id) }) }); }
    catch (e: any) { onError(e.message); await load(); }
  }

  const field = (k: keyof Guide, placeholder: string, max: number) => (
    <input value={(editing?.[k] as string) ?? ""} onChange={(e) => setEditing({ ...editing, [k]: e.target.value })}
      placeholder={placeholder} maxLength={max}
      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md" />
  );

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-slate-500">"Nereden başlamalıyım?" bölümündeki rol kartları. Buton linki site içi (ör. <code>/e-kitaplar#katalog</code>) olabilir.</p>
        <button onClick={() => setEditing({ roleLabel: "", description: "", ctaText: "", ctaHref: "", icon: "", isActive: true })}
          className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-blue-700 text-white text-sm hover:bg-blue-800 whitespace-nowrap">
          <Plus size={14} /> Yeni kart
        </button>
      </div>

      {editing && (
        <div className="bg-white border-2 border-blue-200 rounded-lg p-4 mb-4 grid gap-2">
          <div className="grid grid-cols-[72px_1fr] gap-2">
            {field("icon", "İkon 🏢", 16)}
            {field("roleLabel", "Rol / durum (ör. Ekip yönetiyorum)", 120)}
          </div>
          <textarea value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })}
            placeholder="Açıklama" rows={3} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md" />
          <div className="grid grid-cols-2 gap-2">
            {field("ctaText", "Buton metni (opsiyonel)", 80)}
            {field("ctaHref", "Buton linki (ör. /e-kitaplar#katalog)", 300)}
          </div>
          <div className="flex gap-2 justify-end mt-1">
            <button onClick={() => setEditing(null)} className="px-3 py-1.5 text-sm border border-slate-200 rounded-md bg-white">İptal</button>
            <button onClick={save} disabled={saving} className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-md bg-blue-700 text-white disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Kaydet
            </button>
          </div>
        </div>
      )}

      {loading && items.length === 0 ? (
        <div className="py-8 text-center text-slate-400"><Loader2 className="animate-spin inline" size={18} /></div>
      ) : (
        <div className="space-y-2">
          {items.map((g, i) => (
            <div key={g.id} className={`bg-white border rounded-lg p-3 flex gap-3 ${g.isActive ? "border-slate-200" : "border-dashed border-slate-300 opacity-60"}`}>
              <div className="flex flex-col gap-1 text-slate-400">
                <button onClick={() => move(i, -1)} disabled={i === 0} className="hover:text-blue-700 disabled:opacity-30"><ArrowUp size={14} /></button>
                <button onClick={() => move(i, 1)} disabled={i === items.length - 1} className="hover:text-blue-700 disabled:opacity-30"><ArrowDown size={14} /></button>
              </div>
              <div className="text-2xl w-8 text-center">{g.icon || "•"}</div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-slate-800">{g.roleLabel}</div>
                <div className="text-sm text-slate-500 mt-0.5">{g.description}</div>
                {g.ctaText && <div className="text-xs text-sky-700 mt-1">→ {g.ctaText} <span className="text-slate-400">{g.ctaHref}</span></div>}
              </div>
              <div className="flex gap-1 items-start text-slate-400">
                <button onClick={() => setEditing(g)} className="p-1 hover:text-blue-700" title="Düzenle"><Pencil size={14} /></button>
                <button onClick={() => toggle(g)} className="p-1 hover:text-blue-700" title={g.isActive ? "Pasife al" : "Aktif et"}>{g.isActive ? <Eye size={14} /> : <EyeOff size={14} />}</button>
                <button onClick={() => remove(g.id)} className="p-1 hover:text-red-600" title="Sil"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
          {items.length === 0 && <div className="py-8 text-center text-slate-400 text-sm">Henüz kart yok</div>}
        </div>
      )}
    </div>
  );
}
