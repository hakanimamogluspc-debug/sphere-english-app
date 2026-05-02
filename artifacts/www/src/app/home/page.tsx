import type { Metadata } from 'next';
import React from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import HeroSection from './components/HeroSection';
import FounderQuoteSection from './components/FounderQuoteSection';
import MerveFounderQuoteSection from './components/MerveFounderQuoteSection';
import NedenBizSection from './components/NedenBizSection';
import EgitimModeliSection from './components/ICPSection';
import BentoGrid from './components/ModuleGrid';
import RaporlamaSection from './components/ProofSection';
import PaketlerSection from './components/SyllabusDownload';
import ContactSection from './components/StickyCTA';
import ReferencesSection from './components/ReferencesSection';
import FAQSection from './components/FAQSection';
import AICoachesSection from './components/AICoachesSection';
import AIStudioTeaser from './components/AIStudioTeaser';
import { fetchHomePage } from '@/payload/api';

export const metadata: Metadata = {
  title: 'Kurumsal İş İngilizcesi Eğitimi | Şirketiniz için Online Dil Programı',
  description:
    'Türkiye genelinde şirketlere kurumsal iş İngilizcesi eğitimi veriyoruz. Yönetici, satış, İK ve teknik ekipler için Oxford University Press ortaklıklı, ölçülebilir kurumsal dil eğitimi. Ücretsiz demo randevusu alın. 50+ şirket, 500+ çalışan, %94 memnuniyet oranı.',
  alternates: { canonical: 'https://www.sphereenglish.com/home' },
  openGraph: {
    title: 'Sphere English | Kurumsal İş İngilizcesi — Ölçülebilir Sonuçlar',
    description:
      'Oxford ortaklığıyla sertifikalı kurumsal İngilizce eğitimi. 50+ kurumsal müşteri, %94 memnuniyet.',
    url: 'https://www.sphereenglish.com/home',
    images: [{ url: '/assets/images/hero_online_english_lesson.png', width: 1200, height: 630 }],
  },
};

export const revalidate = 60;

export default async function HomePage() {
  let cms: any = null;
  try {
    cms = await fetchHomePage();
  } catch (err) {
    console.warn('[home] CMS fetch hatası — varsayılan içerik kullanılacak:', err);
  }

  return (
    <div className="min-h-screen bg-white font-sans">
      <Header />
      <main>
        <HeroSection data={cms} />
        <NedenBizSection data={cms} />
        <EgitimModeliSection />
        <BentoGrid data={cms} />
        <AICoachesSection data={cms} />
        <AIStudioTeaser />
        <FounderQuoteSection />
        <MerveFounderQuoteSection />
        <RaporlamaSection />
        <ReferencesSection />
        <PaketlerSection />
        <FAQSection data={cms} />
        <ContactSection />
      </main>
      <Footer />
    </div>
  );
}
