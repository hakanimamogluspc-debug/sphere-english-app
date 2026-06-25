# Hero Banner — AI Üretim Prompt'ları (Açık & Aydınlık Tema)

Sphereenglish.com ana sayfa hero görseli için 4 farklı yaklaşım. **Site beyaz/mavi ağırlıklı olduğu için tüm prompt'lar bright, airy, açık paletli sahnelere yönelik.**

**Hedef boyut:** 1920×1080 (16:9) ya da 2400×1350 (retina için)
**Marka palet referansı:**
- Beyaz/krem `#ffffff` & `#f8fafc`
- Açık mavi `#e8f0fe` & `#bae6fd`
- Marka mavi `#0ea5e9` (azure)
- Lacivert vurgu (az kullan) `#1B365D`
- Sıcak vurgu (çok az) `#f59e0b` (altın)

---

## Önerilen araç:

| Araç | Avantaj | URL |
|---|---|---|
| **ChatGPT Plus** | Sohbetle iterasyon kolay, marka tutarlılığı iyi | chatgpt.com |
| **Midjourney v7** | En sinematik, aydınlık fotoğraf kalitesi | midjourney.com |
| **Gemini (ücretsiz)** | Bütçe yoksa en iyi free seçenek | aistudio.google.com |
| **Ideogram 3.0** | Yazı/logo gerekirse | ideogram.ai |

---

## Prompt #1 — Aydınlık Modern Ofis (EN ÖNERİLEN, kurumsal güven + ferah)

**Kullanım:** ChatGPT Plus, Gemini, Midjourney (v7 için sonuna `--ar 16:9 --v 7 --style raw` ekle)

```
Bright airy corporate photography of a confident Turkish female professional
in her late 30s sitting at a clean white minimalist desk with a thin laptop
showing a video conference grid with diverse international colleagues. She
wears soft sky-blue tailored blazer over white shirt, genuine warm smile.
Background is a contemporary glass-walled office flooded with bright soft
natural daylight from floor-to-ceiling windows — overcast sky reflecting clean
white-and-azure tones. Walls are pale and minimalist with subtle azure
accents (#0ea5e9). Color palette: predominantly white, pale blue (#bae6fd),
and crisp azure (#0ea5e9) with one soft warm gold (#fcd34d) accent in a
plant or small decor element. NO dark or moody tones, NO heavy navy
dominance — overall feeling is fresh, optimistic, premium and modern.
Editorial commercial photography style, shallow depth of field (f/2.0),
Hasselblad medium format, 16:9 cinematic composition, soft diffused
high-key lighting, hyperrealistic, ultra detailed, premium executive
education brand aesthetic. No text or logos visible.
```

---

## Prompt #2 — AI Konuşma Pratiği (teknoloji + aydınlık)

**Kullanım:** AI Studio özelliğini öne çıkar — temiz, gelecek vurgusu

```
Bright cinematic photograph of a Turkish professional in their early 30s
wearing minimalist white wireless earbuds, mid-conversation, confident soft
smile. Sitting at a white modern home office desk facing a sleek laptop.
Around the laptop, subtle floating holographic UI elements in pure azure
blue (#0ea5e9) — clean audio waveforms and language scoring graphics,
appearing weightless against soft white background. The room is bathed in
bright window light from upper-left, white walls, pale oak desk, single
green plant. Predominantly white-and-azure palette, no navy or black
domination, no heavy shadows. The overall mood is calm, modern, futuristic
yet approachable. Shot on Sony A7R V, 85mm prime lens at f/1.8, ultra-
realistic skin texture, premium Apple-keynote style technology
photography, high-key lighting, 16:9 widescreen. No text or logos.
```

---

## Prompt #3 — Ferah Toplantı Odası + Analytics (B2B vurgu)

**Kullanım:** "Şirket çalışanlarını yöneticiler izliyor" mesajını verir

```
Wide-angle bright corporate photograph of a senior Turkish HR executive in
a modern glass-walled meeting room with abundant natural daylight. She
stands beside a large light-framed display showing a clean abstract
analytics dashboard — soft azure (#0ea5e9) progress bars and crisp data
visualization against a near-white panel. Background reveals 4 diverse
business professionals working casually at a pale oak conference table.
Tall windows show soft blue-sky daylight. Color palette is dominantly
white, pale cool grey, and azure accents — no dark navy walls, no moody
shadows. Crisp three-point lighting, premium SaaS marketing brand
photography aesthetic, Apple Vision Pro keynote vibe, ultra-detailed,
shot on RED camera, 16:9 cinematic ratio. No visible text or logos —
keep dashboard graphics abstract and clean.
```

---

## Prompt #4 — Kurucu/Executive Portrait (sıcak ama aydınlık)

**Kullanım:** Hakkımızda sayfası için. Insan duygusu + premium hava

```
Intimate portrait photography of a confident Turkish female professional in
her 40s, genuine warm smile, looking slightly off-camera. Background is a
luxurious blurred bright corporate environment with soft natural bokeh
from large overcast-sky windows — predominantly white and pale blue with
warm gold (#fcd34d) highlights. She wears a crisp tailored cream blazer
over a soft sky-blue blouse. Lighting is high-key, soft golden hour
from window-left creating flattering shadowless beauty light. Premium
editorial portrait style reminiscent of Bloomberg Businessweek or Harvard
Business Review cover. Hasselblad 100mm portrait lens at f/1.4, hyperrealistic
skin detail, color graded with soft white-azure-cream palette — NO dark
navy backgrounds, NO moody tones. 16:9 horizontal composition, subject on
right-third following rule of thirds. No text.
```

---

## Önerilen iş akışı (5 dakika):

1. **ChatGPT Plus → Image üretici** seçeneğini aç
2. **Prompt #1**'i yapıştır → 4 varyant gelir
3. Beğenmediğinden iter et: "make the room brighter" / "softer lighting" / "more white in the palette"
4. Beğendiğinde "Generate 1920x1080 version" iste
5. İndir → `artifacts/www/public/assets/images/hero-online-english.webp` üzerine yaz

## Optimizasyon

- WebP'ye çevir, kalite 85%
- [Squoosh](https://squoosh.app)'a sürükle → boyut %30 düşür
- Page Speed Insights ile test et

## Doğru palet için kritik ipuçları (her promptta var):

- ✅ `bright`, `airy`, `high-key lighting`
- ✅ `white`, `pale blue`, `azure (#0ea5e9)`
- ✅ `soft diffused daylight`
- ❌ `dark navy`, `moody`, `dramatic shadows`
- ❌ Heavy contrast (bunlar koyu görsel üretir)

Üretilen görseli kabul etmeden önce kendi kontrol listen:
- [ ] Genel ton açık mı? (Beyaz hakim olmalı)
- [ ] Azure mavi var mı? (Vurgu olarak)
- [ ] Sıcak altın çok mı kullanılmış? (Az olmalı — sadece small accent)
- [ ] Koyu lacivert geniş alanları kaplıyor mu? (Olmamalı)
- [ ] İnsan doğal mı? (Photoshop hissi vermemeli)

---

**Bonus — kısa Midjourney sentaksı (daha hızlı iterasyon):**

```
bright corporate photo, Turkish female executive, white minimalist office,
floor to ceiling windows, soft natural light, video call on laptop screen,
azure blue accents, white and pale blue palette, high key lighting,
shallow depth of field, hasselblad, 16:9 --ar 16:9 --v 7 --style raw
```

İyi şanslar! Sonucu paylaş, beraber kritik edelim.
