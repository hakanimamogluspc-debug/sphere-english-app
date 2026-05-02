import { useEffect, useState } from "react";
import { Bell, Mail, Flame, Calendar, Award, TrendingUp, FileQuestion, Newspaper, Loader2, Check } from "lucide-react";
import { motion } from "framer-motion";

const TOKEN_KEY = "sphere_token";
const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

interface Preferences {
  emailEnabled: boolean;
  inAppEnabled: boolean;
  streakRiskEmail: boolean;
  inactivityEmail: boolean;
  newAssessmentEmail: boolean;
  levelUpEmail: boolean;
  newQuizEmail: boolean;
  weeklyDigestEmail: boolean;
}

const PREF_GROUPS: Array<{
  title: string;
  desc: string;
  prefs: Array<{ key: keyof Preferences; label: string; desc: string; icon: React.ElementType; color: string }>;
}> = [
  {
    title: "Genel Kanallar",
    desc: "Bildirimleri hangi kanallardan almak istediğini seç.",
    prefs: [
      { key: "inAppEnabled", label: "Uygulama içi bildirimler", desc: "Sphere English'de zil simgesinde görünür.", icon: Bell, color: "#0d9488" },
      { key: "emailEnabled", label: "E-posta bildirimleri", desc: "Önemli bildirimler e-postana iletilir.", icon: Mail, color: "#2563eb" },
    ],
  },
  {
    title: "Bildirim Türleri (E-posta)",
    desc: "Hangi konularda e-posta almak istediğini özelleştir. Uygulama içi bildirimler her zaman gelir.",
    prefs: [
      { key: "streakRiskEmail", label: "Seri riski uyarısı", desc: "Günlük serini koruman için hatırlatma.", icon: Flame, color: "#ea580c" },
      { key: "inactivityEmail", label: "Hareketsizlik hatırlatması", desc: "Birkaç gün giriş yapmadığında nazikçe hatırlatırız.", icon: Calendar, color: "#2563eb" },
      { key: "newAssessmentEmail", label: "Yeni AI değerlendirme raporu", desc: "Telaffuz koçundan CEFR raporun hazır olduğunda.", icon: Award, color: "#16a34a" },
      { key: "levelUpEmail", label: "Seviye atlama", desc: "Sphere AI seviyeni yükselttiğinde.", icon: TrendingUp, color: "#7c3aed" },
      { key: "newQuizEmail", label: "Yeni quiz / alıştırma", desc: "Sana özel yeni alıştırmalar yayınlandığında.", icon: FileQuestion, color: "#0891b2" },
      { key: "weeklyDigestEmail", label: "Haftalık özet", desc: "Pazartesi sabahları haftalık ilerleme özetini al.", icon: Newspaper, color: "#475569" },
    ],
  },
];

export default function StudentSettings() {
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) { setLoading(false); return; }
    fetch(`${API}/notifications/preferences`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.ok ? r.json() : Promise.reject(new Error("Tercihler yüklenemedi")))
      .then((d) => setPrefs(d.preferences))
      .catch((e) => setError(e?.message || "Yükleme hatası"))
      .finally(() => setLoading(false));
  }, []);

  const updatePref = async (key: keyof Preferences, value: boolean) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token || !prefs) return;
    setSavingKey(key);
    setSavedKey(null);
    const optimistic = { ...prefs, [key]: value };
    setPrefs(optimistic);
    try {
      const res = await fetch(`${API}/notifications/preferences`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ [key]: value }),
      });
      if (!res.ok) throw new Error("Kaydedilemedi");
      const data = await res.json();
      setPrefs(data.preferences);
      setSavedKey(key);
      setTimeout(() => setSavedKey(null), 1500);
    } catch (e: any) {
      setError(e?.message || "Hata oluştu");
      setPrefs(prefs); // revert
    } finally {
      setSavingKey(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!prefs) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-rose-700">
          {error || "Tercihler yüklenemedi."}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Bildirim Tercihleri</h1>
        <p className="text-sm text-gray-500 mt-1">
          Hangi durumlarda nasıl bilgilendirilmek istediğini buradan ayarla.
        </p>
      </header>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-sm text-rose-700">{error}</div>
      )}

      {PREF_GROUPS.map((group) => (
        <section key={group.title} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50">
            <h2 className="font-bold text-gray-900 text-base">{group.title}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{group.desc}</p>
          </div>
          <div className="divide-y divide-gray-50">
            {group.prefs.map((p) => {
              const Icon = p.icon;
              const value = prefs[p.key];
              const isSaving = savingKey === p.key;
              const isSaved = savedKey === p.key;
              const disabled =
                p.key !== "inAppEnabled" &&
                p.key !== "emailEnabled" &&
                !prefs.emailEnabled; // email-specific prefs greyed when channel off
              return (
                <div key={p.key} className={`flex items-start gap-3 px-5 py-4 ${disabled ? "opacity-50" : ""}`}>
                  <div
                    className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: p.color + "1a", color: p.color }}
                  >
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{p.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{p.desc}</p>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    {isSaved && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        className="text-emerald-600"
                      >
                        <Check size={14} />
                      </motion.span>
                    )}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={value}
                      disabled={isSaving || disabled}
                      onClick={() => updatePref(p.key, !value)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        value ? "bg-blue-600" : "bg-gray-300"
                      } ${isSaving ? "opacity-60" : ""}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow ${
                          value ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <p className="text-xs text-gray-400 text-center pt-2">
        Tercihlerin anında kaydedilir. E-posta gönderim sıklığı, hesap aktivitene bağlı olarak otomatik ayarlanır.
      </p>
    </div>
  );
}
