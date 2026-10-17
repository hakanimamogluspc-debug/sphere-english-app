/**
 * Merve ile Ders — ders motoru.
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

const execFileAsync = promisify(execFile);

export const TEACHER_NAME = "Merve";

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

const TTS_INSTRUCTIONS =
  "Sen Merve'sin: 30'lu yaşlarda, sıcak ve esprili bir Türk İngilizce öğretmeni. " +
  "Türkçe kısımları doğal, akıcı İstanbul Türkçesiyle; İngilizce örnek cümleleri net, " +
  "anlaşılır ve biraz yavaş, doğru İngilizce telaffuzla oku. Gülümseyen, cesaret veren bir ton; abartılı değil.";

/** TTS başarısız olursa null döner — ders yazıyla devam eder, akış kesilmez. */
export async function speak(text: string): Promise<string | null> {
  if (!aiAvailable() || !text.trim()) return null;
  try {
    const model = process.env.TUTOR_TTS_MODEL || "gpt-4o-mini-tts";
    const voice = process.env.TUTOR_TTS_VOICE || "coral";
    const params: any = { model, voice, input: text.slice(0, 1200), response_format: "mp3" };
    if (model.startsWith("gpt-4o")) params.instructions = TTS_INSTRUCTIONS;
    const r = await withTimeout(getOpenAI().audio.speech.create(params), 25_000, "TTS");
    return Buffer.from(await r.arrayBuffer()).toString("base64");
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

const PERSONA = `Sen ${TEACHER_NAME}'sin: Sphere English'in Türk İngilizce öğretmeni. 30'lu yaşlardasın; sıcak, esprili, kısa ve net konuşursun.
Öğrencilerin Türk şirketlerinde çalışan profesyoneller; iş İngilizcesi öğreniyorlar.

KİŞİLİK VE TON:
- Öğrenciye "sen" diye hitap et. Adını kullanabilirsin.
- "Kızım", "canım", "hayatım", "tatlım", "dostum", "abicim" gibi HİTAPLAR ASLA KULLANMA.
- Hafif, zararsız espri yapabilirsin (ör. "Upper size mı? Gökyüzüne çıkmıyoruz, beden soruyoruz."). Asla alay etme, küçümseme.
- Hata = öğrenme fırsatı. Doğru olanı net söyle, nedenini bir cümleyle açıkla.
- Yapay zekâ olduğundan bahsetme. Sen Merve'sin.

KONUŞMA BİÇİMİ ("say" alanı SESLİ OKUNACAK):
- Markdown, madde işareti, emoji, parantez içi açıklama KULLANMA. Düz konuşma metni.
- En fazla 45 kelime. Kısa cümleler.
- Öğretilen dil HER ZAMAN İngilizcedir. Türkçe yalnızca açıklama ve yönlendirme içindir; Türkçe cümleyi "öğretilecek kalıp" olarak verme.
- İngilizce örnek cümleyi tırnak içinde ver: "I'm afraid your order will be delayed."`;

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
- Örnek doğru cevaplar (birebir aynısı GEREKMEZ): ${step.targets.map((t) => `"${t}"`).join(" | ")}
- İpucu: ${step.hintTr || "(yok)"}
- Bu adımdaki deneme sayısı: ${opts.attempts + 1}${finalAttempt ? " — SON DENEME" : ""}

DEĞERLENDİRME KURALLARI:
- "correct": görevi yerine getiren, seviyesine göre anlaşılır ve doğal bir İngilizce cümle. Örnek cevapla aynı olması gerekmez; isim, şirket, rakam vb. öğrencinin kendisininki olabilir. advance=true. Kısa ve içten bir övgü ver.
- "almost": görevi yerine getiriyor ama düzeltilmeye değer bir hata var (ör. "responsible of", "upper size", eksik "for"). correction doldur, say içinde doğrusunu söyle; advance=true (takılmasın, öğrenerek ilerlesin).
- "wrong": görevi karşılamıyor ya da anlaşılmıyor. advance=false; ipucu ver ve tekrar denemesini iste.
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
      model: process.env.TUTOR_LLM_MODEL || "gpt-4o-mini",
      messages,
      temperature: 0.5,
      max_tokens: 350,
      response_format: { type: "json_object" },
    }),
    25_000,
    "GPT",
  );
  return parseEvaluation(completion.choices[0]?.message?.content || "", opts.attempts >= 2);
}

// ─── Konuşma metinleri (LLM gerektirmeyen) ────────────────────────────────────

export function openingLine(lesson: LessonSnapshot, firstName: string | null): string {
  const hello = firstName ? `Merhaba ${firstName}, ben Merve.` : "Merhaba, ben Merve.";
  return `${hello} ${lesson.introTr} ${lesson.steps[0]?.setupTr ?? ""}`.replace(/\s+/g, " ").trim();
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
  "introTr": "<Merve'nin açılışı, en fazla 30 kelime>",
  "outroTr": "<kapanış, en fazla 25 kelime>",
  "steps": [
    { "goalTr": "<kısa görev>", "setupTr": "<durumu kuran Türkçe anlatım>", "targets": ["<İngilizce örnek doğru cevap>", "<alternatif>"], "hintTr": "<ipucu>" }
  ]
}`;
  const completion = await withTimeout(
    getOpenAI().chat.completions.create({
      model: process.env.TUTOR_LLM_MODEL || "gpt-4o-mini",
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
