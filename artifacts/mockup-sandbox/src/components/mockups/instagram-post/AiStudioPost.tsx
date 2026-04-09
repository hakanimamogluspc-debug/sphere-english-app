import { useEffect } from "react";

const BRAND = {
  primary: "#1e3a6e",
  primaryLight: "#2a4f8f",
  accent: "#0ea5e9",
  accentLight: "#38bdf8",
  white: "#ffffff",
  muted: "rgba(255,255,255,0.55)",
  cardBase: "rgba(255,255,255,0.06)",
  cardHighlight: "rgba(14,165,233,0.15)",
  border: "rgba(255,255,255,0.10)",
  borderAccent: "rgba(14,165,233,0.45)",
};

function SparkleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .962 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.962 0z"/>
    </svg>
  );
}

const features = [
  {
    emoji: "🎙️",
    label: "Telaffuz Koçu",
    tag: "Pronunciation Coach",
    desc: "Sesin gerçek zamanlı analiz edilir. Intonation, vurgu ve aksan hataları anında düzeltilir. IPA tabanlı geri bildirimle konuşman her günde netleşir.",
    highlight: true,
  },
  {
    emoji: "✍️",
    label: "Yazma Koçu",
    tag: "Writing Coach",
    desc: "E-posta, rapor, akademik metin ve iş yazışmalarını AI ile geliştir. Dilbilgisi, ton ve bağlam analizi birlikte sunulur.",
    highlight: false,
  },
  {
    emoji: "🧠",
    label: "Dilbilgisi Koçu",
    tag: "Grammar Coach",
    desc: "Tenses, conditionals, passive voice — her dilbilgisi konusu için kişiselleştirilmiş alıştırmalar ve açıklamalar. Hataları öğrene dönüştürür.",
    highlight: false,
  },
  {
    emoji: "💼",
    label: "İş Senaryoları",
    tag: "Business Simulations",
    desc: "Gerçek iş toplantıları, sunum ortamları ve müzakere senaryoları. AI karşı tarafı oynar, sen pratik yaparsın. Kurumsal İngilizce için.",
    highlight: false,
  },
  {
    emoji: "🎮",
    label: "Kelime Oyunu",
    tag: "Vocabulary Game",
    desc: "Seviyene göre adaptif kelime kartları, yarışmalı skor tablosu ve görsel öğrenme. Eğlenceli, bağımlılık yapan, kalıcı kelime öğrenimi.",
    highlight: false,
  },
];

