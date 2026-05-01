'use client';
import React, { useEffect, useRef } from 'react';
import Icon from '@/components/ui/AppIcon';
import Link from 'next/link';

interface Package {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  features: string[];
  tag: string;
  featured?: boolean;
}

const packages: Package[] = [
  {
    id: 'birebir',
    title: 'Çevrimiçi Birebir',
    subtitle: 'Kişiye özel, hızlı ve hedef odaklı gelişim',
    icon: 'UserIcon',
    tag: 'En Hızlı Gelişim',
    features: [
      'Haftada 2–3 birebir canlı ders',
      'Kişiye özel müfredat ve esnek tempo',
      'İş İngilizcesi uzmanı eğitmenler',
      'Esnek ders saatleri',
      'Kişisel gelişim yol haritası',
      'Aylık bireysel gelişim raporu',
    ],
  },
  {
    id: 'grup',
    title: 'Kurumsal Grup Eğitimleri',
    subtitle: 'Ekip bazlı, ölçülebilir ve sürdürülebilir dil gelişimi',
    icon: 'UserGroupIcon',
    tag: 'En Popüler',
    featured: true,
    features: [
      'Maksimum 5 kişilik butik gruplar',
      'Seviye ve hedef bazlı sınıf planlama',
      'Şirkete özel vaka çalışmaları',
      'Gerçek iş senaryoları ile pratik',
      'Takım içi iletişim odaklı eğitim',
      'Aylık ilerleme ve performans raporları',
      'Yönetici paneli ile gelişim takibi',
    ],
  },
  {
    id: 'sektorel',
    title: 'Sektörel İngilizce',
    subtitle: 'Sektörünüze özel iletişim kalıpları',
    icon: 'BuildingOffice2Icon',
    tag: 'Uzmanlaşmış',
    features: [
      'Finans, teknoloji, sağlık, hukuk vb.',
      'Teknik sunum ve yazışma',
      'Uluslararası konferans dili',
      'Sektör uzmanı eğitmenler',
      'Sertifika programı seçeneği',
    ],
  },
];

export default function PaketlerSection() {
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cards = sectionRef.current?.querySelectorAll('.reveal-card');
    if (!cards) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement;
            const delay = parseInt(el.dataset.delay || '0');
            setTimeout(() => el.classList.add('visible'), delay);
            observer.unobserve(el);
          }
        });
      },
      { threshold: 0.1 }
    );
    cards.forEach((c) => observer.observe(c));
    return () => observer.disconnect();
  }, []);

  return (
    <section id="kurumsal-cozumler" className="py-20 lg:py-28 bg-gradient-to-br from-[#f0f4f8] to-white" ref={sectionRef}>
      <div className="max-w-5xl mx-auto px-6 lg:px-10">

        {/* Header */}
        <div className="text-center mb-14">
          <span className="inline-block text-[11px] font-bold tracking-[0.22em] text-[#0ea5e9] uppercase mb-4">
            KURUMSAL ÇÖZÜMLER
          </span>
          <h2 className="text-[34px] lg:text-[46px] font-extrabold tracking-[-0.025em] text-[#1B365D] leading-[1.12] mb-4">
            Şirketinizin ihtiyacına<br />
            <span className="text-[#0ea5e9]">uygun program.</span>
          </h2>
          <p className="text-[15px] text-gray-500 leading-relaxed max-w-md mx-auto">
            Fiyatlandırma çalışan sayısı ve program kapsamına göre belirlenir. Size özel teklif için iletişime geçin.
          </p>
        </div>

        {/* Package Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {packages.map((pkg, i) => (
            <div
              key={pkg.id}
              className={`reveal-card rounded-3xl flex flex-col shadow-sm hover:shadow-md transition-shadow duration-300 ${
                pkg.featured ? 'bg-[#1B365D]' : 'bg-white border border-gray-100'
              }`}
              data-delay={i * 120}
            >
              {/* Card header */}
              <div className={`p-7 border-b ${pkg.featured ? 'border-white/10' : 'border-gray-100'}`}>
                <div className="flex items-start justify-between mb-5">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={pkg.featured ? { background: 'rgba(255,255,255,0.15)' } : { background: '#e8f0fe' }}
                  >
                    <Icon
                      name={pkg.icon as any}
                      size={24}
                      style={pkg.featured ? { color: 'white' } : { color: '#082567' }}
                    />
                  </div>
                  <span
                    className="text-[10px] font-bold tracking-[0.18em] px-3 py-1 rounded-full"
                    style={
                      pkg.featured
                        ? { background: 'rgba(255,255,255,0.15)', color: 'white' }
                        : { background: '#e8f0fe', color: '#082567' }
                    }
                  >
                    {pkg.tag}
                  </span>
                </div>
                <h3
                  className="text-[22px] font-extrabold mb-2"
                  style={{ color: pkg.featured ? 'white' : '#1B365D' }}
                >
                  {pkg.title}
                </h3>
                <p
                  className="text-[14px] leading-relaxed"
                  style={{ color: pkg.featured ? 'rgba(255,255,255,0.7)' : '#6B7280' }}
                >
                  {pkg.subtitle}
                </p>
              </div>

              {/* Features */}
              <div className="p-7 flex-1 flex flex-col gap-3">
                {pkg.features.map((feat) => (
                  <div key={feat} className="flex items-start gap-3">
                    <Icon
                      name="CheckIcon"
                      size={15}
                      style={{ color: '#0ea5e9' }}
                      className="flex-shrink-0 mt-0.5"
                    />
                    <span
                      className="text-[13px] leading-relaxed"
                      style={{ color: pkg.featured ? 'rgba(255,255,255,0.8)' : '#3D4454' }}
                    >
                      {feat}
                    </span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <div className={`px-7 pb-7 border-t pt-5 ${pkg.featured ? 'border-white/10' : 'border-gray-100'}`}>
                <Link
                  href="#iletisim"
                  className={`w-full py-3.5 text-[12px] font-bold tracking-widest rounded-2xl flex items-center justify-center gap-2 transition-all duration-200 ${
                    pkg.featured
                      ? 'bg-white text-[#1B365D] hover:bg-[#0ea5e9] hover:text-white'
                      : 'bg-[#1B365D] text-white hover:bg-[#0ea5e9]'
                  }`}
                >
                  <Icon name="EnvelopeIcon" size={14} />
                  TEKLİF AL
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}