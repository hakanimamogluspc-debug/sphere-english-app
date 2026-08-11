import { useEffect } from "react";

const S = 2; // scale multiplier — render at 2× for high resolution

const BRAND = {
  primary: "#1e3a6e",
  accent: "#0ea5e9",
  accentLight: "#38bdf8",
  white: "#ffffff",
  muted: "rgba(255,255,255,0.55)",
  cardBase: "rgba(255,255,255,0.06)",
  cardHighlight: "rgba(14,165,233,0.15)",
  border: "rgba(255,255,255,0.10)",
  borderAccent: "rgba(14,165,233,0.45)",
};

const px = (n: number) => n * S;

function SparkleIcon() {
  return (
    <svg width={px(16)} height={px(16)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .962 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.962 0z"/>
    </svg>
  );
}

const features = [
  {
    emoji: "🎙️",
    label: "Telaffuz Koçu",
    tag: "PRONUNCIATION COACH",
    desc: "Sesin gerçek zamanlı analiz edilir. İntonasyon, vurgu ve aksan hataları anında düzeltilir. IPA tabanlı geri bildirimle konuşman her gün netleşir.",
    highlight: true,
  },
  {
    emoji: "✍️",
    label: "Yazma Koçu",
    tag: "WRITING COACH",
    desc: "E-posta, rapor, akademik metin ve iş yazışmalarını AI ile geliştir. Dilbilgisi, ton ve bağlam analizi birlikte sunulur.",
    highlight: false,
  },
  {
    emoji: "🧠",
    label: "Dilbilgisi Koçu",
    tag: "GRAMMAR COACH",
    desc: "Tenses, conditionals, passive voice — her dilbilgisi konusu için kişiselleştirilmiş alıştırmalar. Hataları öğrene dönüştürür.",
    highlight: false,
  },
  {
    emoji: "💼",
    label: "İş Senaryoları",
    tag: "BUSINESS SIMULATIONS",
    desc: "Gerçek iş toplantıları, sunum ve müzakere senaryoları. AI karşı tarafı oynar, sen pratik yaparsın. Kurumsal İngilizce için.",
    highlight: false,
  },
  {
    emoji: "🎮",
    label: "Kelime Oyunu",
    tag: "VOCABULARY GAME",
    desc: "Seviyene göre adaptif kelime kartları ve yarışmalı skor tablosu. Eğlenceli, bağımlılık yapan, kalıcı kelime öğrenimi.",
    highlight: false,
  },
];

export default function AiStudioPost() {
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap";
    document.head.appendChild(link);
    document.body.style.margin = "0";
    document.body.style.padding = "0";
    document.body.style.background = "#000";
    document.body.style.overflow = "hidden";
  }, []);

  const W = px(1080);
  const H = px(1080);

  return (
    <div style={{ width: W, height: H, overflow: "hidden", position: "relative",
      background: `linear-gradient(150deg, #162d58 0%, ${BRAND.primary} 40%, #0d1f3f 100%)`,
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      display: "flex", flexDirection: "column",
    }}>

      {/* Grid */}
      <div style={{ position:"absolute", inset:0, opacity:0.025, pointerEvents:"none",
        backgroundImage:"linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)",
        backgroundSize:`${px(54)}px ${px(54)}px`,
      }}/>

      {/* Glow top-right */}
      <div style={{ position:"absolute", top:px(-160), right:px(-120), width:px(520), height:px(520), borderRadius:"50%",
        background:`radial-gradient(circle,${BRAND.accent}28 0%,transparent 68%)`, pointerEvents:"none",
      }}/>

      {/* Glow bottom-left */}
      <div style={{ position:"absolute", bottom:px(-80), left:px(-60), width:px(300), height:px(300), borderRadius:"50%",
        background:`radial-gradient(circle,${BRAND.accentLight}14 0%,transparent 70%)`, pointerEvents:"none",
      }}/>

      {/* ── TOP BAR ── */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:`${px(48)}px ${px(60)}px 0` }}>
        <img src="/images/logo-full.png" alt="Sphere English"
          style={{ height:px(32), width:"auto", filter:"brightness(0) invert(1)", objectFit:"contain" }}
        />
        <div style={{ display:"flex", alignItems:"center", gap:px(7),
          background:`linear-gradient(135deg,${BRAND.accent}30,${BRAND.accent}12)`,
          border:`${px(1)}px solid ${BRAND.accent}55`, borderRadius:px(100), padding:`${px(7)}px ${px(18)}px`,
        }}>
          <div style={{ color:BRAND.accentLight }}><SparkleIcon/></div>
          <span style={{ fontFamily:"'Outfit',sans-serif", fontWeight:700, fontSize:px(13), color:BRAND.accentLight, letterSpacing:"0.07em" }}>
            AI STUDIO
          </span>
        </div>
      </div>

      {/* ── HEADLINE ── */}
      <div style={{ padding:`${px(36)}px ${px(60)}px 0` }}>
        <div style={{ display:"inline-flex", alignItems:"center", gap:px(10),
          borderLeft:`${px(3)}px solid ${BRAND.accent}`, paddingLeft:px(14), marginBottom:px(14),
        }}>
          <span style={{ fontFamily:"'Outfit',sans-serif", fontWeight:600, fontSize:px(13), color:BRAND.accentLight, letterSpacing:"0.1em", textTransform:"uppercase" }}>
            Yapay Zeka ile İngilizce Öğren
          </span>
        </div>
        <h1 style={{ fontFamily:"'Outfit',sans-serif", fontWeight:900, fontSize:px(64), lineHeight:1.0,
          color:BRAND.white, margin:0, letterSpacing:"-0.025em",
        }}>
          5 Akıllı Koç.<br/>
          <span style={{ color:BRAND.accentLight }}>Sınırsız Pratik.</span>
        </h1>
        <p style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:400, fontSize:px(17),
          color:BRAND.muted, margin:`${px(14)}px 0 0`, lineHeight:1.55,
        }}>
          Konuş, yaz, dinle, analiz et — her beceri için ayrı bir AI koç.
        </p>
      </div>

      {/* ── CARDS ── */}
      <div style={{ padding:`${px(28)}px ${px(60)}px 0`,
        display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:px(12), flex:1,
      }}>
        {features.map((f, i) => (
          <div key={i} style={{
            background: f.highlight ? BRAND.cardHighlight : BRAND.cardBase,
            border:`${px(1)}px solid ${f.highlight ? BRAND.borderAccent : BRAND.border}`,
            borderRadius:px(18), padding:`${px(20)}px ${px(18)}px`,
            position:"relative", overflow:"hidden",
            display:"flex", flexDirection:"column", gap:px(8),
          }}>
            {f.highlight && (
              <div style={{ position:"absolute", top:0, right:0, width:px(90), height:px(90),
                background:`radial-gradient(circle at top right,${BRAND.accent}35,transparent 70%)`,
              }}/>
            )}
            <div style={{ fontSize:px(22), lineHeight:1 }}>{f.emoji}</div>
            <div>
              <div style={{ fontFamily:"'Outfit',sans-serif", fontWeight:700, fontSize:px(15), color:BRAND.white, marginBottom:px(2) }}>
                {f.label}
              </div>
              <div style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:500, fontSize:px(10), color:BRAND.accentLight, letterSpacing:"0.05em" }}>
                {f.tag}
              </div>
            </div>
            <div style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:400, fontSize:px(11.5),
              color:"rgba(255,255,255,0.62)", lineHeight:1.6, flex:1,
            }}>
              {f.desc}
            </div>
          </div>
        ))}
      </div>

      {/* ── BOTTOM ── */}
      <div style={{ padding:`${px(24)}px ${px(60)}px ${px(48)}px`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", gap:px(32) }}>
          {[["12+","Koç Karakteri"],["5","AI Modülü"],["7/24","Erişim"]].map(([v,l]) => (
            <div key={l} style={{ display:"flex", flexDirection:"column", gap:px(2) }}>
              <span style={{ fontFamily:"'Outfit',sans-serif", fontWeight:800, fontSize:px(26), color:BRAND.white, lineHeight:1 }}>{v}</span>
              <span style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:400, fontSize:px(11), color:BRAND.muted }}>{l}</span>
            </div>
          ))}
        </div>
        <div style={{ height:px(36), width:px(1), background:BRAND.border }}/>
        <div style={{
          background:`linear-gradient(135deg,${BRAND.accent},${BRAND.accentLight})`,
          borderRadius:px(100), padding:`${px(13)}px ${px(30)}px`,
          fontFamily:"'Outfit',sans-serif", fontWeight:700, fontSize:px(15),
          color:BRAND.white, boxShadow:`0 ${px(6)}px ${px(28)}px ${BRAND.accent}55`,
        }}>
          sphereenglish.com
        </div>
      </div>
    </div>
  );
}
