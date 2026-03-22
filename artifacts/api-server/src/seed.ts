import bcrypt from "bcryptjs";
import { db, usersTable, coursesTable, modulesTable, lessonsTable, liveClassesTable, quizzesTable, questionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./lib/logger.js";

export async function seedDatabase() {
  try {
    const existing = await db.select().from(usersTable).where(eq(usersTable.email, "admin@sphereenglish.com")).limit(1);
    if (existing.length > 0) {
      logger.info("Database already seeded, skipping.");
      return;
    }

    logger.info("Seeding database...");

    const adminPassword = await bcrypt.hash("admin123", 10);
    const teacherPassword = await bcrypt.hash("teacher123", 10);
    const studentPassword = await bcrypt.hash("student123", 10);

    const [admin] = await db.insert(usersTable).values({
      email: "admin@sphereenglish.com",
      password: adminPassword,
      role: "admin",
      firstName: "System",
      lastName: "Admin",
      totalPoints: 0,
      streak: 0,
      badges: [],
    }).returning();

    const [teacher1] = await db.insert(usersTable).values({
      email: "sarah.johnson@sphereenglish.com",
      password: teacherPassword,
      role: "teacher",
      firstName: "Sarah",
      lastName: "Johnson",
      totalPoints: 0,
      streak: 0,
      badges: [],
    }).returning();

    const [teacher2] = await db.insert(usersTable).values({
      email: "michael.brown@sphereenglish.com",
      password: teacherPassword,
      role: "teacher",
      firstName: "Michael",
      lastName: "Brown",
      totalPoints: 0,
      streak: 0,
      badges: [],
    }).returning();

    await db.insert(usersTable).values([
      { email: "alice@example.com", password: studentPassword, role: "student", firstName: "Alice", lastName: "Smith", currentLevel: "B1", totalPoints: 450, streak: 7, badges: ["first_lesson", "streak_7", "points_100"] },
      { email: "bob@example.com", password: studentPassword, role: "student", firstName: "Bob", lastName: "Jones", currentLevel: "A2", totalPoints: 120, streak: 3, badges: ["first_lesson"] },
      { email: "ceren@example.com", password: studentPassword, role: "student", firstName: "Ceren", lastName: "Yilmaz", currentLevel: "B2", totalPoints: 820, streak: 15, badges: ["first_lesson", "streak_7", "perfect_quiz", "points_100", "points_500"] },
    ]);

    const [course1] = await db.insert(coursesTable).values({ title: "English for Beginners (A1)", description: "Start your English learning journey with fundamental vocabulary, basic grammar, and everyday conversations.", level: "A1", teacherId: teacher1.id, price: "299", isActive: true, imageUrl: "/images/course-placeholder.png" }).returning();
    const [course2] = await db.insert(coursesTable).values({ title: "Elementary English (A2)", description: "Build on your basic English skills with expanded vocabulary and more complex sentence structures.", level: "A2", teacherId: teacher1.id, price: "349", isActive: true, imageUrl: "/images/course-placeholder.png" }).returning();
    const [course3] = await db.insert(coursesTable).values({ title: "Intermediate English (B1)", description: "Develop your ability to handle most situations likely to arise while travelling.", level: "B1", teacherId: teacher2.id, price: "399", isActive: true, imageUrl: "/images/course-placeholder.png" }).returning();
    const [course4] = await db.insert(coursesTable).values({ title: "Upper-Intermediate English (B2)", description: "Express yourself with confidence on a wide range of topics.", level: "B2", teacherId: teacher2.id, price: "449", isActive: true, imageUrl: "/images/course-placeholder.png" }).returning();

    const [mod1] = await db.insert(modulesTable).values({ courseId: course1.id, title: "Unit 1: Introductions", description: "Learn to greet people and introduce yourself", order: 1 }).returning();
    const [mod2] = await db.insert(modulesTable).values({ courseId: course1.id, title: "Unit 2: Numbers & Colors", description: "Essential vocabulary for numbers and colors", order: 2 }).returning();
    const [mod3] = await db.insert(modulesTable).values({ courseId: course1.id, title: "Unit 3: Daily Routines", description: "Talk about your day and daily activities", order: 3 }).returning();
    const [bmod1] = await db.insert(modulesTable).values({ courseId: course3.id, title: "Unit 1: Present Perfect", description: "Master the present perfect tense", order: 1 }).returning();
    const [bmod2] = await db.insert(modulesTable).values({ courseId: course3.id, title: "Unit 2: Travel & Tourism", description: "Vocabulary for travel scenarios", order: 2 }).returning();

    await db.insert(lessonsTable).values([
      { moduleId: mod1.id, title: "Hello! Basic Greetings", type: "video", content: "https://www.youtube.com/embed/dQw4w9WgXcQ", duration: 10, order: 1 },
      { moduleId: mod1.id, title: "Vocabulary: Greetings and Farewells", type: "document", content: "# Greetings\n- Hello / Hi\n- Good morning\n- Good evening\n- Goodbye / Bye", duration: 5, order: 2 },
      { moduleId: mod2.id, title: "Numbers 1-100", type: "video", content: "https://www.youtube.com/embed/dQw4w9WgXcQ", duration: 12, order: 1 },
      { moduleId: mod2.id, title: "Colors Vocabulary", type: "text", content: "Learn the 12 basic colors: red, blue, green, yellow, orange, purple, pink, white, black, brown, grey, gold.", duration: 8, order: 2 },
      { moduleId: mod3.id, title: "Morning Routine Vocabulary", type: "video", content: "https://www.youtube.com/embed/dQw4w9WgXcQ", duration: 15, order: 1 },
      { moduleId: bmod1.id, title: "Introduction to Present Perfect", type: "video", content: "https://www.youtube.com/embed/dQw4w9WgXcQ", duration: 20, order: 1 },
      { moduleId: bmod1.id, title: "Present Perfect vs Past Simple", type: "document", content: "# Present Perfect vs Past Simple\n\nUse **present perfect** for experiences.\nUse **past simple** for completed actions.", duration: 15, order: 2 },
      { moduleId: bmod2.id, title: "At the Airport", type: "video", content: "https://www.youtube.com/embed/dQw4w9WgXcQ", duration: 18, order: 1 },
    ]);

    const futureDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const futureDate2 = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    await db.insert(liveClassesTable).values([
      { title: "A1 Grammar Workshop - Articles", description: "Learn when to use 'a', 'an', and 'the'", teacherId: teacher1.id, courseId: course1.id, startTime: futureDate, duration: 60, meetingLink: "https://zoom.us/j/123456789", maxStudents: 20, isRecorded: true, type: "group" },
      { title: "B1 Conversation Practice", description: "Practice your spoken English in a supportive group", teacherId: teacher2.id, courseId: course3.id, startTime: futureDate2, duration: 90, meetingLink: "https://meet.google.com/abc-defg-hij", maxStudents: 15, isRecorded: false, type: "group" },
    ]);

    const [quiz1] = await db.insert(quizzesTable).values({ title: "A1 Greetings Quiz", courseId: course1.id, passingScore: 70, timeLimit: 15 }).returning();
    await db.insert(questionsTable).values([
      { quizId: quiz1.id, type: "multiple_choice", question: "Which of these is a formal greeting?", options: ["Hey!", "Good morning!", "Howdy!", "Wassup?"], correctAnswer: "Good morning!", points: 10, order: 1 },
      { quizId: quiz1.id, type: "true_false", question: "'Goodbye' is a greeting used when leaving.", options: ["True", "False"], correctAnswer: "True", points: 10, order: 2 },
      { quizId: quiz1.id, type: "fill_blank", question: "Good _____ (used in the morning).", options: null, correctAnswer: "morning", points: 10, order: 3 },
    ]);

    logger.info("✅ Database seeded successfully!");
  } catch (err) {
    logger.error({ err }, "Seed failed (non-fatal, continuing startup)");
  }
}
