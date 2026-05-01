import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'AI Studio | Sphere English — Yapay Zeka Destekli İngilizce Koçlar',
  description:
    '11 farklı yapay zeka koçuyla gerçek zamanlı konuşma pratiği, anlık telaffuz analizi, gramer ve yazma desteği. Sphere AI Studio ile İngilizceyi hızla geliştirin.',
  alternates: { canonical: 'https://www.sphereenglish.com/ai-studio' },
  openGraph: {
    title: 'Sphere AI Studio — Yapay Zeka Destekli İngilizce Eğitim',
    description: '11 AI koç, 4 güçlü özellik, A1–C2 CEFR seviyeleri. Sphere English ile İngilizceyi hızla geliştirin.',
    url: 'https://www.sphereenglish.com/ai-studio',
  },
};

export default function AIStudioLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
