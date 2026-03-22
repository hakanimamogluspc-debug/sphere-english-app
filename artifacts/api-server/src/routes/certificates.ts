import { Router } from "express";
import { randomBytes } from "crypto";
import { db, certificatesTable, usersTable, coursesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth.js";

const router = Router();

async function enrichCert(cert: any) {
  const [user] = await db.select({ firstName: usersTable.firstName, lastName: usersTable.lastName })
    .from(usersTable).where(eq(usersTable.id, cert.userId)).limit(1);
  const [course] = await db.select({ title: coursesTable.title, level: coursesTable.level, teacherId: coursesTable.teacherId })
    .from(coursesTable).where(eq(coursesTable.id, cert.courseId)).limit(1);
  let teacherName = null;
  if (course?.teacherId) {
    const [teacher] = await db.select({ firstName: usersTable.firstName, lastName: usersTable.lastName })
      .from(usersTable).where(eq(usersTable.id, course.teacherId)).limit(1);
    teacherName = teacher ? `${teacher.firstName} ${teacher.lastName}` : null;
  }
  return {
    ...cert,
    issuedAt: cert.issuedAt.toISOString(),
    userName: user ? `${user.firstName} ${user.lastName}` : null,
    courseTitle: course?.title || "Unknown Course",
    level: course?.level || "A1",
    teacherName,
  };
}

router.get("/certificates", authMiddleware, async (req: AuthRequest, res) => {
  const certs = await db.select().from(certificatesTable).where(eq(certificatesTable.userId, req.userId!));
  const enriched = await Promise.all(certs.map(enrichCert));
  res.json(enriched);
});

router.get("/certificates/verify/:code", async (req, res) => {
  const [cert] = await db.select().from(certificatesTable).where(eq(certificatesTable.verificationCode, req.params.code)).limit(1);
  if (!cert) { res.json({ valid: false }); return; }
  res.json({ valid: true, certificate: await enrichCert(cert) });
});

router.get("/certificates/:id", authMiddleware, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const [cert] = await db.select().from(certificatesTable).where(eq(certificatesTable.id, id)).limit(1);
  if (!cert) { res.status(404).json({ error: "Certificate not found" }); return; }
  res.json(await enrichCert(cert));
});

router.post("/certificates/issue", authMiddleware, requireRole("admin", "teacher"), async (req: AuthRequest, res) => {
  const { userId, courseId } = req.body;
  const verificationCode = randomBytes(8).toString("hex").toUpperCase();
  const [cert] = await db.insert(certificatesTable).values({ userId, courseId, verificationCode }).returning();
  res.status(201).json(await enrichCert(cert));
});

export default router;
