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

const SCENE_TOPICS: Record<string, string[]> = {
  general_business: [
    "Yeni iş arkadaşıyla tanışma", "Kahve molasında small talk", "Ekibe yeni katılan birini tanıştırma",
    "Ofiste yön tarifi verme", "Öğle yemeği daveti", "Doğum günü kutlaması organizasyonu",
    "İş yerinde küçük bir ricayı iletme", "Eşyayı ödünç alma", "Toplantı odası ayırtma",
    "Kişisel gelişim hedefini paylaşma", "İzin talebi hakkında konuşma", "Yaklaşan tatil planlarını paylaşma",
  ],
  meetings: [
    "Toplantıyı açma ve gündemi paylaşma", "Fikri kibarca reddetme", "Söz alma ve fikir sunma",
    "Anlamadığın bir noktayı sorma", "Toplantıyı özetleme ve action item'lar", "Zamanı yönetme (konuya dönme)",
    "Farklı görüşleri uzlaştırma", "Karar alma (oylama)", "Sonraki adımları netleştirme",
    "Toplantıyı erteleme", "Bir konuyu bir sonraki toplantıya erteleme", "Toplantıya geç kalma özrü",
  ],
  sales: [
    "Cold call — ilk temas", "Discovery call — ihtiyaç analizi", "Demo yapma",
    "Fiyat sunma ve gerekçelendirme", "İtirazları karşılama (fiyat pahalı)", "Rakip karşılaştırması",
    "ROI sunumu", "Kapama denemesi (close)", "Follow-up email yerine telefon",
    "Referans arama", "Yeni kararverici bulma", "Kaybedilen fırsat için son teklif",
  ],
  negotiation: [
    "Fiyat müzakeresi — indirim isteme", "Sözleşme şartlarını müzakere etme", "Teslim tarihi uzatma talebi",
    "Kapsam değişikliği için ek ücret", "Ödeme koşulu müzakeresi", "Erken kapama teklifi",
    "İki tarafın çıkarını dengeleme", "Sınırı belirtme (walk away)", "Kazanılan konsesyonlar",
    "Alternatif teklifler önerme", "Sözlü mutabakatı yazıya döktürme", "Uzlaşmayı bitiriş cümlesi",
  ],
  presentations: [
    "Sunumu açma — dikkat çekme", "Gündem paylaşma", "Grafik anlatma",
    "Veriyi hikaye ile bağlama", "Zor soru geldiğinde", "Zaman aşımı — hızlanma",
    "Sunumu kapama — call to action", "Q&A yönetimi", "Teknik sorun (proj. çalışmıyor)",
    "İzleyicinin ilgisini geri kazanma", "Detaya inme talebi", "Sunumu birlikte yapma (co-presenting)",
  ],
  phone_calls: [
    "Toplantı rezervasyonu yapma", "Rezervasyonu iptal etme", "Yanlış numaraya düşme",
    "Sesli mesaj bırakma", "Bağlantı kötü olduğunda", "Otomatik menüde işlem",
    "Şikayet iletme", "Randevu değiştirme", "Faturayla ilgili soru",
    "Yeni müşteri temsilcisine transfer", "Konuşmayı kısaltma isteği", "Ödeme talimatı bilgisi alma",
  ],
  tech: [
    "Bug raporlama (destek)", "Feature request iletme", "Deploy sonrası incident bildirme",
    "Product roadmap tartışma", "Code review geri bildirimi verme", "Sprint planning'de tahmin verme",
    "Retro'da açık geri bildirim", "Yeni bir teknolojiye geçiş önerme", "On-call devir teslim",
    "Müşteri tekniği talep etti — tercüme", "Design review'da alternatif önerme", "Postmortem toplantısı",
  ],
  hr: [
    "İş görüşmesi — kendini tanıtma", "Maaş görüşmesi", "Yıllık performans değerlendirmesi",
    "İşe alım referans görüşmesi", "İşten ayrılma bildirimi", "Terfi görüşmesi",
    "İş yerinde çatışma çözme", "Uzaktan çalışma talebi", "Onboarding — ilk hafta",
    "Bir hatayı sahiplenme", "Eğitim talep etme", "İşten çıkarma toplantısı — nazik ton",
  ],
  finance: [
    "Bütçe onayı isteme", "Aylık finansal rapor sunma", "Yatırım toplantısında pitch",
    "Nakit akış sıkıntısını CEO'ya iletme", "Denetçilerle sohbet", "Yeni banka ilişkisi başlatma",
    "Fatura ödeme takibi", "Vergi danışmanı ile görüşme", "Riskli borçluyla telefon",
    "Şirket satın alma müzakereleri", "Kredi başvurusu görüşmesi", "Sigorta poliçesi yenileme",
  ],
  healthcare: [
    "Hasta ile randevu alma", "Şikayet dinleme", "Ağrı seviyesini sorma",
    "İlaç yan etkilerini açıklama", "Tanı sonucunu iletme", "Cerrahi öncesi bilgilendirme",
    "Sigorta kapsamı açıklama", "İkinci görüş önerme", "Aile üyesine bilgi verme",
    "Randevuyu erteleme talebi", "Reçete yenileme telefonu", "Acil durum triyajı",
  ],
};

const SYSTEM_PROMPT = `Sen Sphere English'in speaking role-play sahne üreticisisin. Türk profesyonelleri için iş İngilizcesi konuşma pratiği sahneleri üretiyorsun.

FORMAT (JSON):
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
