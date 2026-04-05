import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { authMiddleware, type AuthRequest } from "../middlewares/auth.js";

const router = Router();

router.get("/leaderboard", authMiddleware, async (req: AuthRequest, res) => {
  const { level } = req.query;

  let query = db.select({
    id: usersTable.id,
    firstName: usersTable.firstName,
    lastName: usersTable.lastName,
    avatar: usersTable.avatar,
    currentLevel: usersTable.currentLevel,
    totalPoints: usersTable.totalPoints,
    streak: usersTable.streak,
    badges: usersTable.badges,
    role: usersTable.role,
    studentNumber: usersTable.studentNumber,
  }).from(usersTable).where(eq(usersTable.role, "student")).orderBy(desc(usersTable.totalPoints)).limit(50);

  const users = await query;

  const filtered = level && level !== "null"
    ? users.filter(u => u.currentLevel === level)
    : users;

  const entries = filtered.map((u, i) => ({
    rank: i + 1,
    userId: u.id,
    userName: `${u.firstName} ${u.lastName}`,
    userAvatar: u.avatar,
    level: u.currentLevel,
    totalPoints: u.totalPoints,
    streak: u.streak,
    badges: (u.badges || []).length,
    isCurrentUser: u.id === req.userId,
    studentNumber: u.studentNumber || null,
  }));

  res.json(entries);
});

export default router;
