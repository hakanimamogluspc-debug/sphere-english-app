import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { subscriptionsTable, usersTable } from "@workspace/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { authMiddleware } from "../middlewares/auth.js";
import { getPlan } from "../lib/subscription.js";

const router = Router();

async function requireAdmin(req: Request, res: Response, next: () => void) {
  const userId = (req as any).userId as number;
  const [me] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!me || me.role !== "admin") return res.status(403).json({ error: "Bu işlem için admin yetkisi gerekli." });
  next();
}

async function resolveStudent(rawId: string): Promise<{ ok: true; userId: number } | { ok: false; status: number; error: string }> {
  const userId = Number.parseInt(rawId, 10);
  if (!Number.isFinite(userId) || userId <= 0) {
    return { ok: false, status: 400, error: "Geçersiz kullanıcı kimliği." };
  }
  const [u] = await db.select({ id: usersTable.id, role: usersTable.role }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!u) return { ok: false, status: 404, error: "Kullanıcı bulunamadı." };
  if (u.role !== "student") return { ok: false, status: 422, error: "Sadece öğrenci hesaplarına abonelik atanabilir." };
  return { ok: true, userId };
}

router.get("/admin/subscriptions", authMiddleware, async (req, res, next) => requireAdmin(req, res, () => next()),
  async (_req, res: Response) => {
    try {
      const rows = await db
        .select({
          subscription: subscriptionsTable,
          userId: usersTable.id,
          email: usersTable.email,
          firstName: usersTable.firstName,
          lastName: usersTable.lastName,
          role: usersTable.role,
          currentLevel: usersTable.currentLevel,
        })
        .from(usersTable)
        .leftJoin(subscriptionsTable, eq(subscriptionsTable.userId, usersTable.id))
        .where(eq(usersTable.role, "student"))
        .orderBy(desc(usersTable.id))
        .limit(500);
      res.json({ users: rows });
    } catch (err: any) {
      console.error("admin/subscriptions list error:", err?.message || err);
      res.status(500).json({ error: "Liste alınamadı." });
    }
  }
);

router.post(
  "/admin/subscriptions/:userId/grant",
  authMiddleware,
  async (req, res, next) => requireAdmin(req, res, () => next()),
  async (req: Request, res: Response) => {
    try {
      const adminId = (req as any).userId as number;
      const resolved = await resolveStudent(req.params.userId);
      if (!resolved.ok) return res.status(resolved.status).json({ error: resolved.error });
      const userId = resolved.userId;
      const planKey = req.body?.planKey === "pro_yearly" ? "pro_yearly" : "pro_monthly";
      const note = req.body?.notes ? String(req.body.notes).slice(0, 500) : null;

      const plan = getPlan(planKey);
      if (!plan) return res.status(400).json({ error: "Geçersiz plan." });

      const now = new Date();
      const periodEnd = new Date(now);
      if (plan.interval === "year") periodEnd.setFullYear(periodEnd.getFullYear() + plan.intervalCount);
      else periodEnd.setMonth(periodEnd.getMonth() + plan.intervalCount);

      const [existing] = await db
        .select()
        .from(subscriptionsTable)
        .where(eq(subscriptionsTable.userId, userId))
        .limit(1);

      let row;
      if (existing) {
        const updated = await db
          .update(subscriptionsTable)
          .set({
            planKey,
            status: "active",
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            cancelAtPeriodEnd: false,
            canceledAt: null,
            grantedByAdminId: adminId,
            notes: note,
            updatedAt: now,
          })
          .where(eq(subscriptionsTable.id, existing.id))
          .returning();
        row = updated[0];
      } else {
        const inserted = await db
          .insert(subscriptionsTable)
          .values({
            userId,
            planKey,
            status: "active",
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            grantedByAdminId: adminId,
            notes: note,
          })
          .returning();
        row = inserted[0];
      }

      res.json({ ok: true, subscription: row });
    } catch (err: any) {
      console.error("grant error:", err?.message || err);
      res.status(500).json({ error: "Abonelik atanamadı." });
    }
  }
);

router.post(
  "/admin/subscriptions/:userId/revoke",
  authMiddleware,
  async (req, res, next) => requireAdmin(req, res, () => next()),
  async (req: Request, res: Response) => {
    try {
      const resolved = await resolveStudent(req.params.userId);
      if (!resolved.ok) return res.status(resolved.status).json({ error: resolved.error });
      const userId = resolved.userId;
      const [existing] = await db
        .select()
        .from(subscriptionsTable)
        .where(eq(subscriptionsTable.userId, userId))
        .limit(1);
      if (!existing) return res.status(404).json({ error: "Abonelik bulunamadı." });

      const now = new Date();
      const updated = await db
        .update(subscriptionsTable)
        .set({ status: "expired", canceledAt: now, cancelAtPeriodEnd: true, updatedAt: now })
        .where(eq(subscriptionsTable.id, existing.id))
        .returning();
      res.json({ ok: true, subscription: updated[0] });
    } catch (err: any) {
      console.error("revoke error:", err?.message || err);
      res.status(500).json({ error: "Abonelik iptal edilemedi." });
    }
  }
);

router.get(
  "/admin/subscriptions/stats",
  authMiddleware,
  async (req, res, next) => requireAdmin(req, res, () => next()),
  async (_req, res: Response) => {
    try {
      const rows = await db.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE status = 'trialing')::int AS trialing,
          COUNT(*) FILTER (WHERE status = 'active')::int AS active,
          COUNT(*) FILTER (WHERE status = 'expired')::int AS expired,
          COUNT(*) FILTER (WHERE status = 'canceled')::int AS canceled,
          COUNT(*)::int AS total
        FROM subscriptions
      `);
      const r: any = (rows as any).rows ? (rows as any).rows[0] : (rows as any)[0];
      res.json({
        trialing: r?.trialing ?? 0,
        active: r?.active ?? 0,
        expired: r?.expired ?? 0,
        canceled: r?.canceled ?? 0,
        total: r?.total ?? 0,
      });
    } catch (err: any) {
      console.error("stats error:", err?.message || err);
      res.status(500).json({ error: "İstatistik alınamadı." });
    }
  }
);

export default router;
