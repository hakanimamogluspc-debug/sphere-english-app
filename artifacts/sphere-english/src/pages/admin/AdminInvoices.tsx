import { useEffect, useMemo, useState } from "react";
import {
  RefreshCw, FileText, ExternalLink, RotateCw, XCircle, CheckCircle2,
  AlertTriangle, Clock, Ban, PlayCircle, X, ClipboardCopy, Loader2,
  Search, ShoppingBag, Package, ShieldCheck, FileCheck2, AlertCircle,
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
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.error || `HTTP ${res.status}`);
  return data;
}

// ─── Types ────────────────────────────────────────────────────────────
type InvoiceRow = {
  id: number;
  provider: string;
  env: "test" | "prod";
  invoice_type: "einvoice" | "earchive";
  ettn: string | null;
  external_invoice_code: string | null;
  invoice_date: string;
  source_type: string;
  source_id: number;
  order_id: string | null;
  buyer_email: string;
  buyer_name: string;
  buyer_type: "individual" | "corporate" | "foreign";
  buyer_tax_id: string | null;
  total_kurus: number;
  currency: string;
  status: "pending" | "sent" | "failed" | "canceled";
  attempts: number;
  last_error: string | null;
  viewer_url: string | null;
  sent_at: string | null;
  created_at: string;
};

