import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  TrendingUp, Users, Eye, DollarSign, Copy, Check, ExternalLink,
  Share2, AlertCircle, Loader2, Award, CreditCard, Sparkles,
} from "lucide-react";
import { API } from "@/lib/api-url";

const TOKEN_KEY = "sphere_token";
const WWW_BASE = "https://www.sphereenglish.com";

async function apiFetch(path: string, opts: RequestInit = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

function tl(kurus: number | string | undefined | null): string {
  const k = Number(kurus ?? 0);
  return (k / 100).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " TL";
}

export default function Partner() {
  const [aff, setAff] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "link" | "commissions" | "payouts" | "bank" | "materials">("overview");
  const [copied, setCopied] = useState(false);
  const [bank, setBank] = useState({ tcNumber: "", iban: "", bankName: "", accountHolderName: "" });
  const [bankSaving, setBankSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      const meData = await apiFetch("/affiliate/me");
      setAff(meData.affiliate);
      if (meData.affiliate && meData.affiliate.status === "active") {
        const [s, c, p] = await Promise.all([
          apiFetch("/affiliate/me/stats").catch(() => ({ stats: null })),
          apiFetch("/affiliate/me/commissions").catch(() => ({ commissions: [] })),
          apiFetch("/affiliate/me/payouts").catch(() => ({ payouts: [] })),
        ]);
        setStats(s.stats);
        setCommissions(c.commissions ?? []);
        setPayouts(p.payouts ?? []);
        setBank({
          tcNumber: meData.affiliate.tc_number || "",
          iban: meData.affiliate.iban || "",
          bankName: meData.affiliate.bank_name || "",
          accountHolderName: meData.affiliate.account_holder_name || "",
        });
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const partnerLink = aff ? `${WWW_BASE}/?ref=${aff.code}` : "";

  function copyLink() {
    navigator.clipboard.writeText(partnerLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function shareTwitter() {
    const text = encodeURIComponent("Sphere English ile iş İngilizcesinde gerçek seviye atla! 7 gün ücretsiz dene:");
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(partnerLink)}`, "_blank");
  }
  function shareWhatsApp() {
    const text = encodeURIComponent(`Sphere English platformunu denemeni öneririm: ${partnerLink}`);
    window.open(`https://wa.me/?text=${text}`, "_blank");
  }
  function shareLinkedin() {
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(partnerLink)}`, "_blank");
  }

  async function saveBank() {
    try {
      setBankSaving(true);
      await apiFetch("/affiliate/me/bank", { method: "PATCH", body: JSON.stringify(bank) });
      await load();
      alert("Banka bilgileri kaydedildi");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBankSaving(false);
    }
  }

  if (loading) {
    return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-emerald-600" size={32} /></div>;
  }

  // Henüz başvurmamış → /partner/apply'a yönlendir
  if (!aff) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-6 text-center">
        <Award size={56} className="text-emerald-600 mx-auto mb-4" />
        <h1 className="text-3xl font-bold mb-3">Sphere Partner Programı</h1>
        <p className="text-slate-600 mb-6">
          Sphere'i sevdiğin kişilere öner, satışlardan komisyon kazan.
          <strong> %20 ilk ödeme + %10 yenileme (12 ay)</strong>.
        </p>
        <Link
          href="/partner/apply"
          className="inline-flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-lg hover:bg-emerald-700"
        >
          <Sparkles size={18} /> Hemen Başvur
        </Link>
      </div>
    );
  }

  if (aff.status === "pending") {
    return (
      <div className="max-w-2xl mx-auto py-12 px-6 text-center">
        <Loader2 size={48} className="text-amber-600 mx-auto mb-4 animate-spin" />
        <h1 className="text-2xl font-bold mb-2">Başvurun değerlendirmede</h1>
        <p className="text-slate-600">
          Ekibimiz başvurunu inceliyor. Onay gelince e-posta atacağız (genellikle 1-2 iş günü).
        </p>
        <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-lg text-left max-w-md mx-auto">
          <div className="text-xs text-slate-500 uppercase">Önerilen kodun</div>
          <div className="text-xl font-mono font-bold text-slate-800">{aff.code}</div>
        </div>
      </div>
    );
  }

  if (aff.status === "rejected") {
    return (
      <div className="max-w-2xl mx-auto py-12 px-6 text-center">
        <AlertCircle size={48} className="text-red-600 mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Başvurun reddedildi</h1>
        {aff.rejection_reason && (
          <p className="text-slate-600 mt-3 italic">"{aff.rejection_reason}"</p>
        )}
        <p className="text-slate-500 text-sm mt-4">
          İtiraz için info@sphereenglish.com'a yazabilirsin.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-emerald-700 flex items-center gap-2">
          <Award size={26} /> Partner Programı
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Kod: <strong className="font-mono">{aff.code}</strong> · Aktif
        </p>
      </header>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">{error}</div>
      )}

      {/* Tab nav */}
      <div className="flex gap-1 mb-4 border-b border-slate-200 overflow-x-auto">
        {([
          ["overview", "Genel Bakış"],
          ["link", "Linkim"],
          ["commissions", "Komisyonlar"],
          ["payouts", "Ödemeler"],
          ["bank", "Banka Bilgisi"],
          ["materials", "Materyaller"],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${
              tab === k ? "border-emerald-600 text-emerald-700" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" && stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <Stat label="Toplam Kazanç" value={tl(stats.total_earned_kurus)} icon={<TrendingUp size={16} />} color="emerald" />
          <Stat label="Bekleyen" value={tl(stats.pending_kurus)} icon={<Loader2 size={16} />} color="amber" />
          <Stat label="Onaylı (Ödenebilir)" value={tl(stats.approved_kurus)} icon={<DollarSign size={16} />} color="blue" />
          <Stat label="Ödenmiş" value={tl(stats.paid_kurus)} icon={<Check size={16} />} color="violet" />
          <Stat label="Tıklama (30g)" value={stats.clicks_30d} icon={<Eye size={16} />} color="slate" />
          <Stat label="Yeni Müşteri (30g)" value={stats.conversions_30d} icon={<Users size={16} />} color="rose" />
          <Stat label="Toplam Tıklama" value={stats.total_clicks} icon={<Eye size={16} />} color="slate" />
          <Stat label="Toplam Dönüşüm" value={stats.total_conversions} icon={<Users size={16} />} color="rose" />
        </div>
      )}

      {tab === "link" && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <div>
            <div className="text-xs text-slate-500 uppercase mb-1">Partner Linkin</div>
            <div className="flex gap-2">
              <input
                type="text"
                value={partnerLink}
                readOnly
                className="flex-1 px-3 py-2 border border-slate-200 rounded-md font-mono text-sm bg-slate-50"
              />
              <button
                onClick={copyLink}
                className="px-4 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 flex items-center gap-2"
              >
                {copied ? <><Check size={16} /> Kopyalandı</> : <><Copy size={16} /> Kopyala</>}
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <div className="text-xs text-slate-500 uppercase mb-3">Hızlı Paylaş</div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={shareWhatsApp} className="px-3 py-2 bg-green-600 text-white rounded-md text-sm flex items-center gap-1 hover:bg-green-700">
                <Share2 size={14} /> WhatsApp
              </button>
              <button onClick={shareTwitter} className="px-3 py-2 bg-sky-500 text-white rounded-md text-sm flex items-center gap-1 hover:bg-sky-600">
                <Share2 size={14} /> Twitter/X
              </button>
              <button onClick={shareLinkedin} className="px-3 py-2 bg-blue-700 text-white rounded-md text-sm flex items-center gap-1 hover:bg-blue-800">
                <Share2 size={14} /> LinkedIn
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 text-sm text-slate-600">
            <strong>Nasıl çalışır?</strong>
            <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
              <li>Linkine tıklayan bir kullanıcı için 60 gün boyunca seninle ilişkilendirilir.</li>
              <li>Bu süre içinde abone olursa → ilk ödemenin <strong>%20'si</strong> + sonraki yenilemelerin <strong>%10'u</strong> (12 ay).</li>
              <li>E-kitap alırsa → satışın <strong>%20'si</strong>.</li>
              <li>14 gün refund penceresinden sonra komisyon <strong>"onaylı"</strong> olur.</li>
              <li>Onaylı bakiyen <strong>500 TL</strong>'yi geçince ödeme yapılır.</li>
            </ul>
          </div>
        </div>
      )}

      {tab === "commissions" && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">Tarih</th>
                <th className="px-3 py-2 text-left">Ürün</th>
                <th className="px-3 py-2 text-right">Satış</th>
                <th className="px-3 py-2 text-right">Oran</th>
                <th className="px-3 py-2 text-right">Komisyon</th>
                <th className="px-3 py-2 text-center">Durum</th>
              </tr>
            </thead>
            <tbody>
              {commissions.length === 0 ? (
                <tr><td colSpan={6} className="text-center p-8 text-slate-400">Henüz komisyon yok</td></tr>
              ) : commissions.map((c) => (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 text-slate-600">{new Date(c.created_at).toLocaleDateString("tr-TR")}</td>
                  <td className="px-3 py-2">
                    {c.source_type === "subscription" ? `Abonelik (${c.billing_cycle}. ödeme)` : "E-kitap"}
                  </td>
                  <td className="px-3 py-2 text-right">{tl(c.sale_amount_kurus)}</td>
                  <td className="px-3 py-2 text-right">%{(Number(c.commission_rate) * 100).toFixed(0)}</td>
                  <td className="px-3 py-2 text-right font-medium">{tl(c.commission_kurus)}</td>
                  <td className="px-3 py-2 text-center">
                    <StatusBadge status={c.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "payouts" && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">Dönem</th>
                <th className="px-3 py-2 text-right">Tutar</th>
                <th className="px-3 py-2 text-center">Komisyon Sayısı</th>
                <th className="px-3 py-2 text-center">Durum</th>
                <th className="px-3 py-2 text-left">Referans</th>
              </tr>
            </thead>
            <tbody>
              {payouts.length === 0 ? (
                <tr><td colSpan={5} className="text-center p-8 text-slate-400">Henüz ödeme yok</td></tr>
              ) : payouts.map((p) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">{p.period_start} → {p.period_end}</td>
                  <td className="px-3 py-2 text-right font-medium">{tl(p.amount_kurus)}</td>
                  <td className="px-3 py-2 text-center">{p.commission_count}</td>
                  <td className="px-3 py-2 text-center"><StatusBadge status={p.status} /></td>
                  <td className="px-3 py-2 font-mono text-xs">{p.payment_reference ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "bank" && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 max-w-xl">
          <div className="flex items-center gap-2 mb-4 text-emerald-700">
            <CreditCard size={20} /> <h2 className="font-semibold">Ödeme Bilgileri</h2>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Min ödeme tutarı: <strong>500 TL</strong>. Ödemeler aylık, her ayın 5'inde IBAN'ına geçer.
            KVKK gereği TC kimlik ve IBAN bilgilerin güvenli saklanır.
          </p>

          <div className="space-y-3">
            <Field label="Hesap Sahibi Adı Soyadı" value={bank.accountHolderName} onChange={(v) => setBank({ ...bank, accountHolderName: v })} />
            <Field label="TC Kimlik Numarası" value={bank.tcNumber} onChange={(v) => setBank({ ...bank, tcNumber: v.replace(/\D/g, "").slice(0, 11) })} placeholder="11 rakam" />
            <Field label="IBAN" value={bank.iban} onChange={(v) => setBank({ ...bank, iban: v.toUpperCase() })} placeholder="TR.. (26 karakter)" mono />
            <Field label="Banka Adı (opsiyonel)" value={bank.bankName} onChange={(v) => setBank({ ...bank, bankName: v })} />

            <button
              onClick={saveBank}
              disabled={bankSaving}
              className="w-full py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50"
            >
              {bankSaving ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </div>
        </div>
      )}

      {tab === "materials" && (
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <ExternalLink size={18} /> Pazarlama Materyalleri
          </h2>
          <p className="text-sm text-slate-600 mb-4">
            Aşağıdaki görselleri ve metinleri sosyal medyada paylaşabilirsin. Logo + 3 farklı ebatta banner mevcut.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { name: "Instagram Post (1080×1080)", file: "banner-1080.svg" },
              { name: "Story (1080×1350)", file: "banner-1350.svg" },
              { name: "Facebook/LinkedIn (1200×628)", file: "banner-1200.svg" },
            ].map((m) => (
              <a
                key={m.file}
                href={`/api-server/affiliate-materials/${m.file}`}
                target="_blank"
                rel="noreferrer"
                className="block p-4 border border-slate-200 rounded-md hover:bg-slate-50"
              >
                <div className="font-medium text-sm">{m.name}</div>
                <div className="text-xs text-slate-500 mt-1">İndir / Görüntüle ↗</div>
              </a>
            ))}
          </div>

          <div className="mt-6 p-4 bg-emerald-50 border border-emerald-200 rounded-md">
            <strong className="text-sm">Örnek Metin:</strong>
            <p className="text-sm text-slate-700 mt-2 italic">
              "Sphere English ile iş İngilizcesinde gerçekten ilerliyorum. AI destekli koçluk + 7 gün ücretsiz deneme.
              {" "}Linkimi kullanırsan ikimize de bonus: <strong>{partnerLink}</strong>"
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, icon, color }: { label: string; value: any; icon: React.ReactNode; color: string }) {
  const colorMap: Record<string, string> = {
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    rose: "bg-rose-50 text-rose-700 border-rose-200",
    violet: "bg-violet-50 text-violet-700 border-violet-200",
    slate: "bg-slate-50 text-slate-700 border-slate-200",
  };
  return (
    <div className={`border rounded-lg p-3 ${colorMap[color]}`}>
      <div className="flex items-center gap-1.5 text-xs opacity-80 mb-1">{icon} {label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const m: Record<string, { c: string; t: string }> = {
    pending: { c: "bg-amber-100 text-amber-700", t: "Bekliyor" },
    approved: { c: "bg-blue-100 text-blue-700", t: "Onaylı" },
    paid: { c: "bg-emerald-100 text-emerald-700", t: "Ödendi" },
    refunded: { c: "bg-red-100 text-red-700", t: "İade" },
    cancelled: { c: "bg-slate-100 text-slate-700", t: "İptal" },
  };
  const x = m[status] ?? { c: "bg-slate-100", t: status };
  return <span className={`text-xs px-2 py-0.5 rounded-full ${x.c}`}>{x.t}</span>;
}

function Field({ label, value, onChange, placeholder, mono }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent ${mono ? "font-mono" : ""}`}
      />
    </div>
  );
}
