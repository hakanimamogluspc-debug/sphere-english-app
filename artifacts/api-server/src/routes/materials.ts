import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db, materialFoldersTable, materialsTable, studentMaterialAccessTable, usersTable } from "@workspace/db";
import { eq, and, asc, desc, ne } from "drizzle-orm";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth.js";

const router = Router();

// ─── Upload directory ────────────────────────────────────────────────────────
const uploadDir = path.join(process.cwd(), "uploads", "materials");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const ALLOWED_MIMES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
];

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Desteklenmeyen dosya türü. İzin verilen: PDF, PPTX, DOCX, PNG, JPEG"));
    }
  },
});

function getFileType(mimetype: string): string {
  if (mimetype === "application/pdf") return "pdf";
  if (mimetype.includes("presentation")) return "pptx";
  if (mimetype.includes("powerpoint")) return "pptx";
  if (mimetype.includes("wordprocessingml") || mimetype.includes("msword")) return "docx";
  if (mimetype.startsWith("image/")) return mimetype.split("/")[1] || "image";
  return "file";
}

// ─── Folders ─────────────────────────────────────────────────────────────────

// GET /materials/folders — list folders (students get filtered, admin/teacher get all)
router.get("/materials/folders", authMiddleware, async (req: AuthRequest, res) => {
  const role = req.userRole;
  const userId = req.userId!;

  let folders = await db.select().from(materialFoldersTable).orderBy(asc(materialFoldersTable.order), asc(materialFoldersTable.createdAt));

  if (role === "student") {
    // Only show active folders not blocked for this student
    folders = folders.filter(f => f.isActive);
    const blocks = await db.select().from(studentMaterialAccessTable)
      .where(and(eq(studentMaterialAccessTable.studentId, userId), eq(studentMaterialAccessTable.isBlocked, true)));
    const blockedIds = new Set(blocks.map(b => b.folderId));
    folders = folders.filter(f => !blockedIds.has(f.id));
  }

  // Enrich with material count and creator name
  const enriched = await Promise.all(folders.map(async (f) => {
    const mats = await db.select().from(materialsTable).where(and(eq(materialsTable.folderId, f.id), eq(materialsTable.isActive, true)));
    let creatorName: string | null = null;
    if (f.createdBy) {
      const [u] = await db.select({ firstName: usersTable.firstName, lastName: usersTable.lastName })
        .from(usersTable).where(eq(usersTable.id, f.createdBy)).limit(1);
      if (u) creatorName = `${u.firstName} ${u.lastName}`;
    }
    return { ...f, materialCount: mats.length, creatorName };
  }));

  res.json(enriched);
});

// GET /materials/folders/:id — folder detail with materials
router.get("/materials/folders/:id", authMiddleware, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const [folder] = await db.select().from(materialFoldersTable).where(eq(materialFoldersTable.id, id)).limit(1);
  if (!folder) { res.status(404).json({ error: "Klasör bulunamadı" }); return; }

  let mats = await db.select().from(materialsTable)
    .where(eq(materialsTable.folderId, id))
    .orderBy(asc(materialsTable.order), asc(materialsTable.createdAt));

  if (req.userRole === "student") {
    mats = mats.filter(m => m.isActive);
  }

  const enrichedMats = await Promise.all(mats.map(async (m) => {
    let uploaderName: string | null = null;
    if (m.uploadedBy) {
      const [u] = await db.select({ firstName: usersTable.firstName, lastName: usersTable.lastName })
        .from(usersTable).where(eq(usersTable.id, m.uploadedBy)).limit(1);
      if (u) uploaderName = `${u.firstName} ${u.lastName}`;
    }
    return { ...m, uploaderName };
  }));

  res.json({ ...folder, materials: enrichedMats });
});

// POST /materials/folders — create folder
router.post("/materials/folders", authMiddleware, requireRole("admin", "teacher"), async (req: AuthRequest, res) => {
  const { name, description } = req.body;
  if (!name) { res.status(400).json({ error: "Klasör adı gereklidir" }); return; }

  const [folder] = await db.insert(materialFoldersTable).values({
    name, description: description || null, createdBy: req.userId, isActive: true, order: 0,
  }).returning();
  res.status(201).json({ ...folder, materialCount: 0, creatorName: null });
});

