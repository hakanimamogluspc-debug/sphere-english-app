import { useEffect, useMemo, useState } from "react";
import {
  Mic, Loader2, RefreshCw, Sparkles, Check, X, Search,
  Plus, Trash2, Edit3, PlayCircle, MessageSquare, Zap,
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

const CATEGORIES = [
  "general_business", "meetings", "sales", "negotiation", "presentations",
  "phone_calls", "tech", "hr", "finance", "healthcare",
];
const CAT_LABEL: Record<string, string> = {
  general_business: "Genel İş", meetings: "Toplantılar", sales: "Satış",
  negotiation: "Müzakere", presentations: "Sunumlar", phone_calls: "Telefon",
  tech: "Teknoloji", hr: "İK", finance: "Finans", healthcare: "Sağlık",
};
const DIFFICULTIES = ["A2", "B1", "B2", "C1"];
const VOICES = ["nova", "onyx", "shimmer", "echo", "alloy", "fable"];

type Scene = {
  id: number;
  slug: string;
  category: string;
  title_en: string;
  title_tr: string;
  description_tr: string;
  user_role_tr: string;
  counterpart_role_tr: string;
  difficulty: string;
  min_plan: string;
  avg_duration_min: number;
  voice: string;
  is_active: boolean;
  sort_order: number;
  turn_count: number;
};

type Turn = {
  id: number;
  turn_order: number;
  speaker: "user" | "ai";
  text_en: string;
  text_tr: string | null;
  notes_tr: string | null;
  phonetic_hint: string | null;
};

export default function AdminScenes() {
  const [tab, setTab] = useState<"list" | "stats">("list");
  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2 text-gray-900">
            <Mic className="h-7 w-7 text-indigo-600" />
            Konuşma Sahneleri
          </h1>
          <p className="text-sm text-gray-500 mt-1">Sahne kütüphanesi — AI ile üret, düzenle, yayınla.</p>
        </div>
      </header>

      <div className="flex gap-1 border-b border-gray-200">
        {[{ v: "list", l: "Sahneler", icon: MessageSquare },
          { v: "stats", l: "Kategori Durumu", icon: Zap }].map((t: any) => (
          <button key={t.v} onClick={() => setTab(t.v)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px ${
              tab === t.v ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-900"
            }`}
          >
            <t.icon className="h-4 w-4" /> {t.l}
          </button>
        ))}
      </div>

      {tab === "list" ? <ListTab /> : <StatsTab />}
    </div>
  );
}

// ─── STATS TAB ─────────────────────────────────────────────────
function StatsTab() {
  const [stats, setStats] = useState<Array<{ category: string; difficulty: string; is_active: boolean; n: number }>>([]);
  const [target, setTarget] = useState(10);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  async function load() {
    try { const d = await apiFetch("/admin/scenes/stats"); setStats(d.stats ?? []); }
    catch (e: any) { alert(e?.message); }
  }
  useEffect(() => { load(); }, []);

  const matrix = useMemo(() => {
    const m: Record<string, Record<string, { active: number; inactive: number }>> = {};
    for (const c of CATEGORIES) {
      m[c] = {};
      for (const d of DIFFICULTIES) m[c][d] = { active: 0, inactive: 0 };
    }
    for (const s of stats) {
      if (!m[s.category] || !m[s.category][s.difficulty]) continue;
      if (s.is_active) m[s.category][s.difficulty].active = s.n;
      else m[s.category][s.difficulty].inactive = s.n;
    }
    return m;
  }, [stats]);

  async function bulkFillAll() {
    if (!confirm(`Her kategori için en az ${target} sahne olacak şekilde AI ile üretilsin mi?\n\nBu ~${target * 10} sahne = birkaç dakika sürebilir ve GPT maliyet üretir.`)) return;
    setRunning(true);
    setLog(["Bulk fill başlıyor... (bu 3-5 dk sürebilir, sayfayı kapatma)"]);
    try {
      const r = await apiFetch("/admin/scenes/bulk-fill", {
        method: "POST",
        body: JSON.stringify({ targetPerCategory: target }),
      });
      setLog(prev => [...prev,
        `✓ Toplam üretilen: ${r.totalCreated}, başarısız: ${r.totalFailed}`,
        ...Object.entries(r.result).map(([k, v]: any) => `  ${k}: +${v.created} (${v.failed} hata)`),
      ]);
      load();
    } catch (e: any) {
      setLog(prev => [...prev, `HATA: ${e?.message}`]);
    } finally {
      setRunning(false);
    }
  }

  async function bulkFillCategory(cat: string) {
    if (!confirm(`${CAT_LABEL[cat] || cat} için en az ${target} sahne olacak şekilde üretilsin mi?`)) return;
    setRunning(true);
    setLog([`${cat} bulk fill başladı...`]);
    try {
      const r = await apiFetch("/admin/scenes/bulk-fill", {
        method: "POST",
        body: JSON.stringify({ targetPerCategory: target, category: cat }),
      });
      const info = r[cat];
      setLog(prev => [...prev, `✓ ${cat}: +${info?.created ?? 0} yeni (${info?.failed ?? 0} hata)`]);
      load();
    } catch (e: any) {
      setLog(prev => [...prev, `HATA: ${e?.message}`]);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border p-4 flex items-center gap-3 flex-wrap">
        <label className="text-sm font-semibold text-gray-700">Hedef sayı / kategori:</label>
        <input type="number" min={1} max={20} value={target} onChange={(e) => setTarget(Number(e.target.value))}
          className="w-20 rounded border-gray-300 px-3 py-1.5 text-sm" />
        <div className="flex-1" />
        <button onClick={bulkFillAll} disabled={running}
          className="rounded bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 text-sm font-medium disabled:opacity-50 inline-flex items-center gap-2">
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Tüm Kategoriler için AI ile Üret
        </button>
        <button onClick={load} className="rounded border border-gray-300 px-3 py-2 hover:bg-gray-50">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      <div className="overflow-x-auto bg-white rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-600">
            <tr>
              <th className="text-left px-4 py-2">Kategori</th>
              {DIFFICULTIES.map(d => <th key={d} className="text-center px-4 py-2">{d}</th>)}
              <th className="text-center px-4 py-2">Toplam</th>
              <th className="text-right px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {CATEGORIES.map(cat => {
              const cells = DIFFICULTIES.map(d => matrix[cat][d]);
              const total = cells.reduce((s, c) => s + c.active + c.inactive, 0);
              const activeTotal = cells.reduce((s, c) => s + c.active, 0);
              return (
                <tr key={cat}>
                  <td className="px-4 py-2 font-semibold">{CAT_LABEL[cat] || cat}</td>
                  {cells.map((c, i) => {
                    const totalN = c.active + c.inactive;
                    return (
                      <td key={i} className="text-center px-4 py-2">
                        {totalN === 0 ? (
                          <span className="text-gray-400">—</span>
                        ) : (
                          <span title={`${c.active} yayında, ${c.inactive} taslak`}>
                            <span className="text-emerald-700 font-semibold">{c.active}</span>
                            {c.inactive > 0 && <span className="text-gray-400"> / {c.active + c.inactive}</span>}
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td className="text-center px-4 py-2 font-bold text-gray-900">
                    <span className="text-emerald-700">{activeTotal}</span>
                    {total !== activeTotal && <span className="text-gray-400">/{total}</span>}
                  </td>
                  <td className="text-right px-4 py-2">
                    <button onClick={() => bulkFillCategory(cat)} disabled={running}
                      className="rounded bg-violet-50 hover:bg-violet-100 text-violet-700 px-2 py-1 text-xs font-medium disabled:opacity-50 inline-flex items-center gap-1">
                      <Sparkles className="h-3 w-3" /> Üret
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {log.length > 0 && (
        <div className="bg-gray-900 text-gray-100 rounded-xl p-4 font-mono text-xs max-h-64 overflow-y-auto">
          {log.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}
    </div>
  );
}

// ─── LIST TAB ─────────────────────────────────────────────────
function ListTab() {
  const [category, setCategory] = useState("all");
  const [difficulty, setDifficulty] = useState("all");
  const [active, setActive] = useState("all");
  const [q, setQ] = useState("");
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [genOpen, setGenOpen] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const p = new URLSearchParams({ category, difficulty, active, q });
      const d = await apiFetch(`/admin/scenes?${p}`);
      setScenes(d.scenes ?? []);
    } catch (e: any) { alert(e?.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [category, difficulty, active, q]);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border p-3 flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Slug/başlık ara..."
            className="w-full rounded border-gray-300 pl-9 pr-3 py-2 text-sm" />
        </div>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded border-gray-300 px-3 py-2 text-sm">
          <option value="all">Tüm Kategoriler</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{CAT_LABEL[c] || c}</option>)}
        </select>
        <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="rounded border-gray-300 px-3 py-2 text-sm">
          <option value="all">Tüm Seviyeler</option>
          {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={active} onChange={(e) => setActive(e.target.value)} className="rounded border-gray-300 px-3 py-2 text-sm">
          <option value="all">Tümü</option>
          <option value="active">Yayında</option>
          <option value="inactive">Taslak</option>
        </select>
        <button onClick={load} className="rounded border border-gray-300 p-2 hover:bg-gray-50">
          <RefreshCw className="h-4 w-4" />
        </button>
        <div className="flex-1" />
        <span className="text-sm text-gray-500">{scenes.length} sahne</span>
        <button onClick={() => setGenOpen(true)}
          className="rounded bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 text-sm font-medium inline-flex items-center gap-1">
          <Sparkles className="h-4 w-4" /> AI ile Sahne Üret
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16"><Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-400" /></div>
      ) : scenes.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border text-gray-500 text-sm">Sahne yok</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {scenes.map(s => <SceneCard key={s.id} scene={s} onClick={() => setSelectedId(s.id)} />)}
        </div>
      )}

      {selectedId && <SceneEditor sceneId={selectedId} onClose={() => setSelectedId(null)} onChanged={() => { setSelectedId(null); load(); }} />}
      {genOpen && <GenerateModal onClose={() => setGenOpen(false)} onDone={() => { setGenOpen(false); load(); }} />}
    </div>
  );
}

function SceneCard({ scene, onClick }: { scene: Scene; onClick: () => void }) {
  return (
    <div onClick={onClick} className="bg-white rounded-lg border p-4 cursor-pointer hover:border-indigo-400 hover:shadow transition">
      <div className="flex items-center gap-2 mb-2 text-xs">
        <span className={`inline-flex px-2 py-0.5 rounded-full font-semibold ${scene.is_active ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
          {scene.is_active ? "Yayında" : "Taslak"}
        </span>
        <span className="inline-flex px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-semibold">{scene.difficulty}</span>
        <span className="inline-flex px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">{CAT_LABEL[scene.category] || scene.category}</span>
        <span className="text-gray-400">·</span>
        <span className="text-gray-500">{scene.min_plan}</span>
        <span className="ml-auto text-gray-500">{scene.turn_count} tur · {scene.avg_duration_min} dk</span>
      </div>
      <h3 className="font-semibold text-gray-900 text-sm">{scene.title_tr}</h3>
      <p className="text-xs text-gray-600 mt-0.5 italic">{scene.title_en}</p>
      {scene.description_tr && <p className="text-xs text-gray-500 mt-2 line-clamp-2">{scene.description_tr}</p>}
      <div className="text-[10px] text-gray-400 mt-1 font-mono">{scene.slug}</div>
    </div>
  );
}

function SceneEditor({ sceneId, onClose, onChanged }: { sceneId: number; onClose: () => void; onChanged: () => void }) {
  const [scene, setScene] = useState<any>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({});

  async function load() {
    setLoading(true);
    try {
      const d = await apiFetch(`/admin/scenes/${sceneId}`);
      setScene(d.scene);
      setTurns(d.turns);
      setForm(d.scene);
    } catch (e: any) { alert(e?.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [sceneId]);

  async function save() {
    setSaving(true);
    try {
      await apiFetch(`/admin/scenes/${sceneId}`, {
        method: "PATCH",
        body: JSON.stringify({
          title_en: form.title_en, title_tr: form.title_tr, description_tr: form.description_tr,
          user_role_tr: form.user_role_tr, counterpart_role_tr: form.counterpart_role_tr,
          difficulty: form.difficulty, min_plan: form.min_plan,
          avg_duration_min: form.avg_duration_min, voice: form.voice,
          is_active: form.is_active, category: form.category,
        }),
      });
      onChanged();
    } catch (e: any) { alert(e?.message); }
    finally { setSaving(false); }
  }

  async function togglePublish() {
    setSaving(true);
    try {
      await apiFetch(`/admin/scenes/${sceneId}`, {
        method: "PATCH", body: JSON.stringify({ is_active: !form.is_active }),
      });
      setForm({ ...form, is_active: !form.is_active });
    } catch (e: any) { alert(e?.message); }
    finally { setSaving(false); }
  }

  async function del() {
    if (!confirm("Bu sahneyi silmek istediğine emin misin? Turlar da silinecek.")) return;
    setSaving(true);
    try {
      await apiFetch(`/admin/scenes/${sceneId}`, { method: "DELETE" });
      onChanged();
    } catch (e: any) { alert(e?.message); }
    finally { setSaving(false); }
  }

  async function updateTurn(t: Turn, patch: Partial<Turn>) {
    try {
      await apiFetch(`/admin/scenes/turns/${t.id}`, { method: "PATCH", body: JSON.stringify(patch) });
      setTurns(prev => prev.map(x => x.id === t.id ? { ...x, ...patch } : x));
    } catch (e: any) { alert(e?.message); }
  }

  async function deleteTurn(id: number) {
    if (!confirm("Bu tur silinsin mi?")) return;
    try {
      await apiFetch(`/admin/scenes/turns/${id}`, { method: "DELETE" });
      setTurns(prev => prev.filter(x => x.id !== id));
    } catch (e: any) { alert(e?.message); }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <div className="h-full w-full max-w-4xl overflow-y-auto bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-5 py-3">
          <h3 className="text-lg font-semibold">Sahne Düzenle</h3>
          <div className="flex items-center gap-2">
            <button onClick={togglePublish} disabled={saving}
              className={`rounded px-3 py-1.5 text-sm font-medium inline-flex items-center gap-1 disabled:opacity-50 ${
                form.is_active ? "bg-amber-100 text-amber-700 hover:bg-amber-200" : "bg-emerald-600 hover:bg-emerald-500 text-white"
              }`}
            >
              {form.is_active ? "Taslağa Al" : <><Check className="h-4 w-4" /> Yayınla</>}
            </button>
            <button onClick={del} disabled={saving} className="rounded p-1.5 text-red-600 hover:bg-red-50">
              <Trash2 className="h-4 w-4" />
            </button>
            <button onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
          </div>
        </div>
        {loading || !scene ? (
          <div className="p-8 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-400" /></div>
        ) : (
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Başlık (TR)" value={form.title_tr} onChange={v => setForm({ ...form, title_tr: v })} />
              <FormField label="Title (EN)" value={form.title_en} onChange={v => setForm({ ...form, title_en: v })} />
            </div>
            <FormField label="Açıklama (TR)" value={form.description_tr} onChange={v => setForm({ ...form, description_tr: v })} textarea />
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Senin Rolün (TR)" value={form.user_role_tr} onChange={v => setForm({ ...form, user_role_tr: v })} />
              <FormField label="Karşı Taraf (TR)" value={form.counterpart_role_tr} onChange={v => setForm({ ...form, counterpart_role_tr: v })} />
            </div>
            <div className="grid grid-cols-4 gap-3">
              <FormSelect label="Kategori" value={form.category} options={CATEGORIES.map(c => ({ v: c, l: CAT_LABEL[c] || c }))} onChange={v => setForm({ ...form, category: v })} />
              <FormSelect label="Seviye" value={form.difficulty} options={DIFFICULTIES.map(d => ({ v: d, l: d }))} onChange={v => setForm({ ...form, difficulty: v })} />
              <FormSelect label="Plan" value={form.min_plan} options={[{ v: "free", l: "Free" }, { v: "pro", l: "Pro" }]} onChange={v => setForm({ ...form, min_plan: v })} />
              <FormSelect label="Ses" value={form.voice} options={VOICES.map(x => ({ v: x, l: x }))} onChange={v => setForm({ ...form, voice: v })} />
            </div>
            <button onClick={save} disabled={saving} className="rounded bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 text-sm font-medium disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin inline" /> : "Kaydet"}
            </button>

            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <MessageSquare className="h-4 w-4" /> Konuşma Turları ({turns.length})
              </h4>
              <div className="space-y-2">
                {turns.map(t => (
                  <div key={t.id} className={`rounded-lg border-l-4 p-3 ${
                    t.speaker === "ai" ? "border-l-indigo-400 bg-indigo-50" : "border-l-emerald-400 bg-emerald-50"
                  }`}>
                    <div className="flex items-center gap-2 mb-2 text-xs">
                      <span className={`px-2 py-0.5 rounded-full font-semibold ${
                        t.speaker === "ai" ? "bg-indigo-200 text-indigo-800" : "bg-emerald-200 text-emerald-800"
                      }`}>{t.speaker === "ai" ? "AI" : "Sen"}</span>
                      <span className="text-gray-500">Tur {t.turn_order}</span>
                      <button onClick={() => deleteTurn(t.id)} className="ml-auto p-1 text-red-500 hover:bg-white rounded">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                    <input type="text" defaultValue={t.text_en}
                      onBlur={e => e.target.value !== t.text_en && updateTurn(t, { text_en: e.target.value })}
                      className="w-full bg-white rounded border-gray-200 px-2 py-1.5 text-sm font-medium mb-1" />
                    <input type="text" defaultValue={t.text_tr ?? ""}
                      onBlur={e => e.target.value !== (t.text_tr ?? "") && updateTurn(t, { text_tr: e.target.value })}
                      placeholder="Türkçe çeviri"
                      className="w-full bg-white/70 rounded border-gray-200 px-2 py-1 text-xs italic text-gray-700 mb-1" />
                    {(t.notes_tr || t.speaker === "user") && (
                      <input type="text" defaultValue={t.notes_tr ?? ""}
                        onBlur={e => e.target.value !== (t.notes_tr ?? "") && updateTurn(t, { notes_tr: e.target.value })}
                        placeholder="Öğretici not (kalıp/idiom açıklaması)"
                        className="w-full bg-yellow-50 rounded border-yellow-200 px-2 py-1 text-xs text-gray-700" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FormField({ label, value, onChange, textarea }: any) {
  return (
    <div>
      <label className="text-xs font-semibold text-gray-500 mb-1 block">{label}</label>
      {textarea ? (
        <textarea value={value ?? ""} onChange={e => onChange(e.target.value)} rows={2}
          className="w-full rounded border-gray-300 px-3 py-2 text-sm" />
      ) : (
        <input value={value ?? ""} onChange={e => onChange(e.target.value)}
          className="w-full rounded border-gray-300 px-3 py-2 text-sm" />
      )}
    </div>
  );
}
function FormSelect({ label, value, options, onChange }: any) {
  return (
    <div>
      <label className="text-xs font-semibold text-gray-500 mb-1 block">{label}</label>
      <select value={value ?? ""} onChange={e => onChange(e.target.value)}
        className="w-full rounded border-gray-300 px-3 py-2 text-sm">
        {options.map((o: any) => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  );
}

function GenerateModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [category, setCategory] = useState("general_business");
  const [difficulty, setDifficulty] = useState("B1");
  const [topic, setTopic] = useState("");
  const [publish, setPublish] = useState(false);
  const [running, setRunning] = useState(false);

  async function submit() {
    setRunning(true);
    try {
      const r = await apiFetch("/admin/scenes/generate", {
        method: "POST",
        body: JSON.stringify({ category, difficulty, topic: topic || undefined, publish }),
      });
      if (r.ok) { alert(`Sahne üretildi: ${r.slug}`); onDone(); }
      else alert(`Hata: ${r.error}`);
    } catch (e: any) { alert(e?.message); }
    finally { setRunning(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h3 className="text-lg font-semibold flex items-center gap-2"><Sparkles className="h-5 w-5 text-violet-600" /> AI ile Sahne Üret</h3>
          <button onClick={onClose}><X className="h-5 w-5 text-gray-400" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Kategori</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded border-gray-300 px-3 py-2 text-sm">
                {CATEGORIES.map(c => <option key={c} value={c}>{CAT_LABEL[c] || c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Seviye</label>
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="w-full rounded border-gray-300 px-3 py-2 text-sm">
                {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Konu (opsiyonel)</label>
            <input value={topic} onChange={(e) => setTopic(e.target.value)}
              placeholder="Örn: Bütçe onayı isteme, Cold call"
              className="w-full rounded border-gray-300 px-3 py-2 text-sm" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} />
            Üretilir üretilmez yayınla (aksi halde taslak kalır)
          </label>
          <div className="flex gap-2 border-t pt-3">
            <button onClick={onClose} className="rounded border border-gray-300 px-3 py-1.5 text-sm">İptal</button>
            <button onClick={submit} disabled={running}
              className="ml-auto rounded bg-violet-600 hover:bg-violet-500 text-white px-4 py-1.5 text-sm font-medium disabled:opacity-50 inline-flex items-center gap-1">
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Üret
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
