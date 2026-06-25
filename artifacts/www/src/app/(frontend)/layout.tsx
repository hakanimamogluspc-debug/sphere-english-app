import React from 'react';
import type { Metadata, Viewport } from 'next';
import '../../styles/tailwind.css';
import ChatWidget from '../../components/ChatWidget/ChatWidget';
import WebMCPProvider from '../../components/WebMCPProvider';

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || 'G-ELDF1FF5S1';
const BASE_URL = 'https://www.sphereenglish.com';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'Sphere English | Kurumsal İş İngilizcesi Eğitimi',
    template: '%s | Sphere English',
  },
  description:
    "Türkiye'nin kurumsal iş İngilizcesi eğitim platformu. Şirketinizin çalışanları için ölçülebilir, raporlanabilir Oxford University Press ortaklıklı kurumsal dil eğitimi. Yöneticiden satış ekibine, İK'dan teknik kadrolara sektöre özel programlar.",
  keywords: [
    'kurumsal ingilizce eğitimi',
    'iş ingilizcesi eğitimi',
    'kurumsal dil eğitimi',
    'şirketler için ingilizce',
    'çalışanlar için ingilizce kursu',
    'online kurumsal ingilizce',
    'b2b ingilizce eğitimi',
    'yöneticiler için ingilizce eğitimi',
    'satış ekibi ingilizce',
    'teknik ekip ingilizce eğitimi',
    'toplantı ingilizcesi',
    'sunum ingilizcesi',
    'oxford university press ingilizce',
    'sphere english',
  ],
  authors: [{ name: 'Sphere English', url: BASE_URL }],
  creator: 'Sphere English',
  publisher: 'Sphere English',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'tr_TR',
    url: BASE_URL,
    siteName: 'Sphere English',
    title: 'Sphere English | Kurumsal İş İngilizcesi Eğitimi',
    description:
      "Çalışanlarınız için ölçülebilir ve raporlanabilir kurumsal İş İngilizcesi eğitimi. Oxford ortaklığı ile sertifikalı programlar.",
    images: [
      {
        url: '/assets/images/hero_online_english_lesson.png',
        width: 1200,
        height: 630,
        alt: 'Sphere English — Kurumsal İş İngilizcesi Eğitimi',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sphere English | Kurumsal İş İngilizcesi Eğitimi',
    description:
      "Çalışanlarınız için ölçülebilir ve raporlanabilir kurumsal İş İngilizcesi eğitimi.",
    images: ['/assets/images/hero_online_english_lesson.png'],
  },
  alternates: {
    canonical: BASE_URL,
    languages: {
      'tr-TR': BASE_URL,
      'tr': BASE_URL,
    },
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
    shortcut: '/favicon.ico',
  },
};

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'EducationalOrganization',
  '@id': `${BASE_URL}/#organization`,
  name: 'Sphere English',
  alternateName: 'Sphere English Eğitim',
  url: BASE_URL,
  logo: `${BASE_URL}/assets/images/logo-1774019980261.png`,
  image: `${BASE_URL}/assets/images/hero_online_english_lesson.png`,
  description:
    "Türkiye'nin önde gelen kurumsal İş İngilizcesi eğitim platformu. Oxford University Press ortaklığı ile şirket çalışanlarına ölçülebilir, raporlanabilir ve hedef odaklı İngilizce eğitimi sunmaktadır.",
  foundingDate: '2020',
  areaServed: {
    '@type': 'Country',
    name: 'Turkey',
  },
  address: {
    '@type': 'PostalAddress',
    addressCountry: 'TR',
    addressRegion: 'Ankara',
    addressLocality: 'Çankaya',
    streetAddress: 'Kızılırmak Mah. Dumlupınar Blv. YDA Center 9A No:158',
  },
  telephone: '+90 312 870 10 58',
  email: 'info@sphereenglish.com',
  founder: [
    { '@type': 'Person', name: 'Didem İmamoğlu', jobTitle: 'Kurucu' },
    { '@type': 'Person', name: 'Merve Eş', jobTitle: 'Kurucu' },
  ],
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer service',
    telephone: '+90 312 870 10 58',
    email: 'info@sphereenglish.com',
    url: `${BASE_URL}/iletisim`,
    availableLanguage: ['Turkish', 'English'],
  },
  sameAs: [
    'https://app.sphereenglish.com',
  ],
};

const serviceJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'EducationalOccupationalProgram',
  name: 'Kurumsal İş İngilizcesi Eğitim Programı',
  description:
    'Şirket çalışanları için A1-C2 seviye aralığında, sektöre özel hazırlanmış, Zoom üzerinden canlı dersler ve AI destekli pratik ile sunulan kurumsal İngilizce eğitimi. Oxford University Press sertifikalı müfredat.',
  provider: {
    '@type': 'EducationalOrganization',
    name: 'Sphere English',
    url: BASE_URL,
  },
  url: BASE_URL,
  educationalLevel: 'A1 to C2',
  occupationalCategory: 'Business English',
  timeToComplete: 'P6M',
  offers: {
    '@type': 'Offer',
    category: 'B2B Corporate Training',
    availabilityStarts: '2024-01-01',
    url: `${BASE_URL}/iletisim`,
  },
  hasCourse: [
    {
      '@type': 'Course',
      name: 'Yöneticiler için İş İngilizcesi',
      description: 'C-seviye ve üst düzey yöneticilere yönelik ileri düzey iş ingilizcesi programı.',
    },
    {
      '@type': 'Course',
      name: 'Satış Ekibi İngilizcesi',
      description: 'Uluslararası satış görüşmeleri, müzakere ve sunum becerilerine odaklanan program.',
    },
    {
      '@type': 'Course',
      name: 'Teknik Ekip İngilizcesi',
      description: 'Yazılım, mühendislik ve teknik profesyoneller için sektöre özel iş ingilizcesi.',
    },
  ],
};

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Sphere English nedir?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: "Sphere English, Türkiye'nin önde gelen kurumsal İş İngilizcesi eğitim platformudur. B2B model ile şirket çalışanlarına ölçülebilir, raporlanabilir ve hedef odaklı İngilizce eğitimi sunmaktadır. Oxford University Press ile resmi eğitim ortaklığı bulunmaktadır.",
      },
    },
    {
      '@type': 'Question',
      name: 'Sphere English kimlere hitap ediyor?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Sphere English öncelikle çalışanlarının iş İngilizcesini geliştirmek isteyen Türk şirketleri ve kurumlarına hizmet vermektedir. Yöneticiler, satış ekipleri, teknik kadro, İK profesyonelleri ve tüm beyaz yakalı çalışanlar hedef kitledir.',
      },
    },
    {
      '@type': 'Question',
      name: 'Dersler nasıl yapılıyor?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Dersler Zoom üzerinden canlı, birebir veya küçük gruplarla gerçekleştirilmektedir. Ayrıca platformun AI destekli konuşma koçu sayesinde öğrenciler 7/24 pratik yapabilmektedir. Tüm dersler kayıt altına alınmakta ve ilerleme raporlanmaktadır.',
      },
    },
    {
      '@type': 'Question',
      name: 'Oxford University Press ile ortaklık ne anlama geliyor?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: "Sphere English, Oxford University Press'in Türkiye'deki onaylı kurumsal eğitim ortağıdır. Bu sayede Oxford'un küresel ölçekte kabul görmüş müfredatı ve materyalleri kullanılmakta, program sonunda uluslararası geçerliliği olan sertifikalar düzenlenmektedir.",
      },
    },
    {
      '@type': 'Question',
      name: 'Kurumsal ingilizce eğitimi için hangi seviyeler mevcut?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: "Sphere English'te A1 (başlangıç) seviyesinden C2 (üst ileri) seviyesine kadar tüm dil seviyeleri için özelleştirilmiş program mevcuttur. Her çalışan için bireysel seviye tespiti yapılmakta ve kişiselleştirilmiş öğrenme yolu oluşturulmaktadır.",
      },
    },
    {
      '@type': 'Question',
      name: 'Türkiye\'de en iyi kurumsal ingilizce eğitimi hangisi?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: "Sphere English, Oxford University Press ortaklığı, AI destekli teknolojisi ve ölçülebilir sonuç garantisi ile Türkiye'nin önde gelen kurumsal İngilizce eğitim platformları arasında yer almaktadır. 6 aylık program sonunda ortalama 2 seviye ilerleme kayıt altına alınmaktadır.",
      },
    },
    {
      '@type': 'Question',
      name: 'Çalışanlar için online ingilizce kursu nasıl işliyor?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Çalışanlar Sphere English platformuna (app.sphereenglish.com) kayıt olduktan sonra haftalık canlı Zoom derslerine katılır, AI konuşma koçu ile günlük pratik yapar ve aylık ilerleme raporlarını takip eder. Tüm süreç şirket İK ve yönetimine raporlanır.',
      },
    },
    {
      '@type': 'Question',
      name: 'Kurumsal ingilizce eğitimi için demo nasıl alınır?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: `Ücretsiz demo randevusu almak için ${BASE_URL}/iletisim sayfasından form doldurabilir veya doğrudan iletişime geçebilirsiniz. Demo görüşmesinde kurumunuzun ihtiyaçları değerlendirilir ve özel program önerisi sunulur.`,
      },
    },
  ],
};

