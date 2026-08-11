import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/core";
import { Users, TrendingUp, Star, Activity, Building2, Hash } from "lucide-react";
import { motion } from "framer-motion";

export default function CorporateDashboard() {
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

  const stats = [
    {
      label: "Toplam Öğrenci",
      value: reports?.summary?.totalStudents ?? 0,
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Aktif Öğrenci (7 Gün)",
      value: reports?.summary?.activeStudents ?? 0,
      icon: Activity,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "Ortalama Puan",
      value: reports?.summary?.avgPoints ?? 0,
      icon: Star,
      color: "text-yellow-600",
      bg: "bg-yellow-50",
    },
    {
      label: "Toplam Puan",
      value: reports?.summary?.totalPoints ?? 0,
      icon: TrendingUp,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
  ];

  const levelOrder = ["A1", "A2", "B1", "B2", "C1", "C2", "Belirtilmemiş"];
  const levelColors: Record<string, string> = {
    A1: "bg-green-400", A2: "bg-green-500",
    B1: "bg-blue-400", B2: "bg-blue-500",
    C1: "bg-purple-400", C2: "bg-purple-500",
    "Belirtilmemiş": "bg-gray-300",
  };

  const sortedLevels = (reports?.levelDistribution || []).sort(
    (a: any, b: any) => levelOrder.indexOf(a.level) - levelOrder.indexOf(b.level)
  );
  const maxCount = Math.max(...sortedLevels.map((l: any) => l.count), 1);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {company && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="p-6 bg-gradient-to-r from-primary to-primary/80 text-white border-0">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-white/20 flex items-center justify-center">
                <Building2 className="h-8 w-8 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold font-display">{company.name}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <Hash className="h-4 w-4 text-white/70" />
                  <span className="text-white/80 text-sm font-mono font-semibold">{company.code}</span>
                  <span className="text-white/60 text-sm">— Kurum Kimliği</span>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <Card className="p-6">
              <div className="flex items-center gap-4">
                <div className={`h-12 w-12 rounded-xl ${stat.bg} flex items-center justify-center`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold text-foreground">{stat.value.toLocaleString("tr-TR")}</p>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Seviye Dağılımı</h3>
          {sortedLevels.length === 0 ? (
            <p className="text-muted-foreground text-sm">Henüz seviye verisi yok.</p>
          ) : (
            <div className="space-y-3">
              {sortedLevels.map((item: any) => (
                <div key={item.level} className="flex items-center gap-3">
                  <span className="w-20 text-sm font-medium text-muted-foreground">{item.level}</span>
                  <div className="flex-1 h-4 bg-secondary rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${levelColors[item.level] || "bg-gray-400"} transition-all duration-700`}
                      style={{ width: `${(item.count / maxCount) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold w-8 text-right">{item.count}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">En İyi Öğrenciler</h3>
          {!reports?.topStudents?.length ? (
            <p className="text-muted-foreground text-sm">Henüz öğrenci yok.</p>
          ) : (
            <div className="space-y-3">
              {reports.topStudents.slice(0, 5).map((s: any, idx: number) => (
                <div key={s.id} className="flex items-center gap-3">
                  <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    idx === 0 ? "bg-yellow-100 text-yellow-700" :
                    idx === 1 ? "bg-gray-100 text-gray-600" :
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
                  <div className="flex items-center gap-1">
                    <Star className="h-3 w-3 text-yellow-500" />
                    <span className="text-sm font-semibold">{s.totalPoints.toLocaleString("tr-TR")}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
