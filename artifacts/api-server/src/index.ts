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
      { type: "multiple_choice", question: "Which is the correct greeting?", options: ["Good morning!", "Good pizza!", "Good cinema!", "Good table!"], correctAnswer: "Good morning!", points: 10, order: 1 },
      { type: "true_false", question: "'Hello' is a greeting word.", options: ["True", "False"], correctAnswer: "True", points: 10, order: 2 },
      { type: "fill_blank", question: "My name ___ John.", options: null, correctAnswer: "is", points: 10, order: 3 },
      { type: "multiple_choice", question: "What color is the sky?", options: ["Red", "Blue", "Green", "Yellow"], correctAnswer: "Blue", points: 10, order: 4 },
      { type: "true_false", question: "A cat is an animal.", options: ["True", "False"], correctAnswer: "True", points: 10, order: 5 },
    ],
  },
  {
    level: "A2",
    title: "A2 Seviyesi - Temel Alıştırmalar",
    passingScore: 60,
    timeLimit: 15,
    questions: [
      { type: "multiple_choice", question: "She ___ to school every day.", options: ["go", "goes", "going", "went"], correctAnswer: "goes", points: 10, order: 1 },
      { type: "true_false", question: "'Yesterday' refers to the past.", options: ["True", "False"], correctAnswer: "True", points: 10, order: 2 },
      { type: "fill_blank", question: "There ___ two apples on the table.", options: null, correctAnswer: "are", points: 10, order: 3 },
      { type: "multiple_choice", question: "What is the plural of 'child'?", options: ["childs", "childes", "children", "child"], correctAnswer: "children", points: 10, order: 4 },
      { type: "multiple_choice", question: "I ___ happy yesterday.", options: ["am", "is", "was", "were"], correctAnswer: "was", points: 10, order: 5 },
    ],
  },
  {
    level: "B1",
    title: "B1 Seviyesi - Orta Seviye Alıştırmalar",
    passingScore: 65,
    timeLimit: 20,
    questions: [
      { type: "multiple_choice", question: "She has ___ to Paris before.", options: ["go", "went", "gone", "going"], correctAnswer: "gone", points: 10, order: 1 },
      { type: "true_false", question: "'Nevertheless' is a conjunction.", options: ["True", "False"], correctAnswer: "True", points: 10, order: 2 },
      { type: "fill_blank", question: "If I ___ you, I would study harder.", options: null, correctAnswer: "were", points: 10, order: 3 },
      { type: "multiple_choice", question: "The word 'sufficient' means:", options: ["not enough", "enough", "too much", "nothing"], correctAnswer: "enough", points: 10, order: 4 },
      { type: "multiple_choice", question: "By the time she arrived, he ___ left.", options: ["has", "have", "had", "will have"], correctAnswer: "had", points: 10, order: 5 },
    ],
  },
  {
    level: "B2",
    title: "B2 Seviyesi - Orta-Üstü Alıştırmalar",
    passingScore: 65,
    timeLimit: 20,
    questions: [
      { type: "multiple_choice", question: "Which sentence uses the passive voice correctly?", options: ["The cat chased the mouse.", "The mouse was chased by the cat.", "The mouse chased by cat.", "Cat was mouse chasing."], correctAnswer: "The mouse was chased by the cat.", points: 10, order: 1 },
      { type: "true_false", question: "'Albeit' means 'although'.", options: ["True", "False"], correctAnswer: "True", points: 10, order: 2 },
      { type: "fill_blank", question: "She wishes she ___ more time to study.", options: null, correctAnswer: "had", points: 10, order: 3 },
      { type: "multiple_choice", question: "Choose the correct reported speech: She said, 'I am tired.'", options: ["She said she is tired.", "She said she was tired.", "She said she were tired.", "She said she be tired."], correctAnswer: "She said she was tired.", points: 10, order: 4 },
      { type: "multiple_choice", question: "'Elusive' most nearly means:", options: ["easy to find", "difficult to catch or achieve", "very important", "colourful"], correctAnswer: "difficult to catch or achieve", points: 10, order: 5 },
    ],
  },
  {
    level: "C1",
    title: "C1 Seviyesi - İleri Alıştırmalar",
    passingScore: 70,
    timeLimit: 25,
    questions: [
      { type: "multiple_choice", question: "Had she known about the meeting, she ___ attended.", options: ["would", "would have", "will have", "had"], correctAnswer: "would have", points: 10, order: 1 },
      { type: "true_false", question: "'Perspicacious' means having a ready insight into things.", options: ["True", "False"], correctAnswer: "True", points: 10, order: 2 },
      { type: "fill_blank", question: "Not only ___ he arrive late, but he also forgot the report.", options: null, correctAnswer: "did", points: 10, order: 3 },
      { type: "multiple_choice", question: "'Propitious' means:", options: ["giving a sign of future success", "extremely angry", "very confused", "deeply sad"], correctAnswer: "giving a sign of future success", points: 10, order: 4 },
      { type: "multiple_choice", question: "Which is correct? 'He suggested that she ___'", options: ["should leaves", "leave", "leaves", "left"], correctAnswer: "leave", points: 10, order: 5 },
    ],
  },
  {
    level: "C2",
    title: "C2 Seviyesi - Yetkinlik Alıştırmaları",
    passingScore: 75,
    timeLimit: 30,
    questions: [
      { type: "multiple_choice", question: "Choose the most appropriate synonym for 'recondite':", options: ["common", "obscure and known by few", "vibrant", "straightforward"], correctAnswer: "obscure and known by few", points: 10, order: 1 },
      { type: "true_false", question: "'Sanguine' can mean optimistic about the future.", options: ["True", "False"], correctAnswer: "True", points: 10, order: 2 },
      { type: "fill_blank", question: "The professor's lecture was so ___ (extremely detailed) that students struggled to take notes.", options: null, correctAnswer: "exhaustive", points: 10, order: 3 },
      { type: "multiple_choice", question: "Identify the sentence with correct subjunctive mood:", options: ["I wish I was taller.", "If I were you, I would go.", "She insists that he goes.", "It is vital that he comes."], correctAnswer: "If I were you, I would go.", points: 10, order: 4 },
      { type: "multiple_choice", question: "'Garrulous' means:", options: ["silent", "excessively talkative", "thoughtful", "generous"], correctAnswer: "excessively talkative", points: 10, order: 5 },
    ],
  },
];

async function ensureSystemQuizzes() {
  try {
    for (const sq of SYSTEM_QUIZZES) {
      const existing = await db.select({ id: quizzesTable.id })
        .from(quizzesTable)
        .where(and(eq(quizzesTable.level as any, sq.level), isNull(quizzesTable.teacherId)))
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
