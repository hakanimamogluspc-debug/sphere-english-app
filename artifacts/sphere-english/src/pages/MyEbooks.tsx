import { useEffect, useState } from "react";
import { BookOpen, Loader2, ExternalLink, Sparkles } from "lucide-react";
import { API } from "@/lib/api-url";

/** /kitaplarim — kullanıcının satın aldığı e-kitaplar */

const TOKEN_KEY = "sphere_token";
const WWW = "https://www.sphereenglish.com";

interface OwnedEbook {
  id: number; slug: string; title: string; subtitle: string | null; author: string | null;
  category: string | null; coverImageUrl: string | null; pageCount: number | null;
  purchasedAt: string | null; hasFile: boolean;
}

function authHeaders(): HeadersInit {
  return { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY)}` };
}

export default function MyEbooks() {
  const [books, setBooks] = useState<OwnedEbook[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState<number | null>(null);

  useEffect(() => {
    fetch(`${API}/me/ebooks`, { headers: authHeaders() })
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setBooks(d.ebooks); })
      .catch((e) => setError(e?.message || "Kitaplar yüklenemedi"));
  }, []);

  async function read(book: OwnedEbook) {
    setOpening(book.id);
    // Açılır pencere engellenmesin diye sekmeyi tıklama anında aç, adresi sonra ver
    const win = window.open("about:blank", "_blank");
    try {
      const r = await fetch(`${API}/me/ebooks/${book.id}/read-link`, { method: "POST", headers: authHeaders() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      const url = `${API}${d.path}`;
      if (win) win.location.href = url; else window.location.href = url;
    } catch (e: any) {
      win?.close();
      alert(e?.message || "Kitap açılamadı");
    } finally {
      setOpening(null);
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-[#1e3a6e]">Kitaplarım</h1>
        <p className="text-sm text-slate-500 mt-1">Satın aldığın e-kitaplar burada. İndirme hakkı derdi olmadan istediğin zaman açabilirsin.</p>
      </div>

      {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">{error}</div>}
      {!books && !error && <div className="py-16 text-center"><Loader2 className="w-7 h-7 animate-spin text-[#13a9e0] mx-auto" /></div>}

      {books && books.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <BookOpen className="w-10 h-10 text-[#13a9e0] mx-auto mb-3" />
          <h2 className="font-bold text-[#1e3a6e]">Henüz kitaplığında kitap yok</h2>
          <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">
            Kitabı farklı bir e-posta adresiyle aldıysan, satın alma e-postandaki <b>“Kitaplarımı uygulamada aç”</b> bağlantısına tıkla; kitaplar bu hesaba eklenir.
          </p>
          <a href={`${WWW}/e-kitaplar`} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1.5 mt-5 px-5 py-2.5 rounded-lg bg-[#1e3a6e] text-white text-sm font-bold">
            E-kitaplara göz at <ExternalLink size={14} />
          </a>
        </div>
      )}

      {books && books.length > 0 && (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {books.map((b) => (
            <div key={b.id} className="rounded-2xl border border-slate-200 bg-white overflow-hidden flex flex-col">
              <div className="aspect-[3/4] bg-[#e8eef8] flex items-center justify-center overflow-hidden">
                {b.coverImageUrl
                  ? <img src={b.coverImageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                  : <BookOpen className="w-12 h-12 text-[#13a9e0]" />}
              </div>
              <div className="p-4 flex-1 flex flex-col">
                <h3 className="font-bold text-[#1e3a6e] leading-snug">{b.title}</h3>
                {b.subtitle && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{b.subtitle}</p>}
                <div className="mt-auto pt-4 space-y-2">
                  <button onClick={() => read(b)} disabled={!b.hasFile || opening === b.id}
                    className="w-full py-2.5 rounded-lg bg-[#1e3a6e] hover:bg-[#16305c] disabled:opacity-50 text-white text-sm font-bold inline-flex items-center justify-center gap-2">
                    {opening === b.id ? <Loader2 size={16} className="animate-spin" /> : <BookOpen size={16} />}
                    {b.hasFile ? "Kitabı oku" : "Dosya hazırlanıyor"}
                  </button>
                  <div className="w-full py-2 rounded-lg bg-[#e8eef8] text-[#0e7da6] text-xs font-semibold inline-flex items-center justify-center gap-1.5">
                    <Sparkles size={14} /> Kitaba özel pratikler yakında
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
