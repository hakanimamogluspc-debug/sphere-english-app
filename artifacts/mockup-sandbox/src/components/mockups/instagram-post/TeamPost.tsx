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
  isSterling?: boolean;
}

/* ── Panel 1: 4 koç ── */
const P1_COACHES: Coach[] = [
  { name: "Jake",      flag: "🇺🇸", specialty: "Pazarlama & Dijital", image: "coach-jake.png"          },
  { name: "David",     flag: "🇺🇸", specialty: "Finans & Yatırım",    image: "coach-david.png"         },
  { name: "Emma",      flag: "🇬🇧", specialty: "İnsan Kaynakları",    image: "coach-emma-hr.png"       },
  { name: "Chloe",     flag: "🇦🇺", specialty: "Müşteri İlişkileri",  image: "coach-chloe.png"         },
];

/* ── Panel 2: 5 koç — farklı yükseklikler ── */
/* Sıra: Raj | Hans | Sterling | Elena | Alistair */
interface Coach2 extends Coach {
  /* avatar merkezinin üstten mantıksal px mesafesi */
  avatarCenterY: number;
  avatarD: number; /* çap (logical px) */
}

const CONTENT_BOTTOM = 860; /* alt şeridin üstü */

const P2_COACHES: Coach2[] = [
  /* Raj — en az boşluk (avatar en altta) */
  { name: "Raj",       flag: "🇮🇳", specialty: "BT & Yazılım",         image: "coach-raj.png",          avatarCenterY: 475, avatarD: 154 },
  /* Hans — orta */
  { name: "Hans",      flag: "🇩🇪", specialty: "Lojistik & Operasyon", image: "coach-hans.png",          avatarCenterY: 415, avatarD: 166 },
  /* Sterling — en çok boşluk (avatar en yukarda) */
  { name: "Mr. Sterling", flag: "🇬🇧", specialty: "CEO & Stratejik Yönetim", image: "coach-sterling.png", avatarCenterY: 355, avatarD: 188, isSterling: true },
  /* Elena — orta */
  { name: "Elena",     flag: "🇪🇺", specialty: "Uluslararası Hukuk",   image: "coach-elena.png",         avatarCenterY: 415, avatarD: 166 },
  /* Alistair — en az boşluk (avatar en altta) */
  { name: "Alistair",  flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", specialty: "Satış & Müzakere",    image: "coach-alistair.png",      avatarCenterY: 475, avatarD: 154 },
];

/* ── Panel 3: 3 koç ── */
const P3_COACHES: Coach[] = [
  { name: "James",      flag: "🇺🇸", specialty: "Üretim & Fabrika",  image: "coach-james-mfg.png"     },
  { name: "Dr. Claire", flag: "🇬🇧", specialty: "Gramer & Telaffuz", image: "coach-claire-grammar.png"},
  { name: "Dr. Olivia", flag: "🇺🇸", specialty: "Sağlık Turizmi",   image: "coach-olivia-health.png" },
];

const BOTTOM_MESSAGES = [
  { line1: "Küresel Sahneye Açılmaya",        line2: "Hazır Mısınız?"                    },
  { line1: "12 Farklı Bakış Açısı,",          line2: "Tek Bir Ortak Hedef"               },
  { line1: "İş İngilizcesinde Gerçek Başarı", line2: "ve Küresel Özgüven"                },
];

/* ── Dikey ayırıcı ── */
const Divider = ({ h = 340 }: { h?: number }) => (
  <div style={{
    width: px(1),
    height: px(h),
    flexShrink: 0,
    alignSelf: "center",
    background: "linear-gradient(to bottom, transparent, rgba(30,58,110,0.10) 30%, rgba(30,58,110,0.10) 70%, transparent)",
  }} />
);

/* ── Alt şerit ── */
const BottomBar = ({ msg }: { msg: typeof BOTTOM_MESSAGES[0] }) => (
  <div style={{
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    height: px(220),
    background: "linear-gradient(135deg, #060d1e 0%, #0b1e3c 50%, #112d58 100%)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: px(7),
    zIndex: 10,
  }}>
    <div style={{
      fontSize: px(27), fontWeight: 900, color: WHITE,
      fontFamily: '"Outfit", sans-serif',
      letterSpacing: "-0.02em", lineHeight: 1,
      textAlign: "center", padding: `0 ${px(40)}px`,
    }}>{msg.line1}</div>
    <div style={{
      fontSize: px(27), fontWeight: 900, color: ACCENT,
      fontFamily: '"Outfit", sans-serif',
      letterSpacing: "-0.02em", lineHeight: 1,
      textAlign: "center", padding: `0 ${px(40)}px`,
    }}>{msg.line2}</div>
    <div style={{
      fontSize: px(12), fontWeight: 500,
      color: "rgba(255,255,255,0.30)",
      fontFamily: '"Plus Jakarta Sans", sans-serif',
      marginTop: px(4), letterSpacing: "0.06em",
    }}>sphereenglish.com</div>
  </div>
);

/* ── Panel 1 / 3: flex layout ── */
const StandardPanel = ({ coaches, msgIdx }: { coaches: Coach[]; msgIdx: number }) => (
  <div style={{
    width: px(W), height: px(W), flexShrink: 0,
    position: "relative", overflow: "hidden",
    background: "linear-gradient(175deg, #dff0fa 0%, #f1f8fc 45%, #ffffff 100%)",
  }}>
    <div style={{
      position: "absolute", inset: 0,
      backgroundImage: "radial-gradient(circle, rgba(30,58,110,0.030) 1px, transparent 1px)",
      backgroundSize: `${px(32)}px ${px(32)}px`,
      pointerEvents: "none",
    }} />

    {/* Koçlar */}
    <div style={{
      position: "absolute",
      top: px(60), bottom: px(220),
      left: px(12), right: px(12),
      display: "flex", alignItems: "center",
    }}>
      {coaches.map((c, i) => (
        <div key={c.name} style={{ display: "flex", alignItems: "stretch", flex: 1 }}>
          <div style={{
            flex: 1, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            gap: px(18), padding: `${px(24)}px ${px(8)}px`,
          }}>
            {/* Fotoğraf çemberi */}
            <div style={{
              width: px(172), height: px(172), borderRadius: "50%",
              overflow: "hidden", flexShrink: 0,
              border: `${px(2)}px solid rgba(30,58,110,0.12)`,
              boxShadow: `0 ${px(6)}px ${px(20)}px rgba(30,58,110,0.10)`,
              background: "#e8effa",
            }}>
              <img src={`/images/${c.image}`} alt={c.name}
                style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center", display: "block" }} />
            </div>
            {/* Metin */}
            <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: px(5) }}>
              <div style={{
                fontSize: px(16), fontWeight: 800, color: PRIMARY,
                fontFamily: '"Outfit", sans-serif', lineHeight: 1.1,
              }}>{c.flag} {c.name}</div>
              <div style={{
                fontSize: px(11), fontWeight: 500,
                color: "rgba(30,58,110,0.45)",
                fontFamily: '"Plus Jakarta Sans", sans-serif',
                lineHeight: 1.3,
              }}>{c.specialty}</div>
            </div>
          </div>
          {i < coaches.length - 1 && <Divider h={300} />}
        </div>
      ))}
    </div>

    <BottomBar msg={BOTTOM_MESSAGES[msgIdx]} />
  </div>
);

