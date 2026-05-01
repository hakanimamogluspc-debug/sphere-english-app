import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Kurumsal İngilizce Çözümleri | Sektör ve Rol Bazlı Eğitim',
    description:
      'Yöneticilerden satış ekiplerine, finans profesyonellerinden teknik kadrolara: sektörünüze ve rolünüze özel kurumsal iş İngilizcesi programları. Toplantı, sunum, e-posta, müzakere ingilizcesi ve daha fazlası.',
    alternates: { canonical: 'https://www.sphereenglish.com/cozumler' },
    openGraph: {
      title: 'Kurumsal İngilizce Çözümleri | Sphere English',
      description: 'Sektörünüze ve rolünüze özel iş İngilizcesi programları. Yönetici, satış, İK, teknik ve finans profesyonelleri için.',
      url: 'https://www.sphereenglish.com/cozumler',
    },
  };

const categories = [
  {
    title: 'Beceriye Göre',
    description: 'Belirli iş becerilerini geliştirmek için tasarlanmış programlar.',
    items: [
      { label: 'Toplantı İngilizcesi', slug: 'toplanti-ingilizcesi' },
      { label: 'Sunum Teknikleri', slug: 'sunum-teknikleri' },
      { label: 'E-posta Yazımı', slug: 'eposta-yazimi' },
      { label: 'Müzakere ve İkna', slug: 'muzakere-ve-ikna' },
      { label: 'Telaffuz ve Akıcılık', slug: 'telaffuz-ve-akicilik' },
    ],
  },
  {
    title: 'Rolüne Göre',
    description: 'Pozisyonunuza özel iletişim becerileri.',
    items: [
      { label: 'Yöneticiler için', slug: 'yoneticiler-icin' },
      { label: 'İK Profesyonelleri', slug: 'ik-profesyonelleri' },
      { label: 'Satış Ekipleri', slug: 'satis-ekipleri' },
      { label: 'Teknik Ekipler', slug: 'teknik-ekipler' },
    ],
  },
  {
    title: 'Sektöre Göre',
    description: 'Sektörünüzün terminolojisi ve iletişim normları.',
    items: [
      { label: 'Finans İngilizcesi', slug: 'finans-ingilizcesi' },
      { label: 'Teknoloji İngilizcesi', slug: 'teknoloji-ingilizcesi' },
      { label: 'Sağlık İngilizcesi', slug: 'saglik-ingilizcesi' },
      { label: 'Hukuk İngilizcesi', slug: 'hukuk-ingilizcesi' },
    ],
  },
];

export default function CozumlerPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header forceWhite />
      <main>
        <section className="pt-32 pb-16 px-4 sm:px-6 bg-gradient-to-br from-[#082567] to-[#1a3a8f] text-white text-center">
          <p className="text-[11px] font-bold tracking-[0.22em] text-blue-200 uppercase mb-4">Sphere English</p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-5">Çözümler</h1>
          <p className="text-base sm:text-lg text-blue-100 max-w-xl mx-auto">
            Beceriye, rolüne ve sektörüne göre kişiselleştirilmiş İş İngilizcesi programları.
          </p>
        </section>

        <section className="py-16 sm:py-20 px-4 sm:px-6">
          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-10">
            {categories.map((cat) => (
              <div key={cat.title}>
                <h2 className="text-[11px] font-bold tracking-[0.2em] text-[#082567] uppercase mb-1">{cat.title}</h2>
                <p className="text-[13px] text-gray-500 mb-5">{cat.description}</p>
                <ul className="flex flex-col gap-3">
                  {cat.items.map((item) => (
                    <li key={item.slug}>
                      <Link
                        href={`/cozumler/${item.slug}`}
                        className="flex items-center gap-2 text-[14px] font-medium text-anthracite hover:text-[#082567] group transition-colors"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-[#082567]/30 group-hover:bg-[#082567] transition-colors flex-shrink-0" />
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="py-12 sm:py-14 px-4 sm:px-6 bg-gray-50 text-center">
          <h3 className="text-xl sm:text-2xl font-bold text-[#082567] mb-4">Size Özel Program Oluşturalım</h3>
          <p className="text-gray-600 mb-8 text-[15px] max-w-lg mx-auto">
            Hangi çözümün size en uygun olduğundan emin değil misiniz? Uzmanlarımız size yol göstersin.
          </p>
          <Link
            href="/#iletisim"
            className="inline-block px-8 py-3.5 rounded-full text-white font-bold text-[13px] tracking-[0.14em] hover:opacity-90 hover:shadow-lg transition-all duration-200"
            style={{ background: '#082567' }}
          >
            Ücretsiz Danışmanlık Al
          </Link>
        </section>
      </main>
      <Footer />
    </div>
  );
}
