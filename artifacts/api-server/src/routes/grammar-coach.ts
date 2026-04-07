import { Router } from "express";
import { db } from "@workspace/db";
import { grammarBooksTable, grammarTopicsTable, grammarProgressTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import OpenAI from "openai";

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
  if (existing.length > 0) return;
  for (const entry of SEED_DATA) {
    const [book] = await db.insert(grammarBooksTable).values(entry.book).returning();
    for (const topic of entry.topics) {
      await db.insert(grammarTopicsTable).values({ bookId: book.id, ...topic });
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
router.post("/grammar/topics/:id/questions", async (req, res) => {
  try {
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
      max_tokens: 1800,
    });

    const data = JSON.parse(completion.choices[0].message.content || "{}");
    return res.json({ questions: data.questions || [] });
  } catch (e) {
    console.error("grammar questions error:", e);
    return res.status(500).json({ detail: "Soru üretilemedi" });
  }
});

/* ─── POST /grammar/ai-coach ────────────────────────────────────── */
router.post("/grammar/ai-coach", async (req, res) => {
  try {
    const { topicId, question, userAnswer, correctAnswer, questionType, topicTitle } = req.body;

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
