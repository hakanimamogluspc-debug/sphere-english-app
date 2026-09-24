import { useState } from "react";
import { API } from "@/lib/api-url";
import {
  Sparkles,
  RefreshCw,
  Check,
  X,
  Upload,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Layers,
  Zap,
} from "lucide-react";

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

type ContentType = "vocab" | "scene" | "reading" | "business_card";
type Cefr = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

const CEFR_LEVELS: Cefr[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

const VOCAB_CATEGORIES = [
  "business_general",
  "meetings",
  "emails",
  "sales",
  "negotiation",
  "presentations",
  "phone_calls",
  "hr",
  "finance",
  "tech",
  "customer_service",
  "everyday",
];

const SCENE_CATEGORIES = [
  "general_business",
  "meetings",
  "sales",
  "negotiation",
  "presentations",
  "phone_calls",
  "tech",
  "hr",
  "finance",
  "healthcare",
];

const CARD_CATEGORIES = [
  "meetings",
  "emails",
  "phone_calls",
  "presentations",
  "sales",
  "interview",
  "self_intro",
  "customer_service",
  "business_general",
  "everyday",
  "vocabulary_expansion",
];

interface GeneratedItem {
  _approved?: boolean;
  _expanded?: boolean;
  [k: string]: any;
}

/**
 * Admin — AI Content Generator
 *
 * Retention için hızlı içerik üretim aracı.
 * Anthropic Claude Sonnet ile vocab/scene/reading üret,
 * preview'de gör, approve edilenleri DB'ye import et.
 */
export default function AdminAIContentGenerator() {
  const [type, setType] = useState<ContentType>("vocab");
  const [level, setLevel] = useState<Cefr>("B1");
  const [count, setCount] = useState(20);
  const [category, setCategory] = useState("business_general");
  const [items, setItems] = useState<GeneratedItem[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<any>(null);

  const availableCategories =
    type === "scene" ? SCENE_CATEGORIES : type === "business_card" ? CARD_CATEGORIES : VOCAB_CATEGORIES;

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    setImportResult(null);
    try {
      const data = await apiFetch("/admin/ai-content/generate", {
        method: "POST",
        body: JSON.stringify({ type, level, count, category }),
      });
      const newItems = (data.items ?? []).map((it: any) => ({ ...it, _approved: true, _expanded: false }));
      setItems(newItems);
      setWarnings(data.warnings ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Üretim başarısız");
    } finally {
      setGenerating(false);
    }
  };

  const handleImport = async () => {
    const approved = items.filter((it) => it._approved);
    if (approved.length === 0) {
      setError("Onaylanan öğe yok. En az bir öğeyi onayla.");
      return;
    }
    setImporting(true);
    setError(null);
    try {
      const cleanedItems = approved.map(({ _approved: _a, _expanded: _e, ...rest }) => rest);
      const data = await apiFetch("/admin/ai-content/import", {
        method: "POST",
        body: JSON.stringify({ type, items: cleanedItems }),
      });
      setImportResult(data);
      // Import sonrası itemsları temizle
      if (data.imported > 0) {
        setItems([]);
      }
    } catch (e: any) {
      setError(e?.message ?? "Import başarısız");
    } finally {
      setImporting(false);
    }
  };

  const toggleApprove = (idx: number) => {
    setItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, _approved: !it._approved } : it)),
    );
  };

  const toggleExpand = (idx: number) => {
    setItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, _expanded: !it._expanded } : it)),
    );
  };

  const approveAll = () => setItems((prev) => prev.map((it) => ({ ...it, _approved: true })));
  const rejectAll = () => setItems((prev) => prev.map((it) => ({ ...it, _approved: false })));

  const approvedCount = items.filter((it) => it._approved).length;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <Sparkles className="text-indigo-500" size={22} />
          AI İçerik Üretici
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Anthropic Claude ile vocab, konuşma sahnesi ve okuma parçası üret. Preview&apos;de gözden geçir,
          onaylananları DB&apos;ye import et.
        </p>
      </div>

      {/* Form */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Tür</label>
            <select
              value={type}
              onChange={(e) => {
                const t = e.target.value as ContentType;
                setType(t);
                setCategory(t === "scene" ? "general_business" : t === "business_card" ? "meetings" : "business_general");
              }}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
              disabled={generating}
            >
              <option value="vocab">Vocab (Kelime)</option>
              <option value="scene">Speaking Scene (Sahne)</option>
              <option value="reading">Reading Article (Makale)</option>
              <option value="business_card">İş Kartı (Business Card)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Seviye</label>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value as Cefr)}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
              disabled={generating}
            >
              {CEFR_LEVELS.map((lvl) => (
                <option key={lvl} value={lvl}>{lvl}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Kategori</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
              disabled={generating}
            >
              {availableCategories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Adet</label>
            <input
              type="number"
              min={1}
              max={type === "scene" ? 1 : type === "reading" ? 10 : type === "business_card" ? 30 : 50}
              value={count}
              onChange={(e) => setCount(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
              disabled={generating || type === "scene"}
            />
            <p className="text-[10px] text-slate-400 mt-0.5">
              {type === "scene"
                ? "Sahne için tek üretim"
                : type === "reading"
                ? "Maks 10"
                : type === "business_card"
                ? "Maks 30"
                : "Maks 50"}
            </p>
          </div>
          <div>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold disabled:bg-slate-300"
            >
              {generating ? (
                <>
                  <RefreshCw size={14} className="animate-spin" /> Üretiliyor…
                </>
              ) : (
                <>
                  <Sparkles size={14} /> Üret
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Hata / Uyarı */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">{error}</div>
      )}
      {warnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
          {warnings.map((w, i) => (
            <div key={i} className="text-sm text-amber-700 flex items-start gap-2">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {w}
            </div>
          ))}
        </div>
      )}
      {importResult && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 mb-4 text-sm text-emerald-800">
          ✅ Import tamamlandı: <strong>{importResult.imported}</strong> yeni öğe eklendi.
          {importResult.skipped > 0 && (
            <> {importResult.skipped} atlandı (duplicate veya eksik alan).</>
          )}
        </div>
      )}

      {/* Preview list */}
      {items.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-slate-600">
              <strong>{approvedCount}</strong> / {items.length} öğe onaylandı
            </div>
            <div className="flex gap-2">
              <button
                onClick={approveAll}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-900"
              >
                Hepsini Onayla
              </button>
              <span className="text-slate-300">·</span>
              <button
                onClick={rejectAll}
                className="text-xs font-semibold text-red-600 hover:text-red-800"
              >
                Hepsini Reddet
              </button>
            </div>
          </div>

          <div className="space-y-2 mb-6">
            {items.map((it, idx) => (
              <div
                key={idx}
                className={`border rounded-lg overflow-hidden ${
                  it._approved ? "border-emerald-200 bg-emerald-50/40" : "border-slate-200 bg-white opacity-60"
                }`}
              >
                <div className="flex items-center gap-3 px-4 py-3">
                  <button
                    onClick={() => toggleApprove(idx)}
                    className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
                      it._approved
                        ? "bg-emerald-500 text-white hover:bg-emerald-600"
                        : "bg-slate-200 text-slate-500 hover:bg-slate-300"
                    }`}
                    title={it._approved ? "Onaylı" : "Onaylı değil"}
                  >
                    {it._approved ? <Check size={14} /> : <X size={14} />}
                  </button>
                  <button
                    onClick={() => toggleExpand(idx)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    {it._expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    {type === "vocab" && (
                      <div className="flex items-center gap-3">
                        <strong className="text-slate-900">{it.word}</strong>
                        <span className="text-slate-400">→</span>
                        <span className="text-slate-700">{it.turkish}</span>
                        <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 uppercase font-semibold">
                          {it.level}
                        </span>
                      </div>
                    )}
                    {type === "scene" && (
                      <div>
                        <strong className="text-slate-900">{it.title_en}</strong>
                        <span className="text-slate-400 mx-2">·</span>
                        <span className="text-slate-600 text-sm">{it.title_tr}</span>
                      </div>
                    )}
                    {type === "reading" && (
                      <div>
                        <strong className="text-slate-900">{it.title}</strong>
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 uppercase font-semibold">
                          {it.cefr_level}
                        </span>
                      </div>
                    )}
                    {type === "business_card" && (
                      <div className="flex items-center gap-3">
                        <strong className="text-slate-900 truncate">{it.phrase_en}</strong>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-600 text-xs truncate">{it.category}</span>
                        <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 uppercase font-semibold">
                          {it.level}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {it._expanded && (
                  <div className="px-4 pb-4 border-t border-slate-100 bg-white/60">
                    <pre className="text-xs text-slate-700 bg-slate-50 rounded p-3 mt-3 overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(
                        (({ _approved: _a, _expanded: _e, ...rest }) => rest)(it),
                        null,
                        2,
                      )}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Import button */}
          <div className="sticky bottom-4 flex justify-end">
            <button
              onClick={handleImport}
              disabled={importing || approvedCount === 0}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-lg disabled:bg-slate-300"
            >
              {importing ? (
                <>
                  <RefreshCw size={15} className="animate-spin" /> Import ediliyor…
                </>
              ) : (
                <>
                  <Upload size={15} /> {approvedCount} Öğeyi Import Et
                </>
              )}
            </button>
          </div>
        </>
      )}

      {items.length === 0 && !generating && !importResult && (
        <div className="text-center py-16 text-slate-400 text-sm">
          Üretmek istediğin içerik türü + seviye + kategori seç, üste basın.
        </div>
      )}

      {/* ═══════════════ TOPLU ÜRET ═══════════════ */}
      <BulkGenerator />
    </div>
  );
}

// ─── BulkGenerator ─────────────────────────────────────────────────────────
// Çoklu kategori için tek tıkla üretim + otomatik import.
interface BulkBatch {
  level: string;
  category: string;
  generated: number;
  imported: number;
  skipped: number;
  warnings: string[];
  errors: string[];
}

function BulkGenerator() {
  const [open, setOpen] = useState(false);
  const [bType, setBType] = useState<ContentType>("business_card");
  const [bLevel, setBLevel] = useState<Cefr>("B1");
  const [bCategories, setBCategories] = useState<string[]>([]);
  const [bCount, setBCount] = useState(10);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ totals: any; batches: BulkBatch[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const available =
    bType === "scene" ? SCENE_CATEGORIES : bType === "business_card" ? CARD_CATEGORIES : VOCAB_CATEGORIES;

  const toggleCat = (c: string) => {
    setBCategories((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  };

  const selectAll = () => setBCategories([...available]);
  const clearAll = () => setBCategories([]);

  const run = async () => {
    if (bCategories.length === 0) {
      setError("En az bir kategori seç");
      return;
    }
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const r = await apiFetch("/admin/ai-content/bulk-generate", {
        method: "POST",
        body: JSON.stringify({
          type: bType,
          level: bLevel,
          categories: bCategories,
          countPerCategory: bCount,
          autoImport: true,
        }),
      });
      setResult({ totals: r.totals, batches: r.batches });
    } catch (e: any) {
      setError(e?.message ?? "Bulk üretim başarısız");
    } finally {
      setRunning(false);
    }
  };

  const estimatedMinutes = Math.ceil((bCategories.length * (bType === "vocab" ? 15 : 10)) / 60);

  return (
    <div className="mt-8 border-2 border-dashed border-indigo-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((s) => !s)}
        className="w-full flex items-center justify-between px-4 py-3 bg-indigo-50 hover:bg-indigo-100 text-left"
      >
        <div className="flex items-center gap-2">
          <Layers className="text-indigo-600" size={18} />
          <span className="font-bold text-indigo-900">Toplu Üret</span>
          <span className="text-xs text-indigo-600 font-semibold">
            (birden fazla kategori tek istekte)
          </span>
        </div>
        {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
      </button>

      {open && (
        <div className="p-4 bg-white">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Tür</label>
              <select
                value={bType}
                onChange={(e) => {
                  setBType(e.target.value as ContentType);
                  setBCategories([]);
                }}
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
                disabled={running}
              >
                <option value="vocab">Vocab</option>
                <option value="scene">Scene</option>
                <option value="reading">Reading</option>
                <option value="business_card">İş Kartı</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Seviye</label>
              <select
                value={bLevel}
                onChange={(e) => setBLevel(e.target.value as Cefr)}
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
                disabled={running}
              >
                {CEFR_LEVELS.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                Adet / Kategori
              </label>
              <input
                type="number"
                min={1}
                max={bType === "scene" ? 1 : bType === "business_card" ? 30 : bType === "reading" ? 10 : 50}
                value={bCount}
                onChange={(e) => setBCount(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
                disabled={running || bType === "scene"}
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={run}
                disabled={running || bCategories.length === 0}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold disabled:bg-slate-300"
              >
                {running ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" /> Üretiliyor…
                  </>
                ) : (
                  <>
                    <Zap size={14} /> {bCategories.length} Kategori × {bCount}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Kategori seçici */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                Kategoriler ({bCategories.length}/{available.length})
              </span>
              <div className="flex gap-2">
                <button onClick={selectAll} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">
                  Hepsi
                </button>
                <span className="text-slate-300">·</span>
                <button onClick={clearAll} className="text-xs font-semibold text-slate-500 hover:text-slate-800">
                  Temizle
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
              {available.map((c) => {
                const selected = bCategories.includes(c);
                return (
                  <button
                    key={c}
                    onClick={() => toggleCat(c)}
                    disabled={running}
                    className={`text-xs px-2 py-1.5 rounded-md border font-semibold text-left transition-colors ${
                      selected
                        ? "bg-indigo-100 border-indigo-400 text-indigo-900"
                        : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    {selected && "✓ "}{c}
                  </button>
                );
              })}
            </div>
          </div>

          {bCategories.length > 0 && (
            <div className="text-xs text-slate-500 mb-3">
              📊 Toplam: <strong>{bCategories.length * bCount}</strong> öğe · ~{estimatedMinutes} dakika sürer
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-2 mb-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {running && (
            <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-3 text-sm text-blue-800">
              🚀 Üretim ve import devam ediyor — sekmeyi kapatma. Bu birkaç dakika sürebilir.
            </div>
          )}

          {result && (
            <div className="space-y-3">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                <div className="text-sm font-bold text-emerald-800 mb-1">
                  ✅ {result.totals.imported} yeni öğe import edildi
                </div>
                <div className="text-xs text-emerald-700">
                  {result.totals.batches} batch · {result.totals.generated} üretildi ·
                  {" "}{result.totals.errors} hata
                </div>
              </div>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr className="text-left text-xs text-slate-600 font-semibold uppercase">
                      <th className="px-3 py-2">Kategori</th>
                      <th className="px-3 py-2 text-right">Üretildi</th>
                      <th className="px-3 py-2 text-right">Import</th>
                      <th className="px-3 py-2 text-right">Atlandı</th>
                      <th className="px-3 py-2">Not</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {result.batches.map((b, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-mono text-xs">{b.category}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{b.generated}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-bold text-emerald-700">
                          {b.imported}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-500">
                          {b.skipped}
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-500">
                          {b.errors.length > 0 && (
                            <span className="text-red-600">⚠ {b.errors[0]}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