/* ── Panel 2: 5 koç, farklı yükseklikler ── */
const Panel2 = () => {
  const N = P2_COACHES.length;         /* 5 */
  const slotW = W / N;                  /* 216 */

  return (
    <div style={{
      width: px(W), height: px(W), flexShrink: 0,
      position: "relative", overflow: "hidden",
      background: "linear-gradient(175deg, #dff0fa 0%, #f1f8fc 45%, #ffffff 100%)",
    }}>
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "radial-gradient(circle, rgba(30,58,110,0.030) 1px, transparent 1px)",
        backgroundSize: `${px(32)}px ${px(32)}px`,
        pointerEvents: "none",
      }} />

      {/* Sterling arka plan kartı */}
      {(() => {
        const s = P2_COACHES[2];
        const cx = slotW * 2 + slotW / 2;
        const cardW = slotW * 1.12;
        return (
          <div style={{
            position: "absolute",
            left: px(cx - cardW / 2),
            top: px(s.avatarCenterY - s.avatarD / 2 - 48),
            width: px(cardW),
            bottom: px(220 + 16),
            background: "linear-gradient(175deg, #e8f2ff 0%, #f0f7ff 60%, #daeeff 100%)",
            borderRadius: `${px(28)}px ${px(28)}px ${px(20)}px ${px(20)}px`,
            boxShadow: `0 ${px(12)}px ${px(50)}px rgba(30,58,110,0.13)`,
            border: `${px(1.5)}px solid rgba(30,58,110,0.12)`,
            zIndex: 1,
          }} />
        );
      })()}

      {/* Ayırıcılar (Sterling hariç) */}
      {[0, 1, 3].map(i => {
        const cx = slotW * i + slotW;
        return (
          <div key={i} style={{
            position: "absolute",
            left: px(cx) - px(0.5),
            top: px(100),
            bottom: px(280),
            width: px(1),
            background: "linear-gradient(to bottom, transparent, rgba(30,58,110,0.09) 30%, rgba(30,58,110,0.09) 70%, transparent)",
            zIndex: 2,
          }} />
        );
      })}

      {/* Koçlar */}
      {P2_COACHES.map((c, i) => {
        const isSterling = !!c.isSterling;
        const cx = slotW * i + slotW / 2;
        const avatarR = c.avatarD / 2;
        const avatarTop = c.avatarCenterY - avatarR;
        const textTop   = c.avatarCenterY + avatarR + 18;

        return (
          <div key={c.name} style={{ position: "absolute", left: 0, top: 0, width: "100%", zIndex: 3 }}>
            {/* Avatar */}
            <div style={{
              position: "absolute",
              left: px(cx - avatarR),
              top: px(avatarTop),
              width: px(c.avatarD),
              height: px(c.avatarD),
              borderRadius: "50%",
              overflow: "hidden",
              border: isSterling
                ? `${px(3.5)}px solid ${GOLD}`
                : `${px(2)}px solid rgba(30,58,110,0.12)`,
              boxShadow: isSterling
                ? `0 0 0 ${px(5)}px rgba(245,158,11,0.18), 0 ${px(14)}px ${px(44)}px rgba(30,58,110,0.22)`
                : `0 ${px(6)}px ${px(20)}px rgba(30,58,110,0.10)`,
              background: "#e8effa",
            }}>
              <img src={`/images/${c.image}`} alt={c.name}
                style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center", display: "block" }} />
            </div>

            {/* Metin */}
            <div style={{
              position: "absolute",
              left: px(cx - slotW / 2 + 4),
              width: px(slotW - 8),
              top: px(textTop),
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: px(5),
            }}>
              <div style={{
                fontSize: px(isSterling ? 17 : 14),
                fontWeight: 800, color: PRIMARY,
                fontFamily: '"Outfit", sans-serif', lineHeight: 1.1,
              }}>{c.flag} {c.name}</div>
              <div style={{
                fontSize: px(10), fontWeight: 500,
                color: isSterling ? "rgba(30,58,110,0.65)" : "rgba(30,58,110,0.42)",
                fontFamily: '"Plus Jakarta Sans", sans-serif',
                lineHeight: 1.3,
              }}>{c.specialty}</div>
            </div>
          </div>
        );
      })}

      <BottomBar msg={BOTTOM_MESSAGES[1]} />
    </div>
  );
};

/* ── Ana bileşen ── */
export default function TeamPost() {
  const params = new URLSearchParams(window.location.search);
  const panel  = parseInt(params.get("panel") || "1");
  const offset = (panel - 1) * px(W);

  return (
    <div style={{
      width: px(W), height: px(W),
      overflow: "hidden",
      fontFamily: '"Outfit", sans-serif',
    }}>
      <div style={{
        width: px(W * 3), height: px(W),
        position: "absolute", left: -offset,
        display: "flex",
      }}>
        <StandardPanel coaches={P1_COACHES} msgIdx={0} />
        <Panel2 />
        <StandardPanel coaches={P3_COACHES} msgIdx={2} />
      </div>
    </div>
  );
}
