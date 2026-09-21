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

type ContentType = "vocab" | "scene" | "reading";
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

  const availableCategories = type === "scene" ? SCENE_CATEGORIES : VOCAB_CATEGORIES;

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
                setCategory(t === "scene" ? "general_business" : "business_general");
              }}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
              disabled={generating}
            >
              <option value="vocab">Vocab (Kelime)</option>
              <option value="scene">Speaking Scene (Sahne)</option>
              <option value="reading">Reading Article (Makale)</option>
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
              max={type === "scene" ? 1 : type === "reading" ? 10 : 50}
              value={count}
              onChange={(e) => setCount(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
              disabled={generating || type === "scene"}
            />
            <p className="text-[10px] text-slate-400 mt-0.5">
              {type === "scene" ? "Sahne için tek üretim" : type === "reading" ? "Maks 10" : "Maks 50"}
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
    </div>
  );
}
