import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { 
  BookOpen, LayoutDashboard, Video, FileQuestion, LineChart, 
  Award, MessageSquare, Users, Megaphone, LogOut, Menu, Building2, BarChart3, GraduationCap, Mic, MessageCircle, FolderOpen, PenLine, TrendingUp, Settings2, Gamepad2
} from "lucide-react";
import { Avatar } from "../ui/core";

const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

type FeatureSetting = { key: string; isEnabled: boolean; visibleTo: string[] };

type NavItem = {
  name: string;
  href: string;
  icon: React.ElementType;
  moduleKey?: string;
};

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [featureSettings, setFeatureSettings] = useState<FeatureSetting[]>([]);

  useEffect(() => {
    const token = localStorage.getItem("sphere_token");
    if (!token) return;
    fetch(`${API}/feature-settings`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : [])
      .then(d => Array.isArray(d) ? setFeatureSettings(d) : null)
      .catch(() => {});
  }, []);

  const navigation: Record<string, NavItem[]> = {
    student: [
      { name: 'Kontrol Paneli',      href: '/dashboard',                     icon: LayoutDashboard },
      { name: 'Kurslarım',           href: '/courses',                        icon: BookOpen },
      { name: 'Materyallerim',       href: '/student/materials',              icon: FolderOpen,    moduleKey: 'student-materials' },
      { name: 'Ders Takvimim',       href: '/live-classes',                   icon: Video,         moduleKey: 'student-live-classes' },
      { name: 'Alıştırmalar',        href: '/quizzes',                        icon: FileQuestion,  moduleKey: 'student-quizzes' },
      { name: 'Speaking Club',       href: '/student/speaking-club',          icon: Mic,           moduleKey: 'student-speaking-club' },
      { name: 'Telaffuz Koçu 🤖',    href: '/student/pronunciation-coach',    icon: Mic,           moduleKey: 'student-pronunciation-coach' },
      { name: 'Yazma Koçu 🤖',       href: '/student/writing-coach',          icon: PenLine,       moduleKey: 'student-writing-coach' },
      { name: 'Kelime Oyunu 🎮',     href: '/student/vocab-game',             icon: Gamepad2,      moduleKey: 'student-vocab-game' },
      { name: 'Forum',               href: '/forum',                          icon: MessageCircle, moduleKey: 'student-forum' },
      { name: 'İlerleme Durumum',    href: '/progress',                       icon: LineChart,     moduleKey: 'student-progress' },
      { name: 'Sertifikalar',        href: '/certificates',                   icon: Award,         moduleKey: 'student-certificates' },
      { name: 'Sıralama',            href: '/leaderboard',                    icon: Users,         moduleKey: 'student-leaderboard' },
      { name: 'Mesajlar',            href: '/messages',                       icon: MessageSquare },
    ],
    teacher: [
      { name: 'Kontrol Paneli',      href: '/dashboard',                      icon: LayoutDashboard },
      { name: 'Kurslarımı Yönet',    href: '/teacher/courses',                icon: BookOpen },
      { name: 'Materyaller',         href: '/teacher/materials',              icon: FolderOpen,    moduleKey: 'teacher-materials' },
      { name: 'Canlı Oturumlar',     href: '/teacher/live-classes',           icon: Video,         moduleKey: 'teacher-live-classes' },
      { name: 'Öğrencilerim',        href: '/teacher/students',               icon: Users },
      { name: 'Öğrenci İlerlemesi',  href: '/teacher/progress',               icon: LineChart },
      { name: 'Quiz Yönetimi',       href: '/teacher/quizzes',                icon: FileQuestion,  moduleKey: 'teacher-quizzes' },
      { name: 'Speaking Club',       href: '/teacher/speaking-club',          icon: Mic,           moduleKey: 'teacher-speaking-club' },
      { name: 'Mesajlar',            href: '/teacher/messages',               icon: MessageSquare },
    ],
    admin: [
      { name: 'Genel Bakış',         href: '/dashboard',                      icon: LayoutDashboard },
      { name: 'Kurumlar',            href: '/admin/companies',                icon: Building2 },
      { name: 'Kullanıcılar',        href: '/admin/users',                    icon: Users },
      { name: 'Öğretmenler',         href: '/admin/teachers',                 icon: GraduationCap },
      { name: 'Öğrenciler',          href: '/admin/students',                 icon: Users },
      { name: 'Gruplar',             href: '/admin/groups',                   icon: Users },
      { name: 'Tüm Kurslar',         href: '/admin/courses',                  icon: BookOpen },
      { name: 'Quiz Yönetimi',       href: '/teacher/quizzes',                icon: FileQuestion },
      { name: 'Materyaller',         href: '/admin/materials',                icon: FolderOpen },
      { name: 'Canlı Dersler',       href: '/admin/live-classes',             icon: Video },
      { name: 'Speaking Club',       href: '/admin/speaking-club',            icon: Mic },
      { name: 'Duyurular',           href: '/admin/announcements',            icon: Megaphone },
      { name: 'Sistem Raporları',    href: '/admin/reports',                  icon: LineChart },
      { name: 'MEB Aktivite Raporu', href: '/admin/meb-report',               icon: BarChart3 },
      { name: 'Pazarlama & E-posta', href: '/admin/marketing',                icon: TrendingUp },
      { name: 'Modül Yönetimi',      href: '/admin/modules',                  icon: Settings2 },
      { name: 'Kelime Oyunu 🎮',     href: '/student/vocab-game',             icon: Gamepad2 },
    ],
    corporate: [
      { name: 'Genel Bakış',         href: '/corporate/dashboard',            icon: LayoutDashboard },
      { name: 'Öğrencilerim',        href: '/corporate/students',             icon: Users },
      { name: 'Raporlar',            href: '/corporate/reports',              icon: BarChart3 },
    ],
  };

  const roleLabel: Record<string, string> = {
    admin: "Yönetici",
    teacher: "Öğretmen",
    student: "Öğrenci",
    corporate: "Kurum Yetkilisi",
  };

  function isVisible(item: NavItem): boolean {
    if (!item.moduleKey) return true;
    const setting = featureSettings.find(f => f.key === item.moduleKey);
    if (!setting) return true; // Ayar henüz yüklenmediyse göster
    if (!setting.isEnabled) return false;
    const role = user?.role ?? "student";
    const accountType = (user as any)?.accountType as string | undefined;

    if (role === "student") {
      // "student" = tüm öğrenciler
      if (setting.visibleTo.includes("student")) return true;
      // Spesifik tip kontrolü
      if (accountType === "bireysel" && setting.visibleTo.includes("bireysel_ogrenci")) return true;
      if (accountType === "kurumsal" && setting.visibleTo.includes("kurumsal_ogrenci")) return true;
      return false;
    }
    return setting.visibleTo.includes(role);
  }

  const rawNav = user ? navigation[user.role as keyof typeof navigation] || navigation.student : [];
  const currentNav = rawNav.filter(isVisible);

  const SidebarContent = () => (
    <>
      <div className="flex h-16 shrink-0 items-center px-5">
        <img
          src={`${import.meta.env.BASE_URL}images/logo-full.png`}
          alt="Sphere English"
          className="h-16 w-auto object-contain brightness-0 invert"
        />
      </div>

      {user?.role === 'corporate' && (user as any).company && (
        <div className="mx-4 mb-2 px-3 py-2 rounded-xl bg-sidebar-accent/30 border border-sidebar-border">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-accent shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-sidebar-foreground truncate">{(user as any).company.name}</p>
              <p className="text-xs text-sidebar-foreground/50">{(user as any).company.code}</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-y-auto px-4 py-4">
        <nav className="flex-1 space-y-1.5">
          {currentNav.map((item) => {
            const isActive = location === item.href || (location.startsWith(item.href) && item.href !== '/dashboard' && item.href !== '/corporate/dashboard');
            return (
              <Link 
                key={item.name} 
                href={item.href}
                className={`group flex items-center rounded-xl px-3 py-3 text-sm font-medium transition-all ${
                  isActive 
                    ? 'bg-sidebar-accent text-white shadow-inner' 
                    : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-white'
                }`}
                onClick={() => setIsMobileOpen(false)}
              >
                <item.icon className={`mr-3 h-5 w-5 flex-shrink-0 transition-colors ${isActive ? 'text-accent' : 'text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80'}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="flex shrink-0 border-t border-sidebar-border p-4">
        <div className="group block w-full shrink-0">
          <div className="flex items-center">
            <Avatar name={`${user?.firstName} ${user?.lastName}`} src={user?.avatar} />
            <div className="ml-3">
              <p className="text-sm font-medium text-sidebar-foreground">{user?.firstName} {user?.lastName}</p>
              <p className="text-xs font-medium text-sidebar-foreground/50 capitalize">{roleLabel[user?.role || ''] || user?.role} {user?.currentLevel ? `• ${user.currentLevel}` : ''}</p>
            </div>
            <button onClick={logout} className="ml-auto p-2 rounded-lg text-sidebar-foreground/50 hover:text-white hover:bg-sidebar-accent transition-colors" title="Çıkış Yap">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AnimatePresence>
        {isMobileOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsMobileOpen(false)} className="fixed inset-0 z-40 bg-foreground/50 backdrop-blur-sm lg:hidden" />
            <motion.div initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="fixed inset-y-0 left-0 z-50 w-72 bg-sidebar shadow-2xl lg:hidden flex flex-col">
              <SidebarContent />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="hidden lg:flex lg:w-72 lg:flex-col lg:fixed lg:inset-y-0 bg-sidebar shadow-xl">
        <SidebarContent />
      </div>

      <div className="flex flex-1 flex-col lg:pl-72 w-full">
        <header className="sticky top-0 z-10 flex h-16 flex-shrink-0 items-center gap-x-4 border-b border-border/50 bg-background/80 backdrop-blur-md px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
          <button type="button" className="-m-2.5 p-2.5 text-foreground lg:hidden" onClick={() => setIsMobileOpen(true)}>
            <Menu className="h-6 w-6" aria-hidden="true" />
          </button>
          <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6 items-center justify-between">
            <h1 className="text-xl font-bold font-display text-foreground hidden sm:block">
              {currentNav.find(n => n.href === location || location.startsWith(n.href))?.name || 'Kontrol Paneli'}
            </h1>
            <div className="flex items-center gap-x-4 lg:gap-x-6 ml-auto">
              {user?.role !== 'corporate' && (
                <div className="flex items-center gap-2 bg-secondary/50 px-4 py-1.5 rounded-full border border-border">
                  <span className="text-sm font-semibold">🔥 {user?.streak || 0} Günlük Seri</span>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
              {children}
            </motion.div>
          </div>
        </main>
      </div>
    </div>
  );
}
