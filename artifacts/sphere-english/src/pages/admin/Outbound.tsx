import { useEffect, useState } from "react";
import { API } from "@/lib/api-url";
import { Card, CardContent, Button, Input, Label } from "@/components/ui/core";
import {
  Send, Mail, TrendingUp, Users, Play, Pause,
  Plus, Trash2, Eye, MousePointer, Calendar as CalendarIcon,
  AlertCircle, CheckCircle2, Copy, X, Sparkles,
} from "lucide-react";

/**
 * /admin/outbound — B2B Outbound Kampanya Yönetimi
 *
 * Bölümler:
 *   1. Stats özet (üstte)
 *   2. Kampanyalar listesi + oluştur
 *   3. Şablon kütüphanesi + editor
 *   4. Analytics (basit)
 */

const TOKEN_KEY = "sphere_token";

async function api(path: string, opts: RequestInit = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(opts.headers || {}),
    },
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((d as any)?.error || `HTTP ${res.status}`);
  return d;
}

const SEGMENTS = [
  { id: "b2b_hr",  label: "B2B İK" },
  { id: "b2b_sme", label: "B2B KOBİ" },
  { id: "b2c_pro", label: "B2C Profesyonel" },
  { id: "partner", label: "Affiliate / İnfluencer" },
];

export default function Outbound() {
  const [tab, setTab] = useState<"campaigns" | "templates" | "leads" | "stats">("campaigns");
  const [stats, setStats] = useState<any>(null);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewCampaign, setShowNewCampaign] = useState(false);
  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<any>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const [s, c, t] = await Promise.all([
        api("/admin/outbound/stats").catch(() => ({ stats: {} })),
        api("/admin/outbound/campaigns").catch(() => ({ campaigns: [] })),
        api("/admin/outbound/templates").catch(() => ({ templates: [] })),
      ]);
      setStats(s.stats);
      setCampaigns(c.campaigns || []);
      setTemplates(t.templates || []);
    } catch (e: any) {
      showToast(e?.message || "Yükleme hatası", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const startCampaign = async (id: number) => {
    try {
      await api(`/admin/outbound/campaigns/${id}/start`, { method: "POST" });
      showToast("Kampanya başlatıldı — sonraki 5 dk içinde ilk e-postalar gider");
      loadAll();
    } catch (e: any) { showToast(e?.message || "Başlatılamadı", "error"); }
  };

  const pauseCampaign = async (id: number) => {
    try {
      await api(`/admin/outbound/campaigns/${id}/pause`, { method: "POST" });
      showToast("Kampanya duraklatıldı");
      loadAll();
    } catch (e: any) { showToast(e?.message || "Duraklatılamadı", "error"); }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#13a9e0]/10 text-[#0e7da6] text-[10px] font-bold tracking-wider uppercase">
              <Sparkles size={10} /> B2B Outbound Sistemi
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-[#1e3a6e] flex items-center gap-2">
            <Send className="h-8 w-8 text-[#13a9e0]" />
            Cold Email Kampanyaları
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Kampanya oluştur → lead ekle → başlat. Scheduler her 5 dk'da bir gönderim yapar.
          </p>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={<Play size={16} />} label="Aktif Kampanya" value={stats.campaignsActive || 0} />
          <StatCard icon={<Mail size={16} />} label="Şablonlar" value={stats.templates || 0} />
          <StatCard icon={<Send size={16} />} label="Gönderim (7g)" value={(stats.last7days?.sent || 0)} />
          <StatCard icon={<CalendarIcon size={16} />} label="Toplantılar" value={stats.meetings || 0} />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        <TabButton active={tab === "campaigns"} onClick={() => setTab("campaigns")}>
          Kampanyalar ({campaigns.length})
        </TabButton>
        <TabButton active={tab === "templates"} onClick={() => setTab("templates")}>
          Şablonlar ({templates.length})
        </TabButton>
        <TabButton active={tab === "leads"} onClick={() => setTab("leads")}>
          Lead Havuzu
        </TabButton>
        <TabButton active={tab === "stats"} onClick={() => setTab("stats")}>
          Analitik
        </TabButton>
      </div>

      {loading && (
        <div className="text-center py-12 text-slate-500 text-sm">Yükleniyor…</div>
      )}

      {/* Kampanyalar Tab */}
      {!loading && tab === "campaigns" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowNewCampaign(true)} className="bg-[#1e3a6e] hover:bg-[#12213e]">
              <Plus size={14} className="mr-1" /> Yeni Kampanya
            </Button>
          </div>

          {campaigns.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <Send size={40} className="mx-auto mb-3 text-slate-300" />
                <p className="text-slate-600 font-semibold">Henüz kampanya yok</p>
                <p className="text-sm text-slate-500 mt-1">"Yeni Kampanya" ile başla</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {campaigns.map(c => (
                <CampaignCard
                  key={c.id} campaign={c}
                  onStart={() => startCampaign(c.id)}
                  onPause={() => pauseCampaign(c.id)}
                  onOpen={() => setSelectedCampaign(c)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Şablonlar Tab */}
      {!loading && tab === "templates" && (
        <div className="space-y-4">
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  await api("/admin/outbound/seed", { method: "POST" });
                  showToast("Hazır şablonlar yüklendi");
                  loadAll();
                } catch (e: any) { showToast(e?.message || "Hata", "error"); }
              }}
            >
              Hazır Şablonları Yükle
            </Button>
            <Button onClick={() => setShowNewTemplate(true)} className="bg-[#1e3a6e]">
              <Plus size={14} className="mr-1" /> Yeni Şablon
            </Button>
          </div>

          {templates.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <Mail size={40} className="mx-auto mb-3 text-slate-300" />
                <p className="text-slate-600 font-semibold">Şablon yok</p>
                <p className="text-sm text-slate-500 mt-1">Hazır şablonları yükle veya yeni oluştur</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 gap-3">
              {templates.map(t => (
                <TemplateCard
                  key={t.id} template={t}
                  onOpen={() => setSelectedTemplate(t)}
                  onDelete={async () => {
                    if (!confirm(`"${t.name}" şablonu silinsin mi?`)) return;
                    try {
                      await api(`/admin/outbound/templates/${t.id}`, { method: "DELETE" });
                      showToast("Silindi");
                      loadAll();
                    } catch (e: any) { showToast(e?.message || "Hata", "error"); }
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Lead Havuzu Tab */}
      {!loading && tab === "leads" && (
        <LeadPool showToast={showToast} />
      )}

      {/* Analitik Tab */}
      {!loading && tab === "stats" && stats && (
        <Card>
          <CardContent className="p-6">
            <h3 className="font-bold text-[#1e3a6e] mb-4">Son 7 gün olay dağılımı</h3>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              {["sent", "delivered", "opened", "clicked", "replied", "bounced"].map(k => (
                <div key={k} className="p-3 bg-slate-50 rounded-lg text-center">
                  <div className="text-xs text-slate-500 uppercase font-bold">{k}</div>
                  <div className="text-2xl font-extrabold text-[#1e3a6e] mt-1">
                    {stats.last7days?.[k] || 0}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 p-4 bg-blue-50 rounded-xl text-sm text-blue-900">
              <p className="font-semibold mb-1">📊 Formül</p>
              <p>Açılma oranı: opened / sent = <strong>{stats.last7days?.sent ? Math.round((stats.last7days.opened / stats.last7days.sent) * 100) : 0}%</strong></p>
              <p>Cevap oranı: replied / sent = <strong>{stats.last7days?.sent ? Math.round((stats.last7days.replied / stats.last7days.sent) * 100) : 0}%</strong></p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modals */}
      {showNewCampaign && (
        <NewCampaignModal
          templates={templates}
          onClose={() => setShowNewCampaign(false)}
          onCreated={() => { setShowNewCampaign(false); loadAll(); showToast("Kampanya oluşturuldu"); }}
        />
      )}
      {showNewTemplate && (
        <NewTemplateModal
          onClose={() => setShowNewTemplate(false)}
          onCreated={() => { setShowNewTemplate(false); loadAll(); showToast("Şablon oluşturuldu"); }}
        />
      )}
      {selectedTemplate && (
        <TemplatePreviewModal
          template={selectedTemplate}
          onClose={() => setSelectedTemplate(null)}
          onSendTest={async (email) => {
            try {
              await api("/admin/outbound/send-test", {
                method: "POST",
                body: JSON.stringify({ templateId: selectedTemplate.id, testEmail: email }),
              });
              showToast("Test e-postası gönderildi");
            } catch (e: any) { showToast(e?.message || "Hata", "error"); }
          }}
        />
      )}
      {selectedCampaign && (
        <CampaignDetailModal
          campaign={selectedCampaign}
          templates={templates}
          onClose={() => setSelectedCampaign(null)}
          onUpdate={() => { setSelectedCampaign(null); loadAll(); }}
          showToast={showToast}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 px-5 py-3 rounded-full shadow-lg text-white font-semibold flex items-center gap-2 ${toast.type === "error" ? "bg-red-500" : "bg-emerald-500"}`}>
          {toast.type === "error" ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ─── Sub Components ──────────────────────────────────────────────────

function TabButton({ active, onClick, children }: any) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${active ? "border-[#13a9e0] text-[#1e3a6e]" : "border-transparent text-slate-500 hover:text-slate-700"}`}
    >{children}</button>
  );
}

function StatCard({ icon, label, value }: any) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase tracking-wider">
        <span className="text-[#13a9e0]">{icon}</span> {label}
      </div>
      <div className="text-3xl font-extrabold text-[#1e3a6e] mt-2 tabular-nums">{value}</div>
    </div>
  );
}

function CampaignCard({ campaign, onStart, onPause, onOpen }: any) {
  const c = campaign;
  const statusColors: any = {
    draft: "bg-slate-100 text-slate-700",
    active: "bg-emerald-100 text-emerald-700",
    paused: "bg-amber-100 text-amber-700",
    completed: "bg-blue-100 text-blue-700",
  };
  return (
    <Card className={c.status === "active" ? "border-emerald-300 border-2" : ""}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0 cursor-pointer" onClick={onOpen}>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-bold text-[#1e3a6e]">{c.name}</h3>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${statusColors[c.status]}`}>
                {c.status}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 uppercase">
                {c.segment}
              </span>
            </div>
            {c.description && <p className="text-sm text-slate-600 mb-2">{c.description}</p>}
            <div className="flex flex-wrap gap-4 text-xs text-slate-500 mt-2">
              <span>👥 {c.totalRecipients} lead</span>
              <span>📤 {c.emailsSent} gönderildi</span>
              <span>👁️ {c.emailsOpened} açıldı</span>
              <span>💬 {c.replies} cevap</span>
              <span>📅 {c.bookings} toplantı</span>
              <span>💥 {c.bounces} bounce</span>
            </div>
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            {c.status === "active" ? (
              <Button size="sm" variant="outline" onClick={onPause}>
                <Pause size={12} className="mr-1" /> Duraklat
              </Button>
            ) : c.status === "draft" || c.status === "paused" ? (
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={onStart}>
                <Play size={12} className="mr-1" /> {c.status === "paused" ? "Devam" : "Başlat"}
              </Button>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TemplateCard({ template, onOpen, onDelete }: any) {
  const t = template;
  return (
    <Card className="hover:shadow-md transition cursor-pointer">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0" onClick={onOpen}>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-bold text-[#1e3a6e] text-sm">{t.name}</h3>
              {t.segment && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#13a9e0]/10 text-[#0e7da6] uppercase">
                  {t.segment}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600 mt-2 line-clamp-1"><strong>Konu:</strong> {t.subject}</p>
            <p className="text-xs text-slate-500 mt-1 line-clamp-2">
              {t.bodyText?.slice(0, 120) || t.bodyHtml.replace(/<[^>]+>/g, "").slice(0, 120)}...
            </p>
          </div>
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-slate-400 hover:text-red-500 p-1">
            <Trash2 size={14} />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

function NewCampaignModal({ templates, onClose, onCreated }: any) {
  const [form, setForm] = useState({
    name: "", description: "", segment: "b2b_hr",
    fromName: "Hakan İmamoğlu", fromEmail: "hakan@sphereenglish.com",
    replyToEmail: "", dailySendLimit: 50,
  });
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setSaving(true);
    try {
      await api("/admin/outbound/campaigns", { method: "POST", body: JSON.stringify(form) });
      onCreated();
    } catch (e: any) { alert(e?.message || "Hata"); }
    finally { setSaving(false); }
  };
  return (
    <Modal title="Yeni Kampanya" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Kampanya adı">
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Q4 B2B HR Push" />
        </Field>
        <Field label="Açıklama (opsiyonel)">
          <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        <Field label="Segment">
          <select value={form.segment} onChange={(e) => setForm({ ...form, segment: e.target.value })}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
            {SEGMENTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Gönderen adı">
            <Input value={form.fromName} onChange={(e) => setForm({ ...form, fromName: e.target.value })} />
          </Field>
          <Field label="Gönderen e-posta">
            <Input value={form.fromEmail} onChange={(e) => setForm({ ...form, fromEmail: e.target.value })} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Reply-to (opsiyonel)">
            <Input value={form.replyToEmail} onChange={(e) => setForm({ ...form, replyToEmail: e.target.value })} placeholder="Boşsa Gönderen kullanılır" />
          </Field>
          <Field label="Günlük gönderim limiti">
            <Input type="number" value={form.dailySendLimit} onChange={(e) => setForm({ ...form, dailySendLimit: Number(e.target.value) })} />
          </Field>
        </div>
        <div className="text-xs text-slate-500 bg-blue-50 p-3 rounded-lg">
          Oluşturduktan sonra: <strong>Kampanya detayında</strong> sequence step'lerini + lead'leri ekle.
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Vazgeç</Button>
          <Button onClick={submit} disabled={saving || !form.name} className="bg-[#1e3a6e]">
            {saving ? "..." : "Oluştur"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function NewTemplateModal({ onClose, onCreated }: any) {
  const [form, setForm] = useState({ name: "", subject: "", bodyHtml: "", segment: "b2b_hr" });
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setSaving(true);
    try {
      await api("/admin/outbound/templates", {
        method: "POST",
        body: JSON.stringify({ ...form, bodyText: form.bodyHtml.replace(/<[^>]+>/g, "") }),
      });
      onCreated();
    } catch (e: any) { alert(e?.message || "Hata"); }
    finally { setSaving(false); }
  };
  return (
    <Modal title="Yeni Şablon" onClose={onClose} wide>
      <div className="space-y-3">
        <Field label="Şablon adı">
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="B2B HR · Cold Intro" />
        </Field>
        <Field label="Segment">
          <select value={form.segment} onChange={(e) => setForm({ ...form, segment: e.target.value })}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
            {SEGMENTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </Field>
        <Field label="E-posta konusu (subject)">
          <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="{{firstName}}, {{company}} için 5 dk'lık bir fikir" />
        </Field>
        <Field label="HTML gövde">
          <textarea
            value={form.bodyHtml}
            onChange={(e) => setForm({ ...form, bodyHtml: e.target.value })}
            rows={12}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono"
            placeholder={`<p>Merhaba {{firstName}},</p>\n<p>{{company}} ile ilgili...</p>`}
          />
        </Field>
        <div className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-3">
          <strong>Kullanılabilir değişkenler:</strong> {"{{firstName}}"}, {"{{lastName}}"}, {"{{fullName}}"}, {"{{company}}"}, {"{{position}}"}, {"{{email}}"}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Vazgeç</Button>
          <Button onClick={submit} disabled={saving || !form.name || !form.subject || !form.bodyHtml} className="bg-[#1e3a6e]">
            {saving ? "..." : "Oluştur"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function TemplatePreviewModal({ template, onClose, onSendTest }: any) {
  const [testEmail, setTestEmail] = useState("");
  const [sending, setSending] = useState(false);
  return (
    <Modal title={template.name} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="p-3 bg-slate-50 rounded-lg">
          <div className="text-xs text-slate-500 uppercase font-bold">Konu</div>
          <div className="text-sm font-semibold text-[#1e3a6e]">{template.subject}</div>
        </div>
        <div className="p-4 border border-slate-200 rounded-lg bg-white max-h-96 overflow-auto">
          <div className="text-xs text-slate-500 uppercase font-bold mb-2">HTML Önizleme</div>
          <div dangerouslySetInnerHTML={{ __html: template.bodyHtml }} className="prose prose-sm max-w-none" />
        </div>
        <div className="pt-3 border-t border-slate-200">
          <Label>Test gönderimi (kendi e-postana)</Label>
          <div className="flex gap-2 mt-2">
            <Input value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="test@sphereenglish.com" />
            <Button
              disabled={sending || !testEmail}
              onClick={async () => { setSending(true); await onSendTest(testEmail); setSending(false); }}
              className="bg-[#13a9e0]"
            >
              <Send size={12} className="mr-1" /> Gönder
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function CampaignDetailModal({ campaign, templates, onClose, onUpdate, showToast }: any) {
  const [steps, setSteps] = useState<any[]>([]);
  const [showAddLeads, setShowAddLeads] = useState(false);

  useEffect(() => {
    api(`/admin/outbound/campaigns/${campaign.id}`)
      .then(d => setSteps(d.steps || []))
      .catch(() => {});
  }, [campaign.id]);

  const addStep = async (templateId: number, delayDays: number, condition: string) => {
    try {
      await api(`/admin/outbound/campaigns/${campaign.id}/steps`, {
        method: "POST",
        body: JSON.stringify({ templateId, stepOrder: steps.length + 1, delayDays, condition }),
      });
      const d = await api(`/admin/outbound/campaigns/${campaign.id}`);
      setSteps(d.steps || []);
      showToast("Step eklendi");
    } catch (e: any) { showToast(e?.message || "Hata", "error"); }
  };

  const deleteStep = async (id: number) => {
    if (!confirm("Bu step silinsin mi?")) return;
    try {
      await api(`/admin/outbound/steps/${id}`, { method: "DELETE" });
      setSteps(steps.filter(s => s.id !== id));
    } catch (e: any) { showToast(e?.message || "Hata", "error"); }
  };

  return (
    <Modal title={campaign.name} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-2 text-xs">
          <div className="p-2 bg-slate-50 rounded"><div className="text-slate-500 font-bold uppercase">Lead</div><div className="text-lg font-bold text-[#1e3a6e]">{campaign.totalRecipients}</div></div>
          <div className="p-2 bg-slate-50 rounded"><div className="text-slate-500 font-bold uppercase">Gönderim</div><div className="text-lg font-bold text-[#1e3a6e]">{campaign.emailsSent}</div></div>
          <div className="p-2 bg-slate-50 rounded"><div className="text-slate-500 font-bold uppercase">Açılma</div><div className="text-lg font-bold text-[#1e3a6e]">{campaign.emailsOpened}</div></div>
          <div className="p-2 bg-slate-50 rounded"><div className="text-slate-500 font-bold uppercase">Cevap</div><div className="text-lg font-bold text-[#1e3a6e]">{campaign.replies}</div></div>
        </div>

        <div>
          <h3 className="font-bold text-[#1e3a6e] mb-2 text-sm uppercase tracking-wider">Sequence Steps</h3>
          {steps.length === 0 && <p className="text-sm text-slate-500 py-4 text-center bg-slate-50 rounded-lg">Henüz step yok. Aşağıdan ekle.</p>}
          <div className="space-y-2">
            {steps.map((s, i) => {
              const tpl = templates.find((t: any) => t.id === s.templateId);
              return (
                <div key={s.id} className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-[#1e3a6e] text-white flex items-center justify-center font-bold text-sm">{i + 1}</div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-[#1e3a6e]">{tpl?.name || "?"}</div>
                    <div className="text-xs text-slate-500">
                      {s.delayDays === 0 ? "Hemen" : `${s.delayDays} gün sonra`}
                      {s.condition && s.condition !== "always" && ` · Koşul: ${s.condition}`}
                    </div>
                  </div>
                  <button onClick={() => deleteStep(s.id)} className="text-slate-400 hover:text-red-500 p-1">
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
          <AddStepForm templates={templates.filter((t: any) => !t.segment || t.segment === campaign.segment)}
            onAdd={addStep} />
        </div>

        <div className="pt-3 border-t border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-[#1e3a6e] text-sm uppercase tracking-wider">
              Lead Havuzu ({campaign.totalRecipients})
            </h3>
            <Button
              onClick={() => setShowAddLeads(true)}
              className="bg-[#13a9e0] hover:bg-[#0e7da6]"
              size="sm"
            >
              <Users size={12} className="mr-1" /> Lead Ekle
            </Button>
          </div>
          <p className="text-xs text-slate-500">
            Kampanyaya {campaign.segment} segmentindeki lead'lerini ekleyebilirsin.
            Eklenen lead'lere step sırasına göre otomatik gönderim başlar.
          </p>
        </div>

        {showAddLeads && (
          <AddLeadsToCampaign
            campaign={campaign}
            onClose={() => setShowAddLeads(false)}
            onAdded={(n) => {
              setShowAddLeads(false);
              showToast(`${n} lead kampanyaya eklendi`);
              onUpdate();
            }}
          />
        )}
      </div>
    </Modal>
  );
}

// ─── Lead Havuzu Tab ─────────────────────────────────────────────────
function LeadPool({ showToast }: any) {
  const [leads, setLeads] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [segmentFilter, setSegmentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [emailStatusFilter, setEmailStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [running, setRunning] = useState<null | string>(null);
  const [showPresetPicker, setShowPresetPicker] = useState(false);
  const [presets, setPresets] = useState<any[]>([]);

  useEffect(() => {
    api("/admin/outreach/presets")
      .then(d => setPresets(d.presets || []))
      .catch(() => {});
  }, []);

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: "50" });
    if (segmentFilter) params.set("segment", segmentFilter);
    if (statusFilter) params.set("status", statusFilter);
    if (emailStatusFilter) params.set("emailStatus", emailStatusFilter);
    if (search) params.set("search", search);
    api(`/admin/outreach/leads?${params}`)
      .then(d => {
        setLeads(d.items || []);
        setTotal(d.pagination?.total || 0);
      })
      .catch(() => setLeads([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [page, segmentFilter, statusFilter, emailStatusFilter]);

  const triggerPreset = async (presetId: string, limit: number = 50) => {
    setRunning("discovery");
    setShowPresetPicker(false);
    try {
      const r = await api("/admin/outreach/trigger-preset", {
        method: "POST",
        body: JSON.stringify({ presetId, limit }),
      });
      showToast(r.message || "Keşif başlatıldı");
    } catch (e: any) { showToast(e?.message || "Hata", "error"); }
    finally { setRunning(null); }
  };

  const triggerVerify = async () => {
    setRunning("verify");
    try {
      const r = await api("/admin/outreach/verify", {
        method: "POST",
        body: JSON.stringify({ batchSize: 200 }),
      });
      showToast(`${r.verified || 0} email doğrulandı (✓${r.valid || 0} ✗${r.invalid || 0})`);
      load();
    } catch (e: any) { showToast(e?.message || "Hata", "error"); }
    finally { setRunning(null); }
  };

  const badge = (status: string, val: any) => {
    const colors: any = {
      valid: "bg-emerald-100 text-emerald-700",
      invalid: "bg-red-100 text-red-700",
      risky: "bg-amber-100 text-amber-700",
      catch_all: "bg-amber-100 text-amber-700",
      unknown: "bg-slate-100 text-slate-600",
      new: "bg-blue-100 text-blue-700",
      contacted: "bg-purple-100 text-purple-700",
      qualified: "bg-emerald-100 text-emerald-700",
      rejected: "bg-red-100 text-red-700",
      archived: "bg-slate-100 text-slate-500",
      viewed: "bg-slate-100 text-slate-700",
    };
    return (
      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${colors[status] || "bg-slate-100 text-slate-600"}`}>
        {val}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Aksiyon Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-xl p-3">
        <div className="flex flex-wrap gap-2 items-center">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
            placeholder="Ara: ad, e-posta, şirket…"
            className="w-56"
          />
          <select value={segmentFilter} onChange={(e) => { setSegmentFilter(e.target.value); setPage(1); }}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
            <option value="">Tüm Segmentler</option>
            {SEGMENTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
            <option value="">Tüm Durumlar</option>
            <option value="new">Yeni</option>
            <option value="viewed">Görüntülendi</option>
            <option value="contacted">İletişime Geçildi</option>
            <option value="qualified">Kalifiye</option>
            <option value="rejected">Reddedildi</option>
            <option value="archived">Arşiv</option>
          </select>
          <select value={emailStatusFilter} onChange={(e) => { setEmailStatusFilter(e.target.value); setPage(1); }}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
            <option value="">Tüm Emailler</option>
            <option value="valid">✓ Valid</option>
            <option value="risky">⚠ Risky</option>
            <option value="invalid">✗ Invalid</option>
            <option value="unknown">? Unknown</option>
          </select>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            disabled={running === "verify"}
            onClick={triggerVerify}
            className="text-xs"
          >
            {running === "verify" ? "Doğrulanıyor…" : "Email Doğrula"}
          </Button>
          <Button
            disabled={running === "discovery"}
            onClick={() => setShowPresetPicker(true)}
            className="bg-[#1e3a6e] hover:bg-[#12213e] text-white"
            size="sm"
          >
            <Sparkles size={12} className="mr-1" />
            {running === "discovery" ? "Keşfediliyor…" : "+ Lead Araştır"}
          </Button>
        </div>
      </div>

      <div className="text-xs text-slate-500">
        Toplam <strong>{total}</strong> lead · Sayfa {page} / {Math.ceil(total / 50) || 1}
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500 text-sm">Yükleniyor…</div>
      ) : leads.length === 0 ? (
        <Card><CardContent className="py-16 text-center">
          <Users size={40} className="mx-auto mb-3 text-slate-300" />
          <p className="text-slate-600 font-semibold">Lead yok</p>
          <p className="text-xs text-slate-500 mt-1">"+ Yeni Keşif" ile Apify'dan lead çek</p>
        </CardContent></Card>
      ) : (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-left text-xs uppercase font-bold text-slate-500">
                <th className="px-3 py-2">Kişi</th>
                <th className="px-3 py-2">Şirket / Pozisyon</th>
                <th className="px-3 py-2">Segment</th>
                <th className="px-3 py-2">Email Durum</th>
                <th className="px-3 py-2">Lead Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leads.map(l => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <div className="font-semibold text-[#1e3a6e]">
                      {l.fullName || `${l.firstName || ""} ${l.lastName || ""}`.trim() || "—"}
                    </div>
                    <div className="text-xs text-slate-500">{l.email}</div>
                    {l.linkedinUrl && (
                      <a href={l.linkedinUrl} target="_blank" rel="noreferrer"
                        className="text-[10px] text-blue-600 hover:underline">LinkedIn ↗</a>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-semibold text-slate-700">{l.company || "—"}</div>
                    <div className="text-xs text-slate-500">{l.jobTitle || "—"}</div>
                    {(l.rawData?.followers || l.rawData?.subscribers) && (
                      <div className="text-[10px] font-bold text-[#13a9e0] mt-0.5">
                        {(l.rawData.followers || l.rawData.subscribers).toLocaleString("tr-TR")} {l.rawData.platform === "youtube" ? "abone" : "takipçi"}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {SEGMENTS.find(s => s.id === l.segment)?.label || l.segment}
                  </td>
                  <td className="px-3 py-2">{badge(l.emailStatus, l.emailStatus || "?")}</td>
                  <td className="px-3 py-2">{badge(l.status, l.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {total > 50 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Önceki</Button>
          <span className="text-sm py-2">{page} / {Math.ceil(total / 50)}</span>
          <Button variant="outline" size="sm" disabled={page >= Math.ceil(total / 50)} onClick={() => setPage(p => p + 1)}>Sonraki →</Button>
        </div>
      )}

      {/* Preset Picker Modal */}
      {showPresetPicker && (
        <PresetPickerModal
          presets={presets}
          onClose={() => setShowPresetPicker(false)}
          onPick={triggerPreset}
        />
      )}
    </div>
  );
}

function PresetPickerModal({ presets, onClose, onPick }: any) {
  const [limit, setLimit] = useState(50);
  const [pickedId, setPickedId] = useState<string | null>(null);

  const grouped = presets.reduce((acc: any, p: any) => {
    (acc[p.segment] ||= []).push(p);
    return acc;
  }, {});

  return (
    <Modal title="Lead Araştır — Hedef Profil Seç" onClose={onClose} wide>
      <div className="space-y-4">
        <div className="text-sm text-slate-600 bg-blue-50 p-3 rounded-lg">
          Sphere English için hazırlanmış {presets.length} hedef profil.
          Her biri Türkiye'deki spesifik bir kitleyi tarayıp e-posta çekmeye çalışır.
          <br/><strong>Maliyet:</strong> ~$50/1000 profil (Apify Starter Bronze discount ile daha ucuz).
        </div>

        {SEGMENTS.map(seg => grouped[seg.id]?.length && (
          <div key={seg.id}>
            <h3 className="font-bold text-[#1e3a6e] text-xs uppercase tracking-wider mb-2 mt-3">
              {seg.label} ({grouped[seg.id].length} profil)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {grouped[seg.id].map((p: any) => (
                <button
                  key={p.id}
                  onClick={() => setPickedId(p.id)}
                  className={`text-left p-3 rounded-lg border-2 transition ${pickedId === p.id ? "border-[#13a9e0] bg-blue-50" : "border-slate-200 hover:border-slate-300 bg-white"}`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-lg leading-none">{p.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm text-[#1e3a6e]">{p.label}</div>
                      <div className="text-xs text-slate-600 mt-0.5">{p.description}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}

        <div className="pt-3 border-t border-slate-200 flex items-center gap-3">
          <Label className="text-xs uppercase font-bold text-slate-500">Kaç lead çekelim?</Label>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value={25}>25 lead (~$1.25)</option>
            <option value={50}>50 lead (~$2.5)</option>
            <option value={75}>75 lead (~$3.75) ⚠️ timeout riski</option>
          </select>
          <div className="text-[10px] text-slate-500 mt-1 w-full">
            ⚠️ 75+ lead Apify'ın 300s sync sınırını aşabilir — sonuçlar Apify'da kalır, DB'ye gelmez.
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Vazgeç</Button>
          <Button
            onClick={() => pickedId && onPick(pickedId, limit)}
            disabled={!pickedId}
            className="bg-[#1e3a6e]"
          >
            <Sparkles size={14} className="mr-1" /> Araştırmayı Başlat
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function AddLeadsToCampaign({ campaign, onClose, onAdded }: any) {
  const [leads, setLeads] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState("new");
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({
      segment: campaign.segment,
      pageSize: "200",
    });
    if (statusFilter) params.set("status", statusFilter);
    api(`/admin/outreach/leads?${params}`)
      .then(d => setLeads(d.items || []))
      .catch(() => setLeads([]))
      .finally(() => setLoading(false));
  }, [campaign.segment, statusFilter]);

  const filtered = leads.filter(l => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      (l.fullName || "").toLowerCase().includes(s) ||
      (l.email || "").toLowerCase().includes(s) ||
      (l.company || "").toLowerCase().includes(s)
    );
  });

  const toggle = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const toggleAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map(l => l.id)));
  };

  const submit = async () => {
    if (selectedIds.size === 0) return;
    setSaving(true);
    try {
      const r = await api(`/admin/outbound/campaigns/${campaign.id}/add-leads`, {
        method: "POST",
        body: JSON.stringify({ leadIds: Array.from(selectedIds) }),
      });
      onAdded(r.added || selectedIds.size);
    } catch (e: any) {
      alert(e?.message || "Hata");
      setSaving(false);
    }
  };

  return (
    <Modal title={`"${campaign.name}" — Lead Ekle`} onClose={onClose} wide>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ara: ad, e-posta, şirket…"
            className="flex-1 min-w-[200px]"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
          >
            <option value="new">Yeni</option>
            <option value="viewed">Görüntülendi</option>
            <option value="qualified">Kalifiye</option>
            <option value="">Tümü</option>
          </select>
        </div>

        <div className="flex items-center justify-between text-xs">
          <div className="text-slate-600">
            Segment: <strong>{campaign.segment}</strong> · Toplam: <strong>{leads.length}</strong> · Seçili: <strong className="text-[#13a9e0]">{selectedIds.size}</strong>
          </div>
          <button onClick={toggleAll} className="text-[#13a9e0] font-bold hover:underline">
            {selectedIds.size === filtered.length ? "Seçimi kaldır" : "Tümünü seç"}
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-500 text-sm">Yükleniyor…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-lg">
            <Users size={40} className="mx-auto mb-3 text-slate-300" />
            <p className="text-slate-600 font-semibold">Bu segmentte lead yok</p>
            <p className="text-xs text-slate-500 mt-1">Önce Apify ile lead keşfi yap</p>
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
            {filtered.map(l => (
              <label
                key={l.id}
                className={`flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer ${selectedIds.has(l.id) ? "bg-blue-50" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(l.id)}
                  onChange={() => toggle(l.id)}
                  className="w-4 h-4 accent-[#13a9e0]"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-[#1e3a6e] truncate">
                      {l.fullName || `${l.firstName || ""} ${l.lastName || ""}`.trim() || "—"}
                    </span>
                    {l.emailVerified && (
                      <span className="text-[9px] bg-emerald-100 text-emerald-700 font-bold px-1.5 py-0.5 rounded uppercase">✓ verified</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-600 truncate">{l.email}</div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {l.jobTitle && <span>{l.jobTitle} · </span>}
                    {l.company}
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
          <Button variant="outline" onClick={onClose}>Vazgeç</Button>
          <Button
            onClick={submit}
            disabled={saving || selectedIds.size === 0}
            className="bg-[#1e3a6e]"
          >
            {saving ? "Ekleniyor…" : `${selectedIds.size} lead'i ekle`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function AddStepForm({ templates, onAdd }: any) {
  const [tpl, setTpl] = useState("");
  const [delay, setDelay] = useState(3);
  const [cond, setCond] = useState("always");
  return (
    <div className="mt-3 p-3 bg-slate-50 rounded-lg flex flex-wrap items-end gap-2">
      <div className="flex-1 min-w-[200px]">
        <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Şablon</div>
        <select value={tpl} onChange={(e) => setTpl(e.target.value)}
          className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white">
          <option value="">Seç…</option>
          {templates.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      <div>
        <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Gecikme (gün)</div>
        <input type="number" value={delay} onChange={(e) => setDelay(Number(e.target.value))}
          className="w-20 border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white" />
      </div>
      <div>
        <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Koşul</div>
        <select value={cond} onChange={(e) => setCond(e.target.value)}
          className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white">
          <option value="always">Her zaman</option>
          <option value="no_reply">Cevap yoksa</option>
          <option value="no_open">Açmadıysa</option>
        </select>
      </div>
      <Button
        disabled={!tpl}
        onClick={() => { if (tpl) { onAdd(Number(tpl), delay, cond); setTpl(""); } }}
        className="bg-[#13a9e0] hover:bg-[#0e7da6]"
      >
        <Plus size={12} className="mr-1" /> Ekle
      </Button>
    </div>
  );
}

function Modal({ title, children, onClose, wide }: any) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center overflow-auto p-4">
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${wide ? "max-w-3xl" : "max-w-lg"} my-8`}>
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h2 className="font-bold text-[#1e3a6e]">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: any) {
  return (
    <div>
      <Label className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-1 block">{label}</Label>
      {children}
    </div>
  );
}
