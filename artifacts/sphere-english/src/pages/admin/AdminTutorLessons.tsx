import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  GraduationCap, RefreshCw, Loader2, AlertCircle, X, Plus, Trash2, Eye, EyeOff, Pencil,
  ArrowUp, ArrowDown, Save,
} from "lucide-react";
import { API } from "@/lib/api-url";

/**
 * Admin → Lara Dersleri
 * Lara'nın yürüttüğü sesli derslerin (sahnelerin) kütüphanesi: listele, düzenle, yayımla, istatistik.
 * Düzenlenen bir ders artık açılış seed'iyle ezilmez.
 */

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

const NAVY = "#1e3a6e";
const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const CATEGORIES: Record<string, string> = {
  tanisma: "Tanışma", toplanti: "Toplantı", musteri: "Müşteri", telefon: "Telefon",
  satis: "Satış", sunum: "Sunum", ofis: "Ofis",
};

type Step = { key?: string; goalTr: string; setupTr: string; targets: string[]; hintTr?: string };
interface Lesson {
  id: number; slug: string; title: string; summary: string; category: string; levelMin: string; levelMax: string;
  sectors: string[]; estMinutes: number; introTr: string; outroTr: string; steps: Step[]; isPublished: boolean;
  sortOrder: number; edited: boolean; stats?: { sessions: number; completed: number; avgCorrections: number };
}
interface Overview {
  totals: { sessions: number; completed: number; learners: number; turns: number; voice_turns: number; corrections: number; personal: number };
  dropOffs: { title: string; step: number; n: number }[];
}

const emptyLesson = (): Omit<Lesson, "id" | "edited"> => ({
  slug: "", title: "", summary: "", category: "ofis", levelMin: "A2", levelMax: "C1", sectors: [], estMinutes: 6,
  introTr: "", outroTr: "", isPublished: false, sortOrder: 100,
  steps: [{ goalTr: "", setupTr: "", targets: [""], hintTr: "" }],
});

