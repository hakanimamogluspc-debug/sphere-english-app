import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, Button, Input, Label, Badge, Modal } from "@/components/ui/core";
import { useToast } from "@/hooks/use-toast";
import {
  Users, UserPlus, UserMinus, Megaphone, Search, ChevronDown, ChevronRight,
  GraduationCap, LayoutList, LayoutGrid, BookOpen, TrendingUp
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { abbrevName } from "@/lib/utils";

interface Student {
  id: number; firstName: string; lastName: string; email: string;
  totalPoints: number; streak: number; currentLevel?: string | null;
  groups?: { groupId: number; joinedAt: string }[];
}
interface Group { id: number; name: string; description: string | null; memberCount: number; }
interface GroupWithMembers { group: Group; members: (Student & { joinedAt: string })[]; }

async function apiFetch(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("sphere_token");
  const res = await fetch(url, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(opts?.headers || {}) },
  });
  if (!res.ok) { const e = await res.json().catch(() => ({ error: "Hata" })); throw new Error(e.error || "Hata"); }
  return res.json();
}

const LEVEL_COLORS: Record<string, string> = {
  A1: "bg-slate-100 text-slate-700",
  A2: "bg-blue-100 text-blue-700",
  B1: "bg-cyan-100 text-cyan-700",
  B2: "bg-emerald-100 text-emerald-700",
  C1: "bg-violet-100 text-violet-700",
  C2: "bg-orange-100 text-orange-700",
};

