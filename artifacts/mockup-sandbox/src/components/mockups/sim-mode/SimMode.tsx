import { useState, useRef, useEffect } from 'react';

const NAVY = '#082567';
const NAVY_LIGHT = '#0f3a8f';
const NAVY_DARK = '#051a45';
const SILVER = '#94a3b8';
const SILVER_LIGHT = '#f1f5f9';
const SILVER_MID = '#e2e8f0';

const SECTOR_ICONS: Record<string, React.ReactNode> = {
  finans: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18"/><path d="M7 16l4-4 4 4 4-6"/>
    </svg>
  ),
  teknoloji: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>
    </svg>
  ),
  saglik: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z"/><path d="M12 8v8M8 12h8"/>
    </svg>
  ),
  uretim: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 20h20M4 20V10l4-4 4 4 4-4 4 4v10"/><path d="M9 20v-5h6v5"/>
    </svg>
  ),
  perakende: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>
    </svg>
  ),
  lojistik: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 3h15v13H1zM16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
    </svg>
  ),
  insaat: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18M5 21V7l7-4 7 4v14"/><path d="M9 21v-6h6v6"/>
    </svg>
  ),
  egitim: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 10v6M2 10l10-5 10 5-10 5-10-5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
    </svg>
  ),
  turizm: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21 4 21 4s-2 0-3.5 1.5L14 9 5.8 7.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 3.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>
    </svg>
  ),
  danismanlik: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/><path d="M7 8h10M7 12h6"/>
    </svg>
  ),
  hukuk: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v20M3 6l9-4 9 4M5 9l-2 7h4L5 9zM19 9l-2 7h4l-2-7z"/><path d="M3 22h18"/>
    </svg>
  ),
  medya: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 7 16 12 23 17V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/>
    </svg>
  ),
  enerji: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>
    </svg>
  ),
  diger: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  ),
};

const SECTORS = [
  { id: 'finans', label: 'Finans', desc: 'Bankacılık, yatırım, sigortacılık' },
  { id: 'teknoloji', label: 'Teknoloji', desc: 'Yazılım, AI, dijital ürünler' },
  { id: 'saglik', label: 'Sağlık', desc: 'Sağlık hizmetleri, ilaç, medikal cihaz' },
  { id: 'uretim', label: 'Üretim', desc: 'İmalat, fabrika, endüstri' },
  { id: 'perakende', label: 'Perakende', desc: 'E-ticaret, mağazacılık, satış' },
  { id: 'lojistik', label: 'Lojistik', desc: 'Tedarik zinciri, kargo, depo' },
  { id: 'insaat', label: 'İnşaat', desc: 'Gayrimenkul, altyapı, mühendislik' },
  { id: 'egitim', label: 'Eğitim', desc: 'Akademi, kurumsal eğitim, EdTech' },
  { id: 'turizm', label: 'Turizm', desc: 'Otelcilik, seyahat, sağlık turizmi' },
  { id: 'danismanlik', label: 'Danışmanlık', desc: 'Strateji, yönetim, süreç iyileştirme' },
  { id: 'hukuk', label: 'Hukuk', desc: 'Hukuk büroları, uyum, sözleşme' },
  { id: 'medya', label: 'Medya', desc: 'Yayıncılık, reklam, içerik üretimi' },
  { id: 'enerji', label: 'Enerji', desc: 'Yenilenebilir enerji, petrol & gaz' },
  { id: 'diger', label: 'Diğer', desc: 'Diğer sektörler' },
];

