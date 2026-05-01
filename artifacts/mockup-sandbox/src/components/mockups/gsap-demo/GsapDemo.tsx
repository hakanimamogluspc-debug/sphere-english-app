import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

const whyCards = [
  { icon: '🌐', title: 'Uluslararası İletişim', tag: 'Global Rekabet' },
  { icon: '📊', title: 'Toplantı & Sunum', tag: 'Profesyonel Gelişim' },
  { icon: '✉️', title: 'E-posta Yazımı', tag: 'Yazılı İletişim' },
  { icon: '📈', title: 'Ölçülebilir Sonuçlar', tag: 'Veri Odaklı' },
  { icon: '🏢', title: 'Kuruma Özel İçerik', tag: 'Kişiselleştirilmiş' },
  { icon: '🎓', title: 'Sertifikalı Eğitmenler', tag: 'Uzman Kadro' },
];

const metrics = [
  { prefix: '%', target: 87, label: 'Katılım Oranı', fill: 87 },
  { prefix: '+', target: 2.1, label: 'Seviye Artışı', fill: 84 },
  { prefix: '%', target: 94, label: 'Memnuniyet', fill: 94 },
];

const coaches = [
  { title: 'Telaffuz Koçu', desc: 'Sizi dinliyor, anında geri bildirim veriyor.', color: '#0ea5e9', bg: '#e8f4fd', icon: '🎤' },
  { title: 'Yazma Koçu', desc: 'Yazdığı İngilizceyi düzeltiyor, geliştiriyor.', color: '#6366f1', bg: '#ede9fe', icon: '✍️' },
];

type Phase = 'cards' | 'metrics' | 'coaches' | 'done';

