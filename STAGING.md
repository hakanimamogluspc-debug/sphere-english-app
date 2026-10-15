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
  - **Başlat:** `node --enable-source-maps artifacts/api-server/dist/index.mjs`
    (boş bırakılırsa `nixpacks.toml`'daki eski uzun `node -e ...` komutu kullanılır ve
    Easypanel bunu bozuk sarmalayıp container'ı sessizce exit 0 ile kapatır — log bile yazmaz.)
  - Nix paketleri: `ffmpeg`
  - Derleme ayarı değişince **mutlaka yeni commit push et**; Easypanel "Dağıt" eski imajı
    1 saniyede yeniden başlatır, rebuild almaz (`git commit --allow-empty` yeterli).
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
- **Alan Adları:** Sunucu alanına **sadece** `staging.app.sphereenglish.com` (başına `https://`
  yazma — Traefik 404 verir, sertifika alınmaz). Hedef port = env'deki `PORT` (canlı env kopyasında **80**).

### 4. DNS
`staging.app.sphereenglish.com` → A kaydı → sunucu IP'si (canlı `app` ile aynı).

### 5. İlk deploy → DB şeması
`runStartupMigrations()` yalnızca ek tabloları/kolonları oluşturur; **`users`, `quizzes`,
`subscriptions` gibi çekirdek tablolar Drizzle şemasından gelir ve boş DB'de oluşmaz.**
Bu yüzden ilk kurulumda canlı DB'yi kopyala (sunucuda SSH, Postgres container'larında
`pg_dump`/`psql` hazır):

```bash
PROD=$(docker ps --format '{{.Names}}' | grep '^sphere-english_sphere-db\.1')
STG=$(docker ps --format '{{.Names}}' | grep '^sphere-english_sphere-db-staging\.1')
docker exec $PROD sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" --no-owner --no-acl' \
  | docker exec -i $STG sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB" -q'
# anonimleştir (admin hariç)
docker exec $STG sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB" -c "UPDATE users SET email = '\''user'\'' || id || '\''@staging.invalid'\'' WHERE role <> '\''admin'\'';"'
```

### 6. Sorun giderme
- Servis ikonu sarı, log boş, `docker service ps` → `Complete`: start komutu bozuk (bkz. 3).
- Traefik 404 sayfası: alan adı Sunucu alanında `https://` var ya da port yanlış.
- İmajı elle test: `docker run --rm --env-file <env> --network easypanel easypanel/sphere-english/sphere-app-staging 'node --enable-source-maps artifacts/api-server/dist/index.mjs'`

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
