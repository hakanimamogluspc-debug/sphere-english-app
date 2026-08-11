import { Router } from "express";
import { db, companiesTable, usersTable } from "@workspace/db";
import { eq, and, count, sql } from "drizzle-orm";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth.js";

const router = Router();

// GET /admin/companies — Tüm kurumları listele (sadece admin)
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
        corporateRemaining: c.corporateLimit > 0 ? Math.max(0, c.corporateLimit - Number(corporateCount)) : null,
      };
    })
  );

  res.json(result);
});

// POST /admin/companies — Yeni kurum oluştur
router.post("/admin/companies", authMiddleware, requireRole("admin"), async (_req: AuthRequest, res) => {
  const {
    name,
    code: rawCode,
    companyTitle,
    address,
    taxOffice,
    taxNumber,
    contactNumber,
    registrationLimit = 0,
    corporateLimit = 0,
  } = _req.body;

  if (!name || name.trim() === "") {
    res.status(400).json({ error: "Kurum adı zorunludur" });
    return;
  }

  if (!rawCode || rawCode.trim() === "") {
    res.status(400).json({ error: "Kurum ID'si zorunludur" });
    return;
  }

  const code = rawCode.trim().toUpperCase();

  const existing = await db
    .select()
    .from(companiesTable)
    .where(sql`lower(${companiesTable.name}) = lower(${name.trim()})`)
    .limit(1);

  if (existing.length > 0) {
    res.status(400).json({ error: "Bu isimde bir kurum zaten mevcut" });
    return;
  }

  const existingCode = await db
    .select()
    .from(companiesTable)
    .where(sql`upper(${companiesTable.code}) = ${code}`)
    .limit(1);

  if (existingCode.length > 0) {
    res.status(400).json({ error: "Bu kurum ID'si zaten kullanımda" });
    return;
  }

  const [company] = await db
    .insert(companiesTable)
    .values({
      name: name.trim(),
      code,
      registrationLimit: Number(registrationLimit),
      corporateLimit: Number(corporateLimit),
      companyTitle: companyTitle?.trim() || null,
      address: address?.trim() || null,
      taxOffice: taxOffice?.trim() || null,
      taxNumber: taxNumber?.trim() || null,
      contactNumber: contactNumber?.trim() || null,
    })
    .returning();

  res.status(201).json(company);
});

// PATCH /admin/companies/:id — Kurum güncelle
router.patch("/admin/companies/:id", authMiddleware, requireRole("admin"), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const {
    name,
    code: rawCode,
    companyTitle,
    address,
    taxOffice,
    taxNumber,
    contactNumber,
    registrationLimit,
    corporateLimit,
  } = req.body;

  const updates: any = {};
  if (name !== undefined && name.trim() !== "") updates.name = name.trim();
  if (rawCode !== undefined && rawCode.trim() !== "") updates.code = rawCode.trim().toUpperCase();
  if (registrationLimit !== undefined) updates.registrationLimit = Number(registrationLimit);
  if (corporateLimit !== undefined) updates.corporateLimit = Number(corporateLimit);
  if (companyTitle !== undefined) updates.companyTitle = companyTitle?.trim() || null;
  if (address !== undefined) updates.address = address?.trim() || null;
  if (taxOffice !== undefined) updates.taxOffice = taxOffice?.trim() || null;
  if (taxNumber !== undefined) updates.taxNumber = taxNumber?.trim() || null;
  if (contactNumber !== undefined) updates.contactNumber = contactNumber?.trim() || null;

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

  if (updates.code) {
    const existingCode = await db
      .select()
      .from(companiesTable)
      .where(and(sql`upper(${companiesTable.code}) = ${updates.code}`, sql`${companiesTable.id} != ${id}`))
      .limit(1);
    if (existingCode.length > 0) {
      res.status(400).json({ error: "Bu kurum ID'si başka bir kurumda kullanımda" });
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

  const [{ corporateCount }] = await db
    .select({ corporateCount: count() })
    .from(usersTable)
    .where(and(eq(usersTable.companyId, id), eq(usersTable.role, "corporate")));

  res.json({
    ...updated,
    studentCount: Number(studentCount),
    corporateCount: Number(corporateCount),
    remaining: updated.registrationLimit > 0 ? Math.max(0, updated.registrationLimit - Number(studentCount)) : null,
    corporateRemaining: updated.corporateLimit > 0 ? Math.max(0, updated.corporateLimit - Number(corporateCount)) : null,
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
