/**
 * Lara ile Ders — başlangıç sahne kütüphanesi.
 *
 * Her ders 4–5 adımdan oluşur. Her adımda:
 *   setupTr  → Lara'nın adımı açarken söylediği Türkçe kurgu (aynen seslendirilir, LLM gerekmez)
 *   goalTr   → ekranda görünen kısa görev ("Ne söylemelisin?")
 *   targets  → öğrencinin ağzından çıkması beklenen İngilizce kalıp(lar); ilki "örnek doğru cevap"
 *   hintTr   → takılırsa Lara'nın vereceği ipucu
 *
 * Seed idempotenttir (slug bazlı). Admin bir dersi düzenlediyse (updated_at > created_at)
 * seed o dersi EZMEZ — sadece eksik dersleri ekler.
 *
 * Ton kuralı: esprili ama hitapsız. "Kızım/canım/hayatım" gibi hitaplar YOK.
 */

import { pool } from "@workspace/db";

export type TutorStep = {
  key: string;
  goalTr: string;
  setupTr: string;
  targets: string[];
  hintTr?: string;
};

export type TutorLessonSeed = {
  slug: string;
  title: string;
  summary: string;
  category: "tanisma" | "toplanti" | "musteri" | "telefon" | "satis" | "sunum" | "ofis";
  levelMin: "A2" | "B1" | "B2";
  levelMax: "B1" | "B2" | "C1";
  sectors: string[]; // boş = herkes
  estMinutes: number;
  introTr: string;
  outroTr: string;
  steps: TutorStep[];
  sortOrder: number;
};

