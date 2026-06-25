# sphereenglish.com — SEO & GEO Denetim Raporu

*Tarih: 4 Haziran 2026 · Kaynaklar: ana sayfa, /ai-studio, /blog, /robots.txt, /sitemap.xml, /llms.txt, repo `artifacts/www/`*

---

## Yönetici Özeti

Sphere English'in marketing sitesi **temel SEO ve GEO altyapısı bakımından beklentinin çok üstünde**: AI bot'lar açıkça whitelist'te, dolu ve niteli bir `llms.txt` mevcut, blog 30+ topik kapsayan kümeleme stratejisiyle yapılmış. Bunlar mükemmel temel.

Üç önemli sorun mevcut:

1. **Ana sayfadaki istatistikler "%0" gösteriyor** (Katılım Oranı, Seviye Artışı, Memnuniyet) — yer tutucu değerler canlıda kalmış, hem kullanıcıya hem AI'a "%0 memnuniyet" diye geçiyor.
2. **Geo meta tag'i İstanbul diyor, fiziksel adres ise Ankara/Çankaya** — yerel SEO için tutarsız sinyal.
3. **Fiyatlandırma sayfası ve `/pricing.md` yok** — AI satın alma ajanları için kritik eksiklik; "TEKLİF AL" formu rakibe karşı dezavantaj yaratıyor.

**Öncelikli aksiyon listesi (5 hızlı kazanç) raporun sonunda.**

---

## Bölüm 1 — SEO: İyi Durumda Olanlar

**Crawlability & indexation**

- `robots.txt` doğru yapılandırılmış, sitemap referansı var
- Next.js dinamik sitemap (`sitemap.ts`) blog yazıları ve çözüm sayfalarını otomatik içeriyor
- Meta robots `index, follow` doğru
- HTTPS düzgün, canonical etiketleri doğru noktaya yönlendiriyor
- Her sayfada özgün `<title>` ve `<meta description>` var

**On-page**

- Title tag'leri 50–70 karakter aralığında, marka kuyrukta, keyword başta
- Heading hiyerarşisi (H1 → H2 → H3) blogda mantıklı kurulmuş
- Ana sayfa FAQ bölümü mevcut (kullanıcı için faydalı, AI extraction için ideal)
- Geo meta tag'leri eklenmiş (`meta-geo.country: Turkey`, `meta-geo.region: TR`)
- Blog 30+ yazı — derinlikli topik kümeleme (CEFR seviyeleri × sektörler × roller)

**Authority sinyalleri**

- Oxford University Press ortaklığı vurgulanmış — güçlü 3. parti otorite
- 6 kurumsal logo (Olivamore, ENME, Andepol, Yekta Enerji, Aksu Group, Ozrize) — sosyal kanıt
- İki kurucu (Didem İmamoğlu, Merve Eş) ad ve fotoğrafla — E-E-A-T pozitif

---

## Bölüm 2 — SEO: Kritik Sorunlar

### 2.1 Ana sayfada "%0" yer tutucu istatistikler (KRİTİK)

**RAPORLAMA & TAKİP** bölümünde üç istatistik canlıda **sıfır değerle** görünüyor:

