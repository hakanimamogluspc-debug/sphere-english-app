import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import Header from '@/components/Header';

interface SolutionData {
  title: string;
  category: string;
  description: string;
  highlights: string[];
  ctaText: string;
}

const solutions: Record<string, SolutionData> = {
  'toplanti-ingilizcesi': {
    title: 'Toplantı İngilizcesi',
    category: 'Beceriye Göre',
    description:
      'Uluslararası toplantılarda kendinizi güvenle ifade edin. Sphere English\'in Toplantı İngilizcesi programı; gündem yönetimi, görüş bildirme, soru sorma ve tartışma yönetimi gibi gerçek iş senaryolarına dayalı pratik beceriler kazandırır.',
    highlights: [
      'Toplantı açma ve kapatma kalıpları',
      'Görüş bildirme ve itiraz etme teknikleri',
      'Aktif dinleme ve not alma stratejileri',
      'Sanal toplantı (Zoom/Teams) dil becerileri',
    ],
    ctaText: 'Toplantı İngilizcesi Programını Keşfet',
  },
  'sunum-teknikleri': {
    title: 'Sunum Teknikleri',
    category: 'Beceriye Göre',
    description:
      'İngilizce sunumlarınızı etkileyici ve akıcı hale getirin. Sphere English\'in Sunum Teknikleri programı; yapı kurma, veri aktarma, seyirciyle etkileşim ve güçlü kapanış teknikleri üzerine yoğunlaşır.',
    highlights: [
      'Sunum yapısı ve akış tasarımı',
      'Grafik ve veri açıklama dili',
      'Seyirci sorularını yönetme',
      'Beden dili ve ses tonu farkındalığı',
    ],
    ctaText: 'Sunum Teknikleri Programını Keşfet',
  },
  'eposta-yazimi': {
    title: 'E-posta Yazımı',
    category: 'Beceriye Göre',
    description:
      'Profesyonel İngilizce e-postalar yazın; net, kibar ve etkili iletişim kurun. Sphere English\'in E-posta Yazımı programı; resmi yazışmalar, talep ve şikayet e-postaları ile iş dünyasının yazılı dil normlarını kapsar.',
    highlights: [
      'Resmi ve yarı resmi e-posta formatları',
      'Talep, onay ve ret yazıları',
      'Şikayet ve özür e-postaları',
      'Konu satırı ve kapanış ifadeleri',
    ],
    ctaText: 'E-posta Yazımı Programını Keşfet',
  },
  'muzakere-ve-ikna': {
    title: 'Müzakere ve İkna',
    category: 'Beceriye Göre',
    description:
      'İngilizce müzakerelerde üstünlük sağlayın. Sphere English\'in Müzakere ve İkna programı; teklif sunma, karşı argüman geliştirme, uzlaşı bulma ve ikna edici dil kullanımı konularında derinlemesine pratik sunar.',
    highlights: [
      'Teklif ve karşı teklif dili',
      'İkna edici argüman yapıları',
      'Uzlaşı ve taviz ifadeleri',
      'Kültürlerarası müzakere farkındalığı',
    ],
    ctaText: 'Müzakere ve İkna Programını Keşfet',
  },
  'telaffuz-ve-akicilik': {
    title: 'Telaffuz ve Akıcılık',
    category: 'Beceriye Göre',
    description:
      'Anlaşılır ve akıcı bir İngilizce telaffuz geliştirin. Sphere English\'in Telaffuz ve Akıcılık programı; ses bilgisi, vurgu, ritim ve doğal konuşma hızı üzerine kişiselleştirilmiş çalışmalar sunar.',
    highlights: [
      'Türkçe konuşanlar için kritik sesler',
      'Kelime ve cümle vurgusu',
      'Bağlantılı konuşma (connected speech)',
      'Özgüven artırıcı konuşma pratikleri',
    ],
    ctaText: 'Telaffuz ve Akıcılık Programını Keşfet',
  },
  'yoneticiler-icin': {
    title: 'Yöneticiler için',
    category: 'Rolüne Göre',
    description:
      'Liderlik iletişiminizi İngilizce\'de de güçlendirin. Sphere English\'in Yöneticiler programı; ekip yönetimi, performans görüşmeleri, stratejik sunum ve uluslararası paydaş iletişimi konularına odaklanır.',
    highlights: [
      'Ekip toplantılarını yönetme',
      'Performans ve geri bildirim görüşmeleri',
      'C-level iletişim dili',
      'Kriz ve değişim yönetimi iletişimi',
    ],
    ctaText: 'Yöneticiler Programını Keşfet',
  },
  'ik-profesyonelleri': {
    title: 'İK Profesyonelleri',
    category: 'Rolüne Göre',
    description:
      'İnsan kaynakları süreçlerinizi İngilizce\'de etkin yönetin. Sphere English\'in İK Profesyonelleri programı; mülakat yönetimi, iş ilanı yazımı, onboarding ve çalışan iletişimi konularını kapsar.',
    highlights: [
      'İngilizce mülakat teknikleri',
      'İş ilanı ve yetkinlik tanımları',
      'Onboarding ve oryantasyon dili',
      'Çalışan bağlılığı iletişimi',
    ],
    ctaText: 'İK Profesyonelleri Programını Keşfet',
  },
  'satis-ekipleri': {
    title: 'Satış Ekipleri',
    category: 'Rolüne Göre',
    description:
      'Uluslararası müşterilerle güçlü satış ilişkileri kurun. Sphere English\'in Satış Ekipleri programı; müşteri görüşmeleri, teklif sunma, itiraz yönetimi ve kapanış teknikleri üzerine yoğunlaşır.',
    highlights: [
      'Müşteri ihtiyaç analizi dili',
      'Ürün ve hizmet sunumu',
      'İtiraz karşılama teknikleri',
      'Satış kapanış ifadeleri',
    ],
    ctaText: 'Satış Ekipleri Programını Keşfet',
  },
  'teknik-ekipler': {
    title: 'Teknik Ekipler',
    category: 'Rolüne Göre',
    description:
      'Teknik bilginizi İngilizce\'de net ve etkili aktarın. Sphere English\'in Teknik Ekipler programı; teknik dokümantasyon, proje toplantıları, kod review ve uluslararası ekip iletişimi konularını kapsar.',
    highlights: [
      'Teknik kavramları sade dille açıklama',
      'Sprint ve proje toplantı dili',
      'Teknik yazışma ve dokümantasyon',
      'Uluslararası ekiplerle iş birliği',
    ],
    ctaText: 'Teknik Ekipler Programını Keşfet',
  },
  'finans-ingilizcesi': {
    title: 'Finans İngilizcesi',
    category: 'Sektöre Göre',
    description:
      'Finans dünyasının diline hakim olun. Sphere English\'in Finans İngilizcesi programı; finansal raporlama, yatırımcı sunumları, bütçe görüşmeleri ve bankacılık terminolojisi konularında uzmanlaşmanızı sağlar.',
    highlights: [
      'Finansal rapor okuma ve yorumlama',
      'Yatırımcı ve paydaş sunumları',
      'Bütçe ve tahmin görüşmeleri',
      'Bankacılık ve fintech terminolojisi',
    ],
    ctaText: 'Finans İngilizcesi Programını Keşfet',
  },
  'teknoloji-ingilizcesi': {
    title: 'Teknoloji İngilizcesi',
    category: 'Sektöre Göre',
    description:
      'Teknoloji sektörünün hızlı tempolu iletişim ortamında öne çıkın. Sphere English\'in Teknoloji İngilizcesi programı; ürün geliştirme, startup ekosistemi, yatırımcı pitch\'leri ve global teknoloji konferansları için dil becerileri sunar.',
    highlights: [
      'Ürün ve özellik tanımlama dili',
      'Startup ve yatırımcı iletişimi',
      'Agile ve Scrum toplantı dili',
      'Teknoloji konferansı ve networking',
    ],
    ctaText: 'Teknoloji İngilizcesi Programını Keşfet',
  },
  'saglik-ingilizcesi': {
    title: 'Sağlık İngilizcesi',
    category: 'Sektöre Göre',
    description:
      'Sağlık sektöründe uluslararası standartlarda iletişim kurun. Sphere English\'in Sağlık İngilizcesi programı; hasta iletişimi, tıbbi terminoloji, uluslararası konferanslar ve akademik yazım konularını kapsar.',
    highlights: [
      'Tıbbi terminoloji ve klinik dil',
      'Hasta ve aile iletişimi',
      'Uluslararası sağlık konferansları',
      'Akademik makale ve sunum dili',
    ],
    ctaText: 'Sağlık İngilizcesi Programını Keşfet',
  },
  'hukuk-ingilizcesi': {
    title: 'Hukuk İngilizcesi',
    category: 'Sektöre Göre',
    description:
      'Hukuki süreçlerde İngilizce\'yi güvenle kullanın. Sphere English\'in Hukuk İngilizcesi programı; sözleşme dili, mahkeme iletişimi, hukuki yazışmalar ve uluslararası tahkim süreçleri için kapsamlı dil eğitimi sunar.',
    highlights: [
      'Sözleşme ve anlaşma terminolojisi',
      'Hukuki yazışma ve dilekçe dili',
      'Uluslararası tahkim ve arabuluculuk',
      'Müvekkil görüşmeleri ve danışmanlık',
    ],
    ctaText: 'Hukuk İngilizcesi Programını Keşfet',
  },
};

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const solution = solutions[slug];
  if (!solution) return { title: 'Sayfa Bulunamadı | Sphere English' };
  return {
    title: `${solution.title} | Sphere English`,
    description: solution.description,
  };
}

