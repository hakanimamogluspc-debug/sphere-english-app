/**
 * Speaking Scene AI Generator
 *
 * GPT-4o-mini ile speaking role-play sahnesi üretir + DB'ye INACTIVE olarak yazar.
 * Admin panelden edit + publish (is_active=true) ile yayına alınır.
 *
 * generateScene(opts) → tek sahne üretir
 * bulkFillCategory(category, targetTotal) → hedef sayıya ulaşana kadar üretir
 * bulkFillAll(targetPerCategory) → her kategori için hedef kadar
 */

import OpenAI from "openai";
import { pool } from "@workspace/db";

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY yok");
    _openai = new OpenAI({ apiKey });
  }
  return _openai;
}

export const CATEGORIES = [
  "general_business", "meetings", "sales", "negotiation", "presentations",
  "phone_calls", "tech", "hr", "finance", "healthcare",
] as const;

export const CATEGORY_LABEL: Record<string, string> = {
  general_business: "Genel İş İngilizcesi",
  meetings: "Toplantılar",
  sales: "Satış",
  negotiation: "Müzakere",
  presentations: "Sunumlar",
  phone_calls: "Telefon Görüşmeleri",
  tech: "Teknoloji / Yazılım",
  hr: "İnsan Kaynakları",
  finance: "Finans",
  healthcare: "Sağlık",
};

const DIFFICULTIES = ["A2", "B1", "B2", "C1"] as const;
const VOICES = ["nova", "onyx", "shimmer", "echo", "alloy", "fable"] as const;

