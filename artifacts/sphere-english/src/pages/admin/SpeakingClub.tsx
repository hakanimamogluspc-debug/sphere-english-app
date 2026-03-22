import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, Button, Input, Label, Modal, Badge } from "@/components/ui/core";
import { useToast } from "@/hooks/use-toast";
import { Mic, Plus, Edit2, Trash2, CalendarDays, Clock, Users, Link as LinkIcon, BookOpen, UserCheck, List } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";

const clubSchema = z.object({
  title: z.string().min(2, "Başlık en az 2 karakter olmalıdır"),
  description: z.string().optional(),
  topic: z.string().optional(),
  teacherId: z.coerce.number().optional(),
  scheduledAt: z.string().min(1, "Tarih ve saat zorunludur"),
  durationMinutes: z.coerce.number().min(15).default(60),
  maxParticipants: z.coerce.number().min(1).default(10),
  level: z.string().default("all"),
  meetingLink: z.string().optional(),
});
type ClubForm = z.infer<typeof clubSchema>;

interface Teacher { id: number; firstName: string; lastName: string; }

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
  teacherId: number | null;
  teacher: Teacher | null;
  scheduledAt: string;
  durationMinutes: number;
  maxParticipants: number;
  participantCount: number;
  level: string;
  status: string;
  meetingLink: string | null;
  createdAt: string;
}

const LEVELS = [
  { value: "all", label: "Tüm Seviyeler" },
  { value: "A1", label: "A1" },
  { value: "A2", label: "A2" },
  { value: "B1", label: "B1" },
  { value: "B2", label: "B2" },
  { value: "C1", label: "C1" },
  { value: "C2", label: "C2" },
];

const STATUS_LABELS: Record<string, string> = {
  upcoming: "Yaklaşan",
  ongoing: "Devam Eden",
  completed: "Tamamlandı",
  cancelled: "İptal",
};

const STATUS_COLORS: Record<string, string> = {
  upcoming: "default",
  ongoing: "success",
  completed: "secondary",
  cancelled: "destructive",
};

