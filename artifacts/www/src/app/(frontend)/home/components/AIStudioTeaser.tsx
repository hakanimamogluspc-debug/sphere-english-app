'use client';
import React, { useRef, useEffect } from 'react';
import Link from 'next/link';

const NAVY = '#1B365D';
const TURQUOISE = '#0ea5e9';

const TOOLS = [
  { icon: '🎙️', label: 'Telaffuz Koçu' },
  { icon: '✍️', label: 'Yazma Koçu' },
  { icon: '🧠', label: 'Dilbilgisi Koçu' },
  { icon: '🎮', label: 'Kelime Oyunu' },
  { icon: '💼', label: 'İş Senaryoları' },
  { icon: '🤝', label: 'Mülakat Simülatörü' },
  { icon: '🎤', label: 'Sunum Simülatörü' },
  { icon: '⚡', label: 'Akıllı Quiz Üretici' },
  { icon: '🎓', label: 'Kişisel AI Öğretmen' },
  { icon: '🗺️', label: 'Adaptif Öğrenme Yolu' },
];

export default function AIStudioTeaser() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('aist-visible');
          obs.disconnect();
        }
      },
      { threshold: 0.08 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section
      className="py-24 lg:py-32 relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #0f1f3d 0%, #1e3a6e 55%, #1a4a8a 100%)' }}
    >
      {/* grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.055]"
        style={{
          backgroundImage:
            'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)',
          backgroundSize: '52px 52px',
        }}
      />
      {/* glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] rounded-full opacity-20 blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, #0ea5e9 0%, transparent 70%)' }}
      />

      <style>{`
        .aist-inner {
          opacity: 0;
          transform: translateY(32px);
          transition: opacity 0.65s ease, transform 0.65s ease;
        }
        .aist-visible .aist-inner {
          opacity: 1;
          transform: translateY(0);
        }
      `}</style>

      <div ref={ref} className="max-w-5xl mx-auto px-6 lg:px-10 relative z-10">
        <div className="aist-inner">
          {/* eyebrow */}
          <div className="flex justify-center mb-6">
            <span
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[11px] font-bold tracking-[0.2em] uppercase border"
              style={{ color: TURQUOISE, borderColor: '#0ea5e933', background: '#0ea5e910' }}
            >
              ✦ AI STUDIO
            </span>
          </div>

          {/* heading */}
          <h2
            className="text-center text-4xl lg:text-5xl font-black text-white mb-5 leading-[1.1]"
            style={{ fontFamily: "'Outfit', sans-serif", letterSpacing: '-0.02em' }}
          >
            İngilizce öğrenmenin
            <br />
            <span style={{ color: TURQUOISE }}>en akıllı yolu.</span>
          </h2>

          {/* sub */}
          <p className="text-center text-white/60 text-[16px] leading-relaxed max-w-xl mx-auto mb-12">
            Telaffuz koçundan iş senaryolarına, mülakat & sunum simülatöründen kişisel AI öğretmene — 10 güçlü yapay
            zeka aracı tek platformda. 7/24 aktif, sınırsız pratik.
          </p>

          {/* tool pills */}
          <div className="flex flex-wrap justify-center gap-3 mb-12">
            {TOOLS.map((t) => (
              <span
                key={t.label}
                className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-semibold border border-white/10 text-white/80"
                style={{ background: 'rgba(255,255,255,0.07)' }}
              >
                <span>{t.icon}</span>
                <span>{t.label}</span>
              </span>
            ))}
          </div>

          {/* stats row */}
          <div className="flex flex-wrap justify-center gap-10 mb-14">
            {[
              { value: '10', label: 'Yapay Zeka Aracı' },
              { value: '7/24', label: 'Erişim' },
              { value: '11', label: 'AI Koç & Aksan' },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <div
                  className="text-3xl font-black text-white mb-1"
                  style={{ fontFamily: "'Outfit', sans-serif" }}
                >
                  {s.value}
                </div>
                <div className="text-[12px] text-white/45 uppercase tracking-widest">{s.label}</div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/ai-studio"
              className="inline-flex items-center gap-2 rounded-2xl px-8 py-4 font-bold text-white text-[15px] hover:opacity-90 transition-all duration-200"
              style={{
                background: `linear-gradient(135deg, ${TURQUOISE}, #0284c7)`,
                boxShadow: `0 8px 32px ${TURQUOISE}44`,
              }}
            >
              AI Studio&apos;yu Keşfet
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-4 h-4"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
            <a
              href="https://app.sphereenglish.com/register"
              className="inline-flex items-center gap-2 rounded-2xl px-8 py-4 font-semibold text-white/70 text-[15px] hover:text-white transition-colors duration-200 border border-white/15 hover:border-white/30"
            >
              Ücretsiz Kaydol
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
