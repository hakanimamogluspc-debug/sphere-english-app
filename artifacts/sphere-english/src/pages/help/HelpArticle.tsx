import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import { ChevronRight, Loader2, ThumbsDown, ThumbsUp, Check } from "lucide-react";
import { API } from "@/lib/api-url";
import HelpShell from "./HelpShell";
import Markdown from "@/components/help/Markdown";
import { CategoryIcon, ContactBox } from "./HelpCenter";

interface Article {
  id: number; slug: string; title: string; summary: string; bodyMd: string;
  categorySlug: string | null; categoryTitle: string | null; categoryIcon: string | null;
  helpfulYes: number; helpfulNo: number; updatedAt: string;
}
interface Related { slug: string; title: string; summary: string }

export default function HelpArticle() {
  const [, params] = useRoute("/yardim/:slug");
  const slug = params?.slug ?? "";
  const [article, setArticle] = useState<Article | null>(null);
  const [related, setRelated] = useState<Related[]>([]);
  const [state, setState] = useState<"loading" | "ok" | "notfound" | "error">("loading");

  useEffect(() => {
    setState("loading");
    window.scrollTo(0, 0);
    fetch(`${API}/help/articles/${encodeURIComponent(slug)}`)
      .then(async (r) => {
        if (r.status === 404) { setState("notfound"); return; }
        if (!r.ok) throw new Error();
        const d = await r.json();
        setArticle(d.article); setRelated(d.related ?? []); setState("ok");
        document.title = `${d.article.title} · Yardım Merkezi · Sphere English`;
      })
      .catch(() => setState("error"));
    return () => { document.title = "Sphere English"; };
  }, [slug]);

  return (
    <HelpShell title={article?.categoryTitle ?? undefined}>
      <nav className="text-sm text-slate-500 flex items-center gap-1 flex-wrap mb-4">
        <Link href="/yardim" className="hover:text-slate-800">Yardım Merkezi</Link>
        {article?.categorySlug && (
          <>
            <ChevronRight size={14} />
            <Link href={`/yardim?k=${article.categorySlug}`} className="hover:text-slate-800 inline-flex items-center gap-1">
              <CategoryIcon name={article.categoryIcon} size={14} /> {article.categoryTitle}
            </Link>
          </>
        )}
      </nav>

      {state === "loading" && <div className="py-16 flex justify-center text-slate-400"><Loader2 className="animate-spin" /></div>}
      {state === "notfound" && (
        <div className="rounded-2xl bg-white border border-slate-200 p-8 text-center">
          <p className="font-semibold text-slate-800">Bu makale bulunamadı ya da yayından kaldırıldı.</p>
          <Link href="/yardim" className="text-sky-700 font-semibold text-sm mt-2 inline-block">Yardım merkezine dön</Link>
        </div>
      )}
      {state === "error" && <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm">Makale yüklenemedi. Lütfen tekrar deneyin.</div>}

      {state === "ok" && article && (
        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          <article className="rounded-3xl bg-white border border-slate-200 p-5 sm:p-8">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 leading-tight">{article.title}</h1>
            <p className="text-slate-500 mt-2">{article.summary}</p>
            <hr className="my-5 border-slate-100" />
            <Markdown source={article.bodyMd} />
            <Feedback slug={article.slug} initialYes={article.helpfulYes} initialNo={article.helpfulNo} />
            <p className="text-xs text-slate-400 mt-4">Son güncelleme: {new Date(article.updatedAt).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}</p>
          </article>

          <aside className="space-y-4">
            {related.length > 0 && (
              <div className="rounded-2xl bg-white border border-slate-200 p-4">
                <div className="text-xs font-bold tracking-wider uppercase text-slate-400 mb-2">İlgili makaleler</div>
                <ul className="space-y-2">
                  {related.map((r) => (
                    <li key={r.slug}>
                      <Link href={`/yardim/${r.slug}`} className="text-sm font-semibold text-slate-800 hover:text-sky-700 leading-snug block">{r.title}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        </div>
      )}

      <ContactBox />
    </HelpShell>
  );
}

function Feedback({ slug, initialYes, initialNo }: { slug: string; initialYes: number; initialNo: number }) {
  const [vote, setVote] = useState<boolean | null>(null);
  const [counts, setCounts] = useState({ yes: initialYes, no: initialNo });
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const send = async (helpful: boolean, withComment?: string) => {
    setBusy(true);
    try {
      const token = localStorage.getItem("sphere_token");
      const r = await fetch(`${API}/help/articles/${encodeURIComponent(slug)}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ helpful, comment: withComment || undefined }),
      });
      const d = await r.json();
      if (r.ok) { setCounts({ yes: d.helpfulYes, no: d.helpfulNo }); setVote(helpful); if (withComment) setSent(true); }
    } finally { setBusy(false); }
  };

  return (
    <div className="mt-8 rounded-2xl bg-slate-50 border border-slate-200 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold text-slate-800">Bu makale faydalı oldu mu?</span>
        <button disabled={busy} onClick={() => send(true)} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border ${vote === true ? "bg-emerald-600 text-white border-emerald-600" : "bg-white border-slate-200 hover:border-emerald-300"}`}>
          <ThumbsUp size={14} /> Evet <span className="opacity-60">{counts.yes}</span>
        </button>
        <button disabled={busy} onClick={() => send(false)} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border ${vote === false ? "bg-slate-700 text-white border-slate-700" : "bg-white border-slate-200 hover:border-slate-400"}`}>
          <ThumbsDown size={14} /> Hayır <span className="opacity-60">{counts.no}</span>
        </button>
      </div>
      {vote === false && !sent && (
        <div className="mt-3 flex flex-col sm:flex-row gap-2">
          <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Neyi bulamadınız? (isteğe bağlı)" className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white" maxLength={500} />
          <button disabled={busy || !comment.trim()} onClick={() => send(false, comment.trim())} className="px-4 py-2 rounded-xl bg-[#1B365D] text-white text-sm font-semibold disabled:opacity-50">Gönder</button>
        </div>
      )}
      {sent && <p className="mt-2 text-sm text-emerald-700 inline-flex items-center gap-1"><Check size={14} /> Teşekkürler, notunuz ekibe iletildi.</p>}
      {vote === true && <p className="mt-2 text-sm text-emerald-700 inline-flex items-center gap-1"><Check size={14} /> Teşekkürler!</p>}
    </div>
  );
}
