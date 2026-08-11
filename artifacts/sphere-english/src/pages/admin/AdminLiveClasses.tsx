import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, Button, Input, Label, Modal, Badge } from "@/components/ui/core";
import { useToast } from "@/hooks/use-toast";
import {
  Video, Plus, Trash2, Users, Search, X, Filter,
  Clock, Calendar, ExternalLink, Eye, UserPlus, ChevronDown
} from "lucide-react";
import { motion } from "framer-motion";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface LiveSession {
  id: number;
  title: string;
  description: string | null;
  teacherId: number;
  teacherName: string | null;
  teacherEmail: string | null;
  courseId: number | null;
  courseName: string | null;
  startTime: string;
  duration: number;
  meetingLink: string;
  maxStudents: number;
  type: "one-on-one" | "group";
  enrolledCount: number;
  createdAt: string;
}
interface Teacher { id: number; firstName: string; lastName: string; email: string; }
interface Student { id: number; firstName: string; lastName: string; email: string; currentLevel: string | null; }
interface AttendanceRecord {
  id: number; studentId: number;
  firstName: string | null; lastName: string | null; email: string | null;
  joinedAt: string | null; leftAt: string | null; durationMinutes: number | null;
}

// ─── API helper ────────────────────────────────────────────────────────────────
async function api(url: string, options?: RequestInit) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Hata oluştu" }));
    throw new Error(err.error || "Hata oluştu");
  }
  return res.json();
}

