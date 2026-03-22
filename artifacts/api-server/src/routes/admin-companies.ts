import { Router } from "express";
import { db, companiesTable, usersTable } from "@workspace/db";
import { eq, and, count, sql, ilike } from "drizzle-orm";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth.js";

const router = Router();

// GET /admin/companies — Tüm kurumları listele
router.get("/admin/companies", authMiddleware, requireRole("admin"), async (_req: AuthRequest, res) => {
  const companies = await db.select().from(companiesTable).orderBy(companiesTable.createdAt);

  const result = await Promise.all(
    companies.map(async (c) => {
      const [{ studentCount }] = await db
        .select({ studentCount: count() })
        .from(usersTable)
        .where(and(eq(usersTable.companyId, c.id), eq(usersTable.role, "student")));

      const [{ corporateCount }] = await db
        .select({ corporateCount: count() })
        .from(usersTable)
        .where(and(eq(usersTable.companyId, c.id), eq(usersTable.role, "corporate")));

      return {
        ...c,
        studentCount: Number(studentCount),
        corporateCount: Number(corporateCount),
        remaining: c.registrationLimit > 0 ? Math.max(0, c.registrationLimit - Number(studentCount)) : null,
      };
    })
  );

  res.json(result);
});

// POST /admin/companies — Yeni kurum oluştur
router.post("/admin/companies", authMiddleware, requireRole("admin"), async (_req: AuthRequest, res) => {
  const { name, registrationLimit = 0 } = _req.body;
  if (!name || name.trim() === "") {
    res.status(400).json({ error: "Kurum adı zorunludur" });
    return;
  }

  const existing = await db
    .select()
    .from(companiesTable)
    .where(sql`lower(${companiesTable.name}) = lower(${name.trim()})`)
    .limit(1);

  if (existing.length > 0) {
    res.status(400).json({ error: "Bu isimde bir kurum zaten mevcut" });
    return;
  }

  const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(companiesTable);
  const nextNum = (Number(countResult.count) + 1).toString().padStart(4, "0");
  const code = `KUR-${nextNum}`;

  const [company] = await db
    .insert(companiesTable)
    .values({ name: name.trim(), code, registrationLimit: Number(registrationLimit) })
    .returning();

  res.status(201).json(company);
});

// PATCH /admin/companies/:id — Kurum güncelle (limit vb.)
router.patch("/admin/companies/:id", authMiddleware, requireRole("admin"), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const { name, registrationLimit } = req.body;

  const updates: any = {};
  if (name !== undefined && name.trim() !== "") updates.name = name.trim();
  if (registrationLimit !== undefined) updates.registrationLimit = Number(registrationLimit);

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "Güncellenecek alan yok" });
    return;
  }

  if (updates.name) {
    const existing = await db
      .select()
      .from(companiesTable)
      .where(and(sql`lower(${companiesTable.name}) = lower(${updates.name})`, sql`${companiesTable.id} != ${id}`))
      .limit(1);
    if (existing.length > 0) {
      res.status(400).json({ error: "Bu isimde başka bir kurum zaten mevcut" });
      return;
    }
  }

  const [updated] = await db
    .update(companiesTable)
    .set(updates)
    .where(eq(companiesTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Kurum bulunamadı" }); return; }

  const [{ studentCount }] = await db
    .select({ studentCount: count() })
    .from(usersTable)
    .where(and(eq(usersTable.companyId, id), eq(usersTable.role, "student")));

  res.json({
    ...updated,
    studentCount: Number(studentCount),
    remaining: updated.registrationLimit > 0 ? Math.max(0, updated.registrationLimit - Number(studentCount)) : null,
  });
});

// DELETE /admin/companies/:id — Kurum sil
router.delete("/admin/companies/:id", authMiddleware, requireRole("admin"), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);

  const [{ count: userCount }] = await db
    .select({ count: count() })
    .from(usersTable)
    .where(eq(usersTable.companyId, id));

  if (Number(userCount) > 0) {
    res.status(400).json({ error: `Bu kuruma bağlı ${userCount} kullanıcı bulunuyor. Önce kullanıcıları silin.` });
    return;
  }

  await db.delete(companiesTable).where(eq(companiesTable.id, id));
  res.json({ success: true });
});

export default router;
