const S = 2;
const px = (n: number) => n * S;
const W = 1080;

const PRIMARY = "#1e3a6e";
const ACCENT  = "#38bdf8";
const GOLD    = "#f59e0b";
const WHITE   = "#ffffff";

/* ── Koç veri tipi ── */
interface Coach {
  name: string;
  flag: string;
  specialty: string;
  image: string;
  isSterling?: boolean;
}

/* ── 12 koç, sıraya göre dizilmiş ── */
/* Sıra: sol kenardan → Sterling (merkez) → sağ kenara */
const COACHES_ROW: Coach[] = [
  { name: "Jake",       flag: "🇺🇸", specialty: "Pazarlama",        image: "coach-jake.png"          },
  { name: "David",      flag: "🇺🇸", specialty: "Finans",            image: "coach-david.png"         },
  { name: "Hans",       flag: "🇩🇪", specialty: "Lojistik",          image: "coach-hans.png"          },
  { name: "Elena",      flag: "🇪🇺", specialty: "Hukuk",             image: "coach-elena.png"         },
  { name: "Raj",        flag: "🇮🇳", specialty: "BT & Yazılım",      image: "coach-raj.png"           },
  { name: "Alistair",   flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", specialty: "Satış",             image: "coach-alistair.png"      },
  /* ★ MERKEZ — MR. STERLING ★ */
  { name: "Mr. Sterling", flag: "🇬🇧", specialty: "CEO & Strateji", image: "coach-sterling.png", isSterling: true },
  { name: "Emma",       flag: "🇬🇧", specialty: "İK",               image: "coach-emma-hr.png"       },
  { name: "Chloe",      flag: "🇦🇺", specialty: "Müşteri İlişk.",   image: "coach-chloe.png"         },
  { name: "James",      flag: "🇺🇸", specialty: "Üretim",            image: "coach-james-mfg.png"     },
  { name: "Dr. Claire", flag: "🇬🇧", specialty: "Gramer",            image: "coach-claire-grammar.png"},
  { name: "Dr. Olivia", flag: "🇺🇸", specialty: "Sağlık Turizmi",   image: "coach-olivia-health.png" },
];

/* ── Geometri sabitleri ── */
const N       = COACHES_ROW.length;           // 12
const STEP    = px(270);                      // her koçun yatay aralığı
const TOTAL_W = px(W * 3);                   // 6480 display px
const SIDE_PAD = (TOTAL_W - (N - 1) * STEP) / 2; // kenar boşluğu

/* Sterling index: 6 (merkez) */
const STERLING_IDX = 6;

/* Fotoğraf boyutları */
const PHOTO_W_REG = px(218);   // normal genişlik
const PHOTO_W_S   = px(268);   // sterling genişlik

const PHOTO_H_REG = px(635);   // normal yükseklik
const PHOTO_H_S   = px(755);   // sterling yükseklik

/* Tüm fotoğrafların alt kenarı aynı hizada (bottom-align) */
const PHOTO_BOTTOM = px(870);

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

      {/* ══════ TAM 3-PANEL KANVAS ══════ */}
      <div style={{
        width: TOTAL_W, height: px(W),
        position: "absolute",
        left: -offset,
      }}>

        {/* ── Arka plan: üstten alta degrade ── */}
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(175deg, #dff0fa 0%, #eef5fb 30%, #f4f8fb 55%, #e8eef5 100%)",
        }} />

        {/* ── Hafif arka plan ışık efekti (derinlik) ── */}
        <div style={{
          position: "absolute",
          left: TOTAL_W / 2 - px(800),
          top: px(-200),
          width: px(1600),
          height: px(1100),
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(56,189,248,0.10) 0%, transparent 65%)",
          pointerEvents: "none",
        }} />

        {/* ── Her panel için üst bar (logo) ── */}
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            position: "absolute",
            left: px(i * W), top: 0,
            width: px(W), height: px(130),
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: `0 ${px(52)}px`,
            zIndex: 30,
            background: "rgba(255,255,255,0.82)",
            backdropFilter: "blur(8px)",
            borderBottom: `${px(1)}px solid rgba(30,58,110,0.07)`,
          }}>
            <img
              src="/images/logo-full.png"
              alt="Sphere English"
              style={{
                height: px(84),
                width: "auto",
                objectFit: "contain",
                objectPosition: "left",
                filter: "brightness(0) saturate(100%) invert(14%) sepia(45%) saturate(1200%) hue-rotate(196deg) brightness(90%)",
              }}
            />
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: px(8),
              background: "rgba(30,58,110,0.07)",
              borderRadius: px(100),
              padding: `${px(9)}px ${px(22)}px`,
            }}>
              <div style={{ width: px(9), height: px(9), borderRadius: "50%", background: ACCENT }} />
              <span style={{
                fontSize: px(13),
                fontWeight: 700,
                color: PRIMARY,
                fontFamily: '"Plus Jakarta Sans", sans-serif',
                letterSpacing: "0.07em",
              }}>12 UZMAN KOÇ</span>
            </div>
          </div>
        ))}

        {/* ── Her panel için alt şerit ── */}
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            position: "absolute",
            left: px(i * W), bottom: 0,
            width: px(W), height: px(195),
            background: "linear-gradient(135deg, #060d1e 0%, #0b1e3c 50%, #112d58 100%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: px(5),
            zIndex: 30,
          }}>
            <div style={{
              fontSize: px(27),
              fontWeight: 900,
              color: WHITE,
              fontFamily: '"Outfit", sans-serif',
              letterSpacing: "-0.02em",
            }}>
              12 Farklı Bakış Açısı,
            </div>
            <div style={{
              fontSize: px(27),
              fontWeight: 900,
              color: ACCENT,
              fontFamily: '"Outfit", sans-serif',
              letterSpacing: "-0.02em",
            }}>
              Tek Bir Ortak Hedef
            </div>
            <div style={{
              fontSize: px(11),
              color: "rgba(255,255,255,0.30)",
              fontFamily: '"Plus Jakarta Sans", sans-serif',
              marginTop: px(3),
              letterSpacing: "0.07em",
            }}>
              sphereenglish.com
            </div>
          </div>
        ))}

        {/* ── KOÇLAR: yatay sıra, alt hizalı ── */}
        {COACHES_ROW.map((coach, i) => {
          const isSterling = !!coach.isSterling;
          const dist   = Math.abs(i - STERLING_IDX);

          /* Merkeze yakın = daha önde (z-index) */
          const zIndex = 20 - dist;

          /* Fotoğraf boyutları */
          const cardW  = isSterling ? PHOTO_W_S : PHOTO_W_REG;
          const cardH  = isSterling ? PHOTO_H_S : PHOTO_H_REG;

          /* X merkezi (eşit aralıklı) */
          const cx = SIDE_PAD + i * STEP;

          /* Y: alt hizalama */
          const top  = PHOTO_BOTTOM - cardH;
          const left = cx - cardW / 2;

          /* Hafif yoğunluk: kenarda biraz saydamlık */
          const opacity = isSterling ? 1 : 1 - dist * 0.025;

          return (
            <div
              key={coach.name}
              style={{
                position: "absolute",
                left,
                top,
                width: cardW,
                height: cardH,
                zIndex,
                borderRadius: `${px(18)}px ${px(18)}px 0 0`,
                overflow: "hidden",
                boxShadow: isSterling
                  ? `0 0 0 ${px(3)}px ${GOLD}, 0 0 ${px(60)}px ${px(20)}px rgba(245,158,11,0.22), 0 ${px(20)}px ${px(70)}px rgba(30,58,110,0.25)`
                  : `${px(3)}px 0 ${px(22)}px rgba(30,58,110,0.12)`,
                opacity,
              }}
            >
              {/* Fotoğraf */}
              <img
                src={`/images/${coach.image}`}
                alt={coach.name}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: "top center",
                  display: "block",
                }}
              />

              {/* Alt metin için karartma degradesi */}
              <div style={{
                position: "absolute",
                left: 0, right: 0, bottom: 0,
                height: isSterling ? px(220) : px(185),
                background: "linear-gradient(to top, rgba(10,20,50,0.90) 0%, rgba(10,20,50,0.55) 55%, transparent 100%)",
              }} />

              {/* İsim + uzmanlık */}
              <div style={{
                position: "absolute",
                bottom: px(18),
                left: 0,
                right: 0,
                textAlign: "center",
                padding: `0 ${px(8)}px`,
              }}>
                {isSterling && (
                  <div style={{
                    fontSize: px(22),
                    color: GOLD,
                    marginBottom: px(4),
                    filter: "drop-shadow(0 1px 3px rgba(245,158,11,0.6))",
                  }}>★</div>
                )}
                <div style={{
                  fontSize: px(isSterling ? 17 : 13),
                  fontWeight: 800,
                  color: WHITE,
                  fontFamily: '"Outfit", sans-serif',
                  lineHeight: 1.1,
                  textShadow: "0 1px 6px rgba(0,0,0,0.5)",
                }}>
                  {coach.flag} {coach.name}
                </div>
                <div style={{
                  fontSize: px(isSterling ? 12 : 10),
                  fontWeight: 500,
                  color: "rgba(255,255,255,0.72)",
                  fontFamily: '"Plus Jakarta Sans", sans-serif',
                  marginTop: px(3),
                  letterSpacing: "0.01em",
                }}>
                  {coach.specialty}
                </div>
                {isSterling && (
                  <div style={{
                    marginTop: px(8),
                    display: "inline-block",
                    background: GOLD,
                    color: "#1a0800",
                    fontSize: px(10),
                    fontWeight: 800,
                    letterSpacing: "0.07em",
                    fontFamily: '"Plus Jakarta Sans", sans-serif',
                    borderRadius: px(100),
                    padding: `${px(4)}px ${px(13)}px`,
                  }}>
                    KURUCU KOÇ
                  </div>
                )}
              </div>
            </div>
          );
        })}

      </div>
    </div>
  );
}