type HealthResp = {
  ok: boolean;
  message?: string;
  provider?: string;
  env?: string;
  companyTaxCode?: string;
  userTaxCode?: string;
  passwordInfo?: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────
function formatTRY(kurus: number) {
  const tl = (kurus ?? 0) / 100;
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(tl);
}
function formatDate(iso: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleString("tr-TR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function statusChip(s: InvoiceRow["status"]) {
  const map = {
    sent:     { bg: "bg-emerald-100 text-emerald-800", label: "Gönderildi", icon: CheckCircle2 },
    pending:  { bg: "bg-amber-100 text-amber-800",     label: "Beklemede",  icon: Clock },
    failed:   { bg: "bg-red-100 text-red-800",         label: "Başarısız",  icon: XCircle },
    canceled: { bg: "bg-gray-200 text-gray-700",       label: "İptal",      icon: Ban },
  } as const;
  const it = map[s] ?? map.pending;
  const Icon = it.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${it.bg}`}>
      <Icon className="h-3 w-3" />
      {it.label}
    </span>
  );
}
function typeChip(t: InvoiceRow["invoice_type"]) {
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${
      t === "einvoice" ? "bg-indigo-100 text-indigo-800" : "bg-sky-100 text-sky-800"
    }`}>
      {t === "einvoice" ? "e-Fatura" : "e-Arşiv"}
    </span>
  );
}
function sourceChip(src: string) {
  const Icon = src === "ebook_cart" ? ShoppingBag : Package;
  const label = src === "ebook" ? "E-Kitap" : src === "ebook_cart" ? "Sepet" : src === "subscription" ? "Abonelik" : src === "manual" ? "Manuel" : src;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-gray-600">
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

// ─── Ana bileşen ──────────────────────────────────────────────────────
export default function AdminInvoices() {
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | InvoiceRow["status"]>("all");
  const [search, setSearch] = useState("");

  const [health, setHealth] = useState<HealthResp | null>(null);
  const [healthChecking, setHealthChecking] = useState(false);

  const [testOpen, setTestOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);

  // ─── Load list ────────────────────────────────────────────────────
  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch("/admin/invoices?limit=200");
      setRows(data.invoices ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Fatura listesi alınamadı");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  // ─── Health check ────────────────────────────────────────────────
  async function runHealth() {
    setHealthChecking(true);
    setHealth(null);
    try {
      const d = await apiFetch("/admin/invoices/health");
      setHealth(d);
    } catch (e: any) {
      setHealth({ ok: false, message: e?.message ?? "Bilinmeyen hata" });
    } finally {
      setHealthChecking(false);
    }
  }

  // ─── Filtered ─────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      return (
        r.buyer_email?.toLowerCase().includes(q) ||
        r.buyer_name?.toLowerCase().includes(q) ||
        r.ettn?.toLowerCase().includes(q) ||
        r.external_invoice_code?.toLowerCase().includes(q) ||
        String(r.source_id).includes(q)
      );
    });
  }, [rows, statusFilter, search]);

  // ─── Counts ───────────────────────────────────────────────────────
  const counts = useMemo(() => {
    const c = { all: rows.length, sent: 0, pending: 0, failed: 0, canceled: 0 };
    for (const r of rows) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [rows]);

  const totalSentKurus = useMemo(
    () => rows.filter((r) => r.status === "sent").reduce((s, r) => s + (r.total_kurus ?? 0), 0),
    [rows]
  );

  // ─── Actions ──────────────────────────────────────────────────────
  async function retry(id: number) {
    if (!confirm("Bu faturayı tekrar denemek istiyor musunuz?")) return;
    try {
      const r = await apiFetch(`/admin/invoices/${id}/retry`, { method: "POST" });
      alert(r.ok ? `✓ Yeni fatura kesildi (ID: ${r.invoiceId})` : `Hata: ${r.error}`);
      load();
    } catch (e: any) {
      alert(`Hata: ${e?.message}`);
    }
  }
  async function refreshViewer(id: number) {
    try {
      const r = await apiFetch(`/admin/invoices/${id}/refresh-viewer`, { method: "POST" });
      if (r.url) window.open(r.url, "_blank");
      load();
    } catch (e: any) {
      alert(`Hata: ${e?.message}`);
    }
  }
  async function cancel(id: number) {
    const reason = prompt("İptal sebebi:", "Müşteri talebi / iade");
    if (!reason) return;
    try {
      const r = await apiFetch(`/admin/invoices/${id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      alert(r.ok ? "✓ İptal edildi" : `Hata: ${r.error}`);
      load();
    } catch (e: any) {
      alert(`Hata: ${e?.message}`);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
              <FileText className="h-6 w-6 text-indigo-600" />
              E-Fatura / E-Arşiv Yönetimi
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Toplam {counts.all} fatura • Gönderilen toplam:{" "}
              <span className="font-semibold text-gray-800">{formatTRY(totalSentKurus)}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={runHealth}
              disabled={healthChecking}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
            >
              {healthChecking ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Bağlantı Testi
            </button>
            <button
              onClick={() => setTestOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            >
              <PlayCircle className="h-4 w-4" />
              Test Faturası
            </button>
            <button
              onClick={() => setManualOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-500"
              title="WhatsApp/telefon satışları için manuel fatura kes"
            >
              <FileText className="h-4 w-4" />
              Yeni Fatura Kes
            </button>
            <button
              onClick={load}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Yenile
            </button>
          </div>
        </div>

        {/* Health panel */}
        {health && (
          <div className={`mb-4 rounded-lg border p-4 ${health.ok ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
            <div className="flex items-start gap-3">
              {health.ok ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600" />
              ) : (
                <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
              )}
              <div className="flex-1 text-sm">
                <div className={`font-semibold ${health.ok ? "text-emerald-800" : "text-red-800"}`}>
                  {health.ok ? "Luca bağlantısı aktif" : "Luca bağlantı sorunu"}
                </div>
                <div className={`mt-1 ${health.ok ? "text-emerald-700" : "text-red-700"}`}>
                  {health.message}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
                  <span><strong>Sağlayıcı:</strong> {health.provider}</span>
                  <span><strong>Ortam:</strong> {health.env}</span>
                  <span><strong>Firma VKN:</strong> {health.companyTaxCode}</span>
                  <span><strong>Kullanıcı TC:</strong> {health.userTaxCode}</span>
                </div>
              </div>
              <button
                onClick={() => setHealth(null)}
                className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Stat tiles */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Gönderilen" count={counts.sent} color="emerald" icon={CheckCircle2} />
          <StatTile label="Beklemede"  count={counts.pending} color="amber" icon={Clock} />
          <StatTile label="Başarısız"  count={counts.failed} color="red" icon={XCircle} />
          <StatTile label="İptal"      count={counts.canceled} color="gray" icon={Ban} />
        </div>

        {/* Bekleyen Taslaklar paneli (manuel fatura draft'ları) */}
        <DraftsPanel />

        {/* Faturalanmamış Siparişler paneli */}
        <UnbilledOrdersPanel onIssued={load} />


        {/* Filters */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-wrap gap-1 rounded-lg bg-white p-1 shadow-sm ring-1 ring-gray-200">
            {(["all", "sent", "pending", "failed", "canceled"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  statusFilter === s ? "bg-indigo-600 text-white shadow" : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {s === "all" ? "Tümü" : s === "sent" ? "Gönderilen" : s === "pending" ? "Bekleyen" : s === "failed" ? "Başarısız" : "İptal"}
                <span className="ml-1.5 text-xs opacity-70">({counts[s]})</span>
              </button>
            ))}
          </div>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Alıcı, ETTN, fatura kodu veya sipariş no ile ara…"
              className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-lg bg-white shadow ring-1 ring-gray-200">
          {error && (
            <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <Th>Tarih</Th>
                  <Th>Alıcı</Th>
                  <Th>Kaynak</Th>
                  <Th>Tip</Th>
                  <Th className="text-right">Tutar</Th>
                  <Th>Durum</Th>
                  <Th>ETTN / Kod</Th>
                  <Th className="text-right pr-4">Aksiyon</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {loading && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td></tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    Bu filtreyle eşleşen fatura yok.
                  </td></tr>
                )}
                {!loading && filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600">
                      {formatDate(r.created_at)}
                      {r.env === "test" && (
                        <div className="mt-0.5 inline-block rounded bg-yellow-100 px-1.5 text-[10px] font-semibold text-yellow-800">TEST</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{r.buyer_name || "—"}</div>
                      <div className="text-xs text-gray-500">{r.buyer_email}</div>
                      {r.buyer_tax_id && (
                        <div className="text-xs text-gray-400">VKN/TC: {r.buyer_tax_id}</div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {sourceChip(r.source_type)}
                      <div className="text-[10px] text-gray-400">#{r.source_id}</div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">{typeChip(r.invoice_type)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-gray-900">
                      {formatTRY(r.total_kurus)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {statusChip(r.status)}
                      {r.attempts > 1 && (
                        <div className="mt-0.5 text-[10px] text-gray-500">{r.attempts} deneme</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.external_invoice_code ? (
                        <div className="font-mono text-xs text-gray-800">{r.external_invoice_code}</div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                      {r.ettn && (
                        <div className="mt-0.5 flex items-center gap-1 font-mono text-[10px] text-gray-500">
                          <span className="truncate max-w-[140px]" title={r.ettn}>{r.ettn.slice(0, 8)}…</span>
                          <button
                            onClick={() => { navigator.clipboard.writeText(r.ettn!); }}
                            title="ETTN kopyala"
                            className="rounded p-0.5 hover:bg-gray-200"
                          >
                            <ClipboardCopy className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        {r.viewer_url && (
                          <a
                            href={r.viewer_url}
                            target="_blank"
                            rel="noreferrer"
                            title="Faturayı aç"
                            className="rounded p-1.5 text-indigo-600 hover:bg-indigo-50"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                        {r.status === "sent" && (
                          <button
                            onClick={() => refreshViewer(r.id)}
                            title="Görüntüleme linkini yenile"
                            className="rounded p-1.5 text-gray-600 hover:bg-gray-100"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </button>
                        )}
                        {r.status === "failed" && (
                          <button
                            onClick={() => retry(r.id)}
                            title="Tekrar dene"
                            className="rounded p-1.5 text-amber-600 hover:bg-amber-50"
                          >
                            <RotateCw className="h-4 w-4" />
                          </button>
                        )}
                        {r.status === "sent" && r.invoice_type === "earchive" && (
                          <button
                            onClick={() => cancel(r.id)}
                            title="İptal"
                            className="rounded p-1.5 text-red-600 hover:bg-red-50"
                          >
                            <Ban className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => setDetailId(r.id)}
                          className="rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
                        >
                          Detay
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Test invoice modal */}
      {testOpen && <TestInvoiceModal onClose={() => setTestOpen(false)} onDone={load} />}
      {manualOpen && <ManualInvoiceModal onClose={() => setManualOpen(false)} onDone={load} />}

      {/* Detail drawer */}
      {detailId != null && <InvoiceDetailDrawer id={detailId} onClose={() => setDetailId(null)} onChanged={load} />}
    </div>
  );
}

// ─── Small components ─────────────────────────────────────────────────
function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`whitespace-nowrap px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 ${className}`}>
      {children}
    </th>
  );
}

function StatTile({
  label, count, color, icon: Icon,
}: { label: string; count: number; color: "emerald" | "amber" | "red" | "gray"; icon: any }) {
  const bg = {
    emerald: "bg-emerald-50 text-emerald-700",
    amber:   "bg-amber-50 text-amber-700",
    red:     "bg-red-50 text-red-700",
    gray:    "bg-gray-100 text-gray-700",
  }[color];
  return (
    <div className="rounded-lg bg-white p-3 shadow ring-1 ring-gray-200">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</div>
        <div className={`rounded-md p-1 ${bg}`}><Icon className="h-4 w-4" /></div>
      </div>
      <div className="mt-1 text-2xl font-bold text-gray-900">{count}</div>
    </div>
  );
}

// ─── Bekleyen Taslak Faturalar paneli ─────────────────────────────────
type DraftRow = {
  id: number;
  buyer_name: string | null;
  buyer_email: string | null;
  product_name: string | null;
  amount_kurus: number | null;
  created_at: string;
};

function DraftsPanel() {
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try {
      const d = await apiFetch("/admin/invoices/drafts");
      setDrafts(d.drafts ?? []);
    } catch (e: any) {
      console.warn("[drafts] yüklenemedi:", e?.message);
      setDrafts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 20000); // 20 sn otomatik refresh
    return () => clearInterval(t);
  }, []);

  async function issueDraft(id: number) {
    if (!confirm("Bu taslak Luca'ya gönderilecek. Fatura kesildikten sonra iptal etmek zor. Devam edilsin mi?")) return;
    setBusyId(id);
    try {
      const r = await apiFetch(`/admin/invoices/drafts/${id}/issue`, { method: "POST" });
      if (r.ok) {
        alert(`✓ Fatura kesildi\nETTN: ${r.ettn ?? "—"}`);
        await load();
      } else {
        alert(`✗ Hata: ${r.error ?? "bilinmiyor"}`);
      }
    } catch (e: any) {
      alert("Hata: " + e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function deleteDraft(id: number, buyerName: string | null) {
    if (!confirm(`"${buyerName ?? "Taslak"}" silinsin mi? Geri alınamaz.`)) return;
    setBusyId(id);
    try {
      await apiFetch(`/admin/invoices/drafts/${id}`, { method: "DELETE" });
      await load();
    } catch (e: any) {
      alert("Hata: " + e.message);
    } finally {
      setBusyId(null);
    }
  }

  if (loading && drafts.length === 0) return null;
  if (drafts.length === 0) return null;

  return (
    <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-amber-700" />
          <h3 className="text-sm font-semibold text-amber-900">
            Bekleyen Taslak Faturalar ({drafts.length})
          </h3>
        </div>
        <span className="text-[11px] text-amber-800">
          Luca'ya gönderilmeden önce buradan inceleyip onaylayabilirsin
        </span>
      </div>
      <div className="space-y-2">
        {drafts.map((d) => (
          <div key={d.id} className="flex items-center gap-3 rounded-md border border-amber-200 bg-white px-3 py-2 text-sm">
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-gray-900 truncate">{d.buyer_name ?? "—"}</div>
              <div className="text-xs text-gray-500 truncate">
                {d.buyer_email ?? "—"} · {d.product_name ?? "—"}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-sm font-bold text-gray-900">{formatTRY(Number(d.amount_kurus ?? 0))}</div>
              <div className="text-[10px] text-gray-400">{new Date(d.created_at).toLocaleString("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => issueDraft(d.id)}
                disabled={busyId === d.id}
                className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                title="Luca'ya gönder ve fatura kes"
              >
                {busyId === d.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                Kes
              </button>
              <button
                onClick={() => deleteDraft(d.id, d.buyer_name)}
                disabled={busyId === d.id}
                className="inline-flex items-center gap-1 rounded border border-red-300 bg-white px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                title="Taslağı sil"
              >
                <XCircle className="h-3 w-3" />
                Sil
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Manual invoice modal — WhatsApp/telefon satışları için ────────────
type ProductOption = {
  key: string;      // 'ebook-42', 'course-foundation'
  label: string;    // 'E-Kitap · Kurumsal İletişim & Toplantılar'
  productName: string;
  priceTL: number;
  type: "ebook" | "course";
};

function ManualInvoiceModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [buyerType, setBuyerType] = useState<"individual" | "corporate">("individual");
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [buyerTaxId, setBuyerTaxId] = useState("");
  const [buyerTaxOffice, setBuyerTaxOffice] = useState("");
  const [buyerCompanyName, setBuyerCompanyName] = useState("");
  const [buyerAddress, setBuyerAddress] = useState("");
  const [buyerCity, setBuyerCity] = useState("");
  const [buyerDistrict, setBuyerDistrict] = useState("");
  const [buyerPostalCode, setBuyerPostalCode] = useState("");
  // Çoklu ürün satırları
  type LineItem = { productName: string; amountTL: string; vatRate: number; note: string; productSelect: string };
  const emptyLine = (): LineItem => ({ productName: "", amountTL: "", vatRate: 20, note: "", productSelect: "" });
  const [lineItems, setLineItems] = useState<LineItem[]>([emptyLine()]);
  const [sendMail, setSendMail] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [productOpts, setProductOpts] = useState<ProductOption[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);

  // Modal açılınca kitap + kurs listesini çek
  useEffect(() => {
    (async () => {
      setProductsLoading(true);
      try {
        const [ebooksRes, coursesRes] = await Promise.allSettled([
          apiFetch("/admin/ebooks"),
          apiFetch("/admin/courses"),
        ]);
        const opts: ProductOption[] = [];
        if (ebooksRes.status === "fulfilled" && Array.isArray(ebooksRes.value?.ebooks)) {
          for (const e of ebooksRes.value.ebooks) {
            if (!e?.is_active) continue;
            opts.push({
              key: `ebook-${e.id}`,
              label: `E-Kitap · ${e.title}`,
              productName: `Sphere English E-Kitap · ${e.title}`,
              priceTL: Number(e.price_try ?? 0),
              type: "ebook",
            });
          }
        }
        if (coursesRes.status === "fulfilled" && Array.isArray(coursesRes.value?.courses)) {
          for (const c of coursesRes.value.courses) {
            if (!c?.is_active) continue;
            opts.push({
              key: `course-${c.slug}`,
              label: `Kurs · ${c.title}`,
              productName: `Sphere English Kurs · ${c.title}`,
              priceTL: Number(c.price_kurus ?? 0) / 100,
              type: "course",
            });
          }
        }
        setProductOpts(opts);
      } catch {
        // Sessizce — manuel giriş her zaman çalışır
      } finally {
        setProductsLoading(false);
      }
    })();
  }, []);

  function updateLine(idx: number, patch: Partial<LineItem>) {
    setLineItems((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLineItems((prev) => [...prev, emptyLine()]);
  }
  function removeLine(idx: number) {
    setLineItems((prev) => prev.filter((_, i) => i !== idx));
  }
  function onProductChangeAtIdx(idx: number, key: string) {
    if (!key) {
      updateLine(idx, { productSelect: "" });
      return;
    }
    const opt = productOpts.find((o) => o.key === key);
    if (!opt) return;
    updateLine(idx, {
      productSelect: key,
      productName: opt.productName,
      amountTL: opt.priceTL.toFixed(2).replace(".", ","),
    });
  }
  // Toplamlar
  const totals = (() => {
    let total = 0;
    for (const l of lineItems) {
      const p = parseFloat((l.amountTL || "0").replace(",", ".")) || 0;
      total += p;
    }
    return { totalTL: total };
  })();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const lines = lineItems.map((l) => ({
        productName: l.productName,
        priceKurus: Math.round((parseFloat(l.amountTL.replace(",", ".")) || 0) * 100),
        vatRate: l.vatRate,
        note: l.note || undefined,
      }));
      const r = await apiFetch("/admin/invoices/manual", {
        method: "POST",
        body: JSON.stringify({
          buyerType,
          buyerName,
          buyerEmail,
          buyerPhone: buyerPhone || undefined,
          buyerTaxId: buyerTaxId.replace(/\D/g, ""),
          buyerTaxOffice: buyerType === "corporate" ? buyerTaxOffice : undefined,
          buyerCompanyName: buyerType === "corporate" ? buyerCompanyName : undefined,
          buyerAddress,
          buyerCity,
          buyerDistrict,
          buyerPostalCode: buyerPostalCode || undefined,
          lineItems: lines,
          sendMailAutomatically: sendMail,
        }),
      });
      setResult(r);
      if (r.ok) onDone();
    } catch (e: any) {
      setResult({ ok: false, error: e?.message });
    } finally {
      setLoading(false);
    }
  }

  const inputCls = "mt-1 w-full rounded border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-emerald-500";
  const labelCls = "block text-xs font-semibold text-gray-700";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl my-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b px-5 py-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Manuel Fatura Kes</h3>
            <p className="text-xs text-gray-500">WhatsApp / telefon satışları için · KDV DAHİL tutar</p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100"><X className="h-4 w-4" /></button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4">

          {/* Alıcı tipi */}
          <div>
            <label className={labelCls}>Fatura Tipi *</label>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {(["individual", "corporate"] as const).map((t) => (
                <label key={t} className={`flex items-center gap-2 px-3 py-2 rounded border-2 cursor-pointer transition-colors ${
                  buyerType === t ? "border-emerald-500 bg-emerald-50" : "border-gray-200 hover:border-gray-300"
                }`}>
                  <input type="radio" name="buyerType" checked={buyerType === t} onChange={() => setBuyerType(t)} className="accent-emerald-600" />
                  <span className="text-sm font-medium text-gray-800">{t === "individual" ? "Bireysel" : "Kurumsal (VKN)"}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Alıcı bilgileri */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{buyerType === "individual" ? "Ad Soyad *" : "Yetkili adı *"}</label>
              <input required type="text" value={buyerName} onChange={(e) => setBuyerName(e.target.value)} className={inputCls} placeholder="Ayşe Yıldız" />
            </div>
            <div>
              <label className={labelCls}>E-posta *</label>
              <input required type="email" value={buyerEmail} onChange={(e) => setBuyerEmail(e.target.value)} className={inputCls} placeholder="ayse@ornek.com" />
            </div>
            <div>
              <label className={labelCls}>Telefon</label>
              <input type="tel" value={buyerPhone} onChange={(e) => setBuyerPhone(e.target.value)} className={inputCls} placeholder="+90 5XX XXX XX XX" />
            </div>
            <div>
              <label className={labelCls}>{buyerType === "individual" ? "TC Kimlik No *" : "VKN *"}</label>
              <input required type="text" inputMode="numeric" maxLength={buyerType === "individual" ? 11 : 10}
                value={buyerTaxId}
                onChange={(e) => setBuyerTaxId(e.target.value.replace(/\D/g, "").slice(0, buyerType === "individual" ? 11 : 10))}
                className={inputCls + " font-mono"}
                placeholder={buyerType === "individual" ? "11 haneli" : "10 haneli"} />
            </div>
          </div>

          {buyerType === "corporate" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Şirket Unvanı *</label>
                <input required type="text" value={buyerCompanyName} onChange={(e) => setBuyerCompanyName(e.target.value)} className={inputCls} placeholder="ABC İletişim A.Ş." />
              </div>
              <div>
                <label className={labelCls}>Vergi Dairesi *</label>
                <input required type="text" value={buyerTaxOffice} onChange={(e) => setBuyerTaxOffice(e.target.value)} className={inputCls} placeholder="Ankara Kurumlar" />
              </div>
            </div>
          )}

          {/* Adres */}
          <div>
            <label className={labelCls}>Açık Adres *</label>
            <textarea required value={buyerAddress} onChange={(e) => setBuyerAddress(e.target.value)} rows={2} className={inputCls} placeholder="Mahalle, cadde, bina no" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>İl *</label>
              <input required type="text" value={buyerCity} onChange={(e) => setBuyerCity(e.target.value)} className={inputCls} placeholder="Ankara" />
            </div>
            <div>
              <label className={labelCls}>İlçe *</label>
              <input required type="text" value={buyerDistrict} onChange={(e) => setBuyerDistrict(e.target.value)} className={inputCls} placeholder="Çankaya" />
            </div>
            <div>
              <label className={labelCls}>Posta Kodu</label>
              <input type="text" inputMode="numeric" maxLength={5}
                value={buyerPostalCode}
                onChange={(e) => setBuyerPostalCode(e.target.value.replace(/\D/g, ""))}
                className={inputCls} placeholder="06520" />
            </div>
          </div>

          {/* Fatura Satırları (çoklu ürün) */}
          <div className="border-t pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-900">Fatura Satırları ({lineItems.length})</h4>
              <button
                type="button"
                onClick={addLine}
                className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-200"
              >
                + Satır Ekle
              </button>
            </div>

            {lineItems.map((line, idx) => (
              <div key={idx} className="rounded-md border border-gray-200 bg-gray-50 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Satır {idx + 1}</span>
                  {lineItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLine(idx)}
                      className="text-xs text-red-600 hover:text-red-800"
                    >
                      Sil
                    </button>
                  )}
                </div>
                <div>
                  <label className={labelCls}>Ürün Seç</label>
                  <select
                    value={line.productSelect}
                    onChange={(e) => onProductChangeAtIdx(idx, e.target.value)}
                    className={inputCls}
                  >
                    <option value="">— Manuel giriş —</option>
                    {productOpts.filter((o) => o.type === "ebook").length > 0 && (
                      <optgroup label="E-Kitaplar">
                        {productOpts.filter((o) => o.type === "ebook").map((o) => (
                          <option key={o.key} value={o.key}>{o.label} — {o.priceTL.toFixed(2)} TL</option>
                        ))}
                      </optgroup>
                    )}
                    {productOpts.filter((o) => o.type === "course").length > 0 && (
                      <optgroup label="Kurslar">
                        {productOpts.filter((o) => o.type === "course").map((o) => (
                          <option key={o.key} value={o.key}>{o.label} — {o.priceTL.toFixed(2)} TL</option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Ürün / Hizmet *</label>
                  <input required type="text" value={line.productName}
                    onChange={(e) => updateLine(idx, { productName: e.target.value })}
                    className={inputCls}
                    placeholder="Ürün adı" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className={labelCls}>Tutar (TL, KDV DAHİL) *</label>
                    <input required type="text" inputMode="decimal" value={line.amountTL}
                      onChange={(e) => updateLine(idx, { amountTL: e.target.value })}
                      className={inputCls + " font-mono"}
                      placeholder="199,00" />
                  </div>
                  <div>
                    <label className={labelCls}>KDV *</label>
                    <select value={line.vatRate}
                      onChange={(e) => updateLine(idx, { vatRate: parseInt(e.target.value) })}
                      className={inputCls}>
                      <option value={20}>%20</option>
                      <option value={10}>%10</option>
                      <option value={1}>%1</option>
                      <option value={0}>%0</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Not (opsiyonel)</label>
                  <input type="text" value={line.note}
                    onChange={(e) => updateLine(idx, { note: e.target.value })}
                    className={inputCls} placeholder="Satıra özel not" />
                </div>
              </div>
            ))}

            {/* Toplam */}
            <div className="flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm">
              <span className="font-semibold text-emerald-900">TOPLAM (KDV DAHİL)</span>
              <span className="font-bold text-emerald-900 text-lg">
                {totals.totalTL.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL
              </span>
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-700 pt-2">
              <input type="checkbox" checked={sendMail} onChange={(e) => setSendMail(e.target.checked)} className="accent-emerald-600" />
              Faturayı alıcıya otomatik e-posta ile gönder (Kes ederken)
            </label>
          </div>

          {result && (
            <div className={`rounded p-3 text-sm ${result.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
              {result.ok ? (
                <>
                  <div className="font-semibold">✓ Taslak oluşturuldu (Draft #{result.draftId})</div>
                  <div className="mt-1 text-xs">{result.message ?? "Taslaklar sekmesinden inceleyip 'Kes' ile onaylayabilirsin."}</div>
                </>
              ) : (
                <>
                  <div className="font-semibold">✗ Taslak oluşturulamadı</div>
                  <div className="mt-1 text-xs break-all">{result.error}</div>
                </>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 border-t pt-3">
            <button type="button" onClick={onClose}
              className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">Kapat</button>
            <button type="submit" disabled={loading}
              className="inline-flex items-center gap-2 rounded bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              Taslak Oluştur
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Test invoice modal ────────────────────────────────────────────────
function TestInvoiceModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const r = await apiFetch("/admin/invoices/issue-test", {
        method: "POST",
        body: JSON.stringify({ email, name, amount }),
      });
      setResult(r);
      if (r.ok) onDone();
    } catch (e: any) {
      setResult({ ok: false, error: e?.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h3 className="text-lg font-semibold text-gray-900">Test Faturası Kes</h3>
          <button onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={submit} className="space-y-3 p-5">
          <div>
            <label className="block text-sm font-medium text-gray-700">Alıcı adı</label>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Alıcı e-posta</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Tutar (TL, KDV dahil)</label>
            <input type="number" min="1" step="0.01" required value={amount}
              onChange={(e) => setAmount(parseFloat(e.target.value))}
              className="mt-1 w-full rounded border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500" />
          </div>
          {result && (
            <div className={`rounded p-3 text-sm ${result.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
              {result.ok ? (
                <>
                  <div className="font-semibold">✓ Fatura oluşturuldu</div>
                  <div className="mt-1 text-xs">Kod: {result.externalInvoiceCode}</div>
                  <div className="text-xs">ETTN: {result.ettn}</div>
                  {result.viewerUrl && (
                    <a href={result.viewerUrl} target="_blank" rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-1 font-medium underline">
                      Faturayı aç <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </>
              ) : (
                <>
                  <div className="font-semibold">✗ Hata</div>
                  <div className="mt-1 text-xs break-all">{result.error}</div>
                </>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2 border-t pt-3">
            <button type="button" onClick={onClose}
              className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">Kapat</button>
            <button type="submit" disabled={loading}
              className="inline-flex items-center gap-2 rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
              Kes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Detail drawer ─────────────────────────────────────────────────────
function InvoiceDetailDrawer({ id, onClose, onChanged }: { id: number; onClose: () => void; onChanged: () => void }) {
  const [inv, setInv] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const d = await apiFetch(`/admin/invoices/${id}`);
        setInv(d.invoice);
      } catch (e: any) {
        setInv({ error: e?.message });
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const lineItems = useMemo(() => {
    if (!inv?.line_items) return [];
    return typeof inv.line_items === "string" ? JSON.parse(inv.line_items) : inv.line_items;
  }, [inv]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <div className="h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-5 py-3">
          <h3 className="text-lg font-semibold text-gray-900">
            Fatura #{id} {inv?.external_invoice_code && <span className="ml-2 font-mono text-sm text-gray-500">{inv.external_invoice_code}</span>}
          </h3>
          <button onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
        </div>

        {loading && <div className="p-8 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-400" /></div>}

        {!loading && inv?.error && (
          <div className="m-5 rounded bg-red-50 p-4 text-sm text-red-800">{inv.error}</div>
        )}

        {!loading && inv && !inv.error && (
          <div className="space-y-5 p-5">
            {/* Status */}
            <div className="flex items-center gap-3">
              {statusChip(inv.status)}
              {typeChip(inv.invoice_type)}
              <span className="text-xs text-gray-500">Sağlayıcı: {inv.provider} ({inv.env})</span>
            </div>

            {inv.viewer_url && (
              <a href={inv.viewer_url} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
                <ExternalLink className="h-4 w-4" /> Faturayı Görüntüle
              </a>
            )}

            {inv.last_error && (
              <div className="rounded border border-red-200 bg-red-50 p-3">
                <div className="mb-1 text-xs font-semibold text-red-800">Son Hata</div>
                <div className="whitespace-pre-wrap break-all font-mono text-xs text-red-700">{inv.last_error}</div>
              </div>
            )}

            {/* Buyer */}
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Alıcı</div>
              <div className="rounded border border-gray-200 bg-gray-50 p-3 text-sm">
                <div className="font-medium text-gray-900">{inv.buyer_name}</div>
                <div className="text-gray-600">{inv.buyer_email}</div>
                <div className="mt-1 text-xs text-gray-500">
                  Tip: {inv.buyer_type === "individual" ? "Bireysel" : inv.buyer_type === "corporate" ? "Kurumsal" : "Yabancı"}
                  {inv.buyer_tax_id && <> · VKN/TC: {inv.buyer_tax_id}</>}
                  {inv.buyer_tax_office && <> · V.D.: {inv.buyer_tax_office}</>}
                </div>
                {(inv.buyer_address || inv.buyer_city) && (
                  <div className="mt-1 text-xs text-gray-500">
                    {[inv.buyer_address, inv.buyer_district, inv.buyer_city].filter(Boolean).join(", ")}
                  </div>
                )}
              </div>
            </div>

            {/* Line items */}
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Satırlar</div>
              <div className="overflow-hidden rounded border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Ürün</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Adet</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Birim (KDV hariç)</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">KDV</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {lineItems.map((li: any, i: number) => (
                      <tr key={i}>
                        <td className="px-3 py-2">
                          <div className="text-gray-900">{li.productName}</div>
                          <div className="text-[11px] text-gray-500">{li.productCode}</div>
                        </td>
                        <td className="px-3 py-2 text-right">{li.quantity}</td>
                        <td className="px-3 py-2 text-right">{formatTRY(li.unitPriceKurus)}</td>
                        <td className="px-3 py-2 text-right">%{li.vatRate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals */}
            <div className="rounded border border-gray-200 bg-gray-50 p-3">
              <Row label="Ara Toplam" value={formatTRY(inv.subtotal_kurus)} />
              {inv.discount_kurus > 0 && <Row label="İskonto" value={`- ${formatTRY(inv.discount_kurus)}`} />}
              <Row label="KDV" value={formatTRY(inv.vat_kurus)} />
              <div className="mt-1 border-t pt-1">
                <Row label="TOPLAM" value={formatTRY(inv.total_kurus)} bold />
              </div>
            </div>

            {/* Meta */}
            <div className="rounded border border-gray-200 bg-white p-3 text-xs">
              <div className="grid grid-cols-2 gap-2 text-gray-600">
                <div><strong>Kaynak:</strong> {inv.source_type} #{inv.source_id}</div>
                <div><strong>Sipariş No:</strong> {inv.order_id ?? "—"}</div>
                <div><strong>Fatura Tarihi:</strong> {inv.invoice_date}</div>
                <div><strong>Oluşturuldu:</strong> {formatDate(inv.created_at)}</div>
                <div><strong>Gönderildi:</strong> {formatDate(inv.sent_at)}</div>
                <div><strong>Deneme:</strong> {inv.attempts}</div>
                {inv.ettn && <div className="col-span-2 break-all"><strong>ETTN:</strong> <span className="font-mono">{inv.ettn}</span></div>}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
              {inv.status === "sent" && (
                <button
                  onClick={async () => {
                    try {
                      const r = await apiFetch(`/admin/invoices/${id}/refresh-viewer`, { method: "POST" });
                      if (r.url) window.open(r.url, "_blank");
                      onChanged();
                    } catch (e: any) { alert(e?.message); }
                  }}
                  className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Görüntüleme Linkini Yenile
                </button>
              )}
              {inv.status === "failed" && (
                <button
                  onClick={async () => {
                    if (!confirm("Tekrar denensin mi?")) return;
                    try {
                      const r = await apiFetch(`/admin/invoices/${id}/retry`, { method: "POST" });
                      alert(r.ok ? `✓ Yeni fatura kesildi #${r.invoiceId}` : `Hata: ${r.error}`);
                      onChanged();
                      onClose();
                    } catch (e: any) { alert(e?.message); }
                  }}
                  className="inline-flex items-center gap-1 rounded bg-amber-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-600"
                >
                  <RotateCw className="h-3.5 w-3.5" /> Tekrar Dene
                </button>
              )}
              {inv.status === "sent" && inv.invoice_type === "earchive" && (
                <button
                  onClick={async () => {
                    const reason = prompt("İptal sebebi:", "Müşteri talebi / iade");
                    if (!reason) return;
                    try {
                      const r = await apiFetch(`/admin/invoices/${id}/cancel`, {
                        method: "POST",
                        body: JSON.stringify({ reason }),
                      });
                      alert(r.ok ? "✓ İptal edildi" : `Hata: ${r.error}`);
                      onChanged();
                      onClose();
                    } catch (e: any) { alert(e?.message); }
                  }}
                  className="inline-flex items-center gap-1 rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500"
                >
                  <Ban className="h-3.5 w-3.5" /> İptal Et
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between text-sm ${bold ? "font-bold text-gray-900" : "text-gray-700"}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

// ─── Faturalanmamış Siparişler paneli ─────────────────────────────────
type UnbilledOrder = {
  order_key: string;
  order_id: string | null;
  first_id: number;
  buyer_email: string;
  buyer_name: string | null;
  invoice_type: string | null;
  tax_id: string | null;
  company_name: string | null;
  total_amount: string;
  currency: string;
  item_count: number;
  created_at: string;
  paid_at: string | null;
};

function UnbilledOrdersPanel({ onIssued }: { onIssued: () => void }) {
  const [orders, setOrders] = useState<UnbilledOrder[]>([]);
  const [env, setEnv] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const d = await apiFetch("/admin/invoices/unbilled");
      setOrders(d.orders ?? []);
      setEnv(d.env ?? "");
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function issue(order: UnbilledOrder) {
    if (!confirm(`${order.buyer_email} için ${formatTRY(Number(order.total_amount) * 100)} tutarında fatura kesilsin mi?\n\nOrtam: ${env.toUpperCase()}`)) {
      return;
    }
    setIssuing(prev => new Set(prev).add(order.first_id));
    try {
      const r = await apiFetch("/admin/invoices/issue-for-purchase", {
        method: "POST",
        body: JSON.stringify({
          purchaseId: order.first_id,
          orderId: order.order_id || undefined,
        }),
      });
      if (r.ok) {
        alert(`✓ Fatura kesildi\nKod: ${r.externalInvoiceCode}\nETTN: ${r.ettn}`);
        load();
        onIssued();
      } else {
        alert(`Hata: ${r.error || "Bilinmeyen"}`);
      }
    } catch (e: any) {
      alert(`Hata: ${e?.message}`);
    } finally {
      setIssuing(prev => {
        const n = new Set(prev);
        n.delete(order.first_id);
        return n;
      });
    }
  }

  async function issueAll() {
    if (!confirm(`${orders.length} sipariş için toplu fatura kesilsin mi?\n\nOrtam: ${env.toUpperCase()}\n\nBu işlem birkaç dakika sürebilir, sayfayı kapatmayın.`)) {
      return;
    }
    for (const order of orders) {
      // Sırayla — paralel yaparsak Luca rate limit yiyebilir
      try {
        setIssuing(prev => new Set(prev).add(order.first_id));
        await apiFetch("/admin/invoices/issue-for-purchase", {
          method: "POST",
          body: JSON.stringify({
            purchaseId: order.first_id,
            orderId: order.order_id || undefined,
          }),
        });
      } catch (e) {
        console.warn("issue failed for", order.first_id, e);
      } finally {
        setIssuing(prev => {
          const n = new Set(prev);
          n.delete(order.first_id);
          return n;
        });
      }
      // 500ms bekle — Luca'yı yormayalım
      await new Promise(r => setTimeout(r, 500));
    }
    load();
    onIssued();
    alert("Toplu kesme tamamlandı");
  }

  if (loading) {
    return (
      <div className="mb-6 rounded-lg bg-white p-4 shadow ring-1 ring-gray-200">
        <Loader2 className="h-4 w-4 animate-spin text-gray-400 mx-auto" />
      </div>
    );
  }

  if (orders.length === 0) return null;

  return (
    <div className="mb-6 rounded-lg border-2 border-amber-300 bg-amber-50 shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-amber-100/50 transition"
      >
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-amber-600" />
          <div className="text-left">
            <div className="font-semibold text-amber-900">
              {orders.length} sipariş faturalanmamış
            </div>
            <div className="text-xs text-amber-700">
              {env.toUpperCase()} ortamında bu siparişlerin faturası yok — tıkla kes
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {expanded && (
            <button
              onClick={(e) => { e.stopPropagation(); issueAll(); }}
              disabled={issuing.size > 0}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 px-3 py-1.5 text-xs font-bold text-white shadow-sm disabled:opacity-50"
            >
              {issuing.size > 0 ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileCheck2 className="h-3.5 w-3.5" />}
              Hepsini Kes ({orders.length})
            </button>
          )}
          <span className="text-amber-600 text-xs">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-amber-200 max-h-[400px] overflow-y-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-amber-100/50 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-amber-900">Alıcı</th>
                <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-amber-900">Ürün</th>
                <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-amber-900">Tutar</th>
                <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-amber-900">Tarih</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-200/50 bg-white">
              {orders.map((o) => {
                const isIssuing = issuing.has(o.first_id);
                return (
                  <tr key={o.order_key} className="hover:bg-amber-50/30">
                    <td className="px-3 py-2">
                      <div className="font-medium text-gray-900 text-sm">{o.buyer_name || "—"}</div>
                      <div className="text-xs text-gray-500">{o.buyer_email}</div>
                      {o.invoice_type === "corporate" && (
                        <div className="text-[10px] text-indigo-700 mt-0.5">
                          🏢 {o.company_name || "Kurumsal"} · VKN: {o.tax_id || "—"}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600">
                      {o.item_count > 1 ? `🛒 Sepet · ${o.item_count} kitap` : "📚 1 kitap"}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-gray-900">
                      {formatTRY(Number(o.total_amount) * 100)}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">
                      {formatDate(o.paid_at ?? o.created_at)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => issue(o)}
                        disabled={isIssuing}
                        className="inline-flex items-center gap-1 rounded bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        {isIssuing ? (
                          <><Loader2 className="h-3 w-3 animate-spin" /> Kesiliyor…</>
                        ) : (
                          <><FileCheck2 className="h-3 w-3" /> Kes</>
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
