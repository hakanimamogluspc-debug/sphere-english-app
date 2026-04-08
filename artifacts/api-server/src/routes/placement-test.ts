import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authMiddleware, type AuthRequest } from "../middlewares/auth.js";

const router = Router();

const ANSWER_KEY: Record<number, string> = {
  1: "A", 2: "A", 3: "C", 4: "C", 5: "A", 6: "B", 7: "C", 8: "A", 9: "B", 10: "C",
  11: "C", 12: "C", 13: "B", 14: "C", 15: "A", 16: "C", 17: "C", 18: "A", 19: "A", 20: "A",
  21: "B", 22: "A", 23: "B", 24: "C", 25: "C", 26: "B", 27: "A", 28: "A", 29: "C", 30: "A",
  31: "C", 32: "A", 33: "C", 34: "B", 35: "A", 36: "C", 37: "C", 38: "C", 39: "B", 40: "A",
  41: "A", 42: "C", 43: "A", 44: "A", 45: "B", 46: "B", 47: "A", 48: "C", 49: "C", 50: "C",
  51: "B", 52: "A", 53: "C", 54: "B", 55: "A", 56: "C", 57: "B", 58: "B", 59: "A", 60: "B",
};

function scoreToLevel(score: number): "A1" | "A2" | "B1" | "B2" | "C1" {
  if (score <= 12) return "A1";
  if (score <= 26) return "A2";
  if (score <= 40) return "B1";
  if (score <= 54) return "B2";
  return "C1";
}

router.get("/placement-test/status", authMiddleware, async (req: AuthRequest, res) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
  if (!user) {
    res.status(404).json({ error: "Kullanıcı bulunamadı" });
    return;
  }
  res.json({
    completed: (user as any).placementTestCompleted ?? false,
    currentLevel: user.currentLevel ?? null,
  });
});

router.post("/placement-test/submit", authMiddleware, async (req: AuthRequest, res) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
  if (!user) {
    res.status(404).json({ error: "Kullanıcı bulunamadı" });
    return;
  }

  if ((user as any).placementTestCompleted) {
    res.status(400).json({ error: "Seviye testi zaten tamamlandı" });
    return;
  }

  const { answers } = req.body as { answers: Record<string, string> };
  if (!answers || typeof answers !== "object") {
    res.status(400).json({ error: "Cevaplar eksik veya geçersiz" });
    return;
  }

  let score = 0;
  for (let q = 1; q <= 60; q++) {
    if (answers[String(q)] === ANSWER_KEY[q]) score++;
  }

  const level = scoreToLevel(score);

  const [updated] = await db
    .update(usersTable)
    .set({
      currentLevel: level,
      placementTestCompleted: true,
    } as any)
    .where(eq(usersTable.id, req.userId!))
    .returning();

  const { password: _, ...userWithoutPassword } = updated;
  res.json({ score, level, user: userWithoutPassword });
});

export default router;