export const TUTOR_LESSONS: TutorLessonSeed[] = [
  {
    slug: "yabanci-musteriye-kendini-tanit",
    title: "Yabancı bir müşteriye kendini tanıt",
    summary: "İlk görüşmede adını, şirketini ve ne iş yaptığını iki üç cümlede söyle.",
    category: "tanisma",
    levelMin: "A2", levelMax: "B2", sectors: [], estMinutes: 6, sortOrder: 10,
    introTr: "Bugün en çok kullanacağın şeyle başlıyoruz: kendini tanıtmak. Online bir toplantıya girdin, karşında yabancı bir müşteri var ve ilk 30 saniye sende. Rahat ol, adım adım gideceğiz.",
    outroTr: "Tebrikler, artık bir görüşmeyi kendinden emin açabilirsin. Bunu bir sonraki gerçek toplantında dene, bakalım müşteri ne kadar etkilenecek.",
    steps: [
      {
        key: "selam-isim",
        goalTr: "Selam ver ve adını söyle.",
        setupTr: "Toplantı başladı, kamera açıldı. Önce selam verip adını söyle. Hadi, İngilizce olarak dene.",
        targets: ["Hi, I'm Ayşe. Nice to meet you.", "Hello, my name is Ayşe. It's nice to meet you."],
        hintTr: "İpucu: \"Hi, I'm …\" ile başla, sonuna \"Nice to meet you\" ekle.",
      },
      {
        key: "sirket-rol",
        goalTr: "Hangi şirkette ve hangi pozisyonda çalıştığını söyle.",
        setupTr: "Güzel. Şimdi nerede çalıştığını ve görevini ekle. Örneğin satış müdürüysen bunu tek cümlede söyle.",
        targets: ["I work at ABC Foods as a sales manager.", "I'm the sales manager at ABC Foods."],
        hintTr: "İpucu: \"I work at [şirket] as a [pozisyon].\" Pozisyonun önündeki \"a\"yı unutma.",
      },
      {
        key: "sorumluluk",
        goalTr: "Ne iş yaptığını bir cümleyle anlat.",
        setupTr: "Müşteri seni tanımak istiyor ama hayat hikâyeni değil. Asıl sorumluluğunu tek cümleyle anlat.",
        targets: ["I'm responsible for our export customers in Europe.", "I look after our international customers."],
        hintTr: "İpucu: \"I'm responsible for …\" ya da \"I look after …\". \"Responsible\"dan sonra \"for\" gelir, \"of\" değil.",
      },
      {
        key: "gundeme-gecis",
        goalTr: "Toplantının amacına geçiş yap.",
        setupTr: "Tanışma tamam. Şimdi kibarca konuya geç: bugün ne konuşacağınızı söyle.",
        targets: ["Today I'd like to talk about our new product range.", "Shall we start with today's agenda?"],
        hintTr: "İpucu: \"Today I'd like to talk about …\" kibar ve net bir geçiştir.",
      },
    ],
  },
  {
    slug: "toplantida-soz-al",
    title: "Toplantıda söz al ve fikrini söyle",
    summary: "Kibarca araya gir, fikrini söyle, katılmadığın yerde nazikçe itiraz et.",
    category: "toplanti",
    levelMin: "A2", levelMax: "C1", sectors: [], estMinutes: 7, sortOrder: 20,
    introTr: "Toplantıda fikrin var ama söz almak zor geliyor, değil mi? Bugün bunu çözüyoruz. Araya girmenin kaba olmayan bir yolu var, onu öğreneceğiz.",
    outroTr: "Harika iş. Artık toplantıda sessizce oturmak yok. Bir sonraki toplantıda en az bir kez söz almayı hedefle.",
    steps: [
      {
        key: "araya-gir",
        goalTr: "Konuşanı kırmadan söz iste.",
        setupTr: "Biri konuşuyor, sen de bir şey eklemek istiyorsun. Kibarca söz iste.",
        targets: ["Sorry to interrupt, could I add something?", "Can I just jump in here?"],
        hintTr: "İpucu: \"Sorry to interrupt, could I …?\" kibar ve güvenli bir başlangıç.",
      },
      {
        key: "fikir-soyle",
        goalTr: "Fikrini yumuşak bir girişle söyle.",
        setupTr: "Söz sende. Şimdi fikrini söyle, ama \"bence\"yi İngilizce kibarca kur.",
        targets: ["In my opinion, we should launch next month.", "I think we should focus on the European market first."],
        hintTr: "İpucu: \"In my opinion, we should …\" ya da \"I think we should …\".",
      },
      {
        key: "nazik-itiraz",
        goalTr: "Katılmadığını nazikçe söyle.",
        setupTr: "Bir meslektaşın farklı bir öneri getirdi ve sen katılmıyorsun. Ama kimse alınmasın. Nazikçe itiraz et.",
        targets: ["I see your point, but I'm not sure that will work.", "I understand, but I see it a bit differently."],
        hintTr: "İpucu: Önce karşı tarafı onayla (\"I see your point\"), sonra \"but\" ile kendi görüşüne geç.",
      },
      {
        key: "netlestir",
        goalTr: "Anlamadığın bir noktayı sor.",
        setupTr: "Biri bir rakam söyledi ama tam anlamadın. Tekrar etmesini ya da açıklamasını iste.",
        targets: ["Sorry, could you clarify what you mean by that?", "Could you say that again, please?"],
        hintTr: "İpucu: \"Could you clarify …?\" anlamadığını profesyonelce söylemenin yolu.",
      },
    ],
  },
  {
    slug: "musteriye-gecikme-bildir",
    title: "Müşteriye sevkiyat gecikmesini bildir",
    summary: "Kötü haberi net ver, özür dile, yeni tarihi ve çözümü söyle.",
    category: "musteri",
    levelMin: "A2", levelMax: "C1", sectors: ["export", "logistics", "manufacturing", "food"], estMinutes: 7, sortOrder: 30,
    introTr: "Bugün kimsenin sevmediği bir an: müşteriye siparişinin gecikeceğini söylemek. İyi haber şu, doğru cümlelerle bu konuşma güven bile kazandırabilir.",
    outroTr: "Çok iyiydi. Kötü haberi net verdin, sorumluluk aldın ve çözüm sundun. Müşteriler en çok bunu hatırlar.",
    steps: [
      {
        key: "haberi-ver",
        goalTr: "Gecikmeyi dolandırmadan söyle.",
        setupTr: "Müşteriyi aradın. Lafı dolandırmadan siparişin gecikeceğini söyle.",
        targets: ["I'm afraid your order will be delayed.", "Unfortunately, there will be a delay with your shipment."],
        hintTr: "İpucu: \"I'm afraid …\" kötü haberi yumuşatan klasik giriştir.",
      },
      {
        key: "sebep",
        goalTr: "Kısa bir sebep söyle.",
        setupTr: "Müşteri tabii ki nedenini soruyor. Kısa ve dürüst bir sebep ver, örneğin limandaki yoğunluk.",
        targets: ["This is because of heavy congestion at the port.", "The delay is due to a problem with our supplier."],
        hintTr: "İpucu: \"The delay is due to …\". \"Due to\"dan sonra isim gelir.",
      },
      {
        key: "ozur",
        goalTr: "Sorumluluk alarak özür dile.",
        setupTr: "Şimdi özür dileme zamanı, ama \"sorry sorry\" diye değil. Profesyonelce özür dile.",
        targets: ["We sincerely apologize for the inconvenience.", "I'm really sorry for any inconvenience this may cause."],
        hintTr: "İpucu: \"We apologize for the inconvenience.\" Apologize'dan sonra \"for\" gelir.",
      },
      {
        key: "yeni-tarih",
        goalTr: "Yeni teslim tarihini söyle.",
        setupTr: "Müşteri asıl şunu merak ediyor: ne zaman gelecek? Yeni tarihi söyle.",
        targets: ["The new delivery date is March 15th.", "We expect the goods to arrive by Friday."],
        hintTr: "İpucu: \"We expect the goods to arrive by …\". \"By\" \"en geç\" anlamı verir.",
      },
      {
        key: "cozum",
        goalTr: "Bir çözüm ya da jest öner.",
        setupTr: "Son olarak durumu toparla: bir çözüm ya da küçük bir jest öner ve gelişmeleri bildireceğini söyle.",
        targets: ["We can offer you free shipping on your next order.", "I'll keep you updated on the progress."],
        hintTr: "İpucu: \"I'll keep you updated\" müşteriyi rahatlatan sihirli cümle.",
      },
    ],
  },
  {
    slug: "fiyat-ve-indirim-talebi",
    title: "Fiyat sorusunu ve indirim talebini karşıla",
    summary: "Fiyatı söyle, değerini anlat, indirim talebine hemen evet demeden cevap ver.",
    category: "satis",
    levelMin: "B1", levelMax: "C1", sectors: [], estMinutes: 8, sortOrder: 40,
    introTr: "Satışın en heyecanlı anı: fiyat. Müşteri \"How much?\" dediğinde paniğe gerek yok. Bugün fiyatı söylemeyi ve indirimi hemen vermemeyi çalışacağız.",
    outroTr: "Pazarlıkta elin güçlendi. Fiyatı söyledin, değerini anlattın ve indirimi karşılıksız vermedin.",
    steps: [
      {
        key: "fiyat-soyle",
        goalTr: "Birim fiyatı net söyle.",
        setupTr: "Müşteri fiyat sordu. Birim fiyatı net bir cümleyle söyle, örneğin kilosu 4 euro.",
        targets: ["The price is 4 euros per kilo.", "It costs 4 euros per kilogram."],
        hintTr: "İpucu: \"The price is … per …\". \"Per\" \"başına\" demek.",
      },
      {
        key: "deger",
        goalTr: "Fiyatın neye dahil olduğunu söyle.",
        setupTr: "Fiyatı söyledin, şimdi değerini anlat. Fiyata nelerin dahil olduğunu söyle.",
        targets: ["This price includes packaging and insurance.", "That includes delivery to your warehouse."],
        hintTr: "İpucu: \"This price includes …\".",
      },
      {
        key: "indirim-talebi",
        goalTr: "İndirim talebine hemen evet deme, şart koş.",
        setupTr: "Müşteri indirim istedi. Hemen evet deme. İndirimi daha büyük bir siparişe bağla.",
        targets: ["We could offer a discount if you order more than ten tons.", "If you increase the volume, we can look at the price."],
        hintTr: "İpucu: \"We could offer a discount if you …\". Koşul cümlesi pazarlıkta en iyi arkadaşın.",
      },
      {
        key: "kapanis",
        goalTr: "Bir sonraki adımı öner.",
        setupTr: "Konuşmayı açık bırakma. Teklifi yazılı göndereceğini ve ne zaman döneceğini söyle.",
        targets: ["I'll send you a written offer by tomorrow.", "Let me send you the details and we can talk again on Monday."],
        hintTr: "İpucu: \"I'll send you … by tomorrow.\"",
      },
    ],
  },
  {
    slug: "telefonda-tedarikci",
    title: "Telefonda yabancı bir tedarikçiyle konuş",
    summary: "Kendini tanıt, anlamadığında tekrar iste, kelimeyi harf harf kontrol et.",
    category: "telefon",
    levelMin: "A2", levelMax: "B2", sectors: [], estMinutes: 6, sortOrder: 50,
    introTr: "Telefon, İngilizcenin en zor hâli. Yüz yok, jest yok, bir de karşıdaki hızlı konuşuyor. Bugün telefonda hayatta kalma cümlelerini çalışıyoruz.",
    outroTr: "Süper. Artık telefon çaldığında kalbin eskisi kadar hızlı atmayacak.",
    steps: [
      {
        key: "acilis",
        goalTr: "Kim olduğunu ve neden aradığını söyle.",
        setupTr: "Tedarikçiyi aradın, telefon açıldı. Kim olduğunu ve neden aradığını söyle.",
        targets: ["Hi, this is Mehmet from ABC Foods. I'm calling about our last order.", "Hello, this is Mehmet calling from ABC Foods."],
        hintTr: "İpucu: Telefonda \"I am\" değil \"This is …\" denir.",
      },
      {
        key: "tekrar-iste",
        goalTr: "Hızlı konuşan karşı tarafa tekrar etmesini söyle.",
        setupTr: "Karşı taraf çok hızlı konuştu, hiçbir şey anlamadın. Kibarca tekrar etmesini ve yavaş konuşmasını iste.",
        targets: ["Sorry, could you repeat that more slowly, please?", "Could you speak a little more slowly, please?"],
        hintTr: "İpucu: \"Could you repeat that more slowly, please?\"",
      },
      {
        key: "harf-harf",
        goalTr: "Bir ismi harf harf kontrol et.",
        setupTr: "Sana bir isim söyledi ama yazımından emin değilsin. Harf harf söylemesini iste.",
        targets: ["Could you spell that for me, please?", "How do you spell that, please?"],
        hintTr: "İpucu: \"Could you spell that for me?\"",
      },
      {
        key: "teyit",
        goalTr: "Anladığını özetleyerek teyit et.",
        setupTr: "Görüşme bitiyor. Anladığını özetleyerek teyit et, örneğin malların salı günü yola çıkacağını.",
        targets: ["So, just to confirm, the goods will ship on Tuesday.", "Let me check: you'll send the invoice today, right?"],
        hintTr: "İpucu: \"Just to confirm, …\" yanlış anlaşılmayı önler.",
      },
    ],
  },
  {
    slug: "toplanti-ayarla",
    title: "Toplantı ayarla ve saati teyit et",
    summary: "Toplantı öner, uygun saati sor, saat farkını netleştir.",
    category: "ofis",
    levelMin: "A2", levelMax: "B2", sectors: [], estMinutes: 5, sortOrder: 60,
    introTr: "Bugün kısa ama her hafta işine yarayacak bir ders: toplantı ayarlamak. Bir de saat farkı var tabii, o işi karıştırır, onu da çözeceğiz.",
    outroTr: "Tamamdır. Takvim artık senin kontrolünde.",
    steps: [
      {
        key: "oneri",
        goalTr: "Bir toplantı öner.",
        setupTr: "Yabancı bir iş ortağıyla görüşmen gerekiyor. Gelecek hafta bir görüşme öner.",
        targets: ["Could we schedule a call next week?", "Would you be available for a meeting next week?"],
        hintTr: "İpucu: \"Could we schedule a call …?\"",
      },
      {
        key: "uygunluk",
        goalTr: "Uygun gün ve saati sor.",
        setupTr: "Kabul etti. Şimdi hangi gün ve saatin ona uyduğunu sor.",
        targets: ["What day and time works best for you?", "When would suit you?"],
        hintTr: "İpucu: \"What time works best for you?\"",
      },
      {
        key: "saat-farki",
        goalTr: "Saat dilimini netleştir.",
        setupTr: "Salı saat üç dedi ama hangi saatle? Türkiye saatiyle mi, onun saatiyle mi? Netleştir.",
        targets: ["Is that 3 p.m. your time or Turkish time?", "Just to check, which time zone is that?"],
        hintTr: "İpucu: \"Is that 3 p.m. your time?\"",
      },
      {
        key: "davet",
        goalTr: "Davet göndereceğini söyle.",
        setupTr: "Son adım: takvim davetini göndereceğini söyle.",
        targets: ["Great, I'll send you a calendar invite.", "Perfect, I'll send the invitation with the link."],
        hintTr: "İpucu: \"I'll send you a calendar invite.\"",
      },
    ],
  },
  {
    slug: "nazikce-hayir-de",
    title: "İş yerinde nazikçe \"hayır\" de",
    summary: "Ek işi kibarca reddet, alternatif öner, ilişkiyi koru.",
    category: "ofis",
    levelMin: "B1", levelMax: "C1", sectors: [], estMinutes: 6, sortOrder: 70,
    introTr: "\"No\" İngilizcedeki en kısa ve en tehlikeli kelimelerden biri. Tek başına söylersen biraz sert durur. Bugün hayır demeyi ama yumuşak demeyi öğreniyoruz.",
    outroTr: "Mükemmel. Hem sınırını korudun hem ilişkini. İkisini aynı anda yapmak gerçek bir beceri.",
    steps: [
      {
        key: "tesekkur",
        goalTr: "Teklif için teşekkür et.",
        setupTr: "Yöneticin cuma akşamına yeni bir rapor istedi ama yetişmesi imkânsız. Önce teşekkür et ya da talebi onayla.",
        targets: ["Thanks for thinking of me.", "I appreciate you asking me."],
        hintTr: "İpucu: \"Thanks for thinking of me\" reddin önünü yumuşatır.",
      },
      {
        key: "reddet",
        goalTr: "Neden yapamayacağını söyle.",
        setupTr: "Şimdi neden yetiştiremeyeceğini kibarca söyle.",
        targets: ["Unfortunately, I won't be able to finish it by Friday.", "I'm afraid my plate is full this week."],
        hintTr: "İpucu: \"I won't be able to …\" düz \"I can't\"ten daha profesyonel durur.",
      },
      {
        key: "alternatif",
        goalTr: "Bir alternatif öner.",
        setupTr: "Kapıyı tamamen kapatma. Bir alternatif öner, örneğin pazartesi teslim ya da birinin yardımı.",
        targets: ["Could I send it to you on Monday instead?", "Would it help if I prepared a short version by Friday?"],
        hintTr: "İpucu: \"Could I … instead?\"",
      },
    ],
  },
  {
    slug: "musteri-sikayeti-karsila",
    title: "Müşteri şikâyetini karşıla",
    summary: "Dinle, empati kur, çözüm ve takip sözü ver.",
    category: "musteri",
    levelMin: "A2", levelMax: "C1", sectors: [], estMinutes: 7, sortOrder: 80,
    introTr: "Müşteri sinirli ve sesi biraz yüksek. Bugün sakin kalıp durumu toparlamayı çalışıyoruz. Doğru cümleler yangını söndürür.",
    outroTr: "Çok profesyonel bir konuşmaydı. Sinirli müşteriyi sadık müşteriye çevirmenin yolu tam olarak buydu.",
    steps: [
      {
        key: "empati",
        goalTr: "Müşteriyi anladığını göster.",
        setupTr: "Müşteri yanlış ürün geldiği için şikâyet ediyor. Önce onu anladığını göster.",
        targets: ["I completely understand how frustrating this must be.", "I'm sorry to hear that. I understand your concern."],
        hintTr: "İpucu: \"I understand how frustrating this must be.\"",
      },
      {
        key: "detay",
        goalTr: "Sipariş bilgisini iste.",
        setupTr: "Durumu çözmek için bilgi lazım. Sipariş numarasını iste.",
        targets: ["Could you give me your order number, please?", "Can I have your order number so I can check?"],
        hintTr: "İpucu: \"Could you give me your order number, please?\"",
      },
      {
        key: "cozum",
        goalTr: "Bir çözüm sun.",
        setupTr: "Hata sizden kaynaklanmış. Doğru ürünü hemen göndereceğini söyle.",
        targets: ["We'll send you the correct product today, free of charge.", "I'll arrange a replacement right away."],
        hintTr: "İpucu: \"I'll arrange a replacement right away.\"",
      },
      {
        key: "takip",
        goalTr: "Takip sözü ver.",
        setupTr: "Kapanışta müşteriye kargo bilgisini ileteceğini söyle ve teşekkür et.",
        targets: ["I'll email you the tracking number as soon as it ships.", "Thank you for your patience. I'll keep you posted."],
        hintTr: "İpucu: \"Thank you for your patience.\"",
      },
    ],
  },
  {
    slug: "kisa-sunum-acilisi",
    title: "Kısa bir sunuma giriş yap",
    summary: "Dinleyiciyi selamla, konuyu ve akışı söyle, soruları ne zaman alacağını belirt.",
    category: "sunum",
    levelMin: "B1", levelMax: "C1", sectors: [], estMinutes: 6, sortOrder: 90,
    introTr: "Sunumun ilk bir dakikası her şeydir. Orayı sağlam açarsan gerisi akar. Bugün bir sunumun açılışını birlikte kuruyoruz.",
    outroTr: "Harika bir açılıştı. Bunu bir de Sunum Simülatörü'nde tam sunumla dene.",
    steps: [
      {
        key: "selam",
        goalTr: "Dinleyicileri selamla.",
        setupTr: "Sahne senin. Dinleyicileri selamla ve geldikleri için teşekkür et.",
        targets: ["Good morning, everyone. Thank you for coming.", "Hello everyone, thanks for joining today."],
        hintTr: "İpucu: \"Thank you for coming / for joining.\"",
      },
      {
        key: "konu",
        goalTr: "Sunumun konusunu söyle.",
        setupTr: "Şimdi bugün neyi anlatacağını tek cümlede söyle.",
        targets: ["Today I'm going to talk about our sales results for this quarter.", "The purpose of this presentation is to show our new strategy."],
        hintTr: "İpucu: \"Today I'm going to talk about …\"",
      },
      {
        key: "akis",
        goalTr: "Sunumun akışını anlat.",
        setupTr: "Dinleyici yol haritası ister. Sunumu kaç bölüme ayırdığını söyle.",
        targets: ["I've divided my presentation into three parts.", "First, I'll look at the numbers, then I'll talk about next steps."],
        hintTr: "İpucu: \"I've divided my presentation into three parts.\"",
      },
      {
        key: "sorular",
        goalTr: "Soruları ne zaman alacağını söyle.",
        setupTr: "Son olarak soruları ne zaman alacağını söyle.",
        targets: ["I'll be happy to take your questions at the end.", "Please feel free to ask questions at any time."],
        hintTr: "İpucu: \"I'll be happy to take questions at the end.\"",
      },
    ],
  },
];

