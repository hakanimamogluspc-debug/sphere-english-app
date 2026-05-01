import type { Metadata } from 'next';
  import type { ReactNode } from 'react';

  export const metadata: Metadata = {
    title: 'Hakkımızda | Kurumsal İngilizce Eğitim Uzmanları',
    description:
      "Sphere English olarak 2020'den bu yana Türkiye'deki şirketlere kurumsal iş İngilizcesi eğitimi veriyoruz. Oxford University Press ortaklığı, sertifikalı eğitmenler ve ölçülebilir sonuçlarla fark yaratıyoruz.",
    alternates: { canonical: 'https://www.sphereenglish.com/hakkimizda' },
    openGraph: {
      title: 'Hakkımızda | Sphere English — Kurumsal İngilizce Uzmanları',
      description: "Kurumsal iş İngilizcesi eğitiminde Türkiye'nin öncü platformu. Sertifikalı eğitmenler, Oxford müfredatı, 50+ şirket deneyimi.",
      url: 'https://www.sphereenglish.com/hakkimizda',
    },
  };

  export default function HakkimizdaLayout({ children }: { children: ReactNode }) {
    return <>{children}</>;
  }
  