import { CheckCircle, XCircle, Globe, BookOpen, Mic, Users, Award, TrendingUp, ChevronRight, Zap } from "lucide-react";

const LOGO_SRC = "/__mockup/images/sphere-logo.png";

function SphereLogo({ size = 52, className = "" }: { size?: number; className?: string }) {
  return (
    <img
      src={LOGO_SRC}
      alt="Sphere English Logo"
      width={size}
      height={size}
      className={className}
      style={{ objectFit: "contain" }}
    />
  );
}

const NAVY = "#1e3a6e";
const TURQUOISE = "#13a9e0";
const NAVY_LIGHT = "#2a4e8a";
const NAVY_DARK = "#152c55";
const TURQ_LIGHT = "#4dc3ec";
const TURQ_DARK = "#0d7bab";

function Section({ children, bg = "white", className = "" }: { children: React.ReactNode; bg?: string; className?: string }) {
  return (
    <section style={{ background: bg }} className={`px-20 py-16 ${className}`}>
      {children}
    </section>
  );
}

function SectionLabel({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="w-8 h-0.5" style={{ background: TURQUOISE }} />
      <span className="text-xs font-bold tracking-[0.2em] uppercase" style={{ color: TURQUOISE, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        {text}
      </span>
    </div>
  );
}

function SectionTitle({ text, light = false }: { text: string; light?: boolean }) {
  return (
    <h2 className="text-4xl font-bold mb-2" style={{ fontFamily: "'Outfit', sans-serif", color: light ? "white" : NAVY }}>
      {text}
    </h2>
  );
}

export function BrandGuide() {
  return (
    <div className="w-full" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* ─── 1. KAPAK ──────────────────────────────────────────── */}
      <section
        className="relative flex flex-col items-center justify-center overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${NAVY_DARK} 0%, ${NAVY} 50%, ${NAVY_LIGHT} 100%)`, minHeight: "100vh" }}
      >
        {/* Background grid */}
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
          backgroundSize: "60px 60px"
        }} />

        {/* Glowing orb */}
        <div className="absolute right-32 top-32 rounded-full opacity-20" style={{
          width: 400, height: 400,
          background: `radial-gradient(circle, ${TURQUOISE}, transparent 70%)`
        }} />
        <div className="absolute left-20 bottom-32 rounded-full opacity-10" style={{
          width: 250, height: 250,
          background: `radial-gradient(circle, ${TURQUOISE}, transparent 70%)`
        }} />

        <div className="relative z-10 text-center px-12">
          {/* Logo mark */}
          <div className="mx-auto mb-10 flex items-center justify-center">
            <div className="relative">
              <div className="rounded-full flex items-center justify-center shadow-2xl overflow-hidden bg-white"
                style={{ width: 110, height: 110 }}>
                <SphereLogo size={86} />
              </div>
              <div className="absolute -inset-3 rounded-full opacity-30 border-2" style={{ borderColor: TURQUOISE }} />
              <div className="absolute -inset-6 rounded-full opacity-15 border" style={{ borderColor: TURQUOISE }} />
            </div>
          </div>

          <h1 className="text-8xl font-black tracking-tight text-white mb-4" style={{ fontFamily: "'Outfit', sans-serif", letterSpacing: "-0.02em" }}>
            Sphere English
          </h1>
          <div className="h-1 w-48 mx-auto mb-6 rounded-full" style={{ background: `linear-gradient(90deg, ${TURQUOISE}, ${TURQ_LIGHT})` }} />
          <p className="text-2xl font-light text-white opacity-80 mb-2" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Kurumsal Kimlik Kılavuzu
          </p>
          <p className="text-base text-white opacity-40 tracking-widest uppercase" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Brand Identity Guide · 2025
          </p>
        </div>

        {/* Bottom tagline */}
        <div className="absolute bottom-10 left-0 right-0 text-center">
          <p className="text-white opacity-30 text-sm tracking-widest uppercase">İngilizce öğreniminde yeni nesil deneyim</p>
        </div>
      </section>

      {/* ─── 2. MARKA KİMLİĞİ ─────────────────────────────────── */}
      <Section bg="#f8fafd">
        <SectionLabel text="Marka Kimliği" />
        <SectionTitle text="Kim Olduğumuz" />
        <p className="text-lg text-gray-500 mb-12 max-w-2xl" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          Sphere English'in vizyonu, hedefleri ve marka DNA'sı
        </p>

        {/* Mission statement */}
        <div className="rounded-3xl p-10 mb-10 relative overflow-hidden" style={{ background: NAVY }}>
          <div className="absolute right-0 top-0 w-64 h-64 rounded-full opacity-10"
            style={{ background: `radial-gradient(circle, ${TURQUOISE}, transparent)`, transform: "translate(30%, -30%)" }} />
          <p className="text-2xl font-light text-white leading-relaxed relative z-10 max-w-3xl"
            style={{ fontFamily: "'Outfit', sans-serif" }}>
            "İngilizceyi sadece bir beceri olarak değil, <span style={{ color: TURQUOISE }} className="font-semibold">dünyaya açılan bir kapı</span> olarak görüyoruz. Her öğrenciye kişiselleştirilmiş, etkili ve ilham verici bir öğrenme deneyimi sunmak için buradayız."
          </p>
          <div className="mt-6 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden bg-white">
              <SphereLogo size={32} />
            </div>
            <span className="text-white opacity-60 text-sm" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Sphere English · Marka Manifestosu</span>
          </div>
        </div>

        {/* Values grid */}
        <div className="grid grid-cols-4 gap-6">
          {[
            { icon: Award, label: "Profesyonel", desc: "Yüksek standartlı eğitim içeriği ve öğretmen kadrosu" },
            { icon: Zap, label: "Modern", desc: "Yapay zeka destekli telaffuz koçu ve interaktif araçlar" },
            { icon: Users, label: "Erişilebilir", desc: "Her seviyeden öğrenciye uygun, kapsamlı müfredat" },
            { icon: TrendingUp, label: "Sonuç Odaklı", desc: "Ölçülebilir ilerleme ve başarı takibi" },
          ].map(({ icon: Icon, label, desc }) => (
            <div key={label} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `${TURQUOISE}18` }}>
                <Icon size={24} style={{ color: TURQUOISE }} />
              </div>
              <h3 className="font-bold text-lg" style={{ color: NAVY, fontFamily: "'Outfit', sans-serif" }}>{label}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ─── 3. RENK PALETİ ───────────────────────────────────── */}
      <Section bg="white">
        <SectionLabel text="Renk Sistemi" />
        <SectionTitle text="Renk Paleti" />
        <p className="text-lg text-gray-500 mb-12 max-w-2xl">
          Sphere English'in renkler tutarlı bir şekilde kullanılır. Marka iki ana renk etrafında inşa edilmiştir.
        </p>

        {/* Primary colors */}
        <div className="mb-10">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-5">Ana Renkler</p>
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <div className="rounded-2xl h-48 mb-4 flex items-end p-6 relative overflow-hidden"
                style={{ background: `linear-gradient(135deg, ${NAVY_DARK}, ${NAVY_LIGHT})` }}>
                <div className="absolute right-6 top-6 opacity-20">
                  <Globe size={80} className="text-white" strokeWidth={1} />
                </div>
                <div>
                  <p className="text-white font-bold text-xl" style={{ fontFamily: "'Outfit', sans-serif" }}>Derin Lacivert</p>
                  <p className="text-white opacity-60 text-sm">Primary Navy</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-gray-400 text-xs mb-1">HEX</p>
                  <p className="font-mono font-bold" style={{ color: NAVY }}>#1e3a6e</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-gray-400 text-xs mb-1">RGB</p>
                  <p className="font-mono font-bold text-gray-700">30, 58, 110</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-gray-400 text-xs mb-1">HSL</p>
                  <p className="font-mono font-bold text-gray-700">220°, 57%, 27%</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-gray-400 text-xs mb-1">Kullanım</p>
                  <p className="font-bold text-gray-700 text-xs">Header, başlık, CTA arka planı</p>
                </div>
              </div>
            </div>

            <div>
              <div className="rounded-2xl h-48 mb-4 flex items-end p-6 relative overflow-hidden"
                style={{ background: `linear-gradient(135deg, ${TURQ_DARK}, ${TURQ_LIGHT})` }}>
                <div className="absolute right-6 top-6 opacity-20">
                  <BookOpen size={80} className="text-white" strokeWidth={1} />
                </div>
                <div>
                  <p className="text-white font-bold text-xl" style={{ fontFamily: "'Outfit', sans-serif" }}>Canlı Turkuaz</p>
                  <p className="text-white opacity-60 text-sm">Accent Turquoise</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-gray-400 text-xs mb-1">HEX</p>
                  <p className="font-mono font-bold" style={{ color: TURQ_DARK }}>#13a9e0</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-gray-400 text-xs mb-1">RGB</p>
                  <p className="font-mono font-bold text-gray-700">19, 169, 224</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-gray-400 text-xs mb-1">HSL</p>
                  <p className="font-mono font-bold text-gray-700">199°, 84%, 48%</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-gray-400 text-xs mb-1">Kullanım</p>
                  <p className="font-bold text-gray-700 text-xs">Vurgu, buton, link, ikon</p>
                </div>
              </div>
            </div>
          </div>

          {/* Tonal palette */}
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Tonal Ölçek</p>
          <div className="grid grid-cols-5 gap-3 mb-10">
            {[
              { hex: "#e8eef8", label: "50", text: NAVY },
              { hex: "#c5d3ed", label: "100", text: NAVY },
              { hex: "#8ba7d9", label: "200", text: NAVY },
              { hex: "#4e77be", label: "400", text: "white" },
              { hex: NAVY, label: "700", text: "white" },
            ].map(({ hex, label, text }) => (
              <div key={label} className="text-center">
                <div className="rounded-xl h-16 mb-2" style={{ background: hex }} />
                <p className="text-xs font-mono font-bold" style={{ color: text === "white" ? "#555" : NAVY }}>{hex}</p>
                <p className="text-xs text-gray-400">Navy {label}</p>
              </div>
            ))}
          </div>

          {/* Supporting colors */}
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Destekleyici Renkler</p>
          <div className="grid grid-cols-4 gap-4">
            {[
              { name: "Başarı", hex: "#22c55e", light: "#dcfce7", desc: "Doğru cevap, tamamlama" },
              { name: "Uyarı", hex: "#f59e0b", light: "#fef3c7", desc: "Önemli bilgi, hatırlatma" },
              { name: "Hata", hex: "#ef4444", light: "#fee2e2", desc: "Yanlış cevap, hata" },
              { name: "Nötr", hex: "#64748b", light: "#f1f5f9", desc: "İkincil metin, kenarlık" },
            ].map(({ name, hex, light, desc }) => (
              <div key={name} className="rounded-2xl p-5 border border-gray-100" style={{ background: light }}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-lg" style={{ background: hex }} />
                  <div>
                    <p className="font-bold text-sm" style={{ color: hex }}>{name}</p>
                    <p className="font-mono text-xs text-gray-500">{hex}</p>
                  </div>
                </div>
                <p className="text-xs text-gray-600">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ─── 4. TİPOGRAFİ ─────────────────────────────────────── */}
      <Section bg="#f8fafd">
        <SectionLabel text="Tipografi" />
        <SectionTitle text="Yazı Tipi Sistemi" />
        <p className="text-lg text-gray-500 mb-12 max-w-2xl">
          İki yazı tipi ailesi birlikte uyum içinde çalışır: başlıklar için güçlü, gövde metni için okunabilir.
        </p>

        <div className="grid grid-cols-2 gap-10 mb-12">
          {/* Outfit */}
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
            <div className="flex items-start justify-between mb-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-3 inline-block"
                  style={{ background: `${TURQUOISE}18`, color: TURQUOISE }}>Başlık Fontu</span>
                <h3 className="text-5xl font-black" style={{ fontFamily: "'Outfit', sans-serif", color: NAVY }}>Outfit</h3>
              </div>
              <span className="text-gray-200 text-6xl font-black" style={{ fontFamily: "'Outfit', sans-serif" }}>Aa</span>
            </div>
            <div className="space-y-4 border-t border-gray-100 pt-6">
              <div>
                <p className="text-xs text-gray-400 mb-1">Black · 900</p>
                <p className="text-4xl font-black" style={{ fontFamily: "'Outfit', sans-serif", color: NAVY }}>Küresel Öğrenme</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Bold · 700</p>
                <p className="text-2xl font-bold" style={{ fontFamily: "'Outfit', sans-serif", color: NAVY }}>İngilizce Becerilerinizi Geliştirin</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">SemiBold · 600</p>
                <p className="text-xl font-semibold" style={{ fontFamily: "'Outfit', sans-serif", color: NAVY }}>Ders Programı ve Değerlendirme</p>
              </div>
              <div className="mt-4 bg-gray-50 rounded-xl p-4">
                <p className="text-xs font-mono text-gray-500">font-family: 'Outfit', sans-serif</p>
                <p className="text-xs font-mono text-gray-500">weights: 400, 600, 700, 800, 900</p>
              </div>
            </div>
          </div>

          {/* Plus Jakarta Sans */}
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
            <div className="flex items-start justify-between mb-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-3 inline-block"
                  style={{ background: `${NAVY}10`, color: NAVY }}>Gövde Fontu</span>
                <h3 className="text-5xl font-black" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: NAVY }}>Jakarta</h3>
              </div>
              <span className="text-gray-200 text-6xl font-black" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Aa</span>
            </div>
            <div className="space-y-4 border-t border-gray-100 pt-6">
              <div>
                <p className="text-xs text-gray-400 mb-1">SemiBold · 600</p>
                <p className="text-xl font-semibold" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#1e293b" }}>Telaffuz Koçunuzla Çalışın</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Regular · 400</p>
                <p className="text-base leading-relaxed" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#475569" }}>
                  Yapay zeka destekli telaffuz koçumuz sayesinde İngilizce konuşma becerilerinizi hızla geliştirin. Gerçek zamanlı geri bildirim ile her hatayanızdan öğrenin.
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Light · 300</p>
                <p className="text-sm font-light text-gray-500" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  Metaveri, açıklama ve yardımcı metin için kullanılır.
                </p>
              </div>
              <div className="mt-4 bg-gray-50 rounded-xl p-4">
                <p className="text-xs font-mono text-gray-500">font-family: 'Plus Jakarta Sans', sans-serif</p>
                <p className="text-xs font-mono text-gray-500">weights: 300, 400, 500, 600, 700</p>
              </div>
            </div>
          </div>
        </div>

        {/* Type scale */}
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-6">Tipografi Ölçeği</p>
          <div className="space-y-6">
            {[
              { label: "Display / Hero", size: "text-6xl", weight: "font-black", font: "Outfit", sample: "İngilizce Öğrenmenin En İyi Yolu", px: "60px / 900" },
              { label: "H1 / Sayfa Başlığı", size: "text-4xl", weight: "font-bold", font: "Outfit", sample: "Kurs Kataloğu", px: "36px / 700" },
              { label: "H2 / Bölüm Başlığı", size: "text-2xl", weight: "font-bold", font: "Outfit", sample: "Bu Hafta Popüler Dersler", px: "24px / 700" },
              { label: "H3 / Kart Başlığı", size: "text-lg", weight: "font-semibold", font: "Jakarta", sample: "Gelişmiş Konuşma Becerileri", px: "18px / 600" },
              { label: "Body / Gövde", size: "text-base", weight: "font-normal", font: "Jakarta", sample: "Derse devam ederek günlük hedeflerinize ulaşın.", px: "16px / 400" },
              { label: "Caption / Açıklama", size: "text-sm", weight: "font-medium", font: "Jakarta", sample: "24 ders · 12 saat · Tüm seviyeler", px: "14px / 500" },
            ].map(({ label, size, weight, font, sample, px }) => (
              <div key={label} className="flex items-baseline gap-6 py-4 border-b border-gray-50 last:border-0">
                <div className="w-44 shrink-0">
                  <p className="text-xs font-bold text-gray-400">{label}</p>
                  <p className="text-xs font-mono text-gray-300">{px}</p>
                </div>
                <p className={`${size} ${weight} flex-1`}
                  style={{ fontFamily: font === "Outfit" ? "'Outfit', sans-serif" : "'Plus Jakarta Sans', sans-serif", color: NAVY }}>
                  {sample}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ─── 5. LOGO KULLANIMI ─────────────────────────────────── */}
      <Section bg="white">
        <SectionLabel text="Logo Sistemi" />
        <SectionTitle text="Logo ve Kullanım Kuralları" />
        <p className="text-lg text-gray-500 mb-12 max-w-2xl">
          Logo, marka kimliğinin en kritik unsurudur. Tutarlı kullanım güvenilirliği artırır.
        </p>

        {/* Logo variations — 4 official variants */}
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-5">Resmi Logo Varyasyonları</p>
        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* V1: Yatay tam logo — koyu zemin */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
              V1 · Yatay Tam Logo — Koyu Zemin
            </p>
            <div className="rounded-2xl flex items-center justify-center h-44 p-8" style={{ background: NAVY }}>
              <img src="/__mockup/images/sphere-logo-horizontal.png" alt="Sphere English Yatay Logo" className="max-h-full max-w-full object-contain" style={{ filter: "brightness(0) invert(1)" }} />
            </div>
            <p className="text-xs text-gray-400 mt-2">Birincil kullanım · Header, sunum, broşür</p>
          </div>

          {/* V2: Yatay tam logo — açık zemin */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
              V2 · Yatay Tam Logo — Açık Zemin
            </p>
            <div className="rounded-2xl flex items-center justify-center h-44 p-8 border-2 border-gray-100 bg-white">
              <img src="/__mockup/images/sphere-logo-horizontal.png" alt="Sphere English Yatay Logo Açık" className="max-h-full max-w-full object-contain" />
            </div>
            <p className="text-xs text-gray-400 mt-2">Web sitesi, e-posta imzası, doküman başlığı</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6 mb-6">
          {/* V3: Metin logosu — koyu zemin */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
              V3 · Metin Logo — Koyu Zemin
            </p>
            <div className="rounded-2xl flex items-center justify-center h-44 p-8" style={{ background: NAVY }}>
              <img src="/__mockup/images/sphere-logo-text.png" alt="Sphere English Metin Logo" className="max-h-full max-w-full object-contain" style={{ filter: "brightness(0) invert(1)" }} />
            </div>
            <p className="text-xs text-gray-400 mt-2">Yedek kullanım · İkon kullanılamadığında</p>
          </div>

          {/* V4: Metin logosu — açık zemin */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
              V4 · Metin Logo — Açık Zemin
            </p>
            <div className="rounded-2xl flex items-center justify-center h-44 p-8 border-2 border-gray-100 bg-white">
              <img src="/__mockup/images/sphere-logo-text.png" alt="Sphere English Metin Logo Açık" className="max-h-full max-w-full object-contain" />
            </div>
            <p className="text-xs text-gray-400 mt-2">Belgeler, sertifikalar, slayt footer</p>
          </div>

          {/* V5: S Monogram */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
              V5 · S Monogram — İkon
            </p>
            <div className="rounded-2xl flex flex-col items-center justify-center h-44 gap-4 bg-gray-50">
              <div className="w-24 h-24 rounded-2xl flex items-center justify-center shadow-md overflow-hidden bg-white">
                <img src="/__mockup/images/sphere-logo-white-bg.png" alt="Sphere English S Monogram" className="w-full h-full object-contain" />
              </div>
              <p className="text-xs text-gray-500 text-center px-2">Favicon, uygulama ikonu, sosyal medya</p>
            </div>
            <p className="text-xs text-gray-400 mt-2">32px ve üzeri · Kare format</p>
          </div>
        </div>

        {/* V6: Yatay Tek Satır Metin Logo */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
              V6 · Yatay Metin Logo — Koyu Zemin
            </p>
            <div className="rounded-2xl flex items-center justify-center h-32 px-10" style={{ background: NAVY }}>
              <img src="/__mockup/images/sphere-logo-inline-text.png" alt="Sphere English Yatay Metin Koyu" className="max-h-full max-w-full object-contain" style={{ filter: "brightness(0) invert(1)" }} />
            </div>
            <p className="text-xs text-gray-400 mt-2">Reklam banner, sosyal medya başlığı, tek satır alan</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
              V6 · Yatay Metin Logo — Açık Zemin
            </p>
            <div className="rounded-2xl flex items-center justify-center h-32 px-10 border-2 border-gray-100 bg-white">
              <img src="/__mockup/images/sphere-logo-inline-text.png" alt="Sphere English Yatay Metin Açık" className="max-h-full max-w-full object-contain" />
            </div>
            <p className="text-xs text-gray-400 mt-2">E-posta başlığı, fatura, dar yatay alanlar</p>
          </div>
        </div>

        {/* Zemin karşılaştırma */}
        <div className="rounded-2xl p-6 mb-10 border border-gray-100 bg-gray-50">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-5">Zemin Uyumu Özeti</p>
          <div className="grid grid-cols-3 gap-4">
            {[
              { bg: NAVY, label: "Lacivert Zemin", imgs: ["V1", "V3", "V5 (beyaz S)"], ok: true },
              { bg: "#ffffff", label: "Beyaz / Açık Zemin", imgs: ["V2", "V4", "V5"], ok: true, border: true },
              { bg: TURQUOISE, label: "Turkuaz Zemin", imgs: ["Yalnızca beyaz/ters logo"], ok: false },
            ].map(({ bg, label, imgs, ok, border }) => (
              <div key={label} className="rounded-xl overflow-hidden shadow-sm">
                <div className="h-16 flex items-center justify-center text-sm font-bold"
                  style={{ background: bg, color: bg === "#ffffff" ? NAVY : "white", border: border ? "2px solid #e5e7eb" : undefined }}>
                  {label}
                </div>
                <div className="bg-white p-3">
                  {imgs.map(img => (
                    <div key={img} className="flex items-center gap-2 py-0.5">
                      {ok ? <CheckCircle size={12} className="text-green-500 shrink-0" /> : <XCircle size={12} className="text-amber-500 shrink-0" />}
                      <span className="text-xs text-gray-600">{img}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Clear space + Do / Don't */}
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2">
              <CheckCircle size={14} className="text-green-500" /> Doğru Kullanım
            </p>
            <div className="space-y-3">
              {[
                "Onaylı renklerle kullanın (koyu veya açık zemin)",
                "Minimum 120px genişlikte tam logo kullanın",
                "Logo etrafında minimum boşluk bırakın (ikon yüksekliği kadar)",
                "Orijinal dosyaları kullanın (SVG veya PNG @2x)",
                "Yalnızca marka assetlerinden indirin",
              ].map((text) => (
                <div key={text} className="flex gap-3 items-start">
                  <CheckCircle size={16} className="text-green-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-gray-700">{text}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2">
              <XCircle size={14} className="text-red-500" /> Yanlış Kullanım
            </p>
            <div className="space-y-3">
              {[
                "Logoyu uzatmayın veya sıkıştırmayın",
                "Marka dışı renkler kullanmayın",
                "Efekt, gölge veya filtre uygulamayın",
                "Logoyu döndürmeyin",
                "Metnin üzerine yerleştirmeyin",
              ].map((text) => (
                <div key={text} className="flex gap-3 items-start">
                  <XCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-gray-700">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* ─── 6. SES & TON ──────────────────────────────────────── */}
      <Section bg="#f8fafd">
        <SectionLabel text="Marka Sesi" />
        <SectionTitle text="Ses & Ton" />
        <p className="text-lg text-gray-500 mb-12 max-w-2xl">
          Sphere English, tutarlı bir ses ve tonla konuşur. Her platformda aynı kişiliği yansıtır.
        </p>

        <div className="grid grid-cols-3 gap-6 mb-10">
          {[
            { title: "Güvenilir", icon: "🤝", desc: "Bilgili, ama gösteriş yapmayan. Uzman ama ulaşılabilir.", sample: "✓ \"Bu derste öğrendiklerinizi hemen kullanabilirsiniz.\"\n✗ \"Paradigma değiştiren metodolojimiz...\"" },
            { title: "Teşvik Edici", icon: "🚀", desc: "Öğrenciyi cesaretlendiren, destekleyen, motive eden.", sample: "✓ \"Harika ilerliyorsunuz! 3 gün üst üste ders tamamladınız.\"\n✗ \"Eksik kalan 47 dersiniz var.\"" },
            { title: "Net & Sade", icon: "💎", desc: "Açık, anlaşılır, jargon kullanmayan, doğrudan.", sample: "✓ \"Bugünkü hedefiniz: 15 kelime öğrenmek.\"\n✗ \"Optimal leksik edinim sürecini optimize edin.\"" },
          ].map(({ title, icon, desc, sample }) => (
            <div key={title} className="bg-white rounded-3xl p-7 shadow-sm border border-gray-100">
              <div className="text-4xl mb-4">{icon}</div>
              <h3 className="text-xl font-bold mb-2" style={{ fontFamily: "'Outfit', sans-serif", color: NAVY }}>{title}</h3>
              <p className="text-sm text-gray-600 mb-4 leading-relaxed">{desc}</p>
              <div className="bg-gray-50 rounded-xl p-4">
                <pre className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{sample}</pre>
              </div>
            </div>
          ))}
        </div>

        {/* Tone spectrum */}
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-6">Ton Spektrumu</p>
          <div className="grid grid-cols-2 gap-10">
            <div>
              <div className="flex justify-between text-xs text-gray-400 mb-2">
                <span>Çok Resmi</span><span>Çok Samimi</span>
              </div>
              <div className="relative h-2 rounded-full mb-1" style={{ background: "linear-gradient(90deg, #e2e8f0, #13a9e0)" }}>
                <div className="absolute w-4 h-4 rounded-full -top-1 shadow-md border-2 border-white"
                  style={{ background: TURQUOISE, left: "65%" }} />
              </div>
              <p className="text-xs text-gray-500 mt-3">Sphere English — Samimiyete yakın, tamamen resmi değil</p>
            </div>
            <div>
              <div className="flex justify-between text-xs text-gray-400 mb-2">
                <span>Çok Basit</span><span>Çok Teknik</span>
              </div>
              <div className="relative h-2 rounded-full mb-1" style={{ background: "linear-gradient(90deg, #e2e8f0, #1e3a6e)" }}>
                <div className="absolute w-4 h-4 rounded-full -top-1 shadow-md border-2 border-white"
                  style={{ background: NAVY, left: "30%" }} />
              </div>
              <p className="text-xs text-gray-500 mt-3">Sphere English — Sade ve anlaşılır, teknik jargon yok</p>
            </div>
          </div>
        </div>
      </Section>

      {/* ─── 7. SLOGAN & TAGLINE ───────────────────────────────── */}
      <Section bg="white">
        <SectionLabel text="Slogan & Tagline" />
        <SectionTitle text="Marka Sloganları" />
        <p className="text-lg text-gray-500 mb-12 max-w-2xl">
          Her platformda ve bağlamda tutarlı bir ses bırakmak için seçilmiş sloganlar ve kullanım yönergeleri.
        </p>

        {/* Ana Slogan */}
        <div className="rounded-3xl p-10 mb-8 relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${NAVY_DARK}, ${NAVY_LIGHT})` }}>
          <div className="absolute right-0 top-0 w-72 h-72 rounded-full opacity-10"
            style={{ background: `radial-gradient(circle, ${TURQUOISE}, transparent)`, transform: "translate(30%, -30%)" }} />
          <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: TURQUOISE }}>
            Ana Slogan · Primary Tagline
          </p>
          <h3 className="text-6xl font-black text-white mb-3 relative z-10" style={{ fontFamily: "'Outfit', sans-serif", letterSpacing: "-0.02em" }}>
            Speak the World.
          </h3>
          <p className="text-2xl text-white opacity-60 mb-6" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Dünyayı Konuş.
          </p>
          <div className="h-0.5 w-24 rounded-full mb-6" style={{ background: TURQUOISE }} />
          <p className="text-white opacity-50 max-w-xl leading-relaxed" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Kısa, evrensel ve güçlü. İngilizceyi öğrenmenin ötesinde — dünyanın bir parçası olmanın davetini taşır. 
            Tüm platformlarda ana slogan olarak kullanılır.
          </p>
        </div>

        {/* Destekleyici Sloganlar */}
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-5">Destekleyici Sloganlar</p>
        <div className="grid grid-cols-2 gap-5 mb-10">
          {[
            {
              tr: "Her kelime, yeni bir kapı.",
              en: "Every word, a new door.",
              context: "Onboarding, kurs tanıtım ekranları",
              mood: "İlham Verici",
              moodColor: TURQUOISE,
            },
            {
              tr: "İngilizceniz, sınırsız olasılıklarınız.",
              en: "Your English, your limitless future.",
              context: "Hero banner, tanıtım sayfaları",
              mood: "Motivasyonel",
              moodColor: "#7c3aed",
            },
            {
              tr: "Öğren. Konuş. Yüksel.",
              en: "Learn. Speak. Rise.",
              context: "Sosyal medya, kısa format reklamlar",
              mood: "Dinamik",
              moodColor: "#059669",
            },
            {
              tr: "Sesini dünyaya taşı.",
              en: "Carry your voice to the world.",
              context: "Telaffuz koçu sayfası, speaking club",
              mood: "Özgüvenli",
              moodColor: "#d97706",
            },
            {
              tr: "Dil engeli değil, dünya kapısı.",
              en: "Not a barrier — a gateway.",
              context: "Farkındalık kampanyaları, blog",
              mood: "Dönüştürücü",
              moodColor: "#dc2626",
            },
            {
              tr: "Küresel kariyerin İngilizce başlar.",
              en: "Your global career starts in English.",
              context: "Kurumsal paket sayfaları, B2B",
              mood: "Kariyer Odaklı",
              moodColor: NAVY,
            },
          ].map(({ tr, en, context, mood, moodColor }) => (
            <div key={tr} className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
              <div className="flex items-start justify-between mb-3">
                <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ background: `${moodColor}15`, color: moodColor }}>
                  {mood}
                </span>
              </div>
              <p className="text-xl font-bold mb-1" style={{ fontFamily: "'Outfit', sans-serif", color: NAVY }}>
                {tr}
              </p>
              <p className="text-sm italic text-gray-400 mb-4" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                "{en}"
              </p>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: moodColor }} />
                <p className="text-xs text-gray-500">{context}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Kampanya Sloganları */}
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-5">Kampanya & Özellik Sloganları</p>
        <div className="grid grid-cols-3 gap-4 mb-10">
          {[
            { text: "30 günde fark et.", sub: "Deneme paketi kampanyaları" },
            { text: "AI koçun her an yanında.", sub: "Telaffuz koçu özellik tanıtımı" },
            { text: "Kelime hazinen, silahın.", sub: "Kelime oyunu & vocab modülü" },
            { text: "Gramer artık kolay.", sub: "Gramer koçu sayfası" },
            { text: "Başarı bir alışkanlık meselesi.", sub: "Günlük ders hatırlatıcıları" },
            { text: "Liderlik tablosunda zirvey hedefle.", sub: "Gamification & liderlik tablosu" },
          ].map(({ text, sub }) => (
            <div key={text} className="rounded-2xl p-5 border-2 flex flex-col gap-2" style={{ borderColor: `${TURQUOISE}30`, background: `${TURQUOISE}06` }}>
              <p className="font-bold text-base leading-snug" style={{ fontFamily: "'Outfit', sans-serif", color: NAVY }}>{text}</p>
              <p className="text-xs text-gray-500">{sub}</p>
            </div>
          ))}
        </div>

        {/* Dil politikası */}
        <div className="bg-gray-50 rounded-3xl p-8 border border-gray-100">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-6">Slogan Kullanım İlkeleri</p>
          <div className="grid grid-cols-3 gap-6">
            {[
              {
                icon: "🌐",
                title: "Dil Seçimi",
                desc: "Türk kullanıcılar için Türkçe slogan önceliklidir. Uluslararası içeriklerde İngilizce kullanılır. İkisi birlikte kullanılacaksa Türkçe üstte yer alır.",
              },
              {
                icon: "✍️",
                title: "Yazım Kuralları",
                desc: "Ana slogan her zaman büyük harfle başlar, noktalama işareti ile biter. Tüm büyük harf (ALL CAPS) yalnızca banner tasarımlarında kabul edilir.",
              },
              {
                icon: "🎯",
                title: "Bağlam Eşleşmesi",
                desc: "Her sloganın belirlenen kullanım bağlamı dışına çıkmaktan kaçınılır. Yanlış bağlamda doğru slogan bile marka tutarsızlığı yaratır.",
              },
            ].map(({ icon, title, desc }) => (
              <div key={title}>
                <div className="text-3xl mb-3">{icon}</div>
                <h4 className="font-bold mb-2" style={{ fontFamily: "'Outfit', sans-serif", color: NAVY }}>{title}</h4>
                <p className="text-sm text-gray-600 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ─── 8. DİJİTAL UI DİLİ ───────────────────────────────── */}
      <Section bg="white">
        <SectionLabel text="Dijital UI" />
        <SectionTitle text="UI Bileşen Dili" />
        <p className="text-lg text-gray-500 mb-12 max-w-2xl">
          Tüm dijital ürünlerde kullanılan bileşenler aynı tasarım diline sahiptir.
        </p>

        <div className="space-y-10">
          {/* Buttons */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-5">Butonlar</p>
            <div className="bg-gray-50 rounded-2xl p-8">
              <div className="flex flex-wrap gap-4 items-center">
                <button className="px-6 py-3 rounded-xl font-semibold text-white text-sm shadow-lg flex items-center gap-2"
                  style={{ background: `linear-gradient(135deg, ${TURQUOISE}, ${TURQ_DARK})`, boxShadow: `0 4px 15px ${TURQUOISE}50` }}>
                  <ChevronRight size={16} /> Derse Başla
                </button>
                <button className="px-6 py-3 rounded-xl font-semibold text-white text-sm"
                  style={{ background: NAVY }}>
                  Kayıt Ol
                </button>
                <button className="px-6 py-3 rounded-xl font-semibold text-sm border-2"
                  style={{ borderColor: TURQUOISE, color: TURQUOISE }}>
                  Detayları Gör
                </button>
                <button className="px-6 py-3 rounded-xl font-semibold text-sm border border-gray-200 text-gray-600 bg-white">
                  İptal
                </button>
                <button className="px-4 py-2 rounded-lg font-semibold text-sm text-white text-xs"
                  style={{ background: TURQUOISE }}>
                  Küçük Buton
                </button>
                <button className="px-8 py-4 rounded-2xl font-bold text-white text-base shadow-xl"
                  style={{ background: `linear-gradient(135deg, ${NAVY}, ${NAVY_LIGHT})` }}>
                  Büyük CTA Butonu
                </button>
              </div>
              <div className="mt-6 grid grid-cols-3 gap-4 text-xs">
                <div className="bg-white rounded-xl p-4">
                  <p className="font-bold text-gray-700 mb-1">Birincil Buton</p>
                  <p className="text-gray-400">Turkuaz gradient · Beyaz metin · Gölge</p>
                  <p className="font-mono text-gray-400 mt-1">border-radius: 12px</p>
                </div>
                <div className="bg-white rounded-xl p-4">
                  <p className="font-bold text-gray-700 mb-1">İkincil Buton</p>
                  <p className="text-gray-400">Lacivert · Beyaz metin · Gölge yok</p>
                  <p className="font-mono text-gray-400 mt-1">border-radius: 12px</p>
                </div>
                <div className="bg-white rounded-xl p-4">
                  <p className="font-bold text-gray-700 mb-1">Outline Buton</p>
                  <p className="text-gray-400">Şeffaf · Turkuaz kenarlık · Turkuaz metin</p>
                  <p className="font-mono text-gray-400 mt-1">border: 2px solid</p>
                </div>
              </div>
            </div>
          </div>

          {/* Cards */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-5">Kartlar</p>
            <div className="grid grid-cols-3 gap-5">
              {/* Course card */}
              <div className="rounded-2xl shadow-md border border-gray-100 overflow-hidden bg-white">
                <div className="h-32 flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${NAVY}, ${NAVY_LIGHT})` }}>
                  <BookOpen size={48} className="text-white opacity-80" strokeWidth={1.5} />
                </div>
                <div className="p-5">
                  <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: `${TURQUOISE}18`, color: TURQUOISE }}>A2 · Temel</span>
                  <h4 className="font-bold text-base mt-2 mb-1" style={{ color: NAVY, fontFamily: "'Outfit', sans-serif" }}>Günlük İngilizce Konuşma</h4>
                  <p className="text-xs text-gray-500 mb-4">24 ders · 8 saat · Sertifikalı</p>
                  <div className="w-full h-1.5 bg-gray-100 rounded-full mb-4">
                    <div className="h-1.5 rounded-full" style={{ width: "65%", background: TURQUOISE }} />
                  </div>
                  <button className="w-full py-2 rounded-xl text-sm font-semibold text-white" style={{ background: TURQUOISE }}>
                    Devam Et
                  </button>
                </div>
              </div>

              {/* Stat card */}
              <div className="rounded-2xl shadow-md border border-gray-100 p-6 bg-white flex flex-col justify-between">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Bu Hafta Öğrenilen</p>
                    <p className="text-5xl font-black" style={{ fontFamily: "'Outfit', sans-serif", color: NAVY }}>48</p>
                    <p className="text-sm font-medium" style={{ color: TURQUOISE }}>kelime</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `${TURQUOISE}18` }}>
                    <TrendingUp size={24} style={{ color: TURQUOISE }} />
                  </div>
                </div>
                <div>
                  <div className="w-full h-2 bg-gray-100 rounded-full">
                    <div className="h-2 rounded-full" style={{ width: "80%", background: `linear-gradient(90deg, ${TURQUOISE}, ${TURQ_LIGHT})` }} />
                  </div>
                  <p className="text-xs text-gray-400 mt-2">Haftalık hedef: 60 kelime</p>
                </div>
              </div>

              {/* Profile / Achievement card */}
              <div className="rounded-2xl shadow-md border border-gray-100 p-6 bg-white">
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center text-white font-black text-xl"
                    style={{ background: `linear-gradient(135deg, ${NAVY}, ${TURQUOISE})`, fontFamily: "'Outfit', sans-serif" }}>
                    CE
                  </div>
                  <div>
                    <p className="font-bold" style={{ color: NAVY, fontFamily: "'Outfit', sans-serif" }}>Ceren Erdoğan</p>
                    <p className="text-xs text-gray-500">B1 Seviye · 124 gün serisi 🔥</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[{ v: "47", l: "Ders" }, { v: "124", l: "Gün" }, { v: "12", l: "Rozet" }].map(({ v, l }) => (
                    <div key={l} className="text-center bg-gray-50 rounded-xl p-3">
                      <p className="font-black text-lg" style={{ fontFamily: "'Outfit', sans-serif", color: NAVY }}>{v}</p>
                      <p className="text-xs text-gray-500">{l}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Spacing & Radius */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-5">Boşluk & Köşe Yarıçapı</p>
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-gray-50 rounded-2xl p-6">
                <p className="text-xs font-bold text-gray-500 mb-4">Köşe Yarıçapı Sistemi</p>
                <div className="flex items-end gap-4">
                  {[{ r: "4px", label: "Küçük", size: "w-8 h-8", style: "rounded" }, { r: "8px", label: "Orta", size: "w-12 h-12", style: "rounded-lg" }, { r: "12px", label: "Büyük", size: "w-16 h-16", style: "rounded-xl" }, { r: "16px", label: "XL", size: "w-20 h-20", style: "rounded-2xl" }, { r: "24px", label: "2XL", size: "w-24 h-24", style: "rounded-3xl" }].map(({ r, label, size, style }) => (
                    <div key={r} className="flex flex-col items-center gap-2">
                      <div className={`${size} ${style} border-2`} style={{ borderColor: NAVY }} />
                      <p className="text-xs font-mono text-gray-500">{r}</p>
                      <p className="text-xs text-gray-400">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-gray-50 rounded-2xl p-6">
                <p className="text-xs font-bold text-gray-500 mb-4">Gölge Sistemi</p>
                <div className="flex gap-6 items-center">
                  {[
                    { label: "sm", style: "0 1px 3px rgba(0,0,0,0.08)" },
                    { label: "md", style: "0 4px 12px rgba(0,0,0,0.1)" },
                    { label: "lg", style: "0 8px 24px rgba(0,0,0,0.12)" },
                    { label: "xl", style: "0 16px 40px rgba(30,58,110,0.2)" },
                  ].map(({ label, style }) => (
                    <div key={label} className="flex flex-col items-center gap-4">
                      <div className="w-16 h-16 rounded-2xl bg-white" style={{ boxShadow: style }} />
                      <p className="text-xs font-mono text-gray-500">shadow-{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ─── 8. GÖRSEL DIL ─────────────────────────────────────── */}
      <Section bg="#f8fafd">
        <SectionLabel text="Görsel Dil" />
        <SectionTitle text="Fotoğraf & İkonografi" />
        <p className="text-lg text-gray-500 mb-12 max-w-2xl">
          Görseller marka kimliğini güçlendirir. Tutarlı bir görsel dil, tanınırlığı artırır.
        </p>

        <div className="grid grid-cols-3 gap-6 mb-8">
          {[
            { label: "Fotoğraf Stili", icon: "📸", desc: "Doğal ışıkta çekilmiş, gerçekçi öğrenme anları. Stüdyo yerine gerçek ortamlar tercih edilir.", tags: ["Aydınlık", "Gerçekçi", "Çeşitlilik"] },
            { label: "İllüstrasyon", icon: "🎨", desc: "Düz renkli, geometrik formlar. Navy ve turkuaz tonları ağırlıklı. Minimal çizgi kalınlığı.", tags: ["Geometrik", "Düz Renk", "Minimalist"] },
            { label: "İkonografi", icon: "⚡", desc: "Lucide React ikonu seti kullanılır. 2px stroke kalınlığı standarttır. Renkler marka paletinden seçilir.", tags: ["Lucide", "2px Stroke", "Marka Rengi"] },
          ].map(({ label, icon, desc, tags }) => (
            <div key={label} className="bg-white rounded-3xl p-7 shadow-sm border border-gray-100">
              <div className="text-4xl mb-4">{icon}</div>
              <h3 className="text-lg font-bold mb-2" style={{ fontFamily: "'Outfit', sans-serif", color: NAVY }}>{label}</h3>
              <p className="text-sm text-gray-600 mb-4 leading-relaxed">{desc}</p>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span key={tag} className="text-xs px-3 py-1 rounded-full font-medium" style={{ background: `${NAVY}10`, color: NAVY }}>{tag}</span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Icon showcase */}
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-6">İkon Kullanım Örnekleri</p>
          <div className="flex flex-wrap gap-6">
            {[
              { icon: Globe, label: "Küresel", context: "Marka ikonu" },
              { icon: BookOpen, label: "Kurs", context: "İçerik" },
              { icon: Mic, label: "Telaffuz", context: "Ses koçu" },
              { icon: Users, label: "Topluluk", context: "Öğrenciler" },
              { icon: Award, label: "Başarı", context: "Sertifika" },
              { icon: TrendingUp, label: "İlerleme", context: "Analitik" },
              { icon: Zap, label: "Hız", context: "AI özellik" },
              { icon: CheckCircle, label: "Tamamlandı", context: "Durum" },
            ].map(({ icon: Icon, label, context }) => (
              <div key={label} className="flex flex-col items-center gap-2 w-20">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "#f8fafd" }}>
                  <Icon size={28} style={{ color: NAVY }} strokeWidth={1.5} />
                </div>
                <p className="text-xs font-bold text-center" style={{ color: NAVY }}>{label}</p>
                <p className="text-xs text-gray-400 text-center">{context}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ─── 9. KAPANIŞ ────────────────────────────────────────── */}
      <section className="relative flex flex-col items-center justify-center py-24 overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${NAVY_DARK} 0%, ${NAVY} 60%, ${NAVY_LIGHT} 100%)` }}>
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
          backgroundSize: "60px 60px"
        }} />
        <div className="relative z-10 text-center px-12">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-xl overflow-hidden bg-white p-1">
            <SphereLogo size={68} />
          </div>
          <h2 className="text-5xl font-black text-white mb-4" style={{ fontFamily: "'Outfit', sans-serif" }}>
            Sphere English
          </h2>
          <div className="h-1 w-32 mx-auto mb-6 rounded-full" style={{ background: `linear-gradient(90deg, ${TURQUOISE}, ${TURQ_LIGHT})` }} />
          <p className="text-xl text-white opacity-60 mb-2" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Kurumsal Kimlik Kılavuzu · 2025
          </p>
          <p className="text-sm text-white opacity-30 tracking-widest uppercase">app.sphereenglish.com</p>
        </div>
      </section>

    </div>
  );
}
