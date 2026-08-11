import { Router } from "express";
import { db } from "@workspace/db";
import { grammarBooksTable, grammarTopicsTable, grammarProgressTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import OpenAI from "openai";
import { authMiddleware } from "../middlewares/auth.js";
import { awardPoints } from "../lib/points.js";

const router = Router();

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI | null {
  try {
    if (!_openai) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) return null;
      _openai = new OpenAI({ apiKey });
    }
    return _openai;
  } catch { return null; }
}

/* ─── SEED DATA ─────────────────────────────────────────────────── */
const SEED_DATA = [
  {
    book: { title: "Temel İngilizce Dilbilgisi", level: "A1-A2", description: "A1 ve A2 seviyesi için temel dilbilgisi kuralları" },
    topics: [
      {
        title: "To Be (am / is / are)", level: "A1", displayOrder: 1,
        content: `The verb "to be" is the most fundamental verb in English. It connects the subject to a description or state.
FORMS: I am (I'm), You are (You're), He/She/It is (He's/She's/It's), We are (We're), They are (They're).
NEGATIVE: Add 'not' after the verb — I am not (I'm not), He is not (He isn't), They are not (They aren't).
QUESTION: Move the verb before the subject — Are you a student? Is she happy? Am I late?
SHORT ANSWERS: Yes, I am / No, I'm not. Yes, she is / No, she isn't. Yes, they are / No, they aren't.
USAGE: Use 'to be' to describe identity (I am a teacher), nationality (She is Turkish), feelings (He is tired), location (We are at school), and age (I am 25 years old).
COMMON MISTAKES: Do NOT say 'I is' or 'he are'. The form must match the subject exactly.`
      },
      {
        title: "Present Simple (Geniş Zaman)", level: "A1", displayOrder: 2,
        content: `Present Simple expresses habits, routines, facts, and general truths.
POSITIVE: Subject + base verb. Add -s/-es for he/she/it. I eat, you eat, he eats, she watches, it runs.
NEGATIVE: Subject + do/does + not + base verb. I do not eat. She does not watch. (don't / doesn't in short form)
QUESTION: Do/Does + subject + base verb? Do you eat? Does she watch TV?
SPELLING: Add -es for verbs ending in -sh, -ch, -x, -o, -s (watches, goes, mixes). Change -y to -ies if preceded by consonant (study → studies).
TIME EXPRESSIONS: always, usually, often, sometimes, rarely, never, every day/week, on Mondays.
USAGE: I drink coffee every morning. She doesn't like spicy food. Do they play football?
COMMON MISTAKES: Never say 'He don't go' — always use 'doesn't' for he/she/it.`
      },
      {
        title: "Past Simple (Geçmiş Zaman)", level: "A2", displayOrder: 3,
        content: `Past Simple describes completed actions in the past at a specific time.
REGULAR VERBS: Add -ed to the base form. walk → walked, play → played, watch → watched.
SPELLING: Double the final consonant for short vowel verbs (stop → stopped, plan → planned). Drop -e before -ed (love → loved). Change -y to -ied (study → studied).
IRREGULAR VERBS: Many common verbs have irregular past forms. go → went, see → saw, eat → ate, have → had, buy → bought, come → came, take → took, make → made.
NEGATIVE: Subject + did not (didn't) + base verb. I didn't go. She didn't eat.
QUESTION: Did + subject + base verb? Did you go? Did they see the film?
TIME EXPRESSIONS: yesterday, last week/month/year, ago (two days ago), in 2020, when I was young.
COMMON MISTAKES: Do NOT add -ed to irregular verbs. Never say 'I goed' or 'She comed'.`
      },
      {
        title: "Present Continuous (Şimdiki Zaman)", level: "A2", displayOrder: 4,
        content: `Present Continuous describes actions happening right now or around this time.
FORM: Subject + am/is/are + verb-ing.
SPELLING: Add -ing to base verb. For verbs ending in -e, drop the -e first (come → coming, write → writing). For short vowel+consonant, double the consonant (run → running, sit → sitting).
POSITIVE: I am studying. She is cooking. They are playing.
NEGATIVE: I am not studying. She isn't cooking. They aren't playing.
QUESTION: Are you studying? Is she cooking? What are they doing?
USAGE: Actions happening NOW (Look! It is raining!), temporary situations (She is living in Istanbul this month), and future arrangements (I am meeting him tomorrow).
NOT USED WITH: stative verbs — know, understand, believe, want, need, like, love, hate, own, have (possession). Say 'I know' not 'I am knowing'.
PRESENT SIMPLE vs CONTINUOUS: 'I drink coffee' (habit) vs 'I am drinking coffee' (right now).`
      },
      {
        title: "Comparative & Superlative Adjectives", level: "A2", displayOrder: 5,
        content: `Comparatives compare two things. Superlatives identify the extreme within a group.
SHORT ADJECTIVES (1 syllable): Add -er for comparative, -est for superlative. fast → faster → fastest. big → bigger → biggest.
SPELLING: Double final consonant for short vowel+consonant adjectives (big → bigger). Drop -e before adding -er/-est (nice → nicer → nicest). Change -y to -ier/-iest (happy → happier → happiest).
LONG ADJECTIVES (2+ syllables): Use 'more' for comparative, 'most' for superlative. beautiful → more beautiful → most beautiful.
IRREGULAR: good → better → best. bad → worse → worst. far → farther → farthest.
STRUCTURES: A is bigger than B. A is the biggest in the group. A is as big as B (equal). A is not as big as B (unequal).
USAGE: Istanbul is bigger than Ankara. Mount Everest is the highest mountain in the world. She is more intelligent than her brother.`
      },
    ]
  },
  {
    book: { title: "Orta Seviye İngilizce Dilbilgisi", level: "B1-B2", description: "B1 ve B2 seviyesi için orta düzey dilbilgisi yapıları" },
    topics: [
      {
        title: "Present Perfect (Yakın Geçmiş)", level: "B1", displayOrder: 1,
        content: `Present Perfect connects the past to the present — actions that happened at an unspecified time before now, or that started in the past and continue now.
FORM: Subject + have/has + past participle.
PAST PARTICIPLE: Regular verbs: add -ed (work → worked). Irregular verbs: go → gone, see → seen, eat → eaten, write → written, take → taken, give → given.
POSITIVE: I have visited Paris. She has finished her homework. We have known each other for years.
NEGATIVE: I have not (haven't) visited. She has not (hasn't) finished.
QUESTION: Have you visited Paris? Has she finished? How long have you lived here?
KEY WORDS: already (I have already eaten), yet (Have you eaten yet? / I haven't eaten yet), just (She has just arrived), ever/never (Have you ever tried sushi? I have never smoked), for (I have worked here for five years), since (She has lived here since 2019).
PRESENT PERFECT vs PAST SIMPLE: 'I have seen that film' (unspecified time, result matters) vs 'I saw that film last night' (specific time, action completed and done).`
      },
      {
        title: "Modal Verbs (Kiplik Fiiller)", level: "B1", displayOrder: 2,
        content: `Modal verbs express ability, possibility, permission, obligation, and advice. They are followed by the bare infinitive (base form without 'to').
ABILITY: can (present/future) — I can swim. could (past ability / polite request) — She could speak French as a child. Can you help me?
PERMISSION: can/could/may — Can I open the window? May I sit here? (May is more formal.)
POSSIBILITY: might/may — It might rain tomorrow. She may be at the office.
OBLIGATION/NECESSITY: must (strong, internal obligation) — You must wear a seatbelt. have to (external obligation) — I have to work on Saturdays.
PROHIBITION: must not (mustn't) — You mustn't smoke here. cannot (can't) — You can't park here.
ADVICE/RECOMMENDATION: should/ought to — You should see a doctor. You ought to apologize.
LACK OF OBLIGATION: don't have to / needn't — You don't have to come if you're busy.
NEGATIVES: can't, couldn't, mustn't, shouldn't, might not.
NOTE: Modal verbs have NO -s for third person singular — 'She can swim' NOT 'She cans swim'.`
      },
      {
        title: "First Conditional (Birinci Koşul)", level: "B1", displayOrder: 3,
        content: `First Conditional expresses real and possible future conditions — if something happens, something else will happen as a result.
STRUCTURE: If + Present Simple, will + base verb.
POSITIVE: If it rains, I will stay at home. If you study hard, you will pass the exam. If she calls, I will answer.
NEGATIVE: If it doesn't rain, we will go to the park. If you don't hurry, you will be late.
QUESTION: If you win the lottery, what will you do? Will you come if I invite you?
NOTE: The 'if' clause uses Present Simple even though it refers to the future. Never say 'If it will rain'. Use 'will' only in the result clause.
UNLESS: Unless = 'if not'. Unless you hurry, you will miss the bus = If you don't hurry, you will miss the bus.
WHEN vs IF: 'When' is used for certain future events. 'When it rains, I stay at home' (it always happens). 'If it rains, I will stay home' (it may or may not rain).
VARIATIONS: Can/may/might can replace 'will' — If you are tired, you can rest.`
      },
      {
        title: "Passive Voice (Edilgen Çatı)", level: "B1", displayOrder: 4,
        content: `Passive Voice is used when the action is more important than who does it, when the agent is unknown, or when we want to avoid mentioning the agent.
FORM: Subject + to be (correct tense) + past participle (+ by + agent, optional).
PRESENT SIMPLE PASSIVE: is/are + past participle. English is spoken all over the world. Letters are delivered every day.
PAST SIMPLE PASSIVE: was/were + past participle. The pyramids were built by the ancient Egyptians. The car was stolen last night.
PRESENT PERFECT PASSIVE: has/have been + past participle. The report has been completed. Many languages have been lost.
FUTURE PASSIVE: will be + past participle. The new hospital will be opened next year.
CONTINUOUS PASSIVE: is/are being + past participle. The bridge is being repaired.
AGENT: Use 'by' to mention the agent when relevant — The song was written by the Beatles. Often the agent is omitted when unknown or unimportant.
ACTIVE TO PASSIVE: Active: 'Shakespeare wrote Hamlet.' Passive: 'Hamlet was written by Shakespeare.' The object of the active becomes the subject of the passive.`
      },
      {
        title: "Second Conditional (İkinci Koşul)", level: "B2", displayOrder: 5,
        content: `Second Conditional expresses unreal, hypothetical, or unlikely present/future situations.
STRUCTURE: If + Past Simple, would + base verb.
POSITIVE: If I had more money, I would travel the world. If she were taller, she could be a model. If I lived in Paris, I would visit the Eiffel Tower every day.
NEGATIVE: If I didn't have to work, I would sleep all day. If she weren't so shy, she would talk to him.
QUESTION: What would you do if you won the lottery? If you could live anywhere, where would you live?
WERE: Use 'were' instead of 'was' for all persons in formal/written English — If I were you, I would accept the offer. (NOT 'If I was you')
FIRST vs SECOND: First Conditional: 'If it rains, I will stay home.' (it might really rain — real possibility). Second Conditional: 'If it rained on my birthday, I would be disappointed.' (hypothetical — imagining it).
COULD/MIGHT: Would can be replaced with could or might — If I had a car, I could drive to work. If she studied, she might pass.
COMMON USES: Giving advice (If I were you...), imagining alternatives (If I were rich...), polite requests (Would you mind if...).`
      },
      {
        title: "Reported Speech (Dolaylı Anlatım)", level: "B2", displayOrder: 6,
        content: `Reported Speech (Indirect Speech) is used to report what someone said without using their exact words.
TENSE BACKSHIFT: When reporting past speech, verb tenses shift back one tense.
Present Simple → Past Simple: "I eat pizza." → She said (that) she ate pizza.
Present Continuous → Past Continuous: "I am watching TV." → He said he was watching TV.
Past Simple → Past Perfect: "I went to school." → She said she had gone to school.
Present Perfect → Past Perfect: "I have finished." → He said he had finished.
Will → Would: "I will come." → She said she would come.
Can → Could: "I can help." → He said he could help.
PRONOUNS AND REFERENCES CHANGE: "I" → he/she. "my" → his/her. "here" → there. "now" → then. "today" → that day. "yesterday" → the day before. "tomorrow" → the next day.
REPORTING VERBS: said, told (always needs an object: told me), asked, explained, mentioned, admitted, promised, warned.
QUESTIONS: "Are you happy?" → She asked if I was happy. "Where do you live?" → He asked where I lived. (Use 'if/whether' for yes/no questions.)
COMMANDS: "Open the door!" → She told him to open the door. "Don't be late!" → He told her not to be late.`
      },
    ]
  },
  {
    book: { title: "İleri Seviye İngilizce Dilbilgisi", level: "C1", description: "C1 seviyesi için ileri düzey dilbilgisi yapıları" },
    topics: [
      {
        title: "Third Conditional (Üçüncü Koşul)", level: "C1", displayOrder: 1,
        content: `Third Conditional expresses unreal, hypothetical situations in the past — imagining how the past could have been different.
STRUCTURE: If + Past Perfect, would have + past participle.
POSITIVE: If I had studied harder, I would have passed the exam. If she had taken the job, she would have been happy.
NEGATIVE: If he hadn't driven so fast, he wouldn't have had an accident. If they hadn't been late, they would have caught the flight.
QUESTION: What would have happened if you had taken the other road? Would you have accepted if she had asked?
REGRET AND CRITICISM: Third Conditional often expresses regret about past choices — If I had known, I would have done things differently. It can also express criticism — If you had listened to me, this wouldn't have happened.
MIXED CONDITIONALS (Third + Second): Mix past condition with present result — If I had taken that job offer (past condition), I would be rich now (present result). If she hadn't moved abroad (past condition), she would still be living near us (present result).
CONTRACTED FORMS: Would have → Would've / 'd have. Had → 'd (I'd studied, she'd known). In informal speech: 'would of' is incorrect — always write 'would have'.
INVERSION: Formal alternative without 'if': Had I known → Had I known the truth, I would have acted differently.`
      },
      {
        title: "Advanced Passive Voice (İleri Edilgen Yapılar)", level: "C1", displayOrder: 2,
        content: `Advanced passive structures allow for sophisticated expression in formal and academic English.
PASSIVE INFINITIVES: Active: People expect him to resign. Passive: He is expected to resign. (subject + passive verb + to infinitive). She appears to have been promoted. He was said to be brilliant.
PASSIVE WITH REPORTING VERBS: Active: People say that he is guilty. Passive options: It is said that he is guilty. / He is said to be guilty.
Common verbs: believe, claim, consider, expect, know, report, say, think, understand.
PASSIVE GERUNDS: Being promoted is a great honor. (subject of sentence). She hated being ignored. (after prepositions). There is no excuse for being rude.
CAUSATIVE HAVE/GET: Have/Get + object + past participle — means you arrange for something to be done. I had my car repaired. She got her hair done. They are having their house renovated. Note difference from active: 'I repaired my car myself' (active) vs 'I had my car repaired' (someone did it for me).
PASSIVE WITH TWO OBJECTS: Active: They gave him an award. Passive A: He was given an award. Passive B: An award was given to him. (Passive A, promoting the person, is more common.)
COMPLEX PASSIVE TENSES: Past Perfect Passive: The work had been completed before the deadline. Future Perfect Passive: The report will have been submitted by Friday.`
      },
      {
        title: "Discourse Markers & Cohesion (Söylem Bağlayıcıları)", level: "C1", displayOrder: 3,
        content: `Discourse markers link ideas and improve the flow and coherence of spoken and written English.
ADDING INFORMATION: Furthermore, moreover, in addition, what is more, additionally, besides, not only...but also.
CONTRASTING: However, nevertheless, nonetheless, on the other hand, in contrast, whereas, while, despite, in spite of, although, even though, yet, that said, be that as it may.
CONCEDING A POINT: Admittedly, granted, of course, certainly, true, it must be acknowledged that, even if, though.
SHOWING RESULT/CONSEQUENCE: Therefore, consequently, as a result, hence, thus, for this reason, so much so that.
GIVING EXAMPLES: For instance, for example, such as, namely, in particular, as illustrated by, to illustrate.
EXPLAINING/CLARIFYING: In other words, that is (to say), to put it differently, to clarify, to elaborate.
SUMMARIZING/CONCLUDING: To sum up, in conclusion, in summary, to conclude, on balance, all things considered, ultimately, in the final analysis.
SEQUENCING: First and foremost, initially, subsequently, following this, meanwhile, at this point, eventually, finally.
EMPHASIZING: Indeed, in fact, as a matter of fact, clearly, above all, particularly, especially, notably, what is particularly striking is.
FORMAL vs INFORMAL: 'However' (formal) vs 'But' (informal). 'Furthermore' (formal) vs 'Also' (informal).`
      },
    ]
  }
];

