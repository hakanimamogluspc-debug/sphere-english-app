import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { subscriptionsTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { authMiddleware } from "../middlewares/auth.js";
import { PLANS, getPlan, getEntitlement, PRO_MODULE_KEYS, isEnforcementEnabled } from "../lib/subscription.js";
import { PLAN_CATALOG } from "../lib/plans.js";

const router = Router();

// Tier başına kısa açıklamalar — frontend gösterimi için
const TIER_DESCRIPTIONS: Record<string, string> = {
  core: "Yeni başlayanlar için standart AI Coach + temel müfredat.",
  pro: "Tüm AI Studio özellikleri + Oxford A1-C1 müfredatı. En popüler.",
  premium: "Pro'nun her şeyi + sektörel modüller + aylık canlı koçluk.",
};

router.get("/subscription/plans", async (_req, res) => {
  // PLAN_CATALOG'u (Sphere Core/Pro/Premium × Aylık/Yıllık) frontend Plan interface
  // formatına dönüştür. Bu sayede admin'in yönettiği 6 plan kullanıcıya gösterilir.
  const plans = PLAN_CATALOG.map((p) => {
    const priceCents = Math.round(p.amount * 100);
    const isYearly = p.billingType === "yearly";
    return {
      key: p.code,
      name: `${p.label} ${isYearly ? "Yıllık" : "Aylık"}`,
      tier: p.tier,
      description: TIER_DESCRIPTIONS[p.tier] ?? "",
      priceCents,
      currency: "TRY" as const,
      interval: isYearly ? ("year" as const) : ("month" as const),
      intervalCount: 1,
      trialDays: 7,
      durationMonths: p.durationMonths,
      features: p.features,
      popular: p.popular ?? false,
      monthlyEquivalentCents: isYearly ? Math.round((p.amount / 12) * 100) : undefined,
      savingsPercent: isYearly ? 17 : undefined,
    };
  });

  res.json({
    plans,
    proModuleKeys: Array.from(PRO_MODULE_KEYS),
    trialDays: 7,
    enforcementEnabled: await isEnforcementEnabled(),
  });
});

router.get("/subscription/me", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as number;
    const [{ entitlement, raw }, enforcementEnabled] = await Promise.all([
      getEntitlement(userId),
      isEnforcementEnabled(),
    ]);
    res.json({
      entitlement,
      subscription: raw,
      proModuleKeys: Array.from(PRO_MODULE_KEYS),
      enforcementEnabled,
    });
  } catch (err: any) {
    console.error("subscription/me error:", err?.message || err);
    res.status(500).json({ error: "Abonelik bilgisi alınamadı." });
  }
});

router.post("/subscription/start-trial", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as number;
    const planKey = req.body?.planKey === "pro_yearly" ? "pro_yearly" : "pro_monthly";

    // Atomic one-shot trial: INSERT ... ON CONFLICT DO UPDATE WHERE trial never used
    // Returns the row only if the trial was actually granted (no prior trialStartedAt and not currently active).
    const result: any = await db.execute(sql`
      INSERT INTO subscriptions
        (user_id, plan_key, status, trial_started_at, trial_ends_at,
         current_period_start, current_period_end, cancel_at_period_end, canceled_at, updated_at)
      VALUES
        (${userId}, ${planKey}, 'trialing', NOW(), NOW() + INTERVAL '7 days',
         NOW(), NOW() + INTERVAL '7 days', false, NULL, NOW())
      ON CONFLICT (user_id) DO UPDATE
        SET plan_key = EXCLUDED.plan_key,
            status = 'trialing',
            trial_started_at = NOW(),
            trial_ends_at = NOW() + INTERVAL '7 days',
            current_period_start = NOW(),
            current_period_end = NOW() + INTERVAL '7 days',
            cancel_at_period_end = false,
            canceled_at = NULL,
            updated_at = NOW()
        WHERE subscriptions.trial_started_at IS NULL
          AND subscriptions.status NOT IN ('trialing','active')
      RETURNING *
    `);

    const rows = (result as any).rows ?? result;
    if (!rows || rows.length === 0) {
      // Conflict path with WHERE-false → not granted. Decide why.
      const { entitlement } = await getEntitlement(userId);
      if (entitlement.hasUsedTrial) {
        return res.status(400).json({ error: "Daha önce deneme süreni kullandın.", code: "trial_already_used" });
      }
      if (entitlement.active) {
        return res.status(400).json({ error: "Zaten aktif bir aboneliğin var.", code: "already_active" });
      }
      return res.status(400).json({ error: "Deneme başlatılamadı.", code: "trial_unavailable" });
    }

    const row = rows[0];
    res.json({ ok: true, subscription: row, daysLeft: 7 });
  } catch (err: any) {
    console.error("start-trial error:", err?.message || err);
    res.status(500).json({ error: "Deneme başlatılamadı." });
  }
});

router.post("/subscription/cancel", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as number;
    const [existing] = await db
      .select()
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.userId, userId))
      .limit(1);
    if (!existing || (existing.status !== "trialing" && existing.status !== "active")) {
      return res.status(400).json({ error: "İptal edilecek aktif bir abonelik bulunamadı." });
    }

    const now = new Date();
    const updated = await db
      .update(subscriptionsTable)
      .set({ cancelAtPeriodEnd: true, canceledAt: now, updatedAt: now })
      .where(eq(subscriptionsTable.id, existing.id))
      .returning();

    res.json({ ok: true, subscription: updated[0] });
  } catch (err: any) {
    console.error("cancel error:", err?.message || err);
    res.status(500).json({ error: "İptal edilemedi." });
  }
});

router.post("/subscription/resume", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as number;
    const [existing] = await db
      .select()
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.userId, userId))
      .limit(1);
    if (!existing || !existing.cancelAtPeriodEnd) {
      return res.status(400).json({ error: "Devam ettirilecek bir iptal isteği yok." });
    }
    const updated = await db
      .update(subscriptionsTable)
      .set({ cancelAtPeriodEnd: false, canceledAt: null, updatedAt: new Date() })
      .where(eq(subscriptionsTable.id, existing.id))
      .returning();
    res.json({ ok: true, subscription: updated[0] });
  } catch (err: any) {
    console.error("resume error:", err?.message || err);
    res.status(500).json({ error: "Devam ettirilemedi." });
  }
});

export default router;
