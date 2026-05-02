'use client';
import React from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';

const steps = [
  {
    number: '01',
    title: 'Ücretsiz Demo Randevusu',
    description: 'İhtiyaçlarınızı anlamak için 30 dakikalık ücretsiz görüşme planlayın.',
    icon: '📅',
  },
  {
    number: '02',
    title: 'Seviye Tespiti',
    description: 'Oxford standartlarında seviye testi ile başlangıç noktanızı belirleyin.',
    icon: '📊',
  },
  {
    number: '03',
    title: 'Kişiselleştirilmiş Program',
    description: 'Hedeflerinize ve sektörünüze özel müfredat hazırlanır.',
    icon: '📋',
  },
  {
    number: '04',
    title: 'Eğitmen Ataması',
    description: 'Alanında uzman, iş dünyası deneyimli eğitmeninizle tanışın.',
    icon: '👨‍🏫',
  },
  {
    number: '05',
    title: 'Dersler ve Takip',
    description: 'Zoom entegreli online dersler. Esnek saatler, kayıt imkanı.',
    icon: '💻',
  },
  {
    number: '06',
    title: 'Raporlama ve Sertifika',
    description: 'Aylık gelişim raporları. Program tamamlama sertifikası.',
    icon: '🏆',
  },
];

export default function NasilCalisirPage() {
  return (
    <div className="min-h-screen bg-white font-sans">
      <Header forceWhite />
      <main>
        {/* Hero Section */}
        <section className="pt-32 pb-12 sm:pb-16 bg-gradient-to-b from-[#f0f4f8] to-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
            <span className="inline-block text-[11px] font-bold tracking-[0.22em] text-[#0ea5e9] uppercase mb-4">
              Süreç
            </span>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#1B365D] mb-5 leading-tight">
              Nasıl Çalışır?
            </h1>
            <p className="text-base sm:text-lg text-gray-500 max-w-xl mx-auto leading-relaxed">
              Sphere English ile iş İngilizcenizi geliştirmek sadece 6 adım uzağınızda.
            </p>
          </div>
        </section>

        {/* Timeline Section */}
        <section className="py-16 md:py-24 bg-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <div className="relative">
              {/* Center vertical line */}
              <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-[#0ea5e9] via-[#1B365D] to-[#0ea5e9] -translate-x-1/2" />

              <div className="flex flex-col gap-12 md:gap-16">
                {steps.map((step, index) => {
                  const isLeft = index % 2 === 0;
                  return (
                    <div key={step.number} className="relative flex items-center">
                      {/* Desktop layout */}
                      <div className="hidden md:flex w-full items-center">
                        {/* Left side */}
                        <div className={`w-1/2 ${isLeft ? 'pr-12 flex justify-end' : 'pr-12'}`}>
                          {isLeft ? (
                            <TimelineCard step={step} />
                          ) : (
                            <div />
                          )}
                        </div>

                        {/* Center dot */}
                        <div className="absolute left-1/2 -translate-x-1/2 z-10 flex items-center justify-center">
                          <div className="w-5 h-5 rounded-full bg-[#0ea5e9] border-4 border-white shadow-lg shadow-[#0ea5e9]/30" />
                        </div>

                        {/* Right side */}
                        <div className={`w-1/2 ${!isLeft ? 'pl-12 flex justify-start' : 'pl-12'}`}>
                          {!isLeft ? (
                            <TimelineCard step={step} />
                          ) : (
                            <div />
                          )}
                        </div>
                      </div>

                      {/* Mobile layout */}
                      <div className="md:hidden flex items-start gap-3 sm:gap-4 w-full">
                        <div className="flex flex-col items-center pt-1">
                          <div className="w-4 h-4 rounded-full bg-[#0ea5e9] border-4 border-white shadow-md flex-shrink-0" />
                          {index < steps.length - 1 && (
                            <div className="w-0.5 bg-gradient-to-b from-[#0ea5e9] to-[#1B365D] flex-1 mt-1" style={{ minHeight: '80px' }} />
                          )}
                        </div>
                        <div className="flex-1 pb-4 min-w-0">
                          <TimelineCard step={step} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 sm:py-20 bg-gradient-to-br from-[#1B365D] to-[#082567]">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white mb-4">
              Hemen Başlayın
            </h2>
            <p className="text-blue-200 text-base sm:text-lg mb-8">
              Ücretsiz demo randevunuzu alın, farkı kendiniz görün.
            </p>
            <Link
              href="#iletisim"
              className="inline-block px-8 py-4 rounded-full bg-[#0ea5e9] text-white text-[13px] font-bold tracking-[0.18em] hover:bg-[#0284c7] transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              ÜCRETSİZ DEMO RANDEVUSU AL
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function TimelineCard({ step }: { step: { number: string; title: string; description: string; icon: string } }) {
  return (
    <div className="bg-[#f8fafc] rounded-2xl p-5 sm:p-6 md:p-8 shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200 w-full">
      <span className="block text-[13px] font-bold tracking-[0.2em] text-gray-400 mb-3">
        {step.number}
      </span>
      <h3 className="text-lg sm:text-xl md:text-2xl font-extrabold text-[#1B365D] mb-3 leading-snug">
        {step.title}
      </h3>
      <p className="text-gray-500 text-[14px] sm:text-[15px] leading-relaxed">
        {step.description}
      </p>
    </div>
  );
}
