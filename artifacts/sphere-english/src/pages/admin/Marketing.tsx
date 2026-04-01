import { useState, useEffect, useRef } from "react";
import {
  Users, Mail, TrendingUp, Eye, Send, Clock, CheckCircle, AlertCircle,
  RefreshCw, Filter, ChevronDown, BarChart3, Megaphone, Search, Tag, X,
  FileUp, Download, Trash2, FileText, FileCode, LayoutTemplate
} from "lucide-react";

const TOKEN_KEY = "sphere_token";

function getApiBase() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return base.replace("/sphere-english", "/api-server");
}

async function apiFetch(path: string, opts?: RequestInit) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${getApiBase()}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts?.headers || {}) },
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
  return res.json();
}

async function apiFetchForm(path: string, formData: FormData) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${getApiBase()}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
  return res.json();
}

interface Stats {
  users: { total: number; newToday: number; newThisWeek: number; newThisMonth: number };
  leads: { total: number; newThisWeek: number; open: number };
  pageViews: { total: number; thisWeek: number };
  campaigns: { total: number; sent: number };
  roleBreakdown: { role: string; count: number }[];
  levelBreakdown: { level: string; count: number }[];
  dailyRegistrations: { date: string; count: number }[];
  emailConfigured: boolean;
}

interface Lead {
  id: number; name: string; email: string; phone?: string;
  company?: string; message?: string; source: string; status: string;
  notes?: string; createdAt: string;
}

interface Campaign {
  id: number; subject: string; body: string; recipientFilter: string;
  recipientCount: number; sentCount: number; status: string;
  sentAt?: string; createdAt: string;
}

interface EmailTemplate {
  id: number; name: string; subject: string; htmlContent: string | null;
  fileType: "html" | "pdf"; fileName: string; filePath: string | null;
  createdAt: string;
}

type Tab = "overview" | "leads" | "email" | "templates";

const RECIPIENT_OPTIONS = [
  { value: "all", label: "Tüm Kullanıcılar" },
  { value: "role:student", label: "Tüm Öğrenciler" },
  { value: "role:teacher", label: "Tüm Öğretmenler" },
  { value: "role:corporate", label: "Kurumsal Yöneticiler" },
  { value: "level:A1", label: "A1 Seviyesi" },
  { value: "level:A2", label: "A2 Seviyesi" },
  { value: "level:B1", label: "B1 Seviyesi" },
  { value: "level:B2", label: "B2 Seviyesi" },
  { value: "level:C1", label: "C1 Seviyesi" },
  { value: "level:C2", label: "C2 Seviyesi" },
];

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  new: { label: "Yeni", color: "bg-blue-100 text-blue-700" },
  contacted: { label: "İletişime Geçildi", color: "bg-yellow-100 text-yellow-700" },
  qualified: { label: "Nitelikli", color: "bg-green-100 text-green-700" },
  lost: { label: "Kaybedildi", color: "bg-gray-100 text-gray-500" },
};

