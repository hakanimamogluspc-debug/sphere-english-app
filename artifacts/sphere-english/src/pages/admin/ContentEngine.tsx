import { useState, useMemo } from "react";
import {
  Sparkles, Copy, Check, AlertTriangle, RefreshCw, Wand2, Zap, Hash,
  Film, MessageSquare, Loader2,
} from "lucide-react";

const TOKEN_KEY = "sphere_token";

function getApiBase() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return base.replace("/sphere-english", "/api-server");
}

async function apiPost<T = any>(path: string, body: any): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${getApiBase()}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return res.json();
}

interface Scene {
  time: string;
  visual: string;
  screen_text: string;
  voiceover: string;
}

interface ContentPacket {
  hook_type: string;
  trigger: string;
  hook_line: string;
  scenes: Scene[];
  caption: string;
  hashtags: string[];
}

interface GenerateResponse {
  ok: boolean;
  packet: ContentPacket;
  warnings: string[];
  meta: { model: string; topic: string; hook: string; trigger: string };
}

// Marka stil kilidi — visual prompt'larının sonuna eklenir
const BRAND_STYLE_LOCK =
  "cinematic corporate photography, modern office, soft natural light, navy and turquoise accent palette, clean minimal composition, professional Turkish adult, realistic, 9:16 vertical, no text";

const HOOK_OPTIONS = [
  { value: "Auto", label: "Auto" },
  { value: "Identity Call", label: "Identity Call" },
  { value: "Contrarian", label: "Contrarian" },
  { value: "Open Loop", label: "Open Loop" },
  { value: "Confession", label: "Confession" },
  { value: "Outcome-first", label: "Outcome-first" },
];

const TRIGGER_OPTIONS = [
  { value: "Auto", label: "Auto" },
  { value: "Sürpriz", label: "Sürpriz" },
  { value: "Korku", label: "Korku" },
  { value: "Ego", label: "Ego" },
  { value: "Aciliyet", label: "Aciliyet" },
  { value: "Arzu", label: "Arzu" },
];

