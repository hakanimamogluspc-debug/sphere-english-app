'use client';
import React, { useState } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const NAVY = '#1B365D';
const TURQUOISE = '#0ea5e9';

/* ────────────────────────────────── DATA ── */

const AI_FEATURES = [
  {
    icon: '🎙️',
    title: 'Telaffuz Koçu',
    subtitle: 'PRONUNCIATION COACH',
    description:
      '11 farklı aksan ve uzmanlık alanına sahip yapay zeka koçuyla gerçek zamanlı konuşma pratiği yapın. OpenAI Whisper teknolojisiyle söylediğiniz her kelime fonem düzeyinde analiz edilir; telaffuz skoru, vurgu hatası ve akış önerileri anında ekrana gelir.',
    highlights: ['11 farklı koç & aksan', 'Fonem bazlı ses analizi', 'Kelime bazlı telaffuz skoru', 'GPT-4o konuşma motoru'],
    detail: 'Her ders sonrası ilerleme grafiği ve hata dağılım raporu oluşturulur. İngiliz RP, Amerikan, Avustralya, Hint-İngiliz ve daha fazla aksan seçeneği sunar.',
    color: TURQUOISE,
    bg: 'from-sky-50 to-cyan-50',
    link: 'https://app.sphereenglish.com/student/pronunciation-coach',
    tag: 'En Popüler',
    tagBg: TURQUOISE,
  },
  {
    icon: '✍️',
    title: 'Yazma Koçu',
    subtitle: 'WRITING COACH',
    description:
      'İş e-postasından akademik makaleye, rapor yazmadan yaratıcı içeriğe kadar her türlü metni yapay zeka ile analiz ettirin. Metniniz CEFR standartlarına göre A1–C2 arasında puanlanır; gramer, kelime zenginliği, tutarlılık ve ton açısından detaylı geri bildirim alırsınız.',
    highlights: ['CEFR seviye tespiti (A1–C2)', 'Gramer, kelime, tutarlılık & ton skoru', 'AI ile yeniden yazılmış versiyon', '7 farklı metin türü'],
    detail: 'E-posta, rapor, sunum, özgeçmiş, akademik metin, müzakere mektubu ve teknik döküman türlerini destekler. Geliştirilmiş versiyon ve açıklamalı karşılaştırma birlikte sunulur.',
    color: '#7c3aed',
    bg: 'from-violet-50 to-purple-50',
    link: 'https://app.sphereenglish.com/student/writing-coach',
    tag: 'Yeni',
    tagBg: '#7c3aed',
  },
  {
    icon: '🧠',
    title: 'Dilbilgisi Koçu',
    subtitle: 'GRAMMAR COACH',
    description:
      "A1'den C1'e uzanan yapılandırılmış öğrenme yollarıyla dilbilgisi kurallarını kalıcı olarak öğrenin. Yanlış cevap verdiğinizde yapay zeka hatanın tam nedenini, doğru kuralı ve benzer örnekleri açıklar — ezber değil, anlayarak öğrenme.",
    highlights: ['A1–C1 yapılandırılmış müfredat', 'AI destekli hata analizi', 'Kural özeti, örnek cümle & alıştırma', 'Kişiselleştirilmiş geri bildirim'],
    detail: 'Tenses, conditionals, modal verbs, articles, prepositions ve daha fazlası. Türk öğrencilerin sıkça yaptığı hatalar için özel hazırlanmış alıştırma setleri mevcuttur.',
    color: '#059669',
    bg: 'from-emerald-50 to-green-50',
    link: 'https://app.sphereenglish.com/student/grammar-coach',
    tag: null,
    tagBg: null,
  },
  {
    icon: '🎮',
    title: 'Kelime Oyunu',
    subtitle: 'VOCAB GAME',
    description:
      'Oyunlaştırılmış kelime öğrenme deneyimiyle 4000\'den fazla iş İngilizcesi kelimesini pekiştirin. Adaptif zorluk sistemi performansınıza göre kendiliğinden ayarlanır; liderlik tablosu, streak ödülleri ve rozetler motivasyonunuzu canlı tutar.',
    highlights: ['4000+ iş İngilizcesi kelimesi', 'Adaptif zorluk algoritması', 'Liderlik tablosu & sıralama', 'Streak & rozet sistemi'],
    detail: 'Kelimeler bağlamsal cümleler içinde sunulur; sadece anlam değil, kullanım kalıpları da öğretilir. Günlük hedef ve haftalık ilerleme takibi mevcuttur.',
    color: '#d97706',
    bg: 'from-amber-50 to-orange-50',
    link: 'https://app.sphereenglish.com/student/vocab-game',
    tag: null,
    tagBg: null,
  },
  {
    icon: '💼',
    title: 'İş Senaryoları',
    subtitle: 'BUSINESS SIMULATION',
    description:
      '14 farklı sektörde gerçek iş hayatı senaryolarını simüle edin. Yatırımcı sunumundan müzakere masasına, sözleşme görüşmesinden kriz yönetimine — 12 uzman AI koçuyla profesyonel İngilizce pratiği yapın. Her konuşma sonrası gramer analizi ve skor raporu alın.',
    highlights: ['14 sektör & 50+ gerçek senaryo', '12 uzman AI koç (finans, hukuk, BT…)', 'Anlık gramer & kelime geri bildirimi', 'Oturum raporu, hata özeti & skor'],
    detail: 'Finans, teknoloji, sağlık turizmi, lojistik, hukuk, danışmanlık ve daha pek çok sektörde gerçekçi diyaloglar. Mr. Sterling ile yönetim kurulu sunumu, Elena ile sözleşme müzakeresi, David ile CFO görüşmesi…',
    color: '#0f766e',
    bg: 'from-teal-50 to-emerald-50',
    link: 'https://app.sphereenglish.com/student/simulation-mode',
    tag: 'Yeni',
    tagBg: '#0f766e',
    span: true,
  },
];

