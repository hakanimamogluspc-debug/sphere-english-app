import React from 'react';
import Image from 'next/image';

export default function MerveFounderQuoteSection() {
  return (
    <section className="py-16 sm:py-20 bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="bg-[#1B365D] rounded-3xl shadow-sm hover:shadow-md transition-shadow duration-300 p-6 sm:p-8 md:p-10 flex flex-col md:flex-row-reverse items-center gap-6 sm:gap-10">
          <div className="flex-shrink-0">
            <div className="w-32 sm:w-44 md:w-52 rounded-2xl overflow-hidden shadow-lg border-4 border-white/20" style={{aspectRatio: '3/4'}}>
              <Image
                src="/assets/images/WhatsApp_Image_2026-03-19_at_13.55.56-1773929304418.jpeg"
                alt="Merve Eş - Kurucu Ortak, Sphere English"
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
            <blockquote className="text-lg sm:text-xl md:text-2xl font-extrabold text-white leading-[1.45] mb-5">
              &ldquo;İş İngilizcesini sadece öğretmiyoruz; ekiplerin gerçek iş hayatında başarıyla iletişim kurmasını sağlıyoruz. Sphere English, her bireyin potansiyelini ortaya çıkaran kişiselleştirilmiş çözümler sunar.&rdquo;
            </blockquote>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#0ea5e9] flex items-center justify-center text-white font-bold text-sm shadow-md flex-shrink-0">M</div>
              <div>
                <p className="text-sm font-bold text-white">Merve Eş</p>
                <p className="text-xs text-[#0ea5e9] font-semibold">Kurucu Ortak</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