// Konu havuzları — Türk profesyonellerin gerçek dünyada yaşadığı senaryolar
const SCENE_TOPICS: Record<string, string[]> = {
  general_business: [
    "Yeni katılan expat manager ile tanışma toplantısı",
    "Yurt dışı ofisten gelen misafiri havaalanından karşılama",
    "İstanbul ofisini yabancı bir mühendise tanıtma",
    "Uluslararası bir konferansta iletişim bilgisi alma (LinkedIn ekleme)",
    "Yabancı iş arkadaşına Türk yemek kültürünü kısaca anlatma (öğle yemeği)",
    "Global ekibe Türkiye tatil takvimini açıklama (bayram, resmi tatiller)",
    "Yabancı iş ortağını Boğaz turuna davet etme",
    "Yıllık kick-off toplantısında Türkiye ekibi olarak kısa update",
    "HQ'dan gelen ziyaretçi için toplantı odası hazırlığı",
    "Yeni gelen expat'e Türkiye'de yaşam ipuçları (banka, sim kart, oturma izni)",
    "Global şirket etkinliğinde Türkiye ofisini temsil etme",
    "Ofiste kahve makinesinin bozulduğunu bildirme (havadan sudan sohbet)",
  ],
  meetings: [
    "Alman HQ ile weekly sync — Türkiye ofisi update'i",
    "Timeline gecikmesini expat direktöre açıklama",
    "Amerikan client'e proje status raporu",
    "İngiliz iş ortağının fikrini kibarca reddetme (kültürel hassasiyet)",
    "Global ürün toplantısında yerel Türk pazar dinamiklerini açıklama",
    "Yabancı yöneticiye Türkiye'deki regülasyon farkını anlatma",
    "Toplantı gündeminde konu sapması — konuya döndürme",
    "Çok saatler ötesindeki takıma zaman uygunluğu belirleme",
    "Zoom'da bağlantı sorunu — konuyu tekrarlatma",
    "Bir sonraki adımları netleştirme (action item'lar)",
    "Toplantıyı özetleme ve karar noktalarını doğrulama",
    "Trafikte kaldığın için toplantıya geç kalma özrü (İstanbul!)",
  ],
  sales: [
    "İngiliz alıcıya Türkiye'den tekstil ihracatı için cold call",
    "Alman otomotiv tedarikçisine ürün demo",
    "Amerikan turist grubuna İstanbul otel satışı",
    "Rus/Ukrayna müşteriye sağlık turizmi paketi sunma",
    "Ortadoğulu iş adamına kurumsal danışmanlık pitch",
    "Yurt dışı fuarında ürününüzü tanıtma (Milano/Frankfurt/Dubai fair)",
    "'Türkiye pahalı değil mi?' itirazına karşılık verme",
    "Rakip Uzak Doğu tedarikçilerine karşı kalite avantajını sunma",
    "Yurt dışı e-ticaret müşterisiyle whatsapp'ta satış görüşmesi",
    "Discovery call — enterprise SaaS müşterisi",
    "Follow-up: 3 hafta önce demo yapan alıcıya geri dönüş",
    "Kaybedilen fırsatı yeniden açmaya çalışma",
  ],
  negotiation: [
    "İngiliz alıcı ile ödeme vadesi müzakeresi (60 gün → 30 gün)",
    "Alman tedarikçisiyle fiyat indirimi görüşmesi",
    "İhracat sözleşmesinde teslim tarihi uzatma talebi",
    "Kur farkı riskini müşteriyle paylaşma önerisi (TL vs EUR)",
    "Uzak Doğu tedarikçisiyle MOQ (minimum sipariş) müzakeresi",
    "Sözleşme yenileme — otomatik %5 zam maddesini kaldırma",
    "Uluslararası fuar stand yerini pazarlık",
    "SLA (service level agreement) şartlarını revize etme",
    "Erken ödeme karşılığı %2 indirim önerme",
    "Anlaşmadan çekilme (walk away) — sınırı belirtme",
    "Ortak yatırım (joint venture) ilk temas",
    "Sözlü mutabakatı email ile teyit etme",
  ],
  presentations: [
    "Global yıllık toplantıda Türkiye ekibi performans sunumu",
    "Yabancı yatırımcıya Türk startup pitch (Series A)",
    "Amerikan client'e proje sonuç raporu (deliverable presentation)",
    "Almanya'daki HQ'ya Türkiye pazarı analizi",
    "Q4 tahminlerini CEO'ya sunma",
    "Yeni ürün özelliğini uluslararası müşteriye canlı demo",
    "Zor soru: 'Neden hedeflere ulaşılamadı?' — diplomatik cevap",
    "Sunum sırasında projeksiyon donunca — sözle devam etme",
    "3 dakika executive summary — CFO'ya bütçe talebi",
    "Bir konuyu detaylandırma isteği geldiğinde",
    "Q&A yönetimi — cevaplayamadığın soru geldiğinde",
    "Sunumu kapama — clear call to action",
  ],
  phone_calls: [
    "Yurt dışından arayan müşteriye rezervasyon yapma (otel/tur)",
    "İngiliz müşterinin sipariş takibi araması",
    "Alman tedarikçiye kalite şikayeti bildirme",
    "Yurt dışı bankaya swift ödeme sorgulama",
    "Uluslararası kargo şirketinden paket bilgisi",
    "Yabancı sigorta şirketiyle poliçe sorgulama",
    "Otomatik menüden gerçek insana ulaşma",
    "Sesli mesaj bırakma — profesyonel format",
    "Bağlantı kötü olduğunda tekrarlatma / geri aramayı önerme",
    "Kızgın uluslararası müşteriyle sakin iletişim",
    "Yanlış numara — nazikçe düzeltme",
    "Konuşmayı sonlandırma — sonraki adımları özetleyerek",
  ],
  tech: [
    "İngiliz tech lead'e code review feedback verme",
    "Alman product manager'a bug reprodüksiyon adımlarını anlatma",
    "Amerikan startup'ta sprint planning — story point tahmini",
    "Slack'te asenkron olarak zor bir konsept açıklama (tools/thread)",
    "On-call devir teslim — hangi incident'lar açık",
    "Retro'da 'ne iyi gitmedi' geri bildirimi (kültürlerarası dikkat)",
    "Global ekibe Türkiye'deki timezone (UTC+3) farkını hatırlatma",
    "Yeni framework'e geçiş önerisi (React → Next.js gibi)",
    "Design review — mimari trade-off tartışması",
    "Customer'a teknik konsepti sade dille tercüme",
    "Postmortem toplantısı — root cause anlatımı",
    "Deploy sonrası incident — Slack'te durum güncellemesi",
  ],
  hr: [
    "Yurt dışı merkezli şirketle uzaktan iş görüşmesi",
    "Expat manager ile yıllık performans değerlendirmesi",
    "Terfi talebi — global manager'a case sunumu",
    "Yurt dışı ofise transfer talebi",
    "Onboarding — Türkiye ofisinden ilk hafta feedback (yabancı yeni işe alım)",
    "Maaş görüşmesi — USD/EUR ödeme talebi (kur riski gerekçesi)",
    "İstifa etme — 30 gün notice period bildirme",
    "İş yerinde çatışma — HR'a rapor etme",
    "Uzaktan çalışma / hybrid model müzakeresi",
    "Eğitim bütçesi talebi (yurt dışı sertifika programı)",
    "İşe alım için referans görüşmesi (İngilizce reference check)",
    "Bir hatayı sahiplenme ve nasıl önleyeceğini açıklama",
  ],
  finance: [
    "Alman HQ CFO'ya Türkiye ofisi Q3 sonuçlarını sunma",
    "Yurt dışı yatırımcıya nakit akış tablosu açıklama",
    "Kur farkı zararını executive'e nazikçe iletme",
    "İhracat gelirini USD/EUR olarak muhasebeleştirme müzakeresi",
    "Yeni ERP sistemine geçişte finans süreçlerini tanıtma",
    "Yurt dışı denetim firması ile yıllık audit görüşmesi",
    "Vergi danışmanına Türkiye'deki KDV/stopaj rejimini anlatma (yabancı yatırımcı için)",
    "Banka relationship manager ile kredi limit artışı görüşmesi",
    "Uluslararası ödeme sistemi (Wise/Swift/PayPal) sorunları",
    "Riskli tahsilat — geciken uluslararası müşteriyi arama",
    "M&A due diligence toplantısı — finansal soru cevap",
    "Sigorta yenileme — global broker ile pazarlık",
  ],
  healthcare: [
    "Sağlık turizmi hastası — İstanbul havaalanından karşılama ve klinik yönlendirme",
    "Yabancı hastaya prosedür öncesi bilgilendirme (saç ekimi, diş, estetik)",
    "İngiliz hastaya sigorta kapsamını açıklama (özel sigorta / SGK farkı)",
    "Alman hastaya rapor ve reçete İngilizce açıklama",
    "Post-op follow-up — hastaneden çıkışta hasta ile telefon",
    "Yabancı doktor ile tanı değerlendirmesi (case discussion)",
    "Sağlık turizmi ajansı ile paket satış görüşmesi",
    "Turizm hastanesinde hasta memnuniyet anketi görüşmesi",
    "Acil durumda triyaj — İngilizce hızlı bilgi alma",
    "Aile üyesine hastalık durumunu iletme (empatik ton)",
    "Kliniğinizi uluslararası bir sağlık kongresinde tanıtma",
    "Konsültasyon randevusu ayarlama (yurt dışından arayan hasta)",
  ],
};

