const S = 1080;
const scale = 0.5;
const D = S * scale;
const px = (n: number) => n * scale;

const weeks = [
  { label: "H1", val: 15 },
  { label: "H2", val: 28 },
  { label: "H3", val: 40 },
  { label: "H4", val: 52 },
  { label: "H5", val: 61 },
  { label: "H6", val: 72 },
  { label: "H7", val: 84 },
  { label: "H8", val: 95 },
];

const BAR_MAX_H = px(160);

export default function AdROI() {
  return (
    <div style={{ width: D, height: D, position: "relative", overflow: "hidden", fontFamily: "'Outfit', sans-serif", background: "#f8faff" }}>

      {/* Top navy bar */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: px(220), background: "#1e3a6e" }} />

      {/* Diagonal cut bottom of navy */}
      <div style={{ position: "absolute", top: px(180), left: 0, right: 0, height: px(80), background: "#f8faff", clipPath: "polygon(0 100%, 100% 40%, 100% 100%)" }} />

      {/* Logo */}
      <div style={{ position: "absolute", top: px(48), left: px(60), display: "flex", alignItems: "center", gap: px(10) }}>
        <div style={{ width: px(36), height: px(36), borderRadius: px(8), background: "#38bdf8", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ color: "#1e3a6e", fontWeight: 800, fontSize: px(18) }}>S</span>
        </div>
        <span style={{ color: "white", fontWeight: 700, fontSize: px(16), letterSpacing: "0.5px" }}>SPHERE ENGLISH</span>
      </div>

      {/* Tag */}
      <div style={{ position: "absolute", top: px(48), right: px(60), background: "rgba(56,189,248,0.2)", borderRadius: px(20), padding: `${px(6)}px ${px(16)}px` }}>
        <span style={{ color: "#38bdf8", fontSize: px(12), fontWeight: 600, letterSpacing: "1px" }}>ÖLÇÜLEBİLİR SONUÇ</span>
      </div>

      {/* Headline */}
      <div style={{ position: "absolute", top: px(110), left: px(60), right: px(60) }}>
        <h1 style={{ margin: 0, color: "white", fontSize: px(48), fontWeight: 800, lineHeight: 1.1 }}>
          8 Haftada{" "}
          <span style={{ color: "#38bdf8" }}>Dönüşüm</span>
        </h1>
      </div>

      {/* Main card */}
      <div style={{ position: "absolute", top: px(248), left: px(48), right: px(48), background: "white", borderRadius: px(20), padding: `${px(36)}px ${px(40)}px`, boxShadow: "0 8px 40px rgba(30,58,110,0.12)" }}>

        {/* Chart label */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: px(24) }}>
          <div>
            <p style={{ margin: 0, color: "#1e3a6e", fontWeight: 700, fontSize: px(16) }}>Çalışan Performans Grafiği</p>
            <p style={{ margin: 0, color: "#6b7280", fontSize: px(13), marginTop: px(4) }}>Ortalama 8 haftalık gelişim</p>
          </div>
          <div style={{ background: "#f0f9ff", borderRadius: px(10), padding: `${px(10)}px ${px(16)}px`, textAlign: "center" }}>
            <p style={{ margin: 0, color: "#1e3a6e", fontSize: px(28), fontWeight: 900 }}>+80<span style={{ fontSize: px(16) }}>%</span></p>
            <p style={{ margin: 0, color: "#38bdf8", fontSize: px(11), fontWeight: 600 }}>ORTALAMA ARTIŞ</p>
          </div>
        </div>

        {/* Bar chart */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: px(12), height: BAR_MAX_H, marginBottom: px(10) }}>
          {weeks.map((w, i) => (
            <div key={w.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: px(6) }}>
              <span style={{ color: "#1e3a6e", fontSize: px(11), fontWeight: 700, opacity: i === 7 ? 1 : 0.5 }}>
                {i === 7 ? `%${w.val}` : ""}
              </span>
              <div style={{
                width: "100%",
                height: BAR_MAX_H * (w.val / 100),
                borderRadius: `${px(6)}px ${px(6)}px 0 0`,
                background: i === 7
                  ? "#1e3a6e"
                  : i >= 5
                  ? "#38bdf8"
                  : `rgba(56,189,248,${0.3 + i * 0.1})`,
                position: "relative",
              }} />
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: px(12) }}>
          {weeks.map((w) => (
            <div key={w.label} style={{ flex: 1, textAlign: "center" }}>
              <span style={{ color: "#9ca3af", fontSize: px(11) }}>{w.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom stats row */}
      <div style={{ position: "absolute", bottom: px(56), left: px(48), right: px(48), display: "flex", gap: px(16) }}>
        {[
          { val: "500+", label: "Eğitilen Çalışan", color: "#1e3a6e" },
          { val: "8 Hafta", label: "Standart Program", color: "#0ea5e9" },
          { val: "%94", label: "Memnuniyet Oranı", color: "#1e3a6e" },
        ].map((stat) => (
          <div key={stat.label} style={{ flex: 1, background: "white", borderRadius: px(14), padding: `${px(18)}px ${px(16)}px`, textAlign: "center", boxShadow: "0 2px 12px rgba(30,58,110,0.08)", borderTop: `${px(3)}px solid ${stat.color}` }}>
            <p style={{ margin: 0, color: stat.color, fontSize: px(26), fontWeight: 900 }}>{stat.val}</p>
            <p style={{ margin: 0, color: "#6b7280", fontSize: px(12), marginTop: px(4) }}>{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Bottom strip */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: px(4), background: "linear-gradient(90deg, #1e3a6e, #38bdf8, #1e3a6e)" }} />
    </div>
  );
}
