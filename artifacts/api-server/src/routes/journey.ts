/**
 * /journey/today — Post-placement 7 günlük başlangıç planı.
 *
 * Yeni kullanıcıya "ne yapacağım?" cevabı veren guided onboarding akışı.
 * Her günün 1-3 görevi var; görev tamamlanmış mı kullanıcı aktivite
 * log'larından türetiliyor (ayrı state tutmuyoruz).
 */
import { Router } from "express";
import {
  db, usersTable,
  userVocabProgressTable,
  pronunciationAssessmentsTable,
  aiTutorConversationsTable,
  lessonProgressTable,
  quizAttemptsTable,
} from "@workspace/db";
import { eq, and, gte, sql } from "drizzle-orm";
import { authMiddleware, type AuthRequest } from "../middlewares/auth.js";

const router = Router();

interface TaskDef {
  id: string;
  label: string;
  href: string;
  icon: string;       // emoji
  checker: (userId: number, since: Date) => Promise<boolean>;
}

async function since24h(): Promise<Date> {
  const d = new Date();
  d.setHours(d.getHours() - 24);
  return d;
}

// Görev tamamlama kontrolleri — son 24 saatte ilgili aktivite oldu mu?
async function didVocabReview(userId: number, since: Date): Promise<boolean> {
  const [{ cc }] = await db.select({ cc: sql<number>`count(*)` })
    .from(userVocabProgressTable)
    .where(and(
      eq(userVocabProgressTable.userId, userId),
      gte(userVocabProgressTable.lastSeenAt, since),
    ));
  return Number(cc) > 0;
}

async function didVocabFavorite(userId: number, since: Date): Promise<boolean> {
  const [{ cc }] = await db.select({ cc: sql<number>`count(*)` })
    .from(userVocabProgressTable)
    .where(and(
      eq(userVocabProgressTable.userId, userId),
      eq(userVocabProgressTable.isFavorite, true),
      gte(userVocabProgressTable.updatedAt, since),
    ));
  return Number(cc) > 0;
}

async function didAiTutor(userId: number, since: Date): Promise<boolean> {
  try {
    const [{ cc }] = await db.select({ cc: sql<number>`count(*)` })
      .from(aiTutorConversationsTable)
      .where(and(
        eq(aiTutorConversationsTable.userId, userId),
        gte(aiTutorConversationsTable.createdAt, since),
      ));
    return Number(cc) > 0;
  } catch { return false; }
}

async function didPronunciation(userId: number, since: Date): Promise<boolean> {
  try {
    const [{ cc }] = await db.select({ cc: sql<number>`count(*)` })
      .from(pronunciationAssessmentsTable)
      .where(and(
        eq(pronunciationAssessmentsTable.userId, userId),
        gte(pronunciationAssessmentsTable.createdAt, since),
      ));
    return Number(cc) > 0;
  } catch { return false; }
}

async function didLesson(userId: number, since: Date): Promise<boolean> {
  const [{ cc }] = await db.select({ cc: sql<number>`count(*)` })
    .from(lessonProgressTable)
    .where(and(
      eq(lessonProgressTable.userId, userId),
      eq(lessonProgressTable.completed, true),
      gte(lessonProgressTable.completedAt, since),
    ));
  return Number(cc) > 0;
}

async function didQuiz(userId: number, since: Date): Promise<boolean> {
  const [{ cc }] = await db.select({ cc: sql<number>`count(*)` })
    .from(quizAttemptsTable)
    .where(and(
      eq(quizAttemptsTable.userId, userId),
      gte(quizAttemptsTable.submittedAt, since),
    ));
  return Number(cc) > 0;
}

