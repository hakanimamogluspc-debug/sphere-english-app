import { ButtonHTMLAttributes, ReactNode } from "react";
import { colors, radius, fonts } from "./tokens";

/**
 * Marka kılavuzu buton kuralları — 3 varyant:
 *   Birincil: Navy zemin + beyaz metin
 *   İkincil: Turkuaz zemin + Navy metin (min 48px, Bold)
 *   Üçüncül: Şeffaf zemin + Navy kenarlık + Navy metin
 */

type Variant = "primary" | "secondary" | "tertiary";
type Size = "md" | "lg";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  iconLeft,
  iconRight,
  children,
  style,
  ...rest
}: Props) {
  const isPrimary = variant === "primary";
  const isSecondary = variant === "secondary";
  const isTertiary = variant === "tertiary";

  const minHeight = size === "lg" ? 56 : 48;
  const padY = size === "lg" ? 16 : 14;
  const padX = size === "lg" ? 28 : 24;

  const baseStyle: React.CSSProperties = {
    fontFamily: fonts.heading,
    fontWeight: 700,
    fontSize: size === "lg" ? 15 : 14,
    letterSpacing: "-0.01em",
    borderRadius: radius.pill,
    padding: `${padY}px ${padX}px`,
    minHeight,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: iconLeft && iconRight ? "space-between" : "center",
    gap: 8,
    cursor: "pointer",
    border: "none",
    width: fullWidth ? "100%" : "auto",
    transition: "transform 0.15s ease, opacity 0.15s ease",
    ...(isPrimary && { background: colors.navy, color: colors.white }),
    ...(isSecondary && { background: colors.turq, color: colors.navy }),
    ...(isTertiary && { background: "transparent", color: colors.navy, border: `1.5px solid ${colors.navy}` }),
    ...style,
  };

  return (
    <button
      style={baseStyle}
      onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.97)")}
      onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
      onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
      {...rest}
    >
      {iconLeft}
      <span>{children}</span>
      {iconRight}
    </button>
  );
}
