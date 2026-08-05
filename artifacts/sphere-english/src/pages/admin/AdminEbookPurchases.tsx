import { useEffect, useState, useMemo } from "react";
import {
  ShoppingBag,
  RefreshCw,
  Loader2,
  AlertCircle,
  X,
  Receipt,
  CheckCircle2,
  Clock,
  XCircle,
  Search,
  Download,
  TrendingUp,
  Building2,
  User as UserIcon,
  Mail,
  Send,
  Check,
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

interface PurchaseItem {
  id: number;
  ebook_id: number;
  ebook_title: string;
  ebook_slug: string;
  ebook_cover_url: string | null;
  amount_paid: string;
  currency: string;
  download_token: string | null;
  download_count: number;
  download_expires_at: string | null;
  invoice_status: string;
  invoice_number: string | null;
  invoice_notes: string | null;
  payment_status: string;
  payment_error: string | null;
  created_at: string;
  paid_at: string | null;
}

interface Purchase {
  id: number;
  ebook_id: number;
  ebook_title: string;
  ebook_slug: string;
  buyer_email: string;
  buyer_name: string | null;
  buyer_phone: string | null;
  invoice_type: "individual" | "corporate";
  tax_id: string | null;
  tax_office: string | null;
  company_name: string | null;
  billing_address: string | null;
  billing_city: string | null;
  billing_district: string | null;
  billing_postal_code: string | null;
  amount_paid: string;
  currency: string;
  iyzico_payment_id: string | null;
  iyzico_conversation_id: string | null;
  payment_status: "pending" | "success" | "failed" | "expired" | "mixed";
  payment_error: string | null;
  invoice_status: "pending" | "issued" | "sent" | "cancelled" | "partial";
  invoice_number: string | null;
  invoice_issued_at: string | null;
  invoice_notes: string | null;
  download_token: string | null;
  download_count: number;
  download_expires_at: string | null;
  mail_sent_at: string | null;
  mail_status: "pending" | "sent" | "failed" | null;
  mail_error: string | null;
  mail_attempts: number;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  // ─── Order-level grouping (yeni) ─────
  order_id?: string | null;
  order_key?: string;
  first_purchase_id?: number;
  item_count?: number;
  items?: PurchaseItem[];
}

interface Stats {
  total: number;
  success_count: number;
  pending_count: number;
  failed_count: number;
  pending_invoices: number;
  issued_invoices: number;
  total_revenue: string;
  revenue_30d: string;
}

function formatTRY(amount: string | number | null) {
  if (amount == null) return "—";
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(n)) return "—";
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: Purchase["payment_status"] }) {
  const map: Record<string, { label: string; cls: string; icon: JSX.Element }> = {
    success: {
      label: "Başarılı",
      cls: "bg-emerald-100 text-emerald-800",
      icon: <CheckCircle2 size={11} />,
    },
    pending: {
      label: "Bekleyen",
      cls: "bg-amber-100 text-amber-800",
      icon: <Clock size={11} />,
    },
    failed: {
      label: "Başarısız",
      cls: "bg-red-100 text-red-800",
      icon: <XCircle size={11} />,
    },
    expired: {
      label: "Süresi Geçti",
      cls: "bg-slate-100 text-slate-600",
      icon: <Clock size={11} />,
    },
  };
  const m = map[status] ?? map.pending;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${m.cls}`}
    >
      {m.icon} {m.label}
    </span>
  );
}

function InvoiceBadge({ status }: { status: Purchase["invoice_status"] }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: "Kesilmedi", cls: "bg-amber-50 text-amber-700 border border-amber-200" },
    issued: { label: "Kesildi", cls: "bg-sky-50 text-sky-700 border border-sky-200" },
    sent: { label: "Gönderildi", cls: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
    cancelled: { label: "İptal", cls: "bg-slate-100 text-slate-500" },
  };
  const m = map[status] ?? map.pending;
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase ${m.cls}`}>
      {m.label}
    </span>
  );
}

