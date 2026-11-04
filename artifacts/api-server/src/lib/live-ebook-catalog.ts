/**
 * Botlar (Instagram, WhatsApp, site sohbet asistanı) için CANLI e-kitap kataloğu.
 *
 * www.sphereenglish.com/e-kitaplar sayfasının kullandığı veriyle aynı kaynaktan (veritabanı)
 * okunur: admin'de fiyat / kitap değişince botlar da en geç birkaç dakika içinde güncel fiyatı söyler.
 * Sayfayı HTML olarak kazımak yerine doğrudan veriyi okumak daha güvenilir (sayfa tasarımı değişince bozulmaz).
 */

import { pool } from "@workspace/db";

const SITE = "https://www.sphereenglish.com";
const CACHE_MS = 5 * 60 * 1000;
let cache: { at: number; text: string } | null = null;

const tl = (n: unknown) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(Number(n));

/** www'deki gruplama ile aynı: kategoride "sektör" / "beceri" geçiyorsa o grup, değilse 1000 Kelime serisi */
function groupOf(category: string | null): string {
  const c = (category ?? "").toLocaleLowerCase("tr-TR");
  if (c.includes("sektör")) return "Sektörel İngilizce";
  if (c.includes("beceri")) return "Beceri Kitapları";
  return "İş İngilizcesinde Kullanılan 1000 Kelime";
}

export async function getLiveEbookCatalog(): Promise<string> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.text;
  try {
    const [books, sets] = await Promise.all([
      pool.query(
        `SELECT slug, title, category, price_try, list_price_try
           FROM ebooks WHERE is_active = TRUE
          ORDER BY category NULLS FIRST, series_order NULLS LAST, title`,
      ),
      pool.query(
        `SELECT b.slug, b.title, b.price_try, b.list_price_try,
                (SELECT COUNT(*)::int FROM ebook_bundle_items i WHERE i.bundle_id = b.id) AS item_count
           FROM ebook_bundles b WHERE b.is_active = TRUE
          ORDER BY b.is_featured DESC, b.sort_order NULLS LAST, b.id`,
      ),
    ]);

    const groups = new Map<string, string[]>();
    for (const b of books.rows as any[]) {
      const g = groupOf(b.category);
      const list = Number(b.list_price_try) > Number(b.price_try) ? ` (liste fiyatı ${tl(b.list_price_try)})` : "";
      const line = `- "${b.title}" — ${tl(b.price_try)}${list} — ${SITE}/e-kitaplar/${b.slug}`;
      groups.set(g, [...(groups.get(g) ?? []), line]);
    }
    const setLines = (sets.rows as any[]).map((s) => {
      const list = Number(s.list_price_try) > Number(s.price_try) ? ` (liste fiyatı ${tl(s.list_price_try)})` : "";
      const n = s.item_count ? ` (${s.item_count} kitap)` : "";
      return `- "${s.title}"${n} — ${tl(s.price_try)}${list} — ${SITE}/e-kitaplar/paketler/${s.slug}`;
    });

    const parts = [
      `## E-KİTAP KATALOĞU (CANLI — ${SITE}/e-kitaplar sayfasıyla aynı veri, KDV dahil)`,
      ...[...groups.entries()].flatMap(([g, lines]) => [`### ${g} (${lines.length} kitap)`, ...lines]),
      ...(setLines.length ? ["### Setler / paketler", ...setLines] : []),
      "Kurallar: E-kitap fiyatı sorulursa YALNIZCA bu listedeki fiyatı söyle; listede olmayan kitap ya da fiyat uydurma.",
      "Her kitabın 5 sayfalık ücretsiz ön izlemesi kitap sayfasında var. Tam ücretsiz e-kitap yok.",
    ];
    const text = books.rows.length ? parts.join("\n") : `## E-KİTAPLAR\nGüncel kitap listesi ve fiyatlar: ${SITE}/e-kitaplar (fiyat uydurma).`;
    cache = { at: Date.now(), text };
    return text;
  } catch (e: any) {
    console.warn("[live-ebook-catalog] okunamadı:", e?.message);
    return cache?.text ?? `## E-KİTAPLAR\nGüncel kitap listesi ve fiyatlar: ${SITE}/e-kitaplar (fiyat uydurma, sayfaya yönlendir).`;
  }
}
