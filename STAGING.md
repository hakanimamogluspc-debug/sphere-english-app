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

### 1. Git branch
```powershell
git checkout -b staging
git push -u origin staging
```

### 2. Postgres (staging)
Easypanel → + Service → **Postgres** → ad: `sphere-db-staging`. Connection string'i not al.

### 3. API (staging)
Easypanel → + Service → **App** → ad: `sphere-api-staging`
- Source: GitHub repo, **branch: `staging`**, Dockerfile: `Dockerfile.api`
- Domain: `staging-api.sphereenglish.com` (ya da `api-staging.…`)
- Environment: canlı `sphere-api`'nin env'ini kopyala, şunları değiştir:
  ```
  APP_ENV=staging
  DATABASE_URL=<staging postgres>
  STAGING_EMAIL_ALLOWLIST=hakanimamogluspc@gmail.com
  APP_URL=https://staging.app.sphereenglish.com
  PUBLIC_ASSET_BASE_URL=https://staging-api.sphereenglish.com/api-server   (varsa)
  IYZICO_BASE_URL=https://sandbox-api.iyzipay.com  + sandbox key/secret
  SENTRY_ENVIRONMENT=staging
  ```
  Instagram/WhatsApp token'larını **boş bırak** (webhook'lar zaten canlıya bağlı).

### 4. Frontend (staging)
Easypanel → + Service → **App** → ad: `sphere-app-staging`
- Source: aynı repo, **branch: `staging`**, Dockerfile: `Dockerfile.frontend`
- Build args: `VITE_API_URL=https://staging-api.sphereenglish.com/api`, `VITE_APP_ENV=staging`
- Domain: `staging.app.sphereenglish.com`

### 5. DNS
`staging.app` ve `staging-api` için A/CNAME kaydı → sunucu IP (canlıyla aynı).

### 6. DB'yi canlıdan doldur (ilk sefer + istendiğinde)
Canlı `sphere-api` container shell:
```bash
pg_dump "$DATABASE_URL" --no-owner --no-acl | gzip > /tmp/prod.sql.gz
```
Dosyayı staging container'a taşı (Easypanel file manager ya da `docker cp`), staging shell:
```bash
gunzip -c /tmp/prod.sql.gz | psql "$DATABASE_URL"
# İsteğe bağlı anonimleştirme — gerçek e-postalar staging'de kalmasın:
psql "$DATABASE_URL" -c "UPDATE users SET email = 'user' || id || '@staging.invalid' WHERE role <> 'admin';"
```
Not: `pg_dump` için container'da `postgresql-client` gerekir (Dockerfile.api'ye eklenecek — backup işiyle birlikte).

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