export default function AiStudioPost() {
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap";
    document.head.appendChild(link);
  }, []);

  return (
    <div style={{
      width: 1080,
      height: 1080,
      background: `linear-gradient(150deg, #162d58 0%, ${BRAND.primary} 40%, #0d1f3f 100%)`,
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      position: "relative",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
    }}>

      {/* Grid overlay */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.025,
        backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)",
        backgroundSize: "54px 54px",
        pointerEvents: "none",
      }} />

      {/* Glow top-right */}
      <div style={{
        position: "absolute", top: -160, right: -120,
        width: 520, height: 520, borderRadius: "50%",
        background: `radial-gradient(circle, ${BRAND.accent}28 0%, transparent 68%)`,
        pointerEvents: "none",
      }} />

      {/* Glow bottom-left */}
      <div style={{
        position: "absolute", bottom: -80, left: -60,
        width: 300, height: 300, borderRadius: "50%",
        background: `radial-gradient(circle, ${BRAND.accentLight}14 0%, transparent 70%)`,
        pointerEvents: "none",
      }} />

      {/* ── TOP BAR ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "48px 60px 0" }}>
        {/* Real logo — white via filter (same as app sidebar) */}
        <img
          src="/images/logo-full.png"
          alt="Sphere English"
          style={{ height: 32, width: "auto", filter: "brightness(0) invert(1)", objectFit: "contain" }}
        />

        {/* AI Studio badge */}
        <div style={{
          display: "flex", alignItems: "center", gap: 7,
          background: `linear-gradient(135deg, ${BRAND.accent}30, ${BRAND.accent}12)`,
          border: `1px solid ${BRAND.accent}55`,
          borderRadius: 100, padding: "7px 18px",
        }}>
          <div style={{ color: BRAND.accentLight }}><SparkleIcon /></div>
          <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 13, color: BRAND.accentLight, letterSpacing: "0.07em" }}>
            AI STUDIO
          </span>
        </div>
      </div>

      {/* ── HEADLINE ── */}
      <div style={{ padding: "36px 60px 0" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 10,
          borderLeft: `3px solid ${BRAND.accent}`,
          paddingLeft: 14, marginBottom: 14,
        }}>
          <span style={{
            fontFamily: "'Outfit', sans-serif", fontWeight: 600,
            fontSize: 13, color: BRAND.accentLight, letterSpacing: "0.1em", textTransform: "uppercase",
          }}>
            Yapay Zeka ile İngilizce Öğren
          </span>
        </div>
        <h1 style={{
          fontFamily: "'Outfit', sans-serif", fontWeight: 900,
          fontSize: 64, lineHeight: 1.0, color: BRAND.white,
          margin: 0, letterSpacing: "-0.025em",
        }}>
          5 Akıllı Koç.<br />
          <span style={{ color: BRAND.accentLight }}>Sınırsız Pratik.</span>
        </h1>
        <p style={{
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontWeight: 400, fontSize: 17, color: BRAND.muted,
          margin: "14px 0 0", lineHeight: 1.55,
        }}>
          Konuş, yaz, dinle, analiz et — her beceri için ayrı bir AI koç.
        </p>
      </div>

      {/* ── FEATURE CARDS ── */}
      <div style={{ padding: "28px 60px 0", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, flex: 1 }}>
        {features.map((f, i) => (
          <div key={i} style={{
            background: f.highlight ? BRAND.cardHighlight : BRAND.cardBase,
            border: `1px solid ${f.highlight ? BRAND.borderAccent : BRAND.border}`,
            borderRadius: 18,
            padding: "20px 18px",
            position: "relative",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}>
            {f.highlight && (
              <div style={{
                position: "absolute", top: 0, right: 0,
                width: 90, height: 90,
                background: `radial-gradient(circle at top right, ${BRAND.accent}35, transparent 70%)`,
              }} />
            )}

            {/* Emoji icon */}
            <div style={{ fontSize: 22, lineHeight: 1 }}>{f.emoji}</div>

            {/* Labels */}
            <div>
              <div style={{
                fontFamily: "'Outfit', sans-serif", fontWeight: 700,
                fontSize: 15, color: BRAND.white, marginBottom: 2,
              }}>{f.label}</div>
              <div style={{
                fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 500,
                fontSize: 10, color: BRAND.accentLight, letterSpacing: "0.05em", textTransform: "uppercase",
              }}>{f.tag}</div>
            </div>

            {/* Description */}
            <div style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontWeight: 400, fontSize: 11.5,
              color: "rgba(255,255,255,0.62)", lineHeight: 1.6,
              flex: 1,
            }}>
              {f.desc}
            </div>
          </div>
        ))}
      </div>

      {/* ── BOTTOM BAR ── */}
      <div style={{ padding: "24px 60px 48px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {/* Stats */}
        <div style={{ display: "flex", gap: 32 }}>
          {[["12+", "Koç Karakteri"], ["5", "AI Modülü"], ["7/24", "Erişim"]].map(([val, lbl]) => (
            <div key={lbl} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 26, color: BRAND.white, lineHeight: 1 }}>{val}</span>
              <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400, fontSize: 11, color: BRAND.muted }}>{lbl}</span>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div style={{ height: 36, width: 1, background: BRAND.border }} />

        {/* CTA */}
        <div style={{
          background: `linear-gradient(135deg, ${BRAND.accent}, ${BRAND.accentLight})`,
          borderRadius: 100, padding: "13px 30px",
          fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 15,
          color: BRAND.white, letterSpacing: "0.01em",
          boxShadow: `0 6px 28px ${BRAND.accent}55`,
        }}>
          sphereenglish.com
        </div>
      </div>
    </div>
  );
}
