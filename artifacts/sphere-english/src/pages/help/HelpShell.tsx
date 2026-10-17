import { type ReactNode } from "react";
import { Link } from "wouter";
import { ArrowLeft, LifeBuoy, LogIn } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

/**
 * Yardım merkezi sayfalarının ortak kabuğu — giriş gerektirmez.
 * Giriş yapılmışsa "Panele dön", değilse "Giriş yap" gösterir.
 */
export default function HelpShell({ children, title }: { children: ReactNode; title?: string }) {
  const { user, isAuthenticated } = useAuth();
  const home = user?.role === "admin" ? "/admin" : user?.role === "teacher" ? "/dashboard" : user?.role === "corporate" ? "/corporate/dashboard" : "/dashboard";

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <Link href="/yardim" className="flex items-center gap-2 font-bold text-[#1B365D]">
            <LifeBuoy size={20} className="text-sky-600" />
            <span>Yardım Merkezi</span>
            {title && <span className="hidden sm:inline text-slate-400 font-normal">/ {title}</span>}
          </Link>
          {isAuthenticated ? (
            <Link href={home} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1B365D] hover:text-sky-700">
              <ArrowLeft size={16} /> Panele dön
            </Link>
          ) : (
            <Link href="/login" className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-[#1B365D] hover:bg-[#15294a] px-3.5 py-1.5 rounded-full">
              <LogIn size={15} /> Giriş yap
            </Link>
          )}
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6 sm:py-10">{children}</main>
      <footer className="max-w-5xl mx-auto px-4 pb-10 pt-4 text-xs text-slate-400 flex flex-wrap gap-x-4 gap-y-1">
        <span>© Sphere English</span>
        <a href="https://www.sphereenglish.com/kvkk" className="hover:text-slate-600">KVKK</a>
        <a href="https://www.sphereenglish.com/gizlilik-politikasi" className="hover:text-slate-600">Gizlilik</a>
        <a href="mailto:info@sphereenglish.com" className="hover:text-slate-600">info@sphereenglish.com</a>
      </footer>
    </div>
  );
}
