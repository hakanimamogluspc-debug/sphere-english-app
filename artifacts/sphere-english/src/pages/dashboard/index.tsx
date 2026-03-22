import { useAuth } from "@/hooks/use-auth";
import { useGetDashboardStats, useGetMyProgress, useGetAdminDashboard } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from "@/components/ui/core";
import { formatDateTime, getLevelColor } from "@/lib/utils";
import { Trophy, Flame, BookOpen, Video, Users, CheckCircle, TrendingUp, DollarSign } from "lucide-react";
import { Link } from "wouter";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function StudentDashboard() {
  const { data: stats } = useGetDashboardStats();
  const { data: progress } = useGetMyProgress();

  return (
    <div className="space-y-8">
      {/* İstatistik Kartları */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-br from-primary to-primary/80 text-white border-0">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 font-medium mb-1">Toplam Puan</p>
                <h3 className="text-4xl font-bold font-display">{stats?.totalPoints || 0}</h3>
              </div>
              <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-md">
                <Trophy className="h-6 w-6 text-yellow-300" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-muted-foreground font-medium mb-1">Günlük Seri</p>
              <h3 className="text-3xl font-bold font-display flex items-center gap-2">
                {stats?.streak || 0} Gün <Flame className="text-orange-500 h-6 w-6" />
              </h3>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-muted-foreground font-medium mb-1">Kayıtlı Kurslar</p>
              <h3 className="text-3xl font-bold font-display">{stats?.enrolledCourses || 0}</h3>
            </div>
            <BookOpen className="h-8 w-8 text-primary/40" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-muted-foreground font-medium mb-1">Yaklaşan Dersler</p>
              <h3 className="text-3xl font-bold font-display">{stats?.upcomingClasses || 0}</h3>
            </div>
            <Video className="h-8 w-8 text-accent/40" />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="col-span-2 space-y-8">
          {/* Haftalık Aktivite Grafiği */}
          <Card>
            <CardHeader>
              <CardTitle>Haftalık Aktivite</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={progress?.weeklyActivity || []}>
                    <defs>
                      <linearGradient id="colorPoints" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tickFormatter={(val) => new Date(val).toLocaleDateString('tr-TR', {weekday: 'short'})} />
                    <YAxis axisLine={false} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Area type="monotone" dataKey="pointsEarned" stroke="hsl(var(--accent))" strokeWidth={3} fillOpacity={1} fill="url(#colorPoints)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Kayıtlı Kurslar İlerlemesi */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Kurslarım</CardTitle>
              <Link href="/courses" className="text-sm font-medium text-primary hover:underline">Tümünü gör</Link>
            </CardHeader>
            <CardContent className="space-y-6">
              {progress?.courseProgress?.map(course => (
                <div key={course.courseId}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-foreground">{course.courseTitle}</span>
                    <span className="text-sm font-medium text-muted-foreground">%{Math.round(course.percentage)}</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-3 overflow-hidden border border-border/50">
                    <div 
                      className="bg-gradient-to-r from-primary to-accent h-full rounded-full transition-all duration-1000" 
                      style={{ width: `${course.percentage}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">{course.completedLessons} / {course.totalLessons} ders tamamlandı</p>
                </div>
              ))}
              {(!progress?.courseProgress || progress.courseProgress.length === 0) && (
                <div className="text-center py-6">
                  <p className="text-muted-foreground mb-4">Henüz herhangi bir kursa kayıt olmadınız.</p>
                  <Link href="/courses">
                    <Button>Kurslara Göz At</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
          {/* Seviye Kartı */}
          <Card className="overflow-hidden">
            <div className="bg-primary p-6 text-center text-white">
              <div className="w-20 h-20 mx-auto bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center mb-4 border-4 border-white/30">
                <span className="text-3xl font-bold font-display">{stats?.level || 'A1'}</span>
              </div>
              <h3 className="text-xl font-bold">Mevcut Seviye</h3>
            </div>
            <CardContent className="p-0">
              <Link href="/courses">
                <div className="p-4 flex items-center justify-center text-sm font-medium text-primary hover:bg-primary/5 transition-colors cursor-pointer">
                  Seviye atlama testini al &rarr;
                </div>
              </Link>
            </CardContent>
          </Card>

          {/* Son Aktiviteler */}
          <Card>
            <CardHeader>
              <CardTitle>Son Aktiviteler</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {progress?.recentActivity?.map((activity, i) => (
                  <div key={i} className="flex gap-4 relative">
                    {i !== progress.recentActivity.length - 1 && (
                      <div className="absolute left-[11px] top-8 bottom-[-24px] w-[2px] bg-border" />
                    )}
                    <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center shrink-0 z-10 ring-4 ring-card">
                      <CheckCircle className="w-3 h-3 text-accent" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{activity.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">{new Date(activity.timestamp).toLocaleDateString('tr-TR')}</span>
                        <span className="text-xs font-bold text-green-600">+{activity.pointsEarned} puan</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function TeacherDashboard() {
  const { data: stats } = useGetDashboardStats();
  
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-muted-foreground font-medium mb-1">Aktif Kurslar</p>
              <h3 className="text-3xl font-bold font-display">{stats?.taughtCourses || 0}</h3>
            </div>
            <BookOpen className="h-8 w-8 text-primary/40" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-muted-foreground font-medium mb-1">Toplam Öğrenci</p>
              <h3 className="text-3xl font-bold font-display">{stats?.totalStudents || 0}</h3>
            </div>
            <Users className="h-8 w-8 text-accent/40" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-muted-foreground font-medium mb-1">Yaklaşan Dersler</p>
              <h3 className="text-3xl font-bold font-display">{stats?.upcomingClasses || 0}</h3>
            </div>
            <Video className="h-8 w-8 text-orange-500/40" />
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Hızlı İşlemler</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <Link href="/teacher/courses">
            <Button>Kurs Oluştur</Button>
          </Link>
          <Link href="/teacher/live-classes">
            <Button variant="outline">Ders Planla</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

function AdminDashboard() {
  const { data: stats } = useGetAdminDashboard();
  
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground font-medium mb-1">Toplam Kullanıcı</p>
            <h3 className="text-3xl font-bold font-display">{stats?.totalUsers || 0}</h3>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground font-medium mb-1">Aktif Kurslar</p>
            <h3 className="text-3xl font-bold font-display">{stats?.activeCourses || 0}</h3>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground font-medium mb-1">Toplam Kayıt</p>
            <h3 className="text-3xl font-bold font-display">{stats?.totalEnrollments || 0}</h3>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground font-medium mb-1">Verilen Sertifikalar</p>
            <h3 className="text-3xl font-bold font-display">{stats?.certificatesIssued || 0}</h3>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();

  if (user?.role === 'admin') return <AdminDashboard />;
  if (user?.role === 'teacher') return <TeacherDashboard />;
  return <StudentDashboard />;
}
