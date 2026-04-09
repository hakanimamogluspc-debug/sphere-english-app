const S = 2;
const px = (n: number) => n * S;
const W = 1080;

const ACCENT  = "#38bdf8";
const ACCENT2 = "#0ea5e9";
const PRIMARY = "#1e3a6e";
const WHITE   = "#ffffff";
const MUTED   = "rgba(255,255,255,0.60)";

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
const BottomLine = ({ n }: { n: number }) => (
  <div style={{ display:"flex", alignItems:"center", gap:px(18) }}>
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
            PANEL 1 — DİDEM FOTOĞRAF
        ══════════════════════════════════════ */}
        <div style={{ width:px(W), height:px(W), flexShrink:0, position:"relative", overflow:"hidden" }}>

          {/* Fotoğraf */}
          <img
            src="/images/founder-didem.jpeg"
            alt="Didem İmamoğlu"
            style={{
              position:"absolute", inset:0, width:"100%", height:"100%",
              objectFit:"cover", objectPosition:"center top",
            }}
          />

          {/* Üst koyu overlay (logo alanı) */}
          <div style={{ position:"absolute", top:0, left:0, right:0, height:px(260), background:"linear-gradient(to bottom, rgba(4,15,30,0.82) 0%, transparent 100%)", pointerEvents:"none" }} />

          {/* Alt koyu overlay (isim alanı) */}
          <div style={{ position:"absolute", bottom:0, left:0, right:0, height:px(340), background:"linear-gradient(to top, rgba(4,15,30,0.96) 0%, rgba(4,15,30,0.7) 60%, transparent 100%)", pointerEvents:"none" }} />

          {/* Üst: Logo + dots */}
          <div style={{ position:"absolute", top:PADY, left:PADX, right:PADX, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <img src="/images/logo-full.png" alt="Sphere English"
              style={{ height:px(120), width:"auto", filter:"brightness(0) invert(1)", objectFit:"contain", objectPosition:"left" }}
            />
            <PanelDots current={1} />
          </div>

          {/* Alt: İsim + ünvan */}
          <div style={{ position:"absolute", bottom:PADY, left:PADX, right:PADX }}>
            {/* Unvan badge */}
            <div style={{
              display:"inline-flex", alignItems:"center", gap:px(10),
              background:"rgba(56,189,248,0.15)", border:"1px solid rgba(56,189,248,0.38)",
              borderRadius:px(100), padding:`${px(12)}px ${px(26)}px`,
              marginBottom:px(20),
            }}>
              <div style={{ width:px(9), height:px(9), borderRadius:"50%", background:ACCENT }} />
              <span style={{ fontSize:px(17), fontWeight:700, letterSpacing:"0.15em", color:"#7dd3fc", textTransform:"uppercase", fontFamily:'"Plus Jakarta Sans", sans-serif' }}>
                KURUCU & EĞİTMEN
              </span>
            </div>

            {/* İsim */}
            <div style={{ fontSize:px(62), fontWeight:900, color:WHITE, letterSpacing:"-0.02em", lineHeight:1, marginBottom:px(8) }}>
              Didem
            </div>
            <div style={{ fontSize:px(62), fontWeight:900, color:ACCENT, letterSpacing:"-0.02em", lineHeight:1, marginBottom:px(28) }}>
              İmamoğlu
            </div>

            <BottomLine n={1} />
          </div>
        </div>


        {/* ══════════════════════════════════════
            PANEL 2 — MESAJ
        ══════════════════════════════════════ */}
        <div style={{
          width:px(W), height:px(W), flexShrink:0,
          display:"flex", flexDirection:"column",
          justifyContent:"space-between",
          padding:`${PADY}px ${PADX}px`,
          boxSizing:"border-box",
          background:"linear-gradient(135deg, #060d1e 0%, #0b1e3c 35%, #112d58 65%, #0d2448 100%)",
          position:"relative",
        }}>

          {/* Dekoratif orb */}
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
            {/* Eyebrow */}
            <div style={{ fontSize:px(17), fontWeight:700, letterSpacing:"0.2em", color:ACCENT, textTransform:"uppercase", fontFamily:'"Plus Jakarta Sans", sans-serif', marginBottom:px(24) }}>
              BİZİ TANIYIN
            </div>

            {/* Başlık */}
            <div style={{ fontSize:px(68), fontWeight:900, color:WHITE, lineHeight:0.95, letterSpacing:"-0.025em", marginBottom:px(16) }}>
              Merhaba, biz
            </div>
            <div style={{ fontSize:px(68), fontWeight:900, lineHeight:0.95, letterSpacing:"-0.025em", marginBottom:px(14) }}>
              <span style={{ color:ACCENT }}>Sphere English'in</span>
            </div>
            <div style={{ fontSize:px(68), fontWeight:900, color:WHITE, lineHeight:0.95, letterSpacing:"-0.025em", marginBottom:px(36) }}>
              kurucularıyız.
            </div>

            {/* Divider */}
            <div style={{ width:px(64), height:px(5), background:`linear-gradient(to right, rgba(56,189,248,0.15), ${ACCENT}, rgba(56,189,248,0.15))`, borderRadius:px(3), marginBottom:px(36) }} />

            {/* Hikaye metni */}
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
            PANEL 3 — MERVE FOTOĞRAF
        ══════════════════════════════════════ */}
        <div style={{ width:px(W), height:px(W), flexShrink:0, position:"relative", overflow:"hidden" }}>

          {/* Fotoğraf */}
          <img
            src="/images/founder-merve.jpeg"
            alt="Merve Eş"
            style={{
              position:"absolute", inset:0, width:"100%", height:"100%",
              objectFit:"cover", objectPosition:"center top",
            }}
          />

          {/* Üst overlay */}
          <div style={{ position:"absolute", top:0, left:0, right:0, height:px(260), background:"linear-gradient(to bottom, rgba(4,15,30,0.82) 0%, transparent 100%)", pointerEvents:"none" }} />

          {/* Alt overlay */}
          <div style={{ position:"absolute", bottom:0, left:0, right:0, height:px(340), background:"linear-gradient(to top, rgba(4,15,30,0.96) 0%, rgba(4,15,30,0.7) 60%, transparent 100%)", pointerEvents:"none" }} />

          {/* Üst: Logo + dots */}
          <div style={{ position:"absolute", top:PADY, left:PADX, right:PADX, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <img src="/images/logo-full.png" alt="Sphere English"
              style={{ height:px(120), width:"auto", filter:"brightness(0) invert(1)", objectFit:"contain", objectPosition:"left" }}
            />
            <PanelDots current={3} />
          </div>

          {/* Alt: İsim + ünvan */}
          <div style={{ position:"absolute", bottom:PADY, left:PADX, right:PADX }}>
            {/* Unvan badge */}
            <div style={{
              display:"inline-flex", alignItems:"center", gap:px(10),
              background:"rgba(56,189,248,0.15)", border:"1px solid rgba(56,189,248,0.38)",
              borderRadius:px(100), padding:`${px(12)}px ${px(26)}px`,
              marginBottom:px(20),
            }}>
              <div style={{ width:px(9), height:px(9), borderRadius:"50%", background:ACCENT }} />
              <span style={{ fontSize:px(17), fontWeight:700, letterSpacing:"0.15em", color:"#7dd3fc", textTransform:"uppercase", fontFamily:'"Plus Jakarta Sans", sans-serif' }}>
                KURUCU & EĞİTMEN
              </span>
            </div>

            {/* İsim */}
            <div style={{ fontSize:px(62), fontWeight:900, color:WHITE, letterSpacing:"-0.02em", lineHeight:1, marginBottom:px(8) }}>
              Merve
            </div>
            <div style={{ fontSize:px(62), fontWeight:900, color:ACCENT, letterSpacing:"-0.02em", lineHeight:1, marginBottom:px(28) }}>
              Eş
            </div>

            <BottomLine n={3} />
          </div>
        </div>

      </div>
    </div>
  );
}