function statusInfo(s: LiveSession) {
  const now = new Date();
  const start = new Date(s.startTime);
  const end = new Date(start.getTime() + s.duration * 60000);
  if (now >= start && now <= end) return { label: "Aktif", color: "success" as const };
  if (now < start) return { label: "Yaklaşan", color: "default" as const };
  return { label: "Geçmiş", color: "secondary" as const };
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("tr-TR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function AdminLiveClasses() {
  const qc = useQueryClient();
  const { toast } = useToast();

  // Filters
  const [teacherFilter, setTeacherFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [viewSession, setViewSession] = useState<LiveSession | null>(null);
  const [addStudentSession, setAddStudentSession] = useState<LiveSession | null>(null);
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);

  // Create form state
  const [form, setForm] = useState({
    title: "", description: "", teacherId: "", courseId: "",
    startTime: "", duration: "60", meetingLink: "", maxStudents: "30", type: "group"
  });

  // ─── Queries ─────────────────────────────────────────────────────────────────
  const params = new URLSearchParams();
  if (teacherFilter !== "all") params.set("teacherId", teacherFilter);
  if (typeFilter !== "all") params.set("type", typeFilter);
  if (statusFilter !== "all") params.set("status", statusFilter);
  if (dateFrom) params.set("dateFrom", dateFrom);
  if (dateTo) params.set("dateTo", dateTo);
  if (search) params.set("search", search);

  const { data: sessions = [], isLoading } = useQuery<LiveSession[]>({
    queryKey: ["/api/admin/live-classes", teacherFilter, typeFilter, statusFilter, dateFrom, dateTo, search],
    queryFn: () => api(`/api/admin/live-classes?${params.toString()}`),
  });

  const { data: teachers = [] } = useQuery<Teacher[]>({
    queryKey: ["/api/admin/teachers"],
    queryFn: () => api("/api/admin/teachers"),
  });

  const { data: allStudents = [] } = useQuery<Student[]>({
    queryKey: ["/api/users", "student"],
    queryFn: () => api("/api/users?role=student"),
    enabled: !!addStudentSession,
  });

  const { data: attendance } = useQuery<{ liveClass: any; attendance: AttendanceRecord[] }>({
    queryKey: ["/api/live-classes", viewSession?.id, "attendance"],
    queryFn: () => api(`/api/live-classes/${viewSession!.id}/attendance`),
    enabled: !!viewSession,
  });

  // ─── Mutations ────────────────────────────────────────────────────────────────
  const createMut = useMutation({
    mutationFn: (body: object) => api("/api/live-classes", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
    }),
    onSuccess: () => {
      toast({ title: "Oturum oluşturuldu" });
      qc.invalidateQueries({ queryKey: ["/api/admin/live-classes"] });
      setIsCreateOpen(false);
      setForm({ title: "", description: "", teacherId: "", courseId: "", startTime: "", duration: "60", meetingLink: "", maxStudents: "30", type: "group" });
    },
    onError: (e: any) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api(`/api/live-classes/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Oturum silindi" });
      qc.invalidateQueries({ queryKey: ["/api/admin/live-classes"] });
    },
    onError: (e: any) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const addStudentsMut = useMutation({
    mutationFn: ({ sessionId, studentIds }: { sessionId: number; studentIds: number[] }) =>
      api(`/api/admin/live-classes/${sessionId}/students`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentIds }),
      }),
    onSuccess: () => {
      toast({ title: "Öğrenciler eklendi" });
      qc.invalidateQueries({ queryKey: ["/api/admin/live-classes"] });
      qc.invalidateQueries({ queryKey: ["/api/live-classes", addStudentSession?.id, "attendance"] });
      setAddStudentSession(null);
      setSelectedStudentIds([]);
      setStudentSearch("");
    },
    onError: (e: any) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const removeStudentMut = useMutation({
    mutationFn: ({ sessionId, studentId }: { sessionId: number; studentId: number }) =>
      api(`/api/admin/live-classes/${sessionId}/students/${studentId}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Öğrenci çıkarıldı" });
      qc.invalidateQueries({ queryKey: ["/api/live-classes", viewSession?.id, "attendance"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/live-classes"] });
    },
    onError: (e: any) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  // ─── Student search filter ────────────────────────────────────────────────────
  const filteredStudents = useMemo(() => {
    const q = studentSearch.toLowerCase();
    if (!q) return allStudents;
    return allStudents.filter(s =>
      `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)
    );
  }, [allStudents, studentSearch]);

  const enrolledIds = useMemo(() =>
    new Set((attendance?.attendance || []).map(a => a.studentId)),
    [attendance]
  );

  // ─── Create submit ────────────────────────────────────────────────────────────
  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title || !form.startTime || !form.duration || !form.maxStudents) {
      toast({ title: "Zorunlu alanları doldurun", variant: "destructive" }); return;
    }
    createMut.mutate({
      title: form.title,
      description: form.description || undefined,
      teacherId: form.teacherId ? parseInt(form.teacherId) : undefined,
      courseId: form.courseId ? parseInt(form.courseId) : undefined,
      startTime: form.startTime,
      duration: parseInt(form.duration),
      meetingLink: form.meetingLink || undefined,
      maxStudents: parseInt(form.maxStudents),
      type: form.type,
    });
  }

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Video className="h-6 w-6 text-primary" /> Canlı Ders Oturumları
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Tüm öğretmenlerin canlı derslerini yönetin</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" /> Yeni Oturum Ekle
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[180px]">
              <Label className="text-xs text-muted-foreground mb-1 block">Arama</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Başlık veya öğretmen..." className="pl-8 h-9" value={search}
                  onChange={e => setSearch(e.target.value)} />
                {search && <button onClick={() => setSearch("")} className="absolute right-2.5 top-2.5"><X className="h-4 w-4 text-muted-foreground" /></button>}
              </div>
            </div>

            <div className="min-w-[150px]">
              <Label className="text-xs text-muted-foreground mb-1 block">Öğretmen</Label>
              <select value={teacherFilter} onChange={e => setTeacherFilter(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="all">Tümü</option>
                {teachers.map(t => (
                  <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>
                ))}
              </select>
            </div>

            <div className="min-w-[130px]">
              <Label className="text-xs text-muted-foreground mb-1 block">Tür</Label>
              <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="all">Tümü</option>
                <option value="group">Grup</option>
                <option value="one-on-one">Birebir</option>
              </select>
            </div>

            <div className="min-w-[130px]">
              <Label className="text-xs text-muted-foreground mb-1 block">Durum</Label>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="all">Tümü</option>
                <option value="upcoming">Yaklaşan</option>
                <option value="past">Geçmiş</option>
              </select>
            </div>

            <div className="min-w-[140px]">
              <Label className="text-xs text-muted-foreground mb-1 block">Başlangıç Tarihi</Label>
              <Input type="date" className="h-9" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>

            <div className="min-w-[140px]">
              <Label className="text-xs text-muted-foreground mb-1 block">Bitiş Tarihi</Label>
              <Input type="date" className="h-9" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>

            {(teacherFilter !== "all" || typeFilter !== "all" || statusFilter !== "all" || dateFrom || dateTo || search) && (
              <Button variant="outline" size="sm" className="h-9 mt-4 gap-1.5" onClick={() => {
                setTeacherFilter("all"); setTypeFilter("all"); setStatusFilter("all");
                setDateFrom(""); setDateTo(""); setSearch("");
              }}>
                <X className="h-3.5 w-3.5" /> Temizle
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sessions Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mr-3" />
              Yükleniyor...
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-muted-foreground gap-3">
              <Video className="h-12 w-12 opacity-20" />
              <p>Oturum bulunamadı</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Başlık</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Öğretmen</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tarih & Saat</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Süre</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tür</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Katılımcı</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Durum</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => {
                    const status = statusInfo(s);
                    return (
                      <motion.tr key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium text-foreground">{s.title}</div>
                          {s.courseName && <div className="text-xs text-muted-foreground">{s.courseName}</div>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-foreground">{s.teacherName || "—"}</div>
                          <div className="text-xs text-muted-foreground">{s.teacherEmail || ""}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{fmtDate(s.startTime)}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{s.duration} dk</td>
                        <td className="px-4 py-3">
                          <Badge variant={s.type === "group" ? "default" : "secondary"}>
                            {s.type === "group" ? "Grup" : "Birebir"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {s.enrolledCount}/{s.maxStudents}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={status.color}>{status.label}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button size="sm" variant="ghost" className="h-7 px-2 gap-1" onClick={() => setViewSession(s)}>
                              <Eye className="h-3.5 w-3.5" /> Katılımcılar
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 gap-1" onClick={() => { setAddStudentSession(s); setSelectedStudentIds([]); setStudentSearch(""); }}>
                              <UserPlus className="h-3.5 w-3.5" /> Ekle
                            </Button>
                            <a href={s.meetingLink} target="_blank" rel="noopener noreferrer">
                              <Button size="sm" variant="ghost" className="h-7 px-2">
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Button>
                            </a>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:text-destructive"
                              onClick={() => { if (confirm("Bu oturumu silmek istediğinizden emin misiniz?")) deleteMut.mutate(s.id); }}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary */}
      {sessions.length > 0 && (
        <p className="text-xs text-muted-foreground text-right">{sessions.length} oturum listeleniyor</p>
      )}

      {/* ─── Create Modal ─────────────────────────────────────────────────────── */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Yeni Canlı Ders Oturumu">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <Label>Başlık *</Label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Örn: B2 Speaking Practice" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Öğretmen</Label>
              <select value={form.teacherId} onChange={e => setForm(f => ({ ...f, teacherId: e.target.value }))}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring mt-1">
                <option value="">Seçiniz</option>
                {teachers.map(t => (
                  <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Tür</Label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring mt-1">
                <option value="group">Grup</option>
                <option value="one-on-one">Birebir</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tarih & Saat *</Label>
              <Input type="datetime-local" value={form.startTime}
                onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} />
            </div>
            <div>
              <Label>Süre (dakika) *</Label>
              <Input type="number" value={form.duration} min={15} max={240}
                onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Maks. Öğrenci *</Label>
              <Input type="number" value={form.maxStudents} min={1}
                onChange={e => setForm(f => ({ ...f, maxStudents: e.target.value }))} />
            </div>
            <div>
              <Label>Toplantı Linki</Label>
              <Input value={form.meetingLink} onChange={e => setForm(f => ({ ...f, meetingLink: e.target.value }))}
                placeholder="https://..." />
            </div>
          </div>

          <div>
            <Label>Açıklama</Label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2} placeholder="Ders hakkında kısa açıklama..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none mt-1" />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" className="flex-1" disabled={createMut.isPending}>
              {createMut.isPending ? "Oluşturuluyor..." : "Oturum Oluştur"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>İptal</Button>
          </div>
        </form>
      </Modal>

      {/* ─── View Attendance Modal ───────────────────────────────────────────────── */}
      {viewSession && (
        <Modal isOpen={!!viewSession} onClose={() => setViewSession(null)}
          title={`Katılımcılar — ${viewSession.title}`}>
          <div className="space-y-4">
            <div className="bg-muted/30 rounded-lg p-3 text-sm space-y-1">
              <p><span className="text-muted-foreground">Öğretmen:</span> <span className="font-medium">{viewSession.teacherName || "—"}</span></p>
              <p><span className="text-muted-foreground">Tarih:</span> <span className="font-medium">{fmtDate(viewSession.startTime)}</span></p>
              <p><span className="text-muted-foreground">Süre:</span> <span className="font-medium">{viewSession.duration} dakika</span></p>
            </div>

            {!attendance ? (
              <div className="text-center py-6 text-muted-foreground text-sm">Yükleniyor...</div>
            ) : attendance.attendance.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                <Users className="h-8 w-8 opacity-20 mx-auto mb-2" />
                Henüz katılımcı yok
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {attendance.attendance.map(a => (
                  <div key={a.id} className="flex items-center justify-between bg-muted/20 rounded-lg px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">{a.firstName} {a.lastName}</p>
                      <p className="text-xs text-muted-foreground">{a.email}</p>
                      {a.joinedAt && (
                        <p className="text-xs text-muted-foreground">
                          {a.durationMinutes ? `${a.durationMinutes} dk katıldı` : "Katılım kaydedildi"}
                        </p>
                      )}
                    </div>
                    <Button size="sm" variant="ghost"
                      className="h-7 px-2 text-destructive hover:text-destructive shrink-0"
                      onClick={() => removeStudentMut.mutate({ sessionId: viewSession.id, studentId: a.studentId })}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <Button variant="outline" className="w-full gap-2" onClick={() => {
              setAddStudentSession(viewSession);
              setViewSession(null);
              setSelectedStudentIds([]);
              setStudentSearch("");
            }}>
              <UserPlus className="h-4 w-4" /> Öğrenci Ekle
            </Button>
          </div>
        </Modal>
      )}

      {/* ─── Add Students Modal ─────────────────────────────────────────────────── */}
      {addStudentSession && (
        <Modal isOpen={!!addStudentSession} onClose={() => { setAddStudentSession(null); setSelectedStudentIds([]); setStudentSearch(""); }}
          title={`Öğrenci Ekle — ${addStudentSession.title}`}>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="İsim veya e-posta ara..." value={studentSearch}
                onChange={e => setStudentSearch(e.target.value)} />
            </div>

            <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1 border rounded-lg p-2">
              {filteredStudents.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-4">Öğrenci bulunamadı</p>
              ) : filteredStudents.map(s => {
                const isEnrolledAlready = enrolledIds.has(s.id);
                const isSelected = selectedStudentIds.includes(s.id);
                return (
                  <label key={s.id}
                    className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors
                      ${isEnrolledAlready ? "opacity-50 cursor-not-allowed" : "hover:bg-muted/30"}
                      ${isSelected ? "bg-primary/10" : ""}`}>
                    <input type="checkbox" checked={isSelected || isEnrolledAlready}
                      disabled={isEnrolledAlready}
                      onChange={e => {
                        if (isEnrolledAlready) return;
                        setSelectedStudentIds(prev =>
                          e.target.checked ? [...prev, s.id] : prev.filter(id => id !== s.id)
                        );
                      }}
                      className="rounded" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{s.firstName} {s.lastName}</p>
                      <p className="text-xs text-muted-foreground truncate">{s.email}</p>
                    </div>
                    {isEnrolledAlready && <Badge variant="secondary" className="text-xs shrink-0">Kayıtlı</Badge>}
                    {s.currentLevel && !isEnrolledAlready && (
                      <Badge variant="outline" className="text-xs shrink-0">{s.currentLevel}</Badge>
                    )}
                  </label>
                );
              })}
            </div>

            {selectedStudentIds.length > 0 && (
              <p className="text-sm text-muted-foreground">{selectedStudentIds.length} öğrenci seçildi</p>
            )}

            <div className="flex gap-3">
              <Button className="flex-1" disabled={selectedStudentIds.length === 0 || addStudentsMut.isPending}
                onClick={() => addStudentsMut.mutate({ sessionId: addStudentSession.id, studentIds: selectedStudentIds })}>
                {addStudentsMut.isPending ? "Ekleniyor..." : `${selectedStudentIds.length || ""} Öğrenci Ekle`}
              </Button>
              <Button variant="outline" onClick={() => { setAddStudentSession(null); setSelectedStudentIds([]); setStudentSearch(""); }}>
                İptal
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
