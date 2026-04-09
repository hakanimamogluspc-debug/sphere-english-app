const S = 2;
const px = (n: number) => n * S;
const W = 1080;

const PRIMARY = "#1e3a6e";
const ACCENT  = "#38bdf8";
const GOLD    = "#f59e0b";
const WHITE   = "#ffffff";

interface Coach {
  name: string;
  flag: string;
  specialty: string;
  image: string;
  color: string;
  isSterling?: boolean;
}

/* 12 koç — Panel sırası: 4 + 4 + 4 */
const ALL_COACHES: Coach[] = [
  /* Panel 1 */
  { name: "Jake",      flag: "🇺🇸", specialty: "Pazarlama & Dijital", image: "coach-jake.png",          color: "#EA580C" },
  { name: "David",     flag: "🇺🇸", specialty: "Finans & Yatırım",    image: "coach-david.png",         color: "#0369A1" },
  { name: "Emma",      flag: "🇬🇧", specialty: "İnsan Kaynakları",    image: "coach-emma-hr.png",       color: "#BE185D" },
  { name: "Raj",       flag: "🇮🇳", specialty: "BT & Yazılım",        image: "coach-raj.png",           color: "#7C3AED" },
  /* Panel 2 */
  { name: "Hans",      flag: "🇩🇪", specialty: "Lojistik & Operasyon",image: "coach-hans.png",          color: "#4B5563" },
  { name: "Mr. Sterling", flag: "🇬🇧", specialty: "CEO & Stratejik Yönetim", image: "coach-sterling.png", color: PRIMARY, isSterling: true },
  { name: "Elena",     flag: "🇪🇺", specialty: "Uluslararası Hukuk",  image: "coach-elena.png",         color: "#059669" },
  { name: "Alistair",  flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", specialty: "Satış & Müzakere",   image: "coach-alistair.png",      color: "#DC2626" },
  /* Panel 3 */
  { name: "Chloe",     flag: "🇦🇺", specialty: "Müşteri İlişkileri",  image: "coach-chloe.png",         color: "#D97706" },
  { name: "James",     flag: "🇺🇸", specialty: "Üretim & Fabrika",    image: "coach-james-mfg.png",     color: "#92400E" },
  { name: "Dr. Claire",flag: "🇬🇧", specialty: "Gramer & Telaffuz",   image: "coach-claire-grammar.png",color: "#0D9488" },
  { name: "Dr. Olivia",flag: "🇺🇸", specialty: "Sağlık Turizmi",      image: "coach-olivia-health.png", color: "#0891b2" },
];

/* Panel başına alt şerit mesajları */
const BOTTOM_MESSAGES = [
  { line1: "Küresel Sahneye Açılmaya",    line2: "Hazır Mısınız?",                line2Color: ACCENT },
  { line1: "12 Farklı Bakış Açısı,",      line2: "Tek Bir Ortak Hedef",           line2Color: ACCENT },
  { line1: "İş İngilizcesinde Gerçek Başarı",  line2: "ve Küresel Özgüven",       line2Color: ACCENT },
];

/* Dikey ince ayırıcı çizgi */
const Divider = () => (
  <div style={{
    width: px(1),
    height: px(340),
    background: "linear-gradient(to bottom, transparent, rgba(30,58,110,0.10) 30%, rgba(30,58,110,0.10) 70%, transparent)",
    flexShrink: 0,
    alignSelf: "center",
  }} />
);

/* Tek koç kartı */
const CoachCard = ({ coach }: { coach: Coach }) => {
  const isSterling = !!coach.isSterling;
  const photoD = isSterling ? px(200) : px(172);

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: px(18),
      flex: 1,
      position: "relative",
      padding: `${px(32)}px ${px(8)}px ${px(28)}px`,
      background: isSterling
        ? "linear-gradient(175deg, #e8f2ff 0%, #f0f7ff 60%, #daeeff 100%)"
        : "transparent",
      borderRadius: isSterling ? px(28) : 0,
      boxShadow: isSterling
        ? `0 ${px(16)}px ${px(60)}px rgba(30,58,110,0.14), 0 0 0 ${px(2)}px rgba(30,58,110,0.18)`
        : "none",
      zIndex: isSterling ? 2 : 1,
      marginTop:    isSterling ? px(-24) : 0,
      marginBottom: isSterling ? px(-24) : 0,
    }}>

      {isSterling && (
        <div style={{
          position: "absolute",
          top: px(-2),
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: px(28),
          lineHeight: 1,
          color: GOLD,
          filter: "drop-shadow(0 2px 4px rgba(245,158,11,0.5))",
        }}>★</div>
      )}

      {/* Fotoğraf çemberi */}
      <div style={{
        width: photoD,
        height: photoD,
        borderRadius: "50%",
        overflow: "hidden",
        flexShrink: 0,
        border: isSterling
          ? `${px(4)}px solid ${GOLD}`
          : `${px(2)}px solid rgba(30,58,110,0.12)`,
        boxShadow: isSterling
          ? `0 0 0 ${px(6)}px rgba(245,158,11,0.18), 0 ${px(16)}px ${px(48)}px rgba(30,58,110,0.22)`
          : `0 ${px(6)}px ${px(20)}px rgba(30,58,110,0.10)`,
        background: "#e8effa",
      }}>
        <img
          src={`/images/${coach.image}`}
          alt={coach.name}
          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center", display: "block" }}
        />
      </div>

      {/* İsim + uzmanlık */}
      <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: px(5) }}>
        <div style={{
          fontSize: px(isSterling ? 20 : 16),
          fontWeight: 800,
          color: PRIMARY,
          fontFamily: '"Outfit", sans-serif',
          lineHeight: 1.1,
          letterSpacing: isSterling ? "-0.01em" : 0,
        }}>
          {coach.flag} {coach.name}
        </div>
        <div style={{
          fontSize: px(11),
          fontWeight: 500,
          color: isSterling ? "rgba(30,58,110,0.72)" : "rgba(30,58,110,0.45)",
          fontFamily: '"Plus Jakarta Sans", sans-serif',
          letterSpacing: "0.01em",
          lineHeight: 1.3,
        }}>
          {coach.specialty}
        </div>
      </div>

      {isSterling && (
        <div style={{
          background: PRIMARY,
          color: WHITE,
          fontSize: px(10),
          fontWeight: 700,
          letterSpacing: "0.08em",
          fontFamily: '"Plus Jakarta Sans", sans-serif',
          borderRadius: px(100),
          padding: `${px(6)}px ${px(16)}px`,
        }}>
          KURUCU KOÇ
        </div>
      )}
    </div>
  );
};

