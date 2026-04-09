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

/* 4 + 4 + 4 = 12 koç */
const PANELS: Coach[][] = [
  /* Panel 1 */
  [
    { name: "Jake",      flag: "🇺🇸", specialty: "Pazarlama & Dijital", image: "coach-jake.png"          },
    { name: "David",     flag: "🇺🇸", specialty: "Finans & Yatırım",    image: "coach-david.png"         },
    { name: "Emma",      flag: "🇬🇧", specialty: "İnsan Kaynakları",    image: "coach-emma-hr.png"       },
    { name: "Raj",       flag: "🇮🇳", specialty: "BT & Yazılım",        image: "coach-raj.png"           },
  ],
  /* Panel 2 — Sterling ortada */
  [
    { name: "Hans",         flag: "🇩🇪", specialty: "Lojistik & Operasyon",     image: "coach-hans.png"     },
    { name: "Mr. Sterling", flag: "🇬🇧", specialty: "CEO & Stratejik Yönetim", image: "coach-sterling.png", isSterling: true },
    { name: "Elena",        flag: "🇪🇺", specialty: "Uluslararası Hukuk",        image: "coach-elena.png"    },
    { name: "Alistair",     flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", specialty: "Satış & Müzakere",         image: "coach-alistair.png" },
  ],
  /* Panel 3 */
  [
    { name: "Chloe",      flag: "🇦🇺", specialty: "Müşteri İlişkileri",  image: "coach-chloe.png"         },
    { name: "James",      flag: "🇺🇸", specialty: "Üretim & Fabrika",    image: "coach-james-mfg.png"     },
    { name: "Dr. Claire", flag: "🇬🇧", specialty: "Gramer & Telaffuz",   image: "coach-claire-grammar.png"},
    { name: "Dr. Olivia", flag: "🇺🇸", specialty: "Sağlık Turizmi",      image: "coach-olivia-health.png" },
  ],
];

const BOTTOM_MESSAGES = [
  { line1: "Küresel Sahneye Açılmaya",        line2: "Hazır Mısınız?"             },
  { line1: "12 Farklı Bakış Açısı,",          line2: "Tek Bir Ortak Hedef"        },
  { line1: "İş İngilizcesinde Gerçek Başarı", line2: "ve Küresel Özgüven"         },
];


const Panel = ({ coaches, msgIdx }: { coaches: Coach[]; msgIdx: number }) => {
  const msg = BOTTOM_MESSAGES[msgIdx];
  const isMiddle = msgIdx === 1;

  return (
    <div style={{
      width: px(W), height: px(W), flexShrink: 0,
      position: "relative", overflow: "hidden",
      background: "linear-gradient(175deg, #dff0fa 0%, #f1f8fc 45%, #ffffff 100%)",
    }}>
      {/* Nokta dokusu */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "radial-gradient(circle, rgba(30,58,110,0.030) 1px, transparent 1px)",
        backgroundSize: `${px(32)}px ${px(32)}px`,
        pointerEvents: "none",
      }} />

      {/* Orta panel başlık metni */}
      {isMiddle && (
        <div style={{
          position: "absolute",
          top: px(80), left: px(24), right: px(24),
          textAlign: "center",
          display: "flex", flexDirection: "column", gap: px(6),
        }}>
          <div style={{
            fontSize: px(38), fontWeight: 800, color: PRIMARY,
            fontFamily: '"Outfit", sans-serif', lineHeight: 1.2,
          }}>İş İngilizcesinde Fark Yaratan 12 Uzman:</div>
          <div style={{
            fontSize: px(32), fontWeight: 800, color: ACCENT,
            fontFamily: '"Outfit", sans-serif', lineHeight: 1.2,
          }}>Sphere ile Küresel Özgüven</div>
        </div>
      )}

      {/* Koçlar */}
      <div style={{
        position: "absolute",
        top: isMiddle ? px(120) : px(60), bottom: px(220),
        left: px(20), right: px(20),
        display: "flex",
        alignItems: "center",
        gap: px(16),
      }}>
        {coaches.map((c) => {
          const isSterling = !!c.isSterling;
          const avatarD = px(172);

          return (
            <div key={c.name} style={{
              flex: 1,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              gap: px(18),
              padding: `${px(24)}px ${px(8)}px`,
              background: isSterling
                ? "linear-gradient(175deg,rgba(56,189,248,0.07) 0%,rgba(30,58,110,0.05) 100%)"
                : "linear-gradient(175deg,rgba(255,255,255,0.72) 0%,rgba(230,240,252,0.55) 100%)",
              borderRadius: px(28),
              boxShadow: isSterling
                ? `0 ${px(8)}px ${px(44)}px rgba(30,58,110,0.13)`
                : `0 ${px(4)}px ${px(24)}px rgba(30,58,110,0.07)`,
            }}>
              {/* Avatar */}
              <div style={{
                width: avatarD, height: avatarD,
                borderRadius: "50%", overflow: "hidden", flexShrink: 0,
                border: isSterling
                  ? `${px(3.5)}px solid ${GOLD}`
                  : `${px(2)}px solid rgba(30,58,110,0.10)`,
                boxShadow: isSterling
                  ? `0 0 0 ${px(5)}px rgba(245,158,11,0.16), 0 ${px(12)}px ${px(40)}px rgba(30,58,110,0.20)`
                  : `0 ${px(8)}px ${px(28)}px rgba(30,58,110,0.13)`,
                background: "#e8effa",
              }}>
                <img
                  src={`/images/${c.image}`} alt={c.name}
                  style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center", display: "block" }}
                />
              </div>

              {/* İsim + uzmanlık */}
              <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: px(8) }}>
                <div style={{
                  fontSize: px(22), fontWeight: 800, color: PRIMARY,
                  fontFamily: '"Outfit", sans-serif', lineHeight: 1.1,
                }}>{c.flag} {c.name}</div>
                <div style={{
                  fontSize: px(15), fontWeight: 500,
                  color: "rgba(30,58,110,0.55)",
                  fontFamily: '"Plus Jakarta Sans", sans-serif', lineHeight: 1.3,
                }}>{c.specialty}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Alt şerit */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        height: px(220),
        background: "linear-gradient(135deg, #060d1e 0%, #0b1e3c 50%, #112d58 100%)",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: px(7), zIndex: 10,
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
    </div>
  );
};

export default function TeamPost() {
  const params = new URLSearchParams(window.location.search);
  const panel  = parseInt(params.get("panel") || "1");
  const offset = (panel - 1) * px(W);

  return (
    <div style={{ width: px(W), height: px(W), overflow: "hidden", fontFamily: '"Outfit", sans-serif' }}>
      <div style={{
        width: px(W * 3), height: px(W),
        position: "absolute", left: -offset,
        display: "flex",
      }}>
        {PANELS.map((coaches, i) => (
          <Panel key={i} coaches={coaches} msgIdx={i} />
        ))}
      </div>
    </div>
  );
}
