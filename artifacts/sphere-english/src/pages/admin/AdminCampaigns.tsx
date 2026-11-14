import { useEffect, useMemo, useState } from "react";
import { Percent, Plus, Loader2, Pencil, Trash2, X, Check, Gift, Layers, ShoppingCart, Clock } from "lucide-react";
import { API } from "@/lib/api-url";

/**
 * Admin → Kampanyalar
 * Tipler: X al Y öde · Sepet tutarı eşiği · Kademeli adet indirimi · Süreli ürün/kategori indirimi.
 * Kural: sepet kampanyası ile kupon birleşmez; müşteri için hangisi avantajlıysa o uygulanır.
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

type CType = "buy_x_pay_y" | "cart_threshold" | "tiered_quantity" | "timed_discount";
type Scope = "ebook" | "course" | "all";
interface Campaign {
  id: number; name: string; type: CType; scope: Scope; targetEbookIds: number[]; targetCategories: string[];
  targetCourseSlugs: string[]; params: any; badgeText: string | null; description: string | null;
  startsAt: string | null; endsAt: string | null; isActive: boolean; showOnHome: boolean; priority: number; usedCount: number;
}
interface Options { ebooks: { id: number; title: string; category: string | null; priceKurus: number }[]; courses: { slug: string; title: string; priceKurus: number }[] }

const TYPE_INFO: Record<CType, { label: string; icon: any; hint: string }> = {
  buy_x_pay_y: { label: "X al Y öde", icon: Gift, hint: "Ör. 3 al 2 öde: sepetteki en ucuz kitap bedava. Her 3 kitapta bir tekrarlanır." },
  cart_threshold: { label: "Sepet tutarı eşiği", icon: ShoppingCart, hint: "Ör. 1.000 TL ve üzeri sepete %15 ya da 150 TL indirim." },
  tiered_quantity: { label: "Kademeli adet indirimi", icon: Layers, hint: "Ör. 2 kitapta %10, 3 kitapta %20. Sepetteki adede göre en yüksek kademe uygulanır." },
  timed_discount: { label: "Süreli ürün/kategori indirimi", icon: Clock, hint: "Seçili ürünlerin fiyatı düşer; sitede eski fiyat üstü çizili görünür." },
};
const CATS = [{ key: "seri", label: "1000 Kelime serisi" }, { key: "beceri", label: "Beceri Kitapları" }, { key: "sektorel", label: "Sektörel İngilizce" }];
const tl = (k: number) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(k / 100);
const toLocal = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : null);

function summary(c: Campaign): string {
  const p = c.params ?? {};
  const disc = (t: string, v: number) => (t === "fixed" ? `${tl(v * 100)} indirim` : `%${v} indirim`);
  if (c.type === "buy_x_pay_y") return `${p.buy} al ${p.pay} öde`;
  if (c.type === "cart_threshold") return `${tl(p.minKurus)} ve üzeri: ${disc(p.discountType, p.value)}`;
  if (c.type === "tiered_quantity") return (p.tiers ?? []).map((t: any) => `${t.minQty}+ adet %${t.percent}`).join(" · ");
  return disc(p.discountType, p.value);
}
function status(c: Campaign): { text: string; cls: string } {
  const now = Date.now();
  if (!c.isActive) return { text: "Pasif", cls: "bg-slate-100 text-slate-500" };
  if (c.startsAt && new Date(c.startsAt).getTime() > now) return { text: "Planlandı", cls: "bg-amber-50 text-amber-700" };
  if (c.endsAt && new Date(c.endsAt).getTime() < now) return { text: "Süresi doldu", cls: "bg-slate-100 text-slate-500" };
  return { text: "Yayında", cls: "bg-emerald-50 text-emerald-700" };
}

const EMPTY: Partial<Campaign> = {
  name: "", type: "buy_x_pay_y", scope: "ebook", targetEbookIds: [], targetCategories: [], targetCourseSlugs: [],
  params: { buy: 3, pay: 2 }, badgeText: "", description: "", startsAt: null, endsAt: null, isActive: false, showOnHome: false, priority: 0,
};
const DEFAULT_PARAMS: Record<CType, any> = {
  buy_x_pay_y: { buy: 3, pay: 2 },
  cart_threshold: { minKurus: 100000, discountType: "percentage", value: 15 },
  tiered_quantity: { tiers: [{ minQty: 2, percent: 10 }, { minQty: 3, percent: 20 }] },
  timed_discount: { discountType: "percentage", value: 20 },
};

export default function AdminCampaigns() {
  const [list, setList] = useState<Campaign[] | null>(null);
  const [opts, setOpts] = useState<Options>({ ebooks: [], courses: [] });
  const [editing, setEditing] = useState<Partial<Campaign> | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = () => apiFetch("/admin/campaigns").then((d) => setList(d.campaigns)).catch((e) => setErr(e.message));
  useEffect(() => { load(); apiFetch("/admin/campaigns/options").then(setOpts).catch(() => {}); }, []);

  async function toggle(c: Campaign) {
    try { await apiFetch(`/admin/campaigns/${c.id}`, { method: "PATCH", body: JSON.stringify({ isActive: !c.isActive }) }); load(); }
    catch (e: any) { alert(e.message); }
  }
  async function remove(c: Campaign) {
    if (!confirm(`"${c.name}" silinsin mi?`)) return;
    try { await apiFetch(`/admin/campaigns/${c.id}`, { method: "DELETE" }); } catch (e: any) { alert(e.message); }
    load();
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1e3a6e] flex items-center gap-2"><Percent className="text-[#13a9e0]" /> Kampanyalar</h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Süreli indirimler ürün fiyatına uygulanır. Sepet kampanyalarından müşteriye en çok kazandıran tek kampanya seçilir.
            Kupon kodu ile sepet kampanyası birleşmez: hangisi daha avantajlıysa o uygulanır.
          </p>
        </div>
        <button onClick={() => setEditing({ ...EMPTY })} className="px-4 py-2 rounded-lg bg-[#1e3a6e] text-white text-sm font-bold inline-flex items-center gap-2">
          <Plus size={16} /> Yeni kampanya
        </button>
      </div>
      {err && <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">{err}</div>}
      {!list && <div className="py-16 text-center"><Loader2 className="w-7 h-7 animate-spin text-[#13a9e0] mx-auto" /></div>}
      {list && list.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">Henüz kampanya yok. "Yeni kampanya" ile başlayın.</div>
      )}
      {list && list.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100">
          {list.map((c) => {
            const s = status(c); const Icon = TYPE_INFO[c.type]?.icon ?? Percent;
            return (
              <div key={c.id} className="p-4 flex items-center gap-4 flex-wrap">
                <div className="w-10 h-10 rounded-xl bg-[#e8eef8] flex items-center justify-center text-[#1e3a6e]"><Icon size={18} /></div>
                <div className="flex-1 min-w-[220px]">
                  <div className="font-bold text-[#1e3a6e]">{c.name} {c.badgeText && <span className="ml-1 text-[11px] px-2 py-0.5 rounded-full bg-[#13a9e0] text-white align-middle">{c.badgeText}</span>}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {TYPE_INFO[c.type]?.label} · {summary(c)} · {c.scope === "ebook" ? "E-kitap" : c.scope === "course" ? "Kurs" : "E-kitap + kurs"}
                    {c.endsAt && ` · bitiş ${new Date(c.endsAt).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })}`}
                    {c.showOnHome && " · ana sayfada"} · {c.usedCount} satış
                  </div>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${s.cls}`}>{s.text}</span>
                <button onClick={() => toggle(c)} className={`text-xs font-bold px-3 py-1.5 rounded-lg ${c.isActive ? "bg-slate-100 text-slate-700" : "bg-emerald-600 text-white"}`}>
                  {c.isActive ? "Durdur" : "Yayına al"}
                </button>
                <button onClick={() => setEditing({ ...c })} className="p-2 rounded hover:bg-slate-100 text-slate-500" aria-label="Düzenle"><Pencil size={16} /></button>
                <button onClick={() => remove(c)} className="p-2 rounded hover:bg-slate-100 text-red-600" aria-label="Sil"><Trash2 size={16} /></button>
              </div>
            );
          })}
        </div>
      )}
      {editing && <Editor initial={editing} opts={opts} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function Editor({ initial, opts, onClose, onSaved }: { initial: Partial<Campaign>; opts: Options; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<Partial<Campaign>>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<Campaign>) => setF((x) => ({ ...x, ...patch }));
  const p = f.params ?? {};
  const setP = (patch: any) => set({ params: { ...p, ...patch } });
  const type = f.type as CType;
  const inp = "w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-[#13a9e0]";
  const showEbooks = f.scope !== "course";
  const showCourses = f.scope !== "ebook" && (type === "timed_discount" || type === "cart_threshold");
  const ebooksByCat = useMemo(() => opts.ebooks, [opts.ebooks]);

  async function save() {
    setSaving(true); setError(null);
    const body = {
      name: f.name, type: f.type, scope: f.scope, params: f.params,
      targetEbookIds: f.targetEbookIds, targetCategories: f.targetCategories, targetCourseSlugs: f.targetCourseSlugs,
      badgeText: f.badgeText, description: f.description, startsAt: f.startsAt, endsAt: f.endsAt,
      isActive: f.isActive, showOnHome: f.showOnHome, priority: f.priority,
    };
    try {
      await apiFetch(f.id ? `/admin/campaigns/${f.id}` : "/admin/campaigns", { method: f.id ? "PATCH" : "POST", body: JSON.stringify(body) });
      onSaved();
    } catch (e: any) { setError(e.message); setSaving(false); }
  }
  const toggleIn = <T,>(arr: T[] | undefined, v: T) => (arr ?? []).includes(v) ? (arr ?? []).filter((x) => x !== v) : [...(arr ?? []), v];

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-2xl my-8 shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="text-lg font-bold text-[#1e3a6e]">{f.id ? "Kampanyayı düzenle" : "Yeni kampanya"}</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700" aria-label="Kapat"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-5">
          <div>
            <label className="text-xs font-bold text-slate-500">Kampanya türü</label>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {(Object.keys(TYPE_INFO) as CType[]).map((t) => {
                const I = TYPE_INFO[t].icon;
                return (
                  <button key={t} type="button" disabled={!!f.id && f.type !== t && (f.usedCount ?? 0) > 0}
                    onClick={() => set({ type: t, params: DEFAULT_PARAMS[t], scope: t === "buy_x_pay_y" || t === "tiered_quantity" ? "ebook" : f.scope })}
                    className={`p-3 rounded-xl border text-left text-sm ${type === t ? "border-[#1e3a6e] bg-[#e8eef8]" : "border-slate-200"}`}>
                    <div className="font-bold text-[#1e3a6e] flex items-center gap-1.5"><I size={15} /> {TYPE_INFO[t].label}</div>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-slate-500 mt-2">{TYPE_INFO[type]?.hint}</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div><label className="text-xs font-bold text-slate-500">Kampanya adı (iç kullanım + sepette görünür)</label>
              <input className={inp} value={f.name ?? ""} onChange={(e) => set({ name: e.target.value })} placeholder="Ör. Kasım 3 al 2 öde" /></div>
            <div><label className="text-xs font-bold text-slate-500">Rozet metni (sitede, kısa)</label>
              <input className={inp} value={f.badgeText ?? ""} maxLength={60} onChange={(e) => set({ badgeText: e.target.value })} placeholder="Ör. 3 al 2 öde" /></div>
          </div>

          {/* Tipe göre kurallar */}
          <div className="rounded-xl bg-[#f7f9fd] p-4 space-y-3">
            {type === "buy_x_pay_y" && (
              <div className="flex items-center gap-2 text-sm">
                <input type="number" min={2} className={`${inp} w-20`} value={p.buy ?? 3} onChange={(e) => setP({ buy: Number(e.target.value) })} /> al
                <input type="number" min={1} className={`${inp} w-20`} value={p.pay ?? 2} onChange={(e) => setP({ pay: Number(e.target.value) })} /> öde
              </div>
            )}
            {(type === "cart_threshold" || type === "timed_discount") && (
              <div className="flex items-center gap-2 text-sm flex-wrap">
                {type === "cart_threshold" && (<>
                  Sepet <input type="number" min={1} className={`${inp} w-28`} value={Math.round((p.minKurus ?? 0) / 100)} onChange={(e) => setP({ minKurus: Number(e.target.value) * 100 })} /> TL ve üzeri →
                </>)}
                <input type="number" min={1} className={`${inp} w-24`} value={p.value ?? ""} onChange={(e) => setP({ value: Number(e.target.value) })} />
                <select className={`${inp} w-auto`} value={p.discountType ?? "percentage"} onChange={(e) => setP({ discountType: e.target.value })}>
                  <option value="percentage">% indirim</option><option value="fixed">TL indirim</option>
                </select>
              </div>
            )}
            {type === "tiered_quantity" && (
              <div className="space-y-2">
                {(p.tiers ?? []).map((t: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <input type="number" min={2} className={`${inp} w-20`} value={t.minQty} onChange={(e) => setP({ tiers: p.tiers.map((x: any, j: number) => j === i ? { ...x, minQty: Number(e.target.value) } : x) })} /> ve üzeri kitapta %
                    <input type="number" min={1} max={99} className={`${inp} w-20`} value={t.percent} onChange={(e) => setP({ tiers: p.tiers.map((x: any, j: number) => j === i ? { ...x, percent: Number(e.target.value) } : x) })} />
                    <button type="button" onClick={() => setP({ tiers: p.tiers.filter((_: any, j: number) => j !== i) })} className="text-red-600 p-1" aria-label="Kademeyi sil"><X size={15} /></button>
                  </div>
                ))}
                <button type="button" onClick={() => setP({ tiers: [...(p.tiers ?? []), { minQty: Number((p.tiers ?? [])[(p.tiers ?? []).length - 1]?.minQty ?? 1) + 1, percent: 10 }] })}
                  className="text-xs font-bold text-[#0e7da6]">+ Kademe ekle</button>
              </div>
            )}
          </div>

          {/* Kapsam */}
          <div>
            <label className="text-xs font-bold text-slate-500">Geçerli olduğu ürünler</label>
            <div className="mt-1 flex gap-2 text-sm">
              {(type === "buy_x_pay_y" || type === "tiered_quantity" ? (["ebook"] as Scope[]) : (["ebook", "course", "all"] as Scope[])).map((s) => (
                <button key={s} type="button" onClick={() => set({ scope: s })}
                  className={`px-3 py-1.5 rounded-full border ${f.scope === s ? "bg-[#1e3a6e] text-white border-[#1e3a6e]" : "border-slate-200 text-slate-600"}`}>
                  {s === "ebook" ? "E-kitaplar" : s === "course" ? "Kurslar" : "E-kitap + kurs"}
                </button>
              ))}
            </div>
            {showEbooks && (
              <div className="mt-3">
                <div className="text-xs text-slate-500 mb-1">Kategori ve/veya kitap seçin. <b>Hiçbiri seçilmezse tüm e-kitaplar</b> geçerli olur.</div>
                <div className="flex gap-2 flex-wrap mb-2">
                  {CATS.map((c) => (
                    <label key={c.key} className="text-sm flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 cursor-pointer">
                      <input type="checkbox" checked={(f.targetCategories ?? []).includes(c.key)} onChange={() => set({ targetCategories: toggleIn(f.targetCategories, c.key) })} /> {c.label}
                    </label>
                  ))}
                </div>
                <div className="max-h-44 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
                  {ebooksByCat.map((b) => (
                    <label key={b.id} className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer">
                      <input type="checkbox" checked={(f.targetEbookIds ?? []).includes(b.id)} onChange={() => set({ targetEbookIds: toggleIn(f.targetEbookIds, b.id) })} />
                      <span className="flex-1">{b.title}</span><span className="text-xs text-slate-400">{tl(b.priceKurus)}</span>
                    </label>
                  ))}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">Paketler (5'li set) zaten indirimli olduğu için yalnızca "Sepet tutarı eşiği" kampanyasına sayılır.</div>
              </div>
            )}
            {showCourses && (
              <div className="mt-3">
                <div className="text-xs text-slate-500 mb-1">Kurs seçin. <b>Hiçbiri seçilmezse tüm kurslar</b> geçerli olur.</div>
                <div className="flex gap-2 flex-wrap">
                  {opts.courses.map((c) => (
                    <label key={c.slug} className="text-sm flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 cursor-pointer">
                      <input type="checkbox" checked={(f.targetCourseSlugs ?? []).includes(c.slug)} onChange={() => set({ targetCourseSlugs: toggleIn(f.targetCourseSlugs, c.slug) })} /> {c.title} <span className="text-xs text-slate-400">{tl(c.priceKurus)}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div><label className="text-xs font-bold text-slate-500">Başlangıç (boşsa hemen)</label>
              <input type="datetime-local" className={inp} value={toLocal(f.startsAt ?? null)} onChange={(e) => set({ startsAt: fromLocal(e.target.value) })} /></div>
            <div><label className="text-xs font-bold text-slate-500">Bitiş (boşsa süresiz)</label>
              <input type="datetime-local" className={inp} value={toLocal(f.endsAt ?? null)} onChange={(e) => set({ endsAt: fromLocal(e.target.value) })} /></div>
          </div>
          <div><label className="text-xs font-bold text-slate-500">Kısa açıklama (ana sayfa banner'ında ve sepette görünebilir)</label>
            <textarea rows={2} className={inp} value={f.description ?? ""} onChange={(e) => set({ description: e.target.value })} placeholder="Ör. Beceri Kitapları'nda 3 kitap alana en ucuzu bizden." /></div>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={!!f.isActive} onChange={(e) => set({ isActive: e.target.checked })} /> Yayında</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={!!f.showOnHome} onChange={(e) => set({ showOnHome: e.target.checked })} /> Ana sayfa banner'ında öne çıkar</label>
            <label className="flex items-center gap-2">Öncelik <input type="number" className={`${inp} w-20`} value={f.priority ?? 0} onChange={(e) => set({ priority: Number(e.target.value) })} /></label>
          </div>
          {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">{error}</div>}
        </div>
        <div className="flex justify-end gap-2 p-5 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-600">Vazgeç</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 rounded-lg bg-[#1e3a6e] text-white text-sm font-bold inline-flex items-center gap-2 disabled:opacity-50">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}
