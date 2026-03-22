import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
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
  res.json({ user: userWithoutPassword, token });
});

router.post("/auth/register", async (req, res) => {
  const { email, password, firstName, lastName, role, phone } = req.body;
  if (!email || !password || !firstName || !lastName) {
    res.status(400).json({ error: "Required fields missing" });
    return;
  }

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
  if (existing) {
    res.status(400).json({ error: "Email already in use" });
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const [user] = await db.insert(usersTable).values({
    email: email.toLowerCase(),
    password: hashedPassword,
    firstName,
    lastName,
    role: role || "student",
    phone: phone || null,
  }).returning();

  const token = generateToken(user.id, user.role);
  const { password: _, ...userWithoutPassword } = user;
  res.status(201).json({ user: userWithoutPassword, token });
});

router.get("/auth/me", authMiddleware, async (req: AuthRequest, res) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }
  const { password: _, ...userWithoutPassword } = user;
  res.json(userWithoutPassword);
});

router.post("/auth/logout", (_req, res) => {
  res.json({ success: true, message: "Logged out successfully" });
});

export default router;
