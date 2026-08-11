import { useEffect } from "react";

const S = 2;
const px = (n: number) => n * S;

const COACHES = [
  {
    id: "sterling", name: "Mr. Sterling", flag: "🇬🇧",
    specialty: "CEO & Stratejik Yönetim",
    accent: "Üst Segment İngiliz (RP)",
    color: "#1E3A5F",
    story: "30 yıllık küresel yöneticilik deneyimiyle Mr. Sterling, üst düzey iş İngilizcesinde en yüksek standartları temsil eder. Londra merkezli çalışmalarında CEO'lara ve kıdemli yöneticilere stratejik iletişim koçluğu sunan Sterling, rafine British RP aksanı ve keskin iş zekasıyla her görüşmeyi gerçek bir boardroom deneyimine dönüştürür. Az konuşur, öz konuşur — her cümle yerli yerindedir.",
    traits: ["Otoriter", "Lakonik", "Vizyon Odaklı"],
    image: "coach-sterling.png",
    bg: "linear-gradient(145deg,#0a1628 0%,#1E3A5F 60%,#0d2040 100%)",
  },
  {
    id: "jake", name: "Jake", flag: "🇺🇸",
    specialty: "Pazarlama & Dijital Medya",
    accent: "West Coast Amerikan",
    color: "#EA580C",
    story: "San Francisco'nun hızlı dijital dünyasından gelen Jake, pazarlama ve sosyal medya alanında sektörün nabzını tutmaktadır. Startup kültürünün enerjisini ve West Coast aksanını birleştirerek öğrencilerine dinamik ve akıcı bir İngilizce sunar. Pitch sunumundan YouTube senaryosuna kadar her içeriği sıfırdan kurgulamak onun uzmanlık alanıdır.",
    traits: ["Enerjik", "Yaratıcı", "Trendy"],
    image: "coach-jake.png",
    bg: "linear-gradient(145deg,#1a0a02 0%,#7c2d00 60%,#431400 100%)",
  },
  {
    id: "david", name: "David", flag: "🇺🇸",
    specialty: "Finans & Yatırım",
    accent: "New York (Wall Street)",
    color: "#0369A1",
    story: "Wall Street'in tempolu iş dünyasından gelen David, finans ve yatırım terminolojisinde rakipsiz bir uzmanlık taşımaktadır. New York aksanı ve keskin analitik zekasıyla her konuşmayı bir iş müzakeresine dönüştürür. Risk hesaplamaktan bütçe sunumuna kadar her finansal konuşma onunla netlik kazanır.",
    traits: ["Analitik", "Direkt", "Risk Odaklı"],
    image: "coach-david.png",
    bg: "linear-gradient(145deg,#02111f 0%,#0369A1 60%,#013f6b 100%)",
  },
  {
    id: "emma", name: "Emma", flag: "🇬🇧",
    specialty: "İnsan Kaynakları",
    accent: "Standart İngiliz (London)",
    color: "#BE185D",
    story: "Londra'nın köklü İK geleneğinden beslenen Emma, iş dünyasında insan ilişkilerinin dilini en iyi bilen koçlardandır. Empatik yaklaşımı ve yapılandırılmış metodolojisiyle müzakere, geri bildirim ve ekip iletişimini öğrencileriyle birlikte inşa eder. Her kelime doğru yere oturursa, her kapı açılır.",
    traits: ["Empatik", "Yapılandırılmış", "Destekleyici"],
    image: "coach-emma-hr.png",
    bg: "linear-gradient(145deg,#1a0010 0%,#7d0f3d 60%,#3d0020 100%)",
  },
  {
    id: "raj", name: "Raj", flag: "🇮🇳",
    specialty: "BT & Yazılım Geliştirme",
    accent: "Hint-İngiliz (Global Tech)",
    color: "#7C3AED",
    story: "Bangalore'daki teknoloji ekosisteminden Londra'nın global sahnesine uzanan yolculuğunda Raj, uluslararası tech İngilizcesinin inceliklerini bizzat yaşayarak öğrendi. Sistematik yaklaşımıyla yazılım geliştirme, proje yönetimi ve uluslararası takım koordinasyonunda dilin nasıl kullanılacağını gösterir. Global Tech aksanıyla öğrencileri Bangalore'dan Silicon Valley'e bağlar.",
    traits: ["Sistematik", "Teknik", "İş Birlikçi"],
    image: "coach-raj.png",
    bg: "linear-gradient(145deg,#0d0020 0%,#4c1d95 60%,#2e1065 100%)",
  },
  {
    id: "hans", name: "Hans", flag: "🇩🇪",
    specialty: "Lojistik & Operasyon",
    accent: "Alman-İngiliz (Euro-English)",
    color: "#4B5563",
    story: "Hamburg'un köklü lojistik kültüründen gelen Hans, küresel tedarik zinciri ve operasyon yönetiminde iş İngilizcesini titizlikle işler. Metodolojik yapısı ve sürece odaklı yaklaşımıyla teknik raporlama, tedarikçi müzakeresi ve operasyonel iletişimde fark yaratır. Alman hassasiyeti ile Euro-English akıcılığını birleştirerek öğrencilere güvenilir bir profesyonel iletişim zemini oluşturur.",
    traits: ["Metodolojik", "Hassas", "Süreç Odaklı"],
    image: "coach-hans.png",
    bg: "linear-gradient(145deg,#0a0c0f 0%,#1f2937 60%,#111827 100%)",
  },
  {
    id: "elena", name: "Elena", flag: "🇪🇺",
    specialty: "Uluslararası Hukuk",
    accent: "Diplomatik (Doğu Avrupa)",
    color: "#059669",
    story: "Brüksel'deki uluslararası müzakere masalarından edindiği deneyimle Elena, hukuki ve diplomatik İngilizceyi bir sanat formuna dönüştürmüştür. Doğu Avrupa'nın titiz dil anlayışını küresel hukuk pratiğiyle birleştirerek sözleşme müzakeresi ve uluslararası iletişimde kusursuzluğu hedefler. Onunla her kelime yerli yerindedir, her cümle bir stratejidir.",
    traits: ["Kesin", "Diplomatik", "Mükemmeliyetçi"],
    image: "coach-elena.png",
    bg: "linear-gradient(145deg,#00150d 0%,#065F46 60%,#022c20 100%)",
  },
  {
    id: "alistair", name: "Alistair", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
    specialty: "Satış & Müzakere",
    accent: "İskoç (Edinburgh)",
    color: "#DC2626",
    story: "Edinburgh'un ikna kültüründen gelen Alistair, satış ve müzakere alanında İngilizceyi bir güç aracına dönüştürür. İskoç aksanının karakteristik özgüveniyle her müzakere senaryosunu analiz eder ve öğrencilere anlaşma kapatmanın dilini öğretir. Israrcı, stratejik ve ikna edici — Alistair ile her görüşme sonuçla biter.",
    traits: ["İkna Edici", "Stratejik", "Israrcı"],
    image: "coach-alistair.png",
    bg: "linear-gradient(145deg,#1a0000 0%,#7f1d1d 60%,#450a0a 100%)",
  },
  {
    id: "chloe", name: "Chloe", flag: "🇦🇺",
    specialty: "Müşteri İlişkileri",
    accent: "Avusturalyalı (Friendly)",
    color: "#D97706",
    story: "Sydney'nin güneşli ve samimi atmosferinden gelen Chloe, müşteri ilişkileri İngilizcesini sıcaklık ve profesyonellikle harmanlayan bir uzmandır. Avusturalyalı doğallığı ve çözüm odaklı yaklaşımıyla müşteri görüşmelerini, şikayet yönetimini ve ilişki geliştirmeyi pratikte öğretir. Onunla iletişim kurmak, karşı tarafı kazanmakla başlar.",
    traits: ["Sıcak", "Samimi", "Çözüm Odaklı"],
    image: "coach-chloe.png",
    bg: "linear-gradient(145deg,#1a0d00 0%,#78350f 60%,#431b00 100%)",
  },
  {
    id: "james", name: "James", flag: "🇺🇸",
    specialty: "Üretim & Fabrika Yönetimi",
    accent: "Amerikan (Midwest)",
    color: "#92400E",
    story: "Ohio'nun sanayi kültüründen gelen James, üretim ve fabrika yönetiminde işlevsel ve direkt bir İngilizce anlayışı geliştirmiştir. Pratik ve güvenilir yaklaşımıyla teknik toplantılardan üretim raporlarına kadar her ortamda etkili iletişim kurmayı öğretir. Lüks değil, işlevsellik — her cümle doğrudan hedefe gider.",
    traits: ["Pratik", "Güvenilir", "Direkt"],
    image: "coach-james-mfg.png",
    bg: "linear-gradient(145deg,#140800 0%,#451a03 60%,#1c0a00 100%)",
  },
  {
    id: "claire", name: "Dr. Claire", flag: "🇬🇧",
    specialty: "Gramer & İleri Telaffuz",
    accent: "Akademik İngiliz (Oxford)",
    color: "#0D9488",
    story: "Oxford'un akademik disiplininden gelen Dr. Claire, gramer ve telaffuz konusundaki uzmanlığını titizlikle öğrencilerine aktarır. İngilizce dil yapısını derinlemesine analiz ederek fonetikten sözdizime kadar her nüansı sabırla ele alır. Akademik mükemmeliyeti ve yapılandırılmış öğretim yöntemiyle dili gerçek anlamda özümsemenizi sağlar.",
    traits: ["Titiz", "Sabırlı", "Akademik"],
    image: "coach-claire-grammar.png",
    bg: "linear-gradient(145deg,#001412 0%,#134e4a 60%,#042f2e 100%)",
  },
  {
    id: "olivia", name: "Dr. Olivia", flag: "🇺🇸",
    specialty: "Sağlık Turizmi İngilizcesi",
    accent: "Amerikan (Miami / Sağlık Turizmi)",
    color: "#0891b2",
    story: "Miami'nin uluslararası sağlık turizmi dünyasından gelen Dr. Olivia, tıp ve sağlık alanında İngilizceyi kültürel farkındalıkla birleştiren bir uzmandır. Hasta iletişiminden sağlık turizmi danışmanlığına kadar her senaryoda profesyonel ve empatik bir dil kullanımını öğretir. Küresel hastalara hizmet verecek sağlık profesyonelleri için biçilmiş kaftandır.",
    traits: ["Profesyonel", "Kültürel Farkındalıklı", "Sıcak"],
    image: "coach-olivia-health.png",
    bg: "linear-gradient(145deg,#001520 0%,#164e63 60%,#0a2535 100%)",
  },
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
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:`${px(44)}px ${px(60)}px 0` }}>
        <img src="/images/logo-full.png" alt="Sphere English"
          style={{ height:px(184), width:"auto", filter:"brightness(0) invert(1)", objectFit:"contain", opacity:0.95 }}
        />
        <div style={{
          display:"flex", alignItems:"center", gap:px(10),
          background:"rgba(255,255,255,0.10)", border:"1px solid rgba(255,255,255,0.20)",
          borderRadius:px(100), padding:`${px(10)}px ${px(24)}px`,
        }}>
          <span style={{ fontSize:px(20) }}>{coach.flag}</span>
          <span style={{ fontFamily:"'Outfit',sans-serif", fontWeight:700, fontSize:px(17),
            color:"rgba(255,255,255,0.90)", letterSpacing:"0.06em" }}>
            AI KOÇLARIMIZ
          </span>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{ flex:1, display:"flex", alignItems:"stretch", padding:`${px(32)}px ${px(60)}px ${px(24)}px`, gap:px(52) }}>

        {/* Coach photo – fills full height of content area */}
        <div style={{ position:"relative", flexShrink:0, width:px(340) }}>
          <div style={{
            position:"absolute", inset:px(-16), borderRadius:"50%",
            background:`radial-gradient(circle, ${coach.color}55 0%, transparent 70%)`,
            filter:`blur(${px(20)}px)`,
          }}/>
          <div style={{
            width:"100%", height:"100%", borderRadius:px(36), overflow:"hidden",
            border:`${px(3)}px solid ${coach.color}80`,
            boxShadow:`0 ${px(24)}px ${px(80)}px ${coach.color}45`,
            position:"relative",
          }}>
            <img src={`/images/${coach.image}`} alt={coach.name}
              style={{ width:"100%", height:"100%", objectFit:"cover", objectPosition:"top center" }}
            />
          </div>
        </div>

        {/* Info */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", justifyContent:"space-between" }}>

          {/* Top section */}
          <div style={{ display:"flex", flexDirection:"column", gap:px(18) }}>
            {/* Specialty tag */}
            <div style={{
              display:"inline-flex", alignItems:"center", alignSelf:"flex-start",
              background:"rgba(255,255,255,0.12)", border:`${px(1)}px solid rgba(255,255,255,0.25)`,
              borderRadius:px(100), padding:`${px(8)}px ${px(20)}px`,
            }}>
              <span style={{ fontFamily:"'Outfit',sans-serif", fontWeight:700, fontSize:px(13),
                color:"rgba(255,255,255,0.90)", letterSpacing:"0.08em", textTransform:"uppercase" }}>
                {coach.specialty}
              </span>
            </div>

            {/* Name */}
            <div>
              <h2 style={{ fontFamily:"'Outfit',sans-serif", fontWeight:900, fontSize:px(72),
                color:"#fff", margin:0, lineHeight:0.95, letterSpacing:"-0.02em" }}>
                {coach.name}
              </h2>
              <p style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:600, fontSize:px(22),
                color:"rgba(255,255,255,0.55)", margin:`${px(12)}px 0 0`, letterSpacing:"0.02em" }}>
                🗣 {coach.accent}
              </p>
            </div>
          </div>

          {/* Story */}
          <p style={{
            fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:400, fontSize:px(22),
            color:"rgba(255,255,255,0.85)", lineHeight:1.72, margin:0,
          }}>
            {coach.story}
          </p>

          {/* Trait chips */}
          <div style={{ display:"flex", gap:px(12), flexWrap:"wrap" }}>
            {coach.traits.map(t => (
              <span key={t} style={{
                fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:600, fontSize:px(17),
                color:"rgba(255,255,255,0.82)",
                background:"rgba(255,255,255,0.09)",
                border:`${px(1)}px solid rgba(255,255,255,0.18)`,
                borderRadius:px(100), padding:`${px(10)}px ${px(22)}px`,
              }}>
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── BOTTOM BAR ── */}
      <div style={{
        display:"flex", alignItems:"center",
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
      </div>
    </div>
  );
}
