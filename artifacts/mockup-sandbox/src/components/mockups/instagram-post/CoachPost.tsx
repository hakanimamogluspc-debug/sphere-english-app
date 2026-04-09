import { useEffect } from "react";

const S = 2;
const px = (n: number) => n * S;

const COACHES = [
  { id: "sterling",  name: "Mr. Sterling",  flag: "🇬🇧", specialty: "CEO & Stratejik Yönetim",       accent: "Üst Segment İngiliz (RP)",          color: "#1E3A5F", tagline: "Boardroom'da geçirilen 30 yıl, tek bir cümleye sığar.",  traits: ["Otoriter","Lakonik","Vizyon Odaklı"], image: "coach-sterling.png",      bg: "linear-gradient(145deg,#0a1628 0%,#1E3A5F 60%,#0d2040 100%)" },
  { id: "jake",      name: "Jake",           flag: "🇺🇸", specialty: "Pazarlama & Dijital Medya",      accent: "West Coast Amerikan",               color: "#EA580C", tagline: "San Francisco'dan dünyaya — İngilizceyi enerjinle konuş.", traits: ["Enerjik","Yaratıcı","Trendy"],         image: "coach-jake.png",          bg: "linear-gradient(145deg,#1a0a02 0%,#7c2d00 60%,#431400 100%)" },
  { id: "david",     name: "David",          flag: "🇺🇸", specialty: "Finans & Yatırım",              accent: "New York (Wall Street)",            color: "#0369A1", tagline: "Rakamlar yalan söylemez, ama doğru İngilizce konuşmanız gerek.", traits: ["Analitik","Direkt","Risk Odaklı"],     image: "coach-david.png",         bg: "linear-gradient(145deg,#02111f 0%,#0369A1 60%,#013f6b 100%)" },
  { id: "emma",      name: "Emma",           flag: "🇬🇧", specialty: "İnsan Kaynakları",              accent: "Standart İngiliz (London)",         color: "#BE185D", tagline: "İyi iletişim, her kapıyı açar.",                       traits: ["Empatik","Yapılandırılmış","Destekleyici"], image: "coach-emma-hr.png", bg: "linear-gradient(145deg,#1a0010 0%,#7d0f3d 60%,#3d0020 100%)" },
  { id: "raj",       name: "Raj",            flag: "🇮🇳", specialty: "BT & Yazılım Geliştirme",       accent: "Hint-İngiliz (Global Tech)",        color: "#7C3AED", tagline: "Bangalore'dan Londra'ya — teknolojiyi İngilizce anlat.", traits: ["Sistematik","Teknik","İş Birlikçi"],   image: "coach-raj.png",           bg: "linear-gradient(145deg,#0d0020 0%,#4c1d95 60%,#2e1065 100%)" },
  { id: "hans",      name: "Hans",           flag: "🇩🇪", specialty: "Lojistik & Operasyon",          accent: "Alman-İngiliz (Euro-English)",      color: "#4B5563", tagline: "Hamburg'un hassasiyeti, küresel iş İngilizcesiyle buluşuyor.", traits: ["Metodolojik","Hassas","Süreç Odaklı"], image: "coach-hans.png",         bg: "linear-gradient(145deg,#0a0c0f 0%,#1f2937 60%,#111827 100%)" },
  { id: "elena",     name: "Elena",          flag: "🇪🇺", specialty: "Uluslararası Hukuk",            accent: "Diplomatik (Doğu Avrupa)",          color: "#059669", tagline: "Brüksel müzakere masasında her kelime kritik.",        traits: ["Kesin","Diplomatik","Mükemmeliyetçi"], image: "coach-elena.png",        bg: "linear-gradient(145deg,#00150d 0%,#065F46 60%,#022c20 100%)" },
  { id: "alistair",  name: "Alistair",       flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", specialty: "Satış & Müzakere",          accent: "İskoç (Edinburgh)",                 color: "#DC2626", tagline: "Edinburgh'dan gelen ikna gücü ile her anlaşmayı kapatın.", traits: ["İkna Edici","Stratejik","Israrcı"],    image: "coach-alistair.png",      bg: "linear-gradient(145deg,#1a0000 0%,#7f1d1d 60%,#450a0a 100%)" },
  { id: "chloe",     name: "Chloe",          flag: "🇦🇺", specialty: "Müşteri İlişkileri",            accent: "Avusturalyalı (Friendly)",          color: "#D97706", tagline: "Sydney'nin sıcaklığıyla müşteri ilişkilerinde fark yarat.", traits: ["Sıcak","Samimi","Çözüm Odaklı"],       image: "coach-chloe.png",         bg: "linear-gradient(145deg,#1a0d00 0%,#78350f 60%,#431b00 100%)" },
  { id: "james",     name: "James",          flag: "🇺🇸", specialty: "Üretim & Fabrika Yönetimi",    accent: "Amerikan (Midwest)",                color: "#92400E", tagline: "Ohio'dan gelen pratik İngilizce — işe yarar, hızlı etkili.", traits: ["Pratik","Güvenilir","Direkt"],         image: "coach-james-mfg.png",     bg: "linear-gradient(145deg,#140800 0%,#451a03 60%,#1c0a00 100%)" },
  { id: "claire",    name: "Dr. Claire",     flag: "🇬🇧", specialty: "Gramer & İleri Telaffuz",      accent: "Akademik İngiliz (Oxford)",         color: "#0D9488", tagline: "Oxford kürsüsünden — dil nüanslarını mükemmelleştirin.", traits: ["Titiz","Sabırlı","Akademik"],          image: "coach-claire-grammar.png", bg: "linear-gradient(145deg,#001412 0%,#134e4a 60%,#042f2e 100%)" },
  { id: "olivia",    name: "Dr. Olivia",     flag: "🇺🇸", specialty: "Sağlık Turizmi İngilizcesi",  accent: "Amerikan (Miami / Sağlık Turizmi)", color: "#0891b2", tagline: "Miami'den küresel hastalara — sağlık İngilizcesini öğrenin.", traits: ["Profesyonel","Kültürel Farkındalıklı","Sıcak"], image: "coach-olivia-health.png", bg: "linear-gradient(145deg,#001520 0%,#164e63 60%,#0a2535 100%)" },
];

export default function CoachPost() {
  const params = new URLSearchParams(window.location.search);
  const coachId = params.get("coach") || "sterling";
  const coach = COACHES.find(c => c.id === coachId) || COACHES[0];

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap";
    document.head.appendChild(link);
    document.body.style.cssText = "margin:0;padding:0;overflow:hidden;";
  }, []);

  const W = px(1080);
  const H = px(1080);

  return (
    <div style={{
      width: W, height: H, overflow: "hidden", position: "relative",
      background: coach.bg,
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      display: "flex", flexDirection: "column",
    }}>
      {/* Subtle grid */}
      <div style={{ position:"absolute", inset:0, opacity:0.03, pointerEvents:"none",
        backgroundImage:"linear-gradient(rgba(255,255,255,.8) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.8) 1px,transparent 1px)",
        backgroundSize:`${px(54)}px ${px(54)}px`,
      }}/>

      {/* Color glow – coach brand color */}
      <div style={{ position:"absolute", top:px(-200), right:px(-200), width:px(700), height:px(700), borderRadius:"50%", pointerEvents:"none",
        background:`radial-gradient(circle, ${coach.color}40 0%, transparent 65%)`,
      }}/>
      <div style={{ position:"absolute", bottom:px(-100), left:px(-100), width:px(400), height:px(400), borderRadius:"50%", pointerEvents:"none",
        background:`radial-gradient(circle, ${coach.color}20 0%, transparent 70%)`,
      }}/>

      {/* ── TOP BAR ── */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:`${px(48)}px ${px(60)}px 0` }}>
        <img src="/images/logo-full.png" alt="Sphere English"
          style={{ height:px(28), width:"auto", filter:"brightness(0) invert(1)", objectFit:"contain", opacity:0.9 }}
        />
        <div style={{
          display:"flex", alignItems:"center", gap:px(8),
          background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.15)",
          borderRadius:px(100), padding:`${px(8)}px ${px(20)}px`,
        }}>
          <span style={{ fontSize:px(16) }}>{coach.flag}</span>
          <span style={{ fontFamily:"'Outfit',sans-serif", fontWeight:600, fontSize:px(12),
            color:"rgba(255,255,255,0.8)", letterSpacing:"0.06em" }}>
            AI KOÇLARIMIZ
          </span>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{ flex:1, display:"flex", alignItems:"center", padding:`0 ${px(60)}px ${px(16)}px`, gap:px(48) }}>

        {/* Coach photo */}
        <div style={{ position:"relative", flexShrink:0 }}>
          {/* Glow ring behind photo */}
          <div style={{
            position:"absolute", inset:px(-12), borderRadius:"50%",
            background:`radial-gradient(circle, ${coach.color}50 0%, transparent 70%)`,
            filter:`blur(${px(16)}px)`,
          }}/>
          <div style={{
            width:px(320), height:px(320), borderRadius:px(32), overflow:"hidden",
            border:`${px(3)}px solid ${coach.color}80`,
            boxShadow:`0 ${px(24)}px ${px(64)}px ${coach.color}40`,
            position:"relative",
          }}>
            <img src={`/images/${coach.image}`} alt={coach.name}
              style={{ width:"100%", height:"100%", objectFit:"cover", objectPosition:"top center" }}
            />
          </div>
        </div>

        {/* Info */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", gap:px(16), paddingBottom:px(8) }}>

          {/* Specialty tag */}
          <div style={{
            display:"inline-flex", alignItems:"center", alignSelf:"flex-start",
            background:"rgba(255,255,255,0.12)", border:`${px(1)}px solid rgba(255,255,255,0.25)`,
            borderRadius:px(100), padding:`${px(6)}px ${px(16)}px`,
          }}>
            <span style={{ fontFamily:"'Outfit',sans-serif", fontWeight:700, fontSize:px(11),
              color:"rgba(255,255,255,0.90)", letterSpacing:"0.08em", textTransform:"uppercase" }}>
              {coach.specialty}
            </span>
          </div>

          {/* Name */}
          <div>
            <h2 style={{ fontFamily:"'Outfit',sans-serif", fontWeight:900, fontSize:px(56),
              color:"#fff", margin:0, lineHeight:1.0, letterSpacing:"-0.02em" }}>
              {coach.name}
            </h2>
            <p style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:600, fontSize:px(16),
              color:"rgba(255,255,255,0.60)", margin:`${px(8)}px 0 0`, letterSpacing:"0.02em" }}>
              🗣 {coach.accent}
            </p>
          </div>

          {/* Tagline */}
          <p style={{ fontFamily:"'Outfit',sans-serif", fontWeight:600, fontSize:px(19),
            color:"rgba(255,255,255,0.85)", lineHeight:1.45, margin:0,
            borderLeft:`${px(3)}px solid ${coach.color}`, paddingLeft:px(16),
          }}>
            "{coach.tagline}"
          </p>

          {/* Trait chips */}
          <div style={{ display:"flex", gap:px(10), flexWrap:"wrap" }}>
            {coach.traits.map(t => (
              <span key={t} style={{
                fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:600, fontSize:px(11),
                color:"rgba(255,255,255,0.75)",
                background:"rgba(255,255,255,0.08)",
                border:`${px(1)}px solid rgba(255,255,255,0.15)`,
                borderRadius:px(100), padding:`${px(6)}px ${px(14)}px`,
              }}>
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── BOTTOM BAR ── */}
      <div style={{
        display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:`${px(18)}px ${px(60)}px ${px(44)}px`,
        borderTop:`${px(1)}px solid rgba(255,255,255,0.08)`,
      }}>
        <div style={{ display:"flex", flexDirection:"column", gap:px(2) }}>
          <span style={{ fontFamily:"'Outfit',sans-serif", fontWeight:700, fontSize:px(13),
            color:"rgba(255,255,255,0.9)", letterSpacing:"0.02em" }}>
            Sphere AI Studio'da Pratik Yap
          </span>
          <span style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:400, fontSize:px(11),
            color:"rgba(255,255,255,0.45)" }}>
            sphereenglish.com
          </span>
        </div>

        {/* CTA */}
        <div style={{
          background:`linear-gradient(135deg, ${coach.color}, ${coach.color}cc)`,
          borderRadius:px(100), padding:`${px(12)}px ${px(28)}px`,
          fontFamily:"'Outfit',sans-serif", fontWeight:700, fontSize:px(13),
          color:"#fff", boxShadow:`0 ${px(6)}px ${px(24)}px ${coach.color}50`,
          letterSpacing:"0.02em",
        }}>
          Hemen Konuş →
        </div>
      </div>
    </div>
  );
}
