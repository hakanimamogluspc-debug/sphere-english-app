import { Router } from "express";
import { db, usersTable, companiesTable } from "@workspace/db";
import { eq, and, count, sql, avg } from "drizzle-orm";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth.js";

const router = Router();

async function getCorporateCompanyId(req: AuthRequest, res: any): Promise<number | null> {
  const [user] = await db.select({ companyId: usersTable.companyId })
    .from(usersTable)
    .where(eq(usersTable.id, req.userId!))
    .limit(1);

  if (!user || !user.companyId) {
    res.status(403).json({ error: "Kurum yetkilisi bir şirkete bağlı değil" });
    return null;
  }
  return user.companyId;
}

// GET /corporate/company — Kendi şirket bilgileri
router.get("/corporate/company", authMiddleware, requireRole("corporate"), async (req: AuthRequest, res) => {
  const companyId = await getCorporateCompanyId(req, res);
  if (!companyId) return;

  const [company] = await db.select().from(companiesTable).where(eq(companiesTable.id, companyId)).limit(1);
  if (!company) { res.status(404).json({ error: "Şirket bulunamadı" }); return; }

  const [{ studentCount }] = await db
    .select({ studentCount: count() })
    .from(usersTable)
    .where(and(eq(usersTable.companyId, companyId), eq(usersTable.role, "student")));

  res.json({ ...company, studentCount: Number(studentCount) });
});

// GET /corporate/students — Şirkete ait öğrenciler
router.get("/corporate/students", authMiddleware, requireRole("corporate"), async (req: AuthRequest, res) => {
  const companyId = await getCorporateCompanyId(req, res);
  if (!companyId) return;

  const { search, page = 1, limit = 20 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  let whereClause = and(
    eq(usersTable.companyId, companyId),
    eq(usersTable.role, "student")
  );

  const students = await db.select({
    id: usersTable.id,
    email: usersTable.email,
    firstName: usersTable.firstName,
    lastName: usersTable.lastName,
    avatar: usersTable.avatar,
    phone: usersTable.phone,
    currentLevel: usersTable.currentLevel,
    totalPoints: usersTable.totalPoints,
    streak: usersTable.streak,
    badges: usersTable.badges,
    createdAt: usersTable.createdAt,
    lastActiveDate: usersTable.lastActiveDate,
  }).from(usersTable)
    .where(whereClause)
    .limit(Number(limit))
    .offset(offset)
    .orderBy(usersTable.totalPoints);

  const [{ total }] = await db.select({ total: count() }).from(usersTable).where(whereClause);

  res.json({ students, total: Number(total), page: Number(page), limit: Number(limit) });
});

// GET /corporate/reports — İstatistikler ve raporlar
router.get("/corporate/reports", authMiddleware, requireRole("corporate"), async (req: AuthRequest, res) => {
  const companyId = await getCorporateCompanyId(req, res);
  if (!companyId) return;

  const [company] = await db.select().from(companiesTable).where(eq(companiesTable.id, companyId)).limit(1);

  const studentWhere = and(eq(usersTable.companyId, companyId), eq(usersTable.role, "student"));

  const [{ totalStudents }] = await db
    .select({ totalStudents: count() })
    .from(usersTable)
    .where(studentWhere);

  const [{ avgPoints }] = await db
    .select({ avgPoints: avg(usersTable.totalPoints) })
    .from(usersTable)
    .where(studentWhere);

  const [{ totalPoints }] = await db
    .select({ totalPoints: sql<number>`coalesce(sum(${usersTable.totalPoints}), 0)` })
    .from(usersTable)
    .where(studentWhere);

  // Seviye dağılımı
  const levelDistribution = await db
    .select({
      level: usersTable.currentLevel,
      count: count(),
    })
    .from(usersTable)
    .where(studentWhere)
    .groupBy(usersTable.currentLevel);

  // Aktif öğrenciler (son 7 gün)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0];

  const [{ activeStudents }] = await db
    .select({ activeStudents: count() })
    .from(usersTable)
    .where(and(studentWhere, sql`${usersTable.lastActiveDate} >= ${sevenDaysAgoStr}`));

  // Top 10 öğrenci
  const topStudents = await db.select({
    id: usersTable.id,
    firstName: usersTable.firstName,
    lastName: usersTable.lastName,
    avatar: usersTable.avatar,
    currentLevel: usersTable.currentLevel,
    totalPoints: usersTable.totalPoints,
    streak: usersTable.streak,
    badges: usersTable.badges,
  }).from(usersTable)
    .where(studentWhere)
    .orderBy(sql`${usersTable.totalPoints} desc`)
    .limit(10);

  res.json({
    company: company ? { id: company.id, name: company.name, code: company.code } : null,
    summary: {
      totalStudents: Number(totalStudents),
      activeStudents: Number(activeStudents),
      avgPoints: Math.round(Number(avgPoints) || 0),
      totalPoints: Number(totalPoints),
    },
    levelDistribution: levelDistribution.map(l => ({
      level: l.level || "Belirtilmemiş",
      count: Number(l.count),
    })),
    topStudents,
  });
});

export default router;