/**
 * Açılışta çalışır. Olmayan dersi ekler; admin hiç dokunmadıysa (updated_at = created_at)
 * içeriği seed'deki son hâline günceller; admin düzenlediyse dokunmaz.
 */
export async function seedTutorLessons(): Promise<void> {
  try {
    let inserted = 0;
    let refreshed = 0;
    for (const l of TUTOR_LESSONS) {
      const ins = await pool.query(
        `INSERT INTO tutor_lessons (slug, title, summary, category, level_min, level_max, sectors, est_minutes, intro_tr, outro_tr, steps, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12)
         ON CONFLICT (slug) DO NOTHING`,
        [l.slug, l.title, l.summary, l.category, l.levelMin, l.levelMax, l.sectors, l.estMinutes, l.introTr, l.outroTr, JSON.stringify(l.steps), l.sortOrder],
      );
      if ((ins.rowCount ?? 0) > 0) { inserted++; continue; }
      const upd = await pool.query(
        `UPDATE tutor_lessons
            SET title=$2, summary=$3, category=$4, level_min=$5, level_max=$6, sectors=$7, est_minutes=$8,
                intro_tr=$9, outro_tr=$10, steps=$11::jsonb, sort_order=$12
          WHERE slug=$1 AND updated_at = created_at
            AND (title IS DISTINCT FROM $2 OR steps IS DISTINCT FROM $11::jsonb OR intro_tr IS DISTINCT FROM $9 OR outro_tr IS DISTINCT FROM $10 OR summary IS DISTINCT FROM $3)`,
        [l.slug, l.title, l.summary, l.category, l.levelMin, l.levelMax, l.sectors, l.estMinutes, l.introTr, l.outroTr, JSON.stringify(l.steps), l.sortOrder],
      );
      refreshed += upd.rowCount ?? 0;
    }
    if (inserted || refreshed) console.info(`[tutor-lessons] seed: ${inserted} eklendi, ${refreshed} güncellendi`);
  } catch (e: any) {
    console.warn("[tutor-lessons] seed atlandı:", e?.message);
  }
}
