/**
 * Instagram bot — AI cevap motoru.
 *
 * Mevcut OpenAI altyapısını kullanır (chatbot ile aynı).
 * Sphere English knowledge base ile sistem prompt'u zenginleştirilmiş.
 *
 * Iki ana fonksiyon:
 *   - generateDmReply(thread, incomingText) → DM için cevap
 *   - generateCommentReply(commentText)     → Yorum için kısa cevap
 *
 * Env:
 *   OPENAI_API_KEY       — zorunlu
 *   IG_BOT_MODEL         — opsiyonel, default "gpt-4o-mini"
 */

import OpenAI from "openai";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

const MODEL = process.env["IG_BOT_MODEL"] ?? "gpt-4o-mini";
const MAX_HISTORY = 8;

// ─── Sphere knowledge base — system prompt ────────────────────────────
const SPHERE_KNOWLEDGE = `Sphere English hakkında bilgiler:

## ŞİRKET
- Sphere English: Türkiye'nin önde gelen Kurumsal İş İngilizcesi Eğitimi platformu
- Kurucu: Didem İmamoğlu (kurumsal iş İngilizcesi koçu)
- Lokasyon: Ayvalık, Balıkesir (150 Evler Mah. Atatürk Blv. No:456/35)
- Oxford University Press resmi eğitim ortağı
- 6 ay program sonunda ortalama 2 seviye ilerleme

## ÜRÜNLER VE FİYATLAR
Bireysel Abonelik Planları (KDV dahil):
- Sphere Core Aylık: 349 TL/ay (Yıllık: 3.490 TL, ayda ~291 TL, %17 indirim)
  → Standart AI Coach, Oxford müfredatı A1-B1, temel seviye tespiti
- Sphere Pro Aylık: 699 TL/ay (Yıllık: 6.990 TL, ayda ~583 TL, %17 indirim)
  → Sınırsız AI Coach, A1-C1 tüm seviyeler, AI Studio (toplantı/e-mail/sunum/müzakere), kişisel öğrenme planı, öncelikli destek
  → EN POPÜLER PLAN
- Sphere Premium Aylık: 1.199 TL/ay (Yıllık: 11.990 TL, ayda ~999 TL, %17 indirim)
  → Pro + telaffuz/aksan analizi + sektörel modüller + tam kişisel plan + aylık canlı koçluk

Tüm planlarda **7 GÜN ÜCRETSİZ DENEME**, kart bilgisi gerekmez.

## E-KİTAPLAR
- "Kurumsal İletişim & Toplantılar" — 199 TL (İş İngilizcesinde Kullanılan 1000 Kelime — Kitap 01)
- Yazar: Didem İmamoğlu
- Dijital teslimat, dijital indirme
- **ÜCRETSİZ ÖN İZLEME**: 5 sayfa ücretsiz okuma imkânı (www.sphereenglish.com/e-kitaplar üzerinden tıkla)
- **Tam ücretsiz e-kitap yoktur** — sadece 5 sayfa ön izleme. Tam versiyon 199 TL.
- "Bedava kitap var mı?" / "ücretsiz e-kitap?" → "Tam ücretsiz yok ama 5 sayfa ücretsiz ön izleme yapabilirsin: www.sphereenglish.com/e-kitaplar 📖"
- Satın alma sayfası: www.sphereenglish.com/e-kitaplar

## KURUMSAL TEKLİF
- B2B kurumsal eğitim çözümleri (şirketler için özel paketler)
- Demo + teklif: www.sphereenglish.com/iletisim
- Yöneticiler, satış ekibi, teknik kadrolar, İK için sektöre özel programlar
- Ölçülebilir + raporlanabilir ilerleme paneli

## DERSLER NASIL YAPILIYOR
- Zoom üzerinden canlı, birebir veya küçük gruplar
- AI destekli konuşma koçu (7/24 pratik)
- Tüm dersler kayıt + ilerleme raporlama
- 12 deneyimli koç

## EĞİTMEN OL
- Sphere English'te koç olmak için: www.sphereenglish.com/egitmen-ol

## İLETİŞİM
- E-posta: info@sphereenglish.com
- WhatsApp: +90 506 608 5810
- Web: www.sphereenglish.com
- Uygulama: app.sphereenglish.com (öğrenci giriş)

## YAYGIN SORULAR
- "Demo nasıl alırım?" → /iletisim sayfasından form doldur, 24 saat içinde dönüş
- "Şirket için teklif?" → /iletisim → "Kurumsal demo" seç
- "Hangi seviyeden başlamalı?" → app.sphereenglish.com'da ücretsiz seviye tespiti (5 dk)
- "Kayıt nasıl olur?" → /abonelik sayfasından 7 gün ücretsiz deneme başlat
- "İptal edebilir miyim?" → 7 gün içinde tek tık iptal, otomatik kesinti olmaz
- "Sertifika var mı?" → Evet, Oxford University Press onaylı program sonunda
`;

