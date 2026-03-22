import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, Badge } from "@/components/ui/core";
import { LineChart, CheckCircle2, XCircle, Target, Flame, Star } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";

interface Attempt {
  id: number;
  quizId: number;
  score: number;
  percentage: number;
  passed: boolean;
  submittedAt: string;
}

interface StudentProgress {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  totalPoints: number;
  streak: number;
  quizAttempts: number;
  averageScore: number | null;
  recentAttempts: Attempt[];
}

async function apiFetch(url: string) {
  const res = await fetch(url);
  if (!res.ok) { const e = await res.json().catch(() => ({ error: "Hata" })); throw new Error(e.error || "Hata"); }
  return res.json();
}

function ScoreBadge({ pct }: { pct: number }) {
  const color = pct >= 70 ? "text-green-600 bg-green-50" : pct >= 50 ? "text-yellow-600 bg-yellow-50" : "text-red-600 bg-red-50";
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${color}`}>{pct}%</span>;
}

export default function TeacherProgress() {
  const [selectedStudent, setSelectedStudent] = useState<StudentProgress | null>(null);

  const { data: students = [], isLoading } = useQuery<StudentProgress[]>({
    queryKey: ["/api/teacher/progress"],
    queryFn: () => apiFetch("/api/teacher/progress"),
  });

  const avgOverall = students.length > 0
    ? Math.round(students.reduce((s, x) => s + (x.averageScore ?? 0), 0) / students.filter(s => s.averageScore !== null).length || 0)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold font-display">Öğrenci İlerlemesi</h2>
        <p className="text-muted-foreground text-sm mt-1">Gruplarınızdaki öğrencilerin quiz performansları</p>
      </div>

      {/* Özet kartlar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center"><LineChart className="h-5 w-5 text-primary" /></div>
          <div><p className="text-xs text-muted-foreground">Toplam Öğrenci</p><p className="text-xl font-bold">{students.length}</p></div>
        </Card>
        <Card className="p-4 flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-green-100 flex items-center justify-center"><Target className="h-5 w-5 text-green-600" /></div>
          <div><p className="text-xs text-muted-foreground">Ortalama Skor</p><p className="text-xl font-bold">{avgOverall}%</p></div>
        </Card>
        <Card className="p-4 flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-orange-100 flex items-center justify-center"><Star className="h-5 w-5 text-orange-500" /></div>
          <div><p className="text-xs text-muted-foreground">Toplam Quiz</p><p className="text-xl font-bold">{students.reduce((s, x) => s + x.quizAttempts, 0)}</p></div>
        </Card>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : students.length === 0 ? (
        <Card className="p-12 text-center">
          <LineChart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground font-medium">Henüz takip edilecek öğrenci yok</p>
          <p className="text-sm text-muted-foreground mt-1">Gruplarınıza öğrenci ekleyin.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {students.map((s, i) => (
            <motion.div key={s.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Card
                className="p-4 border-2 border-border hover:border-primary/30 transition-colors cursor-pointer"
                onClick={() => setSelectedStudent(selectedStudent?.id === s.id ? null : s)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm">
                      {s.firstName[0]}{s.lastName[0]}
                    </div>
                    <div>
                      <p className="font-semibold">{s.firstName} {s.lastName}</p>
                      <p className="text-xs text-muted-foreground">{s.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-right">
                    <div className="hidden sm:block">
                      <p className="text-xs text-muted-foreground">Ortalama</p>
                      {s.averageScore !== null
                        ? <ScoreBadge pct={s.averageScore} />
                        : <span className="text-xs text-muted-foreground italic">—</span>
                      }
                    </div>
                    <div className="hidden sm:block">
                      <p className="text-xs text-muted-foreground">Quiz</p>
                      <p className="text-sm font-semibold">{s.quizAttempts}</p>
                    </div>
                    <div className="flex items-center gap-1 text-orange-500 text-sm font-semibold">
                      <Flame className="h-4 w-4" />{s.streak}
                    </div>
                    <div className="flex items-center gap-1 text-yellow-500 text-sm font-semibold">
                      <Star className="h-4 w-4" />{s.totalPoints}
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                {s.averageScore !== null && (
                  <div className="mt-3">
                    <Progress value={s.averageScore} className="h-1.5" />
                  </div>
                )}

                {/* Son denemeler (açıldığında) */}
                {selectedStudent?.id === s.id && s.recentAttempts.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="mt-4 pt-4 border-t border-border space-y-2"
                  >
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Son Denemeler</p>
                    {s.recentAttempts.map((a) => (
                      <div key={a.id} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-secondary/40">
                        <div className="flex items-center gap-2">
                          {a.passed
                            ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                            : <XCircle className="h-4 w-4 text-red-400" />
                          }
                          <span className="text-sm">Quiz #{a.quizId}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <ScoreBadge pct={Math.round(a.percentage)} />
                          <span className="text-xs text-muted-foreground">
                            {new Date(a.submittedAt).toLocaleDateString("tr-TR")}
                          </span>
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