export default function AdminTutorLessons() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<(Omit<Lesson, "id" | "edited"> & { id?: number }) | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [l, o] = await Promise.all([apiFetch("/admin/tutor-lessons"), apiFetch("/admin/tutor-lessons/overview")]);
      setLessons(l.lessons);
      setOverview(o);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const togglePublish = async (l: Lesson) => {
    try {
      await apiFetch(`/admin/tutor-lessons/${l.id}`, { method: "PATCH", body: JSON.stringify({ isPublished: !l.isPublished }) });
      load();
    } catch (e: any) { setError(e.message); }
  };

  const remove = async (l: Lesson) => {
    if (!confirm(`"${l.title}" silinsin mi? Geçmiş oturumlar korunur.`)) return;
    try {
      await apiFetch(`/admin/tutor-lessons/${l.id}`, { method: "DELETE" });
      load();
    } catch (e: any) { setError(e.message); }
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    setError(null);
    const body = {
      ...editing,
      steps: editing.steps.map((s) => ({ ...s, targets: s.targets.map((t) => t.trim()).filter(Boolean) })),
    };
    try {
      if (editing.id) {
        await apiFetch(`/admin/tutor-lessons/${editing.id}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await apiFetch(`/admin/tutor-lessons`, { method: "POST", body: JSON.stringify(body) });
      }
      setEditing(null);
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const t = overview?.totals;
  const rate = t && t.sessions ? Math.round((t.completed / t.sessions) * 100) : 0;

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: NAVY }}>
            <GraduationCap size={24} /> Lara Dersleri
          </h1>
          <p className="text-sm text-slate-500">AI öğretmen Lara'nın yürüttüğü sesli, adım adım derslerin kütüphanesi.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50" aria-label="Yenile"><RefreshCw size={16} /></button>
          <button onClick={() => setEditing(emptyLesson())} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-white text-sm font-semibold" style={{ background: NAVY }}>
            <Plus size={15} /> Yeni ders
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-rose-50 text-rose-700 text-sm px-3 py-2 flex items-center gap-2">
          <AlertCircle size={15} /> <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)}><X size={14} /></button>
        </div>
      )}

      {t && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Kpi label="Oturum (30 gün)" value={t.sessions} />
          <Kpi label="Tamamlanma" value={`%${rate}`} />
          <Kpi label="Öğrenci" value={t.learners} />
          <Kpi label="Sesli tur" value={t.voice_turns} />
          <Kpi label="Düzeltme" value={t.corrections} />
        </div>
      )}

      {overview && overview.dropOffs.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold mb-2" style={{ color: NAVY }}>En çok yarım bırakılan adımlar</p>
          <ul className="text-sm text-slate-600 space-y-1">
            {overview.dropOffs.map((d, i) => (
              <li key={i}>{d.title} — adım {d.step + 1}: <strong>{d.n}</strong> kişi bıraktı</li>
            ))}
          </ul>
        </div>
      )}

      {loading ? (
        <div className="py-16 flex justify-center text-slate-400"><Loader2 className="animate-spin" /></div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-3 py-2">Ders</th>
                <th className="text-left px-3 py-2">Seviye</th>
                <th className="text-right px-3 py-2">Adım</th>
                <th className="text-right px-3 py-2">Oturum / Bitiren</th>
                <th className="text-right px-3 py-2">Ort. düzeltme</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {lessons.map((l) => (
                <tr key={l.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">
                    <p className="font-semibold" style={{ color: NAVY }}>{l.title}</p>
                    <p className="text-xs text-slate-400">
                      {CATEGORIES[l.category] ?? l.category}
                      {l.sectors.length > 0 && ` · ${l.sectors.join(", ")}`}
                      {l.edited && " · düzenlendi"}
                      {!l.isPublished && " · taslak"}
                    </p>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{l.levelMin}–{l.levelMax}</td>
                  <td className="px-3 py-2 text-right">{l.steps.length}</td>
                  <td className="px-3 py-2 text-right">{l.stats?.sessions ?? 0} / {l.stats?.completed ?? 0}</td>
                  <td className="px-3 py-2 text-right">{l.stats?.avgCorrections ?? 0}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => togglePublish(l)} className="p-1.5 rounded hover:bg-slate-100 text-slate-500" title={l.isPublished ? "Yayından kaldır" : "Yayımla"}>
                        {l.isPublished ? <Eye size={15} /> : <EyeOff size={15} />}
                      </button>
                      <button onClick={() => setEditing({ ...l })} className="p-1.5 rounded hover:bg-slate-100 text-slate-500" title="Düzenle"><Pencil size={15} /></button>
                      <button onClick={() => remove(l)} className="p-1.5 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600" title="Sil"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <Editor value={editing} onChange={setEditing} onCancel={() => setEditing(null)} onSave={save} saving={saving} />
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-xl font-bold" style={{ color: NAVY }}>{value}</p>
    </div>
  );
}

type Editable = Omit<Lesson, "id" | "edited"> & { id?: number };

function Editor({ value, onChange, onCancel, onSave, saving }: {
  value: Editable; onChange: (v: Editable) => void; onCancel: () => void; onSave: () => void; saving: boolean;
}) {
  const set = <K extends keyof Editable>(k: K, v: Editable[K]) => onChange({ ...value, [k]: v });
  const setStep = (i: number, patch: Partial<Step>) =>
    set("steps", value.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const moveStep = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= value.steps.length) return;
    const arr = [...value.steps];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    set("steps", arr);
  };
  const input = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2";

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex justify-end" onClick={onCancel}>
      <div className="w-full max-w-3xl h-full bg-white overflow-y-auto p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold" style={{ color: NAVY }}>{value.id ? "Dersi düzenle" : "Yeni ders"}</h2>
          <button onClick={onCancel} className="p-1.5 rounded hover:bg-slate-100"><X size={18} /></button>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Başlık"><input className={input} value={value.title} onChange={(e) => set("title", e.target.value)} /></Field>
          <Field label="Kısa ad (slug, boşsa başlıktan)"><input className={input} value={value.slug} onChange={(e) => set("slug", e.target.value)} /></Field>
          <Field label="Özet" wide><input className={input} value={value.summary} onChange={(e) => set("summary", e.target.value)} /></Field>
          <Field label="Kategori">
            <select className={input} value={value.category} onChange={(e) => set("category", e.target.value)}>
              {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Seviye aralığı">
            <div className="flex gap-2">
              <select className={input} value={value.levelMin} onChange={(e) => set("levelMin", e.target.value)}>
                {LEVELS.map((l) => <option key={l}>{l}</option>)}
              </select>
              <select className={input} value={value.levelMax} onChange={(e) => set("levelMax", e.target.value)}>
                {LEVELS.map((l) => <option key={l}>{l}</option>)}
              </select>
            </div>
          </Field>
          <Field label="Sektörler (virgülle; boş = herkes)">
            <input className={input} value={value.sectors.join(", ")} onChange={(e) => set("sectors", e.target.value.split(",").map((x) => x.trim()).filter(Boolean))} />
          </Field>
          <Field label="Süre (dk) / Sıra">
            <div className="flex gap-2">
              <input type="number" className={input} value={value.estMinutes} onChange={(e) => set("estMinutes", Number(e.target.value))} />
              <input type="number" className={input} value={value.sortOrder} onChange={(e) => set("sortOrder", Number(e.target.value))} />
            </div>
          </Field>
          <Field label="Lara'nın açılışı (sesli okunur; selamdan sonra)" wide>
            <textarea rows={2} className={input} value={value.introTr} onChange={(e) => set("introTr", e.target.value)} />
          </Field>
          <Field label="Kapanış" wide>
            <textarea rows={2} className={input} value={value.outroTr} onChange={(e) => set("outroTr", e.target.value)} />
          </Field>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold" style={{ color: NAVY }}>Adımlar</p>
          {value.steps.map((s, i) => (
            <div key={i} className="rounded-xl border border-slate-200 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">Adım {i + 1}</span>
                <div className="ml-auto flex gap-1">
                  <button onClick={() => moveStep(i, -1)} className="p-1 rounded hover:bg-slate-100"><ArrowUp size={14} /></button>
                  <button onClick={() => moveStep(i, 1)} className="p-1 rounded hover:bg-slate-100"><ArrowDown size={14} /></button>
                  <button onClick={() => set("steps", value.steps.filter((_, j) => j !== i))} className="p-1 rounded hover:bg-rose-50 text-rose-500"><Trash2 size={14} /></button>
                </div>
              </div>
              <Field label="Görev (ekranda görünür)"><input className={input} value={s.goalTr} onChange={(e) => setStep(i, { goalTr: e.target.value })} /></Field>
              <Field label="Kurgu (Lara sesli okur)"><textarea rows={2} className={input} value={s.setupTr} onChange={(e) => setStep(i, { setupTr: e.target.value })} /></Field>
              <Field label="Hedef İngilizce cümleler (her satıra bir tane; ilki örnek doğru cevap)">
                <textarea rows={2} className={input} value={s.targets.join("\n")} onChange={(e) => setStep(i, { targets: e.target.value.split("\n") })} />
              </Field>
              <Field label="İpucu"><input className={input} value={s.hintTr ?? ""} onChange={(e) => setStep(i, { hintTr: e.target.value })} /></Field>
            </div>
          ))}
          {value.steps.length < 8 && (
            <button
              onClick={() => set("steps", [...value.steps, { goalTr: "", setupTr: "", targets: [""], hintTr: "" }])}
              className="inline-flex items-center gap-1.5 text-sm font-semibold"
              style={{ color: "#0e7da6" }}
            >
              <Plus size={14} /> Adım ekle
            </button>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={value.isPublished} onChange={(e) => set("isPublished", e.target.checked)} /> Yayında
        </label>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg border border-slate-200 text-sm">Vazgeç</button>
          <button onClick={onSave} disabled={saving} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50" style={{ background: NAVY }}>
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`block ${wide ? "sm:col-span-2" : ""}`}>
      <span className="block text-xs font-semibold text-slate-500 mb-1">{label}</span>
      {children}
    </label>
  );
}