export async function generateStaticParams() {
  return Object.keys(solutions).map((slug) => ({ slug }));
}

export default async function CozumlerPage({ params }: PageProps) {
  const { slug } = await params;
  const solution = solutions[slug];

  if (!solution) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-white">
      <Header forceWhite />
      {/* Hero */}
      <section className="pt-32 pb-20 px-6 bg-gradient-to-br from-[#082567] to-[#1a3a8f] text-white">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-[11px] font-bold tracking-[0.22em] text-blue-200 uppercase mb-4">
            {solution.category}
          </p>
          <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
            {solution.title}
          </h1>
          <p className="text-lg md:text-xl text-blue-100 leading-relaxed max-w-2xl mx-auto">
            {solution.description}
          </p>
        </div>
      </section>

      {/* Highlights */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-[#082567] mb-10 text-center tracking-tight">
            Program İçeriği
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {solution.highlights.map((item, i) => (
              <div
                key={i}
                className="flex items-start gap-4 p-5 rounded-2xl border border-gray-100 bg-gray-50 hover:border-[#082567]/20 hover:bg-blue-50/30 transition-all duration-200"
              >
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#082567] text-white text-xs font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <p className="text-[15px] text-anthracite font-medium leading-snug">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-2xl mx-auto text-center">
          <h3 className="text-2xl font-bold text-[#082567] mb-4">
            Hemen Başlayın
          </h3>
          <p className="text-gray-600 mb-8 text-[15px]">
            Ekibiniz veya kendiniz için özel bir program oluşturmak ister misiniz? Uzmanlarımızla ücretsiz görüşün.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/#iletisim"
              className="px-8 py-3.5 rounded-full text-white font-bold text-[13px] tracking-[0.14em] transition-all duration-200 hover:opacity-90 hover:shadow-lg"
              style={{ background: '#082567' }}
            >
              {solution.ctaText}
            </Link>
            <Link
              href="/cozumler"
              className="px-8 py-3.5 rounded-full text-[#082567] font-bold text-[13px] tracking-[0.14em] border-2 border-[#082567] hover:bg-[#082567] hover:text-white transition-all duration-200"
            >
              Tüm Çözümleri Gör
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
