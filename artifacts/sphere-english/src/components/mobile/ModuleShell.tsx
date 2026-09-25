import { ReactNode } from "react";
import { ModuleHeader } from "./ModuleHeader";
import { colors } from "./tokens";

/**
 * Tam sayfa mobil modül sarmalayıcı.
 * Header (sticky) + scroll içerik + opsiyonel footer (sticky).
 * TabBar için 88px boşluk bırakır (footer yoksa).
 */

interface Props {
  title: string;
  subtitle?: string;
  backTo?: string;
  rightAction?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  /** İçerik alanı için özel arka plan (varsayılan beyaz) */
  bg?: string;
  /** İçerik padding'i (varsayılan 20px yatay, 16px üst) */
  contentPadding?: string;
  /** TabBar için alt boşluk ekle */
  withTabBar?: boolean;
}

export function ModuleShell({
  title, subtitle, backTo, rightAction, footer, children,
  bg = colors.white, contentPadding = "16px 20px 24px",
  withTabBar = false,
}: Props) {
  const bottomPad = footer ? 24 : (withTabBar ? 88 : 24);
  return (
    <div style={{
      minHeight: "100vh",
      background: bg,
      display: "flex",
      flexDirection: "column",
    }}>
      <ModuleHeader
        title={title} subtitle={subtitle}
        backTo={backTo} rightAction={rightAction}
      />
      <main style={{
        flex: 1,
        padding: contentPadding,
        paddingBottom: bottomPad,
      }}>
        {children}
      </main>
      {footer && (
        <div style={{
          position: "sticky", bottom: 0, zIndex: 30,
          background: colors.white,
          borderTop: `1px solid ${colors.navy50}`,
          padding: "12px 16px 20px",
        }}>
          {footer}
        </div>
      )}
    </div>
  );
}
