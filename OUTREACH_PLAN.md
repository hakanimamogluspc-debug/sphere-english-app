# Sphere English — Otomatik Lead Bulma & Cold Email Sistemi

**Hazırlayan:** Sistem mimari planı
**Tarih:** 24 Mayıs 2026
**Hedef:** Apify ile günlük lead bulma + mevcut Sphere API üzerinden otomatik cold email gönderimi

---

## 1. Mevcut Durum (Bizde Hazır Olan)

İncelediğim altyapıda şunlar **zaten kurulu**, sıfırdan yazmaya gerek yok:

- `contact_leads` tablosu (lead deposu, status: `new` / `contacted` / `qualified` / `lost`)
- `email_campaigns` + `email_events` tabloları (gönderim + tracking: open / click / bounce)
- `email_templates` tablosu ({{AD}}, {{EMAIL}}, {{SOYAD}} değişkenleriyle)
- `Resend` entegrasyonu (`artifacts/api-server/src/lib/email.ts`)
- SMTP fallback (Titan kullanmak istersen direkt çalışır)
- Admin marketing dashboard route'ları (`marketing.ts`)
- Resend webhook handler'ı (open/click/bounce kaydı)

**Bu, projenin %40'ının zaten hazır olduğu anlamına geliyor.**

---

## 2. Yapılacak (Eksik Olan 4 Katman)

```
┌─────────────────────────────────────────────────────────┐
│  KATMAN 1: LEAD DISCOVERY (Apify)                        │
│  Günlük scraping → ham lead listesi                      │
└────────────────────┬────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────┐
│  KATMAN 2: ENRICHMENT & SCORING                          │
│  Email doğrula, şirket büyüklüğü, ICP fit skoru          │
└────────────────────┬────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────┐
│  KATMAN 3: CADENCE ENGINE                                │
│  AI'la kişiselleştirilmiş 3-touch email serisi           │
└────────────────────┬────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────┐
│  KATMAN 4: SCHEDULER + DELIVERABILITY GUARD              │
│  Günlük cron, throttling, reply-stop, bounce-handling    │
└─────────────────────────────────────────────────────────┘
                     ↓
            [MEVCUT] Resend / Titan SMTP gönderim
```

---

## 3. KRİTİK UYARI: Domain Kararı

> **info@sphereenglish.com'dan cold mail gönderme kararını yeniden düşünmeni öneriyorum.**

Şu anki halinde sistem **2-3 hafta içinde domain itibarını yakar**:

| Senaryo | Sonuç |
|---|---|
| Günlük 200+ cold email | Gmail/Outlook spam klasörü |
| Birkaç şikayet bildirimi | Domain blacklist (Spamhaus, Barracuda) |
| Sphere müşterilerine giden faturalar | Spam'e düşer, gözükmez |
| Şifre sıfırlama mailleri | Ulaşmaz, destek talepleri patlar |
| Domain reputation | 6-12 ayda toparlanır (eğer toparlanırsa) |

**Önerdiğim güvenli yol (5 dakikada kurulur, $12/yıl):**

1. Yeni bir domain al: `sphere-edu.com` veya `getsphereenglish.com` (Namecheap, $12/yıl)
2. SPF/DKIM/DMARC ayarla (Resend dashboard otomatik veriyor)
3. Gönderici: `hakan@sphere-edu.com` veya `hello@sphere-edu.com`
4. Footer'da "Sphere English (sphereenglish.com)" yaz — marka açık
5. Yanıtlar Titan inbox'una forward'lansın

**Eğer yine de info@sphereenglish.com diyorsan**, sistem en azından şunları yapacak şekilde kurulmalı:
- Günlük max 30 email (Resend warmup limiti)
- DKIM zorunlu (zaten var olmalı)
- Her email'de net unsubscribe link
- Bounce > %2 olunca otomatik durdur
- Bu rakamlarla aylık ulaşılabilir lead: ~600 — yetersiz

---

## 4. KATMAN 1: Apify ile Lead Discovery