async function ensureSeeded() {
  const existing = await db.select({ id: grammarBooksTable.id }).from(grammarBooksTable).limit(1);
  if (existing.length === 0) {
    for (const entry of SEED_DATA) {
      const [book] = await db.insert(grammarBooksTable).values(entry.book).returning();
      for (const topic of entry.topics) {
        await db.insert(grammarTopicsTable).values({ bookId: book.id, ...topic });
      }
    }
  }
  await ensureAdditionalTopics();
}

let _additionalTopicsSeeded = false;
async function ensureAdditionalTopics() {
  if (_additionalTopicsSeeded) return;
  _additionalTopicsSeeded = true;
  const books = await db.select().from(grammarBooksTable).orderBy(grammarBooksTable.id);
  if (books.length < 3) return;
  const [book1, book2, book3] = books;
  const existingTitles = new Set((await db.select({ title: grammarTopicsTable.title }).from(grammarTopicsTable)).map(r => r.title));
  const extra: Array<{ bookId: number; level: string; title: string; content: string; displayOrder: number }> = [
    { bookId: book1.id, level: "A2", displayOrder: 6, title: "Countable & Uncountable Nouns (Much, Many, Some, Any)", content: "Countable nouns can be counted individually; uncountable nouns cannot be counted.\nCOUNTABLE: apple/apples, book/books, student/students. Use a/an.\nUNCOUNTABLE: water, milk, bread, rice, information, advice, money, furniture, luggage, weather, music. No plural, no a/an. NEVER 'a water' or 'two musics'.\nMANY (countable): How many apples? I don't have many friends.\nMUCH (uncountable): How much water? I don't have much money.\nA LOT OF (both): I have a lot of friends. There is a lot of water.\nSOME (positive + offers): I have some apples. Would you like some tea?\nANY (negative/questions): I don't have any apples. Is there any water?\nA FEW (countable, small positive): I have a few friends.\nA LITTLE (uncountable, small positive): I have a little money.\nERRORS: Do NOT say 'many water', 'much books', 'an information', 'a furniture'." },
    { bookId: book1.id, level: "A2", displayOrder: 7, title: "Be Going To (Gelecek Plan ve Niyetler)", content: "'Be going to' expresses future plans decided before the moment of speaking, and predictions based on present evidence.\nFORM: Subject + am/is/are + going to + base verb.\nPOSITIVE: I am going to visit Paris. She is going to study medicine.\nNEGATIVE: I am not going to eat meat. He isn't going to come. We aren't going to travel.\nQUESTION: Are you going to call him? What is she going to study?\nPLAN/INTENTION: 'I'm going to buy a new phone.' (already decided before speaking)\nPREDICTION WITH EVIDENCE: Look at those clouds — it's going to rain. Watch out! You're going to fall!\nWILL vs GOING TO: Will = decision at moment of speaking. Going to = plan already made before speaking.\nTIME EXPRESSIONS: next week/month/year, tomorrow, this weekend, soon, after." },
    { bookId: book1.id, level: "A2", displayOrder: 8, title: "Adverbs of Manner (Durum Zarfları)", content: "Adverbs of manner describe HOW an action is performed. They answer 'How?' and come after the verb or verb+object.\nFORMATION: Add -ly to most adjectives: slow->slowly, quick->quickly, careful->carefully, beautiful->beautifully, bad->badly.\nSPELLING: -y adjectives: change y to i + -ly (happy->happily, easy->easily). -le adjectives: drop -e + -y (gentle->gently). -ic adjectives: add -ally (automatic->automatically).\nIRREGULAR: good->well (NOT goodly). fast->fast (NOT fastly). hard->hard (NOTE: 'hardly' means 'almost not'). late->late (NOTE: 'lately' means 'recently').\nPOSITION: AFTER main verb: She speaks English well. He drives carefully. After verb+object: She plays the piano beautifully.\nCOMPARISON: more carefully, most carefully.\nEXAMPLES: He ran fast to catch the bus. She sang beautifully. Please speak more slowly." },
    { bookId: book1.id, level: "A2", displayOrder: 9, title: "Present Perfect Introduction (Ever, Never, Already, Yet)", content: "Present Perfect at A2 level: life experiences and recently completed actions.\nFORM: Subject + have/has + past participle.\nEVER (questions): Have you ever eaten sushi? Has she ever been to London?\nNEVER (negative experience): I have never eaten sushi. We have never tried skiing.\nALREADY (sooner than expected): I have already finished my homework. She has already left.\nYET (negatives/questions — expected to happen): I haven't finished yet. Has he called yet?\nJUST (very recently): I have just arrived. She has just called.\nIRREGULAR PAST PARTICIPLES: go->gone/been. see->seen. eat->eaten. do->done. have->had. make->made. take->taken. write->written.\nPP vs PAST SIMPLE: 'Have you ever visited Rome?' (experience, no time) vs 'I visited Rome in 2019.' (specific time).\nCOMMON: Have you ever been to...? I've never felt like this. Have you done your homework yet?" },
    { bookId: book2.id, level: "B1", displayOrder: 5, title: "Past Continuous (Geçmişte Süren Eylemler)", content: "Past Continuous describes actions in progress at a specific past time, or interrupted by another event.\nFORM: Subject + was/were + verb-ing. WAS: I, he, she, it. WERE: you, we, they.\nPOSITIVE: I was sleeping at midnight. She was cooking dinner at 7 pm.\nNEGATIVE: I wasn't sleeping. They weren't watching TV.\nQUESTION: Were you sleeping? What was she doing?\nUSE 1 — IN PROGRESS AT SPECIFIC TIME: At 8 o'clock, I was having breakfast.\nUSE 2 — INTERRUPTED ACTION: I was taking a shower when the phone rang. (Past Continuous = longer background; Past Simple = shorter interruption; use 'when')\nUSE 3 — TWO PARALLEL ACTIONS: While I was cooking, my husband was setting the table. (use 'while')\nTIME EXPRESSIONS: at this time yesterday, when, while, as.\nPAST SIMPLE vs PAST CONTINUOUS: 'I read a book last night.' (completed) vs 'I was reading a book when she called.' (in progress)" },
    { bookId: book2.id, level: "B1", displayOrder: 6, title: "Present Perfect vs Past Simple (Fark ve Kullanım)", content: "The most important distinction for intermediate learners.\nPAST SIMPLE — use when: Action completed AND specific past time mentioned. 'I saw that film last week.' 'She graduated in 2018.'\nPRESENT PERFECT — use when: Exact time NOT mentioned (only that it happened). 'I have seen that film.' 'She has graduated.'\nKEY SIGNAL WORDS — Past Simple: yesterday, last week/month/year, in 2020, ago, when.\nKEY SIGNAL WORDS — Present Perfect: ever, never, already, yet, just, recently, so far, in the last few years, today/this week (still ongoing).\nBRITISH vs AMERICAN: British prefers Present Perfect for recent events: 'I've just eaten.' American uses Past Simple more.\nEXPERIENCE (PP): 'I have been to Paris three times.' (life experience count)\nSPECIFIC EVENT (PS): 'I went to Paris in 2019.' (specific trip with details)\nRESULT FOCUS (PP): 'She has broken her arm.' (still broken) vs 'She broke her arm in the accident.' (specific, over)" },
    { bookId: book2.id, level: "B1", displayOrder: 7, title: "Relative Clauses — Defining (Kim, Hangi, Olan)", content: "Defining relative clauses give essential information about a noun. Without the clause, the sentence is unclear. NO commas.\nRELATIVE PRONOUNS: WHO (people), WHICH (things/animals), THAT (people or things — informal), WHERE (places), WHEN (times), WHOSE (possession).\nWHO: The man who called you is outside. She is the teacher who helped me most.\nWHICH: The book which I bought is fascinating. The car which broke down has been repaired.\nTHAT: The man that called. The book that I bought. (informal replacement for who/which)\nWHERE: The city where I was born is beautiful.\nWHEN: I remember the day when we first met.\nWHOSE: The student whose homework was best got a prize.\nOMITTING THE PRONOUN (when it is the OBJECT): The film (that) I watched was great. The person (who) you met is my boss.\nDEFINING vs NON-DEFINING: Defining (no commas) — essential info. Non-defining (with commas) — extra info that can be removed." },
    { bookId: book2.id, level: "B1", displayOrder: 8, title: "Zero & First Conditional (Tip 0 ve Tip 1)", content: "Conditionals express relationships between conditions and results.\nZERO CONDITIONAL — general truths and facts:\nSTRUCTURE: If + Present Simple, Present Simple.\nUSE: Always true results — scientific facts, general rules, habits.\nEXAMPLES: If you heat water to 100 degrees, it boils. If it rains, plants grow. If you don't sleep enough, you feel tired. (When can replace If in Zero Conditional)\nFIRST CONDITIONAL — real future possibilities:\nSTRUCTURE: If + Present Simple, will + base verb.\nEXAMPLES: If it rains tomorrow, I will stay at home. If you study hard, you will pass. If they don't hurry, they will miss the train.\nKEY DIFFERENCE: Zero = always true (general fact). First = might be true in the future (specific possibility).\nUNLESS = if not: Unless you hurry, you will be late. = If you don't hurry, you will be late.\nMODAL VARIATIONS: If you have time, you can/could/should/might visit us." },
    { bookId: book2.id, level: "B1", displayOrder: 9, title: "Used To (Eskiden Yapılan Alışkanlıklar)", content: "'Used to' describes habits or states that existed in the past but no longer exist now.\nFORM: Subject + used to + base verb.\nPOSITIVE: I used to smoke, but I stopped. She used to play tennis. He used to be very shy as a child.\nNEGATIVE: I didn't use to like vegetables. (NOTE: 'use to' not 'used to' after did.)\nQUESTION: Did you use to play football? Where did you use to live?\nSTATES AND HABITS BOTH: Used to works for habits AND states. 'I used to go swimming' (habit). 'I used to be very tall' (state).\nUSED TO vs PAST SIMPLE: Past Simple = single or repeated past event. 'Used to' strongly implies the habit NO LONGER exists.\nWOULD for past habits (NOT states): 'I would go swimming' (OK). 'I would be shy' (WRONG — use 'used to be shy').\nGET USED TO: 'Get used to + gerund' = become accustomed to. 'I am getting used to waking up early.'\nBE USED TO: 'Be used to + gerund' = already accustomed to. 'I am used to working long hours.'" },
    { bookId: book2.id, level: "B2", displayOrder: 2, title: "Past Perfect (Geçmişin Geçmişi)", content: "Past Perfect describes an action completed BEFORE another past action or before a specific time in the past.\nFORM: Subject + had + past participle (same for all subjects).\nPOSITIVE: I had already eaten when she arrived. She had left before the party started.\nNEGATIVE: I hadn't finished when she called. He hadn't eaten anything all day.\nQUESTION: Had you finished before she arrived? Had they ever tried sushi before?\nPAST PERFECT vs PAST SIMPLE: Use Past Perfect for EARLIER action, Past Simple for LATER action. 'When I arrived, the train had already left.' (First: train left. Then: I arrived.)\nCOMMON SIGNAL WORDS: before, after, by the time, already, just, never, when (with sequence meaning), because.\nOPTIONAL when sequence is clear: 'After she finished her homework, she watched TV.' (correct with or without had)\nREPORTED SPEECH: Past Simple -> Past Perfect. 'I went to the store.' -> She said she had gone." },
    { bookId: book2.id, level: "B2", displayOrder: 3, title: "Future Forms (Will, Going To, Present Continuous)", content: "English has several ways to express the future depending on the type of action.\nWILL + BASE VERB:\n1. Spontaneous decisions (made at moment of speaking): 'The phone is ringing — I'll get it!'\n2. Predictions without evidence (opinion/belief): I think it will rain. She will probably get the job.\n3. Promises, offers, threats, warnings: I'll help you move. I'll call you tonight.\n4. Future facts: The sun will rise at 6:30 tomorrow.\nBE GOING TO:\n1. Plans/intentions decided before speaking: I'm going to study medicine. (already decided)\n2. Predictions with present evidence: Those clouds! It's going to rain. Watch out — you're going to fall!\nPRESENT CONTINUOUS (future arrangements with other people): I'm meeting Tom at 5 pm tomorrow. She's flying to London on Friday.\nPRESENT SIMPLE (fixed timetables): The train leaves at 8:15. The film starts at 7 pm.\nQUICK GUIDE: Will (spontaneous/opinion/promise). Going to (prior plan/evidence). Present Continuous (appointment/arrangement). Present Simple (timetable)." },
    { bookId: book2.id, level: "B2", displayOrder: 5, title: "Gerunds & Infinitives (To Go vs. Going)", content: "Gerunds (-ing form used as noun) and infinitives (to + base verb) — the choice depends on what comes before.\nGERUND uses:\nAS SUBJECT: Swimming is great exercise. Reading improves vocabulary.\nAFTER PREPOSITIONS (always gerund after prepositions): good at cooking, thank you for coming, looking forward to meeting, after finishing work.\nAFTER THESE VERBS (enjoy, avoid, mind, suggest, finish, keep, practice, quit, miss, deny, imagine, recommend, risk, fancy, can't help, can't stand): I enjoy swimming. He avoids eating fast food.\nINFINITIVE uses:\nAFTER THESE VERBS (want, need, decide, plan, hope, expect, agree, refuse, manage, offer, promise, attempt, seem, tend): I want to go. She decided to study. He managed to pass.\nAFTER ADJECTIVES: It is important to study. She was surprised to see me.\nVERBS + OBJECT + INFINITIVE (tell, ask, want, allow, advise, teach, force, encourage, remind, warn): She told me to leave.\nVERBS WITH BOTH — DIFFERENT MEANING:\nforget: 'I forgot to lock the door.' (didn't do it) vs 'I'll never forget meeting the president.' (memory).\nremember: 'Remember to call her.' (don't forget future) vs 'I remember seeing him.' (recall memory).\nstop: 'He stopped smoking.' (quit forever) vs 'He stopped to smoke.' (paused in order to).\ntry: 'Try adding more salt.' (experiment) vs 'Try to be on time.' (make an effort)." },
    { bookId: book2.id, level: "B2", displayOrder: 6, title: "Modals of Deduction (Must, Might, Can't)", content: "Modals of deduction express how certain we are about something based on evidence or logic.\nPRESENT DEDUCTION:\nMUST (strong certainty — positive): You must be tired after working all day. She must be at home — the lights are on.\nCAN'T / CANNOT (strong certainty — negative, logical impossibility): That can't be right — I checked twice. She can't be at work — it's Sunday.\nMIGHT / MAY / COULD (possibility — not certain): She might be at the library. He could be sleeping.\nPAST DEDUCTION (add 'have + past participle'):\nMUST HAVE + PP: He must have left early — his car is not here. She must have misunderstood.\nCAN'T HAVE + PP: She can't have said that — she's always so kind. He can't have finished already.\nMIGHT HAVE / MAY HAVE / COULD HAVE + PP: She might have taken the wrong train. He could have forgotten.\nSHOULDN'T HAVE + PP (criticism of past action): You shouldn't have told him — it was a secret.\nSHOULD HAVE + PP (unrealized expectation): They should have arrived by now. You should have called me!\nCERTAINTY SCALE: must (90%+ certain) -> might/may/could (50%) -> can't (almost impossible)." },
    { bookId: book3.id, level: "C1", displayOrder: 4, title: "Inversion (Devrik Cümle Yapıları)", content: "Inversion changes normal word order (subject + verb) to verb + subject for emphasis and formality.\nNEGATIVE ADVERBIAL INVERSION:\nNEVER: Never have I seen such a beautiful sunset. (= I have never seen...)\nRARELY / SELDOM: Rarely does she make a mistake. Seldom have we experienced such generosity.\nHARDLY ... when/before: Hardly had I closed my eyes when the alarm rang.\nNO SOONER ... THAN: No sooner had I sat down than the doorbell rang.\nNOT ONLY ... BUT ALSO: Not only did he arrive late, but he also forgot his report.\nAT NO TIME: At no time did the management consider the workers' safety.\nUNDER NO CIRCUMSTANCES: Under no circumstances should you open that door.\nONLY INVERSION: Only then did I realize my mistake. Only after the meeting did she understand. Only by working hard can you succeed.\nNOR / NEITHER INVERSION: She doesn't smoke, nor does she drink.\nCONDITIONAL INVERSION (formal, omitting 'if'): Should you need help, please call. Had I known, I would have helped. Were I in your position, I would refuse.\nFUNCTION: Inversions add dramatic emphasis, signal formality, and are used in formal writing and speeches." },
    { bookId: book3.id, level: "C1", displayOrder: 5, title: "Cleft Sentences (Vurgulu Cümle Yapıları)", content: "Cleft sentences divide a simple sentence into two clauses to give special emphasis to one element.\nIT-CLEFT STRUCTURE: It + be + emphasized element + relative clause.\nFORM: It is/was + [focus element] + that/who + rest of sentence.\nEXAMPLES: 'John broke the window.' -> 'It was John who broke the window.' (emphasis on WHO) 'It was the window that John broke.' (emphasis on WHAT) 'It was yesterday that John broke the window.' (emphasis on WHEN)\nMORE: It was the new manager who introduced the policy. It was because of the rain that the match was cancelled.\nWH-CLEFT (PSEUDO-CLEFT): What + subject + verb + be + emphasized element.\nEXAMPLES: 'I need a long rest.' -> 'What I need is a long rest.' 'She wants to be understood.' -> 'What she wants is to be understood.'\nALL-CLEFT: All I want is a cup of tea. All he did was smile. All you need is love.\nEMPHASIS PATTERNS: IT-cleft emphasizes nouns/adverbials. WH-cleft emphasizes actions or states.\nNEGATIVE CLEFTS: It wasn't John who broke it — it was Peter. What I didn't expect was her reaction.\nFUNCTION: Cleft sentences create contrast, correct misunderstandings, and add stylistic variety to formal writing." },
    { bookId: book3.id, level: "C1", displayOrder: 6, title: "Participle Clauses (Ortaç Yan Cümleleri)", content: "Participle clauses use participles to shorten and combine clauses, making writing more concise and sophisticated.\nPRESENT PARTICIPLE CLAUSES (-ing):\nSIMULTANEOUS ACTIONS: She sat at the table, reading a book. (= She sat...and was reading) Walking along the street, he noticed an unusual shop. (= While he was walking)\nBECAUSE/SINCE MEANING: Being the eldest child, she had more responsibilities. Not knowing the answer, he remained silent.\nSEQUENCE (then): He took off his coat, hanging it on the hook.\nPAST PARTICIPLE CLAUSES (-ed — passive meaning): Written in 1605, the play is still performed today. Exhausted by the journey, she fell asleep.\nPERFECT PARTICIPLE (having + pp — earlier action): Having finished the report, she submitted it. Having lived in Paris, he spoke French fluently.\nRULES: Subject of participle clause MUST be same as main clause subject.\nCORRECT: 'Entering the room, I saw him.' (I entered, I saw.)\nDANGLING PARTICIPLE ERROR: 'Entering the room, the cat was on the table.' (The cat didn't enter!)\nNOT + participle: Not knowing what to do, she called her friend.\nREPLACING RELATIVE CLAUSES: The man sitting in the corner is my boss. (= who is sitting) Students wishing to apply should contact the office." },
    { bookId: book3.id, level: "C1", displayOrder: 7, title: "Mixed Conditionals (Karma Koşul Cümleleri)", content: "Mixed Conditionals combine elements of different conditional types.\nTYPE 1: PAST CONDITION -> PRESENT RESULT (most common):\nSTRUCTURE: If + Past Perfect (condition in past), would + base verb (result in present).\nEXAMPLES: If I had studied medicine, I would be a doctor now. If she had moved to the UK as a child, she would speak English perfectly. If he hadn't made that investment, he wouldn't be rich now.\nTYPE 2: PRESENT CONDITION -> PAST RESULT:\nSTRUCTURE: If + Past Simple (present unreal condition), would have + past participle (result in past).\nEXAMPLES: If I were braver (but I'm not), I would have applied for the job. If she weren't so impatient, she wouldn't have quit so easily.\nCOMPARISON:\nSecond Conditional: If I had more money now, I would travel. (present->present)\nThird Conditional: If I had had more money then, I would have traveled. (past->past)\nMixed (1): If I had had more money then, I would be rich now. (past->present)\nMixed (2): If I had more money by nature, I would have bought it. (present->past)\nSIGNAL WORDS: 'now', 'currently', 'still', 'at the moment' in result clause often signal Mixed Type 1." },
    { bookId: book3.id, level: "C1", displayOrder: 8, title: "Subjunctive Mood (İstek ve Arzu Kipi — Resmi Kullanım)", content: "The subjunctive expresses wishes, demands, recommendations, and hypothetical situations. Marked by base verb (no -s for he/she/it, 'be' for all persons instead of is/am/are).\nAFTER VERBS OF RECOMMENDATION/DEMAND (suggest, recommend, insist, demand, require, request, propose, urge, advise):\nThe committee recommends that the report be submitted. (NOT is submitted)\nThe manager insisted that she arrive on time. (NOT arrives)\nThe board requires that all staff attend the meeting.\nFORMAL PHRASES (It is essential/vital/important/necessary + that + subjunctive):\nIt is essential that every student complete the assignment. It is vital that the data be verified.\nFIXED EXPRESSIONS: Be that as it may. Come what may. Suffice it to say. So be it. If need be. As it were.\nPAST SUBJUNCTIVE (were — not was):\nIf I were you, I would accept. (NOT 'If I was you' in formal English)\nI wish I were taller. It's time you were more careful. I'd rather she were here.\nAS IF / AS THOUGH + PAST SUBJUNCTIVE: He acts as if he were the boss. She speaks as though she knew everything.\nBRITISH vs AMERICAN: British often uses 'should': 'I suggest that you should apply.' American/Formal: 'I suggest that you apply.'" },
    { bookId: book3.id, level: "C1", displayOrder: 9, title: "Future in the Past (Geçmişten Bakılan Gelecek)", content: "'Future in the Past' expresses plans, predictions, and intentions that were expected at a past point in time.\nCORE CONCEPT: Use past forms of future structures to talk about what someone planned or expected (from their past perspective).\nWAS/WERE GOING TO (plan made but may not have been completed):\nShe was going to call me, but she forgot. I was going to tell you, but you already knew. He was going to study medicine, but he changed his mind.\nWOULD (future-in-the-past in narrative/reported speech):\nShe knew she would succeed one day. He told me he would come at six. Little did she know that she would become famous. The treaty that would end the war was signed in 1945.\nPAST CONTINUOUS (future arrangement from past perspective): She was flying to London the next day. We were meeting at noon, but he cancelled.\nWAS/WERE ABOUT TO (imminent past action): She was about to leave when the phone rang. He was about to give up when he heard the news.\nWAS/WERE TO (formal — planned, scheduled, or fated): The president was to arrive at noon. This was to be her finest hour. They were never to meet again. (literary)\nREPORTED SPEECH TRANSFORMATION: 'It will be sunny.' -> He said it would be sunny. 'We're going to win.' -> They thought they were going to win." },
  ];
  for (const t of extra) {
    if (!existingTitles.has(t.title)) {
      await db.insert(grammarTopicsTable).values(t);
    }
  }
}

