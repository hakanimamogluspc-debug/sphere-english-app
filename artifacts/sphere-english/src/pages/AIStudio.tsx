import { motion } from "framer-motion";
import { Link } from "wouter";
import { useState } from "react";
import {
  Mic, PenLine, Brain, Gamepad2, Sparkles, Star,
  ChevronRight, BookOpen, MessageSquare, Trophy,
  Volume2, CheckCircle, Zap, Users, ChevronDown, Menu, X, Briefcase
} from "lucide-react";

const NAVY = "#1e3a6e";
const TURQUOISE = "#13a9e0";

const AI_FEATURES = [
  {
    icon: Mic,
    title: "Telaffuz Koçu",
    subtitle: "Pronunciation Coach",
    description:
      "11 farklı aksan ve uzmanlık alanına sahip yapay zeka koçuyla gerçek zamanlı konuşma pratiği yapın. Whisper AI ile söylediğiniz her kelime analiz edilir, anında geri bildirim alırsınız.",
    highlights: ["11 farklı koç & aksan", "Gerçek zamanlı ses analizi", "Kelime bazlı telaffuz skoru", "GPT-4o konuşma motoru"],
    color: TURQUOISE,
    gradient: "from-sky-500 to-cyan-600",
    bg: "from-sky-50 to-cyan-50",
    link: "/student/pronunciation-coach",
    tag: "En Popüler",
  },
  {
    icon: PenLine,
    title: "Yazma Koçu",
    subtitle: "Writing Coach",
    description:
      "İş e-postasından akademik makaleye, rapor yazmadan yaratıcı içeriğe kadar her türlü metni yapay zeka ile analiz ettirin. CEFR seviyenizi öğrenin, geliştirilmiş versiyon alın.",
    highlights: ["CEFR seviye tespiti (A1–C2)", "Gramer, kelime, tutarlılık skoru", "AI ile düzeltilmiş versiyon", "7 farklı metin türü"],
    color: "#7c3aed",
    gradient: "from-violet-500 to-purple-600",
    bg: "from-violet-50 to-purple-50",
    link: "/student/writing-coach",
    tag: "Yeni",
  },
  {
    icon: Brain,
    title: "Dilbilgisi Koçu",
    subtitle: "Grammar Coach",
    description:
      "A1'den C1'e yapılandırılmış öğrenme yolları. Yanlış cevap verdiğinizde yapay zeka devreye girerek hatanın tam nedenini açıklar — ezber değil, anlayarak öğrenin.",
    highlights: ["A1–C1 yapılandırılmış müfredat", "AI hata analizi", "Kural özeti & örnekler", "Kişiselleştirilmiş geri bildirim"],
    color: "#059669",
    gradient: "from-emerald-500 to-green-600",
    bg: "from-emerald-50 to-green-50",
    link: "/student/grammar-coach",
    tag: null,
  },
  {
    icon: Gamepad2,
    title: "Kelime Oyunu",
    subtitle: "Vocab Game",
    description:
      "Oyunlaştırılmış kelime öğrenme deneyimi. Liderlik tablosu, puan sistemi ve adaptif zorluk seviyeleriyle kelime haznenizi genişletirken eğlenin.",
    highlights: ["Adaptif zorluk sistemi", "Liderlik tablosu & sıralama", "Streak & rozet sistemi", "4000+ iş İngilizcesi kelimesi"],
    color: "#d97706",
    gradient: "from-amber-500 to-orange-500",
    bg: "from-amber-50 to-orange-50",
    link: "/student/vocab-game",
    tag: null,
  },
  {
    icon: Briefcase,
    title: "İş Senaryoları",
    subtitle: "Business Simulation",
    description:
      "14 farklı sektörde gerçek iş senaryolarını simüle edin. Yatırımcı sunumundan müzakere oturumuna, sözleşme görüşmesinden kriz yönetimine — profesyonel dil pratiğinizi gerçek iş bağlamında yapın.",
    highlights: ["14 sektör & 50+ senaryo", "12 uzman AI koç", "Gramer & kelime analizi", "Oturum raporu & skor"],
    color: "#0f766e",
    gradient: "from-teal-500 to-emerald-600",
    bg: "from-teal-50 to-emerald-50",
    link: "/student/simulation-mode",
    tag: "Yeni",
  },
];

