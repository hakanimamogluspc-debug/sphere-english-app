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

/**
 * Mini test: `pool` içinden en fazla `count` soru; şıklar aynı kitaptan (önce aynı tür) seçilir.
 * Yanlış şıklar doğru cevapla aynı metne sahip olamaz.
 */
export function buildQuiz(pool: QuizSourceItem[], all: QuizSourceItem[], count = 10, rnd: () => number = Math.random): QuizQuestion[] {
  const picked = shuffle(pool, rnd).slice(0, count);
  const qs: QuizQuestion[] = [];
  picked.forEach((it, i) => {
    const blank = blankOut(it.exampleEn, it.en);
    const types: QuizQuestion["type"][] = blank ? ["blank", "meaning", "reverse"] : ["meaning", "reverse"];
    const type = types[i % types.length];
    const field: "en" | "tr" = type === "meaning" ? "tr" : "en";
    const correct = field === "tr" ? it.tr : clean(it.en);
    if (!correct) return;

    const seen = new Set([correct.toLowerCase()]);
    const sameKind = shuffle(all.filter((x) => x.id !== it.id && x.kind === it.kind), rnd);
    const otherKind = shuffle(all.filter((x) => x.id !== it.id && x.kind !== it.kind), rnd);
    const distractors: string[] = [];
    for (const x of [...sameKind, ...otherKind]) {
      const v = field === "tr" ? x.tr : clean(x.en);
      if (!v || seen.has(v.toLowerCase())) continue;
      seen.add(v.toLowerCase());
      distractors.push(v);
      if (distractors.length === 3) break;
    }
    if (distractors.length < 3) return;

    const options = shuffle([correct, ...distractors], rnd);
    qs.push({
      itemId: it.id,
      type,
      prompt: type === "blank" ? blank! : type === "meaning" ? clean(it.en) : it.tr,
      hint: type === "blank" ? it.tr : null,
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
