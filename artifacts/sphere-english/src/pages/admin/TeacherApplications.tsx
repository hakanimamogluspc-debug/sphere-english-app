import { useEffect, useState } from "react";
import {
  GraduationCap,
  Loader2,
  RefreshCw,
  Download,
  FileText,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Award,
  X,
  Check,
  Archive,
  AlertCircle,
  Eye,
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
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
  return res.json();
}

interface Application {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  birth_date: string;
  nationality: string;
  location: string;
  experience: string;
  education: string;
  english_level: string;
  certifications: string | null;
  references_text: string | null;
  cv_filename: string | null;
  cv_mime_type: string | null;
  cv_size_bytes: number | null;
  status: string;
  admin_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface StatusCount {
  status: string;
  count: number;
}

const STATUS_META: Record<string, { label: string; bg: string; color: string }> = {
  pending: { label: "Beklemede", bg: "#fef3c7", color: "#92400e" },
  reviewing: { label: "İnceleniyor", bg: "#dbeafe", color: "#1e40af" },
  accepted: { label: "Kabul Edildi", bg: "#d1fae5", color: "#065f46" },
  rejected: { label: "Reddedildi", bg: "#fee2e2", color: "#991b1b" },
  archived: { label: "Arşivlendi", bg: "#f3f4f6", color: "#374151" },
};

const EXP_LABEL: Record<string, string> = {
  "0": "Tecrübem Yok",
  "1-2": "1-2 Yıl",
  "3-4": "3-4 Yıl",
  "5+": "+5 Yıl",
};

const EDU_LABEL: Record<string, string> = {
  univ: "Üniversite",
  ms: "Yüksek Lisans",
  phd: "Doktora",
  student: "Öğrenci",
};

const ENG_LABEL: Record<string, string> = {
  beginner: "Beginner",
  elementary: "Elementary",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export default function TeacherApplications() {
  const [items, setItems] = useState<Application[]>([]);
  const [counts, setCounts] = useState<StatusCount[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Application | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try {
      const qs = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : "";
      const data = await apiFetch(`/admin/teacher-applications${qs}`);
      setItems(data.items ?? []);
      setCounts(data.counts ?? []);
    } catch (e: any) {
      alert("Başvurular alınamadı: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  async function updateApplication(id: number, body: { status?: string; adminNotes?: string }) {
    setSavingId(id);
    try {
      await apiFetch(`/admin/teacher-applications/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      // Optimistic update
      setItems((prev) =>
        prev.map((it) =>
          it.id === id
            ? { ...it, ...(body.status ? { status: body.status, reviewed_at: new Date().toISOString() } : {}), ...(body.adminNotes !== undefined ? { admin_notes: body.adminNotes } : {}) }
            : it,
        ),
      );
      if (selected?.id === id) {
        setSelected((s) => (s ? { ...s, ...(body.status ? { status: body.status } : {}), ...(body.adminNotes !== undefined ? { admin_notes: body.adminNotes } : {}) } : s));
      }
    } catch (e: any) {
      alert("Güncellenemedi: " + e.message);
    } finally {
      setSavingId(null);
    }
  }

  function downloadCv(id: number, filename?: string | null) {
    const token = localStorage.getItem(TOKEN_KEY);
    // window.open + auth Header verilemiyor; bu yüzden fetch + blob ile download
    fetch(`${API}/admin/teacher-applications/${id}/cv`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error("CV indirilemedi");
        return r.blob();
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename || `cv-${id}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      })
      .catch((e) => alert("CV indirilemedi: " + e.message));
  }

  function getCount(status: string) {
    return counts.find((c) => c.status === status)?.count ?? 0;
  }

  const totalCount = counts.reduce((a, b) => a + Number(b.count || 0), 0);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <GraduationCap className="w-7 h-7 text-blue-600" />
        <h1 className="text-2xl font-bold text-slate-900">Eğitmen Başvuruları</h1>
      </div>
      <p className="text-sm text-slate-500 mb-6">
        Pazarlama sitesindeki /egitmen-ol formundan gelen başvurular.
      </p>

      {/* Status filter chips */}
      <div className="flex flex-wrap gap-2 mb-5">
        <FilterChip label={`Tümü (${totalCount})`} active={statusFilter === ""} onClick={() => setStatusFilter("")} />
        {Object.entries(STATUS_META).map(([k, m]) => (
          <FilterChip
            key={k}
            label={`${m.label} (${getCount(k)})`}
            active={statusFilter === k}
            color={m.color}
            bg={m.bg}
            onClick={() => setStatusFilter(k)}
          />
        ))}
        <button onClick={load} className="ml-auto inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700">
          <RefreshCw size={14} /> Yenile
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin inline-block mr-2" />
          Yükleniyor…
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-xl">
          <AlertCircle className="w-10 h-10 mx-auto text-slate-300 mb-3" />
          <div className="text-slate-500">
            {statusFilter ? "Bu durumda başvuru yok." : "Henüz başvuru yok."}
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left p-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Aday</th>
                <th className="text-left p-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">İletişim</th>
                <th className="text-left p-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Profil</th>
                <th className="text-left p-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Durum</th>
                <th className="text-left p-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Tarih</th>
                <th className="text-left p-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => {
                const meta = STATUS_META[a.status] ?? STATUS_META.pending;
                const certs: string[] = a.certifications
                  ? (() => { try { return JSON.parse(a.certifications); } catch { return [a.certifications]; } })()
                  : [];
                return (
                  <tr key={a.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50">
                    <td className="p-3">
                      <div className="font-bold text-sm text-slate-900">{a.full_name}</div>
                      <div className="text-xs text-slate-500">{a.nationality} · {a.location}</div>
                    </td>
                    <td className="p-3 text-xs">
                      <a href={`mailto:${a.email}`} className="text-blue-600 hover:underline block">{a.email}</a>
                      <a href={`tel:${a.phone}`} className="text-slate-600 block">{a.phone}</a>
                    </td>
                    <td className="p-3 text-xs">
                      <div className="text-slate-700">{EDU_LABEL[a.education] ?? a.education} · {EXP_LABEL[a.experience] ?? a.experience}</div>
                      <div className="text-slate-500">İng: {ENG_LABEL[a.english_level] ?? a.english_level}</div>
                      {certs.length > 0 && certs[0] !== "HİÇBİRİ" && (
                        <div className="text-slate-400 mt-0.5">{certs.join(", ")}</div>
                      )}
                    </td>
                    <td className="p-3">
                      <span className="inline-block px-2 py-1 rounded text-[10px] font-bold uppercase" style={{ background: meta.bg, color: meta.color }}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="p-3 text-xs text-slate-500">
                      {new Date(a.created_at).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setSelected(a)}
                          className="p-1.5 rounded hover:bg-slate-100 text-slate-600"
                          title="Detay"
                        >
                          <Eye size={16} />
                        </button>
                        {a.cv_filename && (
                          <button
                            onClick={() => downloadCv(a.id, a.cv_filename)}
                            className="p-1.5 rounded hover:bg-slate-100 text-slate-600"
                            title="CV İndir"
                          >
                            <Download size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Detay modal */}
      {selected && (
        <DetailModal
          application={selected}
          onClose={() => setSelected(null)}
          onUpdate={(body) => updateApplication(selected.id, body)}
          onDownloadCv={() => downloadCv(selected.id, selected.cv_filename)}
          saving={savingId === selected.id}
        />
      )}
    </div>
  );
}

function FilterChip({
  label,
  active,
  color,
  bg,
  onClick,
}: {
  label: string;
  active: boolean;
  color?: string;
  bg?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
        active ? "shadow-sm" : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"
      }`}
      style={active ? { background: bg ?? "#e0e7ff", color: color ?? "#3730a3" } : {}}
    >
      {label}
    </button>
  );
}

function DetailModal({
  application,
  onClose,
  onUpdate,
  onDownloadCv,
  saving,
}: {
  application: Application;
  onClose: () => void;
  onUpdate: (body: { status?: string; adminNotes?: string }) => void;
  onDownloadCv: () => void;
  saving: boolean;
}) {
  const [notes, setNotes] = useState(application.admin_notes ?? "");
  const certs: string[] = application.certifications
    ? (() => { try { return JSON.parse(application.certifications!); } catch { return [application.certifications!]; } })()
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 p-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{application.full_name}</h2>
            <p className="text-xs text-slate-500">Başvuru #{application.id}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        {/* İçerik */}
        <div className="p-5 space-y-4">
          <Section title="İletişim">
            <Field icon={<Mail size={14} />} label="E-posta" value={<a href={`mailto:${application.email}`} className="text-blue-600 hover:underline">{application.email}</a>} />
            <Field icon={<Phone size={14} />} label="Telefon" value={<a href={`tel:${application.phone}`} className="text-blue-600 hover:underline">{application.phone}</a>} />
            <Field icon={<Calendar size={14} />} label="Doğum" value={application.birth_date} />
            <Field icon={<MapPin size={14} />} label="Milliyet / Lokasyon" value={`${application.nationality} · ${application.location}`} />
          </Section>

          <Section title="Profesyonel Profil">
            <Field label="Tecrübe" value={EXP_LABEL[application.experience] ?? application.experience} />
            <Field label="Eğitim" value={EDU_LABEL[application.education] ?? application.education} />
            <Field label="İngilizce Seviyesi" value={ENG_LABEL[application.english_level] ?? application.english_level} />
            <Field icon={<Award size={14} />} label="Sertifikalar" value={certs.length > 0 ? certs.join(", ") : "—"} />
          </Section>

          {application.references_text && (
            <Section title="Referans">
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{application.references_text}</p>
            </Section>
          )}

          {application.cv_filename && (
            <Section title="CV">
              <button
                onClick={onDownloadCv}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold"
              >
                <Download size={14} />
                {application.cv_filename}
                {application.cv_size_bytes && (
                  <span className="text-xs opacity-80">
                    ({(application.cv_size_bytes / 1024).toFixed(0)} KB)
                  </span>
                )}
              </button>
            </Section>
          )}

          <Section title="Yönetici Notları">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => {
                if (notes !== (application.admin_notes ?? "")) {
                  onUpdate({ adminNotes: notes });
                }
              }}
              rows={3}
              placeholder="İç not (sadece adminler görür)..."
              className="w-full p-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
            />
          </Section>

          <Section title="Durum">
            <div className="flex flex-wrap gap-2">
              {[
                { v: "reviewing", label: "İnceleniyor", icon: <Eye size={14} />, color: "bg-blue-600" },
                { v: "accepted", label: "Kabul", icon: <Check size={14} />, color: "bg-emerald-600" },
                { v: "rejected", label: "Reddet", icon: <X size={14} />, color: "bg-red-600" },
                { v: "archived", label: "Arşivle", icon: <Archive size={14} />, color: "bg-slate-500" },
              ].map((b) => (
                <button
                  key={b.v}
                  disabled={saving || application.status === b.v}
                  onClick={() => onUpdate({ status: b.v })}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-white transition-opacity ${b.color} ${application.status === b.v ? "opacity-50 cursor-default" : "hover:opacity-90"}`}
                >
                  {b.icon} {b.label}
                </button>
              ))}
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">{title}</h3>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Field({ icon, label, value }: { icon?: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {icon && <span className="text-slate-400 flex-shrink-0">{icon}</span>}
      <span className="text-slate-500 min-w-[140px]">{label}:</span>
      <span className="text-slate-800 font-medium">{value}</span>
    </div>
  );
}
