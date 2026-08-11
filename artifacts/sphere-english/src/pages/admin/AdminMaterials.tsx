import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, Button, Input, Label, Modal, Badge } from "@/components/ui/core";
import { useToast } from "@/hooks/use-toast";
import {
  FolderOpen, Plus, Trash2, Upload, FileText, Eye, EyeOff,
  Search, X, Users, ToggleLeft, ToggleRight, File, ImageIcon, ChevronRight, ArrowLeft
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { API } from "@/lib/api-url";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface Folder { id: number; name: string; description: string | null; isActive: boolean; materialCount: number; creatorName: string | null; createdAt: string; }
interface Material { id: number; title: string; fileName: string; fileUrl: string; fileType: string; fileSize: number | null; isActive: boolean; uploaderName: string | null; createdAt: string; }
interface FolderDetail extends Folder { materials: Material[]; }
interface StudentAccess { id: number; firstName: string; lastName: string; email: string; hasAccess: boolean; }

// ─── Helpers ──────────────────────────────────────────────────────────────────
function authHeaders() { return { Authorization: `Bearer ${localStorage.getItem("sphere_token")}` }; }

async function api(url: string, options?: RequestInit) {
  const res = await fetch(url, { ...options, headers: { ...authHeaders(), ...(options?.headers || {}) } });
  if (!res.ok) { const e = await res.json().catch(() => ({ error: "Hata" })); throw new Error(e.error || "Hata"); }
  return res.json();
}

function fileIcon(type: string) {
  if (type === "pdf") return <FileText className="h-5 w-5 text-red-500" />;
  if (type === "pptx") return <File className="h-5 w-5 text-orange-500" />;
  if (type === "docx") return <FileText className="h-5 w-5 text-blue-500" />;
  if (["png", "jpeg", "jpg", "gif", "webp"].includes(type)) return <ImageIcon className="h-5 w-5 text-green-500" />;
  return <File className="h-5 w-5 text-muted-foreground" />;
}

function fileSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function AdminMaterials() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFolder, setSelectedFolder] = useState<FolderDetail | null>(null);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [isAccessOpen, setIsAccessOpen] = useState(false);
  const [folderSearch, setFolderSearch] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [folderForm, setFolderForm] = useState({ name: "", description: "" });

  // ─── Queries ─────────────────────────────────────────────────────────────────
  const { data: folders = [], isLoading } = useQuery<Folder[]>({
    queryKey: ["/api/materials/folders"],
    queryFn: () => api(`${API}/materials/folders`),
  });

  const { data: folderDetail, refetch: refetchDetail } = useQuery<FolderDetail>({
    queryKey: ["/api/materials/folders", selectedFolder?.id],
    queryFn: () => api(`${API}/materials/folders/${selectedFolder!.id}`),
    enabled: !!selectedFolder,
  });

  const { data: studentAccess = [] } = useQuery<StudentAccess[]>({
    queryKey: ["/api/admin/materials/folders", selectedFolder?.id, "access"],
    queryFn: () => api(`${API}/admin/materials/folders/${selectedFolder!.id}/access`),
    enabled: !!selectedFolder && isAccessOpen,
  });

  // ─── Mutations ────────────────────────────────────────────────────────────────
  const createFolderMut = useMutation({
    mutationFn: (body: object) => api(`${API}/materials/folders`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
    }),
    onSuccess: () => { toast({ title: "Klasör oluşturuldu" }); qc.invalidateQueries({ queryKey: ["/api/materials/folders"] }); setIsCreateFolderOpen(false); setFolderForm({ name: "", description: "" }); },
    onError: (e: any) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const deleteFolderMut = useMutation({
    mutationFn: (id: number) => api(`${API}/materials/folders/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast({ title: "Klasör silindi" }); qc.invalidateQueries({ queryKey: ["/api/materials/folders"] }); setSelectedFolder(null); },
    onError: (e: any) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const toggleFolderMut = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      api(`${API}/materials/folders/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/materials/folders"] }); refetchDetail(); },
    onError: (e: any) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const deleteMaterialMut = useMutation({
    mutationFn: (id: number) => api(`${API}/materials/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast({ title: "Dosya silindi" }); refetchDetail(); qc.invalidateQueries({ queryKey: ["/api/materials/folders"] }); },
    onError: (e: any) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const toggleMaterialMut = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      api(`${API}/materials/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive }) }),
    onSuccess: () => refetchDetail(),
    onError: (e: any) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const toggleAccessMut = useMutation({
    mutationFn: ({ studentId, hasAccess }: { studentId: number; hasAccess: boolean }) =>
      api(`${API}/admin/materials/folders/${selectedFolder!.id}/access`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ studentId, hasAccess })
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/admin/materials/folders", selectedFolder?.id, "access"] }),
    onError: (e: any) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  // ─── File Upload ──────────────────────────────────────────────────────────────
  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile || !uploadTitle || !selectedFolder) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("title", uploadTitle);
      const res = await fetch(`${API}/materials/folders/${selectedFolder.id}/upload`, {
        method: "POST", headers: authHeaders(), body: formData,
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Yükleme başarısız"); }
      toast({ title: "Dosya yüklendi" });
      setIsUploadOpen(false); setSelectedFile(null); setUploadTitle("");
      refetchDetail(); qc.invalidateQueries({ queryKey: ["/api/materials/folders"] });
    } catch (e: any) {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    } finally { setIsUploading(false); }
  }

  const filteredFolders = folders.filter(f => f.name.toLowerCase().includes(folderSearch.toLowerCase()));
  const filteredStudents = studentAccess.filter(s =>
    `${s.firstName} ${s.lastName}`.toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.email.toLowerCase().includes(studentSearch.toLowerCase())
  );
  const currentDetail = folderDetail && folderDetail.id === selectedFolder?.id ? folderDetail : null;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FolderOpen className="h-6 w-6 text-primary" />
            {selectedFolder ? (
              <span className="flex items-center gap-2">
                <button onClick={() => setSelectedFolder(null)} className="text-muted-foreground hover:text-foreground transition-colors">Materyaller</button>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                {selectedFolder.name}
              </span>
            ) : "Materyal Yönetimi"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {selectedFolder ? "Klasör içeriğini ve öğrenci erişimini yönetin" : "Klasörler ve dosyalar oluşturun, öğrenci erişimini kontrol edin"}
          </p>
        </div>
        <div className="flex gap-2">
          {selectedFolder ? (
            <>
              <Button variant="outline" className="gap-2" onClick={() => setIsAccessOpen(true)}>
                <Users className="h-4 w-4" /> Öğrenci Erişimi
              </Button>
              <Button className="gap-2" onClick={() => setIsUploadOpen(true)}>
                <Upload className="h-4 w-4" /> Dosya Yükle
              </Button>
              <Button variant="outline" onClick={() => setSelectedFolder(null)} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Geri
              </Button>
            </>
          ) : (
            <Button onClick={() => setIsCreateFolderOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Yeni Klasör
            </Button>
          )}
        </div>
      </div>

      {/* Folder list */}
      {!selectedFolder && (
        <>
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Klasör ara..." className="pl-8 h-9" value={folderSearch}
              onChange={e => setFolderSearch(e.target.value)} />
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => <Card key={i} className="h-32 animate-pulse bg-secondary/50" />)}
            </div>
          ) : filteredFolders.length === 0 ? (
            <Card><CardContent className="py-16 text-center text-muted-foreground">
              <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>Henüz klasör yok. "Yeni Klasör" ile başlayın.</p>
            </CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredFolders.map(f => (
                <motion.div key={f.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <Card className={`cursor-pointer hover:shadow-md transition-all border-2 ${f.isActive ? "border-transparent" : "border-muted opacity-70"}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <button className="flex items-start gap-3 flex-1 text-left" onClick={() => setSelectedFolder(f as any)}>
                          <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${f.isActive ? "bg-primary/10" : "bg-muted"}`}>
                            <FolderOpen className={`h-5 w-5 ${f.isActive ? "text-primary" : "text-muted-foreground"}`} />
                          </div>
                          <div>
                            <p className="font-semibold text-sm">{f.name}</p>
                            {f.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{f.description}</p>}
                            <p className="text-xs text-muted-foreground mt-1">{f.materialCount} dosya</p>
                          </div>
                        </button>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <Badge variant={f.isActive ? "success" : "secondary"} className="text-[10px]">
                            {f.isActive ? "Aktif" : "Pasif"}
                          </Badge>
                          <button
                            onClick={() => toggleFolderMut.mutate({ id: f.id, isActive: !f.isActive })}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                            title={f.isActive ? "Pasife al" : "Aktif et"}>
                            {f.isActive ? <ToggleRight className="h-5 w-5 text-primary" /> : <ToggleLeft className="h-5 w-5" />}
                          </button>
                          <button onClick={() => { if (confirm(`"${f.name}" klasörünü ve tüm dosyaları silmek istediğinizden emin misiniz?`)) deleteFolderMut.mutate(f.id); }}
                            className="text-muted-foreground hover:text-destructive transition-colors">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Folder detail */}
      {selectedFolder && (
        <Card>
          <CardContent className="p-0">
            {!currentDetail ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full mr-2" /> Yükleniyor...
              </div>
            ) : currentDetail.materials.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-muted-foreground gap-3">
                <Upload className="h-12 w-12 opacity-20" />
                <p className="text-sm">Bu klasörde henüz dosya yok</p>
                <Button size="sm" onClick={() => setIsUploadOpen(true)} className="gap-1.5">
                  <Upload className="h-4 w-4" /> İlk dosyayı yükle
                </Button>
              </div>
            ) : (
              <div className="divide-y">
                {currentDetail.materials.map(m => (
                  <div key={m.id} className={`flex items-center gap-4 px-4 py-3 hover:bg-muted/20 transition-colors ${!m.isActive ? "opacity-50" : ""}`}>
                    <div className="shrink-0">{fileIcon(m.fileType)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{m.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{m.fileName} {m.fileSize ? `· ${fileSize(m.fileSize)}` : ""}</p>
                    </div>
                    <Badge variant="outline" className="uppercase text-[10px] shrink-0">{m.fileType}</Badge>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <a href={`${API.replace("/api", "")}${m.fileUrl}`} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="ghost" className="h-7 px-2" title="İndir / Görüntüle">
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </a>
                      <Button size="sm" variant="ghost" className="h-7 px-2"
                        title={m.isActive ? "Pasife al" : "Aktif et"}
                        onClick={() => toggleMaterialMut.mutate({ id: m.id, isActive: !m.isActive })}>
                        {m.isActive ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5 text-muted-foreground" />}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:text-destructive"
                        onClick={() => { if (confirm("Bu dosyayı silmek istediğinizden emin misiniz?")) deleteMaterialMut.mutate(m.id); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── Create Folder Modal ─────────────────────────────────────────────── */}
      <Modal isOpen={isCreateFolderOpen} onClose={() => setIsCreateFolderOpen(false)} title="Yeni Klasör Oluştur">
        <form onSubmit={e => { e.preventDefault(); createFolderMut.mutate(folderForm); }} className="space-y-4">
          <div>
            <Label>Klasör Adı *</Label>
            <Input value={folderForm.name} onChange={e => setFolderForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Örn: B2 Gramer Kaynakları" />
          </div>
          <div>
            <Label>Açıklama</Label>
            <textarea value={folderForm.description} onChange={e => setFolderForm(f => ({ ...f, description: e.target.value }))}
              rows={2} placeholder="Klasör hakkında kısa açıklama..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none mt-1" />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" className="flex-1" disabled={createFolderMut.isPending}>
              {createFolderMut.isPending ? "Oluşturuluyor..." : "Oluştur"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setIsCreateFolderOpen(false)}>İptal</Button>
          </div>
        </form>
      </Modal>

      {/* ─── Upload Modal ────────────────────────────────────────────────────── */}
      <Modal isOpen={isUploadOpen} onClose={() => { setIsUploadOpen(false); setSelectedFile(null); setUploadTitle(""); }}
        title={`Dosya Yükle — ${selectedFolder?.name}`}>
        <form onSubmit={handleUpload} className="space-y-4">
          <div>
            <Label>Başlık *</Label>
            <Input value={uploadTitle} onChange={e => setUploadTitle(e.target.value)}
              placeholder="Dosya başlığı..." />
          </div>
          <div>
            <Label>Dosya * <span className="text-xs text-muted-foreground ml-1">(PDF, PPTX, DOCX, PNG, JPEG — max 50 MB)</span></Label>
            <div
              className="mt-1 border-2 border-dashed border-input rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) { setSelectedFile(f); if (!uploadTitle) setUploadTitle(f.name.replace(/\.[^.]+$/, "")); } }}>
              <input ref={fileInputRef} type="file" className="hidden"
                accept=".pdf,.pptx,.ppt,.docx,.doc,.png,.jpg,.jpeg,.gif,.webp"
                onChange={e => { const f = e.target.files?.[0]; if (f) { setSelectedFile(f); if (!uploadTitle) setUploadTitle(f.name.replace(/\.[^.]+$/, "")); } }} />
              {selectedFile ? (
                <div className="flex items-center justify-center gap-3">
                  {fileIcon(selectedFile.name.split(".").pop() || "")}
                  <div className="text-left">
                    <p className="text-sm font-medium">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">{fileSize(selectedFile.size)}</p>
                  </div>
                  <button type="button" onClick={e => { e.stopPropagation(); setSelectedFile(null); }}
                    className="ml-2 text-muted-foreground hover:text-destructive">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="text-muted-foreground">
                  <Upload className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Sürükle & bırak veya <span className="text-primary underline">dosya seç</span></p>
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" className="flex-1" disabled={!selectedFile || !uploadTitle || isUploading}>
              {isUploading ? "Yükleniyor..." : "Yükle"}
            </Button>
            <Button type="button" variant="outline" onClick={() => { setIsUploadOpen(false); setSelectedFile(null); setUploadTitle(""); }}>İptal</Button>
          </div>
        </form>
      </Modal>

      {/* ─── Student Access Modal ────────────────────────────────────────────── */}
      <Modal isOpen={isAccessOpen} onClose={() => { setIsAccessOpen(false); setStudentSearch(""); }}
        title={`Öğrenci Erişimi — ${selectedFolder?.name}`}>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Hangi öğrencilerin bu klasörü görebileceğini kontrol edin. Yeşil = Erişim var, Kırmızı = Erişim yok.</p>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Öğrenci ara..." value={studentSearch} onChange={e => setStudentSearch(e.target.value)} />
          </div>
          <div className="max-h-80 overflow-y-auto space-y-1.5 pr-1 border rounded-lg p-2">
            {filteredStudents.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-6">Öğrenci bulunamadı</p>
            ) : filteredStudents.map(s => (
              <div key={s.id} className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-muted/20 transition-colors">
                <div>
                  <p className="text-sm font-medium">{s.firstName} {s.lastName}</p>
                  <p className="text-xs text-muted-foreground">{s.email}</p>
                </div>
                <button onClick={() => toggleAccessMut.mutate({ studentId: s.id, hasAccess: !s.hasAccess })}
                  className="transition-colors shrink-0" title={s.hasAccess ? "Erişimi kapat" : "Erişimi aç"}>
                  {s.hasAccess
                    ? <ToggleRight className="h-7 w-7 text-primary" />
                    : <ToggleLeft className="h-7 w-7 text-muted-foreground" />
                  }
                </button>
              </div>
            ))}
          </div>
          <Button variant="outline" className="w-full" onClick={() => { setIsAccessOpen(false); setStudentSearch(""); }}>Kapat</Button>
        </div>
      </Modal>
    </div>
  );
}
