import { Router } from "express";
import { db, groupsTable, groupMembersTable, usersTable, companiesTable } from "@workspace/db";
import { eq, count, and, inArray } from "drizzle-orm";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth.js";

const router = Router();

// GET /admin/groups
router.get("/admin/groups", authMiddleware, requireRole("admin"), async (_req, res) => {
  const groups = await db.select().from(groupsTable).orderBy(groupsTable.createdAt);

  const result = await Promise.all(
    groups.map(async (g) => {
      let teacher = null;
      if (g.teacherId) {
        const [t] = await db
          .select({ id: usersTable.id, firstName: usersTable.firstName, lastName: usersTable.lastName, email: usersTable.email })
          .from(usersTable)
          .where(eq(usersTable.id, g.teacherId))
          .limit(1);
        teacher = t || null;
      }
      return { ...g, teacher };
    })
  );

  res.json(result);
});

// GET /admin/teachers — öğretmen listesi (grup atama için)
router.get("/admin/teachers", authMiddleware, requireRole("admin"), async (_req, res) => {
  const teachers = await db
    .select({ id: usersTable.id, firstName: usersTable.firstName, lastName: usersTable.lastName, email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.role, "teacher"))
    .orderBy(usersTable.firstName);
  res.json(teachers);
});

// POST /admin/groups
router.post("/admin/groups", authMiddleware, requireRole("admin"), async (req: AuthRequest, res) => {
  const { name, description, teacherId } = req.body;
  if (!name || name.trim() === "") {
    res.status(400).json({ error: "Grup adı zorunludur" });
    return;
  }

  const [group] = await db
    .insert(groupsTable)
    .values({
      name: name.trim(),
      description: description?.trim() || null,
      teacherId: teacherId ? Number(teacherId) : null,
    })
    .returning();

  res.status(201).json(group);
});

// PATCH /admin/groups/:id
router.patch("/admin/groups/:id", authMiddleware, requireRole("admin"), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const { name, description, teacherId } = req.body;

  const updates: any = {};
  if (name !== undefined && name.trim() !== "") updates.name = name.trim();
  if (description !== undefined) updates.description = description?.trim() || null;
  if (teacherId !== undefined) updates.teacherId = teacherId ? Number(teacherId) : null;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "Güncellenecek alan yok" });
    return;
  }

  const [updated] = await db
    .update(groupsTable)
    .set(updates)
    .where(eq(groupsTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Grup bulunamadı" }); return; }

  let teacher = null;
  if (updated.teacherId) {
    const [t] = await db
      .select({ id: usersTable.id, firstName: usersTable.firstName, lastName: usersTable.lastName, email: usersTable.email })
      .from(usersTable)
      .where(eq(usersTable.id, updated.teacherId))
      .limit(1);
    teacher = t || null;
  }

  res.json({ ...updated, teacher });
});

// DELETE /admin/groups/:id
router.delete("/admin/groups/:id", authMiddleware, requireRole("admin"), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  await db.delete(groupsTable).where(eq(groupsTable.id, id));
  res.json({ success: true });
});

// GET /admin/teachers/:id/groups — öğretmenin grupları + öğrenci sayısı
router.get("/admin/teachers/:id/groups", authMiddleware, requireRole("admin"), async (req: AuthRequest, res) => {
  const teacherId = parseInt(req.params.id);
  const groups = await db.select().from(groupsTable).where(eq(groupsTable.teacherId, teacherId));
  const result = await Promise.all(groups.map(async (g) => {
    const [{ mc }] = await db.select({ mc: count() }).from(groupMembersTable).where(eq(groupMembersTable.groupId, g.id));
    return { ...g, memberCount: Number(mc) };
  }));
  res.json(result);
});

// GET /admin/groups/:id/students — gruptaki öğrenciler
router.get("/admin/groups/:id/students", authMiddleware, requireRole("admin"), async (req: AuthRequest, res) => {
  const groupId = parseInt(req.params.id);
  const members = await db.select({ studentId: groupMembersTable.studentId })
    .from(groupMembersTable).where(eq(groupMembersTable.groupId, groupId));
  if (members.length === 0) { res.json([]); return; }
  const studentIds = members.map((m) => m.studentId);
  const students = await db.select({
    id: usersTable.id, firstName: usersTable.firstName, lastName: usersTable.lastName,
    email: usersTable.email, currentLevel: usersTable.currentLevel, companyId: usersTable.companyId,
  }).from(usersTable).where(inArray(usersTable.id, studentIds));
  res.json(students);
});

// POST /admin/groups/:id/students — gruba öğrenci ekle (tek tek veya kurumdan)
router.post("/admin/groups/:id/students", authMiddleware, requireRole("admin"), async (req: AuthRequest, res) => {
  const groupId = parseInt(req.params.id);
  const { studentIds, companyId } = req.body;
  let idsToAdd: number[] = Array.isArray(studentIds) ? studentIds.map(Number) : [];
  if (companyId) {
    const companyStudents = await db.select({ id: usersTable.id })
      .from(usersTable).where(and(eq(usersTable.companyId, Number(companyId)), eq(usersTable.role, "student")));
    idsToAdd = [...new Set([...idsToAdd, ...companyStudents.map((s) => s.id)])];
  }
  if (idsToAdd.length === 0) { res.status(400).json({ error: "Eklenecek öğrenci bulunamadı" }); return; }
  await db.insert(groupMembersTable)
    .values(idsToAdd.map((sid) => ({ groupId, studentId: sid })))
    .onConflictDoNothing();
  res.json({ success: true, added: idsToAdd.length });
});

// DELETE /admin/groups/:groupId/students/:studentId — gruptan öğrenci çıkar
router.delete("/admin/groups/:groupId/students/:studentId", authMiddleware, requireRole("admin"), async (req: AuthRequest, res) => {
  const groupId = parseInt(req.params.groupId);
  const studentId = parseInt(req.params.studentId);
  await db.delete(groupMembersTable)
    .where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.studentId, studentId)));
  res.json({ success: true });
});

// GET /admin/companies — kurum listesi (öğrenci ataması için)
router.get("/admin/companies-list", authMiddleware, requireRole("admin"), async (_req, res) => {
  const companies = await db.select({ id: companiesTable.id, name: companiesTable.name })
    .from(companiesTable).orderBy(companiesTable.name);
  res.json(companies);
});

export default router;