/* ─── GET /grammar/books ────────────────────────────────────────── */
router.get("/grammar/books", async (_req, res) => {
  try {
    await ensureSeeded();
    const books = await db.select().from(grammarBooksTable).orderBy(grammarBooksTable.id);
    return res.json(books);
  } catch (e) {
    console.error("grammar books error:", e);
    return res.status(500).json({ detail: "Sunucu hatası" });
  }
});

/* ─── GET /grammar/topics?level=A1 ──────────────────────────────── */
router.get("/grammar/topics", async (req, res) => {
  try {
    await ensureSeeded();
    const { level } = req.query as { level?: string };
    const rows = level && level !== "all"
      ? await db.select().from(grammarTopicsTable).where(eq(grammarTopicsTable.level, level)).orderBy(grammarTopicsTable.displayOrder)
      : await db.select().from(grammarTopicsTable).orderBy(grammarTopicsTable.level, grammarTopicsTable.displayOrder);
    return res.json(rows.map(r => ({
      id: r.id, bookId: r.bookId, title: r.title, level: r.level, displayOrder: r.displayOrder,
      hasLearnContent: !!(r.cachedSummary),
    })));
  } catch (e) {
    console.error("grammar topics error:", e);
    return res.status(500).json({ detail: "Sunucu hatası" });
  }
});

