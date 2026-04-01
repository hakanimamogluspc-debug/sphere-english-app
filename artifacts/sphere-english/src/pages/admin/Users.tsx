import { useState } from "react";
import { useGetUsers, useDeleteUser } from "@workspace/api-client-react";
import { Card, CardContent, Button, Input, Badge, Modal, Label } from "@/components/ui/core";
import { Search, Plus, Trash2, Edit, KeyRound, Mail } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { API } from "@/lib/api-url";
import { useToast } from "@/hooks/use-toast";

const createSchema = z.object({
  firstName: z.string().min(2, "En az 2 karakter"),
  lastName: z.string().min(2, "En az 2 karakter"),
  email: z.string().email("Geçerli e-posta giriniz"),
  password: z.string().min(6, "En az 6 karakter"),
  role: z.enum(["admin", "teacher", "student", "corporate"]),
  phone: z.string().optional(),
  currentLevel: z.string().optional(),
  sendWelcomeEmail: z.boolean().optional(),
});

const editSchema = z.object({
  firstName: z.string().min(2, "En az 2 karakter"),
  lastName: z.string().min(2, "En az 2 karakter"),
  email: z.string().email("Geçerli e-posta giriniz"),
  role: z.enum(["admin", "teacher", "student", "corporate"]),
  phone: z.string().optional(),
  currentLevel: z.string().optional(),
});

const passwordSchema = z.object({
  newPassword: z.string().min(6, "En az 6 karakter"),
  confirmPassword: z.string().min(6, "En az 6 karakter"),
}).refine(d => d.newPassword === d.confirmPassword, {
  message: "Şifreler eşleşmiyor",
  path: ["confirmPassword"],
});

type CreateForm = z.infer<typeof createSchema>;
type EditForm = z.infer<typeof editSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;

type User = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  phone?: string | null;
  currentLevel?: string | null;
  totalPoints?: number;
  createdAt: string;
};

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

