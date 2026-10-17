/**
 * Lara ile Ders — ders motoru.
 *
 * Akış (her tur):
 *   öğrenci (ses → Whisper ya da yazı) → GPT-4o-mini değerlendirir (JSON) →
 *   sunucu adımı ilerletir, bir sonraki adımın kurgusunu (setupTr) ekler → TTS (gpt-4o-mini-tts)
 *
 * Maliyet notu: adım açılışları (intro/setup/outro) önceden yazılı metin — LLM çağrısı yok.
 * Tur başına 1 Whisper (ses ise) + 1 küçük chat + 1 TTS.
 */

import OpenAI from "openai";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import os from "os";
import path from "path";
import { openaiTrackedFetch } from "./ai-usage.js";
import type { TutorStep } from "./tutor-lessons-seed.js";
import { synthesizeSpeech, type SpeechPart } from "./tutor-voice.js";

const execFileAsync = promisify(execFile);

export const TEACHER_NAME = "Lara";

export type LessonSnapshot = {
  slug: string | null;
  title: string;
  summary: string;
  introTr: string;
  outroTr: string;
  steps: TutorStep[];
};

export type Correction = { original: string; corrected: string; whyTr: string };

export type TurnVerdict = "correct" | "almost" | "wrong" | "question" | "off_topic";

export type TurnEvaluation = {
  verdict: TurnVerdict;
  say: string;
  correction: Correction | null;
  advance: boolean;
};

let _openai: OpenAI | null = null;
export function aiAvailable(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}
function getOpenAI(): OpenAI {
  if (!_openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY yok");
    _openai = new OpenAI({ fetch: openaiTrackedFetch, apiKey, timeout: 40_000, maxRetries: 1 });
  }
  return _openai;
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} zaman aşımı (${ms}ms)`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }).catch((e) => { clearTimeout(t); reject(e); });
  });
}

// ─── Ses → metin ──────────────────────────────────────────────────────────────

async function toMp3(input: Buffer): Promise<Buffer> {
  const stamp = `${process.pid}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const tmpIn = path.join(os.tmpdir(), `tutor_in_${stamp}`);
  const tmpOut = path.join(os.tmpdir(), `tutor_out_${stamp}.mp3`);
  try {
    fs.writeFileSync(tmpIn, input);
    await execFileAsync("ffmpeg", ["-y", "-i", tmpIn, "-vn", "-ar", "16000", "-ac", "1", "-b:a", "32k", tmpOut]);
    return fs.readFileSync(tmpOut);
  } finally {
    try { fs.unlinkSync(tmpIn); } catch { /* yok */ }
    try { fs.unlinkSync(tmpOut); } catch { /* yok */ }
  }
}

export async function transcribeLearner(audio: Buffer, mimeHint?: string): Promise<{ text: string; seconds: number }> {
  let buf = audio;
  let ext = "mp3";
  let mime = "audio/mpeg";
  try {
    buf = await toMp3(audio);
  } catch {
    // ffmpeg yoksa ham dosyayı gönder (webm/mp4 Whisper tarafından desteklenir)
    ext = mimeHint?.includes("mp4") ? "mp4" : "webm";
    mime = mimeHint || "audio/webm";
  }
  const seconds = ext === "mp3" ? buf.length / 4000 : 0; // 32 kbps ≈ 4000 B/sn
  const file = new File([new Uint8Array(buf)], `speech.${ext}`, { type: mime });
  const res = await withTimeout(
    getOpenAI().audio.transcriptions.create({
      model: "whisper-1",
      file,
      response_format: "text",
      temperature: 0,
      // Dil zorlamıyoruz: öğrenci "nasıl derim" diye Türkçe de konuşabilir.
      prompt: "Business English lesson. A Turkish learner answers in English, sometimes asks in Turkish.",
    } as any),
    30_000,
    "Whisper",
  );
  return { text: String(res as unknown as string).trim(), seconds };
}

