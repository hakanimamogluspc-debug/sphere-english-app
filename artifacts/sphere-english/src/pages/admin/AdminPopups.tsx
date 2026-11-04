import { useCallback, useEffect, useState } from "react";
import {
  Pencil, Trash2, Loader2, AlertCircle, X, Eye, EyeOff, Download, Mail, Megaphone, Gift,
} from "lucide-react";
import { API } from "@/lib/api-url";

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

interface Popup {
  id: number; kind: "announcement" | "newsletter"; title: string; body: string | null; imageUrl: string | null;
  ctaText: string | null; ctaUrl: string | null; delaySeconds: number; frequencyDays: number; priority: number;
  isActive: boolean; startsAt: string | null; endsAt: string | null;
  couponDiscountType: "percentage" | "fixed" | null; couponDiscountValue: string | null; couponAppliesTo: string[] | null;
  couponValidDays: number; views: number; clicks: number; signups: number;
}

const SCOPES: Record<string, string> = { ebook: "E-kitaplar", subscription_all: "Abonelik (tümü)" };

function toLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : null);
const pct = (a: number, b: number) => (b > 0 ? `%${Math.round((a / b) * 100)}` : "—");

export default function AdminPopups() {
  const [tab, setTab] = useState<"popups" | "subscribers">("popups");
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <header className="mb-5">
        <h1 className="text-2xl font-bold text-blue-800 flex items-center gap-2"><Megaphone size={26} /> Site Pop-up'ları</h1>
        <p className="text-sm text-slate-500 mt-1">
          www.sphereenglish.com'da gösterilen duyuru ve bülten pop-up'ları. Yeni kitap, kurs, duyuru ya da bültene kayıt + kişiye özel kupon.
        </p>
      </header>
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700 flex justify-between items-center">
          <span className="flex items-center gap-2"><AlertCircle size={16} /> {error}</span>
          <button onClick={() => setError(null)}><X size={14} /></button>
        </div>
      )}
      <div className="flex gap-1 mb-5 border-b border-slate-200">
        {([["popups", "Pop-up'lar", Megaphone], ["subscribers", "Bülten aboneleri", Mail]] as const).map(([k, l, Icon]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm border-b-2 -mb-px ${tab === k ? "border-blue-700 text-blue-800 font-semibold" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
            <Icon size={15} /> {l}
          </button>
        ))}
      </div>
      {tab === "popups" ? <PopupsTab onError={setError} /> : <SubscribersTab onError={setError} />}
    </div>
  );
}