const COACHES = [
  {
    id: "sterling", name: "Mr. Sterling", flag: "🇬🇧", specialty: "CEO & Stratejik Yönetim",
    accent: "Üst Segment İngiliz (RP)", color: "#1E3A5F", image: "coach-sterling.png",
    bio: "30 yılı küresel şirketlerin yönetim kurullarında geçirmiş emektar bir yönetici. Az ve öz konuşur; liderlik dili, stratejik sunum ve C-suite toplantı jargonu onun uzmanlık bölgesi.",
    idealFor: "Yönetici adayları · Yabancı yatırımcı görüşmeleri · Kurumsal sunum",
  },
  {
    id: "jake", name: "Jake", flag: "🇺🇸", specialty: "Pazarlama & Dijital Medya",
    accent: "West Coast Amerikan", color: "#EA580C", image: "coach-jake.png",
    bio: "San Francisco enerjisiyle dijital çağın konuşma dilini öğretiyor. Güncel jargon, kısa ve etkili pitch yapısı, sosyal medya ve startup toplantı İngilizcesi onun alanı.",
    idealFor: "Dijital pazarlama · Girişimciler · Akıcı Amerikan İngilizcesi",
  },
  {
    id: "david", name: "David", flag: "🇺🇸", specialty: "Finans & Yatırım",
    accent: "New York (Wall Street)", color: "#0369A1", image: "coach-david.png",
    bio: "Wall Street'te yetişmiş, rakamlara hâkim ve zamanın kıymetini bilen biri. Yatırım sunumları, finansal raporlama dili ve CFO toplantıları onun uzmanlığı.",
    idealFor: "Finans & bankacılık · Yabancı müşteri görüşmeleri · Analitik sunum",
  },
  {
    id: "emma", name: "Emma", flag: "🇬🇧", specialty: "İnsan Kaynakları",
    accent: "Standart İngiliz (London)", color: "#BE185D", image: "coach-emma-hr.png",
    bio: "Empatik ve insan odaklı. Mülakat İngilizcesi, cover letter dili, performans görüşmeleri ve ekip içi iletişim konusunda standart ama sıcak bir İngiliz aksanıyla rehberlik eder.",
    idealFor: "İş başvurusu · İK profesyonelleri · Mülakat hazırlığı",
  },
  {
    id: "raj", name: "Raj", flag: "🇮🇳", specialty: "BT & Yazılım Geliştirme",
    accent: "Hint-İngiliz (Global Tech)", color: "#7C3AED", image: "coach-raj.png",
    bio: "Hindistan'dan Silicon Valley'e uzanan kariyeriyle global teknoloji şirketlerinin dil kodunu çok iyi biliyor. Teknik sunum, proje yönetimi ve scrum toplantıları onun uzmanlığı.",
    idealFor: "Yazılımcılar · IT yöneticileri · Teknik sunum dili",
  },
  {
    id: "hans", name: "Hans", flag: "🇩🇪", specialty: "Lojistik & Operasyon",
    accent: "Alman-İngiliz (Euro-English)", color: "#374151", image: "coach-hans.png",
    bio: "Düzenli, sistematik ve son derece pratik. Tedarik zinciri jargonu, lojistik koordinasyon dili ve Avrupa iş ortaklarıyla iletişim konusunda gerçekçi alıştırmalar sunar.",
    idealFor: "Lojistik & tedarik zinciri · Avrupa iş iletişimi · Operasyon yöneticileri",
  },
  {
    id: "elena", name: "Elena", flag: "🇪🇺", specialty: "Uluslararası Hukuk",
    accent: "Diplomatik (Doğu Avrupa)", color: "#065F46", image: "coach-elena.png",
    bio: "Uluslararası tahkim, sözleşme müzakeresi ve Avrupa kurumlarında deneyimli. Hukuki metinleri anlık çözümleyen ve kesin bir diplomatik dil kullanan mükemmeliyetçi bir koç.",
    idealFor: "Hukuk profesyonelleri · Uluslararası sözleşmeler · Diplomatik İngilizce",
  },
  {
    id: "alistair", name: "Alistair", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", specialty: "Satış & Müzakere",
    accent: "İskoç (Edinburg)", color: "#B91C1C", image: "coach-alistair.png",
    bio: "Edinburg doğumlu, sahadan yetişmiş bir satış efsanesi. Müzakere teknikleri, ikna dili, itiraz yönetimi ve kapanış cümleleri konusunda rakipsiz bir pratikçi.",
    idealFor: "Satış uzmanları · Müzakere becerileri · Kurumsal fiyatlama görüşmeleri",
  },
  {
    id: "chloe", name: "Chloe", flag: "🇦🇺", specialty: "Müşteri İlişkileri",
    accent: "Avusturalyalı (Friendly)", color: "#D97706", image: "coach-chloe.png",
    bio: "Melbourne'dan dünyaya; sıcak, samimi ve rahatlatıcı. Müşteri destek İngilizcesi, şikâyet yönetimi, e-ticaret iletişimi ve günlük konuşma pratiği onun güçlü yanları.",
    idealFor: "Müşteri hizmetleri · Çağrı merkezi · Samimi Avustralya İngilizcesi",
  },
  {
    id: "james", name: "James", flag: "🇺🇸", specialty: "Üretim & Fabrika Yönetimi",
    accent: "Amerikan (Midwest)", color: "#78350F", image: "coach-james-mfg.png",
    bio: "Ohio'da yetişmiş, fabrika sahasından yönetim masasına çıkmış biri. Üretim süreçleri jargonu, iş güvenliği talimatları ve tedarikçi görüşmeleri konusunda direkt ve güvenilir.",
    idealFor: "Üretim & imalat yöneticileri · Endüstriyel sektör · Teknik Amerikan İngilizcesi",
  },
  {
    id: "claire", name: "Dr. Claire", flag: "🇬🇧", specialty: "Gramer & İleri Telaffuz",
    accent: "Akademik İngiliz (Oxford)", color: "#0F766E", image: "coach-claire-grammar.png",
    bio: "Oxford'da yetişmiş dil bilimci. Makale kullanımı, sesli harf seslenimleri, cümle vurgusu gibi Türk öğrencilerin zorlandığı noktalara odaklanır — sabırlı, titiz ve sistematik.",
    idealFor: "IELTS · TOEFL · Akademik sunum · C1/C2 hedefleyenler",
  },
];

