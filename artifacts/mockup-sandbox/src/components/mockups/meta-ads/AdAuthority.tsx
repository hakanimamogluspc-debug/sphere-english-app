const S = 1080;
const scale = 0.5;
const D = S * scale;
const px = (n: number) => n * scale;

export default function AdAuthority() {
  return (
    <div style={{ width: D, height: D, position: "relative", overflow: "hidden", fontFamily: "'Outfit', sans-serif", background: "white" }}>

      {/* Left navy panel */}
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: px(480), background: "#1e3a6e" }} />

      {/* Diagonal cut */}
      <div style={{ position: "absolute", left: px(420), top: 0, bottom: 0, width: px(120), background: "#1e3a6e", clipPath: "polygon(0 0, 60% 0, 0% 100%, 0 100%)" }} />

      {/* Decorative dots pattern on navy */}
      <div style={{ position: "absolute", left: px(20), top: px(20), display: "grid", gridTemplateColumns: `repeat(8, ${px(16)}px)`, gap: px(12) }}>
        {Array.from({ length: 40 }).map((_, i) => (
          <div key={i} style={{ width: px(3), height: px(3), borderRadius: "50%", background: "rgba(255,255,255,0.12)" }} />
        ))}
      </div>

      {/* Left panel content */}
      {/* Logo */}
      <div style={{ position: "absolute", top: px(56), left: px(56), display: "flex", alignItems: "center", gap: px(12) }}>
        <div style={{ width: px(44), height: px(44), borderRadius: px(10), background: "#38bdf8", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ color: "#1e3a6e", fontWeight: 800, fontSize: px(22) }}>S</span>
        </div>
        <div>
          <p style={{ margin: 0, color: "white", fontWeight: 800, fontSize: px(18), lineHeight: 1 }}>SPHERE</p>
          <p style={{ margin: 0, color: "#38bdf8", fontWeight: 600, fontSize: px(13), letterSpacing: "2px" }}>ENGLISH</p>
        </div>
      </div>

      {/* Oxford partnership badge */}
      <div style={{ position: "absolute", top: px(160), left: px(56), right: px(160), background: "rgba(56,189,248,0.12)", border: `${px(1)}px solid rgba(56,189,248,0.3)`, borderRadius: px(12), padding: `${px(14)}px ${px(20)}px`, display: "flex", alignItems: "center", gap: px(14) }}>
        <div style={{ width: px(36), height: px(36), borderRadius: "50%", background: "#38bdf8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ color: "#1e3a6e", fontSize: px(18), fontWeight: 800 }}>✓</span>
        </div>
        <div>
          <p style={{ margin: 0, color: "white", fontSize: px(13), fontWeight: 700 }}>Oxford University Press</p>
          <p style={{ margin: 0, color: "rgba(255,255,255,0.6)", fontSize: px(11) }}>Resmi İçerik Ortağı</p>
        </div>
      </div>

      {/* Main headline on left */}
      <div style={{ position: "absolute", top: px(290), left: px(56), right: px(140) }}>
        <h2 style={{ margin: 0, color: "white", fontSize: px(42), fontWeight: 800, lineHeight: 1.15 }}>
          Profesyonel{"\n"}
          <span style={{ color: "#38bdf8" }}>İş İngilizcesi</span>{"\n"}
          Eğitimi
        </h2>
        <div style={{ width: px(50), height: px(3), background: "#38bdf8", marginTop: px(24), marginBottom: px(24) }} />
        <p style={{ margin: 0, color: "rgba(255,255,255,0.65)", fontSize: px(16), lineHeight: 1.6 }}>
          Şirketinizin ihtiyaçlarına özel, sektöre göre tasarlanmış İngilizce programları.
        </p>
      </div>

      {/* Feature list on left */}
      <div style={{ position: "absolute", bottom: px(80), left: px(56), display: "flex", flexDirection: "column", gap: px(14) }}>
        {["Sektöre özel müfredat", "Birebir koçluk seansları", "Haftalık ilerleme raporu"].map((item) => (
          <div key={item} style={{ display: "flex", alignItems: "center", gap: px(12) }}>
            <div style={{ width: px(20), height: px(20), borderRadius: "50%", background: "#38bdf8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ color: "#1e3a6e", fontSize: px(11), fontWeight: 800 }}>✓</span>
            </div>
            <span style={{ color: "rgba(255,255,255,0.8)", fontSize: px(15) }}>{item}</span>
          </div>
        ))}
      </div>

      {/* Right panel content */}
      <div style={{ position: "absolute", top: px(56), right: px(56), left: px(520), display: "flex", flexDirection: "column", alignItems: "center" }}>

        {/* Big number */}
        <div style={{ textAlign: "center", marginTop: px(60) }}>
          <p style={{ margin: 0, color: "#1e3a6e", fontSize: px(96), fontWeight: 900, lineHeight: 1 }}>12</p>
          <p style={{ margin: 0, color: "#38bdf8", fontSize: px(16), fontWeight: 700, letterSpacing: "1px", marginTop: px(4) }}>UZMAN KOÇ</p>
        </div>

        <div style={{ width: "100%", height: px(1), background: "#e5e7eb", margin: `${px(32)}px 0` }} />

        {/* Industries */}
        <p style={{ margin: 0, color: "#6b7280", fontSize: px(12), fontWeight: 600, letterSpacing: "1.5px", marginBottom: px(16) }}>SEKTÖRLER</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: px(8), justifyContent: "center" }}>
          {["Finans", "Teknoloji", "Lojistik", "Sağlık", "Üretim", "Hukuk"].map((s) => (
            <div key={s} style={{ background: "#f0f9ff", border: `${px(1)}px solid #bae6fd`, borderRadius: px(20), padding: `${px(6)}px ${px(14)}px` }}>
              <span style={{ color: "#0284c7", fontSize: px(12), fontWeight: 600 }}>{s}</span>
            </div>
          ))}
        </div>

        <div style={{ width: "100%", height: px(1), background: "#e5e7eb", margin: `${px(32)}px 0` }} />

        {/* CTA */}
        <div style={{ width: "100%", background: "#1e3a6e", borderRadius: px(14), padding: `${px(20)}px`, textAlign: "center" }}>
          <p style={{ margin: 0, color: "white", fontWeight: 700, fontSize: px(17) }}>Şirketinize özel teklif</p>
          <p style={{ margin: 0, color: "#38bdf8", fontSize: px(14), marginTop: px(6) }}>sphereenglish.com →</p>
        </div>
      </div>

      {/* Bottom accent */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: px(4), background: "linear-gradient(90deg, #1e3a6e 0%, #38bdf8 50%, #1e3a6e 100%)" }} />
    </div>
  );
}
