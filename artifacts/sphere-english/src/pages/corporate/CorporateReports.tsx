import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/core";
import {
  BarChart3, Users, Activity, Star, TrendingUp, Award, Building2, Hash,
  BookOpen, Target, UserX, Download, Calendar, AlertCircle,
} from "lucide-react";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const levelColors: Record<string, string> = {
  A1: "bg-emerald-400", A2: "bg-emerald-500",
  B1: "bg-sky-400", B2: "bg-sky-500",
  C1: "bg-violet-400", C2: "bg-violet-500",
  "Belirtilmemiş": "bg-slate-300",
};
const levelTextColors: Record<string, string> = {
  A1: "text-emerald-700", A2: "text-emerald-800",
  B1: "text-sky-700", B2: "text-sky-800",
  C1: "text-violet-700", C2: "text-violet-800",
  "Belirtilmemiş": "text-slate-600",
};

export default function CorporateReports() {
  const { user } = useAuth();
  const company = (user as any)?.company;

  const { data: reports, isLoading } = useQuery({
    queryKey: ["/api/corporate/reports"],
    queryFn: async () => {
      const res = await fetch("/api/corporate/reports");
      if (!res.ok) throw new Error("API hatası");
      return res.json();
    },
  });

  const levelOrder = ["A1", "A2", "B1", "B2", "C1", "C2", "Belirtilmemiş"];
  const sortedLevels = (reports?.levelDistribution || []).sort(
    (a: any, b: any) => levelOrder.indexOf(a.level) - levelOrder.indexOf(b.level)
  );
  const maxCount = Math.max(...sortedLevels.map((l: any) => l.count), 1);
  const totalStudents = reports?.summary?.totalStudents || 1;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold font-display">Raporlar</h2>
        <p className="text-muted-foreground text-sm mt-1">Kurumunuzdaki öğrencilerin performans özeti</p>
      </div>

      {company && (
        <Card className="p-5 border-l-4 border-l-primary">
          <div className="flex items-center gap-3">
            <Building2 className="h-6 w-6 text-primary" />
            <div>
              <p className="font-semibold text-lg">{company.name}</p>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Hash className="h-3.5 w-3.5" />
                <span className="font-mono font-medium">{company.code}</span>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* CSV indirme butonu */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={async () => {
            try {
              const token = localStorage.getItem("sphere_token");
              const res = await fetch("/api/corporate/reports/csv", {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
              });
              if (!res.ok) throw new Error("İndirme başarısız");
              const blob = await res.blob();
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              const dateStr = new Date().toISOString().split("T")[0];
              a.download = `kurumsal-rapor-${dateStr}.csv`;
              document.body.appendChild(a);
              a.click();
              a.remove();
              URL.revokeObjectURL(url);
            } catch (e: any) {
              alert("CSV indirilemedi: " + (e?.message ?? "bilinmeyen hata"));
            }
          }}
          className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
        >
          <Download className="h-4 w-4" /> CSV olarak indir
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Toplam Öğrenci", value: reports?.summary?.totalStudents ?? 0, icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Aktif (7 Gün)", value: reports?.summary?.activeStudents ?? 0, icon: Activity, color: "text-green-600", bg: "bg-green-50" },
          { label: "Ort. Puan", value: reports?.summary?.avgPoints ?? 0, icon: Star, color: "text-amber-600", bg: "bg-amber-50" },
          { label: "Toplam Puan", value: reports?.summary?.totalPoints ?? 0, icon: TrendingUp, color: "text-purple-600", bg: "bg-purple-50" },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.08 }}>
            <Card className="p-5">
              <div className={`h-10 w-10 rounded-xl ${stat.bg} flex items-center justify-center mb-3`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <p className="text-2xl font-bold">{stat.value.toLocaleString("tr-TR")}</p>
              <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-5">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-lg">Seviye Dağılımı</h3>
          </div>
          {sortedLevels.length === 0 ? (
            <p className="text-muted-foreground text-sm">Seviye verisi bulunamadı.</p>
          ) : (
            <div className="space-y-4">
              {sortedLevels.map((item: any) => {
                const pct = Math.round((item.count / totalStudents) * 100);
                return (
                  <div key={item.level}>
                    <div className="flex justify-between items-center mb-1">
                      <span className={`text-sm font-semibold ${levelTextColors[item.level] || "text-muted-foreground"}`}>{item.level}</span>
                      <span className="text-sm text-muted-foreground">{item.count} öğrenci ({pct}%)</span>
                    </div>
                    <div className="h-3 bg-secondary rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(item.count / maxCount) * 100}%` }}
                        transition={{ duration: 0.7, ease: "easeOut" }}
                        className={`h-full rounded-full ${levelColors[item.level] || "bg-gray-400"}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2 mb-5">
            <Award className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-lg">En Başarılı 10 Öğrenci</h3>
          </div>
          {!reports?.topStudents?.length ? (
            <p className="text-muted-foreground text-sm">Henüz öğrenci yok.</p>
          ) : (
            <div className="space-y-2.5">
              {reports.topStudents.map((s: any, idx: number) => (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-secondary/50 transition-colors"
                >
                  <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    idx === 0 ? "bg-yellow-100 text-yellow-700" :
                    idx === 1 ? "bg-slate-100 text-slate-600" :
                    idx === 2 ? "bg-orange-100 text-orange-700" : "bg-secondary text-muted-foreground"
                  }`}>
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{s.firstName} {s.lastName}</p>
                    {s.currentLevel && (
                      <span className="text-xs text-muted-foreground">{s.currentLevel}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Star className="h-3.5 w-3.5 text-yellow-500" />
                    <span className="text-sm font-bold">{s.totalPoints.toLocaleString("tr-TR")}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="font-semibold text-lg mb-4">Katılım Durumu</h3>
        <div className="flex items-center gap-8">
          <div className="text-center">
            <div className="relative h-24 w-24 mx-auto">
              <svg viewBox="0 0 36 36" className="h-24 w-24 -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e2e8f0" strokeWidth="3" />
                <circle
                  cx="18" cy="18" r="15.9" fill="none"
                  stroke="#22c55e" strokeWidth="3"
                  strokeDasharray={`${(reports?.summary?.activeStudents / Math.max(reports?.summary?.totalStudents, 1)) * 100} 100`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold">
                  {Math.round((reports?.summary?.activeStudents / Math.max(reports?.summary?.totalStudents, 1)) * 100)}%
                </span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-2">7 Günlük Aktiflik</p>
          </div>
          <div className="flex-1 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Aktif öğrenciler</span>
              <span className="font-semibold text-green-600">{reports?.summary?.activeStudents ?? 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Pasif öğrenciler</span>
              <span className="font-semibold text-muted-foreground">
                {(reports?.summary?.totalStudents ?? 0) - (reports?.summary?.activeStudents ?? 0)}
              </span>
            </div>
            <div className="flex justify-between text-sm border-t pt-2">
              <span className="font-medium">Toplam</span>
              <span className="font-bold">{reports?.summary?.totalStudents ?? 0}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Yeni: Engagement istatistikleri */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Tamamlanan Ders", value: reports?.summary?.totalLessonsCompleted ?? 0, icon: BookOpen, color: "text-indigo-600", bg: "bg-indigo-50" },
          { label: "Ders / Öğrenci", value: reports?.summary?.avgLessonsPerStudent ?? 0, icon: BookOpen, color: "text-indigo-600", bg: "bg-indigo-50" },
          { label: "Toplam Quiz", value: reports?.summary?.totalQuizAttempts ?? 0, icon: Target, color: "text-rose-600", bg: "bg-rose-50" },
          { label: "Placement %", value: `${reports?.summary?.placementCompletedPct ?? 0}%`, icon: Target, color: "text-teal-600", bg: "bg-teal-50" },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}>
            <Card className="p-5">
              <div className={`h-10 w-10 rounded-xl ${stat.bg} flex items-center justify-center mb-3`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <p className="text-2xl font-bold">{typeof stat.value === "number" ? stat.value.toLocaleString("tr-TR") : stat.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Yeni: Haftalık trend grafiği */}
      {Array.isArray(reports?.weeklyTrend) && reports.weeklyTrend.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-5">
            <Calendar className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-lg">Son 8 Hafta Aktivite</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reports.weeklyTrend}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis
                  dataKey="weekStart"
                  tickFormatter={(d: string) =>
                    new Date(d).toLocaleDateString("tr-TR", { day: "2-digit", month: "short" })
                  }
                  tick={{ fontSize: 12 }}
                />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip
                  labelFormatter={(d: string) =>
                    new Date(d).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" })
                  }
                  formatter={(v: number, name: string) => {
                    const label = name === "lessonsCompleted" ? "Ders" : name === "activeStudents" ? "Aktif öğrenci" : "Puan";
                    return [v.toLocaleString("tr-TR"), label];
                  }}
                />
                <Bar dataKey="lessonsCompleted" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="activeStudents" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Yeni: Placement sonuçları + Pasif öğrenciler */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {reports?.summary?.avgPlacementScore !== null && reports?.summary?.avgPlacementScore !== undefined && (
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-lg">Son Placement Testleri</h3>
              </div>
              <span className="text-sm text-muted-foreground">
                Ort: <span className="font-semibold text-foreground">{reports.summary.avgPlacementScore}%</span>
              </span>
            </div>
            {!reports?.recentPlacements?.length ? (
              <p className="text-sm text-muted-foreground italic">Henüz placement testi yapılmadı.</p>
            ) : (
              <div className="space-y-2">
                {reports.recentPlacements.map((p: any) => {
                  const pct = Math.round((p.score / p.total) * 100);
                  return (
                    <div key={`${p.userId}-${p.completedAt}`} className="flex items-center justify-between py-2 px-3 rounded-lg bg-secondary/40">
                      <div className="text-sm font-medium truncate">{p.firstName} {p.lastName}</div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-muted-foreground">{p.cefrLevel}</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${pct >= 70 ? "text-green-600 bg-green-50" : pct >= 50 ? "text-yellow-600 bg-yellow-50" : "text-red-600 bg-red-50"}`}>{pct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        )}

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <UserX className="h-5 w-5 text-amber-600" />
              <h3 className="font-semibold text-lg">Pasif Öğrenciler</h3>
            </div>
            <span className="text-sm text-muted-foreground">
              Son 14 gün aktivitesiz: <span className="font-semibold text-amber-600">{reports?.summary?.inactiveCount ?? 0}</span>
            </span>
          </div>
          {!reports?.inactiveStudents?.length ? (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <AlertCircle className="h-4 w-4" />
              <span>Harika — pasif öğrenci yok.</span>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-72 overflow-auto">
              {reports.inactiveStudents.map((s: any) => (
                <div key={s.id} className="flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-secondary/40 transition-colors">
                  <div className="text-sm truncate">
                    {s.firstName} {s.lastName}
                    <span className="text-xs text-muted-foreground ml-2">{s.currentLevel ?? "—"}</span>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {s.lastActiveDate ? new Date(s.lastActiveDate).toLocaleDateString("tr-TR") : "Hiç"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