### Hedef kitleler ve Apify actor'ları

| Segment | Apify Actor | Çıktı | Maliyet |
|---|---|---|---|
| **B2B İK Müdürleri** | `apify/linkedin-people-search-scraper` | İK müdürü profilleri (TR şirketler) | ~$0.40 / 100 lead |
| **B2B KOBİ Sahipleri** | `apify/linkedin-company-scraper` + filtre | KOBİ kurucu/CEO listesi | ~$0.50 / 100 lead |
| **B2C Profesyoneller** | `apify/linkedin-people-search-scraper` | Belirli sektör + senior profiller | ~$0.40 / 100 lead |
| **B2B Eğitim Partnerleri** | `compass/google-maps-extractor` | "İngilizce kursu" + "dil okulu" Türkiye | ~$0.30 / 100 işletme |

### Email keşfi
- LinkedIn profili → şirket domain bilgisi
- `apify/email-finder` actor'u domain + isim → email tahmini (Hunter benzeri)
- Doğrulama: `apify/email-validator` (MX kayıt, SMTP ping)

### Discovery cron örneği
Her gün 03:00 TR saatinde:
- 4 hedef segment için Apify scraping job'larını tetikle
- Toplam 200-400 ham lead bekle
- Sonuçları `raw_leads` tablosuna yaz (yeni tablo)
- Enrichment kuyruğuna at

---

## 5. KATMAN 2: Enrichment & Scoring

### Yeni DB tabloları (mevcut `contact_leads`'i bozmadan üzerine inşa)

```sql
CREATE TABLE outreach_leads (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  first_name TEXT,
  last_name TEXT,
  full_name TEXT,
  linkedin_url TEXT,
  company TEXT,
  company_domain TEXT,
  company_size TEXT,         -- '1-10', '11-50', '51-200', vb.
  industry TEXT,
  job_title TEXT,
  seniority TEXT,            -- 'junior', 'mid', 'senior', 'c-level'
  segment TEXT NOT NULL,     -- 'b2b_hr', 'b2b_sme', 'b2c_pro', 'partner'
  source TEXT NOT NULL,      -- 'apify_linkedin', 'apify_gmaps', vb.
  source_run_id TEXT,        -- Apify run ID (debug için)
  email_verified BOOLEAN DEFAULT false,
  email_status TEXT,         -- 'valid', 'risky', 'invalid', 'unknown'
  fit_score INTEGER,         -- 0-100, ICP skoru
  enrichment_data JSONB,     -- ham veriyi sakla
  cadence_status TEXT DEFAULT 'pending', -- 'pending','active','paused','completed','replied','bounced','unsubscribed'
  current_step INTEGER DEFAULT 0,
  next_send_at TIMESTAMP,
  last_event_at TIMESTAMP,
  reply_detected_at TIMESTAMP,
  unsubscribed_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_outreach_leads_next_send ON outreach_leads(next_send_at)
  WHERE cadence_status = 'active';
CREATE INDEX idx_outreach_leads_segment ON outreach_leads(segment);

CREATE TABLE outreach_cadences (
  id SERIAL PRIMARY KEY,
  segment TEXT NOT NULL,
  step INTEGER NOT NULL,           -- 1, 2, 3
  day_offset INTEGER NOT NULL,     -- 0, 3, 7
  subject_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(segment, step)
);

CREATE TABLE outreach_sends (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER REFERENCES outreach_leads(id),
  cadence_id INTEGER REFERENCES outreach_cadences(id),
  step INTEGER NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  resend_email_id TEXT,
  sent_at TIMESTAMP DEFAULT NOW(),
  opened_at TIMESTAMP,
  clicked_at TIMESTAMP,
  bounced_at TIMESTAMP,
  replied_at TIMESTAMP
);

CREATE TABLE outreach_runs (
  id SERIAL PRIMARY KEY,
  job_type TEXT NOT NULL,         -- 'discovery', 'enrichment', 'cadence_send'
  status TEXT NOT NULL,           -- 'running', 'success', 'failed'
  segment TEXT,
  leads_found INTEGER DEFAULT 0,
  leads_added INTEGER DEFAULT 0,
  emails_sent INTEGER DEFAULT 0,
  error_message TEXT,
  apify_run_id TEXT,
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);
```

