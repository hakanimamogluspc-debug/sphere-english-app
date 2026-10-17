# Otomatik testler (api-server)

Entegrasyon testleri: Express uygulaması **gerçek bir Postgres**'e karşı, HTTP üzerinden
(supertest) çağrılır. Mock yok; şema her koşuda sıfırdan kurulur, canlıyla birebir aynı yoldan
(Drizzle şeması + `runStartupMigrations`).

## Kapsam (ilk set)

| Dosya | Ne doğrular |
|---|---|
| `health.test.ts` | `/api/healthz`, 404 JSON, helmet başlıkları, staging `noindex` |
| `auth.test.ts` | KVKK onayı zorunlu, parola kuralı, kayıt (201 + cookie + öğrenci no), e-posta tekilliği, kurum kodu, login 401/200, cookie oturumu, bozuk/yetim token, rol kontrolü |
| `rate-limit.test.ts` | login 10 başarısız → 429 (başarılılar sayılmaz), forgot-password 3 → 429 |
| `internal-payment.test.ts` | www→api HMAC imzası (yok/yanlış/gövde değişmiş → 401), bilinmeyen plan, yeni kullanıcı + abonelik + ödeme kaydı, tekrar ödeme upsert (tek satır), pre-create fatura verisi, cron token |
| `entitlement.test.ts` | otomatik deneme süresi, süresi geçmiş deneme, aktif abonelik, lazy expiry (past_due / expired), iptal-ama-dönem-sürüyor |

## Yerelde çalıştırma (Docker yoksa — sunucudaki test DB + SSH tüneli)

Kullandığımız yol: test Postgres'i Hetzner sunucusunda, sadece 127.0.0.1'e bağlı; bilgisayardan
SSH tüneliyle erişilir (dışarıya port açılmaz).

```bash
# sunucuda, bir kez oluşturuldu:
docker run -d --name sphere-test-db --restart unless-stopped -p 127.0.0.1:5433:5432 \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=sphere_test postgres:16
docker start sphere-test-db      # test koşacağın gün
docker stop  sphere-test-db      # işin bitince (RAM)
```

```powershell
# bilgisayarda — ayrı pencere, açık kalsın:
ssh -N -L 5433:127.0.0.1:5433 root@46.224.223.19
# test penceresi:
$env:TEST_DATABASE_URL = "postgresql://postgres:postgres@localhost:5433/sphere_test"
pnpm run test
```

Bitince tünel penceresini kapat (Ctrl+C) ve sunucuda `docker stop sphere-test-db`.

## Yerelde çalıştırma (Docker varsa)

1. Test veritabanı (bir kez):
   ```powershell
   docker run -d --name sphere-test-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=sphere_test -p 5432:5432 postgres:16
   ```
   Farklı port/kullanıcı için `TEST_DATABASE_URL` ver. **Veritabanı adı "test" içermek zorunda** —
   testler `DROP SCHEMA public` yapar, bu kontrol canlı/staging'e karşı koşmayı engeller.

2. Koş:
   ```powershell
   pnpm run test            # kökten
   pnpm --filter @workspace/api-server run test:watch   # izleme modu
   ```
   İlk koşu şema kurulumu yüzünden ~20–40 sn; sonrakiler daha hızlı.

3. Hepsi birlikte: `pnpm run verify` (typecheck + lint + test).

## CI

`.github/workflows/ci.yml` → `test` job'u: Postgres 16 servisi ayağa kalkar, `pnpm run test` koşar,
JUnit raporu artifact olarak yüklenir. `main` ve `staging` push'larında + PR'larda çalışır.
`check` job'u (typecheck + lint) ayrı koşar; biri kırmızıysa CI kırmızı.

## Ortam

Testler kendi env'ini kurar (`src/test/test-env.ts`): `APP_ENV=staging` + boş allowlist → hiç mail
gitmez, cron'lar kapalı; JWT/HMAC sırları sabit test değerleri; OpenAI/Resend/Iyzico anahtarları
silinir. `.env` dosyana dokunmaz.

## Yeni test yazarken

- `src/test/helpers.ts`: `api()`, `registerUser()`, `tokenFor()`, `createAdmin()`, `internalSignature()`, `resetDb()`.
- Her dosya başında `beforeAll(resetDb)`, sonunda `afterAll(closeDb)`.
- Dosyalar sırayla koşar (tek DB); bir dosya içindeki testler sırayla.
- Dış servise giden kod yolu varsa anahtarsız dala düştüğünden emin ol (test env anahtarları siler).

## Sıradaki adaylar

Kurs kaydı / ders ilerlemesi, e-kitap satın alma akışı (`ebook-purchase`), kupon doğrulama,
şirket yöneticisi raporu yetkisi (`corporate`), webhook (Resend) imza doğrulaması.
