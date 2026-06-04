import type { Metadata } from 'next';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Kullanım Koşulları | Sphere English',
  description:
    'Sphere English kurumsal İngilizce eğitim platformu kullanım koşulları. Hizmet kapsamı, hak ve yükümlülükler, ödeme ve iptal politikaları.',
  alternates: { canonical: 'https://www.sphereenglish.com/kullanim-kosullari' },
  robots: { index: true, follow: true },
};

export default function KullanimKosullariPage() {
  return (
    <main className="bg-white min-h-screen">
      <Header />
      <article className="max-w-3xl mx-auto px-6 lg:px-10 py-16 lg:py-24">
        <p className="text-[11px] font-bold tracking-[0.22em] text-[#0ea5e9] uppercase mb-4">Sözleşme</p>
        <h1 className="text-[34px] lg:text-[44px] font-extrabold tracking-[-0.025em] text-[#1B365D] leading-[1.15] mb-3">
          Kullanım Koşulları
        </h1>
        <p className="text-[14px] text-gray-500 mb-10">Son güncelleme: 4 Haziran 2026</p>

        <div className="prose prose-slate max-w-none text-[15px] leading-relaxed text-gray-700 space-y-6">
          <p>
            sphereenglish.com web sitesini ve app.sphereenglish.com platformunu kullanmadan önce lütfen aşağıdaki
            koşulları dikkatlice okuyunuz. Siteyi kullanmaya devam etmeniz bu koşulları kabul ettiğiniz anlamına gelir.
          </p>

          <h2 className="text-[22px] font-bold text-[#1B365D] mt-10 mb-4">1. Hizmet Tanımı</h2>
          <p>
            Sphere English; B2B kurumsal müşterilere yönelik, Oxford University Press iş birliğiyle, canlı Zoom
            dersleri ve GPT-4o destekli AI Studio modüllerinden oluşan bir İş İngilizcesi eğitim platformudur.
            Bireysel öğrenci programları, kurumsal sözleşme şartları çerçevesinde sağlanabilir.
          </p>

          <h2 className="text-[22px] font-bold text-[#1B365D] mt-10 mb-4">2. Hesap ve Kullanım</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Platform hesabı için verdiğiniz bilgilerin doğru ve güncel olduğunu beyan edersiniz.</li>
            <li>Hesabınızın güvenliği (şifre, oturum) sizin sorumluluğunuzdadır.</li>
            <li>Platformu yalnızca yasal amaçlar için kullanabilirsiniz.</li>
            <li>İçeriklere yetkisiz erişim, sistemleri manipüle etme veya zarar verme yasaktır.</li>
          </ul>

          <h2 className="text-[22px] font-bold text-[#1B365D] mt-10 mb-4">3. Fikri Mülkiyet</h2>
          <p>
            Platform üzerindeki tüm içerikler (müfredat, video, AI koç karakterleri, yazılım kodu) Sphere English
            ve/veya lisans verenlerine (Oxford University Press dahil) aittir. İzinsiz kopyalama, dağıtım ve türev iş
            oluşturma yasaktır.
          </p>

          <h2 className="text-[22px] font-bold text-[#1B365D] mt-10 mb-4">4. Ödeme ve İptal</h2>
          <p>
            Kurumsal müşteriler için ödeme ve iptal koşulları imzalanan hizmet sözleşmesinde belirlenir. Bireysel
            satın almalar için sözleşme tarihinden itibaren 14 gün cayma hakkı tanınır (kullanım başlamamışsa).
            Kullanım başladıktan sonra orantısal iade yapılır.
          </p>

          <h2 className="text-[22px] font-bold text-[#1B365D] mt-10 mb-4">5. Hizmet Değişiklikleri</h2>
          <p>
            Sphere English, hizmet özelliklerinde ve içeriklerde değişiklik yapma hakkını saklı tutar. Kapsamı etkileyen
            değişiklikler müşterilere önceden bildirilir.
          </p>

          <h2 className="text-[22px] font-bold text-[#1B365D] mt-10 mb-4">6. Sorumluluk Sınırlaması</h2>
          <p>
            Sphere English, hizmetin sürekliliği için makul çabayı gösterir ancak teknik aksaklıklar, üçüncü taraf
            servislerin (Zoom, OpenAI vb.) kesintisi nedeniyle oluşabilecek dolaylı zararlardan sorumlu tutulamaz.
          </p>

          <h2 className="text-[22px] font-bold text-[#1B365D] mt-10 mb-4">7. Uygulanacak Hukuk</h2>
          <p>
            Bu sözleşme Türkiye Cumhuriyeti hukukuna tabidir. Doğacak uyuşmazlıklarda Ankara Mahkemeleri ve İcra
            Daireleri yetkilidir.
          </p>

          <h2 className="text-[22px] font-bold text-[#1B365D] mt-10 mb-4">8. İletişim</h2>
          <p>
            Sorularınız için: <a className="text-[#0ea5e9]" href="mailto:info@sphereenglish.com">info@sphereenglish.com</a>
          </p>
        </div>
      </article>
      <Footer />
    </main>
  );
}
