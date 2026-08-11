import { useAuth } from "@/hooks/use-auth";
import { useFeature } from "@/hooks/use-feature";
import { useGetDashboardStats, useGetMyProgress, useGetAdminDashboard } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from "@/components/ui/core";
import { formatDateTime, getLevelColor } from "@/lib/utils";
import { Trophy, Flame, BookOpen, Video, Users, CheckCircle, TrendingUp, DollarSign, Megaphone, AlertCircle, Info, ChevronRight, Wifi, BookMarked, Cpu, LayoutDashboard, GraduationCap, Newspaper, Compass, Sparkles } from "lucide-react";
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
      <WordOfDayWidget />
      <RecommendedArticlesWidget />
      <CareerRecommendedWidget />
    </div>
  );
}

// ─── Hızlı Erişim ─────────────────────────────────────────────────────
type QuickAction = {
  label: string;
  subtitle: string;
  href: string;
  icon: any;
  bg: string;
  accent: string;    // decorative blob color
  featureKey?: string;
};

const QUICK_ACTIONS: QuickAction[] = [
  { label: "AI Öğretmen",       subtitle: "Sohbet ederek öğren",     href: "/student/ai-tutor",           icon: GraduationCap, bg: "from-indigo-600 via-indigo-700 to-blue-800",     accent: "bg-blue-400",    featureKey: "student-ai-tutor" },
  { label: "Konuşma Sahneleri", subtitle: "Rol yaparak konuş",       href: "/student/speaking-scenes",    icon: Cpu,           bg: "from-teal-600 via-emerald-700 to-emerald-800",    accent: "bg-teal-300",    featureKey: "student-speaking-scenes" },
  { label: "Yazma Koçu",        subtitle: "Metnini geliştir",        href: "/student/writing-coach",      icon: BookMarked,    bg: "from-orange-500 via-rose-600 to-pink-700",        accent: "bg-orange-300",  featureKey: "student-writing-coach" },
  { label: "Dilbilgisi Koçu",   subtitle: "Kurallara hakim ol",      href: "/student/grammar-coach",      icon: Cpu,           bg: "from-purple-600 via-fuchsia-700 to-pink-700",     accent: "bg-fuchsia-300", featureKey: "student-grammar-coach" },
  { label: "Kelime Oyunu",      subtitle: "Kelime dağarcığını aç",   href: "/student/vocab-game",         icon: Trophy,        bg: "from-amber-500 via-orange-600 to-red-600",        accent: "bg-yellow-300",  featureKey: "student-vocab-game" },
  { label: "Keşfet",            subtitle: "Haberler & makaleler",    href: "/kesfet",                     icon: Newspaper,     bg: "from-sky-500 via-cyan-600 to-blue-700",           accent: "bg-cyan-300" },
];

function QuickAccessGrid() {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" /> Hızlı Erişim
        </h2>
        <span className="text-xs text-muted-foreground">Öğrenme araçların tek tıkla</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {QUICK_ACTIONS.map(a => (
          <QuickAccessBtn key={a.href} action={a} />
        ))}
      </div>
    </div>
  );
}

