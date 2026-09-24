import { useState } from "react";
import { colors, radius, fonts, shadow } from "./tokens";

/**
 * Büyük iş kartı — çevrilebilir (dokun → örnek + alternatifler görünür).
 * Marka: kelime altı turkuaz vurgu, sol turkuaz kenar örnek kutusu.
 */

export interface BusinessCardData {
  id: number;
  level: string;
  category: string;
  context_tr: string;
  phrase_en: string;
  alternatives_en: string[];
  example_en: string;
  translation_tr: string;
  tags?: string[];
}

interface Props {
  card: BusinessCardData;
  cardNumber?: string;
  totalCards?: number;
  highlightWord?: string; // vurgulanacak kelime
  isFavorite?: boolean;
  onToggleFav?: () => void;
}

export function BusinessCard({
  card, cardNumber, totalCards, highlightWord, isFavorite, onToggleFav,
}: Props) {
  // Vurgu ekle
  let phraseHtml: React.ReactNode = card.phrase_en;
  if (highlightWord && card.phrase_en.includes(highlightWord)) {
    const parts = card.phrase_en.split(highlightWord);
    phraseHtml = (
      <>
        {parts[0]}
        <span style={{ position: "relative", display: "inline-block" }}>
          {highlightWord}
          <span style={{
            content: "''", position: "absolute",
            left: 0, right: 0, bottom: 2,
            height: "30%", background: colors.turq,
            opacity: 0.7, transform: "skewY(-1.5deg)", zIndex: -1,
          }} />
        </span>
        {parts.slice(1).join(highlightWord)}
      </>
    );
  }

  return (
    <div style={{
      background: colors.white,
      borderRadius: radius.panel,
      padding: "28px 24px",
      boxShadow: shadow.card,
      border: `1px solid ${colors.navy100}`,
      position: "relative",
    }}>
      {/* Üst — kicker + fav */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 24,
      }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "6px 12px", background: colors.navy50, color: colors.navy,
          borderRadius: radius.chip,
          fontFamily: fonts.heading, fontWeight: 700, fontSize: 11,
        }}>
          <span style={{ width: 6, height: 6, background: colors.turq, borderRadius: "50%" }} />
          {cardNumber && totalCards ? `Kart ${cardNumber} / ${totalCards}` : card.level}
        </div>
        <button
          onClick={onToggleFav}
          style={{
            color: isFavorite ? colors.turqDeep : colors.neutral,
            width: 36, height: 36, background: "transparent", border: "none",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <svg width={22} height={22} viewBox="0 0 24 24" fill={isFavorite ? colors.turq : "none"} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </button>
      </div>

      {/* Ana ifade */}
      <div style={{
        fontFamily: fonts.heading, fontWeight: 900, fontSize: 24,
        lineHeight: 1.2, letterSpacing: "-0.02em",
        color: colors.navy, marginBottom: 20,
      }}>
        {phraseHtml}
      </div>

      {/* Bağlam divider */}
      <div style={{
        paddingTop: 20,
        borderTop: `1px solid ${colors.navy100}`,
        position: "relative",
      }}>
        <span style={{
          position: "absolute", top: -8, left: 0,
          background: colors.white, paddingRight: 12,
          fontFamily: fonts.heading, fontWeight: 700, fontSize: 10,
          color: colors.turqDeep, letterSpacing: "0.06em",
        }}>BAĞLAM</span>

        <div style={{ fontSize: 13, lineHeight: 1.6, color: colors.navy }}>
          {card.context_tr}
        </div>

        <div style={{
          marginTop: 20,
          padding: "14px 14px 14px 20px",
          background: colors.navy50,
          borderRadius: radius.card,
          borderLeft: `3px solid ${colors.turq}`,
        }}>
          <div style={{
            fontFamily: fonts.body, fontWeight: 600, fontStyle: "italic",
            fontSize: 13, color: colors.navy, lineHeight: 1.5,
          }}>
            "{card.example_en}"
          </div>
          <div style={{
            fontFamily: fonts.body, fontWeight: 400, fontSize: 12,
            color: colors.neutral, lineHeight: 1.5, marginTop: 6,
          }}>{card.translation_tr}</div>
        </div>
      </div>
    </div>
  );
}