export default function TeacherStudents() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState<"groups" | "all">("groups");
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

  const { data: allStudents = [], isLoading: loadingAll } = useQuery<Student[]>({
    queryKey: ["/api/teacher/students"],
    queryFn: () => apiFetch("/api/teacher/students"),
    enabled: tab === "all" || !!addStudentGroup,
  });

  const { data: groupDetail } = useQuery<GroupWithMembers>({
    queryKey: ["/api/teacher/groups", expandedGroup, "members"],
    queryFn: () => apiFetch(`/api/teacher/groups/${expandedGroup}/members`),
    enabled: !!expandedGroup,
  });

  const { data: addableStudents = [] } = useQuery<Student[]>({
    queryKey: ["/api/teacher/all-students"],
    queryFn: () => apiFetch("/api/teacher/all-students"),
    enabled: !!addStudentGroup,
  });

  const addMutation = useMutation({
    mutationFn: ({ groupId, studentId }: { groupId: number; studentId: number }) =>
      apiFetch(`/api/teacher/groups/${groupId}/members`, { method: "POST", body: JSON.stringify({ studentId }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teacher/groups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/teacher/groups", expandedGroup, "members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/teacher/students"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/teacher/students"] });
      toast({ title: "Öğrenci gruptan çıkarıldı" });
    },
    onError: (e: Error) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const announceMutation = useMutation({
    mutationFn: ({ groupId, content }: { groupId: number; content: string }) =>
      apiFetch(`/api/teacher/groups/${groupId}/announce`, { method: "POST", body: JSON.stringify({ content }) }),
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

  const filteredAddStudents = addableStudents.filter((s) =>
    !currentMemberIds.has(s.id) &&
    `${s.firstName} ${s.lastName} ${s.email}`.toLowerCase().includes(searchAdd.toLowerCase())
  );

  const filteredAll = allStudents.filter(s =>
    `${s.firstName} ${s.lastName} ${s.email}`.toLowerCase().includes(searchAll.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-display">Öğrencilerim</h2>
          <p className="text-muted-foreground text-sm mt-1">
            {groups.length} grup · {totalStudents} öğrenci
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit">
        <button
          onClick={() => setTab("groups")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
            ${tab === "groups" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
          <LayoutGrid className="h-4 w-4" /> Gruplar
        </button>
        <button
          onClick={() => setTab("all")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
            ${tab === "all" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
          <LayoutList className="h-4 w-4" /> Tüm Öğrenciler
          {allStudents.length > 0 && (
            <span className="ml-1 rounded-full bg-primary/10 text-primary text-xs px-1.5 py-0.5">{allStudents.length}</span>
          )}
        </button>
      </div>

      {/* ─── GROUPS TAB ──────────────────────────────────────────────────────── */}
      {tab === "groups" && (
        <>
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
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-secondary/30 transition-colors"
                    onClick={() => setExpandedGroup(expandedGroup === group.id ? null : group.id)}>
                    <div className="flex items-center gap-3">
                      {expandedGroup === group.id
                        ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
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
                      <Button size="sm" variant="outline" className="flex items-center gap-1.5"
                        onClick={(e) => { e.stopPropagation(); setAddStudentGroup(group); setExpandedGroup(group.id); setSearchAdd(""); }}>
                        <UserPlus className="h-3.5 w-3.5" /> Ekle
                      </Button>
                      <Button size="sm" variant="outline" className="flex items-center gap-1.5"
                        onClick={(e) => { e.stopPropagation(); setAnnounceGroup(group); }}>
                        <Megaphone className="h-3.5 w-3.5" /> Duyuru
                      </Button>
                    </div>
                  </div>

                  <AnimatePresence>
                    {expandedGroup === group.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="border-t border-border overflow-hidden">
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
                                    className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors" title="Gruptan çıkar">
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
        </>
      )}

      {/* ─── ALL STUDENTS TAB ────────────────────────────────────────────────── */}
      {tab === "all" && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="İsim veya e-posta ile ara..."
              value={searchAll} onChange={e => setSearchAll(e.target.value)} />
          </div>

          {loadingAll ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[1,2,3,4].map(i => <div key={i} className="h-28 rounded-xl animate-pulse bg-secondary/50" />)}
            </div>
          ) : filteredAll.length === 0 ? (
            <Card className="p-12 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground font-medium">
                {allStudents.length === 0 ? "Grubunuzda henüz öğrenci yok" : "Aramanızla eşleşen öğrenci bulunamadı"}
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredAll.map(s => (
                <Card key={s.id} className="hover:shadow-md transition-shadow">
                  <div className="p-4 flex items-start gap-3">
                    <div className="h-11 w-11 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                      {s.firstName[0]}{s.lastName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm">{s.firstName} {s.lastName}</p>
                        {s.currentLevel && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${LEVEL_COLORS[s.currentLevel] || "bg-muted text-muted-foreground"}`}>
                            {s.currentLevel}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{s.email}</p>

                      <div className="flex items-center gap-3 mt-2">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <TrendingUp className="h-3 w-3 text-primary" />
                          {s.totalPoints} puan
                        </span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          🔥 {s.streak} gün seri
                        </span>
                      </div>

                      {s.groups && s.groups.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {s.groups.map(g => {
                            const grp = groups.find(gr => gr.id === g.groupId);
                            return grp ? (
                              <span key={g.groupId} className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground flex items-center gap-1">
                                <BookOpen className="h-2.5 w-2.5" /> {grp.name}
                              </span>
                            ) : null;
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Add Student Modal ─────────────────────────────────────────────── */}
      <Modal isOpen={!!addStudentGroup} onClose={() => { setAddStudentGroup(null); setSearchAdd(""); }}
        title={`Gruba Öğrenci Ekle: ${addStudentGroup?.name}`}>
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="İsim veya e-posta ara..."
              value={searchAdd} onChange={(e) => setSearchAdd(e.target.value)} />
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
                  <Button size="sm"
                    onClick={() => addMutation.mutate({ groupId: addStudentGroup!.id, studentId: s.id })}
                    isLoading={addMutation.isPending}>
                    Ekle
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </Modal>

      {/* ─── Announce Modal ───────────────────────────────────────────────── */}
      <Modal isOpen={!!announceGroup} onClose={() => { setAnnounceGroup(null); setAnnounceText(""); }}
        title={`Grup Duyurusu: ${announceGroup?.name}`}>
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
            <Button className="flex-1"
              disabled={!announceText.trim()}
              isLoading={announceMutation.isPending}
              onClick={() => announceMutation.mutate({ groupId: announceGroup!.id, content: announceText.trim() })}>
              Gönder
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
