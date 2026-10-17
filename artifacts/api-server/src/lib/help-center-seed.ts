/**
 * Yardım Merkezi — başlangıç içeriği.
 *
 * Açılışta `seedHelpCenter()` çalışır: kategori/makale slug'ı yoksa ekler,
 * varsa DOKUNMAZ (admin panelinden yapılan düzenlemeler korunur). Yani buraya
 * yeni makale eklemek yeterli; mevcut makalenin metnini değiştirmek için admin
 * paneli kullanılır.
 *
 * Yazım ilkesi: kısa, somut, adım adım; sayı/süre verirken koddaki gerçek
 * değerler (örn. seviye sınavı %70, e-kitap linki 7 gün / 10 indirme).
 */
import { pool } from "@workspace/db";

type Audience = "all" | "student" | "corporate";

interface SeedCategory {
  slug: string;
  title: string;
  description: string;
  icon: string;
  audience: Audience;
  sort: number;
}

interface SeedArticle {
  category: string;
  slug: string;
  title: string;
  summary: string;
  tags: string[];
  audience?: Audience;
  sort?: number;
  body: string;
}

export const HELP_CATEGORIES: SeedCategory[] = [
  { slug: "baslangic", title: "Başlangıç", description: "Hesap açma, seviye testi, ilk gün", icon: "Rocket", audience: "all", sort: 10 },
  { slug: "hesap", title: "Hesap ve Giriş", description: "Şifre, e-posta, bildirimler, hesap silme", icon: "UserCircle", audience: "all", sort: 20 },
  { slug: "dersler", title: "Canlı Dersler ve Speaking Club", description: "Takvim, katılım, eğitmenle iletişim", icon: "Video", audience: "all", sort: 30 },
  { slug: "ai-studio", title: "AI Koçlar ve Pratik", description: "Konuşma, yazma, kelime, simülatörler", icon: "Sparkles", audience: "all", sort: 40 },
  { slug: "ilerleme", title: "İlerleme ve Ödüller", description: "Seviye sınavları, raporlar, puanlar, seri", icon: "TrendingUp", audience: "all", sort: 50 },
  { slug: "e-kitaplar", title: "E-Kitaplar", description: "Satın alma, indirme, fatura", icon: "BookOpen", audience: "all", sort: 60 },
  { slug: "odeme", title: "Ödeme ve Fatura", description: "Abonelik, e-Arşiv / e-Fatura, iade", icon: "CreditCard", audience: "all", sort: 70 },
  { slug: "kurumsal", title: "Kurumsal Yöneticiler", description: "Çalışan ekleme, raporlar, kurum kodu", icon: "Building2", audience: "corporate", sort: 80 },
  { slug: "gizlilik", title: "Gizlilik ve Güvenlik", description: "KVKK, verileriniz, hesap kapatma", icon: "ShieldCheck", audience: "all", sort: 90 },
];