// ─── Kopyala butonu ────────────────────────────────────────────────────────
function CopyButton({ text, label = "Kopyala" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const onClick = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg bg-[#1FB8AC]/10 text-[#0B7C73] hover:bg-[#1FB8AC]/20 transition"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? "Kopyalandı" : label}
    </button>
  );
}

// ────────────────────────────────────────────────────────────────────────────

export default function ContentEngine() {
  const [topic, setTopic] = useState("");
  const [hook, setHook] = useState("Auto");
  const [trigger, setTrigger] = useState("Auto");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResponse | null>(null);

  const canGenerate = topic.trim().length >= 3 && !loading;

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiPost<GenerateResponse>(
        "/api/admin/content-engine/generate",
        { topic: topic.trim(), hook, trigger },
      );
      setResult(data);
    } catch (e: any) {
      setError(e.message ?? "Üretim başarısız oldu, tekrar dene.");
    } finally {
      setLoading(false);
    }
  };

  const fullPackText = useMemo(() => {
    if (!result) return "";
    const p = result.packet;
    const sceneLines = p.scenes
      .map(
        (s, i) =>
          `${i + 1}. [${s.time}]\n   Görsel: ${s.visual}\n   Ekran metni: ${s.screen_text}\n   Seslendirme: ${s.voiceover}`,
      )
      .join("\n\n");
    return [
      `KONU: ${result.meta.topic}`,
      `KANCA TİPİ: ${p.hook_type} · TETİKLEYİCİ: ${p.trigger}`,
      `\nHOOK LINE: ${p.hook_line}`,
      `\nSCRIPT:\n${sceneLines}`,
      `\nCAPTION:\n${p.caption}`,
      `\nHASHTAG:\n${p.hashtags.join(" ")}`,
    ].join("\n");
  }, [result]);

  return (
    <div className="min-h-screen" style={{ background: "#0B1F3A" }}>
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: "#1FB8AC" }}>
            <Wand2 size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">İçerik Motoru</h1>
            <p className="text-sm text-white/60 mt-0.5">
              28 saniyelik Reel script + caption + hashtag — tek seferde
            </p>
          </div>
        </div>

        {/* Girdi formu */}
        <div className="rounded-2xl border border-white/10 p-5 space-y-4" style={{ background: "#0F2A4D" }}>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-white/60 mb-2 block">
              Konu *
            </label>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Örn: İngilizce call'da donmak — neden olur, nasıl çözülür?"
              rows={2}
              className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#1FB8AC] resize-none"
              maxLength={500}
            />
            <p className="text-[10px] text-white/40 mt-1">{topic.length}/500</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-white/60 mb-2 block">
                Kanca tipi
              </label>
              <select
                value={hook}
                onChange={(e) => setHook(e.target.value)}
                className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#1FB8AC]"
              >
                {HOOK_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value} style={{ color: "#0B1F3A" }}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-white/60 mb-2 block">
                Tetikleyici
              </label>
              <select
                value={trigger}
                onChange={(e) => setTrigger(e.target.value)}
                className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#1FB8AC]"
              >
                {TRIGGER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value} style={{ color: "#0B1F3A" }}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={generate}
              disabled={!canGenerate}
              className="flex-1 sm:flex-none px-6 py-3 rounded-xl font-bold text-white transition flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "#1FB8AC" }}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {loading ? "Üretiliyor…" : "Üret"}
            </button>
            {result && !loading && (
              <button
                onClick={generate}
                className="px-4 py-3 rounded-xl text-sm font-medium text-white/70 hover:text-white border border-white/15 hover:border-white/30 transition flex items-center gap-2"
              >
                <RefreshCw size={14} /> Yeniden üret
              </button>
            )}
          </div>
        </div>

        {/* Hata */}
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-200 text-sm">
            ⚠ {error}
          </div>
        )}

        {/* Sonuç */}
        {result && (
          <div className="space-y-5">
            {/* Marka güvenliği uyarısı */}
            {result.warnings.length > 0 && (
              <div className="rounded-xl border-2 border-red-400 bg-red-50 p-4 flex items-start gap-3">
                <AlertTriangle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-bold text-red-700 text-sm">İddiaları yayından önce doğrula</p>
                  <ul className="list-disc pl-4 mt-1 text-sm text-red-700 space-y-0.5">
                    {result.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Meta + paket kopyala */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1FB8AC]/20 text-[#1FB8AC] text-xs font-bold">
                  <Zap size={12} /> {result.packet.hook_type}
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold">
                  {result.packet.trigger}
                </span>
                <span className="text-xs text-white/40">model: {result.meta.model}</span>
              </div>
              <CopyButton text={fullPackText} label="Paketi kopyala" />
            </div>

            {/* Hook banner */}
            <div className="rounded-2xl border-2 border-[#1FB8AC] p-5 relative" style={{ background: "#F6F4ED" }}>
              <div className="absolute -top-2.5 left-4 px-2 text-[10px] font-bold uppercase tracking-wider text-white rounded" style={{ background: "#1FB8AC" }}>
                Hook · 0–2 sn
              </div>
              <div className="flex items-start justify-between gap-3">
                <p className="text-xl font-bold leading-snug" style={{ color: "#0B1F3A" }}>
                  "{result.packet.hook_line}"
                </p>
                <CopyButton text={result.packet.hook_line} />
              </div>
            </div>

            {/* Script tablosu */}
            <div className="rounded-2xl overflow-hidden border border-white/10" style={{ background: "#F6F4ED" }}>
              <div className="px-5 py-3 flex items-center justify-between" style={{ background: "#0B1F3A" }}>
                <p className="font-bold text-white text-sm flex items-center gap-2">
                  <Film size={14} /> Çekim Listesi (Script)
                </p>
                <CopyButton
                  text={result.packet.scenes
                    .map((s, i) => `${i + 1}. [${s.time}]\nGörsel: ${s.visual}\nEkran: ${s.screen_text}\nSes: ${s.voiceover}`)
                    .join("\n\n")}
                  label="Script kopyala"
                />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-[#0B1F3A]/5">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold text-[#0B1F3A] w-20">Süre</th>
                      <th className="text-left px-3 py-2 font-semibold text-[#0B1F3A]">Görsel yönü</th>
                      <th className="text-left px-3 py-2 font-semibold text-[#0B1F3A]">Ekran metni</th>
                      <th className="text-left px-3 py-2 font-semibold text-[#0B1F3A]">Seslendirme</th>
                      <th className="px-2 py-2 w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#0B1F3A]/10">
                    {result.packet.scenes.map((s, i) => (
                      <tr key={i} className="align-top">
                        <td className="px-3 py-3 font-mono text-[11px] font-bold" style={{ color: "#1FB8AC" }}>
                          {s.time}
                        </td>
                        <td className="px-3 py-3 text-[#0B1F3A]/85 leading-snug">{s.visual}</td>
                        <td className="px-3 py-3 text-[#0B1F3A] font-medium leading-snug">{s.screen_text}</td>
                        <td className="px-3 py-3 text-[#0B1F3A]/85 italic leading-snug">{s.voiceover}</td>
                        <td className="px-2 py-3">
                          <CopyButton
                            text={`${s.visual}, ${BRAND_STYLE_LOCK}`}
                            label="Prompt"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="px-5 py-2 text-[10px] text-[#0B1F3A]/50 border-t border-[#0B1F3A]/10">
                "Prompt" butonu görsel açıklamasına marka stil kilidini ekler — Nano Banana / Higgsfield için hazır.
              </p>
            </div>

            {/* Caption */}
            <div className="rounded-2xl border border-white/10 p-5" style={{ background: "#F6F4ED" }}>
              <div className="flex items-center justify-between mb-3">
                <p className="font-bold text-sm flex items-center gap-2" style={{ color: "#0B1F3A" }}>
                  <MessageSquare size={14} /> Caption
                </p>
                <CopyButton text={result.packet.caption} />
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "#0B1F3A" }}>
                {result.packet.caption}
              </p>
            </div>

            {/* Hashtag */}
            <div className="rounded-2xl border border-white/10 p-5" style={{ background: "#F6F4ED" }}>
              <div className="flex items-center justify-between mb-3">
                <p className="font-bold text-sm flex items-center gap-2" style={{ color: "#0B1F3A" }}>
                  <Hash size={14} /> Hashtag
                </p>
                <CopyButton text={result.packet.hashtags.join(" ")} label="Hepsini kopyala" />
              </div>
              <div className="flex flex-wrap gap-2">
                {result.packet.hashtags.map((h, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 rounded-full text-xs font-medium"
                    style={{ background: "#1FB8AC", color: "#fff" }}
                  >
                    {h}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Boş durum tip */}
        {!result && !loading && !error && (
          <div className="rounded-2xl border border-white/10 p-8 text-center" style={{ background: "#0F2A4D" }}>
            <Sparkles size={28} className="text-[#1FB8AC] mx-auto mb-3" />
            <p className="text-white/70 text-sm">
              Konuyu yaz, "Üret"e bas. 28 saniyelik Reel paketi 5-10 saniyede hazırlanır.
            </p>
            <p className="text-xs text-white/40 mt-2">
              İlk üretimden önce <code className="bg-white/10 px-1.5 py-0.5 rounded">ANTHROPIC_API_KEY</code>{" "}
              env var'ının Easypanel'de tanımlı olduğunu doğrula.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
