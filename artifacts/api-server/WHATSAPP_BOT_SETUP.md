# WhatsApp Bot — Meta Cloud API Setup Rehberi

Sphere'in mevcut WhatsApp numarasını Meta'nın resmi **WhatsApp Cloud API**'sine bağlama ve botun production'a alınması için adım adım rehber.

## Önkoşullar

- Meta Business Manager hesabı (Instagram bot ile aynı işe yarar)
- WhatsApp Business / Personal'da kayıtlı bir Sphere numarası
- Numara'nın bağlı olduğu telefonun elinde olması (OTP doğrulama için)
- Bu numara şu anda hangi WhatsApp uygulamasında kayıtlıysa o uygulamadan çıkartılacak (Cloud API'ye geçince eski uygulama çalışmaz)

---

## Adım 1 — Meta App'e WhatsApp Use Case ekle

Instagram bot ile aynı Meta App'i kullanıyoruz. WhatsApp use case'ini de ekle.

1. https://developers.facebook.com/apps adresine git, mevcut Sphere App'e tıkla
2. Sol menüde **+ Add Product** veya **Use Cases**'e gir
3. **WhatsApp** kartını seç → **Set up**
4. Test numara üretilir (bunu kullanmıyoruz, gerçek numaraya geçeceğiz)

---

## Adım 2 — WhatsApp Business Account (WABA) oluştur

1. App içinde **WhatsApp → API Setup** sayfasına gel
2. Üstte **From** ve **To** alanları var
3. **From** altındaki **Manage phone number list** → Yeni WABA oluştur
4. Business Manager'da bir WABA seç ya da yeni oluştur ("Sphere English WhatsApp")

---

## Adım 3 — Mevcut Sphere numarasını ekle (port etme)

Önemli: Bu numara WhatsApp Personal/Business uygulamasında kayıtlıysa, Cloud API'ye geçince uygulama artık çalışmaz. **Sadece sphere'in iş numarası için yap.**

1. **WhatsApp → API Setup → Phone Numbers → Add phone number**
2. **Display name** (Sphere English) gir → Meta onayına gider (5 dk – 24 saat)
3. Numara ve görüntülenen ad onaylanır
4. **Verify number** — Telefona SMS veya sesli arama ile 6 haneli kod gelir
5. Kodu gir → numara Cloud API'ye bağlanır
6. **Phone number ID** kopyala (örn. `123456789012345`) — bu **WA_PHONE_NUMBER_ID** env'in

---

## Adım 4 — Sistem kullanıcı + kalıcı access token

Test ekranındaki 24 saatlik token production için uygun değil. **System User token** lazım.

1. https://business.facebook.com → **Business Settings → Users → System Users**
2. **Add** → "Sphere WhatsApp Bot" (Role: **Admin**)
3. Bu sistem user'ı WABA'ya assign et (Add Assets → WhatsApp Accounts → Full Control)
4. **Generate Token** → App: senin Sphere App'in
5. İzinler: `whatsapp_business_messaging`, `whatsapp_business_management`
6. Expiration: **Never**
7. Üretilen token'ı **HEMEN** kopyala — bir daha gösterilmez
8. Bu token **WA_ACCESS_TOKEN** env'in

---

## Adım 5 — Webhook konfigürasyonu

1. **WhatsApp → Configuration → Webhook** bölümüne git
2. **Callback URL**: `https://app.sphereenglish.com/api/webhooks/whatsapp`
3. **Verify token**: Senin belirleyeceğin keyfi string — buna **WA_VERIFY_TOKEN** diyeceğiz (örn. `sphere-wa-verify-2026-r4nd0m`)
4. **Verify and save**'e bas — backend'in `GET /api/webhooks/whatsapp` endpoint'i bunu doğrular
5. Webhook fields kısmında **messages** field'ını **Subscribe** et

---

## Adım 6 — App Secret kontrol et

`META_APP_SECRET` zaten Instagram için tanımlı; WhatsApp webhook'u aynı secret'la doğrulanır.  
İstersen `WA_APP_SECRET` adıyla ayrı tanımla, iki secret'tan biri eşleşirse OK.

---

## Adım 7 — Easypanel env değişkenlerini ekle

api-server container'ına şu env'leri ekle:

```
WA_PHONE_NUMBER_ID=123456789012345
WA_BUSINESS_ACCOUNT_ID=xxxxxxxxxxxxxx
WA_ACCESS_TOKEN=EAAxxxxxxxxxxxxxxxxxxxxxxxxxxx
WA_VERIFY_TOKEN=sphere-wa-verify-2026-r4nd0m
WA_APP_SECRET=<META_APP_SECRET ile aynı veya ayrı>
WA_API_VERSION=v21.0
```

`OPENAI_API_KEY` zaten tanımlı (Instagram bot için kullanılıyor).

Restart api-server.

---

## Adım 8 — DB migrate (otomatik)

api-server başladığında startup migration'ları otomatik çalışır:
- `whatsapp_threads`
- `whatsapp_messages`
- `whatsapp_bot_settings` (varsayılan ayarlarla)

Logda şunu görmelisin:
```
[wa-webhook] Subscription verified
```

---

## Adım 9 — Test mesajı gönder

1. WhatsApp'tan, başka bir telefondan Sphere'in numarasına bir mesaj at: "Merhaba"
2. Easypanel log:
   ```
   [wa-webhook] Msg in: thread=1 from=905xxx type=text text="Merhaba"
   [wa-webhook] Mesaj gönderildi thread=1 to=905xxx
   ```
3. Telefona cevap olarak Ezgi'nin yazısı düşer
4. Admin panelde `/admin/whatsapp-bot` aç → konuşmayı gör

---

## 24 saat kuralı (önemli)

WhatsApp Cloud API'de, **kullanıcı sana bir mesaj attıktan sonra 24 saat boyunca** ona ücretsiz cevap atabilirsin. Sonra ya kullanıcı tekrar yazmalı, ya da onaylı bir **template message** kullanmalısın.

Şu an template şart değil — bot reaktif çalışıyor (kullanıcı yazınca cevap). İlerde "ödeme hatırlatma", "ders bilgilendirme" gibi outbound mesaj atmak istersek template ekleriz.

---

## Maliyet

- İlk **1000 servis konuşması/ay** ücretsiz (Türkiye dahil)
- Sonra konuşma başı ~$0.005 – $0.05 (kategori bazlı)
- Şu an kullanım: cevap atılan her benzersiz kullanıcı = 1 servis konuşması (24 saatlik pencere)
- 1000'in altında kalırsak: **sıfır maliyet**

---

## Sorun giderme

**"Subscription verify FAİL"**  
→ Meta panelde `Verify token` ile env `WA_VERIFY_TOKEN` aynı mı? Birebir eşleşmeli.

**"HMAC fail"**  
→ `WA_APP_SECRET` ya da `META_APP_SECRET` eksik veya yanlış. Meta App settings → Basic → App Secret kopyala.

**"OAuthException code=190"**  
→ Token expired veya invalid. System User'dan yeni token üret, env'i güncelle, restart.

**"Recipient phone number not in allowed list"** (sandbox aşamasında)  
→ App vahşi modda değil. Settings → Basic → App Mode'u **Live** yap.

**Numara onay bekliyor**  
→ Meta "Display name approval" 24 saate kadar sürebilir. Geçici olarak Meta'nın test numarasıyla geliştirebilirsin.

---

## Sonraki adımlar (opsiyonel)

- **Template mesajları**: Outbound bildirim için (`utility`, `marketing` kategorileri)
- **Çalışma saatleri**: Mesai dışı "yarın döneceğiz" mesajı
- **Medya desteği**: Görsel/PDF gönder-al
- **WhatsApp Business Profile**: Hakkımızda, web, e-posta, kategori
