import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

/**
 * Güncellenen seri kuralları:
 * - Aktif gün (ders / canlı ders / AI koç 10 dk): +1
 * - Atlanan her gün (gün başına): -2
 * - Minimum 0, maksimum sınır yok
 * - Aynı günde birden fazla aktivite: sadece ilki +1 sayılır
 */

export function computeEffectiveStreak(storedStreak: number, lastActiveDate: string | null): number {
  if (!lastActiveDate) return storedStreak;
  const today = new Date().toISOString().split("T")[0];
  if (lastActiveDate === today) return storedStreak;

  const last = new Date(lastActiveDate + "T00:00:00Z");
  const now = new Date(today + "T00:00:00Z");
  const daysDiff = Math.round((now.getTime() - last.getTime()) / 86400000);

  if (daysDiff <= 1) return storedStreak;
  const inactiveDays = daysDiff - 1;
  return Math.max(0, storedStreak - inactiveDays * 2);
}

/**
 * Aktivite sırasında seriyi günceller.
 * - Bugün zaten aktifse: sadece puanı döner, streak değişmez
 * - Dün aktifti: +1
 * - Daha önceydi: (geçen günlerin cezası) + 1
 */
export async function applyActivityStreak(
  userId: number,
  pointsToAdd: number
): Promise<{ alreadyActiveToday: boolean; newStreak: number; newTotalPoints: number }> {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) throw new Error("User not found");

  const today = new Date().toISOString().split("T")[0];

  if (user.lastActiveDate === today) {
    await db.update(usersTable).set({
      totalPoints: user.totalPoints + pointsToAdd,
      updatedAt: new Date(),
    }).where(eq(usersTable.id, userId));
    return { alreadyActiveToday: true, newStreak: user.streak, newTotalPoints: user.totalPoints + pointsToAdd };
  }

  const effectiveStreak = computeEffectiveStreak(user.streak, user.lastActiveDate);
  const newStreak = effectiveStreak + 1;

  await db.update(usersTable).set({
    totalPoints: user.totalPoints + pointsToAdd,
    streak: newStreak,
    lastActiveDate: today,
    updatedAt: new Date(),
  }).where(eq(usersTable.id, userId));

  return { alreadyActiveToday: false, newStreak, newTotalPoints: user.totalPoints + pointsToAdd };
}
