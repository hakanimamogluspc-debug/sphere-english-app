# Staging Ortamı

Canlının kopyası: ayrı servisler, ayrı DB, ayrı domain. Kod `staging` branch'inden deploy olur.
Her değişiklik önce staging'e, test sonrası `main`'e merge edilir.

## Güvenlik katmanı (kodda, `APP_ENV=staging` ile devreye girer)

| Ne | Davranış |
|---|---|
| Cron'lar (yedek, terk edilen sepet, comeback, haftalık rapor, outbound, content ingest) | **Çalışmaz** |
| `sendEmail` | Sadece `STAGING_EMAIL_ALLOWLIST`'teki adreslere; diğerleri loglanır |
| Web push | Gönderilmez |
| HTTP yanıtları | `X-Robots-Tag: noindex`, `X-App-Env: staging` |
| Frontend | Sarı "STAGING" şeridi (`VITE_APP_ENV=staging` build arg) |
| `/api/healthz` | `{ env: "staging", gitSha }` |

Kaynak: `artifacts/api-server/src/lib/app-env.ts`

## Easypanel kurulumu (bir kez)

Canlı: tek servis (`sphere-english-app`), **Nixpacks**, build sırasında frontend derlenip
`public/` altına kopyalanıyor, API aynı container'dan hem `/api` hem statik dosyaları sunuyor.
Staging da aynı şekilde tek servis.

### 1. Git branch
```powershell
git checkout -b staging && git push -u origin staging && git checkout main
```

### 2. Postgres (staging)
Easypanel → projen → **+ Servis → Postgres** → ad: `sphere-db-staging` → oluştur.
Servisin "Bağlantı" bölümünden **internal connection string**'i kopyala.

### 3. App (staging)
**+ Servis → App** → ad: `sphere-app-staging`

- **Kaynak:** GitHub · Sahip `hakanimamogluspc-debug` · Depo `sphere-english-app` ·
  **Dalan: `staging`** · Yapı yolu `/`
- **Derleme:** Nixpacks (1.41.0) — canlıdakiyle aynı komutlar:
  - Yükleme: `npm install -g pnpm@9 --prefix=/usr/local && /usr/local/bin/pnpm install --no-frozen-lockfile`
  - Yapı: `/usr/local/bin/pnpm --filter @workspace/sphere-english build && mkdir -p public && cp -r artifacts/sphere-english/dist/public/. public/ && /usr/local/bin/pnpm --filter @workspace/api-server build`
  - Nix paketleri: `ffmpeg`
- **Ortam:** canlı servisin Ortam sekmesindeki her şeyi kopyala, şunları değiştir/ekle:
  ```
  APP_ENV=staging
  VITE_APP_ENV=staging
  DATABASE_URL=<sphere-db-staging internal connection string>
  STAGING_EMAIL_ALLOWLIST=hakanimamogluspc@gmail.com
  APP_URL=https://staging.app.sphereenglish.com
  PUBLIC_ASSET_BASE_URL=https://staging.app.sphereenglish.com/api-server
  SENTRY_ENVIRONMENT=staging
  IYZICO_BASE_URL=https://sandbox-api.iyzipay.com   (+ sandbox API key/secret)
  ```
  **Sil / boş bırak:** `IG_PAGE_ACCESS_TOKEN`, `WA_ACCESS_TOKEN` (webhook'lar canlıya bağlı),
  `ADMIN_NOTIFICATION_EMAILS` (kendi mailin kalabilir).
- **Alan Adları:** `staging.app.sphereenglish.com` → port 3000 (canlıyla aynı port), HTTPS açık.

### 4. DNS
`staging.app.sphereenglish.com` → A kaydı → sunucu IP'si (canlı `app` ile aynı).

### 5. İlk deploy → DB şeması
İlk açılışta API `runStartupMigrations()` ile tabloları oluşturur. Sonra canlı verisini
kopyalamak istersen (opsiyonel):
canlı container shell → `pg_dump "$DATABASE_URL" --no-owner --no-acl | gzip > /tmp/prod.sql.gz`
→ dosyayı staging container'a taşı → `gunzip -c /tmp/prod.sql.gz | psql "$DATABASE_URL"`
→ anonimleştir: `UPDATE users SET email = 'user' || id || '@staging.invalid' WHERE role <> 'admin';`
(`pg_dump` için container'da postgresql-client gerekir — backup işiyle birlikte eklenecek.)

## Günlük akış

```powershell
git checkout staging
git merge main            # canlıdaki son durumu al
# ... değişiklik yap ...
git push                  # → staging otomatik deploy
# staging.app.sphereenglish.com'da test et
git checkout main
git merge staging
git push                  # → canlı deploy
```

Acil düzeltme (hotfix) doğrudan `main`'e yapılabilir; sonra `staging`'e merge etmeyi unutma.

## Doğrulama
- `https://staging-api.sphereenglish.com/api/healthz` → `"env":"staging"`
- Sayfada sarı şerit görünüyor
- API loglarında başlangıçta: `Arka plan cron'ları KAPALI (staging …)`
