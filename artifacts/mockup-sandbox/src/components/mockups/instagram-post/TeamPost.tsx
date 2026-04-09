const S = 2;
const px = (n: number) => n * S;
const W = 1080; // logical width per panel

const PRIMARY = "#1e3a6e";
const ACCENT  = "#38bdf8";
const GOLD    = "#f59e0b";
const WHITE   = "#ffffff";

/* ──────────────────────────────────────────────
   Üçgen yerleşim planı (mantıksal koordinatlar)
   Tam kanvas: 3240 × 1080
   Üst şerit: 0–140   Mavi alt şerit: 860–1080
   İçerik alanı: 140–860

   SATIR 1 (üst, 3 koç):  y = 260
   SATIR 2 (orta, 4 koç): y = 500
   SATIR 3 (alt, 5 koç):  y = 740
──────────────────────────────────────────────── */
interface CoachDef {
  name: string;
  flag: string;
  specialty: string;
  image: string;
  color: string;
}

const STERLING: CoachDef = {
  name: "Mr. Sterling", flag: "🇬🇧",
  specialty: "CEO & Stratejik Yönetim",
  image: "coach-sterling.png", color: PRIMARY,
};

const OTHERS: CoachDef[] = [
  { name: "Alistair",   flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", specialty: "Satış & Müzakere",      image: "coach-alistair.png",      color: "#DC2626" },
  { name: "Chloe",      flag: "🇦🇺", specialty: "Müşteri İlişkileri",   image: "coach-chloe.png",         color: "#D97706" },
  { name: "Jake",       flag: "🇺🇸", specialty: "Pazarlama & Dijital",  image: "coach-jake.png",          color: "#EA580C" },
  { name: "David",      flag: "🇺🇸", specialty: "Finans & Yatırım",     image: "coach-david.png",         color: "#0369A1" },
  { name: "Emma",       flag: "🇬🇧", specialty: "İnsan Kaynakları",     image: "coach-emma-hr.png",       color: "#BE185D" },
  { name: "Raj",        flag: "🇮🇳", specialty: "BT & Yazılım",         image: "coach-raj.png",           color: "#7C3AED" },
  { name: "Hans",       flag: "🇩🇪", specialty: "Lojistik & Operasyon", image: "coach-hans.png",          color: "#4B5563" },
  { name: "Elena",      flag: "🇪🇺", specialty: "Uluslararası Hukuk",   image: "coach-elena.png",         color: "#059669" },
  { name: "James",      flag: "🇺🇸", specialty: "Üretim & Fabrika",     image: "coach-james-mfg.png",     color: "#92400E" },
  { name: "Dr. Claire", flag: "🇬🇧", specialty: "Gramer & Telaffuz",    image: "coach-claire-grammar.png", color: "#0D9488" },
  { name: "Dr. Olivia", flag: "🇺🇸", specialty: "Sağlık Turizmi",       image: "coach-olivia-health.png", color: "#0891b2" },
];

/* Piramit konumları — (x, y) mantıksal px */
interface Slot {
  x: number;
  y: number;
  d: number;   // çap (logical)
  row: number;
  coach: CoachDef;
  isSterling?: boolean;
}

const SLOTS: Slot[] = [
  /* ── SATIR 1: 3 koç — y=260 ── */
  { x: 540,  y: 260, d: 175, row: 1, coach: OTHERS[0] },        // Alistair  (panel 1 merkezi)
  { x: 1620, y: 250, d: 215, row: 1, coach: STERLING, isSterling: true }, // STERLING (panel 2 merkezi)
  { x: 2700, y: 260, d: 175, row: 1, coach: OTHERS[1] },        // Chloe     (panel 3 merkezi)

  /* ── SATIR 2: 4 koç — y=500 ── */
  { x: 405,  y: 500, d: 158, row: 2, coach: OTHERS[2] },        // Jake
  { x: 1215, y: 500, d: 158, row: 2, coach: OTHERS[3] },        // David
  { x: 2025, y: 500, d: 158, row: 2, coach: OTHERS[4] },        // Emma
  { x: 2835, y: 500, d: 158, row: 2, coach: OTHERS[5] },        // Raj

  /* ── SATIR 3: 5 koç — y=740 ── */
  { x: 270,  y: 740, d: 140, row: 3, coach: OTHERS[6] },        // Hans
  { x: 810,  y: 740, d: 140, row: 3, coach: OTHERS[7] },        // Elena
  { x: 1620, y: 740, d: 140, row: 3, coach: OTHERS[8] },        // James
  { x: 2430, y: 740, d: 140, row: 3, coach: OTHERS[9] },        // Dr. Claire
  { x: 2970, y: 740, d: 140, row: 3, coach: OTHERS[10] },       // Dr. Olivia
];

/* ── Koç çemberi + bilgi ── */
const CoachDot = ({ slot }: { slot: Slot }) => {
  const { coach, d, isSterling } = slot;
  const D = px(d);

  return (
    <div style={{
      position: "absolute",
      left: px(slot.x) - D / 2,
      top:  px(slot.y) - D / 2,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: px(10),
      width: D,
      zIndex: isSterling ? 10 : 2,
    }}>
      {/* Yıldız */}
      {isSterling && (
        <div style={{
          position: "absolute",
          top: -px(30),
          fontSize: px(26),
          color: GOLD,
          filter: "drop-shadow(0 1px 4px rgba(245,158,11,0.55))",
          zIndex: 11,
        }}>★</div>
      )}

      {/* Çember glow (arka plan) */}
      {isSterling && (
        <div style={{
          position: "absolute",
          inset: -px(20),
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(245,158,11,0.22) 0%, transparent 70%)`,
          pointerEvents: "none",
        }} />
      )}

      {/* Fotoğraf çemberi */}
      <div style={{
        width: D,
        height: D,
        borderRadius: "50%",
        overflow: "hidden",
        border: isSterling
          ? `${px(4)}px solid ${GOLD}`
          : `${px(2)}px solid ${coach.color}55`,
        boxShadow: isSterling
          ? `0 0 0 ${px(7)}px rgba(245,158,11,0.18), 0 ${px(14)}px ${px(50)}px rgba(30,58,110,0.22)`
          : `0 ${px(4)}px ${px(18)}px rgba(30,58,110,0.12)`,
        background: "#e8effa",
        flexShrink: 0,
      }}>
        <img
          src={`/images/${coach.image}`}
          alt={coach.name}
          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center", display: "block" }}
        />
      </div>

      {/* İsim + Uzmanlık */}
      <div style={{ textAlign: "center", width: px(d + 30) }}>
        <div style={{
          fontSize: px(isSterling ? 17 : 13),
          fontWeight: 800,
          color: PRIMARY,
          fontFamily: '"Outfit", sans-serif',
          lineHeight: 1.1,
          letterSpacing: isSterling ? "-0.01em" : 0,
          whiteSpace: "nowrap",
        }}>
          {coach.flag} {coach.name}
        </div>
        <div style={{
          fontSize: px(isSterling ? 11 : 10),
          fontWeight: 500,
          color: "rgba(30,58,110,0.50)",
          fontFamily: '"Plus Jakarta Sans", sans-serif',
          marginTop: px(2),
          lineHeight: 1.2,
        }}>
          {coach.specialty}
        </div>
        {isSterling && (
          <div style={{
            marginTop: px(8),
            display: "inline-block",
            background: PRIMARY,
            color: WHITE,
            fontSize: px(10),
            fontWeight: 700,
            letterSpacing: "0.08em",
            fontFamily: '"Plus Jakarta Sans", sans-serif',
            borderRadius: px(100),
            padding: `${px(5)}px ${px(14)}px`,
          }}>
            KURUCU KOÇ
          </div>
        )}
      </div>
    </div>
  );
};

/* ── SVG üçgen kılavuzu (çok hafif, dekoratif) ── */
const TriangleGuide = () => {
  const W3 = px(W * 3);
  const H  = px(W);

  const apex = { x: px(1620), y: px(230) };
  const bl   = { x: px(180),  y: px(810) };
  const br   = { x: px(3060), y: px(810) };

  const pts = `${apex.x},${apex.y} ${bl.x},${bl.y} ${br.x},${br.y}`;

  return (
    <svg
      width={W3} height={H}
      style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none", zIndex: 1 }}
    >
      <polygon
        points={pts}
        fill="rgba(30,58,110,0.03)"
        stroke="rgba(56,189,248,0.25)"
        strokeWidth={px(1.5)}
        strokeDasharray={`${px(12)} ${px(8)}`}
      />
      {/* Sterling'den köşelere hafif ışın */}
      <line x1={apex.x} y1={apex.y} x2={bl.x} y2={bl.y} stroke={`rgba(245,158,11,0.18)`} strokeWidth={px(1)} />
      <line x1={apex.x} y1={apex.y} x2={br.x} y2={br.y} stroke={`rgba(245,158,11,0.18)`} strokeWidth={px(1)} />
    </svg>
  );
};

/* ── Üst şerit (1 panel genişliğinde, tekrar eder) ── */
const TopBar = () => (
  <div style={{
    position: "absolute",
    top: 0, left: 0, right: 0,
    height: px(140),
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: `0 ${px(56)}px`,
    zIndex: 20,
    background: "rgba(255,255,255,0.95)",
    borderBottom: `${px(1)}px solid rgba(30,58,110,0.07)`,
  }}>
    <img
      src="/images/logo-full.png"
      alt="Sphere English"
      style={{
        height: px(88),
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
      }}>
        12 UZMAN KOÇ
      </span>
    </div>
  </div>
);

/* ── Alt şerit ── */
const BottomBar = () => (
  <div style={{
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    height: px(200),
    background: `linear-gradient(135deg, #060d1e 0%, #0b1e3c 50%, #112d58 100%)`,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: px(6),
    zIndex: 20,
  }}>
    <div style={{
      fontSize: px(28),
      fontWeight: 900,
      color: WHITE,
      fontFamily: '"Outfit", sans-serif',
      letterSpacing: "-0.02em",
      lineHeight: 1,
    }}>
      12 Farklı Bakış Açısı,
    </div>
    <div style={{
      fontSize: px(28),
      fontWeight: 900,
      color: ACCENT,
      fontFamily: '"Outfit", sans-serif',
      letterSpacing: "-0.02em",
      lineHeight: 1,
    }}>
      Tek Bir Ortak Hedef
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
);

export default function TeamPost() {
  const params = new URLSearchParams(window.location.search);
  const panel  = parseInt(params.get("panel") || "1");
  const offset = (panel - 1) * px(W);

  return (
    <div style={{
      width: px(W),
      height: px(W),
      overflow: "hidden",
      fontFamily: '"Outfit", sans-serif',
      background: WHITE,
    }}>
      {/* ═══ TAM 3 PANEL KANVASI ═══ */}
      <div style={{
        width: px(W * 3),
        height: px(W),
        position: "absolute",
        left: -offset,
      }}>

        {/* Arka plan (3 panel boyunca beyaz + hafif doku) */}
        <div style={{
          position: "absolute",
          inset: 0,
          background: "#ffffff",
          backgroundImage: `radial-gradient(circle, rgba(30,58,110,0.032) 1px, transparent 1px)`,
          backgroundSize: `${px(36)}px ${px(36)}px`,
        }} />

        {/* Üçgen içi çok hafif mavi tonu */}
        <div style={{
          position: "absolute",
          top: px(140),
          left: 0,
          right: 0,
          bottom: px(200),
          background: "linear-gradient(to bottom, rgba(248,251,255,0.0) 0%, rgba(235,245,255,0.55) 50%, rgba(248,251,255,0.0) 100%)",
          pointerEvents: "none",
        }} />

        {/* SVG üçgen rehber çizgisi */}
        <TriangleGuide />

        {/* Her panelin kendi üst/alt şeridi */}
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            position: "absolute",
            left: px(i * W),
            top: 0,
            width: px(W),
            height: px(W),
            pointerEvents: "none",
          }}>
            <TopBar />
            <BottomBar />
          </div>
        ))}

        {/* Tüm koçlar — piramit konumlarında */}
        {SLOTS.map((slot, i) => (
          <CoachDot key={i} slot={slot} />
        ))}
      </div>
    </div>
  );
}