function QuickAccessBtn({ action }: { action: QuickAction }) {
  const enabled = useFeature(action.featureKey);
  if (!enabled) return null;
  const Icon = action.icon;
  return (
    <Link href={action.href}>
      <div
        className={`group relative aspect-[4/5] rounded-2xl bg-gradient-to-br ${action.bg} text-white cursor-pointer overflow-hidden shadow-md hover:shadow-2xl hover:-translate-y-1 transition-all duration-300`}
      >
        {/* Decorative blob */}
        <div className={`absolute -top-8 -right-8 w-24 h-24 rounded-full ${action.accent} opacity-30 blur-2xl group-hover:opacity-50 group-hover:scale-110 transition-all duration-500`} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent pointer-events-none" />

        {/* Corner accent line */}
        <div className="absolute top-0 left-0 w-full h-0.5 bg-white/30" />

        {/* Content */}
        <div className="relative h-full flex flex-col p-4">
          {/* Icon badge */}
          <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/30 shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
            <Icon className="h-5 w-5 text-white" strokeWidth={2.2} />
          </div>

          {/* Title + subtitle at bottom */}
          <div className="mt-auto">
            <div className="text-base font-bold leading-tight tracking-tight">{action.label}</div>
            <div className="text-[11px] font-medium text-white/80 mt-0.5 leading-snug">{action.subtitle}</div>
          </div>

          {/* Arrow icon on hover */}
          <ChevronRight className="absolute bottom-3 right-3 h-4 w-4 text-white/0 group-hover:text-white/80 group-hover:translate-x-0.5 transition-all duration-300" />
        </div>
      </div>
    </Link>
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

function WordOfDayWidget() {
  const [word, setWord] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const token = localStorage.getItem("sphere_token");
    fetch(`${API}/word-of-day/today`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setWord(d.word))
      .catch(() => setWord(null))
      .finally(() => setLoading(false));
  }, []);
  if (loading || !word) return null;

  return (
    <Card className="overflow-hidden bg-gradient-to-br from-indigo-600 via-blue-600 to-teal-600 text-white border-0">
      <CardContent className="p-6 md:p-7 flex flex-col md:flex-row md:items-center gap-5">
        <div className="flex-1">
          <div className="text-[11px] uppercase tracking-wider opacity-80 font-bold mb-2">Bugünün Kelimesi</div>
          <div className="flex items-baseline gap-3 flex-wrap">
            <h2 className="text-3xl md:text-4xl font-bold leading-tight">{word.word}</h2>
            {word.phonetic && <span className="text-white/80 font-mono text-sm">/{word.phonetic}/</span>}
            {word.part_of_speech && <span className="bg-white/20 backdrop-blur text-xs px-2 py-0.5 rounded-full font-semibold">{word.part_of_speech}</span>}
          </div>
          {word.tr_meaning && (
            <div className="mt-3">
              <div className="text-[10px] uppercase tracking-wider opacity-70 font-bold mb-1">Türkçe</div>
              <div className="text-lg font-semibold">{word.tr_meaning}</div>
            </div>
          )}
          {word.definition_en && (
            <p className="mt-3 text-sm text-white/90 leading-relaxed">
              <span className="opacity-70 text-xs mr-1">EN:</span>{word.definition_en}
            </p>
          )}
          {word.tr_note && (
            <p className="mt-2 text-xs text-white/80 italic border-l-2 border-white/30 pl-3">{word.tr_note}</p>
          )}
        </div>
        <div className="hidden md:block text-6xl opacity-20 select-none">📖</div>
      </CardContent>
    </Card>
  );
}

function CareerRecommendedWidget() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const token = localStorage.getItem("sphere_token");
    fetch(`${API}/career/recommended?limit=3`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setItems(Array.isArray(d.items) ? d.items : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);
  if (loading || items.length === 0) return null;
  const catLabel: Record<string, string> = {
    career: "Kariyer", motivation: "Motivasyon", entrepreneurship: "Girişimcilik",
    leadership: "Liderlik", productivity: "Verimlilik",
  };
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <Compass className="h-5 w-5 text-primary" />
          <CardTitle>Bu Hafta İzle & Dinle</CardTitle>
        </div>
        <Link href="/kariyer" className="text-xs text-primary hover:underline font-medium flex items-center gap-1">
          Tümünü Gör <ChevronRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {items.map((it: any) => (
            <a key={it.id} href={it.url} target="_blank" rel="noreferrer"
              className="rounded-lg border hover:border-primary/50 hover:shadow transition overflow-hidden group flex flex-col bg-card">
              {it.thumbnail_url ? (
                <div className="aspect-video bg-gray-100 overflow-hidden relative">
                  <img src={it.thumbnail_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition" />
                  <div className="absolute top-2 left-2 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase">
                    {it.source_type}
                  </div>
                </div>
              ) : (
                <div className="aspect-video bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center">
                  <Compass className="h-8 w-8 text-primary/40" />
                </div>
              )}
              <div className="p-3 space-y-1.5 flex-1 flex flex-col">
                <div className="flex items-center gap-1 text-[10px] font-semibold">
                  {it.category && <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary">{catLabel[it.category] || it.category}</span>}
                  <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase">{it.language}</span>
                </div>
                <h4 className="text-sm font-semibold text-foreground line-clamp-2 leading-snug">{it.title}</h4>
                {it.tr_summary && <p className="text-xs text-muted-foreground line-clamp-2">{it.tr_summary}</p>}
              </div>
            </a>
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
