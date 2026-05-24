# Sphere English — Otomatik Lead Keşif Sistemi

Apify ile günlük olarak 4 segmentten potansiyel müşteri (lead) bulan, doğrulayan ve admin panelinde gösteren sistem. **Mail göndermez** — sadece keşfeder. Lead'leri görüp manuel olarak iletişime geçersin.

---

## Ne yapar?

Her gece 03:00'te (cron ile) **4 segmenti paralel olarak tarar**:

| Segment | Kaynak | Hedef |
|---|---|---|
| **B2B İK Müdürleri** | LinkedIn (Apify) | Türkiye'deki İK / L&D / Eğitim müdürleri |
| **B2B KOBİ Sahipleri** | LinkedIn (Apify) | 11-500 kişilik şirketlerin CEO/kurucuları |
| **B2C Profesyoneller** | LinkedIn (Apify) | Senior mühendisler, yöneticiler, müdürler |
| **Eğitim Partnerleri** | Google Maps (Apify) | Dil okulları, özel kurslar |

**Her lead için toplanan veriler:**
- İsim (ad, soyad, tam isim)
- Email + **MX/SMTP doğrulama sonucu**
- Pozisyon, kıdem (junior/mid/senior/c-level)
- Şirket adı, domain, website, telefon
- LinkedIn URL'i
- Sektör, lokasyon

**Duplikasyon:** Email bazlı unique. Aynı kişi ikinci kez bulunursa `last_seen_at` güncellenir, yeni kayıt eklenmez.

---

## Kurulum (5 adım)

### 1. Apify hesabı aç ve token al

1. https://apify.com → Sign up (ücretsiz başlangıç: $5 kredi)
2. Sol menüde **Settings → Integrations → API tokens**
3. **Create new token** → İsim ver (örn: "sphere-prod") → kopyala
4. Ücretli plan: aylık $49 → yaklaşık 6000 lead/ay yapar

### 2. Environment değişkenlerini ekle

Easypanel veya .env dosyasına:

```bash
# Zorunlu
APIFY_API_TOKEN=apify_api_xxxxxxxxxxxxxxxxxxxxxxxxx

# Opsiyonel — segment başına günlük lead limiti (default: 50)
OUTREACH_LIMIT_PER_SEGMENT=50
```

> **Not:** Apify aktör maliyetleri değişkendir. İlk hafta için `OUTREACH_LIMIT_PER_SEGMENT=20` ile başlamanı, sonra kademeli artırmanı öneririm.

### 3. DB migration

Yeni iki tablo eklendi: `outreach_leads`, `outreach_runs`. Drizzle push komutu ile uygula:

```bash
cd lib/db
pnpm push
```

### 4. Bağımlılıkları yükle

```bash
pnpm install
```

> `tsx` paketi cron script'i için api-server'ın devDependencies'ine eklendi.

### 5. Cron'u kur

**Easypanel'de** (önerilen):
- Service → Schedules → Add schedule
- Command: `cd /app/artifacts/api-server && pnpm discover`
- Cron: `0 3 * * 1-5` (Pzt-Cum, 03:00)

**Linux host cron'da**:
```cron
0 3 * * 1-5 cd /path/to/sphere-english-app/artifacts/api-server && pnpm discover >> /var/log/sphere-discover.log 2>&1
```

Veya elle test için:
```bash
cd artifacts/api-server
pnpm discover
```

---

## Admin paneli kullanımı

URL: `https://app.sphereenglish.com/admin/outreach`
Sidebar: **Lead Keşfi**

### Sayfada neler var?

1. **Üst butonlar:**
   - **Şimdi Keşfet:** Tüm 4 segmenti manuel tetikler (~5-10 dk)
   - **Email Doğrula:** Doğrulanmamış lead'lerin email'lerini Apify ile kontrol eder
   - **Yenile:** Verileri yeniden çeker

2. **İstatistik kartları:** Toplam, bu hafta yeni, doğrulanmış email, doğrulama bekleyen.

3. **Segment kartları:** Her segment için ayrı sayaç + hızlı tetikleme.

4. **Son Keşif Çalıştırmaları (toggle):** Her Apify çalıştırmasının logu — kaç lead tarandı, kaç yeni eklendi, hatalar.

5. **Filtre çubuğu:**
   - Arama (email, isim, şirket, pozisyon)
   - Segment filtresi
   - Durum filtresi (yeni / görüldü / iletişimde / nitelikli / reddedildi / arşiv)
   - Email durum filtresi (geçerli / riskli / geçersiz / catch-all)
   - **CSV indir**

6. **Lead tablosu:**
   - Email'in yanındaki simgeyle tek tıkla kopyala
   - LinkedIn profili butonu
   - Mailto butonu (varsayılan mail client'ı açar)
   - Durum dropdown'u (lead'i yönetmek için)

---

## API endpoint'leri