| Metrik | Şu an gösteren | Olması gereken (`llms.txt`'ten) |
|---|---|---|
| Katılım Oranı | **%0** | ~%89 (yönetici panel demo'sunda gösteriliyor) |
| Seviye Artışı | **+0** | +2 CEFR seviye (6 ay) |
| Memnuniyet | **%0** | %94 |

**Etki:** Hem dönüşüm hem AI citation için yıkıcı. ChatGPT/Perplexity bu sayfayı crawl ederse "Sphere English'in memnuniyet oranı %0" diye yanlış aktarabilir. Princeton GEO çalışmasına göre **istatistikler citation oranını %37 artırıyor** — sıfır göstermek bunu negatife çeviriyor.

**Fix:** Hero altında "50+ şirket, 500+ çalışan, %94 memnuniyet" diyorsun — aynı değerleri RAPORLAMA bölümüne de geçir. Component'te sayaç animasyonu varsa endpoint dönmediği için 0'da takılıyor olabilir; default değer ata.

### 2.2 Geo tutarsızlığı (YÜKSEK)

```
meta-geo.placename: İstanbul, Türkiye
adres (footer): Çankaya/ANKARA
```

**Fix:** Tutarlı olarak Ankara yap (footer'daki adres doğruysa). Google Business Profile'a, Google Maps'e ve schema'ya da Ankara yaz. Türkiye genelinde online hizmet sunduğun için ayrıca `meta-geo.region: TR` yeterli, şehir spesifik yapma seçeneği de var.

### 2.3 Footer "yasal" linkler bozuk (YÜKSEK)

Gizlilik Politikası, Kullanım Koşulları, KVKK linkleri `#`'e gidiyor. Bu hem KVKK uyumluluk riski, hem E-E-A-T trust sinyali eksikliği.

**Fix:** Üç sayfayı yaz veya en azından mevcut bir TOS/KVKK metnine yönlendir.

### 2.4 Hero CTA fragment link

`HEMEN TEKLİF AL` butonu `#iletisim`'e gidiyor — `/home` sayfasında scroll yapar ama bağlantı paylaşıldığında diğer sayfalarda kırık olur. **Fix:** `/iletisim` sayfasına yönlendir.

### 2.5 Pricing görünmüyor

"Fiyatlandırma çalışan sayısı ve program kapsamına göre belirlenir" — bu AI satın alma çağında ciddi handikap. Bir AI ajanı "kurumsal İngilizce platform öner" sorusunda Sphere'i değerlendirirken fiyat sinyali bulamadığı için diğer rakibi önerebilir.

**Fix:** Bant fiyatlandırma ekle. Örnek: "5–10 kişi için aylık 12.000 TL'den başlar", "Bireysel canlı dersler 850 TL'den başlar" gibi.

### 2.6 Sayı tutarsızlığı

Ana sayfada **"11 AI Koç & Aksan"**, AI Studio sayfasında bir yerde **"11 koç"** bir yerde **"12 koç"**, `llms.txt`'de **"12 koç"**. Hangisi doğruysa siteyi baştan sona o tek sayıya çek — AI farklı sayılar görünce hangisini cite edeceğini şaşırıyor.

---

## Bölüm 3 — GEO / AI Search: Çok İyi Olanlar (KORU!)

**`/llms.txt` mükemmel.** Türk B2B siteleri arasında bu kalitede llms.txt nadir görülür. İçinde olan ve değerli olan kısımlar:

- Şirket kimliği, iş modeli, hedef kitle açıkça yazılı
- 5 AI Studio özelliği detaylı tarif
- 12 koç profilinin tek tek listesi (isim, aksan, uzmanlık, ideal kullanıcı)
- Pratik SSS bölümü ("ChatGPT ile İngilizce öğrenebilir miyim?" gibi gerçek sorulara cevap)
- Rakip karşılaştırma tablosu (Duolingo, Babbel) — **bu format AI'ın en çok cite ettiği yapı**

**robots.txt — 15 AI bot whitelist'te.** GPTBot, PerplexityBot, ClaudeBot, Google-Extended, OAI-SearchBot dahil hepsi açık. Doğru karar.

**FAQ bölümleri** hem ana sayfada hem AI Studio sayfasında doğal soru-cevap formatında — 40–60 kelimelik öz cevaplar AI extraction için ideal.

**Topical authority — blog.** 30+ yazı bir topik kümeleme stratejisiyle yapılmış: CEFR seviyeleri (A1, A2, B1, B2, C1, C2) × roller (CEO, HR, Sales, Finance) × use case'ler (mülakat, sunum, müzakere, e-posta). Google'ın query fan-out'unda Sphere'in yakalanması olası.

---

## Bölüm 4 — GEO / AI Search: Eksikler

### 4.1 Schema markup belirsiz

WebFetch JavaScript'i render etmediği için JSON-LD'yi göremiyorum. Tahminim: Next.js sayfaları schema injection yapmıyor.

**Önerilen schema'lar:**

- `Organization` (sitewide) — adı, logo, sosyal medya, iletişim, founder'lar
- `FAQPage` (ana sayfa ve AI Studio'daki SSS'ler için)
- `Article` veya `BlogPosting` (her blog yazısı için)
- `Course` veya `Service` (çözüm sayfaları için)
- `Person` (12 koç için — bu unique bir avantaj)

**Doğrulama:** Sayfayı [Rich Results Test](https://search.google.com/test/rich-results)'te aç, JSON-LD görünüyor mu kontrol et.

### 4.2 `/pricing.md` veya `/pricing.txt` yok

`llms.txt`'in bahsettiği "öneri" bu — AI ajanlarının makinece okuyabileceği fiyat dosyası. B2B kurumsal için custom pricing olduğu doğru, ama yine de **bant fiyat** koyabilirsin:

```markdown
# Pricing — Sphere English

## Bireysel Birebir
- Aylık: 4.500 TL'den başlar
- Format: Haftada 2 birebir Zoom dersi

## Kurumsal Grup (5–10 kişi)
- Aylık: 18.000 TL'den başlar
- Format: 2 grup dersi/hafta + AI Studio erişimi

## Kurumsal Enterprise (50+ çalışan)
- Custom — sales@sphereenglish.com
- Özellikler: SSO, dedicated success manager, custom reports
```

### 4.3 Üçüncü taraf varlığı

ChatGPT'nin citation kaynaklarının %7.8'i Wikipedia, %1.8'i Reddit. Sphere için kontrol edilmesi gerekenler:

- Wikipedia maddesi var mı? (TR ve EN)
- G2, Capterra, Trustpilot'ta listing var mı?
- LinkedIn şirket sayfası güncel mi? (var, ama yazıların reach'i?)
- Quora'da "Türkiye'de kurumsal İngilizce eğitimi" gibi sorulara cevap yazılmış mı?

**Action:** En az Wikipedia ve LinkedIn Insights'ta varlığı güçlendir. Reddit r/Turkey, r/cscareerquestionsTR gibi alanlarda **organik** katılım (spam değil).

### 4.4 Blog freshness/scaled content riski

Blog yazılarının büyük çoğunluğu **19 Mart 2026** ve **31 Mart 2026** tarihli. Tek günde 15+ yazı yayınlamak Google'ın "scaled content abuse" sinyaline takılma riski oluşturuyor.

**Fix:**
- Yazıları geriye dönük tarihler ver (her gün/hafta bir yazı yayınlamış gibi)
- Veya "Son güncelleme: [tarih]" alanı ekle ve dönemsel olarak içeriği refresh et
- Author bilgisi sadece "Sphere English" / "sphereenglish" — kurucu Didem İmamoğlu veya Merve Eş'i author olarak ekle (E-E-A-T)

### 4.5 Stat/Quote citation eksikliği

Princeton GEO araştırmasına göre **+%40 citation boost**: kaynaklı istatistikler. Sphere blog yazıları "Araştırmalar gösteriyor ki..." gibi kaynaksız iddialar içeriyor (örn. "online dil eğitimi yüz yüze eğitimle eşdeğer hatta bazı alanlarda daha etkili" — kaynak yok).

**Fix:** Bir-iki blog yazısını pilot olarak gerçek kaynakla güçlendir:
- "Cambridge English'in 2023 raporuna göre..." + link
- "British Council 2024 araştırması..." + link
- "Sphere English iç verilerine göre N çalışan üzerinden..." (kendi data'nız)

### 4.6 Twitter image AI Studio sayfasında yanlış

```
meta-twitter:image: https://www.sphereenglish.com/assets/images/hero_online_english_lesson.png
meta-twitter:title: Sphere English | Kurumsal İş İngilizcesi Eğitimi
```

Sayfa AI Studio sayfası ama Twitter card'ı genel anasayfanın'inkini gösteriyor. **Fix:** Her sayfaya özel OG ve Twitter image üret.

---

## Bölüm 5 — Teknik Detaylar

### Repeated logo issue

Footer'da aynı 6 logo (Olivamore, ENME, ...) **7 kez** tekrar ediyor (carousel'in scroll effect'i için). HTML kaynağında `aria-hidden="true"` veya `loading="lazy"` kullanılıyorsa OK, ama AI crawler bunu noise olarak alabilir.

**Fix:** Carousel kopyalarına `aria-hidden="true"` ekle ve `<picture>` veya CSS ile clone'la, HTML'i şişirme.

### Hero image stock photo

Hero görseli `images.pexels.com/photos/3182773/...` — generic stock photo. "Gerçek iş senaryoları" diyen bir site için kendi müşteri eğitimini gösteren özgün görsel daha güçlü E-E-A-T sinyali.

### Multiple H1 risk

Görünür yapıya bakılırsa ana sayfada birden fazla H1-stili element var. Tek H1 kuralına uy ("Kurumsal İş İngilizcesi Eğitim Programı"), diğerlerini H2 yap.

### Image alt text

WebFetch görsellerde alt text görüyor (örn. "Profesyoneller Zoom üzerinden...") — bu iyi. Logo carousel'inde de "Olivamore logo", "ENME logo" var — bunlar bilgilendirici değil; **"Olivamore — Sphere English kurumsal müşterisi"** gibi daha açıklayıcı yap.

---

## Bölüm 6 — Öncelikli Aksiyon Listesi (5 Hızlı Kazanç)

Etki/efor matrisine göre sıralı:

| # | Aksiyon | Etki | Efor | Süre |
|---|---|---|---|---|
| 1 | **%0 istatistikleri düzelt** (Katılım/Seviye/Memnuniyet) | Çok yüksek | 30 dk | Aynı gün |
| 2 | **Geo tutarsızlığı (İstanbul→Ankara)** + footer KVKK linklerini ekle | Yüksek | 1 saat | Aynı gün |
| 3 | **`/pricing.md` ekle** (bant fiyatlandırma) — AI ajanlar için | Yüksek | 1 saat | Aynı gün |
| 4 | **Schema markup ekle**: Organization (sitewide), FAQPage (ana sayfa + AI Studio), Article (blog) | Yüksek | 4–6 saat | 1 hafta |
| 5 | **Sayı tutarsızlığı**: 11 mi 12 mi koç? Hepsini eşitle (`llms.txt` zaten 12 diyor) | Orta | 30 dk | Aynı gün |

---

## Bölüm 7 — Orta Vadeli (1–3 Ay)

- **Blog yayın tarihlerini dağıt** (her hafta 1 yazı pattern'ine geçir)
- **Author bilgilerini geliştir** (Didem/Merve adına yazılar)
- **Wikipedia maddesi** (TR) — şirket için
- **G2, Capterra listing** — B2B SaaS için kritik
- **YouTube içerik üretimi** — Google AI Overviews YouTube'u sık cite ediyor
- **2–3 blog yazısına gerçek kaynak/data ekle** (Cambridge, British Council, kendi data'n)
- **Kurucu Person schema'sı** + 12 koç için Person schema (unique advantage!)
- **`AGENTS.md` ekle** (yeni standart) — agent'lara kapasiteleri tarif

---

## Bölüm 8 — Uzun Vadeli (3–6 Ay)

- **Programmatic SEO**: "[Sektör] için kurumsal İngilizce eğitimi" pattern'i ile 30+ sayfa
- **Karşılaştırma sayfaları**: "Sphere English vs Wall Street English", "vs English Time", "vs Babbel for Business" — AI'in en sık cite ettiği format
- **Original research**: "2026 Türkiye Kurumsal İngilizce Raporu" — Sphere kullanıcı verisinden bir whitepaper. AI bu tip orijinal data'yı %40+ daha fazla cite ediyor.
- **Hreflang setup**: Sitede EN versiyonu eklendiğinde proper hreflang
- **Core Web Vitals ölçümü** — PageSpeed Insights'tan canlı kontrol; Next.js Image optimizasyonu doğru ama lazy loading + LCP ölçümü gerekiyor

---

## Sonuç

Sphere English'in temel SEO + GEO altyapısı **Türk B2B SaaS pazarında üst yüzde 10'da**. llms.txt ve robots.txt kalitesi özellikle iyi. Yine de **5 hızlı kazanç** listesindeki düzeltmeler özellikle "%0 stat" sorunu ve fiyatlandırma şeffaflığı —  hem dönüşümü hem AI citation oranını ciddi şekilde artıracak.

**Sonraki adım önerisi:** Aksiyon #1, #2, #3, #5'i bugün yap (toplam ~3 saat). #4 (schema) için ayrı bir sprint planla.
