const S = 2;
const px = (n: number) => n * S;
const W = 1080;

const ACCENT = "#38bdf8";
const ACCENT2 = "#0ea5e9";
const WHITE = "#ffffff";
const MUTED = "rgba(255,255,255,0.55)";

const PanelDots = ({ current }: { current: number }) => (
  <div style={{ display: "flex", gap: px(8) }}>
    {[1, 2, 3].map((i) => (
      <div key={i} style={{
        width: i === current ? px(30) : px(10),
        height: px(5),
        borderRadius: px(3),
        background: i === current ? ACCENT : "rgba(255,255,255,0.22)",
      }} />
    ))}
  </div>
);

const BottomLine = ({ n }: { n: number }) => (
  <div style={{ display: "flex", alignItems: "center", gap: px(16) }}>
    <div style={{ width: px(40), height: px(2), background: `rgba(56,189,248,0.55)` }} />
    <span style={{
      fontSize: px(14), color: "rgba(255,255,255,0.28)",
      letterSpacing: "0.18em", textTransform: "uppercase",
      fontFamily: '"Plus Jakarta Sans", sans-serif',
    }}>{n} / 3</span>
  </div>
);

const Pill = ({ children }: { children: React.ReactNode }) => (
  <div style={{
    display: "inline-flex", alignItems: "center", gap: px(10),
    background: "rgba(56,189,248,0.10)", border: `1px solid rgba(56,189,248,0.30)`,
    borderRadius: px(100), padding: `${px(12)}px ${px(28)}px`,
    alignSelf: "flex-start",
  }}>
    {children}
  </div>
);

