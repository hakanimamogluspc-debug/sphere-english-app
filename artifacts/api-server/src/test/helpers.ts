import crypto from "node:crypto";
import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../app";
import { pool } from "@workspace/db";
import { TEST_INTERNAL_SECRET, TEST_JWT_SECRET } from "./test-env.js";

export const api = () => request(app);

/** Testler arası temiz başlangıç — kullanıcı ve ödeme verisini sıfırlar */
export async function resetDb(): Promise<void> {
  await pool.query(`
    TRUNCATE TABLE
      users,
      subscriptions,
      payments,
      pending_subscription_drafts,
      account_setup_tokens
    RESTART IDENTITY CASCADE
  `);
}

let seq = 0;
export function uniqueEmail(prefix = "test"): string {
  seq += 1;
  return `${prefix}+${Date.now()}${seq}@sphere-test.invalid`;
}

export const VALID_PASSWORD = "Sphere!Test2026";

export async function registerUser(overrides: Record<string, unknown> = {}) {
  const email = (overrides.email as string) ?? uniqueEmail();
  const res = await api()
    .post("/api/auth/register")
    .send({
      email,
      password: VALID_PASSWORD,
      firstName: "Test",
      lastName: "Kullanıcı",
      accountType: "bireysel",
      termsAccepted: true,
      ...overrides,
    });
  return { res, email, token: res.body?.token as string | undefined, user: res.body?.user };
}

/** Doğrudan JWT üret — login'i atlayıp yetkili istek atmak için */
export function tokenFor(userId: number, role = "student", accountType = "bireysel"): string {
  return jwt.sign({ userId, role, accountType }, TEST_JWT_SECRET, { expiresIn: "1h" });
}

/** Admin kullanıcı oluştur (DB'de rolü yükselterek) */
export async function createAdmin() {
  const { user } = await registerUser();
  await pool.query(`UPDATE users SET role = 'admin' WHERE id = $1`, [user.id]);
  return { id: user.id as number, token: tokenFor(user.id, "admin") };
}

/** www → api iç çağrılarının imzası (internal-payment.ts ile aynı formül) */
export function internalSignature(body: unknown): string {
  return crypto.createHmac("sha256", TEST_INTERNAL_SECRET).update(JSON.stringify(body)).digest("hex");
}

export async function closeDb(): Promise<void> {
  await pool.end().catch(() => {});
}
