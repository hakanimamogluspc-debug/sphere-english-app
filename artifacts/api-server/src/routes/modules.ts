import { Router } from "express";
import { db, modulesTable, lessonsTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth.js";

const router = Router();

router.post("/modules", authMiddleware, requireRole("admin", "teacher"), async (req: AuthRequest, res) => {
  const { courseId, title, description, order } = req.body;
  if (!courseId || !title) { res.status(400).json({ error: "courseId and title are required" }); return; }

  const [m] = await db.insert(modulesTable).values({ courseId, title, description: description || null, order: order || 0 }).returning();
  res.status(201).json({ ...m, lessonsCount: 0 });
});

router.patch("/modules/:id", authMiddleware, requireRole("admin", "teacher"), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const { title, description, order } = req.body;
  const updates: any = {};
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (order !== undefined) updates.order = order;

  const [updated] = await db.update(modulesTable).set(updates).where(eq(modulesTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Module not found" }); return; }
  const [{ lc }] = await db.select({ lc: count() }).from(lessonsTable).where(eq(lessonsTable.moduleId, id));
  res.json({ ...updated, lessonsCount: Number(lc) });
});

router.delete("/modules/:id", authMiddleware, requireRole("admin", "teacher"), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  await db.delete(modulesTable).where(eq(modulesTable.id, id));
  res.json({ success: true, message: "Module deleted" });
});

export default router;