### Fit Score (ICP — Ideal Customer Profile)

| Sinyal | Puan |
|---|---|
| Şirket büyüklüğü 50-500 (B2B sweet spot) | +30 |
| Job title İK / Eğitim / L&D içeriyor | +25 |
| Senior / C-level | +20 |
| Şirket sektörü: Teknoloji / Finans / İlaç / İhracat | +15 |
| Türkiye lokasyonu | +10 |
| Email doğrulanmış (valid) | +20 |
| LinkedIn profili son 3 ayda aktif | +10 |
| Email "risky" veya "catch-all" | -20 |
| Cinsiyetsiz/yarım isim ("info@", "contact@") | -30 |

**Yalnızca fit_score ≥ 50 olanlar cadence'e girer.**

---

## 6. KATMAN 3: Cadence Engine (3-Touch Sekansı)

### Segment başına sekans tasarımı

#### B2B İK Müdürü Sekansı (3 email, 7 günde)

**Touch 1 (Day 0) — Soğuk açılış**
> Konu: {{FIRST_NAME}}, {{COMPANY}}'de İngilizce eğitimi nasıl yönetiliyor?
> 
> Merhaba {{FIRST_NAME}},
> 
> {{COMPANY}}'nin {{INDUSTRY}} alanındaki büyümesini takip ediyorum. Genelde bu ölçekteki şirketlerde "ekibin İngilizcesi neden hala dökülüyor?" sorusu masaya geliyor.
> 
> Sphere English'te kurumsal müşterilere AI-destekli bireysel İngilizce koçluğu sağlıyoruz — CEFR ölçümü, haftalık raporlama, manager dashboard dahil. Ortalama 4 ayda B1 → B2.
> 
> 15 dakikalık demo için zamanınız uygun mu?
> 
> Hakan

**Touch 2 (Day 3) — Değer ekleyici**
> Konu: Re: {{COMPANY}} ekip İngilizcesi
> 
> {{FIRST_NAME}}, geçen mesajıma ekleyeceğim:
> 
> Geçtiğimiz ay {{INDUSTRY}} sektöründen 3 firmaya CEFR seviye raporu çıkardık. Sonuç: ekibin %60'ı kendi beyan ettiği seviyenin BİR seviye altında.
> 
> {{COMPANY}} için ücretsiz pilot seviye ölçümü yapabiliriz (10 kişi, 1 hafta). Ne dersin?

**Touch 3 (Day 7) — Breakup**
> Konu: Doğru kişi sen değilsen
> 
> {{FIRST_NAME}}, geri dönüşün olmadı — bu son mesajım.
> 
> {{COMPANY}}'de İngilizce eğitimi başka bir arkadaşının sorumluluğundaysa, ileteceği bir mail adresi var mı? Eğer şu an gündeminizde değilse anladım, listemden çıkarayım.

#### Diğer 3 segment (B2B KOBİ, B2C Pro, Partner) için benzer 3-touch sekanslar — `outreach_cadences` seed'inde tanımlı olacak.

### AI Hook Ekleme (Opsiyonel ama güçlü)

GPT-4o-mini ile her lead için **1 cümlelik kişiselleştirilmiş ilk satır** üret:
- Input: LinkedIn bio + son şirket güncellemesi
- Output: "Geçen ay LinkedIn'de paylaştığınız [X konusu] hakkındaki yazıyı okudum, özellikle [Y] noktasında..."
- Maliyet: ~$0.0001 / lead, çok ucuz

---

## 7. KATMAN 4: Scheduler + Deliverability Guard

### Daily cron job (`scripts/outreach-daily.ts`)

