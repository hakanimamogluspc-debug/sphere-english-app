import { useParams, useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, Badge } from "@/components/ui/core";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft, Flame, Star, Target, BookOpen, Trophy, CheckCircle2, XCircle,
  TrendingUp, Calendar, Award,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { motion } from "framer-motion";

// ---------------- types mirroring API responses ----------------
interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  earnedAt: string | null;
}
interface CourseProgress {
  userId: number;
  courseId: number;
  courseTitle: string;
  completedLessons: number;
  totalLessons: number;
  percentage: number;
  lastActivity: string | null;
}
interface DayActivity {
  date: string;
  lessonsCompleted: number;
  pointsEarned: number;
}
interface ActivityItem {
  type: "lesson_completed";
  description: string;
  pointsEarned: number;
  timestamp: string;
}
interface ProgressOverview {
  userId: number;
  totalPoints: number;
  streak: number;
  level: string | null;
  badges: Badge[];
  courseProgress: CourseProgress[];
  weeklyActivity: DayActivity[];
  recentActivity: ActivityItem[];
}

interface Attempt {
  id: number;
  quizId: number;
  score: number;
  percentage: number;
  passed: boolean;
  submittedAt: string;
}
interface TeacherStudent {
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

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const e = await res.json().catch(() => ({ error: "Hata" }));
    throw new Error(e.error || "Hata");
  }
  return res.json();
}

function ScoreBadge({ pct }: { pct: number }) {
  const color =
    pct >= 70 ? "text-green-600 bg-green-50"
    : pct >= 50 ? "text-yellow-600 bg-yellow-50"
    : "text-red-600 bg-red-50";
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${color}`}>
      {pct}%
    </span>
  );
}

export default function TeacherProgressDetail() {
  const { studentId } = useParams<{ studentId: string }>();
  const [, navigate] = useLocation();
  const id = parseInt(studentId!);

  // Full progress overview
  const { data: overview, isLoading: loadingOverview } =
    useQuery<ProgressOverview>({
      queryKey: [`/api/progress/students/${id}`],
      queryFn: () => apiFetch<ProgressOverview>(`/api/progress/students/${id}`),
      enabled: !isNaN(id),
    });

  // Teacher list — includes name, email, quiz attempts, average score
  const { data: students = [], isLoading: loadingList } = useQuery<
    TeacherStudent[]
  >({
    queryKey: ["/api/teacher/progress"],
    queryFn: () => apiFetch<TeacherStudent[]>("/api/teacher/progress"),
  });

  const student = students.find((s) => s.id === id);
  const isLoading = loadingOverview || loadingList;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!overview || !student) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => navigate("/teacher/progress")}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Geri
        </button>
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">Öğrenci bulunamadı</p>
        </Card>
      </div>
    );
  }

  const earnedBadges = overview.badges.filter((b) => b.earnedAt);
  const totalWeeklyLessons = overview.weeklyActivity.reduce(
    (s, d) => s + d.lessonsCompleted,
    0,
  );

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link
          href="/teacher/progress"
          className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Öğrenci İlerlemesi
        </Link>
      </div>

      {/* Header */}
      <Card className="p-6">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary">
            {student.firstName[0]}
            {student.lastName[0]}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold font-display">
              {student.firstName} {student.lastName}
            </h1>
            <p className="text-sm text-muted-foreground">{student.email}</p>
            {overview.level && (
              <Badge className="mt-2" variant="secondary">
                Seviye: {overview.level}
              </Badge>
            )}
          </div>
        </div>
      </Card>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-yellow-100 flex items-center justify-center">
            <Star className="h-5 w-5 text-yellow-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Toplam Puan</p>
            <p className="text-xl font-bold">{overview.totalPoints}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-orange-100 flex items-center justify-center">
            <Flame className="h-5 w-5 text-orange-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Günlük Seri</p>
            <p className="text-xl font-bold">{overview.streak}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-green-100 flex items-center justify-center">
            <Target className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Ortalama Skor</p>
            <p className="text-xl font-bold">
              {student.averageScore !== null ? `${student.averageScore}%` : "—"}
            </p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <BookOpen className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Toplam Quiz</p>
            <p className="text-xl font-bold">{student.quizAttempts}</p>
          </div>
        </Card>
      </div>

      {/* Course progress */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Kurs İlerlemesi</h2>
        </div>
        {overview.courseProgress.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            Henüz kayıtlı kurs yok.
          </p>
        ) : (
          <div className="space-y-4">
            {overview.courseProgress.map((cp) => (
              <div key={cp.courseId}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium">{cp.courseTitle}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>
                      {cp.completedLessons} / {cp.totalLessons} ders
                    </span>
                    <span className="font-semibold text-foreground">
                      {cp.percentage}%
                    </span>
                  </div>
                </div>
                <Progress value={cp.percentage} className="h-2" />
                {cp.lastActivity && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Son aktivite:{" "}
                    {new Date(cp.lastActivity).toLocaleDateString("tr-TR")}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Weekly activity chart */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Son 7 Günlük Aktivite</h2>
          </div>
          <span className="text-sm text-muted-foreground">
            Toplam {totalWeeklyLessons} ders
          </span>
        </div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={overview.weeklyActivity}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis
                dataKey="date"
                tickFormatter={(d) =>
                  new Date(d).toLocaleDateString("tr-TR", {
                    weekday: "short",
                  })
                }
                tick={{ fontSize: 12 }}
              />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip
                labelFormatter={(d) =>
                  new Date(d).toLocaleDateString("tr-TR", {
                    day: "2-digit",
                    month: "short",
                  })
                }
                formatter={(val: number, name: string) => [
                  val,
                  name === "lessonsCompleted" ? "Ders" : "Puan",
                ]}
              />
              <Bar
                dataKey="lessonsCompleted"
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Badges */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Rozetler</h2>
          </div>
          <span className="text-sm text-muted-foreground">
            {earnedBadges.length} / {overview.badges.length}
          </span>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {overview.badges.map((b) => {
            const earned = !!b.earnedAt;
            return (
              <div
                key={b.id}
                title={b.description}
                className={`p-3 rounded-xl text-center border transition ${
                  earned
                    ? "bg-yellow-50 border-yellow-200"
                    : "bg-secondary/30 border-border opacity-50 grayscale"
                }`}
              >
                <div className="text-2xl">{b.icon}</div>
                <p className="text-xs font-medium mt-1 line-clamp-1">
                  {b.name}
                </p>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Recent quiz attempts */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Son Quiz Denemeleri</h2>
        </div>
        {student.recentAttempts.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            Henüz quiz denemesi yok.
          </p>
        ) : (
          <div className="space-y-2">
            {student.recentAttempts.map((a, i) => (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center justify-between py-2 px-3 rounded-lg bg-secondary/40"
              >
                <div className="flex items-center gap-2">
                  {a.passed ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-400" />
                  )}
                  <span className="text-sm">Quiz #{a.quizId}</span>
                </div>
                <div className="flex items-center gap-3">
                  <ScoreBadge pct={Math.round(a.percentage)} />
                  <span className="text-xs text-muted-foreground">
                    {new Date(a.submittedAt).toLocaleDateString("tr-TR")}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </Card>

      {/* Recent activity */}
      {overview.recentActivity.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Son Aktiviteler</h2>
          </div>
          <div className="space-y-2">
            {overview.recentActivity.map((a, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-2 px-3 rounded-lg bg-secondary/40"
              >
                <span className="text-sm">{a.description}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-yellow-600 font-semibold">
                    +{a.pointsEarned} puan
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(a.timestamp).toLocaleDateString("tr-TR")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
