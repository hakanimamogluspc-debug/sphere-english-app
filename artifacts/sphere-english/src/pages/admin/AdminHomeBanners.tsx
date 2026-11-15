import { useEffect, useState } from "react";
import { GalleryHorizontal, Plus, Loader2, Pencil, Trash2, X, Check, ArrowUp, ArrowDown, ExternalLink } from "lucide-react";
import { API } from "@/lib/api-url";

/**
 * Admin → Ana Sayfa Banner'ları (www hero slaytları).
 * Slaytlar sırayla otomatik kayar. "Kampanyayı öne çıkar" açık slaytta, Kampanyalar'da "Ana sayfa banner'ında öne çıkar"
 * işaretli yayındaki kampanya varsa üst etiket ve açıklama otomatik olarak o kampanyadan gelir.
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

interface Banner {
  id: number; slot: "ebook" | "course" | "general"; sortOrder: number; isActive: boolean;
  eyebrow: string | null; titleLine1: string; titleLine2: string | null; titleAccent: string | null; subtitle: string | null;
  cta1Text: string | null; cta1Url: string | null; cta2Text: string | null; cta2Url: string | null;
  imageUrl: string | null; videoUrl: string | null; imageAlt: string | null; imageBadge: string | null; useCampaign: boolean;
  startsAt: string | null; endsAt: string | null;
}
const SLOT_LABEL = { ebook: "E-kitap / kampanya", course: "Kurslar", general: "Genel" };
const EMPTY: Partial<Banner> = { slot: "general", isActive: false, titleLine1: "", useCampaign: false, sortOrder: 99 };
const toLocal = (iso: string | null | undefined) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : null);

export default function AdminHomeBanners() {
  const [list, setList] = useState<Banner[] | null>(null);
  const [editing, setEditing] = useState<Partial<Banner> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = () => apiFetch("/admin/home-banners").then((d) => setList(d.banners)).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  async function patch(id: number, body: Partial<Banner>) {
    try { await apiFetch(`/admin/home-banners/${id}`, { method: "PATCH", body: JSON.stringify(body) }); load(); } catch (e: any) { alert(e.message); }
  }
  async function move(i: number, dir: -1 | 1) {
    if (!list) return;
    const j = i + dir; if (j < 0 || j >= list.length) return;
    const a = list[i], b = list[j];
    await Promise.all([
      apiFetch(`/admin/home-banners/${a.id}`, { method: "PATCH", body: JSON.stringify({ sortOrder: j + 1 }) }),
      apiFetch(`/admin/home-banners/${b.id}`, { method: "PATCH", body: JSON.stringify({ sortOrder: i + 1 }) }),
    ]).catch((e) => alert(e.message));
    load();
  }
  async function remove(b: Banner) {
    if (!confirm("Bu slayt silinsin mi?")) return;
    try { await apiFetch(`/admin/home-banners/${b.id}`, { method: "DELETE" }); load(); } catch (e: any) { alert(e.message); }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1e3a6e] flex items-center gap-2"><GalleryHorizontal className="text-[#13a9e0]" /> Ana Sayfa Banner'ları</h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            sphereenglish.com ana sayfasının giriş slaytları; sırayla kayar. "Kampanyayı öne çıkar" açık slaytta, Kampanyalar'da
            "Ana sayfa banner'ında öne çıkar" işaretli yayındaki kampanya varsa etiket ve açıklama otomatik ondan gelir.
          </p>
        </div>
        <div className="flex gap-2">
          <a href="https://www.sphereenglish.com/" target="_blank" rel="noreferrer" className="px-3 py-2 rounded-lg border border-slate-200 text-sm inline-flex items-center gap-1.5 text-slate-600"><ExternalLink size={15} /> Siteyi aç</a>
          <button onClick={() => setEditing({ ...EMPTY })} className="px-4 py-2 rounded-lg bg-[#1e3a6e] text-white text-sm font-bold inline-flex items-center gap-2"><Plus size={16} /> Yeni slayt</button>
        </div>
      </div>
      {err && <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">{err}</div>}
      {!list && <div className="py-16 text-center"><Loader2 className="w-7 h-7 animate-spin text-[#13a9e0] mx-auto" /></div>}
      <div className="space-y-3">
        {list?.map((b, i) => (
          <div key={b.id} className={`rounded-2xl border bg-white p-4 flex gap-4 items-center ${b.isActive ? "border-slate-200" : "border-dashed border-slate-300 opacity-70"}`}>
            <div className="w-28 h-20 rounded-xl overflow-hidden bg-[#e8eef8] shrink-0">
              {b.imageUrl && <img src={b.imageUrl.startsWith("/") ? `https://www.sphereenglish.com${b.imageUrl}` : b.imageUrl} alt="" className="w-full h-full object-cover object-top" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-bold text-[#0e7da6] uppercase">{SLOT_LABEL[b.slot]}{b.useCampaign && " · kampanyayı öne çıkarır"}{b.eyebrow && ` · ${b.eyebrow}`}</div>
              <div className="font-bold text-[#1e3a6e] truncate">{[b.titleLine1, b.titleLine2, b.titleAccent].filter(Boolean).join(" ")}</div>
              <div className="text-xs text-slate-500 truncate">{b.subtitle}</div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => move(i, -1)} disabled={i === 0} className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30" aria-label="Yukarı"><ArrowUp size={15} /></button>
              <button onClick={() => move(i, 1)} disabled={i === (list.length - 1)} className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30" aria-label="Aşağı"><ArrowDown size={15} /></button>
              <button onClick={() => patch(b.id, { isActive: !b.isActive })} className={`text-xs font-bold px-3 py-1.5 rounded-lg ${b.isActive ? "bg-slate-100 text-slate-700" : "bg-emerald-600 text-white"}`}>{b.isActive ? "Gizle" : "Yayına al"}</button>
              <button onClick={() => setEditing({ ...b })} className="p-1.5 rounded hover:bg-slate-100 text-slate-500" aria-label="Düzenle"><Pencil size={15} /></button>
              <button onClick={() => remove(b)} className="p-1.5 rounded hover:bg-slate-100 text-red-600" aria-label="Sil"><Trash2 size={15} /></button>
            </div>
          </div>
        ))}
      </div>
      {editing && <Editor initial={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function Editor({ initial, onClose, onSaved }: { initial: Partial<Banner>; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<Partial<Banner>>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (p: Partial<Banner>) => setF((x) => ({ ...x, ...p }));
  const inp = "w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-[#13a9e0]";
  const field = (label: string, key: keyof Banner, ph = "", max = 80) => (
    <div><label className="text-xs font-bold text-slate-500">{label}</label>
      <input className={inp} maxLength={max} value={(f[key] as string) ?? ""} placeholder={ph} onChange={(e) => set({ [key]: e.target.value } as any)} /></div>
  );
  async function save() {
    setSaving(true); setError(null);
    try {
      const { id, ...body } = f as Banner;
      await apiFetch(id ? `/admin/home-banners/${id}` : "/admin/home-banners", { method: id ? "PATCH" : "POST", body: JSON.stringify(body) });
      onSaved();
    } catch (e: any) { setError(e.message); setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-2xl my-8 shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="text-lg font-bold text-[#1e3a6e]">{f.id ? "Slaytı düzenle" : "Yeni slayt"}</h2>
          <button onClick={onClose} className="p-1 text-slate-400" aria-label="Kapat"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div><label className="text-xs font-bold text-slate-500">Tür</label>
              <select className={inp} value={f.slot} onChange={(e) => set({ slot: e.target.value as Banner["slot"] })}>
                <option value="ebook">E-kitap / kampanya</option><option value="course">Kurslar</option><option value="general">Genel</option>
              </select></div>
            {field("Üst etiket (küçük, büyük harf)", "eyebrow", "Ör. E-KİTAPLAR")}
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            {field("Başlık 1. satır *", "titleLine1", "İş İngilizcesinde")}
            {field("Başlık 2. satır", "titleLine2", "Bir Üst Seviyeye")}
            {field("Vurgulu satır (turkuaz)", "titleAccent", "Geç.")}
          </div>
          <div><label className="text-xs font-bold text-slate-500">Açıklama</label>
            <textarea rows={3} maxLength={600} className={inp} value={f.subtitle ?? ""} onChange={(e) => set({ subtitle: e.target.value })} /></div>
          <div className="grid sm:grid-cols-2 gap-3">
            {field("Ana buton metni", "cta1Text", "E-KİTAPLARI İNCELE", 60)}
            {field("Ana buton bağlantısı", "cta1Url", "/e-kitaplar", 300)}
            {field("İkinci buton metni", "cta2Text", "", 60)}
            {field("İkinci buton bağlantısı", "cta2Url", "", 300)}
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {field("Görsel bağlantısı (Medya Kütüphanesi ya da /hero/…)", "imageUrl", "https://… veya /hero/kurs.png", 500)}
            {field("Görsel üstü rozet", "imageBadge", "Canlı Ders Devam Ediyor")}
          </div>
          <div>
            {field("Video bağlantısı (isteğe bağlı, sessiz döngü; görsel kapak olarak kalır)", "videoUrl", "/hero/kurs.mp4", 500)}
            <p className="text-[11px] text-slate-400 mt-1">Dikey (3:4) kısa MP4. Hareketi azaltma ayarı açık ziyaretçilere yalnızca görsel gösterilir.</p>
          </div>
          {field("Görsel açıklaması (erişilebilirlik)", "imageAlt", "", 200)}
          <div className="grid sm:grid-cols-2 gap-3">
            <div><label className="text-xs font-bold text-slate-500">Başlangıç (boşsa hemen)</label>
              <input type="datetime-local" className={inp} value={toLocal(f.startsAt)} onChange={(e) => set({ startsAt: fromLocal(e.target.value) })} /></div>
            <div><label className="text-xs font-bold text-slate-500">Bitiş (boşsa süresiz)</label>
              <input type="datetime-local" className={inp} value={toLocal(f.endsAt)} onChange={(e) => set({ endsAt: fromLocal(e.target.value) })} /></div>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={!!f.isActive} onChange={(e) => set({ isActive: e.target.checked })} /> Yayında</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={!!f.useCampaign} onChange={(e) => set({ useCampaign: e.target.checked })} /> Kampanyayı öne çıkar</label>
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
