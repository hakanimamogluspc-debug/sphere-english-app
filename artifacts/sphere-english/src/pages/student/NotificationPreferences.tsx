import { useEffect, useState } from "react";
import { API } from "@/lib/api-url";
import { Bell, Check, Loader2, Mail, Smartphone, BellOff } from "lucide-react";
import {
  isPushSupported,
  currentPushPermission,
  subscribePush,
  unsubscribePush,
} from "@/lib/push-notifications";

const TOKEN_KEY = "sphere_token";

interface Prefs {
  streak_risk_email: boolean;
  inactivity_email: boolean;
  weekly_digest_email: boolean;
  streak_risk_push: boolean;
  inactivity_push: boolean;
}

const DEFAULT_PREFS: Prefs = {
  streak_risk_email: true,
  inactivity_email: true,
  weekly_digest_email: true,
  streak_risk_push: false,
  inactivity_push: false,
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
          checked={prefs.inactivity_email}
          onChange={(v) => update({ inactivity_email: v })}
          disabled={saving}
        />
        <div className="border-t border-slate-100" />
        <ToggleRow
          icon={<span className="text-lg">📊</span>}
          title="Haftalık ilerleme raporu"
          description="Her Pazar günü haftanın özeti — kaç dakika çalıştın, hangi seviyedesin."
          checked={prefs.weekly_digest_email}
          onChange={(v) => update({ weekly_digest_email: v })}
          disabled={saving}
        />
      </div>

      {/* Push */}
      <PushSection
        prefs={prefs}
        onPrefChange={update}
        saving={saving}
      />

      <p className="text-xs text-slate-400 mt-6 leading-relaxed">
        Sphere English size hesap işlemleri (parola sıfırlama, sipariş bildirimi vb.)
        için işlem tabanlı e-postalar göndermeye devam eder — bu bildirimleri kapatmak
        yalnızca yukarıdaki hatırlatmaları durdurur.
      </p>
    </div>
  );
}

// ─── PushSection — subscribe/unsubscribe + toggle'lar ──────────────────────

function PushSection({
  prefs,
  onPrefChange,
  saving,
}: {
  prefs: Prefs;
  onPrefChange: (patch: Partial<Prefs>) => Promise<void>;
  saving: boolean;
}) {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSupported(isPushSupported());
    setPermission(currentPushPermission());
  }, []);

  const activate = async () => {
    setBusy(true);
    const ok = await subscribePush();
    if (ok) {
      setPermission("granted");
      // Otomatik olarak iki toggle'ı da aç
      await onPrefChange({ streak_risk_push: true, inactivity_push: true });
    } else {
      setPermission(currentPushPermission());
    }
    setBusy(false);
  };

  const deactivate = async () => {
    setBusy(true);
    await unsubscribePush();
    await onPrefChange({ streak_risk_push: false, inactivity_push: false });
    setPermission(currentPushPermission());
    setBusy(false);
  };

  const enabled = permission === "granted";

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Smartphone size={16} className="text-slate-500" />
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Tarayıcı Bildirimi</h2>
        </div>
        {supported && (
          enabled ? (
            <button
              onClick={deactivate}
              disabled={busy}
              className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1 rounded-lg"
            >
              {busy ? <Loader2 size={12} className="animate-spin" /> : <BellOff size={12} />}
              Etkin — Kaldır
            </button>
          ) : (
            <button
              onClick={activate}
              disabled={busy || permission === "denied"}
              className="inline-flex items-center gap-1 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1 rounded-lg disabled:bg-slate-300"
            >
              {busy ? <Loader2 size={12} className="animate-spin" /> : <Bell size={12} />}
              Etkinleştir
            </button>
          )
        )}
      </div>

      {!supported && (
        <p className="text-xs text-slate-500 italic">Tarayıcın push bildirimi desteklemiyor.</p>
      )}
      {supported && permission === "denied" && (
        <p className="text-xs text-red-600 mb-3">
          Bildirim izni reddedilmiş. Tarayıcı ayarlarından bu site için bildirimlere izin ver, sonra tekrar dene.
        </p>
      )}

      <ToggleRow
        icon={<span className="text-lg">🔥</span>}
        title="Streak riski (push)"
        description={enabled ? "Tarayıcın açıksa 20:00 civarı bildirim gelir." : "Yukarıdan etkinleştir."}
        checked={prefs.streak_risk_push}
        onChange={(v) => onPrefChange({ streak_risk_push: v })}
        disabled={saving || !enabled}
      />
      <div className="border-t border-slate-100" />
      <ToggleRow
        icon={<span className="text-lg">👋</span>}
        title="Geri dönüş (push)"
        description={enabled ? "Birkaç gündür yoksan sabah bildirim gelir." : "Yukarıdan etkinleştir."}
        checked={prefs.inactivity_push}
        onChange={(v) => onPrefChange({ inactivity_push: v })}
        disabled={saving || !enabled}
      />
    </div>
  );
}

