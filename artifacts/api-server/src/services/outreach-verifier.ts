/**
 * Email Doğrulama Servisi
 *
 * Apify'ın email-verifier actor'unu kullanır.
 * Verify edilmemiş leadleri batch halinde gönderir, sonucu DB'ye yazar.
 */

import { db, outreachLeadsTable, outreachRunsTable } from "@workspace/db";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { getApifyClient } from "./apify-client.js";

type EmailVerifyResult = {
  email: string;
  status?: string; // 'valid' | 'invalid' | 'risky' | 'catch_all' | 'unknown'
  result?: string; // bazı actor'lar 'result' alanı kullanıyor
  isValid?: boolean;
  isCatchAll?: boolean;
  isDeliverable?: boolean;
  smtp?: { canConnect?: boolean; isDeliverable?: boolean };
};

function normalizeStatus(r: EmailVerifyResult): "valid" | "invalid" | "risky" | "catch_all" | "unknown" {
  const raw = (r.status ?? r.result ?? "").toLowerCase();
  if (raw === "valid" || r.isValid === true || r.isDeliverable === true) return "valid";
  if (raw === "invalid" || r.isValid === false || r.isDeliverable === false) return "invalid";
  if (raw === "catch_all" || raw === "catch-all" || r.isCatchAll === true) return "catch_all";
  if (raw === "risky" || raw === "unknown_smtp") return "risky";
  return "unknown";
}

/**
 * Verify edilmemiş tüm leadleri (max batchSize) doğrula.
 */
export async function verifyPendingLeads(
  options: { batchSize?: number } = {},
): Promise<{ runId: number; verified: number; valid: number; invalid: number; risky: number; error?: string }> {
  const batchSize = options.batchSize ?? 100;

  const [run] = await db
    .insert(outreachRunsTable)
    .values({
      jobType: "verification",
      status: "running",
      apifyActorId: "blackbird-team/email-verifier",
    })
    .returning();

  const client = getApifyClient();
  if (!client) {
    await db
      .update(outreachRunsTable)
      .set({ status: "failed", errorMessage: "APIFY_API_TOKEN tanımlı değil", completedAt: new Date() })
      .where(eq(outreachRunsTable.id, run.id));
    return { runId: run.id, verified: 0, valid: 0, invalid: 0, risky: 0, error: "APIFY_API_TOKEN tanımlı değil" };
  }

  try {
    // Doğrulanmamış leadleri çek
    const pending = await db
      .select({ id: outreachLeadsTable.id, email: outreachLeadsTable.email })
      .from(outreachLeadsTable)
      .where(and(eq(outreachLeadsTable.emailVerified, false), isNull(outreachLeadsTable.emailVerifiedAt)))
      .limit(batchSize);

    if (pending.length === 0) {
      await db
        .update(outreachRunsTable)
        .set({ status: "success", completedAt: new Date() })
        .where(eq(outreachRunsTable.id, run.id));
      return { runId: run.id, verified: 0, valid: 0, invalid: 0, risky: 0 };
    }

    const emails = pending.map((p) => p.email);

    // Apify'a gönder
    const { items } = await client.runActorSync<EmailVerifyResult>(
      "blackbird-team/email-verifier",
      { emails },
      300,
    );

    // Sonuçları DB'ye yaz
    let valid = 0;
    let invalid = 0;
    let risky = 0;
    const now = new Date();

    for (const result of items) {
      const status = normalizeStatus(result);
      const targetEmail = result.email?.toLowerCase().trim();
      if (!targetEmail) continue;

      await db
        .update(outreachLeadsTable)
        .set({
          emailVerified: true,
          emailStatus: status,
          emailVerifiedAt: now,
          updatedAt: now,
        })
        .where(eq(outreachLeadsTable.email, targetEmail));

      if (status === "valid") valid++;
      else if (status === "invalid") invalid++;
      else if (status === "risky" || status === "catch_all") risky++;
    }

    await db
      .update(outreachRunsTable)
      .set({
        status: "success",
        emailsVerified: items.length,
        completedAt: new Date(),
      })
      .where(eq(outreachRunsTable.id, run.id));

    return { runId: run.id, verified: items.length, valid, invalid, risky };
  } catch (err: any) {
    const errorMessage = err?.message ?? String(err);
    await db
      .update(outreachRunsTable)
      .set({ status: "failed", errorMessage, completedAt: new Date() })
      .where(eq(outreachRunsTable.id, run.id));

    return { runId: run.id, verified: 0, valid: 0, invalid: 0, risky: 0, error: errorMessage };
  }
}