// ─── Metin → ses ──────────────────────────────────────────────────────────────

/**
 * Konuşmayı seslendir (ayrıntı: lib/tutor-voice.ts — ElevenLabs/OpenAI, TR/EN parçalama, duraklama, önbellek).
 * Parça listesi verilirse parçalar arasına doğal bir duraklama girer; cacheable=true olan sabit metinler önbelleğe alınır.
 * Başarısızsa null döner — ders yazıyla devam eder.
 */
export async function speak(parts: SpeechPart[] | string): Promise<string | null> {
  try {
    const r = await withTimeout(synthesizeSpeech(parts), 40_000, "TTS");
    return r?.audioBase64 ?? null;
  } catch (e: any) {
    console.warn("[tutor-lesson] TTS başarısız:", e?.status ?? "", e?.code ?? "", e?.message);
    return null;
  }
}

// ─── Seviyeye göre Türkçe/İngilizce oranı ─────────────────────────────────────

export function languageMixFor(level: string | null): string {
  switch (level) {
    case "A1":
    case "A2":
      return "Öğrenci A1–A2. Açıklamaların ve yönlendirmelerin büyük kısmı (yaklaşık %70) TÜRKÇE olsun; İngilizce yalnızca hedef kalıplar ve kısa örnekler. İngilizce cümleler çok basit olsun.";
    case "B1":
      return "Öğrenci B1. Türkçe ve İngilizce yarı yarıya: övgü ve kısa yönlendirmeleri İngilizce yapabilirsin, dilbilgisi açıklamalarını Türkçe yap.";
    case "B2":
      return "Öğrenci B2. Yönlendirmelerin çoğu İngilizce olsun; Türkçeyi yalnızca dilbilgisi notu ya da öğrenci takıldığında kullan.";
    case "C1":
    case "C2":
      return "Öğrenci C1+. Neredeyse tamamen İngilizce konuş; Türkçeyi sadece öğrenci Türkçe soru sorarsa kısa bir açıklama için kullan.";
    default:
      return "Öğrencinin seviyesi bilinmiyor (B1 varsay). Türkçe ve İngilizce yarı yarıya; dilbilgisi açıklamaları Türkçe.";
  }
}

// ─── Değerlendirme ────────────────────────────────────────────────────────────

const PERSONA = `Sen ${TEACHER_NAME}'sın: Sphere English'in Türk İngilizce öğretmeni. 30'lu yaşlardasın; sıcak, esprili, kısa ve net konuşursun.
Öğrencilerin Türk şirketlerinde çalışan profesyoneller; iş İngilizcesi öğreniyorlar.

KİŞİLİK VE TON:
- Öğrenciye "sen" diye hitap et. Adını kullanabilirsin.
- "Kızım", "canım", "hayatım", "tatlım", "dostum", "abicim" gibi HİTAPLAR ASLA KULLANMA.
- Hafif, zararsız espri yapabilirsin (ör. "Upper size mı? Gökyüzüne çıkmıyoruz, beden soruyoruz."). Asla alay etme, küçümseme.
- Hata = öğrenme fırsatı. Doğru olanı net söyle, nedenini bir cümleyle açıkla.
- Yapay zekâ olduğundan bahsetme. Sen Lara'sın.

KONUŞMA BİÇİMİ ("say" alanı SESLİ OKUNACAK):
- Markdown, madde işareti, emoji, parantez içi açıklama KULLANMA. Düz konuşma metni.
- En fazla 45 kelime. Kısa cümleler.
- Öğretilen dil HER ZAMAN İngilizcedir. Türkçe yalnızca açıklama ve yönlendirme içindir; Türkçe cümleyi "öğretilecek kalıp" olarak verme.
- İngilizce örnek cümleyi tırnak içinde ver: "I'm afraid your order will be delayed." Tırnak içine YALNIZCA İngilizce yaz (Türkçe kelime koyma).
- Gerçek bir insan gibi konuş: önce kısa bir tepki ("Güzel!", "Hmm, neredeyse."), sonra açıklama. Nefes alınacak yerlere virgül koy; düşünme ya da vurgu anında "…" kullanabilirsin (bir cevapta en fazla bir kez).
- Rakam, saat ve kısaltmaları okunduğu gibi yaz (3 → üç, 15:00 → saat üç, vb. → ve benzeri) — metin seslendirilecek.`;