const SYSTEM_PROMPT = `Sen Sphere English'in speaking role-play sahne üreticisisin. **TÜRK profesyonelleri** için iş İngilizcesi konuşma pratiği sahneleri üretiyorsun.

═══ HEDEF KİTLE VE BAĞLAM ═══
Kullanıcı: Türkiye'de çalışan bir profesyonel (Ankara, İstanbul, İzmir, Bursa vs.).
İngilizce'yi genelde şu durumlar için öğreniyor:
- Yabancı iş ortağı, tedarikçi, müşteri ile telefon/toplantı/email
- Yurt dışı merkezi olan çok uluslu şirketin Türkiye şubesinde çalışma
- Expat manager veya CEO'ya raporlama
- İhracat / ithalat müzakereleri
- Uluslararası konferans, fuar, teknoloji ekosistemi
- Yurt dışı müşterilere destek / satış / danışmanlık
- Global takımlarla remote çalışma (Slack, Zoom, Jira)

═══ SAHNE OLUŞTURMA KURALLARI ═══
1. **Sahne mutlaka bir Türk profesyonelin yabancı bir tarafla İngilizce konuştuğu durum olmalı**.
   Örn: Türk satış müdürü → Alman müşteri; Türk yazılımcı → İngiliz tech lead; Türk otel müdürü → İngiliz turist müşteri.
2. Türkiye'de yaygın sektörler tercih edilebilir: **finans/bankacılık, otomotiv, tekstil, turizm, sağlık turizmi, teknoloji (startup ekosistemi), inşaat, gıda, e-ticaret, lojistik, tekstil ihracatı, savunma sanayi, telekom**.
3. Şirket / kişi isimleri: karışık kullan — Türk isimleri (Ayşe, Mehmet, Deniz, Selin) + yabancı taraf (Sarah, Michael, Klaus, Anna). Türk şirket adları uydurulabilir (ör: "Karadeniz Textiles", "Yıldız Software", "Bosphorus Logistics").
4. **notesTr** alanında Türklerin sık düştüğü tuzaklara dikkat çek:
   - "I am agree" → "I agree"
   - "I have 30 years old" → "I'm 30 years old"
   - "Turkish way of saying it" ile "how English does it" farkı
   - Nezaket kalıpları: Türkçe direkt tercümesi kaba durur ("You must send" yerine "Could you please send")
   - "Hocam / abi / bey" hitabının İngilizce'de karşılığı olmaması (isim + "sir/ma'am" nadir)
5. Kültürel farklar dahil edilebilir:
   - Türk iş kültürü: ilişki-önce (small talk uzar), hiyerarşi hassasiyeti
   - Yabancı taraf (özellikle Alman/İngiliz/Amerikalı): time-boxed, direkt konuya
   - Kullanıcı iki kültür arasında köprü kurmayı öğrensin
6. Somut Türkiye referansları serpiştir (spam yapmadan): "our Istanbul office", "our HQ in Ankara", "our exports to Germany", "the Q4 numbers from our Bursa plant".

═══ FORMAT (JSON) ═══
{
  "slug": "kebab-case-english-slug",  // benzersiz, açıklayıcı (ör: "meeting-open-agenda")
  "titleEn": "English title (max 60 karakter)",
  "titleTr": "Türkçe başlık (max 70 karakter)",
  "descriptionTr": "1-2 cümle Türkçe açıklama — sahne bağlamı, ton",
  "userRoleTr": "Kullanıcının rolü (2-4 kelime, ör: 'Proje Yöneticisi')",
  "counterpartRoleTr": "Karşı tarafın rolü (2-4 kelime)",
  "avgDurationMin": 3,             // 2-5 dakika
  "voice": "nova",                 // nova/onyx/shimmer/echo/alloy/fable — karakter cinsiyetine uygun
  "turns": [                       // 5-8 tur, AI ile user değişimli
    {
      "order": 1,
      "speaker": "ai",             // ai VEYA user
      "textEn": "İngilizce cümle (doğal, iş bağlamında)",
      "textTr": "Türkçe çeviri",
      "notesTr": "Öğretici not (opsiyonel, kullanıcının turlarında sık) — kalıp/deyim/collocation açıklaması",
      "phoneticHint": "Zor kelime için fonetik ipucu (opsiyonel)"
    }
  ]
}

KURALLAR:
- Sahne AI'nin bir soru veya davetiyle başlar (order:1, speaker:'ai')
- Sıra ai→user→ai→user gider. Toplam 5-8 tur, ilk ve son AI olsun
- User cümleleri seviyeye uygun karmaşıklıkta (A2=basit / C1=akıcı)
- Business English, doğal — kitap gibi değil
- notesTr: kullanıcının turlarında iş jargonu/idiom açıklaması (ör: "'circle back' — sonra dönmek")
- phoneticHint: zor kelime varsa (ör: "'schedule' — İngiliz: 'shed-yool'")
- Türkçe metinlerde "!" yok, samimi ama profesyonel
- slug uniquelenebilir olsun (kategori-difficulty-topic tarzı iyi)`;

