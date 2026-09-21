import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AlertTriangle, CheckCircle2, RefreshCw, TrendingUp } from "lucide-react";

/**
 * Admin — İçerik Envanteri
 *
 * CEFR seviye × içerik türü matrisi. Nerede boşluk var, hangi seviye için
 * içerik üretmek gerekli, tek ekranda görün.
 *
 * Endpoint: GET /api/admin/content-inventory
 */

type Cefr = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
const CEFR_LEVELS: Cefr[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

interface InventoryResponse {
  cefr_levels: Cefr[];
  inventory: Record<string, Record<Cefr, number>>;
  targets: Record<string, Record<Cefr, number>>;
  totals: Record<string, number>;
  gaps: Record<string, Record<Cefr, number>>;
  notes: Record<string, string>;
}

const CONTENT_LABELS: Record<string, { label: string; type: "content" | "counter" }> = {
  vocab: { label: "Vocab (Kelimeler)", type: "content" },
  speaking_scenes: { label: "Speaking Scenes", type: "content" },
  reading_articles: { label: "Reading Articles", type: "content" },
  level_exams_taken: { label: "Level Exam Attempts", type: "counter" },
  users_by_level: { label: "Kullanıcı Dağılımı", type: "counter" },
};

export default function AdminContentInventory() {
  const [data, setData] = useState<InventoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/admin/content-inventory");
      setData(res);
    } catch (e: any) {
      setError(e?.message ?? "Envanter yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">İçerik Envanteri</h1>
          <p className="text-sm text-slate-500 mt-1">
            CEFR seviye başına içerik dağılımı. Kırmızı hücreler = hedefe göre eksik.
          </p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          Yenile
        </button>
      </div>

      {loading && !data && (
        <div className="text-center py-12 text-slate-400">Yükleniyor…</div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {data && (
        <>
          {/* Ana matris */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden mb-8">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-bold text-slate-700">İçerik Türü</th>
                  {CEFR_LEVELS.map((lvl) => (
                    <th key={lvl} className="text-center px-4 py-3 font-bold text-slate-700">
                      {lvl}
                    </th>
                  ))}
                  <th className="text-center px-4 py-3 font-bold text-slate-700">Toplam</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(data.inventory).map(([contentKey, byLevel]) => {
                  const meta = CONTENT_LABELS[contentKey] ?? { label: contentKey, type: "content" };
                  const isCounter = meta.type === "counter";
                  return (
                    <tr key={contentKey} className="border-b border-slate-100 last:border-b-0">
                      <td className="px-4 py-3 font-semibold text-slate-800">{meta.label}</td>
                      {CEFR_LEVELS.map((lvl) => {
                        const have = byLevel[lvl] ?? 0;
                        const target = data.targets[contentKey]?.[lvl] ?? 0;
                        const gap = data.gaps[contentKey]?.[lvl] ?? 0;
                        const ok = isCounter || (target > 0 && have >= target);
                        const warn = !isCounter && target > 0 && have > 0 && have < target;
                        const bad = !isCounter && target > 0 && have === 0;
                        return (
                          <td
                            key={lvl}
                            className={`text-center px-4 py-3 tabular-nums ${
                              bad
                                ? "bg-red-50 text-red-700 font-bold"
                                : warn
                                  ? "bg-amber-50 text-amber-700 font-semibold"
                                  : ok
                                    ? "text-slate-700"
                                    : "text-slate-400"
                            }`}
                          >
                            <div>{have}</div>
                            {!isCounter && target > 0 && (
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                / {target}
                                {gap > 0 && (
                                  <span className="ml-1 text-red-500 font-semibold">-{gap}</span>
                                )}
                              </div>
                            )}
                          </td>
                        );
                      })}
                      <td className="text-center px-4 py-3 font-bold text-slate-800">
                        {data.totals[contentKey] ?? 0}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Notlar - grammar, migration gerekliliği vb. */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={18} />
                <div>
                  <div className="text-sm font-bold text-amber-900 mb-1">Grammar Coach</div>
                  <div className="text-xs text-amber-800 leading-relaxed">{data.notes.grammar}</div>
                </div>
              </div>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="text-red-600 shrink-0 mt-0.5" size={18} />
                <div>
                  <div className="text-sm font-bold text-red-900 mb-1">Speaking Scenes A1</div>
                  <div className="text-xs text-red-800 leading-relaxed">
                    {data.notes.speaking_scenes_a1_missing}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="text-slate-500 shrink-0 mt-0.5" size={18} />
                <div>
                  <div className="text-sm font-bold text-slate-800 mb-1">Content Articles A1</div>
                  <div className="text-xs text-slate-700 leading-relaxed">
                    {data.notes.content_articles_a1}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Toplam eksiklik özeti */}
          <div className="bg-slate-900 text-white rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="text-emerald-400" size={20} />
              <h2 className="text-lg font-bold">Toplam Eksik İçerik (Retention Hedefine Göre)</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Object.entries(data.gaps).map(([contentKey, byLevel]) => {
                const meta = CONTENT_LABELS[contentKey] ?? { label: contentKey, type: "content" };
                if (meta.type === "counter") return null;
                const totalGap = Object.values(byLevel).reduce((a, b) => a + b, 0);
                if (totalGap === 0) return null;
                return (
                  <div key={contentKey} className="bg-slate-800 rounded-lg p-4">
                    <div className="text-xs text-slate-400 mb-1">{meta.label}</div>
                    <div className="text-2xl font-extrabold text-white">{totalGap}</div>
                    <div className="text-xs text-slate-400 mt-1">öğe eksik</div>
                    <div className="mt-3 flex gap-1 text-[10px] text-slate-400">
                      {CEFR_LEVELS.map((lvl) => {
                        const g = byLevel[lvl] ?? 0;
                        if (g === 0) return null;
                        return (
                          <span
                            key={lvl}
                            className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-200"
                          >
                            {lvl}: {g}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
