const S = 2;
const px = (n: number) => n * S;
const W = 1080;

const ACCENT  = "#38bdf8";
const ACCENT2 = "#0ea5e9";
const PRIMARY = "#1e3a6e";
const WHITE   = "#ffffff";
const MUTED   = "rgba(255,255,255,0.60)";

const BG = "linear-gradient(135deg, #060d1e 0%, #0b1e3c 35%, #112d58 65%, #0d2448 100%)";

/* ── Panel dot indicator ── */
const PanelDots = ({ current }: { current: number }) => (
  <div style={{ display:"flex", gap:px(10), alignItems:"center" }}>
    {[1,2,3].map(i => (
      <div key={i} style={{
        width:  i === current ? px(48) : px(14),
        height: px(8),
        borderRadius: px(4),
        background: i === current ? ACCENT : "rgba(255,255,255,0.22)",
      }} />
    ))}
  </div>
);

/* ── Bottom "N / 3" label ── */
const BottomLine = ({ n, center }: { n: number; center?: boolean }) => (
  <div style={{ display:"flex", alignItems:"center", gap:px(18), justifyContent: center ? "center" : "flex-start" }}>
    <div style={{ width:px(48), height:px(3), background:`rgba(56,189,248,0.55)`, borderRadius:px(2) }} />
    <span style={{ fontSize:px(17), color:"rgba(255,255,255,0.30)", letterSpacing:"0.2em", textTransform:"uppercase", fontFamily:'"Plus Jakarta Sans", sans-serif', fontWeight:600 }}>
      {n} / 3
    </span>
  </div>
);

/* ── Avatar initials circle ── */
const Avatar = ({ letter, color }: { letter: string; color: string }) => (
  <div style={{
    width: px(52), height: px(52), borderRadius:"50%",
    background: color, display:"flex", alignItems:"center", justifyContent:"center",
    fontSize: px(22), fontWeight:800, color: WHITE,
    border:`${px(3)}px solid rgba(255,255,255,0.25)`,
    flexShrink: 0,
  }}>{letter}</div>
);

/* ── Photo card panel (for Didem & Merve) ── */
const PhotoPanel = ({ src, alt, dots }: { src: string; alt: string; dots: number }) => {
  const PADX = px(72);
  const PADY = px(60);
  return (
    <div style={{
      width:px(W), height:px(W), flexShrink:0,
      background: BG,
      display:"flex", flexDirection:"column",
      padding:`${PADY}px ${PADX}px`,
      boxSizing:"border-box",
      position:"relative",
    }}>
      {/* Dekoratif orbs */}
      <div style={{ position:"absolute", width:px(1200), height:px(1200), borderRadius:"50%", background:"radial-gradient(circle, rgba(14,165,233,0.13) 0%, transparent 58%)", left:px(-300), top:px(-300), pointerEvents:"none" }} />
      <div style={{ position:"absolute", width:px(700), height:px(700), borderRadius:"50%", background:"radial-gradient(circle, rgba(56,189,248,0.10) 0%, transparent 60%)", right:px(-150), bottom:px(-150), pointerEvents:"none" }} />

      {/* Logo + dots */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:px(36), flexShrink:0 }}>
        <img src="/images/logo-full.png" alt="Sphere English"
          style={{ height:px(120), width:"auto", filter:"brightness(0) invert(1)", objectFit:"contain", objectPosition:"left" }}
        />
        <PanelDots current={dots} />
      </div>

      {/* Fotoğraf çerçevesi */}
      <div style={{
        flex: 1,
        borderRadius: px(36),
        overflow: "hidden",
        boxShadow: "0 8px 60px rgba(0,0,0,0.45), 0 0 0 3px rgba(56,189,248,0.18)",
        marginBottom: px(32),
        background: "#dde6f0",
      }}>
        <img
          src={src}
          alt={alt}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            objectPosition: "center bottom",
            display: "block",
          }}
        />
      </div>

      {/* Alt gösterge */}
      <div style={{ flexShrink:0 }}>
        <BottomLine n={dots} />
      </div>
    </div>
  );
};

