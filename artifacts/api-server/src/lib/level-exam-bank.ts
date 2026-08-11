import type { LevelExamQuestion } from "@workspace/db/schema";

type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

const OX = "oxford_business_result" as const;
const AI = "sphere_ai" as const;

function q(
  id: string,
  prompt: string,
  options: [string, string, string],
  correctIndex: number,
  source: typeof OX | typeof AI
): LevelExamQuestion {
  return { id, prompt, options, correctIndex, source };
}

export const LEVEL_EXAM_BANK: Record<CefrLevel, LevelExamQuestion[]> = {
  A1: [
    q("a1-1", "My name ___ Richard Smith.", ["is", "are", "am"], 0, OX),
    q("a1-2", "I'm from ___.", ["Italy", "Italian", "the Italy"], 0, OX),
    q("a1-3", "___ company is Microsoft.", ["She", "She's", "Her"], 2, OX),
    q("a1-4", "Person 1: ___ are you? Person 2: Very well, thanks.", ["What", "Who", "How"], 2, OX),
    q("a1-5", "BMW ___ cars.", ["produces", "provides", "employs"], 0, OX),
    q("a1-6", "We ___ three factories.", ["has", "have", "are"], 1, OX),
    q("a1-7", "Person 1: Do you work for an English company? Person 2: No, I ___. It's French.", ["do", "doesn't", "don't"], 2, OX),
    q("a1-8", "Person 1: ___ you spell that, please? Person 2: Sure. It's A-L-A-N.", ["Can", "Do", "Are"], 0, OX),
    q("a1-9", "There ___ four international airports near London.", ["is", "are", "have"], 1, OX),
    q("a1-10", "A: ___ you like a coffee? B: Yes, please.", ["Do", "Could", "Would"], 2, OX),
    q("a1-11", "I deal ___ customers every day.", ["for", "in", "with"], 2, OX),
    q("a1-12", "Can we ___ a meeting?", ["available", "appoint", "arrange"], 2, OX),
  ],
  A2: [
    q("a2-13", "Our products are ___ than our main competitor's.", ["cheap", "cheaper", "cheapest"], 1, OX),
    q("a2-14", "We need to ___ a solution to this problem.", ["attend", "make", "find"], 2, OX),
    q("a2-15", "What ___ on at the moment?", ["are you working", "do you work", "did you work"], 0, OX),
    q("a2-16", "How do you ___ about that idea?", ["think", "agree", "feel"], 2, OX),
    q("a2-17", "The plane leaves from ___ eighteen.", ["seat", "platform", "gate"], 2, OX),
    q("a2-18", "I have a ___ schedule this week.", ["busy", "fast", "time"], 0, OX),
    q("a2-19", "She's ___ you an email.", ["sent", "send", "sended"], 0, OX),
    q("a2-20", "I'm ___, but she's not here today.", ["sorry", "afraid", "apologize"], 0, OX),
    q("a2-21", "When ___ the company?", ["joined you", "did you join", "did you joined"], 1, OX),
    q("a2-22", "Can I ___ an order for 30 chairs?", ["place", "buy", "quote"], 0, OX),
    q("a2-23", "First of all, I ___ you a little bit about me.", ["tell", "'m going to tell", "'m telling"], 1, OX),
    q("a2-24", "English ___ all over the world.", ["speaks", "has spoken", "is spoken"], 2, OX),
    q("a2-25", "Did you ___ the deadline?", ["get", "reach", "meet"], 2, OX),
    q("a2-26", "I ___ him here recently.", ["didn't see", "haven't seen", "don't see"], 1, OX),
  ],
  B1: [
    q("b1-27", "The new system ___ me focus on more important jobs.", ["lets", "allows", "gets"], 0, OX),
    q("b1-28", "This website isn't as easy to use ___ the other one.", ["as", "than", "more"], 0, OX),
    q("b1-29", "I'll call you back as soon as I ___ something.", ["'m hearing", "'ll hear", "hear"], 2, OX),
    q("b1-30", "You ___ press this button. It's dangerous.", ["mustn't", "don't have to", "needn't"], 0, OX),
    q("b1-31", "Your visitor ___ for over an hour. He's in your room now.", ["is waiting", "has waited", "has been waiting"], 2, OX),
    q("b1-32", "The two companies plan to form a joint ___.", ["venture", "alliance", "forces"], 0, OX),
    q("b1-33", "If we changed the colour, we ___ more.", ["sell", "'ll sell", "'d sell"], 2, OX),
    q("b1-34", "When they have finished making the first ___, we can do some tests on it.", ["breakthrough", "prototype", "invention"], 1, OX),
    q("b1-35", "He ___ to leave the company by his boss.", ["'s been asked", "'s asked", "asked"], 0, OX),
    q("b1-36", "I'm surprised he's late. He's normally so ___.", ["hard-working", "patient", "punctual"], 2, OX),
    q("b1-37", "Hello, Alison. I ___ the office actually. Can I call you back tomorrow?", ["left", "'d just left", "was just leaving"], 2, OX),
    q("b1-38", "___ the delays with the trains, we all still arrived on time.", ["Although", "Even though", "Despite"], 2, OX),
    q("b1-39", "My favourite perk in my job is ___.", ["my salary", "my company car", "the overtime"], 1, OX),
    q("b1-40", "James is away, ___?", ["isn't he", "doesn't he", "is he"], 0, OX),
  ],
  B2: [
    q("b2-41", "I seem to have run ___ of money. Can you lend me some?", ["out", "low", "ahead"], 0, OX),
    q("b2-42", "If you don't like this idea, then come ___ with something better.", ["across", "in", "up"], 2, OX),
    q("b2-43", "___ speak to them about our idea earlier today?", ["Were you able to", "Did you succeed in", "Did you manage"], 0, OX),
    q("b2-44", "Our most ___ customer has been with us for over 25 years.", ["loyal", "courteous", "attentive"], 0, OX),
    q("b2-45", "Do you know what time ___?", ["is it", "it is", "does it"], 1, OX),
    q("b2-46", "Let's ___ up a list of action points.", ["take", "draw", "set"], 1, OX),
    q("b2-47", "We have very ___ information about you. Tell us about yourself.", ["little", "few", "plenty"], 0, OX),
    q("b2-48", "We've looked at the history, so now let's ___ to our current activities.", ["turn on", "notice", "move on"], 2, OX),
    q("b2-49", "Many women feel that they hit a glass ___ on the corporate ladder.", ["roof", "attic", "ceiling"], 2, OX),
    q("b2-50", "Today, we need to ___ on a date for the launch and promotion.", ["discuss", "meet", "decide"], 2, OX),
    q("b2-51", "What they are asking is ___ ridiculous.", ["very", "absolutely", "such"], 1, OX),
    q("b2-52", "There's a real ___ in the market for this kind of service, I think.", ["gap", "break", "miss"], 0, OX),
    q("b2-53", "Shirley is very calm and down to ___.", ["key", "world", "earth"], 2, OX),
    q("b2-54", "The pros definitely ___ the cons.", ["outcome", "outweigh", "outlook"], 1, OX),
  ],
  C1: [
    q("c1-55", "I think you should broaden your ___ and look for a new job.", ["horizons", "views", "positions"], 0, OX),
    q("c1-56", "If you ___, I'm sure you would have got the job.", ["applied", "would apply", "had applied"], 2, OX),
    q("c1-57", "Am I getting my point ___ clearly enough?", ["along", "across", "around"], 1, OX),
    q("c1-58", "There isn't a ___ of purpose to the meeting.", ["feel", "sense", "reason"], 1, OX),
    q("c1-59", "Let me ___ you in on some of the background.", ["fill", "pack", "add"], 0, OX),
    q("c1-60", "It's difficult to ___ what the reaction might be to this proposal.", ["weigh", "gauge", "measure"], 1, OX),
    // 6 additional C1 questions in the same Oxford style
    q("c1-61", "We need to ___ a strategy that will future-proof the business.", ["devise", "design", "draw"], 0, AI),
    q("c1-62", "The merger talks have ___ a serious snag over executive bonuses.", ["hit", "found", "made"], 0, AI),
    q("c1-63", "Margins have been ___ down by intense pricing pressure from new entrants.", ["driven", "pushed", "pressed"], 1, AI),
    q("c1-64", "I'd like to ___ the floor for any final questions.", ["open", "give", "take"], 0, AI),
    q("c1-65", "Their proposal, ___ creative, simply isn't viable in the current climate.", ["however", "although", "despite"], 1, AI),
    q("c1-66", "We can't afford to ___ our reputation by cutting corners on quality.", ["damage", "tarnish", "spoil"], 1, AI),
  ],
  C2: [
    // Hand-crafted C2-level (proficient) Business English questions in Oxford's style
    q("c2-1", "The CEO's remarks were widely ___ as a veiled criticism of the board.", ["construed", "constructed", "concluded"], 0, AI),
    q("c2-2", "Negotiations have reached an ___, and a third-party mediator may be required.", ["embargo", "impasse", "interim"], 1, AI),
    q("c2-3", "Their offer is contingent ___ securing regulatory approval by year-end.", ["on", "for", "with"], 0, AI),
    q("c2-4", "Quarterly earnings ___ analyst expectations by a comfortable margin.", ["overshadowed", "overstepped", "outstripped"], 2, AI),
    q("c2-5", "Had we anticipated the regulatory headwinds, we ___ the launch.", ["would have postponed", "would postpone", "had postponed"], 0, AI),
    q("c2-6", "The risk of reputational damage was ___ outweighed by the strategic upside.", ["far", "much", "widely"], 0, AI),
    q("c2-7", "We are ___ to disclose the terms of the settlement under the NDA.", ["banned", "precluded", "withheld"], 1, AI),
    q("c2-8", "The committee finds the auditor's findings somewhat ___, given the complexity of the transactions.", ["wanting", "deficient", "lacklustre"], 0, AI),
    q("c2-9", "His resignation, ___ unexpected, has created uncertainty in the boardroom.", ["albeit not", "although not", "even though"], 0, AI),
    q("c2-10", "The board is ___ to push through the restructuring before the AGM.", ["intent on", "intent for", "intending of"], 0, AI),
    q("c2-11", "The proposed acquisition would, in effect, give the parent firm a stranglehold ___ the European market.", ["on", "over", "above"], 1, AI),
    q("c2-12", "What initially seemed a routine audit has ___ a far more serious compliance issue.", ["turned up", "thrown out", "given off"], 0, AI),
  ],
};

