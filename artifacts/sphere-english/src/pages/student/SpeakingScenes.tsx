import { useEffect, useState } from "react";
import { Link } from "wouter";
import { API } from "@/lib/api-url";
import { Loader2, Lock, Mic, Clock, TrendingUp, Sparkles } from "lucide-react";

/**
 * Speaking Role-Play sahneleri liste sayfası.
 * Free tier: sadece izin verilen kategoriler + günlük limit gösterge.
 * Pro tier: hepsi açık, sınırsız.
 */

interface Scene {
  id: number;
  slug: string;
  category: string;
  title_en: string;
  title_tr: string;
  description_tr: string;
  user_role_tr: string | null;
  counterpart_role_tr: string | null;
  difficulty: "A2" | "B1" | "B2" | "C1";
  min_plan: "free" | "pro";
  avg_duration_min: number;
  sort_order: number;
  locked: boolean;
  lock_reason: "pro_only" | "category_locked" | null;
}

interface ListResponse {
  tier: "free" | "pro";
  dailyRemaining: number | null;
  dailyLimit: number | null;
  scenes: Scene[];
}

const CATEGORY_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  general_business: { label: "Genel İş", icon: "💼", color: "bg-blue-100 text-blue-800" },
  meetings: { label: "Toplantılar", icon: "🗓️", color: "bg-indigo-100 text-indigo-800" },
  presentations: { label: "Sunumlar", icon: "🎤", color: "bg-purple-100 text-purple-800" },
  negotiation: { label: "Müzakere", icon: "🤝", color: "bg-orange-100 text-orange-800" },
  sales: { label: "Satış", icon: "📈", color: "bg-emerald-100 text-emerald-800" },
  phone_calls: { label: "Telefon", icon: "📞", color: "bg-cyan-100 text-cyan-800" },
  tech: { label: "Teknoloji", icon: "💻", color: "bg-slate-100 text-slate-800" },
  hr: { label: "İnsan Kaynakları", icon: "👥", color: "bg-pink-100 text-pink-800" },
  finance: { label: "Finans", icon: "💰", color: "bg-yellow-100 text-yellow-800" },
  healthcare: { label: "Sağlık", icon: "🏥", color: "bg-red-100 text-red-800" },
};

const DIFFICULTY_COLORS: Record<string, string> = {
  A2: "bg-green-100 text-green-800",
  B1: "bg-blue-100 text-blue-800",
  B2: "bg-orange-100 text-orange-800",
  C1: "bg-red-100 text-red-800",
};

export default function SpeakingScenes() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | "all">("all");

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const token = localStorage.getItem("sphere_token");
        const r = await fetch(`${API}/scenes`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const d = (await r.json()) as ListResponse;
        if (!cancel) setData(d);
      } catch (e: any) {
        if (!cancel) setError(e?.message || "Sahneler yüklenemedi");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto mt-12 p-6 bg-red-50 border border-red-200 rounded-xl text-red-900">
        <p className="font-semibold mb-1">Hata</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  const scenes = data?.scenes ?? [];
  const categories = Array.from(new Set(scenes.map((s) => s.category)));
  const filtered =
    selectedCategory === "all"
      ? scenes
      : scenes.filter((s) => s.category === selectedCategory);

  return (
    <div className="max-w-6xl mx-auto px-4 lg:px-8 py-8">
      {/* Başlık */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
            <Mic className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900">
            Konuşma Sahneleri
          </h1>
        </div>
        <p className="text-slate-600 max-w-2xl">
          Gerçek iş senaryolarında AI ile konuşarak pratik yap. Her turda söyledin
          hedef cümle skorlanır — telaffuz, akıcılık, doğruluk ve tamlık.
        </p>
      </div>

      {/* Abonelik kaldırıldı — tier banner artık gösterilmiyor */}

      {/* Kategori filtresi */}
      <div className="mb-6 flex gap-2 flex-wrap">
        <button
          onClick={() => setSelectedCategory("all")}
          className={`px-4 py-2 rounded-full text-sm font-semibold transition ${
            selectedCategory === "all"
              ? "bg-slate-900 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          Tümü ({scenes.length})
        </button>
        {categories.map((cat) => {
          const meta = CATEGORY_LABELS[cat] || {
            label: cat,
            icon: "📌",
            color: "bg-slate-100",
          };
          const count = scenes.filter((s) => s.category === cat).length;
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition flex items-center gap-1.5 ${
                selectedCategory === cat
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              <span>{meta.icon}</span>
              {meta.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Sahne grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          Bu kategoride sahne yok.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((scene) => (
            <SceneCard key={scene.id} scene={scene} />
          ))}
        </div>
      )}
    </div>
  );
}

function SceneCard({ scene }: { scene: Scene }) {
  const catMeta =
    CATEGORY_LABELS[scene.category] || {
      label: scene.category,
      icon: "📌",
      color: "bg-slate-100 text-slate-800",
    };
  const diffColor = DIFFICULTY_COLORS[scene.difficulty] || "bg-slate-100 text-slate-800";

  const cardContent = (
    <div
      className={`h-full flex flex-col p-5 rounded-2xl border transition-all ${
        scene.locked
          ? "bg-slate-50 border-slate-200 opacity-70"
          : "bg-white border-slate-200 hover:border-cyan-400 hover:shadow-lg hover:-translate-y-0.5"
      }`}
    >
      {/* Üst rozetler */}
      <div className="flex items-center justify-between mb-3">
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold ${catMeta.color}`}>
          <span>{catMeta.icon}</span> {catMeta.label}
        </span>
        <div className="flex items-center gap-1">
          <span className={`px-2 py-1 rounded-md text-[10px] font-bold ${diffColor}`}>
            {scene.difficulty}
          </span>
          {scene.min_plan === "pro" && (
            <span className="px-2 py-1 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800">
              PRO
            </span>
          )}
        </div>
      </div>

      {/* Başlık + açıklama */}
      <h3 className="text-lg font-bold text-slate-900 mb-1.5 leading-snug">
        {scene.title_tr}
      </h3>
      <p className="text-xs text-slate-500 mb-3 italic">{scene.title_en}</p>
      <p className="text-sm text-slate-700 mb-4 line-clamp-3 flex-1">
        {scene.description_tr}
      </p>

      {/* Roller */}
      {(scene.user_role_tr || scene.counterpart_role_tr) && (
        <div className="mb-4 p-2.5 bg-slate-50 rounded-lg text-xs text-slate-600">
          {scene.user_role_tr && (
            <div>
              <span className="font-semibold">Sen:</span> {scene.user_role_tr}
            </div>
          )}
          {scene.counterpart_role_tr && (
            <div>
              <span className="font-semibold">AI:</span> {scene.counterpart_role_tr}
            </div>
          )}
        </div>
      )}

      {/* Alt bilgi + CTA */}
      <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-between">
        <span className="text-xs text-slate-500 inline-flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" /> ~{scene.avg_duration_min} dk
        </span>
        {scene.locked ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 text-slate-500 text-xs font-semibold rounded-lg">
            <Lock className="w-3.5 h-3.5" />
            {scene.lock_reason === "pro_only" ? "Pro" : "Kilitli"}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500 text-white text-xs font-bold rounded-lg group-hover:bg-cyan-600 transition">
            Başla →
          </span>
        )}
      </div>
    </div>
  );

  if (scene.locked) {
    return <div className="group">{cardContent}</div>;
  }
  return (
    <Link href={`/student/speaking-scenes/${scene.slug}`} className="group block">
      {cardContent}
    </Link>
  );
}
