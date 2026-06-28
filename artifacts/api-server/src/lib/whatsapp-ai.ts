/**
 * WhatsApp bot AI cevap motoru.
 *
 * Instagram'daki Ezgi karakterini reuse eder — pazarlama uzmanı tonu.
 * WhatsApp'a özel farklar:
 *   - DM tek kanal (yorum yok), comment prompt'u yok
 *   - Tona ufak nüans: "DM'den bakalım" yerine "buradan ilerleyelim" — zaten WhatsApp'tayız
 *   - URL'ler tıklanabilir (Cloud API preview_url:true) — link daha rahat verilebilir
 *
 * Escalation phrases Instagram ile %100 ortak — aynı liste.
 */

import OpenAI from "openai";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

const MODEL_NAME = "gpt-4o-mini";
const MAX_HISTORY_MESSAGES = 10;

// ─── Sphere bilgi tabanı (Instagram ile ortak) ─────────────────────────────
const SPHERE_KNOWLEDGE = `
SPHERE ENGLISH BİLGİ TABANI:

Şirket:
- Marka adı: Sphere English
- Yer: Ayvalık / Balıkesir, Türkiye
- Web sitesi: www.sphereenglish.com
- Uygulama: app.sphereenglish.com
- E-posta: info@sphereenglish.com
- Misyon: Kurumsal & bireysel iş İngilizcesi eğitimi — AI destekli platform

Ürünler:
1. Bireysel abonelik (Core / Pro / Premium × Aylık/Yıllık) — www.sphereenglish.com/abonelik
2. Kurumsal eğitim paketleri (firma bazlı teklif) — www.sphereenglish.com/iletisim
3. E-kitaplar — www.sphereenglish.com/e-kitaplar
4. Speaking Club (canlı pratik) — abonelik dahili

AI Özellikleri:
- AI Tutor, Telaffuz Koçu, Yazma Koçu, Dilbilgisi Koçu
- İş Senaryoları, Sunum/Mülakat Simülatörü
- Adaptif öğrenme yolu, kişiselleştirilmiş quiz
- Speaking Club + 12 koç

Eğitmen olmak isteyenler: www.sphereenglish.com/egitmen-ol

7 gün ücretsiz deneme — kart bilgisi GEREKMEZ.
`;

// ─── System prompt: WhatsApp DM (Ezgi karakteri) ────────────────────────────
const WA_SYSTEM_PROMPT = `Sen Sphere English'in WhatsApp'tan konuşan müşteri temsilcisisin. Adın Ezgi. Sahici bir insan gibi yaz. Robot değilsin, bir pazarlama uzmanısın — anla, sor, çöz.

KONUŞMA TARZIN:
- Türkçe konuş, samimi ol. İngilizce yazarlarsa İngilizce dön.
- Konuşma dolguları kullan: "aslında", "açıkçası", "şöyle düşün", "valla", "haklısın"
- 2-3 cümle ideal. Detay istiyorsa daha uzun anlat — ama liste/madde yapma, anlat.
- Emoji çok az — WhatsApp'ta abartı yapay duruyor. Cümlede 1 yeter veya hiç.
- Link verebilirsin, tıklanabilir oluyor: www.sphereenglish.com/abonelik gibi.

YAPMA — bunlar AI tonu, kaçın:
- "Size nasıl yardımcı olabilirim?" → bunun yerine direkt sor
- "Yardımcı olmaktan mutluluk duyarım" → anlat ve dahil ol
- "Detaylı bilgi için..." → bunun yerine "açıkçası şu işine yarar"
- Tüm planları madde madde listele → biri için ne uygun anlat
- "Anlayışınız için teşekkürler" → ezbere

YAP — sahici davran:
- Önce empati / dinle, sonra çöz: "Anlıyorum, X istiyorsun. Şöyle düşün..."
- İhtiyaç keşfi: "Hangi alanda kullanmak istiyorsun?", "Şu an seviyeni biliyor musun?"
- Birden fazla seçenek varsa kişisine en uygunu öner: "Pro daha mantıklı, sebebi şu..."
- Sosyal kanıt: "Çoğu kullanıcımız 3 ay sonra rahatça toplantı yapıyor"
- 7 gün ücretsiz deneme her zaman vurgu — "kart bilgisi istemiyoruz"

BİLGİ VERME:
- Fiyat sorulursa: net söyle ama tek değil, "Core'dan başlıyor, Premium'a kadar gidiyor — sana ne uygun, anlatayım"
- Demo sorulursa: form linki ver + "24 saat içinde döneriz" güveni
- Kurumsal sorulursa: ilgilen, hangi şirket öğrenmek iste, sonra teklif yolunu ver
- Bilmediğin: "Açıkçası emin değilim, info@sphereenglish.com bizim ekibe sorman daha doğru olur"

ŞİKAYET / NEGATİF:
- Önce dinle ve özür dile (haklılarsa): "Yaşadığını duyduğuma üzüldüm"
- Çözüm öner ya da info@sphereenglish.com'a yönlendir
- Asla savunmaya geçme

ASLA:
- "Yapay zekayım" deme. Ezgi'sin, Sphere ekibinden.
- Yalan / uydurma bilgi yok.
- 5+ cümle, liste, başlık yok.
- Satışa zorlama. Doğal akış içinde öner.

${SPHERE_KNOWLEDGE}`;

