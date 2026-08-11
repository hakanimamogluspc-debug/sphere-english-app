import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen, LayoutDashboard, Video, FileQuestion, LineChart,
  Award, MessageSquare, Users, Megaphone, LogOut, Menu, Building2, BarChart3, GraduationCap, Mic, MessageCircle, FolderOpen, PenLine, TrendingUp, Settings2, Gamepad2, Crown, Lock,
  Sparkles, ChevronDown, Brain, Briefcase, Presentation, Wand2, Compass, Bot, Activity, UserPlus, ShoppingBag, Phone, UserCircle, Ticket, HardDrive, Package, Receipt, Mail, ChevronLeft, ChevronRight, Calendar, Newspaper
} from "lucide-react";
import { Avatar } from "../ui/core";
import { NotificationBell } from "../NotificationBell";

const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

type FeatureSetting = { key: string; isEnabled: boolean; visibleTo: string[] };

type NavItem = {
  name: string;
  href: string;
  icon: React.ElementType;
  moduleKey?: string;
  group?: 'ai-studio';
};

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [featureSettings, setFeatureSettings] = useState<FeatureSetting[]>([]);
  // Sidebar collapse — desktop için
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('sphere_sidebar_collapsed') === '1';
  });
  useEffect(() => {
    localStorage.setItem('sphere_sidebar_collapsed', isCollapsed ? '1' : '0');
  }, [isCollapsed]);

  const AI_STUDIO_HREFS = [
    '/student/pronunciation-coach',
    '/student/writing-coach',
    '/student/vocab-game',
    '/student/grammar-coach',
    '/student/speaking-scenes',
  ];
  const isAiStudioPage = AI_STUDIO_HREFS.some(h => location === h || location.startsWith(h));
  const [isAiStudioOpen, setIsAiStudioOpen] = useState(isAiStudioPage);

  useEffect(() => {
    if (isAiStudioPage) setIsAiStudioOpen(true);
  }, [location]);

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
      { name: 'Kurslarım',           href: '/courses',                        icon: BookOpen,      moduleKey: 'student-courses' },
      { name: 'Materyallerim',       href: '/student/materials',              icon: FolderOpen,    moduleKey: 'student-materials' },
      { name: 'Keşfet',              href: '/kesfet',                         icon: Newspaper },
      { name: 'İzle & Dinle',        href: '/kariyer',                        icon: Compass },
      { name: 'Raporum',             href: '/raporum',                        icon: BarChart3 },
      { name: 'Ders Takvimim',       href: '/live-classes',                   icon: Video,         moduleKey: 'student-live-classes' },
      { name: 'Alıştırmalar',        href: '/quizzes',                        icon: FileQuestion,  moduleKey: 'student-quizzes' },
      { name: 'Speaking Club',       href: '/student/speaking-club',          icon: Mic,           moduleKey: 'student-speaking-club' },
      { name: 'Telaffuz Koçu',       href: '/student/pronunciation-coach',    icon: Mic,           moduleKey: 'student-pronunciation-coach', group: 'ai-studio' },
      { name: 'Konuşma Sahneleri',   href: '/student/speaking-scenes',        icon: Mic,           moduleKey: 'student-speaking-scenes',      group: 'ai-studio' },
      { name: 'Yazma Koçu',          href: '/student/writing-coach',          icon: PenLine,       moduleKey: 'student-writing-coach',        group: 'ai-studio' },
      { name: 'Kelime Oyunu',        href: '/student/vocab-game',             icon: Gamepad2,      moduleKey: 'student-vocab-game',           group: 'ai-studio' },
      { name: 'Dilbilgisi Koçu',    href: '/student/grammar-coach',          icon: Brain,         moduleKey: 'student-grammar-coach',        group: 'ai-studio' },
      { name: 'İş Senaryoları',     href: '/student/simulation-mode',        icon: Briefcase,     moduleKey: 'student-simulation-mode',      group: 'ai-studio' },
      { name: 'Mülakat Simülatörü', href: '/student/interview-sim',          icon: GraduationCap, moduleKey: 'student-interview-sim',        group: 'ai-studio' },
      { name: 'Sunum Simülatörü',   href: '/student/presentation-sim',       icon: Presentation,  moduleKey: 'student-presentation-sim',     group: 'ai-studio' },
      { name: 'Akıllı Quiz Üretici', href: '/student/ai-quiz',               icon: Wand2,         moduleKey: 'student-ai-quiz',              group: 'ai-studio' },
      { name: 'Kişisel AI Öğretmen', href: '/student/ai-tutor',              icon: GraduationCap, moduleKey: 'student-ai-tutor',             group: 'ai-studio' },
      { name: 'Adaptif Öğrenme Yolu', href: '/student/learning-path',        icon: Compass,       moduleKey: 'student-learning-path',        group: 'ai-studio' },
      { name: 'Seviye Geçme Sınavı', href: '/student/level-exams',           icon: GraduationCap, moduleKey: 'student-level-exams' },
      // Abonelik kaldırıldı — uygulama herkes için ücretsiz
      // { name: 'Aboneliğim',          href: '/student/subscription',           icon: Crown,         moduleKey: 'student-subscription' },
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
      { name: 'Aktivite Analizi',    href: '/admin/analytics',                icon: Activity },
      { name: 'Mail Şablonları',     href: '/admin/mail-sablonlari',          icon: Mail },
      { name: 'Demo Randevular',     href: '/admin/demo',                     icon: Calendar },
      { name: 'İçerik Kütüphanesi',  href: '/admin/content',                  icon: Newspaper },
      { name: 'Kariyer & Motivasyon',href: '/admin/career',                   icon: Compass },
      { name: 'Konuşma Sahneleri',   href: '/admin/scenes',                   icon: Mic },
      { name: 'Eğitmen Başvuruları', href: '/admin/teacher-applications',     icon: UserPlus },
      { name: 'E-Kitap Yönetimi',    href: '/admin/ebooks',                   icon: BookOpen },
      { name: 'E-Kitap Paketleri',   href: '/admin/bundles',                  icon: Package },
      { name: 'E-Kitap Satışları',   href: '/admin/ebook-purchases',          icon: ShoppingBag },
      { name: 'E-Faturalar',         href: '/admin/faturalar',                icon: Receipt },
      { name: 'MEB Aktivite Raporu', href: '/admin/meb-report',               icon: BarChart3 },
      { name: 'Pazarlama & E-posta', href: '/admin/marketing',                icon: TrendingUp },
      { name: 'Web Analiz',          href: '/admin/web-analytics',            icon: Activity },
      { name: 'Chatbot (Sphere Asistan)', href: '/admin/chatbot',             icon: Bot },
      { name: 'Instagram Bot',       href: '/admin/instagram-bot',            icon: MessageCircle },
      { name: 'WhatsApp Bot',        href: '/admin/whatsapp-bot',             icon: Phone },
      { name: 'Affiliate Program',   href: '/admin/affiliates',               icon: Award },
      { name: 'Kupon Kodları',       href: '/admin/coupons',                  icon: Ticket },
      { name: 'DB Yedekleri',        href: '/admin/backups',                  icon: HardDrive },
      { name: 'Smoke Testleri',      href: '/admin/smoke-tests',              icon: Activity },
      { name: 'Modül Yönetimi',      href: '/admin/modules',                  icon: Settings2 },
      { name: 'Abonelikler',         href: '/admin/subscriptions',            icon: Crown },
      { name: 'Kelime Oyunu 🎮',     href: '/student/vocab-game',             icon: Gamepad2 },
    ],
    corporate: [
      { name: 'Genel Bakış',         href: '/corporate/dashboard',            icon: LayoutDashboard },
      { name: 'Öğrencilerim',        href: '/corporate/students',             icon: Users },
      { name: 'Raporlar',            href: '/corporate/reports',              icon: BarChart3 },
      { name: 'AI Performans Raporu', href: '/corporate/ai-report',           icon: Sparkles },
    ],
    partner: [
      { name: 'Partner Paneli',      href: '/partner',                        icon: Award },
      { name: 'Profilim',            href: '/profile',                        icon: UserCircle },
    ],
  };

  const roleLabel: Record<string, string> = {
    admin: "Yönetici",
    teacher: "Öğretmen",
    student: "Öğrenci",
    corporate: "Kurum Yetkilisi",
    partner: "Sphere Partner",
  };

  function isVisible(item: NavItem): boolean {
    if (!item.moduleKey) return true;
    const setting = featureSettings.find(f => f.key === item.moduleKey);
    if (!setting) return true;
    if (!setting.isEnabled) return false;
    const role = user?.role ?? "student";
    const accountType = (user as any)?.accountType as string | undefined;

    if (role === "student") {
      if (setting.visibleTo.includes("student")) return true;
      if (accountType === "bireysel" && setting.visibleTo.includes("bireysel_ogrenci")) return true;
      if (accountType === "kurumsal" && setting.visibleTo.includes("kurumsal_ogrenci")) return true;
      return false;
    }
    return setting.visibleTo.includes(role);
  }

  const rawNav = user ? navigation[user.role as keyof typeof navigation] || navigation.student : [];
  const currentNav = rawNav.filter(isVisible);

  const firstAiIdx = currentNav.findIndex(i => i.group === 'ai-studio');
  const aiStudioItems = currentNav.filter(i => i.group === 'ai-studio');
  const lastAiIdx = firstAiIdx === -1 ? -1 : firstAiIdx + aiStudioItems.length - 1;
  const preGroupItems  = firstAiIdx === -1 ? currentNav : currentNav.slice(0, firstAiIdx);
  const postGroupItems = firstAiIdx === -1 ? [] : currentNav.slice(lastAiIdx + 1);

  const NavLink = ({ item, collapsed = false }: { item: NavItem; collapsed?: boolean }) => {
    const isActive = location === item.href || (location.startsWith(item.href) && item.href !== '/dashboard' && item.href !== '/corporate/dashboard');
    return (
      <Link
        key={item.name}
        href={item.href}
        title={collapsed ? item.name : undefined}
        className={`group flex items-center rounded-xl text-sm font-medium transition-all ${
          collapsed ? 'justify-center px-2 py-3' : 'px-3 py-3'
        } ${
          isActive
            ? 'bg-sidebar-accent text-white shadow-inner'
            : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-white'
        }`}
        onClick={() => setIsMobileOpen(false)}
      >
        <item.icon className={`${collapsed ? '' : 'mr-3'} h-5 w-5 flex-shrink-0 transition-colors ${isActive ? 'text-accent' : 'text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80'}`} />
        {!collapsed && item.name}
      </Link>
    );
  };

  const SidebarContent = ({ collapsed = false }: { collapsed?: boolean }) => (
    <>
      <div className={`flex h-16 shrink-0 items-center ${collapsed ? 'justify-center px-2' : 'px-5'}`}>
        {collapsed ? (
          <div className="h-9 w-9 rounded-lg bg-sidebar-accent flex items-center justify-center">
            <span className="text-white font-bold text-lg">S</span>
          </div>
        ) : (
          <img
            src={`${import.meta.env.BASE_URL}images/logo-full.png`}
            alt="Sphere English"
            className="h-16 w-auto object-contain brightness-0 invert"
          />
        )}
      </div>

      {!collapsed && user?.role === 'corporate' && (user as any).company && (
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

      <div className={`flex flex-1 flex-col overflow-y-auto py-4 ${collapsed ? 'px-2' : 'px-4'}`}>
        <nav className="flex-1 space-y-1.5">
          {preGroupItems.map(item => <NavLink key={item.href} item={item} collapsed={collapsed} />)}

          {aiStudioItems.length > 0 && (
            <div>
              {collapsed ? (
                // Collapsed modda dropdown yerine sadece Sparkles ikonu
                // Alt item'lar da ayrı ikonlar olarak listelenir
                <>
                  <div className="flex justify-center py-2" title="Sphere AI Studio">
                    <Sparkles className={`h-5 w-5 ${isAiStudioPage ? 'text-accent' : 'text-sidebar-foreground/40'}`} />
                  </div>
                  {aiStudioItems.map(item => <NavLink key={item.href} item={item} collapsed />)}
                </>
              ) : (
                <>
                  <button
                    onClick={() => setIsAiStudioOpen(o => !o)}
                    className={`w-full group flex items-center rounded-xl px-3 py-3 text-sm font-medium transition-all ${
                      isAiStudioPage && !isAiStudioOpen
                        ? 'bg-sidebar-accent text-white shadow-inner'
                        : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-white'
                    }`}
                  >
                    <Sparkles className={`mr-3 h-5 w-5 flex-shrink-0 transition-colors ${isAiStudioPage ? 'text-accent' : 'text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80'}`} />
                    <span className="flex-1 text-left">Sphere AI Studio</span>
                    <motion.div
                      animate={{ rotate: isAiStudioOpen ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronDown className="h-4 w-4 opacity-60" />
                    </motion.div>
                  </button>

                  <AnimatePresence initial={false}>
                    {isAiStudioOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease: 'easeInOut' }}
                        className="overflow-hidden"
                      >
                        <div className="mt-1 ml-3 pl-3 border-l border-sidebar-border/50 space-y-1">
                          {aiStudioItems.map(item => <NavLink key={item.href} item={item} />)}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}
            </div>
          )}

          {postGroupItems.map(item => <NavLink key={item.href} item={item} collapsed={collapsed} />)}
        </nav>
      </div>

      <div className={`flex shrink-0 border-t border-sidebar-border ${collapsed ? 'p-2' : 'p-4'}`}>
        <div className="group block w-full shrink-0">
          {collapsed ? (
            <div className="flex flex-col items-center gap-2">
              <div title={`${user?.firstName} ${user?.lastName}`}>
                <Avatar name={`${user?.firstName} ${user?.lastName}`} src={user?.avatar} />
              </div>
              <button onClick={logout} className="p-2 rounded-lg text-sidebar-foreground/50 hover:text-white hover:bg-sidebar-accent transition-colors" title="Çıkış Yap">
                <LogOut size={18} />
              </button>
            </div>
          ) : (
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
          )}
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

      <div className={`hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 bg-sidebar shadow-xl transition-[width] duration-200 ease-in-out ${isCollapsed ? 'lg:w-16' : 'lg:w-72'}`}>
        <SidebarContent collapsed={isCollapsed} />
      </div>

      <div className={`flex flex-1 flex-col w-full transition-[padding] duration-200 ease-in-out ${isCollapsed ? 'lg:pl-16' : 'lg:pl-72'}`}>
        <header className="sticky top-0 z-10 flex h-16 flex-shrink-0 items-center gap-x-4 border-b border-border/50 bg-background/80 backdrop-blur-md px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
          <button type="button" className="-m-2.5 p-2.5 text-foreground lg:hidden" onClick={() => setIsMobileOpen(true)}>
            <Menu className="h-6 w-6" aria-hidden="true" />
          </button>
          {/* Desktop collapse toggle */}
          <button
            type="button"
            onClick={() => setIsCollapsed(c => !c)}
            className="hidden lg:inline-flex p-2 rounded-lg text-foreground/60 hover:text-foreground hover:bg-secondary/50 transition-colors"
            title={isCollapsed ? 'Menüyü aç' : 'Menüyü daralt'}
          >
            {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
          </button>
          <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6 items-center justify-between">
            <h1 className="text-xl font-bold font-display text-foreground hidden sm:block">
              {isAiStudioPage
                ? 'Sphere AI Studio'
                : currentNav.find(n => n.href === location || location.startsWith(n.href))?.name || 'Kontrol Paneli'}
            </h1>
            <div className="flex items-center gap-x-3 lg:gap-x-4 ml-auto">
              {user?.role !== 'corporate' && (
                <div className="flex items-center gap-2 bg-secondary/50 px-4 py-1.5 rounded-full border border-border">
                  <span className="text-sm font-semibold">🔥 {user?.streak || 0} Günlük Seri</span>
                </div>
              )}
              <NotificationBell />
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