Tümü `requireRole("admin")` koruması altında.

| Method | Path | Açıklama |
|---|---|---|
| GET | `/api/admin/outreach/leads` | Filtrelenmiş lead listesi (pagination) |
| GET | `/api/admin/outreach/leads/:id` | Tek lead detay |
| PATCH | `/api/admin/outreach/leads/:id` | Status / notes / tags güncelle |
| DELETE | `/api/admin/outreach/leads/:id` | Arşivle |
| POST | `/api/admin/outreach/leads/bulk` | Toplu işlem |
| GET | `/api/admin/outreach/stats` | Dashboard istatistikleri |
| GET | `/api/admin/outreach/runs` | Son 30 çalıştırma |
| POST | `/api/admin/outreach/trigger` | Manuel keşif (body: `{ segment?, limit? }`) |
| POST | `/api/admin/outreach/verify` | Manuel email doğrulama |
| GET | `/api/admin/outreach/export.csv` | CSV export (filtreli) |

---

## Apify Aktörlerini Özelleştirme

`artifacts/api-server/src/services/outreach-discovery.ts` içindeki `SEGMENT_CONFIGS` objesini düzenleyerek:
- Hangi Apify actor'ünü kullanacağını
- Arama anahtar kelimelerini
- Lokasyon filtresini
- Şirket büyüklüğü filtresini
- Segment başına lead limitini

değiştirebilirsin.

**Apify Marketplace'ten alternatif actor'lar:**
- LinkedIn People Search: `apimaestro/linkedin-profile-search`, `dev_fusion/linkedin-profile-scraper`
- Email validator: `blackbird-team/email-verifier`, `vdrmota/email-checker`
- Google Maps: `compass/crawler-google-places`, `nwua9Gu5YrADL7ZDj/google-maps-scraper`

Her actor'ün input şeması farklı — değiştirmeden önce Apify dashboard'unda "Try this actor" sayfasından input formatını kontrol et.

---

## Yapı

```
artifacts/api-server/src/
├── routes/outreach.ts                 # Admin API
├── services/
│   ├── apify-client.ts                # Apify SDK wrapper (native fetch)
│   ├── outreach-discovery.ts          # 4 segment keşfi + dedup
│   └── outreach-verifier.ts           # Email doğrulama
└── jobs/discovery-cron.ts             # Günlük cron entry point

artifacts/sphere-english/src/
└── pages/admin/Outreach.tsx           # Admin UI

lib/db/src/schema/
└── outreach.ts                        # outreach_leads, outreach_runs tabloları
```

---

## Maliyet tahmini

| Senaryo | Apify maliyeti | Lead/ay |
|---|---|---|
| Test (`limit=20`/segment, haftalık) | ~$8/ay | ~320 |
| Standart (`limit=50`/segment, günlük Pzt-Cum) | ~$35/ay | ~4400 |
| Yoğun (`limit=100`/segment, günlük) | ~$70/ay | ~8800 |

**İlk hafta test moduyla başla**, sonuçları gör, sonra ölçeği büyüt.

---

## Sorun Giderme

**"APIFY_API_TOKEN tanımlı değil" hatası:**
- `.env` dosyasını veya Easypanel environment ayarlarını kontrol et
- Servisi yeniden başlat

**Keşif başlıyor ama lead eklenmiyor:**
- `outreach_runs` tablosundaki `error_message` alanına bak
- Apify dashboard'unda actor run'ın çıktısını incele — input şeması değişmiş olabilir
- Önce admin panelden "Son Keşif Çalıştırmaları" toggle'ını aç

**Çok fazla "skipped" lead:**
- Bu normal — email'i bulamayanlar atlanıyor
- `apify/email-finder` actor'ünü ekleyerek email keşfini ayrı katmana taşıyabilirsin

**Email'ler genelde "risky" işaretleniyor:**
- LinkedIn'den gelen email'lerin çoğu corporate mail server'larında "catch-all" — bu beklenen durum
- `valid` olanlara öncelik ver, `risky` olanları manuel kontrol et

---

## Sonraki Adımlar (öneri)

Şu an sistem sadece **lead keşfi + doğrulama** yapıyor. İleri seviye için:

1. **AI ilk satır** — GPT-4o-mini ile her lead için LinkedIn profilinden özgün açılış cümlesi (~$0.0001/lead)
2. **Şirket büyüklüğü zenginleştirme** — Clearbit/Apollo entegrasyonu ile şirket sayısı ve revenue
3. **Fit score** — ICP'ye uygunluk puanı (0-100), tabloyu otomatik sıralama
4. **Slack bildirim** — günlük özet Slack'e
5. **Mevcut `contact_leads`'e merge** — formdan gelenlerle birleşik tek görünüm

Şu an bunları kurmaya GEREK YOK — önce sistemi 2 hafta çalıştır, gerçek verilerle ne işe yaradığını gör, sonra önceliklendir.