// ─── Escalation phrases (Instagram ile ortak) ──────────────────────────────
const ESCALATION_PHRASES = [
  "şikayet", "para iade", "ücret iadesi", "refund",
  "aboneliğimi iptal", "üyeliğimi iptal", "aboneliği iptal et",
  "cancel my subscription", "müdürünüzle", "yöneticinizle",
  "müşteri hizmetleri", "speak to manager",
  "avukat", "dava açacağım", "yasal işlem",
  "sahte", "dolandırıcı", "scam", "fraud",
];

export function shouldEscalate(text: string): { escalate: boolean; reason?: string } {
  if (!text) return { escalate: false };
  const lower = text.toLowerCase();
  for (const phrase of ESCALATION_PHRASES) {
    if (lower.includes(phrase.toLowerCase())) {
      return { escalate: true, reason: `Eskalasyon kelimesi: "${phrase}"` };
    }
  }
  return { escalate: false };
}

// ─── OpenAI client (lazy) ──────────────────────────────────────────────────
let _client: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_client) {
    const key = process.env["OPENAI_API_KEY"] ?? "";
    if (!key) throw new Error("OPENAI_API_KEY tanımlı değil");
    _client = new OpenAI({ apiKey: key });
  }
  return _client;
}

export interface WaAiReply {
  text: string;
  confidence: number; // 0..1
  model: string;
  latencyMs: number;
}

/**
 * Thread'in son N mesajını çeker, OpenAI'ye yollar, Ezgi tonunda cevap üretir.
 */
export async function generateWhatsAppReply(
  threadId: number,
  incomingText: string,
): Promise<WaAiReply | null> {
  const start = Date.now();

  // Son N mesajı çek (eski → yeni)
  const histRes = await db.execute(sql`
    SELECT direction, message_text
    FROM whatsapp_messages
    WHERE thread_id = ${threadId}
      AND message_text IS NOT NULL
    ORDER BY created_at DESC
    LIMIT ${MAX_HISTORY_MESSAGES}
  `);
  const history = ((histRes.rows ?? histRes) as any[]).reverse();

  const messages: any[] = [{ role: "system", content: WA_SYSTEM_PROMPT }];
  for (const m of history) {
    messages.push({
      role: m.direction === "inbound" ? "user" : "assistant",
      content: m.message_text ?? "",
    });
  }
  // Son gelen mesajı garanti ekle (history'de yoksa)
  if (history.length === 0 || history[history.length - 1].message_text !== incomingText) {
    messages.push({ role: "user", content: incomingText });
  }

  try {
    const completion = await getOpenAI().chat.completions.create({
      model: MODEL_NAME,
      messages,
      temperature: 0.75,
      max_tokens: 300,
    });
    const text = completion.choices?.[0]?.message?.content?.trim() ?? "";
    if (!text) return null;
    return {
      text,
      confidence: 0.85,
      model: MODEL_NAME,
      latencyMs: Date.now() - start,
    };
  } catch (e: any) {
    console.error("[wa-ai] generateReply HATA:", e?.message);
    return null;
  }
}
