import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable, companiesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { authMiddleware, generateToken, type AuthRequest } from "../middlewares/auth.js";

const router = Router();

router.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

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

  const token = generateToken(user.id, user.role);
  const { password: _, ...userWithoutPassword } = user;

  let companyInfo = null;
  if (user.companyId) {
    const [company] = await db.select().from(companiesTable).where(eq(companiesTable.id, user.companyId)).limit(1);
    if (company) companyInfo = { id: company.id, name: company.name, code: company.code };
  }

  res.json({ user: { ...userWithoutPassword, company: companyInfo }, token });
});

router.post("/auth/register", async (req, res) => {
  const { email, password, firstName, lastName, role, phone, companyName } = req.body;
  if (!email || !password || !firstName || !lastName) {
    res.status(400).json({ error: "Zorunlu alanlar eksik" });
    return;
  }

  const assignedRole = role === "corporate" ? "corporate" : "student";

  if ((assignedRole === "student" || assignedRole === "corporate") && !companyName) {
    res.status(400).json({ error: "Şirket adı zorunludur" });
    return;
  }

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
  if (existing) {
    res.status(400).json({ error: "Bu email adresi zaten kullanımda" });
    return;
  }

  let companyId: number | null = null;
  let companyInfo = null;

  if (companyName) {
    const normalizedName = companyName.trim();
    const [existingCompany] = await db
      .select()
      .from(companiesTable)
      .where(sql`lower(${companiesTable.name}) = lower(${normalizedName})`)
      .limit(1);

    if (existingCompany) {
      companyId = existingCompany.id;
      companyInfo = { id: existingCompany.id, name: existingCompany.name, code: existingCompany.code };
    } else {
      const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(companiesTable);
      const nextNum = (Number(countResult.count) + 1).toString().padStart(4, "0");
      const code = `KUR-${nextNum}`;

      const [newCompany] = await db
        .insert(companiesTable)
        .values({ name: normalizedName, code })
        .returning();

      companyId = newCompany.id;
      companyInfo = { id: newCompany.id, name: newCompany.name, code: newCompany.code };
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
    companyId,
  }).returning();

  const token = generateToken(user.id, user.role);
  const { password: _, ...userWithoutPassword } = user;
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
  res.json({ success: true, message: "Logged out successfully" });
});

export default router;