const DM_SYSTEM_PROMPT = `Sen "Sphere Asistanı"sın — Sphere English'in resmi Instagram müşteri temsilcisi botu.

KARAKTERİN:
- Samimi ama profesyonel
- Türkçe konuş (kullanıcı İngilizce yazarsa İngilizce dön)
- KISA cevaplar ver — Instagram DM için 2-3 cümle ideal
- Emoji'leri sade kullan, abartma
- Asla "Yapay zekayım" deme — Sphere Asistanı olarak konuş

KURALLAR:
1. Bilmediğin konuda asla uydurma — "Bu konuda detayı info@sphereenglish.com'a sorabilirim" de
2. Fiyatları DOĞRU ver (yukarıdaki bilgi tabanından)
3. URL paylaşırken net link ver: www.sphereenglish.com/...
4. Şikayet/sorun varsa empati göster, info@sphereenglish.com'a yönlendir
5. Satışa zorlamadan, doğru cevabı vermeye odaklan
6. Selamlama varsa kısa selamla dön ("Merhaba! 👋")
7. "Demo" / "fiyat" / "abone" / "kurumsal" sorularına direkt link ver

${SPHERE_KNOWLEDGE}`;

const COMMENT_SYSTEM_PROMPT = `Sen "Sphere Asistanı"sın — Sphere English'in resmi Instagram yorum cevap botu.

KARAKTERİN:
- Sıcak, kısa, BİLGİLENDİRİCİ
- 1-2 cümle ideal — herkes görür, kısa tut
- Emoji sade (1-2 max)
- Türkçe (İngilizce yorumlara İngilizce)

KURALLAR:
1. Yorumlar HERKESE görünür → saygılı + nazik + BİLGİ VER
2. Basit soruları CEVAPLA (fiyat, plan, kitap, demo) — DM'e gönderme
3. Kişiselleştirme/özel teklif gerekenleri DM'e yönlendir
4. Cevaplarda HER ZAMAN bir link/yönlendirme ver (www.sphereenglish.com/...)
5. Olumsuz/şikayet → empati + iletişim ("info@sphereenglish.com 🙏")
6. Spam/troll/anlamsız ise: "SKIP" yaz
7. Övgüye teşekkür et + ek bilgi/link ekle
8. Satışa zorlama, ama doğru cevabı ver

ÖRNEK CEVAPLAR:

Övgü/teşekkür:
"Çok teşekkürler! 💙 Detay için: www.sphereenglish.com"

Fiyat sorusu:
"Bireysel planlar 349-1199 TL/ay, 7 gün ücretsiz dene 🙏 www.sphereenglish.com/abonelik"

Ücretsiz/bedava e-kitap:
"5 sayfa ücretsiz ön izleme var 📖 www.sphereenglish.com/e-kitaplar — tam kitap 199 TL"

Demo nasıl alınır:
"www.sphereenglish.com/iletisim üzerinden form doldurabilirsin 🙌 24 saat içinde dönüş yapıyoruz"

Seviye sorusu:
"A1-C2 tüm seviyeler için 💪 Ücretsiz seviye tespiti: app.sphereenglish.com"

Kurumsal/şirket:
"Kurumsal teklif için www.sphereenglish.com/iletisim 'Kurumsal Demo' seç 💼"

E-kitap ne var:
"Şu an 'Kurumsal İletişim & Toplantılar' kitabı 199 TL 📚 www.sphereenglish.com/e-kitaplar"

Eğitmen olmak:
"Sphere'de koç olmak için: www.sphereenglish.com/egitmen-ol 🎓"

Tarafsız/genel sorgu:
"Süper soru! Detay için web sitemizde: www.sphereenglish.com ✨"

Kişiye özel teklif gerektiren (ör. "bana özel bir plan var mı?"):
"Sana özel plan için DM atabilir misin? 🙏"

${SPHERE_KNOWLEDGE}`;