const COACHES = [
  { id: 'sterling', name: 'Mr. Sterling', flag: '🇬🇧', specialty: 'CEO & Stratejik Yönetim', accent: 'Üst Segment İngiliz (RP)', color: '#1E3A5F', image: 'coach-sterling.png', bio: '30 yılı küresel şirketlerin yönetim kurullarında geçirmiş emektar bir yönetici. Az ve öz konuşur; liderlik dili, stratejik sunum ve C-suite toplantı jargonu onun uzmanlık bölgesi.', idealFor: 'Yönetici adayları · Yabancı yatırımcı görüşmeleri · Kurumsal sunum' },
  { id: 'jake', name: 'Jake', flag: '🇺🇸', specialty: 'Pazarlama & Dijital Medya', accent: 'West Coast Amerikan', color: '#EA580C', image: 'coach-jake.png', bio: 'San Francisco enerjisiyle dijital çağın konuşma dilini öğretiyor. Güncel jargon, kısa ve etkili pitch yapısı, sosyal medya ve startup toplantı İngilizcesi onun alanı.', idealFor: 'Dijital pazarlama · Girişimciler · Akıcı Amerikan İngilizcesi' },
  { id: 'david', name: 'David', flag: '🇺🇸', specialty: 'Finans & Yatırım', accent: 'New York (Wall Street)', color: '#0369A1', image: 'coach-david.png', bio: "Wall Street'te yetişmiş, rakamlara hâkim ve zamanın kıymetini bilen biri. Yatırım sunumları, finansal raporlama dili ve CFO toplantıları onun uzmanlığı.", idealFor: 'Finans & bankacılık · Yabancı müşteri görüşmeleri · Analitik sunum' },
  { id: 'emma', name: 'Emma', flag: '🇬🇧', specialty: 'İnsan Kaynakları', accent: 'Standart İngiliz (London)', color: '#BE185D', image: 'coach-emma-hr.png', bio: 'Empatik ve insan odaklı. Mülakat İngilizcesi, cover letter dili, performans görüşmeleri ve ekip içi iletişim konusunda standart ama sıcak bir İngiliz aksanıyla rehberlik eder.', idealFor: 'İş başvurusu · İK profesyonelleri · Mülakat hazırlığı' },
  { id: 'raj', name: 'Raj', flag: '🇮🇳', specialty: 'BT & Yazılım Geliştirme', accent: 'Hint-İngiliz (Global Tech)', color: '#7C3AED', image: 'coach-raj.png', bio: "Hindistan'dan Silicon Valley'e uzanan kariyeriyle global teknoloji şirketlerinin dil kodunu çok iyi biliyor. Teknik sunum, proje yönetimi ve scrum toplantıları onun uzmanlığı.", idealFor: 'Yazılımcılar · IT yöneticileri · Teknik sunum dili' },
  { id: 'hans', name: 'Hans', flag: '🇩🇪', specialty: 'Lojistik & Operasyon', accent: 'Alman-İngiliz (Euro-English)', color: '#374151', image: 'coach-hans.png', bio: 'Düzenli, sistematik ve son derece pratik. Tedarik zinciri jargonu, lojistik koordinasyon dili ve Avrupa iş ortaklarıyla iletişim konusunda gerçekçi alıştırmalar sunar.', idealFor: 'Lojistik & tedarik zinciri · Avrupa iş iletişimi · Operasyon yöneticileri' },
  { id: 'elena', name: 'Elena', flag: '🇪🇺', specialty: 'Uluslararası Hukuk', accent: 'Diplomatik (Doğu Avrupa)', color: '#065F46', image: 'coach-elena.png', bio: 'Uluslararası tahkim, sözleşme müzakeresi ve Avrupa kurumlarında deneyimli. Hukuki metinleri anlık çözümleyen ve kesin bir diplomatik dil kullanan mükemmeliyetçi bir koç.', idealFor: 'Hukuk profesyonelleri · Uluslararası sözleşmeler · Diplomatik İngilizce' },
  { id: 'alistair', name: 'Alistair', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', specialty: 'Satış & Müzakere', accent: 'İskoç (Edinburg)', color: '#B91C1C', image: 'coach-alistair.png', bio: "Edinburg doğumlu, sahadan yetişmiş bir satış efsanesi. Müzakere teknikleri, ikna dili, itiraz yönetimi ve kapanış cümleleri konusunda rakipsiz bir pratikçi.", idealFor: 'Satış uzmanları · Müzakere becerileri · Kurumsal fiyatlama görüşmeleri' },
  { id: 'chloe', name: 'Chloe', flag: '🇦🇺', specialty: 'Müşteri İlişkileri', accent: 'Avusturalyalı (Friendly)', color: '#D97706', image: 'coach-chloe.png', bio: "Melbourne'dan dünyaya; sıcak, samimi ve rahatlatıcı. Müşteri destek İngilizcesi, şikâyet yönetimi, e-ticaret iletişimi ve günlük konuşma pratiği onun güçlü yanları.", idealFor: 'Müşteri hizmetleri · Çağrı merkezi · Samimi Avustralya İngilizcesi' },
  { id: 'james', name: 'James', flag: '🇺🇸', specialty: 'Üretim & Fabrika Yönetimi', accent: 'Amerikan (Midwest)', color: '#78350F', image: 'coach-james-mfg.png', bio: "Ohio'da yetişmiş, fabrika sahasından yönetim masasına çıkmış biri. Üretim süreçleri jargonu, iş güvenliği talimatları ve tedarikçi görüşmeleri konusunda direkt ve güvenilir.", idealFor: 'Üretim & imalat yöneticileri · Endüstriyel sektör · Teknik Amerikan İngilizcesi' },
  { id: 'olivia', name: 'Dr. Olivia', flag: '🇺🇸', specialty: 'Sağlık Turizmi İngilizcesi', accent: 'Amerikan (Miami / Sağlık Turizmi)', color: '#0891b2', image: 'coach-olivia-health.png', bio: 'Miami merkezli sağlık turizmi koordinatörü. Uluslararası hastaların tedavi planlamasından hastane koordinasyonuna, sigorta sürecinden klinik görüşmelere kadar tüm profesyonel İngilizce ihtiyaçlarını karşılıyor. Türk sağlık turizmcileri için özel koç.', idealFor: 'Sağlık turizmi profesyonelleri · Hastane koordinatörleri · Medikal danışmanlar' },
  { id: 'claire', name: 'Dr. Claire', flag: '🇬🇧', specialty: 'Gramer & İleri Telaffuz', accent: 'Akademik İngiliz (Oxford)', color: '#0F766E', image: 'coach-claire-grammar.png', bio: "Oxford'da yetişmiş dil bilimci. Makale kullanımı, sesli harf seslenimleri, cümle vurgusu gibi Türk öğrencilerin zorlandığı noktalara odaklanır — sabırlı, titiz ve sistematik.", idealFor: 'IELTS · TOEFL · Akademik sunum · C1/C2 hedefleyenler' },
];

const STATS = [
  { value: '11', label: 'Yapay Zeka Koçu' },
  { value: '5', label: 'AI Özelliği' },
  { value: '4000+', label: 'Kelime & Kural' },
  { value: 'A1–C2', label: 'CEFR Seviyeleri' },
];

const HOW_IT_WORKS = [
  { step: '01', icon: '🔐', title: 'Üye Ol', desc: 'Ücretsiz hesap oluşturun. Kredi kartı gerekmez. 30 saniyede kayıt tamamlanır.' },
  { step: '02', icon: '🎯', title: 'Koç Seç', desc: '11 yapay zeka koçu arasından kendi sektörünüze ve öğrenme hedefinize en uygun olanı seçin.' },
  { step: '03', icon: '🗣️', title: 'Konuş, Yaz & Simüle Et', desc: 'Telaffuz koçuyla sesli konuşun, iş senaryolarını simüle edin, yazma koçuna metin gönderin, dilbilgisi sorularını çözün veya kelime oyunu oynayın.' },
  { step: '04', icon: '📊', title: 'Gelişimini Takip Et', desc: 'Her oturum sonrası otomatik oluşturulan raporlar, hata dağılımı ve CEFR seviyenizi güncel tutar.' },
];

const TECH_STACK = [
  { name: 'GPT-4o', role: 'Konuşma & analiz motoru', color: TURQUOISE },
  { name: 'Whisper AI', role: 'Gerçek zamanlı ses tanıma', color: '#7c3aed' },
  { name: 'CEFR Çerçevesi', role: 'Uluslararası dil ölçütü', color: '#059669' },
  { name: 'Oxford Müfredatı', role: 'İçerik & soru tabanı', color: '#d97706' },
];

const FAQS = [
  {
    q: 'Sphere AI Studio nedir?',
    a: 'Sphere AI Studio, Sphere English LMS platformunun yapay zeka destekli eğitim bölümüdür. 12 farklı yapay zeka koçu, 5 özellik (Telaffuz Koçu, İş Senaryoları, Yazma Koçu, Dilbilgisi Koçu, Kelime Oyunu) ve A1–C2 CEFR ölçeğinde kapsamlı içerikler sunar. GPT-4o ve Whisper AI teknolojileri kullanılarak geliştirilmiştir.',
  },
  {
    q: 'AI Studio\'yu kullanmak için ne kadar İngilizce bilmem gerekiyor?',
    a: 'Hiç bilmene gerek yok. A1 (başlangıç) seviyesinden C2 (ileri) seviyesine kadar tüm kullanıcılar için uygun içerik mevcuttur. İlk girişte seviye tespiti yapılır ve size özel öneriler sunulur.',
  },
  {
    q: 'Hangi yapay zeka teknolojileri kullanılıyor?',
    a: 'Telaffuz Koçu için OpenAI Whisper (ses tanıma) ve GPT-4o (konuşma & geri bildirim) kullanılır. Yazma Koçu CEFR uyumlu dil modelleriyle çalışır. Dilbilgisi Koçu Oxford İngilizce müfredatına dayalı yapılandırılmış bir içerik tabanından beslenir.',
  },
  {
    q: 'Koçlar gerçek kişiler mi yoksa tamamen yapay zeka mı?',
    a: 'Tüm koçlar (Mr. Sterling, Jake, David, Emma, Raj, Hans, Elena, Alistair, Chloe, James, Dr. Claire ve Dr. Olivia) tamamen yapay zekadır. Her koç farklı bir sektör uzmanlığı, aksan ve eğitim stiliyle programlanmıştır. Gerçek bir insan koçun aksine 7/24 erişilebilir ve sınırsız konuşma yapılabilir.',
  },
  {
    q: 'AI Studio kurumsal planlara dahil mi?',
    a: 'Evet. Sphere English\'in tüm kurumsal planlarına AI Studio özellikleri dahildir. Ekip yöneticileri, çalışanların AI Studio kullanımını, ilerleme raporlarını ve CEFR seviye değişimlerini merkezi panelden takip edebilir.',
  },
  {
    q: 'Telaffuz Koçu hangi aksanları destekliyor?',
    a: 'Telaffuz Koçu; İngiliz RP (Mr. Sterling, Dr. Claire, Emma), Amerikan West Coast (Jake), Amerikan Midwest (James), Amerikan Wall Street (David), Hint-İngiliz (Raj), Alman-İngiliz (Hans), Avustralya (Chloe), İskoç (Alistair), Doğu Avrupa (Elena) ve Diplomatik İngilizce aksanlarını destekler.',
  },
  {
    q: 'Yazma Koçu hangi metin türlerini analiz edebiliyor?',
    a: 'Yazma Koçu; iş e-postası, yönetim raporu, sunum metni, özgeçmiş & önyazı, akademik metin, müzakere mektubu ve teknik döküman türlerini analiz eder. Her metin gramer, kelime zenginliği, tutarlılık ve ton açısından CEFR standartlarına göre değerlendirilir.',
  },
  {
    q: 'Dilbilgisi Koçu hangi konuları kapsıyor?',
    a: 'Dilbilgisi Koçu; tüm tense yapıları, conditional cümleler, modal fiiller, article kullanımı, prepositions, passive voice, reported speech, relative clauses ve daha fazlasını A1\'den C1\'e kadar yapılandırılmış bir öğrenme yoluyla ele alır.',
  },
  {
    q: 'Kelime Oyunu\'nun diğer uygulamalardan farkı nedir?',
    a: 'Kelime Oyunu yalnızca genel İngilizce değil, 4000\'den fazla iş İngilizcesi ve sektöre özgü terimi kapsar. Adaptif zorluk algoritması performansınıza göre seviyeyi otomatik ayarlar. Kelimeler bağlamsal cümlelerde sunulduğu için anlam ve kullanım birlikte öğretilir.',
  },
  {
    q: 'İş Senaryoları özelliği nasıl çalışıyor?',
    a: 'Önce sektörünüzü (finans, teknoloji, sağlık, lojistik, hukuk vb.) ve ardından o sektörün uzman koçunu seçiyorsunuz. Senaryo modu ile gerçek iş durumlarını simüle edebilir, serbest konuşma moduyla da koçunuzla dilediğiniz konuyu konuşabilirsiniz. Her tur sonrası gramer hataları, kelime önerileri ve genel skor raporunuz otomatik oluşturulur.',
  },
  {
    q: 'AI Studio\'ya mobil cihazdan erişebilir miyim?',
    a: 'Evet. Sphere English web uygulaması tüm modern mobil tarayıcılarda sorunsuz çalışır. Telaffuz Koçu için telefonun mikrofon iznini vermeniz yeterlidir. Ayrıca ana ekrana ekleyerek uygulama gibi kullanabilirsiniz.',
  },
  {
    q: 'İlerlemeyi nasıl ölçebilirim?',
    a: 'Her AI Studio oturumu sonrası otomatik rapor oluşturulur. Rapor; telaffuz skoru, hata kategorileri, CEFR seviye tahmini ve önceki oturumlarla karşılaştırma içerir. Kurumsal kullanıcılar için yönetici panelinde ekip bazlı ilerleme raporları da mevcuttur.',
  },
  {
    q: 'Sphere AI Studio ile IELTS veya TOEFL\'a hazırlanabilir miyim?',
    a: 'Evet. Dr. Claire (Akademik İngiliz aksanlı dilbilgisi koçu) özellikle IELTS ve TOEFL sınavlarına hazırlanan kullanıcılar için optimize edilmiştir. Writing Coach ise akademik metin türünü destekler. Sınav öncesi yoğun pratik için ideal bir araçtır.',
  },
];

/* ────────────────────────────────── COMPONENT ── */

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-100 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-5 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="font-bold text-base pr-4" style={{ color: NAVY }}>{q}</span>
        <span className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-white text-sm transition-all"
          style={{ background: open ? TURQUOISE : '#e2e8f0', color: open ? 'white' : '#64748b' }}>
          {open ? '−' : '+'}
        </span>
      </button>
      {open && (
        <div className="px-6 pb-5">
          <p className="text-gray-600 text-sm leading-relaxed">{a}</p>
        </div>
      )}
    </div>
  );
}

