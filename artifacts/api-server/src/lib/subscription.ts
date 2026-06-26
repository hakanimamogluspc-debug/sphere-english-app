import { db } from "@workspace/db";
import { subscriptionsTable, featureSettingsTable, usersTable, type Subscription, type SubscriptionPlanKey } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

/**
 * Yeni hesaplara otomatik verilen ücretsiz deneme süresi (gün).
 * users.createdAt + bu süre > NOW ise kullanıcı henüz subscription kaydı
 * oluşturmamış olsa bile virtual 'trialing' entitlement döndürürüz.
 */
export const AUTO_TRIAL_DAYS = 7;

// ── Enforcement flag (admin toggleable). Iyzico hazır olana kadar kapalı kalabilir.
let enforcementCache: { value: boolean; expiresAt: number } | null = null;
const ENFORCEMENT_TTL_MS = 30_000;

export async function isEnforcementEnabled(): Promise<boolean> {
  if (enforcementCache && Date.now() < enforcementCache.expiresAt) return enforcementCache.value;
  try {
    const [row] = await db
      .select({ isEnabled: featureSettingsTable.isEnabled })
      .from(featureSettingsTable)
      .where(eq(featureSettingsTable.key, "subscription-enforcement"))
      .limit(1);
    const value = !!row?.isEnabled;
    enforcementCache = { value, expiresAt: Date.now() + ENFORCEMENT_TTL_MS };
    return value;
  } catch {
    return false; // güvenli varsayılan: kapalı (kilitsiz)
  }
}

export function invalidateEnforcementCache() {
  enforcementCache = null;
}

/**
 * Static plan catalog. No payment is collected yet — Iyzico will plug in later.
 * Prices are in TRY, stored in kuruş (cents) for precision (29900 = 299.00 TL).
 */
export interface PlanDefinition {
  key: SubscriptionPlanKey;
  name: string;
  description: string;
  priceCents: number;
  currency: "TRY";
  interval: "month" | "year";
  intervalCount: number;
  trialDays: number;
  monthlyEquivalentCents?: number;
  savingsPercent?: number;
  popular?: boolean;
}

export const PLANS: PlanDefinition[] = [
  {
    key: "pro_monthly",
    name: "Pro Aylık",
    description: "Tüm AI Studio özellikleri açık. İstediğin zaman iptal et.",
    priceCents: 29900,
    currency: "TRY",
    interval: "month",
    intervalCount: 1,
    trialDays: 7,
  },
  {
    key: "pro_yearly",
    name: "Pro Yıllık",
    description: "12 ay boyunca tüm Pro özellikler. ~%17 indirimli.",
    priceCents: 299000,
    currency: "TRY",
    interval: "year",
    intervalCount: 1,
    trialDays: 7,
    monthlyEquivalentCents: 24917,
    savingsPercent: 17,
    popular: true,
  },
];

export function getPlan(key: string | null | undefined): PlanDefinition | null {
  if (!key) return null;
  return PLANS.find((p) => p.key === key) || null;
}

/**
 * Module keys that require an active subscription (trial or paid).
 * Free tier keeps: courses, materials, live classes, basic quizzes,
 * speaking club, forum, progress, certificates, leaderboard, messages,
 * and the new CEFR level-pass exams.
 */
export const PRO_MODULE_KEYS = new Set<string>([
  "student-pronunciation-coach",
  "student-writing-coach",
  "student-vocab-game",
  "student-grammar-coach",
  "student-simulation-mode",
  "student-interview-sim",
  "student-presentation-sim",
  "student-ai-quiz",
  "student-ai-tutor",
  "student-learning-path",
]);

export interface Entitlement {
  active: boolean;
  status: Subscription["status"];
  planKey: Subscription["planKey"];
  daysLeft: number | null;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  hasUsedTrial: boolean;
}

function diffDays(target: Date | null | undefined): number | null {
  if (!target) return null;
  const ms = target.getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

/**
 * Returns the user's effective entitlement. If no row exists, returns 'none'.
 * Auto-expires trial/paid subs whose end date is in the past (lazy mark).
 */
export async function getEntitlement(userId: number): Promise<{ entitlement: Entitlement; raw: Subscription | null }> {
  const [row] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, userId)).limit(1);
  if (!row) {
    // Subscription kaydı yok — kullanıcının createdAt'ına göre otomatik 7 günlük trial uygula
    const [user] = await db
      .select({ createdAt: usersTable.createdAt })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (user?.createdAt) {
      const trialEndsAt = new Date(user.createdAt.getTime() + AUTO_TRIAL_DAYS * 24 * 60 * 60 * 1000);
      const now = Date.now();
      if (trialEndsAt.getTime() > now) {
        // Hâlâ otomatik trial süresi içinde
        const daysLeft = Math.max(0, Math.ceil((trialEndsAt.getTime() - now) / (1000 * 60 * 60 * 24)));
        return {
          raw: null,
          entitlement: {
            active: true,
            status: "trialing",
            planKey: null,
            daysLeft,
            trialEndsAt,
            currentPeriodEnd: null,
            cancelAtPeriodEnd: false,
            hasUsedTrial: false,
          },
        };
      }
    }

    return {
      raw: null,
      entitlement: {
        active: false,
        status: "none",
        planKey: null,
        daysLeft: null,
        trialEndsAt: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        hasUsedTrial: false,
      },
    };
  }

  let status = row.status;
  const now = Date.now();
  // Lazy expiry transitions
  if (status === "trialing" && row.trialEndsAt && row.trialEndsAt.getTime() <= now) {
    status = "expired";
    await db.update(subscriptionsTable).set({ status, updatedAt: new Date() }).where(eq(subscriptionsTable.id, row.id));
  } else if (status === "active" && row.currentPeriodEnd && row.currentPeriodEnd.getTime() <= now) {
    status = row.cancelAtPeriodEnd ? "expired" : "past_due";
    await db.update(subscriptionsTable).set({ status, updatedAt: new Date() }).where(eq(subscriptionsTable.id, row.id));
  }

  const active = status === "trialing" || status === "active";
  const daysLeft =
    status === "trialing" ? diffDays(row.trialEndsAt) : status === "active" ? diffDays(row.currentPeriodEnd) : null;

  return {
    raw: { ...row, status },
    entitlement: {
      active,
      status,
      planKey: row.planKey,
      daysLeft,
      trialEndsAt: row.trialEndsAt,
      currentPeriodEnd: row.currentPeriodEnd,
      cancelAtPeriodEnd: row.cancelAtPeriodEnd,
      hasUsedTrial: row.trialStartedAt != null,
    },
  };
}
