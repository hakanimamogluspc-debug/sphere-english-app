import type { Metadata } from 'next';
  import type { ReactNode } from 'react';

  export const metadata: Metadata = {
    title: 'İletişim | Kurumsal İngilizce Eğitim Teklifi Alın',
    description:
      "Şirketiniz için kurumsal iş İngilizcesi eğitim teklifi alın. Ücretsiz demo randevusu, ihtiyaç analizi ve kişiselleştirilmiş program önerisi için bizimle iletişime geçin.",
    alternates: { canonical: 'https://www.sphereenglish.com/iletisim' },
    openGraph: {
      title: 'İletişim | Sphere English — Kurumsal İngilizce Eğitimi',
      description: "Şirketiniz için kurumsal ingilizce eğitim teklifi alın. Ücretsiz demo ve ihtiyaç analizi.",
      url: 'https://www.sphereenglish.com/iletisim',
    },
  };

  export default function IletisimLayout({ children }: { children: ReactNode }) {
    return <>{children}</>;
  }
  