type GeneratedScene = {
  slug: string;
  titleEn: string;
  titleTr: string;
  descriptionTr: string;
  userRoleTr: string;
  counterpartRoleTr: string;
  avgDurationMin: number;
  voice: string;
  turns: Array<{
    order: number;
    speaker: "user" | "ai";
    textEn: string;
    textTr?: string;
    notesTr?: string;
    phoneticHint?: string;
  }>;
};

async function callGpt(category: string, difficulty: string, topic: string | null): Promise<GeneratedScene | null> {
  const categoryLabel = CATEGORY_LABEL[category] || category;
  const topicLine = topic ? `\nSpesifik konu: ${topic}` : "";
  const userPrompt = `Kategori: ${categoryLabel}\nSeviye: ${difficulty}${topicLine}\n\nBu kategori + seviye için bir speaking role-play sahne üret.`;

  const res: any = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.6,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
  });
  const raw = res?.choices?.[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw);

  if (!parsed.slug || !parsed.titleEn || !Array.isArray(parsed.turns) || parsed.turns.length < 3) return null;

  // Slug'ı normalize + benzersizleştir suffix ile (kategori kısaltması + hash)
  const slugBase = String(parsed.slug).toLowerCase().replace(/[^a-z0-9\-]/g, "-").replace(/-+/g, "-").slice(0, 60);
  const uniqSlug = `${slugBase}-${category.slice(0, 3)}-${difficulty.toLowerCase()}-${Math.random().toString(36).slice(2, 6)}`;

  const validVoice = VOICES.includes(parsed.voice) ? parsed.voice : "nova";

  return {
    slug: uniqSlug,
    titleEn: String(parsed.titleEn).slice(0, 300),
    titleTr: String(parsed.titleTr ?? parsed.titleEn).slice(0, 300),
    descriptionTr: String(parsed.descriptionTr ?? "").slice(0, 1000),
    userRoleTr: String(parsed.userRoleTr ?? "").slice(0, 200),
    counterpartRoleTr: String(parsed.counterpartRoleTr ?? "").slice(0, 200),
    avgDurationMin: Math.min(10, Math.max(2, Number(parsed.avgDurationMin) || 3)),
    voice: validVoice,
    turns: parsed.turns.slice(0, 10).map((t: any, i: number) => ({
      order: i + 1,
      speaker: t.speaker === "user" ? "user" : "ai",
      textEn: String(t.textEn ?? "").slice(0, 500),
      textTr: t.textTr ? String(t.textTr).slice(0, 500) : undefined,
      notesTr: t.notesTr ? String(t.notesTr).slice(0, 500) : undefined,
      phoneticHint: t.phoneticHint ? String(t.phoneticHint).slice(0, 200) : undefined,
    })).filter((t: any) => t.textEn),
  };
}

