import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db, usersTable, companiesTable } from "@workspace/db";
import { eq, and, count, sql } from "drizzle-orm";
import { authMiddleware, generateToken, type AuthRequest } from "../middlewares/auth.js";
import { sendMetaEvent } from "../services/metaConversions.js";
import { validateBody, schemas } from "../middlewares/validate.js";

const router = Router();

// ─── Zod şemaları ────────────────────────────────────────────────────────────
const loginSchema = z.object({
  email: schemas.email,
  password: z.string().min(1, "Parola gerekli"),
});

const registerSchema = z.object({
  email: schemas.email,
  password: schemas.password,
  firstName: z.string().trim().min(1, "Ad gerekli").max(100),
  lastName: z.string().trim().min(1, "Soyad gerekli").max(100),
  role: z.enum(["student", "corporate"]).optional(),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  companyCode: z.string().trim().max(50).optional().or(z.literal("")),
  accountType: z.enum(["bireysel", "kurumsal"]).optional(),
});

router.post("/auth/login", validateBody(loginSchema), async (req, res) => {
  const { email, password } = req.body;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
  if (!user) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const token = generateToken(user.id, user.role, (user as any).accountType);
  const { password: _, ...userWithoutPassword } = user;

  let companyInfo = null;
  if (user.companyId) {
    const [company] = await db.select().from(companiesTable).where(eq(companiesTable.id, user.companyId)).limit(1);
    if (company) companyInfo = { id: company.id, name: company.name, code: company.code };
  }

  res.cookie("sphere_token", token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60 * 1000,
    secure: process.env.NODE_ENV === "production",
  });

  sendMetaEvent({
    eventName: "Lead",
    email,
    clientIp: (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip,
    clientUserAgent: req.headers["user-agent"],
    fbc: req.cookies?.["_fbc"],
    fbp: req.cookies?.["_fbp"],
    sourceUrl: "https://app.sphereenglish.com/login",
  }).catch(() => {});

  res.json({ user: { ...userWithoutPassword, company: companyInfo }, token });
});

router.post("/auth/register", validateBody(registerSchema), async (req, res) => {
  const { email, password, firstName, lastName, role, phone, companyCode, accountType } = req.body;

  const isBireysel = accountType === "bireysel";
  const assignedRole = role === "corporate" ? "corporate" : "student";

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
  if (existing) {
    res.status(400).json({ error: "Bu email adresi zaten kullanımda" });
    return;
  }

  // ── Bireysel kayıt (kurum kodu olmadan) ──────────────────────────────────
  if (isBireysel) {
    const hashedPassword = await bcrypt.hash(password, 10);
    const [user] = await db.insert(usersTable).values({
      email: email.toLowerCase(),
      password: hashedPassword,
      firstName,
      lastName,
      role: "student",
      phone: phone || null,
      companyId: null,
      accountType: "bireysel",
    } as any).returning();

    const year = new Date(user.createdAt).getFullYear();
    const studentNumber = `SE-${year}-${String(user.id).padStart(4, "0")}`;
    const [updatedUser] = await db.update(usersTable)
      .set({ studentNumber } as any)
      .where(eq(usersTable.id, user.id))
      .returning();

    const token = generateToken(updatedUser.id, updatedUser.role, "bireysel");
    const { password: _, ...userWithoutPassword } = updatedUser;

    res.cookie("sphere_token", token, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000,
      secure: process.env.NODE_ENV === "production",
    });

    sendMetaEvent({
      eventName: "CompleteRegistration",
      email,
      phone: phone || undefined,
      clientIp: (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip,
      clientUserAgent: req.headers["user-agent"],
      fbc: req.cookies?.["_fbc"],
      fbp: req.cookies?.["_fbp"],
      sourceUrl: "https://app.sphereenglish.com/register",
    }).catch(() => {});

    res.status(201).json({ user: { ...userWithoutPassword, company: null }, token });
    return;
  }

  // ── Kurumsal kayıt (kurum kodu zorunlu) ──────────────────────────────────
  if (!companyCode) {
    res.status(400).json({ error: "Kurum kodu zorunludur" });
    return;
  }

  const [company] = await db
    .select()
    .from(companiesTable)
    .where(eq(companiesTable.code, companyCode.trim().toUpperCase()))
    .limit(1);

  if (!company) {
    res.status(400).json({ error: "Geçersiz kurum kodu. Lütfen kurumunuzdan aldığınız kodu giriniz." });
    return;
  }

  if (assignedRole === "student" && company.registrationLimit > 0) {
    const [{ registeredCount }] = await db
      .select({ registeredCount: count() })
      .from(usersTable)
      .where(and(eq(usersTable.companyId, company.id), eq(usersTable.role, "student")));

    if (Number(registeredCount) >= company.registrationLimit) {
      res.status(400).json({
        error: `Bu kurum için öğrenci kayıt limiti dolmuştur. (Limit: ${company.registrationLimit} öğrenci)`,
      });
      return;
    }
  }

  if (assignedRole === "corporate" && company.corporateLimit > 0) {
    const [{ registeredCount }] = await db
      .select({ registeredCount: count() })
      .from(usersTable)
      .where(and(eq(usersTable.companyId, company.id), eq(usersTable.role, "corporate")));

    if (Number(registeredCount) >= company.corporateLimit) {
      res.status(400).json({
        error: `Bu kurum için yetkili kayıt limiti dolmuştur. (Limit: ${company.corporateLimit} yetkili)`,
      });
      return;
    }
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const [user] = await db.insert(usersTable).values({
    email: email.toLowerCase(),
    password: hashedPassword,
    firstName,
    lastName,
    role: assignedRole,
    phone: phone || null,
    companyId: company.id,
    accountType: "kurumsal",
  } as any).returning();

  // Öğrenci numarası ata: SE-YYYY-NNNN formatı
  const year = new Date(user.createdAt).getFullYear();
  const studentNumber = `SE-${year}-${String(user.id).padStart(4, "0")}`;
  const [updatedUser] = await db.update(usersTable)
    .set({ studentNumber } as any)
    .where(eq(usersTable.id, user.id))
    .returning();

  const token = generateToken(updatedUser.id, updatedUser.role, "kurumsal");
  const { password: _, ...userWithoutPassword } = updatedUser;
  const companyInfo = { id: company.id, name: company.name, code: company.code };

  res.cookie("sphere_token", token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60 * 1000,
    secure: process.env.NODE_ENV === "production",
  });

  sendMetaEvent({
    eventName: "CompleteRegistration",
    email,
    phone: phone || undefined,
    clientIp: (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip,
    clientUserAgent: req.headers["user-agent"],
    fbc: req.cookies?.["_fbc"],
    fbp: req.cookies?.["_fbp"],
    sourceUrl: "https://app.sphereenglish.com/register",
  }).catch(() => {});

  res.status(201).json({ user: { ...userWithoutPassword, company: companyInfo }, token });
});

router.get("/auth/me", authMiddleware, async (req: AuthRequest, res) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }
  const { password: _, ...userWithoutPassword } = user;

  let companyInfo = null;
  if (user.companyId) {
    const [company] = await db.select().from(companiesTable).where(eq(companiesTable.id, user.companyId)).limit(1);
    if (company) companyInfo = { id: company.id, name: company.name, code: company.code };
  }

  res.json({ ...userWithoutPassword, company: companyInfo });
});

router.post("/auth/logout", (_req, res) => {
  res.clearCookie("sphere_token", { httpOnly: true, sameSite: "lax" });
  res.json({ success: true, message: "Logged out successfully" });
});

export default router;