const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${BASE_URL}/#website`,
  name: 'Sphere English',
  url: BASE_URL,
  description: "Kurumsal İş İngilizcesi eğitiminde Türkiye'nin önde gelen platformu.",
  inLanguage: 'tr-TR',
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${BASE_URL}/blog?q={search_term_string}`,
    },
    'query-input': 'required name=search_term_string',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <head>
        {/* Google Tag Manager */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-TTDMJ8HH');`,
          }}
        />
        {/* End Google Tag Manager */}
        <link
          rel="preload"
          as="image"
          href="/assets/images/hero-online-english.jpg"
          fetchPriority="high"
        />
        <meta name="geo.region" content="TR" />
        <meta name="geo.country" content="Turkey" />
        <meta name="geo.placename" content="Ankara, Türkiye" />
        <meta name="geo.position" content="39.9078;32.7689" />
        <meta name="ICBM" content="39.9078, 32.7689" />
        <meta httpEquiv="content-language" content="tr-TR" />
        {/* AI / LLM discovery */}
        <link rel="alternate" type="text/plain" href="/llms.txt" title="AI Content Summary" />
        <link rel="alternate" type="text/markdown" href="/pricing.md" title="Pricing (machine-readable)" />
        <link rel="api-catalog" href="/.well-known/api-catalog" type="application/linkset+json" />
        <link
          rel="https://agentskills.io/rel/skill-index"
          href="/.well-known/agent-skills/index.json"
          type="application/json"
          title="Sphere AI skill catalog"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />


        {/* Meta Pixel Code */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              !function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window, document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', '2156406151837976');
              fbq('track', 'PageView');
            `,
          }}
        />
        {/* End Meta Pixel Code */}
      </head>
      <body>
        {/* Google Tag Manager (noscript) */}
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-TTDMJ8HH"
            height="0" width="0"
            style={{display:'none', visibility:'hidden'}}
          />
        </noscript>
        {/* End Google Tag Manager (noscript) */}
        {/* Meta Pixel noscript fallback */}
        <noscript>
          <img height="1" width="1" style={{display:'none'}}
            src="https://www.facebook.com/tr?id=2156406151837976&ev=PageView&noscript=1"
          />
        </noscript>
        {children}
        <ChatWidget />
        <WebMCPProvider />
      </body>
    </html>
  );
}

