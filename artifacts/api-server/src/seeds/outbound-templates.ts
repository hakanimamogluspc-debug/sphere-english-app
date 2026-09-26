/**
 * Seed: Hazır Türkçe cold email şablonları
 *
 * ilk çalıştırmada boşsa yükler. Admin sonradan editleyebilir.
 * Manuel çalıştır: node dist/seeds/outbound-templates.js
 */

import { db, outboundTemplatesTable } from "@workspace/db";
import { count } from "drizzle-orm";

const SEED_TEMPLATES = [
  // B2B HR — İK Müdürleri için
  {
    name: "B2B HR · Cold Intro (Kısa)",
    segment: "b2b_hr",
    subject: "{{firstName}}, {{company}} çalışanları için 5 dakikalık bir fikir",
    bodyHtml: `<p>Merhaba {{firstName}},</p>
<p>{{company}} çalışanlarının İngilizce eğitiminde nasıl bir yol izlediğinizi merak ediyorum.</p>
<p>Sphere English olarak Türkiye'deki 40+ kurumsal firmaya AI destekli iş İngilizcesi eğitimi sağlıyoruz — 16 modül, 10 farklı AI koç, gerçek iş senaryoları.</p>
<p>Farkımız: <strong>çalışan başına ayda 30-45 dk aktif kullanım</strong> (klasik LMS'lerin 3 katı). Bunu <strong>bireysel öğrenme yolu + streak sistemi</strong> ile başarıyoruz.</p>
<p>{{company}} için 15 dk'lık bir demo takvimlemek ister misin? Kısa bir link:<br>
<a href="https://calendly.com/sphereenglish/demo">https://calendly.com/sphereenglish/demo</a></p>
<p>Selamlar,<br>Hakan İmamoğlu<br>Sphere English</p>`,
    bodyText: `Merhaba {{firstName}},\n\n{{company}} çalışanlarının İngilizce eğitiminde nasıl bir yol izlediğinizi merak ediyorum.\n\nSphere English olarak Türkiye'deki 40+ kurumsal firmaya AI destekli iş İngilizcesi eğitimi sağlıyoruz. 16 modül, 10 AI koç, gerçek iş senaryoları.\n\nFarkımız: çalışan başına ayda 30-45 dk aktif kullanım. Bunu bireysel öğrenme yolu + streak sistemi ile başarıyoruz.\n\n{{company}} için 15 dk'lık bir demo takvimlemek ister misin?\nhttps://calendly.com/sphereenglish/demo\n\nSelamlar,\nHakan İmamoğlu\nSphere English`,
  },
  {
    name: "B2B HR · Follow-up 1 (3 gün sonra)",
    segment: "b2b_hr",
    subject: "Re: {{company}} çalışanları için 5 dakikalık bir fikir",
    bodyHtml: `<p>Merhaba {{firstName}},</p>
<p>Geçen mektubuma dönüş yapmamış olabilirsin. Kısa bir düşünce:</p>
<p>Kurumsal İngilizce eğitimlerinde en büyük dert genelde <strong>bitirilmemesi</strong>. Çalışanlar başlar, 2-3 ay sonra bırakır. Sphere'de bu problemi <strong>günlük 10 dk mikro-öğrenme + otomatik hatırlatma + AI koçluğuyla</strong> çözdük.</p>
<p>{{company}}'ye özel bir demo takvimlemek istersen bu linki kullanabilirsin: <a href="https://calendly.com/sphereenglish/demo">https://calendly.com/sphereenglish/demo</a></p>
<p>Vaktin yoksa iki cümle ile "ilgilenmiyorum" desen bile büyük yardım olur — mesajı takip etmeyi keserim.</p>
<p>Selamlar,<br>Hakan</p>`,
    bodyText: `Merhaba {{firstName}},\n\nGeçen mektubuma dönüş yapmamış olabilirsin. Kısa bir düşünce:\n\nKurumsal İngilizce eğitimlerinde en büyük dert genelde bitirilmemesi. Çalışanlar başlar, 2-3 ay sonra bırakır. Sphere'de bu problemi günlük 10 dk mikro-öğrenme + AI koçluğuyla çözdük.\n\nDemo: https://calendly.com/sphereenglish/demo\n\nVaktin yoksa iki cümle ile "ilgilenmiyorum" desen bile yardım olur.\n\nSelamlar,\nHakan`,
  },
  {
    name: "B2B HR · Follow-up 2 / Break-up (7 gün sonra)",
    segment: "b2b_hr",
    subject: "Sonuncu — {{company}} için değer önerisi",
    bodyHtml: `<p>Merhaba {{firstName}},</p>
<p>Bu son mesajım — söz veriyorum.</p>
<p>Şu üç sorudan biri "evet" ise beraber çalışmaya değer olabilir:</p>
<ul>
  <li>Çalışanlarının %30+ı yurtdışı iletişim yapıyor mu?</li>
  <li>Mevcut İngilizce eğitiminizden memnun değil misin?</li>
  <li>Yeni yıl için eğitim bütçesi planlıyor musunuz?</li>
</ul>
<p>Herhangi biri "evet" ise 15 dk'lık bir görüşme ayarlayalım. Değilse mesajlarımı keserim, kolay gelsin.</p>
<p><a href="https://calendly.com/sphereenglish/demo">Demo takvimle →</a></p>
<p>Saygılar,<br>Hakan İmamoğlu</p>`,
    bodyText: `Merhaba {{firstName}},\n\nBu son mesajım — söz veriyorum.\n\nŞu üç sorudan biri "evet" ise beraber çalışmaya değer olabilir:\n- Çalışanlarının %30+ı yurtdışı iletişim yapıyor mu?\n- Mevcut İngilizce eğitiminizden memnun değil misin?\n- Yeni yıl için eğitim bütçesi planlıyor musunuz?\n\nHerhangi biri "evet" ise 15 dk'lık bir görüşme ayarlayalım.\nhttps://calendly.com/sphereenglish/demo\n\nSaygılar,\nHakan İmamoğlu`,
  },
  // B2B SME — KOBİ sahipleri
  {
    name: "B2B SME · Cold Intro",
    segment: "b2b_sme",
    subject: "{{company}} ekibi için yurtdışı iletişim çözümü",
    bodyHtml: `<p>Merhaba {{firstName}},</p>
<p>{{company}} ile ilgili LinkedIn'de gördüklerim etkileyici. Yurtdışı bağlantılarınız da varsa, ekip içinde İngilizce iletişim ihtiyacınız yüksektir sanırım.</p>
<p>Sphere English'te KOBİ'lere özel olarak <strong>ekip başına aylık ₺5.000</strong> gibi bir yatırımla iş İngilizcesi eğitimi sağlıyoruz. 16 AI modül, gerçek iş senaryoları, kişisel raporlama.</p>
<p>Bir görüşme yapmak ister misin?<br>
<a href="https://calendly.com/sphereenglish/demo">15 dk demo →</a></p>
<p>Selamlar,<br>Hakan</p>`,
    bodyText: `Merhaba {{firstName}},\n\n{{company}} ile ilgili LinkedIn'de gördüklerim etkileyici. Yurtdışı bağlantılarınız varsa ekip içinde İngilizce iletişim ihtiyacınız yüksektir.\n\nSphere English'te KOBİ'lere özel ekip başına aylık ₺5.000 yatırımla iş İngilizcesi eğitimi sağlıyoruz.\n\nDemo: https://calendly.com/sphereenglish/demo\n\nSelamlar,\nHakan`,
  },
  // Eğitim Partneri
  {
    name: "Partner · Dil Okulu Ortaklığı",
    segment: "partner",
    subject: "{{company}} + Sphere English partnership fikri",
    bodyHtml: `<p>Merhaba {{firstName}},</p>
<p>{{company}}'nin dil eğitimi alanındaki çalışmalarını takip ediyorum.</p>
<p>Sphere English olarak AI destekli iş İngilizcesi platformumuzu <strong>partner dil okullarına</strong> hediye olarak sunuyoruz. Öğrencilerinize klasik derslerin dışında dijital pratik imkanı verirsiniz — biz de referans olarak sizden bahsederiz.</p>
<p>Karşılıklı fayda modeli düşünelim mi? 20 dk'lık bir sohbet:<br>
<a href="https://calendly.com/sphereenglish/partner">Partner görüşmesi →</a></p>
<p>Saygılarımla,<br>Hakan İmamoğlu<br>Kurucu, Sphere English</p>`,
    bodyText: `Merhaba {{firstName}},\n\n{{company}}'nin dil eğitimi çalışmalarını takip ediyorum.\n\nSphere English olarak AI destekli iş İngilizcesi platformumuzu partner dil okullarına hediye olarak sunuyoruz. Öğrencilerinize dijital pratik imkanı verirsiniz — biz de referans olarak sizden bahsederiz.\n\nPartner görüşmesi: https://calendly.com/sphereenglish/partner\n\nSaygılarımla,\nHakan İmamoğlu\nKurucu, Sphere English`,
  },
];

export async function seedOutboundTemplates() {
  const [{ n }] = await db.select({ n: count() }).from(outboundTemplatesTable);
  if (Number(n) > 0) {
    console.log(`[seed:outbound-templates] Zaten ${n} template var, seed atlandı.`);
    return;
  }
  await db.insert(outboundTemplatesTable).values(SEED_TEMPLATES.map(t => ({
    name: t.name, segment: t.segment,
    subject: t.subject, bodyHtml: t.bodyHtml, bodyText: t.bodyText,
    variables: { firstName: "Ad", lastName: "Soyad", company: "Şirket", position: "Pozisyon" },
    isActive: true,
  })));
  console.log(`[seed:outbound-templates] ✓ ${SEED_TEMPLATES.length} template eklendi`);
}

// CLI: node dist/seeds/outbound-templates.js
if (import.meta.url === `file://${process.argv[1]}`) {
  seedOutboundTemplates().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
}