export default function GsapDemo() {
  const cardsRef = useRef<HTMLDivElement>(null);
  const metricsRef = useRef<HTMLDivElement>(null);
  const coachesRef = useRef<HTMLDivElement>(null);
  const headingCardsRef = useRef<HTMLDivElement>(null);
  const headingMetricsRef = useRef<HTMLDivElement>(null);
  const headingCoachesRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>('cards');
  const [metricVals, setMetricVals] = useState([0, 0, 0]);
  const [barWidths, setBarWidths] = useState([0, 0, 0]);
  const [replay, setReplay] = useState(0);

  useEffect(() => {
    setPhase('cards');
    setMetricVals([0, 0, 0]);
    setBarWidths([0, 0, 0]);

    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

    // --- Phase 1: Cards (Neden Biz stagger) ---
    if (headingCardsRef.current) {
      tl.from(headingCardsRef.current, { y: 36, opacity: 0, duration: 0.6 });
    }
    const cardEls = cardsRef.current?.querySelectorAll('.demo-card');
    if (cardEls) {
      tl.from(cardEls, { y: 50, opacity: 0, duration: 0.55, stagger: 0.1 }, '-=0.2');
    }

    // --- Phase 2: Metrics ---
    tl.add(() => setPhase('metrics'), '+=0.3');
    if (headingMetricsRef.current) {
      tl.from(headingMetricsRef.current, { y: 36, opacity: 0, duration: 0.6 }, '+=0.1');
    }
    const metricEls = metricsRef.current?.querySelectorAll('.demo-metric');
    if (metricEls) {
      tl.from(metricEls, { y: 40, opacity: 0, duration: 0.55, stagger: 0.12 }, '-=0.2');
    }
    // Animate counters + bars
    tl.add(() => {
      metrics.forEach((m, i) => {
        const isDecimal = m.target % 1 !== 0;
        gsap.to({ val: 0 }, {
          val: m.target,
          duration: 1.5,
          ease: 'power2.out',
          delay: i * 0.12,
          onUpdate: function () {
            const v = isDecimal ? this.targets()[0].val.toFixed(1) : Math.round(this.targets()[0].val);
            setMetricVals(prev => { const next = [...prev]; next[i] = parseFloat(v as string); return next; });
          }
        });
        gsap.to({ w: 0 }, {
          w: m.fill,
          duration: 1.4,
          ease: 'power2.out',
          delay: i * 0.12 + 0.3,
          onUpdate: function () {
            setBarWidths(prev => { const next = [...prev]; next[i] = this.targets()[0].w; return next; });
          }
        });
      });
    });

    // --- Phase 3: AI Coaches ---
    tl.add(() => setPhase('coaches'), '+=1.8');
    if (headingCoachesRef.current) {
      tl.from(headingCoachesRef.current, { y: 36, opacity: 0, duration: 0.6 }, '+=0.1');
    }
    const coachEls = coachesRef.current?.querySelectorAll('.demo-coach');
    if (coachEls) {
      Array.from(coachEls).forEach((el, i) => {
        tl.from(el, {
          x: i % 2 === 0 ? -80 : 80,
          opacity: 0,
          duration: 0.75,
          ease: 'power3.out',
        }, i === 0 ? '-=0.1' : '-=0.5');
      });
    }

    tl.add(() => setPhase('done'), '+=0.5');

    return () => { tl.kill(); };
  }, [replay]);

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', background: '#f8fafc', minHeight: '100vh', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ background: '#1B365D', color: 'white', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: '0.2em', color: '#0ea5e9', fontWeight: 700, marginBottom: 4 }}>GSAP ANİMASYON ÖNİZLEMESİ</div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>www.sphereenglish.com Animasyon Demosu</div>
        </div>
        <button
          onClick={() => setReplay(r => r + 1)}
          style={{ background: '#0ea5e9', border: 'none', borderRadius: 12, padding: '8px 20px', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}
        >
          ▶ Tekrar Oynat
        </button>
      </div>

      <div style={{ padding: '32px', maxWidth: 1100, margin: '0 auto' }}>

        {/* === SECTION 1: Neden Biz Kartları === */}
        <div ref={headingCardsRef} style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', color: '#0ea5e9', marginBottom: 6 }}>BÖLÜM 1 — NEDEN BİZ</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#1B365D' }}>
            6 kart scroll'da <span style={{ color: '#0ea5e9' }}>stagger animasyonla</span> belirir
          </div>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Her kart 0.1s gecikmeli, aşağıdan yukarı — GSAP power3.out easing</div>
        </div>

        <div ref={cardsRef} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 48 }}>
          {whyCards.map((card) => (
            <div
              key={card.title}
              className="demo-card"
              style={{
                background: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: 20,
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ width: 44, height: 44, borderRadius: 14, background: '#e8f0fe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                  {card.icon}
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', padding: '4px 10px', borderRadius: 999, background: '#e0f2fe', color: '#0ea5e9' }}>
                  {card.tag}
                </span>
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#1B365D' }}>{card.title}</div>
            </div>
          ))}
        </div>

        {/* === SECTION 2: Sayaç + Progress Bars === */}
        {(phase === 'metrics' || phase === 'coaches' || phase === 'done') && (
          <>
            <div ref={headingMetricsRef} style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', color: '#0ea5e9', marginBottom: 6 }}>BÖLÜM 2 — RAPORLAMA</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#1B365D' }}>
                Sayaçlar <span style={{ color: '#0ea5e9' }}>0'dan sayar</span>, barlar dolar
              </div>
              <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>%87, +2.1, %94 — 1.5s animasyon, GSAP power2.out easing</div>
            </div>

            <div ref={metricsRef} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 48 }}>
              {metrics.map((m, i) => (
                <div
                  key={m.label}
                  className="demo-metric"
                  style={{
                    background: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: 20,
                    padding: '28px 24px',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                  }}
                >
                  <div style={{ fontSize: 44, fontWeight: 900, color: '#1B365D', lineHeight: 1, marginBottom: 4 }}>
                    {m.prefix}{m.target % 1 !== 0 ? metricVals[i].toFixed(1) : Math.round(metricVals[i])}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1B365D', marginBottom: 8 }}>{m.label}</div>
                  <div style={{ height: 6, background: '#e2e8f0', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${barWidths[i]}%`,
                      background: '#0ea5e9',
                      borderRadius: 999,
                      transition: 'width 0.05s linear'
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* === SECTION 3: AI Koçlar === */}
        {(phase === 'coaches' || phase === 'done') && (
          <>
            <div ref={headingCoachesRef} style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', color: '#0ea5e9', marginBottom: 6 }}>BÖLÜM 3 — AI KOÇLAR</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#1B365D' }}>
                Sol kart <span style={{ color: '#0ea5e9' }}>soldan</span>, sağ kart <span style={{ color: '#6366f1' }}>sağdan</span> kayar
              </div>
              <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Alternating x: ±80px slide-in — GSAP power3.out easing</div>
            </div>

            <div ref={coachesRef} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 32 }}>
              {coaches.map((c) => (
                <div
                  key={c.title}
                  className="demo-coach"
                  style={{
                    background: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: 20,
                    overflow: 'hidden',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                  }}
                >
                  <div style={{ height: 4, background: c.color }} />
                  <div style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                      <div style={{ width: 48, height: 48, borderRadius: 14, background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                        {c.icon}
                      </div>
                      <div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#1B365D' }}>{c.title}</div>
                        <div style={{ fontSize: 12, color: c.color, fontWeight: 600 }}>{c.desc}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
                      {['Gerçek zamanlı analiz', 'Anında geri bildirim', 'AI destekli'].map(f => (
                        <span key={f} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 999, background: c.bg, color: c.color, fontWeight: 600 }}>{f}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {phase === 'done' && (
          <div style={{ textAlign: 'center', padding: '20px', background: 'white', borderRadius: 20, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1B365D', marginBottom: 8 }}>✅ Tüm animasyonlar bu şekilde çalışıyor</div>
            <div style={{ fontSize: 13, color: '#64748b' }}>Gerçek sitede bu animasyonlar scroll ile tetiklenecek. Onayladıysanız GitHub'a push edebiliriz.</div>
            <button
              onClick={() => setReplay(r => r + 1)}
              style={{ marginTop: 12, background: '#1B365D', border: 'none', borderRadius: 12, padding: '10px 24px', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}
            >
              ▶ Baştan İzle
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
