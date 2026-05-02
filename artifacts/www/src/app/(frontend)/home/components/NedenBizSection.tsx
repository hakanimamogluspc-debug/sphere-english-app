'use client';
import React, { useEffect, useRef } from 'react';
import Icon from '@/components/ui/AppIcon';

interface WhyCard {
  icon: string;
  title: string;
  description: string;
  tag: string;
}

interface NedenBizProps {
  data?: {
    whyKicker?: string;
    whyTitle1?: string;
    whyTitle2?: string;
    whySubtitle?: string;
    whyCards?: WhyCard[];
  };
}

const DEFAULT_CARDS: WhyCard[] = [
  { icon: 'GlobeAltIcon', title: 'Uluslararası Müşteri İletişimi', description: 'Çalışanlarınız yabancı müşterilerle güvenle iletişim kurabilir, global iş fırsatlarını kaçırmaz.', tag: 'Global Rekabet' },
  { icon: 'PresentationChartBarIcon', title: 'Toplantı & Sunum Becerileri', description: 'Uluslararası toplantılarda etkili sunum yapma, fikir savunma ve müzakere yürütme yetkinliği.', tag: 'Profesyonel Gelişim' },
  { icon: 'EnvelopeOpenIcon', title: 'Profesyonel E-posta Yazımı', description: 'İş dünyasının standartlarına uygun, etkileyici ve net İngilizce yazışma becerisi kazandırın.', tag: 'Yazılı İletişim' },
  { icon: 'ChartBarSquareIcon', title: 'Ölçülebilir Sonuçlar', description: "Aylık gelişim raporları ve performans değerlendirmeleriyle eğitimin ROI'sini somut verilerle takip edin.", tag: 'Veri Odaklı' },
  { icon: 'BuildingOffice2Icon', title: 'Kuruma Özel İçerik', description: 'Sektörünüze ve şirketinizin ihtiyaçlarına göre özelleştirilmiş müfredat ve vaka çalışmaları.', tag: 'Kişiselleştirilmiş' },
  { icon: 'AcademicCapIcon', title: 'Sertifikalı Eğitmenler', description: 'CELTA/DELTA sertifikalı, iş dünyası deneyimli İngiliz ve Amerikan eğitmenlerle birebir çalışın.', tag: 'Uzman Kadro' },
];

export default function NedenBizSection({ data }: NedenBizProps = {}) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  const kicker = data?.whyKicker ?? 'NEDEN SPHERE ENGLISH?';
  const title1 = data?.whyTitle1 ?? 'Şirketinizi global arenada';
  const title2 = data?.whyTitle2 ?? 'rekabetçi kılan eğitim.';
  const subtitle = data?.whySubtitle ?? 'Sadece dil öğretmiyoruz. Çalışanlarınıza iş dünyasında fark yaratan iletişim gücü kazandırıyoruz.';
  const cards: WhyCard[] = (data?.whyCards && data.whyCards.length > 0) ? data.whyCards : DEFAULT_CARDS;

  useEffect(() => {
    let ctx: any;
    (async () => {
      const gsap = (await import('gsap')).default;
      const { ScrollTrigger } = await import('gsap/ScrollTrigger');
      gsap.registerPlugin(ScrollTrigger);

      ctx = gsap.context(() => {
        gsap.from(headingRef.current, {
          y: 40, opacity: 0, duration: 0.8, ease: 'power3.out',
          scrollTrigger: { trigger: headingRef.current, start: 'top 85%', once: true },
        });

        const cardEls = cardsRef.current?.querySelectorAll('.why-card');
        if (cardEls && cardEls.length > 0) {
          gsap.from(cardEls, {
            y: 50, opacity: 0, duration: 0.7, ease: 'power3.out', stagger: 0.1,
            scrollTrigger: { trigger: cardsRef.current, start: 'top 82%', once: true },
          });
        }
      }, sectionRef);
    })();
    return () => ctx?.revert();
  }, []);

  return (
    <section id="neden-biz" className="py-20 lg:py-28 bg-white" ref={sectionRef}>
      <div className="max-w-6xl mx-auto px-6 lg:px-10">
        <div className="text-center mb-14" ref={headingRef}>
          <span className="inline-block text-[11px] font-bold tracking-[0.22em] text-[#0ea5e9] uppercase mb-4">
            {kicker}
          </span>
          <h2 className="text-[34px] lg:text-[46px] font-extrabold tracking-[-0.025em] text-[#1B365D] leading-[1.12] mb-4">
            {title1}<br />
            <span className="text-[#0ea5e9]">{title2}</span>
          </h2>
          <p className="text-[15px] text-gray-500 leading-relaxed max-w-md mx-auto">{subtitle}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" ref={cardsRef}>
          {cards.map((card) => (
            <div
              key={card.title}
              className="why-card bg-[#f8fafc] border border-gray-100 rounded-3xl p-8 flex flex-col gap-5 shadow-sm hover:shadow-md transition-shadow duration-300 cursor-default"
            >
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-[#e8f0fe]">
                  <Icon name={card.icon as any} size={22} style={{ color: '#082567' }} />
                </div>
                <span className="text-[10px] font-bold tracking-[0.18em] px-3 py-1 rounded-full bg-[#0ea5e9]/10 text-[#0ea5e9]">
                  {card.tag}
                </span>
              </div>
              <div>
                <h3 className="text-[18px] font-extrabold text-[#1B365D] mb-2">{card.title}</h3>
                <p className="text-[14px] text-gray-500 leading-relaxed">{card.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
