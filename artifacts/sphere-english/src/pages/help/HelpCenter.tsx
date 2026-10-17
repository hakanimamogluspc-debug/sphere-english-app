import { useEffect, useMemo, useState, type ComponentType } from "react";
import { Link, useLocation } from "wouter";
import {
  Search, ChevronRight, Loader2, Rocket, UserCircle, Video, Sparkles, TrendingUp, BookOpen,
  CreditCard, Building2, ShieldCheck, FolderOpen, MessageSquarePlus,
} from "lucide-react";
import { API } from "@/lib/api-url";
import HelpShell from "./HelpShell";

const ICONS: Record<string, ComponentType<{ size?: number; className?: string }>> = {
  Rocket, UserCircle, Video, Sparkles, TrendingUp, BookOpen, CreditCard, Building2, ShieldCheck,
};
export function CategoryIcon({ name, size = 20, className }: { name?: string | null; size?: number; className?: string }) {
  const Icon = (name && ICONS[name]) || FolderOpen;
  return <Icon size={size} className={className} />;
}

interface Category { id: number; slug: string; title: string; description: string | null; icon: string | null; articleCount: number }
interface Article { id: number; slug: string; title: string; summary: string; categorySlug: string | null; categoryTitle: string | null; categoryIcon: string | null }

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

export default function HelpCenter() {
  const [location, navigate] = useLocation();
  const params = useMemo(() => new URLSearchParams(window.location.search), [location]);
  const activeCat = params.get("k") ?? "";
  const [q, setQ] = useState(params.get("q") ?? "");
  const dq = useDebounced(q.trim(), 300);

  const [cats, setCats] = useState<Category[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/help/categories`).then((r) => r.json()).then((d) => setCats(d.categories ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    const u = new URLSearchParams();
    if (activeCat) u.set("category", activeCat);
    if (dq) u.set("q", dq);
    u.set("source", "app");
    setLoading(true);
    fetch(`${API}/help/articles?${u}`)
      .then((r) => r.json())
      .then((d) => { setArticles(d.articles ?? []); setErr(null); })
      .catch((e) => setErr(e?.message || "Yüklenemedi"))
      .finally(() => setLoading(false));
  }, [activeCat, dq]);

  const setCat = (slug: string) => {
    const u = new URLSearchParams(window.location.search);
    if (slug) u.set("k", slug); else u.delete("k");
    navigate(`/yardim${u.toString() ? `?${u}` : ""}`);
  };

  const grouped = useMemo(() => {
    if (dq || activeCat) return null;
    const m = new Map<string, Article[]>();
    for (const a of articles) {
      const key = a.categorySlug ?? "diger";
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(a);
    }
    return m;
  }, [articles, dq, activeCat]);

  const activeCatObj = cats.find((c) => c.slug === activeCat);

  return (
    <HelpShell>
      {/* Hero + arama */}
      <section className="rounded-3xl bg-[#1B365D] text-white px-5 py-8 sm:px-10 sm:py-12 mb-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold">Size nasıl yardımcı olabiliriz?</h1>
        <p className="text-white/70 mt-1.5 text-sm sm:text-base">Hesap, dersler, AI koçlar, e-kitaplar, fatura — kısa ve net cevaplar.</p>
        <div className="mt-5 relative max-w-xl">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Örn: şifremi unuttum, fatura, seviye sınavı"
            className="w-full rounded-2xl bg-white text-slate-900 pl-11 pr-4 py-3.5 text-[15px] outline-none ring-2 ring-transparent focus:ring-sky-400"
            autoFocus
          />
        </div>
      </section>

      {/* Kategori çipleri */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
        <button onClick={() => setCat("")} className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm font-semibold border ${!activeCat ? "bg-[#1B365D] text-white border-[#1B365D]" : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"}`}>
          Tümü
        </button>
        {cats.map((c) => (
          <button key={c.slug} onClick={() => setCat(c.slug)} className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-semibold border ${activeCat === c.slug ? "bg-[#1B365D] text-white border-[#1B365D]" : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"}`}>
            <CategoryIcon name={c.icon} size={14} /> {c.title}
            <span className={`text-xs ${activeCat === c.slug ? "text-white/70" : "text-slate-400"}`}>{c.articleCount}</span>
          </button>
        ))}
      </div>

      {err && <div className="mt-6 p-3 rounded-xl bg-red-50 text-red-700 text-sm">{err}</div>}
      {loading && <div className="mt-10 flex justify-center text-slate-400"><Loader2 className="animate-spin" /></div>}

      {!loading && (dq || activeCat) && (
        <section className="mt-6">
          <h2 className="text-lg font-bold text-slate-800 mb-3">
            {dq ? <>“{dq}” için {articles.length} sonuç</> : activeCatObj?.title}
          </h2>
          {articles.length === 0 ? (
            <EmptyState q={dq} />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {articles.map((a) => <ArticleCard key={a.id} a={a} />)}
            </ul>
          )}
        </section>
      )}

      {!loading && grouped && (
        <div className="mt-6 space-y-10">
          {cats.filter((c) => grouped.has(c.slug)).map((c) => (
            <section key={c.slug}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
                  <span className="w-8 h-8 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center"><CategoryIcon name={c.icon} size={16} /></span>
                  {c.title}
                </h2>
                <button onClick={() => setCat(c.slug)} className="text-sm font-semibold text-sky-700 hover:underline inline-flex items-center gap-0.5">
                  Tümü <ChevronRight size={14} />
                </button>
              </div>
              <ul className="grid gap-3 sm:grid-cols-2">
                {grouped.get(c.slug)!.slice(0, 4).map((a) => <ArticleCard key={a.id} a={a} />)}
              </ul>
            </section>
          ))}
        </div>
      )}

      <ContactBox />
    </HelpShell>
  );
}

function ArticleCard({ a }: { a: Article }) {
  return (
    <li>
      <Link href={`/yardim/${a.slug}`} className="block h-full rounded-2xl bg-white border border-slate-200 p-4 hover:border-sky-300 hover:shadow-sm transition">
        <div className="font-semibold text-slate-900 leading-snug">{a.title}</div>
        <p className="text-sm text-slate-500 mt-1 line-clamp-2">{a.summary}</p>
      </Link>
    </li>
  );
}

function EmptyState({ q }: { q: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
      <p className="text-slate-700 font-semibold">Bu konuda henüz bir makale yok.</p>
      <p className="text-sm text-slate-500 mt-1">Farklı bir kelimeyle arayın ya da bize doğrudan yazın — {q ? "aramanız kaydedildi, eksik konuları buna göre ekliyoruz." : "genelde aynı gün dönüyoruz."}</p>
    </div>
  );
}

export function ContactBox() {
  return (
    <section className="mt-12 rounded-3xl bg-white border border-slate-200 p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="flex-1">
        <h3 className="font-bold text-slate-900 text-lg">Cevabı bulamadınız mı?</h3>
        <p className="text-sm text-slate-500 mt-1">Uygulama içinden <b>Bize bildir</b> butonuyla ya da e-postayla ulaşın; hafta içi genellikle aynı gün yanıtlıyoruz.</p>
      </div>
      <div className="flex gap-2">
        <a href="mailto:info@sphereenglish.com" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1B365D] text-white text-sm font-semibold hover:bg-[#15294a]">
          <MessageSquarePlus size={16} /> E-posta gönder
        </a>
        <a href="https://wa.me/905066085810" target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:border-slate-300">
          WhatsApp
        </a>
      </div>
    </section>
  );
}
