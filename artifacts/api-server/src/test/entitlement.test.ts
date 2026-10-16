import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { pool } from "@workspace/db";
import { resetDb, closeDb, registerUser } from "./helpers.js";
import { getEntitlement, AUTO_TRIAL_DAYS } from "../lib/subscription.js";

/**
 * lib/subscription.getEntitlement — abonelik durumunun tek doğruluk kaynağı.
 * Burada test edilen kurallar değişirse paywall / rapor / mail akışları da değişir.
 */
beforeAll(resetDb);
afterAll(closeDb);

async function setSubscription(userId: number, patch: Record<string, unknown>) {
  const cols = Object.keys(patch);
  const vals = Object.values(patch);
  await pool.query(
    `INSERT INTO subscriptions (user_id, plan_key, status, ${cols.join(", ")})
     VALUES ($1, 'sphere-pro-aylik', 'active', ${cols.map((_, i) => `$${i + 2}`).join(", ")})
     ON CONFLICT (user_id) DO UPDATE SET ${cols.map((c, i) => `${c} = $${i + 2}`).join(", ")}, status = 'active'`,
    [userId, ...vals],
  );
}

describe("getEntitlement", () => {
  it("yeni kayıt → otomatik deneme süresi (trialing, aktif)", async () => {
    const { user } = await registerUser();
    const { entitlement } = await getEntitlement(user.id);
    expect(entitlement.active).toBe(true);
    expect(entitlement.status).toBe("trialing");
    expect(entitlement.daysLeft).toBeGreaterThan(0);
    expect(entitlement.daysLeft).toBeLessThanOrEqual(AUTO_TRIAL_DAYS);
    expect(entitlement.hasUsedTrial).toBe(false);
  });

  it("deneme süresi geçmiş, abonelik yok → pasif (none)", async () => {
    const { user } = await registerUser();
    await pool.query(`UPDATE users SET created_at = NOW() - INTERVAL '${AUTO_TRIAL_DAYS + 1} days' WHERE id = $1`, [user.id]);
    const { entitlement } = await getEntitlement(user.id);
    expect(entitlement.active).toBe(false);
    expect(entitlement.status).toBe("none");
  });

  it("aktif ödenmiş abonelik → active, kalan gün dönem sonuna göre", async () => {
    const { user } = await registerUser();
    await setSubscription(user.id, {
      current_period_end: new Date(Date.now() + 10 * 86_400_000),
      expires_at: new Date(Date.now() + 10 * 86_400_000),
    });
    const { entitlement } = await getEntitlement(user.id);
    expect(entitlement.active).toBe(true);
    expect(entitlement.status).toBe("active");
    expect(entitlement.daysLeft).toBeGreaterThanOrEqual(9);
    expect(entitlement.daysLeft).toBeLessThanOrEqual(10);
  });

  it("dönemi geçmiş abonelik → past_due'ya düşer ve DB'ye yazılır (lazy expiry)", async () => {
    const { user } = await registerUser();
    await setSubscription(user.id, {
      current_period_end: new Date(Date.now() - 86_400_000),
      expires_at: new Date(Date.now() - 86_400_000),
      cancel_at_period_end: false,
    });
    const { entitlement } = await getEntitlement(user.id);
    expect(entitlement.active).toBe(false);
    expect(entitlement.status).toBe("past_due");
    const { rows } = await pool.query(`SELECT status FROM subscriptions WHERE user_id = $1`, [user.id]);
    expect(rows[0].status).toBe("past_due");
  });

  it("iptal edilmiş + dönemi bitmiş abonelik → expired", async () => {
    const { user } = await registerUser();
    await setSubscription(user.id, {
      current_period_end: new Date(Date.now() - 86_400_000),
      expires_at: new Date(Date.now() - 86_400_000),
      cancel_at_period_end: true,
    });
    const { entitlement } = await getEntitlement(user.id);
    expect(entitlement.active).toBe(false);
    expect(entitlement.status).toBe("expired");
  });

  it("iptal edilmiş ama dönemi sürüyor → hâlâ aktif, cancelAtPeriodEnd=true", async () => {
    const { user } = await registerUser();
    await setSubscription(user.id, {
      current_period_end: new Date(Date.now() + 5 * 86_400_000),
      expires_at: new Date(Date.now() + 5 * 86_400_000),
      cancel_at_period_end: true,
    });
    const { entitlement } = await getEntitlement(user.id);
    expect(entitlement.active).toBe(true);
    expect(entitlement.cancelAtPeriodEnd).toBe(true);
  });
});
