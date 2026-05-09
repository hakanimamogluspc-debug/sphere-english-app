import { useEffect } from "react";

/**
 * Aktif bir oturum/akış var iken kullanıcı F5 yaparsa veya sekmeyi kapatırsa
 * tarayıcı standart "Are you sure?" uyarısı gösterir. Modern tarayıcılar
 * güvenlik nedeniyle özel mesajı yoksayar — sadece varsayılan diyaloğu gösterir.
 *
 * Kullanım:
 *   useBeforeUnload(messages.length > 0); // sohbet aktifken uyar
 */
export function useBeforeUnload(active: boolean) {
  useEffect(() => {
    if (!active) return;

    const handler = (e: BeforeUnloadEvent) => {
      // returnValue + preventDefault — tarayıcılar arası uyumluluk için
      e.preventDefault();
      e.returnValue = "";
      return "";
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [active]);
}
