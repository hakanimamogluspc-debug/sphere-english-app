/**
 * ProGate — abonelik sistemi kaldırıldı (2026-09); kilit yok, içerik doğrudan gösterilir.
 * Props imzası çağıran yerler bozulmasın diye korunuyor.
 * Eski gate UI'ı için git geçmişine bak: components/subscription/ProGate.tsx @ 2026-09.
 */
import type { ComponentType } from "react";

interface Props {
  moduleKey: string;
  featureName: string;
  children: React.ReactNode;
}

export default function ProGate({ children }: Props) {
  return <>{children}</>;
}

/** HOC — App.tsx'teki sarmalamalar için korunuyor (artık pass-through). */
export function withProGate<P extends object>(
  Component: ComponentType<P>,
  moduleKey: string,
  featureName: string,
) {
  return function Wrapped(props: P) {
    return (
      <ProGate moduleKey={moduleKey} featureName={featureName}>
        <Component {...props} />
      </ProGate>
    );
  };
}