const STATS = [
  { value: "11", label: "Yapay Zeka Koçu", icon: Users },
  { value: "5", label: "AI Özelliği", icon: Sparkles },
  { value: "4000+", label: "Kelime & Kural", icon: BookOpen },
  { value: "A1–C2", label: "CEFR Seviyeleri", icon: Trophy },
];

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: "easeOut" } },
};
const stagger = { show: { transition: { staggerChildren: 0.1 } } };

const NAV_ITEMS = [
  { label: "Anasayfa", href: "https://www.sphereenglish.com" },
  { label: "Hakkımızda", href: "https://www.sphereenglish.com/hakkimizda" },
  { label: "AI Studio", href: "/ai-studio", active: true },
  { label: "Çözümler", href: "https://www.sphereenglish.com/cozumler", dropdown: true },
  { label: "Blog", href: "https://www.sphereenglish.com/blog" },
  { label: "İletişim", href: "https://www.sphereenglish.com/iletisim" },
];

function MarketingHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-100"
      style={{ boxShadow: "0 1px 12px rgba(30,58,110,0.07)" }}>
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <a href="https://www.sphereenglish.com"
          className="flex items-center gap-0 text-xl font-black tracking-tight select-none"
          style={{ fontFamily: "'Outfit', sans-serif" }}>
          <span style={{ color: NAVY }}>SPHERE&nbsp;</span>
          <span className="font-normal" style={{ color: NAVY }}>ENGLISH</span>
        </a>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map((item) => (
            <div key={item.label} className="relative">
              {item.active ? (
                <a href={item.href}
                  className="flex items-center gap-1 px-4 py-2 rounded-full text-sm font-bold transition-all"
                  style={{ color: TURQUOISE, background: `${TURQUOISE}12` }}>
                  {item.label}
                </a>
              ) : item.dropdown ? (
                <a href={item.href}
                  className="flex items-center gap-0.5 px-4 py-2 rounded-full text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-all">
                  {item.label}
                  <ChevronDown size={13} className="opacity-60" />
                </a>
              ) : (
                <a href={item.href}
                  className="flex items-center px-4 py-2 rounded-full text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-all">
                  {item.label}
                </a>
              )}
            </div>
          ))}
        </nav>

        {/* CTA buttons */}
        <div className="hidden md:flex items-center gap-2">
          <Link href="/login"
            className="px-5 py-2 rounded-full text-sm font-bold border-2 transition-all hover:bg-gray-50"
            style={{ borderColor: NAVY, color: NAVY }}>
            Giriş Yap
          </Link>
          <Link href="/register"
            className="px-5 py-2 rounded-full text-sm font-bold text-white transition-all hover:opacity-90"
            style={{ background: TURQUOISE }}>
            Teklif Al
          </Link>
        </div>

        {/* Mobile menu toggle */}
        <button className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
          onClick={() => setMobileOpen(o => !o)}>
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 px-6 py-4 space-y-1">
          {NAV_ITEMS.map((item) => (
            <a key={item.label} href={item.href}
              className="flex items-center px-4 py-3 rounded-xl text-sm font-medium transition-all"
              style={item.active
                ? { color: TURQUOISE, background: `${TURQUOISE}12`, fontWeight: 700 }
                : { color: "#374151" }}>
              {item.label}
              {item.dropdown && <ChevronDown size={13} className="ml-1 opacity-60" />}
            </a>
          ))}
          <div className="flex gap-2 pt-3">
            <Link href="/login"
              className="flex-1 text-center px-4 py-2.5 rounded-full text-sm font-bold border-2 transition-all"
              style={{ borderColor: NAVY, color: NAVY }}>
              Giriş Yap
            </Link>
            <Link href="/register"
              className="flex-1 text-center px-4 py-2.5 rounded-full text-sm font-bold text-white transition-all"
              style={{ background: TURQUOISE }}>
              Teklif Al
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