export const HELP_ARTICLES: SeedArticle[] = [
  // ── Başlangıç ────────────────────────────────────────────────────────────
  {
    category: "baslangic", slug: "hesap-nasil-acilir", title: "Hesap nasıl açılır?",
    summary: "Bireysel ya da kurum koduyla kayıt, sözleşme onayı ve ilk giriş.",
    tags: ["kayıt", "üyelik", "kurum kodu"], sort: 10,
    body: `1. **app.sphereenglish.com** adresine gidin ve **Kayıt Ol**'a tıklayın.
2. Hesap türünü seçin:
   - **Bireysel:** kendi adınıza kullanıyorsunuz.
   - **Kurumsal:** şirketinizin size verdiği **kurum kodunu** girin; hesabınız şirketinize bağlanır ve yöneticiniz ilerlemenizi görebilir.
3. Ad, soyad, e-posta ve en az 8 karakterlik bir parola belirleyin.
4. Kullanım Koşulları ve Gizlilik Politikası'nı onaylayın (zorunlu).

Kayıt tamamlanınca otomatik giriş yapılır ve size bir **öğrenci numarası** (SE-YYYY-XXXX) verilir.

> Kurum kodunuz yoksa ya da "Geçersiz kurum kodu" uyarısı alıyorsanız İK/eğitim sorumlunuza danışın; kodlar şirkete özeldir.`,
  },
  {
    category: "baslangic", slug: "seviye-testi-nasil-calisir", title: "Seviye tespit sınavı nasıl çalışır?",
    summary: "İlk girişte yapılan ücretsiz yerleştirme testi ve sonucun ne anlama geldiği.",
    tags: ["seviye", "placement", "CEFR", "A1", "B2"], sort: 20,
    body: `İlk girişte kısa bir **yerleştirme testi** yaparsınız. Sorular Oxford University Press kaynaklarından seçilir; sonuç CEFR ölçeğinde (A1 → C2) bir seviyedir.

**Neden önemli?** Dersler, kelime setleri, AI koçların zorluğu ve haftalık planınız bu seviyeye göre ayarlanır.

**Sonra değiştirebilir miyim?** Evet. Sol menüden **Seviye Sınavları**'na girip bir üst seviye için sınava girebilirsiniz; **%70 ve üzeri** aldığınızda seviyeniz yükselir.

**Testi atladım.** Kontrol panelinde "Seviyeni belirle" kartı görünür; istediğiniz zaman tamamlayabilirsiniz. Test tamamlanmadan bazı modüller genel seviyede içerik gösterir.`,
  },
  {
    category: "baslangic", slug: "ilk-hafta-ne-yapmaliyim", title: "İlk hafta ne yapmalıyım?",
    summary: "Haftada 2–3 saatle sonuç almak için önerdiğimiz başlangıç düzeni.",
    tags: ["plan", "başlangıç", "rutin"], sort: 30,
    body: `Önerdiğimiz düzen, referans şirketlerimizde işe yarayan akış:

- **Gün 1:** Seviye testini bitirin, **Yolculuğum** sayfasından ilk hedefi seçin.
- **Her gün 10–15 dk:** Mobilde **Pratik** sekmesi (kelime tekrarı + kısa konuşma). Günlük seriniz (streak) bu sayede kopmaz.
- **Haftada 2 kez:** Canlı ders ya da Speaking Club (takviminizde görünür).
- **Haftada 1 kez:** Bir simülatör — mülakat, sunum ya da iş senaryosu — gerçek bir işinizi prova edin.

Pazartesi sabahları gelen **haftalık rapor e-postası** nerede olduğunuzu özetler.`,
  },
  {
    category: "baslangic", slug: "mobil-uygulama-ana-ekrana-ekle", title: "Uygulamayı telefona nasıl eklerim?",
    summary: "Mağaza indirmeden ana ekrana ekleme (iPhone ve Android).",
    tags: ["mobil", "PWA", "iPhone", "Android", "ana ekran"], sort: 40,
    body: `Sphere English tarayıcıdan **uygulama gibi** çalışır; mağazadan indirmeye gerek yok.

**Android (Chrome):** app.sphereenglish.com'u açın → üstteki ⋮ menü → **Ana ekrana ekle** (ya da ekranda çıkan "Ekle" davetine dokunun).

**iPhone (Safari):** app.sphereenglish.com'u açın → alttaki **Paylaş** simgesi → **Ana Ekrana Ekle**.

Eklendikten sonra tam ekran açılır, daha hızlı yüklenir ve bildirim izni verirseniz hatırlatmalar gelir. İnternet kesilirse son açılan sayfa görünür, giriş yapılan işlemler bağlantı gelince tamamlanır.`,
  },

  // ── Hesap ────────────────────────────────────────────────────────────────
  {
    category: "hesap", slug: "sifremi-unuttum", title: "Şifremi unuttum, ne yapmalıyım?",
    summary: "Giriş ekranından sıfırlama bağlantısı isteme.",
    tags: ["şifre", "parola", "sıfırlama", "giriş"], sort: 10,
    body: `1. Giriş ekranında **Şifremi unuttum**'a tıklayın.
2. Kayıtlı e-posta adresinizi yazın.
3. Gelen e-postadaki bağlantıya tıklayıp yeni parolanızı belirleyin.

E-posta gelmediyse **spam/gereksiz** klasörüne bakın ve adresi doğru yazdığınızdan emin olun. Güvenlik nedeniyle 15 dakikada en fazla 3 talep gönderebilirsiniz.

Kurumsal hesapta e-postanız şirket adresinizse ve o adrese erişiminiz kalmadıysa yöneticinizden hesabınızı yeni adresle güncellemesini isteyin.`,
  },
  {
    category: "hesap", slug: "satin-aldim-hesabim-nasil-acilir", title: "Satın aldım, uygulamaya nasıl giriş yaparım?",
    summary: "www'den ödeme sonrası gelen kurulum bağlantısı ve parola belirleme.",
    tags: ["satın alma", "kurulum", "magic link", "parola"], sort: 20,
    body: `www.sphereenglish.com üzerinden ödeme yaptıysanız hesabınız otomatik açılır ve ödeme sırasında verdiğiniz e-postaya bir **hesap kurulum bağlantısı** gelir.

- Bağlantı **24 saat** geçerlidir; tıklayıp parolanızı belirleyin, ardından app.sphereenglish.com'a giriş yapın.
- Süresi geçtiyse giriş ekranında **Şifremi unuttum** diyerek yeni bağlantı alabilirsiniz (aynı e-postayla).
- Daha önce hesabınız varsa yeni hesap açılmaz; mevcut hesabınıza abonelik tanımlanır, eski parolanızla girersiniz.

E-posta 10 dakika içinde gelmediyse spam klasörüne bakın; yoksa ödeme e-postanızla birlikte bize yazın.`,
  },
  {
    category: "hesap", slug: "bildirim-tercihleri", title: "Bildirimleri nasıl yönetirim?",
    summary: "E-posta ve tarayıcı/mobil bildirimlerini açma-kapama.",
    tags: ["bildirim", "e-posta", "push", "hatırlatma"], sort: 30,
    body: `**Ayarlar → Bildirim Tercihleri** altından her bildirim türünü ayrı ayrı açıp kapatabilirsiniz: günlük hatırlatma, seri (streak) uyarısı, haftalık rapor, ders hatırlatması, duyurular.

**Anlık (push) bildirimler** için tarayıcı ya da telefon izni gerekir; uygulama ilk sorduğunda "İzin ver" demediyseniz tarayıcı adres çubuğundaki kilit simgesinden bildirimleri açabilirsiniz.

Her e-postanın altında **abonelikten çık** bağlantısı vardır; sadece o türü kapatır, hesabınızı etkilemez.`,
  },
  {
    category: "hesap", slug: "eposta-veya-ad-degistirme", title: "E-posta adresimi veya adımı nasıl değiştiririm?",
    summary: "Profil bilgilerini güncelleme ve değiştirilemeyen alanlar.",
    tags: ["profil", "e-posta", "ad soyad"], sort: 40,
    body: `**Profil** sayfasından ad, soyad, telefon ve kısa tanıtım metninizi güncelleyebilirsiniz.

**E-posta adresi** giriş kimliğinizdir ve fatura kayıtlarına bağlıdır; bu yüzden kendiniz değiştiremezsiniz. Değişiklik için uygulamadaki **Bize bildir** butonundan ya da info@sphereenglish.com adresinden yeni adresinizi iletin; kimlik doğrulaması sonrası güncelleriz.

Kurumsal kullanıcılarda ad/soyad değişikliği yöneticinizin raporlarına da yansır.`,
  },

  // ── Dersler ──────────────────────────────────────────────────────────────
  {
    category: "dersler", slug: "canli-derse-nasil-katilirim", title: "Canlı derse nasıl katılırım?",
    summary: "Ders takvimi, katılım bağlantısı ve geç kalma durumu.",
    tags: ["canlı ders", "takvim", "katılım", "zoom"], sort: 10,
    body: `Canlı dersler **web uygulamasında** (app.sphereenglish.com, masaüstü ya da tablet tarayıcısı) yapılır; mobil uygulamada takvimi görür, katılım için tarayıcıdan web'e geçersiniz.

1. Sol menüden **Ders Takvimim**'e girin.
2. Yaklaşan dersin yanındaki **Katıl** butonu ders saatinden kısa süre önce aktif olur.
3. Kamera ve mikrofon izni verin.

Ders öncesi hatırlatma e-postası ve (açıksa) bildirim gelir. Kaçırdığınız dersler takvimde "katılmadı" olarak görünür; telafi için eğitmeninize **Mesajlar**'dan yazabilirsiniz.`,
  },
  {
    category: "dersler", slug: "speaking-club-nedir", title: "Speaking Club nedir, nasıl katılırım?",
    summary: "Haftalık grup konuşma pratiği: format, seviye ve kayıt.",
    tags: ["speaking club", "konuşma", "grup"], sort: 20,
    body: `Speaking Club, eğitmen yönetiminde **küçük grup serbest konuşma** oturumudur. Amaç hata yapmaktan korkmadan konuşmak; dilbilgisi dersi değildir.

- **Speaking Club** sayfasında açık oturumları ve seviyelerini görürsünüz; size uygun olana **Kayıt ol** deyin.
- Oturum web'de yapılır; katılım bağlantısı saatinden önce açılır.
- Konular iş hayatından seçilir: tanışma, toplantı açılışı, müşteri görüşmesi, sunum sonrası soru-cevap.

Konuşma dakikalarınız raporunuza işlenir; yöneticiniz (kurumsal hesapta) toplam pratik süresini görür.`,
  },
  {
    category: "dersler", slug: "egitmenle-iletisim", title: "Eğitmenimle nasıl iletişim kurarım?",
    summary: "Mesajlar modülü, ödev/materyal paylaşımı.",
    tags: ["eğitmen", "mesaj", "materyal"], sort: 30,
    body: `**Mesajlar** sayfasından eğitmeninize doğrudan yazabilirsiniz; ders dışı sorular, telafi talepleri ve geri bildirim için burayı kullanın.

Eğitmenin paylaştığı dosyalar **Materyallerim** altında toplanır (ders notları, ses kayıtları, ödevler). Yeni materyal geldiğinde bildirim alırsınız.

Acil durumlar (derse bağlanamama vb.) için uygulamadaki **Bize bildir** butonu destek ekibine ulaşır.`,
  },

  // ── AI Studio ────────────────────────────────────────────────────────────
  {
    category: "ai-studio", slug: "ai-koclar-nedir", title: "AI koçlar nedir, hangisini seçmeliyim?",
    summary: "Sektöre göre koçlar ve nasıl çalıştıkları.",
    tags: ["AI", "koç", "Hans", "Mr. Sterling", "Chloe"], sort: 10,
    body: `AI koçlar, kendi sektörünüzün diliyle konuşan yapay zekâ karakterleridir. **Konuşma Sahneleri** ve **İş Senaryoları** modüllerinde karşınıza çıkarlar.

Örnekler: **Mr. Sterling** (üst yönetim, İngiliz aksanı), **Hans** (lojistik ve operasyon, Avrupa iş iletişimi), **Chloe** (müşteri ilişkileri), **David** (finans), **Emma** (İK), **Raj** (yazılım/BT).

**Seçim:** İşinizde en çok kiminle konuşuyorsanız ona en yakın koçla başlayın; örneğin yabancı tedarikçilerle görüşüyorsanız Hans, müşteri şikâyeti yönetiyorsanız Chloe.

Koçlar sizi düzeltir ama not vermez; puanlama **Konuşma Koçu** (telaffuz) ve simülatörlerde yapılır.`,
  },
  {
    category: "ai-studio", slug: "konusma-kocu-telaffuz", title: "Konuşma Koçu ile telaffuz nasıl çalışılır?",
    summary: "Mikrofon izni, kayıt, ses analizi ve puanlar.",
    tags: ["telaffuz", "konuşma", "mikrofon", "ses"], sort: 20,
    body: `1. **Konuşma Koçu**'nu açın, tarayıcı mikrofon izni isteyince **İzin ver** deyin.
2. Ekrandaki cümleyi ya da serbest konuyu okuyun/anlatın; kayıt bitince **Gönder**.
3. Birkaç saniye içinde kelime kelime telaffuz puanı, akıcılık ve vurgu geri bildirimi gelir; kırmızı işaretli kelimelere dokununca doğru söyleyiş dinlenir.

**İpuçları:** Sessiz ortam, telefonu ağza 15–20 cm, cümleyi normal hızda. Her gün 3–5 cümle, haftada bir uzun serbest konuşma iyi bir ritimdir.

Mikrofon çalışmıyorsa: başka sekmede açık görüşme var mı, tarayıcı izinleri "engellendi" mi kontrol edin; iPhone'da Safari kullanın.`,
  },
  {
    category: "ai-studio", slug: "mulakat-ve-sunum-simulatoru", title: "Mülakat ve Sunum Simülatörü nasıl kullanılır?",
    summary: "Gerçek bir görüşmeyi prova etme, rapor ve tekrar.",
    tags: ["mülakat", "sunum", "simülatör", "prova"], sort: 30,
    body: `**Mülakat Simülatörü:** Pozisyonu ve mülakat türünü seçin (davranışsal, teknik, vaka). Koç soruları sırayla sorar, sesli ya da yazılı cevap verirsiniz; sonunda güçlü/zayıf yönler ve örnek cevaplarla rapor çıkar.

**Sunum Simülatörü:** Sunumunuzun konusunu ve hedef kitlesini girin; açılış, gövde ve kapanışınızı bölüm bölüm prova edersiniz. Koç soru-cevap kısmında zor sorular sorar.

Raporlar **Raporum** sayfasında saklanır; aynı senaryoyu tekrar edip puan değişimini görebilirsiniz. Gerçek bir toplantıdan 1–2 gün önce bir prova yapmak en çok işe yarayan kullanım.`,
  },
  {
    category: "ai-studio", slug: "kelime-oyunu-ve-tekrar", title: "Kelime Oyunu ve Kelime Tekrarı arasındaki fark ne?",
    summary: "Yeni kelime öğrenme ile unutmadan tekrar etme.",
    tags: ["kelime", "vocab", "tekrar", "oyun"], sort: 40,
    body: `**Kelime Oyunu:** Seviyenize göre yeni iş İngilizcesi kelimeleri oyunlaştırılmış turlarla öğretir; her tur puan ve seri kazandırır.

**Kelime Tekrarı (Kelime Hub):** Daha önce karşılaştığınız ve zorlandığınız kelimeleri **aralıklı tekrar** mantığıyla önünüze getirir. Unutmak üzere olduğunuz kelimeler önce gelir.

Öneri: Yeni kelime için günde bir oyun turu, tekrar için 5 dakika. Dersten ya da metinden kaydettiğiniz kelimeler (metin içinde kelimeye dokunup **Kaydet**) de tekrar listesine düşer.`,
  },
  {
    category: "ai-studio", slug: "yazma-ve-dilbilgisi-kocu", title: "Yazma Koçu ve Dilbilgisi Koçu ne işe yarar?",
    summary: "E-posta/rapor düzeltme ve kural bazlı çalışma.",
    tags: ["yazma", "e-posta", "dilbilgisi", "grammar"], sort: 50,
    body: `**Yazma Koçu:** Yazdığınız e-posta, teklif ya da raporu yapıştırın; dilbilgisi, ton ve netlik açısından düzeltilmiş hali ve her değişikliğin nedeni gelir. Gerçek bir iş e-postasını göndermeden önce buradan geçirmek en pratik kullanım.

**Dilbilgisi Koçu:** Konu konu (zamanlar, koşul cümleleri, edatlar…) kısa anlatım + alıştırma. Yazma Koçu'nun sık işaretlediği hatalar burada "çalışmanız önerilir" olarak görünür.

İkisi de seviyenize göre açıklama yapar; A2 kullanıcıya C1 terminolojisiyle anlatmaz.`,
  },

  // ── İlerleme ─────────────────────────────────────────────────────────────
  {
    category: "ilerleme", slug: "seviye-sinavi-ve-seviye-atlama", title: "Seviye nasıl yükselir?",
    summary: "Seviye sınavları, %70 barajı ve tekrar hakkı.",
    tags: ["seviye", "sınav", "B1", "B2", "C1"], sort: 10,
    body: `Seviyeniz otomatik yükselmez; **Seviye Sınavları** sayfasından bir üst seviyenin sınavına girersiniz.

- Sınav süreli ve çoktan seçmelidir; **%70 ve üzeri** = geçti.
- Geçince seviyeniz güncellenir, içerik ve AI koçlar yeni seviyeye göre ayarlanır.
- Geçemezseniz sonuç ekranında zayıf konular listelenir; bir süre çalışıp tekrar girebilirsiniz.

Kurumsal hesaplarda yöneticiniz dönem başı/sonu seviye değişimini raporda görür; bu yüzden sınavı ciddiye alın, yardım almadan çözün.`,
  },
  {
    category: "ilerleme", slug: "haftalik-rapor-ve-raporum", title: "Haftalık rapor e-postası ve Raporum sayfası",
    summary: "Her Pazartesi gelen özet ve detaylı kişisel rapor.",
    tags: ["rapor", "haftalık", "e-posta", "ilerleme"], sort: 20,
    body: `Her **Pazartesi sabahı** geçen haftanın özeti e-postayla gelir: kaç gün aktif oldunuz, kaç dakika konuştunuz, kaç kelime öğrendiniz, hangi hatalar tekrar etti.

Detay için **Raporum** sayfası: modül bazında süre, telaffuz puanı eğilimi, sık yapılan hatalar ve önerilen çalışma. **İlerleme Durumum** ise ders/kurs tamamlama yüzdelerini gösterir.

E-postayı istemiyorsanız Bildirim Tercihleri'nden kapatabilirsiniz; rapor sayfası çalışmaya devam eder.`,
  },
  {
    category: "ilerleme", slug: "puan-seri-odul", title: "Puanlar, seri (streak) ve ödüller nasıl çalışır?",
    summary: "Günlük seri, puan kazanma ve Ödüllerim sayfası.",
    tags: ["puan", "streak", "seri", "ödül", "sıralama"], sort: 30,
    body: `- **Puan:** Tamamlanan her aktivite (kelime turu, konuşma, quiz, ders katılımı) puan kazandırır. Puanlar **Sıralama** sayfasındaki haftalık tabloya yansır.
- **Seri (streak):** Üst üste aktif olduğunuz gün sayısı. Günde tek bir kısa aktivite seriyi korur; akşam seri risk altındaysa hatırlatma gelir.
- **Ödüllerim:** Biriken puanlarla açılan rozetler ve ödüller burada görünür.

Seri koptuysa sıfırdan başlar; puanlarınız silinmez.`,
  },
  {
    category: "ilerleme", slug: "arkadasini-davet-et", title: "Arkadaşımı nasıl davet ederim?",
    summary: "Davet bağlantısı ve kazanımlar.",
    tags: ["davet", "referral", "arkadaş"], sort: 40,
    body: `**Arkadaşını Davet Et** sayfasında size özel bir davet bağlantısı ve kod bulunur. Bağlantıyı paylaşın; arkadaşınız bu bağlantıyla kayıt olunca davet sayfanızda görünür.

Davet kazanımları dönemsel olarak değişebilir; güncel koşullar aynı sayfada yazar.`,
  },

  // ── E-Kitaplar ───────────────────────────────────────────────────────────
  {
    category: "e-kitaplar", slug: "e-kitap-satin-alma-ve-indirme", title: "E-kitabı nasıl satın alır ve indiririm?",
    summary: "Ödeme sonrası gelen indirme bağlantısı, süre ve indirme hakkı.",
    tags: ["e-kitap", "pdf", "indirme", "satın alma"], sort: 10,
    body: `1. www.sphereenglish.com/e-kitaplar'dan kitabı ya da seti sepete ekleyin, ödemeyi tamamlayın (kart, 3D Secure).
2. Ödeme onaylanınca e-postanıza **indirme bağlantısı** gelir.
3. Bağlantı **7 gün** geçerlidir ve en fazla **10 kez** indirilebilir; PDF'i cihazınıza kaydedin.

Bağlantının süresi dolduysa ya da e-posta gelmediyse ödeme e-postanız ve sipariş bilgisiyle bize yazın; yeniden gönderelim.`,
  },
  {
    category: "e-kitaplar", slug: "e-kitap-hangi-seviye", title: "Hangi e-kitap bana uygun?",
    summary: "Seviyeye ve role göre seçim.",
    tags: ["e-kitap", "seviye", "seçim"], sort: 20,
    body: `Her kitabın sayfasında **seviye** (CEFR) ve **kimin için** bilgisi vardır.

- Seviyenizi bilmiyorsanız önce uygulamada ücretsiz seviye testini yapın.
- İş rolünüze göre: satış/müzakere, e-posta yazımı, toplantı ve sunum, finans, İK gibi seriler var.
- **Set** almak tek tek almaktan uygundur ve seri boyunca aynı yapı kullanılır.

Kararsızsanız e-kitaplar sayfasındaki "Nereden başlamalıyım" rehberine bakın ya da "Haberdar ol" formuyla ilgi alanınızı bırakın; yeni kitap çıkınca haber veririz.`,
  },

  // ── Ödeme ────────────────────────────────────────────────────────────────
  {
    category: "odeme", slug: "fatura-nasil-alirim", title: "Faturamı nasıl alırım? (e-Arşiv / e-Fatura)",
    summary: "Ödeme sonrası fatura süreci, kurumsal fatura ve VKN.",
    tags: ["fatura", "e-arşiv", "e-fatura", "VKN"], sort: 10,
    body: `Her ödeme için yasal fatura düzenlenir ve e-postanıza gönderilir.

- **Bireysel:** e-Arşiv fatura, TCKN ile.
- **Kurumsal:** Ödeme adımında "Kurumsal fatura" seçip VKN, vergi dairesi ve unvan girin. Şirketiniz e-Fatura mükellefiyse fatura doğrudan **e-Fatura** olarak GİB üzerinden gelir (e-postada değil, şirketinizin e-Fatura gelen kutusunda görünür).

Fatura birkaç saat içinde kesilir; 24 saat içinde ulaşmadıysa ödeme tarihi ve e-postanızla bize yazın. Faturayı düzenleyen: İmmer Global Eğitim ve Danışmanlık Ltd. Şti.`,
  },
  {
    category: "odeme", slug: "iade-ve-iptal", title: "İade ve iptal koşulları nelerdir?",
    summary: "Mesafeli satış sözleşmesi, cayma hakkı ve dijital içerik istisnası.",
    tags: ["iade", "iptal", "cayma"], sort: 20,
    body: `Koşullar **Mesafeli Satış Sözleşmesi** ve **Teslimat & İade** sayfalarında yazar (www.sphereenglish.com altında). Özetle:

- **E-kitaplar** dijital içeriktir; indirme bağlantısı kullanıldıktan sonra cayma hakkı kapsamı dışındadır. Yanlış kitap/teknik sorun durumunda bize yazın, çözüm buluruz.
- **Abonelik/kurs:** Henüz kullanılmamış dönem için talepler sözleşmedeki süre içinde değerlendirilir.

İade talebi için ödeme e-postanız, sipariş/konuşma numaranız ve kısa açıklamayla info@sphereenglish.com'a yazın.`,
  },

  // ── Kurumsal ─────────────────────────────────────────────────────────────
  {
    category: "kurumsal", slug: "kurum-kodu-ve-calisan-ekleme", title: "Çalışanlarımı nasıl eklerim? (kurum kodu)",
    summary: "Kurum koduyla kayıt, kimlerin göründüğü.",
    tags: ["kurumsal", "kurum kodu", "çalışan", "İK"], audience: "corporate", sort: 10,
    body: `Şirketinize özel **kurum kodunuz** Sphere ekibi tarafından verilir. Çalışan, kayıt olurken **Kurumsal** seçip bu kodu girer; hesabı otomatik olarak şirketinize bağlanır ve kurumsal panelinizde görünür.

- Kodu şirket içi duyuruyla paylaşmanız yeterli; kişi başına ayrı davet gerekmez.
- Yanlışlıkla bireysel kaydolan çalışan için bize yazın; hesabı şirkete bağlarız.
- Ayrılan çalışanın hesabını pasife almak için çalışanın e-postasıyla bize yazın; aynı gün işlenir.`,
  },
  {
    category: "kurumsal", slug: "kurumsal-raporlar", title: "Kurumsal raporlarda neyi görürüm?",
    summary: "Yönetici paneli: aktiflik, dakika, seviye değişimi, AI rapor.",
    tags: ["kurumsal", "rapor", "yönetici", "ROI"], audience: "corporate", sort: 20,
    body: `**Kurumsal Panel**'de (yönetici girişi) şirketinize bağlı tüm çalışanlar için:

- **Aktiflik:** Son 7/30 günde kim giriş yaptı, kim bir süredir pasif.
- **Pratik süresi:** Konuşma dakikası, tamamlanan ders ve quiz sayısı.
- **Seviye:** Başlangıç ve güncel seviye dağılımı.
- **AI Rapor:** Dönem özetini ve önerileri yönetime sunulacak biçimde üretir.

Raporlar yalnızca yetkili şirket yöneticisine açıktır; çalışanlar birbirinin verisini görmez. Dönem sonu raporunu çıktı almak için tarayıcının yazdır (Ctrl+P → PDF olarak kaydet) özelliğini kullanabilirsiniz.`,
  },

  // ── Gizlilik ─────────────────────────────────────────────────────────────
  {
    category: "gizlilik", slug: "verilerim-ve-kvkk", title: "Verilerim nasıl işleniyor? (KVKK)",
    summary: "Hangi veriler, ne için, kim görür; haklarınız.",
    tags: ["KVKK", "gizlilik", "veri"], sort: 10,
    body: `Kişisel verileriniz 6698 sayılı KVKK kapsamında, **Gizlilik Politikası** ve **KVKK Aydınlatma Metni**'nde (www.sphereenglish.com/kvkk) açıklanan amaçlarla işlenir: eğitimin verilmesi, ilerleme raporu, faturalama ve yasal yükümlülükler.

- **Ses kayıtlarınız** yalnızca telaffuz/konuşma analizi için işlenir; analiz sonuçları (puanlar) raporunuzda saklanır.
- **Kurumsal hesapta** yöneticiniz yalnızca öğrenme verilerinizi (süre, seviye, katılım) görür; mesajlarınızı ve ses kayıtlarınızı görmez.
- Verilerinize erişme, düzeltme ve silme talebi için info@sphereenglish.com adresine yazabilirsiniz; yasal süre içinde yanıtlanır.`,
  },
  {
    category: "gizlilik", slug: "hesabimi-silmek-istiyorum", title: "Hesabımı nasıl silerim?",
    summary: "Hesap kapatma talebi ve sonrasında ne olur.",
    tags: ["hesap silme", "kapatma", "KVKK"], sort: 20,
    body: `Hesap silme talebini **www.sphereenglish.com/hesap-sil** sayfasından ya da uygulamadaki **Bize bildir** butonundan iletebilirsiniz.

- Talep alındıktan sonra hesabınız kapatılır; öğrenme verileriniz ve kişisel bilgileriniz silinir.
- **Fatura kayıtları** vergi mevzuatı gereği yasal süre boyunca saklanır (kişisel kullanım dışı, yalnızca muhasebe amaçlı).
- Kurumsal hesapta şirketiniz lisansı başka bir çalışana devredebilir.

Silme geri alınamaz; e-kitap indirme bağlantıları ve raporlar da erişilemez olur. Yalnızca ara vermek istiyorsanız bildirimleri kapatmanız yeterli, hesabınız durur.`,
  },
];

export async function seedHelpCenter(): Promise<void> {
  try {
    const catIds = new Map<string, number>();
    for (const c of HELP_CATEGORIES) {
      const r = await pool.query(
        `INSERT INTO help_categories (slug, title, description, icon, audience, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (slug) DO UPDATE SET slug = EXCLUDED.slug
         RETURNING id`,
        [c.slug, c.title, c.description, c.icon, c.audience, c.sort],
      );
      catIds.set(c.slug, r.rows[0].id);
    }
    let inserted = 0;
    for (const a of HELP_ARTICLES) {
      const r = await pool.query(
        `INSERT INTO help_articles (category_id, slug, title, summary, body_md, audience, tags, is_published, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,true,$8)
         ON CONFLICT (slug) DO NOTHING`,
        [catIds.get(a.category) ?? null, a.slug, a.title, a.summary, a.body, a.audience ?? "all", a.tags, a.sort ?? 100],
      );
      inserted += r.rowCount ?? 0;
    }
    if (inserted > 0) console.info(`[help-center] seed: ${inserted} makale eklendi`);
  } catch (e: any) {
    console.warn("[help-center] seed atlandı:", e?.message);
  }
}
