import { useLocation } from "wouter";
import { TabBar, colors, fonts, type TabKey } from "@/components/mobile";

/**
 * Mobil için henüz tam gerçekleştirilmemiş sayfaların şablonu.
 * TabBar çalışsın diye 4 sekme için ortak wrapper.
 */
export function MobilePlaceholder({
  active, title, description,
}: {
  active: TabKey;
  title: string;
  description: string;
}) {
  const [, setLocation] = useLocation();

  const handleTab = (t: TabKey) => {
    if (t === "home") setLocation("/m/anasayfa");
    else if (t === "practice") setLocation("/m/pratik");
    else if (t === "library") setLocation("/m/kutuphane");
    else if (t === "rewards") setLocation("/m/kazanim");
    else if (t === "profile") setLocation("/m/profil");
  };

  return (
    <div style={{ minHeight: "100vh", background: colors.white, paddingBottom: 88 }}>
      <div style={{ padding: "48px 24px" }}>
        <div style={{
          fontFamily: fonts.heading, fontWeight: 700, fontSize: 11,
          color: colors.turqDeep, textTransform: "uppercase", letterSpacing: "0.06em",
          marginBottom: 8,
        }}>
          Sphere Mobil
        </div>
        <div style={{
          fontFamily: fonts.heading, fontWeight: 900, fontSize: 28,
          letterSpacing: "-0.02em", color: colors.navy, marginBottom: 12,
          lineHeight: 1.15,
        }}>
          {title}
        </div>
        <div style={{ fontSize: 14, color: colors.neutral, lineHeight: 1.6 }}>
          {description}
        </div>

        <div style={{
          marginTop: 32, padding: 24, background: colors.navy50,
          borderRadius: 16, textAlign: "center",
        }}>
          <div style={{
            fontFamily: fonts.heading, fontWeight: 700, fontSize: 13,
            color: colors.navy, marginBottom: 8,
          }}>
            Yakında
          </div>
          <div style={{ fontSize: 12, color: colors.neutral, lineHeight: 1.5 }}>
            Bu sekme geliştirme aşamasında. Şimdilik masaüstü versiyonunu
            kullanabilirsin.
          </div>
        </div>
      </div>
      <TabBar active={active} onChange={handleTab} />
    </div>
  );
}

export function MobilePractice() {
  return (
    <MobilePlaceholder
      active="practice"
      title="Pratik"
      description="18 modülünün tamamı burada. Modül seçimi, ilerleme haritası ve pratik geçmişi geliyor."
    />
  );
}

export function MobileLibrary() {
  return (
    <MobilePlaceholder
      active="library"
      title="Kütüphane"
      description="İş kartları arama, seviye + kategori filtreleri, favoriler ve öğrenme geçmişi burada olacak."
    />
  );
}

export function MobileRewards() {
  return (
    <MobilePlaceholder
      active="rewards"
      title="Kazanımlar"
      description="Günlük seri, kilometre taşları, rozetler ve ödül kataloğu bu sekmeye taşınacak."
    />
  );
}

export function MobileProfile() {
  return (
    <MobilePlaceholder
      active="profile"
      title="Profil"
      description="Kişisel istatistikler, rozetler, bildirim ayarları ve hesap yönetimi burada olacak."
    />
  );
}
