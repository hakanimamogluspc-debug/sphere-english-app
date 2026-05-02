'use client';
import React, { useEffect, useRef } from 'react';
import Icon from '@/components/ui/AppIcon';

interface Metric {
  prefix: string;
  numericValue: number;
  suffix: string;
  label: string;
  sub: string;
  fill: number;
}

const metrics: Metric[] = [
  { prefix: '%', numericValue: 87, suffix: '', label: 'Katılım Oranı', sub: 'Ortalama ders devam yüzdesi', fill: 87 },
  { prefix: '+', numericValue: 2.1, suffix: '', label: 'Seviye Artışı', sub: 'Ortalama CEFR seviye gelişimi', fill: 84 },
  { prefix: '%', numericValue: 94, suffix: '', label: 'Memnuniyet', sub: 'Kurumsal müşteri memnuniyeti', fill: 94 },
];

const dashboardFeatures = [
  {
    icon: 'ChartBarIcon',
    title: 'Aylık Gelişim Raporları',
    description: 'Her çalışan için detaylı ilerleme raporu. Seviye değişimleri, güçlü ve geliştirilmesi gereken alanlar.',
  },
  {
    icon: 'ClipboardDocumentCheckIcon',
    title: 'Katılım Takibi',
    description: 'Ders devam oranları, tamamlanan modüller ve ödev teslim istatistikleri anlık olarak izlenir.',
  },
  {
    icon: 'TrophyIcon',
    title: 'Performans Değerlendirmesi',
    description: 'Dönemsel sınavlar ve konuşma değerlendirmeleriyle çalışan gelişimini somut verilerle ölçün.',
  },
  {
    icon: 'DocumentChartBarIcon',
    title: 'Yönetici Paneli',
    description: 'İK ve yöneticiler için özet dashboard. Tüm ekibin eğitim durumunu tek ekranda görün.',
  },
];