/* ─── GET /grammar/topics/:id/learn ─────────────────────────────── */
router.get("/grammar/topics/:id/learn", async (req, res) => {
  try {
    const [topic] = await db.select().from(grammarTopicsTable)
      .where(eq(grammarTopicsTable.id, Number(req.params.id)));
    if (!topic) return res.status(404).json({ detail: "Konu bulunamadı" });

    if (topic.cachedSummary && topic.cachedExamples && topic.cachedTable) {
      return res.json({
        id: topic.id, title: topic.title, level: topic.level,
        summary: topic.cachedSummary,
        examples: JSON.parse(topic.cachedExamples),
        ruleTable: topic.cachedTable,
      });
    }

    const ai = getOpenAI();
    if (!ai) {
      return res.json({
        id: topic.id, title: topic.title, level: topic.level,
        summary: topic.content.split('\n')[0],
        examples: [],
        ruleTable: "",
      });
    }

    const prompt = `You are an expert English grammar teacher. Based on the following grammar content, create a structured lesson for ${topic.level} level students learning English (their native language is Turkish).

GRAMMAR TOPIC: ${topic.title}
CONTENT:
${topic.content}

Respond in valid JSON with this exact structure:
{
  "summary": "A clear explanation in 4-6 sentences in Turkish, explaining the grammar rule simply and directly. Use Turkish but include the English grammar terms.",
  "examples": [
    {"english": "Example sentence in English", "turkish": "Turkish translation", "highlight": "the key grammar word(s)"},
    {"english": "Second example sentence", "turkish": "Turkish translation", "highlight": "key word(s)"},
    {"english": "Third example sentence", "turkish": "Turkish translation", "highlight": "key word(s)"}
  ],
  "ruleTable": "A clean HTML table (no external CSS, use inline styles with border:1px solid #e2e8f0, padding:8px, border-collapse:collapse) showing the rule structure with columns like Form/Example or Subject/Verb/Result etc. Keep it minimal and clear."
}`;

    const completion = await ai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 1200,
    });

    const data = JSON.parse(completion.choices[0].message.content || "{}");
    const summary = data.summary || topic.content.split('\n')[0];
    const examples = data.examples || [];
    const ruleTable = data.ruleTable || "";

    await db.update(grammarTopicsTable)
      .set({ cachedSummary: summary, cachedExamples: JSON.stringify(examples), cachedTable: ruleTable })
      .where(eq(grammarTopicsTable.id, topic.id));

    return res.json({ id: topic.id, title: topic.title, level: topic.level, summary, examples, ruleTable });
  } catch (e) {
    console.error("grammar learn error:", e);
    return res.status(500).json({ detail: "İçerik yüklenirken hata oluştu" });
  }
});

