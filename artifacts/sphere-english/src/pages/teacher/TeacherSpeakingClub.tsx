import { useQuery } from "@tanstack/react-query";
import { Card, Badge, Modal } from "@/components/ui/core";
import { Mic, CalendarDays, Clock, Users, Link as LinkIcon, BookOpen, UserCheck } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";

interface Participant {
  studentId: number;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  joinedAt: string;
}

interface SpeakingClub {
  id: number;
  title: string;
  description: string | null;
  topic: string | null;
  scheduledAt: string;
  durationMinutes: number;
  maxParticipants: number;
  level: string;
  status: string;
  meetingLink: string | null;
  participants: Participant[];
  participantCount: number;
}

const STATUS_LABELS: Record<string, string> = {
  upcoming: "Yaklaşan",
  ongoing: "Devam Eden",
  completed: "Tamamlandı",
  cancelled: "İptal",
};
const STATUS_COLORS: Record<string, string> = {
  upcoming: "bg-blue-100 text-blue-700",
  ongoing: "bg-green-100 text-green-700",
  completed: "bg-secondary text-muted-foreground",
  cancelled: "bg-red-100 text-red-600",
};

async function apiFetch(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Hata");
  return res.json();
}

export default function TeacherSpeakingClub() {
  const [detailClub, setDetailClub] = useState<SpeakingClub | null>(null);

  const { data: clubs = [], isLoading } = useQuery<SpeakingClub[]>({
    queryKey: ["/api/teacher/speaking-clubs"],
    queryFn: () => apiFetch("/api/teacher/speaking-clubs"),
  });

  const upcoming = clubs.filter((c) => c.status === "upcoming");
  const past = clubs.filter((c) => c.status !== "upcoming");

  function ClubCard({ club, i }: { club: SpeakingClub; i: number }) {
    const date = new Date(club.scheduledAt);
    const fillPct = Math.round((club.participantCount / club.maxParticipants) * 100);
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
        <Card
          className="p-5 border-2 border-border hover:border-primary/30 transition-colors cursor-pointer"
          onClick={() => setDetailClub(club)}
        >
          <div className="flex items-start gap-3 mb-3">
            <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
              <Mic className="h-5 w-5 text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold line-clamp-1">{club.title}</h3>
              {club.topic && <p className="text-xs text-muted-foreground">Konu: {club.topic}</p>}
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${STATUS_COLORS[club.status] || ""}`}>
              {STATUS_LABELS[club.status] || club.status}
            </span>
          </div>

          <div className="space-y-1.5 text-sm mb-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5 shrink-0" />
              <span>{date.toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" })}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span>{date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })} — {club.durationMinutes} dk</span>
            </div>
          </div>

          {/* Katılımcı doluluk */}
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                <span>{club.participantCount} / {club.maxParticipants} katılımcı</span>
              </div>
              <span className="text-xs font-medium">{fillPct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${fillPct >= 80 ? "bg-red-400" : fillPct >= 50 ? "bg-yellow-400" : "bg-green-500"}`}
                style={{ width: `${Math.min(fillPct, 100)}%` }}
              />
            </div>
          </div>

          {club.meetingLink && (
            <div className="mt-3 flex items-center gap-2">
              <LinkIcon className="h-3.5 w-3.5 text-primary shrink-0" />
              <a
                href={club.meetingLink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-xs text-primary hover:underline truncate"
              >
                Toplantı bağlantısı
              </a>
            </div>
          )}
        </Card>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold font-display">Speaking Club</h2>
        <p className="text-muted-foreground text-sm mt-1">Size atanmış etkinlikler ve katılımcı listeleri</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : clubs.length === 0 ? (
        <Card className="p-12 text-center">
          <Mic className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground font-medium">Size atanmış Speaking Club etkinliği yok</p>
          <p className="text-sm text-muted-foreground mt-1">Admin panelinden etkinlik oluşturulup size atanması gerekiyor.</p>
        </Card>
      ) : (
        <div className="space-y-8">
          {upcoming.length > 0 && (
            <div>
              <h3 className="text-base font-semibold mb-3">Yaklaşan Etkinlikler</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {upcoming.map((c, i) => <ClubCard key={c.id} club={c} i={i} />)}
              </div>
            </div>
          )}
          {past.length > 0 && (
            <div>
              <h3 className="text-base font-semibold mb-3 text-muted-foreground">Geçmiş Etkinlikler</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {past.map((c, i) => <ClubCard key={c.id} club={c} i={i} />)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Katılımcı Listesi Modal */}
      <Modal
        isOpen={!!detailClub}
        onClose={() => setDetailClub(null)}
        title={`Katılımcılar: ${detailClub?.title}`}
      >
        {detailClub && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <CalendarDays className="h-4 w-4" />
              <span>{new Date(detailClub.scheduledAt).toLocaleString("tr-TR")}</span>
              <Users className="h-4 w-4 ml-2" />
              <span>{detailClub.participantCount} / {detailClub.maxParticipants}</span>
            </div>

            {detailClub.participants.length === 0 ? (
              <p className="text-muted-foreground text-center py-8 text-sm">Henüz katılımcı yok.</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {detailClub.participants.map((p, i) => (
                  <motion.div
                    key={p.studentId}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex items-center gap-3 py-2.5 px-3 rounded-xl bg-secondary/40"
                  >
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                      {p.firstName?.[0] || "?"}{p.lastName?.[0] || ""}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{p.firstName} {p.lastName}</p>
                      <p className="text-xs text-muted-foreground truncate">{p.email}</p>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-green-600 shrink-0">
                      <UserCheck className="h-3.5 w-3.5" />
                      <span>Kayıtlı</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {detailClub.meetingLink && (
              <div className="pt-3 border-t border-border">
                <a
                  href={detailClub.meetingLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-primary text-sm hover:underline"
                >
                  <LinkIcon className="h-4 w-4" />
                  Toplantı bağlantısını aç
                </a>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
