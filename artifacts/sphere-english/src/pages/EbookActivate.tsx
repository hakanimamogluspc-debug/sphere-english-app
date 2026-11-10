import { useEffect, useState } from "react";
import { BookOpen, Loader2, AlertCircle, Eye, EyeOff } from "lucide-react";
import { API } from "@/lib/api-url";
import { useAuth } from "@/hooks/use-auth";

/**
 * /kitaplarim/etkinlestir?e=&s= — satın alma mailindeki "Kitaplarımı uygulamada aç" bağlantısı.
 * Hesap ancak kişi burada şifresini belirleyip koşulları onaylarsa açılır.
 */

const TOKEN_KEY = "sphere_token";
const WWW = "https://www.sphereenglish.com";

interface ClaimInfo { email: string; hasAccount: boolean; books: string[] }

export default function EbookActivate() {
  const { isAuthenticated } = useAuth();
  const params = new URLSearchParams(window.location.search);
  const e = params.get("e") ?? "";
  const s = params.get("s") ?? "";

  const [info, setInfo] = useState<ClaimInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [terms, setTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!e || !s) { setError("Bu sayfa satın alma e-postandaki bağlantıyla açılır."); setLoading(false); return; }
    (async () => {
      try {
        // Zaten giriş yapmışsa: bu e-postadaki kitapları hesabına ekle, Kitaplarım'a geç
        if (isAuthenticated) {
          await fetch(`${API}/me/ebooks/claim`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY)}` },
            body: JSON.stringify({ e, s }),
          });
          window.location.replace("/kitaplarim");
          return;
        }
        const r = await fetch(`${API}/ebook-library/claim?e=${encodeURIComponent(e)}&s=${encodeURIComponent(s)}`);
        const d = await r.json();
        if (!r.ok) setError(d.error ?? "Bağlantı geçersiz");
        else setInfo(d);
      } catch {
        setError("Bağlantı kontrol edilemedi, birazdan tekrar dene.");
      } finally {
        setLoading(false);
      }
    })();
  }, [e, s, isAuthenticated]);

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setFormError(null);
    if (!firstName.trim() || !lastName.trim()) return setFormError("Ad ve soyad gerekli.");
    if (pw.length < 8) return setFormError("Şifre en az 8 karakter olmalı.");
    if (!terms) return setFormError("Devam etmek için onay kutusunu işaretle.");
    setSubmitting(true);
    try {
      const r = await fetch(`${API}/ebook-library/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ e, s, firstName, lastName, password: pw, termsAccepted: true }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setFormError(d.error ?? `Hata (${r.status})`); setSubmitting(false); return; }
      if (d.token) localStorage.setItem(TOKEN_KEY, d.token);
      window.location.replace("/kitaplarim");
    } catch {
      setFormError("Bağlantı hatası, tekrar dene.");
      setSubmitting(false);
    }
  }

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen flex items-center justify-center bg-[#e8eef8] px-4 py-10">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-7">{children}</div>
    </div>
  );

  if (loading) return shell(<div className="text-center py-8"><Loader2 className="w-7 h-7 animate-spin text-[#13a9e0] mx-auto" /></div>);

  if (error || !info) return shell(
    <div className="text-center">
      <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
      <h1 className="text-lg font-bold text-[#1e3a6e] mb-2">Bağlantı açılamadı</h1>
      <p className="text-sm text-slate-600 mb-5">{error}</p>
      <a href="/login" className="inline-block px-5 py-2.5 rounded-lg bg-[#1e3a6e] text-white text-sm font-bold">Giriş yap</a>
    </div>,
  );

  const bookList = info.books.length > 0 && (
    <ul className="bg-[#e8eef8] rounded-xl p-3 mb-5 space-y-1">
      {info.books.map((b) => <li key={b} className="text-sm text-[#1e3a6e] flex gap-2"><BookOpen size={16} className="mt-0.5 shrink-0" />{b}</li>)}
    </ul>
  );

  if (info.hasAccount) return shell(
    <div>
      <h1 className="text-xl font-extrabold text-[#1e3a6e] mb-2">Kitapların hesabına eklendi</h1>
      <p className="text-sm text-slate-600 mb-4"><b>{info.email}</b> adresiyle zaten bir Sphere English hesabın var. Giriş yaptığında kitaplarını <b>Kitaplarım</b> bölümünde bulacaksın.</p>
      {bookList}
      <a href="/login" className="block text-center w-full py-3 rounded-lg bg-[#1e3a6e] text-white text-sm font-bold">Giriş yap</a>
      <a href="/sifremi-unuttum" className="block text-center mt-3 text-xs text-[#0e7da6] hover:underline">Şifremi hatırlamıyorum</a>
    </div>,
  );

  return shell(
    <div>
      <h1 className="text-xl font-extrabold text-[#1e3a6e] mb-1">Kitaplarını uygulamada aç</h1>
      <p className="text-sm text-slate-600 mb-4">
        Ücretsiz hesabını oluştur; kitaplarını indirme hakkı derdi olmadan uygulamadan oku. Hesap yalnızca bu formu gönderirsen açılır.
      </p>
      {bookList}
      <form onSubmit={submit} className="space-y-3" noValidate>
        <div className="text-xs text-slate-500">E-posta: <b className="text-slate-700">{info.email}</b></div>
        <div className="grid grid-cols-2 gap-2">
          <input value={firstName} onChange={(x) => setFirstName(x.target.value)} placeholder="Ad" autoComplete="given-name"
            className="px-3 py-2.5 rounded-lg border border-slate-200 text-sm outline-none focus:border-[#13a9e0]" />
          <input value={lastName} onChange={(x) => setLastName(x.target.value)} placeholder="Soyad" autoComplete="family-name"
            className="px-3 py-2.5 rounded-lg border border-slate-200 text-sm outline-none focus:border-[#13a9e0]" />
        </div>
        <div className="relative">
          <input type={showPw ? "text" : "password"} value={pw} onChange={(x) => setPw(x.target.value)} placeholder="Şifre (en az 8 karakter)" autoComplete="new-password"
            className="w-full px-3 py-2.5 pr-10 rounded-lg border border-slate-200 text-sm outline-none focus:border-[#13a9e0]" />
          <button type="button" onClick={() => setShowPw(!showPw)} tabIndex={-1} aria-label="Şifreyi göster/gizle"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400">{showPw ? <EyeOff size={16} /> : <Eye size={16} />}</button>
        </div>
        <label className="flex items-start gap-2 text-xs text-slate-600 leading-relaxed cursor-pointer">
          <input type="checkbox" checked={terms} onChange={(x) => setTerms(x.target.checked)} className="mt-0.5" />
          <span>
            <a href={`${WWW}/kullanim-kosullari`} target="_blank" rel="noreferrer" className="font-semibold text-[#0e7da6] hover:underline">Kullanım Koşulları</a>{" ve "}
            <a href={`${WWW}/gizlilik-politikasi`} target="_blank" rel="noreferrer" className="font-semibold text-[#0e7da6] hover:underline">Gizlilik Politikası</a>
            {"'nı okudum, kabul ediyorum. Kişisel verilerimin "}
            <a href={`${WWW}/kvkk`} target="_blank" rel="noreferrer" className="font-semibold text-[#0e7da6] hover:underline">KVKK Aydınlatma Metni</a>
            {" kapsamında işlenmesini onaylıyorum."}
          </span>
        </label>
        {formError && <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800" role="alert">{formError}</div>}
        <button type="submit" disabled={submitting}
          className="w-full py-3 rounded-lg bg-[#1e3a6e] hover:bg-[#16305c] disabled:opacity-60 text-white text-sm font-bold inline-flex items-center justify-center gap-2">
          {submitting ? <><Loader2 size={16} className="animate-spin" /> Hesabın hazırlanıyor…</> : "Hesabımı oluştur ve kitaplarımı aç"}
        </button>
      </form>
    </div>,
  );
}
