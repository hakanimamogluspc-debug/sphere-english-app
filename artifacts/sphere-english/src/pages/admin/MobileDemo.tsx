import { useState } from "react";
import {
  Button, StatRow, FocusCard, BusinessCard, TabBar, StreakHero,
  colors, fonts, radius,
  type TabKey, type BusinessCardData,
} from "@/components/mobile";
import { ArrowRight } from "lucide-react";

/**
 * /admin/mobil-demo — Mobil design system bileşenlerinin canlı önizlemesi.
 * Marka kılavuzu v1.0'a uyumlu bileşenler burada bir telefon frame içinde
 * gösteriliyor. Capacitor'a taşındığında aynı bileşenler React Native
 * / Capacitor Vue içinde kullanılabilir.
 */

const SAMPLE_CARD: BusinessCardData = {
  id: 1,
  level: "B2",
  category: "meetings",
  context_tr:
    "Bir toplantıda hemen cevap veremediğin bir soru geldiğinde profesyonelce süre kazanmak istersin.",
  phrase_en: "Let me get back to you on that.",
  alternatives_en: [
    "I'll need to check and get back to you.",
    "Can I circle back to you on this?",
  ],
  example_en:
    "That's a great question — let me get back to you on that after I check with the team.",
  translation_tr: "Harika bir soru — ekiple konuşup size dönerim.",
};