export default function AdminUsers() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const { data: usersData, isLoading } = useGetUsers({ search });
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [passwordUser, setPasswordUser] = useState<User | null>(null);
  const [isEditLoading, setIsEditLoading] = useState(false);
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);
  const [isCreateLoading, setIsCreateLoading] = useState(false);

  const deleteMutation = useDeleteUser();
  const queryClient = useQueryClient();

  const createForm = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { role: "student", sendWelcomeEmail: true }
  });

  const watchRole = createForm.watch("role");

  const editForm = useForm<EditForm>({
    resolver: zodResolver(editSchema),
  });

  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
  });

  const onCreateSubmit = async (data: CreateForm) => {
    setIsCreateLoading(true);
    try {
      const token = localStorage.getItem("sphere_token");
      const res = await fetch(`${API}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Kullanıcı oluşturulamadı");
      }
      const result = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setIsCreateOpen(false);
      createForm.reset({ role: "student", sendWelcomeEmail: true });
      if (data.role === "teacher" && data.sendWelcomeEmail) {
        toast({ title: result.welcomeEmailSent ? "Öğretmen oluşturuldu — hoş geldin e-postası gönderildi!" : "Öğretmen oluşturuldu (e-posta gönderilemedi, SMTP kontrol edin)" });
      } else {
        toast({ title: "Kullanıcı oluşturuldu!" });
      }
    } catch (e: any) {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    } finally {
      setIsCreateLoading(false);
    }
  };

  const openEdit = (user: User) => {
    setEditUser(user);
    editForm.reset({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role as "admin" | "teacher" | "student",
      phone: user.phone || "",
      currentLevel: user.currentLevel || "",
    });
  };

  const onEditSubmit = async (data: EditForm) => {
    if (!editUser) return;
    setIsEditLoading(true);
    try {
      const token = localStorage.getItem("sphere_token");
      const res = await fetch(`${API}/users/${editUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Güncelleme başarısız");
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setEditUser(null);
    } finally {
      setIsEditLoading(false);
    }
  };

  const openPasswordChange = (user: User) => {
    setPasswordUser(user);
    passwordForm.reset();
  };

  const onPasswordSubmit = async (data: PasswordForm) => {
    if (!passwordUser) return;
    setIsPasswordLoading(true);
    try {
      const token = localStorage.getItem("sphere_token");
      const res = await fetch(`${API}/users/${passwordUser.id}/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ newPassword: data.newPassword }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Şifre değiştirme başarısız");
      }
      setPasswordUser(null);
    } finally {
      setIsPasswordLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("Bu kullanıcıyı silmek istediğinize emin misiniz?")) {
      await deleteMutation.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    }
  };

  const roleLabel: Record<string, string> = {
    admin: "Yönetici",
    teacher: "Öğretmen",
    student: "Öğrenci",
    corporate: "Kurum Yetkilisi",
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold font-display text-foreground">Kullanıcı Yönetimi</h1>
          <p className="text-muted-foreground mt-1">Platform kullanıcılarını, öğretmenleri ve yöneticileri yönetin.</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
          <Plus size={18} /> Kullanıcı Ekle
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="p-4 border-b border-border">
            <Input
              icon={<Search size={18} />}
              placeholder="Ad veya e-posta ile ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-md"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-secondary/50 text-muted-foreground">
                <tr>
                  <th className="px-6 py-4 font-semibold">Kullanıcı</th>
                  <th className="px-6 py-4 font-semibold">Rol</th>
                  <th className="px-6 py-4 font-semibold">Seviye / Puan</th>
                  <th className="px-6 py-4 font-semibold">Kayıt Tarihi</th>
                  <th className="px-6 py-4 font-semibold text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Kullanıcılar yükleniyor...</td></tr>
                ) : usersData?.users?.map(user => (
                  <tr key={user.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                          {user.firstName[0]}{user.lastName[0]}
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{user.firstName} {user.lastName}</p>
                          <p className="text-muted-foreground">{user.email}</p>
                          {user.phone && <p className="text-xs text-muted-foreground">{user.phone}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={user.role === 'admin' ? 'destructive' : user.role === 'teacher' ? 'success' : user.role === 'corporate' ? 'warning' : 'default'}>
                        {roleLabel[user.role] || user.role}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      {user.role === 'student' ? (
                        <div>
                          <p className="font-medium">{user.currentLevel || 'Yok'}</p>
                          <p className="text-xs text-muted-foreground">{user.totalPoints || 0} puan</p>
                        </div>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {new Date(user.createdAt).toLocaleDateString('tr-TR')}
                    </td>
                    <td className="px-6 py-4 text-right space-x-1">
                      <Button variant="ghost" size="icon" title="Düzenle" onClick={() => openEdit(user as User)}>
                        <Edit size={16} />
                      </Button>
                      <Button variant="ghost" size="icon" title="Şifre Değiştir" onClick={() => openPasswordChange(user as User)}>
                        <KeyRound size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(user.id)}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Yeni Kullanıcı Modalı */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Yeni Kullanıcı Oluştur">
        <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Ad</Label>
              <Input {...createForm.register("firstName")} />
              {createForm.formState.errors.firstName && <p className="text-xs text-destructive mt-1">{createForm.formState.errors.firstName.message}</p>}
            </div>
            <div>
              <Label>Soyad</Label>
              <Input {...createForm.register("lastName")} />
              {createForm.formState.errors.lastName && <p className="text-xs text-destructive mt-1">{createForm.formState.errors.lastName.message}</p>}
            </div>
          </div>
          <div>
            <Label>E-posta</Label>
            <Input type="email" {...createForm.register("email")} />
            {createForm.formState.errors.email && <p className="text-xs text-destructive mt-1">{createForm.formState.errors.email.message}</p>}
          </div>
          <div>
            <Label>Telefon (isteğe bağlı)</Label>
            <Input {...createForm.register("phone")} placeholder="+90 555 000 00 00" />
          </div>
          <div>
            <Label>Şifre</Label>
            <Input type="password" {...createForm.register("password")} />
            {createForm.formState.errors.password && <p className="text-xs text-destructive mt-1">{createForm.formState.errors.password.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Rol</Label>
              <select {...createForm.register("role")} className="flex h-12 w-full rounded-xl border-2 border-border bg-background px-4 py-2">
                <option value="student">Öğrenci</option>
                <option value="teacher">Öğretmen</option>
                <option value="admin">Yönetici</option>
                <option value="corporate">Kurum Yetkilisi</option>
              </select>
            </div>
            <div>
              <Label>Seviye (isteğe bağlı)</Label>
              <select {...createForm.register("currentLevel")} className="flex h-12 w-full rounded-xl border-2 border-border bg-background px-4 py-2">
                <option value="">Seçiniz</option>
                {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>

          {watchRole === "teacher" && (
            <label className="flex items-center gap-3 p-3 rounded-xl border-2 border-blue-200 bg-blue-50 cursor-pointer select-none">
              <input
                type="checkbox"
                {...createForm.register("sendWelcomeEmail")}
                className="h-4 w-4 rounded accent-blue-600"
              />
              <div className="flex items-center gap-2 text-sm">
                <Mail size={15} className="text-blue-600 flex-shrink-0" />
                <span className="font-medium text-blue-800">Hoş geldin e-postası gönder</span>
              </div>
              <span className="text-xs text-blue-500 ml-auto">şifre dahil</span>
            </label>
          )}

          <Button type="submit" className="w-full mt-2" isLoading={isCreateLoading}>Kullanıcı Oluştur</Button>
        </form>
      </Modal>

      {/* Kullanıcı Düzenleme Modalı */}
      <Modal isOpen={!!editUser} onClose={() => setEditUser(null)} title={`Kullanıcıyı Düzenle — ${editUser?.firstName} ${editUser?.lastName}`}>
        <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Ad</Label>
              <Input {...editForm.register("firstName")} />
              {editForm.formState.errors.firstName && <p className="text-xs text-destructive mt-1">{editForm.formState.errors.firstName.message}</p>}
            </div>
            <div>
              <Label>Soyad</Label>
              <Input {...editForm.register("lastName")} />
              {editForm.formState.errors.lastName && <p className="text-xs text-destructive mt-1">{editForm.formState.errors.lastName.message}</p>}
            </div>
          </div>
          <div>
            <Label>E-posta</Label>
            <Input type="email" {...editForm.register("email")} />
            {editForm.formState.errors.email && <p className="text-xs text-destructive mt-1">{editForm.formState.errors.email.message}</p>}
          </div>
          <div>
            <Label>Telefon</Label>
            <Input {...editForm.register("phone")} placeholder="+90 555 000 00 00" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Rol</Label>
              <select {...editForm.register("role")} className="flex h-12 w-full rounded-xl border-2 border-border bg-background px-4 py-2">
                <option value="student">Öğrenci</option>
                <option value="teacher">Öğretmen</option>
                <option value="admin">Yönetici</option>
                <option value="corporate">Kurum Yetkilisi</option>
              </select>
            </div>
            <div>
              <Label>Seviye</Label>
              <select {...editForm.register("currentLevel")} className="flex h-12 w-full rounded-xl border-2 border-border bg-background px-4 py-2">
                <option value="">Seçiniz</option>
                {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setEditUser(null)}>İptal</Button>
            <Button type="submit" className="flex-1" isLoading={isEditLoading}>Kaydet</Button>
          </div>
        </form>
      </Modal>

      {/* Şifre Değiştirme Modalı */}
      <Modal isOpen={!!passwordUser} onClose={() => setPasswordUser(null)} title={`Şifre Değiştir — ${passwordUser?.firstName} ${passwordUser?.lastName}`}>
        <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            <strong>{passwordUser?.email}</strong> kullanıcısının şifresini değiştiriyorsunuz.
          </div>
          <div>
            <Label>Yeni Şifre</Label>
            <Input type="password" {...passwordForm.register("newPassword")} placeholder="En az 6 karakter" />
            {passwordForm.formState.errors.newPassword && <p className="text-xs text-destructive mt-1">{passwordForm.formState.errors.newPassword.message}</p>}
          </div>
          <div>
            <Label>Yeni Şifre (Tekrar)</Label>
            <Input type="password" {...passwordForm.register("confirmPassword")} placeholder="Şifreyi tekrar giriniz" />
            {passwordForm.formState.errors.confirmPassword && <p className="text-xs text-destructive mt-1">{passwordForm.formState.errors.confirmPassword.message}</p>}
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setPasswordUser(null)}>İptal</Button>
            <Button type="submit" className="flex-1" isLoading={isPasswordLoading}>Şifreyi Değiştir</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
