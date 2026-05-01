import type { Metadata } from 'next';

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

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white font-sans">
      <Header />
      <main>
        <HeroSection />
        <NedenBizSection />
        <EgitimModeliSection />
        <BentoGrid />
        <AICoachesSection />
        <AIStudioTeaser />
        <FounderQuoteSection />
        <MerveFounderQuoteSection />
        <RaporlamaSection />
        <ReferencesSection />
        <PaketlerSection />
        <FAQSection />
        <ContactSection />
      </main>
      <Footer />
    </div>
  );
}
