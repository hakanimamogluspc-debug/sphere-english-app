import { useCallback, useEffect, useMemo, useState } from "react";
import { Sparkles, Loader2, Check, EyeOff, Pencil, Trash2, X, RefreshCw, Rocket, Undo2 } from "lucide-react";
import { API } from "@/lib/api-url";

/**
 * Admin → Kitap Pratikleri
 * Kitabın PDF'inden AI ile kalıp/terim çıkar, tek tek düzelt/onayla, kitabı pratiğe yayına al.
 * Öğrenci yalnızca ONAYLI öğeleri ve YAYINDAKİ kitapları görür.
 */

const TOKEN_KEY = "sphere_token";

async function apiFetch(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY)}`, ...(opts.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

type Status = "draft" | "approved" | "hidden";
interface BookRow {
  id: number; title: string; category: string | null; published: boolean; hasFile: boolean;
  drafts: number; approved: number; hidden: number; job: { status: string; done: number; total: number } | null;
}
interface Job { status: string; done: number; total: number; itemCount: number; error: string | null }
interface Item {
  id: number; unitOrder: number; unitTitle: string; position: number; kind: "pattern" | "term";
  en: string; tr: string; explanation: string | null; exampleEn: string | null; exampleTr: string | null;
  sourcePages: string | null; status: Status;
}

const STATUS_LABEL: Record<Status, string> = { draft: "Taslak", approved: "Onaylı", hidden: "Gizli" };
const STATUS_CLS: Record<Status, string> = {
  draft: "bg-amber-50 text-amber-800 border-amber-200",
  approved: "bg-emerald-50 text-emerald-800 border-emerald-200",
  hidden: "bg-slate-100 text-slate-500 border-slate-200",
};

export default function AdminEbookPractice() {
  const [books, setBooks] = useState<BookRow[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [job, setJob] = useState<Job | null>(null);
  const [published, setPublished] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("all");
  const [kindFilter, setKindFilter] = useState<"all" | "pattern" | "term">("all");
  const [editing, setEditing] = useState<number | null>(null);

  const loadBooks = useCallback(async () => {
    try { setBooks((await apiFetch("/admin/ebook-practice")).books); } catch (e: any) { setErr(e.message); }
  }, []);

  const loadBook = useCallback(async (id: number, quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const d = await apiFetch(`/admin/ebook-practice/${id}`);
      setItems(d.items); setJob(d.job); setPublished(d.book.published);
    } catch (e: any) { setErr(e.message); } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadBooks(); }, [loadBooks]);
  useEffect(() => {
    if (selected) loadBook(selected);
    else {
      // Varsayılan: pilot kitap (Kurumsal İletişim & Toplantılar) varsa onu seç
      const pilot = books.find((b) => /Kurumsal İletişim/i.test(b.title)) ?? books[0];
      if (pilot) setSelected(pilot.id);
    }
  }, [selected, books, loadBook]);

  // Çıkarım sürerken 4 sn'de bir yokla
  useEffect(() => {
    if (!selected || job?.status !== "running") return;
    const t = setInterval(() => { loadBook(selected, true); }, 4000);
    return () => clearInterval(t);
  }, [selected, job?.status, loadBook]);
  useEffect(() => { if (job && job.status !== "running") loadBooks(); }, [job?.status, loadBooks]); // eslint-disable-line react-hooks/exhaustive-deps

  async function extract(append = false) {
    if (!selected) return;
    const hasApproved = items.some((i) => i.status === "approved");
    const msg = append
      ? "Kitap yeniden taranacak ve yalnızca listede OLMAYAN kalıp/terimler taslak olarak eklenecek. Mevcut öğelerin hiçbiri silinmez. Devam edilsin mi?"
      : "Kitabın PDF'i yapay zekâyla taranacak (birkaç dakika sürer). Mevcut TASLAK öğeler silinip yeniden oluşturulur"
        + (hasApproved ? "; onayladıkların ve gizlediklerin korunur." : ".") + " Devam edilsin mi?";
    if (!confirm(msg)) return;
    try {
      const d = await apiFetch(`/admin/ebook-practice/${selected}/extract`, { method: "POST", body: JSON.stringify({ append }) });
      setJob(d.job);
    } catch (e: any) { alert(e.message); }
  }

  async function patch(id: number, body: Partial<Item>) {
    try {
      const d = await apiFetch(`/admin/ebook-practice/items/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      setItems((xs) => xs.map((x) => (x.id === id ? d.item : x)));
      return true;
    } catch (e: any) { alert(e.message); return false; }
  }

  async function remove(id: number) {
    if (!confirm("Bu öğe silinsin mi?")) return;
    try { await apiFetch(`/admin/ebook-practice/items/${id}`, { method: "DELETE" }); setItems((xs) => xs.filter((x) => x.id !== id)); }
    catch (e: any) { alert(e.message); }
  }

  async function approveUnit(unitOrder: number) {
    if (!selected) return;
    try {
      await apiFetch(`/admin/ebook-practice/${selected}/bulk-status`, { method: "POST", body: JSON.stringify({ status: "approved", unitOrder }) });
      await loadBook(selected, true);
    } catch (e: any) { alert(e.message); }
  }

  async function togglePublish() {
    if (!selected) return;
    try {
      await apiFetch(`/admin/ebook-practice/${selected}/publish`, { method: "POST", body: JSON.stringify({ published: !published }) });
      setPublished(!published); loadBooks();
    } catch (e: any) { alert(e.message); }
  }

  const counts = useMemo(() => ({
    draft: items.filter((i) => i.status === "draft").length,
    approved: items.filter((i) => i.status === "approved").length,
    hidden: items.filter((i) => i.status === "hidden").length,
  }), [items]);

  const units = useMemo(() => {
    const filtered = items.filter((i) => (statusFilter === "all" || i.status === statusFilter) && (kindFilter === "all" || i.kind === kindFilter));
    const map = new Map<number, { title: string; items: Item[] }>();
    for (const it of filtered) {
      if (!map.has(it.unitOrder)) map.set(it.unitOrder, { title: it.unitTitle || "(Ünite belirtilmemiş)", items: [] });
      map.get(it.unitOrder)!.items.push(it);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [items, statusFilter, kindFilter]);

  const book = books.find((b) => b.id === selected);
  const running = job?.status === "running";

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1e3a6e] flex items-center gap-2"><Sparkles className="text-[#13a9e0]" /> Kitap Pratikleri</h1>
          <p className="text-sm text-slate-500 mt-1">Kitabın kalıp ve terimlerini yapay zekâyla çıkar, kontrol edip onayla. Öğrenciler yalnızca onaylı öğeleri, yayındaki kitaplarda görür.</p>
        </div>
        <select value={selected ?? ""} onChange={(e) => { setSelected(Number(e.target.value)); setEditing(null); }}
          className="px-3 py-2 rounded-lg border border-slate-200 text-sm min-w-[280px]">
          {books.map((b) => (
            <option key={b.id} value={b.id}>{b.title}{b.published ? " ● yayında" : ""} ({b.approved}/{b.drafts + b.approved + b.hidden})</option>
          ))}
        </select>
      </div>

      {err && <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">{err}</div>}

      {book && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 mb-5 flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-[240px]">
            <div className="font-bold text-[#1e3a6e]">{book.title}</div>
            <div className="text-xs text-slate-500 mt-1 flex gap-3 flex-wrap">
              <span>Taslak: <b>{counts.draft}</b></span>
              <span>Onaylı: <b className="text-emerald-700">{counts.approved}</b></span>
              <span>Gizli: <b>{counts.hidden}</b></span>
              <span>{published ? <b className="text-emerald-700">● Öğrencilere açık</b> : "Öğrencilere kapalı"}</span>
            </div>
            {running && job && (
              <div className="mt-2">
                <div className="text-xs text-[#0e7da6] flex items-center gap-1.5"><Loader2 size={13} className="animate-spin" />
                  Çıkarılıyor… {job.total ? `${job.done}/${job.total} parça` : "PDF hazırlanıyor"} · {job.itemCount} öğe</div>
                <div className="h-1.5 bg-slate-100 rounded mt-1 overflow-hidden"><div className="h-full bg-[#13a9e0] transition-all" style={{ width: `${job.total ? (job.done / job.total) * 100 : 3}%` }} /></div>
              </div>
            )}
            {job?.status === "failed" && <div className="mt-2 text-xs text-red-700">Son çıkarım başarısız: {job.error}</div>}
          </div>
          {items.length > 0 && (
            <button onClick={() => extract(true)} disabled={running || !book.hasFile} title="Mevcut öğeleri silmeden, atlananları bulup ekler"
              className="px-4 py-2 rounded-lg border border-[#13a9e0] text-[#0e7da6] text-sm font-bold inline-flex items-center gap-2 disabled:opacity-50">
              <Sparkles size={15} /> Eksikleri tara
            </button>
          )}
          <button onClick={() => extract(false)} disabled={running || !book.hasFile}
            className="px-4 py-2 rounded-lg border border-[#1e3a6e] text-[#1e3a6e] text-sm font-bold inline-flex items-center gap-2 disabled:opacity-50">
            {items.length ? <RefreshCw size={15} /> : <Sparkles size={15} />} {items.length ? "Yeniden çıkar" : "İçeriği çıkar"}
          </button>
          <button onClick={togglePublish} disabled={running}
            className={`px-4 py-2 rounded-lg text-sm font-bold inline-flex items-center gap-2 disabled:opacity-50 ${published ? "bg-slate-100 text-slate-700" : "bg-[#1e3a6e] text-white"}`}>
            {published ? <><Undo2 size={15} /> Yayından kaldır</> : <><Rocket size={15} /> Öğrencilere aç</>}
          </button>
          {!book.hasFile && <div className="w-full text-xs text-amber-700">Bu kitabın tam PDF'i yüklenmemiş; önce Kitaplar ekranından yükle.</div>}
        </div>
      )}

      {items.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-4 text-sm">
          {(["all", "draft", "approved", "hidden"] as const).map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-full border ${statusFilter === s ? "bg-[#1e3a6e] text-white border-[#1e3a6e]" : "bg-white text-slate-600 border-slate-200"}`}>
              {s === "all" ? `Tümü (${items.length})` : `${STATUS_LABEL[s]} (${counts[s]})`}
            </button>
          ))}
          <span className="mx-1 border-l border-slate-200" />
          {(["all", "pattern", "term"] as const).map((k) => (
            <button key={k} onClick={() => setKindFilter(k)}
              className={`px-3 py-1.5 rounded-full border ${kindFilter === k ? "bg-[#13a9e0] text-white border-[#13a9e0]" : "bg-white text-slate-600 border-slate-200"}`}>
              {k === "all" ? "Hepsi" : k === "pattern" ? "Kalıplar" : "Terimler"}
            </button>
          ))}
        </div>
      )}

      {loading && <div className="py-16 text-center"><Loader2 className="w-7 h-7 animate-spin text-[#13a9e0] mx-auto" /></div>}

      {!loading && items.length === 0 && !running && book && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          Bu kitap için henüz içerik yok. <b>İçeriği çıkar</b> ile başlat; kitap boyutuna göre birkaç dakika sürer.
        </div>
      )}

      <div className="space-y-6">
        {units.map(([order, u]) => {
          const draftsInUnit = u.items.filter((i) => i.status === "draft").length;
          return (
            <section key={order}>
              <div className="flex items-center justify-between gap-3 mb-2">
                <h2 className="font-bold text-[#1e3a6e]">{u.title} <span className="text-xs font-normal text-slate-400">· {u.items.length} öğe</span></h2>
                {draftsInUnit > 0 && (
                  <button onClick={() => approveUnit(order)} className="text-xs font-bold text-emerald-700 hover:underline inline-flex items-center gap-1">
                    <Check size={14} /> Ünitedeki {draftsInUnit} taslağı onayla
                  </button>
                )}
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100">
                {u.items.map((it) => editing === it.id
                  ? <EditRow key={it.id} item={it} onCancel={() => setEditing(null)} onSave={async (b) => { if (await patch(it.id, b)) setEditing(null); }} />
                  : (
                    <div key={it.id} className={`p-3 flex gap-3 ${it.status === "hidden" ? "opacity-60" : ""}`}>
                      <div className="flex flex-col gap-1 items-start w-20 shrink-0">
                        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${it.kind === "pattern" ? "bg-[#e8eef8] text-[#1e3a6e]" : "bg-sky-50 text-[#0e7da6]"}`}>{it.kind === "pattern" ? "Kalıp" : "Terim"}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${STATUS_CLS[it.status]}`}>{STATUS_LABEL[it.status]}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-900">{it.en}</div>
                        <div className="text-sm text-slate-600">{it.tr}</div>
                        {it.explanation && <div className="text-xs text-slate-500 mt-1">{it.explanation}</div>}
                        {it.exampleEn && <div className="text-xs text-[#0e7da6] mt-1 italic">“{it.exampleEn}”{it.exampleTr && <span className="not-italic text-slate-400"> — {it.exampleTr}</span>}</div>}
                        {it.sourcePages && <div className="text-[10px] text-slate-400 mt-1">s. {it.sourcePages}</div>}
                      </div>
                      <div className="flex items-start gap-1 shrink-0">
                        {it.status !== "approved" && <IconBtn title="Onayla" onClick={() => patch(it.id, { status: "approved" })} cls="text-emerald-700"><Check size={16} /></IconBtn>}
                        {it.status !== "hidden"
                          ? <IconBtn title="Gizle (öğrenci görmez)" onClick={() => patch(it.id, { status: "hidden" })}><EyeOff size={16} /></IconBtn>
                          : <IconBtn title="Taslağa geri al" onClick={() => patch(it.id, { status: "draft" })}><Undo2 size={16} /></IconBtn>}
                        <IconBtn title="Düzenle" onClick={() => setEditing(it.id)}><Pencil size={16} /></IconBtn>
                        <IconBtn title="Sil" onClick={() => remove(it.id)} cls="text-red-600"><Trash2 size={16} /></IconBtn>
                      </div>
                    </div>
                  ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function IconBtn({ children, onClick, title, cls = "text-slate-500" }: { children: React.ReactNode; onClick: () => void; title: string; cls?: string }) {
  return <button onClick={onClick} title={title} aria-label={title} className={`p-1.5 rounded hover:bg-slate-100 ${cls}`}>{children}</button>;
}

function EditRow({ item, onSave, onCancel }: { item: Item; onSave: (b: Partial<Item>) => void; onCancel: () => void }) {
  const [f, setF] = useState({ ...item });
  const inp = "w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-sm outline-none focus:border-[#13a9e0]";
  const set = (k: keyof Item) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value } as Item);
  return (
    <div className="p-3 bg-[#f7f9fd] space-y-2">
      <div className="grid gap-2 sm:grid-cols-[110px_1fr]">
        <select value={f.kind} onChange={set("kind")} className={inp}><option value="pattern">Kalıp</option><option value="term">Terim</option></select>
        <input value={f.en} onChange={set("en")} placeholder="İngilizce" className={inp} />
      </div>
      <input value={f.tr} onChange={set("tr")} placeholder="Türkçe anlamı" className={inp} />
      <textarea value={f.explanation ?? ""} onChange={set("explanation")} placeholder="Açıklama (isteğe bağlı)" rows={2} className={inp} />
      <div className="grid gap-2 sm:grid-cols-2">
        <input value={f.exampleEn ?? ""} onChange={set("exampleEn")} placeholder="Örnek cümle (EN)" className={inp} />
        <input value={f.exampleTr ?? ""} onChange={set("exampleTr")} placeholder="Örnek cümle (TR)" className={inp} />
      </div>
      <input value={f.unitTitle} onChange={set("unitTitle")} placeholder="Ünite" className={inp} />
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-3 py-1.5 rounded-lg text-sm text-slate-600 inline-flex items-center gap-1"><X size={14} /> Vazgeç</button>
        <button onClick={() => onSave({ kind: f.kind, en: f.en, tr: f.tr, explanation: f.explanation, exampleEn: f.exampleEn, exampleTr: f.exampleTr, unitTitle: f.unitTitle, status: "approved" })}
          className="px-3 py-1.5 rounded-lg text-sm bg-[#1e3a6e] text-white font-bold inline-flex items-center gap-1"><Check size={14} /> Kaydet ve onayla</button>
      </div>
    </div>
  );
}
