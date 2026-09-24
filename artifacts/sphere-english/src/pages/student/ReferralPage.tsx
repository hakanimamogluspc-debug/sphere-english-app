import { useEffect, useState } from "react";
import { API } from "@/lib/api-url";
import { Link } from "wouter";
import { Gift, Copy, Check, MessageCircle, Twitter, Loader2, Users, Snowflake, Sparkles, Award, ArrowRight } from "lucide-react";

/**
 * /davet — Referans sistemi
 *
 * Her kullanıcının 6 karakterli benzersiz kodu var. Bu kodla kayıt olan
 * yeni bir kullanıcı olduğunda:
 *   - Davet eden: +3 streak freeze
 *   - Yeni kayıt: +3 streak freeze
 */

const TOKEN_KEY = "sphere_token";

interface ReferralData {
  code: string;
  share_url: string;
  stats: {
    total_invited: number;
    rewarded: number;
    total_freezes_earned: number;
    current_freezes: number;
  };
  invited: Array<{ student_number: string; status: string; created_at: string }>;
}

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

export default function ReferralPage() {
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/student/referral")
      .then(setData)
      .catch((e) => setError(e?.message))
      .finally(() => setLoading(false));
  }, []);

  const copy = async (text: string, kind: "code" | "link") => {
    try {
      await navigator.clipboard.writeText(text);
      if (kind === "code") {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 1600);
      } else {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 1600);
      }
    } catch {}
  };

  const shareMessage = data
    ? `Sphere English ile iş İngilizceni geliştir — kayıt olurken kodumu kullan (${data.code}) ve ikimize de 3 streak freeze kazandır! ${data.share_url}`
    : "";

  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;
  const twitterHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareMessage)}`;

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto p-6 flex justify-center">
        <Loader2 className="animate-spin text-slate-400" size={24} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error ?? "Referans bilgileri yüklenemedi"}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6">
      <div className="flex items-center gap-3 mb-2">
        <Gift className="text-purple-600" size={26} />
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900">Arkadaşını Davet Et</h1>
      </div>
      <p className="text-sm text-slate-600 mb-6">
        Her davet ettiğin arkadaş için <strong>ikinize de 3 streak freeze</strong> —
        seri kırılmadan tatile, iş yoğunluğuna dayanabilirsin.
      </p>

      {/* Kod + Link */}
      <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-5 mb-4">
        <p className="text-xs text-purple-800 font-bold uppercase tracking-wider mb-2">Referans Kodun</p>
        <div className="flex items-stretch gap-2 mb-3">
          <div className="flex-1 bg-white border-2 border-purple-300 rounded-lg px-4 py-3 font-mono text-2xl font-extrabold text-purple-900 tracking-widest text-center">
            {data.code}
          </div>
          <button
            onClick={() => copy(data.code, "code")}
            className="px-4 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm flex items-center gap-1.5"
          >
            {copiedCode ? <Check size={16} /> : <Copy size={16} />}
            {copiedCode ? "Kopyalandı" : "Kopyala"}
          </button>
        </div>

        <p className="text-xs text-slate-600 font-semibold mb-1.5">Davet Linkin</p>
        <div className="flex items-stretch gap-2">
          <input
            type="text"
            readOnly
            value={data.share_url}
            className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-700 font-mono truncate"
            onClick={(e) => (e.target as HTMLInputElement).select()}
          />
          <button
            onClick={() => copy(data.share_url, "link")}
            className="px-3 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1"
          >
            {copiedLink ? <Check size={14} /> : <Copy size={14} />}
            {copiedLink ? "Kopyalandı" : "Kopyala"}
          </button>
        </div>
      </div>

      {/* Paylaşım Butonları */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-lg transition-colors"
        >
          <MessageCircle size={16} />
          WhatsApp'ta Paylaş
        </a>
        <a
          href={twitterHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg transition-colors"
        >
          <Twitter size={16} />
          Twitter/X'te Paylaş
        </a>
      </div>

      {/* İstatistik Kartları */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <Users className="text-slate-400 mb-1" size={16} />
          <div className="text-2xl font-extrabold text-slate-900 tabular-nums">
            {data.stats.total_invited}
          </div>
          <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mt-0.5">Davet Ettiğin</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <Sparkles className="text-amber-500 mb-1" size={16} />
          <div className="text-2xl font-extrabold text-slate-900 tabular-nums">
            {data.stats.total_freezes_earned}
          </div>
          <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mt-0.5">Kazandığın Freeze</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <Snowflake className="text-sky-500 mb-1" size={16} />
          <div className="text-2xl font-extrabold text-slate-900 tabular-nums">
            {data.stats.current_freezes}
          </div>
          <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mt-0.5">Mevcut Freeze</p>
        </div>
      </div>

      {/* Ödül CTA */}
      {data.stats.current_freezes > 0 && (
        <Link
          href="/odullerim"
          className="flex items-center gap-3 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-300 rounded-xl p-4 mb-6 hover:shadow-md transition-shadow group"
        >
          <div className="w-12 h-12 rounded-lg bg-amber-500 flex items-center justify-center text-white shrink-0">
            <Award size={22} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-extrabold text-amber-900">
              {data.stats.current_freezes} freeze biriktirdin — ödül al!
            </div>
            <p className="text-xs text-amber-800 mt-0.5">
              Rozetler, ekstra freeze, indirim kuponları seni bekliyor.
            </p>
          </div>
          <ArrowRight className="text-amber-600 group-hover:translate-x-0.5 transition-transform" size={18} />
        </Link>
      )}

      {/* Davetliler Listesi */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-3">
          Davet Ettiklerin
        </h2>
        {data.invited.length === 0 ? (
          <p className="text-sm text-slate-500 py-8 text-center">
            Henüz kimseyi davet etmedin. Kodunu paylaş, ilk kazancını al!
          </p>
        ) : (
          <div className="space-y-2">
            {data.invited.map((inv, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50"
              >
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold text-xs">
                  {i + 1}
                </div>
                <span className="font-mono text-sm text-slate-700 flex-1">{inv.student_number}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold uppercase">
                  {inv.status === "rewarded" ? "✓ Ödüllendirildi" : inv.status}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {new Date(inv.created_at).toLocaleDateString("tr-TR", {
                    day: "2-digit",
                    month: "short",
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* KVKK/etik notu */}
      <p className="text-[11px] text-slate-400 mt-6 leading-relaxed">
        Referans ödülleri gerçek kayıt olmuş kullanıcılar için verilir. Sahte veya
        çoklu hesap kayıtları tespit edildiğinde ödüller iptal edilebilir.
      </p>
    </div>
  );
}
