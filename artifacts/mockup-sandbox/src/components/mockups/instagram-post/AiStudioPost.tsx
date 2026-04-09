import { useEffect } from "react";

const BRAND = {
  primary: "#1e3a6e",
  primaryLight: "#2a4f8f",
  accent: "#0ea5e9",
  accentLight: "#38bdf8",
  white: "#ffffff",
  offWhite: "#f0f6ff",
  muted: "rgba(255,255,255,0.55)",
  card: "rgba(255,255,255,0.07)",
  border: "rgba(255,255,255,0.12)",
};

function SparkleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .962 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.962 0z"/>
    </svg>
  );
}

function MicIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>
    </svg>
  );
}

function BriefcaseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
    </svg>
  );
}

function PenIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
    </svg>
  );
}

function BrainIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/><path d="M17.599 6.5a3 3 0 0 0 .399-1.375"/><path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"/><path d="M3.477 10.896a4 4 0 0 1 .585-.396"/><path d="M19.938 10.5a4 4 0 0 1 .585.396"/><path d="M6 18a4 4 0 0 1-1.967-.516"/><path d="M19.967 17.484A4 4 0 0 1 18 18"/>
    </svg>
  );
}

function GamepadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="6" x2="10" y1="12" y2="12"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="15" x2="15.01" y1="13" y2="13"/><line x1="18" x2="18.01" y1="11" y2="11"/><rect width="20" height="12" x="2" y="6" rx="2"/>
    </svg>
  );
}

const features = [
  { icon: <MicIcon />,      label: "Telaffuz Koçu",   desc: "AI ile gerçek zamanlı geri bildirim" },
  { icon: <PenIcon />,      label: "Yazma Koçu",       desc: "Akademik & iş yazışmaları" },
  { icon: <BrainIcon />,    label: "Dilbilgisi Koçu",  desc: "Akıllı dilbilgisi analizi" },
  { icon: <BriefcaseIcon />,label: "İş Senaryoları",   desc: "Gerçek iş simülasyonları" },
  { icon: <GamepadIcon />,  label: "Kelime Oyunu",     desc: "Oyunlaştırılmış kelime hazinesi" },
];

