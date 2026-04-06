import app from "./app";
import { logger } from "./lib/logger";
import { seedDatabase } from "./seed.js";
import { pool } from "@workspace/db";
import { db, quizzesTable, questionsTable } from "@workspace/db";
import { eq, isNull, and } from "drizzle-orm";

const rawPort = process.env["PORT"] ?? "3000";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// ── Startup migrations — schema değişikliklerini güvenle uygular ─────────────
async function runStartupMigrations() {
  const migrations = [
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS student_number VARCHAR(20)`,
    `ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS level VARCHAR(10)`,
  ];
  for (const sql of migrations) {
    try {
      await pool.query(sql);
      logger.info({ sql }, "Startup migration applied");
    } catch (err: any) {
      logger.warn({ sql, err: err.message }, "Startup migration skipped");
    }
  }
}

// ── Sistem quizlerini ekle (her seviye için, teacherId NULL) ─────────────────
const SYSTEM_QUIZZES = [
  {
    level: "A1",
    title: "A1 Seviyesi - Temel Alıştırmalar",
    passingScore: 60,
    timeLimit: 15,
    questions: [
      { type: "multiple_choice", question: "Hello, I ___ a student at Sphere English.", options: ["is","are","am","be"], correctAnswer: "am", points: 10, order: 0 },
      { type: "multiple_choice", question: "___ your name?", options: ["Who","What's","Where","How"], correctAnswer: "What's", points: 10, order: 1 },
      { type: "multiple_choice", question: "She ___ in London.", options: ["live","living","lives","is live"], correctAnswer: "lives", points: 10, order: 2 },
      { type: "multiple_choice", question: "There are two ___ on the desk.", options: ["book","books","bookes","a book"], correctAnswer: "books", points: 10, order: 3 },
      { type: "multiple_choice", question: "___ you speak English?", options: ["Do","Does","Are","Is"], correctAnswer: "Do", points: 10, order: 4 },
      { type: "multiple_choice", question: "I don't have ___ money.", options: ["some","any","a","many"], correctAnswer: "any", points: 10, order: 5 },
      { type: "multiple_choice", question: "My brother ___ a new car.", options: ["have","having","has","is have"], correctAnswer: "has", points: 10, order: 6 },
      { type: "multiple_choice", question: "We go to the gym ___ Tuesdays.", options: ["in","at","on","to"], correctAnswer: "on", points: 10, order: 7 },
      { type: "multiple_choice", question: "Where ___ they from?", options: ["is","are","am","do"], correctAnswer: "are", points: 10, order: 8 },
      { type: "multiple_choice", question: "I ___ coffee, but I love tea.", options: ["doesn't like","am not like","not like","don't like"], correctAnswer: "don't like", points: 10, order: 9 },
    ],
  },
  {
    level: "A2",
    title: "A2 Seviyesi - Temel Alıştırmalar",
    passingScore: 60,
    timeLimit: 15,
    questions: [
      { type: "multiple_choice", question: "Last night, we ___ to the cinema.", options: ["go","went","gone","going"], correctAnswer: "went", points: 10, order: 0 },
      { type: "multiple_choice", question: "Is this book ___?", options: ["you","your","yours","you're"], correctAnswer: "yours", points: 10, order: 1 },
      { type: "multiple_choice", question: "London is ___ than Istanbul.", options: ["more expensive","expensive","most expensive","expensiver"], correctAnswer: "more expensive", points: 10, order: 2 },
      { type: "multiple_choice", question: "I was late because I ___ my bus.", options: ["lose","lost","missed","miss"], correctAnswer: "missed", points: 10, order: 3 },
      { type: "multiple_choice", question: "Have you ___ been to Germany?", options: ["never","ever","yet","already"], correctAnswer: "ever", points: 10, order: 4 },
      { type: "multiple_choice", question: "I think it ___ rain tomorrow.", options: ["will","is","going to","shall"], correctAnswer: "will", points: 10, order: 5 },
      { type: "multiple_choice", question: "___ you watching TV when I called?", options: ["Did","Was","Were","Are"], correctAnswer: "Were", points: 10, order: 6 },
      { type: "multiple_choice", question: "I enjoy ___ books in the evening.", options: ["read","to read","reading","to reading"], correctAnswer: "reading", points: 10, order: 7 },
      { type: "multiple_choice", question: "You ___ smoke here; it is forbidden.", options: ["shouldn't","mustn't","do not have to","neednt"], correctAnswer: "mustn't", points: 10, order: 8 },
      { type: "multiple_choice", question: "How ___ sugar do you want?", options: ["many","much","a few","any"], correctAnswer: "much", points: 10, order: 9 },
    ],
  },
  {
    level: "B1",
    title: "B1 Seviyesi - Orta Seviye Alıştırmalar",
    passingScore: 65,
    timeLimit: 20,
    questions: [
      { type: "multiple_choice", question: "If I ___ more time, I would learn Spanish.", options: ["have","will have","had","would have"], correctAnswer: "had", points: 10, order: 0 },
      { type: "multiple_choice", question: "The office ___ every morning.", options: ["cleans","is cleaned","is cleaning","cleaned"], correctAnswer: "is cleaned", points: 10, order: 1 },
      { type: "multiple_choice", question: "I've been working here ___ three years.", options: ["since","during","for","ago"], correctAnswer: "for", points: 10, order: 2 },
      { type: "multiple_choice", question: "I don't mind ___ late tonight.", options: ["work","to work","working","to working"], correctAnswer: "working", points: 10, order: 3 },
      { type: "multiple_choice", question: "That's the man ___ car was stolen.", options: ["who","which","whom","whose"], correctAnswer: "whose", points: 10, order: 4 },
      { type: "multiple_choice", question: "I'm used to ___ up early.", options: ["get","getting","got","to get"], correctAnswer: "getting", points: 10, order: 5 },
      { type: "multiple_choice", question: "You ___ better see a doctor.", options: ["had","would","should","ought"], correctAnswer: "had", points: 10, order: 6 },
      { type: "multiple_choice", question: "He asked me where ___ living.", options: ["did I","I was","was I","am I"], correctAnswer: "I was", points: 10, order: 7 },
      { type: "multiple_choice", question: "By this time next year, I ___ my degree.", options: ["will finish","will be finishing","will have finished","finish"], correctAnswer: "will have finished", points: 10, order: 8 },
      { type: "multiple_choice", question: "We need to ___ a decision soon.", options: ["do","get","take","make"], correctAnswer: "make", points: 10, order: 9 },
    ],
  },
  {
    level: "B2",
    title: "B2 Seviyesi - Orta-Üstü Alıştırmalar",
    passingScore: 65,
    timeLimit: 20,
    questions: [
      { type: "multiple_choice", question: "Despite ___ hard, he failed the exam.", options: ["he studied","studying","study","of studying"], correctAnswer: "studying", points: 10, order: 0 },
      { type: "multiple_choice", question: "I wish I ___ so much cake earlier.", options: ["did not eat","had not eaten","would not eat","have not eaten"], correctAnswer: "had not eaten", points: 10, order: 1 },
      { type: "multiple_choice", question: "The meeting was ___ off due to the strike.", options: ["put","called","set","broken"], correctAnswer: "called", points: 10, order: 2 },
      { type: "multiple_choice", question: "Hardly ___ entered the room when the phone rang.", options: ["I had","had I","I did","did I"], correctAnswer: "had I", points: 10, order: 3 },
      { type: "multiple_choice", question: "He is said ___ the richest man in town.", options: ["being","to be","that he is","he is"], correctAnswer: "to be", points: 10, order: 4 },
      { type: "multiple_choice", question: "You ___ have told me! I would have helped.", options: ["should","must","might","could"], correctAnswer: "could", points: 10, order: 5 },
      { type: "multiple_choice", question: "I'd rather you ___ tell anyone yet.", options: ["do not","would not","did not","will not"], correctAnswer: "did not", points: 10, order: 6 },
      { type: "multiple_choice", question: "Not only ___ late, but he also forgot his notes.", options: ["he was","was he","he arrived","did he"], correctAnswer: "did he", points: 10, order: 7 },
      { type: "multiple_choice", question: "I look forward to ___ our collaboration.", options: ["start","starting","be starting","have started"], correctAnswer: "starting", points: 10, order: 8 },
      { type: "multiple_choice", question: "The manager had the report ___ by his assistant.", options: ["write","wrote","written","writing"], correctAnswer: "written", points: 10, order: 9 },
    ],
  },
  {
    level: "C1",
    title: "C1 Seviyesi - İleri Alıştırmalar",
    passingScore: 70,
    timeLimit: 25,
    questions: [
      { type: "multiple_choice", question: "Supposing you ___ the lottery, what would you do?", options: ["win","won","had won","would win"], correctAnswer: "won", points: 10, order: 0 },
      { type: "multiple_choice", question: "It's high time we ___ a stand against this.", options: ["take","are taking","took","should take"], correctAnswer: "took", points: 10, order: 1 },
      { type: "multiple_choice", question: "Such ___ the fury of the storm that trees were uprooted.", options: ["was","is","had","did"], correctAnswer: "was", points: 10, order: 2 },
      { type: "multiple_choice", question: "He acted as though he ___ the boss.", options: ["is","was","were","be"], correctAnswer: "were", points: 10, order: 3 },
      { type: "multiple_choice", question: "Rarely ___ such a beautiful sunset.", options: ["I have seen","have I seen","saw I","I saw"], correctAnswer: "have I seen", points: 10, order: 4 },
      { type: "multiple_choice", question: "He was ___ with a crime he did not commit.", options: ["accused","blamed","charged","arrested"], correctAnswer: "charged", points: 10, order: 5 },
      { type: "multiple_choice", question: "I'd sooner you ___ stay here tonight.", options: ["not","did not","will not","had not"], correctAnswer: "did not", points: 10, order: 6 },
      { type: "multiple_choice", question: "She was on the ___ of resigning when she got promoted.", options: ["edge","verge","border","limit"], correctAnswer: "verge", points: 10, order: 7 },
      { type: "multiple_choice", question: "Had it not been for your help, I ___ failed.", options: ["would have","will have","should","must have"], correctAnswer: "would have", points: 10, order: 8 },
      { type: "multiple_choice", question: "The company's reputation has been ___ by the scandal.", options: ["enhanced","tarnished","flourished","sustained"], correctAnswer: "tarnished", points: 10, order: 9 },
    ],
  },
  {
    level: "C2",
    title: "C2 Seviyesi - Yetkinlik Alıştırmaları",
    passingScore: 75,
    timeLimit: 30,
    questions: [
      { type: "multiple_choice", question: "The negotiations are ___ with difficulty.", options: ["fraught","filled","laden","burdened"], correctAnswer: "fraught", points: 10, order: 0 },
      { type: "multiple_choice", question: "Were it ___ for his intervention, the deal would have collapsed.", options: ["not","but","only","save"], correctAnswer: "not", points: 10, order: 1 },
      { type: "multiple_choice", question: "He is a ___ of knowledge on the subject.", options: ["font","spring","well","mine"], correctAnswer: "mine", points: 10, order: 2 },
      { type: "multiple_choice", question: "The law is ___ to many different interpretations.", options: ["vulnerable","susceptible","liable","open"], correctAnswer: "open", points: 10, order: 3 },
      { type: "multiple_choice", question: "Try ___ he might, he could not solve the riddle.", options: ["as","although","though","even"], correctAnswer: "as", points: 10, order: 4 },
      { type: "multiple_choice", question: "The project is in ___ until more funding is found.", options: ["limbo","abeyance","suspension","wait"], correctAnswer: "abeyance", points: 10, order: 5 },
      { type: "multiple_choice", question: "His remarks ___ a heated debate.", options: ["sparked","kindled","triggered","all of the above"], correctAnswer: "all of the above", points: 10, order: 6 },
      { type: "multiple_choice", question: "He is a person of ___ integrity.", options: ["impeccable","faultless","stainless","whole"], correctAnswer: "impeccable", points: 10, order: 7 },
      { type: "multiple_choice", question: "The city is a ___ of different cultures.", options: ["melting pot","crossroads","hub","mosaic"], correctAnswer: "melting pot", points: 10, order: 8 },
      { type: "multiple_choice", question: "Lest we ___, let us write down the plan.", options: ["forget","should forget","forgot","will forget"], correctAnswer: "should forget", points: 10, order: 9 },
    ],
  },
];

async function ensureSystemQuizzes() {
  try {
    for (const sq of SYSTEM_QUIZZES) {
      const existing = await db.select({ id: quizzesTable.id })
        .from(quizzesTable)
        .where(and(eq((quizzesTable as any).level, sq.level), isNull(quizzesTable.teacherId)))
        .limit(1);

      if (existing.length > 0) continue;

      const [quiz] = await db.insert(quizzesTable).values({
        title: sq.title,
        level: sq.level as any,
        teacherId: null,
        passingScore: sq.passingScore,
        timeLimit: sq.timeLimit,
        courseId: null,
      }).returning();

      await db.insert(questionsTable).values(
        sq.questions.map((q) => ({
          quizId: quiz.id,
          type: q.type as any,
          question: q.question,
          options: q.options,
          correctAnswer: q.correctAnswer,
          points: q.points,
          order: q.order,
        }))
      );

      logger.info({ level: sq.level, quizId: quiz.id }, `System quiz ensured: ${sq.title}`);
    }
  } catch (err: any) {
    logger.warn({ err: err.message }, "ensureSystemQuizzes: non-fatal error");
  }
}

runStartupMigrations()
  .then(() => ensureSystemQuizzes())
  .then(() => {
    app.listen(port, "0.0.0.0", (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }

      logger.info({ port }, "Server listening");

      seedDatabase().catch((e) => logger.error({ err: e }, "Seed error"));
    });
  });