Her gün 03:00 TR saatinde:
1. **03:00** — Apify discovery job'ları tetikle (4 segment)
2. **04:30** — Apify sonuçlarını çek, `outreach_leads`'e yaz
3. **05:00** — Email verification çalıştır (Apify email-validator)
4. **05:30** — Fit score hesapla, ≥50 olanları `cadence_status = 'active'` yap, `next_send_at` ata
5. **09:00 - 17:00 (TR business hours)** — Her 15 dakikada bir batch send (max 20/batch)
6. **18:00** — Günlük rapor: kaç lead bulundu, kaç email gitti, open/click/reply

### Throttling kuralları (deliverability koruma)

| Kural | Limit |
|---|---|
| Günlük toplam send | İlk hafta: 30 → 2. hafta: 60 → 3. hafta: 100 → kararlı: 200 |
| Saatlik send | Max 25 |
| Aynı domain'e art arda | Max 3, sonra 5 dk bekle |
| Bounce oranı | %3'ü aşarsa **otomatik dur**, alert at |
| Spam complaint | %0.1'i aşarsa **acil durdur** |
| Resend webhook reply tespiti | Sekansı otomatik durdur, leadi `replied` yap |
| Unsubscribe linkine tıklama | `cadence_status = 'unsubscribed'`, kalıcı bloklı |

### Gönderim saatleri

- Salı-Perşembe en yüksek open rate
- Sabah 09:30-11:00 + öğleden sonra 14:00-16:00 (TR saati)
- Hafta sonu hiç gönderme
- Resmi tatil günleri hiç gönderme

---

## 8. KVKK & Yasal Uyumluluk

Türkiye'de B2B cold email **şartlı izinli**: KVKK md.5/2-f "meşru menfaat" istisnası altında, sektörel kurumsal adreslerine değer önerisi içeren mesaj genelde tolere edilir, ancak:

**ZORUNLU:**
- Her email'de net **"Listeden çık"** linki
- Header'da `List-Unsubscribe` ve `List-Unsubscribe-Post: List-Unsubscribe=One-Click`
- Gönderici tam tanım: "Sphere English, İstanbul, info@sphereenglish.com"
- Veri kaynağı şeffaflığı (talep edilirse): "Profesyonel ağdan derlenen kamuya açık bilgiler"
- Unsubscribe → kalıcı bloklı liste, 5 yıl sakla

**B2C için daha sıkı:**
- Bireysel kişisel email'e (gmail/hotmail) cold mail KVKK riski yüksek
- Önerimiz: B2C segmentinde **sadece şirket emaillerini** kullan (`@şirketadi.com`)
- Personal email'e gitmek istersen → önce reklam/içerik üzerinden opt-in al, sonra cadence başlat

---

## 9. Dosya & Klasör Yapısı (Mevcut Repo'ya Ekleme)

```
artifacts/api-server/src/
├── routes/
│   ├── outreach.ts                    # YENİ — admin paneli endpointleri
│   └── outreach-webhooks.ts           # YENİ — Resend reply/bounce hook'ları
├── services/
│   ├── apify-client.ts                # YENİ — Apify API wrapper
│   ├── outreach-discovery.ts          # YENİ — günlük scraping job
│   ├── outreach-enrichment.ts         # YENİ — verify + score
│   ├── outreach-cadence.ts            # YENİ — sekans motoru
│   └── outreach-ai-personalizer.ts    # YENİ — GPT hook generator
├── lib/
│   └── outreach-templates.ts          # YENİ — cadence template'leri (seed)
└── workers/
    └── outreach-worker.ts             # YENİ — cron orchestrator

lib/db/src/schema/
└── outreach.ts                        # YENİ — yeni tablolar

scripts/
└── outreach-daily.ts                  # YENİ — main entry, cron'dan çağrılan

artifacts/react/src/pages/admin/
└── OutreachDashboard.tsx              # YENİ — admin UI
```

---

## 10. Gerekli .env Anahtarları

