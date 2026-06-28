# Sentry + DB Backup Setup

## 1. Sentry — Real-time hata izleme

### Hesap aç (5 dakika)

1. https://sentry.io/signup/ → ücretsiz hesap (free tier: 5K hata/ay yeterli)
2. **Create Project** → **Node.js** (backend) ve **React** (frontend) — iki proje aç
3. Her birinin **DSN**'ini kopyala (örn. `https://abc123@o12345.ingest.sentry.io/567890`)

### Easypanel env'leri

**api-server** servisine:
```
SENTRY_DSN=<backend DSN>
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1
```

**sphere-english frontend** için (Vite build sırasında okunur):
```
VITE_SENTRY_DSN=<frontend DSN>
```

Restart sonrası loglarda göreceksin:
```
[sentry] Hata izleme aktif: o12345.ingest.sentry.io
```

Sonra Sphere'de bilinçli bir hata yarat (örn. login dene yanlış şifreyle, veya geçersiz API çağrısı yap) → Sentry dashboard'a düşmesi gerek.

### Hassas bilgi koruması

Otomatik temizlenen alanlar:
- `Authorization` header
- `Cookie` header
- `X-Internal-Signature` header
- Body'deki `password`, `token`, `secret`, `apiKey`, `iyzicoPaymentId`

PII (kullanıcı bilgisi) varsayılan olarak gönderilmez (`sendDefaultPii: false`).

## 2. DB Backup — Günlük otomatik yedek

### Nasıl çalışır

- Her gün **TR saatiyle 03:00** (UTC 00:00) otomatik `pg_dump` çalışır
- Yedek `/app/backups/sphere_YYYYMMDD_TIMESTAMP.sql.gz` olarak kaydedilir
- 7 günden eski yedekler otomatik silinir
- Build script'inde `pg_dump` CLI bulunur (nixpacks postgresql_16 paketi)

### Easypanel env'leri (opsiyonel)

Default değerler yeterli ama özelleştirebilirsin:

```
BACKUP_DIR=/app/backups
BACKUP_RETENTION_DAYS=7
BACKUP_HOUR_UTC=0
```

### Admin paneli

`/admin/backups` → **"DB Yedekleri"** sidebar linki:
- Tüm yedek dosyaları listele (boyut + tarih)
- **Manuel Yedek** butonu (test için)
- **Eskileri Sil** (7 günden eski)

### Yedek geri yükleme (felaket kurtarma)

Easypanel'in api-server container'ına SSH/terminal aç:

```bash
# Mevcut yedekleri listele
ls -lh /app/backups/

# Yedeği aç ve restore et
gunzip -c /app/backups/sphere_20260628_123456789.sql.gz | psql $DATABASE_URL
```

**⚠️ Dikkat:** Restore mevcut DB'yi **silmez**, üzerine yazar. Gerekirse önce drop+create database yap.

### Sınırlamalar

- **Container yeniden oluşturulursa** (Easypanel "Recreate") `/app/backups/` silinir → kritik yedekleri **dışarı kopyala**
- 30+ günlük yedek için bir sonraki adımda **S3/Wasabi** entegrasyonu eklenebilir
- Boyut: Sphere DB'si ~50 MB civarı tahmin, gzip sonrası ~10 MB

### S3/Wasabi'ye taşıma (önerilen sonraki adım)

Container yedeklerini dışarıya yedeklemek için:

```bash
# Tek seferlik
docker cp <container>:/app/backups/sphere_XXX.sql.gz .
```

Veya cron job ile S3 sync. Bunu ileride yaparız.

## 3. Test akışı

### Sentry test
1. Easypanel env'leri ekle → restart
2. Loglarda "Hata izleme aktif" gör
3. Sphere'de hata yarat: `app.sphereenglish.com/api/auth/login` yanlış şifre 10 kez
4. Sentry dashboard'unda hata oluşmasına bakma — bu auth fail normal, Sentry'ye düşmez
5. Backend kodda gerçek hata için: `/api/admin/backups/run` admin değilken çağır → 403 (Sentry skip eder)
6. Daha iyi test: bir TEST endpoint'i hazırla, manuel `throw new Error("sentry test")` at, çağrı yap

### Backup test
1. Easypanel restart sonrası cron başlar (loglarda "Cron aktif" gör)
2. Yedek almak için 24 saat bekleme zorunda değilsin → admin paneldeki **Manuel Yedek** butonuna bas
3. `/admin/backups` listede dosyayı gör (~5-30 saniye)
4. Easypanel terminal'inden doğrula:
   ```bash
   ls -lh /app/backups/
   ```
