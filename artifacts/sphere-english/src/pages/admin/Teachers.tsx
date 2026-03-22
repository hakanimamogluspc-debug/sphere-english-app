import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, Button, Input, Label, Modal, Badge } from "@/components/ui/core";
import { useToast } from "@/hooks/use-toast";
import { Users, Plus, Trash2, GraduationCap, UserPlus, Eye, Building2, Search, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";

// ─── Types ───────────────────────────────────────────────────────────────────
interface Teacher { id: number; firstName: string; lastName: string; email: string; }
interface Group { id: number; name: string; description: string | null; teacherId: number | null; memberCount: number; createdAt: string; }
interface Student { id: number; firstName: string; lastName: string; email: string; currentLevel: string | null; companyId: number | null; }
interface Company { id: number; name: string; }

// ─── API helper ──────────────────────────────────────────────────────────────
async function api(url: string, options?: RequestInit) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Hata oluştu" }));
    throw new Error(err.error || "Hata oluştu");
  }
  return res.json();
}

// ─── Schemas ─────────────────────────────────────────────────────────────────
const groupSchema = z.object({
  name: z.string().min(2, "En az 2 karakter"),
  description: z.string().optional(),
});
type GroupForm = z.infer<typeof groupSchema>;

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AdminTeachers() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [addStudentMode, setAddStudentMode] = useState<"single" | "company" | null>(null);
  const [viewStudentsGroup, setViewStudentsGroup] = useState<Group | null>(null);
  const [isNewGroupOpen, setIsNewGroupOpen] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | "">("");

  // ─── Queries ──────────────────────────────────────────────────────────────
  const { data: teachers = [], isLoading } = useQuery<Teacher[]>({
    queryKey: ["/api/admin/teachers"],
    queryFn: () => api("/api/admin/teachers"),
  });

  const { data: teacherGroups = [] } = useQuery<Group[]>({
    queryKey: ["/api/admin/teachers", selectedTeacher?.id, "groups"],
    queryFn: () => api(`/api/admin/teachers/${selectedTeacher!.id}/groups`),
    enabled: !!selectedTeacher,
  });

  const { data: groupStudents = [] } = useQuery<Student[]>({
    queryKey: ["/api/admin/groups", viewStudentsGroup?.id, "students"],
    queryFn: () => api(`/api/admin/groups/${viewStudentsGroup!.id}/students`),
    enabled: !!viewStudentsGroup,
  });

  const { data: allStudents = [] } = useQuery<Student[]>({
    queryKey: ["/api/users", { role: "student" }],
    queryFn: () => api("/api/users?role=student&limit=500"),
    select: (d: any) => d.users || [],
    enabled: addStudentMode === "single",
  });

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ["/api/admin/companies-list"],
    queryFn: () => api("/api/admin/companies-list"),
    enabled: addStudentMode === "company",
  });

  // ─── Mutations ────────────────────────────────────────────────────────────
  const createGroupMutation = useMutation({
    mutationFn: (data: GroupForm) => api("/api/admin/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, teacherId: selectedTeacher?.id }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/teachers", selectedTeacher?.id, "groups"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/groups"] });
      toast({ title: "Grup oluşturuldu!" });
      setIsNewGroupOpen(false);
      createGroupForm.reset();
    },
    onError: (e: Error) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const deleteGroupMutation = useMutation({
    mutationFn: (groupId: number) => api(`/api/admin/groups/${groupId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/teachers", selectedTeacher?.id, "groups"] });
      toast({ title: "Grup silindi" });
    },
    onError: (e: Error) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const addStudentsMutation = useMutation({
    mutationFn: ({ groupId, studentIds, companyId }: { groupId: number; studentIds?: number[]; companyId?: number }) =>
      api(`/api/admin/groups/${groupId}/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentIds, companyId }),
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/admin/teachers", selectedTeacher?.id, "groups"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/groups", selectedGroup?.id, "students"] });
      toast({ title: `${data.added} öğrenci eklendi!` });
      setAddStudentMode(null);
      setSelectedStudentIds([]);
      setSelectedCompanyId("");
    },
    onError: (e: Error) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const removeStudentMutation = useMutation({
    mutationFn: ({ groupId, studentId }: { groupId: number; studentId: number }) =>
      api(`/api/admin/groups/${groupId}/students/${studentId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/groups", viewStudentsGroup?.id, "students"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/teachers", selectedTeacher?.id, "groups"] });
      toast({ title: "Öğrenci gruptan çıkarıldı" });
    },
    onError: (e: Error) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  // ─── Form ─────────────────────────────────────────────────────────────────
  const createGroupForm = useForm<GroupForm>({ resolver: zodResolver(groupSchema) });

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const filteredStudents = allStudents.filter((s: Student) => {
    const q = studentSearch.toLowerCase();
    return `${s.firstName} ${s.lastName} ${s.email}`.toLowerCase().includes(q);
  });

  const toggleStudent = (id: number) => {
    setSelectedStudentIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleAddStudents = () => {
    if (!selectedGroup) return;
    if (addStudentMode === "single" && selectedStudentIds.length > 0) {
      addStudentsMutation.mutate({ groupId: selectedGroup.id, studentIds: selectedStudentIds });
    } else if (addStudentMode === "company" && selectedCompanyId) {
      addStudentsMutation.mutate({ groupId: selectedGroup.id, companyId: Number(selectedCompanyId) });
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-display text-foreground">Öğretmen Yönetimi</h1>
        <p className="text-muted-foreground mt-1">Öğretmenlere grup, kurum veya bireysel öğrenci atayın.</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : teachers.length === 0 ? (
        <Card className="p-12 text-center">
          <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground font-medium">Henüz öğretmen yok</p>
          <p className="text-sm text-muted-foreground mt-1">Kullanıcı yönetiminden öğretmen ekleyebilirsiniz.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {teachers.map((teacher, i) => (
            <motion.div key={teacher.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="p-5 border-2 border-border hover:border-primary/30 transition-colors">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                    {teacher.firstName[0]}{teacher.lastName[0]}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{teacher.firstName} {teacher.lastName}</p>
                    <p className="text-xs text-muted-foreground">{teacher.email}</p>
                  </div>
                </div>
                <Button className="w-full" variant="outline" onClick={() => setSelectedTeacher(teacher)}>
                  <Users size={16} className="mr-2" />
                  Grupları Yönet
                </Button>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* ── Öğretmen Grup Yönetimi Modalı ── */}
      <Modal
        isOpen={!!selectedTeacher && !isNewGroupOpen && !addStudentMode && !viewStudentsGroup}
        onClose={() => setSelectedTeacher(null)}
        title={`${selectedTeacher?.firstName} ${selectedTeacher?.lastName} — Gruplar`}
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          <Button className="w-full gap-2" onClick={() => setIsNewGroupOpen(true)}>
            <Plus size={16} /> Yeni Grup Ekle
          </Button>

          {teacherGroups.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <GraduationCap className="mx-auto mb-2 h-8 w-8 opacity-40" />
              <p>Bu öğretmene henüz grup atanmadı.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {teacherGroups.map((group) => (
                <div key={group.id} className="flex items-center justify-between p-4 rounded-xl border-2 border-border">
                  <div>
                    <p className="font-semibold text-foreground">{group.name}</p>
                    {group.description && <p className="text-xs text-muted-foreground mt-0.5">{group.description}</p>}
                    <Badge variant="secondary" className="mt-1">{group.memberCount} öğrenci</Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => { setSelectedGroup(group); setViewStudentsGroup(group); }}>
                      <Eye size={14} className="mr-1" /> Öğrenciler
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setSelectedGroup(group); setAddStudentMode("single"); }}>
                      <UserPlus size={14} className="mr-1" /> Ekle
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10"
                      onClick={() => { if (confirm(`"${group.name}" silinsin mi?`)) deleteGroupMutation.mutate(group.id); }}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* ── Yeni Grup Modalı ── */}
      <Modal isOpen={isNewGroupOpen} onClose={() => setIsNewGroupOpen(false)} title="Yeni Grup Oluştur">
        <form onSubmit={createGroupForm.handleSubmit((d) => createGroupMutation.mutateAsync(d))} className="space-y-4">
          <div>
            <Label>Grup Adı</Label>
            <Input {...createGroupForm.register("name")} placeholder="Örn: B2 Akşam Grubu" />
            {createGroupForm.formState.errors.name && <p className="text-xs text-destructive mt-1">{createGroupForm.formState.errors.name.message}</p>}
          </div>
          <div>
            <Label>Açıklama (isteğe bağlı)</Label>
            <Input {...createGroupForm.register("description")} placeholder="Kısa açıklama" />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setIsNewGroupOpen(false)}>İptal</Button>
            <Button type="submit" className="flex-1" isLoading={createGroupMutation.isPending}>Oluştur</Button>
          </div>
        </form>
      </Modal>

      {/* ── Öğrenci Ekle Modalı ── */}
      <Modal
        isOpen={!!addStudentMode}
        onClose={() => { setAddStudentMode(null); setSelectedStudentIds([]); setSelectedCompanyId(""); }}
        title={`"${selectedGroup?.name}" — Öğrenci Ekle`}
        maxWidth="max-w-xl"
      >
        <div className="space-y-4">
          {/* Mod Seçimi */}
          <div className="flex gap-2">
            <Button
              variant={addStudentMode === "single" ? "default" : "outline"}
              className="flex-1 gap-2"
              onClick={() => setAddStudentMode("single")}
            >
              <UserPlus size={16} /> Tekli Atama
            </Button>
            <Button
              variant={addStudentMode === "company" ? "default" : "outline"}
              className="flex-1 gap-2"
              onClick={() => setAddStudentMode("company")}
            >
              <Building2 size={16} /> Kurumdan Ekle
            </Button>
          </div>

          {addStudentMode === "single" && (
            <div className="space-y-3">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Ad, soyad veya e-posta ara..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                />
              </div>
              <div className="max-h-64 overflow-y-auto border-2 border-border rounded-xl divide-y divide-border">
                {filteredStudents.length === 0 ? (
                  <p className="text-center text-muted-foreground py-6 text-sm">Öğrenci bulunamadı</p>
                ) : filteredStudents.map((s: Student) => (
                  <label key={s.id} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-secondary/30 transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedStudentIds.includes(s.id)}
                      onChange={() => toggleStudent(s.id)}
                      className="h-4 w-4 rounded border-border accent-primary"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground">{s.firstName} {s.lastName}</p>
                      <p className="text-xs text-muted-foreground truncate">{s.email}</p>
                    </div>
                    {s.currentLevel && <Badge variant="outline" className="text-xs">{s.currentLevel}</Badge>}
                  </label>
                ))}
              </div>
              {selectedStudentIds.length > 0 && (
                <p className="text-sm text-primary font-medium">{selectedStudentIds.length} öğrenci seçildi</p>
              )}
            </div>
          )}

          {addStudentMode === "company" && (
            <div className="space-y-3">
              <div>
                <Label>Kurum Seçin</Label>
                <select
                  value={selectedCompanyId}
                  onChange={(e) => setSelectedCompanyId(e.target.value ? Number(e.target.value) : "")}
                  className="flex h-12 w-full rounded-xl border-2 border-border bg-background px-4 py-2"
                >
                  <option value="">— Kurum seçin —</option>
                  {companies.map((c: Company) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              {selectedCompanyId && (
                <div className="p-3 bg-primary/5 rounded-xl border border-primary/20 text-sm text-foreground">
                  Seçilen kurumun tüm öğrencileri bu gruba eklenecek.
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => { setAddStudentMode(null); setSelectedStudentIds([]); setSelectedCompanyId(""); }}>
              İptal
            </Button>
            <Button
              className="flex-1"
              disabled={(addStudentMode === "single" && selectedStudentIds.length === 0) || (addStudentMode === "company" && !selectedCompanyId)}
              isLoading={addStudentsMutation.isPending}
              onClick={handleAddStudents}
            >
              Ekle
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Öğrenci Listesi Modalı ── */}
      <Modal
        isOpen={!!viewStudentsGroup}
        onClose={() => setViewStudentsGroup(null)}
        title={`"${viewStudentsGroup?.name}" — Öğrenciler`}
        maxWidth="max-w-lg"
      >
        <div className="space-y-3">
          {groupStudents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="mx-auto mb-2 h-8 w-8 opacity-40" />
              <p>Bu grupta henüz öğrenci yok.</p>
            </div>
          ) : (
            <div className="divide-y divide-border border-2 border-border rounded-xl">
              {groupStudents.map((s: Student) => (
                <div key={s.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="font-medium text-sm text-foreground">{s.firstName} {s.lastName}</p>
                    <p className="text-xs text-muted-foreground">{s.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {s.currentLevel && <Badge variant="outline" className="text-xs">{s.currentLevel}</Badge>}
                    <button
                      onClick={() => removeStudentMutation.mutate({ groupId: viewStudentsGroup!.id, studentId: s.id })}
                      className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors"
                      title="Gruptan çıkar"
                    >
                      <X size={14} className="text-destructive" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Button variant="outline" className="w-full" onClick={() => setViewStudentsGroup(null)}>Kapat</Button>
        </div>
      </Modal>
    </div>
  );
}
