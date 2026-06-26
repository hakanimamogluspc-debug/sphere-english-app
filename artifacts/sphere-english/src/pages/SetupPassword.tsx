import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Loader2, CheckCircle2, AlertCircle, KeyRound, Eye, EyeOff } from "lucide-react";
import { API } from "@/lib/api-url";

const TOKEN_KEY = "sphere_token";

interface TokenInfo {
  ok: true;
  email: string;
  name: string | null;
  purpose: string;
}

interface ErrorInfo {
  error: string;
  code?: "token_invalid" | "token_used" | "token_expired";
}

export default function SetupPassword() {
  const [, setLocation] = useLocation();
  const [token, setToken] = useState<string>("");
  const [info, setInfo] = useState<TokenInfo | null>(null);
  const [error, setError] = useState<ErrorInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // URL'den token al + token bilgisi
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token") ?? "";
    setToken(t);

    if (!t) {
      setError({ error: "Bu sayfaya doğrudan erişilemez. Lütfen mailinizdeki bağlantıyı kullanın." });
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const r = await fetch(`${API}/auth/setup-password?token=${encodeURIComponent(t)}`);
        const data = await r.json();
        if (r.ok) {
          setInfo(data as TokenInfo);
        } else {
          setError(data as ErrorInfo);
        }
      } catch (e: any) {
        setError({ error: "Bağlantı kontrol edilemedi: " + e.message });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (pw1.length < 8) return setFormError("Şifre en az 8 karakter olmalı.");
    if (pw1 !== pw2) return setFormError("Şifreler eşleşmiyor.");

    setSubmitting(true);
    try {
      const r = await fetch(`${API}/auth/setup-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: pw1 }),
      });
      const data = await r.json();
      if (!r.ok) {
        setFormError(data.error || `HTTP ${r.status}`);
        setSubmitting(false);
        return;
      }
      // Otomatik giriş — JWT'yi localStorage'a yaz
      if (data.token) {
        localStorage.setItem(TOKEN_KEY, data.token);
      }
      // Dashboard'a yönlendir
      setLocation("/student/dashboard");
    } catch (e: any) {
      setFormError(e.message);
      setSubmitting(false);
    }
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 via-white to-emerald-50 px-4">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-sky-600 mx-auto mb-3" />
          <p className="text-sm text-slate-500">Bağlantı kontrol ediliyor…</p>
        </div>
      </div>
    );
  }

  // ── Hata ──
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 via-white to-amber-50 px-4">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-8 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Bağlantı geçerli değil</h1>
          <p className="text-sm text-slate-600 mb-6">{error.error}</p>

          {error.code === "token_expired" && (
            <div className="text-left bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-xs text-amber-900">
              <strong>Süre doldu:</strong> Yeni bir hoşgeldin maili göndermemiz için bizimle iletişime geçin.
            </div>
          )}
          {error.code === "token_used" && (
            <div className="text-left bg-sky-50 border border-sky-200 rounded-lg p-3 mb-4 text-xs text-sky-900">
              <strong>Bağlantı kullanılmış:</strong> Şifreni daha önce belirledin. Giriş sayfasından oturum aç.
            </div>
          )}

          <div className="flex flex-col gap-2">
            <button
              onClick={() => setLocation("/login")}
              className="w-full py-2.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-bold"
            >
              Giriş Sayfasına Git
            </button>
            <a
              href="mailto:info@sphereenglish.com"
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              info@sphereenglish.com ile iletişime geç
            </a>
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
            <KeyRound className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900">Şifreni Belirle</h1>
          <p className="text-sm text-slate-500 mt-2">
            Sphere English'e hoşgeldin! Hesabını kullanmaya başlamak için bir şifre belirle.
          </p>
        </div>

        {/* E-posta göster */}
        {info && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4">
            <div className="text-[11px] font-bold uppercase text-slate-500 mb-0.5">E-posta</div>
            <div className="text-sm font-semibold text-slate-800">{info.email}</div>
            {info.name && (
              <div className="text-xs text-slate-500 mt-0.5">Hoşgeldin, {info.name}</div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
              Yeni Şifre
            </label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={pw1}
                onChange={(e) => setPw1(e.target.value)}
                placeholder="En az 8 karakter"
                autoFocus
                className="w-full px-3 py-2.5 pr-10 rounded-lg border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 text-sm outline-none"
                required
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600"
                tabIndex={-1}
                aria-label={showPw ? "Şifreyi gizle" : "Şifreyi göster"}
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Güvenli bir şifre için: büyük/küçük harf, sayı ve sembol karışımı önerilir.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
              Şifre (Tekrar)
            </label>
            <input
              type={showPw ? "text" : "password"}
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              placeholder="Şifreyi tekrar gir"
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 text-sm outline-none"
              required
              minLength={8}
            />
          </div>

          {formError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-900">
              {formError}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-bold inline-flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20"
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Hesabın hazırlanıyor…
              </>
            ) : (
              <>
                <CheckCircle2 size={16} /> Şifremi Belirle ve Giriş Yap
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-100 text-center">
          <p className="text-[11px] text-slate-500">
            Sphere English · {" "}
            <a href="mailto:info@sphereenglish.com" className="text-sky-600 hover:underline">
              info@sphereenglish.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
