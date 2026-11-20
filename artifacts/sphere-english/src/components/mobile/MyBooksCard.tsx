import { useEffect, useState } from "react";
import { BookMarked, ArrowRight } from "lucide-react";
import { API } from "@/lib/api-url";
import { colors, fonts } from "./tokens";

/**
 * Mobilde "Kitaplarım" girişi. Kitabı olan kullanıcıya (satın almış ya da admin tanımlamış) gösterilir;
 * kitabı olmayan kullanıcıda hiç görünmez. Mobil ana sayfa ve Kütüphane sekmesinde kullanılır.
 * (Kitaplarım eskiden yalnızca masaüstü yan menüsündeydi; mobilde ulaşmanın yolu yoktu.)
 */
export default function MyBooksCard() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API}/me/ebooks`, { headers: { Authorization: `Bearer ${localStorage.getItem("sphere_token")}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && Array.isArray(d?.ebooks)) setCount(d.ebooks.length); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (count === 0) return null;

  return (
    <a
      href="/kitaplarim"
      style={{
        display: "flex", alignItems: "center", gap: 14,
        padding: "16px 18px", margin: "0 0 14px",
        background: colors.brand, color: "#ffffff", // tema değişse de lacivert zemin + beyaz yazı
        borderRadius: 18, textDecoration: "none",
      }}
    >
      <span style={{
        width: 44, height: 44, borderRadius: 12, flexShrink: 0,
        background: "rgba(255,255,255,0.12)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <BookMarked size={22} strokeWidth={2} color="#4dcfff" />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontFamily: fonts.heading, fontWeight: 800, fontSize: 16, lineHeight: 1.2 }}>
          Kitaplarım
        </span>
        <span style={{ display: "block", fontFamily: fonts.body, fontWeight: 500, fontSize: 13, color: "#4dcfff", marginTop: 2 }}>
          {count} kitap · oku ve kalıplarla pratik yap
        </span>
      </span>
      <ArrowRight size={20} strokeWidth={2.5} color="#ffffff" />
    </a>
  );
}
