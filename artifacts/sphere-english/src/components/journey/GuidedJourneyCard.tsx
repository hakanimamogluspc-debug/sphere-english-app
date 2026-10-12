import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { CheckCircle2, Circle, Sparkles, ArrowRight } from "lucide-react";

/**
 * GuidedJourneyCard — Post-placement 7 günlük plan.
 *
 * Dashboard'da prominent kart. API: GET /api/journey/today
 * Her gün 1-3 görev; kullanıcı aktivite log'larından completion türetilir.
 *
 * Hem desktop hem mobile için responsive — tailwind.
 */

interface Task {
  id: string;
  label: string;
  href: string;
  icon: string;
  completed: boolean;
}

interface JourneyToday {
  dayNumber: number;
  totalDays: number;
  isCompletedWeek: boolean;
  title: string;
  subtitle: string;
  tasks: Task[];
  allDone: boolean;
  placementCompleted: boolean;
}

async function fetchJourney(): Promise<JourneyToday> {
  const token = localStorage.getItem("sphere_token");
  const res = await fetch("/api/journey/today", {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Journey yüklenemedi");
  return res.json();
}

export default function GuidedJourneyCard() {
  const { data, isLoading } = useQuery<JourneyToday>({
    queryKey: ["/api/journey/today"],
    queryFn: fetchJourney,
  });

  if (isLoading || !data) return null;

  // Haftalık plan tamamlandıysa küçük bir "başardın" mesajı göster
  if (data.isCompletedWeek) {
    return (
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-5 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-lg">Başlangıç haftanı tamamladın 🎉</p>
            <p className="text-sm text-white/85">Günlük tekrar ve pratik yapmaya devam et.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white border-2 border-primary/20 shadow-sm overflow-hidden">
      {/* Header gradient */}
      <div className="bg-gradient-to-r from-primary to-primary/80 text-white px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wider uppercase opacity-80">
              Başlangıç Planı · {data.dayNumber} / {data.totalDays}
            </p>
            <p className="font-bold text-lg mt-0.5 truncate">{data.title}</p>
          </div>
          {/* Day pills */}
          <div className="flex gap-1 shrink-0">
            {Array.from({ length: data.totalDays }, (_, i) => (
              <div
                key={i}
                className={`h-2 w-2 rounded-full ${
                  i + 1 < data.dayNumber ? "bg-white/80"
                  : i + 1 === data.dayNumber ? "bg-white"
                  : "bg-white/30"
                }`}
              />
            ))}
          </div>
        </div>
        <p className="text-sm text-white/90 mt-1">{data.subtitle}</p>
      </div>

      {/* Tasks */}
      <div className="p-4 space-y-2">
        {data.tasks.map((task) => (
          <Link key={task.id} href={task.href}>
            <div
              className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
                task.completed
                  ? "border-green-200 bg-green-50 hover:bg-green-100"
                  : "border-border hover:border-primary/40 hover:bg-primary/5"
              }`}
            >
              <div className="text-2xl shrink-0">{task.icon}</div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${task.completed ? "text-green-700 line-through" : "text-foreground"}`}>
                  {task.label}
                </p>
              </div>
              {task.completed ? (
                <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
              ) : (
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
            </div>
          </Link>
        ))}

        {data.allDone && (
          <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-green-600 shrink-0" />
            <p className="text-sm text-green-700">
              Bugünkü planı tamamladın! Yarın yeni görevler bekliyor.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
