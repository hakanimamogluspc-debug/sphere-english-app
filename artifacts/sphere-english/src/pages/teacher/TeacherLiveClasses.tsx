import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/core";
import { Badge, Button } from "@/components/ui/core";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Video, Clock, Users, Calendar, BarChart2, Plus, Trash2, ExternalLink,
  CheckCircle2, XCircle, LogIn, Wifi, AlertCircle
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { abbrevName } from "@/lib/utils";

const API = "http://localhost:8080/api";
function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem("sphere_token")}`, "Content-Type": "application/json" };
}
function fmt(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}
function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
}
function fmtDur(min: number | null | undefined) {
  if (!min) return "—";
  if (min < 60) return `${min} dk`;
  return `${Math.floor(min / 60)} sa ${min % 60} dk`;
}

type ClassPhase = "too-early" | "soon" | "live" | "ended";
function getPhase(startTime: string, duration: number): ClassPhase {
  const now = Date.now();
  const start = new Date(startTime).getTime();
  const end = start + duration * 60000;
  if (now > end) return "ended";
  if (now >= start) return "live";
  if (now >= start - 15 * 60000) return "soon";
  return "too-early";
}

function ClassBadge({ startTime, duration }: { startTime: string; duration: number }) {
  const p = getPhase(startTime, duration);
  if (p === "live") return <Badge className="bg-green-100 text-green-800 animate-pulse">● Canlı</Badge>;
  if (p === "soon") return <Badge className="bg-amber-100 text-amber-800">Başlamak üzere</Badge>;
  if (p === "ended") return <Badge className="bg-gray-100 text-gray-500">Sona Erdi</Badge>;
  return <Badge className="bg-blue-100 text-blue-800">Yaklaşan</Badge>;
}

function useZoomStatus() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  useEffect(() => {
    fetch(`${API}/zoom/status`, { headers: authHeaders() })
      .then(r => r.json())
      .then(d => setConfigured(d.configured))
      .catch(() => setConfigured(false));
  }, []);
  return configured;
}

export default function TeacherLiveClasses() {
  const { user } = useAuth();
  const { toast } = useToast();
  const zoomConfigured = useZoomStatus();

  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [attendanceModal, setAttendanceModal] = useState<any | null>(null);
  const [attendanceData, setAttendanceData] = useState<any | null>(null);
  const [loadingAtt, setLoadingAtt] = useState(false);

  const { register, handleSubmit, reset } = useForm();

  const load = useCallback(() => {
    setLoading(true);
    fetch(`${API}/live-classes`, { headers: authHeaders() })
      .then(r => r.json())
      .then(d => setClasses(Array.isArray(d) ? d : []))
      .catch(() => setClasses([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAttendance = async (cls: any) => {
    setAttendanceModal(cls);
    setLoadingAtt(true);
    try {
      const res = await fetch(`${API}/live-classes/${cls.id}/attendance`, { headers: authHeaders() });
      const data = await res.json();
      setAttendanceData(data);
    } catch {
      setAttendanceData(null);
    } finally {
      setLoadingAtt(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Bu dersi silmek istediğinizden emin misiniz?")) return;
    await fetch(`${API}/live-classes/${id}`, { method: "DELETE", headers: authHeaders() });
    toast({ title: "Ders silindi." });
    load();
  };

  const onCreate = async (data: any) => {
    setCreating(true);
    try {
      const body: any = {
        title: data.title,
        description: data.description || undefined,
        startTime: new Date(data.startTime).toISOString(),
        duration: parseInt(data.duration),
        maxStudents: parseInt(data.maxStudents) || 20,
        type: "group",
      };
      if (!zoomConfigured) body.meetingLink = data.meetingLink;

      const res = await fetch(`${API}/live-classes`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        toast({ title: "Hata", description: json.error || "Oluşturulamadı.", variant: "destructive" }); return;
      }
      toast({ title: "Ders Oluşturuldu!", description: zoomConfigured ? "Zoom toplantısı otomatik oluşturuldu." : "Ders planlandı." });
      setShowCreate(false);
      reset();
      load();
    } catch {
      toast({ title: "Hata", description: "Bağlantı hatası.", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const now = new Date();
  const upcoming = classes.filter(c => new Date(new Date(c.startTime).getTime() + c.duration * 60000) > now);
  const past = classes.filter(c => new Date(new Date(c.startTime).getTime() + c.duration * 60000) <= now);

  const attPercent = attendanceData
    ? Math.round((attendanceData.attendance.length / (attendanceData.liveClass.maxStudents || 1)) * 100)
    : 0;
  const avgDur = attendanceData?.attendance.length
    ? Math.round(attendanceData.attendance.filter((a: any) => a.durationMinutes).reduce((s: number, a: any) => s + (a.durationMinutes || 0), 0) / attendanceData.attendance.filter((a: any) => a.durationMinutes).length || 0)
    : 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display">Canlı Derslerim</h1>
          <p className="text-muted-foreground mt-1">Derslerinizi planlayın ve yoklama raporlarını inceleyin.</p>
        </div>
        <div className="flex items-center gap-3">
          {zoomConfigured !== null && (
            <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${zoomConfigured ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
              <Wifi className="h-3.5 w-3.5" />
              {zoomConfigured ? "Zoom Entegre" : "Zoom Bağlı Değil"}
            </div>
          )}
          <Button onClick={() => setShowCreate(true)} className="flex items-center gap-2">
            <Plus size={18} /> Ders Planla
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">{[1, 2, 3].map(i => <Card key={i} className="h-28 animate-pulse bg-secondary/50" />)}</div>
      ) : (
        <>
          <div>
            <h2 className="text-lg font-semibold mb-3">Yaklaşan & Aktif</h2>
            {upcoming.length === 0 ? (
              <Card><CardContent className="py-10 text-center text-muted-foreground"><Video className="h-10 w-10 mx-auto mb-2 opacity-40" /><p>Planlanmış ders yok.</p></CardContent></Card>
            ) : (
              <div className="space-y-3">
                {upcoming.map(cls => (
                  <Card key={cls.id} className={`border-l-4 ${getPhase(cls.startTime, cls.duration) === "live" ? "border-l-green-500" : getPhase(cls.startTime, cls.duration) === "soon" ? "border-l-amber-400" : "border-l-primary"}`}>
                    <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-bold">{cls.title}</h3>
                          <ClassBadge startTime={cls.startTime} duration={cls.duration} />
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1"><Calendar size={14} /> {fmtDate(cls.startTime)}</span>
                          <span className="flex items-center gap-1"><Clock size={14} /> {fmt(cls.startTime)} · {cls.duration} dk</span>
                          <span className="flex items-center gap-1"><Users size={14} /> {cls.enrolledCount}/{cls.maxStudents}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" variant="outline" className="flex items-center gap-1.5" onClick={() => openAttendance(cls)}>
                          <BarChart2 size={14} /> Yoklama
                        </Button>
                        {cls.meetingLink && (
                          <a href={cls.meetingLink} target="_blank" rel="noreferrer">
                            <Button size="sm" className="flex items-center gap-1.5"><LogIn size={14} /> Katıl</Button>
                          </a>
                        )}
                        <Button size="sm" variant="ghost" className="text-red-500 hover:bg-red-50" onClick={() => handleDelete(cls.id)}>
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {past.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3">Geçmiş Dersler</h2>
              <div className="space-y-3">
                {past.map(cls => (
                  <Card key={cls.id} className="opacity-80 hover:opacity-100 transition-opacity">
                    <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold">{cls.title}</h3>
                          <Badge className="bg-gray-100 text-gray-500">Sona Erdi</Badge>
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1"><Calendar size={14} /> {fmtDate(cls.startTime)}</span>
                          <span className="flex items-center gap-1"><Clock size={14} /> {fmt(cls.startTime)} · {cls.duration} dk</span>
                          <span className="flex items-center gap-1"><Users size={14} /> {cls.enrolledCount} katılımcı</span>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" variant="outline" className="flex items-center gap-1.5" onClick={() => openAttendance(cls)}>
                          <BarChart2 size={14} /> Yoklama Raporu
                        </Button>
                        <Button size="sm" variant="ghost" className="text-red-500 hover:bg-red-50" onClick={() => handleDelete(cls.id)}>
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Ders Oluşturma Modal */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Canlı Ders Planla</DialogTitle></DialogHeader>
          {zoomConfigured && (
            <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
              <span>Zoom entegrasyonu aktif — toplantı otomatik oluşturulacak ve kayıt devre dışı bırakılacak.</span>
            </div>
          )}
          {zoomConfigured === false && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>Zoom bağlı değil — toplantı bağlantısını manuel giriniz.</span>
            </div>
          )}
          <form onSubmit={handleSubmit(onCreate)} className="space-y-4 mt-1">
            <div>
              <Label>Başlık *</Label>
              <Input {...register("title", { required: true })} placeholder="örn. Konuşma Pratiği — B1" className="mt-1" />
            </div>
            <div>
              <Label>Açıklama</Label>
              <Input {...register("description")} placeholder="Kısa açıklama" className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tarih & Saat *</Label>
                <Input type="datetime-local" {...register("startTime", { required: true })} className="mt-1" />
              </div>
              <div>
                <Label>Süre (dakika) *</Label>
                <Input type="number" min={15} max={180} defaultValue={60} {...register("duration", { required: true })} className="mt-1" />
              </div>
            </div>
            {!zoomConfigured && (
              <div>
                <Label>Zoom Bağlantısı *</Label>
                <Input {...register("meetingLink")} placeholder="https://zoom.us/j/..." className="mt-1" />
              </div>
            )}
            <div>
              <Label>Maksimum Öğrenci</Label>
              <Input type="number" min={1} max={100} defaultValue={20} {...register("maxStudents")} className="mt-1" />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={creating} className="flex-1">{creating ? "Oluşturuluyor..." : "Ders Planla"}</Button>
              <Button type="button" variant="outline" onClick={() => { setShowCreate(false); reset(); }}>İptal</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Yoklama Raporu Modal */}
      <Dialog open={!!attendanceModal} onOpenChange={() => { setAttendanceModal(null); setAttendanceData(null); }}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Yoklama Raporu</DialogTitle>
          </DialogHeader>
          {attendanceModal && (
            <div className="text-sm text-muted-foreground mb-4 space-y-0.5">
              <p className="font-semibold text-foreground text-base">{attendanceModal.title}</p>
              <p>{fmtDate(attendanceModal.startTime)} · {fmt(attendanceModal.startTime)} · {attendanceModal.duration} dk</p>
            </div>
          )}
          {loadingAtt ? (
            <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-10 animate-pulse bg-secondary/50 rounded-lg" />)}</div>
          ) : attendanceData ? (
            <>
              <div className="grid grid-cols-3 gap-3 mb-5">
                <Card className="bg-green-50 border-green-200">
                  <CardContent className="p-3 text-center">
                    <p className="text-2xl font-bold text-green-700">{attendanceData.attendance.length}</p>
                    <p className="text-xs text-green-600 mt-0.5">Katılımcı</p>
                  </CardContent>
                </Card>
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="p-3 text-center">
                    <p className="text-2xl font-bold text-blue-700">{attPercent}%</p>
                    <p className="text-xs text-blue-600 mt-0.5">Doluluk Oranı</p>
                  </CardContent>
                </Card>
                <Card className="bg-purple-50 border-purple-200">
                  <CardContent className="p-3 text-center">
                    <p className="text-2xl font-bold text-purple-700">{fmtDur(avgDur || null)}</p>
                    <p className="text-xs text-purple-600 mt-0.5">Ort. Kalma Süresi</p>
                  </CardContent>
                </Card>
              </div>

              {attendanceData.attendance.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-10 w-10 mx-auto mb-2 opacity-40" />
                  <p>Bu derse katılan öğrenci bulunamadı.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground mb-2">Katılımcı Listesi</p>
                  {attendanceData.attendance.map((a: any) => (
                    <div key={a.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-secondary/40">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                          {a.firstName?.[0] || "?"}{a.lastName?.[0] || ""}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{abbrevName(a.firstName, a.lastName)}</p>
                          <p className="text-xs text-muted-foreground">{a.email}</p>
                        </div>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        <div className="flex items-center gap-1 justify-end">
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                          <span>Giriş: {fmt(a.joinedAt)}</span>
                        </div>
                        {a.leftAt && (
                          <div className="flex items-center gap-1 justify-end mt-0.5">
                            <XCircle className="h-3.5 w-3.5 text-gray-400" />
                            <span>Çıkış: {fmt(a.leftAt)}</span>
                          </div>
                        )}
                        {a.durationMinutes && (
                          <div className="mt-0.5 font-medium text-foreground">{fmtDur(a.durationMinutes)}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">Yoklama verisi alınamadı.</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
