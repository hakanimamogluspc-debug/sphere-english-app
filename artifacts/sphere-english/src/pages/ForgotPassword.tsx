import { useState } from "react";
import { Link } from "wouter";
import { Mail, Loader2, CheckCircle2, ArrowLeft } from "lucide-react";
import { API } from "@/lib/api-url";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
      setError("Geçerli bir e-posta adresi girin.");
      return;
    }

    setSubmitting(true);
    try {
      const r = await fetch(`${API}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data.error || `HTTP ${r.status}`);
        setSubmitting(false);
        return;
      }
      setDone({ message: data.message ?? "Mail gönderildi." });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Başarı sayfası ──
  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-sky-50 px-4 py-12">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-8 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
            <CheckCircle2 className="w-9 h-9 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 mb-2">Mail Yolda</h1>
          <p className="text-sm text-slate-600 mb-6 leading-relaxed">
            {done.message}
          </p>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6 text-left">
            <p className="text-[12px] text-amber-900 leading-relaxed">
              <strong>📬 Bulamadın mı?</strong> Spam / Önemsiz klasörünü kontrol et.
              Bağlantı <strong>1 saat</strong> geçerli.
            </p>
          </div>

          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 text-sm font-bold text-sky-600 hover:text-sky-800"
          >
            <ArrowLeft size={14} /> Giriş Sayfasına Dön
          </Link>

          <div className="mt-6 pt-4 border-t border-slate-100">
            <p className="text-[11px] text-slate-500">
              Sorun yaşarsan:{" "}
              <a href="mailto:info@sphereenglish.com" className="text-sky-600 hover:underline">
                info@sphereenglish.com
              </a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Form ──
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 via-white to-emerald-50 px-4 py-12">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-8">
        <div className="text-center mb-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-sky-500 to-sky-700 flex items-center justify-center mb-3 shadow-lg shadow-sky-500/30">
            <Mail className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900">Şifremi Unuttum</h1>
          <p className="text-sm text-slate-500 mt-2">
            E-posta adresini gir, şifre sıfırlama bağlantısını sana gönderelim.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
              E-posta
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="kayit@email.com"
              autoFocus
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 text-sm outline-none"
              required
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-900">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-sm font-bold inline-flex items-center justify-center gap-2 shadow-md shadow-sky-500/20"
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Mail gönderiliyor…
              </>
            ) : (
              <>
                <Mail size={16} /> Sıfırlama Bağlantısı Gönder
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-100 text-center space-y-2">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft size={12} /> Giriş Sayfasına Dön
          </Link>
          <p className="text-[11px] text-slate-400">
            Sphere English ·{" "}
            <a href="mailto:info@sphereenglish.com" className="text-sky-600 hover:underline">
              info@sphereenglish.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
