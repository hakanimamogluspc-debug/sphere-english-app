import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable, enrollmentsTable, coursesTable, lessonsTable, lessonProgressTable } from "@workspace/db";
import { eq, ilike, and, or, count, sql } from "drizzle-orm";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth.js";
import { sendEmail, loadEmailTemplate, applyTemplateVars } from "../lib/email.js";

const router = Router();

// List users (admin only)
router.get("/users", authMiddleware, requireRole("admin"), async (req: AuthRequest, res) => {
  const { role, search, page = 1, limit = 20 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  let conditions: any[] = [];
  if (role && role !== "null") conditions.push(eq(usersTable.role, role as string));
  if (search) {
    const s = `%${search}%`;
    conditions.push(or(
      ilike(usersTable.firstName, s),
      ilike(usersTable.lastName, s),
      ilike(usersTable.email, s),
      ilike(usersTable.studentNumber, s),
    ));
  }

  const query = conditions.length > 0 ? and(...conditions) : undefined;
  const users = await db.select({
    id: usersTable.id,
    email: usersTable.email,
    role: usersTable.role,
    firstName: usersTable.firstName,
    lastName: usersTable.lastName,
    avatar: usersTable.avatar,
    phone: usersTable.phone,
    currentLevel: usersTable.currentLevel,
    totalPoints: usersTable.totalPoints,
    streak: usersTable.streak,
    badges: usersTable.badges,
    studentNumber: usersTable.studentNumber,
    createdAt: usersTable.createdAt,
  }).from(usersTable).where(query).limit(Number(limit)).offset(offset);

  const [{ total }] = await db.select({ total: count() }).from(usersTable).where(query);

  res.json({ users, total: Number(total), page: Number(page), limit: Number(limit) });
});

// Admin: get student enrollments with progress
router.get("/admin/students/:id/enrollments", authMiddleware, requireRole("admin"), async (req: AuthRequest, res) => {
  const studentId = parseInt(req.params.id);
  const enrollments = await db
    .select({
      enrollmentId: enrollmentsTable.id,
      courseId: coursesTable.id,
      courseTitle: coursesTable.title,
      enrolledAt: enrollmentsTable.enrolledAt,
    })
    .from(enrollmentsTable)
    .innerJoin(coursesTable, eq(enrollmentsTable.courseId, coursesTable.id))
    .where(eq(enrollmentsTable.studentId, studentId));

  const result = await Promise.all(
    enrollments.map(async (e) => {
      const [{ total }] = await db
        .select({ total: count() })
        .from(lessonsTable)
        .where(eq(lessonsTable.courseId, e.courseId));
      const [{ completed }] = await db
        .select({ completed: count() })
        .from(lessonProgressTable)
        .where(and(eq(lessonProgressTable.userId, studentId), eq(lessonProgressTable.completed, true)));
      return {
        id: e.enrollmentId,
        courseTitle: e.courseTitle,
        totalLessons: Number(total),
        completedLessons: Number(completed),
        enrolledAt: e.enrolledAt,
      };
    })
  );

  res.json(result);
});

// Get user by ID
router.get("/users/:id", authMiddleware, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const [user] = await db.select({
    id: usersTable.id,
    email: usersTable.email,
    role: usersTable.role,
    firstName: usersTable.firstName,
    lastName: usersTable.lastName,
    avatar: usersTable.avatar,
    phone: usersTable.phone,
    currentLevel: usersTable.currentLevel,
    totalPoints: usersTable.totalPoints,
    streak: usersTable.streak,
    badges: usersTable.badges,
    createdAt: usersTable.createdAt,
  }).from(usersTable).where(eq(usersTable.id, id)).limit(1);

  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json(user);
});

// Create user (admin only)
router.post("/users", authMiddleware, requireRole("admin"), async (req: AuthRequest, res) => {
  const { email, password, firstName, lastName, role, phone, currentLevel, sendWelcomeEmail } = req.body;
  if (!email || !password || !firstName || !lastName) {
    res.status(400).json({ error: "Required fields missing" });
    return;
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  const [user] = await db.insert(usersTable).values({
    email: email.toLowerCase(), password: hashedPassword, firstName, lastName,
    role: role || "student", phone: phone || null, currentLevel: currentLevel || null,
  }).returning();

  // Öğrenci numarası ata: SE-YYYY-NNNN formatı
  const sYear = new Date(user.createdAt).getFullYear();
  const studentNumber = `SE-${sYear}-${String(user.id).padStart(4, "0")}`;
  const [userWithNum] = await db.update(usersTable)
    .set({ studentNumber })
    .where(eq(usersTable.id, user.id))
    .returning();

  const { password: _, ...userWithoutPassword } = userWithNum;

  // Otomatik hoş geldin maili — öğretmen rolü + onay kutusu işaretli ise
  if (role === "teacher" && sendWelcomeEmail !== false) {
    try {
      const template = loadEmailTemplate("ogretmen-hosgeldiniz.html");
      if (template) {
        const html = applyTemplateVars(template, {
          EMAIL: email.toLowerCase(),
          SIFRE: password,
          AD: firstName,
          SOYAD: lastName,
          AD_SOYAD: `${firstName} ${lastName}`.trim(),
        });
        await sendEmail(email.toLowerCase(), "Sphere English'e Hoş Geldiniz!", html);
      }
    } catch (e) {
      console.error("Welcome email failed:", e);
      // Hata olsa bile kullanıcı oluşturma başarılı
    }
  }

  res.status(201).json({ ...userWithoutPassword, welcomeEmailSent: role === "teacher" && sendWelcomeEmail !== false });
});

// Update user
router.patch("/users/:id", authMiddleware, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  if (req.userRole !== "admin" && req.userId !== id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const { firstName, lastName, phone, avatar, currentLevel, role, email } = req.body;
  const updates: any = { updatedAt: new Date() };
  if (firstName !== undefined) updates.firstName = firstName;
  if (lastName !== undefined) updates.lastName = lastName;
  if (phone !== undefined) updates.phone = phone;
  if (avatar !== undefined) updates.avatar = avatar;
  if (currentLevel !== undefined) updates.currentLevel = currentLevel;
  if (role !== undefined && req.userRole === "admin") updates.role = role;
  if (email !== undefined && req.userRole === "admin") updates.email = email.toLowerCase();

  const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "User not found" }); return; }
  const { password: _, ...userWithoutPassword } = updated;
  res.json(userWithoutPassword);
});

// Change user password (admin only)
router.post("/users/:id/change-password", authMiddleware, requireRole("admin"), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    res.status(400).json({ error: "Şifre en az 6 karakter olmalıdır" });
    return;
  }
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  const [updated] = await db.update(usersTable)
    .set({ password: hashedPassword, updatedAt: new Date() })
    .where(eq(usersTable.id, id))
    .returning({ id: usersTable.id });
  if (!updated) { res.status(404).json({ error: "User not found" }); return; }
  res.json({ success: true });
});

// Delete user (admin only)
router.delete("/users/:id", authMiddleware, requireRole("admin"), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  await db.delete(usersTable).where(eq(usersTable.id, id));
  res.json({ success: true, message: "User deleted" });
});

export default router;
