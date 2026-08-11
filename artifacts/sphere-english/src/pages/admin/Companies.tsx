import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, Button, Input, Label, Modal } from "@/components/ui/core";
import { useToast } from "@/hooks/use-toast";
import { Building2, Plus, Edit2, Trash2, Users, Hash, Copy, Check, Shield, Phone, MapPin, Receipt, BadgeInfo } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";

const companySchema = z.object({
  name: z.string().min(2, "Kurum adı en az 2 karakter olmalıdır"),
  code: z.string().min(1, "Kurum ID'si zorunludur"),
  companyTitle: z.string().optional(),
  address: z.string().optional(),
  taxOffice: z.string().optional(),
  taxNumber: z.string().optional(),
  contactNumber: z.string().optional(),
  registrationLimit: z.coerce.number().min(0, "0 veya daha büyük olmalıdır"),
  corporateLimit: z.coerce.number().min(0, "0 veya daha büyük olmalıdır"),
});

type CompanyForm = z.infer<typeof companySchema>;

interface Company {
  id: number;
  name: string;
  code: string;
  companyTitle?: string | null;
  address?: string | null;
  taxOffice?: string | null;
  taxNumber?: string | null;
  contactNumber?: string | null;
  registrationLimit: number;
  corporateLimit: number;
  studentCount: number;
  corporateCount: number;
  remaining: number | null;
  corporateRemaining: number | null;
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

function FormField({ label, id, error, children }: { label: string; id: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
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
    defaultValues: { registrationLimit: 0, corporateLimit: 0 },
  });

  const { register: regEdit, handleSubmit: handleEdit, reset: resetEdit, formState: { errors: errEdit } } = useForm<CompanyForm>({
    resolver: zodResolver(companySchema),
  });

