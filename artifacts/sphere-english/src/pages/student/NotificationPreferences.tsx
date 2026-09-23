import { useEffect, useState } from "react";
import { API } from "@/lib/api-url";
import { Bell, Check, Loader2, Mail, Smartphone } from "lucide-react";

const TOKEN_KEY = "sphere_token";

interface Prefs {
  streak_risk_email: boolean;
  comeback_email: boolean;
  weekly_report_email: boolean;
  streak_risk_push: boolean;
  comeback_push: boolean;
}

const DEFAULT_PREFS: Prefs = {
  streak_risk_email: true,
  comeback_email: true,
  weekly_report_email: true,
  streak_risk_push: false,
  comeback_push: false,
};

async function apiFetch(path: string, opts: RequestInit = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.error || `HTTP ${res.status}`);
  return data;
}

function ToggleRow({
  title,
  description,
  icon,
  checked,
  onChange,
  disabled,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 py-3">
      <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 text-slate-600 mt-0.5">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-slate-900">{title}</div>
        <p className="text-xs text-slate-500 leading-snug mt-0.5">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        disabled={disabled}
        role="switch"
        aria-checked={checked}
        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
          checked ? "bg-emerald-500" : "bg-slate-300"
        } ${disabled ? "opacity-50" : ""}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

export default function NotificationPreferences() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/student/notification-prefs")
      .then((r) => setPrefs({ ...DEFAULT_PREFS, ...(r.prefs ?? {}) }))
      .catch((e) => setError(e?.message))
      .finally(() => setLoading(false));
  }, []);

  const update = async (patch: Partial<Prefs>) => {
    setPrefs((p) => ({ ...p, ...patch }));
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/student/notification-prefs", {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(null), 2000);
    } catch (e: any) {
      setError(e?.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-6 flex justify-center">
        <Loader2 className="animate-spin text-slate-400" size={24} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6">
      <div className="flex items-center gap-3 mb-2">
        <Bell className="text-indigo-600" size={26} />
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900">Bildirim Tercihleri</h1>
      </div>
      <p className="text-sm text-slate-600 mb-6">
        Sana ne zaman ve nasıl hatırlatma yapacağımızı seç. İstediğin zaman değiştirebilirsin.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">
          {error}
        </div>
      )}
      {savedAt && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 mb-4 text-sm text-emerald-700 flex items-center gap-2">
          <Check size={14} /> Tercih güncellendi
        </div>
      )}

      {/* E-posta */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 mb-4">
        <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-100">
          <Mail size={16} className="text-slate-500" />
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">E-posta</h2>
        </div>

        <ToggleRow
          icon={<span className="text-lg">🔥</span>}
          title="Streak riski hatırlatması"
          description="Bugün girmediysen ve serin tehlikedeyse akşam bir hatırlatma göndeririz."
          checked={prefs.streak_risk_email}
          onChange={(v) => update({ streak_risk_email: v })}
          disabled={saving}
        />
        <div className="border-t border-slate-100" />
        <ToggleRow
          icon={<span className="text-lg">👋</span>}
          title="Geri dönüş hatırlatması"
          description="Birkaç gündür girmediysen 'seni özledik' hatırlatması gönderelim mi?"
          checked={prefs.comeback_email}
          onChange={(v) => update({ comeback_email: v })}
          disabled={saving}
        />
        <div className="border-t border-slate-100" />
        <ToggleRow
          icon={<span className="text-lg">📊</span>}
          title="Haftalık ilerleme raporu"
          description="Her Pazar günü haftanın özeti — kaç dakika çalıştın, hangi seviyedesin."
          checked={prefs.weekly_report_email}
          onChange={(v) => update({ weekly_report_email: v })}
          disabled={saving}
        />
      </div>

      {/* Push */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-100">
          <Smartphone size={16} className="text-slate-500" />
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Tarayıcı Bildirimi</h2>
        </div>

        <ToggleRow
          icon={<span className="text-lg">🔥</span>}
          title="Streak riski (push)"
          description="Tarayıcı bildirimlerini etkinleştirmen gerekir. Yakında."
          checked={prefs.streak_risk_push}
          onChange={(v) => update({ streak_risk_push: v })}
          disabled={saving}
        />
        <div className="border-t border-slate-100" />
        <ToggleRow
          icon={<span className="text-lg">👋</span>}
          title="Geri dönüş (push)"
          description="Yakında — tarayıcı bildirimi için etkinleştirme adımı gerekli."
          checked={prefs.comeback_push}
          onChange={(v) => update({ comeback_push: v })}
          disabled={saving}
        />
      </div>

      <p className="text-xs text-slate-400 mt-6 leading-relaxed">
        Sphere English size hesap işlemleri (parola sıfırlama, sipariş bildirimi vb.)
        için işlem tabanlı e-postalar göndermeye devam eder — bu bildirimleri kapatmak
        yalnızca yukarıdaki hatırlatmaları durdurur.
      </p>
    </div>
  );
}
