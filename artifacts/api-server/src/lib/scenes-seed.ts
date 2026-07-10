/**
 * Speaking Role-Play Sahneleri — startup seed.
 * Slug'a göre idempotent — mevcut sahneleri silmez/değiştirmez, sadece yoksa ekler.
 * İlk 5 MVP sahnesi. Sonraki fazlarda 80+ sahneye genişletilir.
 */

import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

interface SeedTurn {
  order: number;
  speaker: "user" | "ai";
  textEn: string;
  textTr?: string;
  notesTr?: string;
  phoneticHint?: string;
}

interface SeedScene {
  slug: string;
  category:
    | "general_business"
    | "meetings"
    | "sales"
    | "negotiation"
    | "presentations"
    | "phone_calls"
    | "tech"
    | "hr"
    | "finance"
    | "healthcare";
  titleEn: string;
  titleTr: string;
  descriptionTr: string;
  userRoleTr: string;
  counterpartRoleTr: string;
  difficulty: "A2" | "B1" | "B2" | "C1";
  minPlan: "free" | "pro";
  avgDurationMin: number;
  voice: "nova" | "onyx" | "shimmer" | "echo" | "alloy" | "fable";
  sortOrder: number;
  turns: SeedTurn[];
}

const SCENES: SeedScene[] = [
  // ────────── 1. Toplantı açış — Free tier ──────────
  {
    slug: "first-meeting-introduction",
    category: "general_business",
    titleEn: "First Meeting: Introducing Yourself",
    titleTr: "İlk Toplantı: Kendini Tanıtma",
    descriptionTr:
      "Yeni bir müşteriyle ilk toplantıda kendini profesyonel şekilde tanıtıp gündemi açıyorsun. Ton profesyonel ama sıcak.",
    userRoleTr: "Proje Yöneticisi",
    counterpartRoleTr: "Yeni müşteri (CEO)",
    difficulty: "B1",
    minPlan: "free",
    avgDurationMin: 4,
    voice: "nova",
    sortOrder: 1,
    turns: [
      {
        order: 1,
        speaker: "ai",
        textEn: "Good morning! Thanks for joining us today. Shall we begin?",
        textTr: "Günaydın! Bugün katıldığınız için teşekkürler. Başlayalım mı?",
      },
      {
        order: 2,
        speaker: "user",
        textEn: "Good morning. Thank you for having me. Let's start.",
        textTr: "Günaydın. Beni ağırladığınız için teşekkürler. Başlayalım.",
        notesTr: "'Thank you for having me' iş dünyasında sıkça kullanılan bir nezaket ifadesi.",
      },
      {
        order: 3,
        speaker: "ai",
        textEn: "Great. Could you briefly introduce yourself and your role?",
        textTr: "Harika. Kendinizi ve rolünüzü kısaca tanıtabilir misiniz?",
      },
      {
        order: 4,
        speaker: "user",
        textEn:
          "Of course. I'm the project manager for our new digital transformation initiative.",
        textTr: "Elbette. Yeni dijital dönüşüm girişimimizin proje yöneticisiyim.",
        phoneticHint: "'digital transformation' — vurgu 'trans-for-MEY-shın' üzerinde.",
      },
      {
        order: 5,
        speaker: "ai",
        textEn: "Excellent. What are the main goals you'd like to cover today?",
        textTr: "Mükemmel. Bugün ele almak istediğiniz ana hedefler neler?",
      },
      {
        order: 6,
        speaker: "user",
        textEn:
          "Today I'd like to align on the project scope, timeline, and key milestones.",
        textTr:
          "Bugün proje kapsamı, zaman çizelgesi ve önemli aşamalarda hemfikir olmak istiyorum.",
        notesTr:
          "'Align on' — 'X üzerinde anlaşmak, aynı sayfada olmak' anlamında yaygın iş İngilizcesi kalıbı.",
      },
      {
        order: 7,
        speaker: "ai",
        textEn: "Sounds good. Let's start with the scope. What do you have in mind?",
        textTr: "Kulağa hoş geliyor. Kapsamla başlayalım. Aklınızda ne var?",
      },
      {
        order: 8,
        speaker: "user",
        textEn:
          "We plan to launch the core platform in three phases over the next six months.",
        textTr:
          "Ana platformu önümüzdeki altı ay içinde üç fazda hayata geçirmeyi planlıyoruz.",
      },
    ],
  },

  // ────────── 2. Toplantı kapatma — Free ──────────
  {
    slug: "wrapping-up-meeting",
    category: "meetings",
    titleEn: "Wrapping Up a Meeting",
    titleTr: "Toplantıyı Kapatma",
    descriptionTr:
      "Toplantı sonunda alınan kararları özetliyor, aksiyon maddelerini paylaşıyor ve bir sonraki adıma dair takvim belirliyorsun.",
    userRoleTr: "Toplantı yöneticisi",
    counterpartRoleTr: "Ekip üyesi",
    difficulty: "B1",
    minPlan: "free",
    avgDurationMin: 3,
    voice: "shimmer",
    sortOrder: 2,
    turns: [
      {
        order: 1,
        speaker: "ai",
        textEn: "I think we've covered everything on the agenda. Anything else to add?",
        textTr:
          "Sanırım gündemdeki her şeyi konuştuk. Eklemek istediğiniz bir şey var mı?",
      },
      {
        order: 2,
        speaker: "user",
        textEn: "Nothing from my side. Let me quickly summarize the key takeaways.",
        textTr: "Benim tarafımdan yok. Kısaca ana çıkarımları özetleyeyim.",
        notesTr: "'Key takeaways' — 'çıkarımlar / önemli noktalar' anlamında.",
      },
      {
        order: 3,
        speaker: "ai",
        textEn: "Please go ahead.",
        textTr: "Buyurun.",
      },
      {
        order: 4,
        speaker: "user",
        textEn:
          "We agreed on the new budget, and I'll send the revised proposal by Friday.",
        textTr:
          "Yeni bütçe konusunda anlaştık ve revize teklifi Cuma'ya kadar göndereceğim.",
      },
      {
        order: 5,
        speaker: "ai",
        textEn: "Perfect. And when should we meet again?",
        textTr: "Mükemmel. Ne zaman tekrar buluşalım?",
      },
      {
        order: 6,
        speaker: "user",
        textEn: "Let's schedule a follow-up next Tuesday at ten a.m.",
        textTr:
          "Önümüzdeki Salı sabah on'da bir takip toplantısı planlayalım.",
        phoneticHint: "'schedule' — İngiliz İng. 'şedul', Amerikan İng. 'skecul'.",
      },
      {
        order: 7,
        speaker: "ai",
        textEn: "Sounds great. Thanks everyone for your time.",
        textTr: "Kulağa harika geliyor. Ayırdığınız zaman için herkese teşekkürler.",
      },
      {
        order: 8,
        speaker: "user",
        textEn: "Thank you all. Have a productive week.",
        textTr: "Hepinize teşekkürler. Verimli bir hafta geçirin.",
      },
    ],
  },

  // ────────── 3. Sunum açılışı — Pro ──────────
  {
    slug: "presentation-opening",
    category: "presentations",
    titleEn: "Opening a Client Presentation",
    titleTr: "Müşteri Sunumu Açılışı",
    descriptionTr:
      "Yeni bir müşteri için sunum açılışı yapıyorsun. Dikkat çekici bir giriş, kısa bir kendini tanıtma ve sunumun ana hatları.",
    userRoleTr: "Kıdemli Danışman",
    counterpartRoleTr: "Müşteri temsilcisi",
    difficulty: "B2",
    minPlan: "pro",
    avgDurationMin: 4,
    voice: "onyx",
    sortOrder: 3,
    turns: [
      {
        order: 1,
        speaker: "ai",
        textEn: "The team is ready. The floor is yours whenever you're ready.",
        textTr: "Ekip hazır. Hazır olduğunuzda söz sizin.",
        notesTr: "'The floor is yours' — 'söz sizin' anlamında iş sunumlarında sık kullanılır.",
      },
      {
        order: 2,
        speaker: "user",
        textEn:
          "Thank you. Good morning everyone, and thanks for making the time to meet with us.",
        textTr:
          "Teşekkürler. Herkese günaydın, bizimle buluşmak için zaman ayırdığınız için teşekkürler.",
      },
      {
        order: 3,
        speaker: "ai",
        textEn: "Our pleasure.",
        textTr: "Bizim için memnuniyet.",
      },
      {
        order: 4,
        speaker: "user",
        textEn:
          "Today I'd like to walk you through how we can help you cut costs by twenty percent.",
        textTr:
          "Bugün maliyetleri yüzde yirmi azaltmanıza nasıl yardımcı olabileceğimizi adım adım anlatacağım.",
        phoneticHint: "'walk you through' — 'adım adım anlatmak' deyimi. Vurgu 'walk' üzerinde.",
      },
      {
        order: 5,
        speaker: "ai",
        textEn: "That sounds interesting. Please continue.",
        textTr: "Kulağa ilginç geliyor. Lütfen devam edin.",
      },
      {
        order: 6,
        speaker: "user",
        textEn:
          "The presentation has three main parts: our analysis, our recommendations, and next steps.",
        textTr:
          "Sunumun üç ana bölümü var: analizimiz, önerilerimiz ve sonraki adımlar.",
      },
      {
        order: 7,
        speaker: "ai",
        textEn: "Perfect structure. Let's dive in.",
        textTr: "Mükemmel yapı. Hadi başlayalım.",
      },
      {
        order: 8,
        speaker: "user",
        textEn: "Let's start with what we found during our initial analysis phase.",
        textTr: "İlk analiz aşamamızda bulduklarımızla başlayalım.",
        notesTr: "'Let's start with' — profesyonel sunumlarda geçiş cümlesi.",
      },
    ],
  },

  // ────────── 4. Fiyat müzakeresi — Pro ──────────
  {
    slug: "salary-negotiation",
    category: "negotiation",
    titleEn: "Salary Negotiation with Recruiter",
    titleTr: "İşe Alım Sorumlusuyla Maaş Müzakeresi",
    descriptionTr:
      "Bir teklif aldın ve maaş konusunda müzakere ediyorsun. Kendine güvenli ama saygılı bir ton, gerekçelerini net ifade edeceksin.",
    userRoleTr: "İş adayı",
    counterpartRoleTr: "İşe alım sorumlusu",
    difficulty: "B2",
    minPlan: "pro",
    avgDurationMin: 5,
    voice: "shimmer",
    sortOrder: 4,
    turns: [
      {
        order: 1,
        speaker: "ai",
        textEn:
          "We'd love to have you on the team. Our offer is ninety thousand dollars annually.",
        textTr:
          "Sizi ekipte görmeyi çok isteriz. Teklifimiz yıllık doksan bin dolar.",
      },
      {
        order: 2,
        speaker: "user",
        textEn:
          "Thank you for the offer. I'm very excited about this role.",
        textTr: "Teklif için teşekkürler. Bu rol için çok heyecanlıyım.",
        notesTr: "Müzakerede önce olumlu bir çerçeve kurmak yaygın taktik.",
      },
      {
        order: 3,
        speaker: "ai",
        textEn: "We're glad to hear that.",
        textTr: "Bunu duyduğumuza sevindik.",
      },
      {
        order: 4,
        speaker: "user",
        textEn:
          "Based on my experience and the market rate, I was hoping for something closer to a hundred thousand.",
        textTr:
          "Tecrübem ve piyasa oranları düşünüldüğünde yüz bine yakın bir rakam bekliyordum.",
        phoneticHint:
          "'Based on' — 'be-eyst on' değil 'beysd on'. Vurgu ilk hecede.",
      },
      {
        order: 5,
        speaker: "ai",
        textEn: "That's a significant difference. Can you help me understand your reasoning?",
        textTr: "Bu ciddi bir fark. Gerekçenizi biraz açıklar mısınız?",
      },
      {
        order: 6,
        speaker: "user",
        textEn:
          "I've led similar projects that generated over two million in revenue for my previous employer.",
        textTr:
          "Önceki işverenim için iki milyon doların üzerinde gelir üreten benzer projeleri yönettim.",
      },
      {
        order: 7,
        speaker: "ai",
        textEn: "That's impressive. Let me check what we can do.",
        textTr: "Etkileyici. Ne yapabileceğimizi kontrol edeyim.",
      },
      {
        order: 8,
        speaker: "user",
        textEn:
          "I appreciate that. I'm open to discussing the full package, including benefits and equity.",
        textTr:
          "Bunu takdir ediyorum. Yan haklar ve hisse dahil paketin tamamını görüşmeye açığım.",
        notesTr:
          "'Full package' — sadece maaş değil bonus, hisse, yan haklar dahil toplam paket.",
      },
    ],
  },

  // ────────── 5. Kod review sunumu — Pro (tech) ──────────
  {
    slug: "code-review-presentation",
    category: "tech",
    titleEn: "Presenting a Code Review to the Team",
    titleTr: "Ekibe Kod İncelemesi Sunumu",
    descriptionTr:
      "Ekip toplantısında bir pull request'in kod incelemesini sunuyorsun. Teknik bir dille ama yapıcı bir tonla.",
    userRoleTr: "Kıdemli Yazılım Geliştirici",
    counterpartRoleTr: "Yazılım ekibi lideri",
    difficulty: "B2",
    minPlan: "pro",
    avgDurationMin: 4,
    voice: "echo",
    sortOrder: 5,
    turns: [
      {
        order: 1,
        speaker: "ai",
        textEn: "Alright, let's move on to the code review. What are your findings?",
        textTr: "Peki, kod incelemesine geçelim. Bulguların neler?",
      },
      {
        order: 2,
        speaker: "user",
        textEn:
          "Overall, the pull request is well-structured and follows our coding standards.",
        textTr:
          "Genel olarak pull request iyi yapılandırılmış ve kodlama standartlarımıza uygun.",
        notesTr:
          "'Pull request' — telaffuz 'pul rikuest'. Vurgu 'pull' üzerinde.",
      },
      {
        order: 3,
        speaker: "ai",
        textEn: "Good to hear. Any concerns?",
        textTr: "Duymak güzel. Endişelerin var mı?",
      },
      {
        order: 4,
        speaker: "user",
        textEn:
          "I have two main concerns: error handling in the payment module, and missing unit tests.",
        textTr:
          "İki ana endişem var: ödeme modülündeki hata yönetimi ve eksik unit test'ler.",
      },
      {
        order: 5,
        speaker: "ai",
        textEn: "Can you elaborate on the error handling issue?",
        textTr: "Hata yönetimi konusunu biraz açar mısın?",
      },
      {
        order: 6,
        speaker: "user",
        textEn:
          "The current implementation silently catches exceptions instead of logging them.",
        textTr:
          "Mevcut implementasyon istisnaları loglamak yerine sessizce yakalıyor.",
        phoneticHint:
          "'exception' — 'ık-SEP-şın'. Vurgu ikinci hecede.",
      },
      {
        order: 7,
        speaker: "ai",
        textEn: "That's a valid concern. What do you suggest?",
        textTr: "Haklı bir endişe. Ne öneriyorsun?",
      },
      {
        order: 8,
        speaker: "user",
        textEn:
          "I suggest we add structured logging and re-throw critical errors for observability.",
        textTr:
          "Yapılandırılmış loglama eklememizi ve kritik hataları gözlemlenebilirlik için yeniden fırlatmamızı öneriyorum.",
        notesTr:
          "'Observability' iş dünyasında sık kullanılan modern terim: sistemin durumunu anlama.",
      },
    ],
  },

  // ────────── 6. Telefon: Randevu Alma — Free ──────────
  {
    slug: "phone-scheduling-appointment",
    category: "phone_calls",
    titleEn: "Scheduling a Meeting Over the Phone",
    titleTr: "Telefonla Randevu Alma",
    descriptionTr: "Bir müşteriyi telefonla arayıp bir toplantı ayarlıyorsun. Kısa ve net konuşman gerek.",
    userRoleTr: "Hesap Yöneticisi",
    counterpartRoleTr: "Müşteri asistanı",
    difficulty: "B1",
    minPlan: "free",
    avgDurationMin: 3,
    voice: "shimmer",
    sortOrder: 6,
    turns: [
      { order: 1, speaker: "ai", textEn: "Good afternoon, this is Sarah speaking. How can I help you?", textTr: "İyi günler, ben Sarah. Nasıl yardımcı olabilirim?" },
      { order: 2, speaker: "user", textEn: "Hi Sarah, I'd like to schedule a meeting with Mr. Johnson next week.", textTr: "Merhaba Sarah, gelecek hafta Bay Johnson ile bir toplantı ayarlamak istiyorum.", phoneticHint: "'schedule' — Amerikan İng. 'skecul'. Vurgu ilk hecede." },
      { order: 3, speaker: "ai", textEn: "Sure. Which day works best for you?", textTr: "Tabii. Sizin için hangi gün uygun?" },
      { order: 4, speaker: "user", textEn: "Would Tuesday afternoon be possible, around three o'clock?", textTr: "Salı öğleden sonra, saat üç civarı mümkün mü?" },
      { order: 5, speaker: "ai", textEn: "Yes, Tuesday at three works. I'll send a calendar invite.", textTr: "Evet, Salı üç uygun. Bir takvim daveti göndereceğim." },
      { order: 6, speaker: "user", textEn: "Perfect, thank you. Have a great day.", textTr: "Mükemmel, teşekkürler. İyi günler.", notesTr: "'Have a great day' telefon kapanışında en yaygın nezaket ifadesi." },
    ],
  },

  // ────────── 7. Telefon: Şikayet Yönetimi — Pro ──────────
  {
    slug: "phone-handling-complaint",
    category: "phone_calls",
    titleEn: "Handling a Customer Complaint on the Phone",
    titleTr: "Telefonda Müşteri Şikayeti Yönetimi",
    descriptionTr: "Sinirli bir müşteri arıyor. Sakin kalıp anlayışlı bir tonla sorunu çözmeye çalışacaksın.",
    userRoleTr: "Müşteri Hizmetleri Temsilcisi",
    counterpartRoleTr: "Şikayetçi müşteri",
    difficulty: "B2",
    minPlan: "pro",
    avgDurationMin: 4,
    voice: "nova",
    sortOrder: 7,
    turns: [
      { order: 1, speaker: "ai", textEn: "I am really disappointed with your service. My order still hasn't arrived!", textTr: "Hizmetinizden gerçekten hayal kırıklığına uğradım. Siparişim hala gelmedi!" },
      { order: 2, speaker: "user", textEn: "I'm very sorry to hear that. Could you please share your order number?", textTr: "Bunu duyduğuma çok üzüldüm. Sipariş numaranızı paylaşır mısınız?", notesTr: "Şikayet yönetiminde önce empati, sonra bilgi toplama — altın kural." },
      { order: 3, speaker: "ai", textEn: "It's SF-90210. I paid extra for express delivery.", textTr: "SF-90210. Ekspres teslimat için ekstra ödedim." },
      { order: 4, speaker: "user", textEn: "Thank you. Let me look into that right now and see what happened.", textTr: "Teşekkürler. Hemen bakıp ne olduğunu göreyim.", phoneticHint: "'look into that' — bir konuyu araştırmak. Doğal bir bağlantı ile söyle." },
      { order: 5, speaker: "ai", textEn: "Please, this is really urgent.", textTr: "Lütfen, bu gerçekten acil." },
      { order: 6, speaker: "user", textEn: "I completely understand. I'll refund the delivery fee and expedite your package today.", textTr: "Tamamen anlıyorum. Teslimat ücretini iade edip paketinizi bugün acilen göndereceğim.", notesTr: "'Expedite' — hızlandırmak. Kurumsal ortamda çok kullanılan bir fiil." },
    ],
  },

  // ────────── 8. Satış Pitch — Pro ──────────
  {
    slug: "sales-elevator-pitch",
    category: "sales",
    titleEn: "Elevator Pitch to a Prospect",
    titleTr: "Potansiyel Müşteriye Asansör Sunumu",
    descriptionTr: "Yeni tanıştığın bir potansiyel müşteriye 60 saniyede şirketini ve ürününü tanıtıyorsun.",
    userRoleTr: "Satış Müdürü",
    counterpartRoleTr: "Potansiyel müşteri (CTO)",
    difficulty: "B2",
    minPlan: "pro",
    avgDurationMin: 3,
    voice: "onyx",
    sortOrder: 8,
    turns: [
      { order: 1, speaker: "ai", textEn: "So, what does your company do exactly?", textTr: "Peki, şirketiniz tam olarak ne yapıyor?" },
      { order: 2, speaker: "user", textEn: "We help mid-sized companies automate their data pipelines in weeks, not months.", textTr: "Orta ölçekli şirketlerin veri pipeline'larını aylar değil, haftalar içinde otomatikleştirmelerine yardım ediyoruz.", notesTr: "Elevator pitch formülü: 'X'e Y sağlıyoruz, Z zaman kazandırıyoruz.'" },
      { order: 3, speaker: "ai", textEn: "Interesting. How is that different from what already exists?", textTr: "İlginç. Mevcut çözümlerden nasıl farklı?" },
      { order: 4, speaker: "user", textEn: "Our platform is code-free, so business teams can build without engineering support.", textTr: "Platformumuz kod gerektirmiyor, bu yüzden iş ekipleri mühendislik desteği olmadan kurabilir.", phoneticHint: "'code-free' — vurgu 'code'. Birleşik kelime olarak akıcı söyle." },
      { order: 5, speaker: "ai", textEn: "That's a bold claim. Do you have any case studies?", textTr: "Cesur bir iddia. Vaka çalışmalarınız var mı?" },
      { order: 6, speaker: "user", textEn: "Yes, we recently helped a fintech reduce processing time by seventy percent.", textTr: "Evet, kısa süre önce bir fintech şirketinin işleme süresini yüzde yetmiş azaltmasına yardım ettik.", notesTr: "Concrete numbers = credibility. Yuvarlanmış rakamlar (70, 80, 90) etkili." },
    ],
  },

  // ────────── 9. Satış: İtiraz Karşılama — Pro ──────────
  {
    slug: "sales-handling-objection",
    category: "sales",
    titleEn: "Handling Price Objection",
    titleTr: "Fiyat İtirazını Karşılama",
    descriptionTr: "Müşteri fiyatı yüksek buluyor. Değer temelli argümanlarla itirazı karşılayacaksın.",
    userRoleTr: "Satış Temsilcisi",
    counterpartRoleTr: "Şüpheci müşteri",
    difficulty: "B2",
    minPlan: "pro",
    avgDurationMin: 4,
    voice: "shimmer",
    sortOrder: 9,
    turns: [
      { order: 1, speaker: "ai", textEn: "Honestly, your solution is more expensive than the competition.", textTr: "Açıkçası, çözümünüz rakiplerden daha pahalı." },
      { order: 2, speaker: "user", textEn: "I understand your concern. Can we look at the total cost of ownership together?", textTr: "Endişenizi anlıyorum. Toplam sahip olma maliyetine birlikte bakabilir miyiz?", notesTr: "'Total cost of ownership' (TCO) — sadece fiyat değil, uzun vadeli maliyet." },
      { order: 3, speaker: "ai", textEn: "Fine, but I still don't see how you justify the price.", textTr: "Peki, ama fiyatı nasıl gerekçelendirdiğinizi hala göremiyorum." },
      { order: 4, speaker: "user", textEn: "Our clients typically save forty percent in operational costs within the first year.", textTr: "Müşterilerimiz genellikle ilk yıl operasyonel maliyetlerde yüzde kırk tasarruf ediyor.", phoneticHint: "'operational' — 5 heceli. 'ope-ra-şı-nıl'. Vurgu 3. hecede." },
      { order: 5, speaker: "ai", textEn: "That sounds too good to be true.", textTr: "Doğru olmayacak kadar iyi görünüyor." },
      { order: 6, speaker: "user", textEn: "I can share references from three companies your size who confirmed these numbers.", textTr: "Sizin büyüklüğünüzdeki bu rakamları doğrulayan üç şirketten referans paylaşabilirim.", notesTr: "Sosyal kanıt (social proof) itirazları kırmanın en etkili yolu." },
    ],
  },

  // ────────── 10. İK: Performans Değerlendirme — Pro ──────────
  {
    slug: "hr-performance-review",
    category: "hr",
    titleEn: "Delivering a Performance Review",
    titleTr: "Performans Değerlendirmesi Verme",
    descriptionTr: "Bir çalışanına yılsonu performans değerlendirmesi veriyorsun. Yapıcı ve dürüst bir ton.",
    userRoleTr: "Ekip Lideri",
    counterpartRoleTr: "Çalışan",
    difficulty: "B2",
    minPlan: "pro",
    avgDurationMin: 4,
    voice: "nova",
    sortOrder: 10,
    turns: [
      { order: 1, speaker: "ai", textEn: "Thanks for meeting with me. I'm a bit nervous about this review.", textTr: "Benimle görüştüğün için teşekkürler. Bu değerlendirme için biraz gerginim." },
      { order: 2, speaker: "user", textEn: "Don't be. Overall, you've made significant progress this year.", textTr: "Endişelenme. Genel olarak, bu yıl önemli bir ilerleme kaydettin.", notesTr: "Zor konuşmalarda ilk cümle tonu belirler. Pozitif başla." },
      { order: 3, speaker: "ai", textEn: "That's a relief. What went well?", textTr: "Bu bir rahatlık. Ne iyi gitti?" },
      { order: 4, speaker: "user", textEn: "Your project delivery has been consistent, and clients specifically praised your communication.", textTr: "Proje teslimlerin tutarlı oldu ve müşteriler özellikle iletişim tarzını övdü.", phoneticHint: "'specifically' — 5 heceli. 'spe-si-fi-kli'. Akıcı çıkmalı." },
      { order: 5, speaker: "ai", textEn: "Thanks. And what should I focus on next?", textTr: "Teşekkürler. Bir sonraki dönemde neye odaklanmalıyım?" },
      { order: 6, speaker: "user", textEn: "I'd like you to take more ownership of cross-team initiatives next quarter.", textTr: "Önümüzdeki çeyrek ekipler arası girişimlerde daha fazla sorumluluk almanı istiyorum.", notesTr: "'Take ownership' — sadece iş yapmak değil, sonucu sahiplenmek." },
    ],
  },

  // ────────── 11. İK: İşe Alım Görüşmesi — Pro ──────────
  {
    slug: "hr-conducting-interview",
    category: "hr",
    titleEn: "Interviewing a Job Candidate",
    titleTr: "İş Adayı Mülakatı Yapma",
    descriptionTr: "Bir kıdemli pozisyon için adayla mülakat yapıyorsun. Davranışsal sorularla değerlendirme.",
    userRoleTr: "İşe Alım Yöneticisi",
    counterpartRoleTr: "İş Adayı",
    difficulty: "B2",
    minPlan: "pro",
    avgDurationMin: 4,
    voice: "onyx",
    sortOrder: 11,
    turns: [
      { order: 1, speaker: "ai", textEn: "Thanks for having me today.", textTr: "Beni bugün ağırladığınız için teşekkürler." },
      { order: 2, speaker: "user", textEn: "Our pleasure. Could you walk me through your most recent project?", textTr: "Bizim için memnuniyet. En son projenizi bana adım adım anlatır mısınız?", phoneticHint: "'walk me through' — konusu birine anlatmak; kalıp olarak ezberle." },
      { order: 3, speaker: "ai", textEn: "Sure. I led a team of five to migrate our legacy system to cloud.", textTr: "Elbette. Beş kişilik bir ekibe liderlik ederek eski sistemimizi buluta taşıdım." },
      { order: 4, speaker: "user", textEn: "Interesting. What was the biggest challenge you faced?", textTr: "İlginç. Karşılaştığınız en büyük zorluk neydi?", notesTr: "Davranışsal mülakat sorularında STAR (Situation-Task-Action-Result) tekniği aranır." },
      { order: 5, speaker: "ai", textEn: "Managing stakeholder expectations across three departments.", textTr: "Üç departman arasında paydaş beklentilerini yönetmek." },
      { order: 6, speaker: "user", textEn: "How did you handle that? Can you give me a specific example?", textTr: "Bunu nasıl yönettiniz? Somut bir örnek verebilir misiniz?", notesTr: "'Specific example' isteyerek adayın gerçek deneyimini test edersin." },
    ],
  },

  // ────────── 12. Finans: Bütçe Sunumu — Pro ──────────
  {
    slug: "finance-budget-presentation",
    category: "finance",
    titleEn: "Presenting Quarterly Budget",
    titleTr: "Çeyreklik Bütçe Sunumu",
    descriptionTr: "Yönetime çeyreklik bütçe sonuçlarını sunuyorsun. Sayılara hakim, net ve konuşkan.",
    userRoleTr: "Finans Direktörü",
    counterpartRoleTr: "CEO",
    difficulty: "B2",
    minPlan: "pro",
    avgDurationMin: 4,
    voice: "onyx",
    sortOrder: 12,
    turns: [
      { order: 1, speaker: "ai", textEn: "Let's start with the highlights. How did we perform this quarter?", textTr: "Önemli noktalarla başlayalım. Bu çeyrekte nasıl performans gösterdik?" },
      { order: 2, speaker: "user", textEn: "Revenue grew twelve percent year over year, exceeding our forecast.", textTr: "Ciromuz yıllık bazda yüzde on iki büyüdü, tahminlerimizin üzerinde.", phoneticHint: "'year over year' (YoY) — finansta 'yılda bir öncekine göre'. Kalıp olarak akıcı söyle." },
      { order: 3, speaker: "ai", textEn: "Impressive. What drove that growth?", textTr: "Etkileyici. Bu büyümeyi ne sağladı?" },
      { order: 4, speaker: "user", textEn: "Enterprise sales expanded by twenty-five percent while churn declined significantly.", textTr: "Kurumsal satışlar yüzde yirmi beş büyüdü, kayıp müşteri oranı ise belirgin şekilde düştü.", notesTr: "'Churn' — kaybedilen müşteri oranı. Finans ve SaaS'ta çok kullanılır." },
      { order: 5, speaker: "ai", textEn: "Any risks we should be aware of?", textTr: "Farkında olmamız gereken riskler var mı?" },
      { order: 6, speaker: "user", textEn: "Our largest client renews in Q3, and losing them would hurt our top line by eight percent.", textTr: "En büyük müşterimiz Ç3'te yeniliyor, kaybımız gelirimizi yüzde sekiz etkiler.", notesTr: "'Top line' = gelir. 'Bottom line' = kar. Finans jargonu." },
    ],
  },

  // ────────── 13. Kriz İletişimi — Pro ──────────
  {
    slug: "crisis-communication",
    category: "general_business",
    titleEn: "Communicating a Crisis to the Team",
    titleTr: "Ekibe Kriz İletişimi",
    descriptionTr: "Kritik bir sistem hatası oldu. Ekibi sakinleştirip aksiyon planını sunacaksın.",
    userRoleTr: "Direktör",
    counterpartRoleTr: "Ekip Üyesi",
    difficulty: "B2",
    minPlan: "pro",
    avgDurationMin: 3,
    voice: "onyx",
    sortOrder: 13,
    turns: [
      { order: 1, speaker: "ai", textEn: "Everyone's asking questions. What's actually going on?", textTr: "Herkes soru soruyor. Aslında ne oluyor?" },
      { order: 2, speaker: "user", textEn: "Let me be upfront: we had a major outage affecting fifteen percent of customers this morning.", textTr: "Açık olayım: bu sabah müşterilerimizin yüzde on beşini etkileyen büyük bir kesinti yaşadık.", notesTr: "'Let me be upfront' — 'açık konuşayım'. Krizde şeffaflık kilit." },
      { order: 3, speaker: "ai", textEn: "How long will it take to fix?", textTr: "Düzeltmek ne kadar sürecek?" },
      { order: 4, speaker: "user", textEn: "Engineering estimates full recovery within four hours. Our top priority now is customer communication.", textTr: "Mühendislik dört saat içinde tam iyileşme öngörüyor. Şu anki önceliğimiz müşteri iletişimi.", phoneticHint: "'priority' — 'pray-o-ri-ti'. 4 heceli, vurgu ilk hecede." },
      { order: 5, speaker: "ai", textEn: "What do you need from us?", textTr: "Bizden ne bekliyorsun?" },
      { order: 6, speaker: "user", textEn: "Support team should proactively reach out to affected accounts within the next hour.", textTr: "Destek ekibi bir saat içinde etkilenen hesaplarla proaktif iletişime geçmeli.", notesTr: "'Proactively' — beklemeden, önden. Reactive'in tersi." },
    ],
  },

  // ────────── 14. Sunum: Q&A — Pro ──────────
  {
    slug: "presentation-qa-tough-question",
    category: "presentations",
    titleEn: "Handling a Tough Question in Q&A",
    titleTr: "Sunumda Zor Soruyu Karşılama",
    descriptionTr: "Sunum sonrası izleyicilerden agresif ve zorlayıcı bir soru geldi. Sakin ve profesyonel yanıtlayacaksın.",
    userRoleTr: "Sunumcu",
    counterpartRoleTr: "Şüpheci izleyici",
    difficulty: "B2",
    minPlan: "pro",
    avgDurationMin: 3,
    voice: "nova",
    sortOrder: 14,
    turns: [
      { order: 1, speaker: "ai", textEn: "Frankly, your projections seem overly optimistic. How do you defend them?", textTr: "Açıkçası tahminleriniz aşırı iyimser görünüyor. Nasıl savunuyorsunuz?" },
      { order: 2, speaker: "user", textEn: "That's a fair question. Let me walk you through the assumptions behind our numbers.", textTr: "Adil bir soru. Sizi rakamlarımızın arkasındaki varsayımlar üzerinden geçireyim.", notesTr: "Zor sorularda 'fair question' teşekkürüyle başlamak zaman kazandırır." },
      { order: 3, speaker: "ai", textEn: "Go ahead.", textTr: "Buyurun." },
      { order: 4, speaker: "user", textEn: "Our forecast is based on three years of consistent growth and conservative market assumptions.", textTr: "Tahminimiz üç yıllık tutarlı büyüme ve muhafazakâr pazar varsayımlarına dayanıyor.", phoneticHint: "'assumptions' — 'ıh-samp-şıns'. İki 'p' yumuşak." },
      { order: 5, speaker: "ai", textEn: "But the market has shifted since then.", textTr: "Ama pazar o zamandan beri değişti." },
      { order: 6, speaker: "user", textEn: "You're absolutely right, which is why we've applied a twenty percent downside buffer.", textTr: "Kesinlikle haklısınız, bu yüzden yüzde yirmi düşüş tamponu uyguladık.", notesTr: "Karşı tarafı kabul etmek + argümanı güçlendirmek = ikna gücü." },
    ],
  },

  // ────────── 15. Sağlık: Hasta Konsültasyonu — Pro ──────────
  {
    slug: "healthcare-patient-consultation",
    category: "healthcare",
    titleEn: "Doctor-Patient Consultation",
    titleTr: "Doktor-Hasta Konsültasyonu",
    descriptionTr: "Bir hastaya semptomlarını sorup teşhisi açıklıyorsun. Empatik ve profesyonel bir ton.",
    userRoleTr: "Doktor",
    counterpartRoleTr: "Hasta",
    difficulty: "B2",
    minPlan: "pro",
    avgDurationMin: 4,
    voice: "shimmer",
    sortOrder: 15,
    turns: [
      { order: 1, speaker: "ai", textEn: "Doctor, I've been having severe headaches for three weeks now.", textTr: "Doktor, üç haftadır şiddetli baş ağrılarım var." },
      { order: 2, speaker: "user", textEn: "I'm sorry to hear that. Can you describe when the headaches typically occur?", textTr: "Bunu duyduğuma üzüldüm. Baş ağrıları genelde ne zaman oluyor?", notesTr: "Sağlık İngilizcesi'nde empati + spesifik soru = güven inşası." },
      { order: 3, speaker: "ai", textEn: "Mostly in the evenings, and screen time makes it worse.", textTr: "Çoğunlukla akşamları ve ekran süresi kötüleştiriyor." },
      { order: 4, speaker: "user", textEn: "That sounds like tension headaches. Have you been under significant stress lately?", textTr: "Bu gerginlik baş ağrısı gibi görünüyor. Son zamanlarda ciddi bir stres yaşadınız mı?", phoneticHint: "'tension' — 'ten-şın'. İki heceli." },
      { order: 5, speaker: "ai", textEn: "Yes, work has been overwhelming.", textTr: "Evet, iş bunaltıcı." },
      { order: 6, speaker: "user", textEn: "I'd recommend regular breaks, hydration, and I'll prescribe a mild pain reliever.", textTr: "Düzenli molalar, su içmek öneriyorum ve hafif bir ağrı kesici yazacağım.", notesTr: "'Prescribe' — reçete yazmak. Sağlık İng.'nin temel fiillerinden." },
    ],
  },

  // ────────── 16. Networking — Free ──────────
  {
    slug: "networking-conference",
    category: "general_business",
    titleEn: "Networking at a Conference",
    titleTr: "Konferansta Networking",
    descriptionTr: "Bir sektör konferansında yeni biriyle sohbet başlatıyorsun. Sıcak, doğal, meraklı.",
    userRoleTr: "Katılımcı",
    counterpartRoleTr: "Diğer Katılımcı",
    difficulty: "B1",
    minPlan: "free",
    avgDurationMin: 3,
    voice: "shimmer",
    sortOrder: 16,
    turns: [
      { order: 1, speaker: "ai", textEn: "Hi! Are you enjoying the conference so far?", textTr: "Merhaba! Şimdiye kadar konferansı beğeniyor musunuz?" },
      { order: 2, speaker: "user", textEn: "Yes, especially the keynote this morning. What about you?", textTr: "Evet, özellikle bu sabahki açılış konuşmasını. Siz?", notesTr: "Sohbete karşılıklı soru = doğal networking." },
      { order: 3, speaker: "ai", textEn: "Same here. What company are you with?", textTr: "Aynı şekilde. Hangi şirkettesiniz?" },
      { order: 4, speaker: "user", textEn: "I work at a SaaS startup focused on marketing automation.", textTr: "Pazarlama otomasyonuna odaklı bir SaaS startupında çalışıyorum.", phoneticHint: "'SaaS' — 'sass' olarak telaffuz edilir, tek hece." },
      { order: 5, speaker: "ai", textEn: "That's interesting. We might have some synergies. Shall we exchange contacts?", textTr: "İlginç. Sinerjimiz olabilir. İletişim bilgilerimizi paylaşalım mı?" },
      { order: 6, speaker: "user", textEn: "Absolutely, I'd love to stay in touch and continue this conversation.", textTr: "Kesinlikle, iletişimde kalıp bu konuşmaya devam etmek isterim.", notesTr: "'Stay in touch' — 'iletişimde kalmak', networking klasiği." },
    ],
  },

  // ────────── 17. Delege Etme — Pro ──────────
  {
    slug: "management-delegating-task",
    category: "general_business",
    titleEn: "Delegating a Task to a Team Member",
    titleTr: "Ekip Üyesine Görev Verme",
    descriptionTr: "Bir çalışana yeni ve önemli bir proje devrediyorsun. Motive edici ama net bir ton.",
    userRoleTr: "Departman Müdürü",
    counterpartRoleTr: "Ekip Üyesi",
    difficulty: "B1",
    minPlan: "pro",
    avgDurationMin: 3,
    voice: "onyx",
    sortOrder: 17,
    turns: [
      { order: 1, speaker: "ai", textEn: "You wanted to see me?", textTr: "Beni görmek mi istediniz?" },
      { order: 2, speaker: "user", textEn: "Yes. I have an important project I'd like you to lead.", textTr: "Evet. Sana liderlik yapmanı istediğim önemli bir projem var.", notesTr: "'Lead' — birine görev verirken güçlü bir kelime, motive edici." },
      { order: 3, speaker: "ai", textEn: "Sure, what is it?", textTr: "Tabii, nedir?" },
      { order: 4, speaker: "user", textEn: "We're launching a new client onboarding process, and I need someone to own it end-to-end.", textTr: "Yeni bir müşteri onboarding süreci başlatıyoruz ve bunu baştan sona sahiplenecek biri lazım.", phoneticHint: "'end-to-end' — 'end-tu-end'. Kısa ve akıcı." },
      { order: 5, speaker: "ai", textEn: "I'd love to take that on. When do we start?", textTr: "Bunu üstlenmeyi çok isterim. Ne zaman başlıyoruz?" },
      { order: 6, speaker: "user", textEn: "Kickoff meeting is Monday. I'll send you the brief and my expectations by tomorrow.", textTr: "Başlangıç toplantısı Pazartesi. Yarına kadar özeti ve beklentilerimi göndereceğim.", notesTr: "'Kickoff' — projede ilk toplantı; 'brief' — proje özeti." },
    ],
  },

  // ────────── 18. Zor Feedback Verme — Pro ──────────
  {
    slug: "giving-difficult-feedback",
    category: "hr",
    titleEn: "Giving Difficult Feedback to a Peer",
    titleTr: "Meslektaşa Zor Geri Bildirim",
    descriptionTr: "Bir meslektaşın son toplantıda yanlış davranışta bulundu. Yapıcı ama net bir feedback vereceksin.",
    userRoleTr: "Meslektaş",
    counterpartRoleTr: "Diğer Meslektaş",
    difficulty: "B2",
    minPlan: "pro",
    avgDurationMin: 3,
    voice: "nova",
    sortOrder: 18,
    turns: [
      { order: 1, speaker: "ai", textEn: "You mentioned you wanted to talk about the meeting yesterday?", textTr: "Dünkü toplantı hakkında konuşmak istediğinizi söylemiştiniz?" },
      { order: 2, speaker: "user", textEn: "Yes. I noticed you interrupted the client twice, and I'd like to share how it came across.", textTr: "Evet. Müşteriyi iki kez böldüğünüzü fark ettim ve bunun nasıl göründüğünü paylaşmak istiyorum.", notesTr: "SBI modeli: Situation-Behavior-Impact. Objektif kal." },
      { order: 3, speaker: "ai", textEn: "Really? I wasn't aware.", textTr: "Gerçekten mi? Farkında değildim." },
      { order: 4, speaker: "user", textEn: "It made the client hesitate to share more, which limited the conversation.", textTr: "Müşterinin daha fazla paylaşmasını tereddütlü kıldı ve bu konuşmayı sınırladı.", phoneticHint: "'hesitate' — 'he-zi-teyt'. Vurgu ilk hecede." },
      { order: 5, speaker: "ai", textEn: "I appreciate you telling me. I'll be more mindful.", textTr: "Söylediğin için minnettarım. Daha dikkatli olacağım." },
      { order: 6, speaker: "user", textEn: "Thanks for taking it well. Let me know if there's anything I can do to help.", textTr: "İyi karşıladığın için teşekkürler. Yardımcı olabileceğim bir şey olursa haber ver.", notesTr: "Feedback sonrası öneri sunmak = ilişkiyi güçlendirir." },
    ],
  },

  // ────────── 19. Bütçe Onayı İsteme — Pro ──────────
  {
    slug: "finance-requesting-budget-approval",
    category: "finance",
    titleEn: "Requesting Budget Approval",
    titleTr: "Bütçe Onayı İsteme",
    descriptionTr: "Yeni bir girişim için ek bütçe istiyorsun. İş gerekçesini ve ROI'yi net sunacaksın.",
    userRoleTr: "Ürün Müdürü",
    counterpartRoleTr: "CFO",
    difficulty: "B2",
    minPlan: "pro",
    avgDurationMin: 3,
    voice: "onyx",
    sortOrder: 19,
    turns: [
      { order: 1, speaker: "ai", textEn: "You're requesting additional budget. What's the business case?", textTr: "Ek bütçe talep ediyorsunuz. İş gerekçesi ne?" },
      { order: 2, speaker: "user", textEn: "We need fifty thousand to launch a new feature that will boost retention.", textTr: "Bağlılığı arttıracak yeni bir özellik başlatmak için elli bine ihtiyacımız var.", phoneticHint: "'boost' — kısa ve keskin. 'buust'." },
      { order: 3, speaker: "ai", textEn: "What return can we expect?", textTr: "Ne kadar geri dönüş bekleyebiliriz?" },
      { order: 4, speaker: "user", textEn: "Our analysis shows a three-to-one ROI within six months, and higher lifetime value.", textTr: "Analizimiz altı ay içinde 3'e 1 ROI ve daha yüksek yaşam boyu değer gösteriyor.", notesTr: "'Three-to-one' formatı: harcadığın 1 birim başına 3 birim geri dönüş." },
      { order: 5, speaker: "ai", textEn: "How confident are you in those numbers?", textTr: "Bu rakamlara ne kadar güveniyorsunuz?" },
      { order: 6, speaker: "user", textEn: "We validated the assumptions with three customer interviews and a competitor benchmark.", textTr: "Varsayımları üç müşteri görüşmesi ve rakip karşılaştırması ile doğruladık.", notesTr: "'Validated' — teyit etmek, iş dünyasında argümanı sağlamlaştırır." },
    ],
  },

  // ────────── 20. Sunum: Ürün Demo — Pro ──────────
  {
    slug: "presentation-product-demo",
    category: "presentations",
    titleEn: "Presenting a Product Demo",
    titleTr: "Ürün Demo Sunumu",
    descriptionTr: "Potansiyel müşteriye canlı ürün demosu yapıyorsun. Vurgu değer ve kullanım kolaylığında.",
    userRoleTr: "Ürün Danışmanı",
    counterpartRoleTr: "Potansiyel müşteri",
    difficulty: "B2",
    minPlan: "pro",
    avgDurationMin: 4,
    voice: "shimmer",
    sortOrder: 20,
    turns: [
      { order: 1, speaker: "ai", textEn: "Alright, show me what your product can do.", textTr: "Peki, ürününüzün ne yapabileceğini gösterin." },
      { order: 2, speaker: "user", textEn: "Great. Let me start by showing the dashboard, which gives you an overview at a glance.", textTr: "Harika. Size bir bakışta genel görünüm sunan dashboard ile başlayayım.", phoneticHint: "'at a glance' — bir bakışta. 'ıt ı glans'." },
      { order: 3, speaker: "ai", textEn: "That looks clean. What if I need more detail?", textTr: "Temiz görünüyor. Daha fazla detay istersem?" },
      { order: 4, speaker: "user", textEn: "Just click any metric to drill down into the underlying data.", textTr: "Altındaki veriye inmek için herhangi bir metriğe tıklayın.", notesTr: "'Drill down' — detaya inmek. UI sunumlarında sık kullanılır." },
      { order: 5, speaker: "ai", textEn: "Nice. How long does it take to set up?", textTr: "Güzel. Kurulum ne kadar sürüyor?" },
      { order: 6, speaker: "user", textEn: "Most customers are up and running in under an hour, without any coding.", textTr: "Çoğu müşteri bir saatten kısa sürede, kod yazmadan aktif oluyor.", notesTr: "'Up and running' — çalışır durumda. Product jargon'unun temeli." },
    ],
  },
];

