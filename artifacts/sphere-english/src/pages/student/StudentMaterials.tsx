import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/core";
import { FolderOpen, FileText, File, ImageIcon, Download, ChevronRight, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { API } from "@/lib/api-url";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface Folder { id: number; name: string; description: string | null; materialCount: number; isActive: boolean; }
interface Material { id: number; title: string; fileName: string; fileUrl: string; fileType: string; fileSize: number | null; isActive: boolean; }
interface FolderDetail extends Folder { materials: Material[]; }

// ─── Helpers ──────────────────────────────────────────────────────────────────
function authHeaders() { return { Authorization: `Bearer ${localStorage.getItem("sphere_token")}` }; }

async function apiFetch(url: string) {
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error("Hata");
  return res.json();
}

function fileIcon(type: string, size = "h-8 w-8") {
  if (type === "pdf") return <FileText className={`${size} text-red-500`} />;
  if (type === "pptx") return <File className={`${size} text-orange-500`} />;
  if (type === "docx") return <FileText className={`${size} text-blue-500`} />;
  if (["png", "jpeg", "jpg", "gif", "webp"].includes(type)) return <ImageIcon className={`${size} text-green-500`} />;
  return <File className={`${size} text-muted-foreground`} />;
}

function fileSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileTypeBg(type: string) {
  if (type === "pdf") return "bg-red-50 border-red-100";
  if (type === "pptx") return "bg-orange-50 border-orange-100";
  if (type === "docx") return "bg-blue-50 border-blue-100";
  if (["png", "jpeg", "jpg", "gif", "webp"].includes(type)) return "bg-green-50 border-green-100";
  return "bg-muted/30 border-border";
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function StudentMaterials() {
  const [selectedFolder, setSelectedFolder] = useState<FolderDetail | null>(null);

  const { data: folders = [], isLoading } = useQuery<Folder[]>({
    queryKey: ["/api/materials/folders"],
    queryFn: () => apiFetch(`${API}/materials/folders`),
  });

  const { data: folderDetail } = useQuery<FolderDetail>({
    queryKey: ["/api/materials/folders", selectedFolder?.id],
    queryFn: () => apiFetch(`${API}/materials/folders/${selectedFolder!.id}`),
    enabled: !!selectedFolder,
  });

  const currentDetail = folderDetail && folderDetail.id === selectedFolder?.id ? folderDetail : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2 text-foreground">
          <FolderOpen className="h-6 w-6 text-primary" />
          {selectedFolder ? (
            <span className="flex items-center gap-2">
              <button onClick={() => setSelectedFolder(null)}
                className="text-muted-foreground hover:text-foreground transition-colors">
                Materyallerim
              </button>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              {selectedFolder.name}
            </span>
          ) : "Materyallerim"}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {selectedFolder
            ? "Dosyaları görüntüleyin ve indirin"
            : "Öğretmenlerinizin paylaştığı ders materyallerine erişin"}
        </p>
      </div>

      {/* Folder list */}
      {!selectedFolder && (
        <>
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => <Card key={i} className="h-28 animate-pulse bg-secondary/50" />)}
            </div>
          ) : folders.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center text-muted-foreground">
                <FolderOpen className="h-14 w-14 mx-auto mb-3 opacity-20" />
                <p className="font-medium">Henüz paylaşılan materyal yok</p>
                <p className="text-sm mt-1">Öğretmenleriniz materyal paylaştığında burada görünecek.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {folders.map(f => (
                <motion.div key={f.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <Card className="cursor-pointer hover:shadow-md transition-all border-2 border-transparent hover:border-primary/20"
                    onClick={() => setSelectedFolder(f as any)}>
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <FolderOpen className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{f.name}</p>
                        {f.description && <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{f.description}</p>}
                        <p className="text-xs text-muted-foreground mt-1">{f.materialCount} dosya</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
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
        <>
          <button onClick={() => setSelectedFolder(null)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" /> Tüm klasörler
          </button>

          {!currentDetail ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" /> Yükleniyor...
            </div>
          ) : currentDetail.materials.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <File className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>Bu klasörde henüz materyal yok</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {currentDetail.materials.map(m => (
                <motion.div key={m.id} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
                  <a
                    href={`${API.replace("/api", "")}${m.fileUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block group">
                    <Card className={`border-2 hover:shadow-md transition-all group-hover:border-primary/30 ${fileTypeBg(m.fileType)}`}>
                      <CardContent className="p-5 flex flex-col items-center text-center gap-3">
                        <div className="h-14 w-14 rounded-2xl bg-white shadow-sm flex items-center justify-center">
                          {fileIcon(m.fileType, "h-7 w-7")}
                        </div>
                        <div className="w-full">
                          <p className="text-sm font-semibold line-clamp-2 leading-snug">{m.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{m.fileName}</p>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="uppercase font-medium">{m.fileType}</span>
                          {m.fileSize && <span>· {fileSize(m.fileSize)}</span>}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-primary font-medium group-hover:underline">
                          <Download className="h-3.5 w-3.5" /> Görüntüle / İndir
                        </div>
                      </CardContent>
                    </Card>
                  </a>
                </motion.div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
