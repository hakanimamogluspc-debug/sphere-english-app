import { useEffect, useMemo, useState } from "react";
import {
  Users, RefreshCw, Search, Download, Copy, Check, ExternalLink,
  Filter, AlertCircle, TrendingUp, Mail, MailCheck, MailX, Play, ShieldCheck,
  Trash2, Tag, Building2, MapPin, ChevronLeft, ChevronRight, Sparkles,
} from "lucide-react";
import { API } from "@/lib/api-url";

const TOKEN_KEY = "sphere_token";

async function apiFetch(path: string, opts?: RequestInit) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts?.headers || {}) },
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
  return res.json();
}

// ─── Tipler ──────────────────────────────────────────────────────────────
interface Lead {
  id: number;
  email: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  linkedinUrl?: string;
  jobTitle?: string;
  seniority?: string;
  location?: string;
  company?: string;
  companyDomain?: string;
  companyWebsite?: string;
  companyPhone?: string;
  industry?: string;
  segment: "b2b_hr" | "b2b_sme" | "b2c_pro" | "partner";
  source: string;
  emailVerified: boolean;
  emailStatus?: "valid" | "risky" | "invalid" | "unknown" | "catch_all";
  status: "new" | "viewed" | "contacted" | "qualified" | "rejected" | "archived";
  notes?: string;
  tags?: string;
  discoveredAt: string;
}

interface Stats {
  total: number;
  newThisWeek: number;
  validEmails: number;
  unverified: number;
  bySegment: { segment: string; count: number }[];
  byStatus: { status: string; count: number }[];
  byEmailStatus: { emailStatus: string; count: number }[];
  dailyDiscovery: { date: string; count: number }[];
  apifyConfigured: boolean;
}

interface Run {
  id: number;
  jobType: string;
  segment?: string;
  status: string;
  itemsScraped: number;
  leadsAdded: number;
  leadsUpdated: number;
  leadsSkipped: number;
  emailsVerified: number;
  errorMessage?: string;
  apifyActorId?: string;
  startedAt: string;
  completedAt?: string;
}

// ─── Sabit etiketler ─────────────────────────────────────────────────────
const SEGMENTS = [
  { value: "", label: "Tüm Segmentler" },
  { value: "b2b_hr", label: "B2B İK Müdürleri" },
  { value: "b2b_sme", label: "B2B KOBİ Sahipleri" },
  { value: "b2c_pro", label: "B2C Profesyoneller" },
  { value: "partner", label: "Eğitim Partnerleri" },
];

const STATUSES = [
  { value: "", label: "Tüm Durumlar" },
  { value: "new", label: "Yeni" },
  { value: "viewed", label: "Görüldü" },
  { value: "contacted", label: "İletişime Geçildi" },
  { value: "qualified", label: "Nitelikli" },
  { value: "rejected", label: "Reddedildi" },
  { value: "archived", label: "Arşiv" },
];

const EMAIL_STATUSES = [
  { value: "", label: "Tüm Email" },
  { value: "valid", label: "Geçerli" },
  { value: "risky", label: "Riskli" },
  { value: "invalid", label: "Geçersiz" },
  { value: "catch_all", label: "Catch-all" },
  { value: "unknown", label: "Bilinmiyor" },
];

function segmentLabel(s: string) {
  return SEGMENTS.find((x) => x.value === s)?.label ?? s;
}

function statusBadge(status: string) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    new:        { bg: "bg-blue-100", text: "text-blue-700", label: "Yeni" },
    viewed:     { bg: "bg-gray-100", text: "text-gray-700", label: "Görüldü" },
    contacted:  { bg: "bg-yellow-100", text: "text-yellow-700", label: "İletişimde" },
    qualified:  { bg: "bg-green-100", text: "text-green-700", label: "Nitelikli" },
    rejected:   { bg: "bg-red-100", text: "text-red-700", label: "Reddedildi" },
    archived:   { bg: "bg-slate-100", text: "text-slate-500", label: "Arşiv" },
  };
  const c = map[status] ?? map.new;
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${c.bg} ${c.text}`}>{c.label}</span>;
}

function emailStatusBadge(s?: string) {
  if (!s || s === "unknown")
    return <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500">Bilinmiyor</span>;
  const map: Record<string, { bg: string; text: string; label: string }> = {
    valid:     { bg: "bg-green-100", text: "text-green-700", label: "Geçerli" },
    risky:     { bg: "bg-yellow-100", text: "text-yellow-700", label: "Riskli" },
    invalid:   { bg: "bg-red-100", text: "text-red-700", label: "Geçersiz" },
    catch_all: { bg: "bg-orange-100", text: "text-orange-700", label: "Catch-all" },
  };
  const c = map[s] ?? map.valid;
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${c.bg} ${c.text}`}>{c.label}</span>;
}