/* ─── POST /grammar/topics/:id/questions ───────────────────────── */
router.post("/grammar/topics/:id/questions", authMiddleware, async (req: any, res) => {
  try {
    awardPoints(req.userId, "grammar_topic_quiz", { dailyCap: 15, silent: true }).catch(() => {});
    const [topic] = await db.select().from(grammarTopicsTable)
      .where(eq(grammarTopicsTable.id, Number(req.params.id)));
    if (!topic) return res.status(404).json({ detail: "Konu bulunamadı" });

    const ai = getOpenAI();
    if (!ai) return res.status(503).json({ detail: "AI servisi kullanılamıyor" });

    const prompt = `You are an expert English grammar teacher creating practice questions for ${topic.level} level students (Turkish native speakers).

GRAMMAR TOPIC: ${topic.title}
CONTENT:
${topic.content}

Create exactly 5 practice questions covering different types. Use these types in order: fill_blank, multiple_choice, sentence_fix, translate, word_order.

Rules:
- All questions must be directly related to the grammar content above
- Questions should be appropriate for ${topic.level} level
- Make 3 wrong options plausible but clearly incorrect
- "translate" type: give a Turkish sentence to translate to English
- "word_order" type: give scrambled words to arrange (show words as a comma-separated list in the question)
- "sentence_fix" type: show a sentence with a grammar error, options are 4 corrected versions (only 1 is right)

Respond in valid JSON:
{
  "questions": [
    {
      "type": "fill_blank",
      "question": "She _____ to school every day.",
      "options": ["go", "goes", "going", "gone"],
      "correct": 1,
      "explanation": "Üçüncü tekil şahıs (he/she/it) için Present Simple'da fiile -s/-es eklenir."
    },
    {
      "type": "multiple_choice",
      "question": "Which sentence is grammatically correct?",
      "options": ["She don't like apples.", "She doesn't likes apples.", "She doesn't like apples.", "She not likes apples."],
      "correct": 2,
      "explanation": "he/she/it için olumsuz yapıda 'doesn't' kullanılır ve fiil yalın hâlde kalır."
    },
    {
      "type": "sentence_fix",
      "question": "Find the error and choose the corrected sentence: 'I goed to the market yesterday.'",
      "options": ["I go to the market yesterday.", "I gone to the market yesterday.", "I went to the market yesterday.", "I have go to the market yesterday."],
      "correct": 2,
      "explanation": "'go' fiilinin geçmiş zaman formu düzensizdir: went."
    },
    {
      "type": "translate",
      "question": "Türkçe cümleyi İngilizce'ye çevirin: 'Dün okula gitmedim.'",
      "options": ["I don't go to school yesterday.", "I didn't went to school yesterday.", "I didn't go to school yesterday.", "I wasn't go to school yesterday."],
      "correct": 2,
      "explanation": "Geçmiş zaman olumsuzunda 'didn't + yalın fiil' yapısı kullanılır."
    },
    {
      "type": "word_order",
      "question": "Verilen kelimeleri doğru sıraya koyun: 'every / coffee / morning / drinks / she'",
      "options": ["She drinks coffee every morning.", "Every morning she coffee drinks.", "She every morning drinks coffee.", "Coffee she drinks every morning."],
      "correct": 0,
      "explanation": "İngilizce'de temel cümle yapısı: Özne + Fiil + Nesne + Zaman zarfı."
    }
  ]
}`;

    const completion = await ai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 1200,
    });

    const data = JSON.parse(completion.choices[0].message.content || "{}");
    return res.json({ questions: data.questions || [] });
  } catch (e) {
    console.error("grammar questions error:", e);
    return res.status(500).json({ detail: "Soru üretilemedi" });
  }
});

