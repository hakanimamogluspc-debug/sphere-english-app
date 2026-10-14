-- =====================================================================
-- E-Kitap pazarlama sayfası — 2026-10-14
--   ebook_waitlist : "Haberdar ol" formu kayıtları
--   ebook_faq      : /e-kitaplar FAQ (admin'den yönetilir)
--   ebook_guide    : /e-kitaplar "Nereden başlamalıyım" rehber kartları
--
-- Non-destructive, idempotent. Yeni tablolar; mevcut tablo/kolona
-- dokunulmaz. Veri kaybı yok. Seed satırları ON CONFLICT ile korumalı.
--
-- Çalıştırma (Easypanel sphere-api container shell):
--   psql "$DATABASE_URL" -P pager=off -f lib/db/migrations/202610_ebook_marketing.sql
-- =====================================================================

BEGIN;

-- 1. Haberdar ol
CREATE TABLE IF NOT EXISTS ebook_waitlist (
  id             SERIAL PRIMARY KEY,
  email          VARCHAR(320) NOT NULL,
  interest_area  VARCHAR(60),
  source         VARCHAR(60) NOT NULL DEFAULT 'ekitaplar-page',
  user_agent     VARCHAR(500),
  ip_hash        VARCHAR(64),
  notified_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS ebook_waitlist_email_area_unique
  ON ebook_waitlist (lower(email), COALESCE(interest_area, ''));
CREATE INDEX IF NOT EXISTS ebook_waitlist_created_idx ON ebook_waitlist (created_at);
CREATE INDEX IF NOT EXISTS ebook_waitlist_area_idx ON ebook_waitlist (interest_area);

-- 2. FAQ
CREATE TABLE IF NOT EXISTS ebook_faq (
  id             SERIAL PRIMARY KEY,
  question       VARCHAR(300) NOT NULL,
  answer         TEXT NOT NULL,
  display_order  INTEGER NOT NULL DEFAULT 0,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ebook_faq_order_idx ON ebook_faq (is_active, display_order);

-- 3. Rehber
CREATE TABLE IF NOT EXISTS ebook_guide (
  id             SERIAL PRIMARY KEY,
  role_label     VARCHAR(120) NOT NULL,
  description    TEXT NOT NULL,
  cta_text       VARCHAR(80),
  cta_href       VARCHAR(300),
  icon           VARCHAR(16),
  display_order  INTEGER NOT NULL DEFAULT 0,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ebook_guide_order_idx ON ebook_guide (is_active, display_order);

-- 4. Seed FAQ (sadece tablo boşsa)
INSERT INTO ebook_faq (question, answer, display_order)
SELECT q, a, o FROM (VALUES
  ('E-kitaplar hangi formatta ve nasıl teslim ediliyor?',
   'Tüm kitaplar PDF formatındadır. Ödeme tamamlandıktan hemen sonra her kitabın indirme bağlantısı e-posta adresinize gönderilir.', 1),
  ('Şu an hangi kitaplar satışta?',
   'İş İngilizcesinde Kullanılan 1000 Kelime serisinin 5 kitabı satıştadır: Kurumsal İletişim & Toplantılar; Pazarlama, Satış & Müşteri İlişkileri; Liderlik, İnsan Kaynakları & Küresel Operasyonlar; Kurumsal Strateji, Finansal Analiz & Risk Yönetimi; Küresel Girişimcilik, EdTech & Teknoloji Yönetimi.', 2),
  ('Yeni kitaplar gelecek mi?',
   'Evet. Farklı sektörler (ör. havacılık, turizm, sağlık, lojistik) ve beceriler (e-posta, sunum, müzakere, mülakat) için yeni kitaplar hazırlanıyor. Sayfadaki "Haber ver" formuna e-postanızı bırakırsanız ilgilendiğiniz alanda kitap çıktığında haber veririz.', 3),
  ('Seri adındaki "1000 kelime" neyi ifade ediyor?',
   'Her kitapta 50 kurumsal kalıp ve 150 temel terim vardır. 5 kitapta toplam 250 kalıp ve 750 terim, yani 1000 öğe bulunur.', 4),
  ('Set fiyatı nasıl hesaplanıyor?',
   'Bir kitabın liste fiyatı ₺299, indirimli fiyatı ₺199''dur. 5 kitabın liste toplamı ₺1.495, indirimli tek tek toplamı ₺995''tir. 5 kitaplık set ₺799''dur; tek tek almaya göre ₺196 daha az ödersiniz.', 5),
  ('Kitaplar hangi İngilizce seviyesine uygun?',
   'Kitap sayfalarındaki seviye etiketleri şöyledir: Kitap 01 B2–C1, Kitap 03 ve Kitap 04 C1–C2, Kitap 05 C1. Açıklamalar Türkçe olduğu için orta seviyedeki profesyoneller de rahatça takip edebilir.', 6),
  ('Satın almadan önce içeriğe bakabilir miyim?',
   'Evet. Her kitabın ilk 5 sayfasını ücretsiz önizleyebilir, kitap sayfasında içindekiler listesine göz atabilirsiniz.', 7),
  ('Kitaplara ne kadar süre erişebilirim?',
   'Satın aldığınız kitaplara ömür boyu erişiminiz olur. PDF dosyalarını telefon, tablet ve bilgisayarda okuyabilirsiniz.', 8),
  ('Ödeme güvenli mi?',
   'Ödemeler iyzico altyapısıyla 3D Secure olarak alınır. Kart bilgileriniz Sphere English''e iletilmez.', 9),
  ('Şirketim için toplu lisans alabilir miyim?',
   'Evet. 10 ve üzeri lisans için kurumsal fiyat sunuyoruz. İletişim sayfasından teklif isteyebilirsiniz: https://www.sphereenglish.com/iletisim', 10),
  ('İade ve cayma hakkı nasıl işliyor?',
   'Dijital ürünlerde teslimat ve iade koşulları Teslimat & İade (https://www.sphereenglish.com/teslimat-iade) ve Mesafeli Satış Sözleşmesi (https://www.sphereenglish.com/mesafeli-satis-sozlesmesi) sayfalarında yer alır.', 11)
) AS seed(q, a, o)
WHERE NOT EXISTS (SELECT 1 FROM ebook_faq);

-- 5. Seed Rehber (sadece tablo boşsa)
INSERT INTO ebook_guide (role_label, description, cta_text, cta_href, icon, display_order)
SELECT r, d, ct, ch, i, o FROM (VALUES
  ('Toplantılarda ve e-postada daha net olmak',
   'Kitap 01 · Kurumsal İletişim & Toplantılar ile başlayın. Sonra: Kitap 02 · Pazarlama, Satış & Müşteri İlişkileri.',
   'Kitap 01''i incele', '/e-kitaplar#katalog', '💬', 1),
  ('Müşteri ve satış görüşmeleri',
   'Kitap 02 · Pazarlama, Satış & Müşteri İlişkileri ile başlayın. Sonra: Kitap 01.',
   'Kitap 02''yi incele', '/e-kitaplar#katalog', '📈', 2),
  ('Yönetici olarak ekip ve strateji dili',
   'Kitap 03 · Liderlik, İK & Küresel Operasyonlar ile başlayın. Sonra: Kitap 04 · Kurumsal Strateji & Finans.',
   'Kitap 03''ü incele', '/e-kitaplar#katalog', '🧭', 3),
  ('Girişim, ürün ve teknoloji ekipleri',
   'Kitap 05 · Küresel Girişimcilik, EdTech & Teknoloji ile başlayın. Sonra: Kitap 01.',
   'Kitap 05''i incele', '/e-kitaplar#katalog', '🚀', 4),
  ('Birden fazla alanda çalışıyorum',
   '5 kitaplık tam set · ₺799. Tek tek almaya göre ₺196 daha az; 250 kalıp + 750 terim tek seferde.',
   'Tam seti incele', '/e-kitaplar#paketler', '📚', 5)
) AS seed(r, d, ct, ch, i, o)
WHERE NOT EXISTS (SELECT 1 FROM ebook_guide);

COMMIT;