export default function TrilogyPost() {
  const params = new URLSearchParams(window.location.search);
  const panel = parseInt(params.get("panel") || "1");
  const offset = (panel - 1) * px(W);

  const PAD_X = px(80);
  const PAD_Y = px(64);

  const outerPanel: React.CSSProperties = {
    width: px(W), height: px(W), flexShrink: 0,
    display: "flex", flexDirection: "column",
    justifyContent: "space-between",
    padding: `${PAD_Y}px ${PAD_X}px`,
    boxSizing: "border-box",
    position: "relative",
  };

  return (
    <div style={{
      width: px(W),
      height: px(W),
      overflow: "hidden",
      fontFamily: '"Outfit", sans-serif',
      position: "relative",
      background: "#040f1e",
    }}>
      {/* ── 3-PANEL FULL CANVAS ── */}
      <div style={{
        width: px(W * 3),
        height: px(W),
        position: "absolute",
        left: -offset,
        display: "flex",
        background: "linear-gradient(110deg, #050d1c 0%, #0a1c39 22%, #112d58 42%, #0d2448 58%, #092240 70%, #0b3262 82%, #0d4070 92%, #0f4e7a 100%)",
      }}>

        {/* ORBS */}
        <div style={{ position: "absolute", width: px(1800), height: px(1800), borderRadius: "50%", background: "radial-gradient(circle, rgba(14,165,233,0.14) 0%, transparent 58%)", left: px(400), top: px(-500), pointerEvents: "none" }} />
        <div style={{ position: "absolute", width: px(1400), height: px(1400), borderRadius: "50%", background: "radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 60%)", left: px(1800), top: px(50), pointerEvents: "none" }} />
        <div style={{ position: "absolute", width: px(700), height: px(700), borderRadius: "50%", background: "radial-gradient(circle, rgba(14,165,233,0.09) 0%, transparent 70%)", left: px(-150), top: px(450), pointerEvents: "none" }} />
        <div style={{ position: "absolute", width: px(900), height: px(900), borderRadius: "50%", background: "radial-gradient(circle, rgba(3,105,161,0.13) 0%, transparent 65%)", right: px(-150), bottom: px(-200), pointerEvents: "none" }} />

        {/* CONTINUOUS ACCENT LINE */}
        <div style={{ position: "absolute", left: 0, right: 0, top: px(182), height: px(1), background: "linear-gradient(to right, transparent, rgba(56,189,248,0.15) 10%, rgba(56,189,248,0.45) 45%, rgba(56,189,248,0.45) 55%, rgba(56,189,248,0.15) 90%, transparent)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", left: 0, right: 0, bottom: px(166), height: px(1), background: "linear-gradient(to right, transparent, rgba(255,255,255,0.06) 20%, rgba(255,255,255,0.10) 50%, rgba(255,255,255,0.06) 80%, transparent)", pointerEvents: "none" }} />

        {/* SEAM LINES */}
        {[W, W * 2].map((pos) => (
          <div key={pos} style={{ position: "absolute", left: px(pos), top: px(80), bottom: px(80), width: px(1), background: "linear-gradient(to bottom, transparent, rgba(56,189,248,0.20) 30%, rgba(56,189,248,0.20) 70%, transparent)", pointerEvents: "none" }} />
        ))}


        {/* ═══════════════════════════════
            PANEL 1 — PLATFORM TANITIM
        ═══════════════════════════════ */}
        <div style={outerPanel}>

          {/* ZONE 1 — TOP */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: px(36) }}>
              <img src="/images/logo-full.png" alt="Sphere English"
                style={{ height: px(58), width: "auto", filter: "brightness(0) invert(1)", objectFit: "contain", objectPosition: "left" }}
              />
              <PanelDots current={1} />
            </div>
            <Pill>
              <div style={{ width: px(8), height: px(8), borderRadius: "50%", background: ACCENT }} />
              <span style={{ fontSize: px(14), fontWeight: 700, letterSpacing: "0.18em", color: "#7dd3fc", textTransform: "uppercase", fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                Türkiye'nin İlki
              </span>
            </Pill>
          </div>

          {/* ZONE 2 — HEADLINE */}
          <div>
            <div style={{ fontSize: px(96), fontWeight: 900, lineHeight: 0.92, color: WHITE, letterSpacing: "-0.025em", marginBottom: px(12) }}>
              İş İngilizcesi
            </div>
            <div style={{ fontSize: px(96), fontWeight: 900, lineHeight: 0.92, color: ACCENT, letterSpacing: "-0.025em", marginBottom: px(28) }}>
              Platformu
            </div>
            <div style={{ width: px(60), height: px(4), background: `linear-gradient(to right, ${ACCENT}, rgba(56,189,248,0.15))`, borderRadius: px(2) }} />
          </div>

          {/* ZONE 3 — BOTTOM */}
          <div>
            <div style={{ fontSize: px(22), color: MUTED, lineHeight: 1.75, fontFamily: '"Plus Jakarta Sans", sans-serif', marginBottom: px(36) }}>
              Gerçek sektör uzmanlarından ilham alan<br />
              12 yapay zeka koçuyla iş dünyasının<br />
              her sahnesinde güçlü konuş.
            </div>
            <BottomLine n={1} />
          </div>

        </div>


        {/* ═══════════════════════════════
            PANEL 2 — FEATURES
        ═══════════════════════════════ */}
        <div style={outerPanel}>

          {/* ZONE 1 — TOP */}
          <div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: px(48) }}>
              <PanelDots current={2} />
            </div>
            <div style={{ fontSize: px(14), fontWeight: 700, letterSpacing: "0.2em", color: ACCENT, textTransform: "uppercase", fontFamily: '"Plus Jakarta Sans", sans-serif', marginBottom: px(18) }}>
              Nasıl Çalışır?
            </div>
            <div style={{ fontSize: px(52), fontWeight: 800, color: WHITE, lineHeight: 1.1, letterSpacing: "-0.01em" }}>
              Her ihtiyaca özel<br />
              <span style={{ color: ACCENT }}>bir koç seni bekliyor</span>
            </div>
          </div>

          {/* ZONE 2 — FEATURES */}
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {[
              { num: "12", label: "AI Koç", desc: "CEO'dan doktora, her sektörden uzman" },
              { num: "7/24", label: "Kesintisiz Pratik", desc: "İstediğin zaman, istediğin konuda" },
              { num: "∞", label: "Gerçekçi Senaryo", desc: "Toplantı, sunum, müzakere, e-posta…" },
            ].map((f, idx) => (
              <div key={f.num} style={{
                display: "flex", alignItems: "center", gap: px(28),
                padding: `${px(26)}px 0`,
                borderBottom: idx < 2 ? "1px solid rgba(255,255,255,0.09)" : "none",
              }}>
                <div style={{ fontSize: px(54), fontWeight: 900, color: ACCENT2, minWidth: px(140), lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                  {f.num}
                </div>
                <div>
                  <div style={{ fontSize: px(24), fontWeight: 700, color: WHITE, marginBottom: px(5) }}>{f.label}</div>
                  <div style={{ fontSize: px(17), color: "rgba(255,255,255,0.48)", fontFamily: '"Plus Jakarta Sans", sans-serif' }}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* ZONE 3 — BOTTOM */}
          <div>
            <div style={{ width: "100%", height: px(1), background: "rgba(255,255,255,0.08)", marginBottom: px(32) }} />
            <BottomLine n={2} />
          </div>

        </div>


        {/* ═══════════════════════════════
            PANEL 3 — LAUNCH
        ═══════════════════════════════ */}
        <div style={{ ...outerPanel, alignItems: "center", textAlign: "center" }}>

          {/* ZONE 1 — TOP */}
          <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ display: "flex", justifyContent: "flex-end", width: "100%", marginBottom: px(48) }}>
              <PanelDots current={3} />
            </div>
            {/* Live badge */}
            <div style={{
              display: "inline-flex", alignItems: "center", gap: px(12),
              background: "rgba(56,189,248,0.10)", border: `1px solid rgba(56,189,248,0.32)`,
              borderRadius: px(100), padding: `${px(14)}px ${px(36)}px`,
            }}>
              <div style={{ width: px(11), height: px(11), borderRadius: "50%", background: ACCENT, boxShadow: `0 0 0 3px rgba(56,189,248,0.22), 0 0 14px rgba(56,189,248,0.55)` }} />
              <span style={{ fontSize: px(15), fontWeight: 700, letterSpacing: "0.18em", color: "#7dd3fc", textTransform: "uppercase", fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                Hizmet Başladı
              </span>
            </div>
          </div>

          {/* ZONE 2 — HEADLINE */}
          <div>
            <div style={{ fontSize: px(96), fontWeight: 900, lineHeight: 0.92, color: WHITE, letterSpacing: "-0.025em", marginBottom: px(12) }}>
              Kapılarımız
            </div>
            <div style={{ fontSize: px(96), fontWeight: 900, lineHeight: 0.92, color: ACCENT, letterSpacing: "-0.025em", marginBottom: px(28) }}>
              Açıldı!
            </div>
            <div style={{ width: px(60), height: px(4), background: `linear-gradient(to right, rgba(56,189,248,0.2), ${ACCENT}, rgba(56,189,248,0.2))`, borderRadius: px(2), margin: "0 auto" }} />
          </div>

          {/* ZONE 3 — BOTTOM */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
            <div style={{ fontSize: px(21), color: MUTED, lineHeight: 1.75, fontFamily: '"Plus Jakarta Sans", sans-serif', marginBottom: px(40) }}>
              Yapay zeka destekli koçlarımızla<br />
              İş İngilizceni bugün bir<br />
              üst seviyeye taşımaya başla.
            </div>
            <div style={{
              background: `linear-gradient(135deg, ${ACCENT2} 0%, #0369a1 100%)`,
              borderRadius: px(16), padding: `${px(24)}px ${px(60)}px`,
              fontSize: px(23), fontWeight: 800, color: WHITE,
              boxShadow: "0 10px 40px rgba(14,165,233,0.38)", marginBottom: px(20),
            }}>
              sphereenglish.com
            </div>
            <div style={{ fontSize: px(16), color: "rgba(255,255,255,0.30)", fontFamily: '"Plus Jakarta Sans", sans-serif', letterSpacing: "0.08em", marginBottom: px(28) }}>
              @sphereenglish
            </div>
            <div style={{ alignSelf: "flex-start" }}>
              <BottomLine n={3} />
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