export default function MobileDemo() {
  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const [isFav, setIsFav] = useState(false);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: colors.navy50,
        padding: "40px 20px",
        fontFamily: fonts.body,
      }}
    >
      {/* Header */}
      <div style={{ maxWidth: 900, margin: "0 auto 40px", textAlign: "center" }}>
        <div
          style={{
            fontFamily: fonts.heading,
            fontWeight: 700,
            fontSize: 12,
            color: colors.turqDeep,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginBottom: 8,
          }}
        >
          Mobil Design System · Canlı Önizleme
        </div>
        <h1
          style={{
            fontFamily: fonts.heading,
            fontWeight: 900,
            fontSize: 40,
            letterSpacing: "-0.02em",
            color: colors.navy,
            marginBottom: 12,
          }}
        >
          Marka kılavuzuna uyumlu bileşenler
        </h1>
        <p
          style={{
            color: colors.neutral,
            maxWidth: 600,
            margin: "0 auto",
            lineHeight: 1.6,
          }}
        >
          Bu sayfa Sphere English mobil design system bileşenlerini gerçek React
          kodu olarak gösterir. Aynı bileşenler ileride Capacitor'a taşındığında
          birebir çalışır. Alt tabbar'a tıkla, favori butonuna bas.
        </p>
      </div>

      {/* Phone frame */}
      <div
        style={{
          maxWidth: 400,
          margin: "0 auto",
          background: colors.white,
          borderRadius: radius.panel,
          boxShadow: "0 40px 100px rgba(30, 58, 110, 0.20)",
          overflow: "hidden",
          position: "relative",
          minHeight: 700,
          paddingBottom: 72, // TabBar için yer
        }}
      >
        <div style={{ padding: "32px 24px 0" }}>
          {/* Header selam */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 20,
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: fonts.heading,
                  fontWeight: 800,
                  fontSize: 24,
                  letterSpacing: "-0.02em",
                  color: colors.navy,
                  lineHeight: 1.1,
                }}
              >
                İyi sabahlar,
                <br />
                <span style={{ position: "relative", display: "inline-block" }}>
                  Hakan
                  <span
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      bottom: 2,
                      height: 8,
                      background: colors.turq,
                      opacity: 0.9,
                      zIndex: -1,
                    }}
                  />
                </span>
                .
              </div>
            </div>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                background: colors.navy,
                color: colors.white,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: fonts.heading,
                fontWeight: 800,
                fontSize: 18,
              }}
            >
              H
            </div>
          </div>

          {/* StatRow */}
          <StatRow
            stats={[
              { label: "Seri", value: 16, unit: "gün" },
              { label: "Seviye", value: "B2" },
              { label: "Freeze", value: "04" },
            ]}
          />

          {/* İçerik değişir — sekmelere göre */}
          {activeTab === "home" && (
            <>
              <FocusCard
                title="Salı toplantısı için mülakat pratiği"
                description="Jake ile 5 dakika — durum sorularına net cevap."
                meta={[
                  { label: "Süre", value: "5 dk" },
                  { label: "Seviye", value: "B2" },
                  { label: "Odak", value: "Konuşma" },
                ]}
                ctaText="Oturuma başla"
                ctaIcon={<ArrowRight size={18} strokeWidth={2.5} />}
                onCta={() => alert("Oturum başlıyor!")}
              />

              <div
                style={{
                  fontFamily: fonts.heading,
                  fontWeight: 700,
                  fontSize: 18,
                  color: colors.navy,
                  marginBottom: 12,
                }}
              >
                Günün iş kartı
              </div>

              <BusinessCard
                card={SAMPLE_CARD}
                cardNumber="03"
                totalCards={5}
                highlightWord="get back"
                isFavorite={isFav}
                onToggleFav={() => setIsFav(!isFav)}
              />
            </>
          )}

          {activeTab === "rewards" && (
            <>
              <div
                style={{
                  fontFamily: fonts.heading,
                  fontWeight: 700,
                  fontSize: 11,
                  color: colors.turqDeep,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: 8,
                }}
              >
                Kazanımlar
              </div>
              <div
                style={{
                  fontFamily: fonts.heading,
                  fontWeight: 900,
                  fontSize: 28,
                  letterSpacing: "-0.02em",
                  color: colors.navy,
                  marginBottom: 24,
                }}
              >
                Yolun şu ana kadar
              </div>
              <StreakHero days={16} subtitle="En uzun serinin 3 gün uzağındasın." />
            </>
          )}

          {activeTab !== "home" && activeTab !== "rewards" && (
            <div
              style={{
                padding: 40,
                textAlign: "center",
                color: colors.neutral,
                background: colors.navy50,
                borderRadius: radius.panel,
                marginTop: 24,
              }}
            >
              <div
                style={{
                  fontFamily: fonts.heading,
                  fontWeight: 700,
                  fontSize: 16,
                  color: colors.navy,
                  marginBottom: 8,
                }}
              >
                {activeTab === "practice" && "Pratik"}
                {activeTab === "library" && "Kütüphane"}
                {activeTab === "profile" && "Profil"}
              </div>
              <div style={{ fontSize: 13 }}>
                Bu sekmenin bileşenleri hazır ama demo için doldurulmadı.
              </div>
            </div>
          )}
        </div>

        {/* TabBar (position: fixed → burada mock için absolute) */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}>
          <TabBar active={activeTab} onChange={setActiveTab} />
        </div>
      </div>

      {/* Component summary */}
      <div
        style={{
          maxWidth: 900,
          margin: "48px auto 0",
          background: colors.white,
          borderRadius: radius.panel,
          padding: 32,
          border: `1px solid ${colors.navy100}`,
        }}
      >
        <h3
          style={{
            fontFamily: fonts.heading,
            fontWeight: 800,
            fontSize: 20,
            letterSpacing: "-0.01em",
            color: colors.navy,
            marginBottom: 16,
          }}
        >
          Bu sayfada kullanılan bileşenler
        </h3>
        <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 12 }}>
          {[
            { name: "StatRow", desc: "3 stat gösterimi — Navy 50 zemin, hairline ayırıcı" },
            { name: "FocusCard", desc: "Büyük Navy CTA kart — turkuaz küre marka öğesi" },
            { name: "BusinessCard", desc: "İş kartı — kelime altı vurgu, örnek kutusu" },
            { name: "TabBar", desc: "5 sekme, 72px sabit, tek satır" },
            { name: "StreakHero", desc: "Streak paneli — turkuaz küre alt köşede" },
            { name: "Button (secondary)", desc: "Turkuaz zemin + Navy metin, min 48px, pill" },
            { name: "tokens.ts", desc: "Renk, boşluk, radius, tipografi — tek kaynak" },
          ].map((c, i) => (
            <li
              key={i}
              style={{
                display: "flex",
                gap: 12,
                padding: 12,
                background: colors.navy50,
                borderRadius: radius.card,
              }}
            >
              <code
                style={{
                  fontFamily: fonts.heading,
                  fontWeight: 700,
                  fontSize: 13,
                  color: colors.navy,
                  background: colors.white,
                  padding: "4px 10px",
                  borderRadius: 6,
                  minWidth: 130,
                  textAlign: "center",
                }}
              >
                {c.name}
              </code>
              <div style={{ fontSize: 13, color: colors.neutral, lineHeight: 1.5 }}>
                {c.desc}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
