# TÜRMOB Luca e-Entegratör — Web Servis Başvuru Formu Doldurma Rehberi

> PDF form'u yazdır veya online doldur, aşağıdaki metinleri ilgili alanlara yaz.

---

## 1. Kullanım gerekçesi

Aşağıdaki metni olduğu gibi kullanabilirsin (2 satırlık alan yeterli):

```
Sphere English SaaS platformu üzerinden bireysel ve kurumsal müşterilerimize
sattığımız dijital ürünler (e-kitap yayınları ve online İngilizce eğitimi Pro
abonelikleri) için, başarılı ödeme sonrasında otomatik olarak e-Arşiv ve
e-Fatura oluşturulması amacıyla TÜRMOB Luca Web Servis (API) entegrasyonunu
talep ediyoruz.
```

Alternatif kısa versiyon:

```
Sphere English SaaS platformu üzerinden yapılan dijital ürün satışları
(e-kitap ve Pro abonelik) için ödeme sonrasında otomatik e-Arşiv/e-Fatura
kesim işlemi.
```

---

## 2. Çalışma Yapılacak IP Kod Bloğu

**Bu Sphere sunucusunun public IP'si.** Öğrenme yolları:

### Yol A — Easypanel Dashboard (en hızlı)
1. Easypanel'e giriş yap
2. Sol menüden **Server** veya **Cluster** sekmesi
3. Public IP orada yazar
4. Format: `XX.XX.XX.XX`

### Yol B — Server console'dan sorgu
1. Easypanel → **api-server** servisi → **Console/Terminal** sekmesi
2. Şu komutu yaz:
   ```bash
   curl ifconfig.me
   ```
3. Cevap satır olarak public IP'i verir

### Yol C — Hosting sağlayıcı paneli
- Hetzner / DigitalOcean / AWS / vs. — VPS'in dashboard'unda IP yazar

### Form'a yazma formatı

Tek IP için:
```
XX.XX.XX.XX/32
```

Birden fazla IP varsa (staging + production ayrıysa):
```
XX.XX.XX.XX/32, YY.YY.YY.YY/32
```

Veya CIDR bloğu (tüm hosting sağlayıcının IP bloğu):
```
XX.XX.XX.0/24
```

> **Not:** `/32` tek bir IP demektir. TÜRMOB muhtemelen bu IP'den gelen istekleri whitelist yapacak — sadece bu IP'den API çağrılabilir. Server IP'si değişirse yeniden başvuru gerekir.

---

## 3. Şirket VKN / TCKN

- **Şirket VKN:** 10 haneli vergi kimlik numarası
- **Şahıs firmasısan:** 11 haneli TCKN

Emin değilsen muhasibinden veya vergi levhandan öğren.

Örnek yazım:
```
1234567890
```

---

## 4. İletişim & Mail

Öneri format:
```
Ad Soyad: Hakan İmamoğlu
Şirket: [Şirket Ünvanı]
Görev: Kurucu / Genel Müdür

Telefon: +90 5XX XXX XX XX
E-posta: hakanimamogluspc@gmail.com

Teknik entegrasyon iletişim: hakanimamogluspc@gmail.com
Muhasebe iletişim: [muhasibinin e-postası]
```

---

## 5. Kaşe – İmza + Tarih

- **Şirket kaşesi:** Şirket ünvanı ve VKN'sinin basılı olduğu resmi damga → PDF üzerine bas
- **Yetkili imza:** Şirket adına imza yetkilisi (genelde sen) → ıslak imza
- **Tarih:** Bugünün tarihi, GG/AA/YYYY formatında

Eğer online doldur + dijital imza atılacaksa e-İmza veya KEP üzerinden gönderilebilir. Onlar TÜRMOB tarafında da geçerlidir.

---

## Gönderim adresi

Formu doldurduktan sonra:

**Yol 1 — Online:** [TÜRMOB Luca destek portal](https://lucayazilim.freshdesk.com) üzerinden ticket aç, form'u ek olarak yükle.

**Yol 2 — E-posta:** `destek@luca.com.tr` adresine attach ederek gönder. Konu satırı:
```
Web Servis Hizmet Başvurusu — Sphere English — [ŞİRKET VKN]
```

**Yol 3 — KEP:** Şirket KEP adresin varsa TÜRMOB KEP adresine ıslak imzalı formu KEP üzerinden yolla (en resmi ve hızlı).

---

## Sonrasında ne olacak?

1. TÜRMOB Luca ekibi başvurunu inceler (2-5 iş günü)
2. Onay + web servis erişim bilgileri (endpoint, kullanıcı adı, parola) e-posta ile gönderilir
3. Bu bilgileri Easypanel api-server env'ine ekle:
   ```
   TURMOB_LUCA_WS_URL=https://...
   TURMOB_LUCA_WS_USERNAME=...
   TURMOB_LUCA_WS_PASSWORD=...
   ```
4. Sphere kodunda `lib/efatura/luca-provider.ts` adapter'ını ben yazayım
5. Test ortamında en az 3 senaryo dene (bireysel TC, kurumsal VKN, KDV'siz)
6. Canlıya al

---

## Hızlı kontrol listesi

- [ ] Kullanım gerekçesi metni forma yazıldı
- [ ] Public IP öğrenildi (Easypanel dashboard veya `curl ifconfig.me`)
- [ ] IP `/32` formatında yazıldı
- [ ] Şirket VKN doğru yazıldı
- [ ] Ad-soyad, telefon, e-posta yazıldı
- [ ] Şirket kaşesi basıldı
- [ ] Yetkili imza atıldı
- [ ] Bugünün tarihi yazıldı
- [ ] Form muhasebeciye onaylatıldı (isteğe bağlı ama önerilir)
- [ ] destek@luca.com.tr veya freshdesk ticket üzerinden gönderildi