function StatCard({ icon: Icon, label, value, sub, color = "blue" }: {
  icon: any; label: string; value: number | string; sub?: string; color?: string;
}) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600", green: "bg-green-50 text-green-600",
    purple: "bg-purple-50 text-purple-600", orange: "bg-orange-50 text-orange-600",
  };
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${colors[color]}`}>
        <Icon size={22} />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function MiniBar({ items, colorFn }: { items: { label: string; count: number }[]; colorFn?: (l: string) => string }) {
  const max = Math.max(...items.map(i => i.count), 1);
  return (
    <div className="space-y-2">
      {items.map(item => (
        <div key={item.label} className="flex items-center gap-2">
          <span className="w-20 text-xs text-gray-500 text-right flex-shrink-0">{item.label}</span>
          <div className="flex-1 bg-gray-100 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${colorFn ? colorFn(item.label) : "bg-blue-500"}`}
              style={{ width: `${(item.count / max) * 100}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-gray-700 w-6">{item.count}</span>
        </div>
      ))}
    </div>
  );
}

export default function AdminMarketing() {
  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<Stats | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Lead filters
  const [leadSearch, setLeadSearch] = useState("");
  const [leadStatus, setLeadStatus] = useState("all");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [leadNote, setLeadNote] = useState("");
  const [leadStatusEdit, setLeadStatusEdit] = useState("new");

  // Email composer
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recipientFilter, setRecipientFilter] = useState("all");
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewSample, setPreviewSample] = useState<{ email: string; name: string }[]>([]);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Template upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tplName, setTplName] = useState("");
  const [tplSubject, setTplSubject] = useState("");
  const [tplFile, setTplFile] = useState<File | null>(null);
  const [tplUploading, setTplUploading] = useState(false);
  const [tplResult, setTplResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const loadAll = async () => {
    setLoading(true); setError("");
    try {
      const [s, l, c, t] = await Promise.all([
        apiFetch("/api/admin/marketing/stats"),
        apiFetch("/api/admin/marketing/leads"),
        apiFetch("/api/admin/marketing/campaigns"),
        apiFetch("/api/admin/marketing/templates"),
      ]);
      setStats(s); setLeads(l); setCampaigns(c); setTemplates(t);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const previewRecipients = async () => {
    try {
      const data = await apiFetch("/api/admin/marketing/campaigns/preview", {
        method: "POST", body: JSON.stringify({ filter: recipientFilter }),
      });
      setPreviewCount(data.count);
      setPreviewSample(data.sample || []);
    } catch {}
  };

  useEffect(() => {
    setPreviewCount(null);
    setPreviewSample([]);
  }, [recipientFilter]);

  const sendCampaign = async () => {
    if (!subject.trim() || !body.trim()) {
      setSendResult({ ok: false, msg: "Konu ve içerik boş bırakılamaz." }); return;
    }
    setSending(true); setSendResult(null);
    try {
      const data = await apiFetch("/api/admin/marketing/campaigns/send", {
        method: "POST", body: JSON.stringify({ subject, body, filter: recipientFilter }),
      });
      setSendResult({ ok: true, msg: `${data.sent} kişiye başarıyla gönderildi!${!data.smtpConfigured ? " (SMTP yapılandırılmamış — demo mod)" : ""}` });
      setSubject(""); setBody("");
      loadAll();
    } catch (e: any) {
      setSendResult({ ok: false, msg: e.message });
    } finally {
      setSending(false);
    }
  };

  const updateLead = async () => {
    if (!selectedLead) return;
    try {
      await apiFetch(`/api/admin/marketing/leads/${selectedLead.id}`, {
        method: "PATCH", body: JSON.stringify({ status: leadStatusEdit, notes: leadNote }),
      });
      setLeads(prev => prev.map(l => l.id === selectedLead.id ? { ...l, status: leadStatusEdit, notes: leadNote } : l));
      setSelectedLead(null);
    } catch {}
  };

  const uploadTemplate = async () => {
    if (!tplFile || !tplName.trim()) {
      setTplResult({ ok: false, msg: "Şablon adı ve dosya zorunludur." }); return;
    }
    setTplUploading(true); setTplResult(null);
    try {
      const fd = new FormData();
      fd.append("file", tplFile);
      fd.append("name", tplName.trim());
      fd.append("subject", tplSubject.trim());
      const data = await apiFetchForm("/api/admin/marketing/templates", fd);
      setTemplates(prev => [data.template, ...prev]);
      setTplName(""); setTplSubject(""); setTplFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setTplResult({ ok: true, msg: "Şablon başarıyla yüklendi!" });
    } catch (e: any) {
      setTplResult({ ok: false, msg: e.message });
    } finally {
      setTplUploading(false);
    }
  };

  const deleteTemplate = async (id: number) => {
    if (!confirm("Bu şablonu silmek istediğinize emin misiniz?")) return;
    try {
      await apiFetch(`/api/admin/marketing/templates/${id}`, { method: "DELETE" });
      setTemplates(prev => prev.filter(t => t.id !== id));
    } catch (e: any) {
      alert("Silme başarısız: " + e.message);
    }
  };

  const loadTemplateIntoComposer = (tpl: EmailTemplate) => {
    if (tpl.fileType === "pdf") {
      alert("PDF şablonları e-posta içeriği olarak kullanılamaz. Sadece HTML şablonları içerik olarak yüklenebilir.");
      return;
    }
    if (tpl.subject) setSubject(tpl.subject);
    if (tpl.htmlContent) setBody(tpl.htmlContent);
    setTab("email");
  };

  const downloadTemplate = (tpl: EmailTemplate) => {
    const token = localStorage.getItem(TOKEN_KEY);
    const url = `${getApiBase()}/api/admin/marketing/templates/${tpl.id}/download`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = tpl.fileName;
        a.click();
      });
  };

  const filteredLeads = leads.filter(l => {
    const matchSearch = !leadSearch || l.name.toLowerCase().includes(leadSearch.toLowerCase()) || l.email.toLowerCase().includes(leadSearch.toLowerCase());
    const matchStatus = leadStatus === "all" || l.status === leadStatus;
    return matchSearch && matchStatus;
  });

  const levelColors: Record<string, string> = {
    A1: "bg-green-400", A2: "bg-teal-400", B1: "bg-blue-400",
    B2: "bg-purple-400", C1: "bg-orange-400", C2: "bg-red-400",
  };

  const roleColors: Record<string, string> = {
    student: "bg-blue-500", teacher: "bg-purple-500",
    admin: "bg-red-500", corporate: "bg-green-500",
  };

  const roleLabels: Record<string, string> = {
    student: "Öğrenci", teacher: "Öğretmen", admin: "Admin", corporate: "Kurumsal",
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <RefreshCw size={24} className="animate-spin text-blue-500" />
    </div>
  );

  if (error) return (
    <div className="p-6 text-red-600 bg-red-50 rounded-xl">{error}</div>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pazarlama & Yönetim</h1>
          <p className="text-gray-500 text-sm mt-1">Site istatistikleri, lead yönetimi ve toplu e-posta</p>
        </div>
        <button onClick={loadAll} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-100 transition">
          <RefreshCw size={15} /> Yenile
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit flex-wrap">
        {([
          { id: "overview", label: "Genel Bakış", icon: BarChart3 },
          { id: "leads", label: `Leads (${leads.length})`, icon: Users },
          { id: "email", label: "E-posta Gönder", icon: Mail },
          { id: "templates", label: `Şablonlar (${templates.length})`, icon: LayoutTemplate },
        ] as const).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${tab === t.id ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
          >
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {tab === "overview" && stats && (
        <div className="space-y-6">
          {!stats.emailConfigured && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-amber-700">
              <AlertCircle size={16} />
              <span>SMTP yapılandırılmamış. E-posta gönderimi demo modda çalışıyor. Gerçek e-posta için <strong>SMTP_HOST, SMTP_USER, SMTP_PASS</strong> ortam değişkenlerini ayarlayın.</span>
            </div>
          )}

          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Users} label="Toplam Kullanıcı" value={stats.users.total} sub={`+${stats.users.newThisWeek} bu hafta`} color="blue" />
            <StatCard icon={TrendingUp} label="Yeni Bu Ay" value={stats.users.newThisMonth} sub={`Bugün: ${stats.users.newToday}`} color="green" />
            <StatCard icon={Megaphone} label="Lead / İletişim" value={stats.leads.total} sub={`${stats.leads.open} açık lead`} color="purple" />
            <StatCard icon={Mail} label="Kampanya Gönderildi" value={stats.campaigns.sent} sub={`Toplam ${stats.campaigns.total} kampanya`} color="orange" />
          </div>

          {/* Page Views */}
          <div className="grid grid-cols-2 gap-4">
            <StatCard icon={Eye} label="Toplam Sayfa Görüntüleme" value={stats.pageViews.total.toLocaleString()} sub={`Bu hafta: ${stats.pageViews.thisWeek}`} color="blue" />
            <StatCard icon={Users} label="Açık Lead" value={stats.leads.open} sub={`Bu hafta ${stats.leads.newThisWeek} yeni`} color="purple" />
          </div>

          {/* Breakdowns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-semibold text-gray-800 mb-4">Kullanıcı Rolleri</h3>
              <MiniBar
                items={stats.roleBreakdown.map(r => ({ label: roleLabels[r.role] || r.role, count: Number(r.count) }))}
                colorFn={(l) => {
                  const role = Object.entries(roleLabels).find(([, v]) => v === l)?.[0] || "";
                  return roleColors[role] || "bg-blue-500";
                }}
              />
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-semibold text-gray-800 mb-4">Seviye Dağılımı</h3>
              {stats.levelBreakdown.length > 0 ? (
                <MiniBar
                  items={["A1","A2","B1","B2","C1","C2"].map(l => ({
                    label: l,
                    count: Number(stats.levelBreakdown.find(x => x.level === l)?.count || 0)
                  }))}
                  colorFn={(l) => levelColors[l] || "bg-blue-400"}
                />
              ) : <p className="text-gray-400 text-sm">Henüz veri yok.</p>}
            </div>
          </div>

          {/* Daily Registrations */}
          {stats.dailyRegistrations.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-semibold text-gray-800 mb-4">Son 14 Gün — Günlük Kayıtlar</h3>
              <div className="flex items-end gap-1 h-24">
                {stats.dailyRegistrations.map((d) => {
                  const maxCount = Math.max(...stats.dailyRegistrations.map(x => Number(x.count)), 1);
                  const pct = (Number(d.count) / maxCount) * 100;
                  return (
                    <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group relative">
                      <div
                        className="w-full bg-blue-500 rounded-sm transition-all hover:bg-blue-600 cursor-default"
                        style={{ height: `${Math.max(pct, 4)}%` }}
                      />
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] rounded px-1 py-0.5 opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none z-10">
                        {d.date}: {d.count}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-1 text-[10px] text-gray-400">
                <span>{stats.dailyRegistrations[0]?.date?.slice(5)}</span>
                <span>{stats.dailyRegistrations[stats.dailyRegistrations.length - 1]?.date?.slice(5)}</span>
              </div>
            </div>
          )}

          {/* Recent Campaigns */}
          {campaigns.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-semibold text-gray-800 mb-3">Son Kampanyalar</h3>
              <div className="space-y-2">
                {campaigns.slice(0, 5).map(c => (
                  <div key={c.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                    <CheckCircle size={16} className={c.status === "sent" ? "text-green-500" : "text-gray-300"} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{c.subject}</p>
                      <p className="text-xs text-gray-400">{c.sentCount} kişiye gönderildi · {new Date(c.createdAt).toLocaleDateString("tr-TR")}</p>
                    </div>
                    <span className="text-xs text-gray-400">{RECIPIENT_OPTIONS.find(o => o.value === c.recipientFilter)?.label || c.recipientFilter}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── LEADS ── */}
      {tab === "leads" && (
        <div className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 flex-1 min-w-48">
              <Search size={14} className="text-gray-400" />
              <input
                value={leadSearch}
                onChange={e => setLeadSearch(e.target.value)}
                placeholder="İsim veya e-posta ara..."
                className="flex-1 text-sm outline-none"
              />
            </div>
            <select
              value={leadStatus}
              onChange={e => setLeadStatus(e.target.value)}
              className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none"
            >
              <option value="all">Tüm Durumlar</option>
              {Object.entries(STATUS_LABELS).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
            </select>
          </div>

          {filteredLeads.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center text-gray-400">
              <Users size={32} className="mx-auto mb-2 opacity-30" />
              <p>Henüz lead yok.</p>
              <p className="text-xs mt-1">www.sphereenglish.com iletişim formu dolduranlar burada görünür.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Ad Soyad</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">E-posta</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 hidden md:table-cell">Şirket</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Durum</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 hidden md:table-cell">Tarih</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredLeads.map(lead => (
                    <tr key={lead.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{lead.name}</td>
                      <td className="px-4 py-3 text-gray-500">{lead.email}</td>
                      <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{lead.company || "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_LABELS[lead.status]?.color || "bg-gray-100 text-gray-500"}`}>
                          {STATUS_LABELS[lead.status]?.label || lead.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 hidden md:table-cell text-xs">
                        {new Date(lead.createdAt).toLocaleDateString("tr-TR")}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => { setSelectedLead(lead); setLeadStatusEdit(lead.status); setLeadNote(lead.notes || ""); }}
                          className="text-blue-500 hover:text-blue-700 text-xs underline"
                        >
                          Detay
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Lead Detail Modal */}
          {selectedLead && (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setSelectedLead(null)}>
              <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">{selectedLead.name}</h3>
                  <button onClick={() => setSelectedLead(null)}><X size={18} className="text-gray-400" /></button>
                </div>
                <div className="space-y-2 text-sm mb-4">
                  <p><span className="text-gray-400">E-posta:</span> {selectedLead.email}</p>
                  {selectedLead.phone && <p><span className="text-gray-400">Tel:</span> {selectedLead.phone}</p>}
                  {selectedLead.company && <p><span className="text-gray-400">Şirket:</span> {selectedLead.company}</p>}
                  {selectedLead.message && <p className="bg-gray-50 rounded-lg p-3 text-gray-600 mt-2">{selectedLead.message}</p>}
                  <p><span className="text-gray-400">Kaynak:</span> {selectedLead.source}</p>
                  <p><span className="text-gray-400">Tarih:</span> {new Date(selectedLead.createdAt).toLocaleString("tr-TR")}</p>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Durum</label>
                    <select value={leadStatusEdit} onChange={e => setLeadStatusEdit(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none">
                      {Object.entries(STATUS_LABELS).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Notlar</label>
                    <textarea value={leadNote} onChange={e => setLeadNote(e.target.value)} rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none resize-none" placeholder="Dahili not ekle..." />
                  </div>
                  <button onClick={updateLead} className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 transition">
                    Kaydet
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── EMAIL ── */}
      {tab === "email" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Composer */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2"><Mail size={16} /> Yeni Kampanya</h3>

              {!stats?.emailConfigured && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
                  ⚠️ SMTP yapılandırılmamış. E-postalar gerçekten gönderilmeyecek — kayıt tutulacak (demo mod).
                  <br />Gerçek gönderim için: <strong>SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM</strong>
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Alıcılar</label>
                <select
                  value={recipientFilter}
                  onChange={e => setRecipientFilter(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none"
                >
                  {RECIPIENT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <div className="flex items-center gap-2 mt-1.5">
                  <button
                    onClick={previewRecipients}
                    className="text-xs text-blue-500 hover:text-blue-700 underline"
                  >
                    Alıcı sayısını önizle
                  </button>
                  {previewCount !== null && (
                    <span className="text-xs text-gray-500">→ <strong>{previewCount}</strong> kişi</span>
                  )}
                </div>
                {previewSample.length > 0 && (
                  <div className="mt-2 text-xs text-gray-400">
                    Örnek: {previewSample.map(s => s.name).join(", ")}
                    {previewCount! > 5 && " ...ve daha fazlası"}
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Konu</label>
                <input
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="E-posta konusu"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">İçerik</label>
                <textarea
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  rows={8}
                  placeholder="E-posta içeriğini buraya yazın..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none resize-none"
                />
              </div>

              {sendResult && (
                <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${sendResult.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                  {sendResult.ok ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
                  {sendResult.msg}
                </div>
              )}

              <button
                onClick={sendCampaign}
                disabled={sending}
                className="w-full bg-blue-600 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
              >
                {sending ? <><RefreshCw size={15} className="animate-spin" /> Gönderiliyor...</> : <><Send size={15} /> Kampanyayı Gönder</>}
              </button>
            </div>
          </div>

          {/* Campaign History */}
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-2"><Clock size={14} /> Kampanya Geçmişi</h3>
            {campaigns.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 text-center text-gray-400 text-sm">
                Henüz kampanya gönderilmedi.
              </div>
            ) : (
              <div className="space-y-2">
                {campaigns.map(c => (
                  <div key={c.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-gray-800 text-sm truncate">{c.subject}</p>
                      <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full ${c.status === "sent" ? "bg-green-100 text-green-700" : c.status === "sending" ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-500"}`}>
                        {c.status === "sent" ? "Gönderildi" : c.status === "sending" ? "Gönderiliyor" : c.status}
                      </span>
                    </div>
                    <div className="mt-1.5 text-xs text-gray-400 space-y-0.5">
                      <p>{RECIPIENT_OPTIONS.find(o => o.value === c.recipientFilter)?.label || c.recipientFilter}</p>
                      <p>{c.sentCount} / {c.recipientCount} kişi</p>
                      <p>{new Date(c.createdAt).toLocaleString("tr-TR")}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TEMPLATES ── */}
      {tab === "templates" && (
        <div className="space-y-6">
          {/* Upload Card */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2"><FileUp size={16} /> Yeni Şablon Yükle</h3>
            <p className="text-xs text-gray-500">HTML veya PDF dosyası yükleyin. HTML şablonları doğrudan e-posta içeriği olarak kullanılabilir.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Şablon Adı *</label>
                <input
                  value={tplName}
                  onChange={e => setTplName(e.target.value)}
                  placeholder="Örn: Hoş Geldiniz E-postası"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">E-posta Konusu (opsiyonel)</label>
                <input
                  value={tplSubject}
                  onChange={e => setTplSubject(e.target.value)}
                  placeholder="Sphere English'e Hoş Geldiniz!"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Dosya (HTML veya PDF, maks. 5 MB) *</label>
              <div
                className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition"
                onClick={() => fileInputRef.current?.click()}
              >
                {tplFile ? (
                  <div className="flex items-center justify-center gap-2">
                    {tplFile.name.endsWith(".pdf") ? <FileText size={20} className="text-red-500" /> : <FileCode size={20} className="text-blue-500" />}
                    <span className="text-sm font-medium text-gray-700">{tplFile.name}</span>
                    <span className="text-xs text-gray-400">({(tplFile.size / 1024).toFixed(0)} KB)</span>
                  </div>
                ) : (
                  <>
                    <FileUp size={24} className="mx-auto text-gray-300 mb-2" />
                    <p className="text-sm text-gray-400">Dosya seçmek için tıklayın</p>
                    <p className="text-xs text-gray-300 mt-1">.html, .htm, .pdf</p>
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".html,.htm,.pdf"
                className="hidden"
                onChange={e => setTplFile(e.target.files?.[0] || null)}
              />
            </div>

            {tplResult && (
              <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${tplResult.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                {tplResult.ok ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
                {tplResult.msg}
              </div>
            )}

            <button
              onClick={uploadTemplate}
              disabled={tplUploading}
              className="w-full bg-blue-600 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
            >
              {tplUploading ? <><RefreshCw size={15} className="animate-spin" /> Yükleniyor...</> : <><FileUp size={15} /> Şablonu Yükle</>}
            </button>
          </div>

          {/* Template List */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
              <h3 className="font-semibold text-gray-800 text-sm">Kayıtlı Şablonlar</h3>
            </div>
            {templates.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <LayoutTemplate size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Henüz şablon yüklenmedi.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {templates.map(tpl => (
                  <div key={tpl.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${tpl.fileType === "pdf" ? "bg-red-50 text-red-500" : "bg-blue-50 text-blue-500"}`}>
                      {tpl.fileType === "pdf" ? <FileText size={18} /> : <FileCode size={18} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{tpl.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${tpl.fileType === "pdf" ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"}`}>
                          {tpl.fileType.toUpperCase()}
                        </span>
                        <span className="text-xs text-gray-400 truncate">{tpl.fileName}</span>
                        {tpl.subject && <span className="text-xs text-gray-400 truncate hidden md:block">· {tpl.subject}</span>}
                      </div>
                      <p className="text-xs text-gray-300 mt-0.5">{new Date(tpl.createdAt).toLocaleDateString("tr-TR")}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {tpl.fileType === "html" && (
                        <button
                          onClick={() => loadTemplateIntoComposer(tpl)}
                          className="text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1"
                          title="Bu şablonu e-posta composer'a yükle"
                        >
                          <Mail size={13} /> Kullan
                        </button>
                      )}
                      <button
                        onClick={() => downloadTemplate(tpl)}
                        className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition"
                        title="İndir"
                      >
                        <Download size={16} />
                      </button>
                      <button
                        onClick={() => deleteTemplate(tpl.id)}
                        className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition"
                        title="Sil"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