export async function seedSpeakingScenes(): Promise<void> {
  try {
    for (const s of SCENES) {
      // Sahne zaten var mı?
      const existRows = await db.execute(sql`
        SELECT id FROM speaking_scenes WHERE slug = ${s.slug} LIMIT 1
      `);
      if ((existRows.rows ?? existRows).length > 0) {
        continue; // idempotent — dokunma
      }

      // Sahneyi ekle
      const inserted = await db.execute(sql`
        INSERT INTO speaking_scenes (
          slug, category, title_en, title_tr, description_tr,
          user_role_tr, counterpart_role_tr,
          difficulty, min_plan, avg_duration_min, voice, sort_order
        ) VALUES (
          ${s.slug}, ${s.category}, ${s.titleEn}, ${s.titleTr}, ${s.descriptionTr},
          ${s.userRoleTr}, ${s.counterpartRoleTr},
          ${s.difficulty}, ${s.minPlan}, ${s.avgDurationMin}, ${s.voice}, ${s.sortOrder}
        )
        RETURNING id
      `);
      const sceneId = ((inserted.rows ?? inserted)[0] as any)?.id;
      if (!sceneId) continue;

      // Turları ekle
      for (const t of s.turns) {
        await db.execute(sql`
          INSERT INTO speaking_scene_turns (
            scene_id, turn_order, speaker, text_en, text_tr, notes_tr, phonetic_hint
          ) VALUES (
            ${sceneId}, ${t.order}, ${t.speaker}, ${t.textEn},
            ${t.textTr ?? null}, ${t.notesTr ?? null}, ${t.phoneticHint ?? null}
          )
        `);
      }

      console.info(`[scenes-seed] eklendi: ${s.slug} (${s.turns.length} tur)`);
    }
    console.info("[scenes-seed] tamamlandı");
  } catch (e: any) {
    console.error("[scenes-seed] HATA:", e?.message);
  }
}
