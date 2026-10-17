import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Volume2, Loader2, AlertCircle, X, Play, Square, Check, RefreshCw, Trash2, Search } from "lucide-react";
import { API } from "@/lib/api-url";

/**
 * Admin → Lara'nın Sesi
 * ElevenLabs hesabındaki seslerden Lara'yı seç, aynı ders cümlesiyle dinleyip karşılaştır,
 * duraklama / hız / ifade ayarlarını yap. Kaydedilen ayar hemen canlıya geçer (60 sn önbellek).
 */

const TOKEN_KEY = "sphere_token";
const NAVY = "#1e3a6e";
const TURQ_DEEP = "#0e7da6";

async function apiFetch(path: string, opts: RequestInit = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

type Settings = {
  provider: "elevenlabs" | "openai"; elevenVoiceId: string | null; elevenVoiceName: string | null; elevenModel: string;
  stability: number; similarity: number; style: number; speed: number;
  pauseAroundEnglishMs: number; pauseBetweenPartsMs: number; deliveryTags: boolean; openaiVoice: string;
};
type Voice = { voiceId: string; name: string; category: string | null; labels: Record<string, string>; previewUrl: string | null };
type State = {
  settings: Settings; elevenAvailable: boolean; openaiAvailable: boolean; voices: Voice[]; voicesError: string | null;
  cache: { entries: number; hits: number; chars: number; sizeKb: number }; sample: string;
};

const MODELS = [
  { id: "eleven_v4", label: "Eleven v4 — en doğal, ton etiketleri (önerilen)" },
  { id: "eleven_v4_turbo", label: "Eleven v4 Turbo — daha hızlı" },
  { id: "eleven_multilingual_v2", label: "Multilingual v2 — klasik, kararlı" },
  { id: "eleven_flash_v2_5", label: "Flash v2.5 — en hızlı / ucuz" },
];

export default function AdminTutorVoice() {
  const [st, setSt] = useState<State | null>(null);
  const [draft, setDraft] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sample, setSample] = useState("");
  const [busyVoice, setBusyVoice] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const d: State = await apiFetch("/admin/tutor-voice");
      setSt(d);
      setDraft(d.settings);
      setSample((s) => s || d.sample);
    } catch (e: any) { setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => () => { audioRef.current?.pause(); }, []);

  const stop = () => { audioRef.current?.pause(); audioRef.current = null; setPlaying(null); };
  const playSrc = (id: string, src: string) => {
    stop();
    const a = new Audio(src);
    audioRef.current = a;
    setPlaying(id);
    a.onended = () => setPlaying(null);
    a.play().catch(() => setPlaying(null));
  };

  const tryVoice = async (voiceId: string | null) => {
    if (!draft) return;
    const key = voiceId ?? "current";
    setBusyVoice(key);
    setError(null);
    try {
      const d = await apiFetch("/admin/tutor-voice/preview", {
        method: "POST",
        body: JSON.stringify({ voiceId: voiceId ?? undefined, text: sample, settings: draft }),
      });
      playSrc(key, `data:audio/mpeg;base64,${d.audioBase64}`);
      if (d.provider !== "elevenlabs" && st?.elevenAvailable) {
        setNotice(null);
        setError(`ElevenLabs çalışmadı, duyduğun OpenAI sesi. Sebep: ${d.fallbackReason || "bilinmiyor (sunucu günlüğünde [tutor-voice] satırına bak)"}`);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusyVoice(null);
    }
  };

  const save = async (patch: Partial<Settings>) => {
    setSaving(true);
    setError(null);
    try {
      const d = await apiFetch("/admin/tutor-voice", { method: "PATCH", body: JSON.stringify(patch) });
      setDraft(d.settings);
      setSt((s) => (s ? { ...s, settings: d.settings } : s));
      setNotice("Kaydedildi. Öğrenciler en geç 1 dakika içinde yeni sesi duyar.");
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };

  const clearCache = async () => {
    if (!confirm("Ses önbelleği silinsin mi? Sabit cümleler bir sonraki derste yeniden üretilir.")) return;
    try {
      const d = await apiFetch("/admin/tutor-voice/clear-cache", { method: "POST" });
      setSt((s) => (s ? { ...s, cache: d.cache } : s));
    } catch (e: any) { setError(e.message); }
  };

  const voices = useMemo(() => {
    const list = st?.voices ?? [];
    const term = q.trim().toLowerCase();
    const filtered = term
      ? list.filter((v) => `${v.name} ${Object.values(v.labels).join(" ")}`.toLowerCase().includes(term))
      : list;
    // Kadın sesleri üstte
    return [...filtered].sort((a, b) => Number(b.labels.gender === "female") - Number(a.labels.gender === "female"));
  }, [st, q]);

  if (!st || !draft) {
    return (
      <div className="py-20 flex flex-col items-center gap-3 text-slate-500">
        {error ? <><p className="text-sm text-rose-600">{error}</p><button onClick={load} className="text-sm underline">Tekrar dene</button></> : <Loader2 className="animate-spin" />}
      </div>
    );
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(st.settings);

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: NAVY }}><Volume2 size={24} /> Lara'nın Sesi</h1>
          <p className="text-sm text-slate-500">
            Şu an: <strong>{st.settings.provider === "elevenlabs" ? `ElevenLabs — ${st.settings.elevenVoiceName || st.settings.elevenVoiceId}` : `OpenAI — ${st.settings.openaiVoice}`}</strong>
            {st.settings.provider === "elevenlabs" && ` · ${st.settings.elevenModel}`}
          </p>
        </div>
        <button onClick={load} className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50" aria-label="Yenile"><RefreshCw size={16} /></button>
      </div>

      {(error || notice) && (
        <div className={`rounded-lg text-sm px-3 py-2 flex items-center gap-2 ${error ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-800"}`}>
          <AlertCircle size={15} /><span className="flex-1">{error || notice}</span>
          <button onClick={() => { setError(null); setNotice(null); }}><X size={14} /></button>
        </div>
      )}

      {!st.elevenAvailable && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold mb-1">ElevenLabs bağlı değil</p>
          <p>Easypanel → sphere-app → Ortam'a <code className="bg-white px-1 rounded">ELEVENLABS_API_KEY</code> ekleyip yeniden dağıt. Anahtar: ElevenLabs → Profil → API Keys (yalnız "Text to Speech" ve "Voices: Read" izni yeterli). Bu sayfa yenilenince sesler listelenir.</p>
        </div>
      )}

      {/* Örnek metin + ayarlar */}
      <div className="grid lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <p className="text-sm font-semibold" style={{ color: NAVY }}>Deneme metni</p>
          <textarea rows={4} value={sample} onChange={(e) => setSample(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <p className="text-xs text-slate-500">Tırnak içindeki İngilizce cümleler ayrı, İngilizce aksanla okunur ve önlerine/arkalarına duraklama konur.</p>
          <button
            onClick={() => tryVoice(null)}
            disabled={busyVoice !== null}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50"
            style={{ background: NAVY }}
          >
            {busyVoice === "current" ? <Loader2 size={15} className="animate-spin" /> : playing === "current" ? <Square size={15} /> : <Play size={15} />}
            Seçili sesle ve bu ayarlarla dinle
          </button>
        </div>

        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <p className="text-sm font-semibold" style={{ color: NAVY }}>Ses ayarları</p>
          <Labeled label="Model">
            <select className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" value={draft.elevenModel} onChange={(e) => setDraft({ ...draft, elevenModel: e.target.value })}>
              {MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </Labeled>
          <Slider label="Hız" hint="1.0 normal" min={0.7} max={1.2} step={0.01} value={draft.speed} onChange={(v) => setDraft({ ...draft, speed: v })} />
          <Slider label="Kararlılık" hint="Düşük = daha duygulu, yüksek = daha düz" min={0} max={1} step={0.05} value={draft.stability} onChange={(v) => setDraft({ ...draft, stability: v })} />
          <Slider label="İfade (stil)" hint="Yüksek = daha canlı; çok yüksek yapay kaçabilir" min={0} max={1} step={0.05} value={draft.style} onChange={(v) => setDraft({ ...draft, style: v })} />
          <Slider label="Benzerlik" min={0} max={1} step={0.05} value={draft.similarity} onChange={(v) => setDraft({ ...draft, similarity: v })} />
          <Slider label="İngilizce cümle öncesi/sonrası duraklama" hint="ms" min={0} max={1500} step={50} value={draft.pauseAroundEnglishMs} onChange={(v) => setDraft({ ...draft, pauseAroundEnglishMs: v })} />
          <Slider label="Tepki → sonraki adım duraklaması" hint="ms" min={0} max={1500} step={50} value={draft.pauseBetweenPartsMs} onChange={(v) => setDraft({ ...draft, pauseBetweenPartsMs: v })} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={draft.deliveryTags} onChange={(e) => setDraft({ ...draft, deliveryTags: e.target.checked })} />
            Ton yönlendirmesi (v4: "sıcak, gülümseyen" / "öğretmen gibi net")
          </label>
          <button
            onClick={() => save({
              elevenModel: draft.elevenModel, speed: draft.speed, stability: draft.stability, style: draft.style,
              similarity: draft.similarity, pauseAroundEnglishMs: draft.pauseAroundEnglishMs,
              pauseBetweenPartsMs: draft.pauseBetweenPartsMs, deliveryTags: draft.deliveryTags,
            })}
            disabled={!dirty || saving}
            className="w-full inline-flex justify-center items-center gap-1.5 px-3 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-40"
            style={{ background: NAVY }}
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Ayarları canlıya al
          </button>
        </div>
      </div>

      {/* Ses listesi */}
      {st.elevenAvailable && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <p className="text-sm font-semibold" style={{ color: NAVY }}>ElevenLabs sesleri ({st.voices.length})</p>
            <div className="relative ml-auto">
              <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ara (ör. female, turkish)" className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-sm" />
            </div>
          </div>
          {st.voicesError && <p className="text-sm text-rose-600 mb-2">{st.voicesError}</p>}
          <p className="text-xs text-slate-500 mb-3">
            Hesabındaki sesler listelenir. Türkçe bir kadın sesi istiyorsan ElevenLabs → Voice Library'de "Turkish" ara, beğendiğini "Add to my voices" ile ekle; burada görünür.
            "Lara olarak dinle" deneme metnini o sesle, gerçek ders akışıyla okur.
          </p>
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {voices.map((v) => {
              const selected = st.settings.elevenVoiceId === v.voiceId;
              return (
                <div key={v.voiceId} className={`rounded-xl border p-3 ${selected ? "border-2" : "border-slate-200"}`} style={selected ? { borderColor: TURQ_DEEP } : undefined}>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm flex-1 truncate" style={{ color: NAVY }}>{v.name}</p>
                    {selected && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: TURQ_DEEP }}>MERVE</span>}
                  </div>
                  <p className="text-[11px] text-slate-500 truncate mb-2">
                    {[v.labels.gender, v.labels.age, v.labels.accent, v.labels.language, v.labels.descriptive || v.labels.description, v.category].filter(Boolean).join(" · ")}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => (playing === v.voiceId ? stop() : tryVoice(v.voiceId))}
                      disabled={busyVoice !== null && busyVoice !== v.voiceId}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                      style={{ background: NAVY }}
                    >
                      {busyVoice === v.voiceId ? <Loader2 size={12} className="animate-spin" /> : playing === v.voiceId ? <Square size={12} /> : <Play size={12} />}
                      Lara olarak dinle
                    </button>
                    {v.previewUrl && (
                      <button onClick={() => (playing === `p-${v.voiceId}` ? stop() : playSrc(`p-${v.voiceId}`, v.previewUrl!))} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs border border-slate-200">
                        {playing === `p-${v.voiceId}` ? <Square size={12} /> : <Play size={12} />} Örnek
                      </button>
                    )}
                    {!selected && (
                      <button
                        onClick={() => save({ elevenVoiceId: v.voiceId, elevenVoiceName: v.name })}
                        disabled={saving}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border"
                        style={{ borderColor: TURQ_DEEP, color: TURQ_DEEP }}
                      >
                        <Check size={12} /> Lara bu olsun
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center gap-3 flex-wrap text-sm">
        <p className="flex-1 text-slate-600">
          Ses önbelleği: <strong>{st.cache.entries}</strong> cümle, {st.cache.sizeKb} KB, {st.cache.hits} kez tekrar kullanıldı.
          Sabit cümleler (adım kurguları, hedef İngilizce cümleler) bir kez üretilip saklanır; ayar değişince yenileri üretilir.
        </p>
        <button onClick={clearCache} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50"><Trash2 size={14} /> Önbelleği temizle</button>
      </div>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-slate-500 mb-1">{label}</span>
      {children}
    </label>
  );
}

function Slider({ label, hint, min, max, step, value, onChange }: { label: string; hint?: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="flex justify-between text-xs font-semibold text-slate-500 mb-1">
        <span>{label}{hint ? <span className="font-normal text-slate-400"> · {hint}</span> : null}</span>
        <span className="tabular-nums" style={{ color: NAVY }}>{value}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full" />
    </label>
  );
}
