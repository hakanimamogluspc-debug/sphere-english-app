const S = 2;
const px = (n: number) => n * S;
const W = 1080;

const ACCENT  = "#38bdf8";
const ACCENT2 = "#0ea5e9";
const WHITE   = "#ffffff";
const MUTED   = "rgba(255,255,255,0.58)";

/* ── Panel dot indicator ── */
const PanelDots = ({ current }: { current: number }) => (
  <div style={{ display: "flex", gap: px(10), alignItems: "center" }}>
    {[1, 2, 3].map((i) => (
      <div key={i} style={{
        width:  i === current ? px(48) : px(14),
        height: px(8),
        borderRadius: px(4),
        background: i === current ? ACCENT : "rgba(255,255,255,0.20)",
      }} />
    ))}
  </div>
);

/* ── Bottom "N / 3" label ── */
const BottomLine = ({ n }: { n: number }) => (
  <div style={{ display: "flex", alignItems: "center", gap: px(18) }}>
    <div style={{ width: px(48), height: px(3), background: `rgba(56,189,248,0.55)`, borderRadius: px(2) }} />
    <span style={{
      fontSize: px(17), color: "rgba(255,255,255,0.30)",
      letterSpacing: "0.2em", textTransform: "uppercase",
      fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 600,
    }}>{n} / 3</span>
  </div>
);

/* ── Industry tag chip ── */
const Tag = ({ label }: { label: string }) => (
  <div style={{
    display: "inline-flex", alignItems: "center",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: px(100), padding: `${px(10)}px ${px(22)}px`,
    fontSize: px(17), fontWeight: 600, color: "rgba(255,255,255,0.50)",
    fontFamily: '"Plus Jakarta Sans", sans-serif',
  }}>{label}</div>
);

