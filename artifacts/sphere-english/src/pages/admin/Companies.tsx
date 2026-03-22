import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, Button, Input, Label, Modal } from "@/components/ui/core";
import { useToast } from "@/hooks/use-toast";
import { Building2, Plus, Edit2, Trash2, Users, Hash, Copy, Check, Shield } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";

const companySchema = z.object({
  name: z.string().min(2, "Kurum adı en az 2 karakter olmalıdır"),
  registrationLimit: z.coerce.number().min(0, "0 veya daha büyük olmalıdır"),
});
type CompanyForm = z.infer<typeof companySchema>;

interface Company {
  id: number;
  name: string;
  code: string;
  registrationLimit: number;
  studentCount: number;
  corporateCount: number;
  remaining: number | null;
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

export default function AdminCompanies() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const { data: companies = [], isLoading } = useQuery<Company[]>({
    queryKey: ["/api/admin/companies"],
    queryFn: () => apiFetch("/api/admin/companies"),
  });

  const createMutation = useMutation({
    mutationFn: (data: CompanyForm) =>
      apiFetch("/api/admin/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: (company) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/companies"] });
      toast({ title: "Kurum Oluşturuldu!", description: `${company.name} (${company.code}) başarıyla eklendi.` });
      setIsCreateOpen(false);
      resetCreate();
    },
    onError: (e: Error) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CompanyForm> }) =>
      apiFetch(`/api/admin/companies/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/companies"] });
      toast({ title: "Güncellendi!", description: "Kurum bilgileri başarıyla güncellendi." });
      setEditingCompany(null);
    },
    onError: (e: Error) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/admin/companies/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/companies"] });
      toast({ title: "Silindi", description: "Kurum başarıyla silindi." });
    },
    onError: (e: Error) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const { register: regCreate, handleSubmit: handleCreate, reset: resetCreate, formState: { errors: errCreate } } = useForm<CompanyForm>({
    resolver: zodResolver(companySchema),
    defaultValues: { registrationLimit: 0 },
  });

  const { register: regEdit, handleSubmit: handleEdit, reset: resetEdit, formState: { errors: errEdit } } = useForm<CompanyForm>({
    resolver: zodResolver(companySchema),
  });

  const openEdit = (company: Company) => {
    setEditingCompany(company);
    resetEdit({ name: company.name, registrationLimit: company.registrationLimit });
  };

  const handleDelete = (company: Company) => {
    if (confirm(`"${company.name}" kurumunu silmek istediğinize emin misiniz?`)) {
      deleteMutation.mutate(company.id);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-display">Kurum Yönetimi</h2>
          <p className="text-muted-foreground text-sm mt-1">{companies.length} kurum kayıtlı</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Yeni Kurum
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : companies.length === 0 ? (
        <Card className="p-12 text-center">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground font-medium">Henüz kurum yok</p>
          <p className="text-sm text-muted-foreground mt-1">İlk kurumu oluşturmak için "Yeni Kurum" butonuna tıklayın.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {companies.map((company, i) => {
            const usagePercent = company.registrationLimit > 0
              ? Math.min(100, (company.studentCount / company.registrationLimit) * 100)
              : 0;
            const isFull = company.registrationLimit > 0 && company.studentCount >= company.registrationLimit;

            return (
              <motion.div key={company.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                <Card className={`p-5 border-2 ${isFull ? "border-red-200" : "border-border"}`}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">{company.name}</h3>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm font-mono font-semibold text-primary">{company.code}</span>
                          <button
                            onClick={() => copyCode(company.code)}
                            className="ml-1 p-0.5 rounded hover:bg-secondary transition-colors"
                            title="Kodu kopyala"
                          >
                            {copiedCode === company.code
                              ? <Check className="h-3.5 w-3.5 text-green-600" />
                              : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(company)} className="p-2 rounded-lg hover:bg-secondary transition-colors" title="Düzenle">
                        <Edit2 className="h-4 w-4 text-muted-foreground" />
                      </button>
                      <button onClick={() => handleDelete(company)} className="p-2 rounded-lg hover:bg-destructive/10 transition-colors" title="Sil">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-sm mb-4">
                    <div className="flex items-center gap-1.5">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold">{company.studentCount}</span>
                      <span className="text-muted-foreground">öğrenci</span>
                    </div>
                    {company.corporateCount > 0 && (
                      <div className="flex items-center gap-1.5">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold">{company.corporateCount}</span>
                        <span className="text-muted-foreground">yetkili</span>
                      </div>
                    )}
                  </div>

                  {company.registrationLimit > 0 ? (
                    <div>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-muted-foreground">Kayıt kullanımı</span>
                        <span className={`font-semibold ${isFull ? "text-red-600" : "text-foreground"}`}>
                          {company.studentCount} / {company.registrationLimit}
                          {isFull && " — Limit doldu!"}
                        </span>
                      </div>
                      <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            usagePercent >= 100 ? "bg-red-500" :
                            usagePercent >= 80 ? "bg-orange-400" : "bg-green-500"
                          }`}
                          style={{ width: `${usagePercent}%` }}
                        />
                      </div>
                      {company.remaining !== null && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {company.remaining > 0 ? `${company.remaining} kayıt hakkı kaldı` : "Tüm slotlar dolu"}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <div className="h-2 w-2 rounded-full bg-green-400" />
                      <span className="text-xs text-muted-foreground">Sınırsız kayıt</span>
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground mt-3">
                    Oluşturulma: {new Date(company.createdAt).toLocaleDateString("tr-TR")}
                  </p>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Yeni Kurum Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Yeni Kurum Oluştur">
        <form onSubmit={handleCreate((data) => createMutation.mutateAsync(data))} className="space-y-5">
          <div>
            <Label htmlFor="c-name">Kurum Adı <span className="text-destructive">*</span></Label>
            <Input id="c-name" placeholder="Örnek: ABC Holding A.Ş." error={errCreate.name?.message} {...regCreate("name")} />
          </div>
          <div>
            <Label htmlFor="c-limit">Kayıt Limiti</Label>
            <Input id="c-limit" type="number" min="0" placeholder="0 = Sınırsız" error={errCreate.registrationLimit?.message} {...regCreate("registrationLimit")} />
            <p className="text-xs text-muted-foreground mt-1">0 girilirse sınırsız öğrenci kayıt olabilir.</p>
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setIsCreateOpen(false)}>İptal</Button>
            <Button type="submit" className="flex-1" isLoading={createMutation.isPending}>Oluştur</Button>
          </div>
        </form>
      </Modal>

      {/* Düzenleme Modal */}
      <Modal isOpen={!!editingCompany} onClose={() => setEditingCompany(null)} title={`Düzenle: ${editingCompany?.name}`}>
        <form onSubmit={handleEdit((data) => updateMutation.mutateAsync({ id: editingCompany!.id, data }))} className="space-y-5">
          <div>
            <Label htmlFor="e-name">Kurum Adı</Label>
            <Input id="e-name" error={errEdit.name?.message} {...regEdit("name")} />
          </div>
          <div>
            <Label htmlFor="e-limit">Kayıt Limiti</Label>
            <Input id="e-limit" type="number" min="0" error={errEdit.registrationLimit?.message} {...regEdit("registrationLimit")} />
            <p className="text-xs text-muted-foreground mt-1">0 girilirse sınırsız öğrenci kayıt olabilir.</p>
            {editingCompany && editingCompany.studentCount > 0 && (
              <p className="text-xs text-orange-600 mt-1">
                ⚠ Şu an {editingCompany.studentCount} öğrenci kayıtlı. Limit bu sayının altına düşürülmesi yeni kayıtları engeller.
              </p>
            )}
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setEditingCompany(null)}>İptal</Button>
            <Button type="submit" className="flex-1" isLoading={updateMutation.isPending}>Güncelle</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