/* ─── POST /grammar/ai-coach ────────────────────────────────────── */
router.post("/grammar/ai-coach", authMiddleware, async (req: any, res) => {
  try {
    const { topicId, question, userAnswer, correctAnswer, questionType, topicTitle } = req.body;
    awardPoints(req.userId, "grammar_coach_ask", { dailyCap: 20, silent: true }).catch(() => {});

    let topicContent = "";
    if (topicId) {
      const [topic] = await db.select({ content: grammarTopicsTable.content })
        .from(grammarTopicsTable).where(eq(grammarTopicsTable.id, Number(topicId)));
      topicContent = topic?.content || "";
    }

    const ai = getOpenAI();
    if (!ai) return res.json({ message: `Doğru cevap: "${correctAnswer}". Kuralı tekrar gözden geçirmeyi deneyin.` });

    const prompt = `You are a supportive English grammar coach for Turkish students. A student answered a question incorrectly.

GRAMMAR TOPIC: ${topicTitle || ""}
BOOK CONTENT: ${topicContent.slice(0, 800)}

QUESTION: ${question}
STUDENT'S WRONG ANSWER: ${userAnswer}
CORRECT ANSWER: ${correctAnswer}
QUESTION TYPE: ${questionType}

Write a SHORT, encouraging explanation in Turkish (3-4 sentences max):
1. Acknowledge they got it wrong briefly (don't shame them)
2. Explain WHY the correct answer is right, referencing the grammar rule
3. Give a memory tip or simple example to help remember

Keep it warm, clear, and helpful. Use simple Turkish.`;

    const completion = await ai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 300,
    });

    return res.json({ message: completion.choices[0].message.content || "" });
  } catch (e) {
    console.error("grammar ai-coach error:", e);
    return res.status(500).json({ detail: "AI Coach yanıt veremedi" });
  }
});