export default function RaporlamaSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  const metricsRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const mockupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let ctx: any;
    (async () => {
      const gsap = (await import('gsap')).default;
      const { ScrollTrigger } = await import('gsap/ScrollTrigger');
      gsap.registerPlugin(ScrollTrigger);

      ctx = gsap.context(() => {
        gsap.from(headingRef.current, {
          y: 36,
          opacity: 0,
          duration: 0.8,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: headingRef.current,
            start: 'top 85%',
            once: true,
          },
        });

        const metricCards = metricsRef.current?.querySelectorAll('.metric-card');
        const bars = metricsRef.current?.querySelectorAll('.progress-bar-inner');
        const counters = metricsRef.current?.querySelectorAll('.metric-value');

        if (metricCards && metricCards.length > 0) {
          gsap.from(metricCards, {
            y: 50,
            opacity: 0,
            duration: 0.7,
            ease: 'power3.out',
            stagger: 0.12,
            scrollTrigger: {
              trigger: metricsRef.current,
              start: 'top 80%',
              once: true,
              onEnter: () => {
                bars?.forEach((bar) => {
                  const el = bar as HTMLElement;
                  const fill = parseFloat(el.dataset.fill || '0');
                  gsap.to(el, {
                    width: `${fill}%`,
                    duration: 1.4,
                    ease: 'power2.out',
                    delay: 0.3,
                  });
                });

                counters?.forEach((counter, i) => {
                  const el = counter as HTMLElement;
                  const target = parseFloat(el.dataset.target || '0');
                  const prefix = el.dataset.prefix || '';
                  const isDecimal = target % 1 !== 0;
                  const obj = { val: 0 };
                  gsap.to(obj, {
                    val: target,
                    duration: 1.6,
                    delay: i * 0.12 + 0.2,
                    ease: 'power2.out',
                    onUpdate: () => {
                      el.textContent = prefix + (isDecimal ? obj.val.toFixed(1) : Math.round(obj.val).toString());
                    },
                  });
                });
              },
            },
          });
        }

        const featureCards = featuresRef.current?.querySelectorAll('.feature-card');
        if (featureCards && featureCards.length > 0) {
          gsap.from(featureCards, {
            y: 40,
            opacity: 0,
            duration: 0.65,
            ease: 'power3.out',
            stagger: 0.09,
            scrollTrigger: {
              trigger: featuresRef.current,
              start: 'top 82%',
              once: true,
            },
          });
        }

        gsap.from(mockupRef.current, {
          y: 50,
          opacity: 0,
          duration: 0.9,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: mockupRef.current,
            start: 'top 85%',
            once: true,
          },
        });
      }, sectionRef);
    })();

    return () => ctx?.revert();
  }, []);

  return (
    <section id="raporlama" className="py-20 lg:py-28 bg-gradient-to-br from-[#f0f4f8] to-white" ref={sectionRef}>
      <div className="max-w-5xl mx-auto px-6 lg:px-10">

        <div className="text-center mb-14" ref={headingRef}>
          <span className="inline-block text-[11px] font-bold tracking-[0.22em] text-[#0ea5e9] uppercase mb-4">
            RAPORLAMA & TAKİP
          </span>
          <h2 className="text-[34px] lg:text-[46px] font-extrabold tracking-[-0.025em] text-[#1B365D] leading-[1.12] mb-4">
            Eğitimin değerini<br />
            <span className="text-[#0ea5e9]">verilerle kanıtlayın.</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10" ref={metricsRef}>
          {metrics.map((m) => (
            <div
              key={m.label}
              className="metric-card bg-white border border-gray-100 rounded-3xl p-8 shadow-sm hover:shadow-md transition-shadow duration-300"
            >
              <p className="text-[44px] font-extrabold leading-none mb-1 text-[#1B365D]">
                <span
                  className="metric-value"
                  data-target={m.numericValue}
                  data-prefix={m.prefix}
                >
                  {m.prefix}0
                </span>
              </p>
              <p className="text-[13px] font-bold text-[#1B365D] mb-1">{m.label}</p>
              <p className="text-[12px] text-gray-400 mb-5">{m.sub}</p>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="progress-bar-inner h-full rounded-full bg-[#0ea5e9]"
                  data-fill={m.fill}
                  style={{ width: '0%' }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10" ref={featuresRef}>
          {dashboardFeatures.map((feat) => (
            <div
              key={feat.title}
              className="feature-card bg-[#f8fafc] border border-gray-100 rounded-3xl p-6 flex flex-col gap-4 shadow-sm hover:shadow-md transition-shadow duration-300"
            >
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-[#e8f0fe]">
                <Icon name={feat.icon as any} size={20} style={{ color: '#082567' }} />
              </div>
              <div>
                <h3 className="text-[15px] font-extrabold text-[#1B365D] mb-2">
                  {feat.title}
                </h3>
                <p className="text-[13px] text-gray-500 leading-relaxed">{feat.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div
          className="rounded-3xl border border-gray-100 overflow-hidden shadow-sm"
          ref={mockupRef}
          style={{ background: '#f8fafc' }}
        >
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-[#1B365D] rounded-t-3xl overflow-hidden">
            <div className="w-2.5 h-2.5 rounded-full bg-white/30 flex-shrink-0" />
            <div className="w-2.5 h-2.5 rounded-full bg-white/30 flex-shrink-0" />
            <div className="w-2.5 h-2.5 rounded-full bg-white/30 flex-shrink-0" />
            <span className="ml-2 text-[10px] sm:text-[11px] font-bold text-white/70 tracking-widest truncate">Sphere English — Yönetici Paneli</span>
          </div>
          <div className="p-4 lg:p-10 grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
            {[
              { label: 'Aktif Çalışan', value: '24', icon: 'UserGroupIcon' },
              { label: 'Bu Ay Ders', value: '96', icon: 'CalendarDaysIcon' },
              { label: 'Ort. Devam', value: '%89', icon: 'ChartBarIcon' },
              { label: 'Tamamlanan Modül', value: '312', icon: 'CheckCircleIcon' },
            ].map((stat) => (
              <div key={stat.label} className="bg-white border border-gray-100 rounded-2xl p-3 sm:p-4 flex flex-col gap-2 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] sm:text-[11px] font-bold tracking-widest text-gray-400 leading-tight">{stat.label}</span>
                  <Icon name={stat.icon as any} size={14} style={{ color: '#082567' }} />
                </div>
                <p className="text-[22px] sm:text-[28px] font-extrabold leading-none text-[#1B365D]">
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
          <div className="px-4 lg:px-10 pb-6 lg:pb-8 grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-4">
            {['Ahmet Y. — B1 → B2 (+1 seviye)', 'Zeynep K. — A2 → B1 (+1 seviye)', 'Mert D. — B2 → C1 (+1 seviye)'].map((emp) => (
              <div key={emp} className="bg-white border border-gray-100 rounded-2xl px-3 sm:px-4 py-3 flex items-center gap-3 shadow-sm">
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-[#e8f0fe]">
                  <Icon name="UserIcon" size={14} style={{ color: '#082567' }} />
                </div>
                <span className="text-[12px] sm:text-[13px] font-medium text-[#1B365D] break-words min-w-0">{emp}</span>
                <Icon name="ArrowTrendingUpIcon" size={14} style={{ color: '#0ea5e9' }} className="ml-auto flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