```bash
# Apify
APIFY_API_TOKEN=apify_api_xxx
APIFY_DISCOVERY_ENABLED=true

# Discovery limits
OUTREACH_DAILY_DISCOVERY_BUDGET=400      # max lead/gün
OUTREACH_DAILY_SEND_LIMIT=30             # warmup, kademeli artır
OUTREACH_DAILY_RAMPUP=true

# AI personalization
OPENAI_API_KEY=sk-xxx                    # zaten varsa kullan
OUTREACH_AI_PERSONALIZE=true

# Email (zaten kurulu, ama outreach için yeni from kullan)
OUTREACH_FROM_EMAIL=hakan@sphere-edu.com # ÖNERİLEN, ayrı domain
OUTREACH_FROM_NAME=Hakan İmamoğlu
OUTREACH_REPLY_TO=hakan@sphereenglish.com

# Compliance
OUTREACH_UNSUBSCRIBE_BASE=https://app.sphereenglish.com/unsubscribe

# Cron
OUTREACH_CRON_DISCOVERY=0 3 * * 1-5      # Pzt-Cum 03:00
OUTREACH_CRON_SEND=*/15 9-17 * * 2-4     # Salı-Per 09-17
```

---

## 11. Uygulama Planı (3 Faz)

### Faz 1 — Minimum Viable Outreach (3-4 gün)
- [ ] DB migration (`outreach_leads`, `outreach_cadences`, `outreach_sends`, `outreach_runs`)
- [ ] Apify wrapper service (sadece LinkedIn people search)
- [ ] Email validator (Apify actor)
- [ ] Basit fit_score
- [ ] Tek segment için 3-touch cadence (B2B İK)
- [ ] Daily cron
- [ ] Admin UI (lead listesi + cadence status)
- [ ] **Sadece 1 segmentle 20 lead/gün ile başla — ölçek sonra**

### Faz 2 — Tüm segmentler + AI personalize (1 hafta)
- [ ] Diğer 3 segment için Apify actor'ları
- [ ] Google Maps scraper (eğitim partnerleri için)
- [ ] GPT-4o-mini ile ilk satır kişiselleştirme
- [ ] Reply detection (IMAP polling veya Resend forward webhook)
- [ ] Bounce/complaint guard

### Faz 3 — Optimizasyon (sürekli)
- [ ] A/B test motoru (konu satırı, açılış)
- [ ] Inbox rotation (3+ sending domain'i)
- [ ] LinkedIn DM otomasyonu (Phantombuster veya manuel kuyruk)
- [ ] CRM entegrasyonu (Hubspot/Pipedrive webhook)

---

## 12. Tahmini Maliyet

| Kalem | Aylık |
|---|---|
| Apify ($49 plan) | $49 |
| Domain (sphere-edu.com) | $1 (yıllık $12) |
| Resend (zaten var, scale: 50k mail = $20) | $20 |
| OpenAI personalize (10k lead × $0.0001) | $1 |
| **Toplam** | **~$71/ay** |

Beklenen çıktı (3. ay itibariyle, kararlı warmup sonrası):
- 6000 lead/ay discovery
- 4500 fit score ≥50
- 4500 × 3 touch = 13.500 email
- Open rate: %30-40 (iyi cold mail)
- Reply rate: %2-5
- **Aylık 90-225 reply, bunların 1/3'ü demo talebi → 30-75 demo/ay**

---

## 13. Şu Anda Verilmesi Gereken Kararlar

1. **Domain meselesi** — sphere-edu.com alalım mı, yoksa info@sphereenglish.com'da mı israr?
2. **Apify hesabı** — yeni mi açacaksın, var mı?
3. **Hangi segmentle başlayalım?** — Önerim: B2B İK (en yüksek konversiyon)
4. **AI personalize** — Açık başlayalım mı (+$1/ay) yoksa template-only mu?
5. **Reply detection** — IMAP ile Titan'ı polluyalım mı, yoksa basitçe replyTo başka adres olsun?

Bu kararlar netleştikten sonra Faz 1 kodlamasına geçebiliriz — tahmini 3-4 günlük iş.
