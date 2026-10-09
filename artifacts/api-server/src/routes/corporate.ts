import { Router } from "express";
import {
  db, usersTable, companiesTable,
  lessonProgressTable, quizAttemptsTable,
  placementTestAttemptsTable,
} from "@workspace/db";
import { eq, and, count, sql, avg, inArray, gte, lte, desc } from "drizzle-orm";
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

  res.json({
    id: company.id,
    name: company.name,
    code: company.code,
    registrationLimit: company.registrationLimit,
    corporateLimit: company.corporateLimit,
    studentCount: Number(studentCount),
  });
});

// GET /corporate/students — Şirkete ait öğrenciler
router.get("/corporate/students", authMiddleware, requireRole("corporate"), async (req: AuthRequest, res) => {
  const companyId = await getCorporateCompanyId(req, res);
  if (!companyId) return;

  const { page = 1, limit = 20 } = req.query;
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

/**
 * Yardımcı: şirketin öğrenci ID listesini çeker.
 */
async function companyStudentIds(companyId: number): Promise<number[]> {
  const rows = await db.select({ id: usersTable.id }).from(usersTable)
    .where(and(eq(usersTable.companyId, companyId), eq(usersTable.role, "student")));
  return rows.map(r => r.id);
}

/**
 * Yardımcı: Date range query param parse — invalid veya eksikse null döner.
 */
function parseDateRange(q: any): { start: Date | null; end: Date | null } {
  const parse = (v: any): Date | null => {
    if (!v || typeof v !== "string") return null;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  };
  return { start: parse(q.startDate), end: parse(q.endDate) };
}

// GET /corporate/reports — Zengin kurum raporu
router.get("/corporate/reports", authMiddleware, requireRole("corporate"), async (req: AuthRequest, res) => {
  const companyId = await getCorporateCompanyId(req, res);
  if (!companyId) return;

  const [company] = await db.select().from(companiesTable).where(eq(companiesTable.id, companyId)).limit(1);

  const studentWhere = and(eq(usersTable.companyId, companyId), eq(usersTable.role, "student"));

  // Temel sayılar
  const [{ totalStudents }] = await db.select({ totalStudents: count() })
    .from(usersTable).where(studentWhere);
  const [{ avgPoints }] = await db.select({ avgPoints: avg(usersTable.totalPoints) })
    .from(usersTable).where(studentWhere);
  const [{ totalPoints }] = await db.select({ totalPoints: sql<number>`coalesce(sum(${usersTable.totalPoints}), 0)` })
    .from(usersTable).where(studentWhere);
  const [{ placementCompleted }] = await db.select({
    placementCompleted: sql<number>`coalesce(sum(case when ${usersTable.placementTestCompleted} = true then 1 else 0 end), 0)`,
  }).from(usersTable).where(studentWhere);

  const studentIds = await companyStudentIds(companyId);

  // Seviye dağılımı
  const levelDistribution = await db
    .select({ level: usersTable.currentLevel, count: count() })
    .from(usersTable).where(studentWhere).groupBy(usersTable.currentLevel);

  // Aktif öğrenciler (son 7 gün)
  const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0];
  const [{ activeStudents }] = await db.select({ activeStudents: count() })
    .from(usersTable).where(and(studentWhere, sql`${usersTable.lastActiveDate} >= ${sevenDaysAgoStr}`));

  // Pasif öğrenciler (son 14 gün aktivite yok veya hiç yok)
  const fourteenDaysAgo = new Date(); fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  const fourteenDaysAgoStr = fourteenDaysAgo.toISOString().split("T")[0];
  const inactiveStudents = await db.select({
    id: usersTable.id,
    firstName: usersTable.firstName,
    lastName: usersTable.lastName,
    email: usersTable.email,
    lastActiveDate: usersTable.lastActiveDate,
    currentLevel: usersTable.currentLevel,
  }).from(usersTable)
    .where(and(studentWhere, sql`(${usersTable.lastActiveDate} IS NULL OR ${usersTable.lastActiveDate} < ${fourteenDaysAgoStr})`))
    .limit(50);

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
    .where(studentWhere).orderBy(sql`${usersTable.totalPoints} desc`).limit(10);

  // Engagement — toplam ders ve quiz
  let totalLessonsCompleted = 0;
  let totalQuizAttempts = 0;
  let avgPlacementScore: number | null = null;
  let weeklyTrend: Array<{ weekStart: string; lessonsCompleted: number; pointsEarned: number; activeStudents: number }> = [];
  let recentPlacements: Array<{ userId: number; firstName: string; lastName: string; score: number; total: number; cefrLevel: string; completedAt: string }> = [];

  if (studentIds.length > 0) {
    const [{ cc }] = await db.select({ cc: count() }).from(lessonProgressTable)
      .where(and(inArray(lessonProgressTable.userId, studentIds), eq(lessonProgressTable.completed, true)));
    totalLessonsCompleted = Number(cc);

    const [{ qc }] = await db.select({ qc: count() }).from(quizAttemptsTable)
      .where(inArray(quizAttemptsTable.userId, studentIds));
    totalQuizAttempts = Number(qc);

    // Placement avg
    try {
      const [{ ps }] = await db.select({
        ps: sql<number>`coalesce(round(avg(${placementTestAttemptsTable.score}::decimal / NULLIF(${placementTestAttemptsTable.total}, 0) * 100), 1), 0)`,
      }).from(placementTestAttemptsTable).where(inArray(placementTestAttemptsTable.userId, studentIds));
      avgPlacementScore = ps !== null && ps !== undefined ? Number(ps) : null;

      const recents = await db.select({
        userId: placementTestAttemptsTable.userId,
        score: placementTestAttemptsTable.score,
        total: placementTestAttemptsTable.total,
        cefrLevel: placementTestAttemptsTable.cefrLevel,
        completedAt: placementTestAttemptsTable.completedAt,
      }).from(placementTestAttemptsTable)
        .where(inArray(placementTestAttemptsTable.userId, studentIds))
        .orderBy(desc(placementTestAttemptsTable.completedAt))
        .limit(10);

      // Ad soyad için user'ları çek
      if (recents.length > 0) {
        const userIds = [...new Set(recents.map(r => r.userId))];
        const users = await db.select({
          id: usersTable.id,
          firstName: usersTable.firstName,
          lastName: usersTable.lastName,
        }).from(usersTable).where(inArray(usersTable.id, userIds));
        const userMap = new Map(users.map(u => [u.id, u]));
        recentPlacements = recents.map(r => {
          const u = userMap.get(r.userId);
          return {
            userId: r.userId,
            firstName: u?.firstName || "",
            lastName: u?.lastName || "",
            score: r.score,
            total: r.total,
            cefrLevel: r.cefrLevel,
            completedAt: r.completedAt.toISOString(),
          };
        });
      }
    } catch (e: any) {
      console.warn("[corporate/reports] placement stats warn:", e?.message);
    }

    // Haftalık trend — son 8 hafta
    const now = new Date();
    const eightWeeksAgo = new Date(now); eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

    try {
      const trend = await db.execute(sql`
        WITH weeks AS (
          SELECT date_trunc('week', generate_series(
            date_trunc('week', ${eightWeeksAgo}::timestamp),
            date_trunc('week', ${now}::timestamp),
            interval '1 week'
          )) AS week_start
        ),
        lesson_stats AS (
          SELECT
            date_trunc('week', completed_at) AS week_start,
            count(*)::int AS lessons_completed,
            coalesce(sum(points_earned), 0)::int AS points_earned,
            count(DISTINCT user_id)::int AS active_users
          FROM lesson_progress
          WHERE completed = true
            AND user_id = ANY(${studentIds})
            AND completed_at >= ${eightWeeksAgo}
          GROUP BY date_trunc('week', completed_at)
        )
        SELECT
          to_char(w.week_start, 'YYYY-MM-DD') AS week_start,
          coalesce(l.lessons_completed, 0)::int AS lessons_completed,
          coalesce(l.points_earned, 0)::int AS points_earned,
          coalesce(l.active_users, 0)::int AS active_users
        FROM weeks w
        LEFT JOIN lesson_stats l ON l.week_start = w.week_start
        ORDER BY w.week_start ASC
      `);
      weeklyTrend = (trend.rows as any[]).map(r => ({
        weekStart: String(r.week_start),
        lessonsCompleted: Number(r.lessons_completed),
        pointsEarned: Number(r.points_earned),
        activeStudents: Number(r.active_users),
      }));
    } catch (e: any) {
      console.warn("[corporate/reports] weekly trend warn:", e?.message);
    }
  }

  const total = Number(totalStudents) || 0;
  const placementCount = Number(placementCompleted) || 0;
  const placementPct = total > 0 ? Math.round((placementCount / total) * 100) : 0;
  const avgLessonsPerStudent = total > 0 ? Number((totalLessonsCompleted / total).toFixed(1)) : 0;
  const avgQuizAttemptsPerStudent = total > 0 ? Number((totalQuizAttempts / total).toFixed(1)) : 0;

  res.json({
    company: company ? { id: company.id, name: company.name, code: company.code } : null,
    summary: {
      totalStudents: total,
      activeStudents: Number(activeStudents),
      avgPoints: Math.round(Number(avgPoints) || 0),
      totalPoints: Number(totalPoints),
      // Yeni:
      inactiveCount: inactiveStudents.length,
      placementCompletedCount: placementCount,
      placementCompletedPct: placementPct,
      totalLessonsCompleted,
      totalQuizAttempts,
      avgLessonsPerStudent,
      avgQuizAttemptsPerStudent,
      avgPlacementScore,
    },
    levelDistribution: levelDistribution.map(l => ({
      level: l.level || "Belirtilmemiş",
      count: Number(l.count),
    })),
    topStudents,
    // Yeni alanlar:
    weeklyTrend,
    inactiveStudents: inactiveStudents.map(s => ({
      id: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      email: s.email,
      currentLevel: s.currentLevel,
      lastActiveDate: s.lastActiveDate,
    })),
    recentPlacements,
  });
});

// GET /corporate/reports/csv — Öğrenci bazlı tam dökümü CSV olarak indir
router.get("/corporate/reports/csv", authMiddleware, requireRole("corporate"), async (req: AuthRequest, res) => {
  const companyId = await getCorporateCompanyId(req, res);
  if (!companyId) return;

  const { start, end } = parseDateRange(req.query);

  const studentIds = await companyStudentIds(companyId);
  if (studentIds.length === 0) {
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="corporate-report-empty.csv"`);
    res.send("id,firstName,lastName,email,currentLevel,totalPoints,streak,lastActiveDate,placementCompleted,lessonsCompleted,quizAttempts,avgQuizScore\n");
    return;
  }

  // Tüm öğrenciler
  const students = await db.select({
    id: usersTable.id,
    firstName: usersTable.firstName,
    lastName: usersTable.lastName,
    email: usersTable.email,
    currentLevel: usersTable.currentLevel,
    totalPoints: usersTable.totalPoints,
    streak: usersTable.streak,
    lastActiveDate: usersTable.lastActiveDate,
    placementTestCompleted: usersTable.placementTestCompleted,
    createdAt: usersTable.createdAt,
  }).from(usersTable)
    .where(and(eq(usersTable.companyId, companyId), eq(usersTable.role, "student")));

  // Lesson completions per user — opsiyonel date filtre
  const lessonConds = [inArray(lessonProgressTable.userId, studentIds), eq(lessonProgressTable.completed, true)];
  if (start) lessonConds.push(gte(lessonProgressTable.completedAt, start));
  if (end) lessonConds.push(lte(lessonProgressTable.completedAt, end));
  const lessonRows = await db.select({
    userId: lessonProgressTable.userId,
    cc: count(),
  }).from(lessonProgressTable).where(and(...lessonConds)).groupBy(lessonProgressTable.userId);
  const lessonMap = new Map(lessonRows.map(r => [r.userId, Number(r.cc)]));

  // Quiz attempts per user — opsiyonel date filtre
  const quizConds = [inArray(quizAttemptsTable.userId, studentIds)];
  if (start) quizConds.push(gte(quizAttemptsTable.submittedAt, start));
  if (end) quizConds.push(lte(quizAttemptsTable.submittedAt, end));
  const quizRows = await db.select({
    userId: quizAttemptsTable.userId,
    cc: count(),
    avgPct: sql<number>`coalesce(round(avg(${quizAttemptsTable.percentage})::numeric, 1), 0)`,
  }).from(quizAttemptsTable).where(and(...quizConds)).groupBy(quizAttemptsTable.userId);
  const quizMap = new Map(quizRows.map(r => [r.userId, { count: Number(r.cc), avgPct: Number(r.avgPct) }]));

  // CSV compose — RFC 4180 escape
  const esc = (v: any): string => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const header = [
    "id", "firstName", "lastName", "email", "currentLevel", "totalPoints",
    "streak", "lastActiveDate", "placementCompleted", "createdAt",
    "lessonsCompleted", "quizAttempts", "avgQuizScore",
  ];
  const lines = [header.join(",")];
  for (const s of students) {
    const q = quizMap.get(s.id);
    lines.push([
      esc(s.id),
      esc(s.firstName),
      esc(s.lastName),
      esc(s.email),
      esc(s.currentLevel ?? ""),
      esc(s.totalPoints),
      esc(s.streak),
      esc(s.lastActiveDate ?? ""),
      esc((s as any).placementTestCompleted ? "yes" : "no"),
      esc(s.createdAt ? new Date(s.createdAt as any).toISOString() : ""),
      esc(lessonMap.get(s.id) ?? 0),
      esc(q?.count ?? 0),
      esc(q?.avgPct ?? 0),
    ].join(","));
  }
  const csv = "﻿" + lines.join("\n") + "\n"; // UTF-8 BOM — Excel için

  const dateSuffix = start && end
    ? `${start.toISOString().split("T")[0]}_${end.toISOString().split("T")[0]}`
    : new Date().toISOString().split("T")[0];
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="corporate-report-${dateSuffix}.csv"`);
  res.send(csv);
});

export default router;