/* ─── GET /grammar/progress?username=X ─────────────────────────── */
router.get("/grammar/progress", async (req, res) => {
  try {
    const { username } = req.query as { username?: string };
    if (!username) return res.json([]);
    const rows = await db.select().from(grammarProgressTable)
      .where(eq(grammarProgressTable.username, username));
    return res.json(rows);
  } catch (e) {
    return res.status(500).json({ detail: "Sunucu hatası" });
  }
});

/* ─── POST /grammar/progress ────────────────────────────────────── */
router.post("/grammar/progress", async (req, res) => {
  try {
    const { username, topicId, correctAnswers, totalAnswered, completed } = req.body;
    if (!username || !topicId) return res.status(400).json({ detail: "Eksik alan" });

    const existing = await db.select().from(grammarProgressTable)
      .where(and(eq(grammarProgressTable.username, username), eq(grammarProgressTable.topicId, Number(topicId)))).limit(1);

    if (existing.length > 0) {
      await db.update(grammarProgressTable)
        .set({
          correctAnswers: (existing[0].correctAnswers || 0) + (correctAnswers || 0),
          totalAnswered: (existing[0].totalAnswered || 0) + (totalAnswered || 0),
          completed: completed || existing[0].completed,
          completedAt: completed ? new Date() : existing[0].completedAt,
          updatedAt: new Date(),
        })
        .where(eq(grammarProgressTable.id, existing[0].id));
    } else {
      await db.insert(grammarProgressTable).values({
        username, topicId: Number(topicId),
        correctAnswers: correctAnswers || 0,
        totalAnswered: totalAnswered || 0,
        completed: completed || false,
        completedAt: completed ? new Date() : null,
        updatedAt: new Date(),
      });
    }
    return res.json({ ok: true });
  } catch (e) {
    console.error("grammar progress error:", e);
    return res.status(500).json({ detail: "Sunucu hatası" });
  }
});

/* ─── POST /grammar/books (admin — add a book with topics) ─────── */
router.post("/grammar/books", async (req, res) => {
  try {
    const { title, level, description, topics } = req.body;
    if (!title || !level) return res.status(400).json({ detail: "title ve level zorunlu" });
    const [book] = await db.insert(grammarBooksTable).values({ title, level, description }).returning();
    if (Array.isArray(topics)) {
      for (const t of topics) {
        await db.insert(grammarTopicsTable).values({ bookId: book.id, ...t });
      }
    }
    return res.status(201).json(book);
  } catch (e) {
    return res.status(500).json({ detail: "Sunucu hatası" });
  }
});

/* ─── DELETE /grammar/cache/:id (refresh AI learn cache) ───────── */
router.delete("/grammar/cache/:id", async (req, res) => {
  try {
    await db.update(grammarTopicsTable)
      .set({ cachedSummary: null, cachedExamples: null, cachedTable: null })
      .where(eq(grammarTopicsTable.id, Number(req.params.id)));
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ detail: "Sunucu hatası" });
  }
});

export default router;
