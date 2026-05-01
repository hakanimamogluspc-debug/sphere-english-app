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
  recipientCount: number; sentCount: number;
  openedCount: number; clickedCount: number;
  deliveredCount: number; bouncedCount: number;
  status: string; sentAt?: string; createdAt: string;
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
  { value: "custom", label: "Özel E-postalar" },
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
  const [customVars, setCustomVars] = useState<Record<string, string>>({});
  const [customEmailsText, setCustomEmailsText] = useState("");
  const [customName, setCustomName] = useState("");
  const [smtpTestResult, setSmtpTestResult] = useState<{ ok: boolean; config?: any; message?: string; error?: string } | null>(null);
  const [smtpTesting, setSmtpTesting] = useState(false);

  const parsedCustomEmails = customEmailsText
    .split(/[\n,;]+/)
    .map(e => e.trim())
    .filter(e => e.includes("@"));

  const testSmtp = async () => {
    setSmtpTesting(true); setSmtpTestResult(null);
    try {
      const data = await apiFetch("/api/admin/marketing/smtp-test", { method: "POST" });
      setSmtpTestResult(data);
    } catch (e: any) {
      setSmtpTestResult({ ok: false, error: e.message });
    } finally {
      setSmtpTesting(false);
    }
  };

  const AUTO_VARS = ["EMAIL", "AD", "SOYAD", "AD_SOYAD"];

  const detectedVars = (() => {
    const matches = body.match(/\{\{([A-Z0-9_]+)\}\}/g) || [];
    const keys = matches.map(m => m.replace(/\{\{|\}\}/g, ""));
    return [...new Set(keys)].filter(k => !AUTO_VARS.includes(k));
  })();

  // Template upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tplName, setTplName] = useState("");
  const [tplSubject, setTplSubject] = useState("");
  const [tplFile, setTplFile] = useState<File | null>(null);
  const [tplHtmlCode, setTplHtmlCode] = useState("");
  const [tplInputMode, setTplInputMode] = useState<"file" | "code">("code");
  const [tplUploading, setTplUploading] = useState(false);
  const [tplResult, setTplResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);

  const loadAll = async () => {
    setLoading(true); setError("");
    try {
      const [s, l, c] = await Promise.all([
        apiFetch("/api/admin/marketing/stats"),
        apiFetch("/api/admin/marketing/leads"),
        apiFetch("/api/admin/marketing/campaigns"),
      ]);
      setStats(s); setLeads(l); setCampaigns(c);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
    // Templates ayrı yüklenir — hata olsa bile ana panel bozulmaz
    try {
      const t = await apiFetch("/api/admin/marketing/templates");
      setTemplates(t);
    } catch {
      setTemplates([]);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const previewRecipients = async () => {
    try {
      const data = await apiFetch("/api/admin/marketing/campaigns/preview", {
        method: "POST", body: JSON.stringify({
          filter: recipientFilter,
          customEmails: recipientFilter === "custom" ? parsedCustomEmails : undefined,
        }),
      });
      setPreviewCount(data.count);
      setPreviewSample(data.sample || []);
    } catch {}
  };

  useEffect(() => {
    setPreviewCount(null);
    setPreviewSample([]);
  }, [recipientFilter, customEmailsText]);

  const sendCampaign = async () => {
    if (!subject.trim() || !body.trim()) {
      setSendResult({ ok: false, msg: "Konu ve içerik boş bırakılamaz." }); return;
    }
    if (recipientFilter === "custom" && parsedCustomEmails.length === 0) {
      setSendResult({ ok: false, msg: "En az bir geçerli e-posta adresi girin." }); return;
    }
    // Check all custom vars are filled
    for (const v of detectedVars) {
      if (!customVars[v]?.trim()) {
        setSendResult({ ok: false, msg: `"{{${v}}}" için değer giriniz.` }); return;
      }
    }
    setSending(true); setSendResult(null);
    try {
      const data = await apiFetch("/api/admin/marketing/campaigns/send", {
        method: "POST", body: JSON.stringify({
          subject, body, filter: recipientFilter, variables: customVars,
          customEmails: recipientFilter === "custom" ? parsedCustomEmails : undefined,
          customName: recipientFilter === "custom" && customName.trim() ? customName.trim() : undefined,
        }),
      });
      let msg = `${data.sent} / ${data.total} kişiye gönderildi!${data.provider === "demo" ? " (demo mod)" : ""}`;
      if (data.errors?.length) msg += ` — ${data.errors.length} hata: ${data.errors[0]}`;
      setSendResult({ ok: data.sent > 0, msg });
      setSubject(""); setBody(""); setCustomVars({}); setCustomEmailsText(""); setCustomName("");
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

  const saveHtmlCodeTemplate = async () => {
    if (!tplName.trim() || !tplHtmlCode.trim()) {
      setTplResult({ ok: false, msg: "Şablon adı ve HTML içeriği zorunludur." }); return;
    }
    setTplUploading(true); setTplResult(null);
    try {
      const data = await apiFetch("/api/admin/marketing/templates/html", {
        method: "POST",
        body: JSON.stringify({ name: tplName.trim(), subject: tplSubject.trim(), htmlContent: tplHtmlCode.trim() }),
      });
      setTemplates(prev => [data.template, ...prev]);
      setTplName(""); setTplSubject(""); setTplHtmlCode("");
      setTplResult({ ok: true, msg: "HTML şablon kaydedildi!" });
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
              <span>E-posta yapılandırılmamış. Gönderim demo modda çalışıyor. Gerçek e-posta için <strong>RESEND_API_KEY</strong> ortam değişkenini ayarlayın.</span>
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
                      <p className="text-xs text-gray-400">{c.sentCount} kişi · {new Date(c.createdAt).toLocaleDateString("tr-TR")}</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      {c.openedCount > 0 && <span className="text-green-600 font-medium">%{Math.round((c.openedCount / (c.sentCount || 1)) * 100)} açıldı</span>}
                      {c.clickedCount > 0 && <span className="text-purple-600 font-medium">%{Math.round((c.clickedCount / (c.sentCount || 1)) * 100)} tıklandı</span>}
                      {c.openedCount === 0 && c.status === "sent" && <span className="text-gray-300">—</span>}
                    </div>
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
                  ⚠️ E-posta yapılandırılmamış. E-postalar gerçekten gönderilmeyecek — kayıt tutulacak (demo mod).
                  <br />Gerçek gönderim için: <strong>RESEND_API_KEY</strong>
                </div>
              )}

              {/* SMTP Test Paneli */}
              <div className="border border-gray-200 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-600">SMTP Bağlantı Testi</span>
                  <button
                    onClick={testSmtp}
                    disabled={smtpTesting}
                    className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {smtpTesting ? <><RefreshCw size={11} className="animate-spin" /> Test ediliyor...</> : "Bağlantıyı Test Et"}
                  </button>
                </div>

                {smtpTestResult && (
                  <div className={`rounded-lg p-3 text-xs space-y-1.5 ${smtpTestResult.ok ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
                    <p className={`font-semibold ${smtpTestResult.ok ? "text-green-700" : "text-red-700"}`}>
                      {smtpTestResult.ok ? "✓ Bağlantı başarılı!" : "✗ Bağlantı başarısız"}
                    </p>
                    {smtpTestResult.config && (
                      <div className="text-gray-600 space-y-0.5">
                        <p>Host: <code className="bg-white/70 px-1 rounded">{smtpTestResult.config.host}</code></p>
                        <p>Port: <code className="bg-white/70 px-1 rounded">{smtpTestResult.config.port}</code></p>
                        <p>Kullanıcı: <code className="bg-white/70 px-1 rounded">{smtpTestResult.config.user}</code></p>
                        <p>Şifre: <code className="bg-white/70 px-1 rounded">{smtpTestResult.config.passSet ? `•••• (${smtpTestResult.config.passLength} karakter)` : "YOK"}</code></p>
                        <p>From: <code className="bg-white/70 px-1 rounded">{smtpTestResult.config.from}</code></p>
                      </div>
                    )}
                    {smtpTestResult.error && (
                      <p className="text-red-600 font-mono break-all">{smtpTestResult.error}</p>
                    )}
                    {smtpTestResult.message && (
                      <p className="text-green-700">{smtpTestResult.message}</p>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Alıcılar</label>
                <select
                  value={recipientFilter}
                  onChange={e => { setRecipientFilter(e.target.value); setCustomEmailsText(""); }}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none"
                >
                  {RECIPIENT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>

                {recipientFilter === "custom" && (
                  <div className="mt-2 space-y-2">
                    <textarea
                      value={customEmailsText}
                      onChange={e => setCustomEmailsText(e.target.value)}
                      rows={4}
                      placeholder={"E-posta adreslerini girin\n(virgül, noktalı virgül veya her satıra bir tane)"}
                      className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm outline-none resize-none focus:border-blue-400 bg-blue-50"
                    />
                    {parsedCustomEmails.length > 0 && (
                      <p className="text-xs text-blue-600 font-medium">
                        {parsedCustomEmails.length} adres tanımlandı
                      </p>
                    )}
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">
                        Alıcı adı <span className="text-gray-400 font-normal">(isteğe bağlı — {"{{AD}}"} için)</span>
                      </label>
                      <input
                        type="text"
                        value={customName}
                        onChange={e => setCustomName(e.target.value)}
                        placeholder="Örn: Mehmet — boş bırakılırsa e-postadan tahmin edilir"
                        className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 bg-blue-50"
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 mt-1.5">
                  <button
                    onClick={previewRecipients}
                    disabled={recipientFilter === "custom" && parsedCustomEmails.length === 0}
                    className="text-xs text-blue-500 hover:text-blue-700 underline disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Alıcı sayısını önizle
                  </button>
                  {previewCount !== null && (
                    <span className="text-xs text-gray-500">→ <strong>{previewCount}</strong> kişi</span>
                  )}
                </div>
                {previewSample.length > 0 && (
                  <div className="mt-2 text-xs text-gray-400">
                    Örnek: {previewSample.map(s => s.email).join(", ")}
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
                <p className="text-xs text-gray-400 mt-1">
                  Otomatik doldurulan: <code className="bg-gray-100 px-1 rounded">{"{{EMAIL}}"}</code> <code className="bg-gray-100 px-1 rounded">{"{{AD}}"}</code> <code className="bg-gray-100 px-1 rounded">{"{{SOYAD}}"}</code> <code className="bg-gray-100 px-1 rounded">{"{{AD_SOYAD}}"}</code>
                </p>
              </div>

              {detectedVars.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                  <p className="text-xs font-semibold text-blue-700 flex items-center gap-1.5">
                    <Tag size={12} /> Şablon Değişkenleri — Gönderilmeden önce doldurun
                  </p>
                  {detectedVars.map(v => (
                    <div key={v}>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">
                        <code className="bg-blue-100 px-1.5 py-0.5 rounded text-blue-700">{`{{${v}}}`}</code> için değer
                      </label>
                      <input
                        type={v === "SIFRE" ? "text" : "text"}
                        value={customVars[v] || ""}
                        onChange={e => setCustomVars(prev => ({ ...prev, [v]: e.target.value }))}
                        placeholder={v === "SIFRE" ? "Öğretmenin başlangıç şifresi" : `${v} değeri`}
                        className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 bg-white"
                      />
                    </div>
                  ))}
                </div>
              )}

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

          {/* Takip Bilgi Kartı */}
          <div className="space-y-3">
            {/* Resend Dashboard linki */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <p className="text-sm font-semibold text-gray-800 mb-2">Geçmiş E-postalar</p>
              <p className="text-xs text-gray-500 mb-3">Önceden gönderilen e-postaların açılma durumunu Resend'in kendi panelinden görebilirsiniz:</p>
              <a
                href="https://resend.com/emails"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 justify-center w-full bg-gray-900 hover:bg-black text-white text-xs font-medium py-2 px-3 rounded-lg transition"
              >
                <Mail size={13} />
                resend.com/emails — Tüm e-postaları gör
              </a>
            </div>

            {/* Webhook Kurulum */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <p className="text-sm font-semibold text-blue-800 mb-1">Gelecek E-postalar İçin Takip</p>
              <p className="text-xs text-blue-600 mb-2">Bu panelde açılma/tıklama verilerini görmek için Resend'de 1 kez webhook kurun:</p>
              <div className="bg-white border border-blue-200 rounded-lg px-3 py-2 mb-2">
                <p className="text-xs font-mono text-gray-700 break-all">https://app.sphereenglish.com/webhooks/resend</p>
              </div>
              <a
                href="https://resend.com/webhooks"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 justify-center w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium py-2 px-3 rounded-lg transition"
              >
                Webhook Kur →
              </a>
              <p className="text-xs text-blue-500 mt-2">Add Webhook → URL'yi yapıştır → <strong>email.opened, email.clicked, email.delivered, email.bounced</strong> seç → Kaydet</p>
            </div>
          </div>

          {/* Campaign History — tam genişlik */}
          <div className="lg:col-span-3 space-y-3">
            <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-2"><Clock size={14} /> Kampanya Geçmişi</h3>
            {campaigns.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 text-center text-gray-400 text-sm">
                Henüz kampanya gönderilmedi.
              </div>
            ) : (
              <div className="space-y-2">
                {campaigns.map(c => {
                  const base = c.sentCount || 1;
                  const openRate = c.openedCount > 0 ? Math.round((c.openedCount / base) * 100) : null;
                  const clickRate = c.clickedCount > 0 ? Math.round((c.clickedCount / base) * 100) : null;
                  return (
                  <div key={c.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-gray-800 text-sm truncate">{c.subject}</p>
                      <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full ${c.status === "sent" ? "bg-green-100 text-green-700" : c.status === "sending" ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-500"}`}>
                        {c.status === "sent" ? "Gönderildi" : c.status === "sending" ? "Gönderiliyor" : c.status}
                      </span>
                    </div>
                    <div className="mt-1.5 text-xs text-gray-400">
                      <p>{RECIPIENT_OPTIONS.find(o => o.value === c.recipientFilter)?.label || c.recipientFilter}</p>
                      <p className="mt-0.5">{c.sentCount} / {c.recipientCount} kişiye gönderildi · {new Date(c.createdAt).toLocaleString("tr-TR")}</p>
                    </div>
                    {/* Takip istatistikleri */}
                    <div className="mt-3 grid grid-cols-4 gap-2">
                      <div className="bg-blue-50 rounded-lg p-2 text-center">
                        <p className="text-xs text-blue-500 font-medium">Teslim</p>
                        <p className="text-sm font-bold text-blue-700">{c.deliveredCount || c.sentCount}</p>
                      </div>
                      <div className="bg-green-50 rounded-lg p-2 text-center">
                        <p className="text-xs text-green-500 font-medium">Açıldı</p>
                        <p className="text-sm font-bold text-green-700">{c.openedCount}{openRate !== null ? <span className="text-xs font-normal ml-0.5">%{openRate}</span> : ""}</p>
                      </div>
                      <div className="bg-purple-50 rounded-lg p-2 text-center">
                        <p className="text-xs text-purple-500 font-medium">Tıklandı</p>
                        <p className="text-sm font-bold text-purple-700">{c.clickedCount}{clickRate !== null ? <span className="text-xs font-normal ml-0.5">%{clickRate}</span> : ""}</p>
                      </div>
                      <div className="bg-red-50 rounded-lg p-2 text-center">
                        <p className="text-xs text-red-400 font-medium">Bounced</p>
                        <p className="text-sm font-bold text-red-600">{c.bouncedCount}</p>
                      </div>
                    </div>
                    {c.openedCount === 0 && c.clickedCount === 0 && c.status === "sent" && (
                      <p className="mt-2 text-xs text-gray-300 italic">Takip verileri bekleniyor — Resend webhook aktif olduğunda güncellenir</p>
                    )}
                  </div>
                  );
                })}
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
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2"><FileUp size={16} /> Yeni Şablon</h3>
              {/* Mode Toggle */}
              <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                <button
                  onClick={() => setTplInputMode("code")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${tplInputMode === "code" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
                >
                  <FileCode size={13} /> HTML Kodu
                </button>
                <button
                  onClick={() => setTplInputMode("file")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${tplInputMode === "file" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
                >
                  <FileUp size={13} /> Dosya Yükle
                </button>
              </div>
            </div>

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

            {/* HTML Code Mode */}
            {tplInputMode === "code" && (
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">HTML Kodu *</label>
                <textarea
                  value={tplHtmlCode}
                  onChange={e => setTplHtmlCode(e.target.value)}
                  rows={14}
                  placeholder={"<!DOCTYPE html>\n<html>\n<head><meta charset=\"utf-8\"></head>\n<body>\n  <h1>Merhaba!</h1>\n  <p>E-posta içeriğinizi buraya yazın.</p>\n</body>\n</html>"}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono outline-none resize-y bg-gray-950 text-green-400 leading-relaxed"
                  spellCheck={false}
                />
                <p className="text-xs text-gray-400 mt-1">HTML kodunuzu yapıştırın veya yazın. Kaydettikten sonra "Kullan" ile e-posta composer'a yükleyebilirsiniz.</p>
              </div>
            )}

            {/* File Upload Mode */}
            {tplInputMode === "file" && (
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
            )}

            {tplResult && (
              <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${tplResult.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                {tplResult.ok ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
                {tplResult.msg}
              </div>
            )}

            <button
              onClick={tplInputMode === "code" ? saveHtmlCodeTemplate : uploadTemplate}
              disabled={tplUploading}
              className="w-full bg-blue-600 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
            >
              {tplUploading
                ? <><RefreshCw size={15} className="animate-spin" /> Kaydediliyor...</>
                : tplInputMode === "code"
                  ? <><CheckCircle size={15} /> HTML Şablonu Kaydet</>
                  : <><FileUp size={15} /> Dosyayı Yükle</>
              }
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
                          onClick={() => setPreviewTemplate(tpl)}
                          className="text-xs bg-gray-50 text-gray-600 hover:bg-gray-100 px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1"
                          title="Önizle"
                        >
                          <Eye size={13} /> Önizle
                        </button>
                      )}
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

      {/* ── TEMPLATE PREVIEW MODAL ── */}
      {previewTemplate && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => setPreviewTemplate(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col"
            style={{ maxHeight: "90vh" }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                  <FileCode size={16} className="text-blue-500" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{previewTemplate.name}</p>
                  {previewTemplate.subject && (
                    <p className="text-xs text-gray-400">Konu: {previewTemplate.subject}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { loadTemplateIntoComposer(previewTemplate); setPreviewTemplate(null); }}
                  className="flex items-center gap-1.5 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-blue-700 transition"
                >
                  <Mail size={13} /> E-postaya Yükle
                </button>
                <button
                  onClick={() => setPreviewTemplate(null)}
                  className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Preview Tabs: Rendered / Source */}
            <div className="flex-1 overflow-hidden flex flex-col">
              <PreviewTabs template={previewTemplate} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PreviewTabs({ template }: { template: EmailTemplate }) {
  const [view, setView] = useState<"preview" | "source">("preview");
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex gap-1 px-5 pt-3 pb-0 border-b border-gray-100 flex-shrink-0">
        <button
          onClick={() => setView("preview")}
          className={`px-3 py-2 text-xs font-medium border-b-2 transition ${view === "preview" ? "border-blue-500 text-blue-600" : "border-transparent text-gray-400 hover:text-gray-600"}`}
        >
          Görünüm
        </button>
        <button
          onClick={() => setView("source")}
          className={`px-3 py-2 text-xs font-medium border-b-2 transition ${view === "source" ? "border-blue-500 text-blue-600" : "border-transparent text-gray-400 hover:text-gray-600"}`}
        >
          HTML Kodu
        </button>
      </div>
      <div className="flex-1 overflow-hidden">
        {view === "preview" ? (
          <iframe
            srcDoc={template.htmlContent || "<p>İçerik yok</p>"}
            className="w-full h-full border-0"
            style={{ minHeight: "500px" }}
            sandbox="allow-same-origin"
            title="Şablon Önizleme"
          />
        ) : (
          <pre className="w-full h-full overflow-auto p-4 text-xs font-mono bg-gray-950 text-green-400 leading-relaxed" style={{ minHeight: "500px" }}>
            {template.htmlContent || "İçerik yok"}
          </pre>
        )}
      </div>
    </div>
  );
}