export default function AdminEbookPurchases() {
  const [items, setItems] = useState<Purchase[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Purchase | null>(null);

  // Filtreler
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [invoiceFilter, setInvoiceFilter] = useState<string>("all");
  const [searchInput, setSearchInput] = useState("");
  const [searchActive, setSearchActive] = useState("");

  async function loadList() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (invoiceFilter !== "all") params.set("invoiceStatus", invoiceFilter);
      if (searchActive) params.set("search", searchActive);
      params.set("limit", "100");
      const data = await apiFetch(`/admin/ebook-purchases?${params.toString()}`);
      setItems(data.purchases ?? []);
    } catch (e: any) {
      alert("Liste yüklenemedi: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadStats() {
    try {
      const data = await apiFetch("/admin/ebook-purchases/stats");
      setStats(data.stats ?? null);
    } catch {
      // sessizce geç
    }
  }

  useEffect(() => {
    loadList();
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, invoiceFilter, searchActive]);

  const filteredCount = items.length;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <ShoppingBag className="w-7 h-7 text-emerald-600" />
          <h1 className="text-2xl font-bold text-slate-900">E-Kitap Satışları</h1>
        </div>
        <div className="flex items-center gap-2">
          <TestMailButton />
          <button
            onClick={() => {
              loadList();
              loadStats();
            }}
            className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700"
          >
            <RefreshCw size={14} /> Yenile
          </button>
        </div>
      </div>
      <p className="text-sm text-slate-500 mb-6">
        Dijital kitap satın almaları, fatura bilgileri ve fatura kesim durumu.
      </p>

      {/* ─── İstatistik kartları ────────────────────────────── */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <StatCard
            label="Toplam Satış"
            value={String(stats.success_count)}
            sub={`${stats.pending_count} bekleyen · ${stats.failed_count} başarısız`}
            icon={<CheckCircle2 size={18} />}
            color="emerald"
          />
          <StatCard
            label="Toplam Ciro"
            value={formatTRY(stats.total_revenue)}
            sub="Tüm zamanlar"
            icon={<TrendingUp size={18} />}
            color="sky"
          />
          <StatCard
            label="Son 30 Gün"
            value={formatTRY(stats.revenue_30d)}
            sub="Geçen 30 günlük ciro"
            icon={<TrendingUp size={18} />}
            color="violet"
          />
          <StatCard
            label="Bekleyen Fatura"
            value={String(stats.pending_invoices)}
            sub={`${stats.issued_invoices} kesilmiş`}
            icon={<Receipt size={18} />}
            color={stats.pending_invoices > 0 ? "amber" : "slate"}
          />
        </div>
      )}

      {/* ─── Filtreler ───────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 mb-4 flex flex-wrap items-center gap-2">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white"
        >
          <option value="all">Tüm Durumlar</option>
          <option value="success">Başarılı</option>
          <option value="pending">Bekleyen</option>
          <option value="failed">Başarısız</option>
        </select>

        <select
          value={invoiceFilter}
          onChange={(e) => setInvoiceFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white"
        >
          <option value="all">Tüm Faturalar</option>
          <option value="pending">Kesilmemiş</option>
          <option value="issued">Kesildi</option>
          <option value="sent">Gönderildi</option>
          <option value="cancelled">İptal</option>
        </select>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSearchActive(searchInput.trim());
          }}
          className="flex-1 min-w-[200px] flex items-center gap-2"
        >
          <div className="relative flex-1">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="E-posta, isim, şirket, fatura no…"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-sm font-semibold text-slate-700"
          >
            Ara
          </button>
          {searchActive && (
            <button
              type="button"
              onClick={() => {
                setSearchInput("");
                setSearchActive("");
              }}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              Temizle
            </button>
          )}
        </form>
      </div>

      {/* ─── Liste ───────────────────────────────────────── */}
      {loading ? (
        <div className="text-center py-16 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin inline-block mr-2" />
          Yükleniyor…
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-xl">
          <AlertCircle className="w-10 h-10 mx-auto text-slate-300 mb-3" />
          <div className="text-slate-500">Bu filtrelerle satın alma bulunamadı.</div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 text-[11px] text-slate-500">
            {filteredCount} kayıt
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="text-left p-3">Alıcı</th>
                <th className="text-left p-3">Kitap</th>
                <th className="text-left p-3">Fatura Tipi</th>
                <th className="text-right p-3">Tutar</th>
                <th className="text-center p-3">Ödeme</th>
                <th className="text-center p-3">Fatura</th>
                <th className="text-left p-3">Tarih</th>
                <th className="text-right p-3"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50 cursor-pointer"
                  onClick={() => setSelected(p)}
                >
                  <td className="p-3">
                    <div className="font-bold text-sm text-slate-900">
                      {p.buyer_name || "—"}
                    </div>
                    <div className="text-xs text-slate-500">{p.buyer_email}</div>
                  </td>
                  <td className="p-3 text-sm text-slate-700">
                    {p.item_count && p.item_count > 1 ? (
                      <>
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                            🛒 Sepet · {p.item_count} kitap
                          </span>
                        </div>
                        <div className="mt-1 space-y-0.5">
                          {(p.items ?? []).slice(0, 3).map((it) => (
                            <div key={it.id} className="text-[11px] text-slate-600 truncate max-w-[280px]" title={it.ebook_title}>
                              • {it.ebook_title}
                            </div>
                          ))}
                          {(p.items?.length ?? 0) > 3 && (
                            <div className="text-[10px] text-slate-400 italic">
                              +{(p.items!.length - 3)} kitap daha
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="font-semibold">{p.ebook_title}</div>
                        <div className="text-[11px] text-slate-400">/{p.ebook_slug}</div>
                      </>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1.5">
                      {p.invoice_type === "corporate" ? (
                        <>
                          <Building2 size={12} className="text-slate-400" />
                          <span className="text-xs text-slate-700">Kurumsal</span>
                        </>
                      ) : (
                        <>
                          <UserIcon size={12} className="text-slate-400" />
                          <span className="text-xs text-slate-700">Bireysel</span>
                        </>
                      )}
                    </div>
                    {p.company_name && (
                      <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                        {p.company_name}
                      </div>
                    )}
                  </td>
                  <td className="p-3 text-right font-bold text-sm text-slate-900">
                    {formatTRY(p.amount_paid)}
                  </td>
                  <td className="p-3 text-center">
                    <StatusBadge status={p.payment_status} />
                  </td>
                  <td className="p-3 text-center">
                    {p.payment_status === "success" ? (
                      <InvoiceBadge status={p.invoice_status} />
                    ) : (
                      <span className="text-[10px] text-slate-300">—</span>
                    )}
                  </td>
                  <td className="p-3 text-xs text-slate-500">
                    {formatDate(p.paid_at ?? p.created_at)}
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelected(p);
                      }}
                      className="text-xs text-emerald-600 hover:text-emerald-800 font-semibold"
                    >
                      Detay →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── Detay drawer ─────────────────────────────── */}
      {selected && (
        <PurchaseDetail
          purchase={selected}
          onClose={() => setSelected(null)}
          onUpdated={(updated) => {
            setSelected(updated);
            // Listede de güncelle
            setItems((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
            loadStats();
          }}
        />
      )}
    </div>
  );
}

function TestMailButton() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function send() {
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setMsg({ kind: "err", text: "Geçerli bir e-posta girin." });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const data = await apiFetch("/admin/ebook-purchases/test-email", {
        method: "POST",
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      setMsg({ kind: "ok", text: data.message ?? "Test mail gönderildi" });
    } catch (e: any) {
      setMsg({ kind: "err", text: e.message });
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-bold border border-sky-200"
        title="Mail altyapısını test et"
      >
        <Mail size={14} /> Test Mail Gönder
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={() => setOpen(false)}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-lg text-slate-900">Test Mail Gönder</h3>
          <button
            onClick={() => setOpen(false)}
            className="p-1 hover:bg-slate-100 rounded-lg text-slate-500"
          >
            <X size={16} />
          </button>
        </div>
        <p className="text-[13px] text-slate-600 mb-4">
          E-kitap teslimat mail'inin gerçek görünümünü kendi mail kutuna gönder. SMTP / Resend
          yapılandırmasını ve template'i doğrulamak için.
        </p>

        <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
          Alıcı E-posta
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="kendi@maildresin.com"
          className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none"
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
        />

        {msg && (
          <div
            className={`mt-3 p-2 rounded text-[12px] ${
              msg.kind === "ok"
                ? "bg-emerald-50 border border-emerald-200 text-emerald-900"
                : "bg-red-50 border border-red-200 text-red-900"
            }`}
          >
            {msg.text}
          </div>
        )}

        <button
          onClick={send}
          disabled={busy}
          className="mt-4 w-full py-2.5 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-sm font-bold inline-flex items-center justify-center gap-2"
        >
          {busy ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Gönderiliyor…
            </>
          ) : (
            <>
              <Send size={14} /> Test Mail'i Gönder
            </>
          )}
        </button>

        <p className="text-[10px] text-slate-400 mt-3 leading-relaxed">
          Mail içinde örnek bir kitap (kataloğun ilk aktif kitabı) ve dummy bir indirme bağlantısı
          var. Linke tıklarsan "geçersiz token" hatası alırsın — bu normal.
        </p>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  icon: JSX.Element;
  color: "emerald" | "sky" | "violet" | "amber" | "slate";
}) {
  const colorMap: Record<string, string> = {
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
    sky: "bg-sky-50 text-sky-700 border-sky-100",
    violet: "bg-violet-50 text-violet-700 border-violet-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    slate: "bg-slate-50 text-slate-600 border-slate-100",
  };
  return (
    <div className={`p-4 rounded-xl border ${colorMap[color]}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="text-[11px] font-bold uppercase tracking-wider opacity-70">
          {label}
        </div>
        {icon}
      </div>
      <div className="text-2xl font-extrabold">{value}</div>
      <div className="text-[11px] opacity-70 mt-1">{sub}</div>
    </div>
  );
}

function PurchaseDetail({
  purchase,
  onClose,
  onUpdated,
}: {
  purchase: Purchase;
  onClose: () => void;
  onUpdated: (p: Purchase) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState(purchase.invoice_number ?? "");
  const [invoiceStatus, setInvoiceStatus] = useState<Purchase["invoice_status"]>(
    purchase.invoice_status,
  );
  const [invoiceNotes, setInvoiceNotes] = useState(purchase.invoice_notes ?? "");
  const [error, setError] = useState<string | null>(null);

  const downloadUrl = useMemo(() => {
    if (!purchase.download_token) return null;
    return `${API.replace(/\/api$/, "")}/api/ebooks/download?token=${encodeURIComponent(purchase.download_token)}`;
  }, [purchase.download_token]);

  async function saveInvoice() {
    setBusy(true);
    setError(null);
    try {
      const data = await apiFetch(`/admin/ebook-purchases/${purchase.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          invoiceStatus,
          invoiceNumber: invoiceNumber.trim() || null,
          invoiceNotes: invoiceNotes.trim() || null,
        }),
      });
      onUpdated(data.purchase as Purchase);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div
        className="ml-auto w-full max-w-2xl h-full bg-white shadow-2xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Satın Alma #{purchase.id}</h2>
            <div className="flex items-center gap-2 mt-1">
              <StatusBadge status={purchase.payment_status} />
              {purchase.payment_status === "success" && (
                <InvoiceBadge status={purchase.invoice_status} />
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Kitap */}
          <Section title="Kitap">
            <Row label="Başlık" value={purchase.ebook_title} />
            <Row label="Slug" value={`/${purchase.ebook_slug}`} mono />
            <Row label="Tutar" value={formatTRY(purchase.amount_paid)} bold />
          </Section>

          {/* Alıcı */}
          <Section title="Alıcı Bilgileri">
            <Row label="Ad Soyad" value={purchase.buyer_name ?? "—"} />
            <Row label="E-posta" value={purchase.buyer_email} mono />
            <Row label="Telefon" value={purchase.buyer_phone ?? "—"} mono />
          </Section>

          {/* Fatura */}
          <Section title="Fatura Bilgileri">
            <Row
              label="Tip"
              value={purchase.invoice_type === "corporate" ? "Kurumsal" : "Bireysel"}
            />
            <Row
              label={purchase.invoice_type === "corporate" ? "VKN" : "TC Kimlik No"}
              value={purchase.tax_id ?? "—"}
              mono
            />
            {purchase.invoice_type === "corporate" && (
              <>
                <Row label="Vergi Dairesi" value={purchase.tax_office ?? "—"} />
                <Row label="Şirket Unvanı" value={purchase.company_name ?? "—"} />
              </>
            )}
            <Row label="Adres" value={purchase.billing_address ?? "—"} />
            <Row
              label="İl / İlçe"
              value={`${purchase.billing_city ?? "—"} / ${purchase.billing_district ?? "—"}`}
            />
            <Row label="Posta Kodu" value={purchase.billing_postal_code ?? "—"} mono />
          </Section>

          {/* Ödeme detayı */}
          <Section title="Ödeme Detayı">
            <Row label="Iyzico Payment ID" value={purchase.iyzico_payment_id ?? "—"} mono />
            <Row
              label="Conversation ID"
              value={purchase.iyzico_conversation_id ?? "—"}
              mono
            />
            <Row label="Ödeme Tarihi" value={formatDateTime(purchase.paid_at)} />
            {purchase.payment_error && (
              <div className="mt-2 p-2 rounded bg-red-50 border border-red-200 text-[11px] text-red-900">
                <strong>Hata:</strong> {purchase.payment_error}
              </div>
            )}
          </Section>

          {/* İndirme */}
          {purchase.payment_status === "success" && downloadUrl && (
            <Section title="İndirme Erişimi">
              <Row label="İndirme Sayısı" value={`${purchase.download_count} / 10`} />
              <Row
                label="Süresi"
                value={
                  purchase.download_expires_at
                    ? formatDateTime(purchase.download_expires_at)
                    : "—"
                }
              />
              <a
                href={downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 mt-2 text-sm text-emerald-700 hover:text-emerald-900 font-semibold"
              >
                <Download size={14} /> İndirme linkini test et (admin için)
              </a>
            </Section>
          )}

          {/* Bekleyen kayıt için manuel aktivasyon */}
          {purchase.payment_status === "pending" && (
            <ManualActivateSection purchase={purchase} onUpdated={onUpdated} />
          )}

          {/* Mail durumu + yeniden gönder */}
          {purchase.payment_status === "success" && (
            <MailSection purchase={purchase} onUpdated={onUpdated} />
          )}

          {/* Fatura yönetimi */}
          {purchase.payment_status === "success" && (
            <Section title="Fatura Yönetimi" tone="amber">
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                    Fatura Durumu
                  </label>
                  <select
                    value={invoiceStatus}
                    onChange={(e) =>
                      setInvoiceStatus(e.target.value as Purchase["invoice_status"])
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white"
                  >
                    <option value="pending">Kesilmedi</option>
                    <option value="issued">Kesildi</option>
                    <option value="sent">Müşteriye Gönderildi</option>
                    <option value="cancelled">İptal Edildi</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                    Fatura No
                  </label>
                  <input
                    type="text"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder="GIB-2026-000123 / SHE-2026-001 vb."
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                    Notlar (sadece admin görür)
                  </label>
                  <textarea
                    value={invoiceNotes}
                    onChange={(e) => setInvoiceNotes(e.target.value)}
                    rows={2}
                    placeholder="ör: e-Arşiv portalından kesildi, müşteriye e-posta gönderildi…"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                  />
                </div>

                {purchase.invoice_issued_at && (
                  <div className="text-[11px] text-slate-500">
                    Fatura tarihi: {formatDateTime(purchase.invoice_issued_at)}
                  </div>
                )}

                {error && (
                  <div className="p-2 rounded bg-red-50 border border-red-200 text-[11px] text-red-900">
                    {error}
                  </div>
                )}

                <button
                  onClick={saveInvoice}
                  disabled={busy}
                  className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-bold"
                >
                  {busy ? "Kaydediliyor…" : "Fatura Bilgisini Kaydet"}
                </button>
              </div>
            </Section>
          )}

          {/* Zaman damgaları */}
          <Section title="Zaman Damgaları" small>
            <Row label="Oluşturuldu" value={formatDateTime(purchase.created_at)} />
            <Row label="Güncellendi" value={formatDateTime(purchase.updated_at)} />
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
  tone,
  small,
}: {
  title: string;
  children: React.ReactNode;
  tone?: "amber";
  small?: boolean;
}) {
  const toneCls =
    tone === "amber"
      ? "border-amber-200 bg-amber-50/40"
      : "border-slate-200 bg-white";
  return (
    <div className={`rounded-xl border p-4 ${toneCls}`}>
      <h3
        className={`font-bold text-slate-800 mb-3 ${
          small ? "text-[11px] uppercase tracking-wider text-slate-500" : "text-sm"
        }`}
      >
        {title}
      </h3>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function MailSection({
  purchase,
  onUpdated,
}: {
  purchase: Purchase;
  onUpdated: (p: Purchase) => void;
}) {
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const mailBadge = () => {
    if (purchase.mail_status === "sent") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
          <CheckCircle2 size={11} /> Gönderildi
        </span>
      );
    }
    if (purchase.mail_status === "failed") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-red-100 text-red-800">
          <XCircle size={11} /> Başarısız
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-800">
        <Clock size={11} /> Bekliyor
      </span>
    );
  };

  async function resend() {
    setSending(true);
    setMsg(null);
    try {
      const data = await apiFetch(`/admin/ebook-purchases/${purchase.id}/resend-email`, {
        method: "POST",
      });
      setMsg({
        kind: "ok",
        text: `Mail gönderildi: ${data.to} (deneme #${data.mailAttempts ?? "?"})`,
      });
      // Detayı yenile
      const fresh = await apiFetch(`/admin/ebook-purchases/${purchase.id}`);
      if (fresh.purchase) onUpdated(fresh.purchase as Purchase);
    } catch (e: any) {
      setMsg({ kind: "err", text: e.message });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50/40 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
          <Mail size={14} /> Bilgilendirme Maili
        </h3>
        {mailBadge()}
      </div>

      <div className="space-y-1.5">
        <Row label="Alıcı" value={purchase.buyer_email} mono />
        <Row
          label="İlk Gönderim"
          value={purchase.mail_sent_at ? formatDateTime(purchase.mail_sent_at) : "Henüz yok"}
        />
        <Row label="Toplam Deneme" value={String(purchase.mail_attempts ?? 0)} />
        {purchase.mail_error && (
          <div className="mt-2 p-2 rounded bg-red-50 border border-red-200 text-[11px] text-red-900">
            <strong>Son hata:</strong> {purchase.mail_error}
          </div>
        )}
      </div>

      {msg && (
        <div
          className={`mt-3 p-2 rounded text-[12px] ${
            msg.kind === "ok"
              ? "bg-emerald-50 border border-emerald-200 text-emerald-900"
              : "bg-red-50 border border-red-200 text-red-900"
          }`}
        >
          {msg.text}
        </div>
      )}

      <button
        onClick={resend}
        disabled={sending}
        className="mt-3 w-full py-2.5 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-sm font-bold inline-flex items-center justify-center gap-2"
      >
        {sending ? (
          <>
            <Loader2 size={14} className="animate-spin" /> Gönderiliyor…
          </>
        ) : (
          <>
            <Send size={14} /> {purchase.mail_status === "sent" ? "Linki Yeniden Gönder" : "Mail Gönder"}
          </>
        )}
      </button>
    </div>
  );
}

// ─── Bekleyen satışları manuel aktive etme bölümü ────────────────────────
function ManualActivateSection({
  purchase,
  onUpdated,
}: {
  purchase: Purchase;
  onUpdated: (p: Purchase) => void;
}) {
  const [activating, setActivating] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [resultDownloadUrl, setResultDownloadUrl] = useState<string | null>(null);

  async function manualActivate() {
    if (
      !confirm(
        "Bu satışı 'success' durumuna çevirip download token üretmek istediğinden emin misin?\n\n" +
        "→ Müşteriye PDF indirme bağlantısı mail olarak gönderilecek\n" +
        "→ Admin'lere yeni satış bildirimi gönderilecek\n" +
        "→ Satın alma 'success' olarak işaretlenecek\n\n" +
        "Bu işlem geri alınamaz."
      )
    ) {
      return;
    }
    setActivating(true);
    setMsg(null);
    setResultDownloadUrl(null);
    try {
      const data = await apiFetch(`/admin/ebook-purchases/${purchase.id}/manual-activate`, {
        method: "POST",
      });
      setMsg({
        kind: "ok",
        text: data.message ?? "Aktivasyon başarılı. Mail gönderildi.",
      });
      // Yeni download URL'i göster (test için)
      if (data.purchase?.downloadToken) {
        const apiBase = (API || "").replace(/\/$/, "");
        // /api varsa olduğu gibi, /api-server/api'ye de uyum sağla
        const url = `${apiBase}/ebooks/download?token=${encodeURIComponent(data.purchase.downloadToken)}`;
        setResultDownloadUrl(url);
      }
      // Detayı yenile
      const fresh = await apiFetch(`/admin/ebook-purchases/${purchase.id}`);
      if (fresh.purchase) onUpdated(fresh.purchase as Purchase);
    } catch (e: any) {
      setMsg({ kind: "err", text: e.message });
    } finally {
      setActivating(false);
    }
  }

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-amber-900 text-sm flex items-center gap-2">
          <Clock size={14} /> Bekleyen Satış — Kurtarma
        </h3>
      </div>

      <p className="text-[13px] text-amber-900 mb-3">
        Bu satış 'BEKLEYEN' durumunda. Iyzico tarafında ödeme tamamlanmış olabilir ama
        Sphere'de aktif edilememiş. Aşağıdaki butonu kullanarak manuel aktive
        edebilirsin — müşteriye PDF mail'i gönderilir, admin'lere bildirim atılır.
      </p>

      <div className="bg-amber-100/60 rounded p-2 text-[12px] text-amber-900 mb-3 space-y-1">
        <div>
          <strong>İpucu:</strong> Önce Iyzico panelinden ödemenin <em>gerçekten</em>{" "}
          tahsil edildiğini doğrula. Tahsil edilmediyse iade et, aktive etme.
        </div>
      </div>

      {msg && (
        <div
          className={`mb-3 p-2 rounded text-[12px] ${
            msg.kind === "ok"
              ? "bg-emerald-50 border border-emerald-200 text-emerald-900"
              : "bg-red-50 border border-red-200 text-red-900"
          }`}
        >
          {msg.text}
        </div>
      )}

      {resultDownloadUrl && (
        <div className="mb-3 p-3 rounded bg-emerald-50 border border-emerald-300">
          <div className="text-[11px] font-bold uppercase text-emerald-700 mb-2">
            Yeni İndirme Linki (Test Et)
          </div>
          <a
            href={resultDownloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[12px] text-emerald-800 hover:text-emerald-900 underline break-all"
          >
            <Download size={13} /> {resultDownloadUrl}
          </a>
          <button
            onClick={() => {
              if (resultDownloadUrl) navigator.clipboard?.writeText(resultDownloadUrl);
            }}
            className="ml-2 text-[11px] px-2 py-0.5 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-900"
            title="Kopyala"
          >
            Kopyala
          </button>
          <div className="mt-2 text-[11px] text-emerald-700">
            ⏱ 7 gün geçerli, 10 indirme hakkı. Mail de gönderildi.
          </div>
        </div>
      )}

      <button
        onClick={manualActivate}
        disabled={activating}
        className="w-full py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-bold inline-flex items-center justify-center gap-2"
      >
        {activating ? (
          <>
            <Loader2 size={14} className="animate-spin" /> Aktive ediliyor…
          </>
        ) : (
          <>
            <Check size={14} /> Manuel Aktive Et (Token üret + Mail gönder)
          </>
        )}
      </button>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  bold,
}: {
  label: string;
  value: string;
  mono?: boolean;
  bold?: boolean;
}) {
  return (
    <div className="flex gap-3 text-sm">
      <div className="w-32 text-slate-500 text-xs">{label}</div>
      <div
        className={`flex-1 text-slate-800 ${mono ? "font-mono text-xs" : ""} ${
          bold ? "font-bold" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}
