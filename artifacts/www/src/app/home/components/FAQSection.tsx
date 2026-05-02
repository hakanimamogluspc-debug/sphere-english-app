'use client';
import React, { useState } from 'react';

interface FAQ {
  question: string;
  answer: string;
}

interface FAQProps {
  data?: {
    faqKicker?: string;
    faqTitle1?: string;
    faqTitle2?: string;
    faqSubtitle?: string;
    faqs?: FAQ[];
  };
}

const DEFAULT_FAQS: FAQ[] = [
  { question: 'Kurumsal İngilizce eğitim programları ne kadar sürer?', answer: 'Programlarımız şirketinizin ihtiyaçlarına ve çalışanların başlangıç seviyesine göre genellikle 3 ila 12 ay arasında değişir. Her şirket için ücretsiz seviye tespit değerlendirmesi yaparak en uygun program süresini ve yoğunluğunu birlikte belirliyoruz. Haftada 2–3 ders ile sürdürülebilir ve ölçülebilir ilerleme sağlıyoruz.' },
  { question: 'Eğitmenleriniz kimlerden oluşuyor?', answer: "Tüm eğitmenlerimiz CELTA veya DELTA sertifikalı, iş dünyasında deneyim sahibi profesyonellerdir. Ekibimizde anadili İngilizce olan (native speaker) eğitmenler ile Türkiye'nin önde gelen kurumsal İngilizce uzmanları bir arada çalışmaktadır. Her eğitmen, şirketinizin sektörüne göre özellikle seçilmektedir." },
  { question: 'Şirketimize özel içerik hazırlanıyor mu?', answer: 'Evet, programlarımızın tamamı şirketinizin sektörüne, kullandığı terminolojiye ve çalışanların iş rollerine göre özelleştirilmektedir. Finans, teknoloji, sağlık, üretim, lojistik gibi pek çok sektörde sektör odaklı vaka çalışmaları ve gerçek iş senaryoları kullanıyoruz.' },
  { question: 'Kaç kişilik gruplarla çalışıyorsunuz?', answer: "En etkili öğrenme deneyimi için grup derslerimizi maksimum 6 kişi ile sınırlı tutuyoruz. Bire bir (birebir) özel dersler de sunuyoruz. Çalışan sayısı 20'yi aşan şirketler için seviye grupları oluşturarak hem maliyeti optimize ediyor hem de homojen sınıf yapısını koruyoruz." },
  { question: 'Eğitimin etkisini nasıl ölçüyorsunuz?', answer: 'Her ay detaylı ilerleme raporu sunuyoruz. Çalışanların konuşma akıcılığı, yazılı iletişim, kelime dağarcığı ve iş İngilizcesi kullanımı gibi kriterlerde somut verilerle gelişimini takip ediyoruz. Oxford University Press iş birliğiyle uygulanan standart testler aracılığıyla başlangıç ve bitiş seviyeleri karşılaştırmalı olarak raporlanır.' },
  { question: 'Online eğitim yüz yüze eğitim kadar etkili mi?', answer: 'Araştırmalar, yapılandırılmış online dil eğitiminin yüz yüze eğitimle eşdeğer hatta bazı alanlarda daha etkili olduğunu göstermektedir. Çalışanlar istedikleri yerden katılabildiği için devamsızlık oranı düşüyor, öğrenme sürekliliği artıyor. Canlı video derslerimiz, interaktif alıştırmalar ve yapay zeka destekli telaffuz antrenörümüz sayesinde öğrenme daha verimli hale geliyor.' },
  { question: 'İngilizce seviyesi belirleme süreci nasıl işliyor?', answer: "Programa başlamadan önce her çalışan için ücretsiz kapsamlı bir seviye tespit sınavı yapıyoruz. Bu değerlendirme; yazılı, sözlü ve dinleme becerilerini CEFR standartları (A1'den C2'ye) çerçevesinde ölçüyor. Sonuçlara göre çalışanlar uygun seviye grubuna yerleştiriliyor ve kişiselleştirilmiş öğrenme hedefleri belirleniyor." },
  { question: 'Teklif almak ve demo randevusu ayarlamak için ne yapmalıyız?', answer: 'Web sitemizden randevu formumuzu doldurmanız yeterli. 24 saat içinde kurumsal danışmanımız sizi arayarak şirketinizin ihtiyaçlarını dinler ve ücretsiz demo dersi ile birlikte size özel bir teklif hazırlar. Herhangi bir taahhüt gerektirmiyor; deneyip karar verebilirsiniz.' },
];

export default function FAQSection({ data }: FAQProps = {}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const kicker = data?.faqKicker ?? 'SIKÇA SORULAN SORULAR';
  const title1 = data?.faqTitle1 ?? 'Aklınızdaki soruları';
  const title2 = data?.faqTitle2 ?? 'yanıtlıyoruz.';
  const subtitle = data?.faqSubtitle ?? 'Kurumsal İngilizce eğitimi hakkında en çok merak edilen konuları derledik.';
  const faqs: FAQ[] = (data?.faqs && data.faqs.length > 0) ? data.faqs : DEFAULT_FAQS;

  return (
    <section id="sss" className="py-20 lg:py-28 bg-[#f8fafc]">
      <div className="max-w-4xl mx-auto px-6 lg:px-10">
        <div className="text-center mb-14">
          <span className="inline-block text-[11px] font-bold tracking-[0.22em] text-[#0ea5e9] uppercase mb-4">
            {kicker}
          </span>
          <h2 className="text-[34px] lg:text-[46px] font-extrabold tracking-[-0.025em] text-[#1B365D] leading-[1.12] mb-4">
            {title1}<br />
            <span className="text-[#0ea5e9]">{title2}</span>
          </h2>
          <p className="text-[15px] text-gray-500 leading-relaxed max-w-md mx-auto">{subtitle}</p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden"
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full flex items-center justify-between px-7 py-5 text-left gap-4 group"
                aria-expanded={openIndex === i}
              >
                <span className="text-[15px] font-bold text-[#1B365D] group-hover:text-[#0ea5e9] transition-colors duration-200">
                  {faq.question}
                </span>
                <span
                  className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300 ${
                    openIndex === i ? 'bg-[#0ea5e9] rotate-45' : 'bg-[#e8f0fe]'
                  }`}
                >
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className={openIndex === i ? 'text-white' : 'text-[#1B365D]'}>
                    <path d="M6.5 1v11M1 6.5h11" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </span>
              </button>
              <div
                className={`transition-all duration-300 ease-in-out ${
                  openIndex === i ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                } overflow-hidden`}
              >
                <p className="px-7 pb-6 text-[14px] text-gray-500 leading-relaxed">
                  {faq.answer}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
          <p className="text-[14px] text-gray-400 mb-4">Başka sorularınız mı var?</p>
          <a
            href="/iletisim"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-[#1B365D] text-white text-[14px] font-bold hover:bg-[#0ea5e9] transition-colors duration-200"
          >
            Bize Ulaşın
          </a>
        </div>
      </div>
    </section>
  );
}
