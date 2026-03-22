import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/core";
import { Users, Search, Star, Flame, Award } from "lucide-react";
import { motion } from "framer-motion";

const levelColors: Record<string, string> = {
  A1: "bg-green-100 text-green-700",
  A2: "bg-green-100 text-green-800",
  B1: "bg-blue-100 text-blue-700",
  B2: "bg-blue-100 text-blue-800",
  C1: "bg-purple-100 text-purple-700",
  C2: "bg-purple-100 text-purple-800",
};

export default function CorporateStudents() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/corporate/students", page],
    queryFn: async () => {
      const res = await fetch(`/api/corporate/students?page=${page}&limit=20`);
      if (!res.ok) throw new Error("API hatası");
      return res.json();
    },
  });

  const students = data?.students || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / 20);

  const filtered = search
    ? students.filter((s: any) =>
        `${s.firstName} ${s.lastName} ${s.email}`.toLowerCase().includes(search.toLowerCase())
      )
    : students;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-display">Kurumum Öğrencileri</h2>
          <p className="text-muted-foreground text-sm mt-1">Toplam {total} öğrenci kayıtlı</p>
        </div>
      </div>

      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="İsim veya e-posta ile ara..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Henüz öğrenci bulunmuyor.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((student: any, i: number) => (
            <motion.div
              key={student.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg shrink-0">
                    {student.firstName[0]}{student.lastName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-foreground">{student.firstName} {student.lastName}</p>
                      {student.currentLevel && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${levelColors[student.currentLevel] || "bg-secondary text-foreground"}`}>
                          {student.currentLevel}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{student.email}</p>
                    {student.phone && (
                      <p className="text-xs text-muted-foreground">{student.phone}</p>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-4 pt-4 border-t border-border">
                  <div className="flex items-center gap-1.5">
                    <Star className="h-4 w-4 text-yellow-500" />
                    <span className="text-sm font-semibold">{student.totalPoints.toLocaleString("tr-TR")}</span>
                    <span className="text-xs text-muted-foreground">puan</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Flame className="h-4 w-4 text-orange-500" />
                    <span className="text-sm font-semibold">{student.streak}</span>
                    <span className="text-xs text-muted-foreground">seri</span>
                  </div>
                  {student.badges?.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <Award className="h-4 w-4 text-purple-500" />
                      <span className="text-sm font-semibold">{student.badges.length}</span>
                      <span className="text-xs text-muted-foreground">rozet</span>
                    </div>
                  )}
                </div>

                {student.lastActiveDate && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Son aktiflik: {new Date(student.lastActiveDate).toLocaleDateString("tr-TR")}
                  </p>
                )}
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
            className="px-4 py-2 text-sm rounded-lg border border-border disabled:opacity-40 hover:bg-secondary transition-colors"
          >
            Önceki
          </button>
          <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
          <button
            disabled={page === totalPages}
            onClick={() => setPage(p => p + 1)}
            className="px-4 py-2 text-sm rounded-lg border border-border disabled:opacity-40 hover:bg-secondary transition-colors"
          >
            Sonraki
          </button>
        </div>
      )}
    </div>
  );
}