// PATCH /materials/folders/:id — update folder
router.patch("/materials/folders/:id", authMiddleware, requireRole("admin", "teacher"), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const { name, description, isActive, order } = req.body;
  const updates: any = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (isActive !== undefined) updates.isActive = isActive;
  if (order !== undefined) updates.order = parseInt(order);

  const [updated] = await db.update(materialFoldersTable).set(updates).where(eq(materialFoldersTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Klasör bulunamadı" }); return; }
  res.json(updated);
});

// DELETE /materials/folders/:id — delete folder and all its files
router.delete("/materials/folders/:id", authMiddleware, requireRole("admin"), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const mats = await db.select().from(materialsTable).where(eq(materialsTable.folderId, id));
  for (const m of mats) {
    const filePath = path.join(uploadDir, path.basename(m.fileUrl));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  await db.delete(materialFoldersTable).where(eq(materialFoldersTable.id, id));
  res.json({ success: true });
});

// ─── Materials (files) ────────────────────────────────────────────────────────

// POST /materials/folders/:id/upload — upload file
router.post(
  "/materials/folders/:id/upload",
  authMiddleware,
  requireRole("admin", "teacher"),
  upload.single("file"),
  async (req: AuthRequest, res) => {
    const folderId = parseInt(req.params.id);
    const { title } = req.body;
    const file = req.file;

    if (!file) { res.status(400).json({ error: "Dosya gereklidir" }); return; }
    if (!title) { res.status(400).json({ error: "Başlık gereklidir" }); return; }

    const fileUrl = `/uploads/materials/${file.filename}`;
    const fileType = getFileType(file.mimetype);

    const [mat] = await db.insert(materialsTable).values({
      folderId,
      title,
      fileName: file.originalname,
      fileUrl,
      fileType,
      fileSize: file.size,
      uploadedBy: req.userId,
      isActive: true,
      order: 0,
    }).returning();

    res.status(201).json(mat);
  }
);

// PATCH /materials/:id — update material (title, isActive)
router.patch("/materials/:id", authMiddleware, requireRole("admin", "teacher"), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const { title, isActive } = req.body;
  const updates: any = {};
  if (title !== undefined) updates.title = title;
  if (isActive !== undefined) updates.isActive = isActive;

  const [updated] = await db.update(materialsTable).set(updates).where(eq(materialsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Materyal bulunamadı" }); return; }
  res.json(updated);
});

// DELETE /materials/:id — delete a material
router.delete("/materials/:id", authMiddleware, requireRole("admin", "teacher"), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const [mat] = await db.select().from(materialsTable).where(eq(materialsTable.id, id)).limit(1);
  if (!mat) { res.status(404).json({ error: "Materyal bulunamadı" }); return; }

  const filePath = path.join(uploadDir, path.basename(mat.fileUrl));
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  await db.delete(materialsTable).where(eq(materialsTable.id, id));
  res.json({ success: true });
});

// ─── Admin: Student access control ───────────────────────────────────────────

// GET /admin/materials/folders/:id/access — get student access list for a folder
router.get("/admin/materials/folders/:id/access", authMiddleware, requireRole("admin"), async (req: AuthRequest, res) => {
  const folderId = parseInt(req.params.id);
  const students = await db.select({
    id: usersTable.id, firstName: usersTable.firstName, lastName: usersTable.lastName, email: usersTable.email,
  }).from(usersTable).where(eq(usersTable.role, "student"));

  const blocks = await db.select().from(studentMaterialAccessTable)
    .where(and(eq(studentMaterialAccessTable.folderId, folderId), eq(studentMaterialAccessTable.isBlocked, true)));
  const blockedIds = new Set(blocks.map(b => b.studentId));

  const result = students.map(s => ({ ...s, hasAccess: !blockedIds.has(s.id) }));
  res.json(result);
});

// POST /admin/materials/folders/:id/access — toggle student access
router.post("/admin/materials/folders/:id/access", authMiddleware, requireRole("admin"), async (req: AuthRequest, res) => {
  const folderId = parseInt(req.params.id);
  const { studentId, hasAccess } = req.body;
  if (!studentId) { res.status(400).json({ error: "studentId gereklidir" }); return; }

  const [existing] = await db.select().from(studentMaterialAccessTable)
    .where(and(eq(studentMaterialAccessTable.folderId, folderId), eq(studentMaterialAccessTable.studentId, parseInt(studentId)))).limit(1);

  if (existing) {
    await db.update(studentMaterialAccessTable)
      .set({ isBlocked: !hasAccess, updatedAt: new Date() })
      .where(eq(studentMaterialAccessTable.id, existing.id));
  } else if (!hasAccess) {
    await db.insert(studentMaterialAccessTable).values({
      folderId, studentId: parseInt(studentId), isBlocked: true, updatedAt: new Date(),
    });
  }
  res.json({ success: true, studentId, hasAccess });
});

export default router;
