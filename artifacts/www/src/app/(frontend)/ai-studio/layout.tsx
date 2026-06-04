import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'AI Studio | Sphere English — Yapay Zeka Destekli İngilizce Koçlar',
  description:
    '12 farklı yapay zeka koçuyla gerçek zamanlı konuşma pratiği, anlık telaffuz analizi, gramer ve yazma desteği. Sphere AI Studio ile İngilizceyi hızla geliştirin.',
  alternates: { canonical: 'https://www.sphereenglish.com/ai-studio' },
  openGraph: {
    title: 'Sphere AI Studio — Yapay Zeka Destekli İngilizce Eğitim',
    description: '12 AI koç, 10 güçlü özellik, A1–C2 CEFR seviyeleri. Sphere English ile İngilizceyi hızla geliştirin.',
    url: 'https://www.sphereenglish.com/ai-studio',
    images: [{ url: 'https://www.sphereenglish.com/assets/images/og-ai-studio.png', width: 1200, height: 630, alt: 'Sphere AI Studio' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sphere AI Studio — Yapay Zeka Destekli İngilizce Eğitim',
    description: '12 AI koç, 10 güçlü özellik, A1–C2 CEFR seviyeleri.',
    images: ['https://www.sphereenglish.com/assets/images/og-ai-studio.png'],
  },
};

// AI Studio — 12 yapay zeka koçu için ItemList + Person schema (GEO için kritik)
const coachesJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'Sphere AI Studio Yapay Zeka Koçları',
  description: 'Sphere AI Studio bünyesindeki 12 uzman yapay zeka koçu. Her biri farklı sektör, aksan ve eğitim stilinde.',
  numberOfItems: 12,
  itemListElement: [
    { name: 'Mr. Sterling', jobTitle: 'CEO & Stratejik Yönetim Koçu', knowsAbout: 'Üst yönetim, stratejik planlama, kurumsal sunum' },
    { name: 'Jake', jobTitle: 'Pazarlama & Dijital Medya Koçu', knowsAbout: 'Dijital pazarlama, marka, sosyal medya İngilizcesi' },
    { name: 'David', jobTitle: 'Finans & Yatırım Koçu', knowsAbout: 'Wall Street İngilizcesi, yatırımcı sunumu, CFO toplantısı' },
    { name: 'Emma', jobTitle: 'İnsan Kaynakları Koçu', knowsAbout: 'Mülakat, performans görüşmesi, İK yazışmaları' },
    { name: 'Raj', jobTitle: 'BT & Yazılım Koçu', knowsAbout: 'Teknik İngilizce, scrum, teknik sunum' },
    { name: 'Hans', jobTitle: 'Lojistik & Operasyon Koçu', knowsAbout: 'Tedarik zinciri, Avrupa iş iletişimi' },
    { name: 'Elena', jobTitle: 'Uluslararası Hukuk Koçu', knowsAbout: 'Sözleşme müzakeresi, diplomatik İngilizce' },
    { name: 'Alistair', jobTitle: 'Satış & Müzakere Koçu', knowsAbout: 'Müzakere teknikleri, ikna dili, kapanış' },
    { name: 'Chloe', jobTitle: 'Müşteri İlişkileri Koçu', knowsAbout: 'Müşteri desteği, e-ticaret iletişimi' },
    { name: 'James', jobTitle: 'Üretim & Fabrika Koçu', knowsAbout: 'Üretim, iş güvenliği, tedarikçi görüşmeleri' },
    { name: 'Dr. Claire', jobTitle: 'Gramer & Akademik Koç', knowsAbout: 'Gramer, IELTS, TOEFL, akademik İngilizce' },
    { name: 'Dr. Olivia', jobTitle: 'Sağlık Turizmi Koçu', knowsAbout: 'Medikal İngilizce, hastane koordinasyonu, sağlık turizmi' },
  ].map((c, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    item: {
      '@type': 'Person',
      name: c.name,
      jobTitle: c.jobTitle,
      knowsAbout: c.knowsAbout,
      worksFor: { '@type': 'Organization', name: 'Sphere English', url: 'https://www.sphereenglish.com' },
      description: `Sphere AI Studio bünyesinde GPT-4o tabanlı yapay zeka koçu — ${c.jobTitle}.`,
    },
  })),
};

const aiStudioServiceJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'Sphere AI Studio',
  serviceType: 'Yapay Zeka Destekli İngilizce Eğitim',
  provider: { '@type': 'EducationalOrganization', name: 'Sphere English', url: 'https://www.sphereenglish.com' },
  description: 'GPT-4o ve OpenAI Whisper destekli, 12 uzman yapay zeka koçu ve 10 farklı modül sunan İngilizce eğitim platformu.',
  url: 'https://www.sphereenglish.com/ai-studio',
  hasOfferCatalog: {
    '@type': 'OfferCatalog',
    name: 'AI Studio Modülleri',
    itemListElement: [
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Telaffuz Koçu — Whisper AI fonem analizi' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Yazma Koçu — 7 iş yazısı türü' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Dilbilgisi Koçu — 60+ ders birimi' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'İş Senaryoları — 14 sektör, 50+ simülasyon' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Kelime Oyunu — 4000+ kelime' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Mülakat Simülatörü' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Sunum Simülatörü' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Akıllı Quiz Üretici' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Kişisel AI Öğretmen' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Adaptif Öğrenme Yolu' } },
    ],
  },
};

export default function AIStudioLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(coachesJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(aiStudioServiceJsonLd) }}
      />
      {children}
    </>
  );
}
