import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, Button, Input, Label, Modal } from "@/components/ui/core";
import { useToast } from "@/hooks/use-toast";
import { Users, Plus, Edit2, Trash2, GraduationCap, UserCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";

const groupSchema = z.object({
  name: z.string().min(2, "Grup adı en az 2 karakter olmalıdır"),
  description: z.string().optional(),
  teacherId: z.coerce.number().optional(),
});
type GroupForm = z.infer<typeof groupSchema>;

interface Teacher {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
}

interface Group {
  id: number;
  name: string;
  description: string | null;
  teacherId: number | null;
  teacher: Teacher | null;
  createdAt: string;
}

async function apiFetch(url: string, options?: RequestInit) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Bir hata oluştu" }));
    throw new Error(err.error || "Bir hata oluştu");
  }
  return res.json();
}

export default function AdminGroups() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);

  const { data: groups = [], isLoading } = useQuery<Group[]>({
    queryKey: ["/api/admin/groups"],
    queryFn: () => apiFetch("/api/admin/groups"),
  });

  const { data: teachers = [] } = useQuery<Teacher[]>({
    queryKey: ["/api/admin/teachers"],
    queryFn: () => apiFetch("/api/admin/teachers"),
  });

  const createMutation = useMutation({
    mutationFn: (data: GroupForm) =>
      apiFetch("/api/admin/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/groups"] });
      toast({ title: "Grup oluşturuldu!" });
      setIsCreateOpen(false);
      resetCreate();
    },
    onError: (e: Error) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<GroupForm> }) =>
      apiFetch(`/api/admin/groups/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/groups"] });
      toast({ title: "Güncellendi!" });
      setEditingGroup(null);
    },
    onError: (e: Error) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/admin/groups/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/groups"] });
      toast({ title: "Grup silindi" });
    },
    onError: (e: Error) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const { register: regCreate, handleSubmit: handleCreate, reset: resetCreate, formState: { errors: errCreate } } = useForm<GroupForm>({
    resolver: zodResolver(groupSchema),
  });

  const { register: regEdit, handleSubmit: handleEdit, reset: resetEdit, formState: { errors: errEdit } } = useForm<GroupForm>({
    resolver: zodResolver(groupSchema),
  });

  const openEdit = (group: Group) => {
    setEditingGroup(group);
    resetEdit({
      name: group.name,
      description: group.description || "",
      teacherId: group.teacherId || undefined,
    });
  };

  const TeacherSelect = ({ reg, error }: { reg: any; error?: string }) => (
    <div>
      <Label>Öğretmen</Label>
      <select
        {...reg}
        className="flex h-12 w-full rounded-xl border-2 border-border bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
      >
        <option value="">— Öğretmen seçin —</option>
        {teachers.map((t) => (
          <option key={t.id} value={t.id}>
            {t.firstName} {t.lastName}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-display">Sınıf / Grup Yönetimi</h2>
          <p className="text-muted-foreground text-sm mt-1">{groups.length} grup kayıtlı</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Yeni Grup
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : groups.length === 0 ? (
        <Card className="p-12 text-center">
          <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground font-medium">Henüz grup yok</p>
          <p className="text-sm text-muted-foreground mt-1">İlk grubu oluşturmak için "Yeni Grup" butonuna tıklayın.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {groups.map((group, i) => (
            <motion.div key={group.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="p-5 border-2 border-border hover:border-primary/30 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <GraduationCap className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{group.name}</h3>
                      {group.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{group.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => openEdit(group)}
                      className="p-2 rounded-lg hover:bg-secondary transition-colors"
                      title="Düzenle"
                    >
                      <Edit2 className="h-4 w-4 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`"${group.name}" grubunu silmek istediğinize emin misiniz?`))
                          deleteMutation.mutate(group.id);
                      }}
                      className="p-2 rounded-lg hover:bg-destructive/10 transition-colors"
                      title="Sil"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
                  <UserCheck className="h-4 w-4 text-muted-foreground" />
                  {group.teacher ? (
                    <span className="text-sm text-foreground font-medium">
                      {group.teacher.firstName} {group.teacher.lastName}
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground italic">Öğretmen atanmadı</span>
                  )}
                </div>

                <p className="text-xs text-muted-foreground mt-2">
                  Oluşturulma: {new Date(group.createdAt).toLocaleDateString("tr-TR")}
                </p>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Yeni Grup Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Yeni Grup Oluştur">
        <form onSubmit={handleCreate((d) => createMutation.mutateAsync(d))} className="space-y-4">
          <div>
            <Label htmlFor="cg-name">Grup Adı <span className="text-destructive">*</span></Label>
            <Input id="cg-name" placeholder="Örnek: A2 Sabah Grubu" {...regCreate("name")} />
            {errCreate.name && <p className="text-xs text-destructive mt-1">{errCreate.name.message}</p>}
          </div>
          <div>
            <Label htmlFor="cg-desc">Açıklama</Label>
            <Input id="cg-desc" placeholder="Kısa açıklama (isteğe bağlı)" {...regCreate("description")} />
          </div>
          <TeacherSelect reg={regCreate("teacherId")} error={errCreate.teacherId?.message} />
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setIsCreateOpen(false)}>İptal</Button>
            <Button type="submit" className="flex-1" isLoading={createMutation.isPending}>Oluştur</Button>
          </div>
        </form>
      </Modal>

      {/* Düzenleme Modal */}
      <Modal isOpen={!!editingGroup} onClose={() => setEditingGroup(null)} title={`Düzenle: ${editingGroup?.name}`}>
        <form onSubmit={handleEdit((d) => updateMutation.mutateAsync({ id: editingGroup!.id, data: d }))} className="space-y-4">
          <div>
            <Label htmlFor="eg-name">Grup Adı</Label>
            <Input id="eg-name" {...regEdit("name")} />
            {errEdit.name && <p className="text-xs text-destructive mt-1">{errEdit.name.message}</p>}
          </div>
          <div>
            <Label htmlFor="eg-desc">Açıklama</Label>
            <Input id="eg-desc" {...regEdit("description")} />
          </div>
          <TeacherSelect reg={regEdit("teacherId")} error={errEdit.teacherId?.message} />
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setEditingGroup(null)}>İptal</Button>
            <Button type="submit" className="flex-1" isLoading={updateMutation.isPending}>Güncelle</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
