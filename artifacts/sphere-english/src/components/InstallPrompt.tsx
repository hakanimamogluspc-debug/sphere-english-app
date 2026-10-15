import { useEffect, useState } from "react";
import { Download, X, Share } from "lucide-react";
import { isIos, isNativeShell, isStandalone } from "@/lib/pwa";

/**
 * "Ana ekrana ekle" daveti.
 *
 * - Android/Chrome: beforeinstallprompt yakalanır → tek tıkla yükleme.
 * - iOS Safari: prompt API yok → "Paylaş → Ana Ekrana Ekle" ipucu.
 * - Gösterim kuralı: 2. ziyaretten itibaren, kapatılırsa 14 gün sessiz, zaten
 *   yüklüyse / Capacitor içindeyse hiç.
 */
const DISMISS_KEY = "sphere_pwa_dismissed_at";
const VISITS_KEY = "sphere_pwa_visits";
const SNOOZE_DAYS = 14;

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

export default function InstallPrompt() {
  const [bip, setBip] = useState<BIPEvent | null>(null);
  const [show, setShow] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (isStandalone() || isNativeShell()) return;
    try {
      const dismissed = Number(localStorage.getItem(DISMISS_KEY) || 0);
      if (dismissed && Date.now() - dismissed < SNOOZE_DAYS * 86400_000) return;
      const visits = Number(localStorage.getItem(VISITS_KEY) || 0) + 1;
      localStorage.setItem(VISITS_KEY, String(visits));
      if (visits < 2) return;
    } catch { return; }

    if (isIos()) {
      // iOS: 3 sn sonra ipucu göster
      const t = setTimeout(() => { setIos(true); setShow(true); }, 3000);
      return () => clearTimeout(t);
    }

    const onBip = (e: Event) => {
      e.preventDefault();
      setBip(e as BIPEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  if (!show) return null;

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
    setShow(false);
  };

  const install = async () => {
    if (!bip) return;
    await bip.prompt();
    const { outcome } = await bip.userChoice;
    if (outcome === "accepted") setShow(false); else dismiss();
    setBip(null);
  };

  return (
    <div
      role="dialog"
      aria-label="Uygulamayı ana ekrana ekle"
      style={{
        position: "fixed", left: 12, right: 12, bottom: "calc(env(safe-area-inset-bottom, 0px) + 72px)", zIndex: 9000,
        background: "#1B365D", color: "#fff", borderRadius: 16, padding: "12px 14px",
        boxShadow: "0 12px 32px rgba(27,54,93,.35)", display: "flex", alignItems: "center", gap: 12,
        maxWidth: 480, margin: "0 auto",
      }}
    >
      <img src="/icons/icon-96.png" alt="" width={44} height={44} style={{ borderRadius: 10, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 14 }}>Sphere'i ana ekrana ekle</div>
        <div style={{ fontSize: 12, opacity: .85, lineHeight: 1.35 }}>
          {ios
            ? <>Safari'de <Share size={12} style={{ display: "inline", verticalAlign: "-2px" }} /> <b>Paylaş</b> → <b>Ana Ekrana Ekle</b></>
            : "Uygulama gibi açılır, daha hızlı yüklenir."}
        </div>
      </div>
      {!ios && (
        <button onClick={install} style={{ background: "#0ea5e9", color: "#fff", border: 0, borderRadius: 10, padding: "8px 12px", fontWeight: 800, fontSize: 13, display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <Download size={14} /> Ekle
        </button>
      )}
      <button onClick={dismiss} aria-label="Kapat" style={{ background: "transparent", border: 0, color: "#fff", opacity: .7, padding: 4, flexShrink: 0 }}>
        <X size={16} />
      </button>
    </div>
  );
}
