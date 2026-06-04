import type { Metadata } from 'next';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'KVKK Aydınlatma Metni | Sphere English',
  description:
    'Sphere English KVKK aydınlatma metni. 6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında kişisel veri işleme süreçleri.',
  alternates: { canonical: 'https://www.sphereenglish.com/kvkk' },
  robots: { index: true, follow: true },
};

export default function KvkkPage() {
  return (
    <main className="bg-white min-h-screen">
      <Header />
      <article className="max-w-3xl mx-auto px-6 lg:px-10 py-16 lg:py-24">
        <p className="text-[11px] font-bold tracking-[0.22em] text-[#0ea5e9] uppercase mb-4">KVKK</p>
        <h1 className="text-[34px] lg:text-[44px] font-extrabold tracking-[-0.025em] text-[#1B365D] leading-[1.15] mb-3">
          Kişisel Verilerin Korunması Aydınlatma Metni
        </h1>
        <p className="text-[14px] text-gray-500 mb-10">Son güncelleme: 4 Haziran 2026</p>

        <div className="prose prose-slate max-w-none text-[15px] leading-relaxed text-gray-700 space-y-6">
          <p>
            6698 sayılı Kişisel Verilerin Korunması Kanunu (&quot;KVKK&quot;) uyarınca, Sphere English Eğitim
            Hizmetleri (&quot;Sphere English&quot; veya &quot;biz&quot;) olarak veri sorumlusu sıfatıyla, kişisel
            verilerinizin işlenmesine ilişkin sizi bilgilendirmek isteriz.
          </p>

          <h2 className="text-[22px] font-bold text-[#1B365D] mt-10 mb-4">1. Veri Sorumlusu</h2>
          <p>
            <strong>Sphere English</strong>
            <br />Kızılırmak Mah. Dumlupınar Blv. YDA Center 9A No:158 Çankaya/ANKARA
            <br />E-posta: <a className="text-[#0ea5e9]" href="mailto:info@sphereenglish.com">info@sphereenglish.com</a>
            <br />Telefon: +90 312 870 10 58
          </p>

          <h2 className="text-[22px] font-bold text-[#1B365D] mt-10 mb-4">2. İşlenen Kişisel Veriler</h2>
          <p>
            Sphere English; kullanıcı kimlik bilgileri (ad, soyad), iletişim bilgileri (e-posta, telefon, şirket),
            müşteri işlem bilgileri (talep ve şikayet kayıtları), pazarlama bilgileri (anket cevapları, çerez verileri)
            ve hizmet kullanım verilerini işlemektedir.
          </p>

          <h2 className="text-[22px] font-bold text-[#1B365D] mt-10 mb-4">3. İşleme Amaçları</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Sunulan kurumsal İngilizce eğitim hizmetinin yürütülmesi</li>
            <li>Talep, teklif ve sözleşme süreçlerinin yönetilmesi</li>
            <li>Müşteri memnuniyetinin ölçülmesi ve hizmet kalitesinin artırılması</li>
            <li>Yasal yükümlülüklerin yerine getirilmesi</li>
            <li>İletişim faaliyetlerinin yürütülmesi</li>
          </ul>

          <h2 className="text-[22px] font-bold text-[#1B365D] mt-10 mb-4">4. Aktarım</h2>
          <p>
            Kişisel verileriniz; eğitim platformumuzun teknik altyapısını sağlayan bulut hizmeti tedarikçileri, e-posta
            ve iletişim altyapısı sağlayıcıları ile yasal yükümlülükler kapsamında yetkili kamu kurum ve kuruluşlarına
            aktarılabilir.
          </p>

          <h2 className="text-[22px] font-bold text-[#1B365D] mt-10 mb-4">5. Haklarınız</h2>
          <p>KVKK&apos;nın 11. maddesi uyarınca veri sahibi olarak şu haklara sahipsiniz:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Kişisel verilerinizin işlenip işlenmediğini öğrenme</li>
            <li>İşlenme amaçlarını ve bunlara uygun kullanılıp kullanılmadığını öğrenme</li>
            <li>Yurt içi/dışı üçüncü kişileri öğrenme</li>
            <li>Eksik veya yanlış işlenmişse düzeltilmesini isteme</li>
            <li>KVKK&apos;nın öngördüğü şartlar çerçevesinde silinmesini veya yok edilmesini isteme</li>
            <li>Aktarımın yapıldığı üçüncü kişilere bildirilmesini isteme</li>
            <li>Münhasıran otomatik sistemlerle analiz edilmesi sonucu aleyhinize doğan sonuca itiraz etme</li>
            <li>Kanuna aykırı işleme nedeniyle zarara uğramanız hâlinde tazminat talep etme</li>
          </ul>

          <h2 className="text-[22px] font-bold text-[#1B365D] mt-10 mb-4">6. Başvuru</h2>
          <p>
            Yukarıdaki haklarınızı kullanmak için talebinizi <a className="text-[#0ea5e9]" href="mailto:info@sphereenglish.com">info@sphereenglish.com</a>
            {' '}adresine yazılı olarak iletebilirsiniz. Başvurunuz en geç 30 gün içerisinde sonuçlandırılacaktır.
          </p>
        </div>
      </article>
      <Footer />
    </main>
  );
}
