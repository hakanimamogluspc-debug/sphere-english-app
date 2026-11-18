/**
 * Kitap pratikleri — kart tekrarı aralıkları ve mini test üretimi (saf fonksiyonlar, test edilebilir).
 */

/** Leitner kutuları: kutu → bir sonraki tekrar (gün). Kutu 3+ = "öğrenildi" sayılır. */
export const BOX_INTERVAL_DAYS = [0, 1, 3, 7, 16, 35] as const;
export const MAX_BOX = BOX_INTERVAL_DAYS.length - 1;
export const LEARNED_BOX = 3;
/** "Tekrar et" denen kart aynı oturumda biraz sonra yeniden gelsin */
export const AGAIN_DELAY_MIN = 10;

export function nextReview(box: number, result: "know" | "again", now = new Date()): { box: number; dueAt: Date } {
  if (result === "again") return { box: 0, dueAt: new Date(now.getTime() + AGAIN_DELAY_MIN * 60_000) };
  const b = Math.min(MAX_BOX, Math.max(0, box) + 1);
  return { box: b, dueAt: new Date(now.getTime() + BOX_INTERVAL_DAYS[b] * 86_400_000) };
}

export interface QuizSourceItem {
  id: number; kind: "pattern" | "term"; en: string; tr: string; exampleEn: string | null; unitOrder: number;
}

export interface QuizQuestion {
  itemId: number;
  type: "meaning" | "reverse" | "blank";
  prompt: string;
  hint: string | null;
  options: string[];
  answer: number;
}

function shuffle<T>(arr: T[], rnd: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const clean = (s: string) => s.trim().replace(/[.!?…]+$/u, "").trim();

/** Örnek cümlede kalıp/terim geçiyorsa boşluklu hâlini döner */
export function blankOut(example: string | null, en: string): string | null {
  if (!example) return null;
  const target = clean(en);
  if (target.length < 3) return null;
  const idx = example.toLowerCase().indexOf(target.toLowerCase());
  if (idx < 0) return null;
  return `${example.slice(0, idx)}_____${example.slice(idx + target.length)}`;
}

// ─── Çeldirici (yanlış şık) seçimi ─────────────────────────────────────────
// Şıklar rastgele seçilince doğru cevap konuyu bilmeden de bulunuyordu ("[tarih]" → "[date]",
// tek uzun cümle, alakasız kısa ifadeler). Artık yanlış şıklar doğru cevaba EN ÇOK BENZEYEN
// öğelerden seçilir: aynı tür, aynı ünite, benzer uzunluk, ortak kelimeler, aynı başlangıç.

const tokens = (s: string): string[] => s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
/** Yer tutucuları ([date], [tarih], …) ve noktalamayı atıp karşılaştırılabilir çekirdeği döner */
const core = (s: string): string => tokens(s.replace(/\[[^\]]*\]|\([^)]*\)|…|\.{3}/g, " ")).join(" ");
const hasPlaceholder = (s: string): boolean => /\[[^\]]+\]|…|\.{3}/.test(s);

/** Aday, doğru cevapla karışacak kadar yakın mı? (biri diğerini içeriyor ya da neredeyse aynı) */
function tooClose(a: string, b: string): boolean {
  const ca = core(a), cb = core(b);
  if (!ca || !cb) return true;
  if (ca === cb) return true;
  const [short, long] = ca.length <= cb.length ? [ca, cb] : [cb, ca];
  // Kısa olan en az iki kelimeyse ve uzunun içinde geçiyorsa (ör. kalıp + kalıbın örnek cümlesi) ikisi de "doğru" görünür
  if (short.split(" ").length >= 2 && ` ${long} `.includes(` ${short} `)) return true;
  const ta = new Set(ca.split(" ")), tb = new Set(cb.split(" "));
  const inter = [...ta].filter((t) => tb.has(t)).length;
  return inter / (ta.size + tb.size - inter) > 0.8;
}