export default function TrilogyPost() {
  const params = new URLSearchParams(window.location.search);
  const panel  = parseInt(params.get("panel") || "1");
  const offset = (panel - 1) * px(W);

  const PADX = px(80);
  const PADY = px(60);

  const outerPanel: React.CSSProperties = {
    width: px(W), height: px(W), flexShrink: 0,
    display: "flex", flexDirection: "column",
    justifyContent: "space-between",
    padding: `${PADY}px ${PADX}px`,
    boxSizing: "border-box",
    position: "relative",
  };

  return (
    <div style={{ width: px(W), height: px(W), overflow: "hidden", fontFamily: '"Outfit", sans-serif', position: "relative", background: "#040f1e" }}>

      {/* ════ FULL 3-PANEL CANVAS ════ */}
      <div style={{
        width: px(W * 3), height: px(W),
        position: "absolute", left: -offset,
        display: "flex",
        background: "linear-gradient(110deg, #060d1e 0%, #0b1e3c 20%, #122e5a 40%, #0e2548 56%, #0a2442 68%, #0c3460 82%, #0d4270 92%, #0f5080 100%)",
      }}>

        {/* ── DECORATIVE ORBS ── */}
        <div style={{ position:"absolute", width:px(1800), height:px(1800), borderRadius:"50%", background:"radial-gradient(circle, rgba(14,165,233,0.18) 0%, transparent 58%)", left:px(380), top:px(-520), pointerEvents:"none" }} />
        <div style={{ position:"absolute", width:px(1400), height:px(1400), borderRadius:"50%", background:"radial-gradient(circle, rgba(59,130,246,0.16) 0%, transparent 58%)", left:px(1850), top:px(30), pointerEvents:"none" }} />
        <div style={{ position:"absolute", width:px(800),  height:px(800),  borderRadius:"50%", background:"radial-gradient(circle, rgba(14,165,233,0.12) 0%, transparent 68%)", left:px(-180), top:px(480), pointerEvents:"none" }} />
        <div style={{ position:"absolute", width:px(1000), height:px(1000), borderRadius:"50%", background:"radial-gradient(circle, rgba(3,105,161,0.18) 0%, transparent 62%)", right:px(-180), bottom:px(-250), pointerEvents:"none" }} />

        {/* ── CONTINUOUS TOP ACCENT LINE ── */}
        <div style={{ position:"absolute", left:0, right:0, top:px(310), height:px(1), background:"linear-gradient(to right, transparent, rgba(56,189,248,0.18) 8%, rgba(56,189,248,0.5) 42%, rgba(56,189,248,0.5) 58%, rgba(56,189,248,0.18) 92%, transparent)", pointerEvents:"none" }} />
        {/* ── BOTTOM ACCENT LINE ── */}
        <div style={{ position:"absolute", left:0, right:0, bottom:px(174), height:px(1), background:"linear-gradient(to right, transparent, rgba(255,255,255,0.06) 18%, rgba(255,255,255,0.11) 50%, rgba(255,255,255,0.06) 82%, transparent)", pointerEvents:"none" }} />

        {/* ── VERTICAL SEAM LINES ── */}
        {[W, W*2].map(pos => (
          <div key={pos} style={{ position:"absolute", left:px(pos), top:px(80), bottom:px(80), width:px(1), background:"linear-gradient(to bottom, transparent, rgba(56,189,248,0.22) 28%, rgba(56,189,248,0.22) 72%, transparent)", pointerEvents:"none" }} />
        ))}


        {/* ══════════════════════════════════════
            PANEL 1 — PLATFORM TANITIM
        ══════════════════════════════════════ */}
        <div style={outerPanel}>

          {/* TOP: logo + dots + badge */}
          <div>
            {/* Logo row */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:px(32) }}>
              <img src="/images/logo-full.png" alt="Sphere English"
                style={{ height:px(160), width:"auto", filter:"brightness(0) invert(1)", objectFit:"contain", objectPosition:"left" }}
              />
              <PanelDots current={1} />
            </div>

            {/* Eyebrow badge */}
            <div style={{
              display:"inline-flex", alignItems:"center", gap:px(12),
              background:"rgba(56,189,248,0.12)", border:"1px solid rgba(56,189,248,0.35)",
              borderRadius:px(100), padding:`${px(14)}px ${px(30)}px`,
            }}>
              <div style={{ width:px(10), height:px(10), borderRadius:"50%", background:ACCENT, boxShadow:`0 0 8px ${ACCENT}` }} />
              <span style={{ fontSize:px(17), fontWeight:700, letterSpacing:"0.18em", color:"#7dd3fc", textTransform:"uppercase", fontFamily:'"Plus Jakarta Sans", sans-serif' }}>
                TÜRKİYE'NİN İLKİ
              </span>
            </div>
          </div>

          {/* MIDDLE: headline */}
          <div>
            <div style={{ fontSize:px(108), fontWeight:900, lineHeight:0.90, color:WHITE, letterSpacing:"-0.025em", marginBottom:px(14) }}>
              İş İngilizcesi
            </div>
            <div style={{ fontSize:px(108), fontWeight:900, lineHeight:0.90, color:ACCENT, letterSpacing:"-0.025em", marginBottom:px(32) }}>
              Platformu
            </div>
            <div style={{ width:px(64), height:px(5), background:`linear-gradient(to right, ${ACCENT}, rgba(56,189,248,0.15))`, borderRadius:px(3) }} />
          </div>

          {/* BOTTOM: desc + tags + label */}
          <div>
            <div style={{ fontSize:px(25), color:MUTED, lineHeight:1.75, fontFamily:'"Plus Jakarta Sans", sans-serif', marginBottom:px(32) }}>
              Gerçek sektör uzmanlarından ilham alan 12 yapay<br />
              zeka koçuyla iş dünyasının her sahnesinde<br />
              güçlü ve akıcı konuş.
            </div>
            <div style={{ display:"flex", gap:px(14), flexWrap:"wrap", marginBottom:px(36) }}>
              {["Finans","Hukuk","İK","Teknoloji","Sağlık"].map(t => <Tag key={t} label={t} />)}
            </div>
            <BottomLine n={1} />
          </div>

        </div>


        {/* ══════════════════════════════════════
            PANEL 2 — FEATURES
        ══════════════════════════════════════ */}
        <div style={{ ...outerPanel, justifyContent:"flex-start" }}>

          {/* Logo row */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:px(36) }}>
            <img src="/images/logo-full.png" alt="Sphere English"
              style={{ height:px(120), width:"auto", filter:"brightness(0) invert(1)", objectFit:"contain", objectPosition:"left", opacity:0.85 }}
            />
            <PanelDots current={2} />
          </div>

          {/* Eyebrow + headline */}
          <div style={{ marginBottom:px(48) }}>
            <div style={{ fontSize:px(17), fontWeight:700, letterSpacing:"0.2em", color:ACCENT, textTransform:"uppercase", fontFamily:'"Plus Jakarta Sans", sans-serif', marginBottom:px(18) }}>
              Nasıl Çalışır?
            </div>
            <div style={{ fontSize:px(72), fontWeight:800, color:WHITE, lineHeight:1.05, letterSpacing:"-0.015em" }}>
              Her ihtiyaca özel<br />
              <span style={{ color:ACCENT }}>bir koç seni bekliyor</span>
            </div>
          </div>

          {/* Divider */}
          <div style={{ width:"100%", height:px(1), background:"rgba(56,189,248,0.25)", marginBottom:px(20) }} />

          {/* Stats — flex:1 fills remaining space */}
          <div style={{ flex:1, display:"flex", flexDirection:"column", justifyContent:"space-evenly" }}>
            {[
              { num:"12",   label:"AI Koç",             desc:"CEO'dan doktora, her sektörden uzman" },
              { num:"7/24", label:"Kesintisiz Pratik",   desc:"İstediğin zaman, istediğin konuda"   },
              { num:"∞",    label:"Gerçekçi Senaryo",   desc:"Toplantı, sunum, müzakere, e-posta…", big:true },
            ].map((f: any, idx: number) => (
              <div key={f.num}>
                <div style={{ display:"flex", alignItems:"center", gap:px(30), padding:`${px(22)}px 0` }}>
                  <div style={{ fontSize: f.big ? px(90) : px(72), fontWeight:900, color:ACCENT2, minWidth:px(176), lineHeight:1, fontVariantNumeric:"tabular-nums" }}>
                    {f.num}
                  </div>
                  <div>
                    <div style={{ fontSize:px(30), fontWeight:700, color:WHITE, marginBottom:px(8) }}>{f.label}</div>
                    <div style={{ fontSize:px(21), color:"rgba(255,255,255,0.52)", fontFamily:'"Plus Jakarta Sans", sans-serif' }}>{f.desc}</div>
                  </div>
                </div>
                {idx < 2 && <div style={{ width:"100%", height:px(1), background:"rgba(255,255,255,0.08)" }} />}
              </div>
            ))}
          </div>

          {/* Bottom line */}
          <div style={{ paddingTop:px(24) }}>
            <BottomLine n={2} />
          </div>

        </div>


        {/* ══════════════════════════════════════
            PANEL 3 — LAUNCH
        ══════════════════════════════════════ */}
        <div style={{ ...outerPanel, alignItems:"center", textAlign:"center" }}>

          {/* TOP: dots + live badge */}
          <div style={{ width:"100%", display:"flex", flexDirection:"column", alignItems:"center" }}>
            <div style={{ display:"flex", justifyContent:"flex-end", width:"100%", marginBottom:px(40) }}>
              <PanelDots current={3} />
            </div>
            <div style={{
              display:"inline-flex", alignItems:"center", gap:px(14),
              background:"rgba(56,189,248,0.12)", border:"1px solid rgba(56,189,248,0.36)",
              borderRadius:px(100), padding:`${px(16)}px ${px(40)}px`,
            }}>
              <div style={{ width:px(13), height:px(13), borderRadius:"50%", background:ACCENT, boxShadow:`0 0 0 4px rgba(56,189,248,0.22), 0 0 16px rgba(56,189,248,0.6)` }} />
              <span style={{ fontSize:px(17), fontWeight:700, letterSpacing:"0.2em", color:"#7dd3fc", textTransform:"uppercase", fontFamily:'"Plus Jakarta Sans", sans-serif' }}>
                Hizmet Başladı
              </span>
            </div>
          </div>

          {/* MIDDLE: headline */}
          <div>
            <div style={{ fontSize:px(108), fontWeight:900, lineHeight:0.90, color:WHITE, letterSpacing:"-0.025em", marginBottom:px(14) }}>
              Kapılarımız
            </div>
            <div style={{ fontSize:px(108), fontWeight:900, lineHeight:0.90, color:ACCENT, letterSpacing:"-0.025em", marginBottom:px(32) }}>
              Açıldı!
            </div>
            <div style={{ width:px(64), height:px(5), background:`linear-gradient(to right, rgba(56,189,248,0.2), ${ACCENT}, rgba(56,189,248,0.2))`, borderRadius:px(3), margin:"0 auto" }} />
          </div>

          {/* BOTTOM: sub + CTA + handle */}
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", width:"100%" }}>
            <div style={{ fontSize:px(25), color:MUTED, lineHeight:1.75, fontFamily:'"Plus Jakarta Sans", sans-serif', marginBottom:px(40) }}>
              Yapay zeka destekli koçlarımızla<br />
              İş İngilizceni bugün bir<br />
              üst seviyeye taşımaya başla.
            </div>
            <div style={{
              background:`linear-gradient(135deg, ${ACCENT2} 0%, #0369a1 100%)`,
              borderRadius:px(20), padding:`${px(28)}px ${px(72)}px`,
              fontSize:px(26), fontWeight:800, color:WHITE,
              boxShadow:"0 12px 48px rgba(14,165,233,0.42)", marginBottom:px(22),
              letterSpacing:"0.01em",
            }}>
              sphereenglish.com
            </div>
            <div style={{ fontSize:px(18), color:"rgba(255,255,255,0.30)", fontFamily:'"Plus Jakarta Sans", sans-serif', letterSpacing:"0.1em", marginBottom:px(32) }}>
              @sphereenglish
            </div>
            <div style={{ alignSelf:"flex-start" }}>
              <BottomLine n={3} />
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
