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