export default function AIStudio() {
  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <MarketingHeader />

      {/* ── HERO ─────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden flex flex-col items-center justify-center text-center px-6 pt-44 pb-28"
        style={{ background: `linear-gradient(135deg, #0f1f3d 0%, ${NAVY} 50%, #1a4a8a 100%)` }}
      >
        {/* Grid bg */}
        <div className="absolute inset-0 opacity-[0.06]" style={{
          backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)",
          backgroundSize: "56px 56px"
        }} />
        {/* Orbs */}
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-20"
          style={{ background: `radial-gradient(circle, ${TURQUOISE}, transparent 70%)` }} />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full opacity-10"
          style={{ background: `radial-gradient(circle, ${TURQUOISE}, transparent 70%)` }} />

        <motion.div initial="hidden" animate="show" variants={stagger} className="relative z-10 max-w-4xl">
          {/* Badge */}
          <motion.div variants={fadeUp} className="inline-flex items-center gap-2 rounded-full px-5 py-2 mb-8 text-sm font-semibold"
            style={{ background: `${TURQUOISE}22`, color: TURQUOISE, border: `1px solid ${TURQUOISE}44` }}>
            <Sparkles size={15} />
            Yapay Zeka Destekli İngilizce Eğitim
          </motion.div>

          <motion.h1 variants={fadeUp}
            className="text-6xl md:text-7xl font-black text-white mb-2"
            style={{ fontFamily: "'Outfit', sans-serif", letterSpacing: "-0.03em", lineHeight: 1.05 }}>
            Sphere
            <span style={{ color: TURQUOISE }}> AI</span>
            <br />Studio
          </motion.h1>

          <motion.p variants={fadeUp} className="text-xl text-white/60 mt-6 mb-10 max-w-2xl mx-auto leading-relaxed">
            Gerçek zamanlı yapay zeka koçları, akıllı analiz araçları ve oyunlaştırılmış
            öğrenme deneyimiyle İngilizceyi hızla geliştirin.
          </motion.p>

          <motion.div variants={fadeUp} className="flex flex-wrap gap-4 justify-center">
            <Link href="/student/pronunciation-coach"
              className="inline-flex items-center gap-2 rounded-2xl px-8 py-4 font-bold text-white text-base transition-all hover:scale-105 hover:shadow-xl"
              style={{ background: `linear-gradient(135deg, ${TURQUOISE}, #0d7bab)`, boxShadow: `0 8px 32px ${TURQUOISE}44` }}>
              <Mic size={18} />
              Koçla Konuş
            </Link>
            <Link href="/register"
              className="inline-flex items-center gap-2 rounded-2xl px-8 py-4 font-bold text-white/80 text-base border border-white/20 hover:border-white/40 transition-all hover:bg-white/10">
              Ücretsiz Başla
              <ChevronRight size={18} />
            </Link>
          </motion.div>
        </motion.div>

        {/* Stats bar */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="relative z-10 mt-20 grid grid-cols-2 md:grid-cols-4 gap-px w-full max-w-3xl rounded-3xl overflow-hidden"
          style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}>
          {STATS.map(({ value, label, icon: Icon }) => (
            <div key={label} className="flex flex-col items-center gap-1 py-5 px-4">
              <Icon size={18} style={{ color: TURQUOISE }} />
              <span className="text-2xl font-black text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>{value}</span>
              <span className="text-xs text-white/50 text-center">{label}</span>
            </div>
          ))}
        </motion.div>
      </section>

      {/* ── AI ÖZELLİKLERİ ─────────────────────────────────────── */}
      <section className="py-24 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger}>
            <motion.div variants={fadeUp} className="text-center mb-16">
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: TURQUOISE }}>
                — Yapay Zeka Araçları
              </span>
              <h2 className="text-4xl md:text-5xl font-black mt-3 mb-4" style={{ fontFamily: "'Outfit', sans-serif", color: NAVY }}>
                5 Güçlü AI Özelliği
              </h2>
              <p className="text-gray-500 text-lg max-w-xl mx-auto">
                Her biri farklı bir öğrenme ihtiyacına yönelik, birlikte eksiksiz bir İngilizce deneyimi.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {AI_FEATURES.map((f) => (
                <motion.div key={f.title} variants={fadeUp}>
                  <Link href={f.link}
                    className={`block rounded-3xl p-8 bg-gradient-to-br ${f.bg} border border-gray-100 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group`}>
                    <div className="flex items-start justify-between mb-5">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center bg-gradient-to-br ${f.gradient}`}>
                        <f.icon size={26} className="text-white" />
                      </div>
                      {f.tag && (
                        <span className="text-xs font-bold px-3 py-1 rounded-full text-white"
                          style={{ background: f.color }}>
                          {f.tag}
                        </span>
                      )}
                    </div>

                    <h3 className="text-2xl font-black mb-1" style={{ fontFamily: "'Outfit', sans-serif", color: NAVY }}>
                      {f.title}
                    </h3>
                    <p className="text-xs font-semibold mb-3 uppercase tracking-wider" style={{ color: f.color }}>
                      {f.subtitle}
                    </p>
                    <p className="text-gray-600 text-sm leading-relaxed mb-6">
                      {f.description}
                    </p>

                    <ul className="space-y-2">
                      {f.highlights.map((h) => (
                        <li key={h} className="flex items-center gap-2 text-sm text-gray-700">
                          <CheckCircle size={14} style={{ color: f.color, flexShrink: 0 }} />
                          {h}
                        </li>
                      ))}
                    </ul>

                    <div className="mt-6 flex items-center gap-1 text-sm font-bold group-hover:gap-2 transition-all"
                      style={{ color: f.color }}>
                      Hemen Başla <ChevronRight size={16} />
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── KOÇLAR ───────────────────────────────────────────────── */}
      <section className="py-24 px-6" style={{ background: `linear-gradient(180deg, white 0%, #f0f7ff 100%)` }}>
        <div className="max-w-6xl mx-auto">
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger}>
            <motion.div variants={fadeUp} className="text-center mb-16">
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: TURQUOISE }}>
                — Yapay Zeka Koçları
              </span>
              <h2 className="text-4xl md:text-5xl font-black mt-3 mb-4" style={{ fontFamily: "'Outfit', sans-serif", color: NAVY }}>
                11 Uzman, 11 Farklı Dünya
              </h2>
              <p className="text-gray-500 text-lg max-w-xl mx-auto">
                Her biri kendi sektörüne özgü dil ve aksanla; gerçek bir iş ortamına hazırlayan koçlar.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {COACHES.map((coach, i) => (
                <motion.div key={coach.id} variants={fadeUp}
                  custom={i}
                  whileHover={{ y: -5, scale: 1.01 }}
                  transition={{ type: "spring", stiffness: 280 }}
                  className="bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-xl border border-gray-100 transition-all duration-300 flex flex-col">
                  {/* Avatar + header */}
                  <div className="relative flex items-center gap-4 p-5 pb-4"
                    style={{ background: `linear-gradient(135deg, ${coach.color}10, ${coach.color}1a)` }}>
                    <div className="relative flex-shrink-0">
                      <img
                        src={`/images/${coach.image}`}
                        alt={coach.name}
                        className="w-20 h-20 rounded-2xl object-cover shadow-md"
                        onError={(e) => {
                          const t = e.currentTarget;
                          t.style.display = "none";
                          const parent = t.parentElement!;
                          const fallback = document.createElement("div");
                          fallback.style.cssText = `width:80px;height:80px;border-radius:16px;background:${coach.color};display:flex;align-items:center;justify-content:center;font-size:2rem;color:white;font-weight:700`;
                          fallback.textContent = coach.name[0];
                          parent.appendChild(fallback);
                        }}
                      />
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white shadow-sm flex items-center justify-center text-sm leading-none">
                        {coach.flag}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-black text-lg leading-tight mb-0.5 truncate"
                        style={{ fontFamily: "'Outfit', sans-serif", color: NAVY }}>
                        {coach.name}
                      </h4>
                      <p className="text-xs font-bold mb-1 truncate" style={{ color: coach.color }}>
                        {coach.specialty}
                      </p>
                      <p className="text-xs text-gray-400 flex items-center gap-1">
                        <Volume2 size={10} className="flex-shrink-0" />
                        <span className="truncate">{coach.accent}</span>
                      </p>
                    </div>
                  </div>

                  {/* Bio */}
                  <div className="px-5 pt-3 pb-3 flex-1">
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {coach.bio}
                    </p>
                  </div>

                  {/* Ideal For */}
                  <div className="px-5 pb-5">
                    <div className="rounded-xl px-3 py-2.5"
                      style={{ background: `${coach.color}0d`, borderLeft: `3px solid ${coach.color}` }}>
                      <p className="text-xs font-bold mb-0.5 uppercase tracking-wide" style={{ color: coach.color }}>
                        Kimler için ideal?
                      </p>
                      <p className="text-xs text-gray-500 leading-relaxed">{coach.idealFor}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── NASIL ÇALIŞIR ────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger}>
            <motion.div variants={fadeUp} className="text-center mb-16">
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: TURQUOISE }}>— Nasıl Çalışır</span>
              <h2 className="text-4xl font-black mt-3" style={{ fontFamily: "'Outfit', sans-serif", color: NAVY }}>
                3 Adımda AI Koçun Yanında
              </h2>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { step: "01", icon: Users, title: "Koçunu Seç", desc: "11 farklı koç arasından sektörüne ve hedefine en uygun olanı seç. Her birinin farklı aksanı ve uzmanlık alanı var." },
                { step: "02", icon: Mic, title: "Konuşmaya Başla", desc: "Mikrofona bas ve konuş. Whisper AI ses kaydını analiz eder, GPT-4o koçunun karakteriyle yanıt verir." },
                { step: "03", icon: Zap, title: "Anlık Geri Bildirim Al", desc: "Telaffuz skoru, gramer hataları ve kelime önerileri saniyeler içinde ekranında belirir." },
              ].map(({ step, icon: Icon, title, desc }) => (
                <motion.div key={step} variants={fadeUp} className="relative">
                  <div className="text-8xl font-black mb-4 leading-none select-none"
                    style={{ fontFamily: "'Outfit', sans-serif", color: `${TURQUOISE}18` }}>
                    {step}
                  </div>
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 -mt-8"
                    style={{ background: `${TURQUOISE}18` }}>
                    <Icon size={22} style={{ color: TURQUOISE }} />
                  </div>
                  <h3 className="text-xl font-bold mb-2" style={{ fontFamily: "'Outfit', sans-serif", color: NAVY }}>{title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────── */}
      <section className="py-24 px-6" style={{ background: `linear-gradient(135deg, #0f1f3d 0%, ${NAVY} 60%, #1a4a8a 100%)` }}>
        <div className="max-w-3xl mx-auto text-center relative">
          <div className="absolute inset-0 opacity-[0.06]" style={{
            backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)",
            backgroundSize: "48px 48px"
          }} />
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger} className="relative z-10">
            <motion.div variants={fadeUp}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 mb-6 text-sm font-semibold"
              style={{ background: `${TURQUOISE}22`, color: TURQUOISE, border: `1px solid ${TURQUOISE}44` }}>
              <Star size={14} />
              Ücretsiz Dene
            </motion.div>
            <motion.h2 variants={fadeUp}
              className="text-4xl md:text-5xl font-black text-white mb-4"
              style={{ fontFamily: "'Outfit', sans-serif", letterSpacing: "-0.02em" }}>
              AI Koçunla Tanış,<br />Farklı Konuş.
            </motion.h2>
            <motion.p variants={fadeUp} className="text-white/60 text-lg mb-10">
              Kayıt ol, koçunu seç ve ilk dersini hemen başlat.
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-wrap gap-4 justify-center">
              <Link href="/register"
                className="inline-flex items-center gap-2 rounded-2xl px-8 py-4 font-bold text-white text-base hover:scale-105 transition-transform"
                style={{ background: `linear-gradient(135deg, ${TURQUOISE}, #0d7bab)`, boxShadow: `0 8px 32px ${TURQUOISE}44` }}>
                <Sparkles size={18} />
                Hemen Başla — Ücretsiz
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

    </div>
  );
}