/* Tek panel */
const Panel = ({ coaches, msgIndex }: { coaches: Coach[]; msgIndex: number }) => {
  const msg = BOTTOM_MESSAGES[msgIndex];

  return (
    <div style={{
      width: px(W),
      height: px(W),
      flexShrink: 0,
      background: "#ffffff",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Hafif arka plan dokusu */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: `radial-gradient(circle, rgba(30,58,110,0.035) 1px, transparent 1px)`,
        backgroundSize: `${px(32)}px ${px(32)}px`,
        pointerEvents: "none",
      }} />

      {/* Orta ışık tonu */}
      <div style={{
        position: "absolute",
        top: px(140), left: 0, right: 0,
        height: px(560),
        background: "linear-gradient(to bottom, rgba(56,189,248,0.03) 0%, rgba(56,189,248,0.06) 50%, rgba(56,189,248,0.03) 100%)",
        pointerEvents: "none",
      }} />

      {/* Üst şerit */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0,
        height: px(140),
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: `0 ${px(56)}px`,
        zIndex: 10,
        background: "rgba(255,255,255,0.96)",
        borderBottom: `${px(1)}px solid rgba(30,58,110,0.07)`,
      }}>
        <img
          src="/images/logo-full.png"
          alt="Sphere English"
          style={{
            height: px(90),
            width: "auto",
            objectFit: "contain",
            objectPosition: "left",
            filter: "brightness(0) saturate(100%) invert(14%) sepia(45%) saturate(1200%) hue-rotate(196deg) brightness(90%)",
          }}
        />
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: px(10),
          background: "rgba(30,58,110,0.07)",
          borderRadius: px(100),
          padding: `${px(10)}px ${px(24)}px`,
        }}>
          <div style={{ width: px(10), height: px(10), borderRadius: "50%", background: ACCENT }} />
          <span style={{
            fontSize: px(14),
            fontWeight: 700,
            color: PRIMARY,
            fontFamily: '"Plus Jakarta Sans", sans-serif',
            letterSpacing: "0.06em",
          }}>12 UZMAN KOÇ</span>
        </div>
      </div>

      {/* Koçlar */}
      <div style={{
        position: "absolute",
        top: px(140),
        bottom: px(220),
        left: px(12),
        right: px(12),
        display: "flex",
        alignItems: "center",
        gap: 0,
      }}>
        {coaches.map((coach, i) => (
          <div key={coach.name} style={{ display: "flex", alignItems: "stretch", flex: 1 }}>
            <CoachCard coach={coach} />
            {i < coaches.length - 1 && <Divider />}
          </div>
        ))}
      </div>

      {/* Alt şerit — panele özel mesaj */}
      <div style={{
        position: "absolute",
        bottom: 0, left: 0, right: 0,
        height: px(220),
        background: `linear-gradient(135deg, #060d1e 0%, #0b1e3c 50%, #112d58 100%)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: px(7),
        zIndex: 10,
      }}>
        <div style={{
          fontSize: px(27),
          fontWeight: 900,
          color: WHITE,
          fontFamily: '"Outfit", sans-serif',
          letterSpacing: "-0.02em",
          lineHeight: 1,
          textAlign: "center",
          padding: `0 ${px(40)}px`,
        }}>
          {msg.line1}
        </div>
        <div style={{
          fontSize: px(27),
          fontWeight: 900,
          color: msg.line2Color,
          fontFamily: '"Outfit", sans-serif',
          letterSpacing: "-0.02em",
          lineHeight: 1,
          textAlign: "center",
          padding: `0 ${px(40)}px`,
        }}>
          {msg.line2}
        </div>
        <div style={{
          fontSize: px(12),
          fontWeight: 500,
          color: "rgba(255,255,255,0.30)",
          fontFamily: '"Plus Jakarta Sans", sans-serif',
          marginTop: px(4),
          letterSpacing: "0.06em",
        }}>
          sphereenglish.com
        </div>
      </div>
    </div>
  );
};

export default function TeamPost() {
  const params = new URLSearchParams(window.location.search);
  const panel  = parseInt(params.get("panel") || "1");
  const offset = (panel - 1) * px(W);

  const panels = [
    ALL_COACHES.slice(0, 4),
    ALL_COACHES.slice(4, 8),
    ALL_COACHES.slice(8, 12),
  ];

  return (
    <div style={{
      width: px(W),
      height: px(W),
      overflow: "hidden",
      fontFamily: '"Outfit", sans-serif',
      background: "#ffffff",
    }}>
      <div style={{
        width: px(W * 3),
        height: px(W),
        position: "absolute",
        left: -offset,
        display: "flex",
      }}>
        {panels.map((coaches, i) => (
          <Panel key={i} coaches={coaches} msgIndex={i} />
        ))}
      </div>
    </div>
  );
}