export default function AiStudioPost() {
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "preconnect";
    link.href = "https://fonts.googleapis.com";
    document.head.appendChild(link);
    const link2 = document.createElement("link");
    link2.rel = "stylesheet";
    link2.href = "https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap";
    document.head.appendChild(link2);
  }, []);

  return (
    <div style={{
      width: 1080,
      height: 1080,
      background: `linear-gradient(145deg, ${BRAND.primary} 0%, #162d58 50%, #0d1f3f 100%)`,
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      position: "relative",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
    }}>

      {/* ── Subtle grid overlay ── */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.03,
        backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
        backgroundSize: "60px 60px",
        pointerEvents: "none",
      }} />

      {/* ── Glow orbs ── */}
      <div style={{ position: "absolute", top: -120, right: -80, width: 480, height: 480, borderRadius: "50%", background: `radial-gradient(circle, ${BRAND.accent}22 0%, transparent 70%)`, pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: -100, left: -80, width: 360, height: 360, borderRadius: "50%", background: `radial-gradient(circle, ${BRAND.accentLight}18 0%, transparent 70%)`, pointerEvents: "none" }} />

      {/* ── TOP BAR ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "52px 64px 0" }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: `linear-gradient(135deg, ${BRAND.accent}, ${BRAND.accentLight})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 0 20px ${BRAND.accent}55`,
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="2"/>
              <circle cx="12" cy="12" r="4" fill="white"/>
            </svg>
          </div>
          <div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 18, color: BRAND.white, letterSpacing: "0.02em" }}>
              <span style={{ color: BRAND.white }}>SPHERE</span>
              <span style={{ color: BRAND.muted, fontWeight: 500 }}> ENGLISH</span>
            </div>
          </div>
        </div>

        {/* Badge */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          background: `linear-gradient(135deg, ${BRAND.accent}25, ${BRAND.accent}10)`,
          border: `1px solid ${BRAND.accent}50`,
          borderRadius: 100, padding: "8px 18px",
          backdropFilter: "blur(8px)",
        }}>
          <div style={{ color: BRAND.accentLight }}><SparkleIcon /></div>
          <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: 14, color: BRAND.accentLight, letterSpacing: "0.05em" }}>AI STUDIO</span>
        </div>
      </div>

      {/* ── HEADLINE ── */}
      <div style={{ padding: "52px 64px 0" }}>
        <div style={{
          display: "inline-block",
          background: `linear-gradient(90deg, ${BRAND.accent}30, transparent)`,
          borderLeft: `3px solid ${BRAND.accent}`,
          paddingLeft: 16, marginBottom: 16,
        }}>
          <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: 15, color: BRAND.accentLight, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Yapay Zeka ile İngilizce
          </span>
        </div>
        <h1 style={{
          fontFamily: "'Outfit', sans-serif",
          fontWeight: 900,
          fontSize: 72,
          lineHeight: 1.0,
          color: BRAND.white,
          margin: 0,
          letterSpacing: "-0.02em",
        }}>
          5 AI Araç.<br />
          <span style={{ color: BRAND.accentLight }}>1 Platform.</span>
        </h1>
        <p style={{
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontWeight: 400, fontSize: 20,
          color: BRAND.muted, margin: "20px 0 0",
          maxWidth: 480, lineHeight: 1.6,
        }}>
          İngilizceyi konuş, yaz, anla — yapay zekanın kişisel koçluğuyla.
        </p>
      </div>

      {/* ── FEATURE CARDS ── */}
      <div style={{ padding: "44px 64px 0", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, flex: 1 }}>
        {features.map((f, i) => (
          <div key={i} style={{
            background: i === 0
              ? `linear-gradient(135deg, ${BRAND.accent}28, ${BRAND.accent}10)`
              : BRAND.card,
            border: `1px solid ${i === 0 ? BRAND.accent + "60" : BRAND.border}`,
            borderRadius: 20,
            padding: "24px 22px",
            backdropFilter: "blur(12px)",
            position: "relative",
            overflow: "hidden",
            transition: "all 0.2s",
          }}>
            {i === 0 && (
              <div style={{
                position: "absolute", top: 0, right: 0,
                width: 80, height: 80,
                background: `radial-gradient(circle at top right, ${BRAND.accent}30, transparent 70%)`,
              }} />
            )}
            <div style={{
              width: 38, height: 38, borderRadius: 12,
              background: i === 0 ? `linear-gradient(135deg, ${BRAND.accent}, ${BRAND.accentLight})` : `rgba(255,255,255,0.1)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: i === 0 ? BRAND.white : BRAND.accentLight,
              marginBottom: 14,
              boxShadow: i === 0 ? `0 4px 16px ${BRAND.accent}50` : "none",
            }}>
              {f.icon}
            </div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 15, color: BRAND.white, marginBottom: 6 }}>{f.label}</div>
            <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400, fontSize: 12, color: BRAND.muted, lineHeight: 1.5 }}>{f.desc}</div>
          </div>
        ))}
      </div>

      {/* ── BOTTOM ── */}
      <div style={{ padding: "36px 64px 52px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {/* Stats */}
        <div style={{ display: "flex", gap: 36 }}>
          {[["12+", "Koç Karakteri"], ["5", "AI Modülü"], ["7/24", "Erişim"]].map(([val, lbl]) => (
            <div key={lbl}>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 28, color: BRAND.white }}>{val}</div>
              <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400, fontSize: 12, color: BRAND.muted }}>{lbl}</div>
            </div>
          ))}
        </div>

        {/* CTA pill */}
        <div style={{
          background: `linear-gradient(135deg, ${BRAND.accent}, ${BRAND.accentLight})`,
          borderRadius: 100, padding: "14px 32px",
          fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 16,
          color: BRAND.white, letterSpacing: "0.02em",
          boxShadow: `0 8px 32px ${BRAND.accent}60`,
        }}>
          sphereenglish.com
        </div>
      </div>
    </div>
  );
}