export function buildEvaluationPrompt(opts: {
  lesson: LessonSnapshot;
  stepIndex: number;
  attempts: number;
  level: string | null;
  firstName: string | null;
  sector: string | null;
}): string {
  const step = opts.lesson.steps[opts.stepIndex];
  const finalAttempt = opts.attempts >= 2;
  return `${PERSONA}

SEVİYE VE DİL KARIŞIMI:
${languageMixFor(opts.level)}

DERS: "${opts.lesson.title}" — ${opts.lesson.summary}
Öğrenci: ${opts.firstName || "(isim yok)"}${opts.sector ? `, sektör: ${opts.sector}` : ""}

ŞU ANKİ ADIM (${opts.stepIndex + 1}/${opts.lesson.steps.length}):
- Görev: ${step.goalTr}
- Kurgu (sen az önce söyledin): ${step.setupTr}
- Örnek cevaplar (YALNIZCA FİKİR VERMEK İÇİN — öğrencinin bunlardan birini söylemesi BEKLENMİYOR): ${step.targets.map((t) => `"${t}"`).join(" | ")}
- İpucu: ${step.hintTr || "(yok)"}
- Bu adımdaki deneme sayısı: ${opts.attempts + 1}${finalAttempt ? " — SON DENEME" : ""}

DEĞERLENDİRME KURALLARI — EN ÖNEMLİ İLKE: ANLAMA VE İŞE BAK, KELİMELERE DEĞİL.
Gerçek bir öğretmen gibi düşün: "Bu cümleyi gerçek bir iş ortamında söyleseydi, karşı taraf anlar ve iş görülür müydü?" Evet ise öğrenci BAŞARDI.
- Örnek cevaplardan FARKLI kelime, farklı yapı, farklı uzunluk, ek bilgi, kendi isim/şirket/rakamları, daha resmi ya da daha samimi bir üslup kullanmak ASLA tek başına hata değildir. Doğaçlamayı ödüllendir.
  Örnek: görev "gecikmeyi söyle", örnek "I'm afraid your order will be delayed." → "Unfortunately your shipment is going to arrive late, sorry about that." = correct.
  Örnek: görev "kendini tanıt", örnek "Hi, I'm Ayşe." → "Good morning, my name is Ayşe and I'm happy to be here." = correct.
- "correct": görevi yerine getiren, anlaşılır İngilizce. Küçük üslup tercihleri, eksik virgül, büyük/küçük harf, ufak doğal kısaltmalar hata değildir. advance=true. Kısa, içten bir övgü; istersen "Bunu şöyle de diyebilirsin: …" diye ALTERNATİF öner (correction alanını DOLDURMA — alternatif hata değildir).
- "almost": görevi yerine getiriyor ama gerçekten düzeltilmesi gereken bir dilbilgisi/kelime hatası var (ör. "responsible of", "upper size", "I am agree", eksik özne). correction doldur; advance=true (öğrenerek ilerlesin).
- "wrong": YALNIZCA şu durumlarda: cevap görevi hiç karşılamıyor (başka bir şey söylüyor), anlaşılmıyor, ya da neredeyse tamamen Türkçe. Emin değilsen "wrong" DEME — "correct" ya da "almost" seç. advance=false; ipucu ver, tekrar denemesini iste.
- "question": öğrenci Türkçe soru soruyor / "bilmiyorum", "nasıl derim" diyor. advance=false; kısa yardım et (kalıbın başını ver), tekrar denemesini iste.
- "off_topic": dersle ilgisiz. advance=false; nazikçe göreve döndür.
${finalAttempt ? `- SON DENEME: Cevap hâlâ doğru değilse doğru cümleyi tırnak içinde ver, bir kez yüksek sesle tekrar etmesini öner ve advance=true yap (öğrenci aynı adımda takılı kalmasın).` : ""}
- Bir sonraki adımı SEN anlatma; sunucu ekleyecek. Sadece bu cevaba tepki ver.
- Telaffuzu değerlendiremezsin (yazıya dökülmüş metni görüyorsun); yazım/noktalama hatalarını düzeltme.

ÇIKTI — yalnızca geçerli JSON:
{
  "verdict": "correct" | "almost" | "wrong" | "question" | "off_topic",
  "say": "<sesli okunacak tepki, en fazla 45 kelime>",
  "correction": null | { "original": "<öğrencinin yanlış kısmı, İngilizce>", "corrected": "<doğrusu, İngilizce>", "whyTr": "<Türkçe, en fazla 15 kelime>" },
  "advance": true | false
}`;
}