export default function AIStudioPage() {
  return (
    <div className="min-h-screen bg-white font-sans">
      <Header forceWhite />
      <main>

        {/* ── HERO ── */}
        <section className="relative overflow-hidden flex flex-col items-center justify-center text-center px-6 pt-44 pb-28"
          style={{ background: 'linear-gradient(135deg, #0f1f3d 0%, #1e3a6e 50%, #1a4a8a 100%)' }}>
          <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)', backgroundSize: '56px 56px' }} />
          <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-20" style={{ background: 'radial-gradient(circle, #0ea5e9, transparent 70%)' }} />
          <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #0ea5e9, transparent 70%)' }} />
          <div className="relative z-10 max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 rounded-full px-5 py-2 mb-8 text-sm font-semibold"
              style={{ background: '#0ea5e922', color: '#0ea5e9', border: '1px solid #0ea5e944' }}>
              ✦ Yapay Zeka Destekli İngilizce Eğitim
            </div>
            <h1 className="text-5xl sm:text-6xl md:text-7xl font-black text-white mb-2"
              style={{ fontFamily: "'Outfit', sans-serif", letterSpacing: '-0.03em', lineHeight: 1.05 }}>
              Sphere <span style={{ color: '#0ea5e9' }}>AI</span><br />Studio
            </h1>
            <p className="text-xl text-white/60 mt-6 mb-4 max-w-2xl mx-auto leading-relaxed">
              GPT-4o ve Whisper AI destekli 12 yapay zeka koçuyla gerçek zamanlı konuşma pratiği, iş senaryosu simülasyonu, akıllı yazma analizi, dilbilgisi öğrenimi ve oyunlaştırılmış kelime geliştirme — tek platformda.
            </p>
            <p className="text-sm text-white/40 max-w-xl mx-auto mb-10">
              Oxford müfredatı · CEFR A1–C2 · 7/24 erişim · Kurumsal raporlama
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <a href="https://app.sphereenglish.com/register"
                className="inline-flex items-center gap-2 rounded-2xl px-8 py-4 font-bold text-white/80 text-base border border-white/20 hover:border-white/40 transition-all hover:bg-white/10">
                Ücretsiz Başla →
              </a>
            </div>
          </div>
          <div className="relative z-10 mt-20 grid grid-cols-2 md:grid-cols-4 gap-px w-full max-w-3xl rounded-3xl overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
            {STATS.map(({ value, label }) => (
              <div key={label} className="flex flex-col items-center gap-1 py-5 px-4">
                <span className="text-2xl font-black text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>{value}</span>
                <span className="text-xs text-white/50 text-center">{label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── TEKNOLOJİ ŞERIDI ── */}
        <section className="py-6 border-b border-gray-100" style={{ background: '#fafbff' }}>
          <div className="max-w-4xl mx-auto px-6 flex flex-wrap items-center justify-center gap-8">
            <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Teknoloji</span>
            {TECH_STACK.map((t) => (
              <div key={t.name} className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: t.color }} />
                <span className="text-sm font-bold" style={{ color: NAVY }}>{t.name}</span>
                <span className="text-xs text-gray-400">— {t.role}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── NASIL ÇALIŞIR ── */}
        <section className="py-20 px-6 bg-white">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-14">
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: TURQUOISE }}>— Kullanım Akışı</span>
              <h2 className="text-3xl md:text-4xl font-black mt-3" style={{ fontFamily: "'Outfit', sans-serif", color: NAVY }}>
                4 Adımda Başla
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
              {HOW_IT_WORKS.map((s) => (
                <div key={s.step} className="relative p-6 rounded-2xl border border-gray-100 hover:border-sky-100 hover:shadow-md transition-all">
                  <div className="text-3xl mb-3">{s.icon}</div>
                  <div className="text-xs font-black mb-2 uppercase tracking-widest" style={{ color: TURQUOISE }}>{s.step}</div>
                  <h3 className="font-black text-base mb-2" style={{ color: NAVY }}>{s.title}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 4 AI ÖZELLİĞİ ── */}
        <section className="py-24 px-6 bg-gray-50">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: TURQUOISE }}>— Yapay Zeka Araçları</span>
              <h2 className="text-4xl md:text-5xl font-black mt-3 mb-4" style={{ fontFamily: "'Outfit', sans-serif", color: NAVY }}>
                5 Güçlü AI Özelliği
              </h2>
              <p className="text-gray-500 text-lg max-w-2xl mx-auto">
                Konuşma, yazma, dilbilgisi, kelime ve iş senaryosu — İngilizce öğrenmenin beş temel boyutu, tek platformda yapay zeka ile destekleniyor.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {AI_FEATURES.map((f) => (
                <a key={f.title} href={f.link}
                  className={"block rounded-3xl p-8 bg-gradient-to-br " + f.bg + " border border-gray-100 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group" + ((f as any).span ? " md:col-span-2" : "")}>
                  <div className="flex items-start justify-between mb-5">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl" style={{ background: f.color + '15' }}>
                      {f.icon}
                    </div>
                    {f.tag && (
                      <span className="text-xs font-bold px-3 py-1 rounded-full text-white" style={{ background: f.tagBg || f.color }}>{f.tag}</span>
                    )}
                  </div>
                  <h3 className="text-2xl font-black mb-1" style={{ fontFamily: "'Outfit', sans-serif", color: NAVY }}>{f.title}</h3>
                  <p className="text-xs font-semibold mb-3 uppercase tracking-wider" style={{ color: f.color }}>{f.subtitle}</p>
                  <p className="text-gray-600 text-sm leading-relaxed mb-4">{f.description}</p>
                  <p className="text-xs text-gray-400 leading-relaxed mb-5 italic">{f.detail}</p>
                  <ul className="space-y-2">
                    {f.highlights.map((h) => (
                      <li key={h} className="flex items-center gap-2 text-sm text-gray-700">
                        <span className="w-3.5 h-3.5 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[10px]" style={{ background: f.color }}>✓</span>
                        {h}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-6 flex items-center gap-1 text-sm font-bold group-hover:gap-2 transition-all" style={{ color: f.color }}>
                    Hemen Başla →
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* ── KOÇLAR ── */}
        <section className="py-24 px-6" style={{ background: 'linear-gradient(180deg, white 0%, #f0f7ff 100%)' }}>
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: TURQUOISE }}>— Yapay Zeka Koçları</span>
              <h2 className="text-4xl md:text-5xl font-black mt-3 mb-4" style={{ fontFamily: "'Outfit', sans-serif", color: NAVY }}>
                12 Uzman, 12 Farklı Dünya
              </h2>
              <p className="text-gray-500 text-lg max-w-2xl mx-auto">
                12 koç, 12 farklı sektör uzmanlığı, aksan ve eğitim stili. Sektörünüze ve hedefinize en uygun koçu seçin; gerçek bir iş ortamına hazırlanın.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {COACHES.map((coach) => (
                <div key={coach.id}
                  className="bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-xl border border-gray-100 transition-all duration-300 hover:-translate-y-1 flex flex-col">
                  <div className="flex items-center gap-4 p-5 pb-4" style={{ background: coach.color + '10' }}>
                    <div className="relative flex-shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={"/assets/images/coaches/" + coach.image} alt={coach.name} width={80} height={80}
                        className="w-20 h-20 rounded-2xl object-cover shadow-md" />
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white shadow-sm flex items-center justify-center text-sm leading-none">
                        {coach.flag}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-black text-lg leading-tight mb-0.5 truncate" style={{ fontFamily: "'Outfit', sans-serif", color: NAVY }}>{coach.name}</h4>
                      <p className="text-xs font-bold mb-1 truncate" style={{ color: coach.color }}>{coach.specialty}</p>
                      <p className="text-xs text-gray-400 truncate">🔊 {coach.accent}</p>
                    </div>
                  </div>
                  <div className="px-5 pt-3 pb-3 flex-1">
                    <p className="text-sm text-gray-600 leading-relaxed">{coach.bio}</p>
                  </div>
                  <div className="px-5 pb-5">
                    <div className="rounded-xl px-3 py-2.5" style={{ background: coach.color + '0d', borderLeft: '3px solid ' + coach.color }}>
                      <p className="text-xs font-bold mb-0.5 uppercase tracking-wide" style={{ color: coach.color }}>Kimler için ideal?</p>
                      <p className="text-xs text-gray-500 leading-relaxed">{coach.idealFor}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── KAPSAMLI AÇIKLAMA (GEO OPT.) ── */}
        <section className="py-20 px-6 bg-white">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-14">
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: TURQUOISE }}>— Platform Hakkında</span>
              <h2 className="text-3xl md:text-4xl font-black mt-3" style={{ fontFamily: "'Outfit', sans-serif", color: NAVY }}>
                Sphere AI Studio Nedir?
              </h2>
            </div>
            <div className="prose prose-gray max-w-none text-gray-600 leading-relaxed space-y-5 text-[15px]">
              <p>
                <strong style={{ color: NAVY }}>Sphere AI Studio</strong>, Sphere English İngilizce eğitim platformunun yapay zeka bileşenidir. GPT-4o büyük dil modeli ve OpenAI Whisper ses tanıma teknolojisini temel alır; kullanıcılara 7/24 erişilebilir, kişiselleştirilmiş ve ölçülebilir bir İngilizce öğrenme deneyimi sunar.
              </p>
              <p>
                Platform, kurumsal ve bireysel kullanıcıların dil yetkinliklerini CEFR (Common European Framework of Reference for Languages) standartlarına göre A1'den C2'ye kadar geliştirebileceği şekilde tasarlanmıştır. Oxford University Press müfredatıyla uyumlu içerik tabanı, öğrenme sürecinin uluslararası standartlarda ilerlediğini güvence altına alır.
              </p>
              <p>
                <strong style={{ color: NAVY }}>Telaffuz Koçu</strong> özelliği, kullanıcının sesini gerçek zamanlı olarak analiz eder; fonem düzeyinde hataları tespit eder ve hem metin hem sesli geri bildirim sunar. 12 farklı yapay zeka koç karakteri, İngiliz RP'den Amerikan West Coast'a, Wall Street aksanından Sağlık Turizmi İngilizcesine kadar geniş bir yelpazede aksan ve sektör çeşitliliği sağlar.
              </p>
              <p>
                <strong style={{ color: NAVY }}>Yazma Koçu</strong>, iş dünyasında en sık kullanılan 7 metin türünü (e-posta, rapor, sunum, özgeçmiş, akademik metin, müzakere mektubu, teknik döküman) analiz eder. Kullanıcının metni gramer doğruluğu, kelime zenginliği, tutarlılık ve profesyonel ton açısından CEFR ölçütleriyle puanlanır; yapay zeka tarafından yeniden yazılmış geliştirilmiş versiyonu ile karşılaştırmalı sunulur.
              </p>
              <p>
                <strong style={{ color: NAVY }}>Dilbilgisi Koçu</strong>, tense yapıları, conditional cümleler, modal fiiller, article ve preposition kullanımı, passive voice, reported speech ve relative clauses gibi temel konuları A1'den C1'e kadar basamaklı biçimde öğretir. Yanlış yanıt verildiğinde yapay zeka hatanın nedenini açıklar, doğru kuralı özetler ve pekiştirme soruları sunar.
              </p>
              <p>
                <strong style={{ color: NAVY }}>Kelime Oyunu</strong>, 4000'den fazla iş İngilizcesi ve sektöre özgü terimi adaptif bir algoritmayla öğretir. Kelimeler bağlamsal cümleler içinde sunulduğu için yalnızca anlam değil, doğru kullanım kalıpları da kalıcı olarak yerleşir. Streak sistemi, liderlik tablosu ve rozetler kullanıcı motivasyonunu uzun vadede destekler.
              </p>
              <p>
                <strong style={{ color: NAVY }}>İş Senaryoları</strong>, 14 farklı sektörde (finans, teknoloji, sağlık turizmi, lojistik, hukuk, danışmanlık ve daha fazlası) gerçek iş hayatı senaryolarını simüle eder. 12 uzman yapay zeka koçundan birini seçerek yatırımcı sunumundan sözleşme müzakeresine, kriz yönetiminden mülakat pratiğine kadar onlarca farklı senaryoda gerçek zamanlı konuşma yapabilirsiniz. Her konuşma sonrası anlık gramer analizi, kelime önerileri ve oturum raporu otomatik oluşturulur.
              </p>
              <p>
                Kurumsal planlarda yöneticiler, ekip üyelerinin AI Studio kullanımını, ilerleme raporlarını, CEFR seviye değişimlerini ve hata dağılımlarını merkezi panelden takip edebilir. Bu sayede insan kaynakları ve L&D ekipleri, eğitim yatırımının somut çıktısını ölçebilir.
              </p>
            </div>
          </div>
        </section>

        {/* ── SSS ── */}
        <section className="py-24 px-6 bg-gray-50">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-14">
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: TURQUOISE }}>— Sıkça Sorulan Sorular</span>
              <h2 className="text-3xl md:text-4xl font-black mt-3" style={{ fontFamily: "'Outfit', sans-serif", color: NAVY }}>
                AI Studio Hakkında Merak Edilenler
              </h2>
            </div>
            <div className="space-y-3">
              {FAQS.map((faq) => (
                <FAQItem key={faq.q} q={faq.q} a={faq.a} />
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="py-24 px-6" style={{ background: 'linear-gradient(135deg, #0f1f3d 0%, #1e3a6e 60%, #1a4a8a 100%)' }}>
          <div className="max-w-3xl mx-auto text-center relative">
            <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)', backgroundSize: '48px 48px' }} />
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 rounded-full px-4 py-2 mb-6 text-sm font-semibold"
                style={{ background: '#0ea5e922', color: '#0ea5e9', border: '1px solid #0ea5e944' }}>
                ★ Ücretsiz Dene
              </div>
              <h2 className="text-4xl md:text-5xl font-black text-white mb-4"
                style={{ fontFamily: "'Outfit', sans-serif", letterSpacing: '-0.02em' }}>
                AI Koçunla Tanış,<br />Farklı Konuş.
              </h2>
              <p className="text-white/60 text-lg mb-10">Kayıt ol, koçunu seç ve ilk dersini hemen başlat. Kredi kartı gerekmez.</p>
              <a href="https://app.sphereenglish.com/register"
                className="inline-flex items-center gap-2 rounded-2xl px-8 py-4 font-bold text-white text-base hover:opacity-90 transition-opacity"
                style={{ background: 'linear-gradient(135deg, #0ea5e9, #0284c7)', boxShadow: '0 8px 32px #0ea5e944' }}>
                ✦ Hemen Başla — Ücretsiz
              </a>
            </div>
          </div>
        </section>

      </main>
      <Footer />
    </div>
  );
}