// ─── Ana sayfa ──────────────────────────────────────────────────────────
export default function Outreach() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [showRuns, setShowRuns] = useState(false);

  // Filtreler
  const [segment, setSegment] = useState("");
  const [status, setStatus] = useState("");
  const [emailStatus, setEmailStatus] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  async function loadStats() {
    try {
      const s = await apiFetch("/admin/outreach/stats");
      setStats(s);
    } catch (e: any) {
      console.error(e);
    }
  }

  async function loadRuns() {
    try {
      const r = await apiFetch("/admin/outreach/runs");
      setRuns(r);
    } catch (e: any) {
      console.error(e);
    }
  }

  async function loadLeads() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (segment) params.set("segment", segment);
      if (status) params.set("status", status);
      if (emailStatus) params.set("emailStatus", emailStatus);
      if (search) params.set("search", search);
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));

      const data = await apiFetch(`/admin/outreach/leads?${params.toString()}`);
      setLeads(data.items);
      setTotalPages(data.pagination.totalPages);
      setTotal(data.pagination.total);
    } catch (e: any) {
      setError(e?.message ?? "Lead listesi alınamadı.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStats();
    loadRuns();
  }, []);

  useEffect(() => {
    loadLeads();
  }, [segment, status, emailStatus, search, page]);

  async function handleTrigger(segmentParam?: string) {
    if (!confirm(`${segmentParam ? segmentLabel(segmentParam) : "Tüm segmentler"} için keşif başlatılsın mı?\n\n~5-10 dakika sürer ve Apify kredisinden harcanır.`)) return;
    setTriggering(true);
    try {
      await apiFetch("/admin/outreach/trigger", {
        method: "POST",
        body: JSON.stringify({ segment: segmentParam, limit: 50 }),
      });
      alert("Keşif arka planda başladı. ~5-10 dakika sonra 'Yenile' butonuyla sonuçları gör.");
    } catch (e: any) {
      alert("Hata: " + e.message);
    } finally {
      setTriggering(false);
    }
  }

  async function handleVerify() {
    if (!confirm("Doğrulanmamış emailler kontrol edilsin mi? Apify kredisinden harcanır.")) return;
    setVerifying(true);
    try {
      await apiFetch("/admin/outreach/verify", {
        method: "POST",
        body: JSON.stringify({ batchSize: 100 }),
      });
      alert("Doğrulama arka planda başladı.");
    } catch (e: any) {
      alert("Hata: " + e.message);
    } finally {
      setVerifying(false);
    }
  }

  async function handleUpdateStatus(id: number, newStatus: string) {
    try {
      await apiFetch(`/admin/outreach/leads/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status: newStatus as any } : l)));
    } catch (e: any) {
      alert("Hata: " + e.message);
    }
  }

  function copyEmail(id: number, email: string) {
    navigator.clipboard.writeText(email);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  }

  function exportCsv() {
    const token = localStorage.getItem(TOKEN_KEY);
    const params = new URLSearchParams();
    if (segment) params.set("segment", segment);
    if (status) params.set("status", status);
    if (emailStatus) params.set("emailStatus", emailStatus);
    // Token query string'de güvensiz — header'la indirme için bir blob fetch yap
    fetch(`${API}/admin/outreach/export.csv?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `sphere-leads-${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      });
  }

  const segmentCount = useMemo(() => {
    const map = new Map<string, number>();
    stats?.bySegment.forEach((s) => map.set(s.segment, s.count));
    return map;
  }, [stats]);

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      {/* ─── Başlık ─── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-blue-600" />
            Otomatik Lead Keşfi
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Apify ile günlük taranan potansiyel müşteri havuzu — 4 segmentten otomatik olarak doğrulanmış email'lerle.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { loadStats(); loadRuns(); loadLeads(); }}
            className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center gap-2 text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Yenile
          </button>
          <button
            onClick={handleVerify}
            disabled={verifying || !stats?.apifyConfigured}
            className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 flex items-center gap-2 text-sm"
          >
            <ShieldCheck className="w-4 h-4" />
            {verifying ? "Doğrulanıyor..." : "Email Doğrula"}
          </button>
          <button
            onClick={() => handleTrigger()}
            disabled={triggering || !stats?.apifyConfigured}
            className="px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 text-sm font-medium"
          >
            <Play className="w-4 h-4" />
            {triggering ? "Başlatılıyor..." : "Şimdi Keşfet"}
          </button>
        </div>
      </div>

      {/* ─── Apify uyarısı ─── */}
      {stats && !stats.apifyConfigured && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900">
            <strong>Apify API anahtarı kurulu değil.</strong> Sistem çalışmaz — sunucuya
            <code className="mx-1 px-1.5 py-0.5 bg-amber-100 rounded text-xs">APIFY_API_TOKEN</code>
            ortam değişkenini ekleyin. (apify.com → Account → Integrations sayfasından alabilirsiniz.)
          </div>
        </div>
      )}

      {/* ─── İstatistik kartları ─── */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard icon={<Users className="w-5 h-5" />} label="Toplam Lead" value={stats.total} color="blue" />
          <StatCard icon={<TrendingUp className="w-5 h-5" />} label="Bu Hafta Yeni" value={stats.newThisWeek} color="green" />
          <StatCard icon={<MailCheck className="w-5 h-5" />} label="Doğrulanmış Email" value={stats.validEmails} color="emerald" />
          <StatCard icon={<MailX className="w-5 h-5" />} label="Doğrulama Bekliyor" value={stats.unverified} color="orange" />
        </div>
      )}

      {/* ─── Segment quick-trigger satırı ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {SEGMENTS.filter((s) => s.value).map((s) => (
          <div key={s.value} className="bg-white border border-slate-200 rounded-lg p-3 flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-500">{s.label}</div>
              <div className="text-lg font-bold text-slate-900 mt-0.5">
                {segmentCount.get(s.value) ?? 0}
              </div>
            </div>
            <button
              onClick={() => handleTrigger(s.value)}
              disabled={triggering || !stats?.apifyConfigured}
              className="px-2 py-1 text-xs rounded bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-50"
              title={`${s.label} için keşif başlat`}
            >
              <Play className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      {/* ─── Son keşifler (toggle) ─── */}
      <div className="bg-white border border-slate-200 rounded-lg mb-4 overflow-hidden">
        <button
          onClick={() => setShowRuns((v) => !v)}
          className="w-full px-4 py-3 flex items-center justify-between text-sm hover:bg-slate-50"
        >
          <span className="font-medium text-slate-700">Son Keşif Çalıştırmaları ({runs.length})</span>
          <span className="text-xs text-slate-400">{showRuns ? "Gizle" : "Göster"}</span>
        </button>
        {showRuns && (
          <div className="border-t border-slate-100 max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-2 text-left">Zaman</th>
                  <th className="px-4 py-2 text-left">Tür</th>
                  <th className="px-4 py-2 text-left">Segment</th>
                  <th className="px-4 py-2 text-left">Durum</th>
                  <th className="px-4 py-2 text-right">Tarama</th>
                  <th className="px-4 py-2 text-right">Yeni</th>
                  <th className="px-4 py-2 text-right">Atlanan</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="px-4 py-2 text-slate-600">{new Date(r.startedAt).toLocaleString("tr-TR")}</td>
                    <td className="px-4 py-2">{r.jobType}</td>
                    <td className="px-4 py-2 text-slate-600">{r.segment ? segmentLabel(r.segment) : "-"}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        r.status === "success" ? "bg-green-100 text-green-700" :
                        r.status === "failed" ? "bg-red-100 text-red-700" :
                        r.status === "running" ? "bg-blue-100 text-blue-700" :
                        "bg-yellow-100 text-yellow-700"
                      }`}>
                        {r.status}
                      </span>
                      {r.errorMessage && (
                        <div className="text-xs text-red-600 mt-1 truncate max-w-xs" title={r.errorMessage}>
                          {r.errorMessage}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{r.itemsScraped}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-green-700">{r.leadsAdded}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-500">{r.leadsSkipped}</td>
                  </tr>
                ))}
                {runs.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">Henüz keşif çalıştırılmadı.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Filtre çubuğu ─── */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <form onSubmit={handleSearch} className="flex-1 min-w-[240px] relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Email, isim, şirket veya pozisyon ara..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </form>

          <select
            value={segment}
            onChange={(e) => { setSegment(e.target.value); setPage(1); }}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {SEGMENTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>

          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>

          <select
            value={emailStatus}
            onChange={(e) => { setEmailStatus(e.target.value); setPage(1); }}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {EMAIL_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>

          <button
            onClick={exportCsv}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            CSV
          </button>
        </div>
      </div>

      {/* ─── Lead tablosu ─── */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-4 py-2 border-b border-slate-100 text-xs text-slate-500 flex items-center justify-between">
          <span>{total} sonuç</span>
          <span>Sayfa {page} / {totalPages || 1}</span>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border-b border-red-200 text-sm text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Kişi</th>
                <th className="px-4 py-3 text-left">Şirket / Pozisyon</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Segment</th>
                <th className="px-4 py-3 text-left">Durum</th>
                <th className="px-4 py-3 text-left">Tarih</th>
                <th className="px-4 py-3 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">Yükleniyor...</td></tr>
              )}
              {!loading && leads.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <Users className="w-12 h-12 mx-auto text-slate-200 mb-3" />
                    <div className="text-slate-500 mb-2">Henüz lead bulunmadı.</div>
                    <div className="text-xs text-slate-400">
                      "Şimdi Keşfet" butonuyla ilk keşfi başlatın. ~5 dakika içinde sonuçlar burada görünür.
                    </div>
                  </td>
                </tr>
              )}
              {!loading && leads.map((lead) => (
                <tr key={lead.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{lead.fullName || `${lead.firstName ?? ""} ${lead.lastName ?? ""}`.trim() || "—"}</div>
                    {lead.location && (
                      <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3" />
                        {lead.location}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {lead.company && (
                      <div className="font-medium text-slate-700 flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-slate-400" />
                        {lead.company}
                      </div>
                    )}
                    {lead.jobTitle && <div className="text-xs text-slate-500 mt-0.5">{lead.jobTitle}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => copyEmail(lead.id, lead.email)}
                        className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-mono"
                        title="Email'i kopyala"
                      >
                        {copiedId === lead.id ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                        {lead.email}
                      </button>
                    </div>
                    <div className="mt-1">{emailStatusBadge(lead.emailStatus)}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {segmentLabel(lead.segment)}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={lead.status}
                      onChange={(e) => handleUpdateStatus(lead.id, e.target.value)}
                      className="text-xs px-2 py-1 rounded border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {STATUSES.filter((s) => s.value).map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {new Date(lead.discoveredAt).toLocaleDateString("tr-TR")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {lead.linkedinUrl && (
                        <a href={lead.linkedinUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 text-slate-400 hover:text-blue-600" title="LinkedIn profili">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                      <a href={`mailto:${lead.email}`} className="p-1.5 text-slate-400 hover:text-blue-600" title="Mail at">
                        <Mail className="w-4 h-4" />
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-sm">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40 flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              Önceki
            </button>
            <span className="text-slate-500">Sayfa {page} / {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40 flex items-center gap-1"
            >
              Sonraki
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── StatCard ────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-green-50 text-green-700",
    emerald: "bg-emerald-50 text-emerald-700",
    orange: "bg-orange-50 text-orange-700",
  };
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorMap[color] ?? colorMap.blue}`}>
        {icon}
      </div>
      <div>
        <div className="text-xs text-slate-500">{label}</div>
        <div className="text-2xl font-bold text-slate-900">{value.toLocaleString("tr-TR")}</div>
      </div>
    </div>
  );
}
