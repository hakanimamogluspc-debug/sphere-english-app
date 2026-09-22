import { useEffect, useState } from "react";
import { Link } from "wouter";
import { API } from "@/lib/api-url";
import {
  Sparkles,
  Clock,
  ArrowRight,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Rocket,
} from "lucide-react";

/**
 * TodayTaskCard — Dashboard'un ana odak noktası.
 *
 * Retention için kritik: Kullanıcı sisteme girince 15 modül arasında
 * paralize olmadan TEK bir kişisel görev görür.
 *
 * Backend: GET /student/today-task — kullanıcı seviye + sektör + hedefine göre
 * her gün 1 mini görev seçer, DB'de cache'ler.
 */

const TOKEN_KEY = "sphere_token";

interface TodayTask {
  type: string;
  title_tr: string;
  description_tr: string;
  cta_label_tr: string;
  href: string;
  duration_min: number;
  level: string;
  sector?: string;
  goal?: string;
}

interface TodayTaskResponse {
  ok: boolean;
  task: TodayTask;
  taskId: number;
  completed: boolean;
}

async function apiFetch(path: string, opts: RequestInit = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.error || `HTTP ${res.status}`);
  return data;
}

export default function TodayTaskCard() {
  const [data, setData] = useState<TodayTaskResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [skipping, setSkipping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await apiFetch("/student/today-task");
      setData(d);
    } catch (e: any) {
      setError(e?.message ?? "Görev yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSkip = async () => {
    setSkipping(true);
    try {
      await apiFetch("/student/today-task/skip", { method: "POST" });
      await load(); // yeni görev üret
    } catch (e: any) {
      setError(e?.message ?? "Atlanamadı");
    } finally {
      setSkipping(false);
    }
  };

  const handleStart = async () => {
    // Complete olarak işaretlemiyoruz — modül içinde tamamlayacak
    // Ama görev tıklama analytics'i için ileride log'lanabilir
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-sky-50 p-6 flex items-center justify-center min-h-[160px]">
        <Loader2 className="animate-spin text-emerald-500" size={24} />
      </div>
    );
  }

  if (error || !data?.task) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <div className="flex items-center gap-2 text-amber-800 text-sm">
          <RefreshCw size={16} />
          <span>{error ?? "Görev alınamadı"}</span>
          <button
            onClick={load}
            className="ml-auto text-xs font-semibold text-amber-900 hover:underline"
          >
            Tekrar dene
          </button>
        </div>
      </div>
    );
  }

  const { task, completed } = data;

  if (completed) {
    return (
      <div className="rounded-2xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 via-emerald-50 to-sky-50 p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shrink-0">
            <CheckCircle2 className="text-white" size={26} strokeWidth={2.5} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-extrabold text-emerald-700 tracking-wider uppercase">
                🎉 Bugün tamamlandı
              </span>
            </div>
            <h3 className="text-lg font-extrabold text-slate-900 mb-1">
              Aferin! Bugünkü görevini tamamladın
            </h3>
            <p className="text-sm text-slate-600">
              Yarın yeni bir kişisel görev seninle. Streak'ini korudun 🔥
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-sky-50 p-6 shadow-md hover:shadow-lg transition-shadow">
      <div className="flex items-start gap-4 mb-5">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-sky-500 flex items-center justify-center shadow-lg shrink-0">
          <Sparkles className="text-white" size={24} strokeWidth={2.2} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold tracking-wider uppercase">
              <Rocket size={10} /> Bugün için 1 iş
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600 text-[10px] font-bold tracking-wider uppercase">
              <Clock size={10} /> {task.duration_min} dk
            </span>
            {task.level && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600 text-[10px] font-bold tracking-wider uppercase">
                Seviyene özel · {task.level}
              </span>
            )}
          </div>
          <h3 className="text-xl font-extrabold text-slate-900 leading-tight mb-1.5">
            {task.title_tr}
          </h3>
          <p className="text-sm text-slate-600 leading-relaxed">{task.description_tr}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Link
          href={task.href}
          onClick={handleStart}
          className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-bold text-sm shadow-md hover:shadow-xl transition-all"
        >
          {task.cta_label_tr}
          <ArrowRight size={16} />
        </Link>
        <button
          onClick={handleSkip}
          disabled={skipping}
          className="text-xs text-slate-500 hover:text-slate-700 font-semibold px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-40"
          title="Bugünlük atla — yeni görev seçilir"
        >
          {skipping ? "…" : "Atla"}
        </button>
      </div>
    </div>
  );
}