const VERDICTS: TurnVerdict[] = ["correct", "almost", "wrong", "question", "off_topic"];

/** LLM çıktısını doğrula ve güvenli hâle getir. Test edilebilir saf fonksiyon. */
export function parseEvaluation(raw: string, finalAttempt: boolean): TurnEvaluation {
  let j: any = null;
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    j = m ? JSON.parse(m[0]) : null;
  } catch {
    j = null;
  }
  if (!j || typeof j !== "object") {
    return {
      verdict: "wrong",
      say: "Bunu tam anlayamadım. Bir kez daha, İngilizce olarak dener misin?",
      correction: null,
      advance: finalAttempt,
    };
  }
  const verdict: TurnVerdict = VERDICTS.includes(j.verdict) ? j.verdict : "wrong";
  const say = String(j.say || "").replace(/[*_#`>]/g, "").replace(/\s+/g, " ").trim().slice(0, 600)
    || (verdict === "correct" ? "Çok iyi!" : "Bir kez daha deneyelim.");
  let correction: Correction | null = null;
  if (j.correction && typeof j.correction === "object" && j.correction.corrected) {
    correction = {
      original: String(j.correction.original || "").slice(0, 300),
      corrected: String(j.correction.corrected).slice(0, 300),
      whyTr: String(j.correction.whyTr || j.correction.why_tr || "").slice(0, 200),
    };
  }
  let advance = Boolean(j.advance);
  if (verdict === "correct" || verdict === "almost") advance = true;
  if (finalAttempt) advance = true; // takılı kalma yok
  return { verdict, say, correction, advance };
}

export async function evaluateTurn(opts: {
  lesson: LessonSnapshot;
  stepIndex: number;
  attempts: number;
  level: string | null;
  firstName: string | null;
  sector: string | null;
  history: Array<{ role: "merve" | "user"; text: string }>;
  learnerText: string;
}): Promise<TurnEvaluation> {
  const system = buildEvaluationPrompt(opts);
  const messages: any[] = [
    { role: "system", content: system },
    ...opts.history.slice(-8).map((h) => ({ role: h.role === "merve" ? "assistant" : "user", content: h.text })),
    { role: "user", content: opts.learnerText },
  ];
  const completion = await withTimeout(
    getOpenAI().chat.completions.create({
      model: process.env.TUTOR_LLM_MODEL || "gpt-4.1-mini",
      messages,
      temperature: 0.4,
      max_tokens: 350,
      response_format: { type: "json_object" },
    }),
    25_000,
    "GPT",
  );
  return parseEvaluation(completion.choices[0]?.message?.content || "", opts.attempts >= 2);
}

// ─── Gerçek konuşma (rol yapma) bölümü ────────────────────────────────────────
// Adımlar bittikten sonra Lara dersin konusundaki karşı tarafı (müşteri, yönetici, tedarikçi…) canlandırır;
// öğrenci istediği kadar konuşur. Hatalar konuşmayı bölmeden, kısaca düzeltilir.

export function roleplayEnabled(): boolean {
  return process.env.TUTOR_ROLEPLAY !== "0";
}
export function roleplayMaxTurns(): number {
  const n = Number(process.env.TUTOR_ROLEPLAY_MAX_TURNS);
  return Number.isFinite(n) && n >= 2 ? Math.round(n) : 20;
}

export const ROLEPLAY_TRANSITION =
  "Süper, bu dersin kalıpları tamam. Şimdi gerçek bir konuşma yapalım: ben karşı tarafı oynayacağım, sen öğrendiklerini kullanarak istediğin gibi cevap ver. Bitirmek istediğinde Dersi bitir'e basman yeterli.";

export type RoleplayResult = { say: string; correction: Correction | null; ended: boolean };

function buildRoleplayPrompt(opts: { lesson: LessonSnapshot; level: string | null; sector: string | null; firstName: string | null; turnNo: number; maxTurns: number }): string {
  const phrases = opts.lesson.steps.map((s) => `"${s.targets[0]}"`).join(", ");
  const nearEnd = opts.turnNo >= opts.maxTurns - 1;
  return `${PERSONA}

ŞİMDİ ROL YAPMA BÖLÜMÜNDESİN.
Ders: "${opts.lesson.title}" — ${opts.lesson.summary}
Öğrencinin bu derste çalıştığı kalıplar: ${phrases}
Öğrenci: ${opts.firstName || "(isim yok)"}${opts.sector ? `, sektör: ${opts.sector}` : ""}
${languageMixFor(opts.level)}

GÖREVİN:
- Dersin konusundaki KARŞI TARAFI canlandır (ör. yabancı müşteri, yönetici, tedarikçi, toplantıdaki meslektaş). Bu rolde İNGİLİZCE konuş, öğrencinin seviyesine uygun, doğal ve kısa (1–3 cümle).
- Gerçek bir iş konuşması gibi ilerlet: soru sor, itiraz et, ayrıntı iste, konuyu doğal biçimde genişlet. Öğrenciyi konuşturmak için her cevabın sonunda bir soru ya da konuşmayı sürdüren bir söz olsun.
- Öğrenci doğaçlama yapabilir; farklı kelime ve yapılar SERBEST. Sadece gerçek bir hata varsa (anlamı bozan ya da belirgin dilbilgisi hatası) rolden çıkmadan önce TEK kısa Türkçe düzeltme yap, sonra rolüne dön.
  Biçim: Küçük düzeltme: "doğru hâli" diyoruz. Sonra İngilizce rol cümlen.
  Hata yoksa düzeltme YAPMA, doğrudan rolünle devam et.
- Öğrenci Türkçe "nasıl derim" diye sorarsa kısa yardım et, sonra rolüne dön.
- Öğrenci konuşmayı bitirmek istediğini söylerse ("bitirelim", "that's all", "goodbye" vb.) ya da konu doğal olarak kapandıysa: rolündeki kapanış cümlesini söyle, ended=true.
${nearEnd ? "- Bu konuşmanın SON turu: rolündeki kapanış cümlesini söyle ve ended=true yap." : ""}
- "say" sesli okunur: markdown yok, en fazla 50 kelime. İngilizce rol cümlelerini tırnak İÇİNE ALMA (yalnız düzeltmedeki doğru hâli tırnakla).

ÇIKTI — yalnızca geçerli JSON:
{ "say": "<...>", "correction": null | { "original": "<yanlış kısım>", "corrected": "<doğrusu>", "whyTr": "<Türkçe, en fazla 15 kelime>" }, "ended": true | false }`;
}

/** Saf fonksiyon: rol yapma çıktısını doğrula. */
export function parseRoleplay(raw: string): RoleplayResult {
  let j: any = null;
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    j = m ? JSON.parse(m[0]) : null;
  } catch { j = null; }
  if (!j || typeof j !== "object") return { say: "Sorry, could you say that again?", correction: null, ended: false };
  const say = String(j.say || "").replace(/[*_#`>]/g, "").replace(/\s+/g, " ").trim().slice(0, 700) || "Could you tell me a bit more?";
  let correction: Correction | null = null;
  if (j.correction && typeof j.correction === "object" && j.correction.corrected) {
    correction = {
      original: String(j.correction.original || "").slice(0, 300),
      corrected: String(j.correction.corrected).slice(0, 300),
      whyTr: String(j.correction.whyTr || "").slice(0, 200),
    };
  }
  return { say, correction, ended: Boolean(j.ended) };
}

export async function roleplayTurn(opts: {
  lesson: LessonSnapshot; level: string | null; sector: string | null; firstName: string | null;
  turnNo: number; maxTurns: number;
  history: Array<{ role: "merve" | "user"; text: string }>; learnerText: string;
}): Promise<RoleplayResult> {
  const completion = await withTimeout(
    getOpenAI().chat.completions.create({
      model: process.env.TUTOR_LLM_MODEL || "gpt-4.1-mini",
      messages: [
        { role: "system", content: buildRoleplayPrompt(opts) },
        ...opts.history.slice(-12).map((h) => ({ role: h.role === "merve" ? "assistant" : "user", content: h.text })),
        { role: "user", content: opts.learnerText },
      ] as any,
      temperature: 0.7,
      max_tokens: 350,
      response_format: { type: "json_object" },
    }),
    25_000,
    "GPT",
  );
  return parseRoleplay(completion.choices[0]?.message?.content || "");
}

/** Rol yapmanın ilk cümlesi (karşı taraf konuşmayı açar). Hata olursa genel bir açılış. */
export async function roleplayOpener(opts: { lesson: LessonSnapshot; level: string | null; sector: string | null; firstName: string | null }): Promise<string> {
  try {
    const completion = await withTimeout(
      getOpenAI().chat.completions.create({
        model: process.env.TUTOR_LLM_MODEL || "gpt-4.1-mini",
        messages: [
          { role: "system", content: buildRoleplayPrompt({ ...opts, turnNo: 0, maxTurns: 99 }) },
          { role: "user", content: "(Konuşmayı rolündeki karşı taraf olarak SEN başlat: İngilizce, 1–2 cümle, bir soruyla bitir. correction=null, ended=false.)" },
        ] as any,
        temperature: 0.8,
        max_tokens: 200,
        response_format: { type: "json_object" },
      }),
      20_000,
      "GPT",
    );
    return parseRoleplay(completion.choices[0]?.message?.content || "").say;
  } catch {
    return "Hello! Thanks for taking the time to talk today. So, where would you like to start?";
  }
}

// ─── Konuşma metinleri (LLM gerektirmeyen) ────────────────────────────────────

export function openingLine(lesson: LessonSnapshot, firstName: string | null): string {
  const hello = firstName ? `Merhaba ${firstName}, ben Lara.` : "Merhaba, ben Lara.";
  return `${hello} ${lesson.introTr} ${lesson.steps[0]?.setupTr ?? ""}`.replace(/\s+/g, " ").trim();
}

/** Açılışın seslendirme parçaları: selam (kişiye özel) + giriş + ilk adım (kütüphane derslerinde önbelleklenir). */
export function openingSpeech(lesson: LessonSnapshot, firstName: string | null): SpeechPart[] {
  const fixed = Boolean(lesson.slug);
  return [
    { text: firstName ? `Merhaba ${firstName}, ben Lara.` : "Merhaba, ben Lara.", cacheable: !firstName },
    { text: lesson.introTr, cacheable: fixed },
    { text: lesson.steps[0]?.setupTr ?? "", cacheable: fixed },
  ].filter((p) => p.text.trim());
}

export function closingLine(lesson: LessonSnapshot): string {
  return (lesson.outroTr || "Dersi bitirdin, eline sağlık.").trim();
}

// ─── Kişiye özel ders (hata defterinden) ──────────────────────────────────────

export type MistakeRow = { wrong_text: string; correct_text: string | null; explanation: string | null; context: string | null };

export function sanitizeGeneratedLesson(j: any): LessonSnapshot | null {
  if (!j || !Array.isArray(j.steps) || j.steps.length < 2) return null;
  const steps: TutorStep[] = j.steps.slice(0, 5).map((s: any, i: number) => ({
    key: `p${i + 1}`,
    goalTr: String(s.goalTr || "").slice(0, 200),
    setupTr: String(s.setupTr || "").slice(0, 400),
    targets: (Array.isArray(s.targets) ? s.targets : []).map((t: any) => String(t).slice(0, 200)).filter(Boolean).slice(0, 3),
    hintTr: s.hintTr ? String(s.hintTr).slice(0, 200) : undefined,
  })).filter((s: TutorStep) => s.goalTr && s.setupTr && s.targets.length > 0);
  if (steps.length < 2) return null;
  return {
    slug: null,
    title: String(j.title || "Sana özel ders").slice(0, 120),
    summary: String(j.summary || "Son hatalarından hazırlanan kısa tekrar dersi.").slice(0, 300),
    introTr: String(j.introTr || "Bugün senin için son hatalarından küçük bir tekrar dersi hazırladım.").slice(0, 400),
    outroTr: String(j.outroTr || "Harika, bu hataları artık çok daha az yapacaksın.").slice(0, 300),
    steps,
  };
}

export async function generatePersonalLesson(opts: {
  mistakes: MistakeRow[];
  level: string | null;
  sector: string | null;
}): Promise<LessonSnapshot | null> {
  const list = opts.mistakes
    .map((m, i) => `${i + 1}. Yanlış: "${m.wrong_text}" → Doğru: "${m.correct_text ?? "?"}"${m.explanation ? ` (${m.explanation})` : ""}${m.context ? ` | Bağlam: ${m.context}` : ""}`)
    .join("\n");
  const system = `${PERSONA}

GÖREV: Öğrencinin son hatalarından 3–4 adımlık kısa, iş hayatından bir konuşma dersi hazırla.
Her adım bir iş durumu kurar (ör. müşteriye e-posta, toplantı) ve öğrenciden o hatanın DOĞRU hâlini kullanacağı bir İngilizce cümle ister.
${languageMixFor(opts.level)}
${opts.sector ? `Öğrencinin sektörü: ${opts.sector}. Durumları bu sektörden seç.` : ""}
Ton kuralları geçerli: hitap yok, kısa, esprili ama saygılı. setupTr sesli okunacak: markdown/emoji yok, en fazla 35 kelime.

ÇIKTI — yalnızca JSON:
{
  "title": "<Türkçe, en fazla 8 kelime>",
  "summary": "<Türkçe, tek cümle>",
  "introTr": "<Lara'nın açılışı, en fazla 30 kelime>",
  "outroTr": "<kapanış, en fazla 25 kelime>",
  "steps": [
    { "goalTr": "<kısa görev>", "setupTr": "<durumu kuran Türkçe anlatım>", "targets": ["<İngilizce örnek doğru cevap>", "<alternatif>"], "hintTr": "<ipucu>" }
  ]
}`;
  const completion = await withTimeout(
    getOpenAI().chat.completions.create({
      model: process.env.TUTOR_LLM_MODEL || "gpt-4.1-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: `Öğrencinin son hataları:\n${list}` },
      ],
      temperature: 0.6,
      max_tokens: 1200,
      response_format: { type: "json_object" },
    }),
    35_000,
    "GPT",
  );
  try {
    return sanitizeGeneratedLesson(JSON.parse(completion.choices[0]?.message?.content || "{}"));
  } catch {
    return null;
  }
}
