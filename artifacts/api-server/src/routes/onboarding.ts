/**
 * Onboarding — Kayıt sonrası ilk kullanıcı wizard'ı.
 *
 * Akış:
 *   Kayıt → /onboarding (5 adım) → /placement-test → /dashboard
 *
 * Wizard toplanan bilgiler:
 *   - preferredLanguage: 'tr' | 'en'
 *   - sector: finans/tech/uretim/danisman/saglik/turizm/ik/satis/diger
 *   - learningGoal: mulakat/toplanti/sunum/email/musteri/sertifika/genel
 *
 * Endpoint'ler:
 *   POST /api/student/onboarding — 3 alanı save + onboarding_completed=true
 */

import { Router, type Response } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";

const router = Router();

const VALID_LANGS = ["tr", "en"] as const;
const VALID_SECTORS = [
  "finance",
  "tech",
  "manufacturing",
  "consulting",
  "healthcare",
  "hospitality",
  "hr",
  "sales",
  "legal",
  "education",
  "other",
] as const;
const VALID_GOALS = [
  "interview",
  "meetings",
  "presentation",
  "email",
  "customer",
  "certificate",
  "general",
] as const;

router.post("/student/onboarding", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ error: "Yetkisiz" });

    const { preferredLanguage, sector, learningGoal } = req.body ?? {};

    const lang = String(preferredLanguage ?? "tr").toLowerCase();
    if (!VALID_LANGS.includes(lang as any)) {
      return res.status(400).json({ error: "preferredLanguage: 'tr' veya 'en' olmalı" });
    }

    const sec = String(sector ?? "").toLowerCase();
    if (!VALID_SECTORS.includes(sec as any)) {
      return res.status(400).json({ error: "sector geçersiz" });
    }

    const goal = String(learningGoal ?? "").toLowerCase();
    if (!VALID_GOALS.includes(goal as any)) {
      return res.status(400).json({ error: "learningGoal geçersiz" });
    }

    const [updated] = await db
      .update(usersTable)
      .set({
        preferredLanguage: lang,
        sector: sec,
        learningGoal: goal,
        onboardingCompleted: true,
        updatedAt: new Date(),
      } as any)
      .where(eq(usersTable.id, req.userId))
      .returning();

    if (!updated) return res.status(404).json({ error: "Kullanıcı bulunamadı" });

    const { password: _pw, ...userWithoutPassword } = updated;
    return res.json({ ok: true, user: userWithoutPassword });
  } catch (e: any) {
    console.error("[student/onboarding] HATA:", e?.message);
    return res.status(500).json({ error: e?.message ?? "Onboarding tamamlanamadı" });
  }
});

export default router;
