/**
 * User CEFR level helper — AI endpoint'lerinde prompt'a seviye enjekte etmek için.
 *
 * Placement test tamamlanan öğrencinin CEFR seviyesi users.current_level'da saklanır
 * (A1..C2). Onboarding sonrası, placement test bitince set edilir.
 *
 * Kullanım:
 *   import { getUserLevel, levelInstruction } from "../lib/user-level";
 *   const level = await getUserLevel(userId);
 *   const guidance = levelInstruction(level);
 *   const prompt = `${basePrompt}\n\n${guidance}`;
 */

import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export type Cefr = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
const CEFR_SET = new Set<Cefr>(["A1", "A2", "B1", "B2", "C1", "C2"]);

/**
 * Kullanıcının mevcut CEFR seviyesini döner.
 * Placement test tamamlanmadıysa veya level set edilmediyse null döner
 * (caller default davranışa devam eder — genelde B1 kabul edilir).
 */
export async function getUserLevel(userId: number): Promise<Cefr | null> {
  try {
    const [user] = await db
      .select({ current: usersTable.currentLevel })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);
    const lvl = user?.current;
    if (typeof lvl === "string" && CEFR_SET.has(lvl as Cefr)) return lvl as Cefr;
    return null;
  } catch {
    return null;
  }
}

/**
 * AI prompt'una eklenecek seviye rehberi metni.
 *
 * Türkçe destek (A1-A2 için): Bu seviyelerde AI kullanıcıyla
 * Türkçe açıklamalar yapmalı, İngilizce örnekleri basit tutmalı.
 */
export function levelInstruction(level: Cefr | null, opts: { includeTurkishSupport?: boolean } = {}): string {
  const lvl = level ?? "B1"; // default: orta seviye
  const withTr = opts.includeTurkishSupport !== false;

  const map: Record<Cefr, string> = {
    A1: withTr
      ? "The user is at CEFR **A1** (beginner). Use very simple English (5-8 word sentences, present simple). Provide **Turkish explanations** for grammar and vocabulary. Show short bilingual examples: 'I work → Çalışıyorum'."
      : "The user is at CEFR **A1** (beginner). Use very simple English (5-8 word sentences, present simple).",
    A2: withTr
      ? "The user is at CEFR **A2** (elementary). Use simple English with past simple, present continuous. Explain new grammar terms in **Turkish**. Give bilingual examples when helpful."
      : "The user is at CEFR **A2** (elementary). Use simple English with past simple, present continuous.",
    B1: "The user is at CEFR **B1** (intermediate). Use natural intermediate-level English. Introduce common business idioms occasionally. Explanations should be in English but you can support with a Turkish phrase if the concept is complex.",
    B2: "The user is at CEFR **B2** (upper intermediate). Use natural business English with idioms, phrasal verbs, and complex sentence structures. Explanations in English.",
    C1: "The user is at CEFR **C1** (advanced). Use sophisticated, nuanced English. Introduce advanced business jargon, formal register, subtle grammatical distinctions.",
    C2: "The user is at CEFR **C2** (proficient). Use native-level English with complex rhetorical structures, idiomatic expressions, and register variation.",
  };

  return `\n\n[CEFR CALIBRATION]\n${map[lvl]}\n\nAlways stay within this level. Do not use vocabulary or grammar significantly above this level.`;
}

/** Level'ı hedef içerik filter'ı için kullan — user seviyesindeki ve altındaki içerikleri getir */
export function levelsAtOrBelow(level: Cefr | null): Cefr[] {
  const order: Cefr[] = ["A1", "A2", "B1", "B2", "C1", "C2"];
  const idx = level ? order.indexOf(level) : 2; // default B1
  return order.slice(0, idx + 1);
}
