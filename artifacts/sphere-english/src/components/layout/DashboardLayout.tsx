import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { 
  BookOpen, LayoutDashboard, Video, FileQuestion, LineChart, 
  Award, MessageSquare, Users, Megaphone, LogOut, Menu, X 
} from "lucide-react";
import { Avatar } from "../ui/core";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const navigation = {
    student: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { name: 'My Courses', href: '/courses', icon: BookOpen },
      { name: 'Live Classes', href: '/live-classes', icon: Video },
      { name: 'Exercises', href: '/quizzes', icon: FileQuestion },
      { name: 'My Progress', href: '/progress', icon: LineChart },
      { name: 'Certificates', href: '/certificates', icon: Award },
      { name: 'Leaderboard', href: '/leaderboard', icon: Users },
      { name: 'Messages', href: '/messages', icon: MessageSquare },
    ],
    teacher: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { name: 'Manage Courses', href: '/teacher/courses', icon: BookOpen },
      { name: 'Live Sessions', href: '/teacher/live-classes', icon: Video },
      { name: 'My Students', href: '/teacher/students', icon: Users },
      { name: 'Quiz Builder', href: '/teacher/quizzes', icon: FileQuestion },
      { name: 'Messages', href: '/messages', icon: MessageSquare },
    ],
    admin: [
      { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
      { name: 'Users', href: '/admin/users', icon: Users },
      { name: 'All Courses', href: '/admin/courses', icon: BookOpen },
      { name: 'Announcements', href: '/admin/announcements', icon: Megaphone },
      { name: 'System Reports', href: '/admin/reports', icon: LineChart },
    ]
  };

  const currentNav = user ? navigation[user.role as keyof typeof navigation] || navigation.student : [];

  const SidebarContent = () => (
    <>
      <div className="flex h-16 shrink-0 items-center px-6">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center text-white font-bold font-display text-xl shadow-lg shadow-accent/40">
            S
          </div>
          <span className="text-xl font-bold font-display text-sidebar-foreground tracking-tight">Sphere English</span>
        </div>
      </div>
      <div className="flex flex-1 flex-col overflow-y-auto px-4 py-4">
        <nav className="flex-1 space-y-1.5">
          {currentNav.map((item) => {
            const isActive = location === item.href || (location.startsWith(item.href) && item.href !== '/dashboard');
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
              <p className="text-xs font-medium text-sidebar-foreground/50 capitalize">{user?.role} {user?.currentLevel ? `• ${user.currentLevel}` : ''}</p>
            </div>
            <button onClick={logout} className="ml-auto p-2 rounded-lg text-sidebar-foreground/50 hover:text-white hover:bg-sidebar-accent transition-colors" title="Logout">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile Sidebar */}
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

      {/* Desktop Sidebar */}
      <div className="hidden lg:flex lg:w-72 lg:flex-col lg:fixed lg:inset-y-0 bg-sidebar shadow-xl">
        <SidebarContent />
      </div>

      {/* Main Content */}
      <div className="flex flex-1 flex-col lg:pl-72 w-full">
        <header className="sticky top-0 z-10 flex h-16 flex-shrink-0 items-center gap-x-4 border-b border-border/50 bg-background/80 backdrop-blur-md px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
          <button type="button" className="-m-2.5 p-2.5 text-foreground lg:hidden" onClick={() => setIsMobileOpen(true)}>
            <Menu className="h-6 w-6" aria-hidden="true" />
          </button>
          <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6 items-center justify-between">
            <h1 className="text-xl font-bold font-display text-foreground hidden sm:block">
              {currentNav.find(n => n.href === location || location.startsWith(n.href))?.name || 'Dashboard'}
            </h1>
            <div className="flex items-center gap-x-4 lg:gap-x-6 ml-auto">
              <div className="flex items-center gap-2 bg-secondary/50 px-4 py-1.5 rounded-full border border-border">
                <span className="text-sm font-semibold">🔥 {user?.streak || 0} Day Streak</span>
              </div>
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