function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${localStorage.getItem("sphere_token")}` };
}

async function apiFetch(url: string, options?: RequestInit) {
  const res = await fetch(url, {
    ...options,
    headers: { ...authHeaders(), ...(options?.headers as Record<string, string> || {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Bir hata oluştu" }));
    throw new Error(err.error || "Bir hata oluştu");
  }
  return res.json();
}

function toDatetimeLocal(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminSpeakingClub() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingClub, setEditingClub] = useState<SpeakingClub | null>(null);
  const [participantClub, setParticipantClub] = useState<SpeakingClub | null>(null);

  const { data: participants = [], isLoading: participantsLoading } = useQuery<Participant[]>({
    queryKey: ["/api/admin/speaking-clubs", participantClub?.id, "participants"],
    queryFn: () => apiFetch(`/api/admin/speaking-clubs/${participantClub!.id}/participants`),
    enabled: !!participantClub,
  });

  const { data: clubs = [], isLoading } = useQuery<SpeakingClub[]>({
    queryKey: ["/api/admin/speaking-clubs"],
    queryFn: () => apiFetch("/api/admin/speaking-clubs"),
  });

  const { data: teachers = [] } = useQuery<Teacher[]>({
    queryKey: ["/api/admin/teachers"],
    queryFn: () => apiFetch("/api/admin/teachers"),
  });

  const createMutation = useMutation({
    mutationFn: (data: ClubForm) =>
      apiFetch("/api/admin/speaking-clubs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/speaking-clubs"] });
      toast({ title: "Etkinlik oluşturuldu!" });
      setIsCreateOpen(false);
      resetCreate();
    },
    onError: (e: Error) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ClubForm> }) =>
      apiFetch(`/api/admin/speaking-clubs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/speaking-clubs"] });
      toast({ title: "Güncellendi!" });
      setEditingClub(null);
    },
    onError: (e: Error) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/admin/speaking-clubs/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/speaking-clubs"] });
      toast({ title: "Etkinlik silindi" });
    },
    onError: (e: Error) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const { register: regCreate, handleSubmit: handleCreate, reset: resetCreate, formState: { errors: errCreate } } = useForm<ClubForm>({
    resolver: zodResolver(clubSchema),
    defaultValues: { durationMinutes: 60, maxParticipants: 10, level: "all" },
  });

  const { register: regEdit, handleSubmit: handleEdit, reset: resetEdit, formState: { errors: errEdit } } = useForm<ClubForm>({
    resolver: zodResolver(clubSchema),
  });

  const openEdit = (club: SpeakingClub) => {
    setEditingClub(club);
    resetEdit({
      title: club.title,
      description: club.description || "",
      topic: club.topic || "",
      teacherId: club.teacherId || undefined,
      scheduledAt: toDatetimeLocal(club.scheduledAt),
      durationMinutes: club.durationMinutes,
      maxParticipants: club.maxParticipants,
      level: club.level,
      meetingLink: club.meetingLink || "",
    });
  };

  const ClubForm = ({ reg, err, isEdit = false }: { reg: any; err: any; isEdit?: boolean }) => (
    <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
      <div>
        <Label>Başlık <span className="text-destructive">*</span></Label>
        <Input placeholder="Örnek: English Conversation Hour" {...reg("title")} />
        {err.title && <p className="text-xs text-destructive mt-1">{err.title.message}</p>}
      </div>
      <div>
        <Label>Konu</Label>
        <Input placeholder="Örnek: Travel & Holidays" {...reg("topic")} />
      </div>
      <div>
        <Label>Açıklama</Label>
        <Input placeholder="Kısa açıklama" {...reg("description")} />
      </div>
      <div>
        <Label>Öğretmen</Label>
        <select
          {...reg("teacherId")}
          className="flex h-12 w-full rounded-xl border-2 border-border bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <option value="">— Öğretmen seçin —</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label>Tarih ve Saat <span className="text-destructive">*</span></Label>
          <Input type="datetime-local" {...reg("scheduledAt")} />
          {err.scheduledAt && <p className="text-xs text-destructive mt-1">{err.scheduledAt.message}</p>}
        </div>
        <div>
          <Label>Süre (dakika)</Label>
          <Input type="number" min="15" step="15" {...reg("durationMinutes")} />
        </div>
        <div>
          <Label>Maks. Katılımcı</Label>
          <Input type="number" min="1" {...reg("maxParticipants")} />
        </div>
      </div>
      <div>
        <Label>Seviye</Label>
        <select
          {...reg("level")}
          className="flex h-12 w-full rounded-xl border-2 border-border bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          {LEVELS.map((l) => (
            <option key={l.value} value={l.value}>{l.label}</option>
          ))}
        </select>
      </div>
      <div>
        <Label>Toplantı Bağlantısı</Label>
        <Input placeholder="https://zoom.us/..." {...reg("meetingLink")} />
      </div>
    </div>
  );

  const upcoming = clubs.filter((c) => c.status === "upcoming");
  const past = clubs.filter((c) => c.status !== "upcoming");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-display">Speaking Club</h2>
          <p className="text-muted-foreground text-sm mt-1">{clubs.length} etkinlik kayıtlı</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Yeni Etkinlik
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : clubs.length === 0 ? (
        <Card className="p-12 text-center">
          <Mic className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground font-medium">Henüz Speaking Club etkinliği yok</p>
          <p className="text-sm text-muted-foreground mt-1">İlk etkinliği oluşturmak için "Yeni Etkinlik" butonuna tıklayın.</p>
        </Card>
      ) : (
        <div className="space-y-8">
          {upcoming.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3">Yaklaşan Etkinlikler</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {upcoming.map((club, i) => (
                  <ClubCard key={club.id} club={club} i={i} onEdit={openEdit}
                    onDelete={(id) => { if (confirm("Bu etkinliği silmek istediğinize emin misiniz?")) deleteMutation.mutate(id); }}
                    onStatusChange={(id, status) => updateMutation.mutate({ id, data: { status } as any })}
                    onViewParticipants={setParticipantClub}
                  />
                ))}
              </div>
            </div>
          )}
          {past.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3 text-muted-foreground">Geçmiş Etkinlikler</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {past.map((club, i) => (
                  <ClubCard key={club.id} club={club} i={i} onEdit={openEdit}
                    onDelete={(id) => { if (confirm("Bu etkinliği silmek istediğinize emin misiniz?")) deleteMutation.mutate(id); }}
                    onStatusChange={(id, status) => updateMutation.mutate({ id, data: { status } as any })}
                    onViewParticipants={setParticipantClub}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Yeni Etkinlik Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Yeni Speaking Club Etkinliği">
        <form onSubmit={handleCreate((d) => createMutation.mutateAsync(d))} className="space-y-4">
          <ClubForm reg={regCreate} err={errCreate} />
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setIsCreateOpen(false)}>İptal</Button>
            <Button type="submit" className="flex-1" isLoading={createMutation.isPending}>Oluştur</Button>
          </div>
        </form>
      </Modal>

      {/* Düzenleme Modal */}
      <Modal isOpen={!!editingClub} onClose={() => setEditingClub(null)} title={`Düzenle: ${editingClub?.title}`}>
        <form onSubmit={handleEdit((d) => updateMutation.mutateAsync({ id: editingClub!.id, data: d }))} className="space-y-4">
          <ClubForm reg={regEdit} err={errEdit} isEdit />
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setEditingClub(null)}>İptal</Button>
            <Button type="submit" className="flex-1" isLoading={updateMutation.isPending}>Güncelle</Button>
          </div>
        </form>
      </Modal>

      {/* Katılımcı Listesi Modal */}
      <Modal
        isOpen={!!participantClub}
        onClose={() => setParticipantClub(null)}
        title={`Katılımcılar: ${participantClub?.title}`}
      >
        {participantClub && (
          <div className="space-y-4">
            {/* Özet */}
            <div className="flex items-center gap-4 py-3 px-4 bg-secondary/40 rounded-xl">
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-primary" />
                <span className="font-semibold text-foreground">
                  {participantClub.participantCount} / {participantClub.maxParticipants}
                </span>
                <span className="text-muted-foreground">kişi</span>
              </div>
              <div className="flex-1 bg-border rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    (participantClub.participantCount / participantClub.maxParticipants) >= 0.8 ? "bg-red-400" :
                    (participantClub.participantCount / participantClub.maxParticipants) >= 0.5 ? "bg-yellow-400" : "bg-green-500"
                  }`}
                  style={{ width: `${Math.min(100, (participantClub.participantCount / participantClub.maxParticipants) * 100)}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground">
                {Math.round((participantClub.participantCount / participantClub.maxParticipants) * 100)}% dolu
              </span>
            </div>

            {participantsLoading ? (
              <div className="flex items-center justify-center py-10">
                <div className="animate-spin h-7 w-7 border-4 border-primary border-t-transparent rounded-full" />
              </div>
            ) : participants.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Users className="h-10 w-10 mx-auto mb-2 opacity-20" />
                <p className="text-sm font-medium">Henüz kayıtlı katılımcı yok</p>
                <p className="text-xs mt-1">Öğrenciler kaydoldukça burada görünecek.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {participants.map((p, i) => (
                  <motion.div
                    key={p.studentId}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex items-center gap-3 py-2.5 px-3 rounded-xl bg-secondary/40"
                  >
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                      {p.firstName?.[0] || "?"}{p.lastName?.[0] || ""}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{p.firstName} {p.lastName}</p>
                      <p className="text-xs text-muted-foreground truncate">{p.email}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="flex items-center gap-1 text-xs text-green-600">
                        <UserCheck className="h-3.5 w-3.5" />
                        <span>Kayıtlı</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {new Date(p.joinedAt).toLocaleDateString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function ClubCard({ club, i, onEdit, onDelete, onStatusChange, onViewParticipants }: {
  club: SpeakingClub;
  i: number;
  onEdit: (c: SpeakingClub) => void;
  onDelete: (id: number) => void;
  onStatusChange: (id: number, status: string) => void;
  onViewParticipants: (c: SpeakingClub) => void;
}) {
  const date = new Date(club.scheduledAt);
  const fillPct = club.maxParticipants > 0 ? Math.round((club.participantCount / club.maxParticipants) * 100) : 0;
  const isFull = club.participantCount >= club.maxParticipants;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
      <Card className="p-5 border-2 border-border hover:border-primary/30 transition-colors">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center">
              <Mic className="h-5 w-5 text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground line-clamp-1">{club.title}</h3>
              {club.topic && (
                <p className="text-xs text-muted-foreground">Konu: {club.topic}</p>
              )}
            </div>
          </div>
          <div className="flex gap-1.5 shrink-0 ml-2">
            <button onClick={() => onEdit(club)} className="p-1.5 rounded-lg hover:bg-secondary transition-colors" title="Düzenle">
              <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <button onClick={() => onDelete(club.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors" title="Sil">
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </button>
          </div>
        </div>

        <div className="space-y-1.5 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5 shrink-0" />
            <span>{date.toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" })}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span>{date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })} — {club.durationMinutes} dk</span>
          </div>
          {club.teacher && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <BookOpen className="h-3.5 w-3.5 shrink-0" />
              <span>{club.teacher.firstName} {club.teacher.lastName}</span>
            </div>
          )}
          {club.meetingLink && (
            <div className="flex items-center gap-2">
              <LinkIcon className="h-3.5 w-3.5 shrink-0 text-primary" />
              <a href={club.meetingLink} target="_blank" rel="noopener noreferrer" className="text-primary text-xs hover:underline truncate">
                Toplantı bağlantısı
              </a>
            </div>
          )}
        </div>

        {/* Kontenjan doluluk çubuğu */}
        <div className="mt-3 space-y-1">
          <div className="flex items-center justify-between">
            <button
              onClick={() => onViewParticipants(club)}
              className="flex items-center gap-1.5 text-xs hover:text-primary transition-colors"
            >
              <Users className="h-3.5 w-3.5" />
              <span className={isFull ? "text-red-500 font-semibold" : "text-muted-foreground"}>
                {club.participantCount} / {club.maxParticipants} kişi
              </span>
              {isFull && <span className="text-red-500 font-semibold">— Kontenjan Doldu</span>}
            </button>
            <span className="text-xs text-muted-foreground">{fillPct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${fillPct >= 80 ? "bg-red-400" : fillPct >= 50 ? "bg-yellow-400" : "bg-green-500"}`}
              style={{ width: `${Math.min(fillPct, 100)}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
          <div className="flex gap-2">
            <Badge variant="outline" className="text-xs">{club.level === "all" ? "Tüm Seviyeler" : club.level}</Badge>
            <Badge variant={STATUS_COLORS[club.status] as any} className="text-xs">{STATUS_LABELS[club.status] || club.status}</Badge>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => onViewParticipants(club)}
              className="flex items-center gap-1 text-xs text-primary hover:underline transition-colors"
            >
              <List className="h-3.5 w-3.5" /> Katılımcılar
            </button>
            {club.status === "upcoming" && (
              <button
                onClick={() => onStatusChange(club.id, "completed")}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Tamamlandı
              </button>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
