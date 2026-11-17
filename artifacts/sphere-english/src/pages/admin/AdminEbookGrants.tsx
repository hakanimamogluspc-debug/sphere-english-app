import { useEffect, useMemo, useState } from "react";
import { BookOpen, Loader2, Search, Trash2, X, Check } from "lucide-react";
import { API } from "@/lib/api-url";

/**
 * Admin → E-Kitap Tanımlama.
 * Seçilen öğrencilere satın alma olmadan e-kitap verir; kitap öğrencinin Kitaplarım bölümünde görünür.
 * Satış kaydı açılmaz (satış istatistikleri, faturalar ve indirme sayıları etkilenmez).
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

interface User { id: number; name: string; email: string; studentNumber: string | null; company: string | null; bookCount: number }
interface Ebook { id: number; title: string; subtitle: string | null; category: string | null }
interface Bundle { id: number; title: string; ebookIds: number[] }
interface Grant { id: number; userId: number; userName: string; email: string; title: string; note: string | null; createdAt: string; grantedBy: string | null }

export default function AdminEbookGrants() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<User[]>([]);
  const [ebooks, setEbooks] = useState<Ebook[]>([]);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [bookIds, setBookIds] = useState<number[]>([]);
  const [note, setNote] = useState("");
  const [notify, setNotify] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [grants, setGrants] = useState<Grant[] | null>(null);
  const [gq, setGq] = useState("");

  const loadGrants = (query = gq) =>
    apiFetch(`/admin/ebook-grants?q=${encodeURIComponent(query)}`).then((d) => setGrants(d.grants)).catch((e) => setMsg({ ok: false, text: e.message }));

  useEffect(() => {
    apiFetch("/admin/ebook-grants/options").then((d) => { setEbooks(d.ebooks); setBundles(d.bundles); }).catch((e) => setMsg({ ok: false, text: e.message }));
    loadGrants("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Öğrenci araması (yazmayı bıraktıktan 300 ms sonra)
  useEffect(() => {
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(() => {
      apiFetch(`/admin/ebook-grants/users?q=${encodeURIComponent(q.trim())}`)
        .then((d) => { if (!cancelled) setResults(d.users); })
        .catch(() => { if (!cancelled) setResults([]); })
        .finally(() => { if (!cancelled) setSearching(false); });
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q]);

  const selectedIds = useMemo(() => new Set(selected.map((u) => u.id)), [selected]);
  const toggleUser = (u: User) => setSelected((s) => (s.some((x) => x.id === u.id) ? s.filter((x) => x.id !== u.id) : [...s, u]));
  const toggleBook = (id: number) => setBookIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const addBundle = (b: Bundle) => setBookIds((s) => [...new Set([...s, ...b.ebookIds])]);

  async function grant() {
    setSaving(true); setMsg(null);
    try {
      const d = await apiFetch("/admin/ebook-grants", {
        method: "POST",
        body: JSON.stringify({ userIds: selected.map((u) => u.id), ebookIds: bookIds, note, notify }),
      });
      const parts = [`${d.granted} kitap tanımlandı`];
      if (d.skipped > 0) parts.push(`${d.skipped} tanesi atlandı (öğrencide zaten vardı)`);
      if (notify) parts.push(`${d.mailed} öğrenciye bilgilendirme maili gitti`);
      setMsg({ ok: true, text: parts.join(" · ") });
      setSelected([]); setBookIds([]); setNote("");
      loadGrants();
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setSaving(false);
    }
  }

  async function revoke(g: Grant) {
    if (!confirm(`"${g.title}" kitabı ${g.userName} adlı öğrencinin kitaplığından kaldırılsın mı?`)) return;
    try { await apiFetch(`/admin/ebook-grants/${g.id}`, { method: "DELETE" }); loadGrants(); } catch (e: any) { setMsg({ ok: false, text: e.message }); }
  }

  const inp = "w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-[#13a9e0]";
  const canGrant = selected.length > 0 && bookIds.length > 0 && !saving;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-extrabold text-[#1e3a6e] flex items-center gap-2"><BookOpen className="text-[#13a9e0]" /> E-Kitap Tanımlama</h1>
      <p className="text-sm text-slate-500 mt-1 max-w-3xl">
        Seçtiğin öğrencilere satın alma olmadan e-kitap ver. Kitap öğrencinin uygulamadaki Kitaplarım bölümünde görünür; oradan okur ve
        pratik yapar. Satış kaydı açılmaz, fatura kesilmez; PDF indirme bağlantısı gönderilmez.
      </p>

      {msg && (
        <div className={`mt-4 p-3 rounded-lg border text-sm ${msg.ok ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-800"}`}>{msg.text}</div>
      )}

      <div className="grid lg:grid-cols-2 gap-5 mt-5">
        {/* 1) Öğrenciler */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="font-bold text-[#1e3a6e] mb-3">1. Öğrencileri seç</h2>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
            <input className={`${inp} pl-9`} placeholder="Ad, e-posta ya da öğrenci no ile ara" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {selected.map((u) => (
                <span key={u.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[#e8eef8] text-[#1e3a6e] text-xs font-semibold">
                  {u.name || u.email}
                  <button onClick={() => toggleUser(u)} aria-label={`${u.name} seçimini kaldır`}><X size={12} /></button>
                </span>
              ))}
            </div>
          )}
          <div className="mt-3 max-h-80 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-xl">
            {searching && <div className="p-4 text-center"><Loader2 className="w-5 h-5 animate-spin text-[#13a9e0] mx-auto" /></div>}
            {!searching && results.length === 0 && <div className="p-4 text-sm text-slate-500">Öğrenci bulunamadı.</div>}
            {!searching && results.map((u) => (
              <label key={u.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50">
                <input type="checkbox" checked={selectedIds.has(u.id)} onChange={() => toggleUser(u)} className="accent-[#1e3a6e]" />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-[#1e3a6e] truncate">{u.name || "(adsız)"}</span>
                  <span className="block text-xs text-slate-500 truncate">{u.email}{u.studentNumber ? ` · ${u.studentNumber}` : ""}{u.company ? ` · ${u.company}` : ""}</span>
                </span>
                <span className="text-xs text-slate-400 shrink-0">{u.bookCount} kitap</span>
              </label>
            ))}
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Arama kutusu boşken en son kaydolan 30 öğrenci listelenir.</p>
        </section>

        {/* 2) Kitaplar */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="font-bold text-[#1e3a6e] mb-3">2. Kitapları seç</h2>
          <div className="flex flex-wrap gap-2 mb-3">
            {bundles.map((b) => (
              <button key={b.id} onClick={() => addBundle(b)} className="px-3 py-1.5 rounded-lg border border-[#13a9e0] text-[#0e7da6] text-xs font-bold hover:bg-[#e8eef8]">
                + {b.title} ({b.ebookIds.length} kitap)
              </button>
            ))}
            <button onClick={() => setBookIds(ebooks.map((e) => e.id))} className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50">Tümünü seç</button>
            {bookIds.length > 0 && <button onClick={() => setBookIds([])} className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50">Temizle</button>}
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-xl">
            {ebooks.length === 0 && <div className="p-4 text-sm text-slate-500">Yayında kitap yok.</div>}
            {ebooks.map((e) => (
              <label key={e.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50">
                <input type="checkbox" checked={bookIds.includes(e.id)} onChange={() => toggleBook(e.id)} className="accent-[#1e3a6e]" />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-[#1e3a6e] truncate">{e.title}</span>
                  <span className="block text-xs text-slate-500 truncate">{e.subtitle || e.category || ""}</span>
                </span>
              </label>
            ))}
          </div>
        </section>
      </div>

      {/* 3) Tanımla */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 mt-5">
        <h2 className="font-bold text-[#1e3a6e] mb-3">3. Tanımla</h2>
        <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
          <div>
            <label className="text-xs font-bold text-slate-500">Not (isteğe bağlı, sadece yöneticiler görür)</label>
            <input className={inp} maxLength={300} placeholder="Ör. Kurumsal eğitim paketi, hediye, telafi" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <button onClick={grant} disabled={!canGrant}
            className="px-5 py-2.5 rounded-lg bg-[#1e3a6e] text-white text-sm font-bold inline-flex items-center justify-center gap-2 disabled:opacity-40">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            {selected.length} öğrenciye {bookIds.length} kitap tanımla
          </button>
        </div>
        <label className="flex items-center gap-2 mt-3 text-sm text-slate-600">
          <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="accent-[#1e3a6e]" />
          Öğrencilere "Kitaplığına yeni kitap eklendi" bilgilendirme maili gönder
        </label>
      </section>

      {/* Kayıtlar */}
      <section className="mt-8">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <h2 className="font-bold text-[#1e3a6e]">Tanımlanan kitaplar</h2>
          <form onSubmit={(e) => { e.preventDefault(); loadGrants(); }} className="flex gap-2">
            <input className={`${inp} w-64`} placeholder="Öğrenci ya da kitap adı" value={gq} onChange={(e) => setGq(e.target.value)} />
            <button className="px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600">Ara</button>
          </form>
        </div>
        {!grants && <div className="py-10 text-center"><Loader2 className="w-6 h-6 animate-spin text-[#13a9e0] mx-auto" /></div>}
        {grants && grants.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500 text-center">Henüz tanımlanmış kitap yok.</div>}
        {grants && grants.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-500 border-b border-slate-100">
                <tr><th className="px-4 py-2.5">Öğrenci</th><th className="px-4 py-2.5">Kitap</th><th className="px-4 py-2.5">Not</th><th className="px-4 py-2.5">Tarih</th><th className="px-4 py-2.5">Tanımlayan</th><th /></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {grants.map((g) => (
                  <tr key={g.id}>
                    <td className="px-4 py-2.5"><div className="font-semibold text-[#1e3a6e]">{g.userName}</div><div className="text-xs text-slate-500">{g.email}</div></td>
                    <td className="px-4 py-2.5 text-slate-700">{g.title}</td>
                    <td className="px-4 py-2.5 text-slate-500">{g.note || "—"}</td>
                    <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{new Date(g.createdAt).toLocaleDateString("tr-TR")}</td>
                    <td className="px-4 py-2.5 text-slate-500">{g.grantedBy || "—"}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button onClick={() => revoke(g)} className="p-1.5 rounded hover:bg-slate-100 text-red-600" aria-label="Tanımlamayı geri al"><Trash2 size={15} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