function PopupsTab({ onError }: { onError: (m: string | null) => void }) {
  const [popups, setPopups] = useState<Popup[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Partial<Popup> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setPopups((await apiFetch("/admin/popups")).popups ?? []); }
    catch (e: any) { onError(e.message); }
    finally { setLoading(false); }
  }, [onError]);
  useEffect(() => { load(); }, [load]);

  async function toggle(p: Popup) {
    try { await apiFetch(`/admin/popups/${p.id}`, { method: "PATCH", body: JSON.stringify({ isActive: !p.isActive }) }); load(); }
    catch (e: any) { onError(e.message); }
  }
  async function remove(p: Popup) {
    if (!confirm(`"${p.title}" silinsin mi?`)) return;
    try { await apiFetch(`/admin/popups/${p.id}`, { method: "DELETE" }); load(); }
    catch (e: any) { onError(e.message); }
  }

  const activeCount = popups.filter((p) => p.isActive).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <p className="text-xs text-slate-500">
          Aynı anda birden fazla pop-up yayındaysa ziyaretçiye <b>önceliği en yüksek olan</b> gösterilir; kapatınca belirlenen gün kadar tekrar çıkmaz.
          {activeCount > 1 && <span className="text-amber-700"> Şu an {activeCount} pop-up yayında.</span>}
        </p>
        <div className="flex gap-2">
          <button onClick={() => setEditing({ kind: "announcement", delaySeconds: 8, frequencyDays: 7, priority: 0, isActive: false })}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-white border border-slate-200 hover:bg-slate-50 text-sm">
            <Megaphone size={14} /> Yeni duyuru
          </button>
          <button onClick={() => setEditing({ kind: "newsletter", title: "Bültene katıl, %10 indirim kazan", delaySeconds: 10, frequencyDays: 14, priority: 0, isActive: false, couponDiscountType: "percentage", couponDiscountValue: "10", couponAppliesTo: ["ebook"], couponValidDays: 14 })}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-blue-700 text-white text-sm hover:bg-blue-800">
            <Gift size={14} /> Yeni bülten + kupon
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 text-left">
            <tr>
              <th className="px-3 py-2">Pop-up</th><th className="px-3 py-2">Tür</th><th className="px-3 py-2 text-center">Gösterim</th>
              <th className="px-3 py-2 text-center">Tıklama / Kayıt</th><th className="px-3 py-2 text-center">Durum</th><th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading && popups.length === 0 ? (
              <tr><td colSpan={6} className="p-6 text-center"><Loader2 className="animate-spin inline" /></td></tr>
            ) : popups.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-slate-400">Henüz pop-up yok</td></tr>
            ) : popups.map((p) => {
              const conv = p.kind === "newsletter" ? p.signups : p.clicks;
              return (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">
                    <div className="font-semibold text-slate-800">{p.title}</div>
                    <div className="text-xs text-slate-500">{p.delaySeconds} sn sonra · kapatınca {p.frequencyDays} gün gizli · öncelik {p.priority}
                      {p.endsAt && ` · bitiş ${new Date(p.endsAt).toLocaleDateString("tr-TR")}`}</div>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {p.kind === "newsletter"
                      ? <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Bülten{p.couponDiscountValue ? ` · ${p.couponDiscountType === "percentage" ? "%" : ""}${Number(p.couponDiscountValue)}${p.couponDiscountType === "fixed" ? " TL" : ""}` : ""}</span>
                      : <span className="px-2 py-0.5 rounded-full bg-sky-50 text-sky-700">Duyuru</span>}
                  </td>
                  <td className="px-3 py-2 text-center tabular-nums">{p.views}</td>
                  <td className="px-3 py-2 text-center tabular-nums">{conv} <span className="text-xs text-slate-400">({pct(conv, p.views)})</span></td>
                  <td className="px-3 py-2 text-center">
                    {p.isActive ? <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">Yayında</span>
                      : <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">Kapalı</span>}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => toggle(p)} className="p-1.5 hover:bg-slate-100 rounded" title={p.isActive ? "Yayından kaldır" : "Yayına al"}>
                        {p.isActive ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                      <button onClick={() => setEditing(p)} className="p-1.5 hover:bg-slate-100 rounded" title="Düzenle"><Pencil size={14} /></button>
                      <button onClick={() => remove(p)} className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-red-600" title="Sil"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editing && <PopupForm initial={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} onError={onError} />}
    </div>
  );
}

function PopupForm({ initial, onClose, onSaved, onError }: {
  initial: Partial<Popup>; onClose: () => void; onSaved: () => void; onError: (m: string | null) => void;
}) {
  const [f, setF] = useState({
    kind: initial.kind ?? "announcement",
    title: initial.title ?? "",
    body: initial.body ?? "",
    imageUrl: initial.imageUrl ?? "",
    ctaText: initial.ctaText ?? "",
    ctaUrl: initial.ctaUrl ?? "",
    delaySeconds: String(initial.delaySeconds ?? 8),
    frequencyDays: String(initial.frequencyDays ?? 7),
    priority: String(initial.priority ?? 0),
    isActive: initial.isActive ?? false,
    startsAt: toLocal(initial.startsAt ?? null),
    endsAt: toLocal(initial.endsAt ?? null),
    couponDiscountType: initial.couponDiscountType ?? "percentage",
    couponDiscountValue: initial.couponDiscountValue != null ? String(Number(initial.couponDiscountValue)) : "",
    couponAppliesTo: initial.couponAppliesTo ?? ["ebook"],
    couponValidDays: String(initial.couponValidDays ?? 14),
  });
  const [busy, setBusy] = useState(false);
  const isNews = f.kind === "newsletter";
  const set = (k: keyof typeof f, v: any) => setF((x) => ({ ...x, [k]: v }));

  async function save() {
    setBusy(true);
    try {
      const body = {
        ...f,
        delaySeconds: Number(f.delaySeconds), frequencyDays: Number(f.frequencyDays), priority: Number(f.priority),
        couponValidDays: Number(f.couponValidDays), couponDiscountValue: f.couponDiscountValue ? Number(f.couponDiscountValue) : null,
        startsAt: fromLocal(f.startsAt), endsAt: fromLocal(f.endsAt),
      };
      await apiFetch(initial.id ? `/admin/popups/${initial.id}` : "/admin/popups", {
        method: initial.id ? "PATCH" : "POST", body: JSON.stringify(body),
      });
      onSaved();
    } catch (e: any) { onError(e.message); }
    finally { setBusy(false); }
  }

  const input = "w-full px-3 py-2 border border-slate-200 rounded-md text-sm";
  const label = "block text-xs font-medium mb-1";

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-5xl max-h-[92vh] overflow-y-auto grid md:grid-cols-[1.2fr_1fr]">
        <div className="p-6 space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold">{initial.id ? "Pop-up'ı düzenle" : isNews ? "Yeni bülten pop-up'ı" : "Yeni duyuru pop-up'ı"}</h2>
            <button onClick={onClose}><X size={20} /></button>
          </div>
          <div className="flex gap-2">
            {(["announcement", "newsletter"] as const).map((k) => (
              <button key={k} onClick={() => set("kind", k)}
                className={`flex-1 py-2 rounded-md text-sm border ${f.kind === k ? "bg-blue-700 text-white border-blue-700" : "border-slate-200"}`}>
                {k === "announcement" ? "Duyuru (yeni kitap, kurs…)" : "Bülten kaydı + kupon"}
              </button>
            ))}
          </div>
          <div><label className={label}>Başlık *</label><input className={input} value={f.title} maxLength={200} onChange={(e) => set("title", e.target.value)} /></div>
          <div><label className={label}>Metin</label><textarea className={input} rows={3} value={f.body} maxLength={2000} onChange={(e) => set("body", e.target.value)} /></div>
          <div>
            <label className={label}>Görsel linki (isteğe bağlı)</label>
            <input className={input} value={f.imageUrl} placeholder="https://app.sphereenglish.com/api/mail-assets/…" onChange={(e) => set("imageUrl", e.target.value)} />
            <p className="text-[11px] text-slate-400 mt-1">Medya Kütüphanesi'ne yükleyip "Link" düğmesiyle kopyala.</p>
          </div>
          {!isNews && (
            <div className="grid grid-cols-2 gap-3">
              <div><label className={label}>Buton yazısı</label><input className={input} value={f.ctaText} placeholder="Kitabı incele" maxLength={80} onChange={(e) => set("ctaText", e.target.value)} /></div>
              <div><label className={label}>Buton linki</label><input className={input} value={f.ctaUrl} placeholder="/e-kitaplar/…" onChange={(e) => set("ctaUrl", e.target.value)} /></div>
            </div>
          )}
          {isNews && (
            <div className="p-3 rounded-md bg-emerald-50 border border-emerald-200 space-y-2">
              <div className="text-xs font-semibold text-emerald-900">Kayıt olana kişiye özel tek kullanımlık kupon</div>
              <div className="grid grid-cols-3 gap-2">
                <select className={input} value={f.couponDiscountType} onChange={(e) => set("couponDiscountType", e.target.value)}>
                  <option value="percentage">Yüzde (%)</option><option value="fixed">Sabit (TL)</option>
                </select>
                <input className={input} type="number" min="0" placeholder="Değer (boş = kupon yok)" value={f.couponDiscountValue} onChange={(e) => set("couponDiscountValue", e.target.value)} />
                <input className={input} type="number" min="1" max="365" value={f.couponValidDays} onChange={(e) => set("couponValidDays", e.target.value)} title="Geçerlilik (gün)" />
              </div>
              <div className="flex gap-3 text-xs">
                {Object.entries(SCOPES).map(([k, l]) => (
                  <label key={k} className="flex items-center gap-1">
                    <input type="checkbox" checked={f.couponAppliesTo.includes(k)}
                      onChange={() => set("couponAppliesTo", f.couponAppliesTo.includes(k) ? f.couponAppliesTo.filter((x) => x !== k) : [...f.couponAppliesTo, k])} />
                    {l}
                  </label>
                ))}
                <span className="text-slate-500">· son kutu: geçerlilik (gün)</span>
              </div>
              <p className="text-[11px] text-emerald-800">Kod kayıttan hemen sonra ekranda gösterilir ve e-postayla gönderilir. Aynı adrese ikinci kupon verilmez.</p>
            </div>
          )}
          <div className="grid grid-cols-3 gap-3">
            <div><label className={label}>Kaç saniye sonra</label><input className={input} type="number" min="0" max="120" value={f.delaySeconds} onChange={(e) => set("delaySeconds", e.target.value)} /></div>
            <div><label className={label}>Kapatınca kaç gün gizli</label><input className={input} type="number" min="0" max="365" value={f.frequencyDays} onChange={(e) => set("frequencyDays", e.target.value)} /></div>
            <div><label className={label}>Öncelik</label><input className={input} type="number" value={f.priority} onChange={(e) => set("priority", e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={label}>Başlangıç (boş = hemen)</label><input className={input} type="datetime-local" value={f.startsAt} onChange={(e) => set("startsAt", e.target.value)} /></div>
            <div><label className={label}>Bitiş (boş = süresiz)</label><input className={input} type="datetime-local" value={f.endsAt} onChange={(e) => set("endsAt", e.target.value)} /></div>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.isActive} onChange={(e) => set("isActive", e.target.checked)} /> Yayında</label>
          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="flex-1 py-2 border border-slate-200 rounded-md text-sm">İptal</button>
            <button onClick={save} disabled={busy || !f.title.trim()} className="flex-1 py-2 bg-blue-700 text-white rounded-md text-sm disabled:opacity-50">
              {busy ? "Kaydediliyor…" : "Kaydet"}
            </button>
          </div>
        </div>
        {/* Önizleme — www'deki görünüme yakın */}
        <div className="bg-slate-100 p-6 flex items-center justify-center">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden">
            {f.imageUrl && <img src={f.imageUrl} alt="" className="w-full max-h-48 object-cover" />}
            <div className="p-5">
              <div className="text-[18px] font-extrabold text-[#1e3a6e] leading-snug">{f.title || "Başlık"}</div>
              {f.body && <p className="mt-2 text-sm text-slate-600 whitespace-pre-line">{f.body}</p>}
              {isNews ? (
                <div className="mt-4 space-y-2">
                  <div className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-400">E-posta adresin</div>
                  <div className="text-[11px] text-slate-500 flex gap-1.5"><span>☐</span> Kampanya ve duyuru e-postaları almayı kabul ediyorum…</div>
                  <div className="py-2.5 rounded-lg bg-[#1e3a6e] text-white text-sm font-bold text-center">
                    {f.couponDiscountValue ? `Kuponumu al (${f.couponDiscountType === "percentage" ? "%" : ""}${f.couponDiscountValue}${f.couponDiscountType === "fixed" ? " TL" : ""})` : "Kaydol"}
                  </div>
                </div>
              ) : f.ctaText ? (
                <div className="mt-4 py-2.5 rounded-lg bg-[#1e3a6e] text-white text-sm font-bold text-center">{f.ctaText}</div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SubscribersTab({ onError }: { onError: (m: string | null) => void }) {
  const [data, setData] = useState<any>(null);
  useEffect(() => { apiFetch("/admin/newsletter?limit=200").then(setData).catch((e) => onError(e.message)); }, [onError]);

  function exportCsv() {
    const token = localStorage.getItem(TOKEN_KEY);
    fetch(`${API}/admin/newsletter/export.csv`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob()).then((b) => {
        const url = URL.createObjectURL(b); const a = document.createElement("a");
        a.href = url; a.download = `bulten-aboneleri-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
      }).catch((e) => onError(e.message));
  }

  if (!data) return <div className="py-10 text-center"><Loader2 className="animate-spin inline" /></div>;
  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {[["Aktif abone", data.active], ["Ayrılan", data.unsubscribed], ["Kuponunu kullanan", data.couponUsed], ["Toplam kayıt", data.total]].map(([l, v]) => (
          <div key={l as string} className="bg-white border border-slate-200 rounded-lg px-4 py-3">
            <div className="text-xs text-slate-500">{l}</div><div className="text-2xl font-bold text-blue-800 tabular-nums">{v}</div>
          </div>
        ))}
      </div>
      <div className="flex justify-end mb-3">
        <button onClick={exportCsv} className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-blue-700 text-white text-sm"><Download size={14} /> CSV indir (aktif aboneler)</button>
      </div>
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 text-left">
            <tr><th className="px-3 py-2">E-posta</th><th className="px-3 py-2">Kaynak</th><th className="px-3 py-2">Kupon</th><th className="px-3 py-2">Tarih</th></tr>
          </thead>
          <tbody>
            {data.subscribers.length === 0 ? (
              <tr><td colSpan={4} className="p-8 text-center text-slate-400">Henüz abone yok</td></tr>
            ) : data.subscribers.map((s: any) => (
              <tr key={s.id} className={`border-t border-slate-100 ${s.unsubscribedAt ? "opacity-50" : ""}`}>
                <td className="px-3 py-2 font-medium">{s.email}{s.unsubscribedAt && <span className="ml-2 text-xs text-slate-500">(ayrıldı)</span>}</td>
                <td className="px-3 py-2 text-xs text-slate-500">{s.popupTitle ?? s.source}</td>
                <td className="px-3 py-2 text-xs font-mono">{s.couponCode ?? "—"}{s.couponCode && (s.couponUsed > 0 ? <span className="ml-1 text-emerald-700 font-sans">✓ kullanıldı</span> : null)}</td>
                <td className="px-3 py-2 text-xs text-slate-500">{new Date(s.createdAt).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
