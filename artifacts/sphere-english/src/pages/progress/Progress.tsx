import { useGetMyProgress } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui/core";
import { useAuth } from "@/hooks/use-auth";
import { TrendingUp, BookOpen, CheckCircle, Star, Flame, Zap } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import WeeklyHeatmap from "@/components/WeeklyHeatmap";

export default function ProgressPage() {
  const { data: progress, isLoading } = useGetMyProgress();
  const { user } = useAuth();

  if (isLoading) {
    return <div className="text-center p-8 animate-pulse text-muted-foreground">İlerleme yükleniyor...</div>;
  }

  const skillData = [
    { subject: "Okuma", A: progress?.skillLevels?.reading || 0, fullMark: 100 },
    { subject: "Yazma", A: progress?.skillLevels?.writing || 0, fullMark: 100 },
    { subject: "Dinleme", A: progress?.skillLevels?.listening || 0, fullMark: 100 },
    { subject: "Konuşma", A: progress?.skillLevels?.speaking || 0, fullMark: 100 },
    { subject: "Gramer", A: progress?.skillLevels?.grammar || 0, fullMark: 100 },
    { subject: "Kelime", A: progress?.skillLevels?.vocabulary || 0, fullMark: 100 },
  ];

  const badges = progress?.badges || [];
  const levelXP = user?.totalPoints || 0;
  const nextLevelXP = Math.ceil((levelXP + 1) / 500) * 500;
  const xpPercent = Math.round((levelXP / nextLevelXP) * 100);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-display">İlerleme Durumum</h1>
        <p className="text-muted-foreground mt-1">Öğrenme yolculuğunuzu takip edin ve başarılarınızı görün.</p>
      </div>

      {/* Üst İstatistikler */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-primary to-primary/80 text-white border-0">
          <CardContent className="p-6">
            <Star className="h-6 w-6 text-yellow-300 mb-2" />
            <p className="text-white/70 text-sm font-medium">Toplam Puan</p>
            <h3 className="text-3xl font-bold font-display">{user?.totalPoints || 0}</h3>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <Flame className="h-6 w-6 text-orange-500 mb-2" />
            <p className="text-muted-foreground text-sm font-medium">Günlük Seri</p>
            <h3 className="text-3xl font-bold font-display">{user?.streak || 0}</h3>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <CheckCircle className="h-6 w-6 text-green-500 mb-2" />
            <p className="text-muted-foreground text-sm font-medium">Tamamlanan Dersler</p>
            <h3 className="text-3xl font-bold font-display">{progress?.totalLessonsCompleted || 0}</h3>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <BookOpen className="h-6 w-6 text-accent mb-2" />
            <p className="text-muted-foreground text-sm font-medium">Sınav Ortalaması</p>
            <h3 className="text-3xl font-bold font-display">%{progress?.quizStats?.averageScore?.toFixed(0) || 0}</h3>
          </CardContent>
        </Card>
      </div>

      {/* Seviye & XP Barı */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-white font-bold font-display text-lg">
                {user?.currentLevel || 'A1'}
              </div>
              <div>
                <p className="font-bold text-foreground">Mevcut Seviyeniz</p>
                <p className="text-muted-foreground text-sm">Bir sonraki seviyeye {nextLevelXP - levelXP} puan kaldı</p>
              </div>
            </div>
            <span className="font-bold text-primary text-lg">%{xpPercent}</span>
          </div>
          <Progress value={xpPercent} className="h-3" />
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>{levelXP} XP</span>
            <span>{nextLevelXP} XP</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Haftalık Aktivite Isı Haritası */}
        <Card>
          <CardHeader>
            <CardTitle>Haftalık Çalışma Takibi</CardTitle>
          </CardHeader>
          <CardContent>
            <WeeklyHeatmap />
          </CardContent>
        </Card>

        {/* Beceri Radarı */}
        <Card>
          <CardHeader>
            <CardTitle>Beceri Dağılımı</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={skillData}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12, fontWeight: 500 }} />
                  <Radar name="Beceriler" dataKey="A" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Kurs İlerlemesi */}
      {progress?.courseProgress && progress.courseProgress.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Kurs İlerlemesi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {progress.courseProgress.map(course => (
              <div key={course.courseId}>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold text-foreground">{course.courseTitle}</span>
                  <span className="text-sm text-muted-foreground">%{Math.round(course.percentage)}</span>
                </div>
                <Progress value={course.percentage} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1">{course.completedLessons} / {course.totalLessons} ders tamamlandı</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Rozetler */}
      <Card>
        <CardHeader>
          <CardTitle>Kazanılan Rozetler</CardTitle>
        </CardHeader>
        <CardContent>
          {badges.length === 0 ? (
            <div className="text-center py-8">
              <Star className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">Henüz rozet kazanılmadı. Öğrenmeye devam edin!</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {badges.map((badge: any, i: number) => (
                <div key={i} className="flex flex-col items-center p-4 bg-secondary/50 rounded-2xl border border-border text-center hover:scale-105 transition-transform">
                  <div className="text-4xl mb-2">{badge.icon || '🏅'}</div>
                  <p className="text-xs font-semibold leading-tight">{badge.name}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
