import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Loader2, Award, AlertCircle, Check } from "lucide-react";
import { API } from "@/lib/api-url";

const TOKEN_KEY = "sphere_token";

interface FormState {
  fullName: string;
  email: string;
  phone: string;
  website: string;
  socialLinks: string;
  motivation: string;
  audienceDescription: string;
  desiredCode: string;
}

export default function PartnerApply() {
  const [, navigate] = useLocation();
  const [form, setForm] = useState<FormState>({
    fullName: "",
    email: "",
    phone: "",
    website: "",
    socialLinks: "",
    motivation: "",
    audienceDescription: "",
    desiredCode: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<any>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.fullName.trim() || !form.email.trim()) {
      setError("Ad ve e-posta zorunlu");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      // Login'liyse user_id'yi de gönderelim (me endpoint'inden bilgi alma için)
      let userId: number | null = null;
      if (token) {
        try {
          const me = await fetch(`${API}/users/me`, {
            headers: { Authorization: `Bearer ${token}` },
          }).then((r) => r.ok ? r.json() : null);
          userId = me?.id ?? null;
        } catch {}
      }

      const res = await fetch(`${API}/affiliate/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, userId }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.existingStatus) {
          setError(
            data.existingStatus === "active"
              ? "Bu e-postayla zaten aktif bir partner hesabın var. /partner sayfasına git."
              : "Bu e-postayla zaten bir başvurun var, değerlendirme bekliyor.",
          );
        } else {
          setError(data.error || "Başvuru başarısız");
        }
        return;
      }
      setSuccess(data.affiliate);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="max-w-xl mx-auto py-12 px-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
          <Check size={56} className="text-blue-700 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Başvurun alındı!</h1>
          <p className="text-slate-700 mb-4">
            Ekibimiz 1-2 iş günü içinde başvurunu değerlendirip e-posta atacak.
          </p>
          <div className="bg-white border border-slate-200 rounded p-4 my-4">
            <div className="text-xs text-slate-500 uppercase">Önerilen partner kodun</div>
            <div className="text-2xl font-mono font-bold text-blue-800 mt-1">{success.code}</div>
          </div>
          <Link
            href="/partner"
            className="inline-block bg-blue-700 text-white px-6 py-2 rounded-md hover:bg-blue-800"
          >
            Panele dön
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-6">
      <header className="mb-6 text-center">
        <Award size={48} className="text-blue-700 mx-auto mb-3" />
        <h1 className="text-3xl font-bold mb-2">Sphere Partner Başvurusu</h1>
        <p className="text-slate-600">
          %20 ilk ödeme + %10 yenileme (12 ay). E-kitap satışlarından %20.
        </p>
      </header>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700 flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <form onSubmit={submit} className="space-y-4 bg-white border border-slate-200 rounded-lg p-6">
        <Field label="Ad Soyad *" value={form.fullName} onChange={(v) => setForm({ ...form, fullName: v })} placeholder="Mehmet Yılmaz" />
        <Field label="E-posta *" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} placeholder="ornek@email.com" />
        <Field label="Telefon" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} placeholder="+90 5XX XXX XX XX" />
        <Field label="Web sitesi / Blog" value={form.website} onChange={(v) => setForm({ ...form, website: v })} placeholder="https://..." />

        <Field
          label="Sosyal medya hesapları"
          value={form.socialLinks}
          onChange={(v) => setForm({ ...form, socialLinks: v })}
          placeholder="Instagram, YouTube, TikTok... (URL veya kullanıcı adı)"
          textarea
        />

        <Field
          label="Kitlen kimler, ne tür içerik üretiyorsun?"
          value={form.audienceDescription}
          onChange={(v) => setForm({ ...form, audienceDescription: v })}
          placeholder="Örn: 'Üniversite öğrencileri için kariyer içeriği üretiyorum, ~10K takipçi.'"
          textarea
        />

        <Field
          label="Neden Sphere partner olmak istiyorsun?"
          value={form.motivation}
          onChange={(v) => setForm({ ...form, motivation: v })}
          placeholder="Birkaç cümle..."
          textarea
        />

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Önerilen kod (opsiyonel)
          </label>
          <input
            type="text"
            value={form.desiredCode}
            onChange={(e) =>
              setForm({ ...form, desiredCode: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 40) })
            }
            placeholder="MEHMETY (boş bırakırsan biz üretiriz)"
            className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm font-mono uppercase"
          />
          <p className="text-xs text-slate-500 mt-1">Sadece harf + rakam, en az 4 karakter</p>
        </div>

        <div className="text-xs text-slate-500 p-3 bg-slate-50 rounded-md">
          Başvurunu onaylarsak, IBAN ve TC kimlik bilgileri istenir (KVKK & vergisel zorunluluk).
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-blue-700 text-white rounded-md hover:bg-blue-800 disabled:opacity-50 font-medium flex items-center justify-center gap-2"
        >
          {loading ? <><Loader2 className="animate-spin" size={16} /> Gönderiliyor...</> : "Başvuruyu Gönder"}
        </button>
      </form>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, type, textarea,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; textarea?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 mb-1">{label}</label>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
        />
      ) : (
        <input
          type={type ?? "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      )}
    </div>
  );
}