export default function FoundersPost() {
  const params = new URLSearchParams(window.location.search);
  const panel  = parseInt(params.get("panel") || "1");
  const offset = (panel - 1) * px(W);

  const PADX = px(80);
  const PADY = px(60);

  return (
    <div style={{ width:px(W), height:px(W), overflow:"hidden", fontFamily:'"Outfit", sans-serif', position:"relative", background:"#040f1e" }}>

      {/* ════ FULL 3-PANEL CANVAS ════ */}
      <div style={{
        width: px(W * 3), height: px(W),
        position:"absolute", left:-offset, display:"flex",
      }}>

        {/* ══════════════════════════════════════
            PANEL 1 — DİDEM
        ══════════════════════════════════════ */}
        <PhotoPanel src="/images/founder-didem.jpeg" alt="Didem İmamoğlu" dots={1} />


        {/* ══════════════════════════════════════
            PANEL 2 — MESAJ
        ══════════════════════════════════════ */}
        <div style={{
          width:px(W), height:px(W), flexShrink:0,
          display:"flex", flexDirection:"column",
          justifyContent:"space-between",
          padding:`${PADY}px ${PADX}px`,
          boxSizing:"border-box",
          background: BG,
          position:"relative",
        }}>
          {/* Dekoratif orbs */}
          <div style={{ position:"absolute", width:px(1400), height:px(1400), borderRadius:"50%", background:"radial-gradient(circle, rgba(14,165,233,0.14) 0%, transparent 58%)", left:px(-200), top:px(-300), pointerEvents:"none" }} />
          <div style={{ position:"absolute", width:px(800), height:px(800), borderRadius:"50%", background:"radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 60%)", right:px(-200), bottom:px(-200), pointerEvents:"none" }} />
          {/* Yatay accent çizgi */}
          <div style={{ position:"absolute", left:0, right:0, top:px(300), height:px(1), background:"linear-gradient(to right, transparent, rgba(56,189,248,0.18) 15%, rgba(56,189,248,0.45) 50%, rgba(56,189,248,0.18) 85%, transparent)", pointerEvents:"none" }} />

          {/* TOP: Logo + dots */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <img src="/images/logo-full.png" alt="Sphere English"
              style={{ height:px(120), width:"auto", filter:"brightness(0) invert(1)", objectFit:"contain", objectPosition:"left" }}
            />
            <PanelDots current={2} />
          </div>

          {/* MIDDLE: Mesaj — ortalı */}
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", textAlign:"center" }}>
            <div style={{ fontSize:px(17), fontWeight:700, letterSpacing:"0.2em", color:ACCENT, textTransform:"uppercase", fontFamily:'"Plus Jakarta Sans", sans-serif', marginBottom:px(24) }}>
              BİZİ TANIYIN
            </div>
            <div style={{ fontSize:px(68), fontWeight:900, color:WHITE, lineHeight:0.95, letterSpacing:"-0.025em", marginBottom:px(16) }}>
              Merhaba, biz
            </div>
            <div style={{ fontSize:px(68), fontWeight:900, lineHeight:0.95, letterSpacing:"-0.025em", marginBottom:px(14) }}>
              <span style={{ color:ACCENT }}>Sphere English'in</span>
            </div>
            <div style={{ fontSize:px(68), fontWeight:900, color:WHITE, lineHeight:0.95, letterSpacing:"-0.025em", marginBottom:px(36) }}>
              kurucularıyız.
            </div>
            <div style={{ width:px(64), height:px(5), background:`linear-gradient(to right, rgba(56,189,248,0.15), ${ACCENT}, rgba(56,189,248,0.15))`, borderRadius:px(3), marginBottom:px(36) }} />
            <div style={{ fontSize:px(24), color:MUTED, lineHeight:1.78, fontFamily:'"Plus Jakarta Sans", sans-serif' }}>
              Türk iş dünyasının global arenada güçlü bir<br />
              ses bulması için yola çıktık. İki eğitimci,<br />
              bir vizyon: İş İngilizcesinde gerçek fark<br />
              yaratmak.
            </div>
          </div>

          {/* BOTTOM: Avatar çifti + isimler — ortalı */}
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>
            <div style={{ width:"100%", height:px(1), background:"rgba(255,255,255,0.08)", marginBottom:px(28) }} />
            <div style={{ display:"flex", alignItems:"center", gap:px(20), marginBottom:px(32) }}>
              <div style={{ display:"flex" }}>
                <Avatar letter="D" color={ACCENT2} />
                <Avatar letter="M" color={PRIMARY} />
              </div>
              <div style={{ textAlign:"left" }}>
                <div style={{ fontSize:px(22), fontWeight:700, color:WHITE, letterSpacing:"-0.01em" }}>
                  Didem İmamoğlu & Merve Eş
                </div>
                <div style={{ fontSize:px(18), color:"rgba(255,255,255,0.45)", fontFamily:'"Plus Jakarta Sans", sans-serif' }}>
                  Sphere English Kurucuları
                </div>
              </div>
            </div>
            <BottomLine n={2} />
          </div>
        </div>


        {/* ══════════════════════════════════════
            PANEL 3 — MERVE
        ══════════════════════════════════════ */}
        <PhotoPanel src="/images/founder-merve.jpeg" alt="Merve Eş" dots={3} />

      </div>
    </div>
  );
}