export async function generateScene(opts: {
  category: string;
  difficulty: string;
  topic?: string;
  publish?: boolean;
  minPlan?: "free" | "pro";
}): Promise<{ ok: boolean; sceneId?: number; slug?: string; error?: string }> {
  try {
    if (!CATEGORIES.includes(opts.category as any)) return { ok: false, error: "geçersiz kategori" };
    if (!DIFFICULTIES.includes(opts.difficulty as any)) return { ok: false, error: "geçersiz seviye" };

    const scene = await callGpt(opts.category, opts.difficulty, opts.topic ?? null);
    if (!scene) return { ok: false, error: "GPT boş döndü" };

    const isActive = !!opts.publish;
    const minPlan = opts.minPlan || (opts.difficulty === "A2" || opts.difficulty === "B1" ? "free" : "pro");

    // Slug conflict guard
    let finalSlug = scene.slug;
    for (let i = 0; i < 3; i++) {
      const c: any = await pool.query(`SELECT 1 FROM speaking_scenes WHERE slug = $1`, [finalSlug]);
      if (c.rows.length === 0) break;
      finalSlug = `${scene.slug}-${Math.random().toString(36).slice(2, 5)}`;
    }

    const inserted: any = await pool.query(
      `INSERT INTO speaking_scenes
         (slug, category, title_en, title_tr, description_tr,
          user_role_tr, counterpart_role_tr, difficulty, min_plan,
          avg_duration_min, voice, is_active, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 0)
       RETURNING id`,
      [finalSlug, opts.category, scene.titleEn, scene.titleTr, scene.descriptionTr,
       scene.userRoleTr, scene.counterpartRoleTr, opts.difficulty, minPlan,
       scene.avgDurationMin, scene.voice, isActive],
    );
    const sceneId = inserted.rows[0]?.id;
    if (!sceneId) return { ok: false, error: "insert başarısız" };

    for (const t of scene.turns) {
      await pool.query(
        `INSERT INTO speaking_scene_turns
           (scene_id, turn_order, speaker, text_en, text_tr, notes_tr, phonetic_hint)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [sceneId, t.order, t.speaker, t.textEn, t.textTr ?? null, t.notesTr ?? null, t.phoneticHint ?? null],
      );
    }

    return { ok: true, sceneId, slug: finalSlug };
  } catch (e: any) {
    console.error("[scene-generator]", e?.message);
    return { ok: false, error: e?.message };
  }
}

export async function bulkFillCategory(
  category: string, targetTotal: number,
  onProgress?: (msg: string) => void,
): Promise<{ existing: number; created: number; failed: number }> {
  const countRes: any = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE difficulty = 'A2')::int AS a2,
       COUNT(*) FILTER (WHERE difficulty = 'B1')::int AS b1,
       COUNT(*) FILTER (WHERE difficulty = 'B2')::int AS b2,
       COUNT(*) FILTER (WHERE difficulty = 'C1')::int AS c1,
       COUNT(*)::int AS total
     FROM speaking_scenes WHERE category = $1`,
    [category],
  );
  const stats = countRes.rows[0];
  const existing = stats.total;

  // Seviye dağılımı — A2:20% B1:30% B2:30% C1:20%
  const targets = {
    A2: Math.round(targetTotal * 0.2),
    B1: Math.round(targetTotal * 0.3),
    B2: Math.round(targetTotal * 0.3),
    C1: targetTotal - Math.round(targetTotal * 0.2) - Math.round(targetTotal * 0.3) - Math.round(targetTotal * 0.3),
  };

  const topics = SCENE_TOPICS[category] ?? [];
  let created = 0, failed = 0;
  const usedTopics = new Set<number>();

  for (const [level, targetCount] of Object.entries(targets)) {
    const have = stats[level.toLowerCase() as keyof typeof stats] as number;
    const need = Math.max(0, targetCount - have);
    for (let i = 0; i < need; i++) {
      // Yeni topic seç
      let topic: string | undefined;
      if (topics.length > 0) {
        for (let attempt = 0; attempt < 5; attempt++) {
          const idx = Math.floor(Math.random() * topics.length);
          if (!usedTopics.has(idx)) { topic = topics[idx]; usedTopics.add(idx); break; }
        }
        if (!topic) topic = topics[i % topics.length];
      }
      onProgress?.(`${category}/${level} #${i + 1}: ${topic ?? "(random)"}...`);
      const r = await generateScene({ category, difficulty: level, topic, publish: false });
      if (r.ok) created++; else { failed++; onProgress?.(`  hata: ${r.error}`); }
    }
  }

  return { existing, created, failed };
}

export async function bulkFillAll(targetPerCategory: number, onProgress?: (msg: string) => void): Promise<Record<string, { created: number; failed: number }>> {
  const result: Record<string, { created: number; failed: number }> = {};
  for (const cat of CATEGORIES) {
    onProgress?.(`═══ Kategori: ${cat} ═══`);
    const r = await bulkFillCategory(cat, targetPerCategory, onProgress);
    result[cat] = { created: r.created, failed: r.failed };
  }
  return result;
}
