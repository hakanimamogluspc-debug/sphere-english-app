import React, { useRef, useEffect } from 'react';

const TURQUOISE = '#0ea5e9';

const TOOLS = [
  { icon: '🎙️', label: 'Telaffuz Koçu' },
  { icon: '✍️', label: 'Yazma Koçu' },
  { icon: '🧠', label: 'Dilbilgisi Koçu' },
  { icon: '🎮', label: 'Kelime Oyunu' },
  { icon: '💼', label: 'İş Senaryoları' },
];

export default function AIStudioTeaser() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setTimeout(() => el.classList.add('aist-visible'), 300);
  }, []);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f1f3d 0%, #1e3a6e 55%, #1a4a8a 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Outfit', sans-serif",
        padding: '64px 24px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* grid overlay */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.055,
        backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)',
        backgroundSize: '52px 52px',
        pointerEvents: 'none',
      }} />
      {/* glow */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        width: 700, height: 400,
        borderRadius: '50%', opacity: 0.18,
        background: 'radial-gradient(circle, #0ea5e9 0%, transparent 70%)',
        filter: 'blur(60px)',
        pointerEvents: 'none',
      }} />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800;900&display=swap');
        .aist-inner { opacity: 0; transform: translateY(28px); transition: opacity 0.65s ease, transform 0.65s ease; }
        .aist-visible .aist-inner { opacity: 1; transform: translateY(0); }
      `}</style>

      <div ref={ref} style={{ maxWidth: 900, width: '100%', position: 'relative', zIndex: 10 }}>
        <div className="aist-inner" style={{ textAlign: 'center' }}>

          {/* eyebrow */}
          <div style={{ marginBottom: 24 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              borderRadius: 99, padding: '8px 18px',
              fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase',
              color: TURQUOISE, border: '1px solid #0ea5e933', background: '#0ea5e910',
            }}>
              ✦ AI STUDIO
            </span>
          </div>

          {/* heading */}
          <h2 style={{
            fontSize: 'clamp(36px, 5vw, 56px)', fontWeight: 900, color: '#fff',
            lineHeight: 1.1, letterSpacing: '-0.02em', marginBottom: 20,
          }}>
            İngilizce öğrenmenin<br />
            <span style={{ color: TURQUOISE }}>en akıllı yolu.</span>
          </h2>

          {/* sub */}
          <p style={{
            fontSize: 16, color: 'rgba(255,255,255,0.6)', lineHeight: 1.7,
            maxWidth: 560, margin: '0 auto 48px',
          }}>
            Telaffuz koçundan iş senaryolarına, kelime oyunundan yazma analizine — 5 güçlü yapay
            zeka aracı tek platformda. 7/24 aktif, sınırsız pratik.
          </p>

          {/* tool pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginBottom: 48 }}>
            {TOOLS.map((t) => (
              <span key={t.label} style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                borderRadius: 99, padding: '10px 18px',
                fontSize: 13, fontWeight: 600,
                color: 'rgba(255,255,255,0.85)',
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}>
                {t.icon} {t.label}
              </span>
            ))}
          </div>

          {/* stats */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 60, marginBottom: 56 }}>
            {[
              { value: '5', label: 'Yapay Zeka Aracı' },
              { value: '7/24', label: 'Erişim' },
              { value: '11', label: 'AI Koç & Aksan' },
            ].map((s) => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 34, fontWeight: 900, color: '#fff', marginBottom: 4 }}>{s.value}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* CTAs */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
            <a
              href="https://www.sphereenglish.com/ai-studio"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                borderRadius: 16, padding: '16px 32px',
                fontWeight: 700, color: '#fff', fontSize: 15,
                background: `linear-gradient(135deg, ${TURQUOISE}, #0284c7)`,
                boxShadow: `0 8px 32px ${TURQUOISE}44`,
                textDecoration: 'none',
                transition: 'opacity 0.2s',
              }}
            >
              AI Studio'yu Keşfet
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width={16} height={16}>
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </a>
            <a
              href="https://app.sphereenglish.com/register"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                borderRadius: 16, padding: '16px 32px',
                fontWeight: 600, color: 'rgba(255,255,255,0.7)', fontSize: 15,
                border: '1px solid rgba(255,255,255,0.15)',
                textDecoration: 'none',
              }}
            >
              Ücretsiz Kaydol
            </a>
          </div>

        </div>
      </div>
    </div>
  );
}