const COACHES = [
  { id: 'sterling', name: 'Mr. Sterling', flag: '🇬🇧', specialty: 'CEO & Stratejik Yönetim', accent: 'Üst Segment İngiliz (RP)', color: '#1E3A5F', style: 'Otoriter, lakonik, vizyon odaklı', image: '/images/coach-sterling.png', initials: 'MS', voice: 'onyx', systemPrompt: `You are Mr. Sterling, a 57-year-old British executive from London. Refined RP accent, impeccably dressed. 30 years in boardrooms of global firms. Authoritative, precise, dry wit. You speak very concisely — every word counts.` },
  { id: 'jake', name: 'Jake', flag: '🇺🇸', specialty: 'Pazarlama & Dijital Medya', accent: 'West Coast Amerikan', color: '#EA580C', style: 'Enerjik, yaratıcı, trendy', image: '/images/coach-jake.png', initials: 'J', voice: 'echo', systemPrompt: `You are Jake, a 30-year-old San Francisco marketing guy. Laid-back, upbeat, West Coast accent. You work in digital marketing at a startup. Energetic, casual, always pitching ideas.` },
  { id: 'david', name: 'David', flag: '🇺🇸', specialty: 'Finans & Yatırım', accent: 'New York (Wall Street)', color: '#0369A1', style: 'Analitik, direkt, rakam odaklı', image: '/images/coach-david.png', initials: 'D', voice: 'echo', systemPrompt: `You are David, a 43-year-old New Yorker from Wall Street. Intense, sharp, data-driven. You think in numbers and risk. Direct, no-nonsense New York style.` },
  { id: 'emma', name: 'Emma', flag: '🇬🇧', specialty: 'İnsan Kaynakları', accent: 'Standart İngiliz (London)', color: '#BE185D', style: 'Empatik, yapılandırılmış, destekleyici', image: '/images/coach-emma-hr.png', initials: 'E', voice: 'shimmer', systemPrompt: `You are Emma, a 37-year-old London HR professional. Warm, empathetic, structured. You believe in clear communication and constructive feedback. Standard British accent.` },
  { id: 'raj', name: 'Raj', flag: '🇮🇳', specialty: 'BT & Yazılım Geliştirme', accent: 'Hint-İngiliz (Global Tech)', color: '#7C3AED', style: 'Sistematik, teknik, iş birlikçi', image: '/images/coach-raj.png', initials: 'R', voice: 'echo', systemPrompt: `You are Raj, a 32-year-old software engineer from Bangalore, now working in London. Warm, slightly nerdy, collaborative. Indian-English accent. You love explaining technical things clearly.` },
  { id: 'hans', name: 'Hans', flag: '🇩🇪', specialty: 'Lojistik & Operasyon', accent: 'Alman-İngiliz (Euro-English)', color: '#374151', style: 'Metodolojik, hassas, süreç odaklı', image: '/images/coach-hans.png', initials: 'H', voice: 'onyx', systemPrompt: `You are Hans, a 47-year-old German from Hamburg in logistics. Precise, methodical, reliable. German-English accent. You think in processes and timelines. Very structured.` },
  { id: 'elena', name: 'Elena', flag: '🇪🇺', specialty: 'Uluslararası Hukuk', accent: 'Diplomatik (Doğu Avrupa)', color: '#065F46', style: 'Kesin, diplomatik, mükemmeliyetçi', image: '/images/coach-elena.png', initials: 'EL', voice: 'nova', systemPrompt: `You are Elena, a 44-year-old international lawyer from Prague, based in Brussels. Composed, precise, diplomatically careful. Eastern European-English accent. Every word is deliberate.` },
  { id: 'alistair', name: 'Alistair', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', specialty: 'Satış & Müzakere', accent: 'İskoç (Edinburg)', color: '#B91C1C', style: 'İkna edici, stratejik, ısrarcı', image: '/images/coach-alistair.png', initials: 'A', voice: 'echo', systemPrompt: `You are Alistair, a 40-year-old Scotsman from Edinburgh in sales. Charismatic, persuasive, strategic. Scottish accent. You can find common ground with anyone and close any deal.` },
  { id: 'chloe', name: 'Chloe', flag: '🇦🇺', specialty: 'Müşteri İlişkileri', accent: 'Avusturalyalı (Friendly)', color: '#D97706', style: 'Sıcak, samimi, çözüm odaklı', image: '/images/coach-chloe.png', initials: 'C', voice: 'shimmer', systemPrompt: `You are Chloe, a 28-year-old Australian customer success manager. Warm, friendly, solution-focused. Australian accent. You genuinely care about making people happy.` },
  { id: 'james', name: 'James', flag: '🇺🇸', specialty: 'Üretim & Fabrika Yönetimi', accent: 'Amerikan (Midwest)', color: '#78350F', style: 'Pratik, güvenilir, direkt', image: '/images/coach-james-mfg.png', initials: 'JA', voice: 'onyx', systemPrompt: `You are James, a 45-year-old factory operations manager from Ohio. Practical, direct, no-frills. Midwest American accent. You value efficiency and clear, actionable communication.` },
  { id: 'claire', name: 'Dr. Claire', flag: '🇬🇧', specialty: 'Gramer & İleri Telaffuz', accent: 'Akademik İngiliz (Oxford)', color: '#0F766E', style: 'Titiz, sabırlı, akademik', image: '/images/coach-claire-grammar.png', initials: 'DC', voice: 'nova', systemPrompt: `You are Dr. Claire, a 50-year-old Oxford linguistics professor. Precise, patient, academic. You notice language nuances others miss and communicate with elegant clarity.` },
  { id: 'olivia', name: 'Dr. Olivia', flag: '🇺🇸', specialty: 'Sağlık Turizmi İngilizcesi', accent: 'Amerikan (Miami / Sağlık Turizmi)', color: '#0891b2', style: 'Profesyonel, kültürel farkındalıklı, sıcak', image: '/images/coach-olivia-health.png', initials: 'DO', voice: 'nova', systemPrompt: `You are Dr. Olivia, a 38-year-old health tourism coordinator based in Miami. Professional, culturally aware, warm. You bridge medical and hospitality worlds for international patients.` },
];

const SECTOR_COACHES: Record<string, string[]> = {
  enerji:      ['sterling', 'david', 'jake', 'james', 'elena'],
  finans:      ['david', 'elena', 'sterling'],
  teknoloji:   ['raj', 'jake', 'emma'],
  saglik:      ['chloe', 'elena', 'olivia'],
  uretim:      ['james', 'hans'],
  perakende:   ['jake', 'emma', 'chloe'],
  lojistik:    ['hans', 'james'],
  insaat:      ['sterling', 'james', 'david'],
  egitim:      ['claire', 'emma'],
  turizm:      ['chloe', 'alistair', 'olivia'],
  danismanlik: ['sterling', 'david'],
  hukuk:       ['elena', 'sterling'],
  medya:       ['jake', 'elena'],
  diger:       [],
};

const SCENARIO_MAP: Record<string, Record<string, string[]>> = {
  enerji: {
    sterling: [
      'Yatırım Sunumu: Ege\'deki yeni rüzgar santrali projesi için yabancı yatırımcılara vizyon sunumu',
      'Stratejik Ortaklık: Global enerji deviyle Joint Venture için CEO düzeyinde ilk strateji toplantısı',
      'Hükümet İlişkileri: Enerji lisansları ve regülasyonlar için uluslararası konsorsiyum adına resmi görüşme',
      'Kriz Yönetimi: Enerji krizinde şirketin arz güvenliği ve maliyet politikasını hissedarlarına açıklama',
      'Sürdürülebilirlik: "Sıfır Karbon" hedefleri ve Avrupa Yeşil Mutabakatı uyum planını paydaşlara duyurma',
    ],
    david: [
      'Proje Finansmanı: Güneş enerjisi yatırımı için EBRD ile kredi şartlarını müzakere etme',
      'Risk Yönetimi: Enerji ithalat maliyetleri için döviz hedge modeli sunumu',
      'Teşvik Analizi: YEKDEM gelir projeksiyonunu yabancı analistlere kalem kalem anlatma',
      'Maliyet Denetimi: Doğalgaz santralinin OPEX artışını yabancı ortaklara verilerle açıklama',
      'M&A — Due Diligence: Yerel hidroelektrik santralinin devralınması öncesi finansal rapor tartışması',
    ],
    jake: [
      'Lansman Stratejisi: Akıllı ev enerji takip uygulamasının global uygulama mağazalarında tanıtım dili',
      'İçerik Pazarlaması: "Yeşil Enerji" marka imajı için LinkedIn kampanya serisi İngilizce slogan belirleme',
      'Startup Pitch: Energy-tech girişiminin Silicon Valley yatırımcılarına 3 dakikalık hızlı sunumu',
      'Influencer İş Birliği: Sürdürülebilirlik odaklı global içerik üreticisiyle sponsorluk şartlarını görüşme',
      'Topluluk Yönetimi: Çevresel projelere gelen sosyal medya eleştirilerini pozitif dille yönetme',
    ],
    james: [
      'Saha Denetimi: Ohio\'lu teknik denetçiye Türk mühendislik standartlarını ve iş güvenliğini anlatma',
      'Teknik Arıza: Türbin kanatlarındaki üretim hatasını yurt dışı tedarikçiye direkt ve teknik dille raporlama',
      'Montaj Planı: Yeni trafo merkezi kurulumu için yabancı montaj ekibine saha ve ekipman lojistiği brifingi',
      'İş Güvenliği (HSE): Near-miss olayı sonrası alınan güvenlik önlemlerini ekibe İngilizce aktarma',
      'Verimlilik Toplantısı: Üretim hattındaki enerji kaybını azaltmak için teknik iyileştirmeleri sunma',
    ],
    elena: [
      'Sözleşme Revizyonu: Uluslararası enerji tedarik anlaşmasındaki Force Majeure maddesini güncelleme',
      'Regülasyon Uyumu: Yabancı ortağa Türkiye\'deki EPDK mevzuatını ve yasal gereklilikleri açıklama',
      'Uyuşmazlık Çözümü: Rüzgar gülü projesindeki gecikme nedeniyle yabancı alt yükleniciye ihtarname tartışması',
      'Gizlilik Anlaşması (NDA): Enerji depolama teknolojisi paylaşımı öncesi NDA sınırlarını belirleme',
      'Tahkim Hazırlığı: Sınır ötesi enerji yatırım davasında Londra tahkim heyetine savunma stratejisi',
    ],
    default: [
      'Yatırım Sunumu: Yenilenebilir enerji projesini yabancı yatırımcılara sunma',
      'Teknik Brifing: Güneş paneli kurulum sürecini yabancı mühendislere anlatma',
      'Regülasyon Görüşmesi: Enerji lisansı için resmi kurum toplantısı',
      'Sürdürülebilirlik Raporu: ESG hedeflerini uluslararası paydaşlara sunma',
      'Tedarikçi Görüşmesi: Enerji ekipmanı alımı için yabancı firma ile müzakere',
    ],
  },
  finans: {
    david: [
      'Enflasyon Muhasebesi: TAS 29\'un bilançolara etkisini yabancı yatırımcılara kalem kalem açıklama',
      'Yatırım Tavsiyesi: New York\'lu fon yöneticisine BIST bankacılık endeksinin çarpanlarını sunma',
      'Döviz Riski (Hedging): Açık pozisyon için Swap/Forward maliyetlerini finans komitesine raporlama',
      'Kredi Müzakeresi: Holdingin borç yapılandırması için uluslararası bankalar konsorsiyumuyla görüşme',
      'Fintech Pitch: Türk ödeme kuruluşunun Seri A turunda global VC\'ye finansal projeksiyonlarını sunma',
    ],
    elena: [
      'Regülasyon Uyumu: BDDK mevzuatındaki değişiklikleri yabancı ortağın hukuk ekibine aktarma',
      'Sözleşme Revizyonu: Aracı kurumun yurt dışı saklamacı banka ile sub-custody sözleşmesini inceleme',
      'AML/KYC Uyumu: Kara para aklamayı önleme protokollerinin FATF standartlarına uyumunu kanıtlama',
      'Tahkim Süreci: LCIA kuralları çerçevesinde yatırım uyuşmazlığı savunma stratejisi geliştirme',
      'Veri Gizliliği: KVKK ve GDPR farkları gözetilerek sınır ötesi veri transferi maddelerini yazma',
    ],
    sterling: [
      'YK Brifingi: Bankanın neo-bank lisansı alma stratejisini ve pazar payı hedeflerini yönetim kuruluna özetleme',
      'M&A Görüşmesi: Bölgesel sigorta şirketi satın alımı öncesi karşı taraf CEO\'suyla "Stratejik Niyet" toplantısı',
      'Kriz İletişimi: Bankanın likidite ve sermaye gücünü Moody\'s/Fitch gibi derecelendirme kuruluşlarına açıklama',
      'Liderlik Mesajı: Yıllık strateji toplantısında üst düzey yöneticilere "Global Standartlarda Bankacılık" vizyonu',
      'Hissedar İlişkileri: Genel kurulda yabancı kurumsal hissedarların temettü soruları ile başa çıkma',
    ],
    default: [
      'Yatırım Fonu Sunumu: Portföy performansını yabancı müşteriyle değerlendirme',
      'Kredi Görüşmesi: Kurumsal kredi şartlarını uluslararası banka ile müzakere etme',
      'Risk Raporu: Piyasa risklerini yönetim kuruluna İngilizce sunma',
      'Fintech Demo: Ödeme çözümünü yabancı iş ortaklarına tanıtma',
      'Denetim Toplantısı: Finansal uyum sürecini uluslararası denetçilerle gözden geçirme',
    ],
  },
  teknoloji: {
    raj: [
      'Mimari Karar: Monolitikten mikroservise geçiş planını ve deployment hızına etkisini teknik ekibe anlatma',
      'Sprint Retrospektifi: API entegrasyon hatalarının kök neden analizini yabancı geliştiricilerle tartışma',
      'Bulut Maliyetleri: AWS/Azure maliyet artışlarını azaltmak için Serverless geçiş planını BT direktörüne sunma',
      'Güvenlik Brifingi: Penetrasyon testi sonrası ortaya çıkan zafiyetler için acil eylem planını paylaşma',
      'Teknik Mülakat: Senior Lead Developer adayının algoritma ve Clean Code yeteneğini test etme',
    ],
    jake: [
      'Global Lansman: İstanbul merkezli mobil oyunun ABD ve Avrupa\'da Pre-launch reklam stratejisini sunma',
      'Yatırımcı Pitch\'i: SaaS platformunun MRR ve CAC verilerini Silicon Valley tarzı etkileyici dille anlatma',
      'Topluluk Yönetimi: Discord/Twitter\'daki teknik kesinti sonrası global topluluğa "cool" ama güven veren açıklama',
      'Influencer Anlaşması: Global tech-influencer ile iş birliğinin kapsamını ve Creative Direction\'ı müzakere etme',
      'Veri Analitiği: Kullanıcı terk oranını (Churn rate) Mixpanel verileriyle pazarlama ekibine raporlama',
    ],
    emma: [
      'Global İşe Alım: Berlin/Londra\'daki yazılımcıyı Remote çalışmayla Türk ekibine katılmaya ikna etme mülakatı',
      'Performans Feedback: Düşük performanslı Scrum Master ile yapıcı ve gelişim odaklı geri bildirim görüşmesi',
      'Şirket Kültürü: Yurt dışından işe alınan çalışanlar için Türk ofis kültürüne uyum Onboarding programını sunma',
      'Yetenek Tutma (Retention): Rakip teklifler karşısında şirketin yan haklarını ve vizyonunu çalışanlara anlatma',
      'Etik Kurallar: Çeşitlilik ve Kapsayıcılık (D&I) politikalarının Türk ofisindeki uygulanabilirliği workshopu',
    ],
    default: [
      'Teknik Sunum: Yeni yazılım mimarisini yabancı paydaşlara anlatma',
      'Ürün Demo: SaaS platformunu uluslararası müşteriye tanıtma',
      'Agile Toplantısı: Sprint planlamasını yabancı ekip üyeleriyle yürütme',
      'Siber Güvenlik: Güvenlik önlemlerini yönetim kuruluna raporlama',
      'Teknik Destek: Yabancı müşterinin teknik sorununu İngilizce çözme',
    ],
  },
  saglik: {
    chloe: [
      'Hasta Karşılama: İngiltere\'den gelen hastanın transfer gecikmesi şikayetini samimiyetle ve çözüm odaklı giderme',
      'Süreç Bilgilendirme: Ameliyat öncesi gergin hastaya operasyon adımlarını sakinleştirici İngilizce ile anlatma',
      'Şikayet Yönetimi: Konaklama hizmetinden memnun kalmayan VIP hastanın taleplerini karşılayarak gönlünü alma',
      'Memnuniyet Takibi: Tedavisi biten hastayı arayarak iyileşmesini sormak ve global platformlarda yorum istemek',
      'Fiyatlandırma Görüşmesi: Pakete dahil olmayan ek tedavinin neden gerektiğini ve maliyetini profesyonelce açıklama',
    ],
    elena: [
      'Sigorta Müzakeresi: Bupa/Allianz gibi uluslararası sigorta firmasıyla anlaşmalı kurum statüsü ve ödeme şartları',
      'Onam Formları: Yabancı hastaların Aydınlatılmış Onam Formu\'nun uluslararası hukuk standartlarına uygunluğunu denetleme',
      'Veri Gizliliği: Hasta verilerinin GDPR ile uyumlu işlenmesi ve aktarılması sürecini yabancı denetçiye açıklama',
      'Malpractice Savunması: Tıbbi uygulama hatası iddiasına karşı diplomatik dille savunma stratejisi kurgulama',
      'Joint Venture: Yabancı sağlık kuruluşuyla ortak girişim protokolünün kritik maddelerini müzakere etme',
    ],
    olivia: [
      'Tedavi Paketi Sunumu: Uluslararası hastaya sağlık turizmi paketini ve sürecin tüm adımlarını açıklama',
      'Sigorta Koordinasyonu: Uluslararası sigorta kapsamını hasta adına hastane ile koordine etme',
      'JCI Akreditasyon: Yabancı denetçiye hastanenin uluslararası akreditasyon standartlarını anlatma',
      'Hasta Ailesi Brifingi: Ameliyat öncesi aile üyelerine tedavi planını ve beklenen sonuçları açıklama',
      'Post-Tedavi Takip: Ülkesine dönen hastanın iyileşme sürecini uzaktan koordine etme görüşmesi',
    ],
    default: [
      'Klinik Görüşme: Yabancı hastanın tıbbi geçmişini profesyonel İngilizce ile kayıt altına alma',
      'Tedavi Planlaması: Uluslararası hastaya tedavi seçeneklerini anlaşılır şekilde sunma',
      'Medikal Terminoloji: Tanı ve tedavi bilgilerini hasta dostu İngilizce ile aktarma',
      'Sigorta Süreci: Yabancı sigorta şirketiyle teminat şartlarını netleştirme',
      'Taburcu Brifingi: Hastanın eve dönüş sonrası bakım talimatlarını İngilizce anlatma',
    ],
  },
  uretim: {
    james: [
      'Teknik Denetim: Amerikalı kalite kontrolcüye üretim hattını, standartları ve kapasite raporlarını direkt anlatma',
      'Tedarikçi Krizi: Yurt dışı tedarikçiden gelen kusurlu ürünler için sert ama profesyonel şikayet ve iade görüşmesi',
      'İş Güvenliği (HSE): Yeni iş güvenliği protokollerini yabancı teknik ekibe saha jargonuyla brifing olarak verme',
      'Verimlilik Toplantısı: Üretim hattındaki darboğazın teknik nedenlerini fabrika müdürüne pratik dille raporlama',
      'Ekip Koordinasyonu: Yeni makine kurulumu için gelen yabancı ekibe altyapı ve çalışma saatleri talimatları verme',
    ],
    hans: [
      'Sevkiyat Planı: Hamburg limanı üzerinden büyük ihracat sevkiyatının detaylarını "Alman titizliğiyle" alıcıya sunma',
      'Gümrük Problemi: Türkiye sınırındaki gümrük takılmasının nedenlerini metodik düzende operasyon merkezine raporlama',
      'Stok Yönetimi: Hammadde stoklarındaki sapmaları ve Inventory raporlarını yönetim kuruluna açıklama',
      'Tedarik Zinciri Optimizasyonu: İntermodal lojistik modelinin maliyet avantajlarını yabancı ortağa sunma',
      'Kriz İletişimi: Sevkiyat gecikmesini Alman müşteriye dürüst ve çözüm öneren profesyonel şekilde açıklama',
    ],
    default: [
      'Üretim Kapasitesi: Fabrika kapasitesini ve teknolojisini yabancı alıcıya tanıtma',
      'Kalite Denetimi: ISO kalite standartlarını uluslararası denetçiye anlatma',
      'Teknik Şartname: Ürün teknik özelliklerini yabancı mühendislerle tartışma',
      'Tedarik Görüşmesi: Hammadde tedarik şartlarını yabancı tedarikçiyle müzakere etme',
      'İhracat Planlaması: Yeni ihracat pazarı için strateji toplantısı yürütme',
    ],
  },
  perakende: {
    jake: [
      'Pazar Konumlandırma: Türk moda markasının Londra lansmanı için Gen-Z odaklı İngilizce slogan ve kampanya dili',
      'Influencer Briefing: Global influencer\'a markanın hikayesini ve videolarda istenen modern Amerikan jargonunu anlatma',
      'Amazon Stratejisi: Müşteri yorumlarını analiz ederek ürün başlıklarını ve SEO açıklamalarını iyileştirme tartışması',
      'Kriz Yönetimi: Global sosyal medya boykotu veya yanlış anlaşılma durumunda samimi ve dinamik açıklama kurgulama',
      'Trend Analizi: New York/Milano moda trendlerinin Türk üretim bandına nasıl entegre edileceği pazarlama sunumu',
    ],
    emma: [
      'Mağaza Müdürü Mülakatı: Dubai veya Berlin\'deki yeni mağaza için yerel adayla final aşaması İngilizce mülakatı',
      'Mystery Shopper Feedback: Yurt dışı mağazalardaki düşük puanları çalışanlara yapıcı dille aktarma ve eğitim planlama',
      'Çalışan Bağlılığı: Global perakende ekibindeki kopukluğu gidermek için Online Team Building etkinliği açılışı',
      'Performans Değerlendirme: Satış hedeflerinin altında kalan bölge müdürüyle gelişim alanlarını konuşma',
      'Şirket Kültürü El Kitabı: Müşteri Memnuniyeti ve Davranış İlkeleri rehberini İngilizce ekibe sunma',
    ],
    chloe: [
      'Müşteri Şikayeti: Online siparişinde sorun yaşayan yabancı müşteriyi samimi ve çözüm odaklı şekilde yönetme',
      'VIP Müşteri Hizmeti: Premium müşteriye özel alışveriş deneyimi ve sadakat programı avantajlarını anlatma',
      'İade Süreci: Ürün iadesi konusundaki politikayı yabancı müşteriye arkadaşça ve net biçimde açıklama',
      'Mağaza Tanıtımı: Yabancı müşteriye markanın değerlerini ve ürün hikayesini cezbedici dille anlatma',
      'Online İtibar: Olumsuz yorum sonrası müşteriyi geri kazanmak için profesyonel e-posta yazma',
    ],
    default: [
      'Ürün Lansman: Yeni koleksiyonu uluslararası alıcılara tanıtma',
      'Satış Görüşmesi: Toplu sipariş için yabancı distribütörle müzakere etme',
      'Müşteri Hizmetleri: Yabancı müşterinin sorununu İngilizce çözme',
      'Pazar Araştırması: Hedef pazarı yabancı danışmanla değerlendirme',
      'Mağaza Operasyonu: Yabancı ekiple mağaza süreçlerini planlama',
    ],
  },
  lojistik: {
    hans: [
      'Sevkiyat Planı: Hamburg limanı üzerinden büyük ihracat sevkiyatını "Alman titizliğiyle" yabancı alıcıya sunma',
      'Gümrük Problemi: Türkiye sınırında yaşanan gümrük takılmasını metodik şekilde operasyon merkezine raporlama',
      'Stok Yönetimi: Hammadde stok sapmalarını ve Inventory raporlarını yönetim kuruluna net İngilizce ile açıklama',
      'Tedarik Zinciri Optimizasyonu: İntermodal lojistik modelinin avantajlarını yabancı ortağa sunma',
      'Kriz İletişimi: Sevkiyat gecikmesini Alman müşteriye dürüst ve çözüm öneren şekilde açıklama',
    ],
    james: [
      'Depo Denetimi: Amerikalı denetçiye depo düzeni, stok takip sistemi ve güvenlik protokollerini anlatma',
      'Ekipman Kurulumu: Yeni forklift veya konveyör sistemi kurulumu için yabancı ekibe talimat verme',
      'Kapasite Raporlaması: Depo ve taşıma kapasitesini müşteriye direkt ve net dille raporlama',
      'İş Güvenliği: Depo ve saha güvenliği kurallarını yabancı çalışanlara saha jargonuyla aktarma',
      'Tedarikçi Krizi: Geciken sevkiyat için taşıma firmasıyla sert ama profesyonel çözüm görüşmesi',
    ],
    default: [
      'Taşımacılık Teklifi: Kargo fiyatlarını ve şartlarını yabancı müşteriyle müzakere etme',
      'Sevkiyat Koordinasyonu: Uluslararası sevkiyat sürecini İngilizce koordine etme',
      'Gümrük Brifingi: Gümrük süreçlerini yabancı ihracatçıya açıklama',
      '3PL Anlaşması: Üçüncü taraf lojistik sözleşmesi şartlarını görüşme',
      'Rota Planlaması: İdeal taşıma güzergahını yabancı operasyon ekibiyle belirleme',
    ],
  },
  insaat: {
    sterling: [
      'Yatırımcı Sunumu: Körfez yatırımcılarına İstanbul\'daki karma kullanım projesinin konumu ve ROI\'sini üst segment dille sunma',
      'İş Geliştirme: Global otel zinciriyle projenin İşletme Sözleşmesi şartlarını CEO düzeyinde müzakere etme',
      'Hissedar İlişkileri: Yurt dışı projelerdeki hakediş gecikmelerinin nakit akışına etkisini hissedar kuruluna açıklama',
      'Sürdürülebilirlik: "LEED Gold" sertifikası sürecini ve yeşil bina standartlarının marka değerini anlatma',
      'Kriz Yönetimi: Proje sahasındaki büyük aksaklığın teslim tarihine etkisini "British" soğukkanlılığıyla yönetme',
    ],
    james: [
      'Şantiye Denetimi: Ohio\'lu teknik heyete yapı denetim standartlarını, beton kalitesini ve sismik sistemleri anlatma',
      'İSG Brifingi: Yüksekte çalışma ve HSE protokollerini yabancı alt yüklenicilere net ve direkt talimatlarla anlatma',
      'Tedarikçi Görüşmesi: Cephe kaplama malzemelerindeki şartname uyumsuzluğu için Amerikalı tedarikçiyle sorun giderme',
      'İlerleme Raporu: Kaba inşaat bitişi ve ince işler koordinasyonunu yabancı proje müdürüne raporlama',
      'Teknik Sorun Çözme: Mekanik tesisat planındaki çakışmayı yabancı tasarım ekibiyle paftalar üzerinde çözme',
    ],
    david: [
      'Proje Finansmanı: Altyapı projesi için uluslararası sendikasyon kredisinin faiz ve geri ödeme şartlarını tartışma',
      'Maliyet Analizi: Döviz kuru ve inşaat malzemeleri fiyat artışının proje bütçesine etkisini yabancı ortaklara raporlama',
      'Gayrimenkul Değerleme: Yabancı fonun satın almayı düşündüğü ticari alanların ekspertiz ve kira çarpanlarını açıklama',
      'Hakediş Yönetimi: Taşeron firmalarının hakediş ödemeleri ve nakit akışı planlaması stratejik toplantısı',
      'Teşvik Yönetimi: Yatırım teşvik belgeleri ve vergi muafiyetlerinin projenin karlılığına etkisini sunma',
    ],
    default: [
      'Proje Tanıtımı: Yeni inşaat projesini yabancı yatırımcıya sunma',
      'Teknik Şartname: İnşaat malzemelerini ve standartlarını yabancı mühendisle tartışma',
      'Sözleşme Görüşmesi: Taşeron sözleşme şartlarını uluslararası firma ile müzakere etme',
      'İlerleme Toplantısı: Proje durumunu yabancı proje yöneticisine raporlama',
      'Güvenlik Brifingi: Şantiye güvenlik kurallarını çok uluslu ekibe aktarma',
    ],
  },
  egitim: {
    claire: [
      'Konferans Hazırlığı: Oxford/Harvard sunumu öncesi tezin Abstract kısmındaki akademik tonu ve telaffuzu mükemmelleştirme',
      'Akademik Yazışma: Prestijli dergideki hakem eleştirilerine nazik ama argümanlı İngilizce ile yanıt yazma',
      'Burs Mülakatı: Fulbright/Chevening mülakatı için vizyonu sofistike İngilizce ile ifade etmeyi sağlama',
      'Ders Anlatımı: Yabancı üniversitede konuk profesör olarak karmaşık bir teoriyi basit ama etkili dille özetleme',
      'Akademik Kitap Analizi: Uluslararası yayın için kitap taslağının dili, akışı ve akademik etiğe uygunluğunu inceleme',
    ],
    emma: [
      'Native Öğretmen Mülakatı: Ana dili İngilizce öğretmen adayıyla pedagojik yaklaşımlar ve Türkiye kültürü üzerine mülakat',
      'Akademisyen Kontratı: Yurt dışından davet edilen profesörle sözleşme, konaklama ve vize süreçlerini netleştirme',
      'Veli İletişimi: Yabancı öğrencinin gelişim raporunu ve sosyal uyum sürecini diplomatik dille velisine sunma',
      'Akreditasyon Denetimi: IB/CIS akreditasyonunda kurumun İK politikalarını ve personel gelişim planlarını anlatma',
      'Oryantasyon Programı: Yeni işe alınan yabancı öğretmenlere "Türkiye\'de Yaşam ve Okul Kültürü" sunumu',
    ],
    default: [
      'Kurs Tanıtımı: Eğitim programını yabancı öğrenci veya kuruma tanıtma',
      'Öğrenci Değerlendirme: Öğrenci ilerlemesini yabancı veliye veya kuruma raporlama',
      'Eğitim İşbirliği: Uluslararası eğitim kurumu ile ortaklık görüşmesi',
      'Burs Görüşmesi: Burs programını yabancı başvuru sahibine açıklama',
      'Akademik Konferans: Uluslararası akademik etkinlikte sunum yapma',
    ],
  },
  turizm: {
    chloe: [
      'Kriz ve Memnuniyet: Düğün organizasyonundaki teknik aksaklık nedeniyle sinirli yabancı misafiri sakinleştirip çözüm üretme',
      'Özel Talepler: VIP yabancı misafirin spesifik diyet ihtiyaçları ve gezi taleplerine özel plan sunma',
      'Online İtibar: Tripadvisor/Booking\'daki olumsuz yorum sonrası misafiri arayarak profesyonel ve gönül alıcı yönetim',
      'Sadakat Programı: Sadık yabancı misafiri otelin Loyalty Program avantajlarına dahil etme ve ayrıcalıkları anlatma',
      'Kültürel Köprü: Türk mutfağını ve geleneksel Türk hamamını yabancı misafire cezbedici dille tanıtma',
    ],
    alistair: [
      'Acente Pazarlığı: Global tur operatörüyle (TUI, Jet2) gelecek sezonun kontenjan sayıları ve gecelik oda fiyatlarını pazarlama',
      'Kurumsal Satış: Microsoft gibi büyük firmanın Annual Summit organizasyonu için otelin olanaklarını savunarak satış kapatma',
      'Erken Rezervasyon: Early Bird kampanyasının avantajlarını ve rakip destinasyonlara (Yunanistan, İspanya) göre fark sunma',
      'Grup Rezervasyonu: 200 kişilik kongre grubu için transfer, konaklama ve gala yemeği bütçesini "İskoç karizmasıyla" müzakere',
      'Fiyatlandırma Stratejisi: Dinamik Fiyatlandırma (Dynamic Pricing) mantığını yabancı satış ortaklarına rasyonel verilerle açıklama',
    ],
    olivia: [
      'Medikal Turist Paketi: Sağlık turizmi için gelen yabancı hastaya tedavi paketi ve koordinasyon sürecini anlatma',
      'B2B Ortaklık: Yurt dışındaki sağlık turizmi acentesiyle referans protokolü kurma görüşmesi',
      'Uluslararası Sigorta: Sağlık turizmi kapsamı için uluslararası sigorta firmasıyla şart müzakeresi',
      'Sağlık Turizmi Fuarı: Uluslararası fuarda potansiyel iş ortaklarına kliniği ve hizmetleri tanıtma',
      'Hasta Takip Koordinasyonu: Tedavi sonrası ülkesine dönen hastanın sürecini uzaktan koordine etme',
    ],
    default: [
      'Otel Rezervasyonu: Yabancı seyahat acentesiyle konaklama şartlarını görüşme',
      'Tur Programı: Uluslararası gruba gezi planını İngilizce anlatma',
      'Misafir Hizmetleri: Yabancı misafirin taleplerini profesyonel İngilizce ile karşılama',
      'Destinasyon Tanıtımı: Türkiye\'yi yabancı iş ortaklarına tanıtma toplantısı',
      'Grup Organizasyonu: Uluslararası kongre veya etkinlik lojistiğini koordine etme',
    ],
  },
  danismanlik: {
    sterling: [
      'Strateji Sunumu: Büyük Türk holdingine "Globalleşme ve Avrupa Pazarına Giriş" yol haritasını Executive Consultant otoritesiyle sunma',
      'Kurumsallaşma İknası: Aile şirketi kurucusunu yönetimi profesyonellere devretmeye "British" zarafet ve tecrübeyle ikna etme',
      'Dijital Dönüşüm: Dijitalleşmenin "hayatta kalma meselesi" olduğunu anlatan etkileyici yönetim kurulu sunumu',
      'Kriz Danışmanlığı: İtibarı sarsılan marka CEO\'suna kriz iletişimi ve stratejik geri çekilme adımları üzerine mentorluk',
      'Birleşme Stratejisi: İki şirketin birleşmesinde (Merger) kültürel entegrasyonu yönetmek için liderlik planı sunma',
    ],
    david: [
      'IPO Danışmanlığı: Borsa İstanbul veya Londra\'da halka açılmayı planlayan şirketin finansal check-up ve IPO Readiness raporu',
      'Maliyet Optimizasyonu: Üretim tesisindeki gereksiz giderleri belirleyen cost-cutting stratejisini müdürlere raporlama',
      'Girişim Değerlemesi: Unicorn adayı startup\'ın finansal modelini ve nakit akış projeksiyonlarını yabancı yatırımcılara sunma',
      'Vergi ve Teşvik Danışmanlığı: Yurt dışına yatırım yapacak Türk firmaya vergi avantajları ve teşvikler üzerine finansal analiz',
      'Hazine Yönetimi: Küresel piyasa oynaklığına karşı Hazine Politikaları oluşturma konusunda finans departmanına danışmanlık',
    ],
    default: [
      'Danışmanlık Teklifi: Yönetim danışmanlığı hizmetlerini potansiyel müşteriye sunma',
      'Süreç Analizi: Şirket süreçlerini yabancı danışmanla değerlendirme toplantısı',
      'Strateji Oturumu: Büyüme stratejisini uluslararası danışman ekibiyle tartışma',
      'Değişim Yönetimi: Kurumsal dönüşüm planını yönetim kuruluna İngilizce sunma',
      'Benchmarking: Rakip analizini uluslararası paydaşlara raporlama',
    ],
  },
  hukuk: {
    elena: [
      'Sözleşme Müzakeresi: Türk tekstil markasının Avrupa distribütörlük sözleşmesindeki Fesih ve Münhasırlık maddelerini tartışma',
      'Tahkim Hazırlığı: LCIA\'da görülecek inşaat uyuşmazlığı için delil listesi ve Statement of Claim taslağı üzerinde çalışma',
      'KVKK/GDPR Uyumu: Holding\'in sınır ötesi veri transferi süreçlerinin yasal uyumunu yabancı denetim firmasına brifing verme',
      'M&A — Garantiler: Türk startup\'ının yabancı fon tarafından devralınmasında Representations & Warranties müzakeresi',
      'İş Hukuku Danışmanlığı: Yabancı yöneticiye Türkiye\'deki iş kanunu, kıdem tazminatı ve fesih prosedürlerini anlatma',
    ],
    sterling: [
      'Hukuki Strateji: Yurt dışı davanın marka itibarına etkisini ve basına yansıtılacağını yönetim kuruluna stratejik dille sunma',
      'Ortaklık Sözleşmesi: Joint Venture\'da yönetim kontrolü ve veto yetkileri üzerine karşı taraf CEO\'suyla gizli müzakere',
      'Etik ve Yönetişim: Şirketin global Anti-Bribery politikasını yurt dışı ofis yöneticilerine otoriter ve net dille deklare etme',
      'Düzenleyici İlişkiler: SEC/FCA gibi yabancı düzenleyicinin incelemesinde şirketin yasal duruşunu ve uyumluluk geçmişini savunma',
      'Miras ve Kuşak Geçişi: Aile şirketlerinde Trust/Foundation yapılandırmasının gerekliliğini aile meclisine "tecrübeli lider" olarak anlatma',
    ],
    default: [
      'Sözleşme İncelemesi: Uluslararası anlaşmanın kritik maddelerini yabancı avukatla tartışma',
      'Uyum Brifingi: Türkiye\'deki yasal gereklilikleri yabancı iş ortağına açıklama',
      'Hukuki Danışmanlık: Yabancı yatırımcıya Türk hukuku hakkında bilgi verme',
      'İhtilaف Yönetimi: Uluslararası ticari anlaşmazlığı diplomatik dille ele alma',
      'Fikri Mülkiyet: Marka ve patent hakları konusunda yabancı firma ile müzakere',
    ],
  },
  medya: {
    jake: [
      'Dizi İhracatı: Türk dizisinin Latin Amerika/MENA\'daki dağıtım hakları için Netflix/HBO ile Marketing Pitch görüşmesi',
      'Viral Kampanya: Global marka Türkiye lansmanı için Gen-Z jargonuna uygun enerjik dijital pazarlama planı sunumu',
      'Kreatif Brief: Yabancı prodüksiyon ajansına reklam filminde istenen "estetik duygu" ve görsel dili modern Amerikan İngilizce\'siyle aktarma',
      'Influencer Koordinasyonu: Global parfüm markası tanıtımında yabancı influencer\'lara kampanya hedeflerini ve "vibe"ı heyecanla anlatma',
      'Performans Analizi: E-ticaret kampanyasının CTR ve Conversion verilerini teknik pazarlama terimleriyle yönetime raporlama',
    ],
    elena: [
      'Format Lisanslama: Türk yarışma formatının yurt dışına satışı öncesi lisans sözleşmesinin Telif Hakları maddelerini müzakere etme',
      'Yetenek Sözleşmesi: Global yapımda rol alacak Türk oyuncunun sözleşmesindeki Sorumluluk ve Çalışma Saatleri maddelerini inceleme',
      'Telif İhlali: Markanın logosunun izinsiz kullanımı için yabancı ajansa gönderilecek Warning Letter içeriğini tartışma',
      'Veri Gizliliği: Yayın platformunun kullanıcı verilerini işlemesi ve hedeflenmiş reklamcılık konusundaki yasal sınırları raporlama',
      'Ortak Yapım (Co-production): İki ülkeden yapım şirketinin kâr paylaşımı ve fikri mülkiyet haklarının dağılımı hukuki müzakeresi',
    ],
    default: [
      'Medya Planı: Reklam kampanyasını uluslararası medya ajansıyla planlama',
      'İçerik Stratejisi: Global içerik planını yabancı editöryal ekiple belirleme',
      'Basın Toplantısı: Ürün lansmanı için yabancı gazetecilere sunum yapma',
      'Sponsorluk Görüşmesi: Uluslararası medya etkinliği için sponsorluk şartlarını müzakere etme',
      'Platform Görüşmesi: İçerik dağıtım platformuyla lisans şartlarını görüşme',
    ],
  },
  default: {
    default: [
      'Uluslararası Müşteri Görüşmesi: Yabancı müşteriyle ilk keşif ve ihtiyaç analizi toplantısı',
      'Stratejik Ortaklık Sunumu: Potansiyel iş ortağına sektörel işbirliği teklifi',
      'Ürün/Hizmet Tanıtımı: Şirketin ana ürününü veya hizmetini yabancı alıcıya sunma',
      'Bütçe ve Fiyatlama Müzakeresi: Proje bütçesini ve fiyatlandırma modelini yabancı müşteriyle görüşme',
      'Proje Kick-off: Yeni projenin hedef, kapsam ve sorumluluklarını uluslararası ekiple belirleme',
    ],
  },
};

function getScenarios(sectorId: string, coachId: string): string[] {
  const sectorMap = SCENARIO_MAP[sectorId] || SCENARIO_MAP.default;
  return sectorMap[coachId] || sectorMap.default || SCENARIO_MAP.default.default;
}

interface TurnAnalysis {
  grammarErrors: { original: string; corrected: string; explanation: string }[];
  vocabSuggestions: { original: string; better: string; explanation: string }[];
  score: number;
  correctedText: string;
}
interface Message { role: 'user' | 'coach'; text: string; ts: string; turnAnalysis?: TurnAnalysis }

interface SimReport {
  duration: number;
  turnCount: number;
  avgScore: number;
  grammarErrors: TurnAnalysis['grammarErrors'];
  vocabSuggestions: TurnAnalysis['vocabSuggestions'];
}

const MIN_RECORD_MS = 2000;

function getSimApiBase(): string {
  const base = (import.meta.env.BASE_URL as string).replace(/\/$/, '');
  return base.replace(/\/[^/]+$/, '') + '/api-server';
}

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}dk ${s}sn` : `${s}sn`;
}

export function SimMode() {
  const [step, setStep] = useState<'sector' | 'coach' | 'mode' | 'scenario-pick' | 'chat' | 'report'>('sector');
  const [sector, setSector] = useState<typeof SECTORS[0] | null>(null);
  const [coach, setCoach] = useState<typeof COACHES[0] | null>(null);
  const [mode, setMode] = useState<'free' | 'scenario' | null>(null);
  const [scenario, setScenario] = useState<string | null>(null);
  const [customScenario, setCustomScenario] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'recording' | 'processing' | 'speaking'>('idle');
  const [recordSecs, setRecordSecs] = useState(0);
  const [error, setError] = useState('');
  const [sessionReport, setSessionReport] = useState<SimReport | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recordStartRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chatStartTimeRef = useRef<number>(0);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const playAudio = (base64: string) => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ''; }
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: 'audio/mpeg' });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audioRef.current = audio;
    setPhase('speaking');
    audio.play().catch(() => {});
    audio.onended = () => { URL.revokeObjectURL(url); setPhase('idle'); };
  };

  const stopStream = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  };

  const startTimer = () => {
    recordStartRef.current = Date.now();
    setRecordSecs(0);
    timerRef.current = setInterval(() => {
      setRecordSecs(Math.floor((Date.now() - recordStartRef.current) / 1000));
    }, 200);
  };

  const stopTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setRecordSecs(0);
  };

  const sendAudio = async (blob: Blob) => {
    if (!coach || !sector) return;
    setPhase('processing');
    setError('');
    const history = messages.map(m => ({ role: m.role === 'user' ? 'user' : 'assistant' as const, content: m.text }));
    try {
      const formData = new FormData();
      formData.append('audio', blob, 'audio.webm');
      formData.append('voice', coach.voice);
      formData.append('systemPrompt', coach.systemPrompt);
      formData.append('sector', sector.id);
      formData.append('history', JSON.stringify(history));
      const res = await fetch(`${getSimApiBase()}/api/simulation/chat`, { method: 'POST', body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || 'Bir hata oluştu.');
      }
      const data = await res.json() as { userText: string; reply: string; audioBase64: string; turnAnalysis?: TurnAnalysis };
      const userMsg: Message = { role: 'user', text: data.userText, ts: now(), turnAnalysis: data.turnAnalysis };
      const coachMsg: Message = { role: 'coach', text: data.reply, ts: now() };
      setMessages(prev => [...prev, userMsg, coachMsg]);
      if (data.audioBase64) playAudio(data.audioBase64);
      else setPhase('idle');
    } catch (e: any) {
      setError(e?.message || 'Bir hata oluştu.');
      setPhase('idle');
    }
  };

  const handleMicPress = async () => {
    if (phase === 'speaking') { audioRef.current?.pause(); setPhase('idle'); return; }
    if (phase === 'recording') {
      if ((Date.now() - recordStartRef.current) < MIN_RECORD_MS) return;
      const mr = mediaRecorderRef.current;
      if (mr?.state === 'recording') {
        mr.onstop = () => {
          const blob = new Blob(audioChunksRef.current, { type: mr.mimeType || 'audio/webm' });
          stopStream(); stopTimer();
          sendAudio(blob);
        };
        mr.stop();
      } else { stopStream(); stopTimer(); setPhase('idle'); }
      mediaRecorderRef.current = null;
      return;
    }
    if (phase !== 'idle') return;
    setError('');
    audioChunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorder.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.start(100);
      mediaRecorderRef.current = recorder;
      startTimer();
      setPhase('recording');
    } catch {
      setError('Mikrofon erişimi reddedildi. Tarayıcı ayarlarından izin verin.');
    }
  };

  const computeReport = (msgs: Message[]): SimReport => {
    const duration = Math.floor((Date.now() - chatStartTimeRef.current) / 1000);
    const userMsgs = msgs.filter(m => m.role === 'user' && m.turnAnalysis);
    const scores = userMsgs.map(m => m.turnAnalysis!.score);
    const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const grammarErrors = userMsgs.flatMap(m => m.turnAnalysis!.grammarErrors);
    const vocabSuggestions = userMsgs.flatMap(m => m.turnAnalysis!.vocabSuggestions);
    return { duration, turnCount: userMsgs.length, avgScore, grammarErrors, vocabSuggestions };
  };

  const startSession = () => {
    chatStartTimeRef.current = Date.now();
    setSessionStarted(true);
  };

  const handleEndSession = () => {
    stopStream(); stopTimer();
    if (audioRef.current) { audioRef.current.pause(); }
    setPhase('idle');
    const report = computeReport(messages);
    setSessionReport(report);
    setStep('report');
  };

  const startChat = (sc: string | null) => {
    const sc2 = sc || customScenario.trim() || 'Serbest konuşma pratiği';
    setScenario(sc2);
    const greeting = mode === 'scenario'
      ? `Good. Today we're working on: "${sc2}". I'll be your professional counterpart in this scenario. Press the mic button when you're ready to begin.`
      : `Hello! I'm ${coach?.name}. I'm here for a free English conversation session with you. Press the mic button whenever you're ready to start.`;
    setMessages([{ role: 'coach', text: greeting, ts: now() }]);
    setSessionStarted(false);
    setPhase('idle');
    setError('');
    setStep('chat');
  };

  const reset = () => {
    stopStream(); stopTimer();
    if (audioRef.current) { audioRef.current.pause(); }
    setStep('sector'); setSector(null); setCoach(null); setMode(null);
    setScenario(null); setCustomScenario(''); setMessages([]);
    setSessionStarted(false); setPhase('idle'); setError(''); setSessionReport(null);
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: SILVER_LIGHT, fontFamily: "'Outfit', 'Inter', sans-serif" }}>
      {/* Header */}
      <header style={{ background: NAVY }} className="px-8 py-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-white text-sm" style={{ background: '#0ea5e9' }}>S</div>
          <span className="font-bold text-white text-lg tracking-tight">Sphere English</span>
          <span className="ml-2 text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: '#0ea5e922', color: '#7dd3fc', border: '1px solid #0ea5e933' }}>AI Studio</span>
        </div>
        <div className="flex items-center gap-4">
          <Breadcrumb step={step} sector={sector} coach={coach} mode={mode} onReset={reset} onSector={() => setStep('sector')} onCoach={() => setStep('coach')} onMode={() => setStep('mode')} />
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto">
        {step === 'sector' && <SectorScreen sectors={SECTORS} onSelect={s => { setSector(s); setStep('coach'); }} />}
        {step === 'coach' && sector && <CoachScreen coaches={COACHES} sector={sector} onSelect={c => { setCoach(c); setStep('mode'); }} onBack={() => setStep('sector')} />}
        {step === 'mode' && coach && sector && <ModeScreen coach={coach} sector={sector} onSelect={m => { setMode(m); if (m === 'free') startChat(null); else setStep('scenario-pick'); }} onBack={() => setStep('coach')} />}
        {step === 'scenario-pick' && coach && sector && (
          <ScenarioScreen
            coach={coach} sector={sector}
            scenarios={getScenarios(sector.id, coach.id)}
            custom={customScenario} onCustomChange={setCustomScenario}
            onSelect={startChat} onBack={() => setStep('mode')}
          />
        )}
        {step === 'chat' && coach && (
          <ChatScreen
            coach={coach}
            scenario={scenario || ''}
            messages={messages}
            phase={phase}
            recordSecs={recordSecs}
            sessionStarted={sessionStarted}
            error={error}
            onMicPress={handleMicPress}
            onStartSession={startSession}
            onEnd={handleEndSession}
            bottomRef={bottomRef}
          />
        )}
        {step === 'report' && coach && sessionReport && (
          <SimReportScreen
            coach={coach}
            scenario={scenario || ''}
            report={sessionReport}
            onRestart={() => { startChat(scenario); }}
            onHome={reset}
          />
        )}
      </main>
    </div>
  );
}

