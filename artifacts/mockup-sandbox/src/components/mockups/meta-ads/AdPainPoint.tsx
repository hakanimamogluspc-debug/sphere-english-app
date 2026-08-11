const S = 1080;
const scale = 0.5;
const D = S * scale;

const px = (n: number) => n * scale;

export default function AdPainPoint() {
  return (
    <div style={{ width: D, height: D, position: "relative", overflow: "hidden", fontFamily: "'Outfit', sans-serif", background: "#0b1f45" }}>

      {/* Gradient overlay */}
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 80% 20%, #1a3a7a 0%, #0b1f45 60%)" }} />

      {/* Decorative circle top-right */}
      <div style={{ position: "absolute", top: px(-80), right: px(-80), width: px(400), height: px(400), borderRadius: "50%", border: `${px(2)}px solid rgba(56,189,248,0.15)` }} />
      <div style={{ position: "absolute", top: px(-40), right: px(-40), width: px(280), height: px(280), borderRadius: "50%", border: `${px(2)}px solid rgba(56,189,248,0.10)` }} />

      {/* Accent line top */}
      <div style={{ position: "absolute", top: 0, left: px(60), width: px(80), height: px(4), background: "#38bdf8" }} />

      {/* Logo top-left */}
      <div style={{ position: "absolute", top: px(48), left: px(60), display: "flex", alignItems: "center", gap: px(10) }}>
        <div style={{ width: px(36), height: px(36), borderRadius: px(8), background: "#38bdf8", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ color: "#0b1f45", fontWeight: 800, fontSize: px(18), letterSpacing: "-0.5px" }}>S</span>
        </div>
        <span style={{ color: "white", fontWeight: 700, fontSize: px(16), letterSpacing: "0.5px" }}>SPHERE ENGLISH</span>
      </div>

      {/* Tag */}
      <div style={{ position: "absolute", top: px(48), right: px(60), background: "rgba(56,189,248,0.15)", border: `${px(1)}px solid rgba(56,189,248,0.4)`, borderRadius: px(20), padding: `${px(6)}px ${px(16)}px` }}>
        <span style={{ color: "#38bdf8", fontSize: px(12), fontWeight: 600, letterSpacing: "1px" }}>KURUMSAL EĞİTİM</span>
      </div>

      {/* Main content */}
      <div style={{ position: "absolute", top: px(160), left: px(60), right: px(60) }}>

        {/* Eyebrow */}
        <p style={{ margin: 0, color: "#38bdf8", fontSize: px(14), fontWeight: 600, letterSpacing: "2px", marginBottom: px(24) }}>
          ÇALIŞANLARINIZ İÇİN
        </p>

        {/* Headline */}
        <h1 style={{ margin: 0, color: "white", fontSize: px(54), fontWeight: 800, lineHeight: 1.1, marginBottom: px(32) }}>
          Toplantılarda{" "}
          <span style={{ color: "#38bdf8" }}>susmak</span>{" "}
          bir seçenek değil.
        </h1>

        {/* Divider */}
        <div style={{ width: px(60), height: px(3), background: "#38bdf8", marginBottom: px(28) }} />

        {/* Body */}
        <p style={{ margin: 0, color: "rgba(255,255,255,0.75)", fontSize: px(20), lineHeight: 1.6, maxWidth: px(800) }}>
          Ekibinizin İngilizce yetersizliği iş fırsatlarınızın önünde engel olmasın. Sphere English ile 8 haftada ölçülebilir ilerleme.
        </p>
      </div>

      {/* Bottom section */}
      <div style={{ position: "absolute", bottom: px(60), left: px(60), right: px(60), display: "flex", alignItems: "center", justifyContent: "space-between" }}>

        {/* Stats */}
        <div style={{ display: "flex", gap: px(40) }}>
          <div>
            <p style={{ margin: 0, color: "white", fontSize: px(32), fontWeight: 800 }}>500+</p>
            <p style={{ margin: 0, color: "rgba(255,255,255,0.5)", fontSize: px(13), marginTop: px(4) }}>Şirket</p>
          </div>
          <div style={{ width: px(1), background: "rgba(255,255,255,0.15)" }} />
          <div>
            <p style={{ margin: 0, color: "white", fontSize: px(32), fontWeight: 800 }}>12</p>
            <p style={{ margin: 0, color: "rgba(255,255,255,0.5)", fontSize: px(13), marginTop: px(4) }}>Uzman Koç</p>
          </div>
          <div style={{ width: px(1), background: "rgba(255,255,255,0.15)" }} />
          <div>
            <p style={{ margin: 0, color: "white", fontSize: px(32), fontWeight: 800 }}>%94</p>
            <p style={{ margin: 0, color: "rgba(255,255,255,0.5)", fontSize: px(13), marginTop: px(4) }}>Memnuniyet</p>
          </div>
        </div>

        {/* CTA */}
        <div style={{ background: "#38bdf8", borderRadius: px(12), padding: `${px(16)}px ${px(32)}px`, display: "flex", alignItems: "center", gap: px(10) }}>
          <span style={{ color: "#0b1f45", fontWeight: 700, fontSize: px(16) }}>Ücretsiz Danışın</span>
          <span style={{ color: "#0b1f45", fontSize: px(18), fontWeight: 700 }}>→</span>
        </div>
      </div>

      {/* Bottom accent line */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: px(4), background: "linear-gradient(90deg, #38bdf8 0%, #1e3a6e 100%)" }} />
    </div>
  );
}
