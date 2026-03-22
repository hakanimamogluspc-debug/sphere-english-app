import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, Button, Input, Label, Badge, Modal } from "@/components/ui/core";
import { useToast } from "@/hooks/use-toast";
import { Users, UserPlus, UserMinus, Megaphone, Search, ChevronDown, ChevronRight, GraduationCap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { abbrevName } from "@/lib/utils";

interface Student { id: number; firstName: string; lastName: string; email: string; totalPoints: number; streak: number; }
interface Group { id: number; name: string; description: string | null; memberCount: number; }
interface GroupWithMembers { group: Group; members: (Student & { joinedAt: string })[]; }

async function apiFetch(url: string, opts?: RequestInit) {
  const res = await fetch(url, opts);
  if (!res.ok) { const e = await res.json().catch(() => ({ error: "Hata" })); throw new Error(e.error || "Hata"); }
  return res.json();
}

export default function TeacherStudents() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [expandedGroup, setExpandedGroup] = useState<number | null>(null);
  const [announceGroup, setAnnounceGroup] = useState<Group | null>(null);
  const [addStudentGroup, setAddStudentGroup] = useState<Group | null>(null);
  const [announceText, setAnnounceText] = useState("");
  const [searchAll, setSearchAll] = useState("");
  const [searchAdd, setSearchAdd] = useState("");

  const { data: groups = [], isLoading: loadingGroups } = useQuery<Group[]>({
    queryKey: ["/api/teacher/groups"],
    queryFn: () => apiFetch("/api/teacher/groups"),
  });

  const { data: groupDetail } = useQuery<GroupWithMembers>({
    queryKey: ["/api/teacher/groups", expandedGroup, "members"],
    queryFn: () => apiFetch(`/api/teacher/groups/${expandedGroup}/members`),
    enabled: !!expandedGroup,
  });

  const { data: allStudents = [] } = useQuery<Student[]>({
    queryKey: ["/api/teacher/all-students"],
    queryFn: () => apiFetch("/api/teacher/all-students"),
    enabled: !!addStudentGroup,
  });

  const addMutation = useMutation({
    mutationFn: ({ groupId, studentId }: { groupId: number; studentId: number }) =>
      apiFetch(`/api/teacher/groups/${groupId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teacher/groups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/teacher/groups", expandedGroup, "members"] });
      toast({ title: "Öğrenci gruba eklendi" });
    },
    onError: (e: Error) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: ({ groupId, studentId }: { groupId: number; studentId: number }) =>
      apiFetch(`/api/teacher/groups/${groupId}/members/${studentId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teacher/groups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/teacher/groups", expandedGroup, "members"] });
      toast({ title: "Öğrenci gruptan çıkarıldı" });
    },
    onError: (e: Error) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const announceMutation = useMutation({
    mutationFn: ({ groupId, content }: { groupId: number; content: string }) =>
      apiFetch(`/api/teacher/groups/${groupId}/announce`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      }),
    onSuccess: (data) => {
      toast({ title: `Duyuru gönderildi (${data.sent} öğrenci)` });
      setAnnounceGroup(null);
      setAnnounceText("");
    },
    onError: (e: Error) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const totalStudents = groups.reduce((s, g) => s + g.memberCount, 0);
  const currentMembers = groupDetail?.members || [];
  const currentMemberIds = new Set(currentMembers.map((m) => m.id));

  const filteredAddStudents = allStudents.filter((s) =>
    !currentMemberIds.has(s.id) &&
    `${s.firstName} ${s.lastName} ${s.email}`.toLowerCase().includes(searchAdd.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold font-display">Öğrencilerim</h2>
        <p className="text-muted-foreground text-sm mt-1">
          {groups.length} grup · {totalStudents} öğrenci
        </p>
      </div>

      {loadingGroups ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : groups.length === 0 ? (
        <Card className="p-12 text-center">
          <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground font-medium">Size atanmış grup yok</p>
          <p className="text-sm text-muted-foreground mt-1">Admin panelinden gruplara öğretmen atanması gerekiyor.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <Card key={group.id} className="border-2 border-border overflow-hidden">
              {/* Grup başlığı */}
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-secondary/30 transition-colors"
                onClick={() => setExpandedGroup(expandedGroup === group.id ? null : group.id)}
              >
                <div className="flex items-center gap-3">
                  {expandedGroup === group.id
                    ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  }
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <GraduationCap className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{group.name}</p>
                    {group.description && <p className="text-xs text-muted-foreground">{group.description}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{group.memberCount} öğrenci</Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex items-center gap-1.5"
                    onClick={(e) => { e.stopPropagation(); setAddStudentGroup(group); setExpandedGroup(group.id); setSearchAdd(""); }}
                  >
                    <UserPlus className="h-3.5 w-3.5" /> Ekle
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex items-center gap-1.5"
                    onClick={(e) => { e.stopPropagation(); setAnnounceGroup(group); }}
                  >
                    <Megaphone className="h-3.5 w-3.5" /> Duyuru
                  </Button>
                </div>
              </div>

              {/* Açık üye listesi */}
              <AnimatePresence>
                {expandedGroup === group.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-border overflow-hidden"
                  >
                    <div className="p-4 space-y-2">
                      {currentMembers.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">Bu grupta henüz öğrenci yok.</p>
                      ) : (
                        currentMembers.map((s) => (
                          <div key={s.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-secondary/40 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                                {s.firstName[0]}{s.lastName[0]}
                              </div>
                              <div>
                                <p className="text-sm font-medium">{abbrevName(s.firstName, s.lastName)}</p>
                                <p className="text-xs text-muted-foreground">{s.email}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-muted-foreground">{s.totalPoints} puan</span>
                              <button
                                onClick={() => removeMutation.mutate({ groupId: group.id, studentId: s.id })}
                                className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors"
                                title="Gruptan çıkar"
                              >
                                <UserMinus className="h-3.5 w-3.5 text-destructive" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          ))}
        </div>
      )}

      {/* Öğrenci Ekle Modal */}
      <Modal isOpen={!!addStudentGroup} onClose={() => { setAddStudentGroup(null); setSearchAdd(""); }} title={`Gruba Öğrenci Ekle: ${addStudentGroup?.name}`}>
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="İsim veya e-posta ara..."
              value={searchAdd}
              onChange={(e) => setSearchAdd(e.target.value)}
            />
          </div>
          <div className="max-h-72 overflow-y-auto space-y-1">
            {filteredAddStudents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                {searchAdd ? "Sonuç bulunamadı" : "Eklenebilecek öğrenci yok (tümü zaten grupta)"}
              </p>
            ) : (
              filteredAddStudents.map((s) => (
                <div key={s.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-secondary/40 transition-colors">
                  <div>
                    <p className="text-sm font-medium">{abbrevName(s.firstName, s.lastName)}</p>
                    <p className="text-xs text-muted-foreground">{s.email}</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => addMutation.mutate({ groupId: addStudentGroup!.id, studentId: s.id })}
                    isLoading={addMutation.isPending}
                  >
                    Ekle
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </Modal>

      {/* Duyuru Modal */}
      <Modal isOpen={!!announceGroup} onClose={() => { setAnnounceGroup(null); setAnnounceText(""); }} title={`Grup Duyurusu: ${announceGroup?.name}`}>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Bu duyuru gruptaki <strong>{announceGroup?.memberCount}</strong> öğrenciye mesaj olarak gönderilecek.
          </p>
          <div>
            <Label>Mesaj içeriği</Label>
            <textarea
              className="flex min-h-[100px] w-full rounded-xl border-2 border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none mt-1"
              placeholder="Duyurunuzu yazın..."
              value={announceText}
              onChange={(e) => setAnnounceText(e.target.value)}
            />
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => { setAnnounceGroup(null); setAnnounceText(""); }}>İptal</Button>
            <Button
              className="flex-1"
              disabled={!announceText.trim()}
              isLoading={announceMutation.isPending}
              onClick={() => announceMutation.mutate({ groupId: announceGroup!.id, content: announceText.trim() })}
            >
              Gönder
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