// Günlük plan tanımları
const DAILY_PLAN: Record<number, { title: string; subtitle: string; tasks: TaskDef[] }> = {
  1: {
    title: "1. Gün — Tanışma",
    subtitle: "Platforma alıştır: Keşfet'ten 3-5 kelime favorile.",
    tasks: [
      { id: "fav", label: "Keşfet'ten 3 kelime favorile", href: "/m/pratik/kelime-hub", icon: "❤️", checker: didVocabFavorite },
    ],
  },
  2: {
    title: "2. Gün — İlk Tekrar",
    subtitle: "Dün eklediğin kelimeleri tekrar et.",
    tasks: [
      { id: "review", label: "Günlük tekrar oturumu", href: "/m/pratik/kelime-hub", icon: "🔁", checker: didVocabReview },
      { id: "fav2", label: "Yeni 3 kelime favorile", href: "/m/pratik/kelime-hub", icon: "❤️", checker: didVocabFavorite },
    ],
  },
  3: {
    title: "3. Gün — AI ile Sohbet",
    subtitle: "Kişisel AI öğretmene ilk soruyu sor.",
    tasks: [
      { id: "tutor", label: "AI Öğretmen ile sohbet et", href: "/m/pratik/ai-ogretmen", icon: "💬", checker: didAiTutor },
      { id: "review3", label: "Günlük tekrar", href: "/m/pratik/kelime-hub", icon: "🔁", checker: didVocabReview },
    ],
  },
  4: {
    title: "4. Gün — Konuşma Pratiği",
    subtitle: "Konuşma Koçu'nda ilk telaffuz pratiğin.",
    tasks: [
      { id: "pron", label: "Konuşma Koçu'nda 1 pratik", href: "/m/pratik/konusma-kocu", icon: "🎤", checker: didPronunciation },
      { id: "review4", label: "Günlük tekrar", href: "/m/pratik/kelime-hub", icon: "🔁", checker: didVocabReview },
    ],
  },
  5: {
    title: "5. Gün — Senaryoda Konuş",
    subtitle: "Gerçek iş senaryosunda rol yapma.",
    tasks: [
      { id: "scene", label: "Konuşma sahnesi dene", href: "/m/pratik/konusma-sahneleri", icon: "🎭", checker: didPronunciation },
      { id: "review5", label: "Günlük tekrar", href: "/m/pratik/kelime-hub", icon: "🔁", checker: didVocabReview },
    ],
  },
  6: {
    title: "6. Gün — Quiz Zamanı",
    subtitle: "Bir alıştırma çöz, nerede olduğunu gör.",
    tasks: [
      { id: "quiz", label: "Bir alıştırma çöz", href: "/quizzes", icon: "📝", checker: didQuiz },
      { id: "review6", label: "Günlük tekrar", href: "/m/pratik/kelime-hub", icon: "🔁", checker: didVocabReview },
    ],
  },
  7: {
    title: "7. Gün — Bir Haftayı Tamamla",
    subtitle: "Bir ders tamamla, haftanı sertifikala.",
    tasks: [
      { id: "lesson", label: "Bir ders tamamla", href: "/courses", icon: "📚", checker: didLesson },
      { id: "review7", label: "Son tekrar", href: "/m/pratik/kelime-hub", icon: "🔁", checker: didVocabReview },
    ],
  },
};

/**
 * GET /journey/today — kullanıcının bugünkü planı.
 */
router.get("/journey/today", authMiddleware, async (req: AuthRequest, res) => {
  const uid = req.userId!;
  const [user] = await db.select({
    createdAt: usersTable.createdAt,
    placementCompleted: usersTable.placementTestCompleted,
  }).from(usersTable).where(eq(usersTable.id, uid)).limit(1);

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  // Journey başlangıcı: kayıt tarihi (basit yaklaşım — placement complete timestamp'i yok)
  const startedAt = user.createdAt instanceof Date ? user.createdAt : new Date(user.createdAt as any);
  const now = new Date();
  const daysSince = Math.floor((now.getTime() - startedAt.getTime()) / (1000 * 60 * 60 * 24));
  const dayNumber = Math.max(1, Math.min(7, daysSince + 1));
  const isCompletedWeek = daysSince >= 7;

  const plan = DAILY_PLAN[dayNumber];
  const since = await since24h();

  // Her görev için completion kontrolü
  const tasks = await Promise.all(
    plan.tasks.map(async (t) => ({
      id: t.id,
      label: t.label,
      href: t.href,
      icon: t.icon,
      completed: await t.checker(uid, since).catch(() => false),
    })),
  );

  const allDone = tasks.every(t => t.completed);

  res.json({
    dayNumber,
    totalDays: 7,
    isCompletedWeek,
    title: plan.title,
    subtitle: plan.subtitle,
    tasks,
    allDone,
    placementCompleted: user.placementCompleted,
  });
});

export default router;
