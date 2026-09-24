import { Home, Target, BookOpen, Award, User } from "lucide-react";
import { colors, fonts } from "./tokens";

/**
 * Alt tabbar — 5 sekme. Marka kılavuzu:
 * - Etiketler tek satır (nowrap)
 * - 72px sabit yükseklik
 * - İkonlar 22px, stroke 2px, outlined
 * - Aktif: navy renk
 */

export type TabKey = "home" | "practice" | "library" | "rewards" | "profile";

interface Props {
  active: TabKey;
  onChange: (key: TabKey) => void;
}

const TABS: { key: TabKey; label: string; Icon: any }[] = [
  { key: "home", label: "Anasayfa", Icon: Home },
  { key: "practice", label: "Pratik", Icon: Target },
  { key: "library", label: "Kütüphane", Icon: BookOpen },
  { key: "rewards", label: "Kazanım", Icon: Award },
  { key: "profile", label: "Profil", Icon: User },
];

export function TabBar({ active, onChange }: Props) {
  return (
    <nav style={{
      position: "fixed", bottom: 0, left: 0, right: 0,
      background: colors.white,
      borderTop: `1px solid ${colors.navy50}`,
      display: "flex",
      padding: "8px 8px 16px",
      justifyContent: "space-around",
      zIndex: 20,
      height: 72,
    }}>
      {TABS.map(({ key, label, Icon }) => {
        const isActive = active === key;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            style={{
              display: "flex", flexDirection: "column",
              alignItems: "center", gap: 3,
              padding: "4px 6px",
              color: isActive ? colors.navy : colors.neutral,
              fontFamily: fonts.heading, fontWeight: 600, fontSize: 10,
              whiteSpace: "nowrap", textAlign: "center", lineHeight: 1,
              flex: 1, minWidth: 0,
              border: "none", background: "transparent",
              cursor: "pointer",
              transition: "color 0.2s ease",
            }}
          >
            <Icon size={22} strokeWidth={2} />
            {label}
          </button>
        );
      })}
    </nav>
  );
}