/** Benzerlik puanı: yüksek = doğru cevaba daha çok benziyor = daha iyi çeldirici */
function similarity(correct: string, cand: string, sameKind: boolean, sameUnit: boolean): number {
  const ta = tokens(correct), tb = tokens(cand);
  const sa = new Set(ta), sb = new Set(tb);
  const inter = [...sa].filter((t) => sb.has(t)).length;
  const jaccard = inter / Math.max(1, sa.size + sb.size - inter);
  const lenSim = Math.min(correct.length, cand.length) / Math.max(1, Math.max(correct.length, cand.length));
  const wordSim = Math.min(ta.length, tb.length) / Math.max(1, Math.max(ta.length, tb.length));
  return (
    3 * jaccard +
    2 * lenSim +
    1.5 * wordSim +
    (ta[0] && ta[0] === tb[0] ? 1.5 : 0) +
    (hasPlaceholder(correct) === hasPlaceholder(cand) ? 1 : 0) +
    (sameKind ? 1.5 : 0) +
    (sameUnit ? 0.75 : 0)
  );
}

/** Doğru cevaba en çok benzeyen adaylardan 3 yanlış şık (en iyi 6 aday içinden karıştırarak) */
function pickDistractors(
  it: QuizSourceItem, correct: string, field: "en" | "tr", all: QuizSourceItem[], rnd: () => number,
): string[] {
  const seen = new Set([correct.toLowerCase()]);
  const cands: { v: string; score: number }[] = [];
  for (const x of all) {
    if (x.id === it.id) continue;
    const v = field === "tr" ? x.tr?.trim() : clean(x.en);
    if (!v || seen.has(v.toLowerCase())) continue;
    // Karışacak kadar yakın olanlar elenir; ayrıca diğer öğenin karşılığı bu öğeyle aynıysa (eş anlamlı) da elenir
    if (tooClose(correct, v)) continue;
    if (tooClose(field === "tr" ? clean(it.en) : it.tr, field === "tr" ? clean(x.en) : x.tr)) continue;
    seen.add(v.toLowerCase());
    cands.push({ v, score: similarity(correct, v, x.kind === it.kind, x.unitOrder === it.unitOrder) });
  }
  cands.sort((a, b) => b.score - a.score);
  if (cands.length < 3) return [];
  // Her seferinde aynı üçlü gelmesin: 3. en iyi adaya puanı yakın olanlar (en çok 6) arasından karıştırılır.
  // Puanı belirgin düşük (alakasız) adaylar havuza girmez.
  const cutoff = cands[2].score - 0.6;
  const poolTop = cands.filter((c) => c.score >= cutoff).slice(0, 6);
  return shuffle(poolTop, rnd).slice(0, 3).map((c) => c.v);
}

/**
 * Mini test: `pool` içinden en fazla `count` soru. Yanlış şıklar aynı kitaptan, doğru cevaba en çok
 * benzeyen öğelerden seçilir; doğru cevapla karışacak kadar yakın olanlar şık olamaz.
 */
export function buildQuiz(pool: QuizSourceItem[], all: QuizSourceItem[], count = 10, rnd: () => number = Math.random): QuizQuestion[] {
  const picked = shuffle(pool, rnd).slice(0, count);
  const qs: QuizQuestion[] = [];
  picked.forEach((it, i) => {
    const blank = blankOut(it.exampleEn, it.en);
    const types: QuizQuestion["type"][] = blank ? ["blank", "meaning", "reverse"] : ["meaning", "reverse"];
    const type = types[i % types.length];
    const field: "en" | "tr" = type === "meaning" ? "tr" : "en";
    const correct = field === "tr" ? it.tr?.trim() : clean(it.en);
    if (!correct) return;

    const distractors = pickDistractors(it, correct, field, all, rnd);
    if (distractors.length < 3) return;

    const options = shuffle([correct, ...distractors], rnd);
    qs.push({
      itemId: it.id,
      type,
      prompt: type === "blank" ? blank! : type === "meaning" ? clean(it.en) : it.tr,
      // Boşluk doldurmada Türkçe karşılığı ipucu olarak vermek cevabı ele veriyordu; artık ipucu yok
      hint: null,
      options,
      answer: options.indexOf(correct),
    });
  });
  return qs;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Öğrencinin mesajlarında hedef kalıplardan hangileri geçti (basit, deterministik eşleşme) */
export function usedTargets(userTexts: string[], targets: string[]): string[] {
  const hay = ` ${norm(userTexts.join(" "))} `;
  return targets.filter((t) => {
    const n = norm(clean(t));
    return n.length >= 3 && hay.includes(` ${n} `);
  });
}
