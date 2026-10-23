# Dosya depolama ve yedekleme (Hetzner)

İki parça var:

| Ne | Nerede | Neden |
|---|---|---|
| E-kitap dosyaları (kapak, galeri, önizleme, tam PDF) | **Hetzner Object Storage** (S3 uyumlu, private bucket) | Veritabanını şişirmesin; indirmeler sunucuyu yormasın |
| Gece veritabanı yedeği | **Hetzner Storage Box** (WebDAV) — AES-256 şifreli | Sunucu bozulsa / silinse bile veri kalsın |

Ayarlar yoksa uygulama eskisi gibi çalışır (dosyalar veritabanında, yedek yalnız sunucuda). Durum: **Admin → DB Yedekleri**.

---

## 1. Object Storage (e-kitap dosyaları)

1. Hetzner Console → projen → **Object Storage → Create Bucket**
   - Ad: benzersiz olmalı (ör. `sphere-files-7k2m`)
   - Konum: sunucuyla aynı (Falkenstein `fsn1`, Nürnberg `nbg1` ya da Helsinki `hel1`)
   - Görünürlük: **Private**
2. **Security → S3 credentials → Generate**. Secret key yalnız bir kez gösterilir — kaydet.
3. Easypanel → `sphere-app` → Ortam:
   ```
   S3_ENDPOINT=https://fsn1.your-objectstorage.com     # konum kodun neyse
   S3_BUCKET=sphere-files-7k2m
   S3_ACCESS_KEY=...
   S3_SECRET_KEY=...
   ```
4. Dağıt. **Admin → DB Yedekleri**'nde "E-kitap dosyaları" kutusunda *Bağlantı ✓* görünmeli.
5. **Dosyaları bucket'a taşı** düğmesine bas. Bitince "Veritabanında: 0" olmalı.
6. Kontrol: www'de e-kitap kapakları görünüyor mu, bir satın alma e-postasındaki indirme bağlantısı çalışıyor mu.
7. Veritabanında boşalan yeri geri al (sunucuda, SSH):
   ```bash
   PROD=$(docker ps --format '{{.Names}}' | grep '^sphere-english_sphere-db\.1')
   docker exec $PROD sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB" -c "VACUUM FULL ebook_assets;"'
   ```
   (Tablo birkaç saniye kilitlenir; gece yapmak daha iyi.)

Davranış: kapak/galeri/önizleme görselleri sunucu üzerinden akıtılır (URL'ler değişmez, tarayıcı 30 gün önbellekte tutar). Satın alınan tam PDF, **5 dakikalık süreli bağlantıyla doğrudan bucket'tan** iner; indirme sayısı/7 gün kuralı aynen geçerli.

---

## 2. Storage Box (veritabanı yedeği)

1. Hetzner Console → **Storage Boxes → BX11** (1 TB). Konum olarak sunucudan **farklı** bir yer seç (sunucu Almanya'daysa Helsinki) — bina/bölge arızasına karşı.
2. Storage Box ayarları: **WebDAV support: açık**, **External reachability: açık**, parola belirle.
   - Önerilen: **Sub-account** oluştur, yalnız `sphere-backups` klasörüne erişsin, WebDAV açık. Ana hesap parolası sunucuda durmasın.
3. Şifreleme anahtarı üret (sunucuda): `openssl rand -base64 32`
   **Bu anahtarı parola yöneticine kaydet. Anahtar olmadan yedekler açılamaz.**
4. Easypanel → `sphere-app` → Ortam:
   ```
   BACKUP_WEBDAV_URL=https://u123456-sub1.your-storagebox.de/sphere-backups
   BACKUP_WEBDAV_USER=u123456-sub1
   BACKUP_WEBDAV_PASS=...
   BACKUP_ENCRYPTION_KEY=...            # 3. adımdaki
   BACKUP_REMOTE_RETENTION_DAYS=30      # opsiyonel
   ```
5. Dağıt → **Admin → DB Yedekleri → Manuel Yedek**. Çıkan mesajda `Storage Box: ✓ sphere_....sql.gz.enc` görmelisin.

Her gece 03:00 (TR) otomatik çalışır. Yükleme başarısız olursa Sentry'ye `db-backup-offsite` hatası düşer (e-posta gelir).

---

## 3. Geri yükleme tatbikatı (ayda bir, staging'de)

Yedeğin gerçekten açıldığını görmeden "yedeğimiz var" demeyelim.

1. Storage Box'tan en yeni dosyayı indir — tarayıcıda `BACKUP_WEBDAV_URL` adresini aç, kullanıcı/parola gir, `sphere_YYYYMMDD_*.sql.gz.enc` dosyasını indir.
2. Şifreyi çöz (bilgisayarında, repo kökünde):
   ```powershell
   $env:BACKUP_ENCRYPTION_KEY = "..."
   node artifacts/api-server/scripts/decrypt-backup.mjs .\sphere_20261023_xxx.sql.gz.enc .\sphere.sql.gz
   ```
3. Dosyayı sunucuya kopyala ve **staging** veritabanına yükle (STAGING.md'deki "DB kopyalama" adımlarıyla aynı mantık):
   ```bash
   scp sphere.sql.gz root@46.224.223.19:/root/
   STG=$(docker ps --format '{{.Names}}' | grep '^sphere-english_sphere-db-staging\.1')
   docker service scale sphere-english_sphere-app-staging=0
   docker exec $STG sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"'
   gunzip -c /root/sphere.sql.gz | docker exec -i $STG sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB" -q'
   docker service scale sphere-english_sphere-app-staging=1
   ```
4. `https://staging.app.sphereenglish.com/api/healthz` → `ok`; bir test hesabıyla giriş yap.
5. İşin bitince staging'i tekrar 0'a ölçekle (RAM), `/root/sphere.sql.gz`'yi sil.

Gerçek bir felakette aynı adımlar **prod** veritabanına yapılır — önce mevcut durumun bir yedeğini almayı unutma.