export function getExamForLevel(level: CefrLevel): { questions: LevelExamQuestion[]; total: number } {
  const questions = LEVEL_EXAM_BANK[level] || [];
  return { questions, total: questions.length };
}

export function gradeAnswers(
  level: CefrLevel,
  selections: Array<{ questionId: string; selectedIndex: number | null }>
): {
  score: number;
  total: number;
  percent: number;
  passed: boolean;
  graded: Array<{ questionId: string; selectedIndex: number | null; isCorrect: boolean; correctIndex: number }>;
} {
  const bank = LEVEL_EXAM_BANK[level] || [];
  // Dedupe by questionId (last submission wins) and ignore unknown IDs to prevent score inflation.
  const validIds = new Set(bank.map((q) => q.id));
  const dedup = new Map<string, number | null>();
  for (const s of selections) {
    if (!validIds.has(s.questionId)) continue;
    const idx = Number.isInteger(s.selectedIndex) ? s.selectedIndex : null;
    dedup.set(s.questionId, idx);
  }
  // Always iterate the bank (not the submission) so total === bank.length and
  // unanswered questions count as wrong.
  let score = 0;
  const graded = bank.map((q) => {
    const selectedIndex = dedup.has(q.id) ? (dedup.get(q.id) as number | null) : null;
    const isCorrect = selectedIndex === q.correctIndex;
    if (isCorrect) score++;
    return { questionId: q.id, selectedIndex, isCorrect, correctIndex: q.correctIndex };
  });
  const total = bank.length;
  const percent = total > 0 ? Math.round((score / total) * 100) : 0;
  const passed = percent >= 70;
  return { score, total, percent, passed, graded };
}

export const CEFR_ORDER: CefrLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

export function nextCefr(current: string | null | undefined): CefrLevel | null {
  const idx = CEFR_ORDER.indexOf((current || "") as CefrLevel);
  if (idx < 0) return "A1";
  if (idx >= CEFR_ORDER.length - 1) return null;
  return CEFR_ORDER[idx + 1];
}

export function cefrAtOrAbove(level: CefrLevel, threshold: CefrLevel): boolean {
  return CEFR_ORDER.indexOf(level) >= CEFR_ORDER.indexOf(threshold);
}
