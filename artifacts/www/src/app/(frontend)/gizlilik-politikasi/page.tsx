import type { Metadata } from 'next';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Gizlilik Politikası | Sphere English',
  description:
    'Sphere English gizlilik politikası. Kullanıcı verilerinin nasıl toplandığı, işlendiği, korunduğu ve haklarınız hakkında detaylı bilgi.',
  alternates: { canonical: 'https://www.sphereenglish.com/gizlilik-politikasi' },
  robots: { index: true, follow: true },
};

export default function GizlilikPage() {
  return (
    <main className="bg-white min-h-screen">
      <Header />
      <article className="max-w-3xl mx-auto px-6 lg:px-10 py-16 lg:py-24">
        <p className="text-[11px] font-bold tracking-[0.22em] text-[#0ea5e9] uppercase mb-4">Gizlilik</p>
        <h1 className="text-[34px] lg:text-[44px] font-extrabold tracking-[-0.025em] text-[#1B365D] leading-[1.15] mb-3">
          Gizlilik Politikası
        </h1>
        <p className="text-[14px] text-gray-500 mb-10">Son güncelleme: 4 Haziran 2026</p>

        <div className="prose prose-slate max-w-none text-[15px] leading-relaxed text-gray-700 space-y-6">
          <p>
            Sphere English olarak kullanıcılarımızın gizliliğine büyük önem veriyoruz. Bu Gizlilik Politikası;
            sphereenglish.com web sitesini ve app.sphereenglish.com platformunu kullanmanız sırasında topladığımız
            verileri nasıl kullandığımızı ve koruduğumuzu açıklar.
          </p>

          <h2 className="text-[22px] font-bold text-[#1B365D] mt-10 mb-4">1. Topladığımız Bilgiler</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>İletişim bilgileri:</strong> İletişim formu, demo talebi ve newsletter abonelik formları aracılığıyla verdiğiniz ad, e-posta, telefon, şirket bilgileri.</li>
            <li><strong>Hesap bilgileri:</strong> Platforma kayıt olduğunuzda paylaştığınız bilgiler.</li>
            <li><strong>Kullanım verileri:</strong> Hangi dersleri tamamladığınız, ne kadar süre platformu kullandığınız, ilerleme istatistikleriniz.</li>
            <li><strong>Teknik veriler:</strong> IP adresi, tarayıcı tipi, ziyaret zamanı, çerez verileri.</li>
            <li><strong>Sphere Asistan sohbet kayıtları:</strong> Marketing sitesi üzerindeki chatbot ile yaptığınız konuşmalar.</li>
          </ul>

          <h2 className="text-[22px] font-bold text-[#1B365D] mt-10 mb-4">2. Verileri Nasıl Kullanıyoruz</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Hizmetlerimizi sağlamak ve geliştirmek</li>
            <li>Taleplerinize cevap vermek</li>
            <li>Demo, teklif veya satış görüşmesi planlamak</li>
            <li>Müşteri memnuniyetini ölçmek</li>
            <li>Bildirimler ve pazarlama iletişimi (açık rıza varsa)</li>
            <li>Yasal yükümlülükleri yerine getirmek</li>
          </ul>

          <h2 className="text-[22px] font-bold text-[#1B365D] mt-10 mb-4">3. Çerezler (Cookies)</h2>
          <p>
            Sitemiz tarayıcı çerezleri kullanır. Çerezler oturum yönetimi, kullanıcı tercihlerinin hatırlanması ve site
            analitiği için gereklidir. Tarayıcı ayarlarınızdan çerezleri devre dışı bırakabilirsiniz; ancak bazı
            özelliklerin çalışmayabileceğini unutmayın.
          </p>

          <h2 className="text-[22px] font-bold text-[#1B365D] mt-10 mb-4">4. Üçüncü Taraflar</h2>
          <p>
            Verilerinizi yalnızca; hizmet sağlayıcılarımız (bulut hizmeti, e-posta altyapısı, analitik), Oxford
            University Press kapsamındaki sertifikalandırma süreçleri ve yasal yükümlülükler kapsamında yetkili kurumlar
            ile paylaşabiliriz. Verileriniz hiçbir koşulda satılmaz veya pazarlama amacıyla 3. taraflara devredilmez.
          </p>

          <h2 className="text-[22px] font-bold text-[#1B365D] mt-10 mb-4">5. Veri Güvenliği</h2>
          <p>
            Kişisel verileriniz, endüstri standartlarında TLS şifreleme, erişim kontrolü, düzenli yedekleme ve
            güvenlik duvarı önlemleri ile korunur. Buna rağmen internet üzerinden hiçbir veri iletim yönteminin
            %100 güvenli olmadığını hatırlatırız.
          </p>

          <h2 className="text-[22px] font-bold text-[#1B365D] mt-10 mb-4">6. Haklarınız</h2>
          <p>
            6698 sayılı KVKK kapsamındaki haklarınız hakkında detaylı bilgi için <a className="text-[#0ea5e9]" href="/kvkk">KVKK Aydınlatma Metnimizi</a> inceleyiniz.
          </p>

          <h2 className="text-[22px] font-bold text-[#1B365D] mt-10 mb-4">7. İletişim</h2>
          <p>
            Bu politika hakkında sorularınız için: <a className="text-[#0ea5e9]" href="mailto:info@sphereenglish.com">info@sphereenglish.com</a>
          </p>
        </div>
      </article>
      <Footer />
    </main>
  );
}
