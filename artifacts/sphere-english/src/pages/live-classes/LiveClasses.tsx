import { useState, useEffect, useRef, useCallback } from "react";
import { useGetLiveClasses, useCreateLiveClass } from "@workspace/api-client-react";
import { Card, CardContent, Badge, Button } from "@/components/ui/core";
import { Video, Clock, Users, Calendar, ExternalLink, Plus, CheckCircle2, LogIn, AlertCircle, Wifi } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

import { API } from "@/lib/api-url";

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem("sphere_token")}`, "Content-Type": "application/json" };
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("tr-TR", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}
function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}
function formatDuration(minutes: number | null | undefined) {
  if (!minutes) return "—";
  if (minutes < 60) return `${minutes} dk`;
  return `${Math.floor(minutes / 60)} sa ${minutes % 60} dk`;
}

type ClassPhase = "too-early" | "soon" | "live" | "ended";

function getClassPhase(startTime: string, duration: number): ClassPhase {
  const now = Date.now();
  const start = new Date(startTime).getTime();
  const end = start + duration * 60000;
  const windowStart = start - 15 * 60000;
  if (now > end) return "ended";
  if (now >= start) return "live";
  if (now >= windowStart) return "soon";
  return "too-early";
}

function ClassStatus({ startTime, duration }: { startTime: string; duration: number }) {
  const phase = getClassPhase(startTime, duration);
  if (phase === "live") return <Badge className="bg-green-100 text-green-800 animate-pulse">● Canlı</Badge>;
  if (phase === "soon") return <Badge className="bg-amber-100 text-amber-800">Başlamak üzere</Badge>;
  if (phase === "ended") return <Badge className="bg-gray-100 text-gray-500">Sona Erdi</Badge>;
  return <Badge className="bg-blue-100 text-blue-800">Yaklaşan</Badge>;
}

const typeLabel: Record<string, string> = { group: "Grup", "one-on-one": "Birebir" };

function useStudentLiveClasses() {
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const refresh = useCallback(() => {
    fetch(`${API}/student/live-classes`, { headers: authHeaders() })
      .then(r => r.json())
      .then(d => setData(Array.isArray(d) ? d : []))
      .catch(() => setData([]))
      .finally(() => setIsLoading(false));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  return { data, isLoading, refresh };
}

function useAllLiveClasses() {
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const refresh = useCallback(() => {
    fetch(`${API}/live-classes`, { headers: authHeaders() })
      .then(r => r.json())
      .then(d => setData(Array.isArray(d) ? d : []))
      .catch(() => setData([]))
      .finally(() => setIsLoading(false));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  return { data, isLoading, refresh };
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

export default function LiveClasses() {
  const { user } = useAuth();
  const isStudent = user?.role === "student";
  const canCreate = user?.role === "teacher" || user?.role === "admin";

  const { data: studentClasses, isLoading: studentLoading, refresh: refreshStudent } = useStudentLiveClasses();
  const { data: allClasses, isLoading: allLoading, refresh: refreshAll } = useAllLiveClasses();
  const classes = isStudent ? studentClasses : allClasses;
  const isLoading = isStudent ? studentLoading : allLoading;
  const refresh = isStudent ? refreshStudent : refreshAll;

  const zoomConfigured = useZoomStatus();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [joining, setJoining] = useState<number | null>(null);
  const [attendingId, setAttendingId] = useState<number | null>(null);
  const attendingIdRef = useRef<number | null>(null);

  const { register, handleSubmit, reset, watch } = useForm();

  const now = new Date();
  const upcoming = classes?.filter(c => new Date(new Date(c.startTime).getTime() + c.duration * 60000) > now) || [];
  const past = classes?.filter(c => new Date(new Date(c.startTime).getTime() + c.duration * 60000) <= now) || [];

  const callLeave = useCallback(async (classId: number) => {
    try {
      await fetch(`${API}/live-classes/${classId}/leave`, {
        method: "POST",
        headers: authHeaders(),
      });
    } catch {}
  }, []);

  useEffect(() => {
    attendingIdRef.current = attendingId;
  }, [attendingId]);

  useEffect(() => {
    const handler = () => {
      if (attendingIdRef.current) {
        navigator.sendBeacon(`${API}/live-classes/${attendingIdRef.current}/leave`);
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const handleJoin = async (cls: any) => {
    const phase = getClassPhase(cls.startTime, cls.duration);
    if (phase === "too-early") {
      toast({ title: "Henüz erken", description: "Derse 15 dakika öncesinden itibaren katılabilirsiniz.", variant: "destructive" }); return;
    }
    if (phase === "ended") {
      toast({ title: "Ders sona erdi", description: "Bu dersin süresi doldu.", variant: "destructive" }); return;
    }

    setJoining(cls.id);
    try {
      const res = await fetch(`${API}/live-classes/${cls.id}/join`, {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Hata", description: data.error || "Derse katılınamadı.", variant: "destructive" });
        return;
      }
      setAttendingId(cls.id);
      toast({ title: "Derse katıldınız!", description: "Zoom toplantısı açılıyor..." });
      window.open(data.meetingLink || cls.meetingLink, "_blank");
      refresh();
    } catch {
      toast({ title: "Hata", description: "Bağlantı hatası.", variant: "destructive" });
    } finally {
      setJoining(null);
    }
  };

  const handleLeave = async (classId: number) => {
    await callLeave(classId);
    setAttendingId(null);
    toast({ title: "Dersten çıkıldı", description: "Yoklama kaydedildi." });
    refresh();
  };

  const onCreateSubmit = async (data: any) => {
    const token = localStorage.getItem("sphere_token");
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
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        toast({ title: "Hata", description: json.error || "Oluşturulamadı.", variant: "destructive" }); return;
      }
      toast({ title: "Ders Oluşturuldu!", description: zoomConfigured ? "Zoom toplantısı otomatik oluşturuldu." : "Dersiniz planlandı." });
      refresh();
      setShowCreate(false);
      reset();
    } catch {
      toast({ title: "Hata", description: "Bağlantı hatası.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display">Canlı Dersler</h1>
          <p className="text-muted-foreground mt-1">Öğretmenlerinizle canlı oturumlara katılın.</p>
        </div>
        <div className="flex items-center gap-3">
          {zoomConfigured !== null && (
            <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${zoomConfigured ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
              <Wifi className="h-3.5 w-3.5" />
              {zoomConfigured ? "Zoom Entegre" : "Zoom Bağlı Değil"}
            </div>
          )}
          {canCreate && (
            <Button onClick={() => setShowCreate(true)} className="flex items-center gap-2">
              <Plus size={18} /> Ders Planla
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Card key={i} className="h-36 animate-pulse bg-secondary/50" />)}
        </div>
      ) : (
        <>
          <div>
            <h2 className="text-xl font-bold mb-4">Yaklaşan ve Aktif Oturumlar</h2>
            {upcoming.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Video className="h-12 w-12 mx-auto mb-3 opacity-40" />
                  <p>Planlanmış yaklaşan ders yok.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {upcoming.map(cls => {
                  const phase = getClassPhase(cls.startTime, cls.duration);
                  const isAttending = attendingId === cls.id;
                  const alreadyJoined = cls.isEnrolled || isAttending;
                  const canJoin = (phase === "live" || phase === "soon") && isStudent;
                  return (
                    <Card key={cls.id} className={`overflow-hidden border-l-4 ${phase === "live" ? "border-l-green-500" : phase === "soon" ? "border-l-amber-400" : "border-l-accent"}`}>
                      <CardContent className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2 flex-wrap">
                            <h3 className="text-lg font-bold">{cls.title}</h3>
                            <ClassStatus startTime={cls.startTime} duration={cls.duration} />
                            <Badge variant="outline">{typeLabel[cls.type] || cls.type}</Badge>
                          </div>
                          {cls.description && <p className="text-muted-foreground text-sm mb-3">{cls.description}</p>}
                          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1.5"><Calendar size={15} /> {formatDate(cls.startTime)}</span>
                            <span className="flex items-center gap-1.5"><Clock size={15} /> {formatTime(cls.startTime)} · {cls.duration} dk</span>
                            <span className="flex items-center gap-1.5"><Users size={15} /> {cls.enrolledCount}/{cls.maxStudents} öğrenci</span>
                            {cls.teacherName && <span className="text-xs">🎓 {cls.teacherName}</span>}
                          </div>
                          {alreadyJoined && cls.attendanceRecord?.joinedAt && (
                            <div className="mt-2 flex items-center gap-1.5 text-xs text-green-700 bg-green-50 rounded-md px-2 py-1 w-fit">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Katıldınız · {formatTime(cls.attendanceRecord.joinedAt)}
                              {cls.attendanceRecord.durationMinutes && ` · ${formatDuration(cls.attendanceRecord.durationMinutes)}`}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col gap-2 shrink-0 items-end">
                          {isStudent && (
                            <>
                              {isAttending ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="border-red-200 text-red-600 hover:bg-red-50"
                                  onClick={() => handleLeave(cls.id)}
                                >
                                  Dersten Çık
                                </Button>
                              ) : canJoin ? (
                                <Button
                                  size="sm"
                                  className={`flex items-center gap-2 ${phase === "live" ? "bg-green-600 hover:bg-green-700" : ""}`}
                                  onClick={() => handleJoin(cls)}
                                  disabled={joining === cls.id}
                                >
                                  <LogIn size={15} />
                                  {joining === cls.id ? "Katılıyor..." : alreadyJoined ? "Tekrar Katıl" : "Derse Katıl"}
                                </Button>
                              ) : (
                                <div className="text-xs text-muted-foreground flex items-center gap-1">
                                  <AlertCircle className="h-3.5 w-3.5" />
                                  {phase === "too-early" ? "15 dk önce aktif olur" : "Süre doldu"}
                                </div>
                              )}
                            </>
                          )}
                          {!isStudent && cls.meetingLink && (
                            <a href={cls.meetingLink} target="_blank" rel="noreferrer">
                              <Button size="sm" variant="outline" className="flex items-center gap-2">
                                <ExternalLink size={15} /> Toplantıyı Aç
                              </Button>
                            </a>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {past.length > 0 && (
            <div>
              <h2 className="text-xl font-bold mb-4">Geçmiş Oturumlar</h2>
              <div className="space-y-3">
                {past.map(cls => (
                  <Card key={cls.id} className="opacity-75 hover:opacity-100 transition-opacity">
                    <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-3 mb-1 flex-wrap">
                          <h3 className="text-base font-semibold">{cls.title}</h3>
                          <Badge className="bg-gray-100 text-gray-500">Sona Erdi</Badge>
                          <Badge variant="outline">{typeLabel[cls.type] || cls.type}</Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1.5"><Calendar size={14} /> {formatDate(cls.startTime)}</span>
                          <span className="flex items-center gap-1.5"><Clock size={14} /> {formatTime(cls.startTime)} · {cls.duration} dk</span>
                          <span className="flex items-center gap-1.5"><Users size={14} /> {cls.enrolledCount} katılımcı</span>
                        </div>
                      </div>
                      {isStudent && cls.attendanceRecord?.joinedAt ? (
                        <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 rounded-md px-2.5 py-1.5 shrink-0">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Katıldınız {cls.attendanceRecord.durationMinutes ? `· ${formatDuration(cls.attendanceRecord.durationMinutes)}` : ""}
                        </div>
                      ) : isStudent ? (
                        <div className="text-xs text-muted-foreground">Katılmadınız</div>
                      ) : null}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Canlı Ders Planla</DialogTitle>
          </DialogHeader>
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
          <form onSubmit={handleSubmit(onCreateSubmit)} className="space-y-4 mt-2">
            <div>
              <Label>Başlık *</Label>
              <Input {...register("title", { required: true })} placeholder="örn. Gramer Atölyesi — A2" className="mt-1" />
            </div>
            <div>
              <Label>Açıklama</Label>
              <Input {...register("description")} placeholder="Kısa açıklama" className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Başlangıç Tarihi & Saati *</Label>
                <Input type="datetime-local" {...register("startTime", { required: true })} className="mt-1" />
              </div>
              <div>
                <Label>Süre (dakika) *</Label>
                <Input type="number" min={15} max={180} {...register("duration", { required: true })} defaultValue={60} className="mt-1" />
              </div>
            </div>
            {!zoomConfigured && (
              <div>
                <Label>Zoom Toplantı Bağlantısı *</Label>
                <Input {...register("meetingLink", { required: !zoomConfigured })} placeholder="https://zoom.us/j/..." className="mt-1" />
              </div>
            )}
            <div>
              <Label>Maksimum Öğrenci</Label>
              <Input type="number" min={1} max={100} {...register("maxStudents")} defaultValue={20} className="mt-1" />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" className="flex-1">Ders Planla</Button>
              <Button type="button" variant="outline" onClick={() => { setShowCreate(false); reset(); }}>İptal</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
