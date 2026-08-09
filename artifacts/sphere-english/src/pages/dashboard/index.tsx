import { useAuth } from "@/hooks/use-auth";
import { useFeature } from "@/hooks/use-feature";
import { useGetDashboardStats, useGetMyProgress, useGetAdminDashboard } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from "@/components/ui/core";
import { formatDateTime, getLevelColor } from "@/lib/utils";
import { Trophy, Flame, BookOpen, Video, Users, CheckCircle, TrendingUp, DollarSign, Megaphone, AlertCircle, Info, ChevronRight, Wifi, BookMarked, Cpu, LayoutDashboard, GraduationCap, Newspaper, Compass } from "lucide-react";
import { Link, useLocation, Redirect } from "wouter";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useEffect, useState } from "react";
import { API } from "@/lib/api-url";
import TrialBanner from "@/components/subscription/TrialBanner";

function useAnnouncements() {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const token = localStorage.getItem("sphere_token");
    fetch(`${API}/announcements`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => setAnnouncements(Array.isArray(data) ? data : []))
      .catch(() => setAnnouncements([]))
      .finally(() => setLoading(false));
  }, []);
  return { announcements, loading };
}

function StudentDashboard() {
  const { data: stats } = useGetDashboardStats();
  const { data: progress } = useGetMyProgress();
  const { user } = useAuth();
  const showCourses = useFeature("student-courses");

  return (
    <div className="space-y-8">
      <TrialBanner />
      {/* Öğrenci Kimlik Bandı */}
      {(user as any)?.studentNumber && (
        <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-xl px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <span className="text-primary font-bold text-sm">{user?.firstName?.[0]}{user?.lastName?.[0]}</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{user?.firstName} {user?.lastName}</p>
              <p className="text-xs text-muted-foreground">Öğrenci</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground mb-0.5">Öğrenci No</p>
            <span className="font-mono font-bold text-primary text-sm bg-primary/10 px-3 py-1 rounded-lg">
              {(user as any).studentNumber}
            </span>
          </div>
        </div>
      )}

      {/* Hızlı Erişim */}
      <QuickAccessGrid />

      {/* Bu hafta odaklan (hata bazlı) */}
      <FocusThisWeekCard />

      {/* İstatistik Kartları */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-br from-primary to-primary/80 text-white border-0">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 font-medium mb-1">Toplam Puan</p>
                <h3 className="text-4xl font-bold font-display text-white">{stats?.totalPoints || 0}</h3>
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

          {/* Kayıtlı Kurslar İlerlemesi — Kurslar modülü kapalıysa gizli */}
          {showCourses && (
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
          )}
        </div>

        <div className="space-y-8">
          {/* Seviye Kartı */}
          <Card className="overflow-hidden">
            <div className="bg-primary p-6 text-center text-white">
              <div className="w-20 h-20 mx-auto bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center mb-4 border-4 border-white/30">
                <span className="text-3xl font-bold font-display text-white">{stats?.level || 'A1'}</span>
              </div>
              <h3 className="text-xl font-bold text-white">Mevcut Seviye</h3>
            </div>
            <CardContent className="p-0">
              <Link href="/student/level-exams">
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

      {/* Bugün için önerilen makaleler */}
      <RecommendedArticlesWidget />
    </div>
  );
}

// ─── Hızlı Erişim ─────────────────────────────────────────────────────
type QuickAction = {
  label: string;
  href: string;
  icon: any;
  color: string;
  bg: string;
  featureKey?: string;
};

const QUICK_ACTIONS: QuickAction[] = [
  { label: "AI Öğretmen",       href: "/student/ai-tutor",           icon: GraduationCap, color: "text-white", bg: "from-indigo-600 to-blue-600",     featureKey: "student-ai-tutor" },
  { label: "Konuşma Sahneleri", href: "/student/speaking-scenes",    icon: Cpu,           color: "text-white", bg: "from-teal-600 to-emerald-600",    featureKey: "student-speaking-scenes" },
  { label: "Yazma Koçu",        href: "/student/writing-coach",      icon: BookMarked,    color: "text-white", bg: "from-orange-500 to-rose-500",     featureKey: "student-writing-coach" },
  { label: "Dilbilgisi Koçu",   href: "/student/grammar-coach",      icon: Cpu,           color: "text-white", bg: "from-purple-600 to-fuchsia-600",  featureKey: "student-grammar-coach" },
  { label: "Kelime Oyunu",      href: "/student/vocab-game",         icon: Trophy,        color: "text-white", bg: "from-amber-500 to-orange-500",    featureKey: "student-vocab-game" },
  { label: "Keşfet",            href: "/kesfet",                     icon: Newspaper,     color: "text-white", bg: "from-sky-600 to-cyan-600" },
];

function QuickAccessGrid() {
  // Feature flag'lere göre filtre — her item için useFeature çağrısı hook kural gereği
  const flags = QUICK_ACTIONS.map(a => useFeature(a.featureKey));
  const visible = QUICK_ACTIONS.filter((_, i) => flags[i]);
  if (visible.length === 0) return null;
  return (
    <div>
      <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4" /> Hızlı Erişim
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {visible.map(a => (
          <Link key={a.href} href={a.href}>
            <div className={`rounded-xl p-4 bg-gradient-to-br ${a.bg} ${a.color} cursor-pointer hover:shadow-lg hover:scale-105 transition-transform`}>
              <a.icon className="h-6 w-6 mb-2 opacity-95" />
              <div className="text-sm font-semibold leading-tight">{a.label}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─── Bu Hafta Odaklan (mistake bazlı öneri) ────────────────────────────
const MISTAKE_TYPE_LABEL: Record<string, string> = {
  grammar: "Dilbilgisi", vocab: "Kelime", collocation: "Kalıp",
  spelling: "Yazım", register: "Ton/Register", pronunciation: "Telaffuz", other: "Diğer",
};

function FocusThisWeekCard() {
  const [data, setData] = useState<{ mistakes: any[]; stats: any[] } | null>(null);
  useEffect(() => {
    const token = localStorage.getItem("sphere_token");
    fetch(`${API}/my/mistakes?unresolved=1&limit=3`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(setData)
      .catch(() => setData(null));
  }, []);

  if (!data || data.mistakes.length === 0) return null;

  const topType = data.stats?.sort((a, b) => b.n - a.n)[0];
  return (
    <Card className="border-l-4 border-l-red-400">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <CardTitle>Bu Hafta Odaklan</CardTitle>
        </div>
        <Link href="/raporum" className="text-xs text-primary hover:underline font-medium flex items-center gap-1">
          Hata Defterim <ChevronRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {topType && (
          <p className="text-sm text-muted-foreground">
            En çok <strong className="text-foreground">{MISTAKE_TYPE_LABEL[topType.mistake_type] || topType.mistake_type}</strong> kategorisinde
            zorlanıyorsun ({topType.n} açık hata). İşte tekrar eden 3 hata:
          </p>
        )}
        {data.mistakes.map((m: any) => (
          <div key={m.id} className="rounded-lg bg-red-50 border border-red-200 p-3">
            <div className="text-sm flex flex-wrap items-baseline gap-2">
              <span className="line-through text-red-800 font-semibold">{m.wrong_text}</span>
              {m.correct_text && <>
                <span className="text-gray-400">→</span>
                <span className="text-emerald-800 font-bold">{m.correct_text}</span>
              </>}
              {m.occurrence_count > 1 && (
                <span className="text-[10px] font-semibold text-red-600 ml-1">{m.occurrence_count}× tekrar</span>
              )}
            </div>
            {m.explanation && <p className="text-xs text-gray-600 mt-1.5">{m.explanation}</p>}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function RecommendedArticlesWidget() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const token = localStorage.getItem("sphere_token");
    fetch(`${API}/content/recommended?limit=3`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setItems(Array.isArray(d.items) ? d.items : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);
  if (loading || items.length === 0) return null;
  const catLabel: Record<string, string> = {
    finance: "Finans", tech: "Teknoloji", leadership: "Liderlik", negotiation: "Müzakere", general: "Genel",
  };
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <Compass className="h-5 w-5 text-primary" />
          <CardTitle>Bugün İçin Öneriler</CardTitle>
        </div>
        <Link href="/kesfet" className="text-xs text-primary hover:underline font-medium flex items-center gap-1">
          Tümünü Keşfet <ChevronRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {items.map((a: any) => (
            <Link key={a.id} href="/kesfet"
              className="rounded-lg border hover:border-primary/50 hover:shadow transition overflow-hidden group flex flex-col cursor-pointer bg-card"
            >
              {a.image_url ? (
                <div className="aspect-video bg-gray-100 overflow-hidden">
                  <img src={a.image_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition" />
                </div>
              ) : (
                <div className="aspect-video bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center">
                  <Newspaper className="h-8 w-8 text-primary/40" />
                </div>
              )}
              <div className="p-3 space-y-1.5 flex-1 flex flex-col">
                <div className="flex items-center gap-1 text-[10px] font-semibold">
                  {a.category && <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary">{catLabel[a.category] || a.category}</span>}
                  {a.cefr_level && <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{a.cefr_level}</span>}
                </div>
                <h4 className="text-sm font-semibold text-foreground line-clamp-2 leading-snug">{a.title}</h4>
                {a.tr_summary && <p className="text-xs text-muted-foreground line-clamp-2">{a.tr_summary}</p>}
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  high:   { label: 'Yüksek',  color: 'border-l-red-500 bg-red-50',    icon: <AlertCircle className="h-4 w-4 text-red-500 shrink-0" /> },
  medium: { label: 'Orta',    color: 'border-l-amber-500 bg-amber-50', icon: <Info className="h-4 w-4 text-amber-500 shrink-0" /> },
  low:    { label: 'Düşük',   color: 'border-l-blue-500 bg-blue-50',   icon: <Info className="h-4 w-4 text-blue-500 shrink-0" /> },
};

function AnnouncementsCard() {
  const { announcements, loading } = useAnnouncements();
  const [expanded, setExpanded] = useState<number | null>(null);
  const sorted = [...announcements].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-primary" />
          <CardTitle>Duyurular</CardTitle>
          {announcements.length > 0 && (
            <span className="h-5 px-1.5 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">
              {announcements.length}
            </span>
          )}
        </div>
        <Link href="/admin/announcements" className="text-xs text-primary hover:underline font-medium flex items-center gap-1">
          Yönet <ChevronRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {loading ? (
          <div className="space-y-2.5">
            {[1, 2].map(i => (
              <div key={i} className="h-16 bg-secondary/50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Megaphone className="h-10 w-10 mx-auto mb-2 opacity-20" />
            <p className="text-sm">Henüz duyuru yok</p>
          </div>
        ) : sorted.map(ann => {
          const cfg = PRIORITY_CONFIG[ann.priority] ?? PRIORITY_CONFIG.low;
          const isOpen = expanded === ann.id;
          return (
            <button
              key={ann.id}
              onClick={() => setExpanded(isOpen ? null : ann.id)}
              className={`w-full text-left border-l-4 rounded-xl p-4 transition-all hover:shadow-sm ${cfg.color}`}
            >
              <div className="flex items-start gap-3">
                {cfg.icon}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-sm text-foreground truncate">{ann.title}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {new Date(ann.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                      </span>
                      <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {ann.authorName}
                    {ann.courseTitle ? ` · ${ann.courseTitle}` : ''}
                  </p>
                  {isOpen && (
                    <p className="text-sm text-foreground mt-2 leading-relaxed border-t border-black/5 pt-2">
                      {ann.content}
                    </p>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}

function TeacherDashboard() {
  const { data: stats } = useGetDashboardStats();
  
  return (
    <div className="space-y-8">
      {/* İstatistik kartları */}
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Sol: Duyurular */}
        <div className="lg:col-span-2">
          <AnnouncementsCard />
        </div>

        {/* Sağ: Hızlı İşlemler */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Hızlı İşlemler</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/teacher/courses">
                <Button className="w-full justify-start gap-2">
                  <BookOpen className="h-4 w-4" /> Kurs Oluştur
                </Button>
              </Link>
              <Link href="/teacher/live-classes">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Video className="h-4 w-4" /> Ders Planla
                </Button>
              </Link>
              <Link href="/teacher/students">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Users className="h-4 w-4" /> Öğrencilerim
                </Button>
              </Link>
              <Link href="/teacher/messages">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Megaphone className="h-4 w-4" /> Mesaj Gönder
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function useActiveUsers() {
  const [data, setData] = useState<{ count: number; users: Array<{ userId: number; name: string; role: string; page: string; lastSeenAgo: number }> } | null>(null);

  useEffect(() => {
    const fetch_ = () => {
      const token = localStorage.getItem("sphere_token");
      fetch(`${API}/presence/active`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(d => setData(d))
        .catch(() => {});
    };
    fetch_();
    const id = setInterval(fetch_, 30_000);
    return () => clearInterval(id);
  }, []);

  return data;
}

function pageLabelTR(path: string) {
  if (path.includes("simulation")) return "İş Senaryoları";
  if (path.includes("pronunciation")) return "Telaffuz Koçu";
  if (path.includes("writing")) return "Yazma Koçu";
  if (path.includes("grammar")) return "Dilbilgisi Koçu";
  if (path.includes("lesson")) return "Ders";
  if (path.includes("course")) return "Kurs";
  if (path.includes("live")) return "Canlı Ders";
  if (path.includes("quiz")) return "Quiz";
  if (path.includes("forum")) return "Forum";
  if (path.includes("dashboard")) return "Ana Sayfa";
  if (path.includes("ai-studio")) return "AI Studio";
  return "Uygulama";
}

function roleIconEl(role: string) {
  if (role === "admin") return <span title="Admin" className="text-red-500"><LayoutDashboard size={13}/></span>;
  if (role === "teacher") return <span title="Öğretmen" className="text-violet-500"><GraduationCap size={13}/></span>;
  return <span title="Öğrenci" className="text-sky-500"><BookOpen size={13}/></span>;
}

function AdminDashboard() {
  const { data: stats } = useGetAdminDashboard();
  const presence = useActiveUsers();
  const count = presence?.count ?? 0;
  
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Anlık online kullanıcı */}
        <Card className="md:col-span-2 lg:col-span-1 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-green-800">Şu An Online</p>
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
              </span>
            </div>
            <h3 className="text-4xl font-bold font-display text-green-700">{count}</h3>
            <p className="text-xs text-green-600 mt-1">aktif kullanıcı</p>
          </CardContent>
        </Card>

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

      {/* Online kullanıcı listesi — her zaman göster */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Wifi size={16} className={count > 0 ? "text-green-500" : "text-muted-foreground"} />
            Online Kullanıcılar
            {count > 0 && <Badge variant="secondary" className="ml-1 bg-green-100 text-green-700">{count}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {count === 0 ? (
            <p className="text-sm text-muted-foreground py-2">Şu an aktif kullanıcı yok.</p>
          ) : (
            <div className="divide-y divide-border">
              {presence?.users.map(u => (
                <div key={u.userId} className="flex items-center justify-between py-2.5 gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {roleIconEl(u.role)}
                    <span className="font-medium text-sm truncate">{u.name}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      {pageLabelTR(u.page)}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {u.lastSeenAgo < 60 ? `${u.lastSeenAgo}s` : `${Math.floor(u.lastSeenAgo / 60)}dk`} önce
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();

  if (user?.role === 'partner') return <Redirect to="/partner" />;
  if (user?.role === 'corporate') return <Redirect to="/corporate/dashboard" />;
  if (user?.role === 'admin') return <AdminDashboard />;
  if (user?.role === 'teacher') return <TeacherDashboard />;
  return <StudentDashboard />;
}
