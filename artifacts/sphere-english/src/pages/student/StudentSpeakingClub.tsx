import { useState, useEffect } from "react";
import { Mic, Calendar, Clock, Users, Globe, ExternalLink, CheckCircle, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/core";
import { Button } from "@/components/ui/core";
import { Badge } from "@/components/ui/core";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

import { API } from "@/lib/api-url";

type Club = {
  id: number;
  title: string;
  description: string | null;
  teacherId: number | null;
  teacherName: string | null;
  scheduledAt: string;
  durationMinutes: number;
  maxParticipants: number;
  level: string | null;
  meetingLink: string | null;
  participantCount: number;
  isJoined: boolean;
};

const LEVEL_COLORS: Record<string, string> = {
  A1: "bg-emerald-100 text-emerald-700",
  A2: "bg-green-100 text-green-700",
  B1: "bg-blue-100 text-blue-700",
  B2: "bg-indigo-100 text-indigo-700",
  C1: "bg-purple-100 text-purple-700",
  C2: "bg-rose-100 text-rose-700",
};

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("sphere_token")}`,
  };
}

function formatDate(s: string) {
  return new Date(s).toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function formatTime(s: string) {
  return new Date(s).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

function isUpcoming(scheduledAt: string, duration: number) {
  const end = new Date(new Date(scheduledAt).getTime() + duration * 60000);
  return end > new Date();
}

export default function StudentSpeakingClub() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<number | null>(null);
  const [filter, setFilter] = useState<"upcoming" | "joined" | "all">("upcoming");

  const fetchClubs = () => {
    setLoading(true);
    fetch(`${API}/speaking-clubs`, { headers: authHeaders() })
      .then(r => r.json())
      .then(data => setClubs(Array.isArray(data) ? data : []))
      .catch(() => toast({ title: "Hata", description: "Veriler yüklenemedi", variant: "destructive" }))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchClubs(); }, []);

  const handleJoin = async (clubId: number) => {
    setPending(clubId);
    try {
      const r = await fetch(`${API}/speaking-clubs/${clubId}/join`, {
        method: "POST", headers: authHeaders(),
      });
      if (!r.ok) {
        const e = await r.json();
        throw new Error(e.error ?? "Kayıt olunamadı");
      }
      toast({ title: "Kayıt Olundu!", description: "Speaking Club etkinliğine başarıyla kayıt oldunuz." });
      fetchClubs();
    } catch (e: any) {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    } finally {
      setPending(null);
    }
  };

  const handleLeave = async (clubId: number) => {
    setPending(clubId);
    try {
      await fetch(`${API}/speaking-clubs/${clubId}/leave`, { method: "DELETE", headers: authHeaders() });
      toast({ title: "Ayrıldınız", description: "Speaking Club kaydınız iptal edildi." });
      fetchClubs();
    } catch {
      toast({ title: "Hata", description: "İşlem gerçekleştirilemedi", variant: "destructive" });
    } finally {
      setPending(null);
    }
  };

  const displayed = clubs.filter(c => {
    if (filter === "upcoming") return isUpcoming(c.scheduledAt, c.durationMinutes);
    if (filter === "joined") return c.isJoined;
    return true;
  });

  const joinedCount = clubs.filter(c => c.isJoined).length;
  const upcomingCount = clubs.filter(c => isUpcoming(c.scheduledAt, c.durationMinutes)).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-display">Speaking Club</h1>
        <p className="text-muted-foreground mt-1">İngilizce konuşma etkinliklerine katılın, pratiğinizi geliştirin.</p>
      </div>

      {/* Özet istatistik */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Mic className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Toplam Etkinlik</p>
              <p className="text-2xl font-bold">{clubs.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Kayıtlı</p>
              <p className="text-2xl font-bold text-green-600">{joinedCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Yaklaşan</p>
              <p className="text-2xl font-bold text-blue-600">{upcomingCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtre */}
      <div className="flex gap-2 bg-secondary/40 rounded-xl p-1 w-fit">
        {([
          { key: "upcoming", label: "Yaklaşan" },
          { key: "joined",   label: "Kayıtlı Olduklarım" },
          { key: "all",      label: "Tümü" },
        ] as const).map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filter === f.key ? "bg-white shadow text-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Etkinlik listesi */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Card key={i} className="h-36 animate-pulse bg-secondary/50" />)}
        </div>
      ) : displayed.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Mic className="h-14 w-14 mx-auto mb-3 opacity-20" />
            <p className="font-medium">Bu kategoride etkinlik bulunamadı</p>
            <p className="text-sm mt-1">Filtre değiştirerek diğer etkinliklere göz atın.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {displayed.map(club => {
            const upcoming = isUpcoming(club.scheduledAt, club.durationMinutes);
            const isFull = club.participantCount >= club.maxParticipants;
            const loading = pending === club.id;

            return (
              <Card key={club.id} className={`overflow-hidden border-l-4 ${club.isJoined ? "border-l-green-500" : upcoming ? "border-l-primary" : "border-l-gray-200 opacity-70"}`}>
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                    <div className="flex-1 space-y-2">
                      {/* Başlık + Rozetler */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-lg font-bold">{club.title}</h3>
                        {club.level && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${LEVEL_COLORS[club.level] ?? "bg-gray-100 text-gray-600"}`}>
                            {club.level}
                          </span>
                        )}
                        {club.isJoined && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-green-100 text-green-700 flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" /> Kayıtlısınız
                          </span>
                        )}
                        {!upcoming && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Sona Erdi</span>
                        )}
                      </div>

                      {/* Açıklama */}
                      {club.description && (
                        <p className="text-sm text-muted-foreground">{club.description}</p>
                      )}

                      {/* Bilgiler */}
                      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="h-4 w-4" /> {formatDate(club.scheduledAt)}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-4 w-4" /> {formatTime(club.scheduledAt)} · {club.durationMinutes} dk
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Users className="h-4 w-4" />
                          <span className={isFull && !club.isJoined ? "text-red-500 font-medium" : ""}>
                            {club.participantCount} / {club.maxParticipants}
                          </span>
                        </span>
                        {club.teacherName && (
                          <span className="flex items-center gap-1.5">
                            <Globe className="h-4 w-4" /> {club.teacherName}
                          </span>
                        )}
                      </div>

                      {/* Doluluk çubuğu */}
                      <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden max-w-xs">
                        <div
                          className={`h-full rounded-full transition-all ${isFull ? "bg-red-400" : "bg-primary"}`}
                          style={{ width: `${Math.min(100, (club.participantCount / club.maxParticipants) * 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Aksiyon butonları */}
                    {upcoming && (
                      <div className="flex flex-col gap-2 shrink-0">
                        {club.isJoined ? (
                          <>
                            {club.meetingLink && (
                              <a href={club.meetingLink} target="_blank" rel="noreferrer">
                                <Button size="sm" className="w-full gap-1.5">
                                  <ExternalLink className="h-4 w-4" /> Katıl
                                </Button>
                              </a>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-500 border-red-200 hover:bg-red-50"
                              disabled={loading}
                              onClick={() => handleLeave(club.id)}
                            >
                              {loading ? "..." : "Kaydı İptal Et"}
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            disabled={isFull || loading}
                            onClick={() => handleJoin(club.id)}
                          >
                            {loading ? "..." : isFull ? "Dolu" : "Kayıt Ol"}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