  const openEdit = (company: Company) => {
    setEditingCompany(company);
    resetEdit({
      name: company.name,
      code: company.code,
      companyTitle: company.companyTitle || "",
      address: company.address || "",
      taxOffice: company.taxOffice || "",
      taxNumber: company.taxNumber || "",
      contactNumber: company.contactNumber || "",
      registrationLimit: company.registrationLimit,
      corporateLimit: company.corporateLimit,
    });
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
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">{company.name}</h3>
                        {company.companyTitle && (
                          <p className="text-xs text-muted-foreground">{company.companyTitle}</p>
                        )}
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

                  {/* Hassas bilgiler — sadece admin görür */}
                  <div className="mb-3 space-y-1">
                    {company.contactNumber && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        <span>{company.contactNumber}</span>
                      </div>
                    )}
                    {company.address && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span className="line-clamp-1">{company.address}</span>
                      </div>
                    )}
                    {(company.taxOffice || company.taxNumber) && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Receipt className="h-3.5 w-3.5 shrink-0" />
                        <span>
                          {company.taxOffice && company.taxNumber
                            ? `${company.taxOffice} — VKN: ${company.taxNumber}`
                            : company.taxOffice || `VKN: ${company.taxNumber}`}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-sm mb-3">
                    <div className="flex items-center gap-1.5">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold">{company.studentCount}</span>
                      <span className="text-muted-foreground">öğrenci</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Shield className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold">{company.corporateCount}</span>
                      <span className="text-muted-foreground">yetkili</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {/* Öğrenci limiti */}
                    {company.registrationLimit > 0 ? (
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Öğrenci kayıt kullanımı</span>
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
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full bg-green-400" />
                        <span className="text-xs text-muted-foreground">Sınırsız öğrenci kaydı</span>
                      </div>
                    )}

                    {/* Yetkili limiti */}
                    {company.corporateLimit > 0 ? (
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Yetkili kullanımı</span>
                          <span className="font-semibold text-foreground">
                            {company.corporateCount} / {company.corporateLimit}
                          </span>
                        </div>
                        <div className="h-2 bg-secondary rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              company.corporateCount >= company.corporateLimit ? "bg-red-500" :
                              (company.corporateCount / company.corporateLimit) >= 0.8 ? "bg-orange-400" : "bg-blue-500"
                            }`}
                            style={{ width: `${Math.min(100, (company.corporateCount / company.corporateLimit) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full bg-blue-400" />
                        <span className="text-xs text-muted-foreground">Sınırsız yetkili kaydı</span>
                      </div>
                    )}
                  </div>

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
        <form onSubmit={handleCreate((data) => createMutation.mutateAsync(data))} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <FormField label="Kurum Adı *" id="c-name" error={errCreate.name?.message}>
                <Input id="c-name" placeholder="Örnek: ABC Holding" {...regCreate("name")} />
              </FormField>
            </div>
            <div className="col-span-2">
              <FormField label="Kurum ID'si *" id="c-code" error={errCreate.code?.message}>
                <Input id="c-code" placeholder="Örnek: KUR-0001" className="font-mono" {...regCreate("code")} />
              </FormField>
            </div>
            <div className="col-span-2">
              <FormField label="Şirket Ünvanı" id="c-title" error={errCreate.companyTitle?.message}>
                <Input id="c-title" placeholder="Örnek: ABC Holding A.Ş." {...regCreate("companyTitle")} />
              </FormField>
            </div>
            <div className="col-span-2">
              <FormField label="Adres" id="c-address" error={errCreate.address?.message}>
                <Input id="c-address" placeholder="Tam adres" {...regCreate("address")} />
              </FormField>
            </div>
            <FormField label="Vergi Dairesi" id="c-taxoffice" error={errCreate.taxOffice?.message}>
              <Input id="c-taxoffice" placeholder="Vergi dairesi adı" {...regCreate("taxOffice")} />
            </FormField>
            <FormField label="Vergi Numarası" id="c-taxno" error={errCreate.taxNumber?.message}>
              <Input id="c-taxno" placeholder="1234567890" {...regCreate("taxNumber")} />
            </FormField>
            <div className="col-span-2">
              <FormField label="İletişim Numarası" id="c-phone" error={errCreate.contactNumber?.message}>
                <Input id="c-phone" placeholder="+90 (5xx) xxx xx xx" {...regCreate("contactNumber")} />
              </FormField>
            </div>
            <FormField label="Öğrenci Kayıt Limiti" id="c-limit" error={errCreate.registrationLimit?.message}>
              <Input id="c-limit" type="number" min="0" placeholder="0 = Sınırsız" {...regCreate("registrationLimit")} />
            </FormField>
            <FormField label="Yetkili Kayıt Limiti" id="c-corp-limit" error={errCreate.corporateLimit?.message}>
              <Input id="c-corp-limit" type="number" min="0" placeholder="0 = Sınırsız" {...regCreate("corporateLimit")} />
            </FormField>
          </div>
          <p className="text-xs text-muted-foreground">
            <BadgeInfo className="h-3.5 w-3.5 inline mr-1" />
            Kurum ID'si otomatik oluşturulur (KUR-XXXX). Hassas bilgiler yalnızca admin tarafından görülebilir.
          </p>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setIsCreateOpen(false)}>İptal</Button>
            <Button type="submit" className="flex-1" isLoading={createMutation.isPending}>Oluştur</Button>
          </div>
        </form>
      </Modal>

      {/* Düzenleme Modal */}
      <Modal isOpen={!!editingCompany} onClose={() => setEditingCompany(null)} title={`Düzenle: ${editingCompany?.name}`}>
        <form onSubmit={handleEdit((data) => updateMutation.mutateAsync({ id: editingCompany!.id, data }))} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <FormField label="Kurum Adı" id="e-name" error={errEdit.name?.message}>
                <Input id="e-name" {...regEdit("name")} />
              </FormField>
            </div>
            <div className="col-span-2">
              <FormField label="Kurum ID'si" id="e-code" error={errEdit.code?.message}>
                <Input id="e-code" className="font-mono" {...regEdit("code")} />
              </FormField>
            </div>
            <div className="col-span-2">
              <FormField label="Şirket Ünvanı" id="e-title" error={errEdit.companyTitle?.message}>
                <Input id="e-title" placeholder="Örnek: ABC Holding A.Ş." {...regEdit("companyTitle")} />
              </FormField>
            </div>
            <div className="col-span-2">
              <FormField label="Adres" id="e-address" error={errEdit.address?.message}>
                <Input id="e-address" {...regEdit("address")} />
              </FormField>
            </div>
            <FormField label="Vergi Dairesi" id="e-taxoffice" error={errEdit.taxOffice?.message}>
              <Input id="e-taxoffice" {...regEdit("taxOffice")} />
            </FormField>
            <FormField label="Vergi Numarası" id="e-taxno" error={errEdit.taxNumber?.message}>
              <Input id="e-taxno" {...regEdit("taxNumber")} />
            </FormField>
            <div className="col-span-2">
              <FormField label="İletişim Numarası" id="e-phone" error={errEdit.contactNumber?.message}>
                <Input id="e-phone" {...regEdit("contactNumber")} />
              </FormField>
            </div>
            <FormField label="Öğrenci Kayıt Limiti" id="e-limit" error={errEdit.registrationLimit?.message}>
              <Input id="e-limit" type="number" min="0" {...regEdit("registrationLimit")} />
            </FormField>
            <FormField label="Yetkili Kayıt Limiti" id="e-corp-limit" error={errEdit.corporateLimit?.message}>
              <Input id="e-corp-limit" type="number" min="0" {...regEdit("corporateLimit")} />
            </FormField>
          </div>
          {editingCompany && editingCompany.studentCount > 0 && (
            <p className="text-xs text-orange-600">
              ⚠ Şu an {editingCompany.studentCount} öğrenci kayıtlı. Limit bu sayının altına düşürülmesi yeni kayıtları engeller.
            </p>
          )}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setEditingCompany(null)}>İptal</Button>
            <Button type="submit" className="flex-1" isLoading={updateMutation.isPending}>Güncelle</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
