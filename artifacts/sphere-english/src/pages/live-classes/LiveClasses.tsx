import { useState, useEffect } from "react";
import { useGetLiveClasses, useJoinLiveClass, useCreateLiveClass } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from "@/components/ui/core";
import { Video, Clock, Users, Calendar, ExternalLink, Plus } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const API = "http://localhost:8080/api";

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem("sphere_token")}` };
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("tr-TR", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

function ClassStatus({ startTime, duration }: { startTime: string; duration: number }) {
  const now = new Date();
  const start = new Date(startTime);
  const end = new Date(start.getTime() + duration * 60000);

  if (now >= start && now <= end) return <Badge className="bg-green-100 text-green-800">Canlı</Badge>;
  if (now < start) return <Badge className="bg-blue-100 text-blue-800">Yaklaşan</Badge>;
  return <Badge className="bg-gray-100 text-gray-600">Sona Erdi</Badge>;
}

const typeLabel: Record<string, string> = {
  group: "Grup",
  "one-on-one": "Birebir",
};

// Öğrenci için filtrelenmiş dersler
function useStudentLiveClasses() {
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    fetch(`${API}/student/live-classes`, { headers: authHeaders() })
      .then(r => r.json())
      .then(d => setData(Array.isArray(d) ? d : []))
      .catch(() => setData([]))
      .finally(() => setIsLoading(false));
  }, []);
  return { data, isLoading };
}

export default function LiveClasses() {
  const { user } = useAuth();
  const isStudent = user?.role === "student";
  const { data: allClasses, isLoading: allLoading } = useGetLiveClasses();
  const { data: studentClasses, isLoading: studentLoading } = useStudentLiveClasses();
  const classes = isStudent ? studentClasses : allClasses;
  const isLoading = isStudent ? studentLoading : allLoading;
  const joinMutation = useJoinLiveClass();
  const createMutation = useCreateLiveClass();
  const [showCreate, setShowCreate] = useState(false);
  const { register, handleSubmit, reset } = useForm();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const canCreate = user?.role === "teacher" || user?.role === "admin";

  const handleJoin = async (classId: number) => {
    try {
      await joinMutation.mutateAsync({ id: classId });
      toast({ title: "Katıldınız!", description: "Derse başarıyla katıldınız." });
      queryClient.invalidateQueries({ queryKey: ["/api/live-classes"] });
    } catch {
      toast({ title: "Hata", description: "Derse katılınamadı.", variant: "destructive" });
    }
  };

  const onCreateSubmit = async (data: any) => {
    try {
      await createMutation.mutateAsync({
        data: {
          title: data.title,
          description: data.description,
          startTime: new Date(data.startTime).toISOString(),
          duration: parseInt(data.duration),
          meetingLink: data.meetingLink,
          maxStudents: parseInt(data.maxStudents) || 20,
          type: "group",
          isRecorded: false,
        }
      });
      toast({ title: "Ders Oluşturuldu!", description: "Canlı dersiniz planlandı." });
      queryClient.invalidateQueries({ queryKey: ["/api/live-classes"] });
      setShowCreate(false);
      reset();
    } catch {
      toast({ title: "Hata", description: "Ders oluşturulamadı.", variant: "destructive" });
    }
  };

  const upcoming = classes?.filter(c => new Date(c.startTime) > new Date()) || [];
  const past = classes?.filter(c => {
    const end = new Date(new Date(c.startTime).getTime() + c.duration * 60000);
    return end < new Date();
  }) || [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display">Canlı Dersler</h1>
          <p className="text-muted-foreground mt-1">Öğretmenlerinizle canlı oturumlara katılın.</p>
        </div>
        {canCreate && (
          <Button onClick={() => setShowCreate(true)} className="flex items-center gap-2">
            <Plus size={18} /> Ders Planla
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="h-36 animate-pulse bg-secondary/50" />
          ))}
        </div>
      ) : (
        <>
          <div>
            <h2 className="text-xl font-bold mb-4 text-foreground">Yaklaşan Oturumlar</h2>
            {upcoming.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Video className="h-12 w-12 mx-auto mb-3 opacity-40" />
                  <p>Planlanmış yaklaşan ders yok.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {upcoming.map(cls => (
                  <Card key={cls.id} className="overflow-hidden border-l-4 border-l-accent">
                    <CardContent className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <h3 className="text-lg font-bold">{cls.title}</h3>
                          <ClassStatus startTime={cls.startTime} duration={cls.duration} />
                          <Badge variant="outline">{typeLabel[cls.type] || cls.type}</Badge>
                        </div>
                        <p className="text-muted-foreground text-sm mb-3">{cls.description}</p>
                        <div className="flex items-center gap-6 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1.5">
                            <Calendar size={15} /> {formatDate(cls.startTime)}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Clock size={15} /> {formatTime(cls.startTime)} · {cls.duration} dk
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Users size={15} /> Maks. {cls.maxStudents} öğrenci
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-3 shrink-0">
                        {user?.role === "student" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleJoin(cls.id)}
                            disabled={joinMutation.isPending}
                          >
                            Derse Katıl
                          </Button>
                        )}
                        {cls.meetingLink && (
                          <a href={cls.meetingLink} target="_blank" rel="noreferrer">
                            <Button size="sm" className="flex items-center gap-2">
                              <ExternalLink size={15} /> Toplantıyı Aç
                            </Button>
                          </a>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {past.length > 0 && (
            <div>
              <h2 className="text-xl font-bold mb-4 text-foreground">Geçmiş Oturumlar</h2>
              <div className="space-y-4">
                {past.map(cls => (
                  <Card key={cls.id} className="opacity-70">
                    <CardContent className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-base font-semibold">{cls.title}</h3>
                          <ClassStatus startTime={cls.startTime} duration={cls.duration} />
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1.5"><Calendar size={14} /> {formatDate(cls.startTime)}</span>
                          <span className="flex items-center gap-1.5"><Clock size={14} /> {cls.duration} dk</span>
                        </div>
                      </div>
                      {cls.isRecorded && (
                        <Button variant="outline" size="sm">Kaydı İzle</Button>
                      )}
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
          <form onSubmit={handleSubmit(onCreateSubmit)} className="space-y-4 mt-2">
            <div>
              <Label>Başlık</Label>
              <Input {...register("title", { required: true })} placeholder="örn. Gramer Atölyesi" className="mt-1" />
            </div>
            <div>
              <Label>Açıklama</Label>
              <Input {...register("description")} placeholder="Kısa açıklama" className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Başlangıç Saati</Label>
                <Input type="datetime-local" {...register("startTime", { required: true })} className="mt-1" />
              </div>
              <div>
                <Label>Süre (dakika)</Label>
                <Input type="number" {...register("duration", { required: true })} defaultValue={60} className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Toplantı Bağlantısı</Label>
              <Input {...register("meetingLink")} placeholder="https://zoom.us/..." className="mt-1" />
            </div>
            <div>
              <Label>Maksimum Öğrenci</Label>
              <Input type="number" {...register("maxStudents")} defaultValue={20} className="mt-1" />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={createMutation.isPending} className="flex-1">
                {createMutation.isPending ? "Oluşturuluyor..." : "Ders Planla"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>İptal</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
