import { useState } from "react";
import {
  Play, CheckCircle2, XCircle, Loader2, ChevronDown, ChevronRight,
  Activity, Clock, AlertTriangle, Mail, BookOpen,
} from "lucide-react";
import { API } from "@/lib/api-url";

const TOKEN_KEY = "sphere_token";

async function apiFetch(path: string, opts: RequestInit = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

type TestResult = {
  id: string;
  category: string;
  name: string;
  method: string;
  path: string;
  ok: boolean;
  status: number;
  responseTime: number;
  expectedStatus?: number;
  body?: any;
  error?: string;
};

type Summary = {
  total: number;
  passed: number;
  failed: number;
  avgResponseTime: number;
  runAt: string;
};

export default function AdminSmokeTests() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [mailTesting, setMailTesting] = useState(false);
  const [mailResult, setMailResult] = useState<{ ok: boolean; message: string; recipients?: string[] } | null>(null);
  const [ebookChecking, setEbookChecking] = useState(false);
  const [ebookHealth, setEbookHealth] = useState<any | null>(null);

  async function checkEbookHealth() {
    setEbookChecking(true);
    setEbookHealth(null);
    try {
      const data = await apiFetch("/admin/ebooks/health-check");
      setEbookHealth(data);
    } catch (e: any) {
      setEbookHealth({ error: e?.message ?? "Sağlık kontrolü başarısız" });
    } finally {
      setEbookChecking(false);
    }
  }

  async function testNotifications() {
    setMailTesting(true);
    setMailResult(null);
    try {
      const data = await apiFetch("/admin/notifications/test", {
        method: "POST",
        body: JSON.stringify({ eventType: "all" }),
      });
      setMailResult({
        ok: true,
        message: `${data.eventsSent?.length ?? 0} bildirim gönderildi, ${data.recipientCount ?? 0} alıcı`,
        recipients: data.recipients,
      });
    } catch (e: any) {
      setMailResult({ ok: false, message: e?.message ?? "Bilinmeyen hata" });
    } finally {
      setMailTesting(false);
    }
  }

  async function runTests() {
    setRunning(true);
    setError(null);
    setResults([]);
    setSummary(null);
    setExpanded(new Set());
    try {
      const data = await apiFetch("/admin/smoke-tests/run", { method: "POST" });
      setResults(data.results || []);
      setSummary(data.summary || null);
      // Hatalı testleri otomatik aç
      const failedIds = (data.results || []).filter((r: TestResult) => !r.ok).map((r: TestResult) => r.id);
      setExpanded(new Set(failedIds));
    } catch (e: any) {
      setError(e?.message ?? "Bilinmeyen hata");
    } finally {
      setRunning(false);
    }
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Kategorilere göre grupla — sıralama: önce hatalılar
  const grouped = results.reduce<Record<string, TestResult[]>>((acc, r) => {
    if (!acc[r.category]) acc[r.category] = [];
    acc[r.category].push(r);
    return acc;
  }, {});

  const categoryOrder = Object.keys(grouped).sort((a, b) => {
    const failedA = grouped[a].filter((r) => !r.ok).length;
    const failedB = grouped[b].filter((r) => !r.ok).length;
    if (failedA !== failedB) return failedB - failedA; // hatalı kategoriler önce
    return a.localeCompare(b, "tr");
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Activity className="w-6 h-6 text-blue-600" />
            Smoke Testleri
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Kritik API endpoint'lerini tek tıkla test et — yeni bug'ları erken yakala
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            onClick={checkEbookHealth}
            disabled={ebookChecking}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-purple-300 transition"
            title="Tüm e-kitapların PDF asset, slug, satış durumlarını kontrol et"
          >
            {ebookChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}
            {ebookChecking ? "Kontrol ediliyor..." : "E-Kitap Sistemi Kontrol"}
          </button>
          <button
            onClick={testNotifications}
            disabled={mailTesting}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:bg-amber-300 transition"
            title="Admin'e 5 farklı event tipinde test mail at"
          >
            {mailTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            {mailTesting ? "Gönderiliyor..." : "Test Mail Gönder"}
          </button>
          <button
            onClick={runTests}
            disabled={running}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition"
          >
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {running ? "Çalışıyor..." : "Tümünü Çalıştır"}
          </button>
        </div>
      </div>

      {ebookHealth && (
        <EbookHealthPanel data={ebookHealth} />
      )}

      {mailResult && (
        <div className={`mb-4 p-3 rounded-lg border flex items-start gap-2 ${mailResult.ok ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
          {mailResult.ok ? (
            <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          )}
          <div className="text-sm">
            <div className={`font-medium ${mailResult.ok ? "text-green-800" : "text-red-800"}`}>
              {mailResult.ok ? "Test mailleri gönderildi" : "Test mail gönderilemedi"}
            </div>
            <div className={mailResult.ok ? "text-green-700" : "text-red-700"}>
              {mailResult.message}
            </div>
            {mailResult.recipients && mailResult.recipients.length > 0 && (
              <div className="text-xs text-green-600 mt-1">
                Alıcılar: {mailResult.recipients.join(", ")}
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-sm text-red-700">
            <strong>Test çalıştırılamadı:</strong> {error}
          </div>
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Stat label="Toplam" value={String(summary.total)} />
          <Stat label="Başarılı" value={String(summary.passed)} color="green" />
          <Stat label="Başarısız" value={String(summary.failed)} color={summary.failed > 0 ? "red" : "gray"} />
          <Stat label="Ort. yanıt" value={`${summary.avgResponseTime}ms`} icon={<Clock className="w-4 h-4" />} />
        </div>
      )}

      {summary && (
        <p className="text-xs text-gray-500 mb-4">
          Son çalıştırma: {new Date(summary.runAt).toLocaleString("tr-TR")}
        </p>
      )}

      {categoryOrder.map((category) => {
        const tests = grouped[category];
        const failedCount = tests.filter((t) => !t.ok).length;
        return (
          <div key={category} className="mb-5">
            <h2 className="text-base font-semibold text-gray-900 mb-2 flex items-center gap-2">
              {category}
              <span className="text-xs text-gray-400 font-normal">({tests.length})</span>
              {failedCount > 0 && (
                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                  {failedCount} başarısız
                </span>
              )}
            </h2>
            <div className="bg-white rounded-lg border divide-y">
              {tests.map((r) => {
                const isExpanded = expanded.has(r.id);
                const hasDetail = !!(r.body || r.error);
                return (
                  <div key={r.id}>
                    <button
                      onClick={() => hasDetail && toggleExpand(r.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition ${
                        hasDetail ? "hover:bg-gray-50 cursor-pointer" : "cursor-default"
                      }`}
                    >
                      {r.ok ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-600 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 truncate">{r.name}</div>
                        <div className="text-xs text-gray-500 font-mono mt-0.5">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold mr-1.5 ${methodColor(r.method)}`}>
                            {r.method}
                          </span>
                          {r.path}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`text-sm font-mono font-medium ${r.ok ? "text-gray-700" : "text-red-600"}`}>
                          {r.status || "—"}
                        </div>
                        <div className="text-xs text-gray-500">{r.responseTime}ms</div>
                      </div>
                      {hasDetail && (
                        isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                        )
                      )}
                    </button>
                    {isExpanded && hasDetail && (
                      <div className="px-4 pb-3 bg-gray-50 border-t">
                        <div className="text-xs text-gray-500 mt-2 mb-1">Yanıt detayı:</div>
                        <pre className="text-xs text-gray-700 whitespace-pre-wrap overflow-x-auto p-3 bg-white rounded border max-h-64">
                          {r.error ?? (typeof r.body === "string" ? r.body : JSON.stringify(r.body, null, 2))}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {results.length === 0 && !running && !error && (
        <div className="text-center py-12 text-gray-500 bg-white rounded-lg border-2 border-dashed">
          <Activity className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="font-medium text-gray-700 mb-1">Henüz test çalıştırılmadı</p>
          <p className="text-sm">"Tümünü Çalıştır" butonuna tıklayarak başla</p>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color, icon }: { label: string; value: string; color?: "green" | "red" | "gray"; icon?: React.ReactNode }) {
  const colorClass =
    color === "green" ? "text-green-700" :
    color === "red" ? "text-red-700" :
    "text-gray-900";
  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
        {icon}
        {label}
      </div>
      <div className={`text-2xl font-bold ${colorClass}`}>{value}</div>
    </div>
  );
}

function EbookHealthPanel({ data }: { data: any }) {
  if (data?.error) {
    return (
      <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center gap-2 text-red-800 font-medium">
          <AlertTriangle className="w-4 h-4" />
          E-Kitap Sağlık Kontrolü Başarısız
        </div>
        <p className="text-sm text-red-700 mt-1">{data.error}</p>
      </div>
    );
  }

  const summary = data?.summary || {};
  const warnings: string[] = data?.warnings || [];
  const ebooks = data?.ebooks || [];
  const isHealthy = summary.overallStatus === "healthy";

  return (
    <div className="mb-6 bg-white rounded-lg border-2 border-purple-200 overflow-hidden">
      <div className={`px-4 py-3 ${isHealthy ? "bg-green-50" : "bg-amber-50"} border-b`}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">
            {isHealthy ? (
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            )}
            E-Kitap Sistemi: {isHealthy ? "Sağlıklı" : `${summary.warningCount ?? warnings.length} Uyarı`}
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-4 border-b">
        <MiniStat label="Toplam Kitap" value={summary.totalEbooks ?? 0} />
        <MiniStat label="Aktif" value={summary.activeEbooks ?? 0} />
        <MiniStat label="PDF Eksik" value={summary.missingFullPdf ?? 0} color={summary.missingFullPdf > 0 ? "red" : "gray"} />
        <MiniStat label="Slug Sorunu" value={summary.slugConflicts ?? 0} color={summary.slugConflicts > 0 ? "red" : "gray"} />
        <MiniStat label="Bekleyen Satış" value={summary.totalPendingSales ?? 0} color={summary.totalPendingSales > 0 ? "amber" : "gray"} />
      </div>

      {warnings.length > 0 && (
        <div className="p-4 border-b bg-amber-50/50">
          <h3 className="text-sm font-semibold mb-2 text-amber-900">Uyarılar:</h3>
          <ul className="space-y-1.5">
            {warnings.map((w, i) => (
              <li key={i} className="text-sm text-amber-900 font-mono">{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-600">
            <tr>
              <th className="text-left px-4 py-2">Kitap</th>
              <th className="text-center px-2 py-2">Aktif</th>
              <th className="text-center px-2 py-2">Full PDF</th>
              <th className="text-center px-2 py-2">Preview</th>
              <th className="text-center px-2 py-2">Slug</th>
              <th className="text-center px-2 py-2">Satış</th>
              <th className="text-center px-2 py-2">Bekleyen</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {ebooks.map((eb: any) => (
              <tr key={eb.id} className={eb.status === "warning" ? "bg-amber-50/30" : ""}>
                <td className="px-4 py-2">
                  <div className="font-medium text-gray-900">{eb.title}</div>
                  <div className="text-xs text-gray-500 font-mono">#{eb.id} · {eb.slug}</div>
                </td>
                <td className="text-center px-2">{eb.isActive ? "✓" : "—"}</td>
                <td className="text-center px-2">
                  {eb.hasFullPdf ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600 inline" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-600 inline" />
                  )}
                </td>
                <td className="text-center px-2">
                  {eb.hasPreview ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600 inline" />
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="text-center px-2">
                  {eb.slugConflict ? (
                    <span className="text-red-600 font-bold" title="Reserved keyword">⚠</span>
                  ) : (
                    "✓"
                  )}
                </td>
                <td className="text-center px-2 text-gray-700">
                  {eb.sales?.success ?? 0}/{eb.sales?.total ?? 0}
                </td>
                <td className="text-center px-2">
                  {eb.sales?.pending > 0 ? (
                    <span className="inline-block px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-xs font-medium">
                      {eb.sales.pending}
                    </span>
                  ) : (
                    <span className="text-gray-400">0</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color?: "red" | "amber" | "gray" }) {
  const cls =
    color === "red" ? "text-red-700" :
    color === "amber" ? "text-amber-700" :
    "text-gray-900";
  return (
    <div className="bg-gray-50 rounded p-3">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-xl font-bold ${cls}`}>{value}</div>
    </div>
  );
}

function methodColor(method: string): string {
  switch (method) {
    case "GET": return "bg-blue-100 text-blue-700";
    case "POST": return "bg-green-100 text-green-700";
    case "PATCH": return "bg-yellow-100 text-yellow-700";
    case "PUT": return "bg-purple-100 text-purple-700";
    case "DELETE": return "bg-red-100 text-red-700";
    default: return "bg-gray-100 text-gray-700";
  }
}
