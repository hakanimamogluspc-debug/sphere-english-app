'use client';
import React, { useEffect, useRef } from 'react';
import Image from 'next/image';

export default function FounderQuoteSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const quoteRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let ctx: any;
    (async () => {
      const gsap = (await import('gsap')).default;
      const { ScrollTrigger } = await import('gsap/ScrollTrigger');
      gsap.registerPlugin(ScrollTrigger);

      ctx = gsap.context(() => {
        gsap.from(cardRef.current, {
          y: 60,
          opacity: 0,
          duration: 0.95,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: cardRef.current,
            start: 'top 82%',
            once: true,
          },
        });

        gsap.from(quoteRef.current, {
          opacity: 0,
          y: 20,
          duration: 0.8,
          ease: 'power2.out',
          delay: 0.3,
          scrollTrigger: {
            trigger: cardRef.current,
            start: 'top 82%',
            once: true,
          },
        });
      }, sectionRef);
    })();

    return () => ctx?.revert();
  }, []);

  return (
    <section className="py-16 sm:py-20 bg-gradient-to-br from-[#f0f4f8] to-white" ref={sectionRef}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div
          ref={cardRef}
          className="bg-white border border-gray-100 rounded-3xl shadow-sm hover:shadow-md transition-shadow duration-300 p-6 sm:p-8 md:p-10 flex flex-col md:flex-row items-center gap-6 sm:gap-10"
        >
          <div className="flex-shrink-0">
            <div className="w-32 sm:w-44 md:w-52 rounded-2xl overflow-hidden shadow-lg border-4 border-white" style={{aspectRatio: '3/4'}}>
              <Image
                src="/assets/images/WhatsApp_Image_2026-03-19_at_13.55.36-1773919883509.jpeg"
                alt="Didem İmamoğlu - Kurucu Ortak, Sphere English"
                width={208}
                height={277}
                className="object-cover object-top w-full h-full"
              />
            </div>
          </div>
          <div className="flex flex-col items-start">
            <span className="inline-block text-[11px] font-bold tracking-[0.22em] text-[#0ea5e9] uppercase mb-4">
              Kurucu Görüşü
            </span>
            <blockquote
              ref={quoteRef}
              className="text-lg sm:text-xl md:text-2xl font-extrabold text-[#1B365D] leading-[1.45] mb-5"
            >
              &ldquo;Sphere English&apos;i kurduk çünkü her profesyonelin iş İngilizcesinde kendine güvenle iletişim kurmayı hak ettiğine inanıyoruz. Amacımız, ekiplerin ve bireylerin iş dünyasında etkin ve akıcı İngilizce konuşmasını sağlamak.&rdquo;
            </blockquote>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#1B365D] flex items-center justify-center text-white font-bold text-sm shadow-md flex-shrink-0">D</div>
              <div>
                <p className="text-sm font-bold text-[#1B365D]">Didem İmamoğlu</p>
                <p className="text-xs text-[#0ea5e9] font-semibold">Kurucu Ortak</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
