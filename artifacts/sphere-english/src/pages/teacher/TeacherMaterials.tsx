import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, Button, Input, Label, Modal, Badge } from "@/components/ui/core";
import { useToast } from "@/hooks/use-toast";
import {
  FolderOpen, Plus, Trash2, Upload, FileText, Eye, EyeOff, File, ImageIcon, ChevronRight, ArrowLeft, X
} from "lucide-react";
import { motion } from "framer-motion";
import { API } from "@/lib/api-url";

interface Folder { id: number; name: string; description: string | null; isActive: boolean; materialCount: number; creatorName: string | null; }
interface Material { id: number; title: string; fileName: string; fileUrl: string; fileType: string; fileSize: number | null; isActive: boolean; uploaderName: string | null; }
interface FolderDetail extends Folder { materials: Material[]; }

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
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function TeacherMaterials() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFolder, setSelectedFolder] = useState<FolderDetail | null>(null);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [folderForm, setFolderForm] = useState({ name: "", description: "" });

  const { data: folders = [], isLoading } = useQuery<Folder[]>({
    queryKey: ["/api/materials/folders"],
    queryFn: () => api(`${API}/materials/folders`),
  });

  const { data: folderDetail, refetch: refetchDetail } = useQuery<FolderDetail>({
    queryKey: ["/api/materials/folders", selectedFolder?.id],
    queryFn: () => api(`${API}/materials/folders/${selectedFolder!.id}`),
    enabled: !!selectedFolder,
  });

  const createFolderMut = useMutation({
    mutationFn: (body: object) => api(`${API}/materials/folders`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
    }),
    onSuccess: () => { toast({ title: "Klasör oluşturuldu" }); qc.invalidateQueries({ queryKey: ["/api/materials/folders"] }); setIsCreateFolderOpen(false); setFolderForm({ name: "", description: "" }); },
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
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Yükleme başarısız"); }
      toast({ title: "Dosya yüklendi" });
      setIsUploadOpen(false); setSelectedFile(null); setUploadTitle("");
      refetchDetail(); qc.invalidateQueries({ queryKey: ["/api/materials/folders"] });
    } catch (e: any) {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    } finally { setIsUploading(false); }
  }

  const currentDetail = folderDetail && folderDetail.id === selectedFolder?.id ? folderDetail : null;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FolderOpen className="h-6 w-6 text-primary" />
            {selectedFolder ? (
              <span className="flex items-center gap-2">
                <button onClick={() => setSelectedFolder(null)} className="text-muted-foreground hover:text-foreground">Materyaller</button>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                {selectedFolder.name}
              </span>
            ) : "Materyaller"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Ders materyallerinizi yönetin</p>
        </div>
        <div className="flex gap-2">
          {selectedFolder ? (
            <>
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

      {!selectedFolder && (
        isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <Card key={i} className="h-28 animate-pulse bg-secondary/50" />)}
          </div>
        ) : folders.length === 0 ? (
          <Card><CardContent className="py-16 text-center text-muted-foreground">
            <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p>Henüz materyal klasörünüz yok</p>
          </CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {folders.map(f => (
              <motion.div key={f.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="cursor-pointer hover:shadow-md transition-all border-2 border-transparent"
                  onClick={() => setSelectedFolder(f as any)}>
                  <CardContent className="p-4 flex items-start gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <FolderOpen className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{f.name}</p>
                      {f.description && <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{f.description}</p>}
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs text-muted-foreground">{f.materialCount} dosya</p>
                        <Badge variant={f.isActive ? "success" : "secondary"} className="text-[10px]">
                          {f.isActive ? "Aktif" : "Pasif"}
                        </Badge>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )
      )}

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
                    <div className="flex items-center gap-1 shrink-0">
                      <a href={`${API.replace("/api", "")}${m.fileUrl}`} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="ghost" className="h-7 px-2"><Eye className="h-3.5 w-3.5" /></Button>
                      </a>
                      <Button size="sm" variant="ghost" className="h-7 px-2"
                        onClick={() => toggleMaterialMut.mutate({ id: m.id, isActive: !m.isActive })}>
                        {m.isActive ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5 text-muted-foreground" />}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:text-destructive"
                        onClick={() => { if (confirm("Dosyayı silmek istediğinizden emin misiniz?")) deleteMaterialMut.mutate(m.id); }}>
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

      {/* Create Folder Modal */}
      <Modal isOpen={isCreateFolderOpen} onClose={() => setIsCreateFolderOpen(false)} title="Yeni Klasör">
        <form onSubmit={e => { e.preventDefault(); createFolderMut.mutate(folderForm); }} className="space-y-4">
          <div>
            <Label>Klasör Adı *</Label>
            <Input value={folderForm.name} onChange={e => setFolderForm(f => ({ ...f, name: e.target.value }))} placeholder="Örn: Grammar Worksheets" />
          </div>
          <div>
            <Label>Açıklama</Label>
            <textarea value={folderForm.description} onChange={e => setFolderForm(f => ({ ...f, description: e.target.value }))} rows={2}
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

      {/* Upload Modal */}
      <Modal isOpen={isUploadOpen} onClose={() => { setIsUploadOpen(false); setSelectedFile(null); setUploadTitle(""); }}
        title={`Dosya Yükle — ${selectedFolder?.name}`}>
        <form onSubmit={handleUpload} className="space-y-4">
          <div>
            <Label>Başlık *</Label>
            <Input value={uploadTitle} onChange={e => setUploadTitle(e.target.value)} placeholder="Dosya başlığı..." />
          </div>
          <div>
            <Label>Dosya * <span className="text-xs text-muted-foreground ml-1">(PDF, PPTX, DOCX, PNG, JPEG — max 50 MB)</span></Label>
            <div className="mt-1 border-2 border-dashed border-input rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
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
                  <button type="button" onClick={e => { e.stopPropagation(); setSelectedFile(null); }} className="ml-2 text-muted-foreground hover:text-destructive">
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
    </div>
  );
}
