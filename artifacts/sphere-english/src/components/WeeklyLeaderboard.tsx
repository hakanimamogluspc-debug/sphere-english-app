import { useEffect, useState } from "react";
import { API } from "@/lib/api-url";
import { Trophy, Medal, TrendingUp, Loader2, Flame } from "lucide-react";

/**
 * WeeklyLeaderboard — Kullanıcının seviye + sektör kohortundaki sıralaması.
 *
 * Retention için sosyal baskı yaratır — "benim seviyemdeki 20 kişi
 * içinde ben kaçıncıyım" hissi motivasyon oluşturur.
 */

const TOKEN_KEY = "sphere_token";

interface LeaderboardEntry {
  rank: number;
  userId: number;
  studentNumber: string;
  totalPoints: number;
  streak: number;
  isMe: boolean;
}

interface LeaderboardResponse {
  cohort: { level: string | null; sector: string | null };
  leaderboard: LeaderboardEntry[];
}

const SECTOR_LABELS: Record<string, string> = {
  finance: "Finans",
  tech: "Teknoloji",
  manufacturing: "Üretim",
  consulting: "Danışmanlık",
  healthcare: "Sağlık",
  hospitality: "Turizm",
  hr: "İK",
  sales: "Satış",
  legal: "Hukuk",
  education: "Eğitim",
  other: "Diğer",
};

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

function medalFor(rank: number) {
  if (rank === 1) return { color: "text-amber-500", bg: "bg-amber-100", icon: "🥇" };
  if (rank === 2) return { color: "text-slate-500", bg: "bg-slate-100", icon: "🥈" };
  if (rank === 3) return { color: "text-orange-500", bg: "bg-orange-100", icon: "🥉" };
  return null;
}

export default function WeeklyLeaderboard() {
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/student/leaderboard/weekly")
      .then(setData)
      .catch((e) => console.warn("[Leaderboard] hata:", e?.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center justify-center min-h-[120px]">
        <Loader2 className="animate-spin text-slate-400" size={20} />
      </div>
    );
  }

  if (!data || data.leaderboard.length < 2) {
    return null; // yeterli veri yok
  }

  const me = data.leaderboard.find((e) => e.isMe);
  const sectorLabel = data.cohort.sector ? SECTOR_LABELS[data.cohort.sector] ?? data.cohort.sector : null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Trophy className="text-amber-500" size={18} />
          <h3 className="font-extrabold text-slate-900 text-sm">Haftalık Sıralama</h3>
        </div>
        <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
          {data.cohort.level} {sectorLabel ? `· ${sectorLabel}` : ""}
        </div>
      </div>

      {me && (
        <div className="mb-3 flex items-center gap-3 px-3 py-2 rounded-lg bg-gradient-to-r from-indigo-50 to-sky-50 border border-indigo-200">
          <div className="flex items-center gap-2">
            <TrendingUp className="text-indigo-600" size={14} />
            <span className="text-xs font-bold text-indigo-800">Senin sıran:</span>
          </div>
          <span className="text-sm font-extrabold text-indigo-900">
            {me.rank}. / {data.leaderboard.length}
          </span>
          <span className="ml-auto text-xs text-slate-600 font-semibold tabular-nums">
            {me.totalPoints} puan
          </span>
        </div>
      )}

      <div className="space-y-1.5">
        {data.leaderboard.slice(0, 10).map((entry) => {
          const medal = medalFor(entry.rank);
          return (
            <div
              key={entry.userId}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg ${
                entry.isMe
                  ? "bg-indigo-50 border border-indigo-200"
                  : "hover:bg-slate-50"
              }`}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold shrink-0 ${
                  medal
                    ? `${medal.bg} ${medal.color}`
                    : entry.isMe
                    ? "bg-indigo-500 text-white"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {medal ? medal.icon : entry.rank}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-mono font-semibold text-slate-800 truncate tabular-nums">
                  {entry.studentNumber}
                  {entry.isMe && (
                    <span className="ml-1.5 text-[10px] text-indigo-600 font-bold uppercase tracking-wider font-sans">
                      Sen
                    </span>
                  )}
                </div>
              </div>
              {entry.streak > 0 && (
                <div className="flex items-center gap-0.5 text-xs text-orange-600 font-bold tabular-nums">
                  <Flame size={11} />
                  {entry.streak}
                </div>
              )}
              <div className="text-sm font-bold text-slate-700 tabular-nums w-14 text-right">
                {entry.totalPoints}
              </div>
            </div>
          );
        })}
      </div>

      {data.leaderboard.length > 10 && (
        <p className="text-[10px] text-slate-400 text-center mt-3 italic">
          + {data.leaderboard.length - 10} kişi daha
        </p>
      )}
    </div>
  );
}
