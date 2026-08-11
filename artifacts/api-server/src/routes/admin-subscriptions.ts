import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { subscriptionsTable, usersTable } from "@workspace/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { authMiddleware } from "../middlewares/auth.js";
import { getPlan } from "../lib/subscription.js";
import { getPlan as getNewPlan, PLAN_CATALOG } from "../lib/plans.js";

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

/**
 * Admin: kullanıcıya abonelik ata / güncelle.
 *
 * Body:
 *   { planCode, startedAt?, expiresAt?, status?, notes? }
 *
 * - planCode: yeni 6 planın biri (sphere-core-aylik, sphere-pro-yillik vs.)
 * - startedAt: opsiyonel başlangıç tarihi (ISO date). Boşsa şimdi.
 * - expiresAt: opsiyonel bitiş tarihi. Boşsa planın durationMonths'ına göre hesaplanır.
 * - status: opsiyonel ("active", "trialing", "canceled" vb.). Boşsa "active".
 * - notes: admin notu (max 500 chr).
 *
 * Geriye uyumluluk: planKey gönderilirse eski "pro_monthly" / "pro_yearly" da kabul edilir.
 */
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

      // Yeni planCode öncelikli, eski planKey fallback
      const rawCode = String(req.body?.planCode ?? req.body?.planKey ?? "").trim();
      const note = req.body?.notes ? String(req.body.notes).slice(0, 500) : null;
      const requestedStatus = req.body?.status ? String(req.body.status) : "active";
      const allowedStatuses = ["active", "trialing", "pending", "past_due", "canceled", "expired", "failed", "none"];
      const status = allowedStatuses.includes(requestedStatus) ? requestedStatus : "active";

      // Yeni katalogtan plan bul
      let newPlan = getNewPlan(rawCode);
      // Eski plan key fallback (pro_monthly → sphere-pro-aylik)
      if (!newPlan) {
        const legacyMap: Record<string, string> = {
          pro_monthly: "sphere-pro-aylik",
          pro_yearly: "sphere-pro-yillik",
        };
        newPlan = getNewPlan(legacyMap[rawCode] ?? "");
      }
      if (!newPlan) {
        return res.status(400).json({
          error: "Geçersiz plan kodu. Geçerli kodlar: " + PLAN_CATALOG.map((p) => p.code).join(", "),
        });
      }

      // Tarih hesapla
      const now = new Date();
      const startedAt = req.body?.startedAt ? new Date(String(req.body.startedAt)) : now;
      let expiresAt: Date;
      if (req.body?.expiresAt) {
        expiresAt = new Date(String(req.body.expiresAt));
      } else {
        expiresAt = new Date(startedAt);
        expiresAt.setMonth(expiresAt.getMonth() + (newPlan.durationMonths ?? 1));
      }
      if (Number.isNaN(startedAt.getTime()) || Number.isNaN(expiresAt.getTime())) {
        return res.status(400).json({ error: "Geçersiz tarih formatı (ISO bekleniyor)" });
      }

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
            planKey: newPlan.code,
            planLabel: newPlan.label,
            amount: String(newPlan.amount),
            currency: "TRY",
            billingType: newPlan.billingType,
            durationMonths: newPlan.durationMonths,
            status,
            startedAt,
            expiresAt,
            currentPeriodStart: startedAt,
            currentPeriodEnd: expiresAt,
            cancelAtPeriodEnd: false,
            canceledAt: status === "canceled" ? now : null,
            grantedByAdminId: adminId,
            provider: "manual",
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
            planKey: newPlan.code,
            planLabel: newPlan.label,
            amount: String(newPlan.amount),
            currency: "TRY",
            billingType: newPlan.billingType,
            durationMonths: newPlan.durationMonths,
            status,
            startedAt,
            expiresAt,
            currentPeriodStart: startedAt,
            currentPeriodEnd: expiresAt,
            grantedByAdminId: adminId,
            provider: "manual",
            notes: note,
          })
          .returning();
        row = inserted[0];
      }

      res.json({ ok: true, subscription: row });
    } catch (err: any) {
      console.error("grant error:", err?.message || err);
      res.status(500).json({ error: "Abonelik atanamadı: " + (err?.message || "bilinmeyen hata") });
    }
  }
);

/**
 * Admin: plan kataloğunu döndür — frontend dropdown için.
 */
router.get(
  "/admin/subscriptions/plans",
  authMiddleware,
  async (req, res, next) => requireAdmin(req, res, () => next()),
  async (_req: Request, res: Response) => {
    res.json({ plans: PLAN_CATALOG });
  },
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
