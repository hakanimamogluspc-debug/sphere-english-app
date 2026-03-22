import { Router } from "express";
import { db, groupsTable, usersTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
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

export default router;
