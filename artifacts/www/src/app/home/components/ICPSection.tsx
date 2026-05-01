'use client';
import React, { useEffect, useRef } from 'react';
import Icon from '@/components/ui/AppIcon';

interface MethodItem {
  number: string;
  title: string;
  description: string;
  detail: string;
  icon: string;
}

const methodItems: MethodItem[] = [
  {
    number: '01',
    title: 'Oxford University Press Müfredatı',
    description: 'A1\'den C2\'ye kadar tüm seviyeleri kapsayan, uluslararası iş dünyasının standartlarını belirleyen Oxford eğitim seti.',
    detail: 'A1 · A2 · B1 · B2 · C1 · C2 Seviyeleri',
    icon: 'BookOpenIcon',
  },
  {
    number: '02',
    title: 'Zoom Entegreli Çevrimiçi Dersler',
    description: 'Birebir ve grup formatında, esnek takvimli canlı dersler.',
    detail: 'Birebir & Grup Formatları',
    icon: 'VideoCameraIcon',
  },
  {
    number: '03',
    title: 'Gerçek İş Hayatı Senaryoları',
    description: 'Sektörünüze özel vaka çalışmaları, rol yapma egzersizleri ve gerçek iş durumlarına dayalı pratik uygulamalar.',
    detail: 'Case Study Odaklı Yaklaşım',
    icon: 'BriefcaseIcon',
  },
  {
    number: '04',
    title: 'Kişiselleştirilmiş Öğrenme Yolu',
    description: 'Her çalışan için seviye tespiti ve bireysel gelişim planı. Şirketin hedefleriyle uyumlu öğrenme rotası.',
    detail: 'Bireysel Gelişim Planı',
    icon: 'MapIcon',
  },
];

export default function EgitimModeliSection() {
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
    <section id="egitim-modeli" className="py-20 lg:py-28 bg-gradient-to-br from-[#f0f4f8] to-white" ref={sectionRef}>
      <div className="max-w-5xl mx-auto px-6 lg:px-10">

        {/* Header */}
        <div className="text-center mb-14">
          <span className="inline-block text-[11px] font-bold tracking-[0.22em] text-[#0ea5e9] uppercase mb-4">
            EĞİTİM METODOLOJİSİ
          </span>
          <h2 className="text-[34px] lg:text-[46px] font-extrabold tracking-[-0.025em] text-[#1B365D] leading-[1.12] mb-4">
            Kanıtlanmış yöntemler,<br />
            <span className="text-[#0ea5e9]">ölçülebilir sonuçlar.</span>
          </h2>
          <p className="text-[15px] text-gray-500 leading-relaxed max-w-md mx-auto">
            Her adım, çalışanlarınızın iş performansını doğrudan artıracak şekilde tasarlandı.
          </p>
        </div>

        {/* Method grid — 2x2 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {methodItems.map((item, i) => (
            <div
              key={item.number}
              className="reveal-card bg-white border border-gray-100 rounded-3xl p-8 flex flex-col gap-5 shadow-sm hover:shadow-md transition-shadow duration-300"
              data-delay={i * 110}
            >
              <div className="flex items-start justify-between">
                <span
                  className="text-[52px] font-extrabold leading-none select-none"
                  style={{ color: 'rgba(14,165,233,0.15)' }}
                >
                  {item.number}
                </span>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-[#e8f0fe]">
                  <Icon name={item.icon as any} size={22} style={{ color: '#082567' }} />
                </div>
              </div>

              <div>
                <h3 className="text-[20px] font-extrabold text-[#1B365D] mb-3">
                  {item.title}
                </h3>
                <p className="text-[14px] text-gray-500 leading-relaxed">{item.description}</p>
              </div>

              <div className="mt-auto pt-4 border-t border-gray-100 flex items-center gap-2">
                <Icon name="CheckBadgeIcon" size={16} style={{ color: '#0ea5e9' }} />
                <span className="text-[12px] font-bold text-[#0ea5e9]">{item.detail}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}