function now() { return new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }); }

function Breadcrumb({ step, sector, coach, mode, onReset, onSector, onCoach, onMode }: any) {
  const items = [
    { label: sector?.label || 'Sektör', active: step !== 'sector', onClick: step !== 'sector' ? onSector : undefined },
    ...(sector ? [{ label: coach?.name || 'Koç', active: ['mode', 'scenario-pick', 'chat'].includes(step), onClick: ['mode', 'scenario-pick', 'chat'].includes(step) ? onCoach : undefined }] : []),
    ...(coach && ['scenario-pick', 'chat'].includes(step) ? [{ label: mode === 'free' ? 'Free Chat' : 'Scenario Mode', active: false }] : []),
  ];
  return (
    <div className="flex items-center gap-1 text-sm">
      <button onClick={onReset} className="text-white/40 hover:text-white/70 text-xs transition-colors">Yeniden Başla</button>
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          <span className="text-white/30">›</span>
          <button
            onClick={item.onClick}
            className={`transition-colors ${item.active && item.onClick ? 'text-sky-400 hover:text-sky-300 cursor-pointer' : 'text-white/50 cursor-default'}`}
          >{item.label}</button>
        </span>
      ))}
    </div>
  );
}

function SectorScreen({ sectors, onSelect }: { sectors: typeof SECTORS; onSelect: (s: typeof SECTORS[0]) => void }) {
  return (
    <div className="max-w-5xl mx-auto px-8 py-12">
      <div className="mb-10">
        <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#0ea5e9' }}>— Adım 1 / 3</p>
        <h1 className="text-3xl font-black mb-2" style={{ color: NAVY }}>Sektörünüzü Seçin</h1>
        <p className="text-slate-500 text-sm">Çalıştığınız veya pratik yapmak istediğiniz sektörü belirleyin. Koç ve senaryolar buna göre kişiselleştirilecektir.</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {sectors.map(s => (
          <button key={s.id} onClick={() => onSelect(s)}
            className="group p-4 bg-white rounded-xl border text-left transition-all hover:shadow-md hover:-translate-y-0.5"
            style={{ borderColor: SILVER_MID }}>
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3 flex-shrink-0"
              style={{ background: '#e8eef7', color: NAVY }}>
              <div className="w-6 h-6">{SECTOR_ICONS[s.id]}</div>
            </div>
            <div className="font-bold text-sm mb-0.5" style={{ color: NAVY }}>{s.label}</div>
            <div className="text-xs text-slate-400 leading-tight">{s.desc}</div>
            <div className="mt-3 text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: '#0ea5e9' }}>Seç →</div>
          </button>
        ))}
      </div>
    </div>
  );
}