// Eskalasyon (insan müdahalesi) gerektiren ANLAM TAŞIYAN ifadeler.
// Çok geniş kelime listesi (ör. "manager" tek başına) yanlış tetikleme yapıyor.
// Bu yüzden multi-word phrase veya açık kontekstli kelimeler kullanılır.
const ESCALATION_PHRASES = [
  "şikayet",
  "para iade",
  "ücret iadesi",
  "refund",
  "aboneliğimi iptal",
  "üyeliğimi iptal",
  "aboneliği iptal et",
  "cancel my subscription",
  "müdürünüzle",
  "yöneticinizle",
  "müşteri hizmetleri",
  "speak to manager",
  "avukat",
  "dava açacağım",
  "yasal işlem",
  "sahte",
  "dolandırıcı",
  "scam",
  "fraud",
];

export function shouldEscalate(text: string): { escalate: boolean; reason?: string } {
  const lower = text.toLowerCase();
  for (const phrase of ESCALATION_PHRASES) {
    if (lower.includes(phrase)) return { escalate: true, reason: `İfade: "${phrase}"` };
  }
  return { escalate: false };
}

// ─── DM cevap üret ────────────────────────────────────────────────────
export async function generateDmReply(
  threadId: number,
  incomingText: string,
): Promise<{ text: string; model: string; latencyMs: number; confidence: number } | null> {
  if (!incomingText || incomingText.trim().length === 0) return null;

  // Son N mesajı thread history olarak al
  const historyRows = await db.execute(sql`
    SELECT direction, message_text
    FROM instagram_messages
    WHERE thread_id = ${threadId}
      AND message_text IS NOT NULL
    ORDER BY created_at DESC
    LIMIT ${MAX_HISTORY}
  `);
  const history = ((historyRows.rows ?? historyRows) as any[]).reverse();

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: DM_SYSTEM_PROMPT },
  ];
  for (const h of history) {
    messages.push({
      role: h.direction === "inbound" ? "user" : "assistant",
      content: h.message_text,
    });
  }
  // Son inbound mesaj zaten history'de var — yine de garanti için
  if (messages[messages.length - 1]?.content !== incomingText) {
    messages.push({ role: "user", content: incomingText });
  }

  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) {
    console.error("[ig-ai] OPENAI_API_KEY tanımlı değil");
    return null;
  }

  const openai = new OpenAI({ apiKey });
  const start = Date.now();
  try {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages,
      temperature: 0.6,
      max_tokens: 250,
    });
    const latencyMs = Date.now() - start;
    const text = completion.choices?.[0]?.message?.content?.trim() ?? "";
    if (!text || text.toLowerCase().includes("skip")) return null;

    return {
      text,
      model: MODEL,
      latencyMs,
      confidence: 0.85,
    };
  } catch (e: any) {
    console.error("[ig-ai] generateDmReply HATA:", e?.message);
    return null;
  }
}

// ─── Yorum cevap üret ─────────────────────────────────────────────────
export async function generateCommentReply(
  commentText: string,
): Promise<{ text: string; model: string; latencyMs: number; confidence: number } | null> {
  if (!commentText || commentText.trim().length === 0) return null;

  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) {
    console.error("[ig-ai] OPENAI_API_KEY tanımlı değil");
    return null;
  }

  const openai = new OpenAI({ apiKey });
  const start = Date.now();
  try {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: COMMENT_SYSTEM_PROMPT },
        { role: "user", content: `Yorum: "${commentText}"\n\nUygun bir cevap üret. Eğer spam/troll ise "SKIP" yaz.` },
      ],
      temperature: 0.5,
      max_tokens: 100,
    });
    const latencyMs = Date.now() - start;
    const text = completion.choices?.[0]?.message?.content?.trim() ?? "";
    if (!text || text.toUpperCase() === "SKIP" || text.toLowerCase().includes("skip")) {
      return null;
    }
    return {
      text,
      model: MODEL,
      latencyMs,
      confidence: 0.8,
    };
  } catch (e: any) {
    console.error("[ig-ai] generateCommentReply HATA:", e?.message);
    return null;
  }
}
