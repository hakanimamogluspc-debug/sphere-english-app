import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Toggle } from "@/components/ui/toggle";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Settings2, Users, BookOpen, Video, FileQuestion, Mic, PenLine, MessageCircle, LineChart, Award, FolderOpen, Brain, Gamepad2, Briefcase } from "lucide-react";

const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

function authOnly() {
  const token = localStorage.getItem("sphere_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

type FeatureSetting = {
  id: number;
  key: string;
  label: string;
  isEnabled: boolean;
  visibleTo: string[];
  category: string;
};

const MODULE_ICONS: Record<string, React.ElementType> = {
  "student-courses": BookOpen,
  "student-materials": FolderOpen,
  "student-live-classes": Video,
  "student-quizzes": FileQuestion,
  "student-speaking-club": Mic,
  "student-pronunciation-coach": Mic,
  "student-writing-coach": PenLine,
  "student-forum": MessageCircle,
  "student-progress": LineChart,
  "student-certificates": Award,
  "student-leaderboard": Users,
  "teacher-materials": FolderOpen,
  "teacher-live-classes": Video,
  "teacher-quizzes": FileQuestion,
  "teacher-speaking-club": Mic,
  "student-vocab-game": Gamepad2,
  "student-grammar-coach": Brain,
  "student-simulation-mode": Briefcase,
};

const ROLE_OPTIONS = [
  { value: "student",          label: "Tüm Öğrenciler",      color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "bireysel_ogrenci", label: "Bireysel Öğrenci",    color: "bg-cyan-100 text-cyan-700 border-cyan-200" },
  { value: "kurumsal_ogrenci", label: "Kurumsal Öğrenci",    color: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  { value: "teacher",          label: "Öğretmen",            color: "bg-purple-100 text-purple-700 border-purple-200" },
  { value: "admin",            label: "Admin",               color: "bg-orange-100 text-orange-700 border-orange-200" },
];

const CATEGORY_LABELS: Record<string, string> = {
  student: "Öğrenci Modülleri",
  teacher: "Öğretmen Modülleri",
  "ai-studio": "Sphere AI Studio",
};

function ModuleCard({ mod, onToggleEnabled, onToggleRole, saving }: {
  mod: FeatureSetting;
  onToggleEnabled: (key: string, val: boolean) => void;
  onToggleRole: (key: string, role: string, add: boolean) => void;
  saving: string | null;
}) {
  const Icon = MODULE_ICONS[mod.key] || Settings2;
  const isSaving = saving === mod.key;

  return (
    <div className={`rounded-xl border p-4 transition-all ${mod.isEnabled ? "bg-card border-border" : "bg-muted/40 border-dashed border-border opacity-70"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`p-2 rounded-lg shrink-0 ${mod.isEnabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
            <Icon size={18} />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{mod.label}</p>
            <p className="text-xs text-muted-foreground font-mono">{mod.key}</p>
          </div>
        </div>

        <button
          onClick={() => onToggleEnabled(mod.key, !mod.isEnabled)}
          disabled={isSaving}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
            mod.isEnabled ? "bg-primary" : "bg-input"
          } ${isSaving ? "opacity-50" : ""}`}
        >
          <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition-transform ${mod.isEnabled ? "translate-x-5" : "translate-x-0"}`} />
        </button>
      </div>

      {mod.isEnabled && (
        <div className="mt-3 pt-3 border-t border-border/50">
          <p className="text-xs font-medium text-muted-foreground mb-2">Kimlere görünür:</p>
          <div className="flex flex-wrap gap-2">
            {ROLE_OPTIONS.map(role => {
              const active = mod.visibleTo.includes(role.value);
              return (
                <button
                  key={role.value}
                  onClick={() => onToggleRole(mod.key, role.value, !active)}
                  disabled={isSaving}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                    active
                      ? role.color
                      : "bg-transparent text-muted-foreground border-border hover:bg-muted"
                  } ${isSaving ? "opacity-50" : ""}`}
                >
                  {active ? "✓ " : ""}{role.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminModules() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [saving, setSaving] = useState<string | null>(null);

  const { data: modules = [], isLoading } = useQuery<FeatureSetting[]>({
    queryKey: ["/api/admin/feature-settings"],
    queryFn: () =>
      fetch(`${API}/admin/feature-settings`, { headers: authOnly() }).then(r => r.json()),
  });

  const patchMutation = useMutation({
    mutationFn: ({ key, body }: { key: string; body: Partial<FeatureSetting> }) =>
      fetch(`${API}/admin/feature-settings/${key}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authOnly() },
        body: JSON.stringify(body),
      }).then(r => {
        if (!r.ok) throw new Error("Güncelleme başarısız");
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/feature-settings"] });
      qc.invalidateQueries({ queryKey: ["/api/feature-settings"] });
      setSaving(null);
    },
    onError: (e: any) => {
      setSaving(null);
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    },
  });

  function handleToggleEnabled(key: string, val: boolean) {
    setSaving(key);
    patchMutation.mutate({ key, body: { isEnabled: val } });
  }

  function handleToggleRole(key: string, role: string, add: boolean) {
    const mod = modules.find(m => m.key === key);
    if (!mod) return;
    const visibleTo = add
      ? [...mod.visibleTo, role]
      : mod.visibleTo.filter(r => r !== role);
    setSaving(key);
    patchMutation.mutate({ key, body: { visibleTo } });
  }

  const categories = ["student", "teacher", "ai-studio"];

  const enabledCount = modules.filter(m => m.isEnabled).length;
  const totalCount = modules.length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display">Modül Yönetimi</h1>
          <p className="text-muted-foreground mt-1">
            Hangi özelliklerin aktif olduğunu ve kimlerin görebileceğini buradan ayarlayabilirsiniz.
          </p>
        </div>
        <Badge variant="secondary" className="text-sm px-3 py-1.5">
          {enabledCount}/{totalCount} Aktif
        </Badge>
      </div>

      <div className="rounded-xl border border-border bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900 p-4 text-sm text-amber-800 dark:text-amber-200">
        <strong>Not:</strong> Kontrol Paneli, Kurslar, Öğrenciler, Mesajlar gibi temel sayfalar her zaman görünür —
        yalnızca ek modüller yönetilebilir.
      </div>

      {categories.map(cat => {
        const catModules = modules.filter(m => m.category === cat);
        if (!catModules.length) return null;
        return (
          <div key={cat}>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              {CATEGORY_LABELS[cat] || cat}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {catModules.map(mod => (
                <ModuleCard
                  key={mod.key}
                  mod={mod}
                  onToggleEnabled={handleToggleEnabled}
                  onToggleRole={handleToggleRole}
                  saving={saving}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