const BASE = import.meta.env.BASE_URL ?? '/';

function CoachAvatar({ coach, size = 40, className = '' }: { coach: typeof COACHES[0]; size?: number; className?: string }) {
  const [err, setErr] = useState(false);
  const src = coach.image ? BASE.replace(/\/$/, '') + coach.image : null;
  if (src && !err) {
    return (
      <img
        src={src}
        alt={coach.name}
        onError={() => setErr(true)}
        className={`object-cover rounded-full flex-shrink-0 ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className={`rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 ${className}`}
      style={{ width: size, height: size, background: coach.color, fontSize: size * 0.3 }}
    >
      {coach.flag}
    </div>
  );
}

function CoachCard({ c, onSelect, featured }: { c: typeof COACHES[0]; onSelect: (c: typeof COACHES[0]) => void; featured?: boolean }) {
  return (
    <button onClick={() => onSelect(c)}
      className="group bg-white rounded-xl border p-4 text-left transition-all hover:shadow-lg hover:-translate-y-1 relative"
      style={{ borderColor: featured ? c.color : SILVER_MID, borderTopColor: c.color, borderTopWidth: 3 }}>
      {featured && (
        <span className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
          style={{ background: c.color + '18', color: c.color }}>
          Uzman
        </span>
      )}
      <div className="flex items-center gap-3 mb-3">
        <CoachAvatar coach={c} size={40} />
        <div>
          <div className="font-bold text-sm" style={{ color: NAVY }}>{c.name}</div>
          <div className="text-xs text-slate-400">{c.flag} {c.accent}</div>
        </div>
      </div>
      <div className="text-xs font-semibold mb-1" style={{ color: c.color }}>{c.specialty}</div>
      <div className="text-xs text-slate-400 italic leading-tight">{c.style}</div>
      <div className="mt-3 text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: c.color }}>Seç →</div>
    </button>
  );
}

function CoachScreen({ coaches, sector, onSelect, onBack }: { coaches: typeof COACHES; sector: typeof SECTORS[0]; onSelect: (c: typeof COACHES[0]) => void; onBack: () => void }) {
  const featuredIds = SECTOR_COACHES[sector.id] ?? [];
  const featured = featuredIds.length > 0
    ? featuredIds.map(id => coaches.find(c => c.id === id)).filter(Boolean) as typeof COACHES
    : coaches;
  const others = featuredIds.length > 0
    ? coaches.filter(c => !featuredIds.includes(c.id))
    : [];

  return (
    <div className="max-w-5xl mx-auto px-8 py-12">
      <div className="mb-10">
        <button onClick={onBack} className="text-xs text-slate-400 hover:text-slate-600 mb-4 flex items-center gap-1 transition-colors">
          ← Sektör Seçimine Dön
        </button>
        <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#0ea5e9' }}>— Adım 2 / 3 · {sector.label}</p>
        <h1 className="text-3xl font-black mb-2" style={{ color: NAVY }}>Koçunuzu Seçin</h1>
        <p className="text-slate-500 text-sm">Her koç farklı bir uzmanlık ve koçluk tarzı sunar. Hedefinize en uygun olanı seçin.</p>
      </div>

      {featuredIds.length > 0 && (
        <>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: NAVY }}>Bu Sektörün Uzmanları</span>
            <div className="flex-1 h-px" style={{ background: SILVER_MID }} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-10">
            {featured.map(c => <CoachCard key={c.id} c={c} onSelect={onSelect} featured />)}
          </div>
        </>
      )}

      {others.length > 0 && (
        <>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Diğer Koçlar</span>
            <div className="flex-1 h-px" style={{ background: SILVER_MID }} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {others.map(c => <CoachCard key={c.id} c={c} onSelect={onSelect} />)}
          </div>
        </>
      )}
    </div>
  );
}

function ModeScreen({ coach, sector, onSelect, onBack }: { coach: typeof COACHES[0]; sector: typeof SECTORS[0]; onSelect: (m: 'free' | 'scenario') => void; onBack: () => void }) {
  return (
    <div className="max-w-2xl mx-auto px-8 py-12">
      <div className="mb-10">
        <button onClick={onBack} className="text-xs text-slate-400 hover:text-slate-600 mb-4 flex items-center gap-1 transition-colors">← Koç Seçimine Dön</button>
        <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#0ea5e9' }}>— Adım 3 / 3 · {coach.flag} {coach.name}</p>
        <h1 className="text-3xl font-black mb-2" style={{ color: NAVY }}>Mod Seçin</h1>
        <p className="text-slate-500 text-sm">{coach.name} ile nasıl çalışmak istiyorsunuz?</p>
      </div>

      {/* Coach Summary Card */}
      <div className="p-5 rounded-xl border mb-8 flex items-center gap-4" style={{ borderColor: coach.color, background: '#fff' }}>
        <CoachAvatar coach={coach} size={56} />
        <div>
          <div className="font-bold" style={{ color: NAVY }}>{coach.name}</div>
          <div className="text-sm text-slate-500">{coach.specialty} · {coach.accent}</div>
          <div className="text-xs text-slate-400 italic mt-0.5">{coach.style}</div>
        </div>
        <div className="ml-auto text-right">
          <div className="text-xs text-slate-400">Sektör</div>
          <div className="text-sm font-semibold" style={{ color: NAVY }}>{sector.label}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button onClick={() => onSelect('free')}
          className="group p-6 bg-white rounded-2xl border-2 text-left transition-all hover:shadow-xl hover:-translate-y-1"
          style={{ borderColor: SILVER_MID }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl mb-4" style={{ background: NAVY + '10' }}>💬</div>
          <div className="font-black text-lg mb-2" style={{ color: NAVY }}>Free Chat</div>
          <p className="text-sm text-slate-500 leading-relaxed">Herhangi bir konu veya senaryo olmadan koçla serbest konuşma yapın. Esnek ve spontane.</p>
          <div className="mt-4 flex items-center gap-1 text-xs font-bold" style={{ color: NAVY }}>
            Başla <span className="group-hover:translate-x-1 transition-transform inline-block">→</span>
          </div>
        </button>

        <button onClick={() => onSelect('scenario')}
          className="group p-6 rounded-2xl border-2 text-left transition-all hover:shadow-xl hover:-translate-y-1 relative overflow-hidden"
          style={{ borderColor: NAVY, background: NAVY }}>
          <div className="absolute top-3 right-3 text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: '#0ea5e9', color: 'white' }}>Önerilen</div>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl mb-4" style={{ background: '#ffffff15' }}>🎯</div>
          <div className="font-black text-lg mb-2 text-white">Scenario Mode</div>
          <p className="text-sm text-white/70 leading-relaxed">Sektörünüze özel hazırlanmış 10 gerçek senaryo arasından seçin veya kendi senaryonuzu belirleyin.</p>
          <div className="mt-4 flex items-center gap-1 text-xs font-bold text-sky-400">
            Senaryoları Gör <span className="group-hover:translate-x-1 transition-transform inline-block">→</span>
          </div>
        </button>
      </div>
    </div>
  );
}

function ScenarioScreen({ coach, sector, scenarios, custom, onCustomChange, onSelect, onBack }: any) {
  return (
    <div className="max-w-2xl mx-auto px-8 py-12">
      <div className="mb-8">
        <button onClick={onBack} className="text-xs text-slate-400 hover:text-slate-600 mb-4 flex items-center gap-1 transition-colors">← Mod Seçimine Dön</button>
        <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#0ea5e9' }}>— Scenario Mode · {sector.label} × {coach.flag} {coach.name}</p>
        <h1 className="text-3xl font-black mb-2" style={{ color: NAVY }}>Senaryo Seçin</h1>
        <p className="text-slate-500 text-sm">Sektörünüz ve koçunuzun uzmanlığı birleştirilerek hazırlandı. Bir senaryo seçin ya da kendiniz belirleyin.</p>
      </div>

      <div className="space-y-2 mb-6">
        {scenarios.map((sc: string, i: number) => (
          <button key={i} onClick={() => onSelect(sc)}
            className="w-full text-left p-4 bg-white rounded-xl border hover:border-opacity-100 hover:shadow-md transition-all flex items-center gap-3 group"
            style={{ borderColor: SILVER_MID }}>
            <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 text-white" style={{ background: coach.color }}>{i + 1}</span>
            <span className="text-sm font-medium flex-1" style={{ color: NAVY }}>{sc}</span>
            <span className="text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" style={{ color: coach.color }}>Başla →</span>
          </button>
        ))}
      </div>

      <div className="p-5 bg-white rounded-xl border" style={{ borderColor: SILVER_MID }}>
        <label className="text-xs font-bold uppercase tracking-widest mb-2 block" style={{ color: SILVER }}>Kendi Senaryonu Belirle</label>
        <textarea
          value={custom}
          onChange={e => onCustomChange(e.target.value)}
          placeholder="Örn: Yurt dışı ortakla yeni sözleşme müzakeresi yapıyorum..."
          rows={3}
          className="w-full text-sm border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 mb-3"
          style={{ borderColor: SILVER_MID, color: NAVY }}
        />
        <button
          onClick={() => onSelect(custom || null)}
          disabled={!custom.trim()}
          className="px-5 py-2 rounded-lg text-sm font-bold text-white transition-all disabled:opacity-40"
          style={{ background: NAVY }}>
          Bu Senaryoyla Başla →
        </button>
      </div>
    </div>
  );
}

function MicButton({ phase, recordSecs, disabled }: { phase: string; recordSecs: number; disabled: boolean }) {
  const isRecording = phase === 'recording';
  const isSpeaking = phase === 'speaking';
  const isProcessing = phase === 'processing';
  const ringColor = isRecording ? '#ef4444' : isSpeaking ? '#0ea5e9' : NAVY;
  const label = isRecording
    ? `${recordSecs}sn — Durdurmak için tıkla`
    : isSpeaking ? 'Koç konuşuyor — Durdurmak için tıkla'
    : isProcessing ? 'İşleniyor...'
    : 'Konuşmak için tıkla';
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        {isRecording && (
          <span className="absolute inset-0 rounded-full animate-ping opacity-40" style={{ background: '#ef4444', animationDuration: '1s' }} />
        )}
        {isSpeaking && (
          <span className="absolute inset-0 rounded-full animate-ping opacity-30" style={{ background: '#0ea5e9', animationDuration: '1.4s' }} />
        )}
        <button
          disabled={disabled || isProcessing}
          type="button"
          className="relative w-20 h-20 rounded-full flex items-center justify-center shadow-xl transition-all active:scale-95 disabled:opacity-50"
          style={{
            background: isRecording ? '#ef4444' : isSpeaking ? '#0ea5e9' : NAVY,
            border: `3px solid ${ringColor}`,
            boxShadow: `0 0 0 6px ${ringColor}22`,
          }}
        >
          {isProcessing ? (
            <svg className="w-8 h-8 text-white animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          ) : isSpeaking ? (
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none" />
              <rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none" />
            </svg>
          ) : (
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 2a4 4 0 014 4v6a4 4 0 01-8 0V6a4 4 0 014-4z" fill="currentColor" stroke="none" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12a4 4 0 008 0M12 18v4M8 22h8" />
            </svg>
          )}
        </button>
      </div>
      <span className="text-xs text-slate-500 font-medium text-center">{label}</span>
    </div>
  );
}

function ChatScreen({ coach, scenario, messages, phase, recordSecs, sessionStarted, error, onMicPress, onStartSession, onEnd, bottomRef }: any) {
  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Chat Header */}
      <div className="px-5 py-3 border-b flex items-center gap-3 shadow-sm" style={{ background: '#fff', borderColor: SILVER_MID }}>
        <CoachAvatar coach={coach} size={36} />
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm truncate" style={{ color: NAVY }}>{coach.name}</div>
          <div className="text-xs text-slate-400 truncate max-w-xs">{scenario}</div>
        </div>
        {sessionStarted ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs text-slate-400">Oturum aktif</span>
            </div>
            <button onClick={onEnd} className="px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-opacity hover:opacity-80 flex-shrink-0"
              style={{ background: '#dc2626' }}>Oturumu Bitir</button>
          </div>
        ) : (
          <span className="text-xs text-slate-400">Başlamak için hazır</span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4" style={{ background: SILVER_LIGHT }}>
        {messages.map((m: Message, i: number) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} gap-2.5`}>
            {m.role === 'coach' && <CoachAvatar coach={coach} size={30} className="mt-1 flex-shrink-0" />}
            <div className={`max-w-sm flex flex-col gap-1 ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${m.role === 'user' ? 'text-white rounded-tr-sm' : 'text-slate-800 rounded-tl-sm'}`}
                style={{ background: m.role === 'user' ? NAVY : '#fff', border: m.role === 'coach' ? `1px solid ${SILVER_MID}` : 'none' }}>
                {m.text}
              </div>
              {m.turnAnalysis && m.turnAnalysis.grammarErrors.length > 0 && (
                <div className="w-full text-xs px-3 py-2 rounded-xl space-y-1" style={{ background: '#fef9c3', border: '1px solid #fde68a' }}>
                  {m.turnAnalysis.grammarErrors.slice(0, 2).map((e: any, gi: number) => (
                    <div key={gi} className="leading-snug" style={{ color: '#78350f' }}>
                      <span className="line-through opacity-60">{e.original}</span> → <span className="font-semibold">{e.corrected}</span>
                      <span className="opacity-70 ml-1">({e.explanation})</span>
                    </div>
                  ))}
                </div>
              )}
              {m.turnAnalysis && m.turnAnalysis.vocabSuggestions.length > 0 && m.turnAnalysis.grammarErrors.length === 0 && (
                <div className="w-full text-xs px-3 py-2 rounded-xl" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534' }}>
                  💡 {m.turnAnalysis.vocabSuggestions[0].original} → <span className="font-semibold">{m.turnAnalysis.vocabSuggestions[0].better}</span>
                </div>
              )}
              <span className="text-xs text-slate-400 px-1">{m.ts}</span>
            </div>
            {m.role === 'user' && (
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs flex-shrink-0 mt-1 font-bold" style={{ background: SILVER }}>S</div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Voice Controls */}
      <div className="border-t" style={{ background: '#fff', borderColor: SILVER_MID }}>
        {error && (
          <div className="mx-5 mt-4 px-4 py-2.5 rounded-xl text-sm text-red-700 bg-red-50 border border-red-200">{error}</div>
        )}
        {!sessionStarted ? (
          <div className="flex flex-col items-center justify-center py-6 gap-4">
            <p className="text-sm text-slate-500 text-center max-w-xs">Koçunuz hazır. Görüşmeyi başlatmak için aşağıdaki butona basın.</p>
            <button
              onClick={onStartSession}
              className="px-8 py-3 rounded-2xl font-bold text-white text-sm shadow-lg transition-all hover:opacity-90 active:scale-95"
              style={{ background: '#16a34a' }}
            >
              🎙️ Görüşmeyi Başlat
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-5 gap-2" onClick={onMicPress}>
            <MicButton phase={phase} recordSecs={recordSecs} disabled={false} />
          </div>
        )}
      </div>
    </div>
  );
}

function SimReportScreen({ coach, scenario, report, onRestart, onHome }: { coach: any; scenario: string; report: SimReport; onRestart: () => void; onHome: () => void }) {
  const scoreColor = report.avgScore >= 80 ? '#16a34a' : report.avgScore >= 65 ? '#d97706' : '#dc2626';
  const scoreLabel = report.avgScore >= 80 ? 'Çok İyi' : report.avgScore >= 65 ? 'Geliştirilmeli' : 'Çok Pratik Gerekli';

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-start justify-center py-10 px-4" style={{ background: SILVER_LIGHT }}>
      <div className="w-full max-w-2xl space-y-6">
        {/* Title */}
        <div className="text-center space-y-1">
          <h2 className="text-2xl font-black" style={{ color: NAVY }}>Oturum Raporu</h2>
          <p className="text-slate-500 text-sm">{coach.name} ile "{scenario}"</p>
        </div>

        {/* Score + Stats */}
        <div className="rounded-2xl p-6 shadow-sm" style={{ background: '#fff', border: `1px solid ${SILVER_MID}` }}>
          <div className="flex items-center justify-between gap-6">
            <div className="flex flex-col items-center gap-1">
              <div className="text-5xl font-black" style={{ color: scoreColor }}>{report.avgScore || '—'}</div>
              <div className="text-xs font-semibold" style={{ color: scoreColor }}>{report.avgScore ? scoreLabel : 'Puan yok'}</div>
              <div className="text-xs text-slate-400">Genel Skor</div>
            </div>
            <div className="flex-1 grid grid-cols-2 gap-3">
              {[
                { label: 'Süre', value: formatDuration(report.duration) },
                { label: 'Tur Sayısı', value: `${report.turnCount} tur` },
                { label: 'Gramer Hatası', value: `${report.grammarErrors.length} adet` },
                { label: 'Kelime Önerisi', value: `${report.vocabSuggestions.length} adet` },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl p-3 text-center" style={{ background: SILVER_LIGHT }}>
                  <div className="text-lg font-bold" style={{ color: NAVY }}>{value}</div>
                  <div className="text-xs text-slate-400">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Grammar Errors */}
        {report.grammarErrors.length > 0 && (
          <div className="rounded-2xl p-5 shadow-sm" style={{ background: '#fff', border: `1px solid ${SILVER_MID}` }}>
            <h3 className="font-bold text-sm mb-3" style={{ color: NAVY }}>Gramer Hataları</h3>
            <div className="space-y-2">
              {report.grammarErrors.map((e, i) => (
                <div key={i} className="flex items-start gap-3 text-sm px-3 py-2 rounded-xl" style={{ background: '#fef9c3', border: '1px solid #fde68a' }}>
                  <span className="text-red-500 font-mono line-through whitespace-nowrap">{e.original}</span>
                  <span className="text-slate-400">→</span>
                  <span className="font-semibold text-green-700 whitespace-nowrap">{e.corrected}</span>
                  <span className="text-xs text-slate-500 flex-1">({e.explanation})</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Vocab Suggestions */}
        {report.vocabSuggestions.length > 0 && (
          <div className="rounded-2xl p-5 shadow-sm" style={{ background: '#fff', border: `1px solid ${SILVER_MID}` }}>
            <h3 className="font-bold text-sm mb-3" style={{ color: NAVY }}>Profesyonel Kelime Önerileri</h3>
            <div className="space-y-2">
              {report.vocabSuggestions.map((v, i) => (
                <div key={i} className="flex items-start gap-3 text-sm px-3 py-2 rounded-xl" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                  <span className="text-slate-500 whitespace-nowrap">{v.original}</span>
                  <span className="text-slate-400">→</span>
                  <span className="font-semibold text-green-700 whitespace-nowrap">{v.better}</span>
                  <span className="text-xs text-slate-500 flex-1">({v.explanation})</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {report.grammarErrors.length === 0 && report.vocabSuggestions.length === 0 && report.turnCount === 0 && (
          <div className="rounded-2xl p-5 text-center text-slate-400 text-sm" style={{ background: '#fff', border: `1px solid ${SILVER_MID}` }}>
            Bu oturumda konuşma gerçekleşmedi.
          </div>
        )}
        {report.grammarErrors.length === 0 && report.vocabSuggestions.length === 0 && report.turnCount > 0 && (
          <div className="rounded-2xl p-5 text-center" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
            <div className="text-2xl mb-1">🎉</div>
            <div className="font-bold text-green-700 text-sm">Harika! Bu turda belirgin bir hata tespit edilmedi.</div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={onRestart} className="flex-1 py-3 rounded-2xl font-bold text-white text-sm transition-all hover:opacity-90 active:scale-95" style={{ background: NAVY }}>
            Yeniden Dene
          </button>
          <button onClick={onHome} className="flex-1 py-3 rounded-2xl font-bold text-sm transition-all hover:opacity-90 active:scale-95" style={{ background: SILVER_MID, color: NAVY }}>
            Ana Menü
          </button>
        </div>
      </div>
    </div>
  );
}
