import { useEffect, useState } from "react";
import { API } from "@/lib/api-url";
import {
  ModuleShell, LoadingState, ErrorState, Toast, useToast, MobileModuleIntro,
  colors, fonts, radius,
} from "@/components/mobile";
import {
  FolderOpen, FileText, File, Image as ImageIcon,
  Download, ChevronRight, ArrowLeft, Search,
} from "lucide-react";

/**
 * /m/pratik/materyaller — Materyallerim (öğretmen paylaşımları)
 */

const TOKEN_KEY = "sphere_token";

interface Folder {
  id: number; name: string; description: string | null;
  materialCount: number; isActive: boolean;
}
interface Material {
  id: number; title: string; fileName: string;
  fileUrl: string; fileType: string; fileSize: number | null;
  isActive: boolean;
}
interface FolderDetail extends Folder { materials: Material[]; }

async function apiFetch(path: string) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function fileMeta(type: string) {
  const t = type.toLowerCase();
  if (t === "pdf")  return { Icon: FileText, color: "#dc2626", bg: "#fee2e2" };
  if (t === "pptx") return { Icon: File,     color: "#ea580c", bg: "#ffedd5" };
  if (t === "docx") return { Icon: FileText, color: "#2563eb", bg: "#dbeafe" };
  if (t === "xlsx") return { Icon: File,     color: "#16a34a", bg: "#dcfce7" };
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(t))
    return { Icon: ImageIcon, color: "#16a34a", bg: "#dcfce7" };
  return { Icon: File, color: colors.neutral, bg: colors.navy50 };
}

function formatSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MobileMaterials() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [detail, setDetail] = useState<FolderDetail | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const { toast, show: showToast, hide: hideToast } = useToast();

  useEffect(() => { loadFolders(); }, []);
  useEffect(() => {
    if (selectedFolderId != null) loadDetail(selectedFolderId);
    else setDetail(null);
  }, [selectedFolderId]);

  const loadFolders = async () => {
    setLoadingList(true); setError(null);
    try {
      const d = await apiFetch("/materials/folders");
      setFolders(Array.isArray(d) ? d : d?.folders || []);
    } catch (e: any) {
      setError(e?.message || "Klasörler yüklenemedi");
    } finally {
      setLoadingList(false);
    }
  };

  const loadDetail = async (id: number) => {
    setLoadingDetail(true);
    try {
      const d = await apiFetch(`/materials/folders/${id}`);
      setDetail(d);
    } catch (e: any) {
      showToast(e?.message || "Materyaller yüklenemedi", "error");
    } finally {
      setLoadingDetail(false);
    }
  };

  const openFile = (m: Material) => {
    const base = API.replace(/\/api$/, "");
    const url = m.fileUrl.startsWith("http") ? m.fileUrl : `${base}${m.fileUrl}`;
    try { window.open(url, "_blank", "noopener,noreferrer"); }
    catch { window.location.href = url; }
  };

  // ─── Klasör detayı ─────────────────────
  if (selectedFolderId != null) {
    const folder = folders.find((f) => f.id === selectedFolderId);
    const filtered = (detail?.materials || []).filter((m) => {
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      return m.title.toLowerCase().includes(q) || m.fileName.toLowerCase().includes(q);
    });
    return (
      <ModuleShell
        title={folder?.name || "Klasör"}
        subtitle={detail ? `${detail.materials.length} dosya` : "Yükleniyor…"}
        rightAction={
          <button
            onClick={() => { setSelectedFolderId(null); setSearch(""); }}
            aria-label="Klasörler"
            style={{
              background: colors.navy50, border: "none",
              width: 36, height: 36, borderRadius: 18,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: colors.navy,
            }}
          >
            <ArrowLeft size={16} strokeWidth={2.5} />
          </button>
        }
      >
        {folder?.description && (
          <div style={{
            padding: 12, marginBottom: 16,
            background: colors.navy50, borderRadius: 12,
            fontSize: 13, color: colors.navy400, lineHeight: 1.5,
          }}>{folder.description}</div>
        )}

        {/* Arama */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "10px 14px", borderRadius: 12,
          border: `1px solid ${colors.navy100}`,
          background: colors.white, marginBottom: 16,
        }}>
          <Search size={16} color={colors.neutral} strokeWidth={2} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ara…"
            style={{
              flex: 1, border: "none", outline: "none",
              fontFamily: fonts.body, fontSize: 14,
              background: "transparent", color: colors.navy,
            }}
          />
        </div>

        {loadingDetail && !detail ? (
          <LoadingState compact messages={["Materyaller yükleniyor…"]} />
        ) : filtered.length === 0 ? (
          <div style={{
            padding: 40, textAlign: "center",
            color: colors.neutral, fontSize: 13,
          }}>
            <File size={32} color={colors.navy100} style={{ marginBottom: 12 }} />
            <div>{search ? "Aramanla eşleşen dosya yok" : "Bu klasör boş"}</div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {filtered.map((m) => {
              const meta = fileMeta(m.fileType);
              const Icon = meta.Icon;
              return (
                <button
                  key={m.id}
                  onClick={() => openFile(m)}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: 12, textAlign: "left",
                    background: colors.white,
                    border: `1px solid ${colors.navy100}`,
                    borderRadius: radius.card,
                    cursor: "pointer",
                  }}
                >
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: meta.bg, color: meta.color,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <Icon size={22} strokeWidth={2} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: fonts.heading, fontWeight: 700, fontSize: 14,
                      color: colors.navy, letterSpacing: "-0.01em",
                      lineHeight: 1.3, marginBottom: 2,
                      overflow: "hidden", textOverflow: "ellipsis",
                      display: "-webkit-box", WebkitLineClamp: 2 as any,
                      WebkitBoxOrient: "vertical" as any,
                    }}>{m.title}</div>
                    <div style={{
                      fontSize: 11, color: colors.neutral,
                      display: "flex", alignItems: "center", gap: 6,
                    }}>
                      <span style={{
                        fontFamily: fonts.heading, fontWeight: 700, fontSize: 9,
                        color: meta.color, textTransform: "uppercase", letterSpacing: "0.04em",
                        padding: "1px 6px", background: meta.bg, borderRadius: 4,
                      }}>{m.fileType}</span>
                      {m.fileSize && <span>· {formatSize(m.fileSize)}</span>}
                    </div>
                  </div>
                  <Download size={16} color={colors.navy400} strokeWidth={2} style={{ flexShrink: 0 }} />
                </button>
              );
            })}
          </div>
        )}

        <Toast {...toast} onClose={hideToast} />
      </ModuleShell>
    );
  }

  // ─── Klasör listesi ────────────────────
  return (
    <ModuleShell
      title="Materyallerim"
      subtitle={loadingList ? "Yükleniyor…" : `${folders.length} klasör`}
    >
      <MobileModuleIntro moduleKey="materials" />

      {loadingList ? (
        <LoadingState compact messages={["Klasörler yükleniyor…"]} />
      ) : error ? (
        <ErrorState title="Yüklenemedi" message={error} onRetry={loadFolders} />
      ) : folders.length === 0 ? (
        <div style={{
          padding: "48px 24px", textAlign: "center",
          color: colors.neutral,
        }}>
          <FolderOpen size={40} color={colors.navy100} style={{ marginBottom: 12 }} />
          <div style={{
            fontFamily: fonts.heading, fontWeight: 800, fontSize: 15,
            color: colors.navy, marginBottom: 6,
          }}>Henüz materyal yok</div>
          <div style={{ fontSize: 12, lineHeight: 1.5, maxWidth: 260, margin: "0 auto" }}>
            Öğretmenlerinin paylaştığı ders materyalleri burada görünecek.
          </div>
        </div>
      ) : (
        <>
          <div style={{
            fontFamily: fonts.heading, fontWeight: 700, fontSize: 11,
            color: colors.turqDeep, textTransform: "uppercase", letterSpacing: "0.06em",
            marginBottom: 6,
          }}>Ders materyalleri</div>
          <div style={{
            fontFamily: fonts.heading, fontWeight: 900, fontSize: 24,
            color: colors.navy, letterSpacing: "-0.02em", lineHeight: 1.2,
            marginBottom: 20,
          }}>
            Öğretmenlerinin{" "}
            <span style={{ position: "relative", display: "inline-block" }}>
              paylaştıkları
              <span style={{
                position: "absolute", left: 0, right: 0, bottom: 2,
                height: 10, background: colors.turq, opacity: 0.85,
                transform: "skewY(-1deg)", zIndex: -1,
              }} />
            </span>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {folders.map((f) => (
              <button
                key={f.id}
                onClick={() => setSelectedFolderId(f.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: 14, textAlign: "left",
                  background: colors.white,
                  border: `1px solid ${colors.navy100}`,
                  borderRadius: radius.card, cursor: "pointer",
                }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: colors.turq + "22", color: colors.turqDeep,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <FolderOpen size={20} strokeWidth={2} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: fonts.heading, fontWeight: 800, fontSize: 14,
                    color: colors.navy, letterSpacing: "-0.01em",
                    marginBottom: 2,
                  }}>{f.name}</div>
                  {f.description && (
                    <div style={{
                      fontSize: 11, color: colors.neutral,
                      lineHeight: 1.4, marginBottom: 4,
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>{f.description}</div>
                  )}
                  <div style={{
                    fontFamily: fonts.heading, fontWeight: 600, fontSize: 10,
                    color: colors.turqDeep, textTransform: "uppercase", letterSpacing: "0.04em",
                  }}>{f.materialCount} dosya</div>
                </div>
                <ChevronRight size={16} color={colors.navy400} strokeWidth={2} />
              </button>
            ))}
          </div>
        </>
      )}

      <Toast {...toast} onClose={hideToast} />
    </ModuleShell>
  );
